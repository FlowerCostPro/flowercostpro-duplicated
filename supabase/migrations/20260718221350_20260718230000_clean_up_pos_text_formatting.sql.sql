/*
# Clean up and organize POS text formatting

## Problem
The POS text copied into the florist's point-of-sale system was messy:
- Inconsistent currency formatting ($10, $5, $85 mixed with $3.75, $48.75)
- Redundant type tags ("rose vase (vase)")
- Awkward blank line directly under the ITEMS separator
- No subtotal — labor and total appeared without a clear breakdown
- Header field values not aligned

## Fix
Rebuild generate_pos_text with:
- Consistent 2-decimal currency (to_char ... 'FM999999990.00')
- Aligned header labels (rpad to 14)
- Single-line item rows with right-aligned line totals
- A subtotal of items, then labor, then TOTAL — right-aligned into a clean column
- Dropped the redundant (type) parenthetical — the item name is descriptive enough

## Notes
1. Only the function body changes — no schema/column changes.
2. All existing security logic preserved: SECURITY DEFINER, search_path=public,
   shop resolution via get_owner_id_for_user, ownership check, auth check.
3. Signature unchanged: generate_pos_text(uuid) -> text.
*/

DROP FUNCTION IF EXISTS generate_pos_text(uuid);

CREATE FUNCTION generate_pos_text(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id        uuid;
  v_order_user_id  uuid;
  v_order_name     text;
  v_staff_name     text;
  v_staff_id       text;
  v_created_at     timestamptz;
  v_photo          text;
  v_notes          text;
  v_customer_price numeric;
  v_labor_amount   numeric;
  v_lines          text[] := ARRAY[]::text[];
  v_item           record;
  v_has_items      boolean := false;
  v_subtotal       numeric := 0;
  v_line_total     numeric;
  v_name_col       text;
  v_price_txt      text;
  v_total_txt      text;
BEGIN
  -- Resolve caller's shop: staff -> owner_id, owner -> own uid
  v_shop_id := get_owner_id_for_user(auth.uid());
  IF v_shop_id IS NULL THEN
    v_shop_id := auth.uid();
  END IF;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  -- Read the order — only stored fields, no joins to markup or templates
  SELECT user_id, name, staff_name, staff_id, created_at, photo, notes,
         customer_price, labor_amount
  INTO v_order_user_id, v_order_name, v_staff_name, v_staff_id, v_created_at,
       v_photo, v_notes, v_customer_price, v_labor_amount
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_user_id IS DISTINCT FROM v_shop_id THEN
    RAISE EXCEPTION 'Access denied: order does not belong to your shop';
  END IF;

  -- Header (aligned labels)
  v_lines := array_append(v_lines, rpad('=', 50, '='));
  v_lines := array_append(v_lines, rpad('ARRANGEMENT:', 14) || ' ' || COALESCE(v_order_name, '(unnamed)'));
  IF v_staff_name IS NOT NULL THEN
    v_lines := array_append(v_lines, rpad('DESIGNER:', 14) || ' ' || v_staff_name || CASE WHEN v_staff_id IS NOT NULL THEN ' (ID: ' || v_staff_id || ')' ELSE '' END);
  END IF;
  v_lines := array_append(v_lines, rpad('DATE:', 14) || ' ' || to_char(v_created_at AT TIME ZONE 'UTC', 'MM/DD/YYYY'));
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

  -- Items (single-line rows, right-aligned line totals)
  v_lines := array_append(v_lines, 'ITEMS');
  v_lines := array_append(v_lines, rpad('-', 50, '-'));

  FOR v_item IN
    SELECT name, quantity, type, retail_price
    FROM order_products
    WHERE order_id = p_order_id
    ORDER BY id
  LOOP
    v_has_items := true;

    IF v_item.retail_price IS NULL THEN
      RAISE EXCEPTION 'Missing stored retail price for item "%" — re-save the order to snapshot prices', v_item.name;
    END IF;

    v_line_total := ROUND(v_item.retail_price * v_item.quantity, 2);
    v_subtotal   := v_subtotal + v_line_total;

    v_name_col  := rpad(COALESCE(v_item.name, '(unnamed)'), 20);
    v_price_txt := to_char(v_item.retail_price, 'FM999999990.00');
    v_total_txt := to_char(v_line_total,        'FM999999990.00');

    v_lines := array_append(
      v_lines,
      v_name_col
        || lpad(v_item.quantity::text, 4)
        || ' x $' || v_price_txt
        || lpad('$' || v_total_txt, 14)
    );
  END LOOP;

  IF NOT v_has_items THEN
    RAISE EXCEPTION 'Order has no items — cannot generate POS text';
  END IF;

  v_lines := array_append(v_lines, rpad('-', 50, '-'));

  -- Summary (right-aligned amount column)
  v_lines := array_append(v_lines, rpad('Subtotal:', 38) || lpad('$' || to_char(v_subtotal, 'FM999999990.00'), 12));

  IF v_labor_amount IS NOT NULL AND v_labor_amount > 0 THEN
    v_lines := array_append(v_lines, rpad('Design & labor:', 38) || lpad('$' || to_char(v_labor_amount, 'FM999999990.00'), 12));
    v_lines := array_append(v_lines, rpad('-', 50, '-'));
  END IF;

  -- Total — reads ONLY stored customer_price
  IF v_customer_price IS NOT NULL THEN
    v_lines := array_append(v_lines, rpad('TOTAL:', 38) || lpad('$' || to_char(v_customer_price, 'FM999999990.00'), 12));
  ELSE
    RAISE EXCEPTION 'Missing stored customer price — re-save the order to snapshot the total';
  END IF;

  v_lines := array_append(v_lines, rpad('=', 50, '='));

  RETURN array_to_string(v_lines, E'\n');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_pos_text(uuid) TO authenticated;
