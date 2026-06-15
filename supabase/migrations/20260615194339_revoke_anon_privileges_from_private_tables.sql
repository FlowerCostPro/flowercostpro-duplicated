-- Revoke ALL privileges from anon on private tables.
-- RLS already blocks access by policy, but the advisor flags table-level grants.
-- These tables are only for authenticated users.
REVOKE ALL ON public.arrangement_recipes   FROM anon;
REVOKE ALL ON public.markup_settings       FROM anon;
REVOKE ALL ON public.order_products        FROM anon;
REVOKE ALL ON public.orders                FROM anon;
REVOKE ALL ON public.pos_settings          FROM anon;
REVOKE ALL ON public.product_templates     FROM anon;
REVOKE ALL ON public.profiles              FROM anon;
REVOKE ALL ON public.recipe_ingredients    FROM anon;

-- beta_feedback and email_signups accept anonymous submissions from the landing page.
-- Revoke everything, then re-grant only INSERT.
REVOKE ALL ON public.beta_feedback  FROM anon;
REVOKE ALL ON public.email_signups  FROM anon;
GRANT INSERT ON public.beta_feedback  TO anon;
GRANT INSERT ON public.email_signups  TO anon;
