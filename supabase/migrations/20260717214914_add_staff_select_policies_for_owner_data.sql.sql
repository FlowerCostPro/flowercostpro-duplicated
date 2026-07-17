/*
# Fix: Add staff SELECT policies for owner-shared data

When staff RPCs were SECURITY DEFINER they bypassed RLS to read the owner's
product_templates, markup_settings, and orders. Now that they're SECURITY
INVOKER, RLS blocks staff from reading owner data because the existing
SELECT policies only allow `user_id = auth.uid()`.

Add permissive SELECT policies that allow staff to read rows where
`user_id = get_owner_id_for_user(auth.uid())`.
*/

-- product_templates: staff can read their owner's templates
CREATE POLICY "staff_select_product_templates"
  ON public.product_templates FOR SELECT
  TO authenticated
  USING (user_id = get_owner_id_for_user(auth.uid()));

-- markup_settings: staff can read their owner's markup settings
CREATE POLICY "staff_select_markup_settings"
  ON public.markup_settings FOR SELECT
  TO authenticated
  USING (user_id = get_owner_id_for_user(auth.uid()));

-- orders: staff can read their owner's orders
CREATE POLICY "staff_select_orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (user_id = get_owner_id_for_user(auth.uid()));
