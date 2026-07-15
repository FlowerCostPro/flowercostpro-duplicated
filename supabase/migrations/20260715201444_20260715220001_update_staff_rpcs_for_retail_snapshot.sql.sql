/*
# Update save_staff_order to store retail_price snapshot
# Update get_staff_saved_orders to return retail_price
*/

CREATE OR REPLACE FUNCTION save_staff_order(
  p_name text,
  p_notes text,
  p_staff_name text,
  p_staff_id text,
  p_customer_budget numeric,
  p_photo text,
  p_products jsonb
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
  v_labor_amount     numeric;
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

    INSERT INTO order_products (order_id, name, wholesale_cost, quantity, type, retail_price)
    VALUES (v_order_id, v_pname, v_ws, v_qty, v_ptype, v_rt);

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

GRANT EXECUTE ON FUNCTION save_staff_order(text, text, text, text, numeric, text, jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION get_staff_saved_orders()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
            'id',           op.id,
            'name',         op.name,
            'quantity',     op.quantity,
            'type',         op.type,
            'retail_price', op.retail_price
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
$$;

GRANT EXECUTE ON FUNCTION get_staff_saved_orders() TO authenticated;
