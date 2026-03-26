-- Budget groups table for organizing budgets into sections
CREATE TABLE budget_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Add group_id to budgets table
ALTER TABLE budgets ADD COLUMN group_id UUID REFERENCES budget_groups(id) ON DELETE SET NULL;

-- RLS policies for budget_groups
ALTER TABLE budget_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own budget groups"
  ON budget_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budget groups"
  ON budget_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget groups"
  ON budget_groups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budget groups"
  ON budget_groups FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_budget_groups_user_id ON budget_groups(user_id);
CREATE INDEX idx_budgets_group_id ON budgets(group_id);
