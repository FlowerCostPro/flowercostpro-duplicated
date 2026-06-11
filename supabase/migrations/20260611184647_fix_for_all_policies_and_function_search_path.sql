-- Fix 1: Replace FOR ALL policies with per-verb policies on all affected tables
-- This resolves 7 security advisories.

-- arrangement_recipes
DROP POLICY IF EXISTS "Users can manage own arrangement recipes" ON arrangement_recipes;
CREATE POLICY "select_own_arrangement_recipes" ON arrangement_recipes FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "insert_own_arrangement_recipes" ON arrangement_recipes FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "update_own_arrangement_recipes" ON arrangement_recipes FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "delete_own_arrangement_recipes" ON arrangement_recipes FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- markup_settings
DROP POLICY IF EXISTS "Users can manage own markup settings" ON markup_settings;
CREATE POLICY "select_own_markup_settings" ON markup_settings FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "insert_own_markup_settings" ON markup_settings FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "update_own_markup_settings" ON markup_settings FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "delete_own_markup_settings" ON markup_settings FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- orders
DROP POLICY IF EXISTS "Users can manage own orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "insert_own_orders" ON orders FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "update_own_orders" ON orders FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "delete_own_orders" ON orders FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- order_products (ownership checked via join to orders)
DROP POLICY IF EXISTS "Users can manage order products for own orders" ON order_products;
CREATE POLICY "select_own_order_products" ON order_products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_products.order_id AND orders.user_id = (SELECT auth.uid())));
CREATE POLICY "insert_own_order_products" ON order_products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_products.order_id AND orders.user_id = (SELECT auth.uid())));
CREATE POLICY "update_own_order_products" ON order_products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_products.order_id AND orders.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_products.order_id AND orders.user_id = (SELECT auth.uid())));
CREATE POLICY "delete_own_order_products" ON order_products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_products.order_id AND orders.user_id = (SELECT auth.uid())));

-- pos_settings
DROP POLICY IF EXISTS "Users can manage own POS settings" ON pos_settings;
CREATE POLICY "select_own_pos_settings" ON pos_settings FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "insert_own_pos_settings" ON pos_settings FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "update_own_pos_settings" ON pos_settings FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "delete_own_pos_settings" ON pos_settings FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- product_templates
DROP POLICY IF EXISTS "Users can manage own product templates" ON product_templates;
CREATE POLICY "select_own_product_templates" ON product_templates FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "insert_own_product_templates" ON product_templates FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "update_own_product_templates" ON product_templates FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "delete_own_product_templates" ON product_templates FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- recipe_ingredients (ownership checked via join to arrangement_recipes)
DROP POLICY IF EXISTS "Users can manage ingredients for own recipes" ON recipe_ingredients;
CREATE POLICY "select_own_recipe_ingredients" ON recipe_ingredients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM arrangement_recipes WHERE arrangement_recipes.id = recipe_ingredients.recipe_id AND arrangement_recipes.user_id = (SELECT auth.uid())));
CREATE POLICY "insert_own_recipe_ingredients" ON recipe_ingredients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM arrangement_recipes WHERE arrangement_recipes.id = recipe_ingredients.recipe_id AND arrangement_recipes.user_id = (SELECT auth.uid())));
CREATE POLICY "update_own_recipe_ingredients" ON recipe_ingredients FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM arrangement_recipes WHERE arrangement_recipes.id = recipe_ingredients.recipe_id AND arrangement_recipes.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM arrangement_recipes WHERE arrangement_recipes.id = recipe_ingredients.recipe_id AND arrangement_recipes.user_id = (SELECT auth.uid())));
CREATE POLICY "delete_own_recipe_ingredients" ON recipe_ingredients FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM arrangement_recipes WHERE arrangement_recipes.id = recipe_ingredients.recipe_id AND arrangement_recipes.user_id = (SELECT auth.uid())));

-- Fix 2: Remove pg_temp from update_updated_at_column search_path (security advisory #8)
-- pg_temp in search_path can be exploited via search path hijacking.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
