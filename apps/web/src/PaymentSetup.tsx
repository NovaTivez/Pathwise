import { useEffect, useState } from 'react'
import { noirExtensionSigner } from '@noirx402/agent-sdk'
import { Networks } from '@stellar/stellar-sdk'

type Checkout = { id: string; planId: string; intentId: string | null; checkoutUrl: string | null; status: string; active: boolean; amount: string; asset: string; transactionHash: string | null; verifiedWebhook: boolean }
type Experiment = { id: string; planId: string; owner: string; deviceHash: string; merchant: string; agent: string; asset: string; amountStroops: string; fundingStroops: string; limitStroops: string; expiresAt: string; state: string; authorizeHash: string | null; claimHash: string | null; ownerOperations: { id: string; kind: string; hash: string; state: string }[] }
type Setup = { agentManaged: boolean; mode: string; node: string; noir: { version: string; contracts: Record<string, string>; approvalReference: string; ready: boolean; blockers: string[]; agent: string | null; merchant: string | null; asset: string }; velo: { version: string; ready: boolean; blockers: string[]; amount: string; asset: string }; wallet: { owner: string } | null; checkout: Checkout | null; experiment: Experiment | null }
function HashLink({ hash, label }: { hash: string | null; label: string }) {
  if (!hash) return null
  return <p><a href={`https://stellar.expert/explorer/testnet/tx/${hash}`} target="_blank" rel="noreferrer">{label}: {hash}</a></p>
}
export default function PaymentSetup({ token, planId }: { token: string; planId?: string }) {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  async function api(path: string, body?: unknown) {
    const response = await fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Request failed.')
    return data
  }
  async function refresh() { setSetup(await api('setup')) }
  useEffect(() => {
    if (!token) return
    let active = true
    void api('setup').then(data => { if (active) setSetup(data) }).catch(() => { if (active) { setError(true); setMessage('Setup status unavailable. Start the backend and reload.') } })
    return () => { active = false }
    // api is intentionally local to the current session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  async function act(task: () => Promise<unknown>, success: string) {
    setBusy(true); setError(false); setMessage('Working... Wallet operations can take about a minute to confirm.')
    try { await task(); setMessage(success) }
    catch (err) { setError(true); setMessage(err instanceof Error ? err.message : 'Integration request failed.') }
    finally { try { await refresh() } catch { setError(true); setMessage('Could not refresh the backend status. Do not repeat an uncertain payment; reconnect and reconcile it.') } setBusy(false) }
  }
  async function connect() {
    const signer = await noirExtensionSigner()
    const challenge = await api('wallet/challenge', { owner: signer.publicKey })
    const signed = await signer.signTransaction(challenge.xdr, { networkPassphrase: Networks.TESTNET })
    await api('wallet/verify', { id: challenge.id, signedXdr: typeof signed === 'string' ? signed : signed.signedTxXdr })
  }
  async function ownerOperation(kind: string) {
    const signer = await noirExtensionSigner()
    if (signer.publicKey !== setup?.wallet?.owner) throw new Error('Switch the extension back to this sessionâ€™s verified owner wallet.')
    const operation = await api('noir/owner/prepare', { kind })
    const signed = await signer.signTransaction(operation.xdr, { networkPassphrase: Networks.TESTNET })
    await api('noir/owner/submit', { id: operation.id, signedXdr: typeof signed === 'string' ? signed : signed.signedTxXdr })
  }
  if (!token) return null
  return <section className="payment-setup" aria-busy={busy}>
    <h2>03 / Genuine Testnet experiments</h2>
    <p>These actions use Stellar Testnet funds. There are no simulated successes. Only the wallet can sign owner operations.</p>
    {!setup ? <p>Loading setup status...</p> : <>
      <div className="layout"><article><h3>Noir {setup.noir.version}</h3><span className="state">{setup.noir.ready ? 'Server configured / live verification pending' : 'Setup required'}</span><ul>{setup.noir.blockers.map(b => <li key={b}>{b}</li>)}</ul><p>Node {setup.node}</p><p>{setup.noir.approvalReference}</p><details><summary>Selected Testnet contracts</summary>{Object.entries(setup.noir.contracts).map(([name, id]) => <p key={name}>{name}<br /><code>{id}</code></p>)}</details><p>Agent: <code>{setup.noir.agent || 'not configured'}</code><br />Demo provider: <code>{setup.noir.merchant || 'not configured'}</code></p></article>
      <article><h3>Velo {setup.velo.version}</h3><span className="state">{setup.velo.ready ? 'Server configured / live verification pending' : 'Setup required'}</span><ul>{setup.velo.blockers.map(b => <li key={b}>{b}</li>)}</ul><p>Pathwise service fee: {setup.velo.amount} test XLM ({setup.velo.asset}). This is separate from Noir escrow and your learning budget.</p></article></div>
      <h3>1. Connect and verify the owner wallet</h3><p>{setup.wallet ? `Verified wallet: ${setup.wallet.owner}` : 'Install Noir, select Stellar Testnet, then approve the connection and authentication signature. The challenge is never submitted to the network.'}</p>
      <button disabled={busy} onClick={() => void act(connect, 'Owner wallet signature verified and bound to this session.')}>{setup.wallet ? 'Verify wallet again' : 'Connect Noir & verify ownership'}</button>
      <h3>2. Pay the separate service fee</h3><p>A return redirect never activates purchasing. Activation requires a matching signed success webhook plus a paid status retrieved on the server.</p>
      <button disabled={busy || !setup.velo.ready || !setup.wallet || !planId} onClick={() => void act(() => api('service/checkout', { planId }), 'Checkout created or recovered. Open the Velo checkout to pay with Testnet funds.')}>Create / recover Velo Testnet checkout</button>
      {setup.checkout && <><p>Intent: {setup.checkout.intentId || 'creation pending'}<br />Status: {setup.checkout.status}<br />Signed success webhook: {setup.checkout.verifiedWebhook ? 'verified' : 'not yet verified'}<br />Service: {setup.checkout.active ? 'active' : 'inactive'}</p>{setup.checkout.checkoutUrl && <p><a href={setup.checkout.checkoutUrl} target="_blank" rel="noreferrer">Open Velo Testnet checkout</a></p>}<HashLink hash={setup.checkout.transactionHash} label="Service payment" /><button disabled={busy} onClick={() => void act(() => api('service/refresh', {}), 'Service status retrieved from Velo. A signed matching success webhook is also required.')}>Retrieve service payment status</button></>}
      {!setup.agentManaged && <details><summary>Legacy Phase 2 single-course experiment (separate from the purchasing agent)</summary><h3>3. Approve the controlled Noir experiment</h3><p>One fictional CloudTrail Academy cloud-foundations course, 8 test XLM, to the server-configured demo provider only. Escrow funding is exactly 8 test XLM. The saved plan must allow this course and amount; its exam reserve stays outside escrow. Authorization expires in one hour. The on-chain policy limits asset, agent, per-payment amount, and expiry; the application additionally restricts the provider, total spend, plan, and duplicates.</p>
      <button disabled={busy || !setup.noir.ready || !setup.checkout?.active || !planId || Boolean(setup.experiment)} onClick={() => void act(() => api('noir/approve', { planId }), 'Experiment rules approved. Register the device, register the policy, then fund the escrow using wallet signatures.')}>Approve these experiment rules once</button>
      {setup.experiment && <><p>Experiment: {setup.experiment.id}<br />State: <strong>{setup.experiment.state}</strong><br />Expires: {new Date(setup.experiment.expiresAt).toLocaleString()}<br />Virtual demo device hash: <code>{setup.experiment.deviceHash}</code></p><div className="setup-actions">{[['registerDevice', 'Register device'], ['registerAgent', 'Register agent policy'], ['fundEscrow', 'Fund 8 test XLM escrow']].map(([kind, label]) => <button key={kind} disabled={busy || !setup.noir.ready || setup.experiment!.ownerOperations.some(op => op.kind === kind && ['pending', 'confirmed'].includes(op.state))} onClick={() => void act(() => ownerOperation(kind), `${label} confirmed on Testnet.`)}>{label} (wallet signature)</button>)}</div>
      {setup.experiment.ownerOperations.map(op => <div key={op.id}><small>{op.kind}: {op.state}</small><HashLink hash={op.hash} label="Transaction hash (inspect status)" /></div>)}
      <button disabled={busy || !setup.noir.ready || setup.experiment.state !== 'planned'} onClick={() => void act(() => api('noir/run', {}), 'Agent authorization confirmed and matched to a Noir contract event.')}>Start agent: check & authorize the fixed purchase</button>
      <HashLink hash={setup.experiment.authorizeHash} label="Agent authorization (check state above)" />
      <button disabled={busy || !setup.noir.ready || setup.experiment.state !== 'authorized'} onClick={() => void act(() => api('noir/claim', {}), 'Aggregate provider claim confirmed and reconciled. No commercial resource was purchased.')}>Run controlled demo-provider claim</button><HashLink hash={setup.experiment.claimHash} label="Provider claim (check state above)" />
      <button disabled={busy || !setup.noir.ready} onClick={() => void act(() => api('noir/reconcile', {}), 'Known transaction hashes checked against Testnet. Unconfirmed transactions remain pending.')}>Reconcile uncertain Noir transactions</button></>}</details>}
    </>}
    <button disabled={busy} onClick={() => void act(refresh, 'Setup status refreshed.')}>Refresh setup status</button>
    <p role={error ? 'alert' : 'status'}>{message}</p><p>Setup instructions: <code>docs/phase2-setup.md</code>. No sample access code is released by this experiment.</p>
  </section>
}
