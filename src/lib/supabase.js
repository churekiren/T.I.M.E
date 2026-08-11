import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const REQUEST_TIMEOUT_MS = 30000

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new DOMException('REQUEST_TIMEOUT', 'AbortError')), REQUEST_TIMEOUT_MS)
  const upstreamSignal = init.signal
  const abortFromUpstream = () => controller.abort(upstreamSignal.reason)
  if (upstreamSignal) {
    if (upstreamSignal.aborted) abortFromUpstream()
    else upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true })
  }
  try { return await fetch(input, { ...init, signal: controller.signal }) }
  finally {
    clearTimeout(timeout)
    upstreamSignal?.removeEventListener('abort', abortFromUpstream)
  }
}

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        experimental: { passkey: true },
      },
      realtime: { params: { eventsPerSecond: 10 } },
      global: { fetch: fetchWithTimeout },
    })
  : null

export const DATABASE_NOT_CONFIGURED_MESSAGE = 'T.I.M.E. 尚未完成中央資料庫連線設定。'
export const DATABASE_UNAVAILABLE_MESSAGE = '目前無法連線至 T.I.M.E. 中央資料庫，請稍後再試。'

const DATABASE_ERROR_MESSAGES = {
  ACCESS_CREDENTIAL_ALREADY_USED: '此登錄憑證已完成使用，不能再次建立探員。',
  ACCESS_CREDENTIAL_INVALID: '此登錄憑證無效，請重新掃描紙本 QR Code。',
  ACCESS_CREDENTIAL_EXPIRED: '此登錄憑證已過期，請洽現場工作人員。',
  ACCESS_PURPOSE_INVALID: '此憑證不具備首次探員登錄權限。',
  SESSION_NOT_ACTIVE: '此任務梯次目前未開放登錄。',
  CODENAME_INVALID: '探員代號必須為 2 至 18 個英文字母。',
  EMBLEM_PATH_INVALID: '徽章封存路徑驗證失敗，請重試。',
  STAFF_AUTH_REQUIRED: '管理端尚未取得工作人員授權，無法建立 Supabase 登錄憑證。',
}

export function requireSupabase() {
  if (!supabase) throw new Error(DATABASE_NOT_CONFIGURED_MESSAGE)
  return supabase
}

export function toDatabaseError(error) {
  if (error?.message === DATABASE_NOT_CONFIGURED_MESSAGE) return error
  if (error?.name === 'AbortError' || error?.message === 'REQUEST_TIMEOUT' || error?.cause?.name === 'AbortError' || /abort|timeout/i.test(error?.message || '')) {
    const timeoutError = new Error('連線超過 30 秒仍未完成，請確認 Wi-Fi 後重新操作。', { cause: error })
    timeoutError.code = 'REQUEST_TIMEOUT'
    return timeoutError
  }
  const knownMessage = DATABASE_ERROR_MESSAGES[error?.message]
  if (knownMessage) {
    const mappedError = new Error(knownMessage, { cause: error })
    mappedError.code = error.message
    return mappedError
  }
  return new Error(DATABASE_UNAVAILABLE_MESSAGE, { cause: error })
}
