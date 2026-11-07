# Pathwise: a brighter place to learn

## Visual direction

Warm off-white content, dark plum reading text, purple actions and a compact plum navigation bar. The next-step feature is the other deliberate dark surface. Course covers use sunny yellow, labs mint and practice exams sky blue. Coral is limited to small illustration details. Do not apply every accent to every component.

Keep the learner-focused shell: My learning path, Explore resources, My resources; a four-stage setup; the saved certification goal; and one state-driven next action. Learning, resource purchases and payment infrastructure remain distinct.

Impeccable and Taste/design-taste-frontend SKILL.md files were not found in the installed skill locations checked. This implementation follows the supplied brief directly. No dependencies, third-party assets or tracking were added.

## Reusable tokens

Tokens live in apps/web/src/index.css.

| Role | Token / value |
| --- | --- |
| Warm canvas | --bg: #FBF8F3 |
| Reading surface | --surface: #FFFEFD |
| Quiet lavender / selected | --sidebar: #F1EDF7 / --raised: #EEE5FC |
| Primary / secondary text | --text: #30213F / --muted: #685D73 |
| Primary / hover | --accent: #6935C5 / --accent-hover: #5525A8 |
| Links / focus | --accent-light: #6030AE / --focus: #6935C5 |
| Navigation | --nav: #281A38 |
| Subtle / control boundary | --border: #DFD6E5 / --control-border: #908399 |
| Course cover / ink | #FFEDB2 / #654616 |
| Lab cover / ink | #D9EEE6 / #245B4D |
| Practice cover / ink | #DCECFB / #265B81 |
| Coral detail | #ECA58E |
| Success | #245C42 on #DEF2E7 |
| Warning | #78501C on #FFF0CB |
| Error | #942B43 on #FCE7EB |

System sans-serif, --font-body 14px, headings --font-heading 32-46px, 1.8 reading line height. Tabular numerals for prices. Spacing tokens: 8, 12, 16, 24, 32, 48px. Radius tokens: control 8px, card 16px, feature 20px. Motion: --motion-fast 150ms and a restrained ease-out curve. No remote fonts.

## Illustrations and interactions

Illustrations.tsx contains original local SVG: a bookmarked cloud-learning book, a hands-on lab laptop, a practice-question sheet and a curved certification path. SubjectIcon provides the matching small-format icons. All decorative SVG is hidden from assistive technology. Decorative path numbers and practice-sheet ticks are not learner progress or completed milestones.

Faint dot grids appear only in illustration areas; labels have solid backing and body copy stays on plain surfaces. Course/lab/practice colors remain consistent across covers, format tiles and purchased-resource badges. The real learning sequence has numbered markers and a subtle dashed connector; it never marks learning as completed.

Selected tiles change border/background clearly. When motion is allowed, resource-cover illustrations lift by 3px with a small rotation on hover. Reduced-motion disables all animations and transitions, and hover transforms are only defined under prefers-reduced-motion: no-preference. Wallet actions are never delayed. No success celebration is attached to simulation or to unverified payment state.

## Resource and budget conventions

- The new-learner headline is "Your next milestone starts here." The initial action is "Build my learning path"; the final server save remains separate from the intermediate form stages. Stage position is accurate, not certification completion.
- ResourceCard shows real catalog title, format, provider, skills, exact demo price, selection reason where applicable, and actual purchase classification. Stored order amounts take precedence over current catalog price for existing purchases.
- Each card offers an accessible native "Preview this resource" disclosure. It shows skill coverage and the actual demonstration fulfillment description, without access codes or purchase authorization. Existing orders also offer "View in My resources". Catalog browsing has no unchecked purchase route.
- No durations, ratings, reviews, enrollment counts, discounts, provider partnerships or learning outcomes were invented.
- BudgetSummary keeps available capacity and protected exam reserve visible. Pending commitments and settled spending remain separately labeled in the expandable breakdown. Capacity excludes reserve, commitments, settled spending and simulated allocations. The Velo service fee stays separate.
- The budget step uses plain XLM allocation copy (no inset demo explainer). Testnet context remains in the app header/footer and authorization flow. Simulation explicitly says no funds move. Owner keys remain in the wallet.
- Sample access still requires the existing authorized + claimed + fulfilled eligibility check. Only actual saved hash fields produce Testnet explorer links. Purchased resources are never presented as completed learning.

