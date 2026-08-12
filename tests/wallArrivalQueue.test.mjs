import assert from 'node:assert/strict'
import test from 'node:test'
import { createWallArrivalQueue } from '../src/services/wallArrivalQueue.js'

const agent = (id) => ({ enrollmentId: id, codename: id })

function harness() {
  const shown = []
  const activeChanges = []
  const queue = createWallArrivalQueue({
    onActiveChange: (entry) => activeChanges.push(entry?.enrollmentId || null),
    onPresentationStart: (entry) => shown.push(entry.enrollmentId),
  })
  return { queue, shown, activeChanges }
}

test('single arrival is presented once', () => {
  const { queue, shown } = harness()
  queue.initialize([])
  queue.reconcile([agent('A')])
  assert.deepEqual(shown, ['A'])
  queue.complete('A')
  assert.equal(queue.snapshot().active, null)
})

test('five simultaneous arrivals play in FIFO order without omission', () => {
  const { queue, shown } = harness()
  queue.initialize([])
  queue.reconcile(['A', 'B', 'C', 'D', 'E'].map(agent))
  for (const id of ['A', 'B', 'C', 'D', 'E']) queue.complete(id)
  assert.deepEqual(shown, ['A', 'B', 'C', 'D', 'E'])
})

test('duplicate snapshots and update-like reconciliations do not replay an enrollment', () => {
  const { queue, shown } = harness()
  queue.initialize([])
  queue.reconcile([agent('A')])
  queue.reconcile([agent('A')])
  queue.complete('A')
  queue.reconcile([agent('A')])
  assert.deepEqual(shown, ['A'])
})

test('new arrivals never replace the active presentation', () => {
  const { queue, shown } = harness()
  queue.initialize([])
  queue.reconcile([agent('A')])
  queue.reconcile([agent('A'), agent('B'), agent('C')])
  assert.equal(queue.snapshot().active.enrollmentId, 'A')
  assert.deepEqual(queue.snapshot().queued.map((entry) => entry.enrollmentId), ['B', 'C'])
  queue.complete('A')
  assert.equal(queue.snapshot().active.enrollmentId, 'B')
  assert.deepEqual(shown, ['A', 'B'])
})

test('a snapshot containing several unknown enrollments enqueues the full difference', () => {
  const { queue } = harness()
  queue.initialize([agent('A')])
  const added = queue.reconcile(['A', 'B', 'C', 'D'].map(agent))
  assert.deepEqual(added.map((entry) => entry.enrollmentId), ['B', 'C', 'D'])
})

test('initial snapshot never creates arrival presentations', () => {
  const { queue, shown } = harness()
  queue.reconcile(['A', 'B', 'C'].map(agent))
  assert.deepEqual(shown, [])
  assert.equal(queue.snapshot().knownIds.size, 3)
})

test('non-announcing reconnect reconciliation updates known IDs without replay', () => {
  const { queue, shown } = harness()
  queue.initialize([agent('A')])
  queue.reconcile([agent('A'), agent('B')], { announce: false })
  queue.reconcile([agent('A'), agent('B')])
  assert.deepEqual(shown, [])
})

test('reset isolates sessions and clears active and queued arrivals', () => {
  const { queue, shown } = harness()
  queue.initialize([])
  queue.reconcile([agent('SESSION-A-1'), agent('SESSION-A-2')])
  queue.reset()
  queue.initialize([agent('SESSION-B-EXISTING')])
  queue.reconcile([agent('SESSION-B-EXISTING'), agent('SESSION-B-NEW')])
  assert.equal(queue.snapshot().active.enrollmentId, 'SESSION-B-NEW')
  assert.deepEqual(shown, ['SESSION-A-1', 'SESSION-B-NEW'])
})

test('one hundred arrivals remain ordered and are not dropped', () => {
  const { queue, shown } = harness()
  const ids = Array.from({ length: 100 }, (_, index) => `E-${String(index + 1).padStart(3, '0')}`)
  queue.initialize([])
  queue.reconcile(ids.map(agent))
  ids.forEach((id) => queue.complete(id))
  assert.deepEqual(shown, ids)
  assert.equal(queue.snapshot().queued.length, 0)
})
