# DOMI P5 Cross-Device Field Access — Pre-Physical Receipt

Date: 2026-09-15
Branch: `domi-p5-cross-device-field-beta`

## Bounded status

- `P5_CONTROLLED_TRANSPORT_HARNESS = PASS_3_OF_3` (pre-existing controlled transport evidence)
- `CROSS_DEVICE_FIELD_ACCESS_LAYER = IMPLEMENTED`
- `CROSS_DEVICE_REAL_WORLD = NOT_YET_ADJUDICATED`
- `DOMI_FIELD_BETA_READY = FALSE`
- `PRODUCTION_MUTATION = FALSE`
- `SCIENTIFIC_ROOTS_MINTED = 0`

## Field blocker isolated

The prior physical phone attempt did not establish a transport-envelope defect. The field route was served as a protected Vercel Preview. A browser session authorized on the desktop does not, by itself, establish access on a separate physical phone browser.

The field-beta implementation therefore separates two gates:

1. transport-envelope validity and independent governed consumption;
2. physical-destination access to the protected Preview route.

The second gate now fails closed unless a temporary Vercel share bridge is present over HTTPS.

## Added controls

- `domiP5CrossDeviceFieldAccess.mjs`
- dedicated field-access tests
- explicit `FIELD_ACCESS_READY` UI status
- handoff URL strips unrelated query parameters
- handoff URL preserves only the temporary `_vercel_share` bridge plus the synthetic `#handoff` payload
- missing bridge => `CROSS_DEVICE_FIELD_ACCESS_BRIDGE_REQUIRED`
- insecure transport => `CROSS_DEVICE_HTTPS_REQUIRED`

## Adjudication boundary

This receipt does **not** certify a real physical cross-device pass. A physical device observation remains required before any `CROSS_DEVICE_REAL_E2E_PASS` can be recorded.

A generic `AVANCEMOS` does not authorize production mutation, R4 one-shot execution, external outreach, or scientific-root minting.
