# Disaster Recovery Test Plan

## Overview

This document outlines the procedures for testing Sterling's disaster recovery capabilities. Tests should be conducted quarterly to ensure recovery procedures remain effective and team members are trained on execution.

## RTO/RPO Targets

| Component | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|-----------|-------------------------------|-------------------------------|
| Web Application | 4 hours | 1 hour |
| Database (Supabase) | 2 hours | 15 minutes |
| Redis Cache (Upstash) | 1 hour | N/A (rebuildable) |
| Static Assets (Vercel) | 30 minutes | N/A (immutable) |

## Test Schedule

| Test Type | Frequency | Duration | Team Required |
|-----------|-----------|----------|---------------|
| Backup Verification | Monthly | 30 min | 1 engineer |
| Cache Failure Simulation | Quarterly | 1 hour | 1-2 engineers |
| Database Recovery Test | Quarterly | 2-4 hours | 2 engineers |
| Full DR Drill | Annually | 4-8 hours | Full team |

---

## Test 1: Backup Verification (Monthly)

### Objective
Verify that automated backups are running and can be accessed.

### Prerequisites
- Admin API key configured
- Access to Supabase Dashboard

### Procedure

1. **Check Backup Status via API**
   ```bash
   curl -H "Authorization: Bearer $ADMIN_API_KEY" \
        https://your-domain.com/api/admin/backup
   ```
   Expected: 200 OK with backup status

2. **Verify in Supabase Dashboard**
   - Navigate to Settings > Database > Backups
   - Confirm daily backups are listed
   - Note the most recent backup timestamp

3. **Validate Backup Contents**
   - Download a recent backup (if available on plan)
   - Verify file is not corrupted
   - Check file size is reasonable (compare to previous months)

### Success Criteria
- [ ] API endpoint returns healthy status
- [ ] Supabase shows backups within last 24 hours
- [ ] Row counts match expected ranges

### Documentation
Record results in: `docs/dr-tests/YYYY-MM-backup-verification.md`

---

## Test 2: Cache Failure Simulation (Quarterly)

### Objective
Verify the application gracefully handles Redis cache unavailability.

### Prerequisites
- Staging environment access
- Ability to modify environment variables

### Procedure

1. **Baseline Performance**
   ```bash
   # Record current response times
   curl -w "@curl-format.txt" https://staging.your-domain.com/api/accounts
   ```

2. **Simulate Cache Failure**
   - In staging, temporarily set invalid Redis credentials:
     ```
     UPSTASH_REDIS_REST_URL=https://invalid.upstash.io
     UPSTASH_REDIS_REST_TOKEN=invalid_token
     ```
   - Redeploy staging environment

3. **Verify Fallback Behavior**
   ```bash
   # Test API endpoints still work
   curl https://staging.your-domain.com/api/accounts
   curl https://staging.your-domain.com/api/spending
   curl https://staging.your-domain.com/api/budgets
   ```

4. **Verify Rate Limiting Fallback**
   ```bash
   # Send multiple requests to verify in-memory rate limiting
   for i in {1..10}; do
     curl -s -o /dev/null -w "%{http_code}\n" \
       https://staging.your-domain.com/api/accounts
   done
   ```

5. **Check Logs**
   - Verify warning logs for cache failures
   - Confirm no error pages shown to users

6. **Restore Cache**
   - Restore valid Redis credentials
   - Redeploy and verify cache is working

### Success Criteria
- [ ] All API endpoints return valid data without cache
- [ ] Response times increase but remain under 2 seconds
- [ ] Rate limiting continues to function (in-memory fallback)
- [ ] No 500 errors during cache unavailability
- [ ] Logs clearly indicate fallback behavior

### Documentation
Record results in: `docs/dr-tests/YYYY-QN-cache-failure.md`

---

## Test 3: Database Recovery Test (Quarterly)

### Objective
Verify ability to recover database from backup within RTO.

### Prerequisites
- Supabase project access (admin)
- Staging environment
- 2-4 hour maintenance window

### Procedure

1. **Pre-Test Checklist**
   - [ ] Notify stakeholders of test window
   - [ ] Document current database state (row counts)
   - [ ] Ensure recent backup exists

2. **Create Test Snapshot**
   ```bash
   # Via admin API
   curl -X POST \
        -H "Authorization: Bearer $ADMIN_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"dryRun": false}' \
        https://staging.your-domain.com/api/admin/backup
   ```

3. **Simulate Data Loss** (Staging Only!)
   - Create a test table with sample data
   - Delete the test table
   - Document what was "lost"

