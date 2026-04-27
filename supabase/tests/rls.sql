-- pgTAP tests for RLS policies on public.* tables.
-- Run with: supabase db test
-- Each test creates two synthetic auth.users rows and asserts that one user
-- cannot see / mutate the other's data through RLS.

begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- ---------------------------------------------------------------------------
-- Setup: two synthetic users
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000000001', 'alice@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'bob@test.local',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- The handle_new_user trigger should have created profiles for both.
select isnt((select count(*) from public.profiles
  where id in (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  )), 0, 'profiles auto-created via trigger for new auth.users');

-- ---------------------------------------------------------------------------
-- profiles RLS
-- ---------------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000001' $$,
  ARRAY[1],
  'alice can read her own profile'
);

select results_eq(
  $$ select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000002' $$,
  ARRAY[0],
  'alice cannot read bob''s profile'
);

select lives_ok(
  $$ update public.profiles set full_name = 'Alice' where id = '00000000-0000-0000-0000-000000000001' $$,
  'alice can update her own profile'
);

select results_eq(
  $$ update public.profiles set full_name = 'hacked' where id = '00000000-0000-0000-0000-000000000002' returning 1 $$,
  ARRAY[]::int[],
  'alice cannot update bob''s profile (RLS hides the row)'
);

-- ---------------------------------------------------------------------------
-- health_profiles RLS
-- ---------------------------------------------------------------------------

reset role;
insert into public.health_profiles (user_uuid, responses)
values
  ('00000000-0000-0000-0000-000000000001', '{"basics":{"first_name":"Alice"}}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', '{"basics":{"first_name":"Bob"}}'::jsonb);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from public.health_profiles
     where user_uuid = '00000000-0000-0000-0000-000000000001' $$,
  ARRAY[1],
  'alice can read her own health_profiles'
);

select results_eq(
  $$ select count(*)::int from public.health_profiles
     where user_uuid = '00000000-0000-0000-0000-000000000002' $$,
  ARRAY[0],
  'alice cannot read bob''s health_profiles'
);

select lives_ok(
  $$ insert into public.health_profiles (user_uuid, responses)
     values ('00000000-0000-0000-0000-000000000001', '{}'::jsonb) $$,
  'alice can insert her own health_profile'
);

select throws_ok(
  $$ insert into public.health_profiles (user_uuid, responses)
     values ('00000000-0000-0000-0000-000000000002', '{}'::jsonb) $$,
  '42501',
  null,
  'alice cannot insert health_profile owned by bob'
);

-- ---------------------------------------------------------------------------
-- risk_scores RLS (read-only for owner; writes via service_role only)
-- ---------------------------------------------------------------------------

reset role;
insert into public.risk_scores (user_uuid, biological_age, cv_risk)
values
  ('00000000-0000-0000-0000-000000000001', 41.5, 0.12),
  ('00000000-0000-0000-0000-000000000002', 55.2, 0.30);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from public.risk_scores
     where user_uuid = '00000000-0000-0000-0000-000000000001' $$,
  ARRAY[1],
  'alice can read her own risk_scores'
);

select results_eq(
  $$ select count(*)::int from public.risk_scores
     where user_uuid = '00000000-0000-0000-0000-000000000002' $$,
  ARRAY[0],
  'alice cannot read bob''s risk_scores'
);

select throws_ok(
  $$ insert into public.risk_scores (user_uuid, biological_age)
     values ('00000000-0000-0000-0000-000000000001', 99.9) $$,
  '42501',
  null,
  'authenticated user cannot insert into risk_scores (only service_role)'
);

select throws_ok(
  $$ update public.risk_scores set biological_age = 1.0
     where user_uuid = '00000000-0000-0000-0000-000000000001' $$,
  null,
  null,
  'authenticated user cannot update risk_scores (only service_role)'
);

-- ---------------------------------------------------------------------------
-- subscriptions RLS (read-only for owner; writes via service_role only)
-- ---------------------------------------------------------------------------

reset role;
insert into public.subscriptions
  (user_uuid, stripe_customer_id, stripe_subscription_id, status)
values
  ('00000000-0000-0000-0000-000000000001', 'cus_alice', 'sub_alice', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'cus_bob',   'sub_bob',   'active');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from public.subscriptions
     where user_uuid = '00000000-0000-0000-0000-000000000001' $$,
  ARRAY[1],
  'alice can read her own subscription'
);

select results_eq(
  $$ select count(*)::int from public.subscriptions
     where user_uuid = '00000000-0000-0000-0000-000000000002' $$,
  ARRAY[0],
  'alice cannot read bob''s subscription'
);

select throws_ok(
  $$ insert into public.subscriptions
       (user_uuid, stripe_customer_id, stripe_subscription_id, status)
     values
       ('00000000-0000-0000-0000-000000000001','cus_x','sub_x','active') $$,
  '42501',
  null,
  'authenticated user cannot insert subscription (only service_role)'
);

select throws_ok(
  $$ update public.subscriptions set status = 'canceled'
     where user_uuid = '00000000-0000-0000-0000-000000000001' $$,
  null,
  null,
  'authenticated user cannot update subscription (only service_role)'
);

-- ---------------------------------------------------------------------------
-- Anonymous (unauthenticated) access
-- ---------------------------------------------------------------------------

reset role;
set local role anon;

select results_eq(
  $$ select count(*)::int from public.profiles $$,
  ARRAY[0],
  'anonymous user sees zero profiles (RLS blocks)'
);

select results_eq(
  $$ select count(*)::int from public.health_profiles $$,
  ARRAY[0],
  'anonymous user sees zero health_profiles (RLS blocks)'
);

select results_eq(
  $$ select count(*)::int from public.risk_scores $$,
  ARRAY[0],
  'anonymous user sees zero risk_scores (RLS blocks)'
);

select * from finish();

rollback;
