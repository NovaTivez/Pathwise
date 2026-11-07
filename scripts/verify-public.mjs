import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
const raw = process.argv.slice(2).find(a => a.startsWith('https://') || a.startsWith('http://')) || process.env.PUBLIC_URL
if (!raw) throw new Error('Pass the actual public origin: npm run verify:public -- https://YOUR-HOST --exercise-simulation')
const url = new URL(raw)
if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(process.argv.includes('--allow-http-local') && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Use an HTTPS origin without credentials, query, or path. Local HTTP needs --allow-http-local.')
const checks = []
function check(ok, label) { checks.push({ check: label, passed: Boolean(ok) }); if (!ok) throw new Error(label + ' failed') }
async function request(path, token = '', body) {
  const response = await fetch(url.origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Origin: url.origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) })
  return { response, data: await response.json() }
}
let failure
try {
  const page = await fetch(url.origin, { signal: AbortSignal.timeout(15000) })
  check(page.ok && (await page.text()).includes('Pathwise'), 'Public website returns Pathwise HTML')
  const health = await request('/api/health'); check(health.response.ok && health.data.status === 'ok' && health.data.storage === 'sqlite', 'Backend and durable-storage health')
  check((await request('/api/agent/status')).response.status === 401, 'Unauthenticated purchase records are protected')
  const dotfile = await fetch(url.origin + '/.env', { signal: AbortSignal.timeout(10000) }); check(dotfile.status === 404, 'Local environment file is not public')
  if (process.argv.includes('--exercise-simulation')) {
    const session = (await request('/api/session', '', {})).data.token
    const other = (await request('/api/session', '', {})).data.token
    const plan = await request('/api/plans', session, { goal: 'AWS Certified Cloud Practitioner', skills: [], formats: ['course', 'lab', 'practice'], budget: '30', limit: '10', reserve: '10' })
    check(plan.response.status === 201, 'Learner goal saved')
    check((await request('/api/plans/' + plan.data.id, other)).response.status === 404, 'Cross-session plan retrieval denied')
    const args = { planId: plan.data.id, providers: ['cloudtrail', 'sandbox', 'lantern'], mode: 'simulation' }
    const preview = await request('/api/agent/preview', session, args)
    check(preview.data.decisions.filter(d => d.state === 'selected').length === 2, 'Default roadmap selects two resources')
    check(preview.data.decisions.some(d => d.state === 'skipped' && d.reason.includes('per-purchase')), 'Over-limit demo alternative safely skipped')
    const approved = await request('/api/agent/approve', session, args)
    check(approved.response.ok, 'Explicit simulation rules approved')
    const id = approved.data[0].id
    check((await request('/api/agent/start', session, { grantId: id })).response.ok, 'Simulation started on backend')
    let grant
    for (let i = 0; i < 12; i++) {
      grant = (await request('/api/agent/status', session)).data[0]
      if (grant.orders.length === 2 && grant.orders.every(o => o.status === 'simulated')) break
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    check(grant.orders.length === 2 && grant.orders.every(o => o.status === 'simulated' && !o.authorizeHash && !o.claimHash && !o.sampleAccessCode), 'Worker finished simulation without fabricated payments/access codes')
    check(grant.remainingStroops === '60000000' && grant.reserveStroops === '100000000' && grant.spentStroops === '0', 'Exact budget and exam reserve preserved')
    await request('/api/agent/start', session, { grantId: id })
    check((await request('/api/agent/status', session)).data[0].orders.length === 2, 'Repeated start did not duplicate orders')
  }
} catch (error) { failure = error instanceof Error ? error.message : 'Public check failed' }
const report = { checkedAt: new Date().toISOString(), origin: url.origin, scope: 'HTTP checks and optional simulation only; not live payment proof', checks, passed: !failure, failure }
const output = process.env.PUBLIC_CHECK_OUTPUT || 'artifacts/public-check.json'
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
if (failure) process.exitCode = 1
