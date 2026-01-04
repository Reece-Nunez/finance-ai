# Sterling Information Security Policy

**Document Classification:** Internal Use Only
**Version:** 1.0
**Effective Date:** January 2026
**Last Reviewed:** January 2026
**Next Review Date:** January 2027
**Document Owner:** Information Security Team

---

## 1. Purpose and Scope

### 1.1 Purpose

This Information Security Policy establishes the framework for protecting Sterling's information assets, customer data, and technology infrastructure. It defines the security principles, responsibilities, and requirements that govern how Sterling identifies, mitigates, and monitors information security risks.

### 1.2 Scope

This policy applies to:

- All Sterling employees, contractors, and third-party service providers
- All information systems, applications, and data owned or managed by Sterling
- All customer and consumer financial data processed through the Sterling platform
- All physical and virtual infrastructure supporting Sterling operations

### 1.3 Objectives

- Protect the confidentiality, integrity, and availability of customer financial data
- Ensure compliance with applicable laws, regulations, and contractual obligations
- Establish a risk-based approach to information security management
- Define clear roles and responsibilities for security governance
- Maintain customer trust through robust security practices

---

## 2. Governance and Risk Management

### 2.1 Security Governance Structure

Sterling maintains a security governance structure with defined roles and responsibilities:

| Role | Responsibilities |
|------|------------------|
| Executive Leadership | Overall accountability for security program; resource allocation |
| Information Security Lead | Policy development; security program management; risk oversight |
| Engineering Team | Secure development practices; vulnerability remediation |
| All Personnel | Compliance with security policies; incident reporting |

### 2.2 Risk Management Framework

Sterling implements a continuous risk management process:

1. **Risk Identification:** Regular assessment of threats, vulnerabilities, and potential impacts to information assets
2. **Risk Analysis:** Evaluation of likelihood and impact using a standardized risk matrix
3. **Risk Treatment:** Implementation of controls to mitigate, transfer, accept, or avoid identified risks
4. **Risk Monitoring:** Ongoing monitoring of risk indicators and control effectiveness
5. **Risk Reporting:** Regular reporting to leadership on risk posture and trends

### 2.3 Risk Assessment Schedule

| Assessment Type | Frequency |
|-----------------|-----------|
| Infrastructure vulnerability scans | Weekly |
| Application security testing | Per release / Quarterly |
| Third-party risk assessments | Annually / Upon onboarding |
| Comprehensive risk assessment | Annually |
| Penetration testing | Annually |

---

## 3. Information Classification and Handling

### 3.1 Data Classification Levels

| Classification | Description | Examples |
|----------------|-------------|----------|
| **Confidential** | Highly sensitive data requiring maximum protection | Customer financial data, access tokens, API keys, credentials |
| **Internal** | Business information for internal use only | Internal documentation, system configurations, employee data |
| **Public** | Information approved for public disclosure | Marketing materials, public documentation |

### 3.2 Handling Requirements

#### Confidential Data
- Encrypted at rest using AES-256 or equivalent
- Encrypted in transit using TLS 1.2 or higher
- Access restricted to authorized personnel only
- Logged and auditable access
- Secure deletion when no longer required

#### Internal Data
- Protected from unauthorized external access
- Access based on business need
- Stored on approved systems only

---

## 4. Access Control

### 4.1 Access Control Principles

Sterling implements access control based on the following principles:

- **Least Privilege:** Users receive minimum access necessary to perform job functions
- **Need-to-Know:** Access to sensitive data restricted to those with legitimate business need
- **Separation of Duties:** Critical functions divided among multiple individuals
- **Defense in Depth:** Multiple layers of security controls

### 4.2 Authentication Requirements

| System Type | Minimum Requirements |
|-------------|---------------------|
| Production infrastructure | Multi-factor authentication (MFA) required |
| Cloud management consoles | MFA required; SSO where available |
| Database access | MFA required; certificate-based authentication preferred |
| Customer-facing application | Email/password with secure password requirements |
| Administrative functions | MFA required |

### 4.3 Password Policy

- Minimum 12 characters for user accounts
- Minimum 16 characters for service/admin accounts
- Complexity requirements: uppercase, lowercase, numbers, special characters
- Password rotation: 90 days for privileged accounts
- Account lockout after 5 failed attempts
- No password reuse (minimum 12 previous passwords)

### 4.4 Access Reviews

| Review Type | Frequency |
|-------------|-----------|
| User access recertification | Quarterly |
| Privileged access review | Monthly |
| Service account review | Quarterly |
| Third-party access review | Quarterly |

### 4.5 Access Termination

- Access revoked within 24 hours of employment termination
- Immediate revocation for involuntary terminations
- Access modification within 5 business days for role changes

