-- Add AI categorization columns to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS ai_confidence INTEGER,
ADD COLUMN IF NOT EXISTS ai_suggested_category TEXT,
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add index for needs_review to quickly find transactions that need review
CREATE INDEX IF NOT EXISTS idx_transactions_needs_review ON transactions(needs_review) WHERE needs_review = TRUE;

-- Add index for display_name to find transactions without cleaned up names
CREATE INDEX IF NOT EXISTS idx_transactions_display_name_null ON transactions(user_id) WHERE display_name IS NULL;
