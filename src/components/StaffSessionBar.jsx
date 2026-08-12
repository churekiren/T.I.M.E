import { LogOut } from 'lucide-react'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { useWorkingSession } from '../auth/WorkingSessionContext'

export function StaffSessionBar({ label }) {
  const { profile, signOut } = useStaffAuth()
  const { sessions, sessionId, currentSession, setSessionId, loading } = useWorkingSession()
  const dateRange = currentSession.startDate && currentSession.endDate ? `${currentSession.startDate} — ${currentSession.endDate}` : (currentSession.startDate || currentSession.endDate || '日期尚未設定')
  return <div className="staff-session-bar">
    <span>{label} // {profile.role}</span>
    <div className="current-mission"><small>CURRENT MISSION</small><strong>{currentSession.name}</strong><span>{currentSession.id || 'NO OPERATIONAL SESSION'} // {dateRange}</span></div>
    <label className="working-session-select">切換作業梯次
      <select value={sessionId} disabled={loading} onChange={(event) => setSessionId(event.target.value)}>
        {!sessions.length && <option value="">目前沒有可作業梯次</option>}
        {sessions.map((session) => <option value={session.id} key={session.id}>{session.name} // {session.id} // {session.startDate || '日期未定'}</option>)}
      </select>
    </label>
    <strong className="staff-identity">{profile.displayName || profile.email}</strong>
    <button className="button button--ghost" type="button" onClick={signOut}>登出 <LogOut size={15} /></button>
  </div>
}
