# Sterling Access Control Policy

**Document Classification:** Internal Use Only
**Version:** 1.0
**Effective Date:** January 2026
**Last Reviewed:** January 2026
**Next Review Date:** January 2027
**Document Owner:** Information Security Team

---

## 1. Purpose

This Access Control Policy establishes the requirements and procedures for managing access to Sterling's information systems, production assets, and sensitive data. The policy ensures that access is granted based on business need, follows the principle of least privilege, and is regularly reviewed to maintain security.

---

## 2. Scope

This policy applies to:

- All Sterling employees, contractors, and third-party personnel
- All production and non-production systems and environments
- All applications, databases, and infrastructure components
- All consumer and business data
- Human and non-human (service) accounts

---

## 3. Access Control Principles

### 3.1 Least Privilege

All users and systems are granted the minimum level of access necessary to perform their authorized functions. Access rights are:

- Limited to specific resources required for job duties
- Restricted to the minimum permissions needed
- Removed when no longer required

### 3.2 Need-to-Know

Access to sensitive data is restricted to personnel who require it for legitimate business purposes. This includes:

- Consumer financial data
- Authentication credentials and tokens
- System configuration data
- Internal business data

### 3.3 Separation of Duties

Critical functions are divided among multiple individuals to prevent fraud and error:

- Code deployment requires separate approval from code author
- Database administrative access separated from application access
- Financial operations require dual approval
- Security configuration changes require peer review

### 3.4 Defense in Depth

Multiple layers of access controls are implemented:

- Network-level controls (firewalls, segmentation)
- Application-level controls (authentication, authorization)
- Data-level controls (encryption, row-level security)
- Physical controls (where applicable)

---

## 4. Role-Based Access Control (RBAC)

### 4.1 Role Definitions

Sterling implements role-based access control with the following standard roles:

| Role | Description | Access Level |
|------|-------------|--------------|
| **Administrator** | Full system administration capabilities | Full access to assigned systems |
| **Developer** | Application development and deployment | Development environments; limited production read access |
| **Operations** | System monitoring and incident response | Production monitoring; limited configuration access |
| **Support** | Customer support functions | Read access to customer data for support purposes |
| **Analyst** | Business analysis and reporting | Read access to aggregated/anonymized data |
| **Auditor** | Security and compliance auditing | Read-only access to logs and configurations |

### 4.2 Application-Level Roles

#### Sterling Platform Roles

| Role | Permissions |
|------|-------------|
| **Consumer** | Access to own financial data and application features |
| **Premium User** | Consumer permissions plus premium features |
| **Support Agent** | Read access to user data for support (audit logged) |
| **Administrator** | Full platform administration |

### 4.3 Database Access Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| **db_readonly** | SELECT on specified tables | Reporting, analytics |
| **db_application** | SELECT, INSERT, UPDATE, DELETE via RLS | Application service accounts |
| **db_admin** | Full database administration | Database administrators only |

### 4.4 Infrastructure Roles (AWS)

| Role | Permissions | Use Case |
|------|-------------|----------|
| **ViewOnly** | Read-only access to AWS resources | Auditing, monitoring |
| **Developer** | Deploy to non-production environments | Development activities |
| **DevOps** | Deploy to all environments; manage infrastructure | Release management |
| **SecurityAdmin** | Security configuration and monitoring | Security team |
| **Administrator** | Full AWS account access | Emergency access only |

### 4.5 Role Assignment Process

1. **Request:** Access request submitted via ticketing system
2. **Approval:** Manager approval required; security approval for privileged access
3. **Provisioning:** Access provisioned based on approved role
4. **Documentation:** Access grant documented with business justification
5. **Notification:** User notified of access and responsibilities

---

## 5. Authentication Requirements

### 5.1 Human User Authentication

#### Password Requirements

