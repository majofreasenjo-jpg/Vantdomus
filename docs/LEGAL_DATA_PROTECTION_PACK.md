# Legal And Data Protection Pack

This pack is an operational template, not legal advice. Have counsel adapt it to the jurisdictions, customers and service model before launch.

## Required Customer-Facing Documents

- Privacy Policy.
- Terms of Service.
- Data Processing Agreement or data handling addendum.
- Retention and deletion policy.
- Incident notification policy.
- Subprocessor list.
- Security overview.
- Acceptable use policy.

## Privacy Policy Outline

Required sections:

- Who operates the service.
- What customer data is collected.
- What operational telemetry is collected.
- Why data is processed.
- Legal basis or contractual basis.
- Who can access customer data.
- How data is protected.
- How long data is retained.
- How customers can request export, correction or deletion.
- How incident notifications work.
- Contact channel for privacy requests.

Minimum product-specific statements:

- Customer operational records are tenant-scoped.
- Attachments are stored in private storage and served only through authorized or signed access.
- Audit, security and assistant-action events may be retained for security and compliance.
- Passwords are stored only as hashes.
- MFA secrets are encrypted.
- Email verification and password reset tokens are stored only as hashes.
- Customer deletion removes customer-scoped private files and revokes active sessions for related members, subject to legal/security retention requirements.

## Terms Of Service Outline

Required sections:

- Authorized users.
- Account security responsibilities.
- Prohibited use.
- Customer data ownership.
- Platform availability limits.
- Support boundaries.
- Beta/demo data disclaimer if applicable.
- Fees and payment terms.
- Suspension/termination.
- Limitation of liability.
- Governing law.

Security-specific terms:

- Customer must keep admin accounts and recovery codes secure.
- Customer must promptly remove departed staff.
- Customer must not upload illegal or intentionally malicious content.
- Customer must approve production integrations and webhook endpoints.

## Data Processing Agreement Outline

Required sections:

- Roles: controller/processor or equivalent.
- Processing instructions.
- Categories of data.
- Categories of data subjects.
- Subprocessors.
- International transfer mechanism if applicable.
- Security measures.
- Breach notification procedure.
- Assistance with data-subject requests.
- Return/deletion at termination.
- Audit rights.

Technical measures to reference:

- Tenant isolation.
- Role-based access.
- MFA support.
- Hashed passwords.
- Encrypted MFA secrets.
- Hashed verification/reset/recovery tokens.
- Tamper-evident security event chain.
- Audit logs.
- Security event alerting.
- Malware scanning.
- Private file storage.
- Signed short-lived file links.
- Encrypted backups and restore drills.
- Secret scanning in release gate.

## Retention And Deletion Policy

Recommended baseline:

- Active customer operational data: retained while customer account is active.
- Deleted customer private files: purged during contractual delete workflow.
- Signed links and invitations: purged after expiration/revocation grace period.
- MFA recovery codes and reset tokens: purged after use/expiration.
- Audit/security events: retained according to contract and legal/security obligation.
- Backups: retained according to backup schedule and deleted after retention window.

Deletion request procedure:

1. Verify requester identity and authority.
2. Export customer data if requested before deletion.
3. Run contractual delete for the tenant.
4. Confirm private files are purged.
5. Confirm sessions are revoked.
6. Record audit/security evidence.
7. Explain backup deletion lag if backups are retained for a fixed window.

## Incident Notification Policy

Minimum incident workflow:

- Detect and triage event.
- Preserve audit/security evidence.
- Contain access or affected integration.
- Rotate credentials if needed.
- Notify impacted customer contacts according to contract.
- Provide known facts, affected systems, mitigations and next update time.
- Complete post-incident review.

Suggested customer-facing notice fields:

- incident id
- detected time
- affected tenant/customer
- data categories involved
- containment actions
- customer actions required
- next update time
- contact channel

## Subprocessor List Template

Maintain a table with:

- provider name
- service purpose
- data categories
- region
- security documentation URL
- DPA status
- date added
- customer notice requirement

Initial expected subprocessors:

- cloud hosting provider
- database provider
- Redis provider
- SMTP provider
- object/offsite backup storage provider
- alerting/incident tool
- malware signature/update provider if managed separately

## Security Overview For Customers

Suggested summary:

VantDomus uses tenant isolation, role-based access, secure session cookies, CSRF protection, email verification, MFA support, private file storage, malware scanning, audit logs, tamper-evident security events, encrypted backup drills and production deployment gates to protect customer data.

Do not claim certifications, compliance frameworks or audit attestations until they are formally obtained.

## Launch Legal Gate

Before first paying customer:

- Counsel has reviewed Privacy Policy.
- Counsel has reviewed Terms of Service.
- DPA or data handling addendum is approved.
- Retention/deletion policy is approved.
- Subprocessor list is complete.
- Incident notification policy is approved.
- Customer support access process is documented.
- Contract references security, privacy, deletion, backup and incident terms.
