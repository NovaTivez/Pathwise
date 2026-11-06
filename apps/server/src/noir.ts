import { NoirAgentClient } from '@noirx402/agent-sdk'
import type { NoirOperation, NoirSigner } from '@noirx402/agent-sdk'
import { Keypair, Networks, TransactionBuilder, rpc } from '@stellar/stellar-sdk'
import { createHash, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { paymentConfig } from './payment-config.ts'

type Config = ReturnType<typeof paymentConfig>
type Row = Record<string, string | number | null>
export type NoirPort = Pick<NoirAgentClient, 'prepare' | 'submit' | 'getDeviceOwner' | 'getPolicy' | 'getEscrowBalance' | 'getEscrowToken' | 'getPendingBalance' | 'checkPayment' | 'authorizePayment' | 'claim' | 'pastEvents'> & { server: { getLatestLedger(): Promise<{ sequence: number }>; getTransaction(hash: string): Promise<{ status: rpc.Api.GetTransactionStatus; ledger?: number }> } }
export function noirService(db: DatabaseSync, config: Config, injected?: NoirPort) {
  const client: NoirPort = injected || new NoirAgentClient({ network: config.network })
  function ready(reconciliation = false) {
    if (!reconciliation && !config.paymentsEnabled) throw new Error('Live Testnet writes are paused by the operator.')
    if (config.noirProblems.length) throw new Error(config.noirProblems.join(' '))
  }
  function experiment(session: string) {
    const row = db.prepare('SELECT * FROM noir_experiments WHERE session_hash=?').get(session) as Row | undefined
    if (!row) throw new Error('Approve the fixed demo experiment first.')
    return row
  }
  function lock(holder: string) {
    if (!db.prepare('INSERT OR IGNORE INTO payment_locks VALUES (\'noir\', ?)').run(holder).changes) throw new Error('A Noir operation is pending. Reconcile its transaction before another submission.')
  }
  function unlock(holder: string) { db.prepare('DELETE FROM payment_locks WHERE name=\'noir\' AND holder=?').run(holder) }
  function unchanged(row: Row) {
    if (row.deployment !== JSON.stringify(config.network)) throw new Error('Noir deployment configuration changed. Restore the approved experiment deployment; automatic switching is disabled.')
    const managed = db.prepare('SELECT providers FROM agent_grants WHERE experiment_id=?').get(row.id)
    const expectedMerchant = managed ? (JSON.parse(String(managed.providers)) as { id: string; merchant: string }[]).some(p => p.merchant === row.merchant && config.providers[p.id]?.publicKey === p.merchant) : row.merchant === config.merchant?.publicKey
    if (row.agent !== config.agent?.publicKey || !expectedMerchant || row.asset !== config.asset) throw new Error('Server payment configuration changed. Restore the original keys and asset before continuing.')
    const wallet = db.prepare('SELECT owner FROM wallet_bindings WHERE session_hash=?').get(row.session_hash)
    if (wallet?.owner !== row.owner) throw new Error('Experiment wallet does not match this session.')
  }
  async function authorizedEvent(row: Row) {
    if (!row.authorize_hash) return false
    const events = await client.pastEvents(Number(row.start_ledger))
    return events.some(e => e.type === 'payment.authorized' && e.txHash === row.authorize_hash && e.deviceHash === row.device_hash && e.merchant === row.merchant && e.amount === BigInt(row.amount!))
  }
  function recordingSigner(base: NoirSigner, save: (hash: string) => void): NoirSigner {
    return { publicKey: base.publicKey, async signTransaction(xdr, opts) {
      const signed = await base.signTransaction(xdr, opts)
      const signedXdr = typeof signed === 'string' ? signed : signed.signedTxXdr
      save(TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET).hash().toString('hex'))
      return signedXdr
    } }
  }
  return {
    status(session: string) {
      const row = db.prepare('SELECT * FROM noir_experiments WHERE session_hash=?').get(session) as Row | undefined
      if (!row) return null
      return { id: row.id, planId: row.plan_id, owner: row.owner, deviceHash: row.device_hash, agent: row.agent, merchant: row.merchant, asset: row.asset, amountStroops: row.amount, fundingStroops: row.funding, limitStroops: row.limit_amount, expiresAt: new Date(Number(row.expires)).toISOString(), state: row.state, authorizeHash: row.authorize_hash, claimHash: row.claim_hash, ownerOperations: db.prepare('SELECT id, kind, hash, state FROM owner_operations WHERE experiment_id=? ORDER BY rowid').all(row.id) }
    },
    approve(session: string, planId: unknown) {
      ready()
      const existing = db.prepare('SELECT id FROM noir_experiments WHERE session_hash=?').get(session)
      if (existing) return this.status(session)
      const wallet = db.prepare('SELECT owner FROM wallet_bindings WHERE session_hash=?').get(session)
      const stored = typeof planId === 'string' ? db.prepare('SELECT payload FROM learner_plans WHERE id=? AND session_hash=?').get(planId, session) : null
      if (!wallet || !stored) throw new Error('Verify your wallet and save a plan in this session first.')
      if ([config.agent!.publicKey, config.merchant!.publicKey].includes(wallet.owner as string)) throw new Error('Owner, agent, and provider must be separate accounts.')
      const plan = JSON.parse(stored.payload as string)
      const amount = 80000000n // Fixed demo catalog course; never taken from browser input.
      const available = BigInt(plan.budgetStroops) - BigInt(plan.reserveStroops)
      if (amount > BigInt(plan.limitStroops) || amount > available || plan.skills.includes('Cloud concepts') || !plan.formats.includes('course')) throw new Error('The fixed 8 test XLM cloud course is blocked by this plan’s skills, formats, budget, or per-purchase limit.')
      const checkout = db.prepare('SELECT * FROM service_checkouts WHERE session_hash=? AND plan_id=? AND owner=? AND active=1').get(session, planId as string, wallet.owner)
      if (!checkout) throw new Error('The associated Velo service checkout must be verified before approving purchasing.')
      const id = randomUUID(), device = createHash('sha256').update(`Pathwise virtual demo device:${wallet.owner}:${id}`).digest('hex')
      db.prepare('INSERT INTO noir_experiments (id, session_hash, plan_id, owner, device_hash, agent, merchant, asset, amount, limit_amount, funding, expires, nonce, deployment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, session, planId as string, wallet.owner, device, config.agent!.publicKey, config.merchant!.publicKey, config.asset, amount.toString(), plan.limitStroops, amount.toString(), Date.now() + 3600000, BigInt(Date.now()).toString(), JSON.stringify(config.network))
      return this.status(session)
    },
    async prepareOwner(session: string, kind: unknown) {
      ready()
      const row = experiment(session); unchanged(row)
      if (Number(row.expires) <= Date.now()) throw new Error('Experiment authorization expired.')
      if (!['registerDevice', 'registerAgent', 'fundEscrow'].includes(String(kind))) throw new Error('Unsupported owner operation.')
      const incomplete = db.prepare('SELECT id FROM owner_operations WHERE experiment_id=? AND (state=\'pending\' OR (state=\'prepared\' AND expires>?))').get(row.id, Date.now())
      if (incomplete) throw new Error('Finish or reconcile the existing owner operation first; unsigned preparations expire after five minutes.')
      const completed = db.prepare('SELECT id FROM owner_operations WHERE experiment_id=? AND kind=? AND state=\'confirmed\'').get(row.id, String(kind))
      if (completed) throw new Error('This owner operation was already confirmed. Do not fund twice.')
      let op: NoirOperation
      if (kind === 'registerDevice') op = { kind, deviceHash: String(row.device_hash), agent: String(row.agent) }
      else {
        if (await client.getDeviceOwner(String(row.device_hash)) !== row.owner) throw new Error('Register this device with the verified owner wallet first.')
        if (kind === 'registerAgent') op = { kind, deviceHash: String(row.device_hash), agent: String(row.agent), asset: config.asset, maxAmount: BigInt(row.limit_amount!), expiresAt: new Date(Number(row.expires)) }
        else op = { kind: 'fundEscrow', deviceHash: String(row.device_hash), token: config.asset, amount: BigInt(row.funding!) }
      }
      lock(String(row.id))
      try {
        const xdr = await client.prepare(String(row.owner), op)
        const id = randomUUID(), hash = TransactionBuilder.fromXDR(xdr, Networks.TESTNET).hash().toString('hex')
        db.prepare('INSERT INTO owner_operations VALUES (?, ?, ?, ?, ?, \'prepared\', ?)').run(id, row.id, String(kind), xdr, hash, Date.now() + 300000)
        return { id, xdr, hash, networkPassphrase: Networks.TESTNET }
      } finally { unlock(String(row.id)) }
    },
    async submitOwner(session: string, operationId: unknown, signedXdr: unknown) {
      ready()
      const row = experiment(session); unchanged(row)
      const operation = typeof operationId === 'string' ? db.prepare('SELECT * FROM owner_operations WHERE id=? AND experiment_id=?').get(operationId, row.id) : null
      if (!operation || operation.state !== 'prepared' || Number(operation.expires) <= Date.now() || typeof signedXdr !== 'string') throw new Error('Owner operation expired, used, or not found.')
      if (Number(row.expires) <= Date.now()) throw new Error('Experiment authorization expired.')
      const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET)
      if (tx.hash().toString('hex') !== operation.hash || !tx.signatures.some(sig => Keypair.fromPublicKey(String(row.owner)).verify(tx.hash(), sig.signature()))) throw new Error('Wallet signature or transaction does not match the prepared operation.')
      lock(String(row.id))
      db.prepare('UPDATE owner_operations SET state=\'pending\' WHERE id=?').run(operation.id)
      try {
        const hash = await client.submit(signedXdr)
        db.prepare('UPDATE owner_operations SET state=\'confirmed\' WHERE id=?').run(operation.id)
        unlock(String(row.id))
        return { hash }
      } catch { throw new Error('Owner submission outcome needs reconciliation. The stored transaction hash is available; do not submit a new funding transaction.') }
    },
    async run(session: string) {
      ready()
      const row = experiment(session); unchanged(row)
      if (db.prepare('SELECT id FROM agent_grants WHERE experiment_id=?').get(row.id)) throw new Error('This device belongs to the purchasing agent. Use Start agent; the legacy fixed-purchase endpoint is disabled.')
      if (row.state !== 'planned') throw new Error('This experiment has already started. Refresh or reconcile; do not submit again.')
      if (Number(row.expires) <= Date.now()) throw new Error('Experiment authorization expired.')
      if (!db.prepare('SELECT id FROM service_checkouts WHERE session_hash=? AND plan_id=? AND owner=? AND active=1').get(session, row.plan_id, row.owner)) throw new Error('Verified service payment is required.')
      lock(String(row.id))
      let signed = false
      try {
        const owner = await client.getDeviceOwner(String(row.device_hash))
        const policy = await client.getPolicy(String(row.device_hash))
        if (owner !== row.owner || policy?.agent !== row.agent || policy.asset !== row.asset || policy.maxAmount !== BigInt(row.limit_amount!) || !policy.expiresAt || policy.expiresAt.getTime() > Number(row.expires) || policy.expiresAt.getTime() <= Date.now()) throw new Error('On-chain owner or policy differs from the approved experiment.')
        if (await client.getEscrowToken(String(row.device_hash)) !== row.asset) throw new Error('Escrow asset mismatch.')
        const check = await client.checkPayment({ deviceHash: String(row.device_hash), agent: String(row.agent), asset: String(row.asset), amount: BigInt(row.amount!) })
        if (!check.ok) { db.prepare('UPDATE noir_experiments SET state=\'blocked\' WHERE id=?').run(row.id); throw new Error(`Noir blocked purchase: ${check.reason}`) }
        const ledger = (await client.server.getLatestLedger()).sequence
        db.prepare('UPDATE noir_experiments SET state=\'authorizing\', start_ledger=? WHERE id=?').run(ledger, row.id)
        const signer = recordingSigner(config.agent!, hash => { signed = true; db.prepare('UPDATE noir_experiments SET authorize_hash=? WHERE id=?').run(hash, row.id) })
        const result = await client.authorizePayment({ agent: signer, deviceHash: String(row.device_hash), merchant: String(row.merchant), asset: String(row.asset), amount: BigInt(row.amount!), nonce: BigInt(row.nonce!) })
        const fresh = experiment(session)
        if (fresh.authorize_hash !== result.hash || !await authorizedEvent(fresh)) throw new Error('Authorization is awaiting event reconciliation.')
        db.prepare('UPDATE noir_experiments SET state=\'authorized\' WHERE id=?').run(row.id)
        unlock(String(row.id))
        return this.status(session)
      } catch (error) {
        if (!signed) { db.prepare('UPDATE noir_experiments SET state=CASE WHEN state=\'authorizing\' THEN \'planned\' ELSE state END WHERE id=?').run(row.id); unlock(String(row.id)) }
        throw error
      }
    },
    async claim(session: string) {
      ready()
      const own = experiment(session); unchanged(own)
      if (db.prepare('SELECT id FROM agent_grants WHERE experiment_id=?').get(own.id)) throw new Error('The server worker reconciles purchasing-agent claims; the legacy claim endpoint is disabled.')
      if (own.state !== 'authorized') throw new Error('Only an authorized experiment can request provider settlement.')
      const batchId = randomUUID()
      lock(batchId)
      let signed = false
      try {
        const rows = db.prepare('SELECT * FROM noir_experiments WHERE merchant=? AND state=\'authorized\' AND claim_hash IS NULL').all(own.merchant) as Row[]
        const sum = rows.reduce((n, r) => n + BigInt(r.amount!), 0n)
        const pending = await client.getPendingBalance(String(own.merchant))
        if (sum === 0n || pending !== sum) throw new Error('Aggregate pending balance differs from the known authorized orders. Manual reconciliation is required; no order is marked claimed.')
        const ledger = (await client.server.getLatestLedger()).sequence
        const signer = recordingSigner(config.merchant!, hash => {
          signed = true
          db.exec('BEGIN IMMEDIATE')
          try { for (const row of rows) db.prepare('UPDATE noir_experiments SET state=\'claim_pending\', claim_hash=?, claim_amount=?, claim_start=? WHERE id=?').run(hash, sum.toString(), ledger, row.id); db.exec('COMMIT') }
          catch (error) { db.exec('ROLLBACK'); throw error }
        })
        await client.claim({ merchant: signer, token: config.asset })
        const fresh = experiment(session)
        const events = await client.pastEvents(ledger)
        if (!events.some(e => e.type === 'payment.claimed' && e.txHash === fresh.claim_hash && e.merchant === own.merchant && e.amount === sum)) throw new Error('Claim transaction awaits aggregate event reconciliation.')
        db.prepare('UPDATE noir_experiments SET state=\'claimed\' WHERE claim_hash=?').run(fresh.claim_hash)
        unlock(batchId)
        return this.status(session)
      } catch (error) { if (!signed) unlock(batchId); throw error }
    },
    async reconcile(session: string) {
      ready(true)
      const row = experiment(session); unchanged(row)
      const operations = db.prepare('SELECT * FROM owner_operations WHERE experiment_id=? AND state=\'pending\'').all(row.id)
      for (const op of operations) {
        const tx = await client.server.getTransaction(String(op.hash))
        if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) { db.prepare('UPDATE owner_operations SET state=\'confirmed\' WHERE id=?').run(op.id); unlock(String(row.id)) }
        else if (tx.status === rpc.Api.GetTransactionStatus.FAILED) { db.prepare('UPDATE owner_operations SET state=\'failed\' WHERE id=?').run(op.id); unlock(String(row.id)) }
      }
      if (row.state === 'authorizing' && row.authorize_hash) {
        const tx = await client.server.getTransaction(String(row.authorize_hash))
        if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS && await authorizedEvent(row)) { db.prepare('UPDATE noir_experiments SET state=\'authorized\' WHERE id=?').run(row.id); unlock(String(row.id)) }
        else if (tx.status === rpc.Api.GetTransactionStatus.FAILED) { db.prepare('UPDATE noir_experiments SET state=\'failed\' WHERE id=?').run(row.id); unlock(String(row.id)) }
      }
      if (row.state === 'claim_pending' && row.claim_hash) {
        const tx = await client.server.getTransaction(String(row.claim_hash))
        const events = tx.status === rpc.Api.GetTransactionStatus.SUCCESS ? await client.pastEvents(Number(row.claim_start)) : []
        if (events.some(e => e.type === 'payment.claimed' && e.txHash === row.claim_hash && e.merchant === row.merchant && e.amount === BigInt(row.claim_amount!))) {
          db.prepare('UPDATE noir_experiments SET state=\'claimed\' WHERE claim_hash=?').run(row.claim_hash)
          db.prepare('DELETE FROM payment_locks WHERE name=\'noir\'').run()
        } else if (tx.status === rpc.Api.GetTransactionStatus.FAILED) {
          db.prepare('UPDATE noir_experiments SET state=\'authorized\', claim_hash=NULL WHERE claim_hash=?').run(row.claim_hash)
          db.prepare('DELETE FROM payment_locks WHERE name=\'noir\'').run()
        }
      }
      return this.status(session)
    },
  }
}