## Accessibility and responsive rules

Native buttons, selects, checkboxes, details/summary, explicit labels, fieldsets, current-page/current-step markers and an ordered sequence. The skip link and 3px purple focus outline remain; dark navigation and featured areas use a contrasting light focus ring. Status colors always include text. Touch targets remain at least 44px; inputs are 48px.

Desktop uses a centered workspace, three-column catalog and contextual budget aside. Mid-width uses two catalog columns. Below 800px, content stacks; below 560px the compact menu, resource list, filters and budget fields are single-column. Narrow covers may shrink beside their format labels. Account disclosures are bounded to the mobile viewport. Amounts, evidence and long labels wrap.

Measured contrast (WCAG relative-luminance formula): primary/panel 14.73:1; secondary/panel 6.13:1; main text/canvas 14.01:1; white/purple button 7.20:1; link/lavender 6.81:1; control boundary/panel 3.54:1; course format 7.38:1; lab 6.47:1; practice 6.02:1; success 6.69:1; warning 6.27:1; error 6.62:1; featured body copy 10.44:1. These token checks are not a complete accessibility audit.

## Actual verification

- Observed actual Chrome screenshots of the bright returning-learner path and catalog, including illustrated covers, readable prices, visible preview disclosures and two/three-column desktop compositions. The three-column composition was shown in the browser's 1363px responsive preview.
- The direct browser host is unavailable. Native mobile sizing controls failed to target reliably with a cached-state error. No reliable new mobile screenshot, complete keyboard traversal or full no-overflow audit was completed. Do not claim those passed.
- Backend health at localhost:5180/api/health returned status 200 and payments paused. The displayed Testnet mode was existing browser state; no payments were enabled or submitted by this redesign.
- Local server-rendered checks cover exact budgets, empty/loading/disconnected/blocked states, catalog filters, preview disclosures, hidden decorative SVG, correct saved prices, absence of invented evidence and fulfillment gating. They are fixtures, not live payment proof.

Run the checks using the supported workspace Node:

    .\.tools\node\node.exe scripts/verify-learning-ui.mjs

Run the existing build/typecheck/lint and secret scan with .tools/node prepended to PATH. No environment credentials are needed for rendering checks. Existing agent tests use synthetic ports and temporary fixtures, not live transactions.

## Manual review still required

Open http://localhost:5180 while the existing local preview runs. The preview backend uses its separate ignored artifacts/frontend-review.sqlite database. Do not reset it or enable payments.

1. In Chrome Responsive mode, check 390, 768 and 1440 CSS-pixel widths at readable zoom. Inspect setup, spending settings, path, catalog and My resources for clipping and horizontal overflow. Pay attention to account menu bounds, long amounts, format labels and card disclosures.
2. Tab through the top/mobile navigation, My space, inputs, format tiles and resource previews. Use Enter/Space, go Back between setup stages and verify choices remain. Confirm visible focus on both dark and light backgrounds.
3. In a separate browser session, verify the welcome headline and Build my learning path action. Use budget 30, reserve 10, limit 10, all formats and no known skills. Confirm the exact usable estimate is 20, and that invalid decimals/reserve above budget produce understandable errors.
4. Save, compare recommendations, inspect the next action and Why this fits you, and expand skipped alternatives. Stay in simulation, approve the rules and start the simulated agent only if desired. Expected default result: two simulated orders, allocation 14, protected reserve 10, capacity 6, settled spending zero, no hashes or access codes. This is not payment evidence.
5. Combine catalog filters, test no matches, clear filters, and open a resource preview. Its description must come from the catalog and must not reveal an access code. Check that browsing never creates a purchase.
6. Inspect disconnected Testnet setup without connecting/signing. Confirm limits, escrow and the separate Velo fee are explained before execution. Keep payments paused.
7. Check actual empty/error/blocked states where available; never create synthetic successful payment records for screenshots. Verify reduced-motion prevents hover movement and that purchases are not labeled completed learning.

No backend logic, contract IDs, wallet signing, session boundaries, webhook verification, budget enforcement or records were changed. No database was reset, no public deployment or tunnel started, and no paid resource or third-party decorative download was used.
