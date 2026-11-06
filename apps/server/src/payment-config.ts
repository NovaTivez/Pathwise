import { TESTNET, keypairSigner } from '@noirx402/agent-sdk'
import { Asset, Networks, StrKey } from '@stellar/stellar-sdk'
import { stroops } from './policy.ts'

export function supportedNode(version = process.versions.node) {
  const [major, minor, patch] = version.split('.').map(Number)
  return major === 22 ? minor > 23 || (minor === 23 && patch >= 4) : major === 24 ? minor > 22 || (minor === 22 && patch >= 1) : major === 26 ? minor > 12 || (minor === 12 && patch >= 1) : major > 26
}
export function paymentConfig(env: NodeJS.ProcessEnv = process.env) {
  const contracts = {
    deviceRegistry: env.NOIR_DEVICE_REGISTRY || TESTNET.contracts.deviceRegistry,
    agentRegistry: env.NOIR_AGENT_REGISTRY || TESTNET.contracts.agentRegistry,
    paymentEscrow: env.NOIR_PAYMENT_ESCROW || TESTNET.contracts.paymentEscrow,
  }
  let agent, merchant
  const problems: string[] = []
  try { if (env.NOIR_AGENT_SECRET) agent = keypairSigner(env.NOIR_AGENT_SECRET) } catch { problems.push('NOIR_AGENT_SECRET is invalid.') }
  try { if (env.NOIR_PROVIDER_SECRET) merchant = keypairSigner(env.NOIR_PROVIDER_SECRET) } catch { problems.push('NOIR_PROVIDER_SECRET is invalid.') }
  if (!supportedNode()) problems.push('Upgrade Node to 24.22.1+ (on the Node 24 line); the installed Noir SDK does not support this runtime.')
  const matchesHandbook = Object.keys(contracts).every(key => contracts[key as keyof typeof contracts] === TESTNET.contracts[key as keyof typeof contracts])
  if (!matchesHandbook) problems.push('Only the handbook-selected Noir Testnet deployment is allowed. Restore the three documented contract IDs.')
  if (!Object.values(contracts).every(c => StrKey.isValidContract(c))) problems.push('Invalid Noir contract ID.')
  if (!agent) problems.push('Server agent Testnet key is missing.')
  if (!merchant) problems.push('Dedicated demo-provider Testnet key is missing.')
  if (agent && merchant && agent.publicKey === merchant.publicKey) problems.push('Agent and provider must use separate Testnet accounts.')
  const providers: Record<string, ReturnType<typeof keypairSigner> | undefined> = { cloudtrail: merchant }
  for (const [id, variable] of [['sandbox', 'NOIR_PROVIDER_2_SECRET'], ['lantern', 'NOIR_PROVIDER_3_SECRET']]) {
    try { if (env[variable]) providers[id] = keypairSigner(env[variable]!) } catch { /* provider readiness is reported separately */ }
  }
  const amount = env.VELO_SERVICE_AMOUNT || '1'
  let amountValid = false
  try { amountValid = stroops(amount) > 0n } catch { /* surfaced in setup */ }
  const veloProblems = [
    ...(!/^tk_(test|live)_\S+$/.test(env.VELO_API_KEY || '') ? ['A general checkout API key is required (tk_test_ or the current console’s tk_live_ prefix; not a Gas-only key).'] : []),
    ...(!env.VELO_WEBHOOK_SECRET ? ['Velo webhook signing secret is missing.'] : []),
    ...(!env.VELO_PROJECT_ID ? ['Velo project ID is missing.'] : []),
    ...(!amountValid ? ['Service fee must be a positive decimal with at most seven places.'] : []),
  ]
  return {
    paymentsEnabled: env.PAYMENTS_ENABLED === 'true',
    network: { ...TESTNET, networkPassphrase: Networks.TESTNET, contracts }, agent, merchant, providers,
    noirProblems: problems, veloProblems,
    approvalReference: env.NOIR_APPROVAL_REFERENCE || 'User-transcribed November 5, 2026 Builder Handbook; project-selected working reference, not separate organizer confirmation.',
    velo: { apiKey: env.VELO_API_KEY || '', webhookSecret: env.VELO_WEBHOOK_SECRET || '', projectId: env.VELO_PROJECT_ID || '', amount, asset: 'native', baseUrl: 'https://www.velo-build.dev' },
    asset: Asset.native().contractId(Networks.TESTNET),
  }
}
