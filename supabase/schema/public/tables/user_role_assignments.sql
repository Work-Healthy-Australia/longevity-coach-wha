-- Canonical schema: public.user_role_assignments
-- Originally created: migration 0068_role_system

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

-- SELECT: own rows
create policy user_role_assignments_select_self
  on public.user_role_assignments for select
  using (user_uuid = auth.uid());

-- SELECT: admin / super_admin can read all
create policy user_role_assignments_select_admin
  on public.user_role_assignments for select
  using (public.has_role('admin') or public.has_role('super_admin'));

-- No INSERT/UPDATE/DELETE policies — writes only via public.grant_role() and
-- public.revoke_role() (SECURITY DEFINER).
