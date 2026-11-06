# Submission checklist

Audited November 7, 2026, Philippine time. **Not ready for submission.** Status vocabulary: Verified; Implemented but unverified; Missing; Needs user confirmation. A Verified subcomponent does not imply the full live flow is verified.

Source: supplied Builder Handbook, updated November 5; pages 2-3 (six requirements), 10-11 (README/submission), 11-12 (judging). See [source record](deployment-reference.md) and [detailed audit](hackathon-audit.md).

| Requirement | Status | Evidence | Remaining action |
| --- | --- | --- | --- |
| A. Agentic payment | Implemented but unverified | Rule-based planner, atomic server start, autonomous worker checkPayment/authorizePayment; tests and stored simulations | Execute actual agent-made Testnet purchases and record confirmed authorization/claim evidence; no per-resource owner Pay click |
| B. Noir integration on selected deployed contracts, through SDK | Implemented but unverified | SDK 0.3.0; handbook/SDK IDs match; prepare/submit owner setup, check/authorize, aggregate claim; fresh real read probe succeeds | Complete owner device/policy/escrow writes and actual authorization/claim; SDK reads alone are insufficient |
| C. Meaningful Velo integration | Implemented but unverified | SDK 0.1.0-alpha.4; checkout/status/raw signed webhook; independent ledger check; dedup/reuse guards tested | Supply real enabled Testnet credentials, receive a non-test signed event and verify service activation |
| D. Stellar Testnet configuration and safeguards | Verified | Fixed Networks.TESTNET/RPC/native asset, selected contracts only, wallet signing on Testnet; fresh SDK reads succeeded; actual writes default paused | Keep all future transactions on Testnet. This does not certify an unperformed live payment flow |
| E. Public GitHub monorepo | Missing | Root workspaces and one root installation command verified; local Git initialized, no public repository URL | Team creates/publishes a sanitized public repo later; awaiting the final publication decision |
| F. Working live website/backend | Missing | Deployment files exist, but no actual public app URL is provided | Deploy with durable storage and a running worker after explicit authorization/cost review; then check the public URL |
| Local container and persistence | Verified | Approved Node 24.22.2 image build; 19 localhost HTTP/session/simulation/restart checks, private artifacts/container-local-check.json | Public-origin browser journey and webhook remain unverified |
| Root workspaces / one install | Verified | apps/* and packages/* declared; apps/web and apps/server implemented; npm ci at root | Re-run install/run from a clean public clone before submission |
| Required README structure and source links | Verified | All 13 exact level-two sections, opening metadata with honest Pending fields, Mermaid and existing source/line links | Fill pending metadata and proof only after verification; structure is complete, submission data is not |
| Two-minute video showing agent making/requesting payment | Missing | Full timed recording plan exists in docs/demo-script.md; no video or public link yet | Record the genuine Testnet flow, explain agent choices and one blocked alternative, upload and test public access |
| Accessible pitch deck | Missing | Full six-slide content/Q&A exists in docs/pitch-deck-content.md; no exported/shared deck yet | Create a concise deck; set view access for anyone with the link; test in a signed-out browser |
| Short write-up | Verified | docs/submission-writeup.md and README explain the implemented agent and separate payment flows | Review final evidence status before manual submission |
| Team names and Discord handles | Verified | User supplied: Hannah Munoz (@Hactivex), Paul Miguel Roa (@rambobambo), Adrian Salim (@psychoscient) | Confirm spelling again in final manual submission |
| Luma RSVP | Verified | User explicitly confirmed timely completion in the continuation request; receipt not independently inspected | Retain registration confirmation |
| Organizer registration form | Verified | User explicitly confirmed timely completion; no independent organizer record inspected | Retain form confirmation for the registered roster |
| Registration supporting requirements | Needs user confirmation | Handbook page 2 lists repo stars, follows and per-member screenshots | Confirm the registration proof was supplied; no account actions were performed by this audit |
| Genuine agent-made Testnet transaction | Missing | No live authorization references in either inspected application database; Friendbot is setup only | Add at least one actual agent-made Stellar Expert link; project acceptance also asks for two providers, claims, service payment and blocked decision |
| Complete current project Testnet acceptance | Missing | No live wallet bindings, service checkouts, owner operations or claims found | Verify one Velo fee, owner setup, two distinct provider purchases/claims, sample fulfillment and safely blocked purchase; reconcile same-grant evidence |
| Current sanitized repository screenshots | Verified | Genuine local simulation captures in docs/screenshots/goal-setup.png and demo-catalog.png; app-area crops inspected | Actual live purchase/settlement captures remain pending; these images are not payment proof |
| Public accessibility of every submission link | Missing | Public repo/site/video/deck URLs are absent | Test each in a signed-out browser, plus backend health and actual journey; identify any temporary URL |
| Final manual submission by team representative | Needs user confirmation | No form submitted by this audit | Representative submits once at https://forms.gle/hQ73PnsR1w2YwAq57 and retains confirmation |

## Deadlines and eligibility

The supplied handbook deadline is **Saturday, November 7, 2026, 12:00 noon Philippine time (UTC+8)**. Registration was due **Wednesday, November 4, 2026, 11:59 PM Philippine time**, requiring both Luma and the organizer form. Those are distinct deadlines. Coding completion cannot establish registration eligibility or grant an extension.

## User-only next steps

1. **Registration confirmed by the user.** Retain the Luma and organizer-form confirmations. No organizer receipt was independently inspected.
2. **Provide public submission details.** The roster is recorded above. Supply the intended public GitHub repository URL and any real site/video/deck links. Do not send credentials or owner secrets in chat.
3. **Complete Testnet setup privately.** Follow [the current rehearsal guide](testnet-rehearsal.md). Velo's three settings are absent locally; owner signing must happen in the wallet. Keep payments paused until network, accounts, contracts and webhook are verified. The current continuation authorizes deliberate Testnet payments after verification; public access still needs the final release decision.
4. **Arrange public access only after separate approval.** [Deployment preparation](deployment.md) has GitHub/dashboard steps. Do not apply its paid Render blueprint without a funded, explicitly approved budget. If any dashboard requires billing or its cost is unclear, stop. A later temporary local tunnel would require your own computer and internet to stay running; it is not durable cloud hosting and none was started here.
5. **Record and verify the demo/assets.** Capture genuine hashes after success, produce the two-minute video and deck, add sanitized screenshots, and test every public link while signed out.
6. **Submit manually.** The representative checks the completed table, opens the submission form, fills the real links and roster, then submits once before the stated deadline. No assistant submission or outbound message is authorized.

## Judging alignment

| Criterion | Implemented story and proof needed |
| --- | --- |
| Agentic payments fit - 30% | Agent selects gap-filling resources and submits without a human payment click per resource; live transaction proof is still missing |
| Technical execution - 25% | SDK adapters, session/ownership checks, exact accounting, atomic reservations, raw signed webhooks and reconciliation are tested; actual end-to-end Testnet and deployment remain unverified |
| Innovation - 20% | Resource choice is tied to known skills, redundant coverage, provider approval and an exam reserve, rather than a generic checkout |
| Real-world potential - 15% | Limited learning budgets are a concrete use case; real provider fulfillment and more tracks are future work, not existing partnerships |
| Pitch and demo - 10% | README supplies the narrative and honest example; the video, deck and live public journey still need to be delivered |
