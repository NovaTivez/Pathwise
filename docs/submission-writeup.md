# Pathwise submission write-up

Pathwise helps certification learners choose learning resources without spending the amount reserved for their exam. It addresses two everyday problems: resources that repeat familiar material, and small purchases that together exceed a learner's budget.

The implemented MVP supports one AWS Certified Cloud Practitioner track, four curated skill areas and six resources from three fictional demo providers. The map is a demonstration aid, not an official syllabus. Resources, prices and sample fulfillment are demo data; no commercial course or voucher is sold.

## What the agent decides

The learner supplies familiar skills, preferred formats, approved providers, a total learning budget, a per-resource maximum and an exam reserve. The rule-based server agent chooses eligible resources, their configured merchants and exact prices. It skips overlapping or previously purchased coverage and leaves money unspent when nothing suitable remains. No LLM is configured or claimed.

For the default illustrative plan, 30 test XLM total minus a 10-XLM exam reserve leaves 20 for learning. With a 10-XLM per-resource cap, the planner selects IAM essentials lab (Sandbox Grove, 6) and Cloud foundations course (CloudTrail Academy, 8). It rejects the 14-XLM billing practice exam in the application before payment. Fourteen would be allocated, six would remain available, and the ten-XLM exam reserve would stay outside the learning escrow. These are example/simulation amounts until actual transaction evidence is recorded.

## The two payment roles

Velo provides the separate Pathwise service-fee checkout, currently 1 native test XLM. The backend retrieves its payment status and verifies the signed webhook from the raw body. Service activation requires the matching project, session, plan, owner, intent, amount, asset and description plus an exact successful transfer on Stellar Testnet. A browser redirect cannot activate it, and one transaction cannot activate several checkouts.

Noir governs the educational-resource payments. The owner connects the Noir wallet, signs a one-time ownership challenge and authorizes the selected device, agent policy and learning-escrow deposit through the deployed handbook contracts using @noirx402/agent-sdk. Owner secrets stay in the wallet. The server's constrained agent key checks and authorizes each eligible purchase without a human Pay click per resource. Dedicated demo-provider signers claim aggregate pending balances; Pathwise reconciles exact batch membership and settlement before releasing a sample code.

Velo does not automatically verify Noir escrow activity. The application coordinates the two integrations. All transactions must remain on Stellar Testnet, using free test currency.

## Trustworthy execution

Amounts are integer stroops, not floating-point balances. The backend reserves commitments atomically, checks expiry and provider/price identity again before signing, prevents duplicate resources and repeated starts, and persists transaction hashes before submission. Unknown outcomes keep their commitment and are reconciled before a retry. Purchases, claims, sample fulfillment and learning completion are separate; the app does not infer completed learning from a purchase.

## Evidence and current limits

Implemented and automatically tested: planning, exact budgets/reserve, concurrency and duplicate protection, wallet challenge validation, raw signed webhooks, wrong-payment rejection, aggregate claim recovery and process-restart persistence. On GitHub main f50361a: 20 backend tests and 54 UI checks passed, plus build/typecheck; lint exited successfully with one explorer-link effect warning. See submission-readiness.md for final verification scope.

Historically verified on Testnet: deployed-contract read compatibility and agent/provider account balances. They were not refreshed as purchase evidence in this final review. These are not purchase evidence. Registration was confirmed by the user; no independent registration receipt was inspected.

Team: Hannah Munoz (@Hactivex), Paul Miguel Roa (@rambobambo), Adrian Salim (@psychoscient), supplied by the user.

Still pending: owner wallet connection/signatures, real Velo service payment/webhook, two resource authorizations and provider claims, canonical payment verification and the video (the user will send it later). The public website passed HTTP/simulation checks; pitch-deck submission is user-confirmed, but its content/access were not independently inspected. The source repository is publicly verified at https://github.com/NovaTivez/Pathwise. Replace this paragraph only after genuine evidence is recorded. Public proof belongs in README Testnet proof and docs/phase2-evidence.md; never include credentials, session tokens, signed transactions, access codes or private database contents.

Future work includes real provider fulfillment, additional certification tracks, authorization renewal and wallet/session recovery. No partnerships, adoption, savings or outcomes are claimed.
