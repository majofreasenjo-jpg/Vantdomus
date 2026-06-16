# Production Runbook

This runbook describes the minimum operating procedure for running VantDomus Improved with customer data.

## Scope

Use this runbook for staging, production, and any shared environment that may contain customer or customer-like data.

Never copy production customer data into local or demo environments unless the data owner explicitly approves it and the dataset is anonymized.

Companion launch artifacts:

- `docs/PRODUCTION_READINESS_7_POINT_PLAN.md`
- `docs/LAUNCH_SIGNOFF_CHECKLIST.md`
- `docs/STAGING_SMOKE_TEST.md`
- `docs/LEGAL_DATA_PROTECTION_PACK.md`
- `docs/SECRET_ROTATION_REGISTER.md`
- `docs/SUBPROCESSOR_REGISTER.md`
- `docs/INCIDENT_NOTIFICATION_TEMPLATE.md`
- `docs/BACKUP_RESTORE_DRILL_SIGNOFF.md`

## Required Runtime Controls

`APP_ENV` must be `staging` or `production`.

The API refuses to start in staging/production unless these controls are configured:

- `JWT_SECRET`: strong secret, 32+ characters, not the local default.
- `VANTDOMUS_MFA_SECRET_KEY` or `VANTDOMUS_MFA_SECRET_KEYS`: 32+ characters for every key.
- `VANTDOMUS_MALWARE_SCAN_MODE=clamav`.
- `VANTDOMUS_API_RATE_LIMIT_MODE=redis`.
- `VANTDOMUS_REDIS_URL`: shared Redis URL for API rate limiting.
- `VANTDOMUS_BACKUP_ENCRYPTION_KEY`: strong 32+ character backup encryption secret.
- `VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL`: incident/security alert receiver.
- `VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET`: strong 32+ character signing secret.
- `CORS_ALLOWED_ORIGINS`: explicit production web origins only; no `*`, `localhost`, or `127.0.0.1`.
- `VANTDOMUS_ALLOWED_HOSTS`: explicit API/web host list; no `*`, `localhost`, or `127.0.0.1`.
- `VANTDOMUS_APP_PUBLIC_URL`: HTTPS public web URL.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: transactional email delivery.

Recommended production-only values:

- `VANTDOMUS_MALWARE_FAIL_CLOSED=true`
- `VANTDOMUS_SECURITY_ALERT_MIN_SEVERITY=high`
- `VANTDOMUS_GATEWAY_TOKEN_TTL_DAYS=90`
- `VANTDOMUS_ALLOW_DEMO_SEED=false`
- `VANTDOMUS_ALLOW_NOTIFICATION_TESTS=false`
- `VANTDOMUS_ENABLE_PUBLIC_UPLOADS=false`

## Secret Handling

Store these values only in a managed secret store or KMS-backed environment:

- `JWT_SECRET`
- `VANTDOMUS_MFA_SECRET_KEY`
- `VANTDOMUS_MFA_SECRET_KEYS`
- `VANTDOMUS_BACKUP_ENCRYPTION_KEY`
- `VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET`
- database credentials
- Redis credentials
- notification provider credentials
- gateway/webhook tokens

Do not commit real secrets to `.env`, Dockerfiles, docs, screenshots, tickets, or logs.

## Preflight Before Deploy

Run the local release gate from the repository root:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools\security_gate.py
```

This runs the backend security suite and the web production build.

The backend security suite can also be run directly:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m pytest tests\security\test_tenant_isolation.py -q --basetemp C:\tmp\pytest -p no:cacheprovider
```

Expected result:

```text
66 passed
```

The web panel build can also be run directly:

```powershell
cd apps\web
npm.cmd run build
```

Run the production readiness preflight from the repository root:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe apps\api\scripts\production_preflight.py --backup-dir <backup-dir>
```

Use `--skip-network` only in CI jobs that cannot reach staging Redis or ClamAV. Do not use it as the final production gate.

Verify the API boots with production-like variables in staging before promoting.

Generate the production readiness report from completed env files:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools\production_readiness_report.py --api-env docs\env\api.production.env.example --web-env docs\env\web.production.env.example --backup-dir <backup-dir>
```

Use copied real staging/production env exports for the final report. The example files intentionally contain placeholders and should fail until replaced with real secret-manager values.

## Health Checks

Service probe:

```http
GET /health
```

Tenant-scoped operational status:

```http
GET /audit/operational-status?household_id=<household_id>
```

This endpoint requires household `admin` role and reports:

- database health
- Redis/rate-limit backend status
- ClamAV status
- latest local backup artifact
- recent `high` and `critical` security events

## Malware Monitoring

Production must use ClamAV:

```env
VANTDOMUS_MALWARE_SCAN_MODE=clamav
VANTDOMUS_CLAMAV_HOST=clamav
VANTDOMUS_CLAMAV_PORT=3310
VANTDOMUS_MALWARE_FAIL_CLOSED=true
```

