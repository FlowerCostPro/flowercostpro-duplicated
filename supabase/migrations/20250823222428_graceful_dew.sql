/*
  # Fix user signup trigger function

  This migration adds the missing trigger function and trigger that automatically
  creates a profile entry when a new user signs up through Supabase Auth.

  1. Functions
    - `handle_new_user()` - Creates profile entry for new auth users
  
  2. Triggers  
    - `on_auth_user_created` - Executes after INSERT on auth.users
  
  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Ensures profile creation works for all new signups
*/

-- Create the trigger function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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

-- Create the trigger that calls the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the profiles table allows the trigger to insert data
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add policy to allow the trigger function to insert profiles
DROP POLICY IF EXISTS "Allow trigger to insert profiles" ON public.profiles;
CREATE POLICY "Allow trigger to insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);