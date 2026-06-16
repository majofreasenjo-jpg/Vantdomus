# Staging Smoke Test

Run this checklist before every customer pilot and before production launch.

## Pre-Deploy

- Confirm branch is clean and reviewed.
- Run `python tools/security_gate.py`.
- Confirm `python tools/secret_scan.py` has zero findings.
- Confirm API and web production env files contain no demo token.
- Confirm production-like values are loaded from secret manager, not files committed to the repo.

## Deploy

- Deploy API to staging.
- Deploy web panel to staging.
- Confirm API `/health` returns `ok=true`.
- Confirm web `/login` returns HTTP 200 over HTTPS.
- Confirm `/dashboard/<id>` redirects to `/login?next=...` without session.

## Identity

- Create or invite staging admin user.
- Login with email/password.
- Confirm `vantdomus_access_token` and `vantdomus_session_id` are `HttpOnly`.
- Verify email through SMTP.
- Enable MFA.
- Logout and confirm the session is revoked.
- Login again with MFA.
- Request password reset.
- Confirm password reset revokes previous sessions.

## Tenant Isolation

- Create two staging customer units.
- Add user A to unit A.
- Add user B to unit B.
- Confirm user A cannot read unit B dashboard, finance, tasks, members, audit, logbook or files.
- Confirm user B cannot read unit A.
- Confirm admin audit view shows only tenant-scoped events unless global admin tooling is explicitly used.

## Data Workflows

- Create task, mark done and change status.
- Add finance expense.
- Create health/check-in record if enabled for the tenant.
- Upload a clean logbook attachment.
- Create signed file link.
- Confirm signed file link expires and can be revoked.
- Upload malware test signature in staging and confirm rejection.
- Confirm no raw file path is exposed in API response.

## Customer Rights

- Export customer data.
- Review export for expected redactions.
- Run contractual delete against a staging-only tenant.
- Confirm private files are purged.
- Confirm active sessions for tenant members are revoked.
- Confirm audit/security events record the operation.

## Operations

- Run `python apps/api/scripts/production_preflight.py --backup-dir <backup-dir>`.
- Run ClamAV healthcheck.
- Run encrypted backup/restore drill with offsite copy.
- Run security event chain verification.
- Run retention cleanup dry-run.
- Confirm alert webhook receives signed high-severity test event.
- Run automated smoke check:

```powershell
python tools/staging_smoke_check.py --web-url <staging-web-url> --api-url <staging-api-url> --household-id <staging-household-id>
```

Do not use `--allow-demo` or `--allow-dev-cache` in staging/production.

## Sign-Off

Record:

- build id or commit
- staging API URL
- staging web URL
- smoke-test date
- operator
- failures found
- fixes applied
- final decision: block, retry, approve pilot, approve production
