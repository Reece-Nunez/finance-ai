-- Smart Anomaly Detection System
-- Detects unusual transactions, price increases, duplicates, and potential fraud

-- ============================================================================
-- DETECTED ANOMALIES TABLE
-- Stores all detected anomalies for user review
-- ============================================================================
CREATE TABLE IF NOT EXISTS detected_anomalies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

  -- Anomaly classification
  anomaly_type TEXT NOT NULL, -- 'unusual_amount', 'duplicate_charge', 'price_increase', 'new_merchant_large', 'frequency_spike', 'category_unusual'
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'

  -- Anomaly details
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Context data
  merchant_name TEXT,
  amount DECIMAL(12,2),
  expected_amount DECIMAL(12,2), -- For price increases
  historical_average DECIMAL(12,2), -- For unusual amounts
  deviation_percent DECIMAL(8,2), -- How far from normal (%)

  -- Related transactions (for duplicates, patterns)
  related_transaction_ids UUID[],

  -- User feedback
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'dismissed', 'confirmed', 'resolved'
  user_feedback TEXT, -- 'expected', 'suspicious', 'fraud'
  feedback_note TEXT,
  reviewed_at TIMESTAMPTZ,

  -- Learning flags
  should_learn BOOLEAN DEFAULT TRUE, -- Use this feedback for future detection
  false_positive BOOLEAN DEFAULT FALSE,

  -- Metadata
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate anomaly detection for same transaction/type
  UNIQUE(user_id, transaction_id, anomaly_type)
);

-- ============================================================================
-- MERCHANT BASELINES TABLE
-- Stores typical spending patterns per merchant for comparison
-- ============================================================================
CREATE TABLE IF NOT EXISTS merchant_baselines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Merchant identification
  merchant_name TEXT NOT NULL,
  merchant_name_normalized TEXT NOT NULL, -- Lowercase, trimmed for matching

  -- Amount statistics
  average_amount DECIMAL(12,2) NOT NULL,
  median_amount DECIMAL(12,2) NOT NULL,
  min_amount DECIMAL(12,2) NOT NULL,
  max_amount DECIMAL(12,2) NOT NULL,
  std_deviation DECIMAL(12,2) NOT NULL,

  -- Frequency statistics
  typical_frequency TEXT, -- 'daily', 'weekly', 'monthly', 'irregular'
  average_days_between DECIMAL(8,2),
  transaction_count INTEGER NOT NULL DEFAULT 0,

  -- Category
  typical_category TEXT,

  -- Subscription detection
  is_likely_subscription BOOLEAN DEFAULT FALSE,
  subscription_amount DECIMAL(12,2),
  subscription_day_of_month INTEGER,

  -- Time range analyzed
  first_transaction_date DATE,
  last_transaction_date DATE,

  -- Metadata
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, merchant_name_normalized)
);

-- ============================================================================
-- USER ANOMALY PREFERENCES TABLE
-- Stores user preferences for anomaly detection sensitivity
-- ============================================================================
CREATE TABLE IF NOT EXISTS anomaly_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Detection sensitivity (1-10, higher = more sensitive/more alerts)
  sensitivity_level INTEGER NOT NULL DEFAULT 5,

  -- Feature toggles
  detect_unusual_amounts BOOLEAN DEFAULT TRUE,
  detect_duplicate_charges BOOLEAN DEFAULT TRUE,
  detect_price_increases BOOLEAN DEFAULT TRUE,
  detect_new_merchants BOOLEAN DEFAULT TRUE,
  detect_frequency_spikes BOOLEAN DEFAULT TRUE,

  -- Thresholds
  unusual_amount_threshold DECIMAL(5,2) DEFAULT 2.0, -- Standard deviations
  duplicate_window_hours INTEGER DEFAULT 48, -- Hours to check for duplicates
  price_increase_threshold DECIMAL(5,2) DEFAULT 0.10, -- 10% increase
  new_merchant_amount_threshold DECIMAL(12,2) DEFAULT 100, -- Flag new merchants over this

  -- Notification preferences
  notify_critical BOOLEAN DEFAULT TRUE,
  notify_high BOOLEAN DEFAULT TRUE,
  notify_medium BOOLEAN DEFAULT FALSE,
  notify_low BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_detected_anomalies_user ON detected_anomalies(user_id);
CREATE INDEX IF NOT EXISTS idx_detected_anomalies_status ON detected_anomalies(user_id, status);
CREATE INDEX IF NOT EXISTS idx_detected_anomalies_type ON detected_anomalies(user_id, anomaly_type);
CREATE INDEX IF NOT EXISTS idx_detected_anomalies_pending ON detected_anomalies(user_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_detected_anomalies_transaction ON detected_anomalies(transaction_id);

CREATE INDEX IF NOT EXISTS idx_merchant_baselines_user ON merchant_baselines(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_baselines_merchant ON merchant_baselines(user_id, merchant_name_normalized);
CREATE INDEX IF NOT EXISTS idx_merchant_baselines_subscription ON merchant_baselines(user_id, is_likely_subscription)
  WHERE is_likely_subscription = TRUE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE detected_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for detected_anomalies
CREATE POLICY "Users can view own anomalies" ON detected_anomalies
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own anomalies" ON detected_anomalies
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own anomalies" ON detected_anomalies
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own anomalies" ON detected_anomalies
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for merchant_baselines
CREATE POLICY "Users can view own baselines" ON merchant_baselines
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own baselines" ON merchant_baselines
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own baselines" ON merchant_baselines
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own baselines" ON merchant_baselines
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for anomaly_preferences
CREATE POLICY "Users can view own preferences" ON anomaly_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON anomaly_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON anomaly_preferences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own preferences" ON anomaly_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_merchant_baselines_updated_at
  BEFORE UPDATE ON merchant_baselines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_anomaly_preferences_updated_at
  BEFORE UPDATE ON anomaly_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
