import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabase'

const StaffAuthContext = createContext(null)

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
  const signOut = async () => { await requireSupabase().auth.signOut(); setState({ session: null, profile: null, loading: false, error: '' }) }
  return <StaffAuthContext.Provider value={{ ...state, signIn, signOut, refresh }}>{children}</StaffAuthContext.Provider>
}

export function useStaffAuth() {
  const value = useContext(StaffAuthContext)
  if (!value) throw new Error('StaffAuthProvider is required')
  return value
}
