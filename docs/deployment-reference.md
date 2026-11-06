# Noir working deployment reference

Audited November 7, 2026 (Philippine time).

## Source now inspected

The user supplied **Velo x Noir Agentic Payment Hackathon - Builder Handbook.pdf**, updated **November 5, 2026**. Its original file is available in the user's Downloads directory, outside the repository. All 13 pages' text was extracted and read during this audit; no PDF renderer was available, so this is text inspection, not a page-layout review. No copy of the handbook or its full extracted text is included in the public project.

PDF SHA-256: `ac77495fd5512dc2d62924dbbe9d6fed6b18ea1b64d72a99c010e8a1ba0cd55b`.

Page 6 identifies the October 24 deployment as current and October 7 IDs as retired. It explicitly requires these deployed Testnet contracts. They match the earlier user transcription and the installed SDK's TESTNET object exactly; no override is needed.

| Contract | Selected Testnet ID | Installed SDK 0.3.0 |
| --- | --- | --- |
| device_registry | CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5 | Exact match |
| agent_registry | CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV | Exact match |
| payment_escrow | CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS | Exact match |

## Configuration and verification

- Installed package.json, lockfile and dist/networks.js agree on Noir 0.3.0 and these IDs, the Testnet RPC and Networks.TESTNET passphrase.
- payment-config.ts passes the documented network object to NoirAgentClient. This audit hardened configuration so any different contract ID blocks actual Noir execution even if NOIR_APPROVAL_REFERENCE is supplied. That field is a provenance note only. SDK internals were not changed and no replacement contracts were deployed.
- Experiments snapshot the network object; a changed deployment cannot silently continue an existing experiment.
- The fresh [read-only probe](testnet-probe.json) succeeded against device owner, agent policy and escrow reads on Node 24.22.2. It used an unused all-zero device hash and returned no owner, no policy and zero escrow. This proves read compatibility only.
- The supported workspace-local Node runtime is available. Older documents referring to Node 24.14.1 as the only usable runtime are historical; system Node may remain old, so select .tools/node or install a supported runtime before running commands.

The previously mentioned conflicting event-form deployment IDs have not been supplied, so their contents cannot be independently compared. No separate organizer message was provided. The directly inspected handbook, installed SDK and selected project configuration now agree. Contract existence or an empty balance alone would not establish approval; the requirement source here is the supplied handbook itself.

No owner contract write, actual agent authorization, provider claim or Velo service payment is recorded in the databases inspected by this audit. The current [audit](hackathon-audit.md) and [submission checklist](submission-checklist.md) supersede older implementation-status claims.
