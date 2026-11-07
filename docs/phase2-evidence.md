# Phase 2 evidence

> Historical snapshot. For the current GitHub-based verification and outstanding evidence, use [submission-readiness.md](submission-readiness.md) and [submission-checklist.md](submission-checklist.md). Older counts, missing-repository statements and local setup results below describe their original inspection only.

> Historical implementation record. The November 7 [audit](hackathon-audit.md), [submission checklist](submission-checklist.md) and [current multi-provider rehearsal guide](testnet-rehearsal.md) supersede old runtime, UI and readiness statements below. No live payment proof was added by the audit.

Status: **live payment acceptance not achieved**. Genuine authorization + claim and verified Velo service payment remain pending user wallet actions/credentials. This file records only evidence actually obtained.

## Real read-only integration

See [testnet-probe.json](testnet-probe.json). The installed Noir SDK 0.3.0 successfully read owner, policy, and escrow state against the exact handbook-selected deployment. This is not a purchase transaction.

## Actual Testnet account setup

Dedicated agent account: GAQO6XBXVVQOAYGG5AVUDS65TWVC22CWRSONHMBIUPDQY5SFXM6R7MPW

Dedicated demo-provider account: GDAPU6ZNAXXXLHVYKVMI5JFVKXW7FVZ4E5W2GMJQGJ5ARNFIEXZZML57

Both were created/funded by Friendbot during this phase. Actual funding transactions:

- [Agent Friendbot funding](https://stellar.expert/explorer/testnet/tx/c4ae3aafc6e29e781a1cdd2a735f3af6e97e4b0a24a1262157fc990c36118f16)
- [Demo-provider Friendbot funding](https://stellar.expert/explorer/testnet/tx/dd1d271b154465e269a77b9ceca7bab1757b2fd4c5efda9e432d694c3d9db288)

These are network-funded account setup transactions, not agent-made resource payments or provider claims. The server keys are in ignored root .env and are not included here.

## Code verification

- TypeScript checks pass for backend/frontend.
- Build and lint checks pass (final rerun recorded in task report).
- Deterministic tests cover real wallet challenge signature validation, replay/foreign-session/wrong-signer rejection, raw signed webhook parsing, stale/invalid signature rejection, foreign project/intent/amount/asset rejection, duplicate envelopes with changed sentAt, delayed/out-of-order event processing, synthetic test-event exclusion, stable checkout recovery keys, no activation from API status alone, fixed server-selected spending arguments, setup-before-payment checks, duplicate deposit/run prevention, aggregate mismatch refusal, and recovery of uncertain authorizations/claims without resubmission.
- Synthetic integration hashes exist only in temporary test databases. They are not live evidence and are never copied into this report.
- Tests/build currently run on Node 24.14.1, below Noir's declared supported runtime. The app blocks Noir writes on that runtime. Upgrade and rerun checks before live rehearsal.

## Pending acceptance records

| Requirement | Observed result |
| --- | --- |
| Owner wallet challenge verified in actual Noir extension | Not exercised |
| Owner device/policy/funding transactions | Not submitted |
| Noir agent authorizePayment | Not submitted |
| Reconciled aggregate provider claim | Not submitted |
| Velo service checkout created with real credentials | Not created |
| Signed real Velo success event + paid API status + Testnet ledger verification | Not received |
| Real service activation | Inactive |

See [phase2-setup.md](phase2-setup.md) for exact user steps. No owner secret keys or Velo credentials were supplied, and no fake successful transaction was used to satisfy acceptance.

## Final local status check

Build, frontend lint, backend/frontend typecheck, all nine tests, and two consecutive migration runs passed. The authenticated setup endpoint was also exercised with the actual local environment: the only Noir server blocker is Node 24.14.1; Velo reports the missing general API key, project ID, and signing secret. No wallet, checkout, or experiment was present. The backend health check returned SQLite OK. A pre-existing process occupied port 3001, so this smoke check used temporary port 3002 without changing the saved environment; the process started for the check was stopped. Browser wallet prompts and browser visual layout were not exercised.
