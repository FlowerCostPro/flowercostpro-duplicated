/*
# Add generate_pos_text RPC

## Purpose
Staff accounts are blocked by RLS from reading product_templates and
markup_settings directly. The previous client-side POS text builder
silently produced $0.00 item prices for staff because it couldn't read
the retail price data.

This function builds the complete POS text server-side as a SECURITY
DEFINER function, bypassing RLS to read:
  - The order's products (from order_products)
  - The owner's markup settings (from markup_settings) to compute
    retail prices per item
  - The owner's labor_percent to compute the labor dollar amount

It returns ONLY:
  - Retail prices per item (never wholesale cost, never markup multipliers)
  - The labor dollar amount (never the labor percentage)
  - The total (customer_price if set, otherwise sum of retail)

If the order or any product data cannot be read, the function raises an
error rather than silently rendering $0.00.

## Security
  - Caller must be a staff account (get_owner_id_for_user returns non-null)
  - Order must belong to the caller's owner
  - Returns a single text value — the finished POS text
  - Never exposes cost, markup percentages, or profit figures

## Usage
Called from the shared posText.ts module by both OrderBuilder and
SavedOrders components.
*/

CREATE OR REPLACE FUNCTION generate_pos_text(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id        uuid;
  v_order_owner     uuid;
  v_order_name      text;
  v_staff_name      text;
  v_staff_id        text;
  v_created_at      timestamptz;
  v_photo           text;
  v_notes           text;
  v_customer_price  numeric;
  v_labor_pct       float8 := 0;
  v_stem_mult       numeric := 2.5;
  v_vase_mult       numeric := 2.0;
  v_acc_mult        numeric := 3.0;
  v_other_mult      numeric := 2.0;
  v_labor_amount    numeric;
  v_total_retail    numeric := 0;
  v_item_retail     numeric;
  v_item_total      numeric;
  v_lines           text[] := ARRAY[]::text[];
  v_product_rec     record;
  v_has_items        boolean := false;
BEGIN
  -- Verify caller is a staff account
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not a staff account';
  END IF;

  -- Read the order, verify ownership
  SELECT user_id, name, staff_name, staff_id, created_at, photo, notes, customer_price
  INTO v_order_owner, v_order_name, v_staff_name, v_staff_id, v_created_at, v_photo, v_notes, v_customer_price
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_owner IS DISTINCT FROM v_owner_id THEN
    RAISE EXCEPTION 'Access denied: order does not belong to your shop';
  END IF;

  -- Read owner's markup settings (bypasses RLS via SECURITY DEFINER)
  SELECT
    COALESCE(stem, 2.5),
    COALESCE(vase, 2.0),
    COALESCE(accessory, 3.0),
    COALESCE(other, 2.0),
    COALESCE(labor_percent, 0)
  INTO v_stem_mult, v_vase_mult, v_acc_mult, v_other_mult, v_labor_pct
  FROM markup_settings
  WHERE user_id = v_owner_id
  LIMIT 1;

  -- Compute labor dollar amount
  IF v_customer_price IS NOT NULL AND v_labor_pct > 0 THEN
    v_labor_amount := ROUND(v_customer_price * (v_labor_pct / 100.0), 2);
  ELSE
    v_labor_amount := NULL;
  END IF;

  -- Build header
  v_lines := array_append(v_lines, rpad('=', 50, '='));
  v_lines := array_append(v_lines, 'ARRANGEMENT: ' || COALESCE(v_order_name, '(unnamed)'));
  IF v_staff_name IS NOT NULL THEN
    v_lines := array_append(v_lines, 'DESIGNER: ' || v_staff_name || CASE WHEN v_staff_id IS NOT NULL THEN ' (ID: ' || v_staff_id || ')' ELSE '' END);
  END IF;
  v_lines := array_append(v_lines, 'DATE: ' || to_char(v_created_at AT TIME ZONE 'UTC', 'MM/DD/YYYY'));
  v_lines := array_append(v_lines, rpad('=', 50, '='));
  v_lines := array_append(v_lines, '');

  IF v_photo IS NOT NULL THEN
    v_lines := array_append(v_lines, 'PHOTO: [See attached image]');
    v_lines := array_append(v_lines, '');
  END IF;

  IF v_notes IS NOT NULL THEN
    v_lines := array_append(v_lines, 'NOTES:');
    v_lines := array_append(v_lines, v_notes);
    v_lines := array_append(v_lines, '');
  END IF;

  -- Build items section
  v_lines := array_append(v_lines, 'ITEMS:');
  v_lines := array_append(v_lines, rpad('-', 50, '-'));
  v_lines := array_append(v_lines, '');

  FOR v_product_rec IN
    SELECT name, quantity, type, wholesale_cost
    FROM order_products
    WHERE order_id = p_order_id
    ORDER BY id
  LOOP
    v_has_items := true;

    -- Compute retail price using owner's markup multipliers
    v_item_retail := CASE v_product_rec.type
      WHEN 'stem'      THEN v_product_rec.wholesale_cost * v_stem_mult
      WHEN 'vase'      THEN v_product_rec.wholesale_cost * v_vase_mult
      WHEN 'accessory' THEN v_product_rec.wholesale_cost * v_acc_mult
      ELSE                  v_product_rec.wholesale_cost * v_other_mult
    END;
    v_item_retail := ROUND(v_item_retail, 2);
    v_item_total := ROUND(v_item_retail * v_product_rec.quantity, 2);
    v_total_retail := v_total_retail + v_item_total;

    v_lines := array_append(v_lines, v_product_rec.name || ' (' || v_product_rec.type::text || ')');
    v_lines := array_append(v_lines, '   ' || v_product_rec.quantity || ' x $' || v_item_retail::text || ' = $' || v_item_total::text);
  END LOOP;

  IF NOT v_has_items THEN
    RAISE EXCEPTION 'Order has no items — cannot generate POS text';
  END IF;

  v_lines := array_append(v_lines, rpad('-', 50, '-'));
  v_lines := array_append(v_lines, '');

  -- Labor line
  IF v_labor_amount IS NOT NULL AND v_labor_amount > 0 THEN
    v_lines := array_append(v_lines, 'Design & labor: $' || v_labor_amount::text);
    v_lines := array_append(v_lines, '');
  END IF;

  -- Total
  DECLARE
    v_total numeric;
  BEGIN
    v_total := COALESCE(v_customer_price, v_total_retail);
    v_lines := array_append(v_lines, 'TOTAL: $' || v_total::text);
    v_lines := array_append(v_lines, rpad('=', 50, '='));
  END;

  RETURN array_to_string(v_lines, E'\n');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_pos_text(uuid) TO authenticated;
