# Phase 3: educational purchasing agent

> Historical implementation record. The November 7 [audit](hackathon-audit.md), [submission checklist](submission-checklist.md) and [current multi-provider rehearsal guide](testnet-rehearsal.md) supersede old runtime, UI and readiness statements below. No live payment proof was added by the audit.

Implemented: three fictional providers, a persistent six-resource demo catalog, a curated four-area skill map, structured rule-based planning, immutable purchasing rules, atomic reservations, a server worker, actual SDK payment adapters, aggregate claim reconciliation, and conditional demo fulfillment.

No real course, exam voucher, or official certification syllabus is offered. All prices, original prices, discounts, resources, and fulfillment codes are demo data. The skill map is Pathwise's own learning aid, not an official or guaranteed exam-preparation syllabus.

## Try the simulation

From the repository root in PowerShell:

```powershell
npm.cmd install
npm.cmd run migrate
npm.cmd run dev
```

Stop older Vite/backend processes first if ports 5173/3001 are occupied. Open http://localhost:5173.

1. Save the default goal: AWS Certified Cloud Practitioner, no existing skills, all formats, total budget 30, per-purchase limit 10, exam reserve 10 (amounts in test XLM).
2. Scroll to **04 / Your educational purchasing agent**. Keep **Simulation - no funds, transactions, or access codes** selected.
3. Leave the three fictional providers checked. Click **Compare resources & build roadmap**.
4. The rule-based planner selects IAM essentials lab (6 test XLM) and Cloud foundations course (8), from two providers. It skips the overlapping refresher and overview; the 14-XLM practice exam exceeds the purchase cap, and the 9-XLM services lab does not fit after the selected commitments. Six learning XLM and the entire ten-XLM exam reserve remain uncommitted/protected.
5. Click **Approve simulation rules**, then **Start simulated agent**. Orders are reserved on the server before processing. Within a few seconds both show **simulated**. Their authorization and claim fields are explicitly simulated; there are no transaction hashes or access codes.
6. Reload the same tab to see persisted orders. Repeated starts do not create more orders. Closing the browser does not control accounting. If the backend stops, restart it to resume queued orders and reconciliation.
7. To explore another plan before approving, change existing skills, formats, provider approvals, or amounts, save, and preview again. Mark all four curated skill areas known to see **no suitable purchase**. Each mode's approved rules are immutable for that session, preventing a new saved plan from resetting the spending allowance. Use a new browser session for a separate simulation scenario.

Simulation does not require a Velo payment or a wallet; this exception exists only in the explicitly separate simulation mode. It cannot call Noir or satisfy Testnet acceptance.

## Actual Testnet mode

Use the Node version and wallet/Velo setup in [phase2-setup.md](phase2-setup.md). This machine still has Node 24.14.1, which Noir 0.3.0 does not support; live writes remain guarded until a supported release is installed. See [deployment-reference.md](deployment-reference.md) for the exact user-selected handbook contracts.

All three providers now have separate server-configured merchant accounts:

| Fictional provider | Environment secret (server only) | Public merchant |
| --- | --- | --- |
| CloudTrail Academy | NOIR_PROVIDER_SECRET | GDAPU6ZNAXXXLHVYKVMI5JFVKXW7FVZ4E5W2GMJQGJ5ARNFIEXZZML57 |
| Sandbox Grove | NOIR_PROVIDER_2_SECRET | GAJIVSGR6FEJEQL6YU6PUB37IR34WT5ZVWOAJYZRA5TJSF7MCHGXTJSR |
| Exam Lantern | NOIR_PROVIDER_3_SECRET | GA5WSOKXUGSN3U2UNRDGL6DVSPCWZRM5Q6UTAJTUOR5PPTRU5GXEWE5M |

