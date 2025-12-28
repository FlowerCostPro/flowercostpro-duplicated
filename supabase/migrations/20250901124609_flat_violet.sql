/*
  # Create beta feedback table

  1. New Tables
    - `beta_feedback`
      - `id` (uuid, primary key)
      - `email` (text, required)
      - `feedback` (text, required)
      - `timestamp` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `beta_feedback` table
    - Add policy for public to insert feedback
    - Add policy for authenticated users to read feedback
*/

CREATE TABLE IF NOT EXISTS beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  feedback text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert beta feedback"
  ON beta_feedback
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read beta feedback"
  ON beta_feedback
  FOR SELECT
  TO authenticated
  USING (true);