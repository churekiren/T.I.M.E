import { mapEnrollment, runQuery } from './repositoryCore'

export const enrollmentRepository = {
  async getAll() {
    const rows = await runQuery((client) => client.from('enrollments').select('*').order('joined_at'))
    return (rows || []).map(mapEnrollment)
  },
  async getBySession(sessionId) {
    const rows = await runQuery((client) => client.from('enrollments').select('*').eq('session_id', sessionId).order('joined_at'))
    return (rows || []).map(mapEnrollment)
  },
  async getByAgentInternalId(agentInternalId) {
    const rows = await runQuery((client) => client.from('enrollments').select('*').eq('agent_id', agentInternalId).order('joined_at'))
    return (rows || []).map(mapEnrollment)
  },
  async exists(agentInternalId, sessionId) {
    const row = await runQuery((client) => client.from('enrollments').select('id').eq('agent_id', agentInternalId).eq('session_id', sessionId).maybeSingle())
    return Boolean(row)
  },
}
