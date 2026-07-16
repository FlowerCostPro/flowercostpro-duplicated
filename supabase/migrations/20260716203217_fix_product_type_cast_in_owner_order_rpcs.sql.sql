/*
# Fix product_type cast in save_owner_order and update_owner_order

The order_products.type column is a product_type enum, but the RPCs were
inserting v_product->>'type' (text) without casting. Add explicit casts.
*/

CREATE OR REPLACE FUNCTION public.save_owner_order(
  p_name text, p_total_wholesale numeric, p_total_retail numeric, p_profit numeric,
  p_photo text, p_notes text, p_staff_name text, p_staff_id text,
  p_customer_price numeric, p_labor_amount numeric, p_products jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    INSERT INTO order_products (order_id, name, wholesale_cost, quantity, type, retail_price)
    VALUES (v_order_id,
      v_product->>'name', (v_product->>'wholesale_cost')::numeric,
      (v_product->>'quantity')::int, (v_product->>'type')::product_type,
      NULLIF(v_product->>'retail_price','')::numeric);
  END LOOP;
  SELECT jsonb_build_object('id', id, 'created_at', created_at)
  INTO v_result FROM orders WHERE id = v_order_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_owner_order(
  p_order_id uuid, p_name text, p_total_wholesale numeric, p_total_retail numeric,
  p_profit numeric, p_photo text, p_notes text, p_staff_name text, p_staff_id text,
  p_products jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    INSERT INTO order_products (order_id, name, wholesale_cost, quantity, type, retail_price)
    VALUES (p_order_id,
      v_product->>'name', (v_product->>'wholesale_cost')::numeric,
      (v_product->>'quantity')::int, (v_product->>'type')::product_type,
      NULLIF(v_product->>'retail_price','')::numeric);
  END LOOP;
END;
$$;

-- Re-grant privileges (CREATE OR REPLACE resets them)
REVOKE EXECUTE ON FUNCTION public.save_owner_order(text, numeric, numeric, numeric, text, text, text, text, numeric, numeric, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_owner_order(text, numeric, numeric, numeric, text, text, text, text, numeric, numeric, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_owner_order(text, numeric, numeric, numeric, text, text, text, text, numeric, numeric, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_owner_order(uuid, text, numeric, numeric, numeric, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_owner_order(uuid, text, numeric, numeric, numeric, text, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_owner_order(uuid, text, numeric, numeric, numeric, text, text, text, text, jsonb) TO authenticated;