Keys were generated into ignored root .env, preserving the existing agent/provider keys. All accounts were funded using Testnet Friendbot. The new funding transactions are [Sandbox Grove funding](https://stellar.expert/explorer/testnet/tx/6801c6a4ae91841316e25144ed07465e19de8377f5c52aaaa2a4adcdf104b269) and [Exam Lantern funding](https://stellar.expert/explorer/testnet/tx/d538192c0347e316817e5110acbc01b518150dffa5a300c6ad8bbc1d0b423b83). These are account-setup evidence, not resource purchases or claims. No owner key is stored by Pathwise.

For a fresh checkout, the existing helpers now handle all providers:

```powershell
npm.cmd run setup:testnet
npm.cmd run fund:testnet
```

1. Save the desired plan. Connect and verify the owner wallet and complete the associated Velo service checkout using the setup section. Wait for **active** service status. Use the same owner wallet for checkout.
2. In section 04 choose **Actual Stellar Testnet payments**. Select approved demo providers and build a roadmap.
3. Click **Approve Testnet purchasing rules once**. This requires a real verified wallet and service payment for that exact saved plan. It creates a virtual demo device and an authorization lasting one hour. A wallet can have only one Phase 3 Testnet grant; a wallet already used for a Phase 2 experiment is rejected to avoid mixing the old experiment's ledger and new budget. Review and reconcile the existing experiment before proceeding. Do not create another wallet or delete financial records to bypass limits.
4. In section 04 click **Register device**, **Register agent policy**, and **Fund learning escrow**, approving each actual Noir wallet signature. The deposit is total budget minus exam reserve (20 test XLM for defaults). Service fees and network fees are separate; the exam reserve stays outside escrow. Less than the deposit may be spent when suitable purchases run out. Owner operations use Noir SDK prepare/submit and validate the exact returned signed transaction, as in Phase 2.
5. After the three owner operations are confirmed and service is active, click **Start agent**. The server rechecks current owner/policy/asset, freezes and reserves eligible current catalog prices in one SQLite transaction, and returns queued orders. The worker uses checkPayment then authorizePayment with server-selected merchants/amounts. No per-resource owner click is needed.
6. Watch separate authorization, claim, and fulfillment fields. The provider claim is performed by the worker. Actual hashes link to Stellar Expert Testnet; a hash alone is not proof of confirmation. Codes remain locked until a successful transaction and matching aggregate claim event are reconciled.
7. Do not retry a transaction because the browser disconnects or an SDK call times out. The worker checks its stored hash first. Unknown outcomes retain the commitment and global Noir lock. Known failed authorizations release their budget but are not automatically reselected. A definitively failed claim may form a new claim attempt. Owner setup uncertainties use **Reconcile owner setup transactions**.

The earlier fixed-course Phase 2 controls are retained in a collapsed legacy section for compatibility. Do not use them to start the Phase 3 agent; the backend rejects legacy payment/claim calls for an agent-managed device.

## Planning/output boundary

The planner returns a versioned object with engine, skill gaps, selected/skipped catalog IDs, provider IDs, exact stroop prices, reasons, remaining learning funds, protected reserve, and outcome (purchases_planned or no_suitable_purchase). Resource comparison tries preferred formats first, then allows an explicitly explained alternative format when needed. It avoids paying for any overlapping known/selected/previously purchased coverage. The current algorithm is deterministic and understandable; it does not promise globally optimal resource allocation or exam readiness.

No LLM adapter or API key is configured or used. The reusable planner has a strict optional suggestion validator: IDs must exist and be unique; explanations must be nonempty strings with bounded length. Valid proposals can influence ordering/explanation only; all provider, price, coverage, and budget rules still apply. Tests reject invented IDs, duplicate IDs, and invalid explanations, and confirm that valid model suggestions cannot override purchase limits. The public browser endpoint accepts no model payment arguments. The honest rule-based path remains the active implementation.

## Reservation, duplicate and recovery rules

- Migration 3 adds catalog/providers, grants, orders, and claim batches without deleting existing plans or Phase 2 evidence. Seeding is repeatable; existing resource prices are preserved rather than reset on every boot. The SQLite catalog is authoritative for current prices.
- BEGIN IMMEDIATE covers reservation and the once-only started marker. Amounts are integer stroop strings summed with bigint, never SQLite floating-point SUM or JavaScript decimal arithmetic. Reserved, uncertain, authorized, claimed, fulfilled, and simulated orders remain commitments in their respective modes. Confirmed failed/blocked authorizations release their allocation.
- Each grant snapshots the owner, plan, provider addresses, limits, reserve, and expiry. Each wallet/mode has one grant, and each resource/owner/mode is unique. Simulation identities are isolated from real wallets. Changing a plan or browser order ID cannot reset the real wallet allowance.
- Worker checks provider approval/address, current price, total commitments, cap, expiry, service activation and on-chain policy again before a real transaction. Session middleware protects all agent endpoints, including catalog/status. Start accepts only an owned grant ID and ignores browser payment amounts/merchant addresses.
- The worker runs every 1.5 seconds on the server, independent of frontend polling. A durable shared Noir lock serializes agent/merchant operations with Phase 2 owner operations. Known transaction hashes are saved before SDK submission. Unknown results are reconciled before any new Noir submission; there is no automatic resend of a timed-out payment. Crash-before-hash cases require manual review and remain blocked rather than guessing.
- claim is aggregate per merchant/token. A batch records its member orders, exact amount, start ledger, hash, and status. The worker compares the dedicated merchant's pending balance to all known authorized orders and marks the batch claimed only after a successful transaction and an exact matching claim event. A merchant balance mismatch is held for reconciliation; it does not fabricate individual receipts or stall processing of other merchant batches.
- Authorization, claim, and fulfillment are stored independently. Sample demonstration codes appear only after verified real settlement; simulation never releases a code. No commercial access or voucher is claimed.
- RPC event history is bounded; loss of old event history, external payments to dedicated provider accounts, changed keys/deployment, and a crash before a hash can require manual intervention. Never clear a lock or delete orders merely to retry uncertain spending. No automatic escrow withdrawal UI is included; the SDK's documented safe unlink/recovery sequence remains necessary for unspent escrow.

## Verification

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint -w web
npm.cmd run migrate
```

Fourteen tests cover the earlier payment/session validations plus planner overlap/duplicates/format fallback, model output rejection, concurrent reservation through two SQLite connections, repeated starts, expiry, provider restrictions, price changes, overspending, reserve preservation, ambiguous authorization/claim recovery, and settlement-before-fulfillment. An HTTP test stops and starts two actual backend processes using the same temporary database and observes queued simulations finishing via the worker after restart, without browser requests driving payments. Synthetic Noir fixtures exercise the real local signing/hash/accounting code but are not live transaction evidence.

Local HTTP smoke verification also observed three configured provider accounts, six catalog resources, the expected two default selections, two reserved orders, 60000000 uncommitted stroops, and a protected 100000000-stroop reserve. Build/typecheck/API tests do not constitute browser visual verification.

Live acceptance remains pending: no Phase 3 agent authorization, merchant claim, or verified Velo service payment has been performed with a real owner wallet. Actual account funding is recorded separately above. Update phase2-evidence.md with real payment proof only after the wallet/credential setup is completed and those transactions succeed.

Final smoke result: the real backend worker completed two explicitly simulated orders in the local persistent database, with zero transaction hashes and zero access codes. The remaining learning allowance was 60000000 stroops and the protected reserve was 100000000 stroops. Final build, typecheck, lint, fourteen tests, and repeatable migration checks passed. This is code/local-simulation verification, not a live Noir or Velo payment acceptance result.
