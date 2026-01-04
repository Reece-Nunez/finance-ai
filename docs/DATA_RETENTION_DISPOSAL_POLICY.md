# Sterling Data Retention and Disposal Policy

**Document Classification:** Internal Use Only
**Version:** 1.0
**Effective Date:** January 2026
**Last Reviewed:** January 2026
**Next Review Date:** January 2027
**Document Owner:** Information Security Team

---

## 1. Purpose

This Data Retention and Disposal Policy establishes the requirements for retaining, archiving, and securely disposing of data managed by Sterling. The policy ensures that:

- Data is retained only as long as necessary for business and legal purposes
- Consumer data rights are respected, including the right to deletion
- Data disposal is conducted securely to prevent unauthorized access
- Sterling complies with applicable data privacy laws and regulations

---

## 2. Scope

This policy applies to:

- All data collected, processed, or stored by Sterling
- All Sterling systems, applications, databases, and storage media
- All employees, contractors, and third parties handling Sterling data
- Data in all formats: electronic, physical, structured, and unstructured
- Production, backup, and archival data

---

## 3. Definitions

| Term | Definition |
|------|------------|
| **Retention Period** | The length of time data must be kept before disposal |
| **Active Data** | Data in regular use for business operations |
| **Archived Data** | Data no longer in active use but retained for compliance |
| **Data Disposal** | The secure destruction or deletion of data |
| **Data Subject** | The individual whose personal data is being processed |
| **PII** | Personally Identifiable Information |
| **Legal Hold** | Suspension of data disposal due to litigation or investigation |

---

## 4. Data Retention Principles

### 4.1 Minimum Retention

Data shall be retained for the minimum period necessary to:

- Fulfill the purpose for which it was collected
- Meet legal and regulatory requirements
- Support legitimate business needs
- Honor contractual obligations

### 4.2 Purpose Limitation

Data retained beyond its original purpose requires:

- Documented business justification
- Legal basis for continued retention
- Appropriate security controls
- Periodic review for continued necessity

### 4.3 Storage Limitation

In accordance with data privacy principles:

- Data is not kept longer than necessary
- Retention periods are documented and enforced
- Automated deletion implemented where feasible
- Regular audits verify compliance

---

## 5. Data Classification and Retention Schedule

### 5.1 Consumer Financial Data

| Data Type | Retention Period | Legal Basis | Disposal Method |
|-----------|------------------|-------------|-----------------|
| Transaction history | 7 years from transaction date | Tax/financial regulations; IRS requirements | Secure deletion |
| Account balances | Duration of account + 90 days | Service delivery | Secure deletion |
| Bank account identifiers (masked) | Duration of account + 90 days | Service delivery | Secure deletion |
| Plaid access tokens | Until connection revoked + 30 days | Service delivery | Secure deletion; token revocation |
| Financial insights/analytics | 3 years | Service improvement | Anonymization or deletion |

### 5.2 Consumer Account Data

| Data Type | Retention Period | Legal Basis | Disposal Method |
|-----------|------------------|-------------|-----------------|
| Account credentials (hashed) | Duration of account + 30 days | Service delivery | Secure deletion |
| Email address | Duration of account + 30 days | Service delivery; communications | Secure deletion |
| Profile information | Duration of account + 30 days | Service delivery | Secure deletion |
| Subscription/billing history | 7 years | Tax/financial regulations | Secure deletion |
| Payment method tokens | Duration of account + 30 days | Service delivery | Secure deletion; token revocation |

### 5.3 Authentication and Security Data

| Data Type | Retention Period | Legal Basis | Disposal Method |
|-----------|------------------|-------------|-----------------|
| Authentication logs | 2 years | Security; fraud prevention | Automatic purge |
| Session tokens | Until expiration + 24 hours | Service delivery | Automatic expiration |
| MFA enrollment data | Duration of account + 30 days | Service delivery | Secure deletion |
| Password reset tokens | 24 hours | Service delivery | Automatic expiration |
| Failed login attempts | 90 days | Security; fraud prevention | Automatic purge |

### 5.4 Application and System Data

