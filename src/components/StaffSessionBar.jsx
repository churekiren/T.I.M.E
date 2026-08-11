import { LogOut } from 'lucide-react'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { useWorkingSession } from '../auth/WorkingSessionContext'

export function StaffSessionBar({ label }) {
  const { profile, signOut } = useStaffAuth()
  const { sessions, sessionId, setSessionId, loading } = useWorkingSession()
  return <div className="staff-session-bar">
    <span>{label} // {profile.role}</span>
    <label className="working-session-select">目前作業梯次
      <select value={sessionId} disabled={loading} onChange={(event) => setSessionId(event.target.value)}>
        {sessions.map((session) => <option value={session.id} key={session.id}>{session.name} // {session.status === 'PLANNED' ? 'PREPARING' : session.status}</option>)}
      </select>
    </label>
    <strong>{profile.displayName || profile.email}</strong>
    <button className="button button--ghost" type="button" onClick={signOut}>登出 <LogOut size={15} /></button>
  </div>
}
