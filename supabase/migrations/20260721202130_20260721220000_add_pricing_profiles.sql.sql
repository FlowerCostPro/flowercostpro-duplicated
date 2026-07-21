/*
# Add pricing profiles for occasion-based pricing

## What this does
Creates a `pricing_profiles` table so each shop can have multiple markup/labor
configurations (e.g. Everyday, Wedding, Funeral). Each arrangement picks one
profile; all pricing for that arrangement uses the profile's numbers.

## New Tables
- `pricing_profiles`
  - id (uuid PK)
  - user_id (uuid, owner reference, defaults to auth.uid())
  - name (text, e.g. "Everyday", "Wedding", "Funeral")
  - stem (float8, markup multiplier for stems)
  - vase (float8, markup multiplier for vases)
  - accessory (float8, markup multiplier for accessories)
  - other (float8, markup multiplier for other items)
  - bunch (float8, markup multiplier for bunches)
  - labor_percent (float8, nullable, labor deduction percentage)
  - is_default (bool, marks the "Everyday" default profile)
  - sort_order (int, display ordering)
  - created_at, updated_at (timestamps)

## Modified Tables
- `orders` — adds `pricing_profile_id` (nullable uuid FK to pricing_profiles)
  so each saved order records which profile was used.

## Security
- RLS enabled on pricing_profiles.
- Owner: full CRUD on own profiles (authenticated, auth.uid() = user_id).
- Staff: SELECT only on the owner's profiles — but only id and name are
  returned via a dedicated RPC (get_staff_pricing_profiles), so staff never
  see markup or labor values. The table-level SELECT policy is scoped to the
  owner; staff access the profile list through an RPC that returns only
  id + name.

## Default seeding
A DO block seeds three default profiles (Everyday, Wedding, Funeral) for each
existing owner who has a markup_settings row, copying their current values
into the "Everyday" profile. Owners without markup_settings get defaults
on first profile load via the RPC fallback.

## Important notes
1. Existing orders have NULL pricing_profile_id — they predate this feature
   and are treated as "Everyday" for reporting.
2. The current markup_settings table is NOT touched — it remains the
   fallback for shops that never create profiles. The "Everyday" profile
   is seeded from markup_settings so values stay in sync at migration time.
3. Staff never receive markup or labor values — only profile id and name.
*/

CREATE TABLE IF NOT EXISTS pricing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  stem float8 NOT NULL DEFAULT 2.5,
  vase float8 NOT NULL DEFAULT 2.0,
  accessory float8 NOT NULL DEFAULT 3.0,
  other float8 NOT NULL DEFAULT 2.0,
  bunch float8 NOT NULL DEFAULT 2.0,
  labor_percent float8,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pricing_profiles ENABLE ROW LEVEL SECURITY;

-- Owner policies: full CRUD on own profiles
DROP POLICY IF EXISTS "select_own_pricing_profiles" ON pricing_profiles;
CREATE POLICY "select_own_pricing_profiles" ON pricing_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_pricing_profiles" ON pricing_profiles;
CREATE POLICY "insert_own_pricing_profiles" ON pricing_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_pricing_profiles" ON pricing_profiles;
CREATE POLICY "update_own_pricing_profiles" ON pricing_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_pricing_profiles" ON pricing_profiles;
CREATE POLICY "delete_own_pricing_profiles" ON pricing_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add pricing_profile_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pricing_profile_id uuid REFERENCES pricing_profiles(id) ON DELETE SET NULL;

-- Seed default profiles for existing owners from their current markup_settings
DO $$
DECLARE
  owner_record RECORD;
  everyday_id uuid;
BEGIN
  FOR owner_record IN SELECT DISTINCT user_id FROM markup_settings LOOP
    -- Skip if they already have profiles
    IF NOT EXISTS (SELECT 1 FROM pricing_profiles WHERE user_id = owner_record.user_id) THEN
      INSERT INTO pricing_profiles (user_id, name, stem, vase, accessory, other, bunch, labor_percent, is_default, sort_order)
      SELECT
        owner_record.user_id,
        'Everyday',
        COALESCE(ms.stem, 2.5),
        COALESCE(ms.vase, 2.0),
        COALESCE(ms.accessory, 3.0),
        COALESCE(ms.other, 2.0),
        COALESCE(ms.bunch, 2.0),
        ms.labor_percent,
        true,
        0
      FROM markup_settings ms
      WHERE ms.user_id = owner_record.user_id
      LIMIT 1;

      INSERT INTO pricing_profiles (user_id, name, stem, vase, accessory, other, bunch, labor_percent, is_default, sort_order)
      VALUES
        (owner_record.user_id, 'Wedding', 3.0, 2.5, 3.5, 2.5, 2.5, NULL, false, 1),
        (owner_record.user_id, 'Funeral', 2.5, 2.0, 3.0, 2.0, 2.0, NULL, false, 2);
    END IF;
  END LOOP;
END $$;

-- Index for querying profiles by owner
CREATE INDEX IF NOT EXISTS idx_pricing_profiles_user_id ON pricing_profiles(user_id);
