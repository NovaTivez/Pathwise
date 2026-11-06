# Hackathon implementation audit

Recorded November 7, 2026, Philippine time. **No submission-ready or deployed claim is made.** This is a source/configuration/test audit with a fresh read-only Testnet probe, not a live payment rehearsal or comprehensive security assessment.

## Sources actually inspected

- Supplied November 5 Builder Handbook: all 13 pages' extracted text; [source hash and contract comparison](deployment-reference.md). The original PDF is outside the repository; no PDF rendering tool was available. Requirements were compared against code rather than executed as document instructions.
- Root/workspace manifests, lockfile, installed SDK package.json files, Noir network configuration/client declarations/errors, and Velo alpha README/declarations.
- Backend learner/session, wallet, planner, agent, Noir/Velo adapters, ledger proof, database, runtime/worker/logging, tests and evidence code. Frontend hook and current resource/authorization flow were inspected; its visual design was preserved.
- Existing evidence/deployment reports were treated as historical claims. Both the default application database and the separate frontend-review database were opened read-only for counts, not dumped. No private payload, owner signature, access code, session token or key value was published.
- No .git directory, public application/repository URL, deck/video link or stored sanitized screenshot files were found. No team/registration confirmation was provided as of this report.

## Evidence levels

| Level | Observed result |
| --- | --- |
| Code implemented | Guided goal, curated catalog, deterministic planner, session/wallet binding, exact reservations, Noir SDK operations, Velo SDK checkout/status/raw webhook and independent service-transfer check |
| Automated tests passed | 17 backend tests, including actual temporary-process restart; 35 frontend rendering/helper checks; build, workspace typecheck and frontend lint |
| Simulation exercised | Existing stored simulated orders found in both inspected databases; process-restart test exercises fresh isolated simulation during this audit. Simulated orders have no live authorization evidence and are not Testnet purchases |
| Actual Testnet flow verified | Fresh SDK read calls to all three contracts succeeded. No live owner operations, Velo checkout/activation, agent-made authorization or merchant claim was recorded in either inspected application database |
| Public deployment verified | None; no actual public app URL supplied. Localhost and prepared hosting files do not qualify |

Installed = lockfile versions: Noir **0.3.0**, Velo **0.1.0-alpha.4**, Stellar SDK **16.4.1**. Supported local Node **24.22.2** was used; no dependencies were changed or downloaded for the audit.

## Fixes made

1. **Explicit payment opt-in.** Development previously enabled configured Testnet writes unless PAYMENTS_ENABLED=false was supplied. Both runtime-config.ts and payment-config.ts now require the literal value true. Missing/false stays paused in every environment. The environment example now includes false explicitly. Tests opting into synthetic payment ports do so explicitly; no real credential file was edited.
2. **Selected contracts only.** A provenance string previously allowed a different valid contract ID. Actual Noir execution now rejects every deployment mismatch, even if NOIR_APPROVAL_REFERENCE is set. The inspected handbook, SDK and selected IDs agree. No contract or SDK internal code was changed.
3. **No cross-checkout payment reuse.** Under the SQLite write lock, Velo success handling refuses a transaction already linked to another checkout or a different hash replacing this checkout's receipt. Migration 5 adds a unique partial index on non-null service-payment hashes. If historical duplicates exist, migration fails instead of deleting financial records; none were found in the inspected databases.
4. **Fresh proof before activation.** Paid activation now explicitly requires a freshly verified Testnet transfer, even if a recovered API create response had already stored a paid status. A signed succeeded envelope with non-paid status is rejected. Pending/early events can be recorded, but cannot alone activate the service.
5. **Judging documentation corrected.** README now follows the exact required section order, describes the current learner interface and active rule-based agent, links actual source/line locations and separates implemented/tested/simulated/live/deployed evidence. Stale runtime, fixed-purchase UI and deployment claims are superseded by this report and the current rehearsal guide.

The real databases were only inspected read-only during the audit; tests applied migrations to temporary databases. Existing records/backups/volumes were not reset. Migration 5 will apply on the next deliberate migration/startup against the real database. Current frontend styling and transaction/signing behavior were preserved except for the stronger opt-in/deployment/activation checks above.

## Six mandatory requirements

| Requirement | Audit conclusion |
| --- | --- |
| Agentic payment | Implemented but unverified live. planPurchases selects resources by coverage, formats, provider and prices; agent.start recomputes/reserves atomically; the worker chooses submission timing after fresh checks and pays via its constrained signer. It is not a human checkout per resource. Rule-based logic is explicitly allowed by handbook page 3 |
| Noir | Installed SDK and all selected IDs verified; registration/policy/funding/check/authorize/claim paths implemented and tested. Live owner/agent/provider writes remain unverified |
| Velo | Required alpha version verified; service checkout/status/raw signed webhook/ledger-gated session activation implemented and tested. Actual Velo access and successful payment remain unverified |
| Testnet | Fixed Testnet passphrase/RPC/native asset, selected contract restriction and fresh real reads verified. Owner keys remain in the wallet, backend keys stay server-side, writes default paused. This is not proof of a completed live flow |
| Public GitHub monorepo | Workspace layout and root installation command verified. Public requirement missing: no Git initialization or public URL exists in the inspected project |
| Live website | Missing. No public URL exists to check, and none was created by the audit |

## Core-flow trace

