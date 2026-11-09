import { PurchaseOverview } from './PurchaseOverview'
import type { Pathwise } from './usePathwise'
import { Evidence } from './components'
import { PurchaseCard } from './PurchaseCard'
export function ActivityView({ p }: { p: Pathwise }) {
  const paid = p.grants.filter(g => g.mode === 'testnet').flatMap(g => g.orders.map(order => ({ order, planId: g.planId })))
  const simulations = p.grants.filter(g => g.mode !== 'testnet').flatMap(g => g.orders)
  return <><PurchaseOverview p={p}/><section className="activity-page"><p className="page-subtitle">Your resource purchases and separate service receipt.</p>
    {paid.map(({ order, planId }) => <PurchaseCard key={order.id} p={p} order={order} mode="testnet" planId={planId} />)}
    {p.setup?.checkout && <article className="receipt-card"><span className="eyebrow">Stellar Testnet · No real funds</span><h2>Pathwise service</h2><p><strong>{p.setup.checkout.amount} test XLM</strong> · Separate Velo service fee</p><span className="status">{p.setup.checkout.active ? 'Service payment verified' : ['failed','expired','cancelled'].includes(p.setup.checkout.status) ? 'Action needed' : 'Processing'}</span><p>{p.setup.checkout.active ? 'This receipt covers the Pathwise service, not learning-resource escrow.' : ['failed','expired','cancelled'].includes(p.setup.checkout.status) ? 'This checkout needs attention. Review its saved status before attempting another payment.' : 'Awaiting backend payment verification. A browser return does not confirm payment.'}</p>{!p.setup.checkout.active && <button onClick={() => p.go(7)}>Check payment status</button>}<details><summary>Payment details</summary><p>Checkout status: {p.setup.checkout.status}</p><Evidence hash={p.setup.checkout.transactionHash} label="Service payment transaction" /></details></article>}
    {!paid.length && !p.setup?.checkout && <section className="empty"><h2>No purchases yet</h2><p>Start with your roadmap to review optional resource purchases.</p><button onClick={() => p.go(2)}>View roadmap</button></section>}
    {simulations.length > 0 && <details><summary>Simulation records ({simulations.length}) · No verified payments</summary>{simulations.map(order => <PurchaseCard key={order.id} p={p} order={order} mode="simulation" />)}</details>}
  </section></>
}
