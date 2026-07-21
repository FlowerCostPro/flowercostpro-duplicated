/*
# Add pricing_profile_id to order save/update/query RPCs

## What changed
1. save_owner_order — new optional p_pricing_profile_id param, stored on the order
2. update_owner_order — new optional p_pricing_profile_id param, updates the order
3. save_staff_order — new optional p_pricing_profile_id param, stored on the order;
   when provided, markup/labor values are read from the profile instead of
   markup_settings
4. get_owner_orders — returns pricing_profile_id and profile_name (via LEFT JOIN)
5. get_staff_saved_orders — returns pricing_profile_id (no profile_name needed
   for staff, but included for display)

## Security
- All functions remain SECURITY DEFINER, search_path = public.
- Execute revoked from anon/public, granted to authenticated.
*/

-- ============================================================
-- 1. save_owner_order (signature change: add p_pricing_profile_id)
-- ============================================================
DROP FUNCTION IF EXISTS public.save_owner_order(text, numeric, numeric, numeric, text, text, text, text, numeric, numeric, jsonb);

CREATE FUNCTION public.save_owner_order(
  p_name text, p_total_wholesale numeric, p_total_retail numeric, p_profit numeric,
  p_photo text, p_notes text, p_staff_name text, p_staff_id text,
  p_customer_price numeric, p_labor_amount numeric, p_products jsonb,
  p_pricing_profile_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_result jsonb;
  v_product jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO orders (user_id, name, total_wholesale, total_retail, profit, photo, notes, staff_name, staff_id, customer_price, labor_amount, pricing_profile_id)
  VALUES (auth.uid(), p_name, p_total_wholesale, p_total_retail, p_profit, p_photo, p_notes, p_staff_name, p_staff_id, p_customer_price, p_labor_amount, p_pricing_profile_id)
  RETURNING id INTO v_order_id;

  FOR v_product IN SELECT * FROM jsonb_array_elements(p_products) LOOP
    INSERT INTO order_products (order_id, name, wholesale_cost, quantity, type, retail_price, portion_divisor, unit)
    VALUES (
      v_order_id,
      v_product->>'name',
      (v_product->>'wholesale_cost')::numeric,
      (v_product->>'quantity')::int,
      (v_product->>'type')::product_type,
      NULLIF(v_product->>'retail_price','')::numeric,
      NULLIF(v_product->>'portion_divisor','')::int,
      COALESCE(v_product->>'unit', 'stem')
    );
  END LOOP;

  SELECT jsonb_build_object('id', id, 'created_at', created_at)
  INTO v_result FROM orders WHERE id = v_order_id;
  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.save_owner_order(text, numeric, numeric, numeric, text, text, text, text, numeric, numeric, jsonb, uuid) TO authenticated;

-- ============================================================
-- 2. update_owner_order (signature change: add p_pricing_profile_id)
-- ============================================================
DROP FUNCTION IF EXISTS public.update_owner_order(uuid, text, numeric, numeric, numeric, text, text, text, text, jsonb);

CREATE FUNCTION public.update_owner_order(
  p_order_id uuid, p_name text, p_total_wholesale numeric, p_total_retail numeric,
  p_profit numeric, p_photo text, p_notes text, p_staff_name text, p_staff_id text,
  p_products jsonb, p_pricing_profile_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_product jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE orders SET
    name = p_name, total_wholesale = p_total_wholesale, total_retail = p_total_retail,
    profit = p_profit, photo = p_photo, notes = p_notes,
    staff_name = p_staff_name, staff_id = p_staff_id,
    pricing_profile_id = p_pricing_profile_id
  WHERE id = p_order_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  DELETE FROM order_products WHERE order_id = p_order_id;
  FOR v_product IN SELECT * FROM jsonb_array_elements(p_products) LOOP
    INSERT INTO order_products (order_id, name, wholesale_cost, quantity, type, retail_price, portion_divisor, unit)
    VALUES (
      p_order_id,
      v_product->>'name',
      (v_product->>'wholesale_cost')::numeric,
      (v_product->>'quantity')::int,
      (v_product->>'type')::product_type,
      NULLIF(v_product->>'retail_price','')::numeric,
      NULLIF(v_product->>'portion_divisor','')::int,
      COALESCE(v_product->>'unit', 'stem')
    );
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_owner_order(uuid, text, numeric, numeric, numeric, text, text, text, text, jsonb, uuid) TO authenticated;

-- ============================================================
-- 3. save_staff_order (signature change: add p_pricing_profile_id)
-- When p_pricing_profile_id is provided, read markup/labor from the profile
-- instead of markup_settings.
-- ============================================================
DROP FUNCTION IF EXISTS public.save_staff_order(text, text, text, text, numeric, text, jsonb);

CREATE FUNCTION public.save_staff_order(
  p_name text, p_notes text, p_staff_name text, p_staff_id text,
  p_customer_budget numeric, p_photo text, p_products jsonb,
  p_pricing_profile_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
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

-- ============================================================
-- 4. get_owner_orders — return pricing_profile_id + profile_name
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_owner_orders()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id, 'name', o.name, 'created_at', o.created_at,
      'total_wholesale', o.total_wholesale, 'total_retail', o.total_retail,
      'profit', o.profit, 'photo', o.photo, 'notes', o.notes,
      'staff_name', o.staff_name, 'staff_id', o.staff_id,
      'customer_price', o.customer_price, 'labor_amount', o.labor_amount,
      'pricing_profile_id', o.pricing_profile_id,
      'pricing_profile_name', pp.name,
      'products', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', op.id, 'name', op.name, 'wholesale_cost', op.wholesale_cost,
          'quantity', op.quantity, 'type', op.type, 'retail_price', op.retail_price,
          'portion_divisor', op.portion_divisor, 'unit', op.unit
        ) ORDER BY op.id)
        FROM order_products op WHERE op.order_id = o.id
      ), '[]'::jsonb)
    ) ORDER BY o.created_at DESC)
    FROM orders o
    LEFT JOIN pricing_profiles pp ON pp.id = o.pricing_profile_id
    WHERE o.user_id = auth.uid()
  ), '[]'::jsonb);
END;
$function$;

-- ============================================================
-- 5. get_staff_saved_orders — return pricing_profile_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_staff_saved_orders()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_result   jsonb;
BEGIN
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not a staff account';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',             o.id,
        'name',           o.name,
        'created_at',     o.created_at,
        'total_retail',   o.total_retail,
        'customer_price', o.customer_price,
        'labor_amount',   o.labor_amount,
        'notes',          o.notes,
        'staff_name',     o.staff_name,
        'staff_id',       o.staff_id,
        'photo',          o.photo,
        'pricing_profile_id', o.pricing_profile_id,
        'products', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id',             op.id,
            'name',           op.name,
            'quantity',       op.quantity,
            'type',           op.type,
            'retail_price',   op.retail_price,
            'portion_divisor', op.portion_divisor,
            'unit',           op.unit
          ))
          FROM order_products op
          WHERE op.order_id = o.id
        ), '[]'::jsonb)
      )
      ORDER BY o.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM orders o
  WHERE o.user_id = v_owner_id;

  RETURN v_result;
END;
$function$;
