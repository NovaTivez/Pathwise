import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Account, Keypair, Networks, Operation, TransactionBuilder, rpc } from '@stellar/stellar-sdk'
import { NoirAgentClient } from '@noirx402/agent-sdk'
import type { NoirEvent } from '@noirx402/agent-sdk'
import { openDatabase } from './database.ts'
import { agentService } from './agent.ts'
import { paymentConfig } from './payment-config.ts'
import { readCatalog } from './catalog.ts'
import { planPurchases, validateSuggestions } from './planner.ts'
import type { Learner } from './planner.ts'
import type { NoirPort } from './noir.ts'
import { noirService } from './noir.ts'
import { reconcileEvidence } from './evidence.ts'
const learner: Learner = { goal: 'AWS Certified Cloud Practitioner', skills: [], formats: ['course', 'lab', 'practice'], budgetStroops: '300000000', limitStroops: '100000000', reserveStroops: '100000000' }
const ids = ['cloudtrail', 'sandbox', 'lantern']
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'pathwise-agent-')), path = join(dir, 'agent.sqlite'), db = openDatabase(path)
  const owner = Keypair.random(), keys = [Keypair.random(), Keypair.random(), Keypair.random(), Keypair.random()]
  const config = paymentConfig({ PAYMENTS_ENABLED: 'true', NOIR_AGENT_SECRET: keys[0].secret(), NOIR_PROVIDER_SECRET: keys[1].secret(), NOIR_PROVIDER_2_SECRET: keys[2].secret(), NOIR_PROVIDER_3_SECRET: keys[3].secret() })
  config.noirProblems = [] // Test-only injected SDK ports; never a request-level configuration override.
  db.prepare('INSERT INTO learner_sessions VALUES (?,?)').run('session', Date.now() + 86400000)
  db.prepare('INSERT INTO learner_plans VALUES (?,?,?,?)').run('plan', 'session', JSON.stringify(learner), new Date().toISOString())
  db.prepare('INSERT INTO wallet_bindings VALUES (?,?,?)').run('session', owner.publicKey(), Date.now())
  db.prepare('INSERT INTO service_checkouts (id,session_hash,plan_id,owner,amount,asset,active) VALUES (\'service-fixture\',\'session\',\'plan\',?,\'1\',\'native\',1)').run(owner.publicKey())
  return { db, config, path, dir, owner, close() { db.close(); rmSync(dir, { recursive: true, force: true }) } }
}

test('curated planner compares gaps, skips overlap and purchases, handles format fallback and validates model proposals', () => {
  const f = fixture()
  try {
    agentService(f.db, f.config)
    const c = readCatalog(f.db).resources
    const result = planPurchases(learner, c, ids)
    const selected = result.decisions.filter(d => d.state === 'selected')
    assert.deepEqual(new Set(selected.map(d => d.resourceId)), new Set(['iam-lab', 'cloud-foundations']))
    assert.equal(result.remainingStroops, '60000000')
    assert.ok(result.decisions.find(d => d.resourceId === 'cloud-refresher')!.reason.includes('Coverage'))
    assert.ok(result.decisions.find(d => d.resourceId === 'billing-practice')!.reason.includes('per-purchase'))
    assert.equal(planPurchases({ ...learner, skills: ['Cloud concepts', 'Security', 'Billing', 'Technology and services'] }, c, ids).outcome, 'no_suitable_purchase')
    assert.ok(planPurchases(learner, c, ids, ['iam-lab'], 60000000n).decisions.find(d => d.resourceId === 'iam-lab')!.reason.includes('Already purchased'))
    const fallback = planPurchases({ ...learner, formats: ['practice'] }, c, ids)
    assert.ok(fallback.decisions.some(d => d.state === 'selected' && d.reason.includes('fallback')))
    for (const bad of [[{ resourceId: 'invented', explanation: 'Buy it' }], [{ resourceId: 'iam-lab', explanation: '' }], [{ resourceId: 'iam-lab', explanation: 'x'.repeat(501) }], [{ resourceId: 'iam-lab', explanation: 'a' }, { resourceId: 'iam-lab', explanation: 'b' }]]) assert.throws(() => validateSuggestions(bad, c))
    assert.equal(planPurchases(learner, c, ids, [], 0n, [{ resourceId: 'billing-practice', explanation: 'Recommended by a model' }]).decisions.find(d => d.resourceId === 'billing-practice')!.state, 'skipped', 'model recommendations cannot bypass spending rules')
  } finally { f.close() }
})

