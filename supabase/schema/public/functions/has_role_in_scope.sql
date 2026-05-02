-- Canonical schema: public.has_role_in_scope
-- Originally created: migration 0068_role_system
--
-- Scoped variant of has_role(). For organisation-scoped checks against
-- corp_health_manager, queries billing.organisation_members.

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
