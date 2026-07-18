-- =====================================================================
-- BUNCH PRICING FEATURE
-- =====================================================================
-- 1. markup_settings: add bunch markup
-- 2. product_templates: add unit ('stem'|'bunch'), widen inventory to numeric
-- 3. order_products: add portion_divisor + unit for price snapshot
-- 4. Update all affected RPCs (owner + staff)
-- =====================================================================

-- ── 1. markup_settings: add bunch markup column ─────────────────────
ALTER TABLE markup_settings ADD COLUMN IF NOT EXISTS bunch numeric DEFAULT 2.0;

-- ── 2. product_templates: add unit, widen inventory columns ─────────
ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'stem';
DO $$ BEGIN
  ALTER TABLE product_templates ADD CONSTRAINT product_templates_unit_check
    CHECK (unit IN ('stem', 'bunch'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Safe widening: integer → numeric (no data loss)
ALTER TABLE product_templates ALTER COLUMN inventory_count TYPE numeric USING inventory_count::numeric;
ALTER TABLE product_templates ALTER COLUMN low_stock_threshold TYPE numeric USING low_stock_threshold::numeric;

-- ── 3. order_products: add portion_divisor + unit ───────────────────
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS portion_divisor integer;
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'stem';
DO $$ BEGIN
  ALTER TABLE order_products ADD CONSTRAINT order_products_unit_check
    CHECK (unit IN ('stem', 'bunch'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE order_products ADD CONSTRAINT order_products_portion_divisor_check
    CHECK (portion_divisor IS NULL OR portion_divisor IN (1, 2, 3, 4));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 4. RPC UPDATES
-- =====================================================================

-- ── save_owner_markup_settings: add p_bunch parameter (signature change) ──
DROP FUNCTION IF EXISTS public.save_owner_markup_settings(numeric, numeric, numeric, numeric, numeric);

CREATE FUNCTION public.save_owner_markup_settings(
  p_stem numeric, p_vase numeric, p_accessory numeric, p_other numeric,
  p_bunch numeric, p_labor_percent numeric
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO markup_settings (user_id, stem, vase, accessory, other, bunch, labor_percent)
  VALUES (auth.uid(), p_stem, p_vase, p_accessory, p_other, COALESCE(p_bunch, 2.0), p_labor_percent)
  ON CONFLICT (user_id) DO UPDATE SET
    stem = EXCLUDED.stem, vase = EXCLUDED.vase, accessory = EXCLUDED.accessory,
    other = EXCLUDED.other, bunch = EXCLUDED.bunch, labor_percent = EXCLUDED.labor_percent;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.save_owner_markup_settings(numeric, numeric, numeric, numeric, numeric, numeric) TO authenticated;

-- ── get_owner_markup_settings: return bunch field ───────────────────
CREATE OR REPLACE FUNCTION public.get_owner_markup_settings()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'stem', stem, 'vase', vase, 'accessory', accessory,
    'other', other, 'bunch', COALESCE(bunch, 2.0), 'labor_percent', labor_percent
  ) INTO v_result
  FROM markup_settings WHERE user_id = auth.uid();
  RETURN v_result;
END;
$function$;

-- ── get_staff_markup_settings: return bunch (needed for owner UI display, NOT sensitive) ──
-- Bunch markup is NOT sensitive — staff need it to display retail in owner view.
-- The sensitive value is bunch COST, which is never sent to staff.
CREATE OR REPLACE FUNCTION public.get_staff_markup_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id  uuid;
  v_result   jsonb;
BEGIN
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not a staff account';
  END IF;

  SELECT jsonb_build_object(
    'stem',      COALESCE(ms.stem,      2.5),
    'vase',      COALESCE(ms.vase,      2.0),
    'accessory', COALESCE(ms.accessory, 3.0),
    'other',     COALESCE(ms.other,     2.0),
    'bunch',     COALESCE(ms.bunch,     2.0)
  )
  INTO v_result
  FROM markup_settings ms
  WHERE ms.user_id = v_owner_id;

  RETURN COALESCE(v_result, jsonb_build_object(
    'stem', 2.5, 'vase', 2.0, 'accessory', 3.0, 'other', 2.0, 'bunch', 2.0
  ));
END;
$function$;

-- ── get_owner_product_templates: return unit field ──────────────────
CREATE OR REPLACE FUNCTION public.get_owner_product_templates()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'wholesale_cost', wholesale_cost,
      'type', type, 'unit', unit, 'last_used', last_used,
      'inventory_count', inventory_count, 'low_stock_threshold', low_stock_threshold
    ) ORDER BY last_used DESC)
    FROM product_templates WHERE user_id = auth.uid()
  ), '[]'::jsonb);
END;
$function$;

