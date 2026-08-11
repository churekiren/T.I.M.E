import { useState } from 'react'
import { Fingerprint, KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { assetUrl } from '../utils/basePath'

export function StaffLogin() {
  const { signIn, signInWithPasskey, error } = useStaffAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [passkeySubmitting, setPasskeySubmitting] = useState(false)
  const submit = async (event) => { event.preventDefault(); if (submitting) return; setSubmitting(true); try { const profile = await signIn(email, password); if (profile) navigate(profile.role === 'STAFF' ? '/staff' : '/admin', { replace: true }) } catch { /* context supplies safe message */ } finally { setSubmitting(false) } }
  const passkeySignIn = async () => { if (passkeySubmitting) return; setPasskeySubmitting(true); try { const profile = await signInWithPasskey(); if (profile) navigate(profile.role === 'STAFF' ? '/staff' : '/admin', { replace: true }) } catch { /* context supplies safe fallback */ } finally { setPasskeySubmitting(false) } }
  return <section className="staff-auth-panel"><img src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 正式局徽" /><KeyRound /><span className="eyebrow">AUTHORIZED PERSONNEL ONLY</span><h1>工作人員身分驗證</h1><p>STAFF IDENTITY AUTHENTICATION</p><button className="button passkey-login" type="button" disabled={passkeySubmitting || submitting} onClick={passkeySignIn}><Fingerprint size={19} />{passkeySubmitting ? '正在啟動快速驗證……' : '使用 Face ID / Passkey'}</button><div className="auth-divider"><span>或使用 Email 與密碼</span></div><form onSubmit={submit}><label>工作人員 Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label>密碼<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p className="form-error">ACCESS NOTICE // {error}</p>}<button className="button" disabled={submitting || passkeySubmitting}>{submitting ? '正在驗證……' : '登入局方系統'}</button></form></section>
}
