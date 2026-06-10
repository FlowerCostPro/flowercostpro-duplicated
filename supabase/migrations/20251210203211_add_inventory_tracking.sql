/*
  # Add Inventory Tracking to Product Templates

  1. Changes
    - Add `inventory_count` column to `product_templates` table
      - Nullable integer to track current inventory levels
      - Defaults to NULL (no tracking) for flexibility
    - Add `low_stock_threshold` column to `product_templates` table
      - Nullable integer to set low stock alert threshold
      - Defaults to NULL (no alerts)
  
  2. Benefits
    - Enables inventory management for products
    - Supports low stock alerts
    - Optional fields allow gradual adoption
    - NULL values indicate inventory not tracked for that product
  
  3. Notes
    - Existing products will have NULL values (inventory not tracked)
    - Users can add inventory tracking to specific products as needed
    - Negative inventory counts are allowed to handle backorders
*/

-- Add inventory_count column to product_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_templates' AND column_name = 'inventory_count'
  ) THEN
    ALTER TABLE product_templates ADD COLUMN inventory_count integer;
  END IF;
END $$;

-- Add low_stock_threshold column to product_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_templates' AND column_name = 'low_stock_threshold'
  ) THEN
    ALTER TABLE product_templates ADD COLUMN low_stock_threshold integer;
  END IF;
END $$;

-- Add index for querying low stock items
CREATE INDEX IF NOT EXISTS idx_product_templates_low_stock 
  ON product_templates(inventory_count, low_stock_threshold) 
  WHERE inventory_count IS NOT NULL AND low_stock_threshold IS NOT NULL;