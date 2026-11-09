import { PurchaseOverview } from './PurchaseOverview'
import { useEffect, useState } from 'react'
import type { Pathwise } from './usePathwise'
import { NeedGoal, ServiceSummary } from './components'
import { BudgetSummary } from './LearningComponents'
import { PurchaseCard } from './PurchaseCard'
import { xlm } from './ui'

export function DashboardView({ p }: { p: Pathwise }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer) }, [])
  if (!p.activePlan) return <NeedGoal p={p} />
  const expired = Boolean(p.grant && Date.parse(p.grant.expiresAt) <= now)
  const total = p.selected.reduce((sum, d) => sum + BigInt(d.priceStroops), 0n)
  const withinRules = p.selected.length > 0 && total <= BigInt(p.metrics.remaining) && p.selected.every(d => p.approvedIds.includes(d.providerId) && BigInt(d.priceStroops) <= BigInt(p.grant?.perPurchaseLimitStroops || p.activePlan!.limitStroops))
  const ready = Boolean(p.grant && !p.grant.started && !expired && withinRules && !p.connectionError && p.setup?.wallet && p.serviceReady && p.ownerReady && p.setup.noir.ready)
  return <><PurchaseOverview p={p}/><div className="path-layout"><section>
    <div className="library-intro"><span className="eyebrow">{p.activePlan.goal}</span><p>Review purchases and open resource previews after verified settlement.</p></div>
    {p.grant && !p.grant.started && <section className="start-agent"><span className="eyebrow">Stellar Testnet · No real funds</span><h2>{ready ? 'Ready to start' : 'Action needed'}</h2><ul>{p.selected.map(d => <li key={d.resourceId}>{p.resource(d.resourceId)?.title || d.resourceId} · {p.providerName(d.providerId)} · {xlm(d.priceStroops)} test XLM</li>)}</ul><p><strong>Selected total: {xlm(total.toString())} test XLM</strong></p><p>{xlm(p.metrics.reserve)} test XLM stays protected for your exam. Maximum per resource: {xlm(p.grant.perPurchaseLimitStroops)} test XLM. Velo service payment is separate.</p>
      {expired ? <p role="alert">Your authorization has expired. New purchases are blocked. Existing records must be reconciled with the operator before another authorization can be considered.</p> : !ready && <p>Complete wallet verification, the verified service payment and confirmed Noir funding before starting. Check status if the backend is unavailable.</p>}
      <details><summary>Payment details</summary><ul><li>Wallet ownership: {p.setup?.wallet ? 'Verified' : 'Not verified'}</li><li>Velo service payment for this plan: {p.serviceReady ? 'Verified' : 'Not verified'}</li><li>Noir setup and escrow funding: {p.ownerReady ? 'Confirmed' : 'Not confirmed'}</li><li>Resource allowance and providers: {withinRules ? 'Within rules' : 'Review required'}</li></ul></details>
      {ready ? <button disabled={p.busy} onClick={() => void p.act(() => p.api('agent/start', { grantId: p.grant!.id }), 'Purchases are processing. Check their saved status below.')}>{p.busy ? 'Starting…' : 'Start Testnet purchases'}</button> : <button disabled={p.busy} onClick={() => expired || p.connectionError ? void p.act(p.refresh, 'Saved purchase status checked.') : p.go(p.resumeSetup())}>{expired || p.connectionError ? 'Check status' : 'Continue setup'}</button>}
    </section>}
    {!p.grant && <section className="empty"><h2>No purchases yet</h2><p>Review your resource recommendations before setting up optional purchases.</p><button onClick={() => p.go(2)}>Review purchase plan</button></section>}
    {p.grant?.started && !p.grant.orders.length && <section className="empty"><h2>No eligible purchase</h2><p>No additional resource fits the saved rules. Nothing additional was spent.</p><button onClick={() => p.go(2)}>Return to roadmap</button></section>}
    {p.grant?.orders.map(order => <PurchaseCard key={order.id} p={p} order={order} mode={p.grant!.mode} />)}
    {p.grant?.started && <p className="fine-print">Pathwise processes saved orders on the server. Refreshing or closing this page does not submit another purchase.</p>}
    <details className="service-details"><summary>Separate Velo service payment</summary><ServiceSummary p={p} /><button className="text-button" onClick={() => p.go(7)}>View service payment</button></details>
  </section><aside className="path-aside"><BudgetSummary p={p} /></aside></div></>
}
