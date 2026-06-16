# Role Matrix

This matrix defines the current household-level permissions enforced by the API.

## Roles

- `viewer`: read-only operational visibility.
- `member`: daily operations and evidence capture.
- `admin`: configuration, audit, integrations and controlled export.
- `owner`: contractual deletion and all lower-role actions.

## Permissions

| Capability | viewer | member | admin | owner |
| --- | --- | --- | --- | --- |
| View dashboard, tasks, alerts, scores and logbook | yes | yes | yes | yes |
| Create tasks, persons, expenses, health check-ins and logbook entries | no | yes | yes | yes |
| Seed demo data for a household | no | no | no | yes |
| View audit events, security events and assistant action logs | no | no | yes | yes |
| List household members | no | no | yes | yes |
| Add/remove viewer/member/admin users | no | no | yes | yes |
| Add/remove/demote owners | no | no | no | yes |
| Create/revoke viewer/member/admin invitations | no | no | yes | yes |
| Create/revoke owner invitations | no | no | no | yes |
| Create/revoke signed evidence links | no | no | yes | yes |
| Manage coupling gateways and rotate gateway tokens | no | no | yes | yes |
| Export household customer data | no | no | yes | yes |
| Delete household customer data | no | no | no | yes |

## Security Notes

- Cross-tenant access is denied before endpoint-specific behavior runs.
- `person_id` and `assigned_person_id` references must belong to the same household.
- The last owner cannot be removed or demoted.
- Membership changes are audited with `add_member`, `update_member_role` and `remove_member`.
- Invitations store only SHA-256 token hashes; raw invitation tokens are shown once at creation.
- Invitation changes are audited with `create_invitation`, `accept_invitation` and `revoke_invitation`.
- Customer data export redacts auth tokens, push tokens, signed-link hashes and private server file paths.
- Contractual deletion requires `confirm=DELETE` and writes a final audit event.

## Verification

The role matrix is covered by:

```powershell
C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m pytest tests\security\test_tenant_isolation.py -q --basetemp C:\tmp\pytest -p no:cacheprovider
```
