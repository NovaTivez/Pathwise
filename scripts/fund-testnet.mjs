import { Keypair } from '@stellar/stellar-sdk'
for (const name of ['NOIR_AGENT_SECRET', 'NOIR_PROVIDER_SECRET', 'NOIR_PROVIDER_2_SECRET', 'NOIR_PROVIDER_3_SECRET']) {
  const secret = process.env[name]
  if (!secret) throw new Error(`Run npm.cmd run setup:testnet first; ${name} is missing.`)
  const address = Keypair.fromSecret(secret).publicKey()
  console.log(`${name.replace('_SECRET', '')}: checking ${address}`)
  const existing = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`, { signal: AbortSignal.timeout(45000) })
  if (existing.ok) { console.log(`${name.replace('_SECRET', '')}: account already exists (${address}); no funding requested.`); continue }
  if (existing.status !== 404) throw new Error('Could not check Testnet account; no funding attempted.')
  console.log(`${name.replace('_SECRET', '')}: requesting Friendbot funding`)
  const result = await fetch(`https://friendbot.stellar.org?addr=${address}`, { signal: AbortSignal.timeout(60000) })
  if (!result.ok) throw new Error(`Friendbot did not confirm funding (${result.status}); check the public account before retrying.`)
  const proof = await result.json()
  console.log(`${name.replace('_SECRET', '')}: Friendbot funded ${address}`)
  if (typeof proof.hash === 'string') console.log(`Friendbot funding only: https://stellar.expert/explorer/testnet/tx/${proof.hash}`)
}
