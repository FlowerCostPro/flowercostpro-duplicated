/*
# Snapshot retail prices on order_products + rebuild generate_pos_text

## Root design change
Instead of computing retail prices at copy-time from wholesale_cost
and markup multipliers, we now snapshot each line item's retail price
at save-time onto order_products.retail_price. The POS text function
reads only what's stored — no lookups, no math, no wholesale access.

## Changes
1. Add order_products.retail_price (numeric, nullable for backfill)
2. Backfill existing rows from markup_settings × wholesale_cost
3. Drop old generate_pos_text
4. Create new generate_pos_text that reads only stored snapshots
*/

-- 1. Add retail_price column
ALTER TABLE order_products ADD COLUMN retail_price numeric;

-- 2. Backfill existing rows from current markup settings
UPDATE order_products op
SET retail_price = ROUND(
  op.wholesale_cost * CASE op.type
    WHEN 'stem'      THEN COALESCE((SELECT stem      FROM markup_settings ms WHERE ms.user_id = o.user_id LIMIT 1), 2.5)
    WHEN 'vase'      THEN COALESCE((SELECT vase      FROM markup_settings ms WHERE ms.user_id = o.user_id LIMIT 1), 2.0)
    WHEN 'accessory' THEN COALESCE((SELECT accessory FROM markup_settings ms WHERE ms.user_id = o.user_id LIMIT 1), 3.0)
    ELSE                  COALESCE((SELECT other     FROM markup_settings ms WHERE ms.user_id = o.user_id LIMIT 1), 2.0)
  END, 2)
FROM orders o
WHERE op.order_id = o.id
  AND op.retail_price IS NULL;

-- 3. Drop old function
DROP FUNCTION IF EXISTS generate_pos_text(uuid);

-- 4. Create new function — reads ONLY stored snapshots
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
BEGIN
  -- Resolve caller's shop: staff → owner_id, owner → own uid
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

  -- Build items section — reads ONLY stored retail_price
  v_lines := array_append(v_lines, 'ITEMS:');
  v_lines := array_append(v_lines, rpad('-', 50, '-'));
  v_lines := array_append(v_lines, '');

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

    v_lines := array_append(v_lines, v_item.name || ' (' || v_item.type::text || ')');
    v_lines := array_append(v_lines, '   ' || v_item.quantity || ' x $' || v_item.retail_price::text || ' = $' || ROUND(v_item.retail_price * v_item.quantity, 2)::text);
  END LOOP;

  IF NOT v_has_items THEN
    RAISE EXCEPTION 'Order has no items — cannot generate POS text';
  END IF;

  v_lines := array_append(v_lines, rpad('-', 50, '-'));
  v_lines := array_append(v_lines, '');

  -- Labor line — reads ONLY stored labor_amount from the order
  IF v_labor_amount IS NOT NULL AND v_labor_amount > 0 THEN
    v_lines := array_append(v_lines, 'Design & labor: $' || v_labor_amount::text);
    v_lines := array_append(v_lines, '');
  END IF;

  -- Total — reads ONLY stored customer_price (or null if not set)
  IF v_customer_price IS NOT NULL THEN
    v_lines := array_append(v_lines, 'TOTAL: $' || v_customer_price::text);
  ELSE
    RAISE EXCEPTION 'Missing stored customer price — re-save the order to snapshot the total';
  END IF;

  v_lines := array_append(v_lines, rpad('=', 50, '='));

  RETURN array_to_string(v_lines, E'\n');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_pos_text(uuid) TO authenticated;
