# Current Testnet setup and rehearsal

This is the current multi-provider learner-interface flow, replacing the older fixed-course Phase 2 walkthrough. It is **not a record of completed payments**. Do not perform these write/public-access steps during the audit. They require a later deliberate Testnet rehearsal and explicit permission for public access. If a dashboard asks for billing, a paid subscription or a card, stop and ask the organizer for a no-cost Testnet route; no sponsor allocation is assumed.

## 1. Start safely in simulation

Follow README Run it locally using Node 24.22.2, one root npm ci, root .env, migrations and npm run dev. Keep PAYMENTS_ENABLED=false. Existing .env contains private server keys: preserve it and never copy an example over it. The UI and /api/health must show simulation/paused behavior. Local default addresses are http://localhost:5173 and http://127.0.0.1:3001.

New learners: Build my learning path -> four setup stages -> save -> find recommended resources -> Review spending rules -> Explore in simulation -> approve -> My resources -> Start simulated agent. There is no Velo fee/wallet requirement for explicitly simulated execution. No transaction hash or access code should appear.

## 2. Check network, accounts and contracts before opt-in

- Only Stellar Testnet is supported: Networks.TESTNET, Soroban https://soroban-testnet.stellar.org and Horizon https://horizon-testnet.stellar.org. Native XLM asset contract is derived with Asset.native().contractId(Networks.TESTNET). No Mainnet selector or RPC environment override exists.
- Use the exact three IDs in deployment-reference.md. They match page 6 of the actual supplied handbook and installed Noir SDK 0.3.0. Different IDs are rejected, even with a provenance note.
- Owner: a separate single-key Stellar G-address in the Noir wallet, verified for the browser session. Never put the owner secret/seed in chat, .env or a web form.
- Agent: dedicated server NOIR_AGENT_SECRET. Merchants: distinct NOIR_PROVIDER_SECRET, NOIR_PROVIDER_2_SECRET and NOIR_PROVIDER_3_SECRET for CloudTrail Academy, Sandbox Grove and Exam Lantern. These are signer credentials, not invoice addresses the browser can choose. Owner, agent and merchants must be separate accounts.
- Use the authenticated setup screen to inspect public account/contract details. Never screenshot an environment file, signature payload, access code or session token.
- Server-account helper npm run setup:testnet creates missing keys privately and preserves existing nonempty keys; it does not fund them. npm run fund:testnet calls Friendbot to create/fund missing Testnet accounts. It causes network account-setup transactions, not resource payments; it was not run in this audit. Check existing balances after any Testnet reset rather than assuming historical funding persists.

## 3. Install/use the owner wallet

