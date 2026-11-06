import { NoirAgentClient, TESTNET } from '@noirx402/agent-sdk'
import { writeFileSync } from 'node:fs'
const report = { checkedAt: new Date().toISOString(), sdk: '0.3.0', node: process.versions.node, purpose: 'Read-only SDK contract compatibility probe; not payment acceptance evidence.', contracts: TESTNET.contracts, results: {} }
const client = new NoirAgentClient({ network: TESTNET })
let timeout
try {
  report.results = await Promise.race([
    Promise.all([client.getDeviceOwner('0'.repeat(64)), client.getPolicy('0'.repeat(64)), client.getEscrowBalance('0'.repeat(64))]).then(([owner, policy, escrow]) => ({ owner, policy, escrowStroops: escrow.toString(), status: 'read calls succeeded' })),
    new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Read-only RPC probe timed out after 20 seconds.')), 20000) }),
  ])
} catch (error) { report.results = { status: 'failed', error: error.message }; process.exitCode = 1 }
finally { clearTimeout(timeout) }
writeFileSync('docs/testnet-probe.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
process.exit(process.exitCode || 0)
