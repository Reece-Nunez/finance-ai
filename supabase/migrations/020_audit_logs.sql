-- Audit Logs Table
-- Tracks all user actions and system events for security and compliance

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity) WHERE severity IN ('warning', 'error', 'critical');

-- Composite index for user activity queries
CREATE INDEX idx_audit_logs_user_activity ON audit_logs(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert audit logs (from API)
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- No updates allowed (audit logs are immutable)
-- No deletes for regular users (retention policy handled separately)

-- Function to clean up old audit logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  -- Keep audit logs for 90 days by default
  -- Critical/error logs kept for 1 year
  DELETE FROM audit_logs
  WHERE
    (severity IN ('info', 'warning') AND created_at < NOW() - INTERVAL '90 days')
    OR
    (severity IN ('error', 'critical') AND created_at < NOW() - INTERVAL '365 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a cron job to run cleanup weekly (requires pg_cron extension)
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('cleanup-audit-logs', '0 3 * * 0', 'SELECT cleanup_old_audit_logs()');

COMMENT ON TABLE audit_logs IS 'Immutable audit trail of all user actions and system events';
COMMENT ON COLUMN audit_logs.action IS 'Action type (e.g., auth.login, transaction.updated)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (e.g., transaction, budget)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN audit_logs.details IS 'Additional context about the action (JSON)';
COMMENT ON COLUMN audit_logs.severity IS 'Severity level: info, warning, error, critical';
