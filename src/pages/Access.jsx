import { useEffect, useState } from 'react'
import { KeyRound, Radio, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmblemPlaceholder } from '../components/EmblemPlaceholder'
import { useRegistrationAccess } from '../hooks/useRegistrationAccess'
import { assetUrl } from '../utils/basePath'

export function Access() {
  const { token = '' } = useParams(); const navigate = useNavigate(); const { data: access, loading, error, retry } = useRegistrationAccess(token); const [granting, setGranting] = useState(false)
  useEffect(() => {
    if (access?.state !== 'UNUSED') return
    setGranting(true)
    const timer = setTimeout(() => navigate(`/register?token=${encodeURIComponent(token)}`, { replace: true }), 1500)
    return () => clearTimeout(timer)
  }, [access?.state, navigate, token])

  if (loading) return <section className="not-found access-invalid"><KeyRound /><h1>VERIFYING ACCESS CREDENTIAL</h1><p>正在連線中央檔案並驗證探員憑證……</p></section>
  if (error && !access) return <section className="not-found access-invalid"><KeyRound /><h1>ACCESS VERIFICATION INTERRUPTED</h1><p>{error}</p><button className="button" type="button" onClick={retry}>重新連線</button></section>
  if (!access || access.state === 'INVALID') return <section className="not-found access-invalid"><KeyRound /><h1>ACCESS CREDENTIAL INVALID</h1><p>此探員存取憑證無效或已失效，請洽現場工作人員。</p></section>
  if (access.state === 'CLOSED') return <section className="access-gate"><img src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 正式局徽" /><KeyRound className="access-shield" /><span className="eyebrow">MISSION ARCHIVE SEALED</span><h1>REGISTRATION CLOSED</h1><h2>本梯次身份建檔已關閉</h2><p>此憑證尚未完成首次入局，請洽現場工作人員。</p></section>
  if (access.state === 'WAITING' || access.state === 'UNASSIGNED') return <section className="access-gate access-waiting"><img src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 正式局徽" /><div className="waiting-signal"><Radio /></div><span className="eyebrow">TEMPORAL LINK ESTABLISHED</span><h1>AWAITING AUTHORIZATION</h1><h2>時界連線已建立</h2><div className="access-meta"><span>CREDENTIAL<strong>{access.shortCode}</strong></span><span>LINK STATUS<strong>STANDBY</strong></span><span>CHANNEL<strong>SECURE</strong></span></div><p>等待時界局開放身份建檔權限。請保持此頁面開啟，權限開放後將自動進入。</p>{error && <small className="waiting-reconnect">連線正在自動恢復，不需要重新掃描。</small>}</section>
  if (granting || access.state === 'UNUSED') return <section className="access-gate access-granted"><img src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 正式局徽" /><ShieldCheck className="access-shield" /><span className="eyebrow">IDENTITY CLEARANCE AUTHORIZED</span><h1>ACCESS GRANTED</h1><h2>身份建檔權限已開放</h2><p>正在啟動首次入局建檔程序……</p></section>

  const { agent, enrollment } = access
  if (!agent || !enrollment) return <section className="not-found"><KeyRound /><h1>ARCHIVE LINK INCOMPLETE</h1><p>中央檔案連結尚未完成，請洽現場工作人員。</p></section>
  return <section className="access-gate access-used"><img src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 正式局徽" /><ShieldCheck className="access-shield" /><span className="eyebrow">READ-ONLY IDENTITY ACCESS</span><h1>IDENTITY VERIFIED</h1><h2>探員身分已完成登錄</h2><div className="access-agent-emblem">{agent.emblem ? <img src={agent.emblem} alt={`${agent.codename} 徽章`} /> : <EmblemPlaceholder />}</div><div className="access-meta"><span>CODENAME<strong>{agent.codename}</strong></span><span>AGENT NUMBER<strong>{enrollment.displayAgentNumber}</strong></span><span>FIRST REGISTERED<strong>{new Date(agent.firstRegisteredAt).getFullYear()}</strong></span></div><p>永久探員資料已封存。此入口僅提供檔案與本次任務識別牆的唯讀權限。</p><Link className="button" to={`/agent/${agent.id}?access=${encodeURIComponent(token)}`}>進入我的探員檔案</Link></section>
}
