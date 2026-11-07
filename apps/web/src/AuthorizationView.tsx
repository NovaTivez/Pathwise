import type { ReactNode } from 'react'
import type { Pathwise } from './usePathwise'
import { Evidence, NeedGoal, ServiceSummary } from './components'
import { BudgetSummary } from './LearningComponents'
import { readable, xlm } from './ui'

const paySteps = [
  { step: 6, label: 'Wallet' },
  { step: 7, label: 'Service fee' },
  { step: 8, label: 'Escrow' },
]

function PayProgress({ p }: { p: Pathwise }) {
  return <ol className="setup-progress three" aria-label="Testnet setup steps">{paySteps.map((item, index) => {
    const current = p.step === item.step
    const locked = item.step === 8 && !p.grant
    return <li key={item.step} className={current ? 'current' : item.step < p.step ? 'visited' : ''} aria-current={current ? 'step' : undefined}><button type="button" disabled={locked} onClick={() => p.go(item.step)}><span>{index + 1}</span><span>{item.label}</span></button></li>
  })}</ol>
}

function PayFrame({ p, children }: { p: Pathwise; children: ReactNode }) {
  if (!p.activePlan) return <NeedGoal p={p} />
  if (p.previewOnly) return <section className="empty"><h2>This path is for planning.</h2><p>The connected backend does not yet support purchases for this career. No checkout, wallet signature or spending authorization will be requested.</p><button onClick={() => p.go(2)}>Back to my roadmap</button></section>
  return <div className="path-layout"><section className="pay-step"><PayProgress p={p} />{children}</section><div className="path-aside"><BudgetSummary p={p} /><p className="fine-print">The service fee is separate from this learning budget. Returning from Velo does not by itself turn purchasing on.</p></div></div>
}

export function AuthorizationView({ p }: { p: Pathwise }) {
  const { activePlan, grant, busy } = p
  if (!activePlan) return <NeedGoal p={p} />
  if (p.previewOnly) return <section className="empty"><h2>This path is for planning.</h2><p>The connected backend does not yet support purchases for this career. No checkout, wallet signature or spending authorization will be requested.</p><button onClick={() => p.go(2)}>Back to my roadmap</button></section>
  return <div className="path-layout"><section>
    <section className="settings-section"><h2>Approved providers</h2><p>Test XLM is Stellar Testnet currency. This demo does not charge real money. Only the demo providers you check here can be paid.</p><fieldset disabled={busy || Boolean(grant)}><legend className="sr-only">Approved demo providers</legend>{p.catalog?.providers.map(provider => <label className="provider-choice" key={provider.id}><input type="checkbox" checked={p.approvedIds.includes(provider.id)} onChange={() => p.toggleProvider(provider.id)} /><span><strong>{provider.name}</strong><small>Demo provider · {provider.merchant ? 'Testnet account configured' : 'Testnet account needs setup'}</small></span></label>)}</fieldset></section>
    <section className="settings-section"><h2>Spending limits</h2><p>Up to <strong>{xlm(p.metrics.remaining)} test XLM</strong> is available for learning resources. Each resource must cost no more than <strong>{xlm(grant?.perPurchaseLimitStroops || activePlan.limitStroops)} test XLM</strong>. Purchases cannot use the exam reserve, repeat a resource, or pay an unapproved provider.</p><p className="fine-print">{grant ? `Rules expire ${new Date(grant.expiresAt).toLocaleString()}.` : 'Authorization lasts one hour from approval.'} The Velo service fee is separate from this learning budget.</p></section>
    <div className="bottom-actions"><button className="text-button" onClick={() => p.go(2)}>← Roadmap</button>{grant ? <button onClick={() => p.go(p.resumeSetup())}>Continue setup →</button> : p.selected.length ? <button onClick={() => p.go(6)} disabled={busy || !p.approvedIds.length || !p.catalog}>Continue to wallet →</button> : <button disabled={busy || !p.approvedIds.length || !p.catalog} onClick={() => void p.act(p.buildRoadmap)}>Find resources within these rules →</button>}</div>
  </section><div className="path-aside"><BudgetSummary p={p} /><p className="fine-print">Wallet, service fee, and escrow are the next three steps.</p></div></div>
}

export function WalletPage({ p }: { p: Pathwise }) {
  const { setup, busy } = p
  return <PayFrame p={p}><section className="settings-section"><div className="section-heading"><h2>Verify the wallet that approves spending.</h2><span className={`status ${setup?.wallet ? 'good' : ''}`}>{setup?.wallet ? 'Verified' : 'Not connected'}</span></div><p>Sign a one-use ownership challenge in Noir on Stellar Testnet. Your keys stay in your wallet. The next page is only the service fee.</p><button disabled={busy} onClick={() => void p.act(p.connect, setup?.wallet ? 'Wallet ownership verified again for this session.' : 'Wallet ownership verified. Continue to the service fee.')}>{setup?.wallet ? 'Verify wallet again' : 'Connect & verify Noir wallet'}</button><details><summary>Wallet setup & connected account</summary>{setup?.wallet && <code className="address">{setup.wallet.owner}</code>}<p>Install Noir from its official listing, select Stellar Testnet and fund the public address using Friendbot. Never enter an owner secret key in Pathwise.</p><a href="https://chromewebstore.google.com/detail/noir/gikfhchijjljpbhokmdmaadgmpbchmjl" target="_blank" rel="noreferrer">Official Noir extension ↗</a></details></section><div className="bottom-actions"><button className="text-button" onClick={() => p.go(1)}>← Spending rules</button><button onClick={() => p.go(7)} disabled={!setup?.wallet}>Continue to service fee →</button></div></PayFrame>
}

