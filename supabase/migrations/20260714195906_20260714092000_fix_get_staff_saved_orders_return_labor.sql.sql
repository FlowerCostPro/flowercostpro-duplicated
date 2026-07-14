/*
# Fix get_staff_saved_orders to return labor_amount and profit

The RPC was returning all order fields EXCEPT labor_amount and profit.
On page reload, staff orders showed laborAmount: undefined, making it
appear that labor was never deducted — even though the DB had the
correct values from save_staff_order.
*/

CREATE OR REPLACE FUNCTION get_staff_saved_orders()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
        'profit',         o.profit,
        'notes',          o.notes,
        'staff_name',     o.staff_name,
        'staff_id',       o.staff_id,
        'photo',          o.photo,
        'products', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id',       op.id,
            'name',     op.name,
            'quantity', op.quantity,
            'type',     op.type
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