| Data Type | Retention Period | Legal Basis | Disposal Method |
|-----------|------------------|-------------|-----------------|
| Application logs | 1 year | Operations; troubleshooting | Automatic purge |
| Error logs | 1 year | Operations; troubleshooting | Automatic purge |
| API request logs | 90 days | Operations; troubleshooting | Automatic purge |
| Performance metrics | 1 year | Operations; optimization | Automatic purge |
| Security event logs | 2 years | Security; compliance | Secure archival then deletion |

### 5.5 Business and Administrative Data

| Data Type | Retention Period | Legal Basis | Disposal Method |
|-----------|------------------|-------------|-----------------|
| Contracts and agreements | 10 years after expiration | Legal requirements | Secure archival then deletion |
| Financial records | 7 years | Tax regulations | Secure archival then deletion |
| Employee records | 7 years after termination | Employment law | Secure deletion |
| Vendor records | 7 years after relationship ends | Business records | Secure deletion |
| Audit logs | 7 years | Compliance | Secure archival |

### 5.6 Communications Data

| Data Type | Retention Period | Legal Basis | Disposal Method |
|-----------|------------------|-------------|-----------------|
| Customer support tickets | 3 years | Service quality; dispute resolution | Secure deletion |
| AI chat history | 90 days (or until user deletes) | Service delivery | User-initiated or automatic deletion |
| Email communications | 3 years | Business records | Secure deletion |
| System notifications | 90 days | Service delivery | Automatic purge |

### 5.7 Backup Data

| Data Type | Retention Period | Disposal Method |
|-----------|------------------|-----------------|
| Daily backups | 30 days | Automatic rotation/deletion |
| Weekly backups | 90 days | Automatic rotation/deletion |
| Monthly backups | 1 year | Secure deletion |
| Annual archival backups | Per source data retention | Secure deletion |

---

## 6. Data Disposal Requirements

### 6.1 Secure Disposal Standards

All data disposal must meet the following standards:

| Data Classification | Disposal Standard |
|--------------------|-------------------|
| **Confidential** | Cryptographic erasure or physical destruction |
| **Internal** | Secure deletion with verification |
| **Public** | Standard deletion |

### 6.2 Electronic Data Disposal Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **Cryptographic Erasure** | Destroy encryption keys rendering data unreadable | Encrypted storage, cloud data |
| **Secure Deletion** | Overwrite data with random patterns | Local storage, databases |
| **Database Purge** | DELETE with verification of removal | Structured database records |
| **Token Revocation** | Invalidate tokens with third-party providers | Plaid, Stripe tokens |

### 6.3 Physical Media Disposal

| Media Type | Disposal Method |
|------------|-----------------|
| Hard drives | Degaussing and physical destruction |
| SSDs | Cryptographic erasure and physical destruction |
| Backup tapes | Degaussing and physical destruction |
| Paper documents | Cross-cut shredding |
| Optical media | Physical destruction |

### 6.4 Cloud Data Disposal

For data stored in cloud services (Supabase, AWS):

1. **Delete from primary storage** - Remove records from database
2. **Verify deletion** - Confirm removal from application layer
3. **Request backup deletion** - For sensitive data, request backup purge
4. **Revoke access tokens** - Invalidate any associated API tokens
5. **Document disposal** - Log deletion for compliance records

---

## 7. Consumer Data Rights and Deletion

### 7.1 Right to Deletion

Consumers have the right to request deletion of their personal data. Upon verified request:

| Data Type | Deletion Timeline | Exceptions |
|-----------|-------------------|------------|
| Account and profile data | 30 days | None |
| Transaction history | 30 days | Legal retention requirements |
| Financial connections | Immediate | None |
| AI chat history | Immediate | None |
| Backup copies | 90 days | Technical limitations |

### 7.2 Deletion Request Process

1. **Request Receipt**
   - Consumer submits deletion request via app or email
   - Request logged with timestamp

2. **Identity Verification**
   - Verify requestor is the account owner
   - MFA or email verification required

3. **Scope Determination**
   - Identify all data associated with consumer
   - Determine legal retention exceptions

