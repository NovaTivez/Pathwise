import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { Account, Keypair, Networks, Operation, TransactionBuilder, rpc } from '@stellar/stellar-sdk'
import { keypairSigner } from '@noirx402/agent-sdk'
import type { NoirEvent } from '@noirx402/agent-sdk'
import type { PaymentIntent } from '@carts1024/velo-sdk'
import { createApp } from './app.ts'
import { paymentConfig, supportedNode } from './payment-config.ts'
import type { NoirPort } from './noir.ts'
import type { VeloPort } from './velo.ts'

test('SDK runtime requirements and missing setup fail closed', () => {
  assert.equal(supportedNode('24.14.1'), false)
  assert.equal(supportedNode('24.22.1'), true)
  assert.equal(supportedNode('22.23.4'), true)
  const config = paymentConfig({})
  assert.equal(config.paymentsEnabled, false, 'new Testnet writes must require explicit opt-in')
  assert.equal(paymentConfig({ NODE_ENV: 'development' }).paymentsEnabled, false)
  assert.equal(paymentConfig({ PAYMENTS_ENABLED: 'true' }).paymentsEnabled, true)
  assert.equal(config.network.networkPassphrase, Networks.TESTNET)
  assert.equal(config.network.rpcUrl, 'https://soroban-testnet.stellar.org')
  assert.ok(paymentConfig({ NOIR_DEVICE_REGISTRY: config.network.contracts.agentRegistry, NOIR_APPROVAL_REFERENCE: 'arbitrary override' }).noirProblems.some(p => p.includes('handbook-selected')))
  assert.ok(config.noirProblems.some(p => p.includes('agent')))
  assert.ok(config.veloProblems.length >= 3)
})

