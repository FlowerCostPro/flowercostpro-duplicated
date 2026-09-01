-- Staff can read order_products for orders belonging to their owner.
-- Without this, get_staff_saved_orders (SECURITY INVOKER) returns empty products
-- because the existing select_order_products policy checks orders.user_id = auth.uid(),
-- which only matches the owner, not the staff member.

CREATE POLICY "staff_select_order_products"
  ON order_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_products.order_id
        AND orders.user_id = get_owner_id_for_user(auth.uid())
    )
  );