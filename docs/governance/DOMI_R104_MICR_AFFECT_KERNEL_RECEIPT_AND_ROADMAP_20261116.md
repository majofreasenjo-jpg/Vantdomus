# DOMI R104 — MICR affect receiver: verified offline kernel / canonical roadmap
Corte: 2026-11-16. Branch: `domi-r97-memory-safety-isolated-20261116`. SOURCE_TO_TARGET_CONTRACT / NO_CHAT_INTEGRATION / NO_DEPLOY / NO_SPEND.

## Source-to-target transfer receipt (experimental / incomplete)
- source_result_id: MICR-02A (2026-07-25), MICR-02M (2026-07-25), DFLD-5.4 historical executable (2026-08-24), MICR↔DOMI Bridge Charter 2026-09-03
- source_baseline: MICR-02A CANDIDATE_V0.1; MICR-02M FORMALIZED_RECORD_PLUS_ENGRAMMATIC_CANDIDATE; historical DFLD5.4 archiving and checksum R100.
- source_claim_ceiling: functional affect candidate, offline synthetic ablation only, no feelings/subjecthood/consciousness verified; MICR original AffectiveMemoryStack not verified.
- target_DOMI_object_or_organ: `apps/api/app/assistant/affective_runtime.py`, isolated from `/assistant/chat`, memory store and providers, target D03/D10.
- target_native_translation: frozen schema `AffectiveTrace`, `Requester`, `Candidate`; gated read-only relevance and ranking using `score = base + 0.30*w*signal` with use_affect toggle, restricted to authenticated caller-supplied requester, approved cases and explicit consent.
- load_bearing_dependency_set: verified source, consent, confirmation, provenance, same household, subject or authorized scoped access, temporal validity, no revocation, no import as lived, approved candidate. `Requester` **must** be created by trusted backend, never direct client input.
- falsifier: same output on affect-on/off = NULL_EFFECT; private or revoked content changes outcome = FAILURE; effect outside permissions = FAILURE; imported/inferred memory treated as lived = FAILURE; model claims subjective feeling = FAILURE.
- expected_effect: in matched synthetic scenario, score ranking changes when affect is enabled; matches no-affect base without trace; negative controls yield no effect.
- certificate_impact: offline R104 synthetic unit + historical privacy regressions PASS; receiver causal efficacy in family chat NOT VALIDATED.
- privacy_authority_impact: no DB/network/write; `SHARED_TV` restrict to household shared; no change to tool and role gates.
- rollback: revert isolated commits R104 / keep module disconnected; no production migration.
- adjudication: `NEW_TEST_REQUIRED` for actual recipient chat, MICR 02A full regulator, memory four layers, model-swap persistence, guardian authorized binding, concurrent sessions.
- feedback to MICR: test R104 changes ordering only for defined matched samples; null outcomes and unidentifiability remain explicit. No scientific credit to MICR.

## Four fronts
1. Documentary: reviewed MICR-02A, MICR-02M and Bridge Charter directly from Drive; donor DFLD5.4 already recovered R100. Original MICR_AFFECTIVE_SELF/AffectiveMemoryStack still unavailable as source.
2. Formal/implementation: typed frozen input, allowlist scores, never mutate memories/permissions, explicit post-filter state and no feeling claims.
3. Causal: test positive matching with fixed candidate set and A/B histories, affect-on/off ablation, null effect, unauthorized and expired/sham/no-consent controls.
4. Relational/privacy: positive same subject, different household denied, private on TV denied, guardian supervised only via explicitly supplied active set; current test is contract-level, not authenticated HTTP proof.

## CI executed
- Workflow: `DOMI R104 MICR affect isolated`
- Run: https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/44008054303
- Job `micr-affect-offline` = SUCCESS. Includes `tests/test_domi_r104_micr_affect_kernel.py`, `tests/test_domi_memory_privacy.py`, `tests/test_domi_memory_identity_http.py`.
- The workflow has external API flags off and no Anthropic key. No real external call, user-data action, live-model test, real emotion validation or physical device test.

## R101 gates
G0 inventory = PARTIAL / G1 original donante = PARTIAL / G2 receiver isolated = PASS_CONTRACT_ONLY / G3 causal synthetic = PASS_NARROW, family-chat PENDING / G4 longitudinal affect = OPEN / G5 integrated privacy = PARTIAL (contract tests, integration pending) / G6 owner physical pilot = OPEN.
Next priority is NOT creating new theory: link authenticated requester and existing `recall_for_context` output through an allowlisted affect contract, but **never** infer consent or traces from arbitrary free-text memories. Until MICR-02M persistence/revocation contract is implemented in the receptor DB, leave affective runtime disconnected from live chat and avoid production claims.

## 10 canonical axes (historical baseline unchanged)
D01 Personal 45% | D02 Familiar 45% | D03 Development 25% | D04 Federation 45% | D05 Multi-surface 45% | D06 Organizational 10% | D07 DOMI/EDIS 10% | D08 Legacy 10% | D09 Commercial 25% | D10 MICR Science 25%. Global historical 28.5%. These are not revised by a synthetic test.

## Exact prompt restart
Retoma DOMI R104 desde `DOMI_R104_MICR_AFFECT_KERNEL_RECEIPT_AND_ROADMAP_20261116.md` rama `domi-r97-memory-safety-isolated-20261116`. R104 CI run 44008054303 SUCCESS for isolated affect candidate kernel and original memory privacy; module NOT connected to family chat, no DB writes, no real provider/API. R103 Anthropic+voice offline CI run 44003613825 SUCCESS. Next close source-mapped R101 G1 MICR_AFFECTIVE_SELF/02M memory schema and authenticated recipient binding, then implement no-write test-only adapter using confirmed scoped memories and ablation; preserve negative NO_AFFECT. Keep UI conversation first; female historic host still not recovered. Report 10 axes and gates each cut. No merge/deploy or expenditure without OWNER approval.
