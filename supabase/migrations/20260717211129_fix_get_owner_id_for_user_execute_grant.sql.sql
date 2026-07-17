/*
# Fix: get_owner_id_for_user needs EXECUTE for authenticated

RLS policies on `profiles` call `get_owner_id_for_user(auth.uid())` to
determine if a staff member can read their owner's profile. When
`get_owner_profile` (SECURITY INVOKER) queries `profiles`, RLS evaluates
the `staff_read_owner_profile` policy which calls this function.

Since RLS policies run with the invoker's privileges, `authenticated`
needs EXECUTE on `get_owner_id_for_user`. The function is SECURITY DEFINER
but only reads `profiles.owner_id` for a given user id — it returns NULL
if the user doesn't exist, and can't be used for privilege escalation.
*/

GRANT EXECUTE ON FUNCTION public.get_owner_id_for_user(uuid) TO authenticated;
