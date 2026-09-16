# DOMI P5 — Bitácora Rectora + Cápsula + Exact Prompt Restart

DATE=2026-09-15
PROJECT=VANTDOMUS_DOMI
TRACK=PRODUCT_FIELD_BETA
BRANCH=domi-p5-cross-device-field-beta

## BITÁCORA RECTORA — APPEND-ONLY CHECKPOINT

PREVIOUS_CURRENT=P5_POST_BIDIRECTIONAL_PHYSICAL_E2E_PASS_BOUNDED
CURRENT=P5_REPEATABILITY_RELOAD_RECONNECT_BUILD_CERTIFIED_PHYSICAL_PENDING

PRIOR_PHYSICAL_FACTS_PRESERVED=TRUE
PC_TO_MOBILE_REAL_E2E_PASS=PASS_BOUNDED
MOBILE_TO_PC_REAL_E2E_PASS=PASS_BOUNDED
P5_BIDIRECTIONAL_PHYSICAL_CONTINUITY=PASS_BOUNDED

IMPLEMENTATION_COMMIT=2fe84edccaf11768d32dddcf26466ab288a3f2a8
IMPLEMENTATION_PARENT=f7a4a7e500a5d41b4e8f9af3abf2dd6bf17fa2bd

NEW_MODULE=apps/web/lib/domiP5ContinuityResumeArtifact.mjs
NEW_TEST=apps/web/tests/domi-p5-continuity-resume-artifact.test.mjs
NEW_ROUTE=/owner-alpha-continuity-resume

PERSISTENCE_MODEL=MINIMAL_GOVERNED_METADATA_ONLY
PERSIST_FULL_RECEIPT=FALSE
PERSIST_RAW_MEMORY=FALSE
PERSIST_RAW_TRANSCRIPT=FALSE
PERSIST_FULL_STATE=FALSE
PERSIST_AUTHORITY=FALSE
PERSIST_UNBOUNDED_CONTEXT=FALSE

RECONSTRUCTION_RULE=
Validate minimal artifact -> reseed deterministic synthetic fixture from code -> recreate original receipt -> require exact receiptDigest equality -> require exact continuityKey equality -> consume on independently opened target session.

FAIL_CLOSED_CLASSES=
ARTIFACT_MISSING,
ARTIFACT_CORRUPT,
ARTIFACT_EXPIRED,
WRONG_TARGET_SURFACE,
WRONG_SOURCE_SURFACE,
WRONG_CONTINUITY_KEY,
RAW_MEMORY_INJECTION,
RAW_TRANSCRIPT_INJECTION,
FULL_STATE_INJECTION,
AUTHORITY_INJECTION,
UNBOUNDED_CONTEXT_INJECTION,
UNEXPECTED_FIELD

GITHUB_CI_RUN=35049726437
GITHUB_CI_RESULT=SUCCESS
BUILD_PLUS_POSTBUILD=SUCCESS
P5_BOUNDED_GATE_RERUN=SUCCESS

NEW_RESUME_TESTS=13/13_PASS

VERCEL_PRIMARY_PANEL_DEPLOYMENT=dpl_AP9crw2EHkLMg28RHByL12G4aJci
VERCEL_PRIMARY_PANEL_RESULT=ERROR_EXTERNAL_PROJECT_CONFIGURATION
VERCEL_PRIMARY_PANEL_ERROR=Root Directory "vantdomus_panel" does not exist
INTERPRETATION_PRIMARY_PANEL=INFRASTRUCTURE_CONFIGURATION_ERROR_NOT_DOMI_CODE_FAILURE

FIELD_CARRIER_PROJECT=vantdomus-family-pilot
FIELD_CARRIER_DEPLOYMENT=dpl_2MGuyERRVJrAdvtFw2fvbcEs1eay
FIELD_CARRIER_STATE=READY
FIELD_CARRIER_COMMIT=2fe84edccaf11768d32dddcf26466ab288a3f2a8
FIELD_CARRIER_ROUTE=/owner-alpha-continuity-resume
FIELD_CARRIER_HTTP_VERIFICATION=200_OK

PHYSICAL_REPEATABILITY_OBSERVED=FALSE
PHYSICAL_RELOAD_RECONNECT_OBSERVED=FALSE
PHYSICAL_CLOSE_REOPEN_OBSERVED=FALSE

REPEATABILITY=BUILD_CERTIFIED_PHYSICAL_PENDING
RELOAD_RECONNECT=BUILD_CERTIFIED_PHYSICAL_PENDING
SESSION_REOPEN_RECOVERY=BUILD_CERTIFIED_PHYSICAL_PENDING

REAL_OWNER_MEMORY=NOT_STARTED
PRODUCTION_MUTATION=FALSE
SCIENTIFIC_ROOTS_MINTED=0
R4_EXECUTION_AUTHORIZATION=FALSE
EXTERNAL_OUTREACH_AUTHORIZATION=FALSE

NO_GO_AND_NEGATIVE_EVIDENCE_PRESERVED=TRUE
NO_GO_001=vantdomus-panel preview cannot be used because configured Root Directory vantdomus_panel is absent.
NO_GO_001_DOES_NOT_INVALIDATE=GitHub CI or vantdomus-family-pilot carrier.

