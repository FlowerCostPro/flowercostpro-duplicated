/*
# Fix: restore SECURITY DEFINER on save_staff_order

## Root cause
The previous migration (20260721220200) dropped and recreated save_staff_order
with the new p_pricing_profile_id parameter, but omitted SECURITY DEFINER.
Without it, RLS blocks the staff member from inserting an order with
user_id = owner_id (auth.uid() != user_id), so the entire RPC fails silently
— no order is saved and no inventory is deducted.

## Fix
Recreate save_staff_order with SECURITY DEFINER so it runs as the owner
of the function (postgres), bypassing RLS for the INSERT and UPDATE
operations on orders and product_templates.
*/

DROP FUNCTION IF EXISTS public.save_staff_order(text, text, text, text, numeric, text, jsonb, uuid);

CREATE FUNCTION public.save_staff_order(
  p_name text, p_notes text, p_staff_name text, p_staff_id text,
  p_customer_budget numeric, p_photo text, p_products jsonb,
  p_pricing_profile_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id        uuid;
  v_labor_pct       float8 := 0;
  v_bunch_markup    numeric := 2.0;
  v_stem_markup     numeric := 2.5;
  v_vase_markup     numeric := 2.0;
  v_acc_markup      numeric := 3.0;
  v_other_markup    numeric := 2.0;
  v_total_wholesale numeric := 0;
  v_total_retail    numeric := 0;
  v_labor_amount    numeric;
  v_profit          numeric;
  v_order_id        uuid;
  v_created_at      timestamptz;
  v_elem            jsonb;
  v_template_id     uuid;
  v_qty             int;
  v_divisor         int;
  v_raw_ws          numeric;
  v_ws              numeric;
  v_rt              numeric;
  v_pname           text;
  v_ptype           product_type;
  v_unit            text;
  v_profile_found   boolean := false;
BEGIN
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: caller is not a staff account';
  END IF;

  -- Try to read markup/labor from the pricing profile first
  IF p_pricing_profile_id IS NOT NULL THEN
    SELECT
      COALESCE(pp.stem, 2.5), COALESCE(pp.vase, 2.0),
      COALESCE(pp.accessory, 3.0), COALESCE(pp.other, 2.0),
      COALESCE(pp.bunch, 2.0), COALESCE(pp.labor_percent, 0)
    INTO
      v_stem_markup, v_vase_markup, v_acc_markup, v_other_markup,
      v_bunch_markup, v_labor_pct
    FROM pricing_profiles pp
    WHERE pp.id = p_pricing_profile_id AND pp.user_id = v_owner_id;

    v_profile_found := FOUND;
  END IF;

  -- Fallback to markup_settings if no profile or profile not found
  IF NOT v_profile_found THEN
    SELECT
      COALESCE(ms.stem, 2.5), COALESCE(ms.vase, 2.0),
      COALESCE(ms.accessory, 3.0), COALESCE(ms.other, 2.0),
      COALESCE(ms.bunch, 2.0), COALESCE(ms.labor_percent, 0)
    INTO
      v_stem_markup, v_vase_markup, v_acc_markup, v_other_markup,
      v_bunch_markup, v_labor_pct
    FROM markup_settings ms
    WHERE ms.user_id = v_owner_id;
  END IF;

  v_labor_pct := COALESCE(v_labor_pct, 0);

  INSERT INTO orders (
    user_id, name, notes, staff_name, staff_id,
    total_wholesale, total_retail, profit,
    customer_price, labor_amount, photo, pricing_profile_id
  ) VALUES (
    v_owner_id, p_name, p_notes, p_staff_name, p_staff_id,
    0, 0, 0, p_customer_budget, NULL, p_photo, p_pricing_profile_id
  ) RETURNING id, created_at INTO v_order_id, v_created_at;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_products)
  LOOP
    v_template_id := (v_elem->>'template_id')::uuid;
    v_qty         := COALESCE((v_elem->>'quantity')::int, 1);
    v_divisor     := COALESCE((v_elem->>'portion_divisor')::int, 1);

    SELECT pt.wholesale_cost, pt.unit, pt.name, pt.type
    INTO v_raw_ws, v_unit, v_pname, v_ptype
    FROM product_templates pt
    WHERE pt.id = v_template_id AND pt.user_id = v_owner_id;

    IF v_raw_ws IS NULL THEN CONTINUE; END IF;

    IF v_unit = 'bunch' THEN
      v_ws := ROUND(v_raw_ws / v_divisor, 2);
      v_rt := ROUND(v_raw_ws * v_bunch_markup / v_divisor, 2);

      INSERT INTO order_products (order_id, name, wholesale_cost, quantity, type, retail_price, portion_divisor, unit)
      VALUES (v_order_id, v_pname, v_ws, 1, v_ptype, v_rt, v_divisor, 'bunch');

      v_total_wholesale := v_total_wholesale + v_ws;
      v_total_retail    := v_total_retail + v_rt;

      UPDATE product_templates
      SET inventory_count = GREATEST(0, inventory_count - (1.0 / v_divisor))
      WHERE id = v_template_id
        AND user_id = v_owner_id
        AND inventory_count IS NOT NULL;
    ELSE
      v_rt := ROUND(v_raw_ws * CASE v_ptype
        WHEN 'stem'      THEN v_stem_markup
        WHEN 'vase'      THEN v_vase_markup
        WHEN 'accessory' THEN v_acc_markup
        ELSE                  v_other_markup
      END, 2);

      INSERT INTO order_products (order_id, name, wholesale_cost, quantity, type, retail_price, unit)
      VALUES (v_order_id, v_pname, v_raw_ws, v_qty, v_ptype, v_rt, 'stem');

      v_total_wholesale := v_total_wholesale + (v_raw_ws * v_qty);
      v_total_retail    := v_total_retail + (v_rt * v_qty);

      UPDATE product_templates
      SET inventory_count = GREATEST(0, inventory_count - v_qty)
      WHERE id = v_template_id
        AND user_id = v_owner_id
        AND inventory_count IS NOT NULL;
    END IF;
  END LOOP;

  IF p_customer_budget IS NOT NULL AND v_labor_pct > 0 THEN
    v_labor_amount := ROUND((p_customer_budget * (v_labor_pct / 100.0))::numeric, 2);
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
    'order_id',     v_order_id,
    'total_retail', v_total_retail,
    'labor_amount', v_labor_amount,
    'created_at',   v_created_at
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.save_staff_order(text, text, text, text, numeric, text, jsonb, uuid) TO authenticated;
