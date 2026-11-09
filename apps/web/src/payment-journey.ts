import type { Setup } from './ui'

export const ownerSteps = [
  { kind: 'registerDevice', label: 'Register learning agent', explanation: 'Register this learning device to your verified owner wallet. This does not purchase a resource.' },
  { kind: 'registerAgent', label: 'Authorize spending policy', explanation: 'Allow the server agent to spend test assets under your approved policy and expiry. Your owner keys remain in Noir.' },
  { kind: 'fundEscrow', label: 'Fund learning escrow', explanation: 'Deposit the approved prep allowance into Noir learning escrow. Your exam reserve stays outside it; the Velo service fee is separate.' },
] as const

export function nextOwnerAction(operations: NonNullable<Setup['experiment']>['ownerOperations']) {
  // Any uncertain operation blocks all new signatures, even if an earlier step needs attention.
  const uncertain = operations.find(op => op.state === 'pending' || op.state === 'prepared')
  if (uncertain) return { kind: uncertain.kind, state: 'check' as const }
  const next = ownerSteps.find(step => !operations.some(op => op.kind === step.kind && op.state === 'confirmed'))
  return next ? { kind: next.kind, state: 'sign' as const } : { kind: '', state: 'complete' as const }
}

export function serviceAction(setup: Setup | null, planId: string, serviceReady: boolean) {
  if (!setup?.wallet) return 'wallet'
  if (serviceReady && setup.checkout?.active && setup.checkout.planId === planId) return 'continue'
  // A stored checkout must be checked/reused, never replaced merely because a redirect failed.
  if (setup.checkout) return setup.checkout.planId === planId ? 'check' : 'mismatch'
  return setup.velo.ready ? 'pay' : 'blocked'
}
