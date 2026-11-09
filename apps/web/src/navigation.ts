const routes: Record<number, string> = { [-1]: 'home', 0: 'careers', 1: 'spending', 2: 'roadmap', 3: 'purchases', 4: 'resources', 5: 'purchase-history', 6: 'wallet', 7: 'service-payment', 8: 'authorization' }
import type { Grant, Plan, Setup } from './ui'
export function stepFromHash(hash: string) {
  const name = hash.replace(/^#/, '').split('?')[0]
  return Number(Object.entries(routes).find(([, route]) => route === name)?.[0] ?? -1)
}
export function routeForStep(step: number) { return '#' + (routes[step] || 'home') }
export function nextSetupStep(plan: Plan | null, grant: Grant | undefined, setup: Setup | null) {
  if (!plan) return 0
  if (plan.id.startsWith('preview:')) return 2
  if (grant?.started) return 3
  if (!setup) return 2
  if (!setup.wallet) return 6
  if (!setup.checkout?.active || setup.checkout.planId !== plan.id || !grant) return 7
  const sameOwner = setup.wallet.owner === grant.owner && setup.experiment?.owner === grant.owner && setup.experiment?.planId === plan.id
  return sameOwner && ['registerDevice','registerAgent','fundEscrow'].every(kind => setup.experiment?.ownerOperations.some(op => op.kind === kind && op.state === 'confirmed')) ? 3 : 8
}
