/*
# Fix recipe save for bunch products

## What changed
- Add 'bunch' to product_type enum (used by recipe_ingredients.type).
- Add portion_divisor integer column to recipe_ingredients (nullable, default 1).
- Update save_owner_arrangement_recipe to insert portion_divisor from JSON.
- Update update_owner_arrangement_recipe to update portion_divisor from JSON.
- Update get_owner_arrangement_recipes to return portion_divisor per ingredient.

## Security
- All functions stay SECURITY DEFINER (unchanged), search_path = public.
- No new grants; existing REVOKE from anon/public preserved by recreating functions.
*/

-- 1. Add 'bunch' to the product_type enum
ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'bunch';

-- 2. Add portion_divisor column to recipe_ingredients
ALTER TABLE recipe_ingredients
  ADD COLUMN IF NOT EXISTS portion_divisor integer DEFAULT 1;

-- 3. Update save_owner_arrangement_recipe to store portion_divisor
CREATE OR REPLACE FUNCTION save_owner_arrangement_recipe(
  p_name text,
  p_description text,
  p_website_price numeric,
  p_website_url text,
  p_photo text,
  p_ingredients jsonb
) RETURNS jsonb AS $$
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
    INSERT INTO recipe_ingredients (recipe_id, name, quantity, type, notes, portion_divisor)
    VALUES (
      v_recipe_id,
      v_ingredient->>'name',
      (v_ingredient->>'quantity')::int,
      v_ingredient->>'type',
      v_ingredient->>'notes',
      COALESCE((v_ingredient->>'portionDivisor')::int, 1)
    );
  END LOOP;

  SELECT jsonb_build_object('id', id, 'updated_at', updated_at)
  INTO v_result FROM arrangement_recipes WHERE id = v_recipe_id;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Update update_owner_arrangement_recipe to store portion_divisor
CREATE OR REPLACE FUNCTION update_owner_arrangement_recipe(
  p_recipe_id uuid,
  p_name text,
  p_description text,
  p_website_price numeric,
  p_website_url text,
  p_photo text,
  p_ingredients jsonb
) RETURNS void AS $$
DECLARE
  v_ingredient jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE arrangement_recipes
  SET name = COALESCE(p_name, name),
      description = COALESCE(p_description, description),
      website_price = COALESCE(p_website_price, website_price),
      website_url = COALESCE(p_website_url, website_url),
      photo = COALESCE(p_photo, photo),
      updated_at = now()
  WHERE id = p_recipe_id AND user_id = auth.uid();

  IF p_ingredients IS NOT NULL THEN
    DELETE FROM recipe_ingredients WHERE recipe_id = p_recipe_id;
    FOR v_ingredient IN SELECT * FROM jsonb_array_elements(p_ingredients) LOOP
      INSERT INTO recipe_ingredients (recipe_id, name, quantity, type, notes, portion_divisor)
      VALUES (
        p_recipe_id,
        v_ingredient->>'name',
        (v_ingredient->>'quantity')::int,
        v_ingredient->>'type',
        v_ingredient->>'notes',
        COALESCE((v_ingredient->>'portionDivisor')::int, 1)
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Update get_owner_arrangement_recipes to return portion_divisor
CREATE OR REPLACE FUNCTION get_owner_arrangement_recipes() RETURNS jsonb AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ar.id, 'name', ar.name, 'description', ar.description,
      'website_price', ar.website_price, 'website_url', ar.website_url,
      'photo', ar.photo, 'updated_at', ar.updated_at,
      'ingredients', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', ri.name, 'quantity', ri.quantity, 'type', ri.type,
          'notes', ri.notes, 'portionDivisor', ri.portion_divisor
        ) ORDER BY ri.id)
        FROM recipe_ingredients ri WHERE ri.recipe_id = ar.id
      ), '[]'::jsonb)
    ) ORDER BY ar.updated_at DESC)
    FROM arrangement_recipes ar WHERE ar.user_id = auth.uid()
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Preserve lockdown
REVOKE EXECUTE ON FUNCTION save_owner_arrangement_recipe(text, text, numeric, text, text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION update_owner_arrangement_recipe(uuid, text, text, numeric, text, text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION get_owner_arrangement_recipes() FROM anon, public;
