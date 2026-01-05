-- Store AI-detected recurring patterns (cached results)
CREATE TABLE IF NOT EXISTS recurring_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Pattern identification
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  merchant_pattern TEXT, -- Normalized merchant name for matching

  -- Recurring details
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly')),
  amount DECIMAL(12, 2) NOT NULL,
  average_amount DECIMAL(12, 2) NOT NULL,
  is_income BOOLEAN DEFAULT FALSE,

  -- Scheduling
  typical_day INTEGER, -- Day of month (1-31) or day of week (1-7) for weekly
  next_expected_date DATE,
  last_seen_date DATE,

  -- Metadata
  category TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  occurrences INTEGER DEFAULT 0,
  bill_type TEXT, -- subscription, utility, loan, insurance, rent, income, other

  -- AI tracking
  ai_detected BOOLEAN DEFAULT TRUE,
  last_ai_analysis TIMESTAMPTZ,

  -- Linked transactions
  transaction_ids UUID[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, merchant_pattern)
);

-- Store user dismissals of recurring patterns
CREATE TABLE IF NOT EXISTS recurring_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What was dismissed
  merchant_pattern TEXT NOT NULL, -- Normalized name to prevent re-detection
  original_name TEXT, -- Original name for reference

  -- When/why dismissed
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT, -- Optional: 'not_recurring', 'shopping', 'one_time', 'other'

  UNIQUE(user_id, merchant_pattern)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_user ON recurring_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_next_date ON recurring_patterns(user_id, next_expected_date);
CREATE INDEX IF NOT EXISTS idx_recurring_dismissals_user ON recurring_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_dismissals_pattern ON recurring_dismissals(user_id, merchant_pattern);

-- RLS Policies
ALTER TABLE recurring_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring patterns"
  ON recurring_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring patterns"
  ON recurring_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring patterns"
  ON recurring_patterns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring patterns"
  ON recurring_patterns FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own dismissals"
  ON recurring_dismissals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dismissals"
  ON recurring_dismissals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dismissals"
  ON recurring_dismissals FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_recurring_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_patterns_updated_at
  BEFORE UPDATE ON recurring_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_patterns_updated_at();
