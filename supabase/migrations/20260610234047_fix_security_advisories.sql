-- ================================================================
-- 1. Fix RLS "always true" INSERT policies
-- ================================================================

-- beta_feedback: require non-empty feedback and email
DROP POLICY IF EXISTS "Anyone can insert beta feedback" ON beta_feedback;
CREATE POLICY "Anyone can insert beta feedback"
  ON beta_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    feedback IS NOT NULL AND length(trim(feedback)) > 0
    AND email IS NOT NULL AND length(trim(email)) > 0
  );

-- email_signups: require a plausibly valid email
DROP POLICY IF EXISTS "Anyone can insert email signups" ON email_signups;
CREATE POLICY "Anyone can insert email signups"
  ON email_signups FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

-- profiles: handle_new_user runs as SECURITY DEFINER and bypasses RLS,
-- so restrict the REST-API-accessible INSERT policy to own profile only.
DROP POLICY IF EXISTS "Allow trigger to insert profiles" ON profiles;
CREATE POLICY "Allow trigger to insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- ================================================================
-- 2. Revoke anon SELECT on all private tables
--    (anon role should never read user data)
-- ================================================================

REVOKE SELECT ON TABLE public.arrangement_recipes  FROM anon;
REVOKE SELECT ON TABLE public.beta_feedback        FROM anon;
REVOKE SELECT ON TABLE public.email_signups        FROM anon;
REVOKE SELECT ON TABLE public.markup_settings      FROM anon;
REVOKE SELECT ON TABLE public.order_products       FROM anon;
REVOKE SELECT ON TABLE public.orders               FROM anon;
REVOKE SELECT ON TABLE public.pos_settings         FROM anon;
REVOKE SELECT ON TABLE public.product_templates    FROM anon;
REVOKE SELECT ON TABLE public.profiles             FROM anon;
REVOKE SELECT ON TABLE public.recipe_ingredients   FROM anon;

-- beta_feedback and email_signups: authenticated users should NOT see
-- all rows (policies currently use qual = true). Restrict to admin or drop.
DROP POLICY IF EXISTS "Authenticated users can read beta feedback"  ON beta_feedback;
DROP POLICY IF EXISTS "Authenticated users can read email signups"  ON email_signups;
REVOKE SELECT ON TABLE public.beta_feedback  FROM authenticated;
REVOKE SELECT ON TABLE public.email_signups  FROM authenticated;

-- ================================================================
-- 3. Revoke public EXECUTE on trigger-only SECURITY DEFINER functions
--    These are called by triggers, not the REST API.
-- ================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
