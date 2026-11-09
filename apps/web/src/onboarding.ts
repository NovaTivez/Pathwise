export const onboardingStages = ['Career', 'Skills', 'Timeline', 'Budget']
export const defaultDraft = { career: 'cloud', timelineWeeks: 12, goal: 'AWS Certified Cloud Practitioner', skills: [] as string[], formats: ['course'], budget: '30', limit: '10', reserve: '10' }
export function validatedDraft(value: unknown): typeof defaultDraft {
  if (!value || typeof value !== 'object') return defaultDraft
  const draft = value as Record<string, unknown>
  if (!['career','goal','budget','limit','reserve'].every(key => typeof draft[key] === 'string') || ![4,8,12,24].includes(Number(draft.timelineWeeks)) || !Array.isArray(draft.skills) || !draft.skills.every(skill => typeof skill === 'string') || !Array.isArray(draft.formats) || !draft.formats.length || !draft.formats.every(format => ['course','lab','practice'].includes(String(format)))) return defaultDraft
  return { career: String(draft.career), goal: String(draft.goal), timelineWeeks: Number(draft.timelineWeeks), skills: draft.skills as string[], formats: draft.formats as string[], budget: String(draft.budget), limit: String(draft.limit), reserve: String(draft.reserve) }
}
export function stageFromHash(hash: string) {
  const value = new URLSearchParams(hash.split('?')[1] || '').get('step')
  return Math.max(0, onboardingStages.findIndex(stage => stage.toLowerCase() === value))
}
export function routeForStage(stage: number) { return '#careers?step=' + (onboardingStages[stage] || onboardingStages[0]).toLowerCase() }
