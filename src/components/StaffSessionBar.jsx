import { Fingerprint, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { useWorkingSession } from '../auth/WorkingSessionContext'
import { PasskeyManager } from './PasskeyManager'

export function StaffSessionBar({ label }) {
  const { profile, signOut } = useStaffAuth()
  const { sessions, sessionId, setSessionId, loading } = useWorkingSession()
  const [showPasskeys, setShowPasskeys] = useState(false)
  const canManagePasskeys = profile.role === 'OWNER' || profile.role === 'ADMIN'
  return <><div className="staff-session-bar">
    <span>{label} // {profile.role}</span>
    <label className="working-session-select">目前作業梯次
      <select value={sessionId} disabled={loading} onChange={(event) => setSessionId(event.target.value)}>
        {sessions.map((session) => <option value={session.id} key={session.id}>{session.name} // {session.status === 'PLANNED' ? 'PREPARING' : session.status}</option>)}
      </select>
    </label>
    <strong>{profile.displayName || profile.email}</strong>
    {canManagePasskeys && <button className="button button--ghost" type="button" aria-expanded={showPasskeys} onClick={() => setShowPasskeys((value) => !value)}><Fingerprint size={15} /> Passkey</button>}
    <button className="button button--ghost" type="button" onClick={signOut}>登出 <LogOut size={15} /></button>
  </div>{canManagePasskeys && showPasskeys && <PasskeyManager onClose={() => setShowPasskeys(false)} />}</>
}
