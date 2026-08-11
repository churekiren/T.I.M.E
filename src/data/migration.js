import { agentStore } from './agentStore'
import { enrollmentStore } from './enrollmentStore'
import { sessionStore } from './sessionStore'
import { read, STORAGE_KEYS, write } from './storageCore'

export function migrateLegacyData() {
  const meta = read(STORAGE_KEYS.meta, {})
  if (meta.legacyV1Migrated) return
  const legacy = read(STORAGE_KEYS.legacyAgents)
  legacy.forEach((old) => {
    let session = sessionStore.getAll().find((item) => item.name === old.session)
    if (!session) session = sessionStore.create({ id: `MIGRATED-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: old.session || '舊梯次（已遷移）', startDate: '', endDate: '', status: 'ARCHIVED' })
    const agent = agentStore.create({ codename: old.codename, emblem: old.emblem, createdAt: old.createdAt })
    enrollmentStore.create({ agentId: agent.id, sessionId: session.id, joinedAt: old.createdAt, displayAgentNumber: old.id, returningAgent: false })
  })
  write(STORAGE_KEYS.meta, { ...meta, legacyV1Migrated: true, migratedAt: new Date().toISOString(), legacyCount: legacy.length }, { type: 'migration-complete' })
}