4. **Execute Recovery**
   - Go to Supabase Dashboard > Settings > Database > Backups
   - Select backup from before data loss
   - For PITR (if available): Select point-in-time
   - Initiate restore

5. **Verify Recovery**
   - Check test table is restored
   - Verify row counts match pre-loss state
   - Test application functionality

6. **Document Recovery Time**
   - Record total time from "disaster" to "recovered"
   - Compare against 2-hour RTO

### Success Criteria
- [ ] Recovery completed within 2-hour RTO
- [ ] All data restored to within 15-minute RPO
- [ ] Application fully functional after recovery
- [ ] No data corruption detected

### Documentation
Record results in: `docs/dr-tests/YYYY-QN-database-recovery.md`

---

## Test 4: Full DR Drill (Annually)

### Objective
Simulate complete infrastructure failure and recovery.

### Prerequisites
- Full team availability
- 4-8 hour maintenance window
- Executive approval

### Scenario
Simulate: "Primary deployment region is unavailable"

### Procedure

1. **Preparation (Week Before)**
   - [ ] Schedule maintenance window
   - [ ] Brief team on procedures
   - [ ] Verify backup access
   - [ ] Prepare alternate deployment credentials

2. **Drill Execution**

   **Hour 0: Incident Declaration**
   - Declare simulated incident
   - Start incident timer
   - Assign roles:
     - Incident Commander
     - Database Recovery Lead
     - Application Recovery Lead
     - Communications Lead

   **Hour 0-1: Assessment**
   - Document "failed" components
   - Verify backup availability
   - Initiate communication to stakeholders

   **Hour 1-2: Database Recovery**
   - Restore database from backup
   - Verify data integrity
   - Update connection strings if needed

   **Hour 2-3: Application Recovery**
   - Deploy application to recovery environment
   - Configure environment variables
   - Verify API endpoints

   **Hour 3-4: Verification**
   - Run full test suite
   - Verify user-facing functionality
   - Test critical user flows:
     - [ ] User can log in
     - [ ] Dashboard loads
     - [ ] Transactions display
     - [ ] AI chat works

   **Hour 4+: Documentation**
   - Record total recovery time
   - Document issues encountered
   - Gather team feedback

3. **Post-Drill Review**
   - Conduct retrospective within 1 week
   - Update procedures based on findings
   - Schedule follow-up training if needed

### Success Criteria
- [ ] Full recovery within 4-hour RTO
- [ ] Data loss within 1-hour RPO
- [ ] All critical functions operational
- [ ] Team executed procedures effectively

### Documentation
Record results in: `docs/dr-tests/YYYY-full-dr-drill.md`

---

## Recovery Runbooks

### Runbook A: Application Not Responding

1. Check Vercel deployment status
2. Check Supabase status page
3. Check Upstash status page
4. If Vercel issue:
   - Trigger redeploy from last known good commit
   - If persistent, deploy to backup region
5. If database issue:
   - Follow Database Recovery Test procedure
6. If cache issue:
   - Application should auto-fallback; monitor performance

### Runbook B: Database Corruption

1. Immediately stop writes (enable maintenance mode)
2. Assess extent of corruption
3. Identify last known good backup
4. Execute point-in-time recovery (if PITR available)
5. Or restore from daily backup
6. Verify data integrity
7. Re-enable application

### Runbook C: Security Breach

1. Rotate all API keys and secrets immediately
2. Enable maintenance mode
3. Review audit logs for breach scope
4. Invalidate all user sessions
5. Notify affected users (per privacy policy)
6. Engage security team for investigation

---

## Contacts

| Role | Primary | Backup |
|------|---------|--------|
| Incident Commander | [Name] | [Name] |
| Database Admin | [Name] | [Name] |
| DevOps | [Name] | [Name] |
| Security | [Name] | [Name] |

## External Resources

- Supabase Status: https://status.supabase.com
- Vercel Status: https://www.vercel-status.com
- Upstash Status: https://status.upstash.com
- Plaid Status: https://status.plaid.com
- Stripe Status: https://status.stripe.com

---

## Test Results Log

| Date | Test Type | Result | RTO Achieved | RPO Achieved | Notes |
|------|-----------|--------|--------------|--------------|-------|
| YYYY-MM-DD | Backup Verification | Pass/Fail | N/A | N/A | |
| YYYY-MM-DD | Cache Failure | Pass/Fail | Yes/No | N/A | |
| YYYY-MM-DD | Database Recovery | Pass/Fail | Yes/No | Yes/No | |
| YYYY-MM-DD | Full DR Drill | Pass/Fail | Yes/No | Yes/No | |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-13 | Sterling Team | Initial DR test plan |
