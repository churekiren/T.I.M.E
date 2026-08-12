import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { useWorkingSession } from '../auth/WorkingSessionContext'
import { AgentDetail } from '../components/AgentDetail'
import { EmblemPlaceholder } from '../components/EmblemPlaceholder'
import { SectionHead } from '../components/Layout'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { agentRepository, emblemRepository, enrollmentRepository, sessionRepository } from '../repositories'

async function loadDirectory(currentSessionId) {
  const [agents, enrollments, sessions] = await Promise.all([
    agentRepository.getAll(),
    enrollmentRepository.getAll(),
    sessionRepository.getAll(),
  ])
  const sessionNames = new Map(sessions.map((session) => [session.id, session.name]))
  const missionsByAgent = new Map()
  enrollments.forEach((enrollment) => {
    const missions = missionsByAgent.get(enrollment.agentInternalId) || []
    missions.push({
      enrollmentId: enrollment.id,
      sessionId: enrollment.sessionId,
      sessionName: sessionNames.get(enrollment.sessionId) || enrollment.sessionId,
      displayAgentNumber: enrollment.displayAgentNumber,
      returningAgent: enrollment.returningAgent,
      completionStatus: enrollment.completionStatus,
      joinedAt: enrollment.joinedAt,
    })
    missionsByAgent.set(enrollment.agentInternalId, missions)
  })
  return agents.map((agent) => {
    const missions = (missionsByAgent.get(agent.internalId) || []).sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
    return { ...agent, missions, currentEnrollment: missions.find((mission) => mission.sessionId === currentSessionId) || null }
  })
}

export function AgentDirectory() {
  const { profile } = useStaffAuth()
  const { sessionId, currentSession } = useWorkingSession()
  const directory = useAsyncResource(() => loadDirectory(sessionId), [sessionId])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const agents = directory.data || []
  const filtered = useMemo(() => {
    const normalized = query.trim().toUpperCase()
    if (!normalized) return agents
    return agents.filter((agent) => agent.codename.includes(normalized) || agent.id.includes(normalized))
  }, [agents, query])
  const selected = agents.find((agent) => agent.internalId === selectedId) || null
  const isOwner = profile.role === 'OWNER'

  const deleteAgent = async () => {
    if (!selected || !isOwner) return
    if (!window.confirm(`永久刪除 ${selected.id} / ${selected.codename}？此操作無法復原。`)) return
    if (!window.confirm(`第二次確認：將刪除 ${selected.missions.length} 筆 Enrollment、撤銷相關憑證並移除徽章。確定繼續？`)) return
    try {
      const result = await agentRepository.deletePermanently(selected.id)
      const prefixes = [result.emblemPath, `agents/${result.agentUuid}`, ...(result.tokenHashes || []).map((hash) => `temporary/${hash}`)]
      await emblemRepository.removeByPrefixes(prefixes)
      setSelectedId('')
      directory.retry()
      setMessage(`${result.permanentAgentId} 已永久刪除；名冊正在重新同步。`)
    } catch (error) { setMessage(`刪除未完整完成：${error.message}`) }
  }

  return <><SectionHead eyebrow="AGENT DIVISION // PERMANENT ARCHIVE" title="探員名冊">瀏覽所有永久 Agent，依徽章、Codename 與永久探員編號確認身分。目前作業梯次：{currentSession.name}。</SectionHead>
    {message && <p className="admin-message">{message}</p>}{directory.error && <p className="admin-message">{directory.error.message}</p>}
    <div className="admin-layout directory-layout"><section className="admin-results"><h2>AGENT DIRECTORY // {directory.loading ? 'READING' : agents.length}</h2><div className="search-box directory-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="搜尋 Codename 或 AGENT-xxxxxx" /><kbd>FILTER</kbd></div><div className="directory-list">{filtered.map((agent) => <article className={`admin-agent ${selectedId === agent.internalId ? 'is-selected' : ''}`} key={agent.internalId} onClick={() => setSelectedId(agent.internalId)}>{agent.emblem ? <img src={agent.emblem} alt={`${agent.codename} 徽章`} /> : <EmblemPlaceholder />}<div><span>{agent.id}</span><strong>{agent.codename}</strong><small>{agent.missions.length} 次任務 // {agent.currentEnrollment ? `${agent.currentEnrollment.displayAgentNumber} ${agent.currentEnrollment.completionStatus}` : '本梯未加入'}</small></div></article>)}</div>{!directory.loading && !filtered.length && <div className="empty-results">NO MATCHING AGENTS // 查無符合探員</div>}</section>
      <aside className="admin-detail"><AgentDetail agent={selected} isOwner={isOwner} onDelete={deleteAgent} /></aside></div>
  </>
}
