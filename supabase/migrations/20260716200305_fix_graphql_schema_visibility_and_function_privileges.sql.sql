/*
 * Security hardening: reduce GraphQL schema visibility and lock down
 * SECURITY DEFINER function execution privileges.
 *
 * Strategy:
 * - Tables: revoke ALL from anon, revoke SELECT from authenticated.
 *   Owners access data through RLS policies (which check auth.uid()),
 *   so they still get rows. Staff access data through SECURITY DEFINER
 *   RPCs that bypass RLS. The table being invisible in the GraphQL
 *   schema to authenticated is fine — the app never uses the GraphQL
 *   API directly; it uses the REST API (PostgREST), which also respects
 *   GRANTs. However, PostgREST only exposes tables the role has GRANTs
 *   on, so we must keep INSERT/UPDATE/DELETE for authenticated on tables
 *   the owner writes to directly. We only revoke SELECT (schema discovery)
 *   and rely on RLS for row-level filtering.
 *
 *   Actually — PostgREST requires SELECT to return data. If we revoke
 *   SELECT from authenticated, the owner's direct .select() calls will
 *   fail. The correct fix for "visible in GraphQL schema" is to revoke
 *   from anon only, and for authenticated, accept that RLS controls
 *   row access. The advisory's recommendation to revoke from authenticated
 *   would break the app. We revoke from anon and keep authenticated SELECT
 *   with RLS protection.
 *
 * - Functions: revoke EXECUTE from anon on all SECURITY DEFINER functions
 *   except accept_staff_invite and get_staff_invite_by_token (needed
 *   during the invite flow before the user is authenticated).
 *
 * - staff_invites: revoke ALL from anon (was arwdDxtm). The invite
 *   acceptance flow uses the get_staff_invite_by_token RPC (SECURITY
 *   DEFINER), not direct table access.
 */

-- ============================================================================
-- 1. TABLE PRIVILEGES: Revoke from anon on all tables
-- ============================================================================

-- staff_invites: anon had arwdDxtm — revoke all
REVOKE ALL ON TABLE public.staff_invites FROM anon;

-- beta_feedback and email_signups: anon had SELECT (a) — revoke
REVOKE SELECT ON TABLE public.beta_feedback FROM anon;
REVOKE SELECT ON TABLE public.email_signups FROM anon;

-- Ensure no other tables have anon privileges
REVOKE ALL ON TABLE public.arrangement_recipes FROM anon;
REVOKE ALL ON TABLE public.markup_settings FROM anon;
REVOKE ALL ON TABLE public.order_products FROM anon;
REVOKE ALL ON TABLE public.orders FROM anon;
REVOKE ALL ON TABLE public.pos_settings FROM anon;
REVOKE ALL ON TABLE public.product_templates FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.recipe_ingredients FROM anon;

-- ============================================================================
-- 2. FUNCTION PRIVILEGES: Revoke EXECUTE from anon
-- ============================================================================

-- Functions that are ONLY needed by authenticated users
REVOKE EXECUTE ON FUNCTION public.generate_pos_text(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_order_labor_amount(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_id_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_staff_markup_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_staff_product_templates() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_staff_saved_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_working_budget_for_staff(numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_staff_order(text, text, text, text, numeric, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restock_product_template(uuid, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_staff_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_staff_account(text, text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_staff_to_owner(uuid, uuid) FROM anon;

-- Functions needed during the invite flow BEFORE the user is authenticated:
--   get_staff_invite_by_token — staff invite acceptance page loads invite info
--   accept_staff_invite       — links the new auth user to the owner
-- These remain executable by anon. Both functions validate the token strictly
-- (accepted=false, expires_at > now()). accept_staff_invite also verifies
-- the p_user_id matches the newly created auth user.
-- NO CHANGES to these two functions.

-- ============================================================================
-- 3. GRANT SELECT back to anon on beta_feedback and email_signups
--    (landing page needs anon INSERT for feedback/signup, but NOT SELECT)
--    Actually — the landing page only INSERTs, so anon SELECT is not needed.
--    Leave revoked.
-- ============================================================================
