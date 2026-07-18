/*
# Security hardening: revoke anon on generate_pos_text + scope get_owner_id_for_user to caller

## Scope
Four security items requested; this migration addresses the two that are
database-side. No values, calculations, table SELECT grants, or authenticated
EXECUTE grants are touched.

## Change 1 — Revoke anon EXECUTE on generate_pos_text
generate_pos_text reads stored order/line-item data (names, quantities, retail
prices, labor, totals) and is meant for authenticated shop users only. anon
currently has EXECUTE and must not — an unauthenticated request could feed an
order id and receive itemized pricing. Revoke anon; leave authenticated (staff
workflows depend on it). The function's internal permission logic (shop
resolution via get_owner_id_for_user + ownership check) is unchanged.

## Change 2 — Scope get_owner_id_for_user to the calling user
Current body:  SELECT owner_id FROM profiles WHERE id = p_user_id;
This accepts ANY uuid. An authenticated user could call it with another user's
id and learn that user's owner_id (a metadata leak, and a stepping stone to
further probing).

Hardened body: SELECT owner_id FROM profiles WHERE id = p_user_id AND id = auth.uid();
Now it only returns a value when the queried id is the caller's own. For any
other id it returns NULL.

## Why this is safe for existing callers
Every call site passes auth.uid():
  - RLS policies on profiles, orders, order_products, arrangement_recipes,
    markup_settings, etc. all use get_owner_id_for_user(auth.uid()).
  - generate_pos_text and other SECURITY DEFINER RPCs call it with auth.uid().
    (SECURITY DEFINER preserves auth.uid() as the original caller.)
With the new guard, p_user_id = auth.uid() in every existing call, so the
predicate still matches and behavior is identical. Only direct RPC calls with
a foreign id now return NULL instead of leaking.

## Notes
1. No schema/column changes.
2. No grants added or removed on get_owner_id_for_user (authenticated keeps
   EXECUTE; anon already lacks it).
3. No table SELECT grants changed.
4. remove_staff_member is NOT modified — its ownership check is already
   correct (verified separately).
*/

-- 1. Revoke anon EXECUTE on generate_pos_text (authenticated unchanged)
REVOKE EXECUTE ON FUNCTION public.generate_pos_text(uuid) FROM anon;

-- 2. Harden get_owner_id_for_user to only resolve for the calling user
CREATE OR REPLACE FUNCTION public.get_owner_id_for_user(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT owner_id FROM profiles WHERE id = p_user_id AND id = auth.uid();
$$;
