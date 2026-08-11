export const STORAGE_KEYS = {
  agents: 'time-bureau-agents-v2',
  sessions: 'time-bureau-sessions-v2',
  enrollments: 'time-bureau-enrollments-v2',
  tokens: 'time-bureau-access-tokens-v2',
  meta: 'time-bureau-meta-v2',
  legacyAgents: 'time-bureau-agents-v1',
}

const CHANNEL_NAME = 'time-bureau-updates-v2'
const EVENT_NAME = 'time-registry-changed'
const canUseDOM = typeof window !== 'undefined'

export function read(key, fallback = []) {
  if (!canUseDOM) return fallback
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

export function write(key, value, event = {}) {
  if (!canUseDOM) return
  localStorage.setItem(key, JSON.stringify(value))
  const detail = { ...event, key, at: Date.now() }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }))
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(detail)
    channel.close()
  }
}

export function subscribe(callback) {
  if (!canUseDOM) return () => {}
  const onLocal = (event) => callback(event.detail)
  const onStorage = (event) => Object.values(STORAGE_KEYS).includes(event.key) && callback({ type: 'storage-sync', key: event.key })
  let channel
  window.addEventListener(EVENT_NAME, onLocal)
  window.addEventListener('storage', onStorage)
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event) => callback(event.data)
  }
  return () => { window.removeEventListener(EVENT_NAME, onLocal); window.removeEventListener('storage', onStorage); channel?.close() }
}

export function makeId(prefix) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${id}`
}
