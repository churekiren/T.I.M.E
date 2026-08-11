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
}
