/*
# Update get_staff_invite_by_token to return shop name

The invite acceptance page needs to show which shop invited the staff member.
The function now joins with profiles to return store_name.

Also re-grant anon EXECUTE — the invite page loads before the user has an
account, so it must be callable with only the anon key. The function only
reveals: email, expires_at, accepted, and store_name — no sensitive data.
*/

CREATE OR REPLACE FUNCTION get_staff_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', si.id,
    'owner_id', si.owner_id,
    'email', si.email,
    'expires_at', si.expires_at,
    'accepted', si.accepted,
    'store_name', p.store_name
  )
  INTO v_result
  FROM staff_invites si
  LEFT JOIN profiles p ON p.id = si.owner_id
  WHERE si.token = p_token
    AND si.accepted = false
    AND si.expires_at > now();

  RETURN v_result;
END;
$$;

-- Re-grant anon EXECUTE — invite page is pre-login
GRANT EXECUTE ON FUNCTION get_staff_invite_by_token(text) TO anon;
