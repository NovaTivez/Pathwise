import { useCallback, useEffect, useRef, useState } from 'react'
import { noirExtensionSigner } from '@noirx402/agent-sdk'
import { Networks } from '@stellar/stellar-sdk'

type Provider = { id: string; name: string; merchant: string | null }
type Resource = { id: string; providerId: string; title: string; skills: string[]; format: string; priceStroops: string; originalPriceStroops: string; fulfillment: { description: string } }
type Roadmap = { engine: string; outcome: string; gaps: string[]; remainingStroops: string; decisions: { resourceId: string; providerId: string; priceStroops: string; state: string; reason: string }[] }
type Grant = { id: string; mode: string; planId: string; started: boolean; expiresAt: string; owner: string; providers: { id: string; merchant: string | null }[]; remainingStroops: string; reserveStroops: string; orders: { id: string; resourceId: string; providerId: string; amountStroops: string; status: string; reason: string; authorization: string; claim: string; fulfillment: string; authorizeHash: string | null; claimHash: string | null; sampleAccessCode: string | null }[] }
type Setup = { noir: { ready: boolean; blockers: string[] }; checkout: { active: boolean; planId: string } | null; experiment: { fundingStroops: string; deviceHash: string; ownerOperations: { kind: string; state: string; hash: string }[] } | null }
function xlm(s: string) { const value = BigInt(s), fraction = (value % 10000000n).toString().padStart(7, '0').replace(/0+$/, ''); return `${value / 10000000n}${fraction ? '.' + fraction : ''}` }
function Evidence({ hash, label }: { hash: string | null; label: string }) { return hash ? <p><a href={`https://stellar.expert/explorer/testnet/tx/${hash}`} target="_blank" rel="noreferrer">{label}: {hash}</a></p> : null }
export default function LearningAgent({ token, planId }: { token: string; planId?: string }) {
  const [catalog, setCatalog] = useState<{ providers: Provider[]; resources: Resource[]; skillMap: { disclaimer: string }; prices: string } | null>(null)
  const [grants, setGrants] = useState<Grant[]>([])
  const [setup, setSetup] = useState<Setup | null>(null)
  const [mode, setMode] = useState('simulation')
  const [providers, setProviders] = useState(['cloudtrail', 'sandbox', 'lantern'])
  const [previewData, setRoadmap] = useState<{ planId?: string; mode: string; value: Roadmap } | null>(null)
  const roadmap = previewData?.planId === planId && previewData?.mode === mode ? previewData.value : null
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const api = useCallback(async (path: string, body?: unknown) => {
    const res = await fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Agent request failed.')
    return data
  }, [token])
  async function refresh() { const [next, status] = await Promise.all([api('agent/status'), api('setup')]); setGrants(next); setSetup(status) }
  const polling = useRef(false)
  useEffect(() => {
    if (!token) return
    const lifetime = new AbortController()
    async function poll() {
      if (polling.current) return
      polling.current = true
      try {
        const [c, g, s] = await Promise.all([api('agent/catalog'), api('agent/status'), api('setup')])
        if (!lifetime.signal.aborted) { setCatalog(c); setGrants(g); setSetup(s) }
      } catch { if (!lifetime.signal.aborted) { setError(true); setMessage('Agent status unavailable. Check the backend and reload; no payment should be repeated because the browser lost its connection.') } }
      finally { polling.current = false }
    }
    void poll()
    const timer = setInterval(() => { void poll() }, 2500)
    return () => { lifetime.abort(); clearInterval(timer) }
  }, [token, api])
  async function action(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(false); setMessage('Working...')
    try { await work(); setMessage(success) }
    catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'Request failed.') }
    finally { try { await refresh() } catch { /* polling will recover status without resending transactions */ } setBusy(false) }
  }
  const current = grants.find(g => g.mode === mode)
  const approvedIds = current ? current.providers.map(p => p.id) : providers
  const title = (id: string) => catalog?.resources.find(r => r.id === id)?.title || id
  async function signOwner(kind: string) {
    const signer = await noirExtensionSigner()
    if (signer.publicKey !== current?.owner) throw new Error('Switch Noir to the owner wallet bound to this authorization.')
    const prepared = await api('noir/owner/prepare', { kind })
    const signed = await signer.signTransaction(prepared.xdr, { networkPassphrase: Networks.TESTNET })
    await api('noir/owner/submit', { id: prepared.id, signedXdr: typeof signed === 'string' ? signed : signed.signedTxXdr })
  }
  if (!token) return null
  return <section className="payment-setup" aria-busy={busy}>
    <h2>04 / Your educational purchasing agent</h2>
    <p>{catalog?.skillMap.disclaimer}</p><p>Rule-based planning is active. No LLM adapter is configured. All providers, resources, prices, and discounts below are demonstration data.</p>
    <label>Execution mode<select value={mode} onChange={e => setMode(e.target.value)}><option value="simulation">Simulation - no funds, transactions, or access codes</option><option value="testnet">Actual Stellar Testnet payments - setup required</option></select></label>
    <p className="badge">{mode === 'simulation' ? 'SIMULATION ONLY' : 'ACTUAL TESTNET MODE / NEVER MAINNET'}</p>
    <fieldset disabled={busy || Boolean(current)}><legend>Approve fictional providers</legend>{catalog?.providers.map(p => <label className="check" key={p.id}><input type="checkbox" checked={approvedIds.includes(p.id)} onChange={() => { setProviders(providers.includes(p.id) ? providers.filter(id => id !== p.id) : [...providers, p.id]); setRoadmap(null) }} />{p.name} {p.merchant ? '(merchant configured)' : '(Testnet merchant not configured)'}</label>)}</fieldset>
    <details><summary>Browse the demonstration catalog</summary>{catalog?.resources.map(r => <article key={r.id}><h3>{r.title}</h3><p>{r.id} / {r.providerId} / {r.format}<br />Coverage: {r.skills.join(', ')}<br />Demo price: {xlm(r.priceStroops)} test XLM; demo original price: {xlm(r.originalPriceStroops)} test XLM. Demo saving: {xlm((BigInt(r.originalPriceStroops) - BigInt(r.priceStroops)).toString())} test XLM.</p><small>{r.fulfillment.description}</small></article>)}</details>
    <button disabled={busy || !planId || !providers.length} onClick={() => void action(async () => setRoadmap({ planId, mode, value: await api('agent/preview', { planId, providers: approvedIds, mode }) }), 'Roadmap evaluated on the server. Skipped resources will not be purchased.')}>Compare resources & build roadmap</button>
    {roadmap && <><h3>{roadmap.outcome === 'no_suitable_purchase' ? 'No suitable purchase - leave funds unspent' : 'Suggested purchases and skipped alternatives'}</h3><p>Skill gaps: {roadmap.gaps.join(', ') || 'None in this curated map'}. Planner: {roadmap.engine}.</p>{roadmap.decisions.map(d => <article key={d.resourceId}><div className="row"><h3>{title(d.resourceId)}</h3><span className={`state ${d.state === 'skipped' ? 'blocked' : ''}`}>{d.state}</span></div><p>{xlm(d.priceStroops)} test XLM / {d.providerId}<br />{d.reason}</p></article>)}<p>Uncommitted learning funds after this plan: {xlm(roadmap.remainingStroops)} test XLM. The exam reserve stays protected.</p></>}
    {mode === 'testnet' && <><p>Connect the wallet and verify the separate Velo service payment in the setup section above first.</p>{setup?.noir.blockers.map(b => <p key={b}>{b}</p>)}</>}
    <p>Approval lasts one hour and fixes the saved learner plan and approved providers. Current catalog prices are checked again before execution. Testnet escrow funding uses the plan's total budget minus its exam reserve; useful purchases can leave escrow funds unspent. Service fees and network fees are separate.</p>
    <button disabled={busy || !planId || !roadmap || roadmap.outcome === 'no_suitable_purchase' || Boolean(current) || (mode === 'testnet' && (!setup?.noir.ready || !setup.checkout?.active || setup.checkout.planId !== planId))} onClick={() => void action(() => api('agent/approve', { planId, providers, mode }), mode === 'simulation' ? 'Simulation rules approved. Start the simulated agent when ready.' : 'Application rules approved. Complete the three owner-signed setup transactions below before starting.')}>{mode === 'simulation' ? 'Approve simulation rules' : 'Approve Testnet purchasing rules once'}</button>
    {current && <><h3>{mode === 'simulation' ? 'Simulation authorization' : 'Testnet authorization'}</h3><p>Expires: {new Date(current.expiresAt).toLocaleString()}<br />Saved plan: {current.planId}<br />Remaining learning funds: {xlm(current.remainingStroops)} test XLM<br />Protected exam reserve: {xlm(current.reserveStroops)} test XLM</p>
    {mode === 'testnet' && setup?.experiment && <><p>Escrow funding: {xlm(setup.experiment.fundingStroops)} test XLM.<br />Virtual demonstration device: <code>{setup.experiment.deviceHash}</code></p>{[['registerDevice', 'Register device'], ['registerAgent', 'Register agent policy'], ['fundEscrow', 'Fund learning escrow']].map(([kind, label]) => <button key={kind} disabled={busy || setup.experiment!.ownerOperations.some(op => op.kind === kind && ['pending', 'confirmed'].includes(op.state))} onClick={() => void action(() => signOwner(kind), `${label} confirmed. Review its actual transaction evidence.`)}>{label} (owner wallet signature)</button>)}{setup.experiment.ownerOperations.map(op => <div key={op.hash}><small>{op.kind}: {op.state}</small><Evidence hash={op.hash} label="Owner setup transaction (inspect status)" /></div>)}<button disabled={busy} onClick={() => void action(() => api('noir/reconcile', {}), 'Known owner transaction hashes checked. Uncertain operations remain pending.')}>Reconcile owner setup transactions</button></>}
    <button disabled={busy || current.started || (mode === 'testnet' && (!setup?.checkout?.active || !['registerDevice', 'registerAgent', 'fundEscrow'].every(kind => setup.experiment?.ownerOperations.some(op => op.kind === kind && op.state === 'confirmed'))))} onClick={() => void action(() => api('agent/start', { grantId: current.id }), 'Selected purchases reserved atomically. The backend worker continues independently of this browser.')}>{current.started ? 'Agent started - monitoring saved orders' : mode === 'simulation' ? 'Start simulated agent' : 'Start agent'}</button>
    {current.started && !current.orders.length && <p>No suitable purchase remains. Funds were left unspent.</p>}
    {current.orders.map(o => <article key={o.id}><h3>{title(o.resourceId)}</h3><span className="state">{o.status.replaceAll('_', ' ')}</span><p>{xlm(o.amountStroops)} test XLM / {o.providerId}<br />Authorization: {o.authorization}<br />Merchant claim: {o.claim}<br />Fulfillment: {o.fulfillment}<br />{o.reason}</p><Evidence hash={o.authorizeHash} label="Authorization transaction (check state)" /><Evidence hash={o.claimHash} label="Aggregate claim transaction (check state)" />{o.sampleAccessCode && <p>Demonstration access code after verified settlement: <strong>{o.sampleAccessCode}</strong>. This is not commercial course access.</p>}</article>)}
    </>}
    <p role={error ? 'alert' : 'status'}>{message}</p><small>The backend stores and processes orders. Closing this tab does not cancel payments. Restarting the backend resumes queued work and reconciliation; unknown outcomes keep funds committed.</small>
  </section>
}
