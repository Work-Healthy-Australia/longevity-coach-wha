-- Canonical schema: public.grant_role
-- Originally created: migration 0068_role_system
--
-- Privilege rules:
--   - super_admin or admin may call
--   - super_admin grants are restricted to existing super_admin
--   - admin grants are restricted to existing super_admin
--   - manager grants require ahpra_verified_at on the target user
--   - service-role calls (auth.uid() is null) bypass actor checks (bootstrap)
--
-- Side effects: writes one user_role_assignments row + one role_audit_log row.

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

  if actor_uuid is not null then
    if not (public.has_role('super_admin') or public.has_role('admin')) then
      raise exception 'insufficient privileges to grant roles';
    end if;

    if grant_role in ('super_admin', 'admin') and not public.has_role('super_admin') then
      raise exception 'only super_admin can grant super_admin or admin roles';
    end if;
  end if;

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
