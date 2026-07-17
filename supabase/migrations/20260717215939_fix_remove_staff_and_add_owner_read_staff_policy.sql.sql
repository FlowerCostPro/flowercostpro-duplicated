/*
# Fix: Restore remove_staff_member to SECURITY DEFINER + add owner-read-staff RLS

## Problem 1: remove_staff_member can't delete from auth.users
The function does `DELETE FROM auth.users WHERE id = p_staff_id`.
As SECURITY INVOKER, the authenticated role has no DELETE privilege on
auth.users. It must be SECURITY DEFINER to run as postgres.

## Problem 2: get_my_staff can't read staff profiles
The function (SECURITY INVOKER) queries `profiles WHERE owner_id = auth.uid()`.
But RLS on profiles only allows:
  - Users reading their own profile (auth.uid() = id)
  - Staff reading their owner's profile (id = get_owner_id_for_user(auth.uid()))
There's no policy for owners to read their staff's profiles. Add one.
*/

-- 1. Switch remove_staff_member back to SECURITY DEFINER
ALTER FUNCTION public.remove_staff_member(uuid) SECURITY DEFINER;

-- 2. Add RLS policy: owners can SELECT their staff's profiles
CREATE POLICY "owner_read_staff_profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());
