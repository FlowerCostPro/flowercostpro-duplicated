/*
# Pricing profile RPCs

## What this does
Creates RPC functions for managing pricing profiles and integrates them
with order saving and staff pricing.

## Functions
1. get_owner_pricing_profiles — returns all profiles for the authenticated owner
2. save_owner_pricing_profile — insert or update a single profile
3. delete_owner_pricing_profile — delete a profile (with guard against deleting
   the last/default profile)
4. get_staff_pricing_profiles — returns ONLY id and name for the staff member's
   owner profiles. Never returns markup or labor values.
5. get_working_budget_for_staff_with_profile — like get_working_budget_for_staff
   but uses a specific profile's labor_percent instead of markup_settings.
6. get_staff_product_templates_with_profile — like get_staff_product_templates
   but computes retail prices using a specific profile's markup values.

## Security
- All functions are SECURITY DEFINER with search_path = public.
- Owner functions check auth.uid() for ownership.
- Staff functions resolve owner via get_owner_id_for_user and never expose
  markup or labor values.
- Execute revoked from anon/public on all functions.
*/

-- ============================================================
-- 1. get_owner_pricing_profiles
-- ============================================================
CREATE OR REPLACE FUNCTION get_owner_pricing_profiles()
RETURNS jsonb AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'stem', stem,
        'vase', vase,
        'accessory', accessory,
        'other', other,
        'bunch', bunch,
        'labor_percent', labor_percent,
        'is_default', is_default,
        'sort_order', sort_order
      ) ORDER BY sort_order, created_at
    )
    FROM pricing_profiles
    WHERE user_id = auth.uid()),
    '[]'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION get_owner_pricing_profiles() FROM anon, public;
GRANT EXECUTE ON FUNCTION get_owner_pricing_profiles() TO authenticated;

