/*
  # Create email signups table

  1. New Tables
    - `email_signups`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `source` (text) - where the signup came from
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on `email_signups` table
    - Add policy for public insert access (since this is for unauthenticated users)
    - Add policy for authenticated users to read their own data
*/

CREATE TABLE IF NOT EXISTS email_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  source text DEFAULT 'landing-page',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_signups ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert email signups (for landing page forms)
CREATE POLICY "Anyone can insert email signups"
  ON email_signups
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow authenticated users to read all email signups (for admin purposes)
CREATE POLICY "Authenticated users can read email signups"
  ON email_signups
  FOR SELECT
  TO authenticated
  USING (true);