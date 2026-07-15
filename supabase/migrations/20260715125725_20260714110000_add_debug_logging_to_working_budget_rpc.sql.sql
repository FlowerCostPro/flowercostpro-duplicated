/*
# Temporary debug logging in get_working_budget_for_staff

Adds RAISE LOG statements to trace:
  - which owner_id the function resolves for the caller
  - what labor_percent it reads from markup_settings
  - the final working_budget it computes

This is temporary and will be removed once the issue is diagnosed.
*/

CREATE OR REPLACE FUNCTION get_working_budget_for_staff(p_customer_budget numeric)
RETURNS TABLE (working_budget numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id   uuid;
  v_labor_pct  float8 := 0;
BEGIN
  v_owner_id := get_owner_id_for_user(auth.uid());
  RAISE LOG '[BUDGET-DEBUG-RPC] auth.uid()=%, resolved owner_id=%', auth.uid(), v_owner_id;

  IF v_owner_id IS NULL THEN
    RAISE LOG '[BUDGET-DEBUG-RPC] Access denied: not a staff account';
    RAISE EXCEPTION 'Access denied: not a staff account';
  END IF;

  SELECT COALESCE(labor_percent, 0)
  INTO v_labor_pct
  FROM markup_settings
  WHERE user_id = v_owner_id
  LIMIT 1;

  v_labor_pct := COALESCE(v_labor_pct, 0);

  RAISE LOG '[BUDGET-DEBUG-RPC] owner_id=%, labor_percent=%, customer_budget=%', v_owner_id, v_labor_pct, p_customer_budget;

  RETURN QUERY
    SELECT ROUND(p_customer_budget * (1 - v_labor_pct / 100.0), 2)::numeric;
END;
$$;
