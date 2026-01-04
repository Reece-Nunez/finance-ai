-- Add is_exceptional column to transactions
-- Exceptional transactions are one-time/unusual transactions that should be excluded
-- from spending baselines and pattern analysis (e.g., insurance payouts, contractor payments)

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_exceptional BOOLEAN DEFAULT FALSE;

-- Index for filtering out exceptional transactions in baseline calculations
CREATE INDEX IF NOT EXISTS idx_transactions_exceptional ON transactions(user_id, is_exceptional)
  WHERE is_exceptional = TRUE;

-- Add comment
COMMENT ON COLUMN transactions.is_exceptional IS 'Marks one-time/unusual transactions to exclude from spending pattern analysis';
