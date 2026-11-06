import { useCallback, useEffect, useState } from 'react'
import { noirExtensionSigner } from '@noirx402/agent-sdk'
import { Networks } from '@stellar/stellar-sdk'
import type { Catalog, Decision, Grant, Plan, Roadmap, Setup } from './ui'
import { xlm } from './ui'
export function usePathwise() {
  const [step, setStep] = useState(0), [token, setToken] = useState('')
  const [plans, setPlans] = useState<Plan[]>([]), [saved, setSaved] = useState<Plan | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null), [setup, setSetup] = useState<Setup | null>(null)
  const [grants, setGrants] = useState<Grant[]>([]), [mode, setMode] = useState('simulation')
  const [providers, setProviders] = useState(['cloudtrail', 'sandbox', 'lantern'])
  const [draft, setDraft] = useState({ goal: 'AWS Certified Cloud Practitioner', skills: [] as string[], formats: ['course', 'lab', 'practice'], budget: '30', limit: '10', reserve: '10' })
  const [preview, setPreview] = useState<{ planId: string; mode: string; value: Roadmap } | null>(null)
  const [busy, setBusy] = useState(true), [notice, setNotice] = useState('Connecting to your learning space...')
  const [error, setError] = useState(false), [connectionError, setConnectionError] = useState('')
  const api = useCallback(async (path: string, body?: unknown, session = token) => {
    let res: Response
    try { res = await fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` }, body: body === undefined ? undefined : JSON.stringify(body) }) }
    catch { throw new Error('The backend could not be reached. Keep npm.cmd run dev running, then retry status. Do not repeat an uncertain payment.') }
    const data = await res.json().catch(() => { throw new Error('Unexpected backend response. Restart both apps, then reload status.') })
    if (!res.ok) throw new Error(data.error || 'This request could not be completed.')
    return data
  }, [token])
  const populate = (p: Plan) => setDraft({ goal: p.goal, skills: p.skills, formats: p.formats, budget: xlm(p.budgetStroops), limit: xlm(p.limitStroops), reserve: xlm(p.reserveStroops) })
  useEffect(() => {
    const lifetime = new AbortController()
    async function init() {
      try {
        const prior = sessionStorage.getItem('pathwise.session') || '', session = await api('session', {}, prior)
        sessionStorage.setItem('pathwise.session', session.token)
        const list: Plan[] = await api('plans', undefined, session.token)
        if (lifetime.signal.aborted) return
        setToken(session.token); setPlans(list)
        if (list[0]) { setSaved(list[0]); populate(list[0]); setStep(2) }
        setNotice(list[0] ? 'Your saved goal is ready. Continue where you left off.' : '')
      } catch (e) { if (!lifetime.signal.aborted) { setError(true); setNotice(e instanceof Error ? e.message : 'Could not load this session. Reload to try again.') } }
      finally { if (!lifetime.signal.aborted) setBusy(false) }
    }
    void init()
    return () => lifetime.abort()
    // Initialization supplies the persisted session explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const refresh = useCallback(async () => {
    const [c, g, s] = await Promise.all([api('agent/catalog'), api('agent/status'), api('setup')])
    setCatalog(c); setGrants(g); setSetup(s); setConnectionError('')
  }, [api])
  useEffect(() => {
    if (!token) return
    const lifetime = new AbortController()
    async function poll() {
      try {
        const [c, g, s] = await Promise.all([api('agent/catalog'), api('agent/status'), api('setup')])
        if (!lifetime.signal.aborted) { setCatalog(c); setGrants(g); setSetup(s); setConnectionError('') }
      } catch { if (!lifetime.signal.aborted) setConnectionError('Live status is unavailable. Commitments remain saved on the server. Check status before attempting another payment.') }
    }
    void poll()
    const timer = setInterval(() => { void poll() }, 2500)
    return () => { lifetime.abort(); clearInterval(timer) }
  }, [token, api])
  const grant = grants.find(g => g.mode === mode)
  const activePlan = (grant ? plans.find(p => p.id === grant.planId) : saved) || saved
  const approvedIds = grant ? grant.providers.map(p => p.id) : providers
  const roadmap = preview && preview.planId === activePlan?.id && preview.mode === mode ? preview.value : null
  const resource = (id: string) => catalog?.resources.find(r => r.id === id)
  const providerName = (id: string) => catalog?.providers.find(p => p.id === id)?.name || id
  const gaps = roadmap?.gaps || catalog?.skillMap.skills.filter(s => !activePlan?.skills.includes(s)) || []
  const decisions: Decision[] = grant?.started ? grant.orders.map(o => ({ resourceId: o.resourceId, providerId: o.providerId, priceStroops: o.amountStroops, state: 'selected', reason: o.selectionReason })) : roadmap?.decisions || []
  const selected = decisions.filter(d => d.state === 'selected'), skipped = roadmap?.decisions.filter(d => d.state === 'skipped') || []
  const ownerReady = ['registerDevice', 'registerAgent', 'fundEscrow'].every(kind => setup?.experiment?.ownerOperations.some(op => op.kind === kind && op.state === 'confirmed'))
  const serviceReady = Boolean(setup?.checkout?.active && setup.checkout.planId === activePlan?.id)
  const metrics = { total: grant?.totalBudgetStroops || activePlan?.budgetStroops || '0', reserve: grant?.reserveStroops || activePlan?.reserveStroops || '0', pending: grant?.pendingStroops || '0', spent: grant?.spentStroops || '0', remaining: grant?.remainingStroops || (activePlan ? (BigInt(activePlan.budgetStroops) - BigInt(activePlan.reserveStroops)).toString() : '0') }
  function go(next: number) { setStep(next); setNotice(''); setError(false); window.scrollTo({ top: 0, behavior: 'instant' }) }
  async function act(work: () => Promise<unknown>, success = '') {
    setBusy(true); setError(false); setNotice(mode === 'simulation' ? 'Working on your simulation. No funds will move.' : 'Working. Testnet wallet transactions may take a minute to confirm.')
    try { await work(); if (success) setNotice(success) }
    catch (e) { setError(true); setNotice(e instanceof Error ? e.message : 'Could not complete this action. Check status before retrying.') }
    finally { try { if (token) await refresh() } catch { setConnectionError('Could not refresh status. The request may still be processing; check status before retrying.') } setBusy(false) }
  }
  async function save() { const p: Plan = await api('plans', draft); setSaved(p); setPlans([p, ...plans]); setPreview(null); go(2) }
  async function buildRoadmap() {
    if (!activePlan) throw new Error('Save your goal first.')
    const result = await api('agent/preview', { planId: activePlan.id, providers: approvedIds, mode })
    setPreview({ planId: activePlan.id, mode, value: result }); go(2)
  }
  async function connect() {
    const signer = await noirExtensionSigner(), challenge = await api('wallet/challenge', { owner: signer.publicKey })
    const signed = await signer.signTransaction(challenge.xdr, { networkPassphrase: Networks.TESTNET })
    await api('wallet/verify', { id: challenge.id, signedXdr: typeof signed === 'string' ? signed : signed.signedTxXdr })
  }
  async function signOwner(kind: string) {
    const signer = await noirExtensionSigner()
    if (signer.publicKey !== grant?.owner) throw new Error('Switch Noir to this authorization’s owner wallet before signing.')
    const prepared = await api('noir/owner/prepare', { kind }), signed = await signer.signTransaction(prepared.xdr, { networkPassphrase: Networks.TESTNET })
    await api('noir/owner/submit', { id: prepared.id, signedXdr: typeof signed === 'string' ? signed : signed.signedTxXdr })
  }
  async function approve() { await api('agent/approve', { planId: activePlan?.id, providers: approvedIds, mode }); go(mode === 'simulation' ? 3 : 1) }
  function selectMode(next: string) {
    setMode(next); setPreview(null); setNotice(''); setError(false)
    const g = grants.find(g => g.mode === next), p = g ? plans.find(p => p.id === g.planId) : saved
    if (p) populate(p)
  }
  function toggleProvider(id: string) { setProviders(providers.includes(id) ? providers.filter(v => v !== id) : [...providers, id]); setPreview(null) }
  return { step, token, busy, notice, error, connectionError, draft, setDraft, catalog, setup, grant, activePlan, approvedIds, roadmap, selected, skipped, gaps, ownerReady, serviceReady, metrics, mode, selectMode, resource, providerName, go, act, api, refresh, save, buildRoadmap, connect, signOwner, approve, toggleProvider }
}
export type Pathwise = ReturnType<typeof usePathwise>