-- ── get_staff_product_templates: compute bunch retail server-side, return unit ──
-- For bunch products: retail_price = wholesale_cost × bunch_markup (full bunch)
-- Staff client divides by portion_divisor to get portion retail.
-- wholesale_cost is NEVER returned to staff (unchanged).
DROP FUNCTION IF EXISTS public.get_staff_product_templates();

CREATE FUNCTION public.get_staff_product_templates()
RETURNS TABLE(id uuid, name text, type text, unit text, inventory_count numeric, low_stock_threshold numeric, last_used timestamp with time zone, retail_price numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT
  pt.id,
  pt.name,
  pt.type::text,
  pt.unit,
  pt.inventory_count,
  pt.low_stock_threshold,
  pt.last_used,
  ROUND(
    CASE WHEN pt.unit = 'bunch' THEN
      pt.wholesale_cost * COALESCE(ms.bunch, 2.0)
    ELSE
      pt.wholesale_cost * CASE pt.type
        WHEN 'stem'      THEN COALESCE(ms.stem,      2.5)
        WHEN 'vase'      THEN COALESCE(ms.vase,      2.0)
        WHEN 'accessory' THEN COALESCE(ms.accessory, 3.0)
        ELSE                  COALESCE(ms.other,     2.0)
      END
    END, 2
  ) AS retail_price
FROM product_templates pt
LEFT JOIN LATERAL (
  SELECT stem, vase, accessory, other, bunch
  FROM markup_settings
  WHERE user_id = pt.user_id
  LIMIT 1
) ms ON true
WHERE pt.user_id = get_owner_id_for_user(auth.uid())
  AND get_owner_id_for_user(auth.uid()) IS NOT NULL
ORDER BY pt.last_used DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_staff_product_templates() TO authenticated;

-- ── save_owner_product_template: add p_unit, numeric inventory (signature change) ──
DROP FUNCTION IF EXISTS public.save_owner_product_template(text, numeric, text, timestamp with time zone, integer, integer);

CREATE FUNCTION public.save_owner_product_template(
  p_name text, p_wholesale_cost numeric, p_type text, p_last_used timestamp with time zone,
  p_unit text, p_inventory_count numeric, p_low_stock_threshold numeric
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO product_templates (user_id, name, wholesale_cost, type, unit, last_used, inventory_count, low_stock_threshold)
  VALUES (auth.uid(), p_name, p_wholesale_cost, p_type, COALESCE(p_unit, 'stem'), p_last_used, p_inventory_count, p_low_stock_threshold)
  RETURNING id INTO v_id;
  SELECT jsonb_build_object(
    'id', id, 'name', name, 'wholesale_cost', wholesale_cost,
    'type', type, 'unit', unit, 'last_used', last_used,
    'inventory_count', inventory_count, 'low_stock_threshold', low_stock_threshold
  ) INTO v_result FROM product_templates WHERE id = v_id;
  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.save_owner_product_template(text, numeric, text, timestamp with time zone, text, numeric, numeric) TO authenticated;

-- ── update_owner_product_template: add p_unit, numeric inventory (signature change) ──
DROP FUNCTION IF EXISTS public.update_owner_product_template(uuid, text, numeric, text, timestamp with time zone, integer, integer);

CREATE FUNCTION public.update_owner_product_template(
  p_template_id uuid, p_name text, p_wholesale_cost numeric, p_type text,
  p_last_used timestamp with time zone, p_unit text, p_inventory_count numeric, p_low_stock_threshold numeric
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE product_templates SET
    name = p_name, wholesale_cost = p_wholesale_cost, type = p_type,
    unit = COALESCE(p_unit, unit),
    last_used = p_last_used, inventory_count = p_inventory_count,
    low_stock_threshold = p_low_stock_threshold
  WHERE id = p_template_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found'; END IF;
  SELECT jsonb_build_object(
    'id', id, 'name', name, 'wholesale_cost', wholesale_cost,
    'type', type, 'unit', unit, 'last_used', last_used,
    'inventory_count', inventory_count, 'low_stock_threshold', low_stock_threshold
  ) INTO v_result FROM product_templates WHERE id = p_template_id;
  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_owner_product_template(uuid, text, numeric, text, timestamp with time zone, text, numeric, numeric) TO authenticated;

-- ── restock_product_template: numeric inventory (signature change) ──
DROP FUNCTION IF EXISTS public.restock_product_template(uuid, integer, integer);

CREATE FUNCTION public.restock_product_template(
  p_template_id uuid, p_inventory_count numeric, p_low_stock_threshold numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_is_staff boolean := false;
BEGIN
  -- Try staff first (staff → owner_id)
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NOT NULL THEN
    v_is_staff := true;
  ELSE
    -- Owner updating own template
    v_owner_id := auth.uid();
  END IF;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  -- Verify the template belongs to the owner
  PERFORM 1 FROM product_templates
  WHERE id = p_template_id AND user_id = v_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  UPDATE product_templates
  SET
    inventory_count     = p_inventory_count,
    low_stock_threshold = COALESCE(p_low_stock_threshold, low_stock_threshold)
  WHERE id = p_template_id AND user_id = v_owner_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.restock_product_template(uuid, numeric, numeric) TO authenticated;

-- ── save_owner_order: add portion_divisor + unit to order_products insert ──
CREATE OR REPLACE FUNCTION public.save_owner_order(
  p_name text, p_total_wholesale numeric, p_total_retail numeric, p_profit numeric,
  p_photo text, p_notes text, p_staff_name text, p_staff_id text,
  p_customer_price numeric, p_labor_amount numeric, p_products jsonb
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
  INSERT INTO orders (user_id, name, total_wholesale, total_retail, profit, photo, notes, staff_name, staff_id, customer_price, labor_amount)
  VALUES (auth.uid(), p_name, p_total_wholesale, p_total_retail, p_profit, p_photo, p_notes, p_staff_name, p_staff_id, p_customer_price, p_labor_amount)
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

-- ── update_owner_order: add portion_divisor + unit to order_products insert ──
CREATE OR REPLACE FUNCTION public.update_owner_order(
  p_order_id uuid, p_name text, p_total_wholesale numeric, p_total_retail numeric,
  p_profit numeric, p_photo text, p_notes text, p_staff_name text, p_staff_id text,
  p_products jsonb
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
    staff_name = p_staff_name, staff_id = p_staff_id
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

-- ── get_owner_orders: return portion_divisor + unit in products ─────
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
      'products', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', op.id, 'name', op.name, 'wholesale_cost', op.wholesale_cost,
          'quantity', op.quantity, 'type', op.type, 'retail_price', op.retail_price,
          'portion_divisor', op.portion_divisor, 'unit', op.unit
        ) ORDER BY op.id)
        FROM order_products op WHERE op.order_id = o.id
      ), '[]'::jsonb)
    ) ORDER BY o.created_at DESC)
    FROM orders o WHERE o.user_id = auth.uid()
  ), '[]'::jsonb);
