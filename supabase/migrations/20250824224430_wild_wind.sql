/*
  # Update Owner Profile to Karen Edwards

  1. Updates the existing profile to use Karen Edwards' information
  2. Sets the correct email and full name
  3. Ensures owner role is maintained
  4. Updates the updated_at timestamp

  This migration will change the current owner account to use Karen Edwards' details.
*/

-- Update the existing profile to Karen Edwards' information
UPDATE profiles 
SET 
  email = 'pcflorist@columbus.rr.com',
  full_name = 'Karen Edwards',
  role = 'owner',
  updated_at = now()
WHERE role = 'owner';

-- Also update the auth.users table email if needed
-- Note: This might require additional steps in Supabase dashboard
UPDATE auth.users 
SET 
  email = 'pcflorist@columbus.rr.com',
  updated_at = now()
WHERE id IN (
  SELECT id FROM profiles WHERE role = 'owner'
);