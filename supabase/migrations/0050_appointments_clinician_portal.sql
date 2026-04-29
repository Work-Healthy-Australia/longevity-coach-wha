-- Migration 0050: clinician portal columns on appointments
--
-- The appointments table was originally created in 0014_agent_tables.sql with
-- scheduled_at + appointment_type + a single notes column. Migration 0048's
-- "create table if not exists" was a no-op because the table already existed,
-- so the clinician portal columns specced in clinician-portal.md never landed.
-- This migration adds them to the existing table.

alter table public.appointments
  add column if not exists video_link      text,
  add column if not exists patient_notes   text,
  add column if not exists clinician_notes text;