END;
$function$;

-- ── get_staff_saved_orders: return portion_divisor + unit in products ──
-- Still does NOT return wholesale_cost (unchanged security posture)
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

-- ── save_staff_order: handle bunch products with portion pricing ────
-- For bunch products:
--   retail_price = wholesale_cost × bunch_markup ÷ portion_divisor
--   order wholesale_cost = wholesale_cost ÷ portion_divisor (for profit reporting)
--   inventory deduction = 1 ÷ portion_divisor (fractional)
-- For stem products: unchanged
CREATE OR REPLACE FUNCTION public.save_staff_order(
  p_name text, p_notes text, p_staff_name text, p_staff_id text,
  p_customer_budget numeric, p_photo text, p_products jsonb
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
BEGIN
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: caller is not a staff account';
  END IF;

  -- Fetch all markup values once
  SELECT
    COALESCE(ms.stem, 2.5), COALESCE(ms.vase, 2.0),
    COALESCE(ms.accessory, 3.0), COALESCE(ms.other, 2.0),
    COALESCE(ms.bunch, 2.0), COALESCE(ms.labor_percent, 0)
  INTO
    v_stem_markup, v_vase_markup, v_acc_markup, v_other_markup,
    v_bunch_markup, v_labor_pct
  FROM markup_settings ms
  WHERE ms.user_id = v_owner_id;

  v_labor_pct := COALESCE(v_labor_pct, 0);

  INSERT INTO orders (
    user_id, name, notes, staff_name, staff_id,
    total_wholesale, total_retail, profit,
    customer_price, labor_amount, photo
  ) VALUES (
    v_owner_id, p_name, p_notes, p_staff_name, p_staff_id,
    0, 0, 0, p_customer_budget, NULL, p_photo
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
      -- Bunch product: compute portion pricing server-side
      v_ws := ROUND(v_raw_ws / v_divisor, 2);
      v_rt := ROUND(v_raw_ws * v_bunch_markup / v_divisor, 2);

      INSERT INTO order_products (order_id, name, wholesale_cost, quantity, type, retail_price, portion_divisor, unit)
      VALUES (v_order_id, v_pname, v_ws, 1, v_ptype, v_rt, v_divisor, 'bunch');

      v_total_wholesale := v_total_wholesale + v_ws;
      v_total_retail    := v_total_retail + v_rt;

      -- Fractional inventory deduction
      UPDATE product_templates
      SET inventory_count = GREATEST(0, inventory_count - (1.0 / v_divisor))
      WHERE id = v_template_id
        AND user_id = v_owner_id
        AND inventory_count IS NOT NULL;
    ELSE
      -- Per-stem product: unchanged behavior
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
