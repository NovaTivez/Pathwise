# Deploying Pathwise without losing payment records

No public deployment or paid hosting commitment has been created. The user has no hosting/repository yet and no confirmed sponsor credits. The approved local image build and 19 container checks, including restart persistence, passed on November 7. The later Cloudflare image download was rejected; no tunnel or public rehearsal was started. See release-preparation.md for current evidence. Production serving, environment guards, worker draining, webhook authentication, and persistence are covered by local automated tests.

## Choose a compatible route

| Route | Fit for the current code | Cost / limitation |
| --- | --- | --- |
| Local Docker + persistent named volume + Cloudflare Quick Tunnel | Recommended first public rehearsal without a hosting purchase. Runs the same Express API, built frontend, SQLite, and worker together. | No cloud compute purchase; uses your computer, electricity and internet. Computer must remain awake and Docker running. Temporary public URL changes when tunnel restarts; no uptime guarantee. Durable across container restarts, but tied to this computer and its Docker volume. |
| One Render web service + attached persistent disk | Simplest stable managed host compatible with the existing SQLite/worker implementation. Blueprint prepared in render.yaml. | Paid Starter compute plus disk, and possible usage overages. Render currently advertises paid web services from $7/month and disk at $0.25/GB/month; a 1-GB disk gives an indicative $7.25/month before any extras/tax. Confirm the actual dashboard estimate before agreeing. Not provisioned and not authorized for purchase here. |
| Free Render web service | Not compatible as-is for durable payment execution. | Sleeps after 15 idle minutes, cannot attach a disk, and local files are lost. Free Postgres expires and would require a database-adapter migration; it would not fix the always-on worker by itself. |
| Fly.io machine + volume | Technically compatible with a single always-on machine and volume, but more operational setup. | Compute and volumes are billed; no unconfirmed credits assumed. |
| Static-only/serverless hosting | Can host frontend files, not this complete backend/SQLite/continuous worker. | Do not publish a static preview and label its payment flow deployed. |

