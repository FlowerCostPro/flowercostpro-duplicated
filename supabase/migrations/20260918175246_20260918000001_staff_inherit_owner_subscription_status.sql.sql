/*
# Staff accounts inherit owner's subscription status

## Problem
When a staff member calls `get_owner_profile()`, it returns their own
`subscription_status` and `trial_ends_at` — both default to 'trialing' and
a trial end date. This means:
1. In the admin dashboard, staff of a paying florist appear as "trialing"
   instead of "active".
2. The subscription banner and paywall logic use this status, so staff
   see incorrect subscription state.

## Fix
For staff accounts (account_role = 'staff'), resolve the owner's profile
via `owner_id` and return the OWNER's `subscription_status`, `trial_ends_at`,
and `subscribed_at` instead of the staff member's own. The staff member's
own `full_name`, `store_name`, `is_admin`, `account_role`, and `owner_id`
are still returned as-is.

## Security
- No new tables or columns.
- No RLS changes.
- The function is SECURITY DEFINER and already grants EXECUTE to authenticated.
- Staff can already see their owner's subscription status through the app UI;
  this just makes the RPC return the correct values.
*/

CREATE OR REPLACE FUNCTION public.get_owner_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_owner_id uuid;
  v_owner_sub_status text;
  v_owner_trial_ends timestamptz;
  v_owner_subscribed_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get the caller's own profile, including owner_id for staff
  SELECT p.owner_id, p.account_role
    INTO v_owner_id
  FROM profiles p
  WHERE p.id = v_user_id;

  -- For staff: fetch the owner's subscription fields
  IF v_owner_id IS NOT NULL THEN
    SELECT p.subscription_status, p.trial_ends_at, p.subscribed_at
      INTO v_owner_sub_status, v_owner_trial_ends, v_owner_subscribed_at
    FROM profiles p
    WHERE p.id = v_owner_id;
  END IF;

  -- Build the result. For staff, use the owner's subscription fields.
  -- For owners, use their own (COALESCE handles the NULL case).
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'store_name', p.store_name,
    'subscription_status', COALESCE(v_owner_sub_status, p.subscription_status),
    'trial_ends_at', COALESCE(v_owner_trial_ends, p.trial_ends_at),
    'subscribed_at', COALESCE(v_owner_subscribed_at, p.subscribed_at),
    'is_admin', p.is_admin,
    'account_role', p.account_role,
    'owner_id', p.owner_id
  )
  INTO v_result
  FROM profiles p
  WHERE p.id = v_user_id;

  RETURN v_result;
END;
$$;
