import { makeId, read, STORAGE_KEYS, subscribe, write } from './storageCore'

function secureToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export const accessTokenStore = {
  getAll() { return read(STORAGE_KEYS.tokens) },
  getByToken(token = '') { return this.getAll().find((item) => item.token === token) },
  getById(id) { return this.getAll().find((item) => item.id === id) },
  getByAgent(agentId) { return this.getAll().filter((item) => item.agentId === agentId) },
  createBatch(count, sessionId, purpose = 'FIRST_REGISTRATION') {
    const safeCount = Math.min(100, Math.max(1, Number(count) || 1)); const now = new Date().toISOString(); const existing = this.getAll()
    const created = Array.from({ length: safeCount }, (_, index) => ({ id: makeId('ACCESS'), shortCode: `REG-${(existing.length + index + 1).toString().padStart(4, '0')}`, token: secureToken(), sessionId, agentId: null, enrollmentId: null, status: 'UNUSED', purpose, createdAt: now, usedAt: null }))
    write(STORAGE_KEYS.tokens, [...existing, ...created], { type: 'tokens-created', tokens: created })
    return created
  },
  markUsed(token, { agentId, enrollmentId, usedAt = new Date().toISOString() }) {
    const current = this.getByToken(token)
    if (!current || current.status !== 'UNUSED') throw new Error('此登錄憑證已失效或已經使用。')
    let updated
    const next = this.getAll().map((item) => item.token === token ? (updated = { ...item, agentId, enrollmentId, status: 'USED', usedAt }) : item)
    write(STORAGE_KEYS.tokens, next, { type: 'token-used', accessToken: updated })
    return updated
  },
  subscribe,
}