---

## 5. Infrastructure and Network Security

### 5.1 Network Architecture

Sterling's infrastructure implements:

- **Network segmentation:** Production, staging, and development environments isolated
- **Firewall protection:** All network boundaries protected by firewalls with default-deny rules
- **Intrusion detection:** Monitoring for suspicious network activity
- **DDoS protection:** Cloud-based DDoS mitigation services

### 5.2 Cloud Security

Sterling utilizes cloud service providers with the following requirements:

- SOC 2 Type II certification required
- Data encryption at rest and in transit
- Geographic data residency controls
- Regular security assessments and certifications

### 5.3 Encryption Standards

| Data State | Minimum Standard |
|------------|------------------|
| Data in transit | TLS 1.2 or higher |
| Data at rest | AES-256 encryption |
| Database connections | TLS 1.2 with certificate validation |
| API communications | HTTPS only; certificate pinning where applicable |
| Backup data | AES-256 encryption |

### 5.4 Infrastructure Security Controls

- Automated security patching within 30 days for standard vulnerabilities
- Critical/high severity patches applied within 7 days
- Hardened server configurations based on CIS benchmarks
- Regular vulnerability scanning of all production systems
- Centralized logging and monitoring

---

## 6. Application Security

### 6.1 Secure Development Lifecycle

Sterling integrates security throughout the software development lifecycle:

1. **Requirements:** Security requirements defined for new features
2. **Design:** Threat modeling for significant changes
3. **Development:** Secure coding practices; peer code review
4. **Testing:** Security testing including SAST/DAST
5. **Deployment:** Automated security checks in CI/CD pipeline
6. **Operations:** Runtime protection and monitoring

### 6.2 Secure Coding Standards

- Input validation on all user-supplied data
- Output encoding to prevent injection attacks
- Parameterized queries for database access
- Secure session management
- Protection against OWASP Top 10 vulnerabilities
- No hardcoded credentials or secrets in code
- Secrets managed through secure vault services

### 6.3 Code Review Requirements

- All code changes require peer review before merge
- Security-sensitive changes require security team review
- Automated static analysis on all pull requests
- Dependency vulnerability scanning

### 6.4 Third-Party Libraries

- Approved libraries list maintained
- Automated vulnerability scanning for dependencies
- Critical vulnerabilities in dependencies addressed within 7 days
- Regular updates to address known vulnerabilities

---

## 7. Data Protection and Privacy

### 7.1 Consumer Data Protection

Sterling implements the following protections for consumer financial data:

- **Collection minimization:** Only collect data necessary for service delivery
- **Purpose limitation:** Data used only for stated purposes
- **Encryption:** All consumer financial data encrypted at rest and in transit
- **Access controls:** Strict access controls with audit logging
- **Data isolation:** Consumer data logically separated by user

### 7.2 Data Retention and Deletion

| Data Type | Retention Period | Deletion Method |
|-----------|------------------|-----------------|
| Transaction data | 7 years or as required by law | Secure deletion |
| Account data | Duration of account + 30 days | Secure deletion |
| Authentication logs | 2 years | Automatic purge |
| System logs | 1 year | Automatic purge |
| Backup data | 90 days | Secure deletion |

### 7.3 Consumer Rights

Sterling supports consumer rights including:

- Right to access personal data
- Right to correction of inaccurate data
- Right to deletion (subject to legal retention requirements)
- Right to data portability
- Right to withdraw consent

### 7.4 Privacy Policy

Sterling maintains a public privacy policy that discloses:

- Types of data collected
- Purposes for data collection and use
- Third-party data sharing practices
- Consumer rights and how to exercise them
- Contact information for privacy inquiries

---

## 8. Third-Party Risk Management

### 8.1 Vendor Assessment

All third-party vendors with access to sensitive data must:

- Complete security questionnaire
- Provide evidence of security certifications (SOC 2, ISO 27001, etc.)
- Agree to data protection requirements in contracts
- Undergo periodic reassessment

### 8.2 Vendor Security Requirements

| Vendor Tier | Assessment Requirements |
|-------------|------------------------|
| Critical (access to customer data) | Full security assessment; SOC 2 required; annual review |
| High (infrastructure providers) | Security questionnaire; certifications required; annual review |
| Standard (limited access) | Security questionnaire; biennial review |

### 8.3 Current Third-Party Services

| Service | Purpose | Security Certifications |
|---------|---------|------------------------|
| Supabase | Database and authentication | SOC 2 Type II |
| AWS | Cloud infrastructure | SOC 2, ISO 27001, PCI DSS |
| Plaid | Financial data aggregation | SOC 2 Type II, ISO 27001 |
| Stripe | Payment processing | PCI DSS Level 1, SOC 2 |
| Anthropic | AI services | SOC 2 Type II |