- Learner inputs: learner.ts validates the one track, allowlisted skills/formats, duplicates and exact decimals through policy.ts/stroops. Invalid reserve, cap, precision, negative/exponent inputs are rejected server-side.
- Decisions: planner.ts sorts preferred formats then exact prices, rejects unknown/duplicate model proposal IDs if supplied, avoids known/selected/previously purchased coverage and stops when no resource fits. No LLM adapter is configured; no model payment arguments are accepted from the browser.
- Authority: app.ts scopes APIs to hashed opaque sessions; wallet.ts verifies a one-time five-minute Testnet ownership challenge. Owner signatures stay in the Noir extension. Sessions expire in 24 hours; this is not a production account-recovery system.
- Service fee: velo.ts snapshots plan/session/owner/fee/asset, reuses an idempotency key, verifies signed raw event/project/intent/amount/asset/description and retrieves current API state. velo-ledger.ts checks a successful exact owner-to-receiver native transfer and memo on Horizon Testnet. Browser redirects cannot activate. Velo does not verify Noir escrow.
- Owner setup: noir.ts uses SDK prepare with registerDevice/registerAgent/fundEscrow, then SDK submit of the exact wallet-signed transaction. Duplicate funding/prepared/pending operation and signature/session checks remain.
- Start/reserve: agent.ts/approve snapshots immutable rules and registered merchant accounts. start verifies owner/policy/service and reserves all selected integer prices under BEGIN IMMEDIATE with a once-only marker. Grant/resource uniqueness and held uncertain commitments prevent repeated clicks or new browser IDs resetting the allowance.
- Payment: worker tick validates provider/address, current price, cap, total/reserve, expiry, wallet and service again. getDeviceOwner/getPolicy/getEscrowToken and checkPayment precede authorizePayment. Signed hashes are stored before SDK submission; uncertain outcomes retain a durable global lock.
- Settlement: dedicated provider keys call aggregate claim only when known authorized totals match that merchant's on-chain pending balance. Transaction success plus exact events reconcile authorization and batch claim separately.
- Fulfillment: sample codes are generated only after separately confirmed settlement and returned only for fulfilled records. Simulation has no code/hash/claim. No learning completion or commercial access is claimed.

On-chain limits are agent/asset/per-payment/expiry, nonce and available escrow. Provider allowlists, total/reserve accounting, resource uniqueness, catalog identity and service-session eligibility are Pathwise rules. An on-chain policy is not a full mirror of every application constraint.

## Checks actually run

- Root npm test: **17 passed**, including real temporary backend-process restart and repeatable migrations through version 5. Payment calls use injected synthetic SDK ports; wallet signatures and webhook HMAC parsing use the real SDK implementations locally.
- npm run build, npm run typecheck, npm run lint --workspace=web: passed on the supported runtime.
- node scripts/verify-learning-ui.mjs: **35 passed**. These are server-rendered fixtures/helper checks, not browser screenshots or live payments.
- npm run audit:secrets: source/bundle scan passed after the documentation rewrite; the final result is recorded in the task response. No Git history exists yet to audit.
- Read-only scripts/noir-probe.mjs: initial sandbox network attempt failed; the approved network-enabled retry succeeded. docs/testnet-probe.json records the actual result: no owner/policy and zero balance for the unused probe identifier. No signer or payment method was called.
- Database evidence inventory: default DB contained four simulated orders; separate review DB contained two. Both had zero wallet bindings, service checkouts, owner operations, live authorization references and claim batches. No private rows were exported.
- Handbook/SDK contract comparison: all three exact IDs match after removing PDF line-wrap whitespace.
- README metadata/section/source-link checks: final check validates exact heading order and local source targets/line anchors. Public links remain absent, not fabricated.

No public website/backend could be checked, no real Velo webhook was received, no contract write was submitted, and no owner wallet was automated. Existing historical Friendbot links are explicitly setup-only and were not freshly revalidated.

## Remaining limits and blockers

The [submission checklist](submission-checklist.md) is authoritative for pending deliverables. Registration is unconfirmed; the registration deadline preceded this audit. The supplied submission deadline is November 7, 2026, noon Philippine time. No extension is assumed.

Actual Velo API/project/webhook values are absent. Four Noir server keys are present privately and match the configured deployment; that does not prove accounts remain funded after a Testnet reset. The owner must connect/sign and the whole live flow must be rehearsed after explicit authorization. This audit grants no permission to enable it.

No public repository, durable public host, actual public URL, two-minute video, pitch deck, confirmed team roster or repository screenshot assets are available. Publishing, a public tunnel and paid resource creation were prohibited and were not attempted. Use the separate deployment guide only after a new approval/cost review; free local hosting uses the owner's existing computer and internet and needs them to remain running.

Operational limits: one SQLite instance; event-history retention can require manual recovery; no automatic safe release for crash-before-hash cases; immutable one-hour grants have no renewal UI; expired sessions do not automatically recover wallet-linked history; Velo scanner/merchant balances need live compatibility validation. Full narrow-screen/keyboard accessibility remains unverified from prior UI work. Do not delete records or locks to make a blocked demo appear successful.

## Judge story

The strongest implemented differentiator is buying for remaining skill gaps while avoiding repeated coverage, preserving an exam reserve and explaining both selections and refusals. This supports the handbook's 30% agentic fit, 25% technical execution, 20% innovation, 15% real-world potential and 10% pitch/demo criteria. It does not establish traction, savings, partnerships, performance statistics or a likelihood of winning.