test('status exposes planner roadmap before start and persisted agent decisions after start', async () => {
  const f = fixture()
  try {
    const agent = agentService(f.db, f.config)
    agent.approve('session', { planId: 'plan', mode: 'simulation', providers: ids })
    const before = agent.status('session')[0]
    assert.ok(before.roadmapFromGrant)
    assert.equal(before.started, false)
    assert.equal(before.decisions.length, 0)
    assert.ok(before.roadmapFromGrant.decisions.some(d => d.state === 'selected'))
    assert.ok(before.roadmapFromGrant.decisions.some(d => d.state === 'skipped'))
    const planned = agent.preview('session', { planId: 'plan', providers: ids, mode: 'simulation' })
    assert.deepEqual(before.roadmapFromGrant.decisions.map(d => d.resourceId + d.state), planned.decisions.map(d => d.resourceId + d.state))
    const grantId = before.id
    await agent.start('session', grantId)
    const after = agent.status('session')[0]
    assert.ok(after.started)
    assert.ok(after.decisions.length > 0)
    assert.deepEqual(new Set(after.decisions.map(d => d.decision)), new Set(['selected', 'skipped', 'blocked']))
    const fromRows = f.db.prepare('SELECT decision FROM agent_decisions WHERE grant_id=?').all(grantId) as { decision: string }[]
    assert.deepEqual(new Set(fromRows.map(r => r.decision)), new Set(after.decisions.map(d => d.decision)))
    assert.deepEqual(new Set(after.decisions.filter(d => d.decision === 'selected').map(d => d.resourceId)), new Set(after.orders.map(o => o.resourceId)))
    assert.deepEqual(agent.status('another-session'), [])
    const preview = agent.preview('session', { planId: 'plan', providers: ids, mode: 'simulation' })
    assert.ok(preview.decisions.find(d => d.resourceId === 'iam-lab')!.reason.includes('Already purchased'))
  } finally { f.close() }
})

test('atomic reservation protects total and reserve under concurrent starts, repeated clicks and restart', async () => {
  const f = fixture()
  let other: ReturnType<typeof openDatabase> | undefined
  try {
    const agent = agentService(f.db, f.config)
    const approved = agent.approve('session', { planId: 'plan', mode: 'simulation', providers: ids })[0]
    other = openDatabase(f.path)
    const competing = agentService(other, f.config)
    await Promise.all([agent.start('session', approved.id), competing.start('session', approved.id), agent.start('session', approved.id)])
    assert.equal(agent.status('session')[0].orders.length, 2)
    assert.equal(agent.status('session')[0].remainingStroops, '60000000')
    assert.equal(agent.status('session')[0].pendingStroops, '140000000')
    assert.equal(agent.status('session')[0].spentStroops, '0')
    assert.ok(f.db.prepare("SELECT resource_id FROM agent_decisions WHERE decision='blocked'").all().length > 0)
    assert.equal(agent.status('session')[0].reserveStroops, '100000000')
    await Promise.all([agent.tick(), competing.tick()])
    await competing.tick()
    const restarted = agentService(other, f.config)
    const status = restarted.status('session')[0]
    assert.ok(status.orders.every(o => o.status === 'simulated'))
    assert.equal(status.pendingStroops, '0')
    assert.equal(status.spentStroops, '0')
    assert.equal(status.simulatedStroops, '140000000')
    assert.ok(status.orders.every(o => !o.authorizeHash && !o.claimHash && !o.sampleAccessCode))
    await restarted.start('session', approved.id)
    assert.equal(restarted.status('session')[0].orders.length, 2)
    await assert.rejects(agent.start('another-session', approved.id))
    assert.throws(() => agent.approve('session', { planId: 'plan', mode: 'simulation', providers: ['arbitrary-merchant'] }))
  } finally { other?.close(); f.close() }
})

