-- Add missing updated_at column to product_templates
-- The trigger update_product_templates_updated_at already exists and fires on every UPDATE,
-- but without this column every update silently fails.

ALTER TABLE product_templates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE product_templates
SET updated_at = COALESCE(last_used, created_at, now())
WHERE updated_at IS NULL;
