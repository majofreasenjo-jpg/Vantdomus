# DOMI P5 — Mobile to PC Physical E2E Final Adjudication

Date: 2026-09-15
Branch: `domi-p5-cross-device-field-beta`

## Evidence basis

Owner-provided physical mobile screenshot plus destination-PC result text from the isolated alternate-environment carrier.

### Physical mobile source observed

- surface: `Linux armv81 · 411x717`
- origin: `PERSONAL_MOBILE`
- destination: `PERSONAL_DESKTOP`
- `Raw memory: false`
- `Raw transcript: false`
- `Full state: false`
- mobile source generated a return handoff for the PC destination

### Physical PC destination observed

- surface: `Win32 · 1528x732`
- `Payload recibido: sí`
- `Origen declarado: PERSONAL_MOBILE`
- `Destino declarado: PERSONAL_DESKTOP`
- `Raw memory transportada: false`
- `Raw transcript transportada: false`
- destination session: `P5-DESKTOP-RETURN-CARRIER-1`
- recovered synthetic references: `P5-M-PRIVATE, P5-M-SHARED`
- continuity key: `fnv1a32:2b7f23b7`
- application result: `P5 MOBILE → PC: resultado esperado observado en destino.`
- last state: `ninguno`

## Final bounded adjudication

`P5_MOBILE_SOURCE_REACHED = PASS_BOUNDED`

`P5_MOBILE_RETURN_RECEIPT_CREATED = PASS_BOUNDED`

`P5_PC_DESTINATION_REACHED = PASS_BOUNDED`

`P5_PC_RECEIPT_VALIDATED = PASS_BOUNDED`

`P5_PC_RECEIPT_CONSUMED = PASS_BOUNDED`

`P5_PC_INDEPENDENT_SYNTHETIC_RECONSTRUCTION = PASS_BOUNDED`

`P5_EXPECTED_SYNTHETIC_REFERENCES_RECOVERED = PASS_BOUNDED`

`P5_RAW_MEMORY_TRANSPORTED = FALSE`

`P5_RAW_TRANSCRIPT_TRANSPORTED = FALSE`

`P5_FULL_STATE_TRANSPORTED = FALSE`

`P5_LAST_ERROR = NONE`

`MOBILE_TO_PC_REAL_E2E_PASS = PASS_BOUNDED`

## Bidirectional field status

Prior physical field evidence already established:

`PC_TO_MOBILE_REAL_E2E_PASS = PASS_BOUNDED`

This receipt establishes:

`MOBILE_TO_PC_REAL_E2E_PASS = PASS_BOUNDED`

Therefore, for the demonstrated physical surfaces only:

`P5_BIDIRECTIONAL_PHYSICAL_CONTINUITY = PASS_BOUNDED`

The two demonstrated surfaces are:

- desktop: Windows browser (`Win32`)
- mobile: Android browser (`Linux armv81`)

## Alternate-environment significance

The mobile-to-PC field trial was executed using an isolated alternate deployment carrier because Vercel preview builds were temporarily blocked by a Hobby-plan build-rate limit. The alternate carrier is not production and is not itself scientific evidence beyond the bounded software transport behavior demonstrated here.

This trial does show that the bounded P5 synthetic receipt mechanism can be exercised outside the original Vercel preview path.

`ALTERNATE_ENVIRONMENT_FIELD_CARRIER = PASS_BOUNDED`

## Claim ceiling

This receipt certifies only bounded synthetic software continuity for the demonstrated PC <-> physical Android routes and environments.

It does NOT establish:

- universal device compatibility;
- universal browser compatibility;
- production readiness;
- real owner-memory continuity;
- human autobiographical memory;
- subjecthood;
- selfhood;
- consciousness;
- phenomenal experience;
- general long-term agency.

`REAL_OWNER_MEMORY = NOT_STARTED`

`DOMI_FIELD_BETA_READY = NOT_YET_DECLARED`

`PRODUCTION_MUTATION = FALSE`

`SCIENTIFIC_ROOTS_MINTED = 0`

## Roadmap consequence

The bidirectional physical continuity blocker is now closed for the demonstrated pair.

Remaining FIELD BETA gates:

1. same-pair repeatability;
2. reconnect after reload;
3. close/reopen session recovery;
4. network switch Wi-Fi <-> mobile data;
5. explicit supported browser/OS/device matrix;
6. field-beta final adjudication.

Commercial preparation may continue in parallel. External outreach remains separately gated and is not authorized by this receipt.

## Rehydration capsule

```text
PROJECT=VANTDOMUS_DOMI
TRACK=PRODUCT_FIELD_BETA
CURRENT=P5_POST_BIDIRECTIONAL_PHYSICAL_E2E_PASS_BOUNDED
DATE=2026-09-15
BRANCH=domi-p5-cross-device-field-beta

PC_TO_MOBILE_REAL_E2E_PASS=PASS_BOUNDED
MOBILE_TO_PC_REAL_E2E_PASS=PASS_BOUNDED
P5_BIDIRECTIONAL_PHYSICAL_CONTINUITY=PASS_BOUNDED

DESKTOP_SURFACE=WIN32_BROWSER_1528x732
MOBILE_SURFACE=ANDROID_BROWSER_LINUX_ARMV81_411x717

EXPECTED_SYNTHETIC_REFERENCES=P5-M-PRIVATE,P5-M-SHARED
CONTINUITY_KEY=fnv1a32:2b7f23b7
RAW_MEMORY_TRANSPORTED=FALSE
RAW_TRANSCRIPT_TRANSPORTED=FALSE
FULL_STATE_TRANSPORTED=FALSE
LAST_ERROR=NONE

ALTERNATE_ENVIRONMENT_FIELD_CARRIER=PASS_BOUNDED
VERCEL_PREVIEW_BLOCKER=BUILD_RATE_LIMIT_EXTERNAL

REAL_OWNER_MEMORY=NOT_STARTED
DOMI_FIELD_BETA_READY=NOT_YET_DECLARED
PRODUCTION_MUTATION=FALSE
SCIENTIFIC_ROOTS_MINTED=0

NEXT=REPEATABILITY_RELOAD_RECONNECT_SESSION_REOPEN_NETWORK_SWITCH_SUPPORTED_MATRIX
COMMERCIAL_PREPARATION=CONTINUE_IN_PARALLEL
EXTERNAL_OUTREACH=NOT_AUTHORIZED_BY_THIS_RECEIPT
```

## Exact prompt restart

```text
Retomar VANTDOMUS / DOMI desde P5_POST_BIDIRECTIONAL_PHYSICAL_E2E_PASS_BOUNDED.

Ya existe evidencia física PASS_BOUNDED en ambos sentidos:
PC -> Android físico y Android físico -> PC.

El retorno móvil -> PC se ejecutó en un carrier alternativo aislado porque Vercel estaba temporalmente bloqueado por build-rate-limit. El PC recibió y consumió el receipt, recuperó P5-M-PRIVATE y P5-M-SHARED, continuity key fnv1a32:2b7f23b7, sin raw memory, raw transcript ni full state y sin error.

No volver a tratar la bidireccionalidad física como pendiente para este par demostrado.

Continuar FIELD BETA por:
repeatability -> reload/reconnect -> close/reopen session -> Wi-Fi/mobile-data switch -> explicit browser/OS/device supported matrix -> final DOMI_FIELD_BETA_READY adjudication.

Mantener R4 científico separado. Mantener preparación comercial en paralelo. AVANCEMOS no autoriza contacto externo, producción, roots científicos ni one-shot R4.
```
