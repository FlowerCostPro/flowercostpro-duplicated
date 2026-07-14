/*
# Fix staff_invites anon SELECT policy

The `anon_read_invite_by_token` policy used `USING (true)`, allowing
anyone (including unauthenticated anon) to SELECT ALL staff_invites
rows — exposing owner_id, staff email, and invite tokens.

Fix: restrict to only allow reading a specific invite by its token.
The frontend always filters by token, so this doesn't break the signup
flow. We use a session variable set by the client (request.headers)
or, more reliably, restrict to only return rows where the token
matches a query parameter.

Since PostgREST doesn't support per-row token filtering via query params
in RLS, we use a SECURITY DEFINER function instead for the public lookup.
The anon policy is removed entirely; the edge function handles the
public token validation.
*/

-- Remove the overly permissive anon SELECT policy
DROP POLICY IF EXISTS "anon_read_invite_by_token" ON staff_invites;

-- Create a SECURITY DEFINER function for public invite lookup by token
CREATE OR REPLACE FUNCTION get_staff_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
    'accepted', si.accepted
  )
  INTO v_result
  FROM staff_invites si
  WHERE si.token = p_token
    AND si.accepted = false
    AND si.expires_at > now();

  RETURN v_result;
END;
$$;
