/*
  # Add missing updated_at column to orders table

  1. Changes
    - Add `updated_at` column to `orders` table with default value of now()
    - This fixes the error where the trigger tries to update a non-existent column

  2. Notes
    - The trigger `update_orders_updated_at` already exists and expects this column
    - This column will automatically be updated whenever an order is modified
*/

-- Add updated_at column to orders table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Update existing records to have the same updated_at as created_at
UPDATE orders 
SET updated_at = created_at 
WHERE updated_at IS NULL;
