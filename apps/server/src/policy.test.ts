import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plan, stroops, catalog } from './policy.ts'
const base = { budget: '30', reserve: '10', limit: '10', skills: [], formats: ['course', 'lab', 'practice'], providers: catalog.map(r => r.provider) }
test('two providers selected and third blocked by purchase limit', () => {
  const result = plan(base)
  assert.deepEqual(result.orders.map(o => o.state), ['planned', 'planned', 'blocked'])
  assert.equal(result.remainingStroops, '60000000')
})
test('planned commitments protect reserve', () => {
  assert.equal(plan({ ...base, budget: '20' }).orders[1].state, 'blocked')
})
test('amounts are exact and reject exponent or excessive precision', () => {
  assert.equal(stroops('0.0000001'), 1n)
  assert.throws(() => stroops('1e2'))
  assert.throws(() => stroops('1.00000001'))
})
test('known skills and unapproved providers are blocked', () => {
  assert.ok(plan({ ...base, skills: ['Cloud concepts'], providers: [] }).orders.every(o => o.state === 'blocked'))
})
