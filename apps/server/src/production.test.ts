import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createHmac } from 'node:crypto'
import { runtimeConfig, assertDurableMount } from './runtime-config.ts'
import { createApp } from './app.ts'
import { paymentConfig } from './payment-config.ts'
import { startWorker } from './worker.ts'
import { operationalLog } from './logging.ts'

test('production refuses missing HTTPS origin, ephemeral database config, multiple instances, bad credentials and unsupported runtime', () => {
  const dir = join(tmpdir(), 'pathwise-volume-config')
  const valid = { NODE_ENV: 'production', PUBLIC_URL: 'https://pathwise.example.org', PERSISTENT_DATA_DIR: dir, DATABASE_PATH: join(dir, 'app.sqlite'), STORAGE_KIND: 'docker-volume', AGENT_INSTANCES: '1', PAYMENTS_ENABLED: 'false' }
  assert.equal(runtimeConfig(valid, '24.22.2').host, '0.0.0.0')
  assert.equal(runtimeConfig(valid, '24.22.2').paymentsEnabled, false)
  for (const patch of [{ PUBLIC_URL: '' }, { PUBLIC_URL: 'http://pathwise.example.org' }, { PUBLIC_URL: 'https://x.example.org/path' }, { PUBLIC_URL: 'https://user:secret@x.example.org' }, { WEB_ORIGIN: '*' }, { DATABASE_PATH: 'data/pathwise.sqlite' }, { DATABASE_PATH: join(tmpdir(), 'outside.sqlite') }, { STORAGE_KIND: 'ephemeral' }, { AGENT_INSTANCES: '2' }, { PAYMENTS_ENABLED: 'yes' }, { PAYMENTS_ENABLED: 'true' }, { VITE_API_KEY: 'do-not-expose' }]) assert.throws(() => runtimeConfig({ ...valid, ...patch }, '24.22.2'))
  assert.throws(() => runtimeConfig(valid, '24.14.1'))
  assert.equal(runtimeConfig({ ...valid, PUBLIC_URL: '', RENDER_EXTERNAL_URL: 'https://pathwise.onrender.com' }, '24.22.2').origin, 'https://pathwise.onrender.com')
  const unmounted = mkdtempSync(join(tmpdir(), 'pathwise-unmounted-'))
  try { assert.throws(() => assertDurableMount(unmounted), 'a plain existing directory is not a persistent volume') } finally { rmSync(unmounted, { recursive: true, force: true }) }
})

test('single-origin production serves only built assets, protects APIs, limits sessions and verifies raw webhooks', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pathwise-production-')), frontend = join(dir, 'dist')
  mkdirSync(frontend); writeFileSync(join(frontend, 'index.html'), '<!doctype html><title>Pathwise production fixture</title>')
  writeFileSync(join(dir, '.env'), 'PRIVATE_VALUE=never-serve-this')
  const config = paymentConfig({ NODE_ENV: 'production', VELO_WEBHOOK_SECRET: 'test-only-webhook-secret', VELO_PROJECT_ID: 'fixture-project' })
  let running = true
  const { app, db } = createApp(join(dir, 'db.sqlite'), 'https://pathwise.example.org', { config }, { production: true, frontendDir: frontend, workerStatus: () => ({ running, lastCompletedAt: Date.now(), inFlight: false }) })
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    const html = await fetch(base + '/')
    assert.equal(html.status, 200); assert.ok((await html.text()).includes('Pathwise production fixture'))
    assert.ok(html.headers.get('content-security-policy')?.includes("script-src 'self'"))
    assert.equal(html.headers.get('x-content-type-options'), 'nosniff')
    assert.equal((await fetch(base + '/.env')).status, 404)
    assert.equal((await fetch(base + '/apps/server/data/pathwise.sqlite')).status, 404)
    assert.equal((await fetch(base + '/api/agent/status')).status, 401)
    const foreign = await fetch(base + '/api/session', { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(foreign.status, 403)
    const session = await (await fetch(base + '/api/session', { method: 'POST', headers: { Origin: 'https://pathwise.example.org', 'Content-Type': 'application/json' }, body: '{}' })).json() as { token: string }
    assert.equal((await fetch(base + '/api/nonexistent', { headers: { Authorization: `Bearer ${session.token}` } })).status, 404)
    for (let i = 0; i < 12; i++) await fetch(base + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal((await fetch(base + '/api/session', { method: 'POST', body: '{}' })).status, 429)
    const payload = JSON.stringify({ id: 'synthetic-transport-check', version: '1', type: 'project.updated', test: true, sentAt: new Date().toISOString(), project: { id: 'fixture-project', registryProjectId: 'fixture', name: 'fixture', slug: 'fixture' }, ledger: 1, metadataHash: 'fixture', status: 'active' }, null, 2)
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHmac('sha256', 'test-only-webhook-secret').update(`${timestamp}.${payload}`).digest('hex')
    const webhook = await fetch(base + '/api/webhooks/velo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-velo-signature': `t=${timestamp},v1=${signature}` }, body: payload })
    assert.equal(webhook.status, 200, 'webhook bypasses browser session/origin/rate middleware but must verify its raw HMAC')
    assert.equal((await webhook.json() as { ignored: boolean }).ignored, true)
    assert.equal((await fetch(base + '/api/webhooks/velo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })).status, 401)
    assert.equal((await fetch(base + '/api/health')).status, 200)
    running = false
    assert.equal((await fetch(base + '/api/health')).status, 503)
    assert.equal(db.prepare('SELECT count(*) AS n FROM service_checkouts WHERE active=1').get()!.n, 0)
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('worker drains in-flight work without overlapping ticks and logger never emits caller secrets', async () => {
  let release!: () => void, calls = 0
  const pending = new Promise<void>(resolve => { release = resolve })
  const worker = startWorker(async () => { calls++; await pending }, 5)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(calls, 1)
  const stopping = worker.stop(1000)
  release(); assert.equal(await stopping, true); assert.equal(worker.status().running, false)
  const original = console.error, lines: string[] = []
  try {
    console.error = line => { lines.push(String(line)) }
    operationalLog('http_error', { requestId: 'secret-token-do-not-log', operation: 'secret_API_KEY_value', status: 500 })
    assert.ok(!lines.join('').includes('secret')); assert.ok(lines.join('').includes('http_error'))
  } finally { console.error = original }
})
