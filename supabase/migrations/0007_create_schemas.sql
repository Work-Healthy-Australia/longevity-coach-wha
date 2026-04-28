-- Migration 0007: Create isolated schemas
--
--   biomarkers — all patient measurements, lab data, and uploads
--   billing    — financial layer (designed as a standalone platform)
--
-- Everything else lives in public. These two schemas are isolated because
-- biomarkers has its own access patterns (service_role writes, patient reads)
-- and billing will be extracted into its own platform.

create schema if not exists biomarkers;
grant usage on schema biomarkers to anon, authenticated, service_role;
alter default privileges in schema biomarkers grant all on tables to anon, authenticated, service_role;
alter default privileges in schema biomarkers grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema biomarkers grant all on routines to anon, authenticated, service_role;

create schema if not exists billing;
grant usage on schema billing to anon, authenticated, service_role;
alter default privileges in schema billing grant all on tables to anon, authenticated, service_role;
alter default privileges in schema billing grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema billing grant all on routines to anon, authenticated, service_role;
