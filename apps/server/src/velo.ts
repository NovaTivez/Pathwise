import { Velo } from '@carts1024/velo-sdk'
import type { PaymentIntent, WebhookEvent } from '@carts1024/velo-sdk'
import { createHash, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { stroops } from './policy.ts'
import type { paymentConfig } from './payment-config.ts'
import { verifyVeloLedger } from './velo-ledger.ts'
import type { VeloLedgerVerifier } from './velo-ledger.ts'

type Config = ReturnType<typeof paymentConfig>
type Row = Record<string, string | number | null>
export type VeloPort = Pick<Velo, 'checkout' | 'paymentIntents'>
export function veloService(db: DatabaseSync, config: Config, origin: string, client?: VeloPort, verifyLedger: VeloLedgerVerifier = verifyVeloLedger) {
  const velo = client || (config.veloProblems.length ? null : new Velo({ apiKey: config.velo.apiKey, baseUrl: config.velo.baseUrl, environment: 'testnet', timeoutMs: 10000, maxRetries: 1 }))
  function ready() { if (!velo) throw new Error('Complete Velo setup before creating a checkout.'); return velo }
  function binding(session: string) {
    const wallet = db.prepare('SELECT owner FROM wallet_bindings WHERE session_hash=?').get(session)
    if (!wallet) throw new Error('Verify your owner wallet first.')
    return wallet.owner as string
  }
  function checkout(session: string) {
    return db.prepare('SELECT * FROM service_checkouts WHERE session_hash=?').get(session) as Row | undefined
  }
  function publicCheckout(row: Row) {
    return { id: row.id, planId: row.plan_id, intentId: row.intent_id, checkoutUrl: row.checkout_url, status: row.status, active: Boolean(row.active), amount: row.amount, asset: row.asset, transactionHash: row.tx_hash, verifiedWebhook: Boolean(row.success_event) }
  }
  function validate(row: Row, intent: Pick<PaymentIntent, 'id' | 'amount' | 'asset' | 'description'>) {
    if (intent.id !== row.intent_id || stroops(intent.amount) !== stroops(row.amount) || intent.asset !== row.asset || intent.description !== `Pathwise service ${row.id}`) throw new Error('Velo payment does not match the stored checkout, amount, asset, or description.')
  }
  function saveStatus(row: Row, intent: PaymentIntent, paidProof = false) {
    validate(row, intent)
    if (intent.status === 'paid' && !paidProof) throw new Error('Paid activation requires a freshly verified Testnet transaction.')
    db.prepare('UPDATE service_checkouts SET status=CASE WHEN status=\'paid\' THEN status ELSE ? END, active=CASE WHEN ?=\'paid\' AND ?=1 AND success_event IS NOT NULL THEN 1 ELSE active END WHERE id=?').run(intent.status, intent.status, paidProof ? 1 : 0, row.id)
  }
  return {
    status(session: string) { const row = checkout(session); return row ? publicCheckout(row) : null },
    async create(session: string, planId: unknown) {
      if (!config.paymentsEnabled) throw new Error('New Testnet service checkouts are paused by the operator.')
      const api = ready(), owner = binding(session)
      if (typeof planId !== 'string' || !db.prepare('SELECT id FROM learner_plans WHERE id=? AND session_hash=?').get(planId, session)) throw new Error('Save a plan in this session first.')
      let row = checkout(session)
      if (!row) {
        db.prepare('INSERT INTO service_checkouts (id, session_hash, plan_id, owner, amount, asset) VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), session, planId, owner, config.velo.amount, config.velo.asset)
        row = checkout(session)!
      }
      if (row.plan_id !== planId || row.owner !== owner) throw new Error('This session already has a checkout for a different plan. Return to that saved plan.')
      if (row.intent_id) return publicCheckout(row)
      // The same persisted checkout attempt always reuses the same parameters and key after a timeout/restart.
      const intent = await api.checkout.sessions.create({ amount: String(row.amount), asset: String(row.asset), description: `Pathwise service ${row.id}`, anchor: 'inhouse', successUrl: origin + '/?checkout=returned', cancelUrl: origin + '/?checkout=cancelled' }, { idempotencyKey: `pathwise-service-${row.id}`, correlationId: String(row.id) })
      if (!intent.id || intent.id !== intent.paymentIntentId) throw new Error('Unexpected Velo intent identifiers; checkout requires reconciliation.')
      const expected = { ...row, intent_id: intent.id }
      validate(expected, intent)
      if (intent.checkoutUrl && new URL(intent.checkoutUrl).origin !== config.velo.baseUrl) throw new Error('Unexpected Velo checkout origin; consult the SDK publisher before continuing.')
      db.prepare('UPDATE service_checkouts SET intent_id=?, checkout_url=?, status=? WHERE id=?').run(intent.id, intent.checkoutUrl, intent.status, row.id)
      return publicCheckout(checkout(session)!)
    },
    async refresh(session: string) {
      const row = checkout(session)
      if (!row?.intent_id) throw new Error('Create or recover your checkout first.')
      const intent = await ready().paymentIntents.retrieve(String(row.intent_id))
      validate(row, intent)
      if (intent.status === 'paid' && !row.tx_hash) {
        db.prepare('UPDATE service_checkouts SET status=\'paid_awaiting_verified_webhook\' WHERE id=? AND status<>\'paid\'').run(row.id)
        return publicCheckout(checkout(session)!)
      }
      if (intent.status === 'paid') await verifyLedger(intent, String(row.owner), String(row.tx_hash || ''))
      saveStatus(row, intent, intent.status === 'paid')
      return publicCheckout(checkout(session)!)
    },
    async webhook(raw: string, signature: string | null, delivery: string | null) {
      if (!config.velo.webhookSecret || !config.velo.projectId) throw new Error('Velo webhook is not configured.')
      const event: WebhookEvent = await Velo.webhooks.verify({ payload: raw, signature, secret: config.velo.webhookSecret, toleranceSeconds: 300 })
      if (event.project.id !== config.velo.projectId) throw new Error('Webhook belongs to another project.')
      const digest = createHash('sha256').update(raw).digest('hex')
      const prior = db.prepare('SELECT * FROM velo_events WHERE id=?').get(event.id)
      if (prior) {
        // Velo rebuilds delivery envelopes (including sentAt) on retries.
        // Authentication and project checks ran above; an already applied event has no second business effect.
        return { received: true, duplicate: true }
      }
      // Dashboard test deliveries must never activate purchasing, even if they say succeeded.
      if (event.test || !('paymentIntent' in event)) {
        db.prepare('INSERT OR IGNORE INTO velo_events VALUES (?, ?, ?, ?, ?)').run(event.id, delivery, null, digest, Date.now())
        return { received: true, ignored: true }
      }
      const row = db.prepare('SELECT * FROM service_checkouts WHERE intent_id=?').get(event.paymentIntent.id) as Row | undefined
      // Unknown intents may arrive before create() persisted its response. Ask Velo to retry rather than losing the event.
      if (!row) throw new Error('Checkout is not linked yet; retry delivery after checkout creation.')
      validate(row, event.paymentIntent)
      const succeeded = event.type === 'payment.succeeded'
      if (succeeded && event.paymentIntent.status !== 'paid') throw new Error('Successful Velo event must include paid status.')
      if (succeeded && (!event.paymentIntent.txHash || !/^[a-f0-9]{64}$/i.test(event.paymentIntent.txHash))) throw new Error('Successful payment event has no valid transaction hash.')
      const current = await ready().paymentIntents.retrieve(String(row.intent_id))
      validate(row, current)
      if (current.status === 'paid' && event.type === 'payment.succeeded') {
        await verifyLedger(current, String(row.owner), event.paymentIntent.txHash || '')
      }
      db.exec('BEGIN IMMEDIATE')
      try {
        if (db.prepare('SELECT id FROM velo_events WHERE id=?').get(event.id)) { db.exec('COMMIT'); return { received: true, duplicate: true } }
        // Do not trust unsigned delivery headers as the sole business deduplication key.
        const existingDelivery = delivery ? db.prepare('SELECT id FROM velo_events WHERE delivery_id=?').get(delivery) : null
        if (existingDelivery && existingDelivery.id !== event.id) throw new Error('Delivery ID was reused for a different event.')
        db.prepare('INSERT INTO velo_events VALUES (?, ?, ?, ?, ?)').run(event.id, delivery, row.intent_id, digest, Date.now())
        if (event.type === 'payment.succeeded' && event.paymentIntent.status === 'paid') {
          const txHash = event.paymentIntent.txHash!
          const linked = db.prepare('SELECT id,tx_hash FROM service_checkouts WHERE id=? OR tx_hash=?').all(row.id, txHash)
          if (linked.some(checkout => checkout.id !== row.id || (checkout.tx_hash && checkout.tx_hash !== txHash))) throw new Error('Payment proof is already linked or differs from this checkout; reconcile before activation.')
          db.prepare('UPDATE service_checkouts SET success_event=?, tx_hash=? WHERE id=?').run(event.id, txHash, row.id)
        }
        // Reload under the write lock so concurrent/out-of-order responses cannot undo a verified paid transition.
        // A failed/created event may arrive after API status is paid, but it supplies no payment proof.
        // Only a succeeded envelope (verified on Testnet above) may promote this response to paid.
        if (current.status !== 'paid' || event.type === 'payment.succeeded') saveStatus(db.prepare('SELECT * FROM service_checkouts WHERE id=?').get(row.id) as Row, current, current.status === 'paid' && succeeded)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return { received: true }
    },
  }
}