4. **Deletion Execution**
   - Delete data from primary systems
   - Queue deletion from backups
   - Revoke third-party tokens (Plaid, Stripe)

5. **Confirmation**
   - Notify consumer of completed deletion
   - Document process for compliance

### 7.3 Retention Exceptions

Data may be retained despite deletion request when required for:

| Exception | Retention Period | Data Retained |
|-----------|------------------|---------------|
| Tax/financial regulations | 7 years | Transaction summaries |
| Legal proceedings | Duration of proceedings | Relevant records |
| Fraud investigation | Duration of investigation | Relevant records |
| Contractual obligation | Per contract terms | Specified data |

When exceptions apply:

- Consumer is notified of retention and reason
- Data is minimized to what is legally required
- Data is deleted when exception no longer applies
- Access is restricted to authorized personnel only

### 7.4 Third-Party Data Deletion

When consumer requests deletion, Sterling also:

| Third Party | Action |
|-------------|--------|
| Plaid | Revoke access token; request data deletion |
| Stripe | Delete customer record; retain transaction records per PCI |
| Supabase | Delete user record and associated data |
| Analytics | Delete or anonymize user data |

---

## 8. Data Anonymization

### 8.1 When Anonymization is Used

Anonymization may be used instead of deletion when:

- Data is needed for analytics or research
- Aggregated data provides business value
- Legal retention applies but individual identification is unnecessary

### 8.2 Anonymization Standards

Anonymized data must:

- Remove all direct identifiers (name, email, account IDs)
- Remove or generalize quasi-identifiers (location, dates)
- Prevent re-identification through aggregation
- Be verified by security team before retention

### 8.3 Anonymization Techniques

| Technique | Description | Use Case |
|-----------|-------------|----------|
| Data masking | Replace identifying values | Display purposes |
| Generalization | Reduce precision (e.g., zip to region) | Analytics |
| Aggregation | Combine individual records | Reporting |
| Pseudonymization | Replace identifiers with tokens | Research |

---

## 9. Implementation Requirements

### 9.1 Automated Retention Enforcement

| Requirement | Implementation |
|-------------|----------------|
| Automated deletion | Scheduled jobs delete expired data |
| Retention tagging | Data tagged with retention period at creation |
| Expiration tracking | System tracks data expiration dates |
| Deletion logging | All deletions logged for compliance |
| Verification | Regular audits verify automated deletion |

### 9.2 Database Implementation

```sql
-- Example: Automatic purge of expired sessions
DELETE FROM auth.sessions
WHERE created_at < NOW() - INTERVAL '30 days';

-- Example: Automatic purge of old logs
DELETE FROM application_logs
WHERE created_at < NOW() - INTERVAL '1 year';

-- Example: Account deletion cascade
-- Triggered when user requests account deletion
DELETE FROM transactions WHERE user_id = [user_id];
DELETE FROM accounts WHERE user_id = [user_id];
DELETE FROM budgets WHERE user_id = [user_id];
DELETE FROM user_profiles WHERE user_id = [user_id];
DELETE FROM auth.users WHERE id = [user_id];
```

### 9.3 Backup Retention Implementation

| Backup Type | Retention | Rotation Method |
|-------------|-----------|-----------------|
| Database snapshots | 30 days | FIFO rotation |
| Transaction logs | 7 days | Automatic purge |
| Full backups | 90 days | FIFO rotation |
| Disaster recovery | 1 year | Annual rotation |

---

## 10. Legal Hold Procedures

### 10.1 Legal Hold Definition

A legal hold suspends normal retention and disposal when data may be relevant to:

- Pending or anticipated litigation
- Regulatory investigation
- Government inquiry
- Internal investigation

### 10.2 Legal Hold Process

1. **Hold Initiation**
   - Legal/compliance issues hold notice
   - Scope of hold defined (data types, date ranges, users)
   - Hold documented in legal hold register

2. **Hold Implementation**
   - Automated deletion suspended for in-scope data
   - Data preserved in current state
   - Personnel notified not to delete relevant data

3. **Hold Monitoring**
   - Regular review of hold necessity
   - Updates to scope as needed
   - Documentation of preservation efforts