Primary sources checked: [Render disks](https://render.com/docs/disks), [free limits](https://render.com/docs/free), [Render billing](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses), [current pricing](https://render.com/pricing), [web services](https://render.com/docs/web-services), [Node selection](https://render.com/docs/node-version), [Fly volumes](https://fly.io/docs/volumes/overview/), and [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/). Prices can change; no paid action is part of the steps for the free rehearsal.

## Deployment shape and safeguards

The production Express process serves apps/web/dist and /api on the SAME HTTPS origin. No frontend API key or cross-origin API host is needed. PUBLIC_URL (or Render's automatic RENDER_EXTERNAL_URL) supplies the canonical URL for wallet challenges and Velo return URLs. Optional WEB_ORIGIN must match exactly; do not copy localhost into production. The signed webhook route deliberately runs before browser-origin/session checks and before JSON parsing.

Use one process/instance with its built-in worker. A separate worker service cannot share Render's attached disk. The app checks the actual Linux mount table and refuses a plain unmounted directory: merely setting DATABASE_PATH is not proof of durable storage. DATABASE_PATH must be under PERSISTENT_DATA_DIR. Migrations run transactionally at startup on the mounted disk, before serving requests. Render disks are unavailable during build/pre-deploy, so migrations MUST NOT be a build or preDeployCommand.

The prepared runtime is Node 24.22.2, compatible with installed Noir SDK 0.3.0. Your system Node is still 24.14.1. A checksum-verified official Windows Node 24.22.2 is available privately at .tools/node/node.exe for local checks; it is excluded from Git and Docker context. Containers/native Render select their own pinned runtime.

All environments now default PAYMENTS_ENABLED=false; actual Testnet writes require an explicit opt-in. This keeps simulation usable and rejects new real Testnet checkout/owner/agent writes. When valid payment configuration is present, already-submitted transactions can still be reconciled while paused; no timeout is treated as permission to resubmit. Graceful shutdown stops scheduling work and drains up to 20 seconds, then preserves commitments/hashes for startup recovery. Render may kill the process at its own deadline; this cannot erase the persistent ledger.

## 1. Create a free GitHub repository

Do this only after reviewing the secret audit. Never upload .env, .env.production, database/backups, signed XDR, or screenshots showing credentials.

1. Open https://github.com and sign in yourself (or create your account). Do not send login details to this chat.
2. Click the **+** menu at the top right → **New repository**.
3. Repository name: **pathwise**. Description: **Educational purchasing agent on Stellar Testnet**.
4. Choose **Public**. Leave **Add a README file**, **Add .gitignore**, and **Choose a license** unselected because this workspace already has project files.
5. Click **Create repository**. Copy the HTTPS repository URL without a token in it.
6. In PowerShell:

```powershell
cd C:\Users\Hannah\Documents\Pathwise
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
npm.cmd run audit:secrets
git init -b main
git add .
git diff --cached --name-only
npm.cmd run audit:secrets
```

The audit must report passed=true. The staged list may contain .env.example and .env.production.example; it MUST NOT contain .env, .env.production, any SQLite database, .tools, or artifacts. Audit output deliberately omits matched credential values. The current workspace is not yet a Git repository, so the current audit cannot inspect history. If you later suspect a key entered Git history, revoke/rotate it before publishing; removing it from the latest commit alone does not remove history.

If Git asks for your identity, configure it locally using your chosen display name and GitHub verified/noreply email:

```powershell
git config user.name "YOUR_DISPLAY_NAME"
git config user.email "YOUR_GITHUB_VERIFIED_OR_NOREPLY_EMAIL"
```

Replace the capitalized placeholders, then:

```powershell
git commit -m "Prepare Pathwise Testnet deployment"
git remote add origin https://github.com/YOUR_USERNAME/pathwise.git
git push -u origin main
```

Complete Git Credential Manager's browser sign-in yourself. Never put a token in the remote URL. These instructions do not imply a repository was created or pushed by the agent.

## 2. Free public rehearsal on your computer

Docker Desktop is installed. The approved local image build and simulation/restart checks have now passed. A local-only origin fixture is running with payments paused; public exposure remains unapproved. Do not rerun volume seeding or overwrite its database. If Docker requests OS virtualization/WSL changes or license/account acceptance, complete those decisions yourself; no such changes were automated here.

1. Open **Docker Desktop** and wait until its engine shows running. Use Linux containers.
2. In a terminal at the project root:

```powershell
docker compose build app
```

This downloads the official Node image and npm dependencies. .dockerignore excludes credentials, local databases, backups, artifacts and the local runtime. No secret is passed as a build argument.

3. Start ONLY the optional free tunnel; it can allocate its URL before the app is up:

```powershell
docker compose --profile tunnel up -d tunnel
docker compose --profile tunnel logs --tail 100 tunnel
```

4. Find the printed HTTPS trycloudflare.com URL. It is a real generated URL, not an example hostname. No Cloudflare account, domain purchase, or payment card is needed for a Quick Tunnel. The app is not healthy until the next steps are complete.
5. If .env.production does not already exist, copy the safe template:

```powershell
Copy-Item .env.production.example .env.production
```

Open .env.production in your editor. Set PUBLIC_URL to the ACTUAL HTTPS origin just printed (no trailing path/query). Keep PAYMENTS_ENABLED=false for the first check. Leave payment credentials empty until ready to configure them privately. Do not overwrite the existing local .env, which already has server Testnet keys. Do not run or share `docker compose config` with secret values resolved.

6. Start the app with its persistent named volume:

```powershell
docker compose up -d app
docker compose ps
Invoke-RestMethod http://localhost:3000/api/health
```

The app listens internally on 0.0.0.0:10000, while the host port is restricted to 127.0.0.1. The public tunnel routes to the container. Use the generated HTTPS URL for browser interaction; localhost:3000 is for health checks and is not the allowed browser origin in this public configuration.

7. Open the HTTPS URL, save a goal, use simulation, build a roadmap, approve simulation rules, and start the simulated agent. Verify two simulated orders and no transaction hashes/access codes. The service fee must remain visibly separate.
8. Run the prepared HTTP checks against the actual URL:

```powershell
npm.cmd run verify:public -- https://YOUR_ACTUAL_HOST --exercise-simulation
```

This creates only a disposable simulation session/plan on that deployment, checks session isolation, worker completion, reserve accounting and duplicate starts, and writes artifacts/public-check.json without tokens. It NEVER verifies or fabricates a real payment.
9. Keep the browser tab and tunnel open, then restart JUST the app:

```powershell
docker compose restart app
```

Reload the same browser tab: records should persist. The named pathwise-data volume is separate from the app container. Do not delete Docker volumes or use a volume-removing teardown for financial records. Container restart and image rebuild do not replace the named volume.
10. To end the public rehearsal without deleting data:

```powershell
docker compose --profile tunnel stop
```

A new tunnel process can generate a different URL. Update PUBLIC_URL, restart the app, and update the Velo webhook URL before further use. Browser sessionStorage is origin-bound; changing tunnel hostname loses that browser session's access even though records remain in SQLite. Keep the same tunnel during a payment rehearsal. Wallet/session recovery across lost browser sessions is not implemented; do not delete records to reset a wallet's authorization limits.

## 3. Optional stable Render deployment — paid, not created

Do NOT create this service without confirmed sponsor credits or a separately approved hosting budget. A free Render workspace does not make a Starter service or its disk free.

When funded/approved, either use New → Blueprint with render.yaml and review the paid estimate, or configure manually:

1. Open https://dashboard.render.com and sign in yourself. Connect your GitHub account when asked.
2. Click **New → Web Service**, choose your Pathwise repository, branch **main**.
3. Name: a unique name such as **pathwise-YOUR_USERNAME**. Region: **Singapore**. Root Directory: leave empty. Language/runtime: **Node**.
4. Build Command: `npm ci --include=dev && npm run build && npm run audit:secrets`.
5. Start Command: `npm start`. Health Check Path: `/api/health`.
6. Choose **Starter** (paid). Under **Advanced**, add a persistent disk: name **pathwise-data**, mount path **/var/data**, size **1 GB**. One instance only; do not enable horizontal autoscaling.
7. Add Environment variables:

```dotenv
NODE_VERSION=24.22.2
NODE_ENV=production
DATABASE_PATH=/var/data/pathwise.sqlite
PERSISTENT_DATA_DIR=/var/data
STORAGE_KIND=render-disk
AGENT_INSTANCES=1
PAYMENTS_ENABLED=false
```

Leave PUBLIC_URL and WEB_ORIGIN unset when using the default Render URL; Render supplies RENDER_EXTERNAL_URL. For a custom domain later, set PUBLIC_URL to that actual HTTPS origin and update Velo. Render supplies PORT. No pre-deploy migration command is needed.
8. Review the compute + disk + possible usage cost. **STOP before Create Web Service unless the budget/credits have been confirmed.** No creation or payment was performed in this task.
9. After you choose to create it, wait for **Live**, copy the ACTUAL public URL shown in the dashboard, check `/api/health`, and run verify:public. Do not claim that the sample name is an actual deployment URL.
10. Use **Manual Deploy** for later updates. render.yaml disables automatic deployments by default. The single disk means brief downtime during deployment; records and unknown commitments must survive.

## 4. Configure the public Velo webhook and enable Testnet

The Velo SDK alpha version and handbook-selected Noir contract IDs stay unchanged; see deployment-reference.md. All accounts/transactions must remain Stellar Testnet, never Mainnet.

1. Open the Velo console, connect the project owner wallet, select the Pathwise project, and finish its project/Pay-access activation if requested.
2. Current private dashboard labels have not been independently observed. Use the available **API keys → Generate key**. Label: **Pathwise Testnet checkout**. API access: **General project API**, in-house route. Copy the raw key privately when shown once. A Gas-only key is unsuitable. Current general keys may use tk_live_; that prefix alone is not network proof. Pathwise independently verifies payment on Stellar Testnet.
3. Set VELO_API_KEY and VELO_PROJECT_ID on the backend. Use the internal project ID from the project's URL (project.id), not registryProjectId.
4. Open **Webhooks**. Endpoint: `https://YOUR_ACTUAL_HOST/api/webhooks/velo`. Enable it. Select payment.created, payment.succeeded and payment.failed. Click **Save webhook**.
5. Reveal/copy the signing secret privately into VELO_WEBHOOK_SECRET. For Docker edit ignored .env.production; for Render use **Environment → Add Environment Variable**. Never use VITE_* for secrets and never put them into render.yaml, Dockerfile, GitHub source, screenshots or chat.
6. Privately copy the existing NOIR_AGENT_SECRET and all three NOIR_PROVIDER[_2/_3]_SECRET values from local .env into that backend environment. Keep the same keys for their persisted records. No owner secret is required; owner keys stay in Noir.
7. Keep VELO_SERVICE_AMOUNT=1. Set PAYMENTS_ENABLED=true only after the above setup is complete. Production startup validates distinct agent/provider keys and complete Velo configuration before allowing live writes. Restart the Docker app or save/redeploy the Render environment.
8. Send a Velo **Test delivery**. A valid signed synthetic payload can get HTTP 200 but does NOT activate purchasing. Wrong signatures return 401; unknown/unlinked checkout or transient reconciliation errors return 503 for retry. Inspect **Delivery logs** and the backend's redacted request/event logs. Webhook delivery is not configured merely because this route exists.

Raw request bytes are verified by Velo.webhooks.verify before parsing/trusting the event. Event ID and delivery ID deduplication are persistent; out-of-order delivery cannot undo a verified paid state. Activation requires a matching stored checkout/session/owner, exact expected amount/native asset, signed success event, paid API status, and exact successful owner-to-expected-receiver transaction on Stellar Testnet. A browser redirect alone cannot activate service.

## 5. Actual live Testnet acceptance sequence (not yet performed)

Keep the same public origin and browser tab through this sequence.

1. In **Goal setup**, use no pre-known skills, all formats, budget 30, cap 10, reserve 10. Save.
2. In **Payment & authorization**, choose **Use actual Testnet payments**. Connect Noir, select Testnet, and approve the wallet ownership challenge. Install/fund the owner wallet using phase2-setup.md if needed. Never enter an owner key into the website or backend.
3. Create the Velo service checkout, open it, use the SAME verified owner wallet and Testnet, pay the 1 test XLM service fee, return, and click **Check payment status**. Wait for verified service payment/active status. A synthetic delivery is not payment evidence.
4. Build the roadmap. Defaults should select the 6-XLM IAM lab and 8-XLM cloud course from different demo providers. The 14-XLM billing practice exam is safely blocked by the 10-XLM purchase cap. This is an application-rule block, not a fabricated failed on-chain transaction.
5. Approve Testnet rules. In authorization, sign device registration, agent policy, and the 20-XLM learning escrow deposit. Your 10-XLM exam reserve stays outside escrow. Use the existing owner where appropriate. If a previous experiment or grant blocks this flow, stop and reconcile it; do not create a wallet or reset financial tables to bypass spending limits.
6. Open **Purchases → Start agent** once. The worker checks and authorizes resources, claims provider batches, reconciles events, and releases sample demo codes only after verified eligibility. Network fees and service fee are outside the learning budget.
7. Observe actual authorization/claim hashes and Testnet explorer links. Expect two providers, 14 test XLM settled spending, 0 pending after full settlement, 6 remaining purchasing capacity, and 10 protected reserve. These figures are expectations from demo data, not a statement that the payments occurred.
8. Unknown transactions retain commitments and pause new Noir submissions. Do not blindly re-fund, clear a lock, reset a grant, or reauthorize after timeout. Allow reconciliation or inspect the exact known hash. Code/history should distinguish planned, reserved, authorized, claim pending, claimed and fulfilled.

## 6. Generate genuine evidence and reconcile it

Run the report ON the host/container that owns the persistent database, not against an unrelated laptop database:

```powershell
docker compose exec app npm run evidence:reconcile
```

For Render use the service's **Shell** on its real disk-backed instance (not an ephemeral one-off job):

```sh
npm run evidence:reconcile
```

The default production output is `/var/data/testnet-reconciliation.json`. It includes only public transaction references, resource/provider IDs and verification results; no session token, signed XDR, secret or sample code. It rechecks Noir transaction status and exact authorization/claim events, batch membership/amounts, provider pending balances, owner setup events, Velo intent/payment amount and identity, the stored authenticated receipt association, and the Testnet transfer. The webhook HMAC is checked at receipt; the report does not manufacture a fresh signature.

A successful complete-flow result requires the SAME grant to have verified service payment, all owner setup evidence, two settled/fulfilled providers, and a stored blocked alternative. Exit code 0 means complete acceptance with no report issues; 1 means an inconsistency/RPC problem; 2 means acceptance is still incomplete. Existing simulation rows can never satisfy these checks. Missing or old RPC history requires manual evidence review; it is not proof of success.

Copy the reviewed sanitized report into submission evidence only after real verification. For Docker you can retrieve it privately:

```powershell
docker compose cp app:/var/data/testnet-reconciliation.json artifacts/testnet-reconciliation.json
```

Update README live website/video/proof references only with actual values. Friendbot account funding is setup evidence, not an agent-made resource purchase.

## 7. Backups and operational checks

Create a consistent SQLite backup using the backup API (not a plain copy of the live WAL file):

```powershell
docker compose exec -e BACKUP_PATH=/var/data/backups/pathwise-before-demo.sqlite app npm run backup:db
```

Keep backups private, retain an off-machine copy, and never put them in Git. Restore only with spending paused and the app stopped, and reconcile against chain state before re-enabling. Restoring an old database can forget newer transactions; do not infer that missing rows mean nothing was spent.

Health: `GET /api/health` returns 200 only when SQLite is readable and the worker heartbeat is healthy; 503 signals degraded readiness. This does not mean all payments are complete. Logs contain timestamp, fixed event name, request ID, fixed operation and status only. No request body/header/query, raw SDK message, stack, key, token or XDR is logged. Errors are correlated by X-Request-Id. Clock skew or a mismatched Velo secret causes signature rejection; missing origin/disk/runtime setup refuses startup. Unknown financial outcomes remain stored for manual/worker reconciliation.

Automated checks:

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
npm.cmd run audit:secrets
docker compose config --no-env-resolution --quiet
```

The supported local runtime can be used without altering your system:

```powershell
$env:PATH = (Join-Path (Get-Location) '.tools/node') + ';' + $env:PATH
& .tools/node/node.exe 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' test
```

Current result: local container build and 19 simulation/restart checks passed as recorded in release-preparation.md. Public URL and live-wallet journey remain unverified. No paid service, real-money payment, public repository, or successful live purchase was invented.

Run the reconciliation report when the queue has settled (or with new spending paused), since chain state can still advance beyond the report's consistent local database snapshot. Review any mismatch before re-enabling writes.