-- ============================================================
-- 2. save_owner_pricing_profile
-- ============================================================
CREATE OR REPLACE FUNCTION save_owner_pricing_profile(
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_stem float8 DEFAULT NULL,
  p_vase float8 DEFAULT NULL,
  p_accessory float8 DEFAULT NULL,
  p_other float8 DEFAULT NULL,
  p_bunch float8 DEFAULT NULL,
  p_labor_percent float8 DEFAULT NULL,
  p_is_default boolean DEFAULT false,
  p_sort_order integer DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_id uuid;
  v_existing_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_id IS NOT NULL AND EXISTS (SELECT 1 FROM pricing_profiles WHERE id = p_id AND user_id = auth.uid()) THEN
    -- Update existing
    UPDATE pricing_profiles SET
      name = COALESCE(p_name, name),
      stem = COALESCE(p_stem, stem),
      vase = COALESCE(p_vase, vase),
      accessory = COALESCE(p_accessory, accessory),
      other = COALESCE(p_other, other),
      bunch = COALESCE(p_bunch, bunch),
      labor_percent = p_labor_percent,
      is_default = COALESCE(p_is_default, is_default),
      sort_order = COALESCE(p_sort_order, sort_order),
      updated_at = now()
    WHERE id = p_id AND user_id = auth.uid();
    v_id := p_id;
  ELSE
    -- Insert new
    INSERT INTO pricing_profiles (user_id, name, stem, vase, accessory, other, bunch, labor_percent, is_default, sort_order)
    VALUES (
      auth.uid(),
      COALESCE(p_name, 'New Profile'),
      COALESCE(p_stem, 2.5),
      COALESCE(p_vase, 2.0),
      COALESCE(p_accessory, 3.0),
      COALESCE(p_other, 2.0),
      COALESCE(p_bunch, 2.0),
      p_labor_percent,
      COALESCE(p_is_default, false),
      COALESCE(p_sort_order, 0)
    )
    RETURNING id INTO v_id;
  END IF;

  -- If this is being set as default, unset others
  IF p_is_default THEN
    UPDATE pricing_profiles SET is_default = (id = v_id) WHERE user_id = auth.uid();
  END IF;

  -- Ensure at least one default exists
  SELECT count(*) INTO v_existing_count FROM pricing_profiles WHERE user_id = auth.uid() AND is_default = true;
  IF v_existing_count = 0 THEN
    UPDATE pricing_profiles SET is_default = true WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION save_owner_pricing_profile(uuid, text, float8, float8, float8, float8, float8, float8, boolean, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION save_owner_pricing_profile(uuid, text, float8, float8, float8, float8, float8, float8, boolean, integer) TO authenticated;

-- ============================================================
-- 3. delete_owner_pricing_profile
-- ============================================================
CREATE OR REPLACE FUNCTION delete_owner_pricing_profile(p_profile_id uuid)
RETURNS void AS $$
DECLARE
  v_count integer;
  v_is_default boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT is_default INTO v_is_default FROM pricing_profiles WHERE id = p_profile_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  SELECT count(*) INTO v_count FROM pricing_profiles WHERE user_id = auth.uid();
  IF v_count <= 1 THEN RAISE EXCEPTION 'Cannot delete the last pricing profile'; END IF;
  IF v_is_default THEN RAISE EXCEPTION 'Cannot delete the default profile'; END IF;

  -- Unset profile reference on orders that used this profile
  UPDATE orders SET pricing_profile_id = NULL WHERE pricing_profile_id = p_profile_id;

  DELETE FROM pricing_profiles WHERE id = p_profile_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION delete_owner_pricing_profile(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION delete_owner_pricing_profile(uuid) TO authenticated;

-- ============================================================
-- 4. get_staff_pricing_profiles
-- Returns ONLY id and name — never markup or labor values
-- ============================================================
CREATE OR REPLACE FUNCTION get_staff_pricing_profiles()
RETURNS jsonb AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'No owner found for staff account'; END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object('id', id, 'name', name)
      ORDER BY sort_order, created_at
    )
    FROM pricing_profiles WHERE user_id = v_owner_id),
    '[]'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION get_staff_pricing_profiles() FROM anon, public;
GRANT EXECUTE ON FUNCTION get_staff_pricing_profiles() TO authenticated;

-- ============================================================
-- 5. get_working_budget_for_staff_with_profile
-- Like get_working_budget_for_staff but uses a specific profile's labor_percent
-- ============================================================
CREATE OR REPLACE FUNCTION get_working_budget_for_staff_with_profile(
  p_customer_budget numeric,
  p_profile_id uuid
) RETURNS TABLE (working_budget numeric) AS $$
DECLARE
  v_owner_id uuid;
  v_labor_pct float8;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'No owner found'; END IF;

  SELECT COALESCE(labor_percent, 0) INTO v_labor_pct
  FROM pricing_profiles WHERE id = p_profile_id AND user_id = v_owner_id;
  IF NOT FOUND THEN
    -- Fallback to markup_settings if profile not found
    SELECT COALESCE(labor_percent, 0) INTO v_labor_pct
    FROM markup_settings WHERE user_id = v_owner_id;
  END IF;

  RETURN QUERY SELECT ROUND((p_customer_budget * (1 - COALESCE(v_labor_pct, 0) / 100.0))::numeric, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION get_working_budget_for_staff_with_profile(numeric, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION get_working_budget_for_staff_with_profile(numeric, uuid) TO authenticated;

-- ============================================================
-- 6. get_staff_product_templates_with_profile
-- Like get_staff_product_templates but uses a specific profile's markup
-- ============================================================
CREATE OR REPLACE FUNCTION get_staff_product_templates_with_profile(
  p_profile_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_owner_id uuid;
  v_stem float8;
  v_vase float8;
  v_accessory float8;
  v_other float8;
  v_bunch float8;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'No owner found'; END IF;

  -- Get markup values from the profile
  SELECT stem, vase, accessory, other, bunch
  INTO v_stem, v_vase, v_accessory, v_other, v_bunch
  FROM pricing_profiles WHERE id = p_profile_id AND user_id = v_owner_id;

  IF NOT FOUND THEN
    -- Fallback to markup_settings
    SELECT
      COALESCE(ms.stem, 2.5), COALESCE(ms.vase, 2.0), COALESCE(ms.accessory, 3.0),
      COALESCE(ms.other, 2.0), COALESCE(ms.bunch, 2.0)
    INTO v_stem, v_vase, v_accessory, v_other, v_bunch
    FROM markup_settings ms WHERE ms.user_id = v_owner_id;

    v_stem := COALESCE(v_stem, 2.5);
    v_vase := COALESCE(v_vase, 2.0);
    v_accessory := COALESCE(v_accessory, 3.0);
    v_other := COALESCE(v_other, 2.0);
    v_bunch := COALESCE(v_bunch, 2.0);
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', pt.id,
        'name', pt.name,
        'type', pt.type,
        'unit', pt.unit,
        'retail_price',
        ROUND(
          CASE WHEN pt.unit = 'bunch' THEN pt.wholesale_cost * v_bunch
          ELSE pt.wholesale_cost *
            CASE pt.type
              WHEN 'stem' THEN v_stem
              WHEN 'vase' THEN v_vase
              WHEN 'accessory' THEN v_accessory
              WHEN 'other' THEN v_other
              ELSE v_stem
            END
          END, 2),
        'inventory_count', pt.inventory_count,
        'low_stock_threshold', pt.low_stock_threshold,
        'last_used', pt.last_used
      )
    )
    FROM product_templates pt
    WHERE pt.user_id = v_owner_id),
    '[]'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION get_staff_product_templates_with_profile(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION get_staff_product_templates_with_profile(uuid) TO authenticated;
