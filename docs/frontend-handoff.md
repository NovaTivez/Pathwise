# Career journey frontend handoff

This change is frontend-focused. The teammate's unpublished Noir/Velo backend is not present in this checkout and has not been overwritten. No credentials, backend contracts, migrations or payment execution rules are changed. Local verification keeps PAYMENTS_ENABLED=false. No live transaction or public deployment is claimed.

## What works against the current backend

Home → Careers → Cloud Engineer → skills → timeline → budget → server-priced resource comparison → existing authorization and purchase views. The backend remains the authority for purchases and receipt states. Cloud preferences use the existing plan, preview, wallet, service, owner-operation and agent endpoints. The timeline is currently a suggested frontend study schedule; the old server does not use it for paid-resource eligibility.

The navigation stays sticky and Activity appears only for stored orders or a service transaction. Activity and roadmap receipts link only actual stored valid transaction hashes to Stellar Expert Testnet. They distinguish authorization from provider claim and fulfillment. Simulation retains explicit labels at execution/receipt boundaries, without adding a badge to every public landing section.

Data Analyst and the other new careers have local, rule-based milestone/free-reference previews when the backend does not advertise support. These are explicitly labeled planning previews. They create no server checkout, order, transaction, spending grant or fulfillment. Guidance is stored in this browser tab's sessionStorage. Certification names are reference links, not purchasable commercial exam seats or invented vouchers. Exam reserve amounts are user-selected test XLM, not real-world fee estimates.

## Integrating the teammate's backend

1. Keep its current wallet/session verification, Velo raw signed webhook/ledger proof, selected Noir deployment, exact amounts, atomic commitments and reconciliation intact. Merge frontend files rather than replacing the backend or environment.
2. GET /api/agent/catalog can advertise `careers: [{id,name,description,goal,skills}]`. IDs used by this frontend are cloud, software, data, security, support, network, undecided. Advertising a career means its server validation, planning and catalog are genuinely implemented; do not advertise a stub.
3. POST /api/plans receives existing fields plus `career` and numeric `timelineWeeks` (4, 8, 12 or 24). Return/persist both, validate the career/goal/skills mapping, and retain legacy plans. Keep budgets exact on the server. For non-cloud supported careers, reject unknown mappings rather than silently using AWS rules.
4. POST /api/agent/preview retains the existing decisions/outcome/remaining/reserve fields. Optional `steps: [{order,skill,weekStart,weekEnd,resourceIds,action}]` and `freeResources: [{resourceId,title,url,reason}]` let the server replace local guidance. Enforce relevance, prerequisites and timeline on the server before payments. A purchased prerequisite is not necessarily a learned skill. Free resources must never become paid orders.
5. Resource metadata can include `kind` (prep-course, certification-exam, free-resource), career IDs, prerequisites, duration and a vetted HTTPS reference URL. Keep all purchases fictional Testnet demos and no real enrollment. Never trust browser catalog prices, merchant addresses or receipt states.
6. GET /api/agent/status may include stored `decisions: [{resourceId,providerId,priceStroops,state,reason}]` so skipped explanations survive reload. Without this extension the frontend safely recomputes comparisons via the existing preview endpoint; it does not invent historical refusals.
7. The current backend has no safe explicit retry endpoint. No speculative retry button was added. Before adding one, independently confirm on-chain failure, archive the previous attempt, atomically re-reserve budget and recheck owner/session/provider/expiry; pending and unknown outcomes must remain blocked. Do not retry by sending Start again or resetting a grant.

## Acceptance on the integrated backend

Run build/typecheck/lint, backend tests and scripts/verify-learning-ui.mjs. Open localhost:5173 from the root dev command. Choose Cloud, Start from scratch, 12 weeks, budget 30 / reserve 10 / cap 10. Review the backend's actual picks and skipped alternatives. A lower usable allowance than the cheapest eligible price must produce no paid purchase and a free reference. Switch to Data Analyst and confirm different skill milestones and references. Non-cloud payment remains disabled until server support is advertised and verified.

On the teammate's approved deployed origin, independently verify one Velo service payment, owner device/policy/escrow signatures, agent authorization, provider claim, fulfillment and saved receipt. Record the genuine explorer references and compare them with the canonical database. Do not mark this acceptance complete from this frontend work or local fixtures.

Design reference: DataCamp's clear career-track discovery and learning-platform hierarchy, inspected at https://www.datacamp.com/. Pathwise uses its own paper, aubergine, lilac and chartreuse palette, original CSS roadmap preview, copy and components; no DataCamp branding, testimonials or activity were copied.

## Checks performed for this frontend change

- Production build, workspace typecheck and frontend lint passed; 49 UI rendering/helper checks and all 17 existing backend tests passed. The source/bundle secret audit found no configured-secret or private-key matches. These are scoped checks, not a complete security certification.
- Actual local browser walkthrough: landing, Cloud selection, beginner skill option, timeline, budget and generated Cloud roadmap with backend-selected cloud prep course/lab. Sticky navigation remained visible while scrolling. A 390-pixel responsive preview showed the mobile menu and complete onboarding; switching to Data Analyst generated different milestones and a clearly labeled payment-disabled planning preview.
- An independent localhost API check verified that a 30/10/10 Cloud plan has eligible paid resources, while a 10/9/10 plan selects none and keeps its reserve. No payment was submitted by either check.
- Basic Tab navigation showed a visible focus outline on the beginner option. This was not a full assistive-technology audit. No genuine payment, deployed teammate backend, provider fulfillment or public URL was verified in this frontend pass.
