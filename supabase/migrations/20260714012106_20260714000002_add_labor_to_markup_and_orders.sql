/*
# Add labor percentage to markup settings and labor fields to orders

## Summary
Adds support for an optional labor charge that owners can configure as a
percentage of the customer's arrangement price. When set, the labor amount
is captured at order time and tracked separately for reporting.

## Changes

### markup_settings
- New column `labor_percent` (float8, nullable) — the owner's configured labor
  percentage, e.g. 25.0 means 25%. NULL or 0 means the feature is off.

### orders
- New column `customer_price` (numeric, nullable) — the full price the customer
  pays (what the staff entered as "customer's budget"). NULL for orders created
  before this feature existed, or when no budget was entered.
- New column `labor_amount` (numeric, nullable) — the dollar amount deducted for
  labor, e.g. 25% of $85 = $21.25. NULL when labor is not configured.

## Notes
- Both new columns are nullable so all existing orders and markup settings
  remain valid without migration of data.
- `total_retail` continues to reflect the sum of product retail prices (what
  the designer built to). `customer_price` is the full customer-facing price.
  When labor is active: customer_price = product total + labor_amount.
- `profit` on orders is recalculated at save time as:
    customer_price - total_wholesale - labor_amount (if labor is active)
  or the original: total_retail - total_wholesale (if not).
*/

ALTER TABLE markup_settings
  ADD COLUMN IF NOT EXISTS labor_percent float8;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_price numeric,
  ADD COLUMN IF NOT EXISTS labor_amount numeric;
