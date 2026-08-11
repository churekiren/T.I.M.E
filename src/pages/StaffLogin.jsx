import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { assetUrl } from '../utils/basePath'

export function StaffLogin() {
  const { signIn, error } = useStaffAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => { event.preventDefault(); if (submitting) return; setSubmitting(true); try { const profile = await signIn(email, password); if (profile) navigate(profile.role === 'STAFF' ? '/staff' : '/admin', { replace: true }) } catch { /* context supplies safe message */ } finally { setSubmitting(false) } }
  return <section className="staff-auth-panel"><img src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 正式局徽" /><KeyRound /><span className="eyebrow">AUTHORIZED PERSONNEL ONLY</span><h1>工作人員身分驗證</h1><p>STAFF IDENTITY AUTHENTICATION</p><form onSubmit={submit}><label>工作人員 Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label>密碼<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p className="form-error">ACCESS DENIED // {error}</p>}<button className="button" disabled={submitting}>{submitting ? '正在驗證……' : '登入局方系統'}</button></form></section>
}
