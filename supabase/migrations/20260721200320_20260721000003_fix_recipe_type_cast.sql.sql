/*
# Fix recipe save: cast type text -> product_type enum

The jsonb access `v_ingredient->>'type'` returns text, but the column is
product_type enum. Add explicit ::product_type casts in both RPCs.
*/

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
  v_qty int;
  v_portion int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO arrangement_recipes (user_id, name, description, website_price, website_url, photo)
  VALUES (auth.uid(), p_name, p_description, p_website_price, p_website_url, p_photo)
  RETURNING id INTO v_recipe_id;

  FOR v_ingredient IN SELECT * FROM jsonb_array_elements(p_ingredients) LOOP
    v_qty := COALESCE(NULLIF((v_ingredient->>'quantity'), '')::int, 1);
    v_portion := COALESCE(NULLIF((v_ingredient->>'portionDivisor'), '')::int, 1);
    INSERT INTO recipe_ingredients (recipe_id, name, quantity, type, notes, portion_divisor)
    VALUES (
      v_recipe_id,
      v_ingredient->>'name',
      v_qty,
      (v_ingredient->>'type')::product_type,
      v_ingredient->>'notes',
      v_portion
    );
  END LOOP;

  SELECT jsonb_build_object('id', id, 'updated_at', updated_at)
  INTO v_result FROM arrangement_recipes WHERE id = v_recipe_id;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
  v_qty int;
  v_portion int;
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
      v_qty := COALESCE(NULLIF((v_ingredient->>'quantity'), '')::int, 1);
      v_portion := COALESCE(NULLIF((v_ingredient->>'portionDivisor'), '')::int, 1);
      INSERT INTO recipe_ingredients (recipe_id, name, quantity, type, notes, portion_divisor)
      VALUES (
        p_recipe_id,
        v_ingredient->>'name',
        v_qty,
        (v_ingredient->>'type')::product_type,
        v_ingredient->>'notes',
        v_portion
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION save_owner_arrangement_recipe(text, text, numeric, text, text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION update_owner_arrangement_recipe(uuid, text, text, numeric, text, text, jsonb) FROM anon, public;
