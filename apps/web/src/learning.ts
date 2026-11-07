import type { Catalog, Order } from './ui.ts'
import { xlm } from './ui'
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
export function available(order?: Order) { return Boolean(order && order.fulfillment === 'fulfilled' && order.claim === 'claimed' && order.authorization === 'authorized' && order.sampleAccessCode) }
export function resourceStage(order?: Order) {
  if (!order) return 'Suggested'
  if (order.status === 'simulated') return 'Recorded · no access'
  if (available(order)) return 'Available · demo access'
  if (order.status === 'blocked') return 'Purchase blocked'
  if (order.status === 'failed') return 'Purchase failed'
  if (order.claim === 'claimed') return 'Purchased · access pending'
  if (order.authorization === 'authorized') return 'Authorized · awaiting claim'
  return 'Purchase pending'
}
export function filterResources(catalog: Catalog, skill: string, format: string, provider: string) {
  return catalog.resources.filter(r => (!skill || r.skills.includes(skill)) && (!format || r.format === format) && (!provider || r.providerId === provider))
}
export function formatName(format: string) { return ({course:'Course',lab:'Hands-on lab',practice:'Practice exam'} as Record<string,string>)[format] || format }
