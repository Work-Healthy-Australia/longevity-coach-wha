-- Add agents.agent_conversations to the supabase_realtime publication so
-- clients can subscribe to INSERT events for assistant messages and dismiss
-- their "generating…" indicators without polling.
--
-- RLS still applies — clients only receive rows they could SELECT.
--
-- Idempotent via a DO block (ALTER PUBLICATION ... ADD TABLE has no IF NOT EXISTS).

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'agents'
      and tablename = 'agent_conversations'
  ) then
    execute 'alter publication supabase_realtime add table agents.agent_conversations';
  end if;
end$$;
