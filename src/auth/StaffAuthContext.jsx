import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabase'

const StaffAuthContext = createContext(null)
const PASSKEY_ROLES = new Set(['OWNER', 'ADMIN'])

function passkeyErrorMessage(error) {
  const name = error?.name || error?.cause?.name || ''
  const message = error?.message || ''
  if (name === 'NotAllowedError' || /cancel|not.?allowed/i.test(message)) return '快速登入已取消，仍可使用 Email 與密碼登入。'
  if (name === 'NotSupportedError' || /not.?supported|webauthn.*unavailable/i.test(message)) return '此瀏覽器或裝置不支援 Passkey，請使用 Email 與密碼登入。'
  return '快速登入未完成，仍可使用 Email 與密碼登入。'
}

function requirePasskeySupport() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
    const error = new Error('此瀏覽器或裝置不支援 Passkey，請使用 Email 與密碼登入。')
    error.code = 'PASSKEY_UNAVAILABLE'
    throw error
  }
}

async function loadProfile(session) {
  if (!session) return null
  const { data, error } = await requireSupabase().rpc('get_my_staff_profile')
  if (error) throw error
  return data?.state === 'DENIED' ? null : data
}

export function StaffAuthProvider({ children }) {
  const [state, setState] = useState({ session: null, profile: null, loading: true, error: '' })
  const refresh = useCallback(async (sessionOverride) => {
    try {
      const client = requireSupabase()
      const session = sessionOverride === undefined ? (await client.auth.getSession()).data.session : sessionOverride
      const profile = await loadProfile(session)
      setState({ session, profile, loading: false, error: '' })
    } catch (error) { setState({ session: null, profile: null, loading: false, error: error.message }) }
  }, [])

  useEffect(() => {
    void refresh()
    const { data } = requireSupabase().auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { void refresh(session) }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [refresh])

  const signIn = async (email, password) => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password })
    if (error) { setState({ session: null, profile: null, loading: false, error: 'Email 或密碼不正確。' }); throw error }
    const profile = await loadProfile(data.session)
    if (!profile) {
      await requireSupabase().auth.signOut()
      setState({ session: null, profile: null, loading: false, error: '未取得 T.I.M.E. 工作人員授權。' })
      return null
    }
    setState({ session: data.session, profile, loading: false, error: '' })
    return profile
  }
  const signInWithPasskey = async () => {
    try {
      requirePasskeySupport()
      setState((current) => ({ ...current, loading: true, error: '' }))
      const { data, error } = await requireSupabase().auth.signInWithPasskey()
      if (error) throw error
      const profile = await loadProfile(data.session)
      if (!profile) {
        await requireSupabase().auth.signOut()
        setState({ session: null, profile: null, loading: false, error: '此帳號沒有有效的 T.I.M.E. 工作人員授權。' })
        return null
      }
      setState({ session: data.session, profile, loading: false, error: '' })
      return profile
    } catch (error) {
      const safeMessage = error.code === 'PASSKEY_UNAVAILABLE' ? error.message : passkeyErrorMessage(error)
      setState((current) => ({ ...current, loading: false, error: safeMessage }))
      throw error
    }
  }
  const requirePasskeyManager = () => {
    if (!state.session || !state.profile || !PASSKEY_ROLES.has(state.profile.role)) throw new Error('PASSKEY_MANAGEMENT_NOT_AUTHORIZED')
    requirePasskeySupport()
    return requireSupabase().auth
  }
  const listPasskeys = async () => {
    const { data, error } = await requirePasskeyManager().passkey.list()
    if (error) throw error
    return data || []
  }
  const registerPasskey = async () => {
    const { data, error } = await requirePasskeyManager().registerPasskey()
    if (error) throw error
    return data
  }
  const renamePasskey = async (passkeyId, friendlyName) => {
    const { data, error } = await requirePasskeyManager().passkey.update({ passkeyId, friendlyName: friendlyName.trim() })
    if (error) throw error
    return data
  }
  const deletePasskey = async (passkeyId) => {
    const { error } = await requirePasskeyManager().passkey.delete({ passkeyId })
    if (error) throw error
  }
  const signOut = async () => { await requireSupabase().auth.signOut(); setState({ session: null, profile: null, loading: false, error: '' }) }
  return <StaffAuthContext.Provider value={{ ...state, signIn, signInWithPasskey, signOut, refresh, listPasskeys, registerPasskey, renamePasskey, deletePasskey }}>{children}</StaffAuthContext.Provider>
}

export function useStaffAuth() {
  const value = useContext(StaffAuthContext)
  if (!value) throw new Error('StaffAuthProvider is required')
  return value
}
