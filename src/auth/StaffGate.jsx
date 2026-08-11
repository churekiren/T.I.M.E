import { Navigate, useLocation } from 'react-router-dom'
import { StaffLogin } from '../pages/StaffLogin'
import { useStaffAuth } from './StaffAuthContext'

export function StaffGate({ roles, children }) {
  const auth = useStaffAuth()
  const location = useLocation()
  if (auth.loading) return <section className="staff-auth-panel"><span className="eyebrow">SECURE CHANNEL</span><h1>VERIFYING STAFF CLEARANCE</h1><p>正在驗證工作人員權限……</p></section>
  if (!auth.session || !auth.profile) return <StaffLogin intendedPath={location.pathname} />
  if (!roles.includes(auth.profile.role)) return <Navigate to={auth.profile.role === 'STAFF' ? '/staff' : '/admin'} replace />
  return children
}
