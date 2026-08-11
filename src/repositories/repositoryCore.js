import { DATABASE_UNAVAILABLE_MESSAGE, requireSupabase, toDatabaseError } from '../lib/supabase'

export async function runQuery(operation) {
  try {
    const result = await operation(requireSupabase())
    if (result?.error) throw result.error
    return result?.data
  } catch (error) {
    if (error?.message === DATABASE_UNAVAILABLE_MESSAGE || error?.message === 'T.I.M.E. 尚未完成中央資料庫連線設定。') throw error
    throw toDatabaseError(error)
  }
}

export function mapAgent(row) {
  if (!row) return null
  return {
    internalId: row.id,
    id: row.permanent_agent_id,
    codename: row.codename,
    emblemPath: row.emblem_path,
    firstRegisteredAt: row.first_registered_at,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function mapSession(row) {
  if (!row) return null
  return { id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date, status: row.status, createdAt: row.created_at }
}

export function mapEnrollment(row) {
  if (!row) return null
  return {
    id: row.id,
    agentInternalId: row.agent_id,
    sessionId: row.session_id,
    displayAgentNumber: row.display_agent_number,
    returningAgent: row.returning_agent,
    joinedAt: row.joined_at,
    completionStatus: row.completion_status,
  }
}

export function normalizeRpcAgent(row) {
  if (!row) return null
  return { internalId: row.internalId, id: row.id, codename: row.codename, emblemPath: row.emblemPath, firstRegisteredAt: row.firstRegisteredAt, status: row.status }
}

export function normalizeRpcEnrollment(row) {
  if (!row) return null
  return { id: row.id, sessionId: row.sessionId, displayAgentNumber: row.displayAgentNumber, returningAgent: row.returningAgent }
}
