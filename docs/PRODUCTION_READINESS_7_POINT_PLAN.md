# VantDomus Production Readiness Plan

This plan turns the seven remaining production items into concrete deployment, operating and governance work.

## 1. Real Infrastructure

Target outcome: staging and production run on real managed services, not local demo defaults.

Required services:

- HTTPS domain for the web panel, for example `https://app.vantdomus.example`.
- HTTPS public API domain if the API is exposed separately, for example `https://api.vantdomus.example`.
- Managed database or hardened server database with automated snapshots.
- Redis for shared API rate limiting.
- ClamAV daemon plus freshclam signature updates.
- SMTP provider for transactional email.
- Encrypted backup storage plus offsite copy.
- Incident/alert webhook receiver.

Required API variables:

- `APP_ENV=staging` or `APP_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `VANTDOMUS_MFA_SECRET_KEY` or `VANTDOMUS_MFA_SECRET_KEYS`
- `VANTDOMUS_ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `VANTDOMUS_APP_PUBLIC_URL`
- `VANTDOMUS_API_RATE_LIMIT_MODE=redis`
- `VANTDOMUS_REDIS_URL`
- `VANTDOMUS_MALWARE_SCAN_MODE=clamav`
- `VANTDOMUS_CLAMAV_HOST`
- `VANTDOMUS_CLAMAV_PORT`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `VANTDOMUS_BACKUP_ENCRYPTION_KEY`
- `VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL`
- `VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET`

Required web variables:

- `NEXT_PUBLIC_API_BASE`
- `VANTDOMUS_DEPLOY_ENV=staging` or `production`
- `VANTDOMUS_WEB_PROXY_MAX_BODY_BYTES`
- `VANTDOMUS_WEB_PUBLIC_PROXY_MAX_BODY_BYTES`

Production must leave these empty or absent:

- `NEXT_PUBLIC_ACCESS_TOKEN`
- `NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID`
- `VANTDOMUS_ENABLE_PUBLIC_UPLOADS`

Acceptance checks:

- `python tools/security_gate.py`
- `python apps/api/scripts/production_preflight.py --backup-dir <backup-dir>`
- `python tools/production_readiness_report.py --api-env <api-env> --web-env <web-env> --backup-dir <backup-dir>`
- API `/health` returns `ok=true`.
- Web `/login` returns 200 over HTTPS.
- A protected web route redirects to `/login?next=...` without a session.

## 2. Secret Management

Target outcome: no customer secret is stored in code, docs, local text files, screenshots or tickets.

Secrets that must live in a managed secret store:

- `JWT_SECRET`
- `DATABASE_URL`
- `VANTDOMUS_MFA_SECRET_KEY`
- `VANTDOMUS_MFA_SECRET_KEYS`
- `VANTDOMUS_BACKUP_ENCRYPTION_KEY`
- `VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET`
- `SMTP_PASS`
- `VANTDOMUS_REDIS_URL` when it includes credentials
- provider API keys
- webhook/gateway tokens

Minimum process:

- Generate secrets with a cryptographically strong generator.
- Assign each secret an owner, purpose and rotation interval.
- Never paste secrets into repository files.
- Run `python tools/secret_scan.py` before every release.
- Rotate any secret that was ever committed, pasted into chat, sent by email or included in a screenshot.

Rotation cadence:

- JWT signing secret: planned rotation at least every 180 days, immediate rotation after suspected exposure.
- MFA encryption keys: rotate with `VANTDOMUS_MFA_SECRET_KEYS=<new>,<previous>` and `rotate_mfa_secrets.py`.
- Alert signing secret: rotate every 180 days or after receiver compromise.
- SMTP/Redis/database credentials: rotate according to provider policy and after staff offboarding.
- Gateway tokens: use 90-day TTL or less.

Acceptance checks:

- `python tools/secret_scan.py` has zero findings.
- Production secret values do not appear in `.env`, docs, scripts or logs.
- Rotation procedure has been rehearsed in staging.

## 3. Production Login

Target outcome: customer access uses real accounts, MFA, verified email and server-side session controls.

Required flow:

- Create initial admin account in staging.
- Verify email through real SMTP.
- Enable MFA for all admin users.
- Confirm recovery codes are generated and stored by the user, not by support.
- Login writes `HttpOnly` session cookies.
- Browser calls go through `/api/proxy/*`.
- Mutations require CSRF.
- Logout revokes backend session via `POST /auth/logout`.
- Password reset emails work through real SMTP.

Production web must not use:

- `NEXT_PUBLIC_ACCESS_TOKEN`
- `NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID`

Acceptance checks:

- Login succeeds with email/password.
- MFA challenge works when MFA is enabled.
- Password reset invalidates old sessions.
- Logout revokes the session and clears cookies.
- Sensitive actions fail before email verification when verification is required.
- `/settings/<householdId>/security` shows session and MFA status.

## 4. Monitoring And Alerts

