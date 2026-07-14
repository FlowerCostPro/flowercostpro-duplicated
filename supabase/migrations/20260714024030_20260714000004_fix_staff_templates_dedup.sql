/*
# Fix get_staff_product_templates: use DISTINCT ON to prevent duplicate rows

## Problem
The original LEFT JOIN of product_templates onto markup_settings could produce
duplicate rows if multiple markup_settings rows existed for the same owner
(e.g. from a previous upsert that used a non-unique conflict key). Each extra
markup_settings row caused every product to appear an extra time in the staff
product list.

## Fix
Replace the simple LEFT JOIN with a LATERAL subquery that fetches at most one
markup_settings row per product_template row. This guarantees exactly one row
per product regardless of how many markup_settings rows exist for the owner.

## No data changes — function definition only.
*/

CREATE OR REPLACE FUNCTION get_staff_product_templates()
RETURNS TABLE (
  id              uuid,
  name            text,
  type            text,
  inventory_count integer,
  low_stock_threshold integer,
  last_used       timestamptz,
  retail_price    numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pt.id,
    pt.name,
    pt.type::text,
    pt.inventory_count,
    pt.low_stock_threshold,
    pt.last_used,
    ROUND(
      pt.wholesale_cost * CASE pt.type
        WHEN 'stem'      THEN COALESCE(ms.stem,      2.5)
        WHEN 'vase'      THEN COALESCE(ms.vase,      2.0)
        WHEN 'accessory' THEN COALESCE(ms.accessory, 3.0)
        ELSE                  COALESCE(ms.other,     2.0)
      END,
      2
    ) AS retail_price
  FROM product_templates pt
  LEFT JOIN LATERAL (
    SELECT stem, vase, accessory, other
    FROM markup_settings
    WHERE user_id = pt.user_id
    LIMIT 1
  ) ms ON true
  WHERE pt.user_id = get_owner_id_for_user(auth.uid())
    AND get_owner_id_for_user(auth.uid()) IS NOT NULL
  ORDER BY pt.last_used DESC;
$$;
