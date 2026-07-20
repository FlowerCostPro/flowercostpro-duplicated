/*
# Pre-populate product library with sample products for new owner accounts

## Goals
- New owner signups get a starter product library so they can build an
  arrangement immediately, without data entry.
- Samples are clearly labeled (name suffix + is_sample flag + UI tag).
- A one-click "Remove all sample products" action bulk-deletes them.
- Samples behave as normal products: markup applies, budgets calculate,
  inventory deducts, orders save. No special-casing in calculations.
- Existing accounts are untouched — seeding only runs inside handle_new_user
  for new owner rows. No backfill.

## Schema change
- product_templates.is_sample boolean default false. Existing rows get false.
  This is an additive column; no data is lost.

## Trigger change
- handle_new_user already seeds default markup_settings for owners. Extend
  the owner branch to also INSERT the sample product_templates rows with
  is_sample = true. Staff branch (account_role = 'staff') is unchanged and
  gets no samples.

## RPC changes (owner only; staff RPCs untouched)
- get_owner_product_templates: include is_sample in the returned JSON.
- delete_owner_sample_products: new RPC — deletes all is_sample=true rows
  owned by the caller. One-click bulk removal.

## Sample set
- Matches sample-florist-data.json templates (name, cost, type, inventory,
  low_stock_threshold). Names suffixed with "(sample)" per the labeling
  requirement. unit defaults to 'stem' (all sample items are per-stem).

## Security
- delete_owner_sample_products is SECURITY DEFINER, checks auth.uid(),
  scopes DELETE to user_id = auth.uid() AND is_sample = true. Cannot delete
  a user's real products; cannot touch another shop's rows.
- No new grants to anon. authenticated keeps EXECUTE (staff workflows depend
  on existing RPCs; the new RPC is owner-only by predicate but granting to
  authenticated is consistent with the other owner RPCs and harmless since
  the predicate scopes by auth.uid()).
- No table SELECT grants changed.
*/

-- 1. Add is_sample column (additive; existing rows default to false)
ALTER TABLE product_templates
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

-- 2. Extend handle_new_user to seed sample products for new owners
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, account_role, owner_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'account_role', 'owner'),
    CASE
      WHEN NEW.raw_user_meta_data->>'owner_id' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'owner_id')::uuid
      ELSE NULL
    END
  );

  -- Only create default markup settings + sample products for owners
  IF COALESCE(NEW.raw_user_meta_data->>'account_role', 'owner') = 'owner' THEN
    INSERT INTO markup_settings (user_id, stem, vase, accessory, other)
    VALUES (NEW.id, 2.5, 2.0, 3.0, 2.0);

    INSERT INTO product_templates (user_id, name, wholesale_cost, type, unit, inventory_count, low_stock_threshold, is_sample)
    VALUES
      (NEW.id, 'Red Roses (sample)',          3.50, 'stem',      'stem', 48, 20, true),
      (NEW.id, 'White Roses (sample)',        3.75, 'stem',      'stem', 32, 20, true),
      (NEW.id, "Baby's Breath (sample)",      2.25, 'stem',      'stem', 15, 10, true),
      (NEW.id, 'Eucalyptus (sample)',         1.80, 'stem',      'stem', 25, 15, true),
      (NEW.id, 'Glass Cylinder Vase (sample)', 8.50, 'vase',      'stem', 12,  5, true),
      (NEW.id, 'Ceramic Pot (sample)',       12.00, 'vase',      'stem',  8,  5, true),
      (NEW.id, 'Satin Ribbon (sample)',       1.25, 'accessory', 'stem', 50, 10, true),
      (NEW.id, 'Floral Foam (sample)',        2.50, 'other',     'stem',  3,  5, true),
      (NEW.id, 'Pink Carnations (sample)',    2.10, 'stem',      'stem',  0, 15, true),
      (NEW.id, 'Sunflowers (sample)',         4.25, 'stem',      'stem', 18, 12, true);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. get_owner_product_templates: surface is_sample
CREATE OR REPLACE FUNCTION get_owner_product_templates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'wholesale_cost', wholesale_cost,
      'type', type, 'unit', unit, 'last_used', last_used,
      'inventory_count', inventory_count, 'low_stock_threshold', low_stock_threshold,
      'is_sample', is_sample
    ) ORDER BY last_used DESC)
    FROM product_templates WHERE user_id = auth.uid()
  ), '[]'::jsonb);
END;
$$;

-- 4. New RPC: bulk-delete the caller's sample products
CREATE OR REPLACE FUNCTION delete_owner_sample_products()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM product_templates
  WHERE user_id = auth.uid() AND is_sample = true;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_owner_sample_products() TO authenticated;

-- Preserve the lockdown: handle_new_user stays executable only by postgres
-- (it is a trigger function; never called directly by clients).
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated, public;
