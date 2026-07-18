/*
# Fix update_owner_product_template: restore product_type cast lost in prior COALESCE migration

## Problem
The previous migration (20260718190000) added COALESCE to preserve existing
values when a param is NULL, but it dropped the `p_type::product_type` cast
that migration 20260718000002 had added. `COALESCE(p_type, type)` fails
because `p_type` is `text` and the `type` column is the `product_type` enum —
PostgreSQL cannot resolve the type mismatch, so every restock/inventory update
threw an error ("failed to update inventory").

## Fix
Use `COALESCE(p_type::product_type, type)` so a provided type string is cast
to the enum, and a NULL param preserves the existing enum value. Same
COALESCE treatment for the other nullable-from-client fields. Also coalesce
`last_used` and set `updated_at = now()`.

## Changes
- `update_owner_product_template` (replaced): COALESCE for every field, with
  `p_type::product_type` cast restored.

## Notes
1. No schema/column changes — safe, idempotent re-creation of one function.
2. Grants re-applied for `authenticated`.
3. Signature unchanged.
*/

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
    name               = COALESCE(p_name, name),
    wholesale_cost     = COALESCE(p_wholesale_cost, wholesale_cost),
    type               = COALESCE(p_type::product_type, type),
    unit               = COALESCE(p_unit, unit),
    last_used          = COALESCE(p_last_used, last_used),
    inventory_count    = COALESCE(p_inventory_count, inventory_count),
    low_stock_threshold = COALESCE(p_low_stock_threshold, low_stock_threshold),
    updated_at         = now()
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

GRANT EXECUTE ON FUNCTION public.update_owner_product_template(uuid, text, numeric, text, timestamp with time zone, text, numeric, numeric) TO authenticated;
