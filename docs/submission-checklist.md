# Submission checklist

**Not submission-ready.** Current verification is based on GitHub main f50361a and [the scoped readiness record](submission-readiness.md). Historical audit statements are not current deployment evidence.

Source: supplied November 5 Builder Handbook, pages 2-3 (mandatory requirements), 10-11 (README/submission), 11-12 (judging); see [deployment/source reference](deployment-reference.md).

| Requirement | Status | Direct evidence | Remaining action |
| --- | --- | --- | --- |
| Public GitHub monorepo | Publicly verified | Anonymous repository metadata and raw README return 200; apps/web, apps/server, root workspaces and lockfile inspected | Review and publish the final documentation changes only when approved |
| Working public website/backend | Public HTTP and simulation verified | Supplied trycloudflare URL; 13 checks passed | Finish browser checks and verify actual storage/worker identity and canonical payment evidence |
| Genuine agent-made Stellar Testnet payment | Unverified: canonical references not supplied | SDK adapter/worker code and synthetic tests; no qualifying reference available to this review | Supply actual agent authorization hash(es) and fresh canonical reconciliation |
| Noir SDK and required contracts | Implemented; reads historically checked; live writes unverified here | Installed/pinned SDK 0.3.0, handbook IDs, owner setup, check/authorize/aggregate-claim paths, receipt tests | Verify owner setup, two-provider authorizations/claims and exact resource/amount/event association on the actual deployment |
| Meaningful Velo integration | Implemented; live service payment unverified here | Pinned SDK alpha, raw signed webhook, narrow compatibility adapter, checkout identity and Testnet-ledger proof, dedup/reuse tests | Verify actual non-test signed receipt plus matching paid API/ledger proof for the same session/plan/owner |
| Testnet-only safeguards | Automatically checked | Fixed selected deployment/network, exact stroops, reserve/expiry/provider/duplicate controls; local payments paused | Recheck the deployed configuration without printing credentials; never use Mainnet or repeat purchases for proof |
| Two-minute demo video | Blocked: no video visible signed out | Supplied folder opens in Incognito with no listed video | Supply a direct playable file link, then check two-minute duration and required content |
| Accessible pitch deck | User confirms it was included in the submission form; not independently inspected | User statement; no deck URL supplied to this reviewer | No additional submission is requested; public access/content remain unverified without the actual link |
| Short write-up | Prepared | submission-writeup.md, consistent with verified code and explicit evidence limits | Final evidence review before manual submission |
| Team roster | User supplied | Hannah Munoz (@Hactivex), Paul Miguel Roa (@rambobambo), Adrian Salim (@psychoscient) | Representative confirms spelling in the form |
| Luma and organizer registration | User-confirmed timely; not independently verified | User explicitly confirmed completion | Retain receipts and confirm supporting per-member requirements; no receipt was inspected here |
| Same-grant acceptance: fee, setup, two providers, claims, fulfillment, refusal | Unverified on canonical host | Automatic/simulation coverage only in this review | Obtain canonical read-only report and compare actual on-chain references; do not reset grants or resubmit purchases |
| All public links / public keyboard and narrow-screen journey | Partially verified | Repository and website HTTP/simulation passed; video folder opens with no visible file; local keyboard/390px checked; deck submission user-confirmed | Video playback/duration, public browser journey and deck content/access remain independently unverified |

## Supporting checks

- Root workspaces, lockfile, build/typecheck and repeatable migrations are implemented. Migration 5 transaction-uniqueness protections remain intact.
- The older 35 UI checks are included in the current 54-check suite. Current baseline has 20 backend tests. Synthetic fixtures and simulations are not payment proof.
- README must retain its 13 required level-two sections and order. The current short write-up, recording script and slide content are prepared; content/scripts do not replace a finished public recording or deck.
- README includes a sanitized current landing capture from the isolated, payment-paused local preview. Older screenshots are historical simulation captures. Verified live-purchase/settlement screenshots remain unavailable to this review.
- Registration-support items (stars/follows/per-member screenshots) and the final manual submission remain user-only confirmations; no receipt or organizer record was inspected.

## User-only next step

The website and public simulation checks are verified; deck submission is confirmed by the user, with content/access unverified. Send the direct video link when ready and the canonical read-only reconciliation report location. No request to resubmit the deck or form is made. Share no credentials, tokens, signed payloads, access codes or database dump. No new purchases are needed merely to inspect existing evidence.

## Deadline and manual submission

The supplied deadline is **November 7, 2026, 12:00 noon Philippine time**. Registration was due November 4, 2026, 11:59 PM Philippine time and was confirmed timely by the user, not independently verified. No extension is inferred. Only the representative submits the real links manually at https://forms.gle/hQ73PnsR1w2YwAq57; the assistant does not submit or contact organizers.