4. **Hold Release**
   - Legal/compliance authorizes release
   - Normal retention schedules resume
   - Data disposed per standard schedule

### 10.3 Legal Hold Register

All legal holds tracked with:

- Hold identifier and description
- Date initiated and anticipated duration
- Scope (data types, systems, users)
- Authorizing party
- Status and review dates

---

## 11. Roles and Responsibilities

| Role | Responsibilities |
|------|------------------|
| **Data Protection Lead** | Policy ownership; compliance oversight; deletion request approval |
| **Engineering Team** | Implement automated retention; execute secure deletion |
| **Legal/Compliance** | Define retention requirements; manage legal holds |
| **Security Team** | Verify secure disposal; audit compliance |
| **System Owners** | Ensure systems comply with retention schedules |
| **All Personnel** | Follow retention requirements; report violations |

---

## 12. Compliance and Auditing

### 12.1 Compliance Monitoring

| Activity | Frequency |
|----------|-----------|
| Retention schedule review | Annually |
| Automated deletion verification | Monthly |
| Data inventory audit | Quarterly |
| Consumer deletion request audit | Quarterly |
| Legal hold review | Monthly |

### 12.2 Audit Requirements

Audits verify:

- Data is not retained beyond defined periods
- Disposal methods meet security standards
- Consumer deletion requests processed within SLA
- Legal holds properly implemented
- Documentation is complete and accurate

### 12.3 Compliance Reporting

| Report | Frequency | Audience |
|--------|-----------|----------|
| Retention compliance summary | Monthly | Security/Compliance |
| Consumer deletion metrics | Monthly | Management |
| Legal hold status | Monthly | Legal/Compliance |
| Audit findings | Per audit | Management |

---

## 13. Regulatory Compliance

### 13.1 Applicable Regulations

This policy supports compliance with:

| Regulation | Requirements |
|------------|--------------|
| **CCPA/CPRA** | Consumer right to deletion; 45-day response |
| **GDPR** (if applicable) | Right to erasure; data minimization |
| **GLBA** | Financial data retention requirements |
| **IRS Regulations** | 7-year retention for tax-related records |
| **State Privacy Laws** | Various deletion and retention requirements |

### 13.2 Regulatory Retention Requirements

| Regulation | Data Type | Minimum Retention |
|------------|-----------|-------------------|
| IRS | Financial transaction records | 7 years |
| GLBA | Consumer financial records | 5 years |
| State laws | Varies by state | Per applicable law |

---

## 14. Policy Exceptions

### 14.1 Exception Process

Exceptions to retention periods require:

1. Written request with business justification
2. Legal review for compliance implications
3. Security review for risk assessment
4. Approval by Data Protection Lead
5. Documentation in exception register
6. Defined expiration date (maximum 1 year)
7. Annual review if extended

### 14.2 Exception Documentation

Exceptions must document:

- Data type and scope
- Standard retention period
- Requested retention period
- Business justification
- Legal basis
- Compensating controls
- Expiration date

---

## 15. Training and Awareness

All personnel handling data must:

- Complete data retention training upon hire
- Complete annual refresher training
- Acknowledge understanding of this policy
- Know how to identify data for retention
- Understand secure disposal requirements
- Know how to report violations

---

## 16. Policy Violations

Violations of this policy may result in:

- Disciplinary action up to termination
- Regulatory penalties
- Legal liability
- Reputational damage

All violations must be reported to the security team immediately.

---

## 17. Policy Review

This policy is reviewed:

- Annually at minimum
- When regulations change
- When business practices change
- Following significant incidents
- Upon request from legal/compliance

---

## 18. Related Documents

- Information Security Policy
- Access Control Policy
- Privacy Policy
- Incident Response Plan
- Consumer Rights Procedures

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2026 | Information Security | Initial release |

---

## Approval

This policy has been reviewed and approved by:

_________________________________
**Executive Signature**

_________________________________
**Data Protection Lead**

_________________________________
**Legal/Compliance**

**Date:** _______________

---

*For questions regarding this policy, contact: privacy@joinsterling.com*
