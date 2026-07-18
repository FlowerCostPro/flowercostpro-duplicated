/*
# Fix restock failing because update_owner_product_template overwrites fields with NULL

## Problem
When a user restocks a product (or edits only inventory fields), the frontend
calls `update_owner_product_template` with `inventoryCount` plus NULL for the
other params (`name`, `wholesale_cost`, `type`, `last_used`, `unit`). The
function's UPDATE statement unconditionally assigned every param:

    name = p_name, wholesale_cost = p_wholesale_cost, type = p_type, ...

Several of those columns are NOT NULL (`name`, `wholesale_cost`, `type`,
`unit`), so the UPDATE violated the NOT NULL constraint and the whole restock
call failed with an error — inventory never updated.

## Fix
Rewrite `update_owner_product_template` to use `COALESCE(p_x, existing_column)`
for every nullable-from-the-client field, so a NULL param preserves the row's
existing value instead of overwriting it. This makes partial updates (restock,
inventory-only edits) work without clobbering name/cost/type/unit.

## Changes
- `update_owner_product_template` (replaced): UPDATE now uses COALESCE for
  name, wholesale_cost, type, unit, last_used, low_stock_threshold, and only
  sets inventory_count directly (the restock path always supplies it, and
  inventory_count is itself nullable).

## Notes
1. No schema/column changes — safe, idempotent re-creation of one function.
2. Grants re-applied for `authenticated`.
3. Signature is unchanged, so existing client RPC calls keep working.
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
    type               = COALESCE(p_type, type),
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
