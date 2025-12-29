-- Custom categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT, -- Optional emoji or icon name
  color TEXT, -- Optional hex color
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint per user
CREATE UNIQUE INDEX idx_categories_user_name ON categories(user_id, name);

-- Index for faster lookups
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- Function to seed default categories for new users
CREATE OR REPLACE FUNCTION seed_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categories (user_id, name, is_default) VALUES
    (NEW.id, 'Food & Dining', TRUE),
    (NEW.id, 'Groceries', TRUE),
    (NEW.id, 'Transportation', TRUE),
    (NEW.id, 'Gas & Fuel', TRUE),
    (NEW.id, 'Shopping', TRUE),
    (NEW.id, 'Entertainment', TRUE),
    (NEW.id, 'Bills & Utilities', TRUE),
    (NEW.id, 'Health & Medical', TRUE),
    (NEW.id, 'Travel', TRUE),
    (NEW.id, 'Education', TRUE),
    (NEW.id, 'Personal Care', TRUE),
    (NEW.id, 'Home & Garden', TRUE),
    (NEW.id, 'Gifts & Donations', TRUE),
    (NEW.id, 'Subscriptions', TRUE),
    (NEW.id, 'Income', TRUE),
    (NEW.id, 'Transfer', TRUE),
    (NEW.id, 'Other', TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To add trigger on auth.users, you'd need to do this in Supabase dashboard
-- or use a different approach. For now, we'll seed categories on first API call.
