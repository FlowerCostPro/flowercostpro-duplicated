/*
# Lock down GraphQL schema visibility and function privileges

## Problem
Security advisories report:
1. Tables visible in GraphQL schema to `anon` (staff_invites) and `authenticated` (all business tables)
2. SECURITY DEFINER functions executable by `anon` and `authenticated` via PUBLIC grant

## Root Cause
All functions had `=X/postgres` (PUBLIC EXECUTE), so previous REVOKE FROM anon was
ineffective — anon retained access through PUBLIC. Tables had authenticated=arwdDxtm.

## Solution
1. Create SECURITY DEFINER RPCs for ALL owner-path data access (replacing direct table queries)
2. Revoke SELECT from authenticated on all business tables
3. Revoke EXECUTE FROM PUBLIC on all SECURITY DEFINER functions, grant back to authenticated
   (and anon for the 2 pre-auth invite functions)
4. Keep beta_feedback and email_signups anon-INSERT-only (landing page needs it)

## New Functions (21 owner RPCs)
- get_owner_profile, get_owner_product_templates, save/update/delete_owner_product_template
- get/save_owner_markup_settings
- get/save/update/delete_owner_orders
- get/save/update/delete_owner_arrangement_recipes
- get/save_owner_pos_settings
- get_pending_invites, create_invite, delete_invite

## Security Changes
- REVOKE SELECT on 9 business tables FROM authenticated
- REVOKE EXECUTE FROM PUBLIC on all SECURITY DEFINER functions
- GRANT EXECUTE to authenticated on owner + staff functions
- GRANT EXECUTE to anon on get_staff_invite_by_token, accept_staff_invite only
*/

-- ============================================================================
-- 1. OWNER RPCs — profiles
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_owner_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object(
    'id', p.id,
    'subscription_status', p.subscription_status,
    'trial_ends_at', p.trial_ends_at,
    'is_admin', p.is_admin,
    'account_role', p.account_role,
    'owner_id', p.owner_id
  )
  INTO v_result
  FROM profiles p
  WHERE p.id = v_user_id;
  RETURN v_result;
END;
$$;

-- ============================================================================
-- 2. OWNER RPCs — product_templates
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_owner_product_templates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'wholesale_cost', wholesale_cost,
      'type', type, 'last_used', last_used,
      'inventory_count', inventory_count, 'low_stock_threshold', low_stock_threshold
    ) ORDER BY last_used DESC)
    FROM product_templates WHERE user_id = auth.uid()
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_owner_product_template(
  p_name text, p_wholesale_cost numeric, p_type text, p_last_used timestamptz,
  p_inventory_count integer, p_low_stock_threshold integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO product_templates (user_id, name, wholesale_cost, type, last_used, inventory_count, low_stock_threshold)
  VALUES (auth.uid(), p_name, p_wholesale_cost, p_type, p_last_used, p_inventory_count, p_low_stock_threshold)
  RETURNING id INTO v_id;
  SELECT jsonb_build_object(
    'id', id, 'name', name, 'wholesale_cost', wholesale_cost,
    'type', type, 'last_used', last_used,
    'inventory_count', inventory_count, 'low_stock_threshold', low_stock_threshold
  ) INTO v_result FROM product_templates WHERE id = v_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_owner_product_template(
  p_template_id uuid, p_name text, p_wholesale_cost numeric, p_type text,
  p_last_used timestamptz, p_inventory_count integer, p_low_stock_threshold integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE product_templates SET
    name = p_name, wholesale_cost = p_wholesale_cost, type = p_type,
    last_used = p_last_used, inventory_count = p_inventory_count,
    low_stock_threshold = p_low_stock_threshold
  WHERE id = p_template_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found'; END IF;
  SELECT jsonb_build_object(
    'id', id, 'name', name, 'wholesale_cost', wholesale_cost,
    'type', type, 'last_used', last_used,
    'inventory_count', inventory_count, 'low_stock_threshold', low_stock_threshold
  ) INTO v_result FROM product_templates WHERE id = p_template_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_owner_product_template(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM product_templates WHERE id = p_template_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found'; END IF;
END;
$$;

-- ============================================================================
-- 3. OWNER RPCs — markup_settings
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_owner_markup_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'stem', stem, 'vase', vase, 'accessory', accessory,
    'other', other, 'labor_percent', labor_percent
  ) INTO v_result
  FROM markup_settings WHERE user_id = auth.uid();
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_owner_markup_settings(
  p_stem numeric, p_vase numeric, p_accessory numeric, p_other numeric, p_labor_percent numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO markup_settings (user_id, stem, vase, accessory, other, labor_percent)
  VALUES (auth.uid(), p_stem, p_vase, p_accessory, p_other, p_labor_percent)
  ON CONFLICT (user_id) DO UPDATE SET
    stem = EXCLUDED.stem, vase = EXCLUDED.vase, accessory = EXCLUDED.accessory,
    other = EXCLUDED.other, labor_percent = EXCLUDED.labor_percent;
END;
$$;

-- ============================================================================
-- 4. OWNER RPCs — orders + order_products
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_owner_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id, 'name', o.name, 'created_at', o.created_at,
      'total_wholesale', o.total_wholesale, 'total_retail', o.total_retail,
      'profit', o.profit, 'photo', o.photo, 'notes', o.notes,
      'staff_name', o.staff_name, 'staff_id', o.staff_id,
      'customer_price', o.customer_price, 'labor_amount', o.labor_amount,
      'products', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', op.id, 'name', op.name, 'wholesale_cost', op.wholesale_cost,
          'quantity', op.quantity, 'type', op.type, 'retail_price', op.retail_price
        ) ORDER BY op.id)
        FROM order_products op WHERE op.order_id = o.id
      ), '[]'::jsonb)
    ) ORDER BY o.created_at DESC)
    FROM orders o WHERE o.user_id = auth.uid()
  ), '[]'::jsonb);