test('expired rules, disallowed providers, changed prices and oversized commitments block execution', async () => {
  for (const condition of ['expired', 'provider', 'price', 'overspend']) {
    const f = fixture()
    try {
      const agent = agentService(f.db, f.config)
      const g = agent.approve('session', { planId: 'plan', mode: 'simulation', providers: ids })[0]
      await agent.start('session', g.id)
      if (condition === 'expired') f.db.prepare('UPDATE agent_grants SET expires=0').run()
      if (condition === 'provider') f.db.prepare('UPDATE agent_grants SET providers=\'[]\'').run()
      if (condition === 'price') f.db.prepare('UPDATE demo_resources SET price=\'1000000000\'').run()
      if (condition === 'overspend') f.db.prepare('UPDATE agent_orders SET amount=\'1000000000\'').run()
      await agent.tick(); await agent.tick()
      assert.ok(agent.status('session')[0].orders.every(o => o.status === 'blocked'), condition)
      assert.ok(agent.status('session')[0].orders.every(o => !o.authorizeHash && !o.sampleAccessCode))
    } finally { f.close() }
  }
  const f = fixture()
  try {
    const agent = agentService(f.db, f.config)
    const g = agent.approve('session', { planId: 'plan', mode: 'simulation', providers: ['cloudtrail'] })[0]
    f.db.prepare('UPDATE agent_grants SET expires=0').run()
    await assert.rejects(agent.start('session', g.id), /expired/)
    assert.equal(agent.status('session')[0].orders.length, 0)
  } finally { f.close() }
})

test('owner setup supports an approved secondary provider and rejects legacy execution for managed devices', async () => {
  const f = fixture()
  try {
    const agent = agentService(f.db, f.config)
    agent.approve('session', { planId: 'plan', mode: 'testnet', providers: ['sandbox'] })
    const sdk = new NoirAgentClient({ network: f.config.network })
    sdk.prepare = async source => new TransactionBuilder(new Account(source, '0'), { fee: '100', networkPassphrase: Networks.TESTNET }).addOperation(Operation.manageData({ name: 'test-fixture', value: 'never submitted' })).setTimeout(300).build().toXDR()
    const ownerFlow = noirService(f.db, f.config, sdk)
    assert.ok((await ownerFlow.prepareOwner('session', 'registerDevice')).hash)
    await assert.rejects(ownerFlow.run('session'), /purchasing agent/)
    await assert.rejects(ownerFlow.claim('session'), /worker/)
  } finally { f.close() }
})

test('legacy Noir run hides raw SDK text and still reports a safe blocked purchase', async () => {
  const leaking: NoirPort = {
    server: { getLatestLedger: async () => ({ sequence: 1 }), getTransaction: async () => ({ status: rpc.Api.GetTransactionStatus.NOT_FOUND }) },
    prepare: async () => { throw new Error('unused') }, submit: async () => { throw new Error('unused') },
    getDeviceOwner: async () => { throw new Error('RAW-SDK-BODY-xyz') },
    getPolicy: async () => null, getEscrowBalance: async () => 0n, getEscrowToken: async () => 'native',
    getPendingBalance: async () => 0n, checkPayment: async () => ({ ok: true }),
    authorizePayment: async () => { throw new Error('unused') }, claim: async () => { throw new Error('unused') }, pastEvents: async () => [],
  }
  const hidden = fixture()
  try {
    const flow = noirService(hidden.db, hidden.config, leaking)
    flow.approve('session', 'plan')
    await assert.rejects(flow.run('session'), (error: Error) => {
      assert.equal(error.message.includes('RAW-SDK-BODY'), false)
      assert.match(error.message, /could not be completed/)
      return true
    })
  } finally { hidden.close() }
  const blocked = fixture()
  try {
    const rowHolder: { agent?: string; asset?: string; limit_amount?: string; expires?: number; owner?: string } = {}
    const flow = noirService(blocked.db, blocked.config, {
      ...leaking,
      getDeviceOwner: async () => String(rowHolder.owner),
      getPolicy: async () => ({ agent: String(rowHolder.agent), asset: String(rowHolder.asset), maxAmount: BigInt(String(rowHolder.limit_amount)), expiresAt: new Date(Number(rowHolder.expires) - 1000) }),
      getEscrowToken: async () => blocked.config.asset,
      checkPayment: async () => ({ ok: false, reason: 'RAW-SDK-BODY-xyz' }),
    } as unknown as NoirPort)
    flow.approve('session', 'plan')
    Object.assign(rowHolder, blocked.db.prepare('SELECT * FROM noir_experiments').get())
    await assert.rejects(flow.run('session'), (error: Error) => {
      assert.equal(error.message.includes('RAW-SDK-BODY'), false)
      assert.match(error.message, /Noir blocked this purchase/)
      return true
    })
    assert.equal(blocked.db.prepare('SELECT state FROM noir_experiments').get()!.state, 'blocked')
  } finally { blocked.close() }
})

