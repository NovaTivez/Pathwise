# Stitch redesign implementation

The supplied `stitch_pathwise_certification_learning_platform.zip` is the visual reference. Its HTML is reference material, not an executable dependency. Extracted references remain in ignored `artifacts/stitch-reference/`.

## Screen mapping

| Export | Working implementation |
| --- | --- |
| `pathwise_home` | `HomeView.tsx`: editorial hero, example roadmap, filterable career cards, and separate payment explanations; `App.tsx`: light navigation |
| `setup_plan` | `GoalView.tsx`: four-step progression, validated live fields, and budget allocation ledger |
| `my_roadmap` | `RoadmapView.tsx`: purple next-step panel, catalog-backed recommendations, budget summary, and milestone cards |
| `purchases_wallet` | `PurchaseOverview.tsx`, `PurchaseCard.tsx`, `DashboardView.tsx`, `ActivityView.tsx`, and the existing wallet/service/authorization screens |

The workspace uses the export's lavender sidebar and top track bar. `stitch.css` supplies the shared colors, typography, controls, responsive layouts, and semantic resource accents across empty, blocked, loading, and pending states as well.

## Intentional data adaptations

- The actual supported purchasing track remains AWS Certified Cloud Practitioner, not the export's Solutions Architect example.
- Amounts remain exact test XLM, not the export's USD/USDC examples.
- There are no invented learner names, avatars, pass rates, exam scores, progress percentages, block numbers, testimonials, or transaction records.
- The reserve remains outside learning escrow; no voucher guarantee, automatic exam booking, readiness threshold, refund mechanism, or zero-knowledge claim is introduced.
- Velo's service fee is visibly separate from Noir's learning allowance.
- Purchase receipts, preview eligibility, and owner signing continue to depend on the existing backend states. No payment action runs from navigation or refresh.
- Backend contracts, webhook verification, persistence, and duplicate protection were not changed for this redesign.

## Local assets and dependencies

The export's Tailwind CDN script, remote profile pictures, and Material Symbols font are not loaded. Icons are local React SVGs in `Icon.tsx`.

The only new external downloads are Plus Jakarta Sans and Inter font files from Google's font hosting and their SIL Open Font License notices from the official `google/fonts` repository. Files are served locally from `apps/web/public/fonts/`; the browser does not fetch Google Fonts at runtime. No new npm dependency is required.

## Onboarding recovery

Steps have meaningful hashes such as `#careers?step=skills` and `#careers?step=budget`. Browser history changes only the screen, never submits a payment. A validated draft is retained in session storage to preserve fields on refresh; it contains career, timeline, skills, format preferences and budget fields, never wallet keys or signed transactions. Session tokens remain outside URLs.

## Verification scope

Automated rendering/helper checks cover all four setup fields, recommendation branches, payment prerequisites, pending and fulfilled purchase states, draft validation, and step URL round trips. Backend tests cover restart persistence, webhook verification, ambiguous transaction reconciliation, reserve protection, and duplicate starts.

The browser-control host was unavailable, and native Computer Use subsequently stopped because it could not determine the browser URL confidently enough to enforce policy. No safeguard was bypassed. Desktop/mobile browser walkthroughs and fresh screenshots therefore remain unverified, despite responsive styles and automated checks. No actual Testnet checkout or wallet transaction was submitted during the redesign.

Local verification on November 9, 2026: 191 rendering/helper checks and 20 backend tests passed, as did build, typecheck, secret scan and whitespace checks. Lint completed with three existing warnings. The local frontend and bundled font URLs returned HTTP 200, and backend health reported payments paused. An explicitly simulated API run selected the 8 + 6 test-XLM resources, preserved the 10 test-XLM reserve, completed without transaction hashes or sample codes, and did not create extra orders on repeated start. A fully reserved budget selected no paid resources.

The root local environment has Noir agent and provider configuration, but payments remain disabled and the Velo checkout API key, webhook signing secret and project ID are missing. The isolated local preview intentionally loads no payment credentials and has no verified owner wallet. Live verification requires the configured teammate backend (or privately completed local settings and webhook), followed by owner-wallet approvals on the pinned Stellar Testnet deployment. Do not enable payment execution merely to preview the redesign.
