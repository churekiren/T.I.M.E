import { buildAccessUrl } from '../utils/accessUrl'

const TOKEN_KEY = 'time-registration-print:tokens'
const BATCH_PREFIX = 'time-registration-print:batch:'

function readJson(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback } catch { return fallback }
}

export function readRegistrationPrintTokens() { return readJson(TOKEN_KEY, []) }

export function storeRegistrationPrintTokens(tokens) {
  const existing = readRegistrationPrintTokens()
  const byId = new Map(existing.map((item) => [item.id, item]))
  tokens.forEach((token) => byId.set(token.id, {
    id: token.id,
    rawToken: token.rawToken,
    shortCode: token.shortCode,
    sessionId: token.sessionId,
    accessUrl: token.accessUrl || buildAccessUrl(token.rawToken),
    createdAt: token.createdAt,
  }))
  const stored = [...byId.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(stored))
  return stored
}

export function cacheRegistrationPrintBatch(tokens) {
  storeRegistrationPrintTokens(tokens)
  const batchId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  sessionStorage.setItem(`${BATCH_PREFIX}${batchId}`, JSON.stringify(tokens.map((token) => token.id)))
  return batchId
}

export function readRegistrationPrintBatch(batchId) {
  if (!batchId) return []
  const ids = readJson(`${BATCH_PREFIX}${batchId}`, [])
  const tokens = readRegistrationPrintTokens()
  return ids.map((id) => tokens.find((token) => token.id === id)).filter(Boolean)
}
