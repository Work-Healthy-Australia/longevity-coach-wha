-- Canonical schema: public.has_role
-- Originally created: migration 0068_role_system
--
-- RLS-callable helper. Returns true if the calling user has the given role
-- active anywhere. For corp_health_manager, queries the legacy
-- billing.organisation_members table (Phase A decision — see 0068 header).

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
