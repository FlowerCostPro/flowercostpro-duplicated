/*
  # Fix Security and Performance Issues

  ## 1. Add Missing Foreign Key Indexes
  Adds indexes to all foreign key columns to improve query performance:
    - arrangement_recipes.user_id
    - markup_settings.user_id
    - order_products.order_id
    - orders.user_id
    - pos_settings.user_id
    - product_templates.user_id
    - recipe_ingredients.recipe_id

  ## 2. Optimize RLS Policies
  Wraps auth.uid() calls in SELECT to prevent re-evaluation for each row:
    - All policies on profiles, product_templates, markup_settings, orders, order_products, arrangement_recipes, recipe_ingredients, pos_settings

  ## 3. Remove Unused Index
    - Drops idx_product_templates_low_stock (unused)

  ## 4. Fix Multiple Permissive Policies
    - Removes duplicate INSERT policy on profiles table

  ## 5. Fix Function Search Path
    - Makes update_updated_at_column function search path immutable
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_arrangement_recipes_user_id ON arrangement_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_markup_settings_user_id ON markup_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_order_products_order_id ON order_products(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_settings_user_id ON pos_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_product_templates_user_id ON product_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);

-- Remove unused index
DROP INDEX IF EXISTS idx_product_templates_low_stock;

-- Fix duplicate INSERT policy on profiles (remove the user-facing one, keep trigger policy)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Recreate all RLS policies with optimized auth.uid() calls wrapped in SELECT

-- Profiles table policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Product templates policy
DROP POLICY IF EXISTS "Users can manage own product templates" ON product_templates;
CREATE POLICY "Users can manage own product templates"
  ON product_templates
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Markup settings policy
DROP POLICY IF EXISTS "Users can manage own markup settings" ON markup_settings;
CREATE POLICY "Users can manage own markup settings"
  ON markup_settings
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Orders policy
DROP POLICY IF EXISTS "Users can manage own orders" ON orders;
CREATE POLICY "Users can manage own orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Order products policy
DROP POLICY IF EXISTS "Users can manage order products for own orders" ON order_products;
CREATE POLICY "Users can manage order products for own orders"
  ON order_products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_products.order_id 
      AND orders.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_products.order_id 
      AND orders.user_id = (SELECT auth.uid())
    )
  );

-- Arrangement recipes policy
DROP POLICY IF EXISTS "Users can manage own arrangement recipes" ON arrangement_recipes;
CREATE POLICY "Users can manage own arrangement recipes"
  ON arrangement_recipes
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Recipe ingredients policy
DROP POLICY IF EXISTS "Users can manage ingredients for own recipes" ON recipe_ingredients;
CREATE POLICY "Users can manage ingredients for own recipes"
  ON recipe_ingredients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM arrangement_recipes 
      WHERE arrangement_recipes.id = recipe_ingredients.recipe_id 
      AND arrangement_recipes.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM arrangement_recipes 
      WHERE arrangement_recipes.id = recipe_ingredients.recipe_id 
      AND arrangement_recipes.user_id = (SELECT auth.uid())
    )
  );

-- POS settings policy
DROP POLICY IF EXISTS "Users can manage own POS settings" ON pos_settings;
CREATE POLICY "Users can manage own POS settings"
  ON pos_settings
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Fix function search path for update_updated_at_column
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers for the function
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_templates_updated_at
  BEFORE UPDATE ON product_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_markup_settings_updated_at
  BEFORE UPDATE ON markup_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_arrangement_recipes_updated_at
  BEFORE UPDATE ON arrangement_recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pos_settings_updated_at
  BEFORE UPDATE ON pos_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();