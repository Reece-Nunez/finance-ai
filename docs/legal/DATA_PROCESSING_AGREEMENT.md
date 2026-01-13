# Data Processing Agreement (DPA)

**Effective Date:** [DATE]

This Data Processing Agreement ("DPA") forms part of the Terms of Service between:

**Data Controller:** The entity agreeing to Sterling's Terms of Service ("Customer", "you")

**Data Processor:** Sterling Financial Technologies Inc. ("Sterling", "we", "us")

---

## 1. Definitions

**"Personal Data"** means any information relating to an identified or identifiable natural person.

**"Processing"** means any operation performed on Personal Data, including collection, storage, use, disclosure, or deletion.

**"Sub-processor"** means any third party engaged by Sterling to process Personal Data on behalf of Customer.

**"Data Subject"** means the individual to whom Personal Data relates.

**"Applicable Data Protection Law"** means GDPR, CCPA, and any other applicable privacy laws.

---

## 2. Scope and Purpose

### 2.1 Subject Matter
Sterling processes Personal Data to provide financial management services, including:
- Bank account aggregation via Plaid
- Transaction categorization and analysis
- Budget tracking and financial insights
- AI-powered financial assistance
- Subscription billing via Stripe

### 2.2 Duration
Processing continues for the duration of the service agreement, plus any retention period required by law.

### 2.3 Categories of Data Subjects
- Customer's end users
- Account holders linked through Plaid

### 2.4 Types of Personal Data Processed

| Category | Examples |
|----------|----------|
| Identity Data | Name, email address |
| Financial Data | Bank account numbers, transaction history, balances |
| Usage Data | App interactions, feature usage |
| Device Data | IP address, device identifiers |

---

## 3. Obligations of Sterling (Data Processor)

### 3.1 Processing Instructions
Sterling shall:
- Process Personal Data only on documented instructions from Customer
- Inform Customer if legally required to process data otherwise
- Ensure processing is lawful under Applicable Data Protection Law

### 3.2 Confidentiality
Sterling shall:
- Ensure personnel processing data are bound by confidentiality obligations
- Limit access to Personal Data to personnel who need it
- Implement access controls and authentication measures

### 3.3 Security Measures
Sterling implements appropriate technical and organizational measures including:

**Technical Measures:**
- Encryption at rest (AES-256) and in transit (TLS 1.2+)
- Row-Level Security (RLS) database policies
- Rate limiting and DDoS protection
- Regular security audits and penetration testing
- Automated vulnerability scanning

**Organizational Measures:**
- Role-based access control (RBAC)
- Employee security training
- Incident response procedures
- Business continuity planning

### 3.4 Sub-processors
Sterling uses the following sub-processors:

| Sub-processor | Purpose | Location | DPA |
|---------------|---------|----------|-----|
| Supabase | Database hosting, authentication | USA/EU | [Link] |
| Vercel | Application hosting | USA/EU | [Link] |
| Plaid | Bank account linking | USA | [Link] |
| Stripe | Payment processing | USA | [Link] |
| Anthropic | AI services | USA | [Link] |
| Sentry | Error monitoring | USA | [Link] |

Sterling shall:
- Maintain an up-to-date list of sub-processors
- Notify Customer of any intended changes to sub-processors
- Ensure sub-processors are bound by equivalent data protection obligations
- Remain liable for sub-processor compliance

### 3.5 Data Subject Rights
Sterling shall assist Customer in responding to Data Subject requests for:
- Access to Personal Data
- Rectification of inaccurate data
- Erasure ("right to be forgotten")
- Data portability
- Restriction of processing
- Objection to processing

**Implementation:**
- Data export: Available in Settings → Export Data (JSON format)
- Account deletion: Available in Settings → Delete Account (cascades to all data)
- Data access: Users can view all their data in-app

### 3.6 Data Breach Notification
In the event of a Personal Data breach, Sterling shall:
- Notify Customer without undue delay (within 72 hours of discovery)
- Provide details of the breach, affected data, and remediation steps
- Cooperate with Customer's obligations to notify supervisory authorities
- Document all breaches and remediation actions

### 3.7 Audit Rights
Sterling shall:
- Make available information necessary to demonstrate compliance
- Allow for audits conducted by Customer or an appointed auditor
- Provide audit reports upon request (SOC 2 Type II when available)

### 3.8 Data Deletion
Upon termination of services or Customer request, Sterling shall:
- Delete or return all Personal Data within 30 days
- Provide written confirmation of deletion
- Retain only data required by law (with documentation of legal basis)

---

## 4. Obligations of Customer (Data Controller)

