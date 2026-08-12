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
    return runQuery((client) => client.rpc('create_session', {
      p_id: session.id,
      p_name: session.name,
      p_start_date: session.startDate || null,
      p_end_date: session.endDate || null,
      p_status: session.status,
    }))
  },
  async update(id, changes) {
    return runQuery((client) => client.rpc('update_session', {
      p_session_id: id,
      p_name: changes.name,
      p_start_date: changes.startDate || null,
      p_end_date: changes.endDate || null,
      p_status: changes.status,
    }))
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
