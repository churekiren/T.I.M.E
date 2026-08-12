import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { sessionRepository } from '../repositories'
import { campConfig } from '../config/campConfig'

const STORAGE_KEY = 'time-staff-working-session'
const WorkingSessionContext = createContext(null)

export function WorkingSessionProvider({ children }) {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || campConfig.currentSessionId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = async () => {
    try {
      const rows = await sessionRepository.getOperational()
      setSessions(rows)
      setSessionIdState((current) => rows.some((item) => item.id === current) ? current : (rows[0]?.id || ''))
      setError('')
    } catch (loadError) { setError(loadError.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  const setSessionId = (value) => { if (value) localStorage.setItem(STORAGE_KEY, value); else localStorage.removeItem(STORAGE_KEY); setSessionIdState(value) }
  const currentSession = sessions.find((item) => item.id === sessionId) || { id: '', name: '尚未選擇作業梯次', status: 'UNKNOWN', startDate: null, endDate: null }
  const value = useMemo(() => ({ sessions, sessionId, currentSession, setSessionId, refresh, loading, error }), [sessions, sessionId, currentSession, loading, error])
  return <WorkingSessionContext.Provider value={value}>{children}</WorkingSessionContext.Provider>
}

export function useWorkingSession() {
  const value = useContext(WorkingSessionContext)
  if (!value) throw new Error('WorkingSessionProvider is required')
  return value
}