test('synthetic Noir worker reconciles ambiguous outcomes before retry, batches claims, and unlocks fulfillment only after settlement', async () => {
  const f = fixture()
  const events: NoirEvent[] = [], balances = new Map<string, bigint>()
  const calls: string[] = []
  let loseResponse = true, observable = false, sequence = 0, failClaim = true
  const transaction = (source: string) => new TransactionBuilder(new Account(source, String(sequence++)), { fee: '100', networkPassphrase: Networks.TESTNET }).addOperation(Operation.manageData({ name: 'test-only', value: 'synthetic' })).setTimeout(300).build()
  const noir: NoirPort = {
    server: { getLatestLedger: async () => ({ sequence: 100 }), getTransaction: async () => ({ status: observable ? rpc.Api.GetTransactionStatus.SUCCESS : rpc.Api.GetTransactionStatus.NOT_FOUND }) },
    prepare: async source => transaction(source).toXDR(), submit: async () => { throw new Error('Not used by this worker fixture') },
    getDeviceOwner: async device => String(f.db.prepare('SELECT owner FROM noir_experiments WHERE device_hash=?').get(device)!.owner),
    getPolicy: async device => { const row = f.db.prepare('SELECT * FROM noir_experiments WHERE device_hash=?').get(device)!; return { agent: String(row.agent), asset: String(row.asset), maxAmount: BigInt(String(row.limit_amount)), expiresAt: new Date(Math.floor(Number(row.expires) / 1000) * 1000) } },
    getEscrowBalance: async () => 200000000n, getEscrowToken: async () => f.config.asset,
    getPendingBalance: async merchant => balances.get(merchant) || 0n,
    checkPayment: async () => { calls.push('check'); return { ok: true } },
    authorizePayment: async params => {
      calls.push('authorize')
      const result = await params.agent.signTransaction(transaction(params.agent.publicKey).toXDR(), { networkPassphrase: Networks.TESTNET })
      const hash = TransactionBuilder.fromXDR(typeof result === 'string' ? result : result.signedTxXdr, Networks.TESTNET).hash().toString('hex')
      balances.set(params.merchant, (balances.get(params.merchant) || 0n) + params.amount)
      events.push({ id: hash, type: 'payment.authorized', deviceHash: params.deviceHash, merchant: params.merchant, amount: params.amount, txHash: hash, contractId: f.config.network.contracts.paymentEscrow, ledger: 101, ledgerClosedAt: new Date().toISOString() })
      if (loseResponse) { loseResponse = false; throw new Error('Synthetic timeout after submission') }
      return { hash, nonce: params.nonce! }
    },
    claim: async params => {
      calls.push('claim')
      const result = await params.merchant.signTransaction(transaction(params.merchant.publicKey).toXDR(), { networkPassphrase: Networks.TESTNET })
      const hash = TransactionBuilder.fromXDR(typeof result === 'string' ? result : result.signedTxXdr, Networks.TESTNET).hash().toString('hex')
      const amount = balances.get(params.merchant.publicKey)!
      events.push({ id: hash, type: 'payment.claimed', merchant: params.merchant.publicKey, amount, txHash: hash, contractId: f.config.network.contracts.paymentEscrow, ledger: 102, ledgerClosedAt: new Date().toISOString() })
      balances.set(params.merchant.publicKey, 0n)
      if (failClaim) { failClaim = false; throw new Error('Synthetic lost claim confirmation') }
      return { hash }
    }, pastEvents: async () => events,
  }
  try {
    const agent = agentService(f.db, f.config, noir)
    const g = agent.approve('session', { planId: 'plan', mode: 'testnet', providers: ids })[0]
    await Promise.all([agent.start('session', g.id), agent.start('session', g.id)])
    await agent.tick()
    assert.equal(calls.filter(c => c === 'authorize').length, 1)
    assert.equal(agent.status('session')[0].orders[0].status, 'authorization_pending')
    assert.equal(agent.status('session')[0].remainingStroops, '60000000', 'uncertain payments retain the reservation')
    const restarted = agentService(f.db, f.config, noir)
    await restarted.tick(); await restarted.start('session', g.id)
    assert.equal(calls.filter(c => c === 'authorize').length, 1, 'unknown transaction is not resubmitted')
    observable = true
    f.config.paymentsEnabled = false
    await restarted.tick(); await restarted.tick()
    assert.equal(calls.filter(c => c === 'authorize').length, 1, 'pausing stops new writes but permits reconciliation of submitted hashes')
    assert.equal(restarted.status('session')[0].orders[1].status, 'reserved')
    f.config.paymentsEnabled = true
    await restarted.tick()
    assert.equal(calls.filter(c => c === 'authorize').length, 2)
    assert.deepEqual(calls.slice(0, 4), ['check', 'authorize', 'check', 'authorize'])
    assert.ok(restarted.status('session')[0].orders.every(o => o.authorization === 'authorized' && o.sampleAccessCode === null))
    await restarted.tick()
    assert.ok(restarted.status('session')[0].orders.some(o => o.claim === 'pending'))
    assert.ok(restarted.status('session')[0].orders.every(o => o.sampleAccessCode === null))
    for (let i = 0; i < 5; i++) await restarted.tick()
    const final = restarted.status('session')[0]
    assert.equal(final.spentStroops, '140000000')
    assert.equal(final.pendingStroops, '0')
    assert.ok(final.orders.every(o => o.authorization === 'authorized' && o.claim === 'claimed' && o.fulfillment === 'fulfilled'))
    assert.ok(final.orders.every(o => o.sampleAccessCode?.startsWith('DEMO-') && o.claimHash && o.authorizeHash))
    assert.equal(new Set(final.orders.map(o => o.providerId)).size, 2)
    const report = await reconcileEvidence(f.db, f.config, noir)
    assert.ok(report.purchases.every(p => p.authorizationVerified && p.fulfillmentEligible))
    assert.equal(report.acceptance.completeFlowForSameGrant, false, 'synthetic service fixture has no verified Velo receipt or owner setup proof')
    assert.ok(!JSON.stringify(report).includes('session_hash'))
    assert.ok(!JSON.stringify(report).includes(final.orders[0].sampleAccessCode!))
    f.db.prepare("UPDATE agent_claim_batches SET amount='1'").run()
    const mismatch = await reconcileEvidence(f.db, f.config, noir)
    assert.ok(mismatch.issues.some(issue => issue.includes('aggregate proof')))
    assert.ok(mismatch.purchases.every(p => !p.fulfillmentEligible))
    await restarted.start('session', g.id); await restarted.tick()
    assert.equal(calls.filter(c => c === 'authorize').length, 2)
    const before = final.orders[0].resourceId
    assert.equal(restarted.preview('session', { planId: 'plan', providers: ids, mode: 'testnet' }).decisions.find(d => d.resourceId === before)!.state, 'skipped')
  } finally { f.close() }
})
