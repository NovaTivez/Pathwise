import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Keypair, nativeToScVal, xdr } from '@stellar/stellar-sdk'
import { ledgerEvents } from './noir-events.ts'
import type { NoirPort } from './noir.ts'

test('a successful Noir receipt is readable when the RPC omits the success flag', async () => {
  const merchant = Keypair.random().publicKey()
  const device = Buffer.from('ab'.repeat(32), 'hex')
  const raw = {
    id: 'event-1',
    inSuccessfulContractCall: false,
    ledger: 9,
    ledgerClosedAt: '2026-11-07T00:00:00Z',
    txHash: 'cd'.repeat(32),
    contractId: { contractId: () => 'contract-escrow' },
    topic: [xdr.ScVal.scvSymbol('authorize'), xdr.ScVal.scvBytes(device), xdr.ScVal.scvAddress(xdr.ScAddress.scAddressTypeAccount(Keypair.fromPublicKey(merchant).xdrAccountId()))],
    value: nativeToScVal(60000000n, { type: 'i128' }),
  }
  const client = {
    contracts: { paymentEscrow: 'contract-escrow' },
    pastEvents: async () => [],
    server: { getEvents: async () => ({ events: [raw], cursor: (9n << 32n).toString(), latestLedger: 9 }) },
  }
  const events = await ledgerEvents(client as unknown as Parameters<typeof ledgerEvents>[0], 9)
  assert.equal(events.length, 1)
  assert.equal(events[0]?.type, 'payment.authorized')
  assert.equal(events[0]?.txHash, raw.txHash)
  if (events[0]?.type === 'payment.authorized') {
    assert.equal(events[0].merchant, merchant)
    assert.equal(events[0].amount, 60000000n)
    assert.equal(events[0].deviceHash, device.toString('hex'))
  }
  const fallback = await ledgerEvents({ pastEvents: async () => [], server: {} } as unknown as NoirPort, 9)
  assert.deepEqual(fallback, [])
})
