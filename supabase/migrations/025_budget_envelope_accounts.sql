-- Add budget envelope flag to accounts
-- Budget envelope accounts are used for "envelope budgeting" where money is
-- transferred from a main account to separate budget accounts.
-- Transactions from these accounts should be ignored in reports to prevent
-- double-counting transfers as spending/income.

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS is_budget_envelope BOOLEAN DEFAULT FALSE;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_accounts_budget_envelope ON accounts(user_id, is_budget_envelope);

-- Comment for documentation
COMMENT ON COLUMN accounts.is_budget_envelope IS 'When true, all transactions from this account are auto-ignored in spending/income reports to prevent double-counting internal transfers';
