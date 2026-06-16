# Launch Sign-Off Checklist

Use this checklist to approve staging pilots and production launches.

## Environment

- [ ] Web HTTPS URL configured.
- [ ] API HTTPS URL configured.
- [ ] `VANTDOMUS_ALLOWED_HOSTS` contains only approved hosts.
- [ ] `CORS_ALLOWED_ORIGINS` contains only approved web origins.
- [ ] Redis is reachable from API runtime.
- [ ] ClamAV is reachable from API runtime.
- [ ] SMTP is reachable and sends verification/reset emails.
- [ ] Public uploads remain disabled.
- [ ] Demo seed endpoints remain disabled.
- [ ] Notification test endpoints remain disabled.

## Secrets

- [ ] Secrets are stored in a managed secret store.
- [ ] No production secret is committed to repo, docs, tickets or screenshots.
- [ ] `python tools/secret_scan.py` returns zero findings.
- [ ] JWT secret rotation procedure is documented.
- [ ] MFA key rotation procedure is tested.
- [ ] Alert signing secret rotation procedure is tested.
- [ ] Redis/database/SMTP credentials have owners and rotation cadence.

## Identity

- [ ] Initial admin account exists.
- [ ] Admin email is verified.
- [ ] Admin MFA is enabled.
- [ ] Password reset email works.
- [ ] Logout revokes server session.
- [ ] Sensitive actions require verified email.
- [ ] Production web has no `NEXT_PUBLIC_ACCESS_TOKEN`.
- [ ] Production web has no `NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID`.

## Monitoring

- [ ] Alert webhook receives signed events.
- [ ] Receiver verifies `X-VantDomus-Signature`.
- [ ] ClamAV healthcheck is scheduled.
- [ ] Backup drill is scheduled.
- [ ] Security event chain verification is scheduled.
- [ ] Retention cleanup dry-run is scheduled.
- [ ] Production preflight is scheduled.
- [ ] On-call channel and escalation owner are defined.

## Backup And Restore

- [ ] Encrypted backup exists.
- [ ] Manifest exists.
- [ ] Manifest SHA-256 matches backup artifact.
- [ ] Offsite copy exists.
- [ ] Restore drill succeeds.
- [ ] Required tables exist after restore.
- [ ] RPO/RTO are documented.
- [ ] Backup retention window is approved.

## Legal And Customer Commitments

- [ ] Privacy Policy approved.
- [ ] Terms of Service approved.
- [ ] DPA/data handling addendum approved.
- [ ] Retention/deletion policy approved.
- [ ] Incident notification policy approved.
- [ ] Subprocessor list approved.
- [ ] Support access policy approved.
- [ ] Customer contract references privacy, deletion, backup and incident terms.

## Pre-Customer Tests

- [ ] `python tools/security_gate.py` passes.
- [ ] `python apps/api/scripts/production_preflight.py --backup-dir <dir>` passes without `--skip-network`.
- [ ] `python tools/production_readiness_report.py --api-env <file> --web-env <file> --backup-dir <dir>` passes.
- [ ] `python tools/staging_smoke_check.py --web-url <url> --api-url <url> --household-id <id>` passes.
- [ ] Two-tenant isolation smoke test completed.
- [ ] Export workflow completed.
- [ ] Contractual delete workflow completed against test tenant.
- [ ] Evidence package export completed.

## Decision

- Environment: staging / production
- Build or commit:
- Date:
- Operator:
- Reviewer:
- Decision: blocked / retry / approved pilot / approved production
- Residual risks:
- Next review date:
