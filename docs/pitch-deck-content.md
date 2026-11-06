# Pathwise pitch deck content

Six slides for a five-minute pitch, followed by three minutes of questions. This is slide-ready content and presenter notes, not an exported or publicly shared deck. Use a blank no-charge presentation with original project assets; no paid templates or stock media are needed.

Keep the app's warm off-white, plum and purple identity. Use a small local resource illustration on selected slides. Use 30-36pt titles, 20-24pt body text and plenty of space. No decorative charts, unsupported statistics, fake screenshots or implied partnerships.

## Slide 1 - Pathwise (0:00-0:30)

**On slide**

A purchasing agent for certification learners

Fill skill gaps. Avoid repeated coverage. Protect the exam reserve.

Fictional demo resources - Stellar Testnet only

Team: Hannah Munoz (@Hactivex), Paul Miguel Roa (@rambobambo), Adrian Salim (@psychoscient)

**Presenter notes**

"Pathwise helps learners choose the next useful learning resource without using the money set aside for their exam. The owner sets the spending boundaries; the agent selects and pays within them. Our MVP uses one certification track, fictional providers and test currency."

Source: README Problem/Solution and current implemented catalog. Do not insert a made-up team name or traction figure.

## Slide 2 - Choosing what to buy (0:30-1:10)

**On slide**

- Similar courses can cover the same skills.
- A resource can fit its own price limit but exceed the remaining learning budget.
- Learners need to understand both the selection and the refusal.

One goal: AWS Certified Cloud Practitioner

**Presenter notes**

"We ask what the learner already knows, how they prefer to learn, and how much they want to protect. Our map is a curated demonstration aid, not an official or guaranteed exam syllabus. We focus on the purchasing decision, rather than inventing learning-completion statistics."

Source: learner.ts, planner.ts, catalog.ts. These are product design motivations, not research or adoption statistics.

## Slide 3 - A constrained purchasing decision (1:10-2:05)

**On slide**

Illustrative default plan - not payment proof

30 test XLM total | 10 exam reserve | 10 per-resource cap

IAM essentials lab - Sandbox Grove - 6 test XLM
Cloud foundations course - CloudTrail Academy - 8 test XLM

Skip repeated coverage; block the 14-XLM practice exam

6 remains available after 14 is allocated

**Presenter notes**

"The rule-based planner compares coverage, formats, providers and exact prices. It selects two different providers and avoids overlapping materials. The exam reserve is excluded before planning. The fourteen-XLM practice exam fails the application's per-purchase cap; no on-chain failure or fake transaction is needed to explain that refusal. These amounts become actual proof only when the corresponding real transactions are verified."

Source: actual catalog definitions and planner tests. No LLM, savings statistic, discount or optimality guarantee is claimed.

## Slide 4 - Two payment roles (2:05-3:05)

**On slide**

Velo: separate service checkout -> paid status -> signed raw webhook -> service activation

Noir: owner device/policy/escrow -> agent check/authorize -> provider aggregate claim

Pathwise coordinates them; Velo does not verify Noir escrow

Owner signs in the wallet. Agent/provider keys stay on the server.

**Presenter notes**

"Velo handles the separate service fee, currently one test XLM. We verify its signed event, retrieve its status and check the exact Testnet transfer before activating the associated session and plan. Noir handles the learning-resource escrow. The owner grants the agent policy and funds the learning allowance; after one start, the server checks and authorizes each selected purchase. Each merchant then claims its pending balance. The two systems meet in our application code."

Source: velo.ts, velo-ledger.ts, noir.ts, agent.ts; SDK versions and exact deployed IDs in README. Draw two separate arrows; never imply automatic integration between the vendors.

## Slide 5 - Correctness after the click (3:05-4:05)

**On slide**

- Reserve exact amounts before signing
- Recheck provider, price, expiry and remaining capacity
- Keep pending commitments in the budget
- Reconcile stored hashes before retrying an uncertain transaction
- Unlock sample fulfillment only after verified settlement

