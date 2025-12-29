-- AI Categorization Reports table
-- Stores results of each AI categorization run for user review
CREATE TABLE ai_categorization_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Summary stats
  transactions_found INTEGER NOT NULL DEFAULT 0,
  transactions_categorized INTEGER NOT NULL DEFAULT 0,
  transactions_skipped INTEGER NOT NULL DEFAULT 0,

  -- Detailed results stored as JSONB
  -- categorized_items: array of {transaction_id, original_name, new_category, new_name, confidence}
  -- skipped_items: array of {transaction_id, original_name, amount, date, current_category, suggested_category, suggested_name, confidence, reason}
  categorized_items JSONB DEFAULT '[]'::jsonb,
  skipped_items JSONB DEFAULT '[]'::jsonb,

  -- Tracking
  trigger_type TEXT NOT NULL DEFAULT 'auto', -- 'auto' (sync) or 'manual' (button click)
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_reports_user_id ON ai_categorization_reports(user_id);
CREATE INDEX idx_ai_reports_reviewed ON ai_categorization_reports(user_id, reviewed);
CREATE INDEX idx_ai_reports_created_at ON ai_categorization_reports(created_at DESC);

-- Enable RLS
ALTER TABLE ai_categorization_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own AI reports"
  ON ai_categorization_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI reports"
  ON ai_categorization_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI reports"
  ON ai_categorization_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI reports"
  ON ai_categorization_reports FOR DELETE
  USING (auth.uid() = user_id);
