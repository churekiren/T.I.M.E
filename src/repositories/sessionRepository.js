import { campConfig } from '../config/campConfig'
import { mapSession, runQuery } from './repositoryCore'

export const sessionRepository = {
  async getAll() {
    const rows = await runQuery((client) => client.from('sessions').select('*').order('created_at'))
    return (rows || []).map(mapSession)
  },
  async getById(id) {
    const row = await runQuery((client) => client.from('sessions').select('*').eq('id', id).maybeSingle())
    return mapSession(row)
  },
  async getCurrent() { return this.getById(campConfig.currentSessionId) },
  async getOperational() {
    const rows = await runQuery((client) => client.rpc('list_operational_sessions'))
    return (rows || []).map(mapSession)
  },
  async create(session) {
    const row = await runQuery((client) => client.from('sessions').insert({ id: session.id, name: session.name, start_date: session.startDate || null, end_date: session.endDate || null, status: session.status }).select().single())
    return mapSession(row)
  },
  async update(id, changes) {
    const payload = { ...('name' in changes && { name: changes.name }), ...('startDate' in changes && { start_date: changes.startDate }), ...('endDate' in changes && { end_date: changes.endDate }), ...('status' in changes && { status: changes.status }) }
    const row = await runQuery((client) => client.from('sessions').update(payload).eq('id', id).select().single())
    return mapSession(row)
  },
  async manage(session) {
    return runQuery((client) => client.rpc('manage_session', {
      p_id: session.id,
      p_name: session.name,
      p_start_date: session.startDate || null,
      p_end_date: session.endDate || null,
      p_status: session.status,
    }))
  },
}
