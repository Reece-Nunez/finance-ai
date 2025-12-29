-- Cash Flow Learning System
-- Enables the app to learn from prediction accuracy and improve over time

-- ============================================================================
-- SPENDING PATTERNS TABLE
-- Stores learned spending patterns by various dimensions
-- ============================================================================
CREATE TABLE IF NOT EXISTS spending_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Pattern dimensions
  pattern_type TEXT NOT NULL, -- 'day_of_week', 'week_of_month', 'month_of_year', 'category', 'pay_cycle', 'seasonal'
  dimension_key TEXT NOT NULL, -- e.g., 'monday', 'week_1', 'december', 'groceries', 'post_payday'
  category TEXT, -- Optional: specific category this pattern applies to

  -- Pattern values
  average_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  median_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  std_deviation DECIMAL(12,2) NOT NULL DEFAULT 0,
  min_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  max_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  occurrence_count INTEGER NOT NULL DEFAULT 0,

  -- Confidence and weights
  confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.5, -- 0 to 1
  weight DECIMAL(5,4) NOT NULL DEFAULT 1.0, -- Multiplier for predictions

  -- Learning metadata
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_points_used INTEGER NOT NULL DEFAULT 0,
  months_of_data INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, pattern_type, dimension_key, category)
);

-- ============================================================================
-- CASH FLOW PREDICTIONS TABLE
-- Stores prediction snapshots for accuracy tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS cash_flow_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Prediction details
  prediction_date DATE NOT NULL, -- The date this prediction is FOR
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When the prediction was made

  -- Predicted values
  predicted_balance DECIMAL(12,2) NOT NULL,
  predicted_income DECIMAL(12,2) NOT NULL DEFAULT 0,
  predicted_expenses DECIMAL(12,2) NOT NULL DEFAULT 0,
  predicted_recurring DECIMAL(12,2) NOT NULL DEFAULT 0,
  predicted_discretionary DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Prediction metadata
  confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.5,
  prediction_factors JSONB, -- What factors went into this prediction

  -- Actual values (filled in later)
  actual_balance DECIMAL(12,2),
  actual_income DECIMAL(12,2),
  actual_expenses DECIMAL(12,2),
  actual_recorded_at TIMESTAMPTZ,

  -- Variance analysis (calculated after actual is recorded)
  variance_amount DECIMAL(12,2),
  variance_percentage DECIMAL(8,4),
  variance_analyzed BOOLEAN DEFAULT FALSE,
  variance_reasons JSONB, -- AI-generated analysis of why prediction was off

  UNIQUE(user_id, prediction_date, created_at)
);

-- ============================================================================
-- PREDICTION ACCURACY TABLE
-- Aggregated accuracy metrics over time
-- ============================================================================
CREATE TABLE IF NOT EXISTS prediction_accuracy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Time period
  period_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Accuracy metrics
  mean_absolute_error DECIMAL(12,2), -- Average absolute difference
  mean_percentage_error DECIMAL(8,4), -- Average percentage difference
  root_mean_square_error DECIMAL(12,2), -- RMSE
  predictions_count INTEGER NOT NULL DEFAULT 0,

  -- Direction accuracy (did we predict increase/decrease correctly?)
  direction_accuracy DECIMAL(5,4), -- 0 to 1

  -- Category-specific accuracy
  category_accuracy JSONB, -- { "groceries": 0.85, "dining": 0.72, ... }

  -- Improvement tracking
  accuracy_trend DECIMAL(8,4), -- Positive = improving, negative = worsening

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, period_type, period_start)
);

-- ============================================================================
-- UNEXPECTED EXPENSES TABLE
-- Tracks expenses that weren't predicted to learn from them
-- ============================================================================
CREATE TABLE IF NOT EXISTS unexpected_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

  -- Expense details
  amount DECIMAL(12,2) NOT NULL,
  category TEXT,
  merchant_name TEXT,
  description TEXT,
  expense_date DATE NOT NULL,

  -- Classification
  expense_type TEXT, -- 'one_time', 'irregular_recurring', 'seasonal', 'emergency'
  frequency_estimate TEXT, -- 'yearly', 'quarterly', 'rare', 'unknown'

  -- AI analysis
  ai_analysis TEXT, -- AI explanation of this expense
  similar_past_expenses JSONB, -- References to similar past expenses
  should_predict_future BOOLEAN DEFAULT FALSE,
  predicted_next_occurrence DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INCOME PATTERNS TABLE
