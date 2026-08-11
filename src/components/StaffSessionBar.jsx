import { LogOut } from 'lucide-react'
import { useStaffAuth } from '../auth/StaffAuthContext'

export function StaffSessionBar({ label }) {
  const { profile, signOut } = useStaffAuth()
  return <div className="staff-session-bar"><span>{label} // {profile.role}</span><strong>{profile.displayName || profile.email}</strong><button className="button button--ghost" type="button" onClick={signOut}>登出 <LogOut size={15} /></button></div>
}
