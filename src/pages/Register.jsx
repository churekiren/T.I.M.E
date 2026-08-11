import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Fingerprint } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmblemCapture } from '../components/EmblemCapture'
import { SectionHead } from '../components/Layout'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { centralRegistry } from '../services/centralRegistry'
import { assetUrl } from '../utils/basePath'

const EMPTY_EMBLEM = { source: '', cropped: '' }

export function Register() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const registrationToken = params.get('token') || ''
  const accessResource = useAsyncResource(
    () => registrationToken ? centralRegistry.inspectAccess(registrationToken) : Promise.resolve(null),
    [registrationToken],
  )
  const [codename, setCodename] = useState('')
  const [emblem, setEmblem] = useState(EMPTY_EMBLEM)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [diagnostics, setDiagnostics] = useState(null)
  const mountedRef = useRef(true)
  const submittingRef = useRef(false)
  useEffect(() => () => { mountedRef.current = false }, [])
  const updateEmblem = useCallback((next) => setEmblem(next), [])
  const valid = /^[A-Z]{2,18}$/.test(codename.trim())
  const access = accessResource.data
  const session = access?.session

  const submit = async (event) => {
    event.preventDefault()
    if (submittingRef.current) return
    if (!valid) return setError('請輸入 2 至 18 個英文字母作為探員代號。')
    if (!emblem.cropped) return setError('請先完成個人識別徽章的拍攝與裁切。')
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    try {
      const registration = await centralRegistry.registerNew({ rawToken: registrationToken, codename, emblem: emblem.cropped, emblemProcessingMs: emblem.processingMs, onTiming: (timings) => { if (mountedRef.current) setDiagnostics(timings) } })
      if (mountedRef.current) { setDiagnostics(registration.timings); setResult({ ...registration, accessToken: { token: registrationToken } }) }
    } catch (submitError) {
      if (submitError.code === 'ACCESS_CREDENTIAL_ALREADY_USED') {
        navigate(`/access/${encodeURIComponent(registrationToken)}`, { replace: true })
        return
      }
      if (mountedRef.current) {
        setError(submitError.message); setDiagnostics(submitError.registrationTimings || null)
      }
    } finally {
      submittingRef.current = false
      if (mountedRef.current) setSubmitting(false)
    }
  }

  if (result) return <section className="success-panel registration-success">
    <img className="registration-official-emblem" src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 正式局徽" />
    <div className="success-mark"><CheckCircle2 /></div><span className="eyebrow">IDENTITY SEALED</span>
    <h1>AGENT REGISTRATION COMPLETE</h1><h2>探員身分登錄完成</h2><p className="success-welcome">WELCOME TO T.I.M.E.</p>
    <img className="success-emblem" src={result.agent.emblem} alt={`${result.agent.codename} 個人識別徽章`} />
    <div className="receipt"><span>AGENT NUMBER<strong>{result.enrollment.displayAgentNumber}</strong></span><span>CODENAME<strong>{result.agent.codename}</strong></span><span>STATUS<strong className="active">● ACTIVE</strong></span></div>
    <p className="permanent-id">PERMANENT AGENT ID // {result.agent.id}</p>
    <div className="button-row"><Link className="button" to={`/agent/${result.agent.id}?access=${encodeURIComponent(result.accessToken.token)}`}>查看我的探員檔案 <ArrowRight size={17} /></Link></div>
    {import.meta.env.DEV && diagnostics && <details className="registration-diagnostics"><summary>DEV // REGISTRATION TIMING</summary>{Object.entries(diagnostics).map(([step, milliseconds]) => <span key={step}>{step}<strong>{milliseconds} ms</strong></span>)}</details>}
  </section>

  if (!registrationToken) return <section className="not-found"><h1>REGISTRATION CREDENTIAL REQUIRED</h1><p>首次入局必須由紙本探員身分登錄申請書上的 QR Code 進入。</p><Link className="button" to="/">返回中央入口</Link></section>
  if (accessResource.loading) return <section className="not-found"><h1>VERIFYING REGISTRATION ACCESS</h1><p>正在連線中央資料庫並驗證登錄權限……</p></section>
  if (accessResource.error) return <section className="not-found"><h1>REGISTRATION ACCESS INTERRUPTED</h1><p>{accessResource.error.message}</p><button className="button" type="button" onClick={accessResource.retry}>重新驗證</button></section>
  if ((!access || access.state !== 'UNUSED') && !submitting) return <section className="not-found"><h1>REGISTRATION ACCESS CLOSED</h1><p>{access?.state === 'USED' ? '此登錄憑證已完成使用，不能再次建立探員或修改永久身分。' : '此登錄憑證無效，請重新掃描紙本 QR Code。'}</p>{access?.state === 'USED' && <Link className="button" to={`/access/${registrationToken}`}>返回我的探員入口</Link>}</section>

  return <><SectionHead eyebrow={`AUTHORIZED CREDENTIAL // ${access.shortCode}`} title="探員身分登錄">完成以下三個步驟，正式建立 T.I.M.E. 永久探員身分。本次梯次已由紙本憑證鎖定，無須另行選擇。</SectionHead>
    <form className="registration-flow" onSubmit={submit} aria-busy={submitting}>
      <section className="registration-step"><header><span>STEP 01</span><div><h2>設定探員代號</h2><small>SET AGENT CODENAME</small></div></header><div className="step-body codename-step">
        <label><span>英文探員代號 <small>CODENAME</small></span><input autoFocus value={codename} disabled={submitting} onChange={(event) => { setCodename(event.target.value.toUpperCase().replace(/[^A-Z]/g, '')); setError('') }} placeholder="例如：NOVA" maxLength={18} autoCapitalize="characters" autoComplete="off" /><em>限 2–18 個英文字母，系統會自動轉為大寫。</em></label>
        <div className="session-lock"><span>CURRENT MISSION SESSION</span><strong>{session?.name}</strong><small>本次任務已由憑證指定</small></div></div></section>
      <section className="registration-step"><header><span>STEP 02</span><div><h2>登錄個人識別徽章</h2><small>REGISTER PERSONAL EMBLEM</small></div></header><div className="step-body"><EmblemCapture value={emblem} onChange={updateEmblem} /></div></section>
      <section className="registration-step confirmation-step"><header><span>STEP 03</span><div><h2>最終身分確認</h2><small>FINAL IDENTITY CHECK</small></div></header><div className="step-body confirmation-grid">
        <div className="confirmation-emblem">{emblem.cropped ? <img src={emblem.cropped} alt="徽章確認預覽" /> : <span>EMBLEM<br />PENDING</span>}</div><dl><div><dt>CODENAME</dt><dd>{codename || '尚未設定'}</dd></div><div><dt>MISSION SESSION</dt><dd>{session?.name}</dd></div><div><dt>AGENT NUMBER</dt><dd className="pending-id">完成登錄後自動配置</dd></div></dl><Fingerprint className="confirmation-fingerprint" /></div>
        {error && <p className="form-error registration-error">! {error}</p>}{import.meta.env.DEV && diagnostics && <details className="registration-diagnostics"><summary>DEV // FAILED TIMING</summary>{Object.entries(diagnostics).map(([step, milliseconds]) => <span key={step}>{step}<strong>{milliseconds} ms</strong></span>)}</details>}<button className="button registration-submit" type="submit" disabled={submitting || !valid || !emblem.cropped}>{submitting ? '正在封存探員身分……' : '完成探員登錄'} {!submitting && <ArrowRight size={17} />}</button></section>
    </form></>
}
