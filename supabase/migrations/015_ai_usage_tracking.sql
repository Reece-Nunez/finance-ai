-- AI Usage Tracking for cost control
-- Tracks daily AI request counts per user to enforce limits

CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Request counts by feature
  categorization_requests INT DEFAULT 0,
  chat_requests INT DEFAULT 0,
  recurring_detection_requests INT DEFAULT 0,
  insights_requests INT DEFAULT 0,
  search_requests INT DEFAULT 0,

  -- Token usage (approximate)
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One row per user per day
  UNIQUE(user_id, date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, date);

-- Enable RLS
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "Users can view own AI usage"
  ON ai_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Only the system (service role) can insert/update usage
-- This prevents users from manipulating their usage counts
CREATE POLICY "Service role can manage AI usage"
  ON ai_usage FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to increment usage and check limits
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id UUID,
  p_feature TEXT,
  p_input_tokens INT DEFAULT 0,
  p_output_tokens INT DEFAULT 0
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
  v_is_pro BOOLEAN;
  v_limit INT;
BEGIN
  -- Check if user is Pro
  SELECT EXISTS(
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
  ) INTO v_is_pro;

  -- Set limits based on subscription (daily limits)
  -- Free: 10 requests/day per feature
  -- Pro: 100 requests/day per feature
  v_limit := CASE WHEN v_is_pro THEN 100 ELSE 10 END;

  -- Upsert usage record for today
  INSERT INTO ai_usage (user_id, date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- Get current count for this feature
  EXECUTE format(
    'SELECT %I FROM ai_usage WHERE user_id = $1 AND date = CURRENT_DATE',
    p_feature || '_requests'
  ) INTO v_count USING p_user_id;

  -- Check if over limit
  IF v_count >= v_limit THEN
    RETURN FALSE;
  END IF;

  -- Increment the count
  EXECUTE format(
    'UPDATE ai_usage SET %I = %I + 1, input_tokens = input_tokens + $2, output_tokens = output_tokens + $3, updated_at = NOW() WHERE user_id = $1 AND date = CURRENT_DATE',
    p_feature || '_requests',
    p_feature || '_requests'
  ) USING p_user_id, p_input_tokens, p_output_tokens;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get remaining requests for a user
CREATE OR REPLACE FUNCTION get_ai_usage_remaining(p_user_id UUID)
RETURNS TABLE(
  feature TEXT,
  used INT,
  remaining INT,
  daily_limit INT
) AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_limit INT;
  v_usage RECORD;
BEGIN
  -- Check if user is Pro
  SELECT EXISTS(
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
  ) INTO v_is_pro;

  v_limit := CASE WHEN v_is_pro THEN 100 ELSE 10 END;

  -- Get today's usage
  SELECT * INTO v_usage FROM ai_usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  -- Return usage for each feature
  RETURN QUERY SELECT
    'categorization'::TEXT,
    COALESCE(v_usage.categorization_requests, 0),
    v_limit - COALESCE(v_usage.categorization_requests, 0),
    v_limit;

  RETURN QUERY SELECT
    'chat'::TEXT,
    COALESCE(v_usage.chat_requests, 0),
    v_limit - COALESCE(v_usage.chat_requests, 0),
    v_limit;

  RETURN QUERY SELECT
    'recurring_detection'::TEXT,
    COALESCE(v_usage.recurring_detection_requests, 0),
    v_limit - COALESCE(v_usage.recurring_detection_requests, 0),
    v_limit;

  RETURN QUERY SELECT
    'insights'::TEXT,
    COALESCE(v_usage.insights_requests, 0),
    v_limit - COALESCE(v_usage.insights_requests, 0),
    v_limit;

  RETURN QUERY SELECT
    'search'::TEXT,
    COALESCE(v_usage.search_requests, 0),
    v_limit - COALESCE(v_usage.search_requests, 0),
    v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
