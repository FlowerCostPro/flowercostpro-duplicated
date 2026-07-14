/*
# Add get_staff_markup_settings RPC (corrected)

Staff cannot read `markup_settings` directly — RLS policies require
`user_id = auth.uid()`, but the rows belong to the owner. Without the
markup multipliers, staff see default markups (2.5/2.0/3.0/2.0) instead
of the owner's configured values, and `laborPercent` is undefined so
labor is never deducted in the client-side cost analysis.

This RPC returns the owner's markup multipliers (stem, vase, accessory,
other) but deliberately omits `labor_percent` — staff should never see
the labor percentage. Labor is already applied server-side by
`get_working_budget_for_staff` and `save_staff_order`.
*/

DROP FUNCTION IF EXISTS get_staff_markup_settings();

CREATE OR REPLACE FUNCTION get_staff_markup_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id  uuid;
  v_result   jsonb;
BEGIN
  v_owner_id := get_owner_id_for_user(auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not a staff account';
  END IF;

  SELECT jsonb_build_object(
    'stem',      COALESCE(ms.stem,      2.5),
    'vase',      COALESCE(ms.vase,      2.0),
    'accessory', COALESCE(ms.accessory, 3.0),
    'other',     COALESCE(ms.other,     2.0)
  )
  INTO v_result
  FROM markup_settings ms
  WHERE ms.user_id = v_owner_id;

  RETURN COALESCE(v_result, jsonb_build_object(
    'stem', 2.5, 'vase', 2.0, 'accessory', 3.0, 'other', 2.0
  ));
END;
$$;
