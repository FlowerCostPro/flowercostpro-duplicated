/*
# Enforce cost/markup/profit protection at the database level for staff accounts

## Problem
Staff accounts could previously query the following tables directly via the
PostgREST API using their JWT, exposing sensitive business data:
- `markup_settings` — reveals all markup multipliers (business strategy)
- `product_templates` — contains `wholesale_cost` for every product
- `orders` — contains `total_wholesale`, `profit`, `customer_price`, `labor_amount`
- `order_products` — contains `wholesale_cost` per product per order

## Changes

### RLS SELECT policies (tightened to owner-only)
The following SELECT policies now use `user_id = auth.uid()` only (no staff
pass-through). Staff accounts cannot read these tables directly.
- `markup_settings`
- `product_templates`
- `orders`
- `order_products`

### New SECURITY DEFINER function: `get_staff_product_templates()`
Returns the product catalogue for the caller's owner without exposing
`wholesale_cost` or markup multipliers. Returns:
  id, name, type, inventory_count, low_stock_threshold, last_used,
  retail_price (computed server-side from wholesale × markup).
Only callable by staff accounts (returns 0 rows for non-staff callers).

### New SECURITY DEFINER function: `save_staff_order(...)`
Accepts an order from a staff member as (name, notes, staff_name, staff_id,
customer_budget, products JSON array of {template_id, quantity}).
The function:
1. Verifies the caller is a staff account.
2. Looks up wholesale costs and computes retail prices server-side (bypasses
   RLS via SECURITY DEFINER — staff never transmit or see cost data).
3. Applies the owner's labor percentage (from markup_settings) if configured.
4. Inserts `orders` + `order_products` rows under the owner's user_id.
5. Decrements `inventory_count` on the used product templates.
6. Returns {order_id, total_retail, created_at} — no wholesale or profit data.

## Security guarantee
After this migration a staff account using the anon-key client CANNOT retrieve
wholesale costs, markup multipliers, profit figures, or labor rates through
any direct table query. All sensitive computation happens inside SECURITY
DEFINER functions which run as the database owner role.

## Important notes
1. Existing orders are not affected — rows and data are unchanged.
2. The `get_staff_product_templates()` function is idempotent (OR REPLACE).
3. Inventory decrement inside `save_staff_order` uses GREATEST(0, ...) to
   prevent negative counts.
4. Items in a staff order whose template_id is not found (or does not belong
   to the owner) are silently skipped to prevent information leakage.
*/

-- ─── markup_settings: owner-only SELECT ────────────────────────────────────

DROP POLICY IF EXISTS "owner_select_markup_settings" ON markup_settings;
CREATE POLICY "owner_select_markup_settings" ON markup_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── product_templates: owner-only SELECT ──────────────────────────────────

DROP POLICY IF EXISTS "owner_select_product_templates" ON product_templates;
CREATE POLICY "owner_select_product_templates" ON product_templates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── orders: owner-only SELECT ─────────────────────────────────────────────

DROP POLICY IF EXISTS "select_orders" ON orders;
CREATE POLICY "select_orders" ON orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── order_products: owner-only SELECT ─────────────────────────────────────

DROP POLICY IF EXISTS "select_order_products" ON order_products;
CREATE POLICY "select_order_products" ON order_products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_products.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- ─── get_staff_product_templates() ─────────────────────────────────────────
-- Returns the owner's product catalogue with retail_price computed,
-- but WITHOUT wholesale_cost or markup multipliers.
-- Returns 0 rows for non-staff callers.

