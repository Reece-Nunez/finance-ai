-- Add sync preference columns to user_profiles
-- sync_frequency: 'manual' (no auto-sync), 'daily' (once per day), 'frequent' (every 6 hours - Pro only)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS sync_frequency TEXT DEFAULT 'daily'
  CHECK (sync_frequency IN ('manual', 'daily', 'frequent'));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_auto_sync TIMESTAMPTZ;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS next_sync_due TIMESTAMPTZ;

-- Index for cron job queries - only index rows that need syncing
CREATE INDEX IF NOT EXISTS idx_user_profiles_next_sync
ON user_profiles(next_sync_due)
WHERE sync_frequency != 'manual';

-- Set next_sync_due for existing users with auto-sync enabled
UPDATE user_profiles
SET next_sync_due = NOW()
WHERE sync_frequency != 'manual' AND next_sync_due IS NULL;

-- Comments for documentation
COMMENT ON COLUMN user_profiles.sync_frequency IS 'Auto-sync frequency: manual, daily (free), frequent (Pro only - every 6 hours)';
COMMENT ON COLUMN user_profiles.last_auto_sync IS 'Timestamp of last automatic sync';
COMMENT ON COLUMN user_profiles.next_sync_due IS 'When the next automatic sync should run';
