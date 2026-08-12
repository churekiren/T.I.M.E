import { emblemRepository } from './emblemRepository'
import { runQuery } from './repositoryCore'
import { requireSupabase } from '../lib/supabase'

async function mapWallEntry(row) {
  return { enrollmentId: row.enrollment_id, displayAgentNumber: row.display_agent_number, returningAgent: row.returning_agent, codename: row.codename, emblemPath: row.emblem_path, emblem: await emblemRepository.createSignedUrl(row.emblem_path), joinedAt: row.joined_at }
}

export const wallRepository = {
  async getBySession(sessionId) {
    const rows = await runQuery((client) => client.rpc('get_session_wall', { p_session_id: sessionId }))
    return Promise.all((rows || []).map(mapWallEntry))
  },
  subscribe(sessionId, callback, onStatus = () => {}) {
    try {
      const client = requireSupabase()
      const channel = client.channel(`wall:${sessionId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'wall_entries', filter: `session_id=eq.${sessionId}` }, (payload) => callback(payload)).subscribe(onStatus)
      return () => { client.removeChannel(channel) }
    } catch (error) {
      queueMicrotask(() => callback({ error }))
      return () => {}
    }
  },
}