CREATE OR REPLACE FUNCTION get_staff_product_templates()
RETURNS TABLE (
  id              uuid,
  name            text,
  type            text,
  inventory_count integer,
  low_stock_threshold integer,
  last_used       timestamptz,
  retail_price    numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pt.id,
    pt.name,
    pt.type::text,
    pt.inventory_count,
    pt.low_stock_threshold,
    pt.last_used,
    ROUND(
      pt.wholesale_cost * CASE pt.type
        WHEN 'stem'      THEN COALESCE(ms.stem,      2.5)
        WHEN 'vase'      THEN COALESCE(ms.vase,      2.0)
        WHEN 'accessory' THEN COALESCE(ms.accessory, 3.0)
        ELSE                  COALESCE(ms.other,     2.0)
      END,
      2
    ) AS retail_price
  FROM product_templates pt
  LEFT JOIN markup_settings ms ON ms.user_id = pt.user_id
  WHERE pt.user_id = get_owner_id_for_user(auth.uid())
    AND get_owner_id_for_user(auth.uid()) IS NOT NULL
  ORDER BY pt.last_used DESC;
$$;

-- ─── save_staff_order() ─────────────────────────────────────────────────────
-- Inserts a complete order on behalf of a staff account.
-- Wholesale costs, markup, and labor are all computed server-side.
-- Staff never see or transmit any financial data.

CREATE OR REPLACE FUNCTION save_staff_order(
  p_name            text,
  p_notes           text,
  p_staff_name      text,
  p_staff_id        text,
  p_customer_budget numeric,
  p_products        jsonb   -- [{template_id: uuid, quantity: int}, ...]
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
  v_ptype           text;
BEGIN
  -- Only staff accounts may call this function
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: caller is not a staff account';
  END IF;

  -- Fetch owner labor percentage (null-safe)
  SELECT COALESCE(labor_percent, 0)
  INTO v_labor_pct
  FROM markup_settings
  WHERE user_id = v_owner_id;
  v_labor_pct := COALESCE(v_labor_pct, 0);

  -- Insert order with placeholder totals; get back id + timestamp
  INSERT INTO orders (
    user_id, name, notes, staff_name, staff_id,
    total_wholesale, total_retail, profit,
    customer_price, labor_amount
  ) VALUES (
    v_owner_id, p_name, p_notes, p_staff_name, p_staff_id,
    0, 0, 0, p_customer_budget, NULL
  )
  RETURNING id, created_at INTO v_order_id, v_created_at;

  -- Process each product: look up costs, insert order_products, update inventory
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_products)
  LOOP
    v_template_id := (v_elem->>'template_id')::uuid;
    v_qty         := (v_elem->>'quantity')::int;

    -- Look up cost + compute retail (SECURITY DEFINER bypasses RLS)
    SELECT
      pt.wholesale_cost,
      ROUND(pt.wholesale_cost * CASE pt.type
        WHEN 'stem'      THEN COALESCE(ms.stem,      2.5)
        WHEN 'vase'      THEN COALESCE(ms.vase,      2.0)
        WHEN 'accessory' THEN COALESCE(ms.accessory, 3.0)
        ELSE                  COALESCE(ms.other,     2.0)
      END, 2),
      pt.name,
      pt.type::text
    INTO v_ws, v_rt, v_pname, v_ptype
    FROM product_templates pt
    LEFT JOIN markup_settings ms ON ms.user_id = pt.user_id
    WHERE pt.id = v_template_id
      AND pt.user_id = v_owner_id;

    -- Skip any template that wasn't found (e.g. deleted or wrong owner)
    IF v_ws IS NULL THEN CONTINUE; END IF;

    INSERT INTO order_products (order_id, name, wholesale_cost, quantity, type)
    VALUES (v_order_id, v_pname, v_ws, v_qty, v_ptype);

    v_total_wholesale := v_total_wholesale + (v_ws * v_qty);
    v_total_retail    := v_total_retail    + (v_rt * v_qty);

    -- Decrement inventory (floor at 0, skip if inventory tracking is off)
    UPDATE product_templates
    SET inventory_count = GREATEST(0, inventory_count - v_qty)
    WHERE id = v_template_id
      AND user_id = v_owner_id
      AND inventory_count IS NOT NULL;
  END LOOP;

  -- Compute final profit with or without labor
  IF p_customer_budget IS NOT NULL AND v_labor_pct > 0 THEN
    v_labor_amount := ROUND(p_customer_budget * (v_labor_pct / 100.0), 2);
    v_profit       := ROUND(p_customer_budget - v_total_wholesale - v_labor_amount, 2);
  ELSE
    v_labor_amount := NULL;
    v_profit       := ROUND(v_total_retail - v_total_wholesale, 2);
  END IF;

  -- Update order with real totals
  UPDATE orders SET
    total_wholesale = v_total_wholesale,
    total_retail    = v_total_retail,
    profit          = v_profit,
    labor_amount    = v_labor_amount
  WHERE id = v_order_id;

  -- Return only safe fields — no financial data is included
  RETURN jsonb_build_object(
    'order_id',    v_order_id,
    'total_retail', v_total_retail,
    'created_at',  v_created_at
  );
END;
$$;
