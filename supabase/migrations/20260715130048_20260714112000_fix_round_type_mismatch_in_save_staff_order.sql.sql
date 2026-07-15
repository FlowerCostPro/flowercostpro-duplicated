/*
# Fix ROUND type mismatch in save_staff_order

Same bug as get_working_budget_for_staff: ROUND(double precision, integer)
does not exist in PostgreSQL. The expression p_customer_budget * (v_labor_pct / 100.0)
produces double precision because v_labor_pct is float8.

Fix: cast to numeric before ROUND.
*/

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
$$;
