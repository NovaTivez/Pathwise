import { stroops } from './policy.ts'

export const certification = 'AWS Certified Cloud Practitioner'
export const skillOptions = ['Cloud concepts', 'Security', 'Billing', 'Technology and services']
export const formatOptions = ['course', 'lab', 'practice']
export function validatePlan(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A learner plan is required.')
  const input = value as Record<string, unknown>
  if (input.goal !== certification) throw new Error('Choose AWS Certified Cloud Practitioner, the supported certification track.')
  function choices(field: string, allowed: string[], required: boolean) {
    const values = input[field]
    if (!Array.isArray(values) || values.length > allowed.length || values.some(v => typeof v !== 'string' || !allowed.includes(v)) || new Set(values).size !== values.length || (required && !values.length)) throw new Error(`Select valid ${field}${required ? ' (at least one)' : ''}.`)
    return values as string[]
  }
  const skills = choices('skills', skillOptions, false)
  const formats = choices('formats', formatOptions, true)
  const budget = stroops(input.budget), limit = stroops(input.limit), reserve = stroops(input.reserve)
  if (budget <= 0n || limit <= 0n) throw new Error('Total budget and per-purchase limit must be positive.')
  if (limit > budget) throw new Error('Per-purchase limit cannot exceed total budget.')
  if (reserve > budget) throw new Error('Exam reserve cannot exceed total budget.')
  return { goal: certification, skills, formats, budgetStroops: budget.toString(), limitStroops: limit.toString(), reserveStroops: reserve.toString() }
}
