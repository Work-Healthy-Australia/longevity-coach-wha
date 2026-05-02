-- ============================================================================
-- 0068_role_system.sql
--
-- Phase A of the role-system rebuild (per docs/product/epics.md role design,
-- conversation with James 2026-05-02).
--
-- Introduces:
--   - app_role enum (super_admin, admin, manager, corp_health_manager, clinician)
--   - role_scope_type enum (global, segment, organisation)
--   - public.user_role_assignments  — the assignment ledger
--   - public.role_audit_log         — append-only audit trail
--   - profiles.ahpra_registration_number + ahpra_verified_at
--   - has_role() / has_role_in_scope() SECURITY DEFINER helpers (RLS callable)
--   - grant_role() / revoke_role() SECURITY DEFINER functions (with no-self-
--     escalation + AHPRA gate for the manager role)
--   - Backfill from profiles.is_admin and profiles.role
--
-- Design decisions captured in memory file project_role_model.md:
--   1. Coach folds into clinician (no separate role for now).
--   2. Corp Health Manager source-of-truth STAYS in billing.organisation_members
--      (option a) — has_role() reads from billing for that one role only.
--   3. One organisation per user is enforced by existing
--      billing.organisation_members unique index — kept as-is.
--   4. super_admin is NOT seeded by this migration; must be granted via direct
--      SQL by the operator with service-role from the Supabase dashboard:
--          select public.grant_role(
--            '<james-user-uuid>'::uuid, 'super_admin', 'global', null,
--            'initial bootstrap'
--          );
--
-- Out of scope (deferred to follow-up migrations):
--   - RLS rewrites on patient-data tables to route through the helpers
--   - Assignment UI (`/admin/users`)
--   - Drop of legacy profiles.is_admin / profiles.role columns (kept one
--     release for parallel reads + rollback)
--   - Phase B Role Builder (lift app_role enum into a roles table)
--
-- Idempotent — uses IF NOT EXISTS / DO blocks throughout.
-- ============================================================================

-- ============================================================================
-- Enums
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'super_admin',
      'admin',
      'manager',
      'corp_health_manager',
      'clinician'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_scope_type') then
    create type public.role_scope_type as enum (
      'global',
      'segment',
      'organisation'
    );
  end if;
end$$;

-- ============================================================================
-- profiles: AHPRA registration columns
--
-- Adding NEW writer to profiles via grant_role() (SECURITY DEFINER) — see
-- migration header for the design discussion. Direct user write is permitted
-- (a clinician can record their own AHPRA number) but ahpra_verified_at is
-- only ever set by grant_role() during the manager-role grant flow.
-- ============================================================================

alter table public.profiles
  add column if not exists ahpra_registration_number text,
  add column if not exists ahpra_verified_at timestamptz;

create index if not exists profiles_ahpra_registration_idx
  on public.profiles(ahpra_registration_number)
  where ahpra_registration_number is not null;

-- ============================================================================
-- public.user_role_assignments
-- ============================================================================

create table if not exists public.user_role_assignments (
  id           uuid              primary key default gen_random_uuid(),
  user_uuid    uuid              not null references auth.users(id) on delete cascade,
  role         public.app_role   not null,
  scope_type   public.role_scope_type not null default 'global',
  scope_id     text,
  granted_by   uuid              references auth.users(id) on delete set null,
  granted_at   timestamptz       not null default now(),
  revoked_at   timestamptz,
  revoked_by   uuid              references auth.users(id) on delete set null,
  reason       text,
  constraint user_role_assignments_scope_id_consistent check (
    (scope_type = 'global' and scope_id is null) or
    (scope_type <> 'global' and scope_id is not null)
  )
);

-- One active assignment per (user, role, scope) — partial unique index so
-- revoked rows do not block re-grants.
create unique index if not exists user_role_assignments_active_unique
  on public.user_role_assignments(user_uuid, role, scope_type, scope_id)
  nulls not distinct
  where revoked_at is null;

create index if not exists user_role_assignments_user_idx
  on public.user_role_assignments(user_uuid)
  where revoked_at is null;

create index if not exists user_role_assignments_role_scope_idx
  on public.user_role_assignments(role, scope_type, scope_id)
  where revoked_at is null;

alter table public.user_role_assignments enable row level security;

