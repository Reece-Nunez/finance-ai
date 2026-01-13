-- Performance Indexes Migration
-- Optimizes common query patterns for analytics and reporting
-- Note: Using regular CREATE INDEX (not CONCURRENTLY) for Supabase migrations

-- ============================================================================
-- TRANSACTION INDEXES
-- Composite indexes for common filter combinations
-- ============================================================================

-- Index for spending/budget queries: user + date range + category filtering
-- Covers: /api/spending, /api/budgets/analytics
CREATE INDEX IF NOT EXISTS idx_transactions_spending_queries
ON transactions(user_id, date DESC, category)
WHERE (ignore_type IS NULL OR ignore_type = 'none')
  AND (ignored IS NULL OR ignored = false);

-- Index for income vs expense aggregation
-- Covers: monthly summary queries in /api/spending
CREATE INDEX IF NOT EXISTS idx_transactions_aggregation
ON transactions(user_id, date, amount, is_income)
WHERE (ignore_type IS NULL OR ignore_type = 'none')
  AND (ignored IS NULL OR ignored = false);

-- Index for category-based budget calculations
-- Covers: category spending in /api/budgets/analytics
CREATE INDEX IF NOT EXISTS idx_transactions_category_spending
ON transactions(user_id, category, date DESC, amount)
WHERE amount > 0
  AND (is_income IS NULL OR is_income = false)
  AND (ignore_type IS NULL OR ignore_type = 'none');

-- ============================================================================
-- SPENDING PATTERNS INDEXES
-- Optimize cash flow learning and forecasting queries
-- ============================================================================

-- Index for pattern lookup by type and confidence
-- Covers: /api/cash-flow/forecast pattern fetching
CREATE INDEX IF NOT EXISTS idx_spending_patterns_forecast
ON spending_patterns(user_id, pattern_type, confidence_score DESC)
WHERE confidence_score > 0.3;

-- Index for category-specific patterns
CREATE INDEX IF NOT EXISTS idx_spending_patterns_category_lookup
ON spending_patterns(user_id, category, pattern_type)
WHERE category IS NOT NULL;

-- ============================================================================
-- CASH FLOW PREDICTIONS INDEXES
-- Optimize prediction queries and variance analysis
-- ============================================================================

-- Index for unanalyzed predictions (for learning system)
CREATE INDEX IF NOT EXISTS idx_predictions_pending_analysis
ON cash_flow_predictions(user_id, prediction_date DESC)
WHERE variance_analyzed = false
  AND actual_balance IS NOT NULL;

-- Index for recent predictions lookup
CREATE INDEX IF NOT EXISTS idx_predictions_recent
ON cash_flow_predictions(user_id, created_at DESC)
INCLUDE (predicted_balance, confidence_score);

-- ============================================================================
-- INCOME PATTERNS INDEXES
-- Optimize income forecasting queries
-- ============================================================================

-- Index for active income patterns by next expected date
CREATE INDEX IF NOT EXISTS idx_income_patterns_upcoming
ON income_patterns(user_id, next_expected)
WHERE is_active = true
  AND next_expected IS NOT NULL;

-- ============================================================================
-- RECURRING PATTERNS INDEXES
-- From migration 016
-- ============================================================================

-- Index for upcoming recurring transactions
CREATE INDEX IF NOT EXISTS idx_recurring_upcoming
ON recurring_patterns(user_id, next_expected_date)
WHERE next_expected_date IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTIONS FOR AGGREGATION
-- These functions move aggregation from JS to database
-- ============================================================================

