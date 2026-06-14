
/*
# Fix Function Search Path Mutable advisories

Both SECURITY DEFINER functions in the public schema had `SET search_path = public`
which Supabase flags as mutable (an attacker with CREATE privilege on public could
shadow system functions). The fix is to set `search_path = ''` (empty) so the
database never auto-resolves unqualified names.

Both function bodies already use fully-qualified references (public.profiles) or
reference only built-in SQL (NEW.updated_at = now()), so no body changes are needed.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
