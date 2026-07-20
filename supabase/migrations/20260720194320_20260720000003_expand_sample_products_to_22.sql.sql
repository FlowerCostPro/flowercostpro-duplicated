/*
# Expand sample product set to 22 items

## What changed
- handle_new_user now seeds 22 sample products (was 10).
- All items marked is_sample = true and suffixed "(sample)".
- Includes 3 bunch-priced items (Baby's Breath, Leather Leaf, Silver Dollar Euc)
  with unit = 'bunch' and bunch wholesale cost.
- Costs and inventory updated to match the user's provided product library data.
- markup_settings insert now explicitly sets bunch = 2.0 (was relying on column
  default) for clarity, so bunch retail prices compute correctly.

## No schema changes
- is_sample column already added in 20260720000001.
- No new RPCs.

## Security
- handle_new_user stays SECURITY DEFINER, trigger-only (REVOKE from anon/auth/public).
- No new grants.
*/

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
    INSERT INTO markup_settings (user_id, stem, vase, accessory, other, bunch)
    VALUES (NEW.id, 2.5, 2.0, 3.0, 2.0, 2.0);

    INSERT INTO product_templates (user_id, name, wholesale_cost, type, unit, inventory_count, low_stock_threshold, is_sample)
    VALUES
      (NEW.id, 'Alstromeria (sample)',               0.65, 'stem',      'stem', 30, 10, true),
      (NEW.id, 'Baby''s Breath (sample)',            8.00, 'stem',      'bunch', 15,  5, true),
      (NEW.id, 'Ceramic Pot (sample)',              12.00, 'vase',      'stem',  8,  5, true),
      (NEW.id, 'Cube Vase (sample)',                 2.75, 'vase',      'stem', 12,  5, true),
      (NEW.id, 'Eucalyptus (sample)',                1.80, 'stem',      'stem', 25, 10, true),
      (NEW.id, 'Floral Foam (sample)',               2.50, 'other',     'stem', 39,  5, true),
      (NEW.id, 'gerbera Daisy (sample)',             1.25, 'stem',      'stem', 20, 10, true),
      (NEW.id, 'Ginber Vase (sample)',               3.50, 'vase',      'stem', 12,  5, true),
      (NEW.id, 'Glass Cylinder Vase (sample)',       8.50, 'vase',      'stem', 12,  5, true),
      (NEW.id, 'Hydrangea (sample)',                 2.25, 'stem',      'stem', 20, 10, true),
      (NEW.id, 'Leather Leaf (sample)',              6.50, 'stem',      'bunch', 10,  5, true),
      (NEW.id, 'Oriental Lily (sample)',             2.00, 'stem',      'stem', 20, 10, true),
      (NEW.id, 'Pink Carnations (sample)',           0.55, 'stem',      'stem', 25, 10, true),
      (NEW.id, 'Red Roses (sample)',                 1.25, 'stem',      'stem', 48, 10, true),
      (NEW.id, 'Ribbon #9 per yd (sample)',          0.40, 'accessory', 'stem', 10, 10, true),
      (NEW.id, 'Satin Ribbon (sample)',              1.25, 'accessory', 'stem', 50, 10, true),
      (NEW.id, 'Silver Dollar Euc (sample)',         9.50, 'stem',      'bunch', 10,  5, true),
      (NEW.id, 'Snapdragon (sample)',                1.00, 'stem',      'stem', 20, 10, true),
      (NEW.id, 'Spray Rose (sample)',                0.95, 'stem',      'stem', 20, 10, true),
      (NEW.id, 'Stock (sample)',                     0.90, 'stem',      'stem', 30, 10, true),
      (NEW.id, 'Sunflowers (sample)',                1.10, 'stem',      'stem', 18, 10, true),
      (NEW.id, 'White Roses (sample)',               3.75, 'stem',      'stem', 32, 10, true);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Preserve lockdown: trigger function is never called directly by clients.
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated, public;
