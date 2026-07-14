/*
# Fix infinite recursion in profiles RLS policies

The staff accounts migration caused infinite recursion because its policies
query the `profiles` table inside other policies that also apply to `profiles`.

## Fix

1. Create `get_owner_id_for_user(uuid)` — a SECURITY DEFINER function that
   reads `profiles.owner_id` while bypassing RLS, breaking the recursion.

2. Rewrite every policy that used a self-referential
   `EXISTS (SELECT 1 FROM profiles AS me WHERE ...)` subquery to instead call
   `get_owner_id_for_user(auth.uid())`.

3. Rewrite `staff_read_owner_profile` on `profiles` to use
   `id = get_owner_id_for_user(auth.uid())` — no self-referential join.

## Tables affected
- profiles, product_templates, markup_settings, arrangement_recipes,
  recipe_ingredients, pos_settings, orders, order_products
*/

-- SECURITY DEFINER helper: returns owner_id for a user, bypasses RLS
CREATE OR REPLACE FUNCTION get_owner_id_for_user(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id FROM profiles WHERE id = p_user_id;
$$;

-- -----------------------------------------------------------------------
-- profiles: replace self-referential policy
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_read_owner_profile" ON profiles;
CREATE POLICY "staff_read_owner_profile" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = get_owner_id_for_user(auth.uid())
  );

-- -----------------------------------------------------------------------
-- product_templates
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "owner_select_product_templates" ON product_templates;
CREATE POLICY "owner_select_product_templates" ON product_templates
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id = get_owner_id_for_user(auth.uid())
  );

-- -----------------------------------------------------------------------
-- markup_settings
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "owner_select_markup_settings" ON markup_settings;
CREATE POLICY "owner_select_markup_settings" ON markup_settings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id = get_owner_id_for_user(auth.uid())
  );

-- -----------------------------------------------------------------------
-- arrangement_recipes
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "owner_select_arrangement_recipes" ON arrangement_recipes;
CREATE POLICY "owner_select_arrangement_recipes" ON arrangement_recipes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id = get_owner_id_for_user(auth.uid())
  );

-- -----------------------------------------------------------------------
-- recipe_ingredients
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "select_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "select_recipe_ingredients" ON recipe_ingredients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM arrangement_recipes ar
      WHERE ar.id = recipe_ingredients.recipe_id
        AND (
          ar.user_id = auth.uid()
          OR ar.user_id = get_owner_id_for_user(auth.uid())
        )
    )
  );

-- -----------------------------------------------------------------------
-- pos_settings
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "owner_select_pos_settings" ON pos_settings;
CREATE POLICY "owner_select_pos_settings" ON pos_settings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id = get_owner_id_for_user(auth.uid())
  );

-- -----------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "select_orders" ON orders;
CREATE POLICY "select_orders" ON orders
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id = get_owner_id_for_user(auth.uid())
  );

DROP POLICY IF EXISTS "insert_orders" ON orders;
CREATE POLICY "insert_orders" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR user_id = get_owner_id_for_user(auth.uid())
  );

-- -----------------------------------------------------------------------
-- order_products
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "select_order_products" ON order_products;
CREATE POLICY "select_order_products" ON order_products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_products.order_id
        AND (
          orders.user_id = auth.uid()
          OR orders.user_id = get_owner_id_for_user(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "insert_order_products" ON order_products;
CREATE POLICY "insert_order_products" ON order_products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_products.order_id
        AND (
          orders.user_id = auth.uid()
          OR orders.user_id = get_owner_id_for_user(auth.uid())
        )
    )
  );
