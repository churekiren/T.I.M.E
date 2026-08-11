import { makeId, read, STORAGE_KEYS, subscribe, write } from './storageCore'

function nextDisplayNumber(enrollments, sessionId) {
  const max = enrollments.filter((e) => e.sessionId === sessionId).reduce((n, e) => Math.max(n, Number(e.displayAgentNumber?.replace(/\D/g, '')) || 0), 0)
  return `T-${String(max + 1).padStart(3, '0')}`
}

export const enrollmentStore = {
  getAll() { return read(STORAGE_KEYS.enrollments) },
  getBySession(sessionId) { return this.getAll().filter((item) => item.sessionId === sessionId) },
  getByAgent(agentId) { return this.getAll().filter((item) => item.agentId === agentId) },
  exists(agentId, sessionId) { return this.getAll().some((item) => item.agentId === agentId && item.sessionId === sessionId) },
  create({ agentId, sessionId, returningAgent = false, joinedAt = new Date().toISOString(), displayAgentNumber }) {
    const enrollments = this.getAll()
    if (this.exists(agentId, sessionId)) throw new Error('此探員已加入目前梯次，不能重複登錄。')
    const enrollment = { id: makeId('ENROLLMENT'), agentId, sessionId, displayAgentNumber: displayAgentNumber || nextDisplayNumber(enrollments, sessionId), joinedAt, completionStatus: 'ACTIVE', returningAgent }
    write(STORAGE_KEYS.enrollments, [...enrollments, enrollment], { type: 'enrollment-created', enrollment })
    return enrollment
  },
  remove(id) { const next = this.getAll().filter((item) => item.id !== id); write(STORAGE_KEYS.enrollments, next, { type: 'enrollment-removed', enrollmentId: id }) },
  subscribe,
}
