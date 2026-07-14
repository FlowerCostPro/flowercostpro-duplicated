/*
# Fix pos_settings not persisting after owner logs out

## Problem
Same bug as markup_settings: the `pos_settings` table had no unique
constraint on `user_id`. The frontend `savePosSettings` used `upsert()`
without an `onConflict` target, so PostgREST used the auto-generated
primary key `id` — every save inserted a NEW row instead of updating.
On reload, `loadPosSettings` hit multiple rows and failed, falling back
to defaults.

One user had 5 duplicate rows.

## Fix
1. Deduplicate: keep the most recently updated row per `user_id`.
2. Add a UNIQUE constraint on `user_id`.
3. Frontend upsert will use `onConflict: 'user_id'`.
*/

DELETE FROM pos_settings
WHERE id NOT IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY updated_at DESC, id DESC
      ) AS rn
    FROM pos_settings
  ) ranked
  WHERE ranked.rn = 1
);

DROP INDEX IF EXISTS pos_settings_user_id_unique;
CREATE UNIQUE INDEX pos_settings_user_id_unique
  ON pos_settings (user_id);
