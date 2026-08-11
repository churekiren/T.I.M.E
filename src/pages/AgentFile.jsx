import { Link, useParams, useSearchParams } from 'react-router-dom'
import { FileKey2, ShieldCheck } from 'lucide-react'
import { Brand } from '../components/Brand'
import { EmblemPlaceholder } from '../components/EmblemPlaceholder'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { agentRepository } from '../repositories'

export function AgentFile() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const rawToken = params.get('access') || ''
  const { data: file, loading, error, retry } = useAsyncResource(
    () => rawToken ? agentRepository.getFileByToken(rawToken) : Promise.resolve({ state: 'INVALID' }),
    [rawToken],
  )

  if (loading) return <section className="not-found"><FileKey2 /><h1>VERIFYING AGENT ARCHIVE</h1><p>正在連線中央資料庫並驗證檔案權限……</p></section>
  if (error) return <section className="not-found"><FileKey2 /><h1>ARCHIVE ACCESS INTERRUPTED</h1><p>{error.message}</p><button className="button" type="button" onClick={retry}>重新讀取</button></section>
  if (!file || file.state !== 'USED' || file.agent?.id !== id?.toUpperCase()) return <section className="not-found"><FileKey2 /><h1>查無此探員檔案</h1><p>ARCHIVE RECORD NOT FOUND OR ACCESS DENIED</p><Link className="button" to="/agents">返回檔案查詢</Link></section>

  const { agent, missions } = file
  const year = new Date(agent.firstRegisteredAt).getFullYear()
  return <article className="dossier"><div className="dossier-top"><Brand compact /><div className="classified">CLASSIFIED AGENT FILE <span>// ACCESS LEVEL I</span></div></div>
    <header><span>時界異常事件處理局官方識別區</span><h1>機密探員人事檔案</h1><p>OFFICIAL AGENT IDENTIFICATION RECORD</p></header>
    <div className="dossier-body"><section className="file-fields"><div><label>PERMANENT AGENT ID</label><strong>{agent.id}</strong></div><div><label>CODENAME</label><strong>{agent.codename}</strong></div><div><label>FIRST REGISTERED</label><span>{year}</span></div><div><label>STATUS</label><span className="status"><i /> {agent.status}</span></div></section>
      <section className="personal-emblem"><label>PERSONAL EMBLEM <span>個人識別徽章</span></label><div>{agent.emblem ? <img src={agent.emblem} alt={`${agent.codename} 個人識別徽章`} /> : <EmblemPlaceholder />}</div></section></div>
    <section className="mission-history"><header><span>MISSION HISTORY</span><h2>歷次任務紀錄</h2></header>{missions.map((mission) => <div className="mission-row" key={mission.enrollmentId}><div><strong>{mission.sessionName || mission.sessionId}</strong><small>{mission.displayAgentNumber} {mission.returningAgent && '// RETURNING AGENT'}</small></div><span className={mission.completionStatus === 'ACTIVE' ? 'active' : ''}>{mission.completionStatus}</span></div>)}<div className="authorized-wall-link"><span>AUTHORIZED SESSION // {file.authorizedSessionId}</span><Link className="button button--ghost" to={`/wall?session=${file.authorizedSessionId}&access=${encodeURIComponent(rawToken)}`}>進入本梯次探員識別牆</Link></div></section>
    <div className="verification"><ShieldCheck /><div><strong>IDENTITY RECORD VERIFIED</strong><span>此檔案由 T.I.M.E. 中央資料庫提供唯讀驗證。</span></div><b>{agent.id.replaceAll('-', '')}</b></div>
  </article>
}
