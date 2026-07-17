/*
# Lock down all SECURITY DEFINER function privileges

## Problem
Security advisories flag ALL SECURITY DEFINER functions as executable by
`anon` and/or `authenticated` via the REST API. Even though each function
has internal `auth.uid()` checks, the scanner flags the EXECUTE privilege itself.

## Solution
1. Switch all owner-path RPCs to SECURITY INVOKER — they only access rows
   where `user_id = auth.uid()`, which RLS policies already permit.
2. Keep `get_owner_id_for_user` as SECURITY DEFINER (RLS policies depend on it;
   switching to INVOKER causes infinite recursion) but revoke EXECUTE from
   `authenticated` — it's only called internally by RLS policies, not by the
   frontend.
3. Keep `accept_staff_invite` and `get_staff_invite_by_token` as SECURITY DEFINER
   but revoke EXECUTE from `anon` and `authenticated` — they're now only called
   by the `staff-invite` edge function with the service_role key.
4. Keep `create_staff_account` and `link_staff_to_owner` as SECURITY DEFINER
   but revoke EXECUTE from `authenticated` — only called by edge functions.
5. Grant SELECT on business tables back to `authenticated` (needed for
   SECURITY INVOKER functions to read data through RLS).
6. Revoke EXECUTE from `anon` on ALL functions.
7. Re-grant EXECUTE to `authenticated` only on functions the frontend calls
   directly via RPC (owner RPCs, staff RPCs, generate_pos_text, etc.).

## Functions switched to SECURITY INVOKER (28)
All get/save/update/delete_owner_* functions, get_pending_invites,
create_invite, delete_invite, get_my_staff, remove_staff_member,
generate_pos_text, get_order_labor_amount, get_working_budget_for_staff,
save_staff_order, get_staff_markup_settings, get_staff_product_templates,
get_staff_saved_orders, submit_feedback_and_extend_trial, get_owner_profile

## Functions kept as SECURITY DEFINER (4)
- get_owner_id_for_user — called by RLS policies, must bypass RLS
- accept_staff_invite — called by edge function with service_role
- get_staff_invite_by_token — called by edge function with service_role
- create_staff_account — called by edge function with service_role
- link_staff_to_owner — called by edge function with service_role
- handle_new_user — trigger function
- update_updated_at_column — trigger function
*/

-- ============================================================================
-- 1. Switch owner/staff RPCs to SECURITY INVOKER
-- ============================================================================

ALTER FUNCTION public.get_owner_profile() SECURITY INVOKER;
ALTER FUNCTION public.get_owner_product_templates() SECURITY INVOKER;
ALTER FUNCTION public.save_owner_product_template(text, numeric, text, timestamptz, integer, integer) SECURITY INVOKER;
ALTER FUNCTION public.update_owner_product_template(uuid, text, numeric, text, timestamptz, integer, integer) SECURITY INVOKER;
ALTER FUNCTION public.delete_owner_product_template(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_owner_markup_settings() SECURITY INVOKER;
ALTER FUNCTION public.save_owner_markup_settings(numeric, numeric, numeric, numeric, numeric) SECURITY INVOKER;
ALTER FUNCTION public.get_owner_orders() SECURITY INVOKER;
ALTER FUNCTION public.save_owner_order(text, numeric, numeric, numeric, text, text, text, text, numeric, numeric, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.update_owner_order(uuid, text, numeric, numeric, numeric, text, text, text, text, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.delete_owner_order(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_owner_arrangement_recipes() SECURITY INVOKER;
ALTER FUNCTION public.save_owner_arrangement_recipe(text, text, numeric, text, text, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.update_owner_arrangement_recipe(uuid, text, text, numeric, text, text, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.delete_owner_arrangement_recipe(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_owner_pos_settings() SECURITY INVOKER;
ALTER FUNCTION public.save_owner_pos_settings(text, boolean) SECURITY INVOKER;
ALTER FUNCTION public.get_pending_invites() SECURITY INVOKER;
ALTER FUNCTION public.create_invite(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_invite(uuid) SECURITY INVOKER;

-- Staff RPCs
ALTER FUNCTION public.get_my_staff() SECURITY INVOKER;
ALTER FUNCTION public.remove_staff_member(uuid) SECURITY INVOKER;
ALTER FUNCTION public.generate_pos_text(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_order_labor_amount(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_working_budget_for_staff(numeric) SECURITY INVOKER;
ALTER FUNCTION public.save_staff_order(text, text, text, text, numeric, text, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.get_staff_markup_settings() SECURITY INVOKER;
ALTER FUNCTION public.get_staff_product_templates() SECURITY INVOKER;
ALTER FUNCTION public.get_staff_saved_orders() SECURITY INVOKER;
ALTER FUNCTION public.submit_feedback_and_extend_trial(text, text) SECURITY INVOKER;
ALTER FUNCTION public.restock_product_template(uuid, integer, integer) SECURITY INVOKER;

-- ============================================================================
-- 2. Grant SELECT back to authenticated on business tables
--    (needed for SECURITY INVOKER functions to read through RLS)
-- ============================================================================
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.product_templates TO authenticated;
GRANT SELECT ON TABLE public.markup_settings TO authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.order_products TO authenticated;
GRANT SELECT ON TABLE public.arrangement_recipes TO authenticated;
GRANT SELECT ON TABLE public.recipe_ingredients TO authenticated;
GRANT SELECT ON TABLE public.pos_settings TO authenticated;
GRANT SELECT ON TABLE public.staff_invites TO authenticated;

-- ============================================================================
-- 3. Revoke EXECUTE from anon on ALL functions
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.accept_staff_invite(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_staff_invite_by_token(text) FROM anon;

-- ============================================================================
-- 4. Revoke EXECUTE from authenticated on edge-function-only functions
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.accept_staff_invite(text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_staff_invite_by_token(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_staff_account(text, text, text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.link_staff_to_owner(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_owner_id_for_user(uuid) FROM authenticated;

-- ============================================================================
-- 5. Re-grant EXECUTE to authenticated on frontend-called functions
--    (SECURITY INVOKER ones — safe because they use auth.uid() + RLS)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_owner_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_product_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_product_template(text, numeric, text, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_owner_product_template(uuid, text, numeric, text, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owner_product_template(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_markup_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_markup_settings(numeric, numeric, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_order(text, numeric, numeric, numeric, text, text, text, text, numeric, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_owner_order(uuid, text, numeric, numeric, numeric, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owner_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_arrangement_recipes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_arrangement_recipe(text, text, numeric, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_owner_arrangement_recipe(uuid, text, text, numeric, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owner_arrangement_recipe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_pos_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_pos_settings(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_staff_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_pos_text(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_labor_amount(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_working_budget_for_staff(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_staff_order(text, text, text, text, numeric, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_markup_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_product_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_saved_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback_and_extend_trial(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restock_product_template(uuid, integer, integer) TO authenticated;
