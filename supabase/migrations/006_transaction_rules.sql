-- Transaction rules for automatic renaming and categorization
CREATE TABLE transaction_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Pattern matching
  match_field TEXT NOT NULL DEFAULT 'name', -- 'name', 'merchant_name', or 'any'
  match_pattern TEXT NOT NULL, -- The pattern to match (case-insensitive contains)
  -- Actions to apply
  display_name TEXT, -- Custom name to show instead
  set_category TEXT, -- Category to assign
  set_as_income BOOLEAN DEFAULT FALSE, -- Mark as recurring income
  set_ignore_type TEXT DEFAULT NULL, -- 'none', 'budget', or 'all'
  -- Metadata
  description TEXT, -- User's note about this rule
  priority INT DEFAULT 0, -- Higher priority rules apply first
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add display_name to transactions for custom names
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Index for efficient rule matching
CREATE INDEX idx_transaction_rules_user_id ON transaction_rules(user_id);
CREATE INDEX idx_transaction_rules_active ON transaction_rules(is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE transaction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rules"
  ON transaction_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rules"
  ON transaction_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rules"
  ON transaction_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rules"
  ON transaction_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Updated at trigger
CREATE TRIGGER update_transaction_rules_updated_at
  BEFORE UPDATE ON transaction_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
