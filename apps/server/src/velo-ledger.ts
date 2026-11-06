import type { PaymentIntent } from '@carts1024/velo-sdk'
import { stroops } from './policy.ts'

export type VeloLedgerVerifier = (intent: PaymentIntent, owner: string, txHash: string) => Promise<void>
export const verifyVeloLedger: VeloLedgerVerifier = async (intent, owner, txHash) => {
  if (!/^[a-f0-9]{64}$/i.test(txHash) || !intent.receiverAddress || intent.payerAddress !== owner || intent.asset !== 'native') throw new Error('Velo Testnet payment identity is incomplete or does not match the verified owner.')
  const root = `https://horizon-testnet.stellar.org/transactions/${txHash}`
  const [txResponse, opsResponse] = await Promise.all([
    fetch(root, { signal: AbortSignal.timeout(5000) }),
    fetch(root + '/operations?limit=200', { signal: AbortSignal.timeout(5000) }),
  ])
  if (!txResponse.ok || !opsResponse.ok) throw new Error('Velo transaction is not yet verifiable on Stellar Testnet. Retry status retrieval or webhook delivery.')
  const tx = await txResponse.json() as { hash?: string; successful?: boolean; memo?: string }
  const ops = await opsResponse.json() as { _embedded?: { records?: { type?: string; asset_type?: string; to?: string; from?: string; amount?: string }[] } }
  if (!tx.successful || tx.hash !== txHash || (intent.receiverMemo && tx.memo !== intent.receiverMemo)) throw new Error('Testnet transaction result or memo differs from the Velo checkout.')
  if (!ops._embedded?.records?.some(op => op.type === 'payment' && op.asset_type === 'native' && op.to === intent.receiverAddress && op.from === owner && typeof op.amount === 'string' && stroops(op.amount) === stroops(intent.amount))) throw new Error('No exact native-XLM payment to the expected Velo receiver was found on Testnet.')
}