Run the ClamAV daemon healthcheck on a schedule:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe apps\api\scripts\clamav_healthcheck.py
```

On failure, the script records a `security_events` row:

```text
event_type=clamav_healthcheck_failed
severity=high
source=clamav_healthcheck
```

Route this event to the production incident channel through the security alert webhook.

## Backups

Run encrypted backup/restore drills on a schedule:

```powershell
$env:VANTDOMUS_BACKUP_ENCRYPTION_KEY='<secret-from-secret-store>'
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe apps\api\scripts\backup_restore_drill.py --backup-dir <backup-dir> --encrypt
```

Copy the verified encrypted artifact and manifest to an offsite directory:

```powershell
$env:VANTDOMUS_BACKUP_ENCRYPTION_KEY='<secret-from-secret-store>'
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe apps\api\scripts\backup_restore_drill.py --backup-dir <backup-dir> --encrypt --offsite-dir <offsite-backup-dir>
```

The drill must:

- create a consistent SQLite backup
- encrypt the backup envelope
- write a `.manifest.json` with backup size and SHA-256 checksum
- copy the encrypted backup and manifest to the offsite directory when configured
- decrypt into a temporary restore database
- run `PRAGMA integrity_check`
- verify required security tables exist

Production database engines should additionally use provider-native backups and offsite encrypted retention. Treat the local SQLite drill as the baseline restoration proof, not the whole production backup strategy.

## Retention Cleanup

Temporary security records should be purged after their operational usefulness has passed.

The cleanup script runs in dry-run mode by default:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe apps\api\scripts\retention_cleanup.py --grace-days 30
```

Apply cleanup only after reviewing the dry-run counts:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe apps\api\scripts\retention_cleanup.py --grace-days 30 --apply
```

The script purges only:

- expired or revoked signed file links
- expired, accepted or revoked household invitations
- used MFA recovery codes

On apply, it records a low-severity `security_events` row with `event_type=retention_cleanup`.

## Scheduled Jobs

On Windows hosts, install the baseline security jobs from an elevated PowerShell session:

```powershell
.\tools\windows\Install-ScheduledSecurityJobs.ps1 `
  -ProjectRoot "D:\Aplicaciones de Juegos\VantDomus_Improved" `
  -PythonPath "C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" `
  -BackupDir "C:\VantDomus\backups" `
  -OffsiteBackupDir "C:\VantDomus\offsite-backups" `
  -LogDir "C:\VantDomus\logs"
```

The installer creates these Task Scheduler jobs:

- `VantDomus-ClamAV-Healthcheck`: hourly ClamAV check.
- `VantDomus-Encrypted-Backup-Drill`: daily encrypted backup and restore drill.
- `VantDomus-Security-Event-Integrity`: daily hash-chain verification.
- `VantDomus-Retention-Cleanup-DryRun`: daily retention cleanup dry-run.
- `VantDomus-Production-Preflight`: daily production readiness check.

Remove them with:

```powershell
.\tools\windows\Uninstall-ScheduledSecurityJobs.ps1
```

Review logs in the configured `LogDir`. Do not schedule `retention_cleanup.py --apply` until dry-run counts are reviewed and the retention policy is approved.

## Alerting

Configure:

```env
VANTDOMUS_SECURITY_ALERT_WEBHOOK_URL=https://...
VANTDOMUS_SECURITY_ALERT_MIN_SEVERITY=high
VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET=CHANGE_ME_32_PLUS_CHARACTER_ALERT_SIGNING_SECRET
```

Alert payloads are signed with:

```text
X-VantDomus-Signature: sha256=<hmac>
```

Incident receiver should verify the signature before accepting the event.

Events that should page an operator:

- `malware_detected`
- `malware_scan_unavailable`
- `clamav_healthcheck_failed`
- repeated `rate_limit_exceeded`
- unexpected critical export/delete activity
- suspicious invitation or membership changes

## Secret Rotation

Rotate MFA encryption keys with an ordered key ring:

```env
VANTDOMUS_MFA_SECRET_KEYS=<new-active-key>,<previous-key>
```

Then run:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe apps\api\scripts\rotate_mfa_secrets.py --apply
```

After verification, remove retired keys from `VANTDOMUS_MFA_SECRET_KEYS`.

Rotate gateway tokens from the admin coupling UI or API:

```http
POST /coupling/{household_id}/gateways/{gateway_id}/rotate-token
```

Rotate signed alert webhook secrets by deploying receiver support for both old and new secrets during the transition window, then update `VANTDOMUS_SECURITY_ALERT_SIGNING_SECRET`.

## Incident Response

1. Open `/settings/{householdId}/audit`.
2. Check operational status and recent high/critical events.
3. Export an evidence package:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe apps\api\scripts\incident_evidence_export.py --household-id <household_id> --output-dir <evidence-dir>
```

The package includes tenant-scoped audit events, assistant actions, security events, security-event chain verification and a package SHA-256.

4. Pull audit events if live API inspection is needed:

```http
GET /audit?household_id=<household_id>
GET /audit/security-events?household_id=<household_id>
GET /audit/assistant-actions?household_id=<household_id>
```

5. If malware is involved, quarantine the uploaded artifact path from private storage and keep the security event id.
6. If credentials or tokens are involved, rotate affected secrets and revoke signed links/gateway tokens.
7. If tenant exposure is suspected, preserve logs and pause destructive cleanup until evidence is retained.
8. After containment, run the full security suite and a backup restore drill.

## Security Event Integrity

Verify tamper-evident security event chains during audits and incident reviews:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe apps\api\scripts\verify_security_events.py
```

To verify a single tenant:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe apps\api\scripts\verify_security_events.py --household-id <household_id>
```

The script exits non-zero if any chain is tampered or incomplete.

## Release Gate

Do not release a build to customer production unless all are true:

- security suite passes
- web build passes
- `/health` returns `ok=true`
- `/audit/operational-status` is reviewed by an admin
- ClamAV healthcheck is scheduled
- encrypted backup drill is scheduled
- offsite backup copy is configured and checksum-verified
- latest encrypted backup has a matching manifest checksum
- retention cleanup dry-run is reviewed and apply job is scheduled
- security event hash chains verify successfully
- production preflight passes without `--skip-network`
- production readiness report passes using real env exports
- alert webhook is receiving signed events
- secrets are stored outside source control
- demo seed and notification test endpoints are disabled
