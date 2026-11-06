import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PaymentIntent } from '@carts1024/velo-sdk'
import { verifyVeloLedger } from './velo-ledger.ts'

test('service activation ledger proof rejects failed, wrong-asset, wrong-recipient, wrong-payer and wrong-amount payments', async () => {
  const original = globalThis.fetch
  const hash = 'a'.repeat(64)
  const intent: PaymentIntent = { id: 'fixture', paymentIntentId: 'fixture', object: 'payment_intent', status: 'paid', amount: '1', asset: 'native', receiverAddress: 'receiver-fixture', payerAddress: 'owner-fixture', receiverMemo: 'memo-fixture', description: 'fixture', checkoutUrl: null, successUrl: null, cancelUrl: null, expiresAt: '', createdAt: '', updatedAt: '' }
  let successful = true
  let operation = { type: 'payment', asset_type: 'native', to: 'receiver-fixture', from: 'owner-fixture', amount: '1.0000000' }
  let memo = 'memo-fixture'
  try {
    globalThis.fetch = async input => {
      const url = String(input)
      assert.ok(url.startsWith('https://horizon-testnet.stellar.org/'), 'proof must use Testnet, never Mainnet')
      return Response.json(url.includes('/operations') ? { _embedded: { records: [operation] } } : { hash, successful, memo })
    }
    await verifyVeloLedger(intent, 'owner-fixture', hash)
    successful = false; await assert.rejects(verifyVeloLedger(intent, 'owner-fixture', hash)); successful = true
    for (const patch of [{ to: 'other' }, { from: 'other' }, { asset_type: 'credit_alphanum4' }, { amount: '0.9999999' }]) {
      const previous = operation; operation = { ...operation, ...patch }
      await assert.rejects(verifyVeloLedger(intent, 'owner-fixture', hash))
      operation = previous
    }
    memo = 'other'; await assert.rejects(verifyVeloLedger(intent, 'owner-fixture', hash)); memo = 'memo-fixture'
    await assert.rejects(verifyVeloLedger(intent, 'other-owner', hash))
    await assert.rejects(verifyVeloLedger(intent, 'owner-fixture', 'not-a-hash'))
    globalThis.fetch = async () => new Response('', { status: 404 })
    await assert.rejects(verifyVeloLedger(intent, 'owner-fixture', hash))
  } finally { globalThis.fetch = original }
})