Customer shall:
- Ensure lawful basis for processing (consent, contract, legitimate interest)
- Provide clear privacy notices to Data Subjects
- Respond to Data Subject requests within legal timeframes
- Notify Sterling of any processing restrictions
- Ensure accuracy of Personal Data provided

---

## 5. International Data Transfers

### 5.1 Transfer Mechanisms
For transfers outside the EEA, Sterling relies on:
- Standard Contractual Clauses (SCCs) approved by the European Commission
- Adequacy decisions where applicable
- Binding Corporate Rules where applicable

### 5.2 US Data Transfers
Sterling and its US-based sub-processors implement supplementary measures:
- Encryption of data in transit and at rest
- Access controls limiting data access
- Policies prohibiting mass surveillance compliance
- Transparency reports on government requests

---

## 6. CCPA-Specific Provisions

For California residents, Sterling:
- Acts as a "Service Provider" under CCPA
- Does not sell Personal Information
- Does not retain, use, or disclose Personal Information except as necessary to perform services
- Certifies understanding of CCPA restrictions
- Supports Customer's obligations for consumer rights requests

---

## 7. Term and Termination

### 7.1 Term
This DPA is effective upon Customer's acceptance of Sterling's Terms of Service and continues until termination of services.

### 7.2 Survival
Obligations regarding data deletion, confidentiality, and audit rights survive termination.

---

## 8. Liability

### 8.1 Limitation
Each party's liability under this DPA is subject to the limitations in the Terms of Service.

### 8.2 Indemnification
Sterling shall indemnify Customer for losses arising from Sterling's breach of this DPA or Applicable Data Protection Law.

---

## 9. Amendments

Sterling may update this DPA to reflect:
- Changes in Applicable Data Protection Law
- Changes in sub-processors
- Improvements to security measures

Material changes will be notified to Customer with 30 days' notice.

---

## 10. Contact Information

**Data Protection Inquiries:**
- Email: privacy@joinsterling.com
- Address: [Company Address]

**Data Protection Officer (if appointed):**
- Email: dpo@joinsterling.com

---

## Annex A: Technical and Organizational Measures

### A.1 Access Control
- Multi-factor authentication for admin access
- Role-based access control (user, support, admin, super_admin)
- Automatic session timeout (5 minutes inactivity)
- Audit logging of all data access

### A.2 Encryption
- TLS 1.2+ for all data in transit
- AES-256 encryption at rest (Supabase)
- Encrypted backups
- Secure key management

### A.3 Network Security
- Web Application Firewall (WAF)
- DDoS protection (Vercel/Cloudflare)
- Rate limiting per endpoint
- Security headers (CSP, HSTS, X-Frame-Options)

### A.4 Application Security
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention
- CSRF protection
- Regular dependency updates

### A.5 Monitoring and Logging
- Real-time error monitoring (Sentry)
- Audit logging of sensitive operations
- Anomaly detection
- Incident alerting

### A.6 Business Continuity
- Automated daily backups
- Point-in-time recovery capability
- Disaster recovery procedures
- 99.9% uptime SLA (Vercel/Supabase)

### A.7 Vendor Management
- Due diligence on sub-processors
- Contractual data protection requirements
- Regular review of sub-processor compliance

---

## Annex B: Standard Contractual Clauses

For international data transfers, the Standard Contractual Clauses (Module 2: Controller to Processor) adopted by European Commission Decision 2021/914 are incorporated by reference.

The details required for the SCCs are:
- **Clause 7 (Docking clause):** Not used
- **Clause 9 (Use of sub-processors):** Option 2 (general written authorization with notification)
- **Clause 11 (Redress):** Not used
- **Clause 17 (Governing law):** Laws of Ireland
- **Clause 18 (Choice of forum):** Courts of Ireland

---

## Annex C: List of Sub-processors

*Last updated: [DATE]*

| Name | Processing Activities | Location | Safeguards |
|------|----------------------|----------|------------|
| Supabase Inc. | Database, authentication, file storage | USA (AWS) | SCCs, encryption |
| Vercel Inc. | Application hosting, CDN | USA/EU | SCCs, encryption |
| Plaid Inc. | Bank account linking, transaction sync | USA | SCCs, SOC 2 |
| Stripe Inc. | Payment processing, subscription management | USA | SCCs, PCI DSS |
| Anthropic PBC | AI processing for financial insights | USA | SCCs, encryption |
| Functional Software Inc. (Sentry) | Error monitoring, performance tracking | USA | SCCs, encryption |

---

**IMPORTANT NOTICE:** This document is a template and should be reviewed by qualified legal counsel before use. Data protection requirements vary by jurisdiction and business context. Sterling makes no warranties regarding the legal sufficiency of this template.

---

*Document Version: 1.0*
*Last Reviewed: [DATE]*
