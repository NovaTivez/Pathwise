import { useEffect, useState, type ReactNode } from 'react'
import type { Pathwise } from './usePathwise'
import { Evidence, NeedGoal, ServiceSummary } from './components'
import { BudgetSummary } from './LearningComponents'
import { checkoutReadiness } from './learning'
import { nextOwnerAction, ownerSteps, serviceAction } from './payment-journey'
import { xlm } from './ui'

function paymentReady(p: Pathwise) {
  return checkoutReadiness(p.setup, p.previewOnly, Boolean(p.connectionError)).available
    && p.approvedIds.length > 0 && p.approvedIds.every(id => Boolean(p.catalog?.providers.find(provider => provider.id === id)?.merchant))
}
function PayProgress({ p }: { p: Pathwise }) {
  return <ol className="setup-progress three" aria-label="Testnet setup steps">{[[6, 'Wallet'], [7, 'Service payment'], [8, 'Spending authorization']].map(([step, label], index) => <li key={step} className={p.step === step ? 'current' : ''} aria-current={p.step === step ? 'step' : undefined}><span>{index + 1}</span><span>{label}</span></li>)}</ol>
}
function Blockers({ p }: { p: Pathwise }) {
  const checkout = checkoutReadiness(p.setup, p.previewOnly, Boolean(p.connectionError))
  const missing = p.approvedIds.filter(id => !p.catalog?.providers.find(provider => provider.id === id)?.merchant)
  return !checkout.available || missing.length || !p.approvedIds.length ? <div className="notice" role="status"><p>{checkout.reason || 'Approved providers need configured Testnet merchant accounts before payment setup.'}</p><ul>{[...new Set([...(p.setup?.velo.blockers || []), ...(p.setup?.noir.blockers || []), ...missing.map(id => `${p.providerName(id)} needs a Testnet merchant account configured by the operator.`), ...(!p.approvedIds.length ? ['Select at least one provider and update recommendations.'] : [])])].map(item => <li key={item}>{item}</li>)}</ul><button className="text-button" onClick={() => p.go(2)}>Continue planning</button></div> : null
}
function PayFrame({ p, children }: { p: Pathwise; children: ReactNode }) {
  if (!p.activePlan) return <NeedGoal p={p} />
  if (p.previewOnly) return <section className="empty"><h2>This path is for planning.</h2><p>No checkout, wallet signature or spending authorization is supported for this career yet.</p><button onClick={() => p.go(2)}>Back to my roadmap</button></section>
  return <div className="path-layout"><section className="pay-step"><PayProgress p={p} /><Blockers p={p} />{children}</section><aside className="path-aside"><BudgetSummary p={p} /><p className="fine-print">Velo service payment is separate from Noir learning escrow. Returning from checkout does not verify a payment.</p></aside></div>
}
export function AuthorizationView({ p }: { p: Pathwise }) {
  if (!p.activePlan) return <NeedGoal p={p} />
  const ready = paymentReady(p)
  const total = p.selected.reduce((sum, d) => sum + BigInt(d.priceStroops), 0n)
  const eligible = p.compared && p.selected.length > 0 && total <= BigInt(p.metrics.remaining) && p.selected.every(d => p.approvedIds.includes(d.providerId) && BigInt(d.priceStroops) <= BigInt(p.grant?.perPurchaseLimitStroops || p.activePlan!.limitStroops))
  return <PayFrame p={p}><section className="settings-section"><h2>Review spending</h2><p>Only selected demo providers may receive Testnet learning-resource payments. Saving these choices does not authorize spending.</p>
    <fieldset disabled={p.busy || Boolean(p.grant)}><legend>Approved providers</legend>{p.catalog?.providers.map(provider => <label className="provider-choice" key={provider.id}><input type="checkbox" checked={p.approvedIds.includes(provider.id)} onChange={() => p.toggleProvider(provider.id)} /><span><strong>{provider.name}</strong><small>{provider.merchant ? 'Testnet account configured' : 'Testnet merchant account needs operator setup'}</small></span></label>)}</fieldset>
    {!p.compared && <p role="status">The provider list changed or recommendations are missing. Update recommendations before continuing.</p>}
    {p.compared && p.selected.length > 0 && <ul className="review-resources">{p.selected.map(d => <li key={d.resourceId}><strong>{p.resource(d.resourceId)?.title || d.resourceId}</strong><p>{p.providerName(d.providerId)} · {xlm(d.priceStroops)} test XLM</p><p>{d.reason}</p></li>)}</ul>}
    <dl className="rule-list"><div><dt>Selected resource total</dt><dd>{p.compared ? `${xlm(total.toString())} test XLM` : 'Update required'}</dd></div><div><dt>Available prep allowance</dt><dd>{xlm(p.metrics.remaining)} test XLM</dd></div><div><dt>Per-resource cap</dt><dd>{xlm(p.grant?.perPurchaseLimitStroops || p.activePlan.limitStroops)} test XLM</dd></div><div><dt>Protected exam reserve</dt><dd>{xlm(p.metrics.reserve)} test XLM</dd></div></dl>
    <p>{p.grant ? `Authorization expires ${new Date(p.grant.expiresAt).toLocaleString()}. Approved rules cannot be edited.` : 'Authorization lasts one hour from approval after the service payment. The timer includes wallet setup transactions.'}</p><p>Velo service fee: {p.setup?.velo.amount || 'Unavailable'} test XLM, additional to the learning allowance. Your reserve stays outside Noir escrow.</p>
    {p.compared && !eligible && !p.grant && <p>No eligible purchase remains. Return to your roadmap for free resources or adjust your budget.</p>}
  </section><div className="bottom-actions"><button className="text-button" onClick={() => p.go(2)}>Back to roadmap</button>{!p.compared && !p.grant ? <button disabled={p.busy || !p.approvedIds.length || !p.catalog} onClick={() => void p.act(() => p.buildRoadmap(true), 'Recommendations updated. Review the new purchase plan.')}>Update recommendations</button> : ready && (eligible || p.grant) ? <button disabled={p.busy} onClick={() => p.go(p.grant ? p.resumeSetup() : 6)}>{p.grant ? 'Continue setup' : 'Continue to wallet'}</button> : null}</div></PayFrame>
}
export function WalletPage({ p }: { p: Pathwise }) {
  const verified = Boolean(p.setup?.wallet), ready = paymentReady(p)
  return <PayFrame p={p}><section className="settings-section"><h2>{verified ? 'Wallet ownership verified' : 'Connect Noir wallet'}</h2><p>Connecting signs a one-use ownership challenge on Stellar Testnet. It proves this wallet belongs to you; it does not pay the service fee or authorize resource spending. Owner keys stay in Noir.</p>
    {!verified && <div className="wallet-help"><h3>First time using Noir?</h3><ol><li><a href="https://chromewebstore.google.com/detail/noir/gikfhchijjljpbhokmdmaadgmpbchmjl" target="_blank" rel="noreferrer">Install the official Noir extension</a>, then return here.</li><li>Create or open your wallet in the extension and select Stellar Testnet.</li><li>Use Testnet Friendbot funding in your wallet, or visit <a href="https://laboratory.stellar.org/#account-creator?network=test" target="_blank" rel="noreferrer">Stellar Laboratory</a> with only your public address. Never enter wallet secrets in Pathwise.</li></ol></div>}
    {verified && <details><summary>Connected public account</summary><code className="address">{p.setup!.wallet!.owner}</code></details>}
    {ready && <button disabled={p.busy} onClick={() => verified ? p.go(7) : void p.act(p.connect, 'Wallet ownership verified. Continue to service payment.')}>{verified ? 'Continue to service payment' : 'Connect Noir wallet'}</button>}
  </section><button className="text-button" onClick={() => p.go(1)}>Back to spending review</button></PayFrame>
}
export function FeePage({ p }: { p: Pathwise }) {
  const action = serviceAction(p.setup, p.activePlan?.id || '', p.serviceReady)
  const amount = p.setup?.checkout?.planId === p.activePlan?.id ? p.setup?.checkout?.amount : p.setup?.velo.amount
  const ready = paymentReady(p)
  async function payInVelo() {
    if (!p.activePlan) throw new Error('Save a goal before paying the service fee.')
    const popup = window.open('about:blank', 'pathwise-velo')
    if (!popup) throw new Error('Allow pop-ups for Pathwise, then try again.')
    try {
      const created = await p.api('service/checkout', { planId: p.activePlan.id }) as { checkoutUrl?: string | null }
      if (!created.checkoutUrl) throw new Error('No checkout link was returned. Check payment status before retrying.')
      popup.location.replace(created.checkoutUrl)
    } catch (error) { popup.close(); throw error }
  }
  return <PayFrame p={p}><section className="settings-section"><h2>{amount ? `${amount} test XLM service payment` : 'Service payment unavailable'}</h2><ServiceSummary p={p} /><p>Velo pays for the Pathwise service. It does not fund Noir learning escrow or purchase any course. Testnet only; no real funds.</p>
    {action === 'wallet' && <><p>Verify wallet ownership before opening checkout.</p>{ready && <button onClick={() => p.go(6)}>Connect Noir wallet</button>}</>}
    {action === 'mismatch' && <p role="alert">The stored checkout belongs to another goal. Resume that original plan; do not pay again for this plan.</p>}
    {action === 'pay' && ready && <button disabled={p.busy} onClick={() => void p.act(payInVelo, 'Checkout opened in another tab. Return here to check payment status.')}>Pay {amount} test XLM service fee</button>}
    {action === 'check' && <><p>Awaiting backend verification. A successful browser redirect is not proof of payment. Checking status reuses the saved checkout.</p><button disabled={p.busy} onClick={() => void p.act(() => p.setup?.checkout?.intentId ? p.api('service/refresh', {}) : p.api('service/checkout', { planId: p.activePlan?.id }), 'Status checked. Continue only when the backend confirms the payment.')}>Check payment status</button>{p.setup?.checkout?.checkoutUrl && !['paid', 'paid_awaiting_verified_webhook', 'failed', 'expired'].includes(p.setup.checkout.status) && ready && <button className="text-button" disabled={p.busy} onClick={() => void p.act(payInVelo)}>Reopen saved checkout</button>}{p.setup?.checkout && ['failed', 'expired', 'cancelled'].includes(p.setup.checkout.status) && <p>Checkout {p.setup.checkout.status}. Check its saved status, then ask the operator to reconcile this checkout. Do not create a replacement payment.</p>}</>}
    {action === 'continue' && ready && <button disabled={p.busy || !p.approvedIds.length || !p.selected.length} onClick={() => p.grant ? p.go(8) : void p.act(p.approve, 'Spending rules approved. Complete the Noir signatures in order.')}>Continue to spending authorization</button>}
  </section><button className="text-button" onClick={() => p.go(6)}>Back to wallet</button></PayFrame>
}
export function EscrowPage({ p }: { p: Pathwise }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer) }, [])
  const operations = p.setup?.experiment?.ownerOperations || [], next = nextOwnerAction(operations)
  const ready = paymentReady(p)
  const expired = Boolean(p.grant && Date.parse(p.grant.expiresAt) <= now)
  const step = ownerSteps.find(s => s.kind === next.kind)
  return <PayFrame p={p}>{!p.grant || !p.serviceReady ? <section><h2>Verify service payment first</h2><p>Spending authorization needs the verified service payment and an approved plan.</p><button onClick={() => p.go(7)}>Back to service payment</button></section> : <section className="settings-section"><h2>Authorize spending with Noir</h2><p>Sign three steps in order. The learning deposit is <strong>{xlm(p.setup?.experiment?.fundingStroops || (BigInt(p.grant.totalBudgetStroops) - BigInt(p.grant.reserveStroops)).toString())} test XLM</strong>. The protected reserve and Velo fee are separate.</p>
    {expired && <p role="alert">Authorization expired. New signatures and purchases are blocked. Check existing transactions; operator assistance is needed to resume this immutable authorization safely.</p>}
    <ol className="completed-signatures">{ownerSteps.filter(s => operations.some(op => op.kind === s.kind && op.state === 'confirmed')).map(s => <li key={s.kind}>{s.label}: Confirmed</li>)}</ol>
    {next.state === 'check' ? <div className="notice"><h3>Check transaction status</h3><p>{step?.label || 'Wallet transaction'} is prepared or has an uncertain outcome. Do not sign another transaction. An unsigned preparation expires after five minutes; a submitted transaction must be reconciled.</p><button disabled={p.busy} onClick={() => void p.act(() => p.api('noir/reconcile', {}), 'Known transactions checked. Pending outcomes remain blocked.')}>Check transaction status</button></div> : next.state === 'sign' && step ? <div className="owner-step"><h3>{step.label}</h3><p>{step.explanation}</p>{operations.some(op => op.kind === step.kind && op.state === 'failed') && <p>The previous transaction failed on chain. You may review a new signature.</p>}<button disabled={p.busy || expired || !ready || !p.setup?.experiment || !p.setup?.wallet} onClick={() => void p.act(() => p.signOwner(step.kind), 'Signature submitted. Checking the confirmed state before the next step.')}>{step.label}</button></div> : <><p>All three wallet transactions are confirmed. Review the resources before starting the agent.</p><button disabled={p.busy || !ready || !p.ownerReady || expired} onClick={() => p.go(3)}>Review purchase</button></>}
    <details><summary>Setup transaction evidence</summary>{operations.map(op => <div key={op.id}><p>{op.kind}: {op.state}</p><Evidence hash={op.hash} label="Setup transaction" /></div>)}</details>
  </section>}<button className="text-button" onClick={() => p.go(7)}>Back to service payment</button></PayFrame>
}
