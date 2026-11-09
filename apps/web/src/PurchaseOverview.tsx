import type { Pathwise } from './usePathwise'
import { Icon } from './Icon'
import { xlm } from './ui'
export function PurchaseOverview({ p }: { p: Pathwise }) {
  if (!p.activePlan) return null
  return <section className="purchase-overview" aria-label="Current plan learning budget">{[
    ['Total learning budget',p.metrics.total,'wallet'],['Protected exam reserve',p.metrics.reserve,'shield'],['Pending commitments',p.metrics.pending,'clock'],['Remaining prep budget',p.metrics.remaining,'book'],
  ].map(([label,value,icon]) => <div className="metric-card" key={label}><span className="eyebrow">{label}<Icon name={icon}/></span><strong>{xlm(value)} <small>test XLM</small></strong><span>{label==='Protected exam reserve'?'Outside learning escrow':label==='Pending commitments'?'Not yet settled':label==='Remaining prep budget'?'After reserve and commitments':'Velo service fee is separate'}</span></div>)}</section>
}
