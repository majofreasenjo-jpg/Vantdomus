# Subprocessor Register

Keep this list current before onboarding real customers. Have counsel review customer notice requirements.

| Provider | Purpose | Data categories | Region | DPA status | Security docs | Date added | Customer notice required |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cloud hosting provider | API/web hosting | account, operational, audit metadata | TBD | TBD | TBD | TBD | TBD |
| Database provider | primary data storage | customer operational data, audit/security records | TBD | TBD | TBD | TBD | TBD |
| Redis provider | rate limiting/session-adjacent counters | IP/user identifiers, throttle metadata | TBD | TBD | TBD | TBD | TBD |
| SMTP provider | transactional email | email address, verification/reset messages | TBD | TBD | TBD | TBD | TBD |
| Backup storage provider | encrypted backup/offsite storage | encrypted database backup | TBD | TBD | TBD | TBD | TBD |
| Alerting/incident tool | security/ops alerts | security event metadata, tenant ids where needed | TBD | TBD | TBD | TBD | TBD |
| Malware signature provider | malware scanning/signature updates | file stream metadata if managed service is used | TBD | TBD | TBD | TBD | TBD |

## Review Procedure

- Review before first customer launch.
- Review whenever a provider is added or replaced.
- Notify customers if contract requires notice.
- Do not send customer data to providers not listed and approved.
