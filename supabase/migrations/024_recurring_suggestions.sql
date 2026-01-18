-- Recurring suggestions for user review before adding to patterns
-- This implements a confirmation workflow where AI detects recurring transactions
-- but they must be confirmed by the user before being added to patterns

CREATE TABLE IF NOT EXISTS recurring_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Pattern identification (same as recurring_patterns)
  name TEXT NOT NULL,
  display_name TEXT,
  merchant_pattern TEXT NOT NULL,

  -- Recurring details
  frequency TEXT CHECK (frequency IN ('weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly')),
  amount DECIMAL(12, 2),
  average_amount DECIMAL(12, 2),
  is_income BOOLEAN DEFAULT FALSE,

  -- Scheduling
  typical_day INTEGER,
  next_expected_date DATE,
  last_seen_date DATE,

  -- Metadata
  category TEXT,
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  occurrences INTEGER DEFAULT 0,
  bill_type TEXT,

  -- Detection info
  detection_reason TEXT, -- Why AI thinks this is recurring
  transaction_ids UUID[] DEFAULT '{}',

  -- Review status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'denied')),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, merchant_pattern)
);

-- Add denial feedback columns to recurring_dismissals (if not exists)
DO $$
BEGIN
  -- Add denial_reason column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_dismissals' AND column_name = 'denial_reason'
  ) THEN
    ALTER TABLE recurring_dismissals ADD COLUMN denial_reason TEXT;
  END IF;

  -- Add merchant_keywords column for AI learning
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_dismissals' AND column_name = 'merchant_keywords'
  ) THEN
    ALTER TABLE recurring_dismissals ADD COLUMN merchant_keywords TEXT[];
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_suggestions_user ON recurring_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_suggestions_status ON recurring_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_recurring_suggestions_pattern ON recurring_suggestions(user_id, merchant_pattern);

-- RLS Policies
ALTER TABLE recurring_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suggestions"
  ON recurring_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suggestions"
  ON recurring_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON recurring_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suggestions"
  ON recurring_suggestions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_recurring_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_suggestions_updated_at
  BEFORE UPDATE ON recurring_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_suggestions_updated_at();
