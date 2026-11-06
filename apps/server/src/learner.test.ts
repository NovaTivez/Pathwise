import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { validatePlan } from './learner.ts'
import { openDatabase } from './database.ts'
const valid = { goal: 'AWS Certified Cloud Practitioner', skills: ['Security'], formats: ['course'], budget: '30.0000001', limit: '10', reserve: '12.0000001' }
test('validates every learner field and stores exact monetary values', () => {
  assert.equal(validatePlan(valid).budgetStroops, '300000001')
  for (const patch of [ { goal: '' }, { goal: 'Other exam' }, { skills: ['unknown'] }, { skills: [1] }, { formats: [] }, { formats: ['course', 'course'] }, { budget: 30 }, { budget: '1e3' }, { budget: '-1' }, { budget: '0' }, { budget: '1.00000001' }, { limit: '0' }, { limit: '31' }, { reserve: '31' }, { reserve: '-1' } ]) {
    assert.throws(() => validatePlan({ ...valid, ...patch }), JSON.stringify(patch))
  }
  assert.throws(() => validatePlan(null))
})
test('HTTP session isolation, validation, repeatable migrations and real process restart persistence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pathwise-'))
  const path = join(dir, 'test.sqlite')
  let child: ReturnType<typeof spawn> | undefined
  async function start() {
    child = spawn(process.execPath, [fileURLToPath(new URL('./index.ts', import.meta.url))], { env: { ...process.env, DATABASE_PATH: path, PORT: '0', NODE_ENV: 'development', PAYMENTS_ENABLED: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const base = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Backend did not start: ' + output)), 30000)
      child!.stdout!.on('data', chunk => { output += chunk; const match = output.match(/http:\/\/localhost:(\d+)/); if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`) } })
      child!.stderr!.on('data', chunk => { output += chunk })
      child!.once('error', error => { clearTimeout(timer); reject(error) })
      child!.once('exit', code => { clearTimeout(timer); reject(new Error(`Backend exited ${code}: ${output}`)) })
    })
    return base
  }
  async function stop() { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited } }
  try {
    const first = openDatabase(path); first.close()
    const second = openDatabase(path); assert.equal(second.prepare('SELECT count(*) AS count FROM schema_migrations').get()!.count, 5); second.close()
    let base = await start()
    async function request(route: string, token = '', body?: unknown) {
      const response = await fetch(base + '/api/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) })
      return { status: response.status, data: await response.json() }
    }
    assert.equal((await request('health')).data.status, 'ok')
    assert.equal((await request('plans')).status, 401)
    const owner = (await request('session', '', {})).data.token
    const other = (await request('session', '', {})).data.token
    const saved = await request('plans', owner, valid)
    assert.equal(saved.status, 201)
    assert.equal((await request('plans/' + saved.data.id, other)).status, 404)
    assert.deepEqual((await request('plans', other)).data, [])
    assert.equal((await request('plans', owner, { ...valid, reserve: '100' })).status, 400)
    assert.equal((await request('plans', owner)).data.length, 1)
    const malformed = await fetch(base + '/api/plans', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner}` }, body: '{' })
    assert.equal(malformed.status, 400)
    assert.equal((await request('agent/start', '', {})).status, 401)
    const approved = await request('agent/approve', owner, { planId: saved.data.id, mode: 'simulation', providers: ['cloudtrail', 'sandbox', 'lantern'] })
    assert.equal(approved.status, 200)
    const grantId = approved.data[0].id
    assert.equal((await request('agent/start', other, { grantId })).status, 400)
    await request('agent/start', owner, { grantId })
    await stop()
    base = await start()
    assert.deepEqual((await request('plans/' + saved.data.id, owner)).data, saved.data)
    assert.equal((await request('plans', owner)).data[0].budgetStroops, '300000001')
    assert.equal((await request('plans/' + saved.data.id, other)).status, 404)
    let agentStatus = (await request('agent/status', owner)).data[0]
    const deadline = Date.now() + 8000
    while (agentStatus.orders.some((o: { status: string }) => o.status === 'reserved') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100))
      agentStatus = (await request('agent/status', owner)).data[0]
    }
    assert.equal(agentStatus.orders.length, 2)
    assert.ok(agentStatus.orders.every((o: { status: string }) => o.status === 'simulated'), 'worker resumes queued purchases after a real process restart, without a browser tick')
    await request('agent/start', owner, { grantId })
    assert.equal((await request('agent/status', owner)).data[0].orders.length, 2)
    assert.deepEqual((await request('agent/status', other)).data, [])
  } finally { await stop(); rmSync(dir, { recursive: true, force: true }) }
})
