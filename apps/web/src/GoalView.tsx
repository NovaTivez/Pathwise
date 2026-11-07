import { useEffect, useRef, useState } from 'react'
import type { Pathwise } from './usePathwise'
import { purchasingBudget } from './learning'
import { SubjectIcon } from './LearningComponents'
import { PathIllustration } from './Illustrations'
const stages = ['Your goal', 'What you know', 'How you learn', 'Your budget']
export function GoalView({ p }: { p: Pathwise }) {
  const [stage, setStage] = useState(0), [validation, setValidation] = useState('')
  const title = useRef<HTMLHeadingElement>(null)
  const { draft } = p
  useEffect(() => { title.current?.focus() }, [stage])
  function toggle(field: 'skills' | 'formats', value: string) { p.setDraft({ ...draft, [field]: draft[field].includes(value) ? draft[field].filter(v => v !== value) : [...draft[field], value] }) }
  function next() {
    if (stage === 2 && !draft.formats.length) { setValidation('Choose at least one learning format.'); return }
    setValidation(''); setStage(stage + 1)
  }
  const usable = purchasingBudget(draft.budget, draft.reserve)
  return <div className="onboarding-layout"><form className="onboarding-form" aria-busy={p.busy} onSubmit={e => { e.preventDefault(); if (stage < 3) next(); else void p.act(p.save, 'Goal saved. Your learning path is ready to explore.') }}>
    <ol className="setup-progress" aria-label="Goal setup steps">{stages.map((label,i) => <li key={label} aria-current={stage === i ? 'step' : undefined} className={stage === i ? 'current' : i < stage ? 'visited' : ''}><span aria-hidden="true">{i + 1}</span><span>{label}</span></li>)}</ol>
    <span className="eyebrow">STEP {stage + 1} OF {stages.length}</span><h2 ref={title} tabIndex={-1}>{['Choose your destination.', 'Start with what you know.', 'Make it your kind of learning.', 'Leave room for your exam.'][stage]}</h2>
    {p.grant && <div className="notice">Your approved plan stays fixed. You can review its learning path and spending settings.<button type="button" className="text-button" onClick={() => p.go(2)}>View my learning path →</button></div>}
    <fieldset disabled={p.busy || Boolean(p.grant)}>
      {stage === 0 && <><label htmlFor="goal">Certification goal</label><select id="goal" value={draft.goal} onChange={e => p.setDraft({ ...draft, goal: e.target.value })}><option>AWS Certified Cloud Practitioner</option></select><p className="field-hint">One certification track for this demo. We’ll use a curated skill map, not an official or guaranteed exam syllabus.</p></>}
      {stage === 1 && <><legend>Which areas feel familiar?</legend><p className="field-hint">Choose any that you already know. It’s fine to start from scratch.</p><div className="choice-grid">{['Cloud concepts', 'Security', 'Billing', 'Technology and services'].map(s => <label className="choice" key={s}><input type="checkbox" checked={draft.skills.includes(s)} onChange={() => toggle('skills', s)} /><span>{s}</span></label>)}</div></>}
      {stage === 2 && <><legend>What helps you learn best?</legend><p className="field-hint">Choose at least one. If another format better fits a gap, your agent will explain why.</p><div className="format-choices">{[['course', 'Courses', 'Make sense of the big picture.'], ['lab', 'Hands-on labs', 'Try ideas out for yourself.'], ['practice', 'Practice exams', 'Put your understanding to the test.']].map(([id,label,help]) => <label className={`choice format-choice format-${id}`} key={id}><input type="checkbox" checked={draft.formats.includes(id)} onChange={() => toggle('formats', id)} /><SubjectIcon format={id} /><span><strong>{label}</strong><small>{help}</small></span></label>)}</div></>}
      {stage === 3 && <><p className="budget-step-intro">Split your balance between study materials and a protected exam reserve. Amounts are in XLM.</p><div className="budget-card"><div className="budget-fields">{[['budget','Total learning budget','The amount you want to set aside for resources and your exam.'],['reserve','Reserved for your exam','Held back and never spent on learning materials.'],['limit','Limit for one resource','The most your agent may authorize for a single purchase.']].map(([id,label,help]) => <div className="budget-field" key={id}><div><label htmlFor={id}>{label}</label><p className="field-hint" id={`${id}-help`}>{help}</p></div><div className="amount-input"><input id={id} inputMode="decimal" required aria-describedby={`${id}-help`} value={draft[id as 'budget' | 'reserve' | 'limit']} onChange={e => p.setDraft({ ...draft, [id]: e.target.value })} /><span className="amount-suffix" aria-hidden="true">XLM</span></div></div>)}</div><div className="usable-budget" role="status"><div className="usable-budget-copy"><span>Available for learning resources</span><small>After your exam reserve</small></div><strong>{usable}</strong></div></div><p className="fine-print">The Velo service fee is separate. Saving your goal does not authorize spending.</p></>}
    </fieldset>
    {validation && <p className="inline-error" role="alert">{validation}</p>}
    <div className="form-footer">{stage > 0 ? <button type="button" className="text-button" onClick={() => { setValidation(''); setStage(stage - 1) }}>← Back</button> : <small>You can review your choices before spending.</small>}{stage < 3 ? <button disabled={p.busy}>{stage === 0 ? 'Build my learning path' : 'Continue'} <span aria-hidden="true">→</span></button> : <button disabled={p.busy || !p.token || Boolean(p.grant)}>{p.busy ? 'Saving your goal…' : 'Save goal & see my path →'}</button>}</div>
  </form><aside className="onboarding-guide"><div className="learning-illustration" aria-hidden="true"><PathIllustration /><span>Your goal. Your pace.</span></div><h3>Focus on the skills<br />you still need.</h3><p>Find materials for your remaining gaps, understand every recommendation, and protect the budget you set.</p><ul className="plain-list"><li>Build on skills you already have</li><li>Choose the way you like to learn</li><li>Keep your exam reserve untouched</li></ul></aside></div>
}
