/*
# Fix role column issues and add guard to accept_staff_invite

## Changes
1. accept_staff_invite: add guard — refuse to demote existing owners
2. Drop the dead `role` enum column from profiles
3. Drop the unused `user_role` enum type
*/

-- ============================================================
-- 1. accept_staff_invite: add guard against demoting owners
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_staff_invite(p_token text, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite staff_invites%ROWTYPE;
  v_existing_role text;
BEGIN
  SELECT * INTO v_invite
  FROM staff_invites
  WHERE token = p_token
  AND accepted = false
  AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  -- Guard: refuse to demote an existing shop owner to staff
  SELECT account_role INTO v_existing_role
  FROM profiles WHERE id = p_user_id;

  IF v_existing_role = 'owner' THEN
    RAISE EXCEPTION 'This account is a shop owner and can''t join as staff.';
  END IF;

  -- Link the user to the owner
  UPDATE profiles
  SET account_role = 'staff', owner_id = v_invite.owner_id
  WHERE id = p_user_id;

  -- Mark invite as accepted
  UPDATE staff_invites SET accepted = true WHERE id = v_invite.id;

  RETURN v_invite.owner_id;
END;
$function$;

-- ============================================================
-- 2. Drop the dead `role` enum column from profiles
--    Nothing reads it: no functions, no RLS policies, no triggers,
--    and the app exclusively uses account_role.
-- ============================================================
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- ============================================================
-- 3. Drop the now-unused user_role enum type
-- ============================================================
DROP TYPE IF EXISTS public.user_role;
