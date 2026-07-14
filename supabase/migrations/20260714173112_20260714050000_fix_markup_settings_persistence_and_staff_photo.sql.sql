/*
# Fix markup_settings persistence + add photo to save_staff_order

## Problem 1: Markup settings not persisting after logout/relogin
The `markup_settings` table had no unique constraint on `user_id`. The
frontend `saveMarkupSettings` used `upsert()` without specifying an
`onConflict` target, so PostgREST fell back to the primary key `id` (an
auto-generated UUID). Every "save" inserted a NEW row instead of updating
the existing one. On reload, `loadMarkupSettings` used `.maybeSingle()`,
which throws when multiple rows exist for the same user — so the app
silently fell back to default markup values.

One user had accumulated 28 duplicate rows.

## Fix 1
1. Deduplicate existing rows: keep only the most recently updated row per
   `user_id`, delete the rest. Uses a CTE with `row_number()` so we never
   touch the row with the latest `updated_at`.
2. Add a UNIQUE constraint on `user_id` so only one row per user can exist.
3. The frontend upsert will now use `onConflict: 'user_id'` to match this
   constraint and perform a true update.

## Problem 2: Staff orders lose their photo
The `save_staff_order()` RPC had no `p_photo` parameter. The frontend
sent the photo in the order object but the RPC never received it, so the
`orders.photo` column was always NULL for staff-created orders.

## Fix 2
Add `p_photo text` parameter to `save_staff_order()` and include it in
the INSERT into `orders`.

## Security
No RLS or policy changes. The unique constraint enforces data integrity.
The new RPC parameter is a text field (base64 data URL) passed through
the existing SECURITY DEFINER function — no new privilege surface.
*/

-- ─── Deduplicate markup_settings ──────────────────────────────────────
-- Keep the most recently updated row per user_id, delete the rest.
DELETE FROM markup_settings
WHERE id NOT IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY updated_at DESC, id DESC
      ) AS rn
    FROM markup_settings
  ) ranked
  WHERE ranked.rn = 1
);

-- ─── Add unique constraint on user_id ─────────────────────────────────
DROP INDEX IF EXISTS markup_settings_user_id_unique;
CREATE UNIQUE INDEX markup_settings_user_id_unique
  ON markup_settings (user_id);

-- ─── Update save_staff_order to accept p_photo ───────────────────────
CREATE OR REPLACE FUNCTION save_staff_order(
  p_name            text,
  p_notes           text,
  p_staff_name      text,
  p_staff_id        text,
  p_customer_budget numeric,
  p_photo           text,
  p_products        jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id        uuid;
  v_labor_pct       float8 := 0;
  v_total_wholesale numeric := 0;
  v_total_retail    numeric := 0;
  v_labor_amount    numeric;
  v_profit          numeric;
  v_order_id        uuid;
  v_created_at      timestamptz;
  v_elem            jsonb;
  v_template_id     uuid;
  v_qty             int;
  v_ws              numeric;
  v_rt              numeric;
  v_pname           text;
  v_ptype           product_type;
BEGIN
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: caller is not a staff account';
  END IF;

  SELECT COALESCE(labor_percent, 0)
  INTO v_labor_pct
  FROM markup_settings
  WHERE user_id = v_owner_id;
  v_labor_pct := COALESCE(v_labor_pct, 0);

  INSERT INTO orders (
    user_id, name, notes, staff_name, staff_id,
    total_wholesale, total_retail, profit,
    customer_price, labor_amount, photo
  ) VALUES (
    v_owner_id, p_name, p_notes, p_staff_name, p_staff_id,
    0, 0, 0, p_customer_budget, NULL, p_photo
  )
  RETURNING id, created_at INTO v_order_id, v_created_at;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_products)
  LOOP
    v_template_id := (v_elem->>'template_id')::uuid;
    v_qty         := (v_elem->>'quantity')::int;

    SELECT
      pt.wholesale_cost,
      ROUND(pt.wholesale_cost * CASE pt.type
        WHEN 'stem'      THEN COALESCE(ms.stem,      2.5)
        WHEN 'vase'      THEN COALESCE(ms.vase,      2.0)
        WHEN 'accessory' THEN COALESCE(ms.accessory, 3.0)
        ELSE                  COALESCE(ms.other,     2.0)
      END, 2),
      pt.name,
      pt.type
    INTO v_ws, v_rt, v_pname, v_ptype
    FROM product_templates pt
    LEFT JOIN markup_settings ms ON ms.user_id = pt.user_id
    WHERE pt.id = v_template_id
      AND pt.user_id = v_owner_id;

    IF v_ws IS NULL THEN CONTINUE; END IF;

    INSERT INTO order_products (order_id, name, wholesale_cost, quantity, type)
    VALUES (v_order_id, v_pname, v_ws, v_qty, v_ptype);

    v_total_wholesale := v_total_wholesale + (v_ws * v_qty);
    v_total_retail    := v_total_retail    + (v_rt * v_qty);

    UPDATE product_templates
    SET inventory_count = GREATEST(0, inventory_count - v_qty)
    WHERE id = v_template_id
      AND user_id = v_owner_id
      AND inventory_count IS NOT NULL;
  END LOOP;

  IF p_customer_budget IS NOT NULL AND v_labor_pct > 0 THEN
    v_labor_amount := ROUND(p_customer_budget * (v_labor_pct / 100.0), 2);
    v_profit       := ROUND(p_customer_budget - v_total_wholesale - v_labor_amount, 2);
  ELSE
    v_labor_amount := NULL;
    v_profit       := ROUND(v_total_retail - v_total_wholesale, 2);
  END IF;

  UPDATE orders SET
    total_wholesale = v_total_wholesale,
    total_retail    = v_total_retail,
    profit          = v_profit,
    labor_amount    = v_labor_amount
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id',    v_order_id,
    'total_retail', v_total_retail,
    'created_at',  v_created_at
  );
END;
$$;