1. In Chrome open the [official Noir extension listing](https://chromewebstore.google.com/detail/noir/gikfhchijjljpbhokmdmaadgmpbchmjl), linked from the publisher's extension README. Install it yourself.
2. Open Noir, create a separate test wallet and back up recovery information privately inside the wallet workflow. Select Stellar Testnet and copy only its public G-address.
3. Use Friendbot with that public address for test funds. Keep enough test XLM for the separate service fee, learning escrow deposit, network fees and minimum account balance. Test XLM has no real-money value.
4. In Pathwise open My space -> Spending & payment settings and explicitly choose Stellar Testnet. Click Connect & verify Noir wallet, review site/network and sign the one-time ownership challenge. That challenge authenticates the session; it is not a submitted payment.

Only single-key G-address ownership verification is implemented. Multisig/contract-wallet authentication and expired-session wallet-history recovery are not implemented.

## 4. Obtain Velo access without creating paid commitments

1. Open [Velo](https://www.velo-build.dev/) and sign in using the owner wallet. Confirm the intended project/payment route is Testnet before signing anything.
2. Select/create a Pathwise project only if its cost is confirmed no-charge. If access needs organizer activation or any cost is unclear, stop this step and request an enabled Testnet checkout project from the organizer yourself.
3. In the project's API keys area generate a **general project API key** for checkout, not a Gas-only key. Store it privately as VELO_API_KEY in root .env. Store the internal project ID as VELO_PROJECT_ID. UI labels may change; if those controls are absent, ask the publisher rather than substituting undocumented settings.
4. The installed alpha SDK accepts environment=testnet, but a general key prefix does not prove network. Pathwise accepts supported general-key prefixes and requires independent Stellar Testnet ledger proof before activation. Stop if the hosted checkout asks for Mainnet or real funds.
5. Leave VELO_SERVICE_AMOUNT=1 unless deliberately changing the separate service price before checkout creation. It is fixed on the backend, not supplied by browser input.

## 5. Arrange the real webhook later

Velo must reach /api/webhooks/velo at an actual public HTTPS origin. This audit did not expose one. Use an already approved public backend or, after separate permission, the development tunnel procedure in deployment.md. Do not create a paid host or billing-enabled trial. A temporary tunnel depends on your existing computer/internet, changes address on restart and is not a durable managed deployment.

In the Velo project's Webhooks area, register the actual HTTPS endpoint and subscribe to payment.created, payment.succeeded and payment.failed. Copy only its signing secret into VELO_WEBHOOK_SECRET in the backend environment. Restart the backend. Test-delivery success verifies transport/HMAC only and must not activate purchasing. Keep the exact raw body intact through the proxy.

For paid activation the backend verifies project, session-linked intent, amount, native asset and description; retrieves paid API status; verifies the exact owner-to-receiver transfer/memo on Testnet; and stores a deduplicated receipt. One ledger transaction cannot be reused for another checkout. A browser success redirect is never proof.

## 6. Explicit opt-in and multi-provider rehearsal

Only after network/accounts/contracts, enabled no-cost Velo Testnet access and actual webhook reachability are verified may the operator deliberately set PAYMENTS_ENABLED=true in the backend and restart. Missing/false defaults paused everywhere. Do not enable it during this audit, and do not change the three contracts.

For the default two-provider example, use a saved plan with no familiar skills, all formats, 30 total learning budget, 10 exam reserve and 10 per purchase. The separate service fee defaults to 1 test XLM. One-hour grants begin at approval, so prepare prerequisites first.

1. My learning path -> find recommendations. IAM essentials lab 6 and Cloud foundations course 8 should be selected; billing practice 14 is blocked by the cap. Prices are demo data, not a promise of commercial course access.
2. Spending settings -> Testnet -> Connect & verify owner wallet. Create/recover Velo checkout. Open Velo, use the same verified owner, check Testnet and the fee, then complete that separate service payment yourself.
3. Return and Check payment status. Wait for both the signed non-test webhook and server's paid/API/ledger verification. Do not mark a redirect or dashboard test event successful.
4. Review approved providers and spending rules. Approve rules & set up escrow. This creates immutable application rules; it is not owner contract approval by itself.
5. In owner authorization, Review & sign each of Register demo device, Grant agent policy, Fund learning escrow. The default learning deposit is 20 test XLM; the exam reserve is not deposited. Fees and service payment are separate. Confirm each transaction state before the next step.
6. Open My resources -> review the limits -> Start Testnet purchasing agent once. The server rechecks eligibility, reserves exact amounts, then autonomously authorizes both purchases. No per-resource owner Pay click is needed.
7. Observe pending -> authorized -> aggregate claim -> fulfillment separately. Only confirmed authorization and matching aggregate merchant claim unlock sample codes. Do not screenshot or publish the codes. No resource is labeled completed learning.
8. Explain the safely blocked 14-XLM practice exam. A pre-payment refusal should have no fake hash and no unnecessary rejected chain transaction.

Unknown/timeout outcomes retain commitments and saved hashes for reconciliation. Use the provided owner reconciliation control for uncertain setup; the background worker reconciles agent operations. Never delete a lock, row, database or volume to force retry. A crash before a hash, old RPC event history or an unexpected merchant balance needs manual review. Expired immutable grants have no renewal UI; do not reset records to bypass expiry.

## 7. Capture genuine proof and compare it to records

After successful live execution, record public transaction hashes and verified states only. Keep owner setup, agent authorization, aggregate merchant claim and separate Velo service payment labeled distinctly. An aggregate claim hash can cover multiple orders; record its member orders and sum, not a fictitious per-order receipt.

Run the existing **read-only** reconciliation with the supported Node runtime:

    npm.cmd run evidence:reconcile

It opens the intended database read-only, calls Noir/Velo status and event/ledger reads, and writes a private ignored reconciliation report. It does not submit transactions. Exit 0 means the complete same-grant acceptance proof passed, 1 means issues, 2 means incomplete acceptance. Review the code before using a changed script. Do not publish the private database or full report blindly; extract public proof into docs/phase2-evidence.md without secrets, session identifiers, signed XDR or access codes.

Verify a service payment, owner setup, two distinct providers settled/fulfilled and a stored safely blocked decision all belong to the same grant. A synthetic hash, Friendbot transaction, successful test webhook or zero merchant balance does not meet acceptance. Public deployment and its URL must then be verified separately; localhost evidence is not a public website.
