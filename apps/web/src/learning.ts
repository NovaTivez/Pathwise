import type { Catalog, Order, Setup } from './ui.ts'
import { xlm } from './ui'
export function careerPurchasingSupported(career: { id: string; goal: string }, catalog: Catalog | null) {
  if (!catalog) return false
  if (catalog.careers?.length) return catalog.careers.some(item => item.id === career.id)
  return catalog.skillMap.certification === career.goal
}
export function prepBudgetCalculation(budget: string, reserve: string) {
  const available = purchasingBudget(budget, reserve)
  return available.endsWith(' test XLM') ? `${budget} total − ${reserve} protected = ${available} for prep` : available
}
export function checkoutReadiness(setup: Setup | null, previewOnly: boolean, statusUnavailable = false) {
  if (previewOnly) return { available: false, reason: 'Planning preview: purchases are not supported for this career yet. You can still use the learning milestones and free resources.' }
  if (statusUnavailable || !setup) return { available: false, reason: 'Checkout status is unavailable. Your roadmap is still available; retry status before setting up payments.' }
  if (!setup.velo.ready || !setup.noir.ready) return { available: false, reason: 'Testnet checkout is currently unavailable or paused. Keep planning without connecting a wallet or paying a fee.' }
  return { available: true, reason: '' }
}
export function purchasingBudget(budget: string, reserve: string) {
  const exact = (value: string) => {
    if (!/^\d+(\.\d{1,7})?$/.test(value)) return null
    const [whole, fraction = ''] = value.split('.')
    return BigInt(whole) * 10000000n + BigInt(fraction.padEnd(7, '0'))
  }
  const total = exact(budget), protectedAmount = exact(reserve)
  if (total === null || protectedAmount === null) return 'Enter valid amounts'
  if (protectedAmount > total) return 'Reserve exceeds budget'
  return `${xlm((total - protectedAmount).toString())} test XLM`
}
export function available(order?: Order) { return Boolean(order && order.status !== 'simulated' && order.fulfillment === 'fulfilled' && order.claim === 'claimed' && order.authorization === 'authorized' && order.sampleAccessCode) }
export function resourceStage(order?: Order) {
  if (!order) return 'Suggested'
  if (order.status === 'simulated') return 'Simulation record'
  if (available(order)) return 'Resource preview ready'
  if (['blocked', 'failed'].includes(order.status) || order.authorization === 'failed' || order.claim === 'failed') return 'Action needed'
  return 'Processing'
}
export function purchaseExplanation(order: Order) {
  if (order.status === 'simulated') return 'Simulation only. No payment was submitted and no resource access was delivered.'
  if (available(order)) return 'Settlement is verified and sample content is ready. This preview is not a commercial course enrollment.'
  if (resourceStage(order) === 'Action needed') return order.reason || 'A payment needs attention. Check its status before trying again.'
  if (order.claim === 'claimed') return 'Payment settlement is confirmed. Pathwise is preparing the resource preview.'
  if (order.authorization === 'authorized') return 'Payment is authorized. Waiting for provider settlement before releasing the preview.'
  return 'Pathwise is verifying the payment outcome. Pending commitments remain reserved; do not submit another purchase.'
}
export function filterResources(catalog: Catalog, skill: string, format: string, provider: string) {
  return catalog.resources.filter(r => (!skill || r.skills.includes(skill)) && (!format || r.format === format) && (!provider || r.providerId === provider))
}
export function formatName(format: string) { return ({course:'Course',lab:'Hands-on lab',practice:'Practice exam'} as Record<string,string>)[format] || format }
