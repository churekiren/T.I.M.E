import { read, STORAGE_KEYS, subscribe, write } from './storageCore'

function nextId(agents) {
  const max = agents.reduce((value, agent) => Math.max(value, Number(agent.id?.replace(/\D/g, '')) || 0), 0)
  return `AGENT-${String(max + 1).padStart(6, '0')}`
}

export const agentStore = {
  getAll() { return read(STORAGE_KEYS.agents) },
  getById(id = '') { return this.getAll().find((agent) => agent.id.toUpperCase() === id.toUpperCase()) },
  getByAccessToken(token = '') { return this.getAll().find((agent) => agent.accessToken?.toUpperCase() === token.toUpperCase()) },
  search(query = '') { const q = query.trim().toUpperCase(); return q ? this.getAll().filter((a) => a.id.includes(q) || a.codename.includes(q) || a.accessToken?.includes(q)) : this.getAll() },
  create({ codename, emblem = '', createdAt = new Date().toISOString() }) {
    const agents = this.getAll()
    const agent = { id: nextId(agents), codename: codename.trim().toUpperCase(), emblem, firstRegisteredAt: createdAt, status: 'ACTIVE', accessToken: `TIME-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, tokenStatus: 'USED', createdAt }
    write(STORAGE_KEYS.agents, [...agents, agent], { type: 'agent-created', agent })
    return agent
  },
  update(id, changes) {
    let updated
    const next = this.getAll().map((agent) => agent.id === id ? (updated = { ...agent, ...changes, id: agent.id }) : agent)
    write(STORAGE_KEYS.agents, next, { type: 'agent-updated', agent: updated })
    return updated
  },
  setEmblem(id, emblem) { return this.update(id, { emblem }) },
  remove(id) { const next = this.getAll().filter((agent) => agent.id !== id); write(STORAGE_KEYS.agents, next, { type: 'agent-removed', agentId: id }) },
  subscribe,
  storageKey: STORAGE_KEYS.agents,
}
