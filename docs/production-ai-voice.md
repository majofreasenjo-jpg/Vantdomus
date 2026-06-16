# VantDomus AI, STT and TTS Production Setup

VantDomus uses a server-managed AI gateway. End users do not provide API keys in the normal product flow.

## Recommended Model

```text
User -> VantDomus Web/App -> VantDomus API -> AI/STT/TTS Provider
                                  |
                                  -> audit log, assistant action log, quotas, tenant policy
```

## Key Modes

- `platform`: VantDomus owns and pays for the provider key. Recommended default.
- `tenant_byok`: Enterprise-only. A tenant supplies its own key, stored in a secret manager and never exposed to the browser.

## Required Environment

```env
VANTDOMUS_AI_FEATURES_ENABLED=true
VANTDOMUS_AI_PROVIDER=openai
VANTDOMUS_AI_KEYS_MODE=platform
VANTDOMUS_SECRET_MANAGER=azure_key_vault
OPENAI_API_KEY=...
VANTDOMUS_STT_MODEL=gpt-4o-mini-transcribe
VANTDOMUS_TTS_MODEL=gpt-4o-mini-tts
VANTDOMUS_TTS_VOICE=alloy
VANTDOMUS_AUDIO_MAX_BYTES=26214400
```

For local development, `VANTDOMUS_SECRET_MANAGER=env` and `apps/api/.env.local` are accepted.

For staging/production, use a real secret manager:

- Azure Key Vault
- AWS Secrets Manager
- GCP Secret Manager
- Doppler
- 1Password Secrets Automation

## Tenant Controls

Production should enforce:

- per-tenant quotas for audio minutes, TTS characters and LLM tokens
- per-user role permission for audio upload and agent execution
- audit records for every transcription and generated voice
- signed/private storage for audio files
- retention policy for audio and transcripts
- malware scan before processing uploaded files

## Current Implementation

- `POST /audio/transcribe`: uploads audio, scans file, calls STT provider, writes audit and assistant action logs.
- `POST /audio/speech`: generates natural speech, writes audit and assistant action logs.
- `GET /audio/status`: shows provider readiness without leaking secrets.
- `POST /coupling/webhook/{gateway_id}`: accepts `transcript`, `audio_transcript` or `speech_text` from WhatsApp/Teams/Drive connectors.

## WhatsApp and Teams Audio

Do not let the backend download arbitrary media URLs in production.

Use provider-specific connectors:

- WhatsApp Cloud API media download with verified app token and allowed Meta host.
- Microsoft Graph for Teams audio/files with tenant consent.
- Google Drive API with scoped OAuth and Drive file id validation.

Each connector should pass the downloaded audio into `/audio/transcribe` or pass the trusted transcript into the coupling webhook.
