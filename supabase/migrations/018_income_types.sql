-- Income Type Classification System
-- Industry-standard income categorization for better financial tracking

-- Add income_type to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS income_type TEXT DEFAULT 'none';

-- Create enum-like check constraint for valid income types
ALTER TABLE transactions
ADD CONSTRAINT valid_income_type CHECK (
  income_type IN ('none', 'payroll', 'government', 'retirement', 'self_employment', 'investment', 'rental', 'refund', 'transfer', 'other')
);

-- Create income_sources table for tracking recurring income
CREATE TABLE IF NOT EXISTS income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info
  name TEXT NOT NULL,
  display_name TEXT,
  income_type TEXT NOT NULL DEFAULT 'payroll',

  -- Pattern matching
  merchant_pattern TEXT NOT NULL,
  keywords TEXT[], -- Additional keywords for matching

  -- Amount info
  amount DECIMAL(12,2) NOT NULL,
  average_amount DECIMAL(12,2),
  min_amount DECIMAL(12,2),
  max_amount DECIMAL(12,2),

  -- Frequency
  frequency TEXT NOT NULL DEFAULT 'monthly', -- weekly, bi-weekly, semi-monthly, monthly, quarterly, yearly
  pay_day INTEGER, -- Day of month (1-31) or day of week (1-7) for weekly

  -- Dates
  next_expected_date DATE,
  last_received_date DATE,
  first_seen_date DATE,

  -- Metadata
  employer_name TEXT, -- For payroll
  account_id TEXT, -- Which account receives this income
  category TEXT,
  notes TEXT,

  -- Tracking
  occurrences INTEGER DEFAULT 0,
  total_received DECIMAL(12,2) DEFAULT 0,
  confidence TEXT DEFAULT 'high', -- high, medium, low

  -- Flags
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false, -- User confirmed this is correct
  ai_detected BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_income_source_type CHECK (
    income_type IN ('payroll', 'government', 'retirement', 'self_employment', 'investment', 'rental', 'other')
  ),
  CONSTRAINT valid_income_frequency CHECK (
    frequency IN ('weekly', 'bi-weekly', 'semi-monthly', 'monthly', 'quarterly', 'yearly', 'irregular')
  ),
  UNIQUE(user_id, merchant_pattern)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_income_sources_user_id ON income_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_income_sources_income_type ON income_sources(income_type);
CREATE INDEX IF NOT EXISTS idx_income_sources_next_date ON income_sources(next_expected_date);
CREATE INDEX IF NOT EXISTS idx_transactions_income_type ON transactions(income_type) WHERE income_type != 'none';

-- Enable RLS
ALTER TABLE income_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own income sources" ON income_sources
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own income sources" ON income_sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own income sources" ON income_sources
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own income sources" ON income_sources
  FOR DELETE USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_income_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER income_sources_updated_at
  BEFORE UPDATE ON income_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_income_sources_updated_at();

-- Comment on table
COMMENT ON TABLE income_sources IS 'Tracks recurring income sources with industry-standard classification';
COMMENT ON COLUMN income_sources.income_type IS 'payroll=employment, government=SSA/benefits, retirement=pension/401k, self_employment=freelance, investment=dividends, rental=rent received, other=misc';
