# Domi Owner-only Living Bridge network probe contract

This file freezes the scope of the temporary preview-only probe.

- Branch: `domi-owner-live-precheck` only.
- Environment: Vercel `preview` only; production returns 404.
- Input: one hard-coded synthetic message only.
- Family data: forbidden.
- Holdouts: forbidden.
- Persistence: provider request uses `store: false`; route writes no database/state.
- Output surface: hashes, lengths, model/transport status, invariant fingerprint and truth ceilings only; provider prose is not returned.
- Authority wall: provider cannot choose the functional future or mutate identity, memory, obligations, lineage or actions.
- Functional future remains fixed outside the provider as `F-CAUTIOUS`.
- The invariant fingerprint is computed from the authority/decision contract and must remain stable across provider/transport swaps.
- Current preferred transport for this branch is direct OpenAI Responses API using a preview-scoped server-only `OPENAI_API_KEY`.
- Success means network/provider transport works. It does **not** demonstrate development, subjecthood, self-specificity or consciousness.
