
-- RPC that inserts feedback AND atomically extends the trial to 30 days from
-- signup. Runs as SECURITY DEFINER so it bypasses RLS on both tables and
-- always succeeds for any authenticated user regardless of policy edge-cases.
CREATE OR REPLACE FUNCTION public.submit_feedback_and_extend_trial(
  p_email    text,
  p_feedback text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          uuid;
  v_created_at       timestamptz;
  v_current_trial    timestamptz;
  v_thirty_day_end   timestamptz;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Insert feedback record
  INSERT INTO beta_feedback (email, feedback, timestamp)
  VALUES (lower(trim(p_email)), trim(p_feedback), now())
  ON CONFLICT DO NOTHING;

  -- Read profile dates
  SELECT created_at, trial_ends_at
  INTO v_created_at, v_current_trial
  FROM profiles
  WHERE id = v_user_id;

  IF v_created_at IS NULL THEN
    RETURN NULL;
  END IF;

  v_thirty_day_end := v_created_at + INTERVAL '30 days';

  -- Only extend if 30-day date is further out than current trial end
  IF v_thirty_day_end > COALESCE(v_current_trial, now()) THEN
    UPDATE profiles
    SET
      trial_ends_at       = v_thirty_day_end,
      subscription_status = 'trialing',
      updated_at          = now()
    WHERE id = v_user_id;

    RETURN v_thirty_day_end::text;
  END IF;

  RETURN v_current_trial::text;
END;
$$;

-- Only authenticated users can call this function
REVOKE ALL ON FUNCTION public.submit_feedback_and_extend_trial(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_feedback_and_extend_trial(text, text) TO authenticated;