| Requirement | Standard Accounts | Privileged Accounts |
|-------------|-------------------|---------------------|
| Minimum length | 12 characters | 16 characters |
| Complexity | Upper, lower, number, special | Upper, lower, number, special |
| Maximum age | 90 days | 60 days |
| History | 12 passwords | 24 passwords |
| Lockout threshold | 5 failed attempts | 3 failed attempts |
| Lockout duration | 30 minutes | Manual unlock required |

#### Multi-Factor Authentication (MFA)

MFA is **required** for:

| System/Access Type | MFA Requirement |
|--------------------|-----------------|
| AWS Console | Required |
| Supabase Dashboard | Required |
| Plaid Dashboard | Required |
| Stripe Dashboard | Required |
| Production database access | Required |
| VPN/Remote access | Required |
| Administrative interfaces | Required |
| Code repository (GitHub) | Required |
| CI/CD pipeline approvals | Required |

MFA Methods Approved:
- Hardware security keys (FIDO2/WebAuthn) - Preferred
- Authenticator applications (TOTP)
- Push notifications from approved apps

MFA Methods Not Approved:
- SMS-based OTP (except as backup)
- Email-based OTP

### 5.2 Consumer Authentication

Sterling platform consumers authenticate using:

- Email and password (minimum 8 characters with complexity)
- Optional MFA via authenticator app
- Session tokens with configurable expiration
- Secure password reset via verified email

### 5.3 Session Management

| Session Type | Timeout | Renewal |
|--------------|---------|---------|
| Consumer web session | 24 hours idle / 7 days max | Automatic with activity |
| Consumer mobile session | 30 days | Refresh token rotation |
| Administrative session | 1 hour idle / 8 hours max | Re-authentication required |
| API session | Per token expiration | Refresh token flow |

---

## 6. Non-Human Authentication (Service Accounts)

### 6.1 Service Account Types

| Type | Description | Authentication Method |
|------|-------------|----------------------|
| **Application Service Account** | Application-to-database connections | OAuth tokens / JWT |
| **API Integration** | Third-party API access | API keys / OAuth 2.0 |
| **Infrastructure Service** | Cloud service communication | IAM roles / TLS certificates |
| **CI/CD Pipeline** | Automated deployment | Short-lived tokens / OIDC |

### 6.2 OAuth Token Management

Sterling uses OAuth 2.0 / JWT tokens for service authentication:

#### Token Specifications

| Token Type | Lifetime | Rotation |
|------------|----------|----------|
| Access tokens | 1 hour maximum | Automatic via refresh |
| Refresh tokens | 7 days maximum | Rotation on use |
| Service tokens | 24 hours maximum | Automatic rotation |

#### Token Security Requirements

- Tokens stored in secure credential stores (not in code)
- Tokens transmitted only over TLS 1.2+
- Token scopes limited to minimum required permissions
- Token revocation capability implemented
- Token usage logged and monitored

### 6.3 TLS Certificate Authentication

For service-to-service communication:

| Requirement | Standard |
|-------------|----------|
| Minimum key length | RSA 2048-bit / ECDSA P-256 |
| Certificate validity | 1 year maximum |
| Certificate authority | Approved internal or public CA |
| Certificate revocation | CRL/OCSP checking enabled |
| Mutual TLS (mTLS) | Required for sensitive service communication |

### 6.4 API Key Management

| Requirement | Implementation |
|-------------|----------------|
| Storage | Encrypted secrets manager (environment variables, vault) |
| Rotation | Every 90 days or upon personnel change |
| Scope | Limited to specific API endpoints/operations |
| Monitoring | Usage logging and anomaly detection |
| Revocation | Immediate revocation capability |

### 6.5 Service Account Inventory

All service accounts are inventoried with:

- Account name and purpose
- Owner/responsible team
- Systems accessed
- Permissions granted
- Creation and last review date
- Expiration/rotation schedule

---

## 7. Access to Production Systems

### 7.1 Production Access Restrictions

Access to production systems is restricted and controlled:

| Restriction | Implementation |
|-------------|----------------|
| Default deny | No access unless explicitly granted |
| Business justification | Required for all production access |
| Time-limited access | Just-in-time access for troubleshooting |
| Audit logging | All production access logged |
| Separate credentials | Production credentials separate from non-production |

### 7.2 Production Access Tiers

| Tier | Access Type | Approval Required | Duration |
|------|-------------|-------------------|----------|
| **Tier 1** | Read-only monitoring | Manager | Standing |
| **Tier 2** | Application logs/debugging | Manager + Security | 24 hours |
| **Tier 3** | Database read access | Manager + Security + Data Owner | 4 hours |
| **Tier 4** | Database write access | VP + Security + Data Owner | 2 hours |
| **Tier 5** | Infrastructure admin | Executive + Security | 1 hour |

### 7.3 Emergency Access

Emergency access procedures for critical incidents:

1. Emergency declared by on-call engineer
2. Break-glass access granted via secure procedure
3. All actions logged and recorded
4. Access automatically revoked after incident
5. Post-incident review within 24 hours

---

## 8. Access to Sensitive Data

### 8.1 Consumer Financial Data Access

Access to consumer financial data is strictly controlled:

| Control | Implementation |
|---------|----------------|
| Row-Level Security (RLS) | Database enforces user can only access own data |
| Application enforcement | API layer validates user ownership |
| Encryption | Data encrypted at rest and in transit |
| Audit logging | All data access logged with user identity |
| Data masking | PII masked in logs and non-production environments |

### 8.2 Supabase Row-Level Security

Sterling implements RLS policies in Supabase:

```sql
-- Example: Users can only access their own accounts
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);

-- Example: Users can only access their own transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);
```

### 8.3 Administrative Access to Consumer Data

- Requires documented business justification
- Requires manager and security approval
- Limited to minimum data necessary
- All access logged with query details
- Regular audit of administrative access

---

## 9. Third-Party Access

### 9.1 Third-Party Access Requirements

Third parties requiring access must:

1. Sign confidentiality/NDA agreements
2. Complete security assessment
3. Receive security awareness briefing
4. Use dedicated accounts (no shared credentials)
5. Access via secure methods (VPN, SSO)
6. Submit to access logging and monitoring

### 9.2 Third-Party Access Controls

| Control | Requirement |
|---------|-------------|
| Account type | Named individual accounts |
| Authentication | MFA required |
| Authorization | Minimum necessary access |
| Duration | Time-limited with expiration |
| Monitoring | Enhanced logging and alerting |
| Review | Monthly access review |

### 9.3 Vendor API Access

Third-party services access Sterling data via:

| Vendor | Access Method | Data Accessed | Controls |
|--------|---------------|---------------|----------|
| Plaid | OAuth/API | Financial credentials (tokenized) | Encrypted transit, audit logged |
| Stripe | API Key | Payment data | PCI DSS compliant, tokenized |
| Anthropic | API Key | Anonymized query data | No PII transmitted |

---

## 10. Access Lifecycle Management

### 10.1 Access Provisioning

| Step | Description | Timeline |
|------|-------------|----------|
| Request | User/manager submits access request | Day 0 |
| Approval | Manager approval; security for privileged | 1-2 days |
| Provisioning | Access granted per approved request | 1 day |
| Verification | User confirms access works | 1 day |
| Documentation | Access documented in inventory | Immediate |

### 10.2 Access Modification

Access modifications follow the same approval process as new access:

- Role changes require new approval
- Additional access requires justification
- Access scope increases require security review

### 10.3 Access Revocation

| Trigger | Timeline | Process |
|---------|----------|---------|
| Voluntary termination | Last day of employment | Disable accounts; revoke tokens |
| Involuntary termination | Immediate | Immediate disable; password reset |
| Role change | Within 5 business days | Remove old access; provision new |
| Project completion | Within 5 business days | Remove project-specific access |
| Leave of absence | Start of leave | Disable accounts temporarily |

### 10.4 Access Revocation Checklist

Upon termination or role change:

