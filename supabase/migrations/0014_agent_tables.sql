-- Migration 0014: agent system tables
--
-- Adds to risk_scores:
--   narrative     : human-readable risk story (Risk Narrative Pipeline writes)
--   engine_output : reserved for future deterministic risk engine output
--   data_gaps     : missing data that would improve confidence
--
-- New tables:
--   agent_conversations : one row per Janet/Alex message turn
--   support_tickets     : Alex escalation records (service_role writes)
--   appointments        : Janet booking confirmations (service_role writes)
--
-- Writers: service_role only for all new tables (agent layer uses admin client).
-- Readers: patient sees own rows; admin sees all.

-- ============================================================================
-- risk_scores — new columns
-- ============================================================================

alter table public.risk_scores
  add column if not exists narrative     text,
  add column if not exists engine_output jsonb,
  add column if not exists data_gaps     text[] not null default '{}';

-- ============================================================================
-- agent_conversations
-- ============================================================================

create table if not exists public.agent_conversations (
  id          uuid        primary key default gen_random_uuid(),
  user_uuid   uuid        not null references auth.users(id) on delete cascade,
  agent       text        not null check (agent in ('janet', 'pt_coach_live', 'alex')),
  role        text        not null check (role in ('user', 'assistant')),
  content     text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists agent_conversations_user_agent_idx
  on public.agent_conversations(user_uuid, agent, created_at desc);

alter table public.agent_conversations enable row level security;

drop policy if exists "agent_conv_patient_select"  on public.agent_conversations;
drop policy if exists "agent_conv_service_insert"  on public.agent_conversations;
drop policy if exists "agent_conv_admin_all"        on public.agent_conversations;

-- Patient can read their own conversation turns
create policy "agent_conv_patient_select" on public.agent_conversations
  for select using (auth.uid() = user_uuid);

-- Only service_role can write (agent uses admin client)
create policy "agent_conv_service_insert" on public.agent_conversations
  for insert with check (auth.role() = 'service_role');

create policy "agent_conv_admin_all" on public.agent_conversations
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

-- ============================================================================
-- support_tickets
-- ============================================================================

create table if not exists public.support_tickets (
  id               uuid        primary key default gen_random_uuid(),
  user_uuid        uuid        not null references auth.users(id) on delete cascade,
  persona          text        not null check (persona in ('patient', 'clinician', 'b2b_admin', 'b2b_member')),
  category         text        not null check (category in (
                     'account', 'billing', 'technical', 'feature_request',
                     'data', 'wearables', 'onboarding', 'clinical',
                     'corporate', 'integration', 'other'
                   )),
  summary          text        not null,
  conversation_ref uuid        references public.agent_conversations(id) on delete set null,
  status           text        not null default 'open'
                   check (status in ('open', 'in_progress', 'resolved', 'escalated')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists support_tickets_user_uuid_idx
  on public.support_tickets(user_uuid);
create index if not exists support_tickets_status_idx
  on public.support_tickets(status);

alter table public.support_tickets enable row level security;

drop policy if exists "support_tickets_patient_select"  on public.support_tickets;
drop policy if exists "support_tickets_service_insert"  on public.support_tickets;
drop policy if exists "support_tickets_service_update"  on public.support_tickets;
drop policy if exists "support_tickets_admin_all"       on public.support_tickets;

create policy "support_tickets_patient_select" on public.support_tickets
  for select using (auth.uid() = user_uuid);

create policy "support_tickets_service_insert" on public.support_tickets
  for insert with check (auth.role() = 'service_role');

create policy "support_tickets_service_update" on public.support_tickets
  for update using (auth.role() = 'service_role');

create policy "support_tickets_admin_all" on public.support_tickets
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- ============================================================================
-- appointments
-- ============================================================================

create table if not exists public.appointments (
  id                  uuid        primary key default gen_random_uuid(),
  patient_uuid        uuid        not null references auth.users(id) on delete cascade,
  clinician_uuid      uuid        references auth.users(id) on delete set null,
  appointment_type    text        not null check (appointment_type in ('clinician_review', 'coaching_session')),
  scheduled_at        timestamptz not null,
  duration_minutes    smallint    not null default 30,
  status              text        not null default 'pending'
                      check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  notes               text,
  conversation_ref    uuid        references public.agent_conversations(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists appointments_patient_uuid_idx
  on public.appointments(patient_uuid);
create index if not exists appointments_clinician_uuid_idx
  on public.appointments(clinician_uuid);
create index if not exists appointments_scheduled_at_idx
  on public.appointments(scheduled_at);

alter table public.appointments enable row level security;

drop policy if exists "appointments_patient_select"    on public.appointments;
drop policy if exists "appointments_clinician_select"  on public.appointments;
drop policy if exists "appointments_service_insert"    on public.appointments;
drop policy if exists "appointments_service_update"    on public.appointments;
drop policy if exists "appointments_admin_all"         on public.appointments;

create policy "appointments_patient_select" on public.appointments
  for select using (auth.uid() = patient_uuid);

create policy "appointments_clinician_select" on public.appointments
  for select using (
    (auth.jwt() ->> 'role') = 'clinician' and clinician_uuid = auth.uid()
  );

create policy "appointments_service_insert" on public.appointments
  for insert with check (auth.role() = 'service_role');

create policy "appointments_service_update" on public.appointments
  for update using (auth.role() = 'service_role');

create policy "appointments_admin_all" on public.appointments
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();