Server execution continues independently of the browser

**Presenter notes**

"A double click must not create a second purchase. Reservations and the start marker share one SQLite transaction. We retain uncertain commitments instead of assuming a timeout means failure. Provider claims are aggregate, so we reconcile batch membership and the total rather than inventing one claim receipt for every order. A verified sample code is demonstration fulfillment, not a real course partnership or completed learning."

Source: agent.ts, database.ts and existing concurrency/restart/uncertain-outcome tests. Do not describe application provider rules as an on-chain merchant whitelist.

## Slide 6 - Proof and next steps (4:05-5:00)

**On slide - current truthful state**

Implemented and automatically tested

Testnet reads and existing account balances verified

Actual resource payments, Velo activation and public demo: pending

Next: verify live flow, publish reviewed demo, record genuine evidence

Future: real provider fulfillment, more certification tracks, authorization/session recovery

**Presenter notes**

"We have the working local interface, rule-based agent and SDK integrations, with deterministic correctness tests. We distinguish those from live evidence. At preparation time the owner signing, real Velo payment and public deployment were still pending. We will replace this proof panel only with actual successful transaction and public-site links after verification. No commercial provider integration is claimed."

After the real acceptance flow succeeds, replace only this status panel with the actual public website/repo, agent authorization and merchant claim references, plus a short live demo or the recorded genuine sequence. Leave unsuccessful/pending items labeled. Do not read the success version before it is true.

## Three-minute Q&A preparation

| Question | Grounded answer |
| --- | --- |
| Is the agent an LLM? | No. The active agent is deterministic rule-based planning. A proposal validator exists, but no LLM adapter is configured. |
| Why not a normal checkout? | The learner approves boundaries once; the server chooses eligible resources and submits without a separate owner Pay click per resource. |
| What does Noir enforce? | Agent, asset, per-payment cap, expiry, nonce and available escrow; provider approval and total/reserve/resource rules are additional application checks. |
| What does Velo verify? | The separate service checkout. Pathwise additionally validates the exact Testnet transfer. It does not automatically confirm Noir escrow. |
| Can a timeout cause double payment? | Stored hashes, durable locks and pending commitments are reconciled before retry; unknown results are not blindly resubmitted. Some crash/history cases require manual recovery. |
| Are these real courses? | No. Providers, catalog and fulfillment are demonstration data. Real provider access is future work. |
| Does a purchase mean learning is completed? | No. Purchase, settlement, sample access and learning completion are separate. |
| Will the temporary URL stay online? | Only while the user's computer, server and tunnel remain running. URLs can change; no uptime or organizer-acceptance guarantee is claimed. |

## Exact no-paid-tool export/sharing steps

1. Use an existing free Google Slides, PowerPoint or Canva account/tool. Create a blank 16:9 presentation. If asked to start billing, enter a card or use paid templates/assets, stop.
2. Create six slides using the exact on-slide copy above. Put presenter notes in the notes pane. Use local Pathwise SVG artwork or simple native shapes; preserve the demo/Testnet disclosures. Do not add stock screenshots.
3. Update Slide 6 from verified evidence only. Add the exact team roster after it is supplied. Check every slide at normal presentation size; verify all text fits and no credentials, signed payloads or access codes are visible.
4. Export a PDF (File -> Download/Export -> PDF) and retain an editable copy. Exporting or sharing is not claimed by this Markdown file.
5. Upload/share using a no-charge account. Set view-only access for anyone with the link, then open the link signed out. If access requests or login are required, fix sharing yourself before replacing README's Pending deck link.
6. Keep a local PDF and the genuine demo MP4 on the presentation laptop as a backup. The team representative still submits the final public links manually.

Presentation creation tooling status: the project has no installed local artifact presentation library. Canva generation is available but has an unconfirmed AI-credit cost; it was not invoked under the no-cost boundary. This complete outline is ready for manual no-charge authoring, not an assertion that a shared deck exists.
