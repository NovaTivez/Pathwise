export const catalog = [
  { id: 'cloud-course', provider: 'CloudTrail Academy', format: 'course', skill: 'Cloud concepts', price: '8', title: 'Cloud foundations' },
  { id: 'security-lab', provider: 'Sandbox Grove', format: 'lab', skill: 'Security', price: '6', title: 'IAM essentials lab' },
  { id: 'practice-exam', provider: 'Exam Lantern', format: 'practice', skill: 'Billing', price: '14', title: 'Billing practice exam' },
]
export function stroops(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d{1,8}(\.\d{1,7})?$/.test(value)) throw new Error('Enter an amount with up to seven decimal places.')
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 10000000n + BigInt(fraction.padEnd(7, '0'))
}
export function plan(input: any) {
  const total = stroops(input.budget), reserve = stroops(input.reserve), limit = stroops(input.limit)
  if (total <= 0n || limit <= 0n || reserve > total) throw new Error('Budget and purchase limit must be positive; reserve cannot exceed budget.')
  if (!Array.isArray(input.skills) || !Array.isArray(input.formats) || !Array.isArray(input.providers)) throw new Error('Select your learning preferences.')
  let remaining = total - reserve
  const orders = catalog.map(resource => {
    let reason = ''
    if (input.skills.includes(resource.skill)) reason = 'You already know this skill.'
    else if (!input.formats.includes(resource.format)) reason = 'Outside your preferred formats.'
    else if (!input.providers.includes(resource.provider)) reason = 'Provider is not approved.'
    else if (stroops(resource.price) > limit) reason = 'Exceeds your per-purchase limit.'
    else if (stroops(resource.price) > remaining) reason = 'Would spend your exam reserve or exceed the budget.'
    if (!reason) remaining -= stroops(resource.price)
    return { ...resource, state: reason ? 'blocked' : 'planned', reason: reason || `Fills your ${resource.skill.toLowerCase()} skill gap within your rules.` }
  })
  return { orders, remainingStroops: remaining.toString(), reserveStroops: reserve.toString() }
}
