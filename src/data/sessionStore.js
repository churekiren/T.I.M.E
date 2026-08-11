import { campConfig } from '../config/campConfig'
import { read, STORAGE_KEYS, write } from './storageCore'

const defaults = [
  { id: '2026-SUMMER-01', name: '2026 夏季第一梯', startDate: '2026-07-01', endDate: '2026-07-05', status: 'ACTIVE' },
  { id: '2026-SUMMER-02', name: '2026 夏季第二梯', startDate: '2026-07-08', endDate: '2026-07-12', status: 'PLANNED' },
  { id: '2027-SUMMER-01', name: '2027 夏季第一梯', startDate: '2027-07-01', endDate: '2027-07-05', status: 'PLANNED' },
]

function ensure() {
  const sessions = read(STORAGE_KEYS.sessions)
  if (!sessions.length) { write(STORAGE_KEYS.sessions, defaults, { type: 'sessions-seeded' }); return defaults }
  return sessions
}

export const sessionStore = {
  getAll: ensure,
  getById(id) { return ensure().find((item) => item.id === id) },
  getCurrent() { return this.getById(campConfig.currentSessionId) || ensure()[0] },
  create(input) { const next = { ...input }; write(STORAGE_KEYS.sessions, [...ensure(), next], { type: 'session-created', session: next }); return next },
}
