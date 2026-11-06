# Phase 2 setup and live rehearsal

> Historical implementation record. The November 7 [audit](hackathon-audit.md), [submission checklist](submission-checklist.md) and [current multi-provider rehearsal guide](testnet-rehearsal.md) supersede old runtime, UI and readiness statements below. No live payment proof was added by the audit.

Current state: integration code and deterministic tests are implemented; live payment acceptance is **not yet achieved**. No owner wallet signature or Velo credential was available during implementation. No successful payment is fabricated. See deployment-reference.md and phase2-evidence.md.

## 1. Upgrade Node and install

The installed Noir 0.3.0 package requires Node ^22.23.4 || ^24.22.1 || >=26.12.1. This machine currently has 24.14.1. Use the [official Node downloads](https://nodejs.org/en/download), select Windows x64 and a supported release (for example 24.22.2 on the Node 24 line), install it, and reopen terminals. Pathwise intentionally blocks Noir writes on unsupported runtimes.

```powershell
cd C:\Users\Hannah\Documents\Pathwise
node --version
npm.cmd install
npm.cmd run migrate
```

The root .env has already been created with dedicated agent and provider Testnet keys; keep it. For a fresh checkout, run `npm.cmd run setup:testnet` to create .env and fill missing server keys. It preserves existing nonempty keys and prints only public addresses. Never copy an owner secret into .env or into Pathwise.

```powershell
npm.cmd run setup:testnet
npm.cmd run fund:testnet
```

The funding helper creates missing server Testnet accounts with Friendbot; it leaves existing accounts alone. The two accounts generated during implementation were actually funded. Their public funding evidence is in phase2-evidence.md. Friendbot transactions are not agent-payment proof. If a previously created account needs more fee funds, open its public Friendbot URL manually; the helper deliberately does not keep funding existing accounts.

## 2. Install Noir and fund the owner account

1. Use Chrome. Install [Noir from the Chrome Web Store](https://chromewebstore.google.com/detail/noir/gikfhchijjljpbhokmdmaadgmpbchmjl), linked by the [official extension README](https://github.com/noirx402/noir/blob/main/extension/README.md).
2. Open the extension and create a separate test wallet. Back up its recovery phrase privately. Keep the phrase and secret inside the wallet; Pathwise never asks for them.
3. Select **Stellar Testnet** in the extension. Noir refuses signing requests for a different network. Copy the public address beginning with G.
4. Open `https://friendbot.stellar.org?addr=YOUR_G_PUBLIC_ADDRESS` after replacing the address. [Stellar account setup documentation](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts) explains Testnet account funding. Keep enough test XLM for the separate service fee, the 8-XLM escrow deposit, network fees, and account reserves. Friendbot provides free Testnet funds.
5. Start Pathwise using step 5 below. In the setup section click **Connect Noir & verify ownership**. Approve the site connection, then the authentication transaction signature. This is a one-use five-minute SEP-10-style challenge, never a network submission. The server checks the exact challenge body, wallet signature, domain, expiry, and session. Only single-key G-address wallets are supported in this experiment; multisig/contract-wallet threshold authentication is not implemented.

The extension also supports unpacked installation from its official source: in a separate folder, follow its README's npm ci / npm run build instructions, then Chrome → chrome://extensions → Developer mode → Load unpacked → extension/dist. Do not scaffold or clone it inside Pathwise.

## 3. Obtain Velo credentials

1. Open [Velo](https://www.velo-build.dev/), connect the owner wallet, and complete its wallet-ownership prompt.
2. Create or select the Pathwise project on Stellar Testnet. Complete Velo's project registration and Pay-access activation if the console requests them. Creating a project or API key alone does not guarantee payment access.
3. Open the project's **API keys** page → **Generate key** → enter a label → select **General project API** → **Generate key**. Use the in-house Stellar route. A **Gas Station · Testnet** key cannot create checkouts.
4. Copy the raw general key when it is shown once into VELO_API_KEY in the root .env. Copy the project's internal ID from `/projects/PROJECT_ID/...` into VELO_PROJECT_ID; this is the webhook envelope's project.id, not registryProjectId or the project name.
5. Important verified discrepancy: current [console source](https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/packages/backend/convex/projects/mutation.ts) generates general keys with `tk_live_`, while the installed alpha README also documents `tk_test_`. Pathwise accepts either general-key prefix, fixes SDK environment to testnet, and independently checks the payment transaction against **Stellar Testnet** before activation. The prefix and SDK environment alone are not network proof. Use Testnet in the checkout wallet and stop if the hosted page requests Mainnet.
6. If registration/access/key creation is unavailable, ask the Velo organizer for an enabled Testnet checkout project and a general project API key. Do not substitute a Gas key or invent credentials.

Inspected sources: installed alpha 0.1.0-alpha.4 declarations/README/Express example, [official SDK README](https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/packages/velo-sdk/README.md), [console API-key controls](https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/apps/web/features/projects/project-api-keys.tsx). Current upstream docs describe stable 1.0.0; this project deliberately pins alpha.4 per the hackathon requirement. Calls compile against the installed alpha declarations.

## 4. Make the raw webhook public

Install cloudflared from [Cloudflare's official downloads](https://developers.cloudflare.com/tunnel/downloads/), then open a separate terminal:

```powershell
cloudflared tunnel --url http://127.0.0.1:3001
```

Use the HTTPS trycloudflare.com URL printed by the command. [Quick Tunnels documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) describes this development-only workflow. The URL changes if the tunnel restarts. Keep the tunnel terminal open. This exposes the local backend while running; use it only for the experiment, with Testnet credentials. No browser/email access gate may sit in front of the webhook because Velo must reach it automatically.

1. In Velo open the project's **Webhooks** page.
2. Enter `https://YOUR-TUNNEL.trycloudflare.com/api/webhooks/velo` as the endpoint. Enable it and subscribe to payment.created, payment.succeeded, and payment.failed. Click **Save webhook**.
3. Reveal/copy the endpoint signing secret into VELO_WEBHOOK_SECRET in root .env. Restart Pathwise after editing .env.
4. Use **Test delivery** → **Send test event** to check transport/signature configuration. A valid synthetic event can receive HTTP 200 but **does not activate the service**. Real payment events have test=false; this was verified in the publisher's webhookDelivery.ts source.
5. Inspect **Delivery logs** for status, attempts, and HTTP response. Correct configuration and retry a failed real delivery after resolving its cause. If automatic retries exhaust, use the publisher's supported retry mechanism or request organizer assistance; do not change the event into a fabricated success.

The endpoint captures express.raw before any JSON parser or session middleware and uses Velo.webhooks.verify with the original body, x-velo-signature, a five-minute tolerance, and the server-only secret. Unknown/unlinked checkouts and transient verification failures return 503 for retries. Signed events are deduplicated durably by event ID and delivery ID. The original payload hash is retained without logging full sensitive payloads. A changed sentAt on redelivery does not apply a second business effect.

## 5. Edit the root local environment and start

Open `C:\Users\Hannah\Documents\Pathwise\.env` in your editor. It already contains generated server keys; **do not overwrite it by copying .env.example**. Fill only:

```dotenv
VELO_API_KEY=your_general_project_key
VELO_PROJECT_ID=the_internal_project_id
VELO_WEBHOOK_SECRET=the_endpoint_signing_secret
VELO_SERVICE_AMOUNT=1
```

These lines are placeholders for your editor, not real credentials. Keep the three NOIR contract IDs exactly as recorded in deployment-reference.md. No owner secret belongs in this file. The native XLM asset, Testnet passphrase, RPC endpoint, and Velo API origin are fixed in code. There is no frontend VITE_* payment secret.

```powershell
npm.cmd run dev
```

Open http://localhost:5173. Stop an older Vite/backend process first if ports 5173 or 3001 are already in use. Root dev starts both apps. .env changes and backend code changes require restarting root dev; Vite updates frontend edits automatically.

## 6. Rehearse genuine payments

1. Save the default plan: 30 test XLM total, 10 per purchase, 10 exam reserve, course format, and Cloud concepts not marked as already known.
2. Connect/verify the Noir owner wallet if not done already. The session cannot switch to a different wallet after binding.
3. Click **Create / recover Velo Testnet checkout**. Open the returned hosted checkout link. Connect the **same owner wallet**, verify Testnet and the 1 test XLM service fee, then sign/pay there. The service fee is separate from the learning budget and Noir escrow.
4. Return to Pathwise and click **Retrieve service payment status**. A success redirect alone does nothing. Activation needs a matching authenticated success webhook, server-retrieved paid intent, and a successful exact native-XLM payment on Stellar Testnet from the verified owner to Velo's expected receiver, with any required memo. If it remains inactive, inspect Velo delivery logs and keep the tunnel running. The webhook may arrive before the paid API status; refresh again after the scanner catches up.
5. Once active, review the fixed 8 test XLM fictional course/provider experiment and click **Approve these experiment rules once**. It is bound to the saved plan, session, wallet, configured agent/provider/asset, selected deployment, and a one-hour expiry. It reserves the entire 8 test XLM commitment. Only one experiment per wallet is permitted in this phase, preventing duplicate purchases across plans/sessions; return to the original tab rather than creating another attempt.
6. In order, click **Register device**, **Register agent policy**, and **Fund 8 test XLM escrow**. Each opens an actual owner wallet signature prompt. These three setup transactions are separate from the agent-made purchase. Inspect the provided hashes and Testnet explorer links. The virtual device hash is a clearly labeled demo identifier, not a claim that physical NFC hardware was linked.
7. Click **Start agent: check & authorize the fixed purchase** once. The backend validates the application rules, current owner/policy/asset and service activation, then invokes SDK checkPayment followed by authorizePayment. Only the server agent signs; no per-resource owner signature is required.
8. Confirm state **authorized** and an actual authorization hash. Click **Run controlled demo-provider claim**. The server provider signs an aggregate claim. Confirm **claimed** only after matching confirmed contract events. No commercial course integration or access-code fulfillment is performed in this experiment.
9. If a submission times out, use **Reconcile uncertain Noir transactions**. The known hash and pending commitment are retained; do not re-fund or submit a new payment. Unknown outcomes block further Noir submissions globally until reconciled. If the process dies before a signed hash was recorded, or the RPC event history is no longer available, manual review is required; there is no unsafe auto-reset.

## Aggregate claims and limitations

SDK claim({ merchant, token }) pays all pending payments for that merchant in the chosen token; it has no order ID. Contract pending_balance(merchant) sums pending payments across tokens. Pathwise uses a dedicated XLM-only provider account, sums all locally authorized unclaimed orders, and refuses a claim if the aggregate balance differs. All participating orders share the claim hash and captured batch total. Only a matching payment.claimed event marks the batch claimed; a claim hash alone is not a per-order receipt. External payments/other assets to this provider require manual reconciliation. Do not reuse the provider key in another app. Concurrency is serialized by a durable SQLite lock; unresolved operations intentionally block later writes.

On-chain policy enforces agent, asset, per-payment cap, and expiry. Application rules additionally enforce the selected provider/resource, single purchase, total budget, reserve, session binding, and verified service activation. Transaction fees and the separate Velo service fee are outside the learning-resource budget. Keep fee/reserve funds in the owner wallet. If setup expires after funding, do not revoke the device directly: the official SDK unlinkDevice flow revokes the policy, sweeps escrow, then removes the device safely. Recovery UI is not included in this phase; retain the experiment/device ID and use the documented owner-wallet SDK flow with assistance.

## Local verification and evidence

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run lint -w web
npm.cmd run probe:noir
```

Tests use synthetic SDK ports and signed local fixtures, never real payment secrets, and cannot satisfy live acceptance. Wallet challenge signatures and Velo HMAC verification use the real SDK implementations. A separate process-restart test confirms SQLite plan/session persistence. The probe performs only read-only SDK calls and records docs/testnet-probe.json.

After a real rehearsal, record the actual authorization hash, batch claim hash, Velo intent ID, verified event ID, and Testnet transaction hash in docs/phase2-evidence.md. Keep API keys, secrets, signed XDR, and session tokens out of the public report. The authenticated setup screen retrieves these real records from SQLite; no placeholder transaction links are displayed.
