-- Canonical schema: public.role_audit_log
-- Originally created: migration 0068_role_system
--
-- Append-only. Every grant_role() / revoke_role() call writes one row.

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

-- SELECT: admin / super_admin only
create policy role_audit_log_select_admin
  on public.role_audit_log for select
  using (public.has_role('admin') or public.has_role('super_admin'));

-- No INSERT/UPDATE/DELETE policies — writes only via public.grant_role() and
-- public.revoke_role() (SECURITY DEFINER, append-only).