test('synthetic integration: verified challenge, session-bound checkout, raw HMAC webhooks and aggregate Noir reconciliation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pathwise-payments-'))
  const owner = Keypair.random(), attacker = Keypair.random(), agent = Keypair.random(), merchant = Keypair.random()
  const config = paymentConfig({ PAYMENTS_ENABLED: 'true', NOIR_AGENT_SECRET: agent.secret(), NOIR_PROVIDER_SECRET: merchant.secret(), VELO_API_KEY: 'tk_test_synthetic_fixture', VELO_WEBHOOK_SECRET: 'test-only-hmac-secret', VELO_PROJECT_ID: 'project-test' })
  // Explicit test dependency injection; no HTTP flag can bypass the production runtime guard.
  config.noirProblems = []
  let intent: PaymentIntent | undefined
  let failCreate = true
  const keys: string[] = []
  const velo: VeloPort = {
    checkout: { sessions: { async create(params, options) {
      keys.push(options!.idempotencyKey!)
      intent = { id: 'pi_fixture', paymentIntentId: 'pi_fixture', object: 'payment_intent', status: 'pending', amount: params.amount, asset: params.asset!, description: params.description!, checkoutUrl: 'https://www.velo-build.dev/checkout/pi_fixture', successUrl: params.successUrl!, cancelUrl: params.cancelUrl!, expiresAt: new Date(Date.now() + 3600000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      if (failCreate) { failCreate = false; throw new Error('Synthetic lost create response') }
      return intent
    } } },
    paymentIntents: { async retrieve() { return { ...intent! } }, async create() { throw new Error('unused') }, async list() { return { object: 'list', data: [], hasMore: false, nextCursor: null } } },
  }
  const events: NoirEvent[] = []
  const calls: string[] = []
  let pending = 0n, ownerRegistered = false, policyRegistered = false, funded = false
  let loseAuthorizationResponse = true, loseClaimResponse = true
  let currentExperiment: { device_hash: string; expires: number; limit_amount: string } | undefined
  let sequence = 0
  const transaction = (source: string) => new TransactionBuilder(new Account(source, String(sequence++)), { fee: '100', networkPassphrase: Networks.TESTNET }).addOperation(Operation.manageData({ name: 'synthetic-test-only', value: 'fixture' })).setTimeout(300).build()
  const noir: NoirPort = {
    server: {
      getLatestLedger: async () => ({ sequence: 100, id: 'fixture', protocolVersion: 23 }),
      getTransaction: async () => ({ status: rpc.Api.GetTransactionStatus.SUCCESS, txHash: '', latestLedger: 100, latestLedgerCloseTime: 0, oldestLedger: 1, oldestLedgerCloseTime: 0 }),
    },
    prepare: async source => transaction(source).toXDR(),
    submit: async xdr => {
      if (!ownerRegistered) ownerRegistered = true
      else if (!policyRegistered) policyRegistered = true
      else funded = true
      return TransactionBuilder.fromXDR(xdr, Networks.TESTNET).hash().toString('hex')
    },
    getDeviceOwner: async () => ownerRegistered ? owner.publicKey() : null,
    getPolicy: async () => policyRegistered ? { agent: agent.publicKey(), asset: config.asset, maxAmount: BigInt(currentExperiment!.limit_amount), expiresAt: new Date(Math.floor(currentExperiment!.expires / 1000) * 1000) } : null,
    getEscrowBalance: async () => funded ? 80000000n : 0n,
    getEscrowToken: async () => funded ? config.asset : null,
    getPendingBalance: async () => pending,
    checkPayment: async () => { calls.push('checkPayment'); return { ok: true } },
    authorizePayment: async params => {
      calls.push('authorizePayment')
      const signed = await params.agent.signTransaction(transaction(agent.publicKey()).toXDR(), { networkPassphrase: Networks.TESTNET })
      const xdr = typeof signed === 'string' ? signed : signed.signedTxXdr
      const hash = TransactionBuilder.fromXDR(xdr, Networks.TESTNET).hash().toString('hex')
      pending += params.amount
      events.push({ id: 'auth-fixture', type: 'payment.authorized', deviceHash: params.deviceHash, merchant: params.merchant, amount: params.amount, txHash: hash, contractId: config.network.contracts.paymentEscrow, ledger: 101, ledgerClosedAt: new Date().toISOString() })
      if (loseAuthorizationResponse) { loseAuthorizationResponse = false; throw new Error('Synthetic timeout after signing authorization') }
      return { hash, nonce: params.nonce! }
    },
    claim: async params => {
      calls.push('claim')
      const signed = await params.merchant.signTransaction(transaction(merchant.publicKey()).toXDR(), { networkPassphrase: Networks.TESTNET })
      const xdr = typeof signed === 'string' ? signed : signed.signedTxXdr
      const hash = TransactionBuilder.fromXDR(xdr, Networks.TESTNET).hash().toString('hex')
      events.push({ id: 'claim-fixture', type: 'payment.claimed', merchant: merchant.publicKey(), amount: pending, txHash: hash, contractId: config.network.contracts.paymentEscrow, ledger: 102, ledgerClosedAt: new Date().toISOString() })
      pending = 0n
      if (loseClaimResponse) { loseClaimResponse = false; throw new Error('Synthetic timeout after signing claim') }
      return { hash }
    },
    pastEvents: async () => events,
  }
  let verifiedLedgerCalls = 0
  const { app, db } = createApp(join(dir, 'test.sqlite'), 'http://localhost:5173', { config, velo, noir, verifyVeloLedger: async () => { verifiedLedgerCalls++ } })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  async function api(path: string, token = '', body?: unknown) {
    const response = await fetch(base + '/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, data: await response.json() }
  }
  function sign(xdr: string, key = owner) { const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET); tx.sign(key); return tx.toXDR() }
  function event(id: string, patch: Record<string, unknown> = {}) {
    return { version: '1', id, type: 'payment.succeeded', test: false, sentAt: new Date().toISOString(), project: { id: 'project-test', registryProjectId: 'registry-test', name: 'test', slug: 'test' }, paymentIntent: { id: intent!.id, amount: intent!.amount, asset: intent!.asset, description: intent!.description, merchantName: 'Pathwise test', status: 'paid', txHash: 'a'.repeat(64), createdAt: intent!.createdAt, updatedAt: intent!.updatedAt }, ...patch }
  }
  async function hook(value: unknown, signatureValid = true, timestamp = Math.floor(Date.now() / 1000)) {
    // Deliberate whitespace verifies the HTTP route uses the original raw bytes.
    const raw = JSON.stringify(value, null, 2)
    const hmac = createHmac('sha256', config.velo.webhookSecret).update(`${timestamp}.${raw}`).digest('hex')
    const response = await fetch(base + '/api/webhooks/velo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-velo-signature': `t=${timestamp},v1=${signatureValid ? hmac : '0'.repeat(64)}`, 'x-velo-delivery': `delivery-${(value as { id: string }).id}` }, body: raw })
    return { status: response.status, data: await response.json() }
  }
  try {
    const session = (await api('session', '', {})).data.token
    const other = (await api('session', '', {})).data.token
    const setupText = JSON.stringify((await api('setup', session)).data)
    for (const secret of [agent.secret(), merchant.secret(), config.velo.apiKey, config.velo.webhookSecret]) assert.ok(!setupText.includes(secret), 'setup screen must not expose secrets')
    const saved = (await api('plans', session, { goal: 'AWS Certified Cloud Practitioner', skills: [], formats: ['course'], budget: '30', limit: '10', reserve: '10' })).data
    const challenge = (await api('wallet/challenge', session, { owner: owner.publicKey() })).data
    assert.equal((await api('wallet/verify', other, { id: challenge.id, signedXdr: sign(challenge.xdr) })).status, 400)
    assert.equal((await api('wallet/verify', session, { id: challenge.id, signedXdr: sign(challenge.xdr, attacker) })).status, 400)
    assert.equal((await api('wallet/verify', session, { id: challenge.id, signedXdr: sign(challenge.xdr) })).status, 200)
    assert.equal((await api('wallet/verify', session, { id: challenge.id, signedXdr: sign(challenge.xdr) })).status, 400)
    assert.equal((await api('noir/approve', session, { planId: saved.id })).status, 400)
    assert.equal((await api('service/checkout', other, { planId: saved.id })).status, 400)
    assert.equal((await api('service/checkout', session, { planId: saved.id, amount: '0', asset: 'evil' })).status, 400)
    assert.equal((await api('service/checkout', session, { planId: saved.id })).status, 200)
    assert.equal(intent!.amount, '1')
    await api('service/checkout', session, { planId: saved.id })
    assert.equal(keys.length, 2)
    assert.equal(keys[0], keys[1], 'lost checkout responses reuse the persisted idempotency key')
    assert.equal((await api('setup', other)).data.checkout, null)
    assert.equal((await hook(event('bad-signature'), false)).status, 401)
    assert.equal((await hook(event('stale'), true, 1)).status, 401)
    assert.equal((await hook(event('wrong-project', { project: { id: 'other', registryProjectId: 'x', name: 'x', slug: 'x' } }))).status, 503)
    assert.equal((await hook(event('wrong-amount', { paymentIntent: { ...event('x').paymentIntent, amount: '2' } }))).status, 503)
    assert.equal((await hook(event('wrong-asset', { paymentIntent: { ...event('x').paymentIntent, asset: 'USDC' } }))).status, 503)
    assert.equal((await hook(event('wrong-intent', { paymentIntent: { ...event('x').paymentIntent, id: 'unlinked' } }))).status, 503)
    intent!.status = 'paid'
    await api('service/refresh', session, {})
    assert.equal((await api('setup', session)).data.checkout.active, false, 'API status alone cannot activate service')
    intent!.status = 'pending'
    db.prepare("UPDATE service_checkouts SET status='paid' WHERE intent_id=?").run(intent!.id) // Recovered create response alone is not verified payment proof.
    assert.equal((await hook(event('early-success'))).status, 200)
    assert.equal((await api('setup', session)).data.checkout.active, false, 'signed event cannot activate while API status is pending')
    intent!.status = 'paid'
    await api('service/refresh', session, {})
    assert.equal((await api('setup', session)).data.checkout.active, true, 'API paid status activates only after the earlier signed success event')
    assert.equal((await hook(event('malformed-success', { paymentIntent: { ...event('x').paymentIntent, status: 'pending' } }))).status, 503)
    assert.equal((await hook(event('changed-hash', { paymentIntent: { ...event('x').paymentIntent, txHash: 'b'.repeat(64) } }))).status, 503)
    // A second checkout may not reuse the first checkout's ledger proof.
    const otherPlan = (await api('plans', other, { goal: 'AWS Certified Cloud Practitioner', skills: [], formats: ['course'], budget: '30', limit: '10', reserve: '10' })).data
    db.prepare('INSERT INTO wallet_bindings VALUES (?,?,?)').run(db.prepare('SELECT session_hash FROM learner_plans WHERE id=?').get(otherPlan.id)!.session_hash, attacker.publicKey(), Date.now())
    const otherSession = db.prepare('SELECT session_hash FROM learner_plans WHERE id=?').get(otherPlan.id)!.session_hash
    db.prepare('INSERT INTO service_checkouts (id,session_hash,plan_id,owner,amount,asset,intent_id) VALUES (?,?,?,?,?,?,?)').run('other-checkout', otherSession, otherPlan.id, attacker.publicKey(), '1', 'native', 'pi_other')
    const originalIntent = intent!
    intent = { ...originalIntent, id: 'pi_other', paymentIntentId: 'pi_other', description: 'Pathwise service other-checkout' }
    const reused = event('reused-ledger-proof')
    assert.equal((await hook(reused)).status, 503, 'one transaction cannot activate a second checkout')
    assert.equal((await api('setup', other)).data.checkout.active, false)
    intent = originalIntent
    assert.equal((await hook(event('test-delivery', { test: true }))).status, 200)
    assert.equal(db.prepare('SELECT count(*) AS n FROM velo_events WHERE id=\'test-delivery\'').get()!.n, 1)
    const success = event('paid-fixture')
    assert.equal((await hook(success)).status, 200)
    assert.equal((await hook(success)).data.duplicate, true)
    assert.equal((await hook({ ...success, sentAt: new Date(Date.now() + 1000).toISOString() })).data.duplicate, true, 'delivery envelope timestamps can change on retry')
    assert.equal((await api('setup', session)).data.checkout.active, true)
    assert.ok(verifiedLedgerCalls > 0)
    intent!.status = 'failed'
    await hook(event('late-failure', { type: 'payment.failed', paymentIntent: { ...success.paymentIntent, status: 'failed' } }))
    assert.equal((await api('setup', session)).data.checkout.status, 'paid')
    const experiment = await api('noir/approve', session, { planId: saved.id, merchant: attacker.publicKey(), amount: '999' })
    assert.equal(experiment.status, 200)
    assert.equal(experiment.data.merchant, merchant.publicKey())
    assert.equal(experiment.data.amountStroops, '80000000')
    currentExperiment = db.prepare('SELECT * FROM noir_experiments').get() as unknown as typeof currentExperiment
    assert.equal((await api('noir/run', other, {})).status, 400)
    assert.equal((await api('noir/run', session, {})).status, 400, 'cannot pay before on-chain setup')
    for (const kind of ['registerDevice', 'registerAgent', 'fundEscrow']) {
      const prepared = await api('noir/owner/prepare', session, { kind })
      assert.equal(prepared.status, 200, JSON.stringify(prepared.data))
      assert.equal((await api('noir/owner/submit', other, { id: prepared.data.id, signedXdr: sign(prepared.data.xdr) })).status, 400)
      assert.equal((await api('noir/owner/submit', session, { id: prepared.data.id, signedXdr: sign(prepared.data.xdr, attacker) })).status, 400)
      assert.equal((await api('noir/owner/submit', session, { id: prepared.data.id, signedXdr: sign(prepared.data.xdr) })).status, 200)
    }
    assert.equal((await api('noir/owner/prepare', session, { kind: 'fundEscrow' })).status, 400, 'prevents duplicate escrow deposit')
    const run = await api('noir/run', session, {})
    assert.equal(run.status, 400, 'uncertain submission must not be reported as success')
    assert.equal((await api('setup', session)).data.experiment.state, 'authorizing')
    assert.ok((await api('setup', session)).data.experiment.authorizeHash)
    assert.equal((await api('noir/run', session, {})).status, 400, 'uncertain authorization must not be resent')
    assert.equal((await api('noir/reconcile', session, {})).data.state, 'authorized')
    assert.deepEqual(calls, ['checkPayment', 'authorizePayment'])
    assert.equal((await api('noir/run', session, {})).status, 400)
    pending += 1n
    assert.equal((await api('noir/claim', session, {})).status, 400, 'unknown aggregate balance must not settle an order')
    pending -= 1n
    const claim = await api('noir/claim', session, {})
    assert.equal(claim.status, 400)
    assert.equal((await api('setup', session)).data.experiment.state, 'claim_pending')
    assert.equal((await api('noir/claim', session, {})).status, 400, 'uncertain aggregate claim must not be resent')
    const reconciled = await api('noir/reconcile', session, {})
    assert.equal(reconciled.data.state, 'claimed', JSON.stringify(reconciled.data))
    assert.ok(reconciled.data.claimHash)
    assert.equal((await api('noir/claim', session, {})).status, 400)
    assert.equal((await api('setup', other)).data.experiment, null)
    assert.equal((await api('setup', session)).data.noir.agent, keypairSigner(agent.secret()).publicKey)
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
    db.close(); rmSync(dir, { recursive: true, force: true })
  }
})
