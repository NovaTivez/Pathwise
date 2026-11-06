import express from 'express'
import type { ErrorRequestHandler } from 'express'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { openDatabase } from './database.ts'
import { validatePlan } from './learner.ts'
import { paymentConfig } from './payment-config.ts'
import { walletAuth } from './wallet.ts'
import { veloService } from './velo.ts'
import { noirService } from './noir.ts'
import { agentService } from './agent.ts'
import type { VeloPort } from './velo.ts'
import type { NoirPort } from './noir.ts'
import type { VeloLedgerVerifier } from './velo-ledger.ts'
import { VeloError, VeloWebhookSignatureVerificationError } from '@carts1024/velo-sdk'
import { fileURLToPath } from 'node:url'
import { resolve, extname } from 'node:path'
import { operationalLog } from './logging.ts'
import { publicApiLimiter } from './rate-limit.ts'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
export function createApp(databasePath: string, webOrigin = 'http://localhost:5173', dependencies: { config?: ReturnType<typeof paymentConfig>; velo?: VeloPort; noir?: NoirPort; verifyVeloLedger?: VeloLedgerVerifier } = {}, hosting: { production?: boolean; frontendDir?: string; workerStatus?: () => { running: boolean; lastCompletedAt: number; inFlight: boolean } } = {}) {
  const db = openDatabase(databasePath)
  const app = express()
  const config = dependencies.config || paymentConfig()
  const wallet = walletAuth(db, webOrigin)
  const velo = veloService(db, config, webOrigin, dependencies.velo, dependencies.verifyVeloLedger)
  const noir = noirService(db, config, dependencies.noir)
  const agent = agentService(db, config, dependencies.noir)
  app.disable('x-powered-by')
  if (hosting.production) app.set('trust proxy', 1)
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID()
    res.set('X-Request-Id', res.locals.requestId)
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Referrer-Policy', 'no-referrer')
    res.set('X-Frame-Options', 'DENY')
    if (hosting.production) {
      res.set('Strict-Transport-Security', 'max-age=31536000')
      res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; form-action 'self'")
    }
    next()
  })
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  // Must precede JSON parsing, browser-origin checks, and session middleware.
  app.post('/api/webhooks/velo', express.raw({ type: 'application/json', limit: '64kb' }), async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body)) { res.status(400).json({ error: 'Raw application/json body required.' }); return }
      res.json(await velo.webhook(req.body.toString('utf8'), req.get('x-velo-signature') || null, req.get('x-velo-delivery') || null))
      operationalLog('velo_webhook_processed', { requestId: res.locals.requestId })
    } catch (error) {
      operationalLog('velo_webhook_rejected', { requestId: res.locals.requestId, status: error instanceof VeloWebhookSignatureVerificationError ? 401 : 503 })
      res.status(error instanceof VeloWebhookSignatureVerificationError ? 401 : 503).json({ error: error instanceof VeloWebhookSignatureVerificationError ? 'Invalid webhook signature or envelope.' : 'Webhook not reconciled; retry delivery after resolving checkout configuration or status.' })
    }
  })
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.get('origin') && req.get('origin') !== webOrigin) { res.status(403).json({ error: 'Origin not allowed.' }); return }
    next()
  })
  app.use(express.json({ limit: '16kb' }))
  if (hosting.production) app.use('/api', publicApiLimiter())
  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get()
    const worker = hosting.workerStatus?.()
    const ready = !worker || (worker.running && Date.now() - worker.lastCompletedAt < 120000)
    res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'degraded', storage: 'sqlite', payments: config.paymentsEnabled ? 'testnet-experiments-only' : 'paused', worker: worker ? { running: worker.running, inFlight: worker.inFlight } : undefined, noirConfigured: config.noirProblems.length === 0, veloConfigured: config.veloProblems.length === 0 })
  })
  app.post('/api/session', (req, res) => {
    const token = req.get('authorization')?.replace(/^Bearer /, '') || ''
    const current = db.prepare('SELECT token_hash FROM learner_sessions WHERE token_hash=? AND expires>?').get(hash(token), Date.now())
    if (current) { res.json({ token }); return }
    const fresh = randomBytes(32).toString('hex')
    db.prepare('INSERT INTO learner_sessions VALUES (?, ?)').run(hash(fresh), Date.now() + 86400000)
    res.status(201).json({ token: fresh })
  })
  app.use('/api', (req, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer /, '') || ''
    const sessionHash = hash(token)
    if (!db.prepare('SELECT token_hash FROM learner_sessions WHERE token_hash=? AND expires>?').get(sessionHash, Date.now())) {
      res.status(401).json({ error: 'Session expired. Reload to start a new session.' }); return
    }
    res.locals.sessionHash = sessionHash
    next()
  })
  function decode(row: Record<string, unknown>) {
    return { ...JSON.parse(row.payload as string), id: row.id, createdAt: row.created_at }
  }
  app.post('/api/plans', (req, res) => {
    let payload
    try { payload = validatePlan(req.body) }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid plan.' }); return }
    const id = randomUUID(), createdAt = new Date().toISOString()
    db.prepare('INSERT INTO learner_plans VALUES (?, ?, ?, ?)').run(id, res.locals.sessionHash, JSON.stringify(payload), createdAt)
    res.status(201).json({ ...payload, id, createdAt })
  })
  app.get('/api/plans', (_req, res) => {
    res.json(db.prepare('SELECT * FROM learner_plans WHERE session_hash=? ORDER BY created_at DESC, rowid DESC').all(res.locals.sessionHash).map(decode))
  })
  app.get('/api/plans/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM learner_plans WHERE id=? AND session_hash=?').get(req.params.id as string, res.locals.sessionHash)
    if (!row) { res.status(404).json({ error: 'Plan not found.' }); return }
    res.json(decode(row))
  })
  app.get('/api/setup', (_req, res) => res.json({
    mode: 'stellar-testnet-experiment', node: process.versions.node,
    noir: { version: '0.3.0', contracts: config.network.contracts, approvalReference: config.approvalReference, ready: config.paymentsEnabled && config.noirProblems.length === 0, blockers: [...config.noirProblems, ...(!config.paymentsEnabled ? ['Live Testnet writes are paused by the operator.'] : [])], agent: config.agent?.publicKey || null, merchant: config.merchant?.publicKey || null, asset: config.asset },
    velo: { version: '0.1.0-alpha.4', ready: config.paymentsEnabled && config.veloProblems.length === 0, blockers: [...config.veloProblems, ...(!config.paymentsEnabled ? ['New checkouts are paused by the operator.'] : [])], amount: config.velo.amount, asset: config.velo.asset },
    wallet: db.prepare('SELECT owner FROM wallet_bindings WHERE session_hash=?').get(res.locals.sessionHash) || null,
    checkout: velo.status(res.locals.sessionHash), experiment: noir.status(res.locals.sessionHash), agentManaged: Boolean(db.prepare('SELECT id FROM agent_grants WHERE session_hash=? AND mode=\'testnet\'').get(res.locals.sessionHash)),
  }))
  app.get('/api/agent/catalog', (_req, res) => res.json(agent.catalog()))
  app.get('/api/agent/status', (_req, res) => res.json(agent.status(res.locals.sessionHash)))
  const actions: Record<string, (session: string, body: Record<string, unknown>) => unknown> = {
    'wallet/challenge': (s, b) => wallet.challenge(s, b.owner),
    'wallet/verify': (s, b) => wallet.verify(s, b.id, b.signedXdr),
    'service/checkout': (s, b) => velo.create(s, b.planId),
    'service/refresh': s => velo.refresh(s),
    'noir/approve': (s, b) => noir.approve(s, b.planId),
    'noir/owner/prepare': (s, b) => noir.prepareOwner(s, b.kind),
    'noir/owner/submit': (s, b) => noir.submitOwner(s, b.id, b.signedXdr),
    'noir/run': s => noir.run(s),
    'noir/claim': s => noir.claim(s),
    'noir/reconcile': s => noir.reconcile(s),
    'agent/preview': (s, b) => agent.preview(s, b),
    'agent/approve': (s, b) => agent.approve(s, b),
    'agent/start': (s, b) => agent.start(s, b.grantId),
  }
  for (const [path, action] of Object.entries(actions)) app.post(`/api/${path}`, async (req, res) => {
    try { res.json(await action(res.locals.sessionHash, req.body && typeof req.body === 'object' ? req.body : {})) }
    catch (error) {
      operationalLog('action_rejected', { requestId: res.locals.requestId, operation: path, status: error instanceof VeloError ? 502 : 400 })
      res.status(error instanceof VeloError ? 502 : 400).json({ error: error instanceof VeloError ? 'Velo API request failed. Check Testnet credentials, project activation, and API availability; retry the same stored checkout.' : error instanceof Error ? error.message.slice(0, 400) : 'Integration request failed.' })
    }
  })
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }))
  if (hosting.production) {
    const frontend = hosting.frontendDir || fileURLToPath(new URL('../../web/dist/', import.meta.url))
    app.use((req, res, next) => { if (/\/\./.test(req.path)) { res.status(404).end(); return } next() })
    app.use(express.static(frontend, { index: false, dotfiles: 'deny' }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || extname(req.path) || !req.accepts('html')) { next(); return }
      res.sendFile(resolve(frontend, 'index.html'))
    })
  }
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500
    operationalLog('http_error', { requestId: res.locals.requestId, status })
    res.status(status).json({ error: status === 500 ? 'Could not complete the request. Try again.' : 'Invalid JSON or request too large.' })
  }
  app.use(errors)
  return { app, db, agent }
}
