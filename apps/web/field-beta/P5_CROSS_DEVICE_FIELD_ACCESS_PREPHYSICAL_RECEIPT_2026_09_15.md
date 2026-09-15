# DOMI P5 Cross-Device Field Access — Pre-Physical Receipt

Date: 2026-09-15
Branch: `domi-p5-cross-device-field-beta`

## Bounded status

- `P5_CONTROLLED_TRANSPORT_HARNESS = PASS_3_OF_3` (pre-existing controlled transport evidence)
- `CROSS_DEVICE_FIELD_ACCESS_LAYER = IMPLEMENTED_V0_2`
- `CROSS_DEVICE_REAL_WORLD = NOT_YET_ADJUDICATED`
- `CROSS_DEVICE_REAL_E2E_PASS = NOT_YET_DECLARED`
- `DOMI_FIELD_BETA_READY = FALSE`
- `PRODUCTION_MUTATION = FALSE`
- `SCIENTIFIC_ROOTS_MINTED = 0`

## Physical observation preserved

The desktop observation from the protected Vercel Preview is preserved as negative field evidence:

- `DESKTOP_PROTECTED_PREVIEW_ENTRY = PASS`
- `HTTPS = PASS`
- `APP_VISIBLE_SHARE_BRIDGE = MISSING`
- `FIELD_ACCESS_READY = PENDING`
- `FAIL_CLOSED = PASS`
- `OBSERVED_ERROR = CROSS_DEVICE_FIELD_ACCESS_BRIDGE_REQUIRED`
- `ROOT_CAUSE = VERCEL_UPSTREAM_SHARE_PARAMETER_CONSUMPTION`
- `RECEIPT_FAILURE = FALSE`

The prior physical phone attempt did not establish a transport-envelope defect. The field route was served as a protected Vercel Preview. Vercel may consume the temporary `_vercel_share` parameter while authorizing the desktop Preview before application code can inspect the final browser URL. A browser session authorized on the desktop also does not, by itself, establish access on a separate physical phone browser.

## V0_2 field-access correction

The field-beta implementation now separates three layers:

1. transport-envelope validity and independent governed consumption;
2. physical-destination access to the protected Preview route;
3. explicit recovery of the temporary Vercel share bridge when the upstream authorization layer has removed it from the application-visible URL.

Added control:

- `MANUAL_TEMPORARY_SHARE_BRIDGE_CAPTURE = IMPLEMENTED_IN_MEMORY_ONLY`

The desktop source UI accepts either the original temporary Vercel share URL or the raw temporary bridge. The value is held only in React state for the current tab. The implementation does not write it to localStorage, cookies, repository state, receipts, diagnostic text, or scientific records.

The field status exposes only `PRESENT/MISSING`. The generated handoff URL is no longer printed on screen; it is available only through copy/share controls.

## Fail-closed controls

- `domiP5CrossDeviceFieldAccess.mjs` version `DOMI_P5_CROSS_DEVICE_FIELD_ACCESS_V0_2`
- explicit full temporary Vercel URL accepted
- explicit raw bridge accepted
- malformed bridge rejected
- Vercel URL without `_vercel_share` rejected
- unrelated query parameters stripped from the handoff URL
- handoff preserves only the temporary `_vercel_share` bridge plus the synthetic `#handoff` payload
- missing bridge => `CROSS_DEVICE_FIELD_ACCESS_BRIDGE_REQUIRED`
- insecure transport => `CROSS_DEVICE_HTTPS_REQUIRED`
- no bridge/token value is emitted by diagnostics

## Adjudication boundary

This receipt does **not** certify a real physical cross-device pass. A new physical device observation remains required before any `CROSS_DEVICE_REAL_E2E_PASS` can be recorded.

A generic `AVANCEMOS` authorizes continued safe preparation/build verification only. It does not authorize production mutation, R4 one-shot execution, external outreach, or scientific-root minting.

## Rehydration capsule

```text
PROJECT=VANTDOMUS_DOMI_P5
CURRENT=P5_CROSS_DEVICE_FIELD_ACCESS_V0_2_PREPHYSICAL
BRANCH=domi-p5-cross-device-field-beta

P5_CONTROLLED_TRANSPORT_HARNESS=PASS_3_OF_3
DESKTOP_PROTECTED_PREVIEW_ENTRY=PASS
HTTPS=PASS
APP_VISIBLE_SHARE_BRIDGE=MISSING
FIELD_ACCESS_READY=PENDING
FAIL_CLOSED=PASS
ROOT_CAUSE=VERCEL_UPSTREAM_SHARE_PARAMETER_CONSUMPTION
RECEIPT_FAILURE=FALSE

MANUAL_TEMPORARY_SHARE_BRIDGE_CAPTURE=IMPLEMENTED_IN_MEMORY_ONLY
TOKEN_DIAGNOSTIC_DISCLOSURE=FALSE
TOKEN_PERSISTENCE=FALSE
UNRELATED_QUERY_PROPAGATION=FALSE

CROSS_DEVICE_REAL_WORLD=NOT_YET_ADJUDICATED
CROSS_DEVICE_REAL_E2E_PASS=NOT_YET_DECLARED
DOMI_FIELD_BETA_READY=FALSE
PRODUCTION_MUTATION=FALSE
SCIENTIFIC_ROOTS_MINTED=0

NEXT=BUILD_CI_AND_PREVIEW_DEPLOYMENT_READBACK_THEN_ONE_NEW_PHYSICAL_PHONE_TEST
```

## Exact prompt restart

```text
Retomar VANTDOMUS / DOMI P5 desde CROSS_DEVICE_FIELD_ACCESS_V0_2_PREPHYSICAL en la rama domi-p5-cross-device-field-beta.

Preservar como evidencia negativa el intento físico anterior: DESKTOP_PROTECTED_PREVIEW_ENTRY=PASS, HTTPS=PASS, APP_VISIBLE_SHARE_BRIDGE=MISSING, FIELD_ACCESS_READY=PENDING, FAIL_CLOSED=PASS, ROOT_CAUSE=VERCEL_UPSTREAM_SHARE_PARAMETER_CONSUMPTION, RECEIPT_FAILURE=FALSE.

La corrección V0_2 permite pegar en el computador el enlace temporal original de Vercel o su bridge; debe permanecer sólo en memoria de la pestaña, sin persistencia ni diagnóstico del token. El handoff debe conservar únicamente _vercel_share + #handoff sintético.

Verificar tests/build/Preview antes de pedir una nueva prueba física. No declarar CROSS_DEVICE_REAL_E2E_PASS hasta observar consumo válido en un teléfono físico distinto.

Mantener PRODUCTION_MUTATION=FALSE y SCIENTIFIC_ROOTS_MINTED=0. AVANCEMOS no autoriza producción, one-shot científico ni minting.
```
