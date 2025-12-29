-- Add is_income flag to transactions for recurring income detection
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_income BOOLEAN DEFAULT FALSE;

-- Add notes field for user annotations
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add ignore_type for different levels of ignoring transactions
-- Values: 'none' (default), 'budget' (ignore from budgets only), 'all' (ignore from everything)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ignore_type TEXT DEFAULT 'none';

-- Create index for income transactions (for payday detection)
CREATE INDEX IF NOT EXISTS idx_transactions_is_income ON transactions(is_income) WHERE is_income = TRUE;

-- Create index for ignored transactions
CREATE INDEX IF NOT EXISTS idx_transactions_ignore_type ON transactions(ignore_type) WHERE ignore_type != 'none';
