/*
# Clean up POS text formatting (minimal separators, no PHOTO placeholder)

## Scope — formatting ONLY
No data, calculation, permission, or generation-flow changes. Same server-side
RPC, same ORDER BY id, same security model, same caller (buildPOSText).

## Two changes requested
1. Drop the "PHOTO: [See attached image]" line — the photo is copied separately
   now, so the placeholder is unnecessary.
2. Reduce separator lines to a minimum (zero) — no ==== or ---- lines.

## Resulting template
  ARRANGEMENT: <name>
  DESIGNER: <staff> [(ID: <id>)]
  DATE: MM/DD/YYYY
  [NOTES:\n<notes>\n]      (only when notes exist)
  ITEMS
  <name padded to 17><qty> x $<price> = $<line>
  ...
  Subtotal:        $<sum>
  Design & labor:  $<labor>     (only when > 0)
  TOTAL:           $<total>

## Notes
1. Only the function body changes — no schema/column changes.
2. SECURITY DEFINER, STABLE, search_path=public preserved.
3. Shop resolution via get_owner_id_for_user + ownership check preserved.
4. Signature unchanged: generate_pos_text(uuid) -> text.
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
  v_notes          text;
  v_customer_price numeric;
  v_labor_amount   numeric;
  v_lines          text[] := ARRAY[]::text[];
  v_item           record;
  v_has_items      boolean := false;
  v_subtotal       numeric := 0;
  v_line_total     numeric;
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
  SELECT user_id, name, staff_name, staff_id, created_at, notes,
         customer_price, labor_amount
  INTO v_order_user_id, v_order_name, v_staff_name, v_staff_id, v_created_at,
       v_notes, v_customer_price, v_labor_amount
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_user_id IS DISTINCT FROM v_shop_id THEN
    RAISE EXCEPTION 'Access denied: order does not belong to your shop';
  END IF;

  -- Header (unaligned labels, no separators)
  v_lines := array_append(v_lines, 'ARRANGEMENT: ' || COALESCE(v_order_name, '(unnamed)'));
  IF v_staff_name IS NOT NULL THEN
    v_lines := array_append(v_lines, 'DESIGNER: ' || v_staff_name || CASE WHEN v_staff_id IS NOT NULL THEN ' (ID: ' || v_staff_id || ')' ELSE '' END);
  END IF;
  v_lines := array_append(v_lines, 'DATE: ' || to_char(v_created_at AT TIME ZONE 'UTC', 'MM/DD/YYYY'));
  v_lines := array_append(v_lines, '');

  IF v_notes IS NOT NULL THEN
    v_lines := array_append(v_lines, 'NOTES:');
    v_lines := array_append(v_lines, v_notes);
    v_lines := array_append(v_lines, '');
  END IF;

  -- Items (single-line rows: name padded to 17, then qty x $price = $line)
  v_lines := array_append(v_lines, 'ITEMS');

  FOR v_item IN
    SELECT name, quantity, retail_price
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

    v_lines := array_append(
      v_lines,
      rpad(COALESCE(v_item.name, '(unnamed)'), 17)
        || v_item.quantity::text || ' x $'
        || to_char(v_item.retail_price, 'FM999999990.00') || ' = $'
        || to_char(v_line_total, 'FM999999990.00')
    );
  END LOOP;

  IF NOT v_has_items THEN
    RAISE EXCEPTION 'Order has no items — cannot generate POS text';
  END IF;

  v_lines := array_append(v_lines, '');

  -- Summary (labels padded to 17, amounts right at the boundary)
  v_lines := array_append(v_lines, rpad('Subtotal:', 17) || '$' || to_char(v_subtotal, 'FM999999990.00'));

  IF v_labor_amount IS NOT NULL AND v_labor_amount > 0 THEN
    v_lines := array_append(v_lines, rpad('Design & labor:', 17) || '$' || to_char(v_labor_amount, 'FM999999990.00'));
  END IF;

  IF v_customer_price IS NOT NULL THEN
    v_lines := array_append(v_lines, rpad('TOTAL:', 17) || '$' || to_char(v_customer_price, 'FM999999990.00'));
  ELSE
    RAISE EXCEPTION 'Missing stored customer price — re-save the order to snapshot the total';
  END IF;

  RETURN array_to_string(v_lines, E'\n');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_pos_text(uuid) TO authenticated;
