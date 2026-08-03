/*
# Fix display name single source of truth + add staff recipe RPC

## Issue 1: Display name not updating
The `get_owner_profile` RPC returned only subscription/role fields but NOT
`full_name` or `store_name`. The frontend fell back to `user_metadata.full_name`
from the JWT, which is stale (set at signup, never refreshed). This made the
profiles table the ignored stepchild — updating it had no visible effect.

Fix: Add `full_name` and `store_name` to the `get_owner_profile` return so the
frontend reads from the profiles table (single source of truth).

## Issue 2: Staff cannot see arrangement recipes
`get_owner_arrangement_recipes` uses `auth.uid()` to filter, but staff auth.uid()
is their own ID, not the owner's — so staff get an empty list.

Fix: Create `get_staff_arrangement_recipes` SECURITY DEFINER function that:
- Resolves the caller's owner_id from profiles
- Returns recipes for that owner with ONLY staff-safe fields:
  recipe id, name, description, photo, website_url, website_price (retail),
  ingredients (name, quantity, type, portion_divisor, notes), updated_at
- Does NOT return: wholesale costs, markup, margin, labor percentage

## Security
- `get_staff_arrangement_recipes` is SECURITY DEFINER, runs with owner privileges,
  scoped to the caller's owner_id — no raw table access for staff.
- Execute granted to authenticated only (not anon).
*/

-- =========================================================
-- Issue 1: Add full_name and store_name to get_owner_profile
-- =========================================================

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
    'full_name', p.full_name,
    'store_name', p.store_name,
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

-- =========================================================
-- Issue 2: Create get_staff_arrangement_recipes RPC
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_staff_arrangement_recipes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Resolve the caller's owner_id
  SELECT owner_id INTO v_owner_id
  FROM profiles
  WHERE id = v_user_id AND account_role = 'staff';

  IF v_owner_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Return recipes for the owner with staff-safe fields only
  -- NO wholesale costs, markup, margin, or labor fields
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ar.id,
      'name', ar.name,
      'description', ar.description,
      'website_price', ar.website_price,
      'website_url', ar.website_url,
      'photo', ar.photo,
      'updated_at', ar.updated_at,
      'ingredients', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', ri.name,
          'quantity', ri.quantity,
          'type', ri.type,
          'portionDivisor', ri.portion_divisor,
          'notes', ri.notes
        ) ORDER BY ri.id)
        FROM recipe_ingredients ri
        WHERE ri.recipe_id = ar.id
      ), '[]'::jsonb)
    ) ORDER BY ar.updated_at DESC)
    FROM arrangement_recipes ar
    WHERE ar.user_id = v_owner_id
  ), '[]'::jsonb);
END;
$$;

-- Grant execute to authenticated only (staff are authenticated)
GRANT EXECUTE ON FUNCTION public.get_staff_arrangement_recipes() TO authenticated;

-- Revoke anon execute
REVOKE EXECUTE ON FUNCTION public.get_staff_arrangement_recipes() FROM anon;
