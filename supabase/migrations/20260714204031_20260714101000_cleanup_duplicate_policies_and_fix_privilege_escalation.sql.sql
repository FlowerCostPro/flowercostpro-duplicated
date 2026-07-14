/*
# Clean up duplicate RLS policies

Every table has two sets of policies:
  - "owner_*" policies using `user_id = auth.uid()`
  - "*_own_*" policies using `user_id = (SELECT auth.uid() AS uid)`

These are functionally identical — both check the same condition. The
duplicates came from the staff-accounts migration adding new policies
without dropping the old ones. Having both is confusing and makes auditing
harder.

This migration drops the redundant "*_own_*" variants and keeps only the
"owner_*" policies (which are the ones tightened by the staff data
isolation migration).

For tables where staff need read access (arrangement_recipes,
recipe_ingredients, pos_settings), the owner_* SELECT policy includes
`OR user_id = get_owner_id_for_user(auth.uid())` — that is intentional
and not loosened here.

## profiles
The "Users can update own profile" policy allows users to update ANY
column on their own profile, including `account_role` and `owner_id`.
This is a privilege-escalation risk: a staff member could set
`account_role = 'owner'` and `owner_id = NULL` to gain owner access.

Fix: restrict the UPDATE policy to only allow updates to non-privileged
columns. We do this by adding a WITH CHECK that prevents changing
account_role or owner_id.
*/

-- ─── Drop redundant "*_own_*" policies ────────────────────────────────────

-- arrangement_recipes
DROP POLICY IF EXISTS "select_own_arrangement_recipes" ON arrangement_recipes;
DROP POLICY IF EXISTS "insert_own_arrangement_recipes" ON arrangement_recipes;
DROP POLICY IF EXISTS "update_own_arrangement_recipes" ON arrangement_recipes;
DROP POLICY IF EXISTS "delete_own_arrangement_recipes" ON arrangement_recipes;

-- markup_settings
DROP POLICY IF EXISTS "select_own_markup_settings" ON markup_settings;
DROP POLICY IF EXISTS "insert_own_markup_settings" ON markup_settings;
DROP POLICY IF EXISTS "update_own_markup_settings" ON markup_settings;
DROP POLICY IF EXISTS "delete_own_markup_settings" ON markup_settings;

-- order_products
DROP POLICY IF EXISTS "select_own_order_products" ON order_products;
DROP POLICY IF EXISTS "insert_own_order_products" ON order_products;
DROP POLICY IF EXISTS "update_own_order_products" ON order_products;
DROP POLICY IF EXISTS "delete_own_order_products" ON order_products;

-- orders
DROP POLICY IF EXISTS "select_own_orders" ON orders;
DROP POLICY IF EXISTS "insert_own_orders" ON orders;
DROP POLICY IF EXISTS "update_own_orders" ON orders;
DROP POLICY IF EXISTS "delete_own_orders" ON orders;

-- pos_settings
DROP POLICY IF EXISTS "select_own_pos_settings" ON pos_settings;
DROP POLICY IF EXISTS "insert_own_pos_settings" ON pos_settings;
DROP POLICY IF EXISTS "update_own_pos_settings" ON pos_settings;
DROP POLICY IF EXISTS "delete_own_pos_settings" ON pos_settings;

-- product_templates
DROP POLICY IF EXISTS "select_own_product_templates" ON product_templates;
DROP POLICY IF EXISTS "insert_own_product_templates" ON product_templates;
DROP POLICY IF EXISTS "update_own_product_templates" ON product_templates;
DROP POLICY IF EXISTS "delete_own_product_templates" ON product_templates;

-- recipe_ingredients
DROP POLICY IF EXISTS "select_own_recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "insert_own_recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "update_own_recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "delete_own_recipe_ingredients" ON recipe_ingredients;

-- ─── profiles: prevent privilege escalation ──────────────────────────────
-- Users can update their own profile, but CANNOT change account_role
-- or owner_id (which would allow escalating from staff to owner).

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent changing account_role or owner_id
    AND account_role = (SELECT account_role FROM profiles WHERE id = auth.uid())
    AND owner_id IS NOT DISTINCT FROM (SELECT owner_id FROM profiles WHERE id = auth.uid())
  );