CLAIM_CEILING=
This checkpoint establishes implementation and build certification for governed synthetic continuity recovery after reload/reopen. It does not establish physical repeatability, physical reload recovery, physical close/reopen recovery, universal compatibility, production readiness, real owner memory, autobiographical human memory, selfhood, subjecthood, consciousness, phenomenal experience, or general long-term agency.

## CÁPSULA DE REHIDRATACIÓN

PROJECT=VANTDOMUS_DOMI
DATE=2026-09-15
TRACK=PRODUCT_FIELD_BETA
CURRENT=P5_REPEATABILITY_RELOAD_RECONNECT_BUILD_CERTIFIED_PHYSICAL_PENDING
REPO=majofreasenjo-jpg/Vantdomus
BRANCH=domi-p5-cross-device-field-beta
IMPLEMENTATION_COMMIT=2fe84edccaf11768d32dddcf26466ab288a3f2a8
GITHUB_CI_RUN=35049726437
GITHUB_CI_RESULT=SUCCESS
FIELD_CARRIER_PROJECT=vantdomus-family-pilot
FIELD_CARRIER_DEPLOYMENT=dpl_2MGuyERRVJrAdvtFw2fvbcEs1eay
FIELD_CARRIER_STATE=READY
FIELD_ROUTE=/owner-alpha-continuity-resume

P5_BIDIRECTIONAL_PHYSICAL_CONTINUITY=PASS_BOUNDED
P5_REPEATABILITY_RELOAD_RECONNECT=BUILD_CERTIFIED_PHYSICAL_PENDING

Minimal governed resume artifact implemented. It persists only strict identifiers, commitments and timestamps. It does not persist the receipt, raw memory, raw transcript, full state, authority or unbounded context. On resume, the synthetic fixture is rebuilt from deterministic code and the recreated receipt must match the committed receipt digest and continuity key exactly before consumption.

13/13 new fail-closed tests PASS in Vercel build logs and full GitHub workflow SUCCESS.

The physical gate remains open. Do not promote PASS until the same real phone/desktop field workflow demonstrates:
1. same-pair repeatability;
2. page reload recovery with handoff removed;
3. full browser close/reopen recovery from the minimal artifact.

NEXT_AFTER_PHYSICAL_CLOSE=
WIFI_TO_MOBILE_DATA_SWITCH -> MOBILE_DATA_TO_WIFI_SWITCH -> SUPPORTED_BROWSER_OS_DEVICE_MATRIX -> FINAL_FIELD_BETA_ADJUDICATION -> DOMI_FIELD_BETA_READY

## EXACT PROMPT RESTART

RETOMA VANTDOMUS / DOMI EXACTAMENTE DESDE:
P5_REPEATABILITY_RELOAD_RECONNECT_BUILD_CERTIFIED_PHYSICAL_PENDING

Preserva como cerrados:
- PC_TO_MOBILE_REAL_E2E_PASS=PASS_BOUNDED
- MOBILE_TO_PC_REAL_E2E_PASS=PASS_BOUNDED
- P5_BIDIRECTIONAL_PHYSICAL_CONTINUITY=PASS_BOUNDED

No vuelvas a tratar la bidireccionalidad física previa como pendiente.

Implementation commit:
2fe84edccaf11768d32dddcf26466ab288a3f2a8

GitHub CI:
35049726437 = SUCCESS

Carrier:
vantdomus-family-pilot
dpl_2MGuyERRVJrAdvtFw2fvbcEs1eay = READY
Route=/owner-alpha-continuity-resume

El nuevo artifact de reanudación es allow-list-only y NO persiste:
RAW_MEMORY, RAW_TRANSCRIPT, FULL_STATE, AUTHORITY, UNBOUNDED_CONTEXT ni el receipt completo.

Para la prueba física:
A. abrir /owner-alpha-continuity-resume en PC;
B. crear una nueva prueba de repeatability y transportar al mismo teléfono;
C. consumir baseline en el teléfono y exigir P5-M-PRIVATE + P5-M-SHARED;
D. persistir artifact mínimo; confirmar handoff URL ausente;
E. recargar página; reconstruir y consumir sólo desde artifact;
F. cerrar completamente navegador; reabrir la URL limpia; reconstruir y consumir otra vez sólo desde artifact;
G. capturar device/surface, receiptId, receiptDigest, artifactDigest, continuityKey, artifact bytes, recovered refs y last error.

Sólo si la observación física es positiva declarar:
REPEATABILITY=PASS_BOUNDED
RELOAD_RECONNECT=PASS_BOUNDED
SESSION_REOPEN_RECOVERY=PASS_BOUNDED

Si cualquiera falla, preservar el fallo y no elevar el claim.

AVANCEMOS != R4_EXECUTION_AUTHORIZATION
AVANCEMOS != PRODUCTION_MUTATION_AUTHORIZATION
AVANCEMOS != EXTERNAL_CONTACT_AUTHORIZATION
AVANCEMOS != SCIENTIFIC_ROOT_MINTING_AUTHORIZATION

REAL_OWNER_MEMORY=NOT_STARTED
PRODUCTION_MUTATION=FALSE
SCIENTIFIC_ROOTS_MINTED=0

NEXT_GATE_AFTER_PHYSICAL_SUCCESS=WIFI_TO_MOBILE_DATA_SWITCH
