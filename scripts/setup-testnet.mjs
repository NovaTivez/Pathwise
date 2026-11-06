import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { Keypair } from '@stellar/stellar-sdk'
let text = existsSync('.env') ? readFileSync('.env', 'utf8') : readFileSync('.env.example', 'utf8')
for (const name of ['NOIR_AGENT_SECRET', 'NOIR_PROVIDER_SECRET', 'NOIR_PROVIDER_2_SECRET', 'NOIR_PROVIDER_3_SECRET']) {
  const expression = new RegExp(`^${name}=(.*)$`, 'm')
  const match = text.match(expression)
  if (!match || !match[1].trim()) {
    const line = `${name}=${Keypair.random().secret()}`
    text = match ? text.replace(expression, line) : text.trimEnd() + '\n' + line + '\n'
  }
}
writeFileSync('.env', text, { mode: 0o600 })
for (const name of ['NOIR_AGENT_SECRET', 'NOIR_PROVIDER_SECRET', 'NOIR_PROVIDER_2_SECRET', 'NOIR_PROVIDER_3_SECRET']) {
  const secret = text.match(new RegExp(`^${name}=(.*)$`, 'm'))[1].trim()
  console.log(`${name.replace('_SECRET', '_PUBLIC')}: ${Keypair.fromSecret(secret).publicKey()}`)
}
console.log('Server-only keys stored in ignored root .env. Existing nonempty keys were preserved. No owner key was created or requested.')