---

## 9. Incident Response

### 9.1 Incident Classification

| Severity | Description | Response Time |
|----------|-------------|---------------|
| Critical | Active breach; data exfiltration; service outage | Immediate (< 1 hour) |
| High | Potential breach; significant vulnerability | < 4 hours |
| Medium | Security policy violation; minor vulnerability | < 24 hours |
| Low | Security improvement opportunity | < 1 week |

### 9.2 Incident Response Process

1. **Detection:** Identify potential security incident through monitoring, alerts, or reports
2. **Triage:** Assess severity and scope; classify incident
3. **Containment:** Isolate affected systems; prevent further damage
4. **Eradication:** Remove threat; patch vulnerabilities
5. **Recovery:** Restore systems; verify integrity
6. **Lessons Learned:** Document incident; update controls as needed

### 9.3 Breach Notification

In the event of a data breach involving consumer data:

- Affected consumers notified within 72 hours of confirmation
- Regulatory authorities notified as required by law
- Third-party partners (e.g., Plaid) notified per contractual requirements
- Documentation maintained for regulatory compliance

### 9.4 Incident Reporting

All personnel must immediately report:

- Suspected security incidents
- Lost or stolen devices
- Phishing attempts
- Unauthorized access attempts
- Policy violations

---

## 10. Business Continuity and Disaster Recovery

### 10.1 Availability Targets

| System | Target Availability | Recovery Time Objective (RTO) | Recovery Point Objective (RPO) |
|--------|--------------------|-----------------------------|-------------------------------|
| Production application | 99.9% | 4 hours | 1 hour |
| Database | 99.9% | 2 hours | 15 minutes |
| Authentication services | 99.9% | 1 hour | 15 minutes |

### 10.2 Backup Requirements

- Automated daily backups of all production data
- Backups encrypted using AES-256
- Backups stored in geographically separate location
- Backup restoration tested quarterly
- Backup retention per data retention policy

### 10.3 Disaster Recovery

- Documented disaster recovery procedures
- Annual DR testing
- Multi-region capability for critical services
- Automated failover where possible

---

## 11. Security Awareness and Training

### 11.1 Training Requirements

| Audience | Training | Frequency |
|----------|----------|-----------|
| All personnel | Security awareness | Upon hire; annually |
| Developers | Secure coding practices | Upon hire; annually |
| Privileged users | Advanced security training | Upon role assignment; annually |

### 11.2 Training Topics

- Information security policies and procedures
- Data handling and classification
- Phishing and social engineering awareness
- Password and authentication security
- Incident reporting procedures
- Regulatory and compliance requirements

---

## 12. Compliance and Audit

### 12.1 Regulatory Compliance

Sterling maintains compliance with applicable regulations including:

- State data protection laws
- Financial services regulations
- Consumer privacy regulations (CCPA, etc.)
- Payment card industry standards (where applicable)

### 12.2 Audit and Assessment

| Assessment Type | Frequency | Scope |
|-----------------|-----------|-------|
| Internal security review | Quarterly | Policy compliance; control effectiveness |
| External penetration test | Annually | Application and infrastructure |
| Third-party audit (SOC 2) | Annually | Security controls |
| Compliance assessment | Annually | Regulatory requirements |

### 12.3 Policy Exceptions

- All policy exceptions require documented approval
- Exceptions granted for limited duration with compensating controls
- Exceptions reviewed quarterly for continued necessity

---

## 13. Policy Enforcement

### 13.1 Compliance Monitoring

- Regular audits of policy compliance
- Automated monitoring of security controls
- Exception tracking and reporting

### 13.2 Violations

Violations of this policy may result in:

- Disciplinary action up to and including termination
- Revocation of system access
- Legal action where appropriate

---

## 14. Policy Review and Updates

This policy is reviewed and updated:

- Annually at minimum
- Following significant security incidents
- When regulatory requirements change
- When significant business changes occur

---

## 15. Definitions

| Term | Definition |
|------|------------|
| Consumer | End user of the Sterling application |
| Confidential Data | Data classified as requiring the highest level of protection |
| MFA | Multi-factor authentication |
| PII | Personally identifiable information |
| RTO | Recovery Time Objective |
| RPO | Recovery Point Objective |

---

## 16. Related Documents

- Privacy Policy
- Terms of Service
- Incident Response Plan
- Business Continuity Plan
- Acceptable Use Policy
- Data Retention Policy

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2026 | Information Security | Initial release |

---

**Approval**

This policy has been reviewed and approved by Sterling executive leadership.

_________________________________
**Executive Signature**
**Date:**

---

*For questions regarding this policy, contact: security@joinsterling.com*
