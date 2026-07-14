/*
# Add restock_product_template RPC for staff

Staff cannot directly UPDATE product_templates (RLS blocks them — the
rows belong to the owner). Reads use get_staff_product_templates(); we
need an equivalent SECURITY DEFINER function for inventory updates.

This RPC lets a staff user restock or set stock for one of their owner's
product templates. It validates ownership via get_owner_id_for_user()
and only updates the template if it belongs to that owner.
*/

CREATE OR REPLACE FUNCTION restock_product_template(
  p_template_id       uuid,
  p_inventory_count   integer,
  p_low_stock_threshold integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: caller is not a staff account';
  END IF;

  -- Verify the template belongs to the owner
  PERFORM 1 FROM product_templates
  WHERE id = p_template_id AND user_id = v_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  UPDATE product_templates
  SET
    inventory_count     = p_inventory_count,
    low_stock_threshold = COALESCE(p_low_stock_threshold, low_stock_threshold)
  WHERE id = p_template_id AND user_id = v_owner_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