END;
$$;

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
      (v_product->>'quantity')::int, v_product->>'type',
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
      (v_product->>'quantity')::int, v_product->>'type',
      NULLIF(v_product->>'retail_price','')::numeric);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_owner_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM orders WHERE id = p_order_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
END;
$$;

-- ============================================================================
-- 5. OWNER RPCs — arrangement_recipes + recipe_ingredients
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_owner_arrangement_recipes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ar.id, 'name', ar.name, 'description', ar.description,
      'website_price', ar.website_price, 'website_url', ar.website_url,
      'photo', ar.photo, 'updated_at', ar.updated_at,
      'ingredients', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', ri.name, 'quantity', ri.quantity, 'type', ri.type, 'notes', ri.notes
        ) ORDER BY ri.id)
        FROM recipe_ingredients ri WHERE ri.recipe_id = ar.id
      ), '[]'::jsonb)
    ) ORDER BY ar.updated_at DESC)
    FROM arrangement_recipes ar WHERE ar.user_id = auth.uid()
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_owner_arrangement_recipe(
  p_name text, p_description text, p_website_price numeric, p_website_url text,
  p_photo text, p_ingredients jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipe_id uuid;
  v_result jsonb;
  v_ingredient jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO arrangement_recipes (user_id, name, description, website_price, website_url, photo)
  VALUES (auth.uid(), p_name, p_description, p_website_price, p_website_url, p_photo)
  RETURNING id INTO v_recipe_id;
  FOR v_ingredient IN SELECT * FROM jsonb_array_elements(p_ingredients) LOOP
    INSERT INTO recipe_ingredients (recipe_id, name, quantity, type, notes)
    VALUES (v_recipe_id,
      v_ingredient->>'name', (v_ingredient->>'quantity')::int,
      v_ingredient->>'type', v_ingredient->>'notes');
  END LOOP;
  SELECT jsonb_build_object('id', id, 'updated_at', updated_at)
  INTO v_result FROM arrangement_recipes WHERE id = v_recipe_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_owner_arrangement_recipe(
  p_recipe_id uuid, p_name text, p_description text, p_website_price numeric,
  p_website_url text, p_photo text, p_ingredients jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ingredient jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE arrangement_recipes SET
    name = p_name, description = p_description, website_price = p_website_price,
    website_url = p_website_url, photo = p_photo
  WHERE id = p_recipe_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipe not found'; END IF;
  IF p_ingredients IS NOT NULL THEN
    DELETE FROM recipe_ingredients WHERE recipe_id = p_recipe_id;
    FOR v_ingredient IN SELECT * FROM jsonb_array_elements(p_ingredients) LOOP
      INSERT INTO recipe_ingredients (recipe_id, name, quantity, type, notes)
      VALUES (p_recipe_id,
        v_ingredient->>'name', (v_ingredient->>'quantity')::int,
        v_ingredient->>'type', v_ingredient->>'notes');
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_owner_arrangement_recipe(p_recipe_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM arrangement_recipes WHERE id = p_recipe_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipe not found'; END IF;
END;
$$;

-- ============================================================================
-- 6. OWNER RPCs — pos_settings
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_owner_pos_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('store_name', store_name, 'is_configured', is_configured)
  INTO v_result FROM pos_settings WHERE user_id = auth.uid();
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_owner_pos_settings(
  p_store_name text, p_is_configured boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO pos_settings (user_id, store_name, is_configured)
  VALUES (auth.uid(), p_store_name, p_is_configured)
  ON CONFLICT (user_id) DO UPDATE SET
    store_name = EXCLUDED.store_name, is_configured = EXCLUDED.is_configured;
END;
$$;

-- ============================================================================
-- 7. OWNER RPCs — staff_invites
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_invites()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'owner_id', owner_id, 'email', email,
      'token', token, 'expires_at', expires_at, 'accepted', accepted,
      'created_at', created_at
    ) ORDER BY created_at DESC)
    FROM staff_invites WHERE owner_id = auth.uid() AND accepted = false
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invite(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO staff_invites (owner_id, email)
  VALUES (auth.uid(), p_email)
  RETURNING jsonb_build_object('id', id, 'owner_id', owner_id, 'email', email, 'token', token, 'expires_at', expires_at, 'accepted', accepted, 'created_at', created_at)
  INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM staff_invites WHERE id = p_invite_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
END;
$$;

-- ============================================================================
-- 8. PRIVILEGE LOCKDOWN
-- ============================================================================

-- 8a. Revoke SELECT from authenticated on all business tables
REVOKE SELECT ON TABLE public.arrangement_recipes FROM authenticated;
REVOKE SELECT ON TABLE public.markup_settings FROM authenticated;
REVOKE SELECT ON TABLE public.order_products FROM authenticated;
REVOKE SELECT ON TABLE public.orders FROM authenticated;
REVOKE SELECT ON TABLE public.pos_settings FROM authenticated;
REVOKE SELECT ON TABLE public.product_templates FROM authenticated;
REVOKE SELECT ON TABLE public.profiles FROM authenticated;
REVOKE SELECT ON TABLE public.recipe_ingredients FROM authenticated;
REVOKE SELECT ON TABLE public.staff_invites FROM authenticated;

-- 8b. Revoke EXECUTE FROM PUBLIC on ALL SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.accept_staff_invite(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_staff_account(text, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_pos_text(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_staff() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_order_labor_amount(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_owner_id_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_staff_invite_by_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_staff_markup_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_staff_product_templates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_staff_saved_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_working_budget_for_staff(numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_staff_to_owner(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_staff_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restock_product_template(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_staff_order(text, text, text, text, numeric, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_feedback_and_extend_trial(text, text) FROM PUBLIC;

-- New owner RPCs
REVOKE EXECUTE ON FUNCTION public.get_owner_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_owner_product_templates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_owner_product_template(text, numeric, text, timestamptz, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_owner_product_template(uuid, text, numeric, text, timestamptz, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_owner_product_template(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_owner_markup_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_owner_markup_settings(numeric, numeric, numeric, numeric, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_owner_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_owner_order(text, numeric, numeric, numeric, text, text, text, text, numeric, numeric, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_owner_order(uuid, text, numeric, numeric, numeric, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_owner_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_owner_arrangement_recipes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_owner_arrangement_recipe(text, text, numeric, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_owner_arrangement_recipe(uuid, text, text, numeric, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_owner_arrangement_recipe(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_owner_pos_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_owner_pos_settings(text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pending_invites() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_invite(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_invite(uuid) FROM PUBLIC;

-- 8c. Grant EXECUTE to authenticated on all functions they need
GRANT EXECUTE ON FUNCTION public.accept_staff_invite(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_pos_text(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_labor_amount(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_id_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_invite_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_markup_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_product_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_saved_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_working_budget_for_staff(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_staff_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restock_product_template(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_staff_order(text, text, text, text, numeric, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback_and_extend_trial(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_owner_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_product_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_product_template(text, numeric, text, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_owner_product_template(uuid, text, numeric, text, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owner_product_template(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_markup_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_markup_settings(numeric, numeric, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_order(text, numeric, numeric, numeric, text, text, text, text, numeric, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_owner_order(uuid, text, numeric, numeric, numeric, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owner_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_arrangement_recipes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_arrangement_recipe(text, text, numeric, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_owner_arrangement_recipe(uuid, text, text, numeric, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owner_arrangement_recipe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_pos_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_pos_settings(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_invite(uuid) TO authenticated;

-- 8d. Grant EXECUTE to anon only on the 2 pre-auth invite functions
GRANT EXECUTE ON FUNCTION public.get_staff_invite_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.accept_staff_invite(text, uuid) TO anon;
