-- Add ignored field to transactions for filtering out transfers and other non-spending transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ignored boolean DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ignored_at timestamptz;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_transactions_ignored ON transactions(user_id, ignored) WHERE ignored = true;

-- Comment for documentation
COMMENT ON COLUMN transactions.ignored IS 'When true, transaction is excluded from spending/budget calculations (e.g., internal transfers)';
