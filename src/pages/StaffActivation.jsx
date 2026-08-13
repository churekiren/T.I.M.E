import { useState } from 'react'
import { CheckCircle2, KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { assetUrl } from '../utils/basePath'

export function StaffActivation() {
  const { profile, activationRequired, completePasswordSetup } = useStaffAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    if (password.length < 8) { setMessage('密碼至少需要 8 個字元。'); return }
    if (password !== confirmation) { setMessage('兩次輸入的密碼不一致，請重新確認。'); return }
    setSubmitting(true); setMessage('')
    try {
      const activeProfile = await completePasswordSetup(password)
      setPassword(''); setConfirmation(''); setComplete(true)
      window.setTimeout(() => navigate(activeProfile.role === 'STAFF' ? '/staff' : '/admin', { replace: true }), 900)
    } catch (error) {
      setMessage(error?.message || '密碼設定失敗，請稍後再試。')
    } finally { setSubmitting(false) }
  }

  return <section className="staff-auth-panel staff-activation-panel">
    <img src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 正式局徽" />
    {complete ? <CheckCircle2 /> : <KeyRound />}
    <span className="eyebrow">STAFF ACCOUNT ACTIVATION</span>
    <h1>{complete ? '身分驗證完成' : activationRequired ? '啟用 T.I.M.E. 工作人員帳號' : '設定登入密碼'}</h1>
    <p>{complete ? '歡迎加入 T.I.M.E.' : `${profile.role} // ${profile.email}`}</p>
    {!complete && <form onSubmit={submit}>
      <label>新密碼<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength="8" required /></label>
      <label>確認新密碼<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength="8" required /></label>
      {message && <p className="form-error">ACCESS NOTICE // {message}</p>}
      <button className="button" disabled={submitting}>{submitting ? '正在啟用帳號……' : activationRequired ? '啟用帳號' : '儲存登入密碼'}</button>
    </form>}
  </section>
}
