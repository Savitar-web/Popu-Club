import test from 'node:test'
import assert from 'node:assert/strict'
import { dayKey, dayRange, moveItem } from '../src/lib/metrics.ts'

test('daily ranges include today exactly once and cross month boundaries', () => {
  const days = dayRange(7, new Date(2026, 10, 2, 23, 59))
  assert.equal(days.length, 7)
  assert.equal(days[0].day, '2026-10-27')
  assert.equal(days.at(-1).day, '2026-11-02')
  assert.equal(new Set(days.map(d => d.day)).size, 7)
  assert.ok(days.every(d => d.views === 0 && d.likes === 0 && d.comments === 0))
})

test('day keys use the local calendar rather than shifting dates through UTC', () => {
  assert.equal(dayKey(new Date(2026, 9, 27, 23, 59)), '2026-10-27')
  assert.equal(dayKey(new Date(2026, 0, 1)), '2026-01-01')
})

test('reordering moves in both directions without altering objects or losing data', () => {
  const before = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }]
  assert.deepEqual(moveItem(before, 'a', 'c').map(x => x.id), ['b', 'c', 'a'])
  assert.deepEqual(moveItem(before, 'c', 'a').map(x => x.id), ['c', 'a', 'b'])
  assert.deepEqual(before.map(x => x.id), ['a', 'b', 'c'])
  assert.equal(moveItem(before, 'a', 'c')[2], before[0])
})

test('invalid drops and boundary moves leave the order intact', () => {
  const before = [{ id: 'a' }, { id: 'b' }]
  assert.deepEqual(moveItem(before, 'missing', 'a'), before)
  assert.deepEqual(moveItem(before, 'a', 'missing'), before)
  assert.deepEqual(moveItem(before, 'a', 'a'), before)
})
