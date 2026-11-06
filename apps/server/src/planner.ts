import type { Resource } from './catalog.ts'
import { skillMap } from './catalog.ts'
export type Learner = { goal: string; skills: string[]; formats: string[]; budgetStroops: string; limitStroops: string; reserveStroops: string }
export type Proposal = { resourceId: string; explanation: string }
// Optional server-side model adapters must pass this validator. No browser/model payment arguments are accepted.
export function validateSuggestions(value: unknown, catalog: Resource[]): Proposal[] {
  if (!Array.isArray(value) || value.length > catalog.length) throw new Error('Invalid proposal list.')
  const seen = new Set<string>()
  return value.map(item => {
    if (!item || typeof item !== 'object' || typeof item.resourceId !== 'string' || !catalog.some(r => r.id === item.resourceId) || seen.has(item.resourceId) || typeof item.explanation !== 'string' || !item.explanation.trim() || item.explanation.length > 500) throw new Error('Invalid catalog ID, duplicate suggestion, or explanation.')
    seen.add(item.resourceId)
    return { resourceId: item.resourceId, explanation: item.explanation.trim() }
  })
}
export function planPurchases(plan: Learner, catalog: Resource[], approved: string[], purchased: string[] = [], committed = 0n, suggestions?: unknown) {
  let remaining = BigInt(plan.budgetStroops) - BigInt(plan.reserveStroops) - committed
  if (remaining < 0n) remaining = 0n
  const gaps = skillMap.skills.filter(s => !plan.skills.includes(s))
  const covered = new Set(plan.skills)
  for (const r of catalog.filter(r => purchased.includes(r.id))) for (const s of r.skills) covered.add(s)
  const proposals = suggestions === undefined ? [] : validateSuggestions(suggestions, catalog)
  const preferred = (r: Resource) => plan.formats.includes(r.format)
  const sorted = [...catalog].sort((a, b) => {
    if (preferred(a) !== preferred(b)) return preferred(a) ? -1 : 1
    const priorityA = proposals.findIndex(p => p.resourceId === a.id), priorityB = proposals.findIndex(p => p.resourceId === b.id)
    if (priorityA !== priorityB && (priorityA >= 0 || priorityB >= 0)) return priorityA < 0 ? 1 : priorityB < 0 ? -1 : priorityA - priorityB
    const priceA = BigInt(a.priceStroops), priceB = BigInt(b.priceStroops)
    return priceA < priceB ? -1 : priceA > priceB ? 1 : a.id.localeCompare(b.id)
  })
  const decisions = sorted.map(r => {
    const newSkills = r.skills.filter(s => !covered.has(s))
    let reason = ''
    if (purchased.includes(r.id)) reason = 'Already purchased or committed; no duplicate purchase.'
    else if (!approved.includes(r.providerId)) reason = 'Provider is not approved.'
    else if (!newSkills.length) reason = 'Coverage is already known or provided by another selection.'
    else if (r.skills.some(s => covered.has(s))) reason = 'Overlaps existing or selected coverage; a narrower resource avoids paying twice.'
    else if (BigInt(r.priceStroops) > BigInt(plan.limitStroops)) reason = 'Exceeds the per-purchase limit.'
    else if (BigInt(r.priceStroops) > remaining) reason = 'Insufficient uncommitted learning funds after protecting the exam reserve.'
    if (!reason) {
      remaining -= BigInt(r.priceStroops)
      for (const s of r.skills) covered.add(s)
    }
    return { resourceId: r.id, providerId: r.providerId, priceStroops: r.priceStroops, state: reason ? 'skipped' as const : 'selected' as const, reason: reason || `Covers ${newSkills.join(', ')} within your budget.${preferred(r) ? ' Matches a preferred format.' : ' Format fallback: no preferred resource for this gap was selected.'}`, modelExplanation: proposals.find(p => p.resourceId === r.id)?.explanation || null }
  })
  return { version: 1 as const, engine: proposals.length ? 'validated-model-proposal-with-server-rules' : 'rule-based', disclaimer: skillMap.disclaimer, gaps, decisions, remainingStroops: remaining.toString(), reserveStroops: plan.reserveStroops, outcome: decisions.some(d => d.state === 'selected') ? 'purchases_planned' : 'no_suitable_purchase' }
}
