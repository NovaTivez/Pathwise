import type { DatabaseSync } from 'node:sqlite'
import { NoirAgentClient } from '@noirx402/agent-sdk'
import { rpc } from '@stellar/stellar-sdk'
import { Velo } from '@carts1024/velo-sdk'
import type { NoirPort } from './noir.ts'
import type { paymentConfig } from './payment-config.ts'
import { verifyVeloLedger } from './velo-ledger.ts'
import { stroops } from './policy.ts'

type Row = Record<string, string | number | null>
const explorer = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`
export async function reconcileEvidence(db: DatabaseSync, config: ReturnType<typeof paymentConfig>, injected?: NoirPort) {
  const noir: NoirPort = injected || new NoirAgentClient({ network: config.network })
  const issues: string[] = []
  const grants = db.prepare("SELECT * FROM agent_grants WHERE mode='testnet'").all() as unknown as Row[]
  const orders = db.prepare("SELECT o.*, e.device_hash, e.deployment FROM agent_orders o JOIN agent_grants g ON g.id=o.grant_id JOIN noir_experiments e ON e.id=g.experiment_id WHERE o.mode='testnet'").all() as unknown as Row[]
  const authorizationProof: Record<string, boolean> = {}, usedHashes = new Set<string>()
  const purchases: { grantId: string; orderId: string; resourceId: string; providerId: string; amountStroops: string; state: string; authorizationHash: string | null; explorer: string | null; authorizationVerified: boolean; fulfillmentEligible: boolean }[] = []
  for (const o of orders) {
    let verified = false
    const hash = o.authorize_hash as string | null
    try {
      if (o.deployment !== JSON.stringify(config.network) || o.asset !== config.asset) throw new Error('Deployment/asset mismatch')
      if (await noir.getEscrowToken(String(o.device_hash)) !== config.asset) throw new Error('On-chain escrow asset differs from the expected native token')
      if (hash) {
        if (usedHashes.has(hash)) throw new Error('Reused authorization hash')
        usedHashes.add(hash)
        const tx = await noir.server.getTransaction(hash)
        if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          const events = await noir.pastEvents(Number(o.start_ledger))
          verified = events.some(e => e.type === 'payment.authorized' && e.txHash === hash && e.deviceHash === o.device_hash && e.merchant === o.merchant && e.amount === BigInt(o.amount!))
        }
      }
      if (['authorized', 'claim_pending', 'claimed', 'fulfilled'].includes(String(o.status)) && !verified) issues.push(`Order ${o.id}: stored authorization lacks current matching on-chain proof.`)
      if (verified && ['blocked', 'failed'].includes(String(o.status))) issues.push(`Order ${o.id}: failed/blocked locally but authorization exists on chain.`)
    } catch { issues.push(`Order ${o.id}: authorization requires manual review (RPC/deployment/evidence unavailable or inconsistent).`) }
    authorizationProof[String(o.id)] = verified
    purchases.push({ grantId: String(o.grant_id), orderId: String(o.id), resourceId: String(o.resource_id), providerId: String(o.provider_id), amountStroops: String(o.amount), state: String(o.status), authorizationHash: hash, explorer: hash ? explorer(hash) : null, authorizationVerified: verified, fulfillmentEligible: false })
  }
  const batches: { hash: string | null; amountStroops: string; verified: boolean; explorer: string | null; memberOrders: string[] }[] = []
  const claimProof: Record<string, boolean> = {}
  for (const b of db.prepare('SELECT * FROM agent_claim_batches').all() as unknown as Row[]) {
    const members = orders.filter(o => o.batch_id === b.id)
    let verified = false
    try {
      if (!members.length || members.some(o => !authorizationProof[String(o.id)] || o.merchant !== b.merchant || o.asset !== b.asset) || members.reduce((sum, o) => sum + BigInt(o.amount!), 0n) !== BigInt(b.amount!) || b.asset !== config.asset) throw new Error('Batch membership mismatch')
      if (b.hash && (await noir.server.getTransaction(String(b.hash))).status === rpc.Api.GetTransactionStatus.SUCCESS) {
        const events = await noir.pastEvents(Number(b.start_ledger))
        verified = events.some(e => e.type === 'payment.claimed' && e.txHash === b.hash && e.merchant === b.merchant && e.amount === BigInt(b.amount!))
      }
      if (b.status === 'claimed' && !verified) issues.push(`Claim batch ${b.id}: stored settlement lacks matching on-chain proof.`)
    } catch { issues.push(`Claim batch ${b.id}: aggregate proof requires manual review.`) }
    claimProof[String(b.id)] = verified
    batches.push({ hash: b.hash as string | null, amountStroops: String(b.amount), verified, explorer: b.hash ? explorer(String(b.hash)) : null, memberOrders: members.map(o => String(o.id)) })
  }
  for (const o of orders) {
    const eligible = authorizationProof[String(o.id)] && Boolean(o.batch_id && claimProof[String(o.batch_id)])
    purchases.find(p => p.orderId === o.id)!.fulfillmentEligible = eligible
    if ((o.code || o.fulfillment_state === 'fulfilled') && !eligible) issues.push(`Order ${o.id}: fulfillment is not supported by current verified authorization and claim evidence.`)
  }
  const providers: { providerId: string; pendingStroops: string | null; knownUnclaimedStroops: string; matches: boolean }[] = []
  for (const [id, signer] of Object.entries(config.providers)) {
    if (!signer) continue
    const expected = orders.filter(o => o.merchant === signer.publicKey && authorizationProof[String(o.id)] && !(o.batch_id && claimProof[String(o.batch_id)])).reduce((sum, o) => sum + BigInt(o.amount!), 0n)
    let pending: bigint | null = null
    try { pending = await noir.getPendingBalance(signer.publicKey) } catch { issues.push(`Provider ${id}: pending balance could not be read.`) }
    if (pending !== null && pending !== expected) issues.push(`Provider ${id}: aggregate pending balance differs from known unclaimed orders; external/legacy payments may need reconciliation.`)
    providers.push({ providerId: id, pendingStroops: pending?.toString() || null, knownUnclaimedStroops: expected.toString(), matches: pending === expected })
  }
  const servicePayments: { grantIds: string[]; intentId: string | null; transactionHash: string | null; explorer: string | null; verified: boolean; signedReceiptRecorded: boolean }[] = []
  const velo = config.velo.apiKey ? new Velo({ apiKey: config.velo.apiKey, environment: 'testnet', baseUrl: config.velo.baseUrl, timeoutMs: 10000, maxRetries: 0 }) : null
  for (const row of db.prepare('SELECT * FROM service_checkouts').all() as unknown as Row[]) {
    let verified = false
    const receipt = Boolean(row.success_event && db.prepare('SELECT id FROM velo_events WHERE id=? AND intent_id=?').get(row.success_event, row.intent_id))
    try {
      if (velo && row.intent_id && row.tx_hash && receipt) {
        const intent = await velo.paymentIntents.retrieve(String(row.intent_id))
        if (intent.id !== row.intent_id || intent.status !== 'paid' || intent.asset !== row.asset || stroops(intent.amount) !== stroops(row.amount) || intent.description !== `Pathwise service ${row.id}`) throw new Error('Checkout mismatch')
        await verifyVeloLedger(intent, String(row.owner), String(row.tx_hash)); verified = true
      }
    } catch { issues.push(`Service checkout ${row.id}: API/Testnet proof could not be reconciled.`) }
    if (row.active && !verified) issues.push(`Service checkout ${row.id}: active locally but live service-payment proof is incomplete.`)
    servicePayments.push({ grantIds: grants.filter(g => g.session_hash === row.session_hash && g.plan_id === row.plan_id && g.owner === row.owner).map(g => String(g.id)), intentId: row.intent_id as string | null, transactionHash: row.tx_hash as string | null, explorer: row.tx_hash ? explorer(String(row.tx_hash)) : null, verified, signedReceiptRecorded: receipt })
  }
  const ownerSetup: { grantId: string; operations: { kind: string; hash: string; explorer: string; verified: boolean }[]; verified: boolean; currentEscrowStroops: string | null; expectedEscrowFromKnownTransactions: string | null }[] = []
  for (const g of grants) {
    const e = db.prepare('SELECT * FROM noir_experiments WHERE id=?').get(g.experiment_id!) as unknown as Row
    const operations: { kind: string; hash: string; explorer: string; verified: boolean }[] = []
    for (const op of db.prepare('SELECT kind,hash FROM owner_operations WHERE experiment_id=?').all(g.experiment_id!) as unknown as Row[]) {
      let verified = false
      try {
        const tx = await noir.server.getTransaction(String(op.hash))
        if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS && tx.ledger) {
          const events = await noir.pastEvents(tx.ledger)
          verified = events.some(event => event.txHash === op.hash && 'deviceHash' in event && event.deviceHash === e.device_hash && (op.kind === 'registerDevice' ? event.type === 'device.registered' && event.agent === e.agent : op.kind === 'registerAgent' ? event.type === 'agent.registered' && event.agent === e.agent : op.kind === 'fundEscrow' && event.type === 'escrow.funded' && event.amount === BigInt(e.funding!)))
        }
      } catch { /* No claim of confirmation without retrievable matching evidence. */ }
      operations.push({ kind: String(op.kind), hash: String(op.hash), explorer: explorer(String(op.hash)), verified })
    }
    let escrow: string | null = null
    try { escrow = (await noir.getEscrowBalance(String(e.device_hash))).toString() } catch { issues.push(`Grant ${g.id}: current escrow could not be read.`) }
    const setupVerified = ['registerDevice', 'registerAgent', 'fundEscrow'].every(kind => operations.some(op => op.kind === kind && op.verified))
    const spent = orders.filter(o => o.grant_id === g.id && authorizationProof[String(o.id)]).reduce((n, o) => n + BigInt(o.amount!), 0n)
    const expected = setupVerified ? (BigInt(e.funding!) - spent).toString() : null
    if (expected !== null && escrow !== null && expected !== escrow) issues.push(`Grant ${g.id}: escrow differs from known funding minus authorizations; check extra funding, withdrawals, or missing records.`)
    ownerSetup.push({ grantId: String(g.id), operations, currentEscrowStroops: escrow, expectedEscrowFromKnownTransactions: expected, verified: setupVerified })
  }
  const blocked = db.prepare("SELECT d.grant_id AS grantId, d.resource_id AS resourceId, d.provider_id AS providerId, d.amount AS amountStroops, d.reason FROM agent_decisions d JOIN agent_grants g ON g.id=d.grant_id WHERE g.mode='testnet' AND d.decision='blocked'").all()
  const verified = purchases.filter(p => p.authorizationVerified && p.fulfillmentEligible)
  const completeGrant = grants.some(g => servicePayments.some(s => s.verified && s.grantIds.includes(String(g.id))) && ownerSetup.some(s => s.grantId === g.id && s.verified) && new Set(verified.filter(p => p.grantId === g.id && p.state === 'fulfilled').map(p => p.providerId)).size >= 2 && blocked.some(b => b.grantId === g.id))
  return { checkedAt: new Date().toISOString(), mode: 'read-only Testnet reconciliation; no transactions submitted', contracts: config.network.contracts, ownerSetup, purchases, claimBatches: batches, servicePayments, providers, safelyBlockedDecisions: blocked, issues, acceptance: { completeFlowForSameGrant: completeGrant, servicePaymentVerified: servicePayments.some(p => p.verified), ownerSetupVerified: ownerSetup.some(s => s.verified), twoProvidersSettled: new Set(verified.map(p => p.providerId)).size >= 2, fulfillmentRecorded: verified.filter(p => p.state === 'fulfilled').length >= 2, blockedPurchaseRecorded: blocked.length > 0 }, note: 'Webhook HMAC was checked at receipt; this report checks the durable receipt association and fresh Velo API/Testnet evidence. No signed payload, secret, session token, or sample code is exported.' }
}