export function FeePage({ p }: { p: Pathwise }) {
  const { activePlan, setup, grant, busy } = p
  async function payInVelo() {
    if (!activePlan) throw new Error('Save a goal before paying the service fee.')
    const popup = window.open('about:blank', 'pathwise-velo')
    if (!popup) throw new Error('Allow pop-ups for Pathwise, then try again. This step stays open.')
    try {
      const created = await p.api('service/checkout', { planId: activePlan.id }) as { checkoutUrl?: string | null }
      if (!created?.checkoutUrl) { popup.close(); throw new Error('No Velo checkout link was returned. Stay on this step and try again.') }
      popup.location.replace(created.checkoutUrl)
    } catch (error) { popup.close(); throw error }
  }
  return <PayFrame p={p}><section className="settings-section"><h2>Pay the 1 test XLM service fee in Velo.</h2><ServiceSummary p={p} /><p>Velo opens in another tab. After payment, that tab closes and this step stays put. If the tab cannot close, it opens this same service-fee step instead of the homepage.</p><div className="button-row"><button disabled={busy || !setup?.wallet || !setup?.velo.ready} onClick={() => void p.act(payInVelo, 'Velo is open in another tab. Stay on this service fee step.')}>Pay service fee in Velo</button><button className="text-button" disabled={busy || !setup?.checkout} onClick={() => void p.act(() => p.api('service/refresh', {}), 'Payment status retrieved. Activation also requires the matching verified webhook and Testnet transaction.')}>Check payment status</button></div>{Boolean(setup?.velo.blockers.length) && <details className="integration-details"><summary>Service fee needs attention</summary><ul>{setup?.velo.blockers.map(item => <li key={item}>{item}</li>)}</ul></details>}</section><div className="bottom-actions"><button className="text-button" onClick={() => p.go(6)}>← Wallet</button>{grant ? <button onClick={() => p.go(8)}>Continue to escrow →</button> : <button disabled={busy || !p.serviceReady || !p.approvedIds.length || !setup?.noir.ready} onClick={() => void p.act(p.approve, 'Rules approved. Sign the escrow steps next.')}>Approve rules & continue to escrow →</button>}</div></PayFrame>
}

export function EscrowPage({ p }: { p: Pathwise }) {
  const { setup, grant, busy } = p
  return <PayFrame p={p}>{!grant ? <section className="settings-section"><h2>Escrow starts after the rules are approved.</h2><p>Finish the service fee step, then approve the spending rules. Nothing in escrow is signed from this page until then.</p><button onClick={() => p.go(7)}>Back to service fee</button></section> : <section className="settings-section"><h2>Sign the learning escrow in your owner wallet.</h2><p>The approved deposit is <strong>{xlm(setup?.experiment?.fundingStroops || grant.totalBudgetStroops)} test XLM</strong>. Your exam reserve stays outside this escrow. Review and sign each step in order.</p><div className="owner-actions">{[['registerDevice', 'Register demo device'], ['registerAgent', 'Grant agent policy'], ['fundEscrow', 'Fund learning escrow']].map(([kind, label]) => { const op = setup?.experiment?.ownerOperations.find(item => item.kind === kind && ['pending', 'confirmed'].includes(item.state)); return <div className="owner-step" key={kind}><span className="status">{op ? readable(op.state) : 'Signature needed'}</span><h3>{label}</h3><button className="secondary" disabled={busy || Boolean(op) || !setup?.experiment} onClick={() => void p.act(() => p.signOwner(kind), `${label} submitted. This escrow step stays open.`)}>{op?.state === 'confirmed' ? 'Confirmed' : 'Review & sign'}</button>{op && <Evidence hash={op.hash} label="Setup transaction" />}</div> })}</div><details><summary>Reconcile uncertain wallet transactions</summary><p>Check known hashes before retrying an uncertain operation.</p><button className="text-button" disabled={busy} onClick={() => void p.act(() => p.api('noir/reconcile', {}), 'Known hashes checked. Unconfirmed operations remain pending.')}>Reconcile setup transactions</button></details>{Boolean(setup?.noir.blockers.length) && <details className="integration-details"><summary>Escrow setup needs attention</summary><ul>{setup?.noir.blockers.map(item => <li key={item}>{item}</li>)}</ul></details>}</section>}<div className="bottom-actions"><button className="text-button" onClick={() => p.go(7)}>← Service fee</button><button onClick={() => p.go(3)} disabled={!grant || !p.ownerReady || !p.serviceReady || !setup?.noir.ready}>Review & start Testnet agent →</button></div></PayFrame>
}
