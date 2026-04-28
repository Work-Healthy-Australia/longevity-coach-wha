-- Admin invite system (2026-04-28).
-- Stores pending admin invitations by email. When an invited email signs up,
-- the handle_new_user trigger auto-grants is_admin and marks the invite accepted.

CREATE TABLE IF NOT EXISTS public.admin_invites (
  email      text        PRIMARY KEY,
  invited_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Only service-role can read or write this table.
DROP POLICY IF EXISTS "admin_invites_deny_all" ON public.admin_invites;
CREATE POLICY "admin_invites_deny_all" ON public.admin_invites USING (false);

-- Update handle_new_user to auto-grant admin when the email was pre-invited.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.admin_invites
    WHERE email = new.email AND accepted_at IS NULL
  ) INTO v_is_admin;

  INSERT INTO public.profiles (id, full_name, is_admin)
  VALUES (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    v_is_admin
  );

  -- Mark invite accepted so it isn't re-used.
  IF v_is_admin THEN
    UPDATE public.admin_invites
    SET accepted_at = now()
    WHERE email = new.email;
  END IF;

  RETURN new;
END;
$$;
