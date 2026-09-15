# P5 mobile to PC field-beta status

Date: 2026-09-15

Completed in software:
- dedicated mobile-to-desktop return helper
- dedicated return UI route `/owner-alpha-cross-device-return`
- return receipt targets `PERSONAL_DESKTOP`
- raw memory and raw transcript remain excluded
- deterministic return tests added
- field-beta certification workflow extended
- GitHub Actions run 35015829591 completed successfully for the return gate

Current branch tree includes the return helper, return UI, tests, certification workflow, and this status record.

Current boundary:
- software gate: PASS
- physical PC -> Android: PASS_BOUNDED
- physical Android -> PC: pending
- DOMI field beta ready: not yet declared

Physical return protocol:
1. authorize the same protected Preview deployment in both the phone browser and computer browser;
2. on the phone open `/owner-alpha-cross-device-return`;
3. create the synthetic return receipt;
4. transfer the generated handoff link to the already-authorized computer browser;
5. consume the receipt on the computer;
6. require expected synthetic references and no error before adjudicating PASS.

No production mutation. No real owner-memory test. No external outreach authorization.