-- Function to get monthly spending summary (replaces N+1 in /api/spending)
CREATE OR REPLACE FUNCTION get_monthly_spending_summary(
  p_user_id UUID,
  p_months INTEGER DEFAULT 6
)
RETURNS TABLE (
  month_start DATE,
  month_name TEXT,
  year INTEGER,
  total_income DECIMAL(12,2),
  total_expenses DECIMAL(12,2),
  total_bills DECIMAL(12,2),
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('month', t.date)::DATE as month_start,
    TO_CHAR(DATE_TRUNC('month', t.date), 'Mon') as month_name,
    EXTRACT(YEAR FROM t.date)::INTEGER as year,
    COALESCE(SUM(CASE WHEN t.amount < 0 OR t.is_income = true THEN ABS(t.amount) ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN t.amount > 0 AND (t.is_income IS NULL OR t.is_income = false) THEN t.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN t.amount > 0 AND t.category ILIKE '%bill%' THEN t.amount ELSE 0 END), 0) as total_bills,
    COUNT(*)::BIGINT as transaction_count
  FROM transactions t
  WHERE t.user_id = p_user_id
    AND t.date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
    AND (t.ignore_type IS NULL OR t.ignore_type = 'none')
    AND (t.ignored IS NULL OR t.ignored = false)
  GROUP BY DATE_TRUNC('month', t.date)
  ORDER BY DATE_TRUNC('month', t.date) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get category spending for a period (replaces N+1 in /api/budgets/analytics)
CREATE OR REPLACE FUNCTION get_category_spending(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  category TEXT,
  total_spent DECIMAL(12,2),
  transaction_count BIGINT,
  avg_transaction DECIMAL(12,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(t.category, 'Uncategorized') as category,
    COALESCE(SUM(CASE WHEN t.amount > 0 AND (t.is_income IS NULL OR t.is_income = false) THEN t.amount ELSE 0 END), 0) as total_spent,
    COUNT(*)::BIGINT as transaction_count,
    COALESCE(AVG(CASE WHEN t.amount > 0 THEN t.amount ELSE NULL END), 0) as avg_transaction
  FROM transactions t
  WHERE t.user_id = p_user_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND (t.ignore_type IS NULL OR t.ignore_type = 'none')
    AND (t.ignored IS NULL OR t.ignored = false)
  GROUP BY COALESCE(t.category, 'Uncategorized')
  ORDER BY total_spent DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to compare spending between two periods
CREATE OR REPLACE FUNCTION get_spending_comparison(
  p_user_id UUID,
  p_current_start DATE,
  p_current_end DATE,
  p_previous_start DATE,
  p_previous_end DATE
)
RETURNS TABLE (
  category TEXT,
  current_spent DECIMAL(12,2),
  previous_spent DECIMAL(12,2),
  change_amount DECIMAL(12,2),
  change_percent DECIMAL(8,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT
      COALESCE(t.category, 'Uncategorized') as cat,
      SUM(CASE WHEN t.amount > 0 AND (t.is_income IS NULL OR t.is_income = false) THEN t.amount ELSE 0 END) as spent
    FROM transactions t
    WHERE t.user_id = p_user_id
      AND t.date BETWEEN p_current_start AND p_current_end
      AND (t.ignore_type IS NULL OR t.ignore_type = 'none')
      AND (t.ignored IS NULL OR t.ignored = false)
    GROUP BY COALESCE(t.category, 'Uncategorized')
  ),
  previous_period AS (
    SELECT
      COALESCE(t.category, 'Uncategorized') as cat,
      SUM(CASE WHEN t.amount > 0 AND (t.is_income IS NULL OR t.is_income = false) THEN t.amount ELSE 0 END) as spent
    FROM transactions t
    WHERE t.user_id = p_user_id
      AND t.date BETWEEN p_previous_start AND p_previous_end
      AND (t.ignore_type IS NULL OR t.ignore_type = 'none')
      AND (t.ignored IS NULL OR t.ignored = false)
    GROUP BY COALESCE(t.category, 'Uncategorized')
  )
  SELECT
    COALESCE(c.cat, p.cat) as category,
    COALESCE(c.spent, 0) as current_spent,
    COALESCE(p.spent, 0) as previous_spent,
    COALESCE(c.spent, 0) - COALESCE(p.spent, 0) as change_amount,
    CASE
      WHEN COALESCE(p.spent, 0) = 0 THEN NULL
      ELSE ROUND(((COALESCE(c.spent, 0) - p.spent) / p.spent * 100)::NUMERIC, 2)
    END as change_percent
  FROM current_period c
  FULL OUTER JOIN previous_period p ON c.cat = p.cat
  ORDER BY current_spent DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_monthly_spending_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_spending TO authenticated;
GRANT EXECUTE ON FUNCTION get_spending_comparison TO authenticated;
