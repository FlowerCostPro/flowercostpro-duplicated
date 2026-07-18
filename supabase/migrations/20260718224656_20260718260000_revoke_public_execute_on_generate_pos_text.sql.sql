/*
# Revoke PUBLIC EXECUTE on generate_pos_text (anon inheritance fix)

## Problem
The prior migration ran `REVOKE EXECUTE ... FROM anon`, but anon still has
EXECUTE because the function was also granted to PUBLIC (grantee_oid 0), and
every role — including anon — inherits PUBLIC's privileges. Revoking from anon
alone has no effect when PUBLIC still grants it.

## Fix
Revoke EXECUTE from PUBLIC and from anon explicitly. authenticated has its own
direct grant (verified: grantee_oid 16481), so it keeps EXECUTE and staff
workflows are unaffected.

## Verified before/after grantee oids
- 0        = PUBLIC  (inherits to anon)  -> REVOKE
- 16480    = anon                         -> REVOKE
- 16481    = authenticated                -> KEEP (staff workflows)
- 16384    = postgres/supabase admin      -> KEEP (admin)

## No other changes
- generate_pos_text internal logic untouched.
- authenticated EXECUTE untouched.
- No table SELECT grants touched.
*/

REVOKE EXECUTE ON FUNCTION public.generate_pos_text(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_pos_text(uuid) FROM anon;
