import { emblemRepository } from './emblemRepository'
import { runQuery } from './repositoryCore'

export const accessTokenRepository = {
  async inspect(rawToken) {
    const data = await runQuery((client) => client.rpc('inspect_registration_token', { p_raw_token: rawToken }))
    if (!data || data.state === 'INVALID') return { state: 'INVALID' }
    if (data.state === 'USED' && data.agent?.emblemPath) data.agent.emblem = await emblemRepository.createSignedUrl(data.agent.emblemPath)
    return data
  },
  async getAll() {
    const rows = await runQuery((client) => client.from('registration_tokens').select('id,short_code,session_id,agent_id,enrollment_id,purpose,status,created_at,used_at,expires_at').order('created_at', { ascending: false }))
    return (rows || []).map((row) => ({ id: row.id, shortCode: row.short_code, sessionId: row.session_id, agentInternalId: row.agent_id, enrollmentId: row.enrollment_id, purpose: row.purpose, status: row.status, createdAt: row.created_at, usedAt: row.used_at, expiresAt: row.expires_at }))
  },
  async createBatch(count, sessionId) {
    const rows = await runQuery((client) => client.rpc('create_registration_tokens', { p_session_id: sessionId, p_count: Number(count) }))
    return (rows || []).map((row) => ({ id: row.id, rawToken: row.raw_token, shortCode: row.short_code, sessionId: row.session_id, status: row.status, createdAt: row.created_at }))
  },
  async createUniversalBatch(count) {
    const rows = await runQuery((client) => client.rpc('create_universal_registration_tokens', { p_count: Number(count) }))
    return (rows || []).map((row) => ({ id: row.id, rawToken: row.raw_token, shortCode: row.short_code, sessionId: null, status: row.status, createdAt: row.created_at }))
  },
  async requestWaiting(rawToken) {
    return runQuery((client) => client.rpc('request_registration_waiting', { p_raw_token: rawToken }))
  },
  async getWaitingPool() {
    const rows = await runQuery((client) => client.rpc('list_registration_waiting_pool'))
    return (rows || []).map((row) => ({ tokenId: row.token_id, shortCode: row.short_code, requestedAt: row.requested_at, lastSeenAt: row.last_seen_at, waitingSeconds: Number(row.waiting_seconds), state: row.state }))
  },
  async authorizeWaiting(tokenIds, targetSessionId) {
    return runQuery((client) => client.rpc('authorize_registration_waiting', { p_token_ids: tokenIds, p_target_session_id: targetSessionId }))
  },
  async cancelWaiting(tokenIds) {
    return runQuery((client) => client.rpc('cancel_registration_waiting', { p_token_ids: tokenIds }))
  },
  async getMetadataBySession(sessionId) {
    const rows = await runQuery((client) => client.rpc('list_registration_token_metadata', { p_session_id: sessionId }))
    return (rows || []).map((row) => ({ id: row.id, shortCode: row.short_code, sessionId: row.session_id, status: row.status, purpose: row.purpose, createdAt: row.created_at, usedAt: row.used_at, permanentAgentId: row.permanent_agent_id, codename: row.codename }))
  },
}