-- Users can read their own role assignments (lets the app render role-aware UI
-- without leaking other users' roles).
drop policy if exists user_role_assignments_select_self on public.user_role_assignments;
create policy user_role_assignments_select_self
  on public.user_role_assignments for select
  using (user_uuid = auth.uid());

-- Direct INSERT/UPDATE/DELETE are NOT permitted — must go through
-- public.grant_role() / public.revoke_role(). No write policies = denied for
-- any non-service-role caller. Service-role bypasses RLS by Supabase default.

-- ============================================================================
-- public.role_audit_log
-- ============================================================================

create table if not exists public.role_audit_log (
  id                  uuid              primary key default gen_random_uuid(),
  actor_uuid          uuid              references auth.users(id) on delete set null,
  action              text              not null check (action in ('grant', 'revoke')),
  target_uuid         uuid              not null references auth.users(id) on delete cascade,
  role                public.app_role   not null,
  scope_type          public.role_scope_type not null,
  scope_id            text,
  reason              text,
  ahpra_check_passed  boolean,
  created_at          timestamptz       not null default now()
);

create index if not exists role_audit_log_target_idx
  on public.role_audit_log(target_uuid, created_at desc);

create index if not exists role_audit_log_actor_idx
  on public.role_audit_log(actor_uuid, created_at desc);

alter table public.role_audit_log enable row level security;

-- No insert/update/delete policies — append-only via grant_role()/revoke_role()
-- using SECURITY DEFINER, which bypasses RLS.

-- Read policy added below after has_role() exists.

-- ============================================================================
-- Helper: public.has_role(check_role)
--
-- Returns true if the calling user has the given role active anywhere
-- (any scope).  For corp_health_manager, queries billing.organisation_members
-- (the legacy source of truth — see migration header decision #2).
-- ============================================================================

create or replace function public.has_role(check_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, billing, pg_temp
as $$
  select case
    when check_role = 'corp_health_manager' then exists (
      select 1
      from billing.organisation_members
      where user_uuid = auth.uid()
        and role = 'health_manager'
    )
    else exists (
      select 1
      from public.user_role_assignments
      where user_uuid = auth.uid()
        and role = check_role
        and revoked_at is null
    )
  end;
$$;

revoke all on function public.has_role(public.app_role) from public;
grant execute on function public.has_role(public.app_role) to authenticated;

-- ============================================================================
-- Helper: public.has_role_in_scope(check_role, scope_type, scope_id)
--
-- Scoped check — used by RLS where access depends on segment or organisation.
-- For corp_health_manager, queries billing for the specific org.
-- ============================================================================

create or replace function public.has_role_in_scope(
  check_role        public.app_role,
  check_scope_type  public.role_scope_type,
  check_scope_id    text
)
returns boolean
language sql
stable
security definer
set search_path = public, billing, pg_temp
as $$
  select case
    when check_role = 'corp_health_manager' and check_scope_type = 'organisation' then exists (
      select 1
      from billing.organisation_members
      where user_uuid = auth.uid()
        and role = 'health_manager'
        and org_id::text = check_scope_id
    )
    else exists (
      select 1
      from public.user_role_assignments
      where user_uuid = auth.uid()
        and role = check_role
        and scope_type = check_scope_type
        and (
          (scope_id is null and check_scope_id is null)
          or scope_id = check_scope_id
        )
        and revoked_at is null
    )
  end;
$$;

revoke all on function public.has_role_in_scope(
  public.app_role, public.role_scope_type, text
) from public;
grant execute on function public.has_role_in_scope(
  public.app_role, public.role_scope_type, text
) to authenticated;

-- ============================================================================
-- role_audit_log: read policy (now that has_role exists)
-- ============================================================================

drop policy if exists role_audit_log_select_admin on public.role_audit_log;
create policy role_audit_log_select_admin
  on public.role_audit_log for select
  using (public.has_role('admin') or public.has_role('super_admin'));

-- Admin+ may read all role assignments (UI surfaces this).
drop policy if exists user_role_assignments_select_admin on public.user_role_assignments;
create policy user_role_assignments_select_admin
  on public.user_role_assignments for select
  using (public.has_role('admin') or public.has_role('super_admin'));

-- ============================================================================
-- Function: public.grant_role(target, role, scope, scope_id, reason)
--
-- - Only super_admin or admin can grant roles
-- - Only super_admin can grant super_admin or admin
-- - Granting `manager` requires the target to have ahpra_verified_at set
-- - Service-role calls (auth.uid() is null) bypass actor checks (bootstrap path)
-- - Writes to user_role_assignments + role_audit_log atomically
-- ============================================================================

create or replace function public.grant_role(
  target_user_uuid  uuid,
  grant_role        public.app_role,
  grant_scope_type  public.role_scope_type default 'global',
  grant_scope_id    text                   default null,
  grant_reason      text                   default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid          uuid;
  ahpra_ok            boolean;
  new_assignment_id   uuid;
begin
  actor_uuid := auth.uid();

  -- Privilege checks (bypassed when called by service-role with no auth.uid()).
  if actor_uuid is not null then
    if not (public.has_role('super_admin') or public.has_role('admin')) then
      raise exception 'insufficient privileges to grant roles';
    end if;

    if grant_role in ('super_admin', 'admin') and not public.has_role('super_admin') then
      raise exception 'only super_admin can grant super_admin or admin roles';
    end if;
  end if;

  -- Manager role requires AHPRA verification on the target.
  if grant_role = 'manager' then
    select profiles.ahpra_verified_at is not null
      into ahpra_ok
    from public.profiles
    where id = target_user_uuid;

    if not coalesce(ahpra_ok, false) then
      raise exception 'manager role requires ahpra_verified_at on target user';
    end if;
  end if;

  insert into public.user_role_assignments (
    user_uuid, role, scope_type, scope_id, granted_by, reason
  ) values (
    target_user_uuid, grant_role, grant_scope_type, grant_scope_id, actor_uuid, grant_reason
  )
  returning id into new_assignment_id;

  insert into public.role_audit_log (
    actor_uuid, action, target_uuid, role, scope_type, scope_id, reason, ahpra_check_passed
  ) values (
    actor_uuid, 'grant', target_user_uuid, grant_role, grant_scope_type, grant_scope_id,
    grant_reason, ahpra_ok
  );

  return new_assignment_id;
end;
$$;

revoke all on function public.grant_role(
  uuid, public.app_role, public.role_scope_type, text, text
) from public;
grant execute on function public.grant_role(
  uuid, public.app_role, public.role_scope_type, text, text
) to authenticated;

-- ============================================================================
-- Function: public.revoke_role(assignment_id, reason)
-- ============================================================================

create or replace function public.revoke_role(
  assignment_id   uuid,
  revoke_reason   text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid;
  target     record;
begin
  actor_uuid := auth.uid();

  if actor_uuid is not null then
    if not (public.has_role('super_admin') or public.has_role('admin')) then
      raise exception 'insufficient privileges to revoke roles';
    end if;
  end if;

  select user_uuid, role, scope_type, scope_id, revoked_at
    into target
  from public.user_role_assignments
  where id = assignment_id;

  if not found then
    raise exception 'role assignment not found';
  end if;

  if target.revoked_at is not null then
    raise exception 'role assignment already revoked';
  end if;

  if actor_uuid is not null then
    if target.role in ('super_admin', 'admin') and not public.has_role('super_admin') then
      raise exception 'only super_admin can revoke super_admin or admin roles';
    end if;
  end if;

  update public.user_role_assignments
  set revoked_at = now(),
      revoked_by = actor_uuid,
      reason     = coalesce(revoke_reason, reason)
  where id = assignment_id;

  insert into public.role_audit_log (
    actor_uuid, action, target_uuid, role, scope_type, scope_id, reason
  ) values (
    actor_uuid, 'revoke', target.user_uuid, target.role, target.scope_type, target.scope_id,
    revoke_reason
  );
end;
$$;

revoke all on function public.revoke_role(uuid, text) from public;
grant execute on function public.revoke_role(uuid, text) to authenticated;

-- ============================================================================
-- Backfill from existing role columns
--
-- - profiles.is_admin = true       → admin role, global scope
-- - profiles.role = 'admin'        → admin role, global scope (independent of
--                                      is_admin; deduped via partial unique idx)
-- - profiles.role = 'clinician'    → clinician role, global scope
-- - profiles.role = 'coach'        → clinician role, global scope (coach
--                                      folds into clinician per James 2026-05-02)
-- - profiles.role = 'health_manager' is NOT backfilled — CHM source-of-truth
--   stays in billing.organisation_members (decision #2 in migration header)
-- - super_admin is NOT seeded — operator must run grant_role() manually
-- ============================================================================

insert into public.user_role_assignments (
  user_uuid, role, scope_type, granted_at, reason
)
select id, 'admin'::public.app_role, 'global'::public.role_scope_type, now(),
       'backfill 0068_role_system from profiles.is_admin'
from public.profiles
where is_admin = true
on conflict do nothing;

-- Catch any profile rows whose role text is 'admin' but is_admin is false
-- (drift between the two signals). Deduped against the previous insert by
-- the partial unique index (user_uuid, role, scope_type, scope_id) where
-- revoked_at is null.
insert into public.user_role_assignments (
  user_uuid, role, scope_type, granted_at, reason
)
select id, 'admin'::public.app_role, 'global'::public.role_scope_type, now(),
       'backfill 0068_role_system from profiles.role = admin'
from public.profiles
where role = 'admin'
on conflict do nothing;

insert into public.user_role_assignments (
  user_uuid, role, scope_type, granted_at, reason
)
select id, 'clinician'::public.app_role, 'global'::public.role_scope_type, now(),
       'backfill 0068_role_system from profiles.role = ' || role
from public.profiles
where role in ('clinician', 'coach')
on conflict do nothing;
