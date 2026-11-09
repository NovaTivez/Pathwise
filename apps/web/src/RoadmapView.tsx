import type { Pathwise } from './usePathwise'
import { NeedGoal, Evidence } from './components'
import { ResourceCard } from './LearningComponents'
import { checkoutReadiness } from './learning'
import { certificationReferences } from './career-guidance'
import { Icon } from './Icon'
import { shown, xlm } from './ui'

export function RoadmapView({ p }: { p: Pathwise }) {
  if (!p.activePlan) return <NeedGoal p={p} />
  const plan = p.activePlan, roadmap = p.roadmap
  const checkout = checkoutReadiness(p.setup, p.previewOnly, Boolean(p.connectionError))
  const free = roadmap?.freeResources?.find(r => r.url)
  const total = p.selected.reduce((sum, d) => sum + BigInt(d.priceStroops), 0n)
  const eligible = p.compared && p.selected.length > 0 && total <= BigInt(p.metrics.remaining)
    && p.selected.every(d => p.approvedIds.includes(d.providerId) && p.resource(d.resourceId) && BigInt(d.priceStroops) <= BigInt(p.grant?.perPurchaseLimitStroops || plan.limitStroops))
  const primary = p.grant?.started ? 'View purchases' : !checkout.available || !p.compared ? 'Continue planning'
    : eligible ? 'Review purchase plan' : free ? 'Start with a free resource' : 'Adjust budget'
  function continueJourney() {
    if (p.grant?.started) p.go(3)
    else if (primary === 'Review purchase plan') p.go(p.grant ? p.resumeSetup() : 1)
    else if (primary === 'Adjust budget') p.go(0)
    else document.getElementById(primary === 'Start with a free resource' ? 'free-learning' : 'learning-milestones')?.focus()
  }
  return <div className="roadmap-review">
    <section className="recommendation-layout" aria-label="Resource recommendations and budget">
      <div className="agent-picks"><div className="next-learning-heading"><span className="eyebrow"><Icon name="roadmap"/>Your next learning step</span><h2>{p.gaps[0] || 'Review your learning plan'}</h2><p>{plan.skills.length ? 'Your marked skills are skipped. Focus on your remaining gaps.' : 'Start with the basics, then build up your skills.'} No purchase marks a skill complete.</p></div><h2 className="recommendation-title">{p.selected.length ? 'Selected for your remaining gaps' : p.compared ? 'No suitable purchase' : 'Your learning plan is available'}</h2>
        {p.selected.length > 0 && <p className="agent-decision">{p.skipped.some(d => /overlap|coverage is already/i.test(d.reason)) ? 'Overlapping resources were skipped. These cover the remaining gaps.' : 'These cover the remaining gaps inside your spending rules.'}</p>}
        <div className="roadmap-resource-grid">{p.selected.map(d => {
          const resource = p.resource(d.resourceId), order = p.grant?.orders.find(o => o.resourceId === d.resourceId)
          return resource && <div key={d.resourceId}><ResourceCard resource={resource} provider={p.providerName(d.providerId)} reason={d.reason} order={order} priceStroops={d.priceStroops} onView={() => p.go(3)} />{order?.authorizeHash && <details className="inline-receipt"><summary>Testnet payment evidence</summary><Evidence hash={order.authorizeHash} label="Authorization transaction" /><p>Provider claim: {order.claim}. Fulfillment: {order.fulfillment}.</p></details>}</div>
        })}</div>
        {!p.selected.length && <p className="no-purchase-note">{!p.compared ? 'Resource comparison is not available yet. You can still follow the milestones below.' : 'No paid resource qualifies under these skills, providers and spending limits. Nothing will be purchased; your exam reserve stays protected.'}</p>}
      </div>
      <aside className="recommendation-budget" aria-label="Purchase plan summary"><h2><Icon name="wallet"/>Learner budget</h2><span className="testnet-label">Stellar Testnet · No real funds</span><dl className="rule-list">
        <div><dt>Selected total</dt><dd>{xlm(total.toString())} test XLM</dd></div>
        <div><dt>Available prep budget</dt><dd>{xlm(p.metrics.remaining)} test XLM</dd></div>
        <div><dt>Protected exam reserve</dt><dd>{xlm(p.metrics.reserve)} test XLM</dd></div>
        <div><dt>Maximum per resource</dt><dd>{xlm(p.grant?.perPurchaseLimitStroops || plan.limitStroops)} test XLM</dd></div>
        <div><dt>Separate Velo service fee</dt><dd>{p.setup?.velo.amount ? `${p.setup.velo.amount} test XLM` : 'Not available yet'}</dd></div>
      </dl><p className="fine-print">The prep budget excludes your reserve, pending commitments and settled spending. The service fee is additional; it does not fund learning resources. Testnet only. Demo prices, no real course or exam orders.</p>
        {!checkout.available && <p className="notice" role="status">{checkout.reason}</p>}
        {!p.compared && <p>Refresh resource recommendations before reviewing a purchase.</p>}
        {!eligible && p.selected.length > 0 && !p.grant?.started && <p className="notice">These selections no longer fit your available allowance or per-resource limit. Adjust your budget or refresh the comparison before purchasing.</p>}
        <div className="recommendation-actions"><button disabled={p.busy} onClick={continueJourney}>{primary}</button>{!eligible && primary !== 'Adjust budget' && !p.grant?.started && <button className="text-button" onClick={() => p.go(0)}>Adjust budget</button>}</div>
      </aside>
    </section>
    {p.skipped.length > 0 && <details className="alternatives"><summary>Why other resources were skipped ({p.skipped.length})</summary>{p.skipped.map(d => <div className="alternative" key={d.resourceId}><div><h3>{p.resource(d.resourceId)?.title || d.resourceId}</h3><p>{xlm(d.priceStroops)} test XLM · Demo price</p><p>{shown(d.reason)}</p></div><span className="status">{d.state === 'blocked' ? 'Blocked' : 'Skipped'}</span></div>)}</details>}
    <section id="learning-milestones" tabIndex={-1} className="roadmap-milestones"><div className="section-heading"><h2><Icon name="roadmap"/>Your learning milestones</h2><span className="subtle">Suggested pace, not a deadline</span></div><ol className="career-timeline">{roadmap?.steps?.map(s => <li key={s.skill}><span className="timeline-number">{String(s.order).padStart(2, '0')}</span><div><span className="eyebrow">{s.weekStart === s.weekEnd ? `WEEK ${s.weekStart}` : `WEEKS ${s.weekStart}–${s.weekEnd}`}</span><h3>{s.skill}</h3><p>{s.action}</p></div></li>)}</ol>{!p.gaps.length && <p>No skill gaps in this map. No purchase is needed.</p>}</section>
    <section id="free-learning" tabIndex={-1} aria-label="Free starting points">{roadmap?.freeResources?.map(r => <article className="free-resource" key={r.resourceId}><span className="free-resource-icon"><Icon name="book"/></span><div className="free-resource-copy"><span className="status">Free resource · No checkout</span><h3>{r.title}</h3><p>{r.reason}</p><span className="free-resource-note">Opens an external learning site in a new tab.</span><details><summary>Before you visit</summary><p>This link opens a learning index. Any optional paid offers are outside Pathwise and are not part of your plan.</p></details></div>{r.url && <a className="free-resource-action" href={r.url} target="_blank" rel="noreferrer">Open free resource <Icon name="arrow"/><span className="sr-only"> (opens in a new tab)</span></a>}</article>)}</section>
    <details className="path-settings"><summary>Plan details and optional resources</summary><p>{plan.skills.length ? plan.skills.join(' · ') : 'No skills selected'} · {plan.timelineWeeks || 12} weeks · {plan.formats.join(' · ')}</p><button className="text-button" onClick={() => p.go(0)}>Edit career and budget</button><button className="text-button" onClick={() => p.go(4)}>Browse the catalog</button>{!p.previewOnly && <button className="text-button" disabled={p.busy || !p.catalog} onClick={() => void p.act(p.buildRoadmap)}>Refresh resource comparison</button>}<p>Rule-based comparison. Refreshing does not authorize payment.</p></details>
    <details className="certification-references"><summary>Certification references and technical details</summary><p>These are references, not purchasable exam vouchers. The reserve is self-selected, not an estimate of actual exam fees.</p>{certificationReferences.filter(r => r.careers.includes(plan.career || 'cloud')).map(r => <a key={r.title} href={r.url} target="_blank" rel="noreferrer">{r.title}</a>)}<p>Rule-based selection. Authorization, provider settlement and fulfillment are tracked separately.</p><p>Curated career guidance, not an official syllabus or guarantee of a job or exam readiness. Paid catalog materials and prices are fictional demo data.</p></details>
    
  </div>
}
