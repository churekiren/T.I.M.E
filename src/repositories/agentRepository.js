import { emblemRepository } from './emblemRepository'
import { mapAgent, runQuery } from './repositoryCore'

async function withEmblem(agent) {
  return agent ? { ...agent, emblem: await emblemRepository.createSignedUrl(agent.emblemPath) } : null
}

export const agentRepository = {
  async getAll() {
    const rows = await runQuery((client) => client.from('agents').select('*').order('created_at'))
    return Promise.all((rows || []).map((row) => withEmblem(mapAgent(row))))
  },
  async getById(permanentAgentId) {
    const row = await runQuery((client) => client.from('agents').select('*').eq('permanent_agent_id', permanentAgentId.toUpperCase()).maybeSingle())
    return withEmblem(mapAgent(row))
  },
  async search(query) {
    const normalized = query.trim().toUpperCase().replaceAll('%', '')
    if (!normalized) return this.getAll()
    const rows = await runQuery((client) => client.from('agents').select('*').or(`permanent_agent_id.ilike.%${normalized}%,codename.ilike.%${normalized}%`).order('created_at'))
    return Promise.all((rows || []).map((row) => withEmblem(mapAgent(row))))
  },
  async update(permanentAgentId, changes) {
    const payload = { ...('codename' in changes && { codename: changes.codename.trim().toUpperCase() }), ...('status' in changes && { status: changes.status }), ...('emblemPath' in changes && { emblem_path: changes.emblemPath }) }
    const row = await runQuery((client) => client.from('agents').update(payload).eq('permanent_agent_id', permanentAgentId.toUpperCase()).select().single())
    return withEmblem(mapAgent(row))
  },
  async getFileByToken(rawToken) {
    const data = await runQuery((client) => client.rpc('get_agent_file_by_token', { p_raw_token: rawToken }))
    if (!data || data.state !== 'USED') return { state: 'INVALID' }
    const agent = { ...data.agent, emblem: await emblemRepository.createSignedUrl(data.agent.emblemPath) }
    return { state: 'USED', authorizedSessionId: data.authorizedSessionId, agent, missions: data.missions || [] }
  },
  async fieldSearch(query, sessionId) {
    const rows = await runQuery((client) => client.rpc('search_field_agents', { p_query: query, p_session_id: sessionId }))
    return Promise.all((rows || []).map(async (row) => ({
      id: row.permanent_agent_id,
      codename: row.codename,
      emblemPath: row.emblem_path,
      emblem: await emblemRepository.createSignedUrl(row.emblem_path),
      firstRegisteredAt: row.first_registered_at,
      status: row.agent_status,
      matchingShortCode: row.matching_short_code,
      currentEnrollment: row.current_enrollment_id ? {
        id: row.current_enrollment_id,
        displayAgentNumber: row.current_display_agent_number,
        completionStatus: row.current_enrollment_status,
        returningAgent: row.current_returning_agent,
        joinedAt: row.current_joined_at,
        sessionId,
      } : null,
      missions: row.mission_history || [],
    })))
  },
  async deletePermanently(permanentAgentId) {
    return runQuery((client) => client.rpc('delete_agent_permanently', { p_permanent_agent_id: permanentAgentId }))
  },
  async resequencePermanentIds() {
    return runQuery((client) => client.rpc('resequence_permanent_agent_ids'))
  },
}
