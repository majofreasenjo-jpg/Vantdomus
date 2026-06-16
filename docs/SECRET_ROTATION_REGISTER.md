# Secret Rotation Register

Keep one row per secret family. Do not store secret values here.

| Secret family | Storage location | Owner | Rotation cadence | Last rotated | Next rotation | Emergency trigger | Rotation procedure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| JWT signing secret | Secret manager path | Platform owner | 180 days | TBD | TBD | suspected token/signing exposure | deploy new secret, revoke sessions if needed |
| MFA encryption key ring | Secret manager path | Security owner | 180 days | TBD | TBD | key exposure or staff offboarding | set `VANTDOMUS_MFA_SECRET_KEYS=<new>,<old>`, run `rotate_mfa_secrets.py --apply`, remove retired key |
| Backup encryption key | Secret manager path | Operations owner | 365 days | TBD | TBD | backup exposure | create new key, generate fresh backup, retire old after retention window |
| Alert signing secret | Secret manager path | Security owner | 180 days | TBD | TBD | receiver/signature exposure | support old+new at receiver, update app secret, remove old |
| SMTP password/API key | Secret manager path | Operations owner | provider policy | TBD | TBD | mailbox/provider exposure | rotate in provider, update secret manager, send test email |
| Redis credentials | Secret manager path | Platform owner | provider policy | TBD | TBD | cache credential exposure | rotate provider password, update runtime, confirm rate limit |
| Database credentials | Secret manager path | Platform owner | provider policy | TBD | TBD | DB credential exposure | create new credential, deploy, revoke old |
| Gateway tokens | Database/API | Customer success owner | 90 days | TBD | TBD | partner token exposure | use gateway rotate-token endpoint |

## Rotation Evidence

For every rotation, record:

- date/time
- operator
- reason
- systems updated
- verification command
- customer impact
- incident id, if applicable