- [ ] Disable SSO/directory account
- [ ] Revoke AWS IAM access
- [ ] Remove Supabase dashboard access
- [ ] Revoke GitHub access
- [ ] Disable VPN access
- [ ] Revoke API keys/tokens
- [ ] Remove from distribution lists
- [ ] Collect hardware (if applicable)
- [ ] Document revocation

---

## 11. Access Reviews and Audits

### 11.1 Periodic Access Reviews

| Review Type | Frequency | Reviewer | Scope |
|-------------|-----------|----------|-------|
| User access certification | Quarterly | Managers | All user access |
| Privileged access review | Monthly | Security + Management | Admin/elevated access |
| Service account review | Quarterly | System owners | All service accounts |
| Third-party access review | Quarterly | Vendor managers | External access |
| Dormant account review | Monthly | Security | Unused accounts |

### 11.2 Access Review Process

1. **Generate report:** List of all access for review scope
2. **Distribute:** Send to appropriate reviewers
3. **Review:** Reviewers validate each access grant
4. **Certify/Revoke:** Approve continued access or request revocation
5. **Remediate:** Remove access not certified within 5 days
6. **Document:** Record review completion and findings

### 11.3 Audit Logging

All access-related events are logged:

| Event | Logged Information |
|-------|-------------------|
| Authentication | User, timestamp, source IP, success/failure |
| Authorization | User, resource, action, decision |
| Access changes | User, change type, approver, timestamp |
| Data access | User, query/operation, data accessed |
| Administrative actions | User, action, target, timestamp |

Log retention: Minimum 2 years

---

## 12. Technical Implementation

### 12.1 Authentication Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Identity Provider | Supabase Auth | Consumer authentication |
| SSO Provider | Google Workspace / Okta | Employee authentication |
| MFA | Authenticator apps / Hardware keys | Second factor |
| Secrets Management | Environment variables / AWS Secrets Manager | Credential storage |

### 12.2 Authorization Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| API Authorization | JWT validation | Request authentication |
| Database Authorization | Supabase RLS | Row-level data access |
| Cloud Authorization | AWS IAM | Infrastructure access |
| Application Authorization | Custom RBAC | Feature access |

### 12.3 Access Control Matrix

| Resource | Consumer | Support | Developer | Admin |
|----------|----------|---------|-----------|-------|
| Own financial data | Read/Write | Read | None | Read |
| Other user data | None | Read (logged) | None | Read (logged) |
| Application features | Per subscription | Full | Full | Full |
| Production logs | None | Read | Read | Full |
| Production database | None | None | Read | Full |
| Infrastructure | None | None | Non-prod | Full |

---

## 13. Compliance and Exceptions

### 13.1 Policy Compliance

- All personnel must comply with this policy
- Compliance monitored through access reviews and audits
- Violations reported to management and security

### 13.2 Policy Exceptions

Exceptions to this policy require:

1. Written request with business justification
2. Risk assessment
3. Security team review
4. Management approval (VP level for significant exceptions)
5. Compensating controls documented
6. Time-limited duration (maximum 1 year)
7. Periodic review of continued necessity

### 13.3 Exception Register

All exceptions are tracked in an exception register including:

- Exception description
- Business justification
- Risk assessment
- Compensating controls
- Approval chain
- Expiration date
- Review schedule

---

## 14. Enforcement

Violations of this policy may result in:

- Immediate access revocation
- Disciplinary action up to termination
- Legal action where appropriate
- Reporting to regulatory authorities if required

---

## 15. References

- Sterling Information Security Policy
- Sterling Privacy Policy
- Sterling Incident Response Plan
- NIST SP 800-53 (Access Control)
- CIS Controls (Access Control)

---

## 16. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2026 | Information Security | Initial release |

---

## Approval

This policy has been reviewed and approved by:

_________________________________
**Executive Signature**

_________________________________
**Information Security Lead**

**Date:** _______________

---

*For questions regarding this policy, contact: security@joinsterling.com*
