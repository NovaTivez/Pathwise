import { useEffect, useState } from 'react'
import type { Pathwise } from './usePathwise'
import { readable } from './ui'

const EXPERT_INDEX_DELAY_MS = 12000

function expertReadyAt(hash: string) {
  const key = `pathwise.expert-ready.${hash}`
  try {
    const saved = Number(sessionStorage.getItem(key))
    if (Number.isFinite(saved) && saved > 0) return saved
    const readyAt = Date.now() + EXPERT_INDEX_DELAY_MS
    sessionStorage.setItem(key, String(readyAt))
    return readyAt
  } catch {
    return Date.now() + EXPERT_INDEX_DELAY_MS
  }
}

export function Evidence({ hash, label }: { hash?: string | null; label: string }) {
  const valid = Boolean(hash && /^[a-f0-9]{64}$/i.test(hash))
  const [readyAt, setReadyAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!valid || !hash) { setReadyAt(null); return }
    const opensAt = expertReadyAt(hash)
    setReadyAt(opensAt)
    if (opensAt <= Date.now()) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [hash, valid])
  if (!valid || !hash) return null
  if (readyAt === null || now < readyAt) {
    const seconds = readyAt === null ? Math.ceil(EXPERT_INDEX_DELAY_MS / 1000) : Math.max(1, Math.ceil((readyAt - now) / 1000))
    return <span className="evidence waiting" aria-disabled="true">{label} — indexing on Stellar Expert ({seconds}s)</span>
  }
  return <a className="evidence" target="_blank" rel="noreferrer" href={`https://stellar.expert/explorer/testnet/tx/${hash}`}>{label} ↗<span className="sr-only"> (Stellar Expert Testnet, new tab)</span></a>
}
export function ServiceSummary({ p }: { p: Pathwise }) {
  const matchesPlan = p.setup?.checkout?.planId === p.activePlan?.id
  const verified = Boolean(p.setup?.checkout?.active && matchesPlan)
  return <div className="service-summary"><div><span className="eyebrow">SEPARATE SERVICE FEE</span><h3>{p.setup?.checkout?.amount || p.setup?.velo.amount || '—'} <small>test XLM</small></h3><p>Roadmap and procurement service. Separate from your learning budget and escrow.</p></div><span className={`status ${verified ? 'good' : ''}`}>{verified ? 'Verified service payment' : p.setup?.checkout && !matchesPlan ? 'Checkout belongs to another goal' : p.setup?.checkout ? readable(p.setup.checkout.status) : 'Not paid'}</span><Evidence hash={p.setup?.checkout?.transactionHash} label="Service transaction (inspect status)" /></div>
}
export function NeedGoal({ p }: { p: Pathwise }) { return <div className="panel empty"><h2>Save a career and budget first.</h2><p>Set a career, skills, timeline, and budget to build a roadmap.</p><button onClick={() => p.go(0)}>Choose a career</button></div> }
