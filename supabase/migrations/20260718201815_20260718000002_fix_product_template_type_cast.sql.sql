-- Fix: cast p_type text → product_type enum in save/update owner product template

CREATE OR REPLACE FUNCTION public.save_owner_product_template(
  p_name text, p_wholesale_cost numeric, p_type text, p_last_used timestamp with time zone,
  p_unit text, p_inventory_count numeric, p_low_stock_threshold numeric
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO product_templates (user_id, name, wholesale_cost, type, unit, last_used, inventory_count, low_stock_threshold)
  VALUES (auth.uid(), p_name, p_wholesale_cost, p_type::product_type, COALESCE(p_unit, 'stem'), p_last_used, p_inventory_count, p_low_stock_threshold)
  RETURNING id INTO v_id;
  SELECT jsonb_build_object(
    'id', id, 'name', name, 'wholesale_cost', wholesale_cost,
    'type', type, 'unit', unit, 'last_used', last_used,
    'inventory_count', inventory_count, 'low_stock_threshold', low_stock_threshold
  ) INTO v_result FROM product_templates WHERE id = v_id;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_owner_product_template(
  p_template_id uuid, p_name text, p_wholesale_cost numeric, p_type text,
  p_last_used timestamp with time zone, p_unit text, p_inventory_count numeric, p_low_stock_threshold numeric
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE product_templates SET
    name = p_name, wholesale_cost = p_wholesale_cost, type = p_type::product_type,
    unit = COALESCE(p_unit, unit),
    last_used = p_last_used, inventory_count = p_inventory_count,
    low_stock_threshold = p_low_stock_threshold
  WHERE id = p_template_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found'; END IF;
  SELECT jsonb_build_object(
    'id', id, 'name', name, 'wholesale_cost', wholesale_cost,
    'type', type, 'unit', unit, 'last_used', last_used,
    'inventory_count', inventory_count, 'low_stock_threshold', low_stock_threshold
  ) INTO v_result FROM product_templates WHERE id = p_template_id;
  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.save_owner_product_template(text, numeric, text, timestamp with time zone, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_owner_product_template(uuid, text, numeric, text, timestamp with time zone, text, numeric, numeric) TO authenticated;
