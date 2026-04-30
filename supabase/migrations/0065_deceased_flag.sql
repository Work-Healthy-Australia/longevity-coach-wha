-- 0065_deceased_flag.sql
-- Adds deceased_at soft-marker and deceased_reported_by to profiles, plus
-- the append-only deceased_log audit table.
--
-- Admin-only flow: a team member marks a member as deceased after receiving
-- a notification from next-of-kin. This suspends access (proxy redirect)
-- and preserves data for clinical integrity. No self-service path.
--
-- Audit pattern mirrors erasure_log (migration 0054) — service_role-only
-- inserts (no INSERT policy), admin-only select. nullable FKs with
-- ON DELETE SET NULL so the audit row outlives a hard-delete.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deceased_at       timestamptz,
  ADD COLUMN IF NOT EXISTS deceased_reported_by uuid REFERENCES auth.users(id);

-- The proxy checks deceased_at to block access, similar to paused_at.
-- Admin can query deceased members for audit.
CREATE INDEX IF NOT EXISTS profiles_deceased_idx
  ON public.profiles (deceased_at)
  WHERE deceased_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- deceased_log — append-only audit trail for the admin mark/unmark flow.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.deceased_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Patient who was marked / unmarked. Nullable + ON DELETE SET NULL so the
  -- audit row survives a future hard-delete (matches erasure_log).
  target_user_uuid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Admin who performed the action.
  actor_uuid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('marked', 'unmarked')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  -- Request metadata for AHPRA-style audit forensics. Never identifies the
  -- patient on its own — same precedent as erasure_log / consent_records.
  request_ip text,
  request_user_agent text
);

CREATE INDEX IF NOT EXISTS deceased_log_target_user_uuid_idx
  ON public.deceased_log (target_user_uuid);
CREATE INDEX IF NOT EXISTS deceased_log_recorded_at_idx
  ON public.deceased_log (recorded_at DESC);

ALTER TABLE public.deceased_log ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS, so no INSERT policy is needed (matches
-- erasure_log + export_log convention). No owner-select by design — only
-- admins can review the deceased audit trail.
DROP POLICY IF EXISTS "deceased_log_admin_select" ON public.deceased_log;
CREATE POLICY "deceased_log_admin_select" ON public.deceased_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
