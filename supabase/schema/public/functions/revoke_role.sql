-- Canonical schema: public.revoke_role
-- Originally created: migration 0068_role_system
--
-- Privilege rules:
--   - super_admin or admin may call
--   - revoking super_admin or admin requires existing super_admin
--   - service-role calls (auth.uid() is null) bypass actor checks
--
-- Side effects: sets revoked_at on the assignment + writes one
-- role_audit_log row.

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
