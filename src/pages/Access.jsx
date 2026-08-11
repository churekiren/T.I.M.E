import { KeyRound, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmblemPlaceholder } from '../components/EmblemPlaceholder'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { centralRegistry } from '../services/centralRegistry'
import { assetUrl } from '../utils/basePath'

function AccessLoading() {
  return <section className="not-found access-invalid"><KeyRound /><h1>VERIFYING ACCESS CREDENTIAL</h1><p>正在連線中央資料庫並驗證探員憑證……</p></section>
}

function AccessError({ error, retry }) {
  return <section className="not-found access-invalid"><KeyRound /><h1>ACCESS VERIFICATION INTERRUPTED</h1><p>{error.message}</p><button className="button" type="button" onClick={retry}>重新驗證</button></section>
}

export function Access() {
  const { token = '' } = useParams()
  const { data: access, loading, error, retry } = useAsyncResource(() => centralRegistry.inspectAccess(token), [token])

  if (loading) return <AccessLoading />
  if (error) return <AccessError error={error} retry={retry} />
  if (!access || access.state === 'INVALID') return <section className="not-found access-invalid"><KeyRound /><h1>ACCESS CREDENTIAL INVALID</h1><p>此探員存取憑證無效或已失效，請洽現場工作人員。</p></section>

  if (access.state === 'UNUSED') return <section className="access-gate"><img src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 正式局徽" /><span className="eyebrow">ONE-TIME REGISTRATION CLEARANCE</span><h1>TEMPORARY ACCESS GRANTED</h1><h2>臨時探員登錄權限核准</h2><div className="access-meta"><span>CREDENTIAL<strong>{access.shortCode}</strong></span><span>MISSION SESSION<strong>{access.session?.name}</strong></span><span>STATUS<strong>UNUSED</strong></span></div><p>此憑證僅供一次首次入局登錄使用。完成身分與徽章登錄後，同一 QR Code 將轉為唯讀探員檔案入口。</p><Link className="button" to={`/register?token=${encodeURIComponent(token)}`}>開始探員身分登錄</Link></section>

  const { agent, enrollment } = access
  if (!agent || !enrollment) return <section className="not-found"><KeyRound /><h1>ARCHIVE LINK INCOMPLETE</h1><p>中央檔案連結尚未完成，請洽現場工作人員。</p></section>
  return <section className="access-gate access-used"><img src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 正式局徽" /><ShieldCheck className="access-shield" /><span className="eyebrow">READ-ONLY IDENTITY ACCESS</span><h1>IDENTITY VERIFIED</h1><h2>探員身分已完成登錄</h2><div className="access-agent-emblem">{agent.emblem ? <img src={agent.emblem} alt={`${agent.codename} 徽章`} /> : <EmblemPlaceholder />}</div><div className="access-meta"><span>CODENAME<strong>{agent.codename}</strong></span><span>AGENT NUMBER<strong>{enrollment.displayAgentNumber}</strong></span><span>FIRST REGISTERED<strong>{new Date(agent.firstRegisteredAt).getFullYear()}</strong></span></div><p>永久探員資料已封存。此入口僅提供檔案與本次任務識別牆的唯讀權限。</p><Link className="button" to={`/agent/${agent.id}?access=${encodeURIComponent(token)}`}>進入我的探員檔案</Link></section>
}
