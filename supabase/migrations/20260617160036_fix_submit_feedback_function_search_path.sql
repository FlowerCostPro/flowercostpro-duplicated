
-- Fix submit_feedback_and_extend_trial to use empty search_path (non-mutable)
-- and fully-qualified table names, matching the pattern established for all
-- other SECURITY DEFINER functions in this project.
CREATE OR REPLACE FUNCTION public.submit_feedback_and_extend_trial(
  p_email    text,
  p_feedback text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  INSERT INTO public.beta_feedback (email, feedback, timestamp)
  VALUES (lower(trim(p_email)), trim(p_feedback), now())
  ON CONFLICT DO NOTHING;

  -- Read profile dates
  SELECT created_at, trial_ends_at
  INTO v_created_at, v_current_trial
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_created_at IS NULL THEN
    RETURN NULL;
  END IF;

  v_thirty_day_end := v_created_at + INTERVAL '30 days';

  -- Only extend if 30-day date is further out than current trial end
  IF v_thirty_day_end > COALESCE(v_current_trial, now()) THEN
    UPDATE public.profiles
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

-- Lock down execute permissions to authenticated users only
REVOKE EXECUTE ON FUNCTION public.submit_feedback_and_extend_trial(text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.submit_feedback_and_extend_trial(text, text) TO authenticated;
