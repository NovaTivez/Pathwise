import { useState } from 'react'
import type { Pathwise } from './usePathwise'
import type { Order } from './ui'
import { Evidence } from './components'
import { available, purchaseExplanation, resourceStage } from './learning'
import { readable, shown, xlm } from './ui'
import { Icon } from './Icon'

export function PurchaseCard({ p, order, mode, planId }: { p: Pathwise; order: Order; mode: string; planId?: string }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const simulated = mode !== 'testnet' || order.status === 'simulated'
  const previewReady = !simulated && available(order)
  const resource = p.resource(order.resourceId)
  return <article className="receipt-card">
    <span className="eyebrow">{simulated ? 'Simulation record · No payment submitted' : 'Stellar Testnet · No real funds'}</span>
    <div className="receipt-resource-head"><span className={`purchase-resource-icon format-${resource?.format || 'course'}`}><Icon name={resource?.format === 'lab' ? 'code' : 'book'}/></span><div><span className="provider-name">{p.providerName(order.providerId)}</span><h2>{resource?.title || order.resourceId}</h2></div><strong className="receipt-amount">{xlm(order.amountStroops)}<small>test XLM · Demo price</small></strong></div>
    <span className={`status ${previewReady ? 'good' : resourceStage(order) === 'Action needed' ? 'warning' : ''}`}>{simulated ? 'Simulation record' : resourceStage(order)}</span><p>{simulated ? 'No transaction or resource access was delivered by this simulation.' : purchaseExplanation(order)}</p>
    {previewReady ? <><button aria-expanded={previewOpen} onClick={() => setPreviewOpen(!previewOpen)}>{previewOpen ? 'Close preview' : 'Open preview'}</button>{previewOpen && <section className="access-code" aria-label="Resource preview"><h3>Sample content</h3><p>{resource?.fulfillment?.description || 'Demonstration learning resource.'}</p><code>{order.sampleAccessCode}</code><p>This sample does not enroll you in a commercial course or mark a skill complete.</p></section>}</> : !simulated && (order.status === 'blocked' ? <button onClick={() => planId ? p.viewPlan(planId) : p.go(2)}>Review purchase plan</button> : <button disabled={p.busy} onClick={() => void p.act(p.refresh, 'Purchase status checked. Unverified payments remain pending.')}>Check status</button>)}
    {!simulated && order.status === 'failed' && <p>If the saved payment remains failed, ask the operator to reconcile this record. Starting another purchase is not a safe retry.</p>}
    <details className="purchase-details"><summary>Payment details</summary><p>{shown(order.selectionReason)}</p><p>{shown(order.reason)}</p><dl className="order-states"><div><dt>Authorization</dt><dd>{readable(order.authorization)}</dd></div><div><dt>Provider claim</dt><dd>{readable(order.claim)}</dd></div><div><dt>Fulfillment</dt><dd>{readable(order.fulfillment)}</dd></div></dl>{!simulated && <div className="evidence-row"><Evidence hash={order.authorizeHash} label="Authorization transaction" /><Evidence hash={order.claimHash} label="Aggregate provider claim" /></div>}</details>
  </article>
}
