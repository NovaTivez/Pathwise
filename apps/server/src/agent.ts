import { NoirAgentClient } from '@noirx402/agent-sdk'
import type { NoirSigner } from '@noirx402/agent-sdk'
import { Networks, TransactionBuilder, rpc } from '@stellar/stellar-sdk'
import { createHash, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { readCatalog, seedCatalog, skillMap } from './catalog.ts'
import { planPurchases } from './planner.ts'
import type { Learner } from './planner.ts'
import type { paymentConfig } from './payment-config.ts'
import type { NoirPort } from './noir.ts'

type Config = ReturnType<typeof paymentConfig>
type Mode = 'simulation' | 'testnet'
type Grant = { id: string; session_hash: string; plan_id: string; mode: Mode; owner: string; providers: string; snapshot: string; expires: number; experiment_id: string | null; started: number }
type Order = { id: string; grant_id: string; mode: Mode; owner: string; resource_id: string; provider_id: string; merchant: string | null; asset: string; amount: string; coverage: string; status: string; reason: string; authorization_state: string; claim_state: string; fulfillment_state: string; nonce: string; authorize_hash: string | null; start_ledger: number; batch_id: string | null; code: string | null }
type Batch = { id: string; merchant: string; asset: string; amount: string; status: string; hash: string | null; start_ledger: number }
type Experiment = { id: string; owner: string; device_hash: string; agent: string; asset: string; limit_amount: string; deployment: string; expires: number }
const holdsBudget = (o: Order) => !['blocked', 'failed'].includes(o.status)
export function agentService(db: DatabaseSync, config: Config, injected?: NoirPort) {
  const client: NoirPort = injected || new NoirAgentClient({ network: config.network })
  seedCatalog(db, config.providers)
  function mode(value: unknown): Mode { if (value !== 'simulation' && value !== 'testnet') throw new Error('Choose simulation or testnet explicitly.'); return value }
  function plan(session: string, id: unknown): Learner {
    const row = typeof id === 'string' ? db.prepare('SELECT payload FROM learner_plans WHERE id=? AND session_hash=?').get(id, session) : null
    if (!row) throw new Error('Plan not found in this session.')
    return JSON.parse(String(row.payload))
  }
  function owner(session: string, m: Mode) {
    if (m === 'simulation') return `simulation:${session}`
    const row = db.prepare('SELECT owner FROM wallet_bindings WHERE session_hash=?').get(session)
    if (!row) throw new Error('Verify the owner wallet first.')
    return String(row.owner)
  }
  function providers(value: unknown) {
    if (!Array.isArray(value) || !value.length || value.length > 3 || new Set(value).size !== value.length || value.some(v => typeof v !== 'string' || !readCatalog(db).providers.some(p => p.id === v))) throw new Error('Approve one or more catalog provider IDs; merchant addresses cannot be supplied.')
    return value as string[]
  }
  function orders(grantId: string) { return db.prepare('SELECT * FROM agent_orders WHERE grant_id=? ORDER BY rowid').all(grantId) as unknown as Order[] }
  function grant(session: string, id: unknown) {
    const row = typeof id === 'string' ? db.prepare('SELECT * FROM agent_grants WHERE id=? AND session_hash=?').get(id, session) as unknown as Grant | undefined : undefined
    if (!row) throw new Error('Agent authorization not found in this session.')
    return row
  }
  function previous(who: string, m: Mode) { return db.prepare('SELECT * FROM agent_orders WHERE owner=? AND mode=?').all(who, m) as unknown as Order[] }
  function service(g: Grant) {
    if (!db.prepare('SELECT id FROM service_checkouts WHERE session_hash=? AND plan_id=? AND owner=? AND active=1').get(g.session_hash, g.plan_id, g.owner)) throw new Error('A verified service payment for this exact plan and owner is required.')
  }
  function liveReady(ids: string[]) {
    if (!config.paymentsEnabled) throw new Error('Live Testnet execution is paused by the operator. Simulation remains available.')
    if (config.noirProblems.length) throw new Error(config.noirProblems.join(' '))
    const addresses = ids.map(id => config.providers[id]?.publicKey)
    if (addresses.some(a => !a) || new Set(addresses).size !== addresses.length || addresses.includes(config.agent!.publicKey)) throw new Error('Approved providers require distinct server-configured merchant keys, separate from the agent.')
  }
  function fresh(g: Grant) {
    if (g.expires <= Date.now()) throw new Error('Owner authorization expired.')
    if (g.mode === 'testnet') {
      if (owner(g.session_hash, g.mode) !== g.owner) throw new Error('Wallet binding changed.')
      liveReady(JSON.parse(g.providers).map((p: { id: string }) => p.id)); service(g)
    }
  }
  function validateOrder(g: Grant, o: Order) {
    fresh(g)
    const r = readCatalog(db).resources.find(r => r.id === o.resource_id)
    const approved = JSON.parse(g.providers) as { id: string; merchant: string | null }[]
    const p = approved.find(p => p.id === o.provider_id)
    if (!r || !p || r.providerId !== o.provider_id || p.merchant !== o.merchant || (g.mode === 'testnet' && config.providers[o.provider_id]?.publicKey !== o.merchant)) throw new Error('Provider is disallowed or its configured merchant changed.')
    const learner = JSON.parse(g.snapshot) as Learner
    const committed = orders(g.id).filter(holdsBudget).reduce((n, order) => n + BigInt(order.amount), 0n)
    if (r.priceStroops !== o.amount || BigInt(o.amount) > BigInt(learner.limitStroops) || committed > BigInt(learner.budgetStroops) - BigInt(learner.reserveStroops)) throw new Error('Current price, purchase cap, budget, or protected reserve check failed.')
  }
  function exp(g: Grant): Experiment {
    const row = db.prepare('SELECT * FROM noir_experiments WHERE id=?').get(g.experiment_id!) as unknown as Experiment | undefined
    if (!row || row.owner !== g.owner || row.agent !== config.agent?.publicKey || row.asset !== config.asset || row.deployment !== JSON.stringify(config.network)) throw new Error('Noir deployment or owner authorization configuration changed.')
    return row
  }
  async function verifyOwner(g: Grant) {
    fresh(g)
    const e = exp(g)
    const [registeredOwner, policy, token] = await Promise.all([client.getDeviceOwner(e.device_hash), client.getPolicy(e.device_hash), client.getEscrowToken(e.device_hash)])
    if (registeredOwner !== g.owner || policy?.agent !== config.agent!.publicKey || policy.asset !== config.asset || policy.maxAmount !== BigInt(e.limit_amount) || !policy.expiresAt || policy.expiresAt.getTime() > g.expires || policy.expiresAt.getTime() <= Date.now() || token !== config.asset) throw new Error('Register the owner device, grant the exact policy, and fund the matching escrow before starting.')
    return e
  }
  function preview(session: string, planId: unknown, providerIds: unknown, m: Mode) {
    const learner = plan(session, planId), ids = providers(providerIds)
    const who = m === 'simulation' ? owner(session, m) : String(db.prepare('SELECT owner FROM wallet_bindings WHERE session_hash=?').get(session)?.owner || `unbound:${session}`)
    const old = previous(who, m).filter(holdsBudget)
    return planPurchases(learner, readCatalog(db).resources, ids, old.map(o => o.resource_id), old.reduce((n, o) => n + BigInt(o.amount), 0n))
  }
  /** Same planner inputs as preview/start: snapshot + current catalog + cross-grant committed purchases for this owner/mode. */
  function roadmapForGrant(g: Grant) {
    const learner = JSON.parse(g.snapshot) as Learner
    const providerRows = JSON.parse(g.providers) as { id: string; merchant: string | null }[]
    const ids = providerRows.map(p => p.id)
    const old = previous(g.owner, g.mode).filter(holdsBudget)
    return planPurchases(learner, readCatalog(db).resources, ids, old.map(o => o.resource_id), old.reduce((n, o) => n + BigInt(o.amount), 0n))
  }
  function status(session: string) {
    const grants = db.prepare('SELECT * FROM agent_grants WHERE session_hash=? ORDER BY rowid DESC').all(session) as unknown as Grant[]
    return grants.map(g => {
      const list = orders(g.id), learner = JSON.parse(g.snapshot) as Learner
      const committed = list.filter(holdsBudget).reduce((n, o) => n + BigInt(o.amount), 0n)
      const sum = (states: string[]) => list.filter(o => states.includes(o.status)).reduce((n, o) => n + BigInt(o.amount), 0n).toString()
      const roadmapFromGrant = roadmapForGrant(g)
      const storedDecisions = db.prepare('SELECT resource_id, provider_id, amount, decision, reason FROM agent_decisions WHERE grant_id=? ORDER BY rowid').all(g.id) as { resource_id: string; provider_id: string; amount: string; decision: string; reason: string }[]
      const decisions = storedDecisions.map(d => ({ resourceId: d.resource_id, providerId: d.provider_id, priceStroops: d.amount, decision: d.decision as 'selected' | 'skipped' | 'blocked', reason: d.reason }))
      return { id: g.id, mode: g.mode, planId: g.plan_id, started: Boolean(g.started), expiresAt: new Date(g.expires).toISOString(), owner: g.owner, providers: JSON.parse(g.providers), totalBudgetStroops: learner.budgetStroops, perPurchaseLimitStroops: learner.limitStroops, pendingStroops: sum(['reserved', 'authorization_pending', 'authorized', 'claim_pending']), spentStroops: sum(['claimed', 'fulfilled']), simulatedStroops: sum(['simulated']), remainingStroops: (BigInt(learner.budgetStroops) - BigInt(learner.reserveStroops) - committed).toString(), reserveStroops: learner.reserveStroops, roadmapFromGrant, decisions, orders: list.map(o => ({ id: o.id, resourceId: o.resource_id, providerId: o.provider_id, amountStroops: o.amount, status: o.status, selectionReason: `Planned to cover ${JSON.parse(o.coverage).join(', ')} within the approved learning allowance and purchase limit.`, reason: o.reason, authorization: o.authorization_state, claim: o.claim_state, fulfillment: o.fulfillment_state, authorizeHash: o.authorize_hash, claimHash: o.batch_id ? db.prepare('SELECT hash FROM agent_claim_batches WHERE id=?').get(o.batch_id)?.hash || null : null, sampleAccessCode: o.fulfillment_state === 'fulfilled' ? o.code : null })) }
    })
  }
  function takeLock(id: string) { return Boolean(db.prepare('INSERT OR IGNORE INTO payment_locks VALUES (\'noir\', ?)').run(id).changes) }
  function release(id: string) { db.prepare('DELETE FROM payment_locks WHERE name=\'noir\' AND holder=?').run(id) }
  function signer(base: NoirSigner, record: (hash: string) => void): NoirSigner {
    return { publicKey: base.publicKey, async signTransaction(xdr, opts) {
      const result = await base.signTransaction(xdr, opts)
      const signed = typeof result === 'string' ? result : result.signedTxXdr
      record(TransactionBuilder.fromXDR(signed, Networks.TESTNET).hash().toString('hex'))
      return signed
    } }
  }
  async function reconcileOrder(o: Order) {
    if (!o.authorize_hash) return // Crash before a hash was saved: manual review, never blind replay.
    const tx = await client.server.getTransaction(o.authorize_hash)
    if (tx.status === rpc.Api.GetTransactionStatus.FAILED) {
      db.prepare('UPDATE agent_orders SET status=\'failed\', authorization_state=\'failed\', reason=\'Authorization failed on chain; no automatic retry.\' WHERE id=?').run(o.id); release(o.id)
    } else if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const g = db.prepare('SELECT * FROM agent_grants WHERE id=?').get(o.grant_id) as unknown as Grant
      const e = exp(g)
      const events = await client.pastEvents(o.start_ledger)
      if (events.some(event => event.type === 'payment.authorized' && event.txHash === o.authorize_hash && event.deviceHash === e.device_hash && event.merchant === o.merchant && event.amount === BigInt(o.amount))) {
        db.prepare('UPDATE agent_orders SET status=\'authorized\', authorization_state=\'authorized\', reason=\'Authorization confirmed by transaction and matching Noir event.\' WHERE id=?').run(o.id); release(o.id)
      }
    }
  }
  async function reconcileBatch(b: Batch) {
    if (!b.hash) return
    const tx = await client.server.getTransaction(b.hash)
    if (tx.status === rpc.Api.GetTransactionStatus.FAILED) {
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare('UPDATE agent_claim_batches SET status=\'failed\' WHERE id=?').run(b.id)
        db.prepare('UPDATE agent_orders SET status=\'authorized\', claim_state=\'failed\', batch_id=NULL, reason=\'Claim failed on chain; a new batch may be attempted.\' WHERE batch_id=?').run(b.id)
        release(b.id); db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
    } else if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const events = await client.pastEvents(b.start_ledger)
      if (!events.some(e => e.type === 'payment.claimed' && e.txHash === b.hash && e.merchant === b.merchant && e.amount === BigInt(b.amount))) return
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare('UPDATE agent_claim_batches SET status=\'claimed\' WHERE id=?').run(b.id)
        db.prepare('UPDATE agent_orders SET status=\'claimed\', claim_state=\'claimed\', reason=\'Aggregate merchant claim confirmed; fulfillment is separate.\' WHERE batch_id=?').run(b.id)
        release(b.id); db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
    }
  }
  async function authorize(o: Order) {
    if (!takeLock(o.id)) return
    if (db.prepare('SELECT status FROM agent_orders WHERE id=?').get(o.id)?.status !== 'reserved') { release(o.id); return }
    let signed = false
    try {
      const g = db.prepare('SELECT * FROM agent_grants WHERE id=?').get(o.grant_id) as unknown as Grant
      validateOrder(g, o)
      const e = await verifyOwner(g)
      const check = await client.checkPayment({ deviceHash: e.device_hash, agent: config.agent!.publicKey, asset: config.asset, amount: BigInt(o.amount) })
      if (!check.ok) throw new Error(`Noir blocked purchase: ${check.reason}`)
      // Freshness is checked again immediately before the transaction can be signed.
      fresh(g)
      const ledger = (await client.server.getLatestLedger()).sequence
      db.prepare('UPDATE agent_orders SET status=\'authorization_pending\', authorization_state=\'pending\', start_ledger=? WHERE id=?').run(ledger, o.id)
      await client.authorizePayment({ deviceHash: e.device_hash, agent: signer(config.agent!, hash => { signed = true; db.prepare('UPDATE agent_orders SET authorize_hash=? WHERE id=?').run(hash, o.id) }), merchant: o.merchant!, asset: config.asset, amount: BigInt(o.amount), nonce: BigInt(o.nonce) })
      await reconcileOrder(db.prepare('SELECT * FROM agent_orders WHERE id=?').get(o.id) as unknown as Order)
    } catch (error) {
      if (!signed) {
        db.prepare('UPDATE agent_orders SET status=\'blocked\', authorization_state=\'blocked\', reason=? WHERE id=?').run(error instanceof Error ? error.message.slice(0, 300) : 'Purchase blocked.', o.id)
        release(o.id)
      } else db.prepare('UPDATE agent_orders SET reason=\'Submission outcome uncertain; retained commitment and hash must be reconciled before any retry.\' WHERE id=?').run(o.id)
    }
  }
  async function claimOrders(merchant: string) {
    const id = randomUUID()
    if (!takeLock(id)) return
    let signed = false
    try {
      const list = db.prepare('SELECT * FROM agent_orders WHERE merchant=? AND status=\'authorized\' AND batch_id IS NULL AND mode=\'testnet\'').all(merchant) as unknown as Order[]
      const amount = list.reduce((n, o) => n + BigInt(o.amount), 0n)
      const provider = Object.values(config.providers).find(p => p?.publicKey === merchant)
      if (!provider || amount <= 0n || await client.getPendingBalance(merchant) !== amount) {
        db.prepare('UPDATE agent_orders SET reason=\'Aggregate merchant balance mismatch or provider unavailable; claim withheld for reconciliation.\' WHERE merchant=? AND status=\'authorized\'').run(merchant)
        release(id); return
      }
      const ledger = (await client.server.getLatestLedger()).sequence
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare('INSERT INTO agent_claim_batches VALUES (?,?,?,?,\'pending\',NULL,?)').run(id, merchant, config.asset, amount.toString(), ledger)
        for (const o of list) db.prepare('UPDATE agent_orders SET status=\'claim_pending\', claim_state=\'pending\', batch_id=? WHERE id=?').run(id, o.id)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      await client.claim({ merchant: signer(provider, hash => { signed = true; db.prepare('UPDATE agent_claim_batches SET hash=? WHERE id=?').run(hash, id) }), token: config.asset })
      await reconcileBatch(db.prepare('SELECT * FROM agent_claim_batches WHERE id=?').get(id) as unknown as Batch)
    } catch {
      if (!signed) {
        db.prepare('UPDATE agent_orders SET status=\'authorized\', claim_state=\'failed\', batch_id=NULL WHERE batch_id=?').run(id)
        db.prepare('UPDATE agent_claim_batches SET status=\'failed\' WHERE id=?').run(id); release(id)
      }
    }
  }
  let ticking = false
  return {
    catalog() { const c = readCatalog(db); return { ...c, resources: c.resources.map(r => ({ ...r, fulfillment: { description: r.fulfillment.description } })), skillMap, prices: 'All prices, original prices, and discounts are fictional demonstration data in Testnet XLM.', engine: 'rule-based; no LLM adapter configured' } },
    preview(session: string, body: Record<string, unknown>) { return preview(session, body.planId, body.providers, mode(body.mode)) },
    status,
    approve(session: string, body: Record<string, unknown>) {
      const m = mode(body.mode), learner = plan(session, body.planId), ids = providers(body.providers), who = owner(session, m)
      const existing = db.prepare('SELECT * FROM agent_grants WHERE session_hash=? AND mode=?').get(session, m) as unknown as Grant | undefined
      if (existing) { if (existing.plan_id !== body.planId) throw new Error('This mode already has an immutable authorization for a different saved plan.'); return status(session) }
      if (m === 'testnet') liveReady(ids)
      const selection = preview(session, body.planId, ids, m)
      if (selection.outcome === 'no_suitable_purchase') throw new Error('No suitable purchase. Nothing is authorized and funds remain unspent.')
      const id = randomUUID(), expires = Date.now() + 3600000
      const approved = ids.map(id => ({ id, merchant: m === 'testnet' ? config.providers[id]!.publicKey : null }))
      const g: Grant = { id, session_hash: session, plan_id: String(body.planId), mode: m, owner: who, providers: JSON.stringify(approved), snapshot: JSON.stringify(learner), expires, experiment_id: m === 'testnet' ? randomUUID() : null, started: 0 }
      if (m === 'testnet') { service(g); if (approved.some(p => p.merchant === who) || config.agent!.publicKey === who) throw new Error('Owner, agent, and demo merchants must be separate accounts.') }
      db.exec('BEGIN IMMEDIATE')
      try {
        if (m === 'testnet') {
          if (db.prepare('SELECT id FROM noir_experiments WHERE owner=?').get(who)) throw new Error('This wallet already has a Phase 2 learning experiment on file. Reconcile or finish that setup with the same owner wallet first; Pathwise cannot open a second concurrent experiment for this address. Do not create a new wallet to bypass this—continue the existing Testnet experiment.')
          const available = (BigInt(learner.budgetStroops) - BigInt(learner.reserveStroops)).toString()
          const device = createHash('sha256').update(`Pathwise learning agent:${who}:${id}`).digest('hex')
          db.prepare('INSERT INTO noir_experiments (id,session_hash,plan_id,owner,device_hash,agent,merchant,asset,amount,limit_amount,funding,expires,nonce,deployment) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(g.experiment_id!, session, g.plan_id, who, device, config.agent!.publicKey, config.providers[ids[0]]!.publicKey, config.asset, available, learner.limitStroops, available, expires, String(Date.now()), JSON.stringify(config.network))
        }
        db.prepare('INSERT INTO agent_grants VALUES (?,?,?,?,?,?,?,?,?,0)').run(id, session, g.plan_id, m, who, g.providers, g.snapshot, expires, g.experiment_id)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return status(session)
    },
    async start(session: string, id: unknown) {
      const g = grant(session, id)
      if (g.started) return status(session)
      fresh(g)
      if (g.mode === 'testnet') await verifyOwner(g)
      db.exec('BEGIN IMMEDIATE')
      try {
        const current = grant(session, id)
        if (current.started) { db.exec('COMMIT'); return status(session) }
        fresh(current)
        const learner = JSON.parse(g.snapshot) as Learner
        const old = previous(g.owner, g.mode).filter(holdsBudget)
        const total = old.reduce((n, o) => n + BigInt(o.amount), 0n)
        const selection = planPurchases(learner, readCatalog(db).resources, JSON.parse(g.providers).map((p: { id: string }) => p.id), old.map(o => o.resource_id), total)
        for (const d of selection.decisions) db.prepare('INSERT INTO agent_decisions VALUES (?,?,?,?,?,?)').run(g.id, d.resourceId, d.providerId, d.priceStroops, d.state === 'selected' ? 'selected' : /limit|Insufficient|not approved/.test(d.reason) ? 'blocked' : 'skipped', d.reason)
        let nonce = BigInt(Date.now())
        for (const decision of selection.decisions.filter(d => d.state === 'selected')) {
          const r = readCatalog(db).resources.find(r => r.id === decision.resourceId)!
          const merchant = (JSON.parse(g.providers) as { id: string; merchant: string | null }[]).find(p => p.id === r.providerId)!.merchant
          db.prepare('INSERT INTO agent_orders (id,grant_id,mode,owner,resource_id,provider_id,merchant,asset,amount,coverage,status,reason,nonce) VALUES (?,?,?,?,?,?,?,?,?,?,\'reserved\',?,?)').run(randomUUID(), g.id, g.mode, g.owner, r.id, r.providerId, merchant, config.asset, r.priceStroops, JSON.stringify(r.skills), decision.reason, String(nonce++))
        }
        db.prepare('UPDATE agent_grants SET started=1 WHERE id=?').run(g.id)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return status(session)
    },
    async tick() {
      if (ticking) return
      ticking = true
      try {
        // Fulfillment happens only after separately reconciled merchant settlement.
        for (const row of db.prepare('SELECT * FROM agent_orders WHERE status=\'claimed\' AND mode=\'testnet\'').all() as unknown as Order[]) {
          const r = readCatalog(db).resources.find(r => r.id === row.resource_id)!
          db.prepare('UPDATE agent_orders SET status=\'fulfilled\', fulfillment_state=\'fulfilled\', code=? WHERE id=? AND claim_state=\'claimed\'').run(`${r.fulfillment.codePrefix}-${row.id.slice(0, 8)}`, row.id)
        }
        const sim = db.prepare('SELECT * FROM agent_orders WHERE mode=\'simulation\' AND status=\'reserved\' ORDER BY rowid LIMIT 1').get() as unknown as Order | undefined
        if (sim) {
          const g = db.prepare('SELECT * FROM agent_grants WHERE id=?').get(sim.grant_id) as unknown as Grant
          try {
            validateOrder(g, sim)
            db.prepare('UPDATE agent_orders SET status=\'simulated\', authorization_state=\'simulated\', claim_state=\'simulated\', fulfillment_state=\'simulation_preview\', reason=\'Simulation only: no transaction, merchant settlement, or access code.\' WHERE id=?').run(sim.id)
          } catch (error) { db.prepare('UPDATE agent_orders SET status=\'blocked\', authorization_state=\'blocked\', reason=? WHERE id=?').run(error instanceof Error ? error.message : 'Blocked.', sim.id) }
        }
        if (config.noirProblems.length) return
        // Durable locks survive restarts. Reconcile known submissions before doing any new work.
        const held = db.prepare('SELECT holder FROM payment_locks WHERE name=\'noir\'').get()
        if (held) {
          const pending = db.prepare('SELECT * FROM agent_orders WHERE id=? AND status=\'authorization_pending\'').get(held.holder) as unknown as Order | undefined
          const batch = db.prepare('SELECT * FROM agent_claim_batches WHERE id=? AND status=\'pending\'').get(held.holder) as unknown as Batch | undefined
          if (pending) await reconcileOrder(pending)
          if (batch) await reconcileBatch(batch)
          return
        }
        if (!config.paymentsEnabled) return // Pause new spending, but reconcile already submitted hashes above.
        const queued = db.prepare('SELECT * FROM agent_orders WHERE status=\'reserved\' AND mode=\'testnet\' ORDER BY rowid LIMIT 1').get() as unknown as Order | undefined
        if (queued) { await authorize(queued); return }
        for (const row of db.prepare('SELECT DISTINCT merchant FROM agent_orders WHERE status=\'authorized\' AND mode=\'testnet\'').all()) {
          await claimOrders(String(row.merchant))
          if (db.prepare('SELECT holder FROM payment_locks WHERE name=\'noir\'').get()) break
        }
      } finally { ticking = false }
    },
  }
}
