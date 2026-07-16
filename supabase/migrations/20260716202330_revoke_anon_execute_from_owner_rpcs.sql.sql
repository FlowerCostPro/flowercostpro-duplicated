/*
# Revoke anon EXECUTE from owner RPCs

The new owner RPCs created in the previous migration still have anon execute
privileges (PostgreSQL grants EXECUTE to PUBLIC by default on function creation,
and Supabase may mirror this to anon explicitly). Revoke EXECUTE from anon on
all owner-only functions.
*/

REVOKE EXECUTE ON FUNCTION public.get_owner_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_product_templates() FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_owner_product_template(text, numeric, text, timestamptz, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_owner_product_template(uuid, text, numeric, text, timestamptz, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_owner_product_template(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_markup_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_owner_markup_settings(numeric, numeric, numeric, numeric, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_owner_order(text, numeric, numeric, numeric, text, text, text, text, numeric, numeric, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_owner_order(uuid, text, numeric, numeric, numeric, text, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_owner_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_arrangement_recipes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_owner_arrangement_recipe(text, text, numeric, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_owner_arrangement_recipe(uuid, text, text, numeric, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_owner_arrangement_recipe(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_pos_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_owner_pos_settings(text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_pending_invites() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_invite(uuid) FROM anon;
