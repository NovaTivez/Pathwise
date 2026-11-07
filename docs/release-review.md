# Proposed public release contents

> Historical snapshot. For the current GitHub-based verification and outstanding evidence, use [submission-readiness.md](submission-readiness.md) and [submission-checklist.md](submission-checklist.md). Older counts, missing-repository statements and local setup results below describe their original inspection only.

This is a local review, not publication approval. No remote, public website or tunnel has been configured.

## Proposed exposure

The exact repository paths below include source, locked dependencies, safe environment templates, deployment scripts, public Testnet addresses and the user-supplied team roster. Screenshots show actual local simulation. Credentials, private reports, databases, backups, session data, signed transactions, the handbook PDF, local runtime, node_modules and generated build output are excluded. Git history and commit author name/email become public if pushed. Review the configured identity privately in artifacts/release-git-metadata.json before publication.

The staged-byte audit checks configured secret values and private-key patterns; it does not guarantee detection of every unknown credential. Private file hashes remain in artifacts/release-manifest.json. This is a newly initialized repository with no earlier project commits.

A separately approved temporary tunnel would expose the frontend, catalog/setup/health metadata, session creation and API routes over HTTPS. Learner records require their originating session. Actual execution additionally requires verified wallet ownership, matching verified service payment and valid spending authorization. The webhook requires raw-body signature verification and independent checkout/ledger proof. Static serving is limited to frontend build files. Local automated tests cover private-file denial, isolation, origins, limits, duplicates and restart persistence. Payments remain paused. The current local-only Compose origin fixture must not be exposed.

Strangers could create sessions and consume this computer's resources. No comprehensive abuse-resistance or complete-security claim is made. The computer, Docker, internet and tunnel must remain running. A changed tunnel hostname requires origin/webhook updates and loses browser-session access at the old origin. Temporary access guarantees neither uptime nor organizer acceptance. No paid service, image push, repository push or tunnel start is authorized by this document.

## Downloads and build actions

The approved local build downloaded official node:24.22.2-bookworm-slim layers and locked npm dependencies. It ran npm ci --include=dev, npm run build, npm run audit:secrets and npm prune --omit=dev. No downloaded script was piped into a shell. No secret was supplied through build arguments. npm installation can run dependency lifecycle hooks; the installed declarations are listed below. The log did not separately trace every hook, so declarations are not proof that each ran. The Cloudflare image download request was rejected and no tunnel was started.

Only pathwise-data is mounted at /var/data. No Docker socket or host folder is mounted; the app is non-root and not privileged. Host port 3000 binds to 127.0.0.1 only; internal port 10000 is routed by Compose. See release-preparation.md for actual local evidence.

## Installed dependency lifecycle declarations

No preinstall/install/postinstall hook was declared in the installed top-level packages inspected on Windows. The lockfile marks optional fsevents 2.3.3 as having an install script; it is a macOS-specific dependency and was not installed in this Windows tree. This inventory does not prove every nested or platform-selected dependency is hook-free.

## Exact proposed repository paths

```text
.dockerignore
.env.example
.env.production.example
.gitignore
.node-version
DESIGN.md
Dockerfile
README.md
apps/server/package.json
apps/server/src/agent.test.ts
apps/server/src/agent.ts
apps/server/src/app.ts
apps/server/src/backup-cli.ts
apps/server/src/catalog.ts
apps/server/src/database.ts
apps/server/src/evidence-cli.ts
apps/server/src/evidence.ts
apps/server/src/index.ts
apps/server/src/learner.test.ts
apps/server/src/learner.ts
apps/server/src/logging.ts
apps/server/src/migrate.ts
apps/server/src/noir.ts
apps/server/src/payment-config.ts
apps/server/src/payments.test.ts
apps/server/src/planner.ts
apps/server/src/policy.test.ts
apps/server/src/policy.ts
apps/server/src/production.test.ts
apps/server/src/rate-limit.ts
apps/server/src/runtime-config.ts
apps/server/src/velo-ledger.test.ts
apps/server/src/velo-ledger.ts
apps/server/src/velo.ts
apps/server/src/wallet.ts
apps/server/src/worker.ts
apps/server/tsconfig.json
apps/web/.gitignore
apps/web/.oxlintrc.json
apps/web/README.md
apps/web/index.html
apps/web/package.json
apps/web/public/favicon.svg
apps/web/public/icons.svg
apps/web/src/App.css
apps/web/src/App.tsx
apps/web/src/AuthorizationView.tsx
apps/web/src/DashboardView.tsx
apps/web/src/ExploreView.tsx
apps/web/src/GoalView.tsx
apps/web/src/Illustrations.tsx
apps/web/src/LearningAgent.tsx
apps/web/src/LearningComponents.tsx
apps/web/src/PaymentSetup.tsx
apps/web/src/RoadmapView.tsx
apps/web/src/assets/hero.png
apps/web/src/assets/react.svg
apps/web/src/assets/vite.svg
apps/web/src/components.tsx
apps/web/src/index.css
apps/web/src/learning.ts
apps/web/src/main.tsx
apps/web/src/ui.ts
apps/web/src/usePathwise.ts
apps/web/tsconfig.app.json
apps/web/tsconfig.json
apps/web/tsconfig.node.json
apps/web/vite.config.ts
compose.local-check.yaml
compose.yaml
docs/demo-script.md
docs/deployment-reference.md
docs/deployment-status.md
docs/deployment.md
docs/hackathon-audit.md
docs/phase2-evidence.md
docs/phase2-setup.md
docs/phase3-agent.md
docs/pitch-deck-content.md
docs/release-preparation.md
docs/release-review.md
docs/screenshots/demo-catalog.png
docs/screenshots/goal-setup.png
docs/submission-checklist.md
docs/submission-writeup.md
docs/testnet-probe.json
docs/testnet-rehearsal.md
package-lock.json
package.json
render.yaml
scripts/audit-secrets.mjs
scripts/dev.mjs
scripts/fund-testnet.mjs
scripts/noir-probe.mjs
scripts/review-release.mjs
scripts/seed-release-volume.mjs
scripts/setup-testnet.mjs
scripts/testnet-readiness.mts
scripts/verify-container-local.mjs
scripts/verify-learning-ui.mjs
scripts/verify-public.mjs
```
