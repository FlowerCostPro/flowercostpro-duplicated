/*
# Fix: "Database error saving new user"

## Root cause
handle_new_user (AFTER INSERT trigger on auth.users) seeded sample products.
One row used double quotes for a string containing an apostrophe:
  "Baby's Breath (sample)"
In PostgreSQL double quotes denote an identifier, not a string literal, so
when the trigger fired during signup that row raised an error and the entire
transaction (user creation) rolled back — surfacing as
"Database error saving new user".

## Fix
Replace the double-quoted literal with a single-quoted string and escape the
apostrophe as '':
  'Baby''s Breath (sample)'
All other rows were already single-quoted and correct. No schema changes.
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
    INSERT INTO markup_settings (user_id, stem, vase, accessory, other)
    VALUES (NEW.id, 2.5, 2.0, 3.0, 2.0);

    INSERT INTO product_templates (user_id, name, wholesale_cost, type, unit, inventory_count, low_stock_threshold, is_sample)
    VALUES
      (NEW.id, 'Red Roses (sample)',          3.50, 'stem',      'stem', 48, 20, true),
      (NEW.id, 'White Roses (sample)',        3.75, 'stem',      'stem', 32, 20, true),
      (NEW.id, 'Baby''s Breath (sample)',     2.25, 'stem',      'stem', 15, 10, true),
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

-- Preserve lockdown: trigger function is never called directly by clients.
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated, public;
