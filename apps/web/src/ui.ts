export type Plan = { id: string; career?: string; timelineWeeks?: number; goal: string; skills: string[]; formats: string[]; budgetStroops: string; limitStroops: string; reserveStroops: string; createdAt: string }
export type Provider = { id: string; name: string; merchant: string | null }
export type Resource = { id: string; providerId: string; title: string; skills: string[]; format: string; priceStroops: string; kind?: string; careers?: string[]; prerequisites?: string[]; weeks?: number; url?: string; fulfillment?: { description: string } }
export type Career = { id: string; name: string; description: string; goal: string; skills: string[] }
export type Catalog = { careers?: Career[]; providers: Provider[]; resources: Resource[]; skillMap: { disclaimer: string; skills: string[] } }
export type Decision = { resourceId: string; providerId: string; priceStroops: string; state: string; reason: string }
export type StoredAgentDecision = { resourceId: string; providerId: string; priceStroops: string; decision: 'selected' | 'skipped' | 'blocked'; reason: string }
export function decisionFromStored(d: StoredAgentDecision | Decision): Decision {
  return { resourceId: d.resourceId, providerId: d.providerId, priceStroops: d.priceStroops, state: 'decision' in d ? d.decision : d.state, reason: d.reason }
}
export type Roadmap = { career?: string; timelineWeeks?: number; steps?: { order: number; skill: string; weekStart: number; weekEnd: number; resourceIds: string[]; action: string }[]; freeResources?: { resourceId: string; title: string; url?: string; reason: string }[]; gaps: string[]; decisions: Decision[]; outcome: string; remainingStroops: string; engine: string }
export type Order = { id: string; resourceId: string; providerId: string; amountStroops: string; status: string; selectionReason: string; reason: string; authorization: string; claim: string; fulfillment: string; authorizeHash: string | null; claimHash: string | null; sampleAccessCode: string | null }
export type Grant = { roadmapFromGrant?: Roadmap; decisions?: (StoredAgentDecision | Decision)[]; id: string; mode: string; planId: string; started: boolean; expiresAt: string; owner: string; providers: { id: string; merchant: string | null }[]; totalBudgetStroops: string; perPurchaseLimitStroops: string; pendingStroops: string; spentStroops: string; simulatedStroops: string; reserveStroops: string; remainingStroops: string; orders: Order[] }
export type Setup = { noir: { ready: boolean; blockers: string[] }; velo: { ready: boolean; blockers: string[]; amount: string }; wallet: { owner: string } | null; checkout: { active: boolean; planId: string; status: string; amount: string; checkoutUrl: string | null; transactionHash: string | null; verifiedWebhook: boolean } | null; experiment: { fundingStroops: string; deviceHash: string; ownerOperations: { id: string; kind: string; state: string; hash: string }[] } | null }
export function xlm(value: string) {
  const n = BigInt(value), fraction = (n % 10000000n).toString().padStart(7, '0').replace(/0+$/, '')
  return `${n / 10000000n}${fraction ? '.' + fraction : ''}`
}
export function readable(value: string) {
  const labels: Record<string, string> = { reserved: 'Budget reserved', authorization_pending: 'Authorization pending', authorized: 'Authorized', claim_pending: 'Claim pending', claimed: 'Claim confirmed', fulfilled: 'Demo access ready', simulated: 'Simulated', blocked: 'Blocked', failed: 'Failed', not_started: 'Not started', pending: 'Pending', locked: 'Locked', simulation_preview: 'Simulation only', paid_awaiting_verified_webhook: 'Paid status received; awaiting verified webhook' }
  return labels[value] || value.replaceAll('_', ' ')
}
