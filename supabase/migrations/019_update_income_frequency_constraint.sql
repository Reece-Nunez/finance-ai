-- Update frequency constraint to include 'irregular' option
-- This handles the case where income_sources was created without it

-- Drop and recreate the constraint with the new value
DO $$
BEGIN
  -- Check if the table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'income_sources') THEN
    -- Drop the old constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'valid_income_frequency'
               AND table_name = 'income_sources') THEN
      ALTER TABLE income_sources DROP CONSTRAINT valid_income_frequency;
    END IF;

    -- Add the updated constraint with 'irregular'
    ALTER TABLE income_sources ADD CONSTRAINT valid_income_frequency CHECK (
      frequency IN ('weekly', 'bi-weekly', 'semi-monthly', 'monthly', 'quarterly', 'yearly', 'irregular')
    );
  END IF;
END $$;
