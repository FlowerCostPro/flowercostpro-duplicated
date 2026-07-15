/*
# Add get_order_labor_amount RPC

Staff clients must not read the labor_percent setting to compute the labor
dollar amount for POS text. This SECURITY DEFINER function reads the owner's
labor_percent from markup_settings and computes:

  labor_amount = customer_price × (labor_percent / 100)

Returns NULL when labor_percent is 0/NULL or customer_price is NULL.
Never returns the percentage itself — only the dollar amount.

The caller must be a staff account (owner_id IS NOT NULL) and must own the
order (order belongs to the caller's owner).
*/

CREATE OR REPLACE FUNCTION get_order_labor_amount(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id    uuid;
  v_labor_pct   float8 := 0;
  v_customer_price numeric;
  v_order_owner uuid;
BEGIN
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not a staff account';
  END IF;

  SELECT customer_price
  INTO v_customer_price
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT user_id INTO v_order_owner FROM orders WHERE id = p_order_id;
  IF v_order_owner IS DISTINCT FROM v_owner_id THEN
    RAISE EXCEPTION 'Access denied: order does not belong to your shop';
  END IF;

  SELECT COALESCE(labor_percent, 0)
  INTO v_labor_pct
  FROM markup_settings
  WHERE user_id = v_owner_id
  LIMIT 1;

  v_labor_pct := COALESCE(v_labor_pct, 0);

  IF v_customer_price IS NOT NULL AND v_labor_pct > 0 THEN
    RETURN ROUND(v_customer_price * (v_labor_pct / 100.0), 2);
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_order_labor_amount(uuid) TO authenticated;
