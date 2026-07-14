/*
# Add get_staff_saved_orders SECURITY DEFINER function

## Problem
After restricting the orders SELECT policy to `user_id = auth.uid()`, staff
accounts (whose auth.uid() is their own staff UUID, not the owner's) can no
longer query the orders table at all. This means:
- Saved orders disappear on any page refresh for staff.
- loadSavedOrders always returns an empty array for staff sessions.

## Solution
A SECURITY DEFINER function that:
1. Verifies the caller is a staff account.
2. Reads orders for the owner — bypassing RLS — and returns only safe fields.
3. Never exposes total_wholesale, profit, labor_amount, or wholesale_cost per
   product to the client.

## Returned fields (per order)
- id, name, created_at, total_retail, customer_price, notes, staff_name,
  staff_id, photo
- products: array of {id, name, quantity, type} — no wholesale_cost

## Security guarantee
Staff calling this function cannot reconstruct any cost or margin data from
the returned payload.
*/

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