Target outcome: critical security and operational failures reach a real incident channel.

Required alert destinations:

- Security incident channel.
- Operations/on-call channel.
- Backup failure channel.
- Compliance/audit mailbox or ticket queue.

Events that must alert:

- `malware_detected`
- `malware_scan_unavailable`
- `clamav_healthcheck_failed`
- repeated `rate_limit_exceeded`
- `password_reset_completed` for privileged users
- admin MFA reset
- membership/invitation changes for sensitive tenants
- export/delete operations
- backup/preflight failure
- security event chain tampering

Scheduled checks:

- ClamAV healthcheck: hourly.
- Security-event chain verification: daily.
- Encrypted backup drill: daily.
- Offsite backup verification: daily.
- Retention cleanup dry-run: daily.
- Production preflight: daily.

Acceptance checks:

- Test alert webhook receives a signed event.
- Receiver verifies `X-VantDomus-Signature`.
- On-call runbook includes severity and escalation mapping.
- Last 24 hours of scheduled jobs have successful logs.

## 5. Backups And Restoration

Target outcome: a customer-data incident can be recovered from an encrypted, verified backup.

Backup requirements:

- Encrypted backup artifact.
- Manifest with SHA-256 checksum.
- Offsite copy.
- Provider-native snapshot if using managed database.
- Documented retention schedule.
- Restore drill with integrity check.

Minimum cadence:

- Daily encrypted backup and restore drill.
- Daily offsite checksum verification.
- Weekly full restore rehearsal in staging-like environment.
- Monthly review of retention policy.

Acceptance checks:

- `backup_restore_drill.py --encrypt --offsite-dir <dir>` succeeds.
- Restored database passes `PRAGMA integrity_check` or provider equivalent.
- Required security tables exist after restore.
- Latest backup manifest checksum matches artifact.
- Restore time objective and restore point objective are documented.

## 6. Legal And Commercial Readiness

Target outcome: customers understand how their data is used, protected, retained and deleted.

Required documents:

- Privacy Policy.
- Terms of Service.
- Data Processing Agreement or data handling addendum.
- Retention and deletion policy.
- Security overview for customers.
- Incident notification policy.
- Subprocessor list.
- Acceptable use policy.

Required operational commitments:

- Define data controller/processor role per customer.
- Define support access boundaries.
- Define export and deletion request process.
- Define incident notice window.
- Define backup retention and deletion lag.
- Define user consent for communications and operational notifications.

Acceptance checks:

- Legal documents reviewed by counsel before customer launch.
- Customer contract references privacy, retention, DPA and support access terms.
- Data deletion workflow tested in staging.
- Export workflow tested in staging.

## 7. Pre-Customer Testing

Target outcome: staging behaves like production and can survive a realistic customer pilot.

Smoke test sequence:

- Deploy API and web to staging.
- Run production preflight without `--skip-network`.
- Open `/login`.
- Create or login as admin.
- Verify email through SMTP.
- Enable MFA.
- Create tenant/customer unit.
- Add second user and assign role.
- Confirm tenant isolation between two units.
- Upload clean attachment and open signed link.
- Upload malware test signature and confirm rejection.
- Create finance/task/health records.
- Export customer data.
- Run contractual delete in staging-only test tenant.
- Confirm audit log and security events.
- Confirm backup drill and restore.
- Confirm alert webhook receives test high-severity event.

Acceptance checks:

- `python tools/security_gate.py` succeeds.
- `python tools/production_readiness_report.py` reports no critical missing configuration.
- Manual smoke test result is signed off.
- Known residual risks are written down before any customer pilot.

## Launch Decision

Do not onboard a real customer until all seven sections are complete in staging and repeated once in production with test data.

## Completion Artifacts

Use these files to complete and evidence the seven points:

- `docs/LAUNCH_SIGNOFF_CHECKLIST.md`
- `docs/STAGING_SMOKE_TEST.md`
- `docs/LEGAL_DATA_PROTECTION_PACK.md`
- `docs/SECRET_ROTATION_REGISTER.md`
- `docs/SUBPROCESSOR_REGISTER.md`
- `docs/INCIDENT_NOTIFICATION_TEMPLATE.md`
- `docs/BACKUP_RESTORE_DRILL_SIGNOFF.md`
- `docs/env/api.production.env.example`
- `docs/env/web.production.env.example`

Use these commands as objective gates:

```powershell
python tools/security_gate.py
python tools/secret_scan.py
python tools/staging_smoke_check.py --web-url <web-url> --api-url <api-url> --household-id <staging-household-id>
python tools/production_readiness_report.py --api-env <api-env-export> --web-env <web-env-export> --backup-dir <backup-dir>
python apps/api/scripts/production_preflight.py --backup-dir <backup-dir>
```

For local development only, `staging_smoke_check.py` accepts `--allow-demo --allow-dev-cache` because Next dev mode emits development cache headers and demo routes may be intentionally accessible.
