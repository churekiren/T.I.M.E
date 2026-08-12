import { ShieldAlert } from 'lucide-react'
import { EmblemPlaceholder } from './EmblemPlaceholder'

export function AgentDetail({ agent, isOwner = false, onDelete }) {
  if (!agent) return <p>選擇一位探員以檢查完整永久身分與任務紀錄。</p>
  return <><h2>{agent.codename}</h2><p>{agent.id}</p>{agent.emblem ? <img className="admin-detail-emblem" src={agent.emblem} alt={`${agent.codename} 徽章`} /> : <EmblemPlaceholder />}<div className="field-status"><span>UUID 身分<strong>永不重新編號</strong></span><span>徽章<strong>{agent.emblemPath ? '已完成' : '尚未完成'}</strong></span><span>本梯 Enrollment<strong>{agent.currentEnrollment?.completionStatus || '尚未加入'}</strong></span><span>任務次數<strong>{agent.missions.length}</strong></span></div><h3>MISSION HISTORY</h3>{agent.missions.length ? agent.missions.map((mission) => <div className="admin-mission" key={mission.enrollmentId}><span>{mission.sessionName}</span><strong>{mission.displayAgentNumber} // {mission.completionStatus}</strong></div>) : <p className="directory-empty-history">尚無任務紀錄</p>}{isOwner && onDelete && <div className="agent-danger"><ShieldAlert /><strong>OWNER DANGER ZONE</strong><p>永久刪除不會自動補 Agent 序號。</p><button className="button button--danger" type="button" onClick={onDelete}>永久刪除此 Agent</button></div>}</>
}