-- Specifically tracks income timing and variability
-- ============================================================================
CREATE TABLE IF NOT EXISTS income_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Income source identification
  source_name TEXT NOT NULL, -- Normalized employer/source name
  source_type TEXT, -- 'salary', 'freelance', 'investment', 'transfer', 'other'

  -- Timing patterns
  typical_day_of_month INTEGER[], -- e.g., [1, 15] for bi-weekly
  typical_day_of_week INTEGER, -- 0-6 for weekly pay
  frequency TEXT, -- 'weekly', 'bi-weekly', 'semi-monthly', 'monthly', 'irregular'

  -- Amount patterns
  average_amount DECIMAL(12,2) NOT NULL,
  min_amount DECIMAL(12,2),
  max_amount DECIMAL(12,2),
  variability DECIMAL(5,4), -- How much it varies (0 = consistent, 1 = highly variable)

  -- Confidence
  confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.5,
  occurrences_analyzed INTEGER NOT NULL DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_occurrence DATE,
  next_expected DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, source_name)
);

-- ============================================================================
-- LEARNING INSIGHTS TABLE
-- Stores AI-generated insights from the learning process
-- ============================================================================
CREATE TABLE IF NOT EXISTS learning_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Insight details
  insight_type TEXT NOT NULL, -- 'pattern_discovered', 'accuracy_improvement', 'anomaly_detected', 'recommendation'
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Related data
  related_category TEXT,
  related_pattern_id UUID REFERENCES spending_patterns(id) ON DELETE SET NULL,
  related_prediction_id UUID REFERENCES cash_flow_predictions(id) ON DELETE SET NULL,

  -- Impact
  impact_score DECIMAL(5,4), -- How significant is this insight (0 to 1)
  actionable BOOLEAN DEFAULT FALSE,
  action_taken BOOLEAN DEFAULT FALSE,

  -- Display
  shown_to_user BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_spending_patterns_user ON spending_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_spending_patterns_type ON spending_patterns(user_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_spending_patterns_category ON spending_patterns(user_id, category);

CREATE INDEX IF NOT EXISTS idx_cash_flow_predictions_user ON cash_flow_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_predictions_date ON cash_flow_predictions(user_id, prediction_date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_predictions_unanalyzed ON cash_flow_predictions(user_id, variance_analyzed)
  WHERE variance_analyzed = FALSE AND actual_balance IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_user ON prediction_accuracy(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_period ON prediction_accuracy(user_id, period_type, period_start);

CREATE INDEX IF NOT EXISTS idx_unexpected_expenses_user ON unexpected_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_unexpected_expenses_date ON unexpected_expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_unexpected_expenses_type ON unexpected_expenses(user_id, expense_type);

CREATE INDEX IF NOT EXISTS idx_income_patterns_user ON income_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_income_patterns_active ON income_patterns(user_id, is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_learning_insights_user ON learning_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_insights_unshown ON learning_insights(user_id, shown_to_user) WHERE shown_to_user = FALSE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE spending_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE unexpected_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_insights ENABLE ROW LEVEL SECURITY;

-- Policies for spending_patterns
CREATE POLICY "Users can view own spending patterns" ON spending_patterns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spending patterns" ON spending_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spending patterns" ON spending_patterns
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own spending patterns" ON spending_patterns
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for cash_flow_predictions
CREATE POLICY "Users can view own predictions" ON cash_flow_predictions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own predictions" ON cash_flow_predictions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own predictions" ON cash_flow_predictions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own predictions" ON cash_flow_predictions
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for prediction_accuracy
CREATE POLICY "Users can view own accuracy" ON prediction_accuracy
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accuracy" ON prediction_accuracy
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accuracy" ON prediction_accuracy
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accuracy" ON prediction_accuracy
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for unexpected_expenses
CREATE POLICY "Users can view own unexpected expenses" ON unexpected_expenses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own unexpected expenses" ON unexpected_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own unexpected expenses" ON unexpected_expenses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own unexpected expenses" ON unexpected_expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for income_patterns
CREATE POLICY "Users can view own income patterns" ON income_patterns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income patterns" ON income_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income patterns" ON income_patterns
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income patterns" ON income_patterns
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for learning_insights
CREATE POLICY "Users can view own insights" ON learning_insights
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own insights" ON learning_insights
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own insights" ON learning_insights
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own insights" ON learning_insights
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_spending_patterns_updated_at
  BEFORE UPDATE ON spending_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_income_patterns_updated_at
  BEFORE UPDATE ON income_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
