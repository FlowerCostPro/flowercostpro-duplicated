/*
# Add get_working_budget_for_staff RPC

## Problem
After restricting staff access to markup_settings, the staff OrderBuilder can
no longer read the owner's labor_percent. The client-side budget tracker was
silently using laborPct = 0, so no labor was being deducted from the customer
budget before presenting the "flower budget" to the designer.

## Solution
A SECURITY DEFINER function that:
1. Verifies the caller is a staff account.
2. Reads the owner's labor_percent from markup_settings server-side.
3. Returns ONLY the computed working_budget (customer_budget minus labor).

The labor_percent value is never returned to the client — only the derived
dollar amount is revealed, which is the minimum needed for the designer to
build to the right target.

## New function: get_working_budget_for_staff(p_customer_budget numeric)
- Input:  the gross customer-facing price (what the customer pays)
- Output: {working_budget: numeric} — the amount available for flowers/supplies
          after the owner's labor allocation has been silently removed
- Access: staff accounts only; returns an error for non-staff callers
*/

CREATE OR REPLACE FUNCTION get_working_budget_for_staff(
  p_customer_budget numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id   uuid;
  v_labor_pct  float8 := 0;
  v_working    numeric;
BEGIN
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not a staff account';
  END IF;

  SELECT COALESCE(labor_percent, 0)
  INTO v_labor_pct
  FROM markup_settings
  WHERE user_id = v_owner_id
  LIMIT 1;

  v_labor_pct := COALESCE(v_labor_pct, 0);
  v_working   := ROUND(p_customer_budget * (1 - v_labor_pct / 100.0), 2);

  RETURN jsonb_build_object('working_budget', v_working);
END;
$$;
