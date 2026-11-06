import type { Pathwise } from './usePathwise'
import { readable } from './ui'
export function Evidence({ hash, label }: { hash?: string | null; label: string }) {
  return hash && /^[a-f0-9]{64}$/i.test(hash) ? <a className="evidence" target="_blank" rel="noreferrer" href={`https://stellar.expert/explorer/testnet/tx/${hash}`}>{label} ↗<span className="sr-only"> (Stellar Expert Testnet, new tab)</span></a> : null
}
export function ServiceSummary({ p }: { p: Pathwise }) {
  const matchesPlan = p.setup?.checkout?.planId === p.activePlan?.id
  const verified = Boolean(p.setup?.checkout?.active && matchesPlan)
  return <div className="service-summary"><div><span className="eyebrow">SEPARATE SERVICE FEE</span><h3>{p.setup?.checkout?.amount || p.setup?.velo.amount || '—'} <small>test XLM</small></h3><p>Roadmap & procurement service. Separate from your learning budget and escrow.{p.mode === 'simulation' && ' No service payment is required for simulation.'}</p></div><span className={`status ${verified ? 'good' : ''}`}>{verified ? 'Verified service payment' : p.setup?.checkout && !matchesPlan ? 'Checkout belongs to another goal' : p.setup?.checkout ? readable(p.setup.checkout.status) : 'Not paid'}</span><Evidence hash={p.setup?.checkout?.transactionHash} label="Service transaction (inspect status)" /></div>
}
export function NeedGoal({ p }: { p: Pathwise }) { return <div className="panel empty"><h2>A goal comes first.</h2><p>Save your preferences and budget to build a learning path.</p><button onClick={() => p.go(0)}>Set up my goal</button></div> }
