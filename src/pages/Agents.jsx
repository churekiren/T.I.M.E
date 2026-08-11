import { useState } from 'react'
import { Search, BadgeCheck } from 'lucide-react'
import { SectionHead } from '../components/Layout'
import { EmblemPlaceholder } from '../components/EmblemPlaceholder'
import { useFieldAgentSearch } from '../hooks/useFieldAgentSearch'
import { useWorkingSession } from '../auth/WorkingSessionContext'

export function Agents() {
  const { sessionId } = useWorkingSession(); const [query, setQuery] = useState(''); const { results, loading, error } = useFieldAgentSearch(query, sessionId)
  return <><SectionHead eyebrow="AUTHORIZED ARCHIVE QUERY // TERMINAL Q-02" title="探員檔案查詢">輸入 Codename、永久 Agent ID、本梯 T-xxx 或 REG 簡短編號。</SectionHead>
    <div className="search-box"><Search /><input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="搜尋 SHEN、T-001、AGENT-000001 或 REG-0002" autoFocus /><kbd>SEARCH</kbd></div>
    <div className="result-meta"><span>ARCHIVE RESULTS</span><strong>{loading ? '讀取中' : `${String(results.length).padStart(2, '0')} 筆`}</strong></div>
    {error && <p className="admin-message">{error}</p>}<div className="result-list">{results.map((agent) => <article className="result-card" key={agent.id}><div className="result-emblem">{agent.emblem ? <img src={agent.emblem} alt="" /> : <EmblemPlaceholder />}</div><div><span>{agent.id}</span><strong>{agent.codename}</strong><small>{agent.currentEnrollment ? `${agent.currentEnrollment.displayAgentNumber} // ${agent.currentEnrollment.completionStatus}` : '尚未加入目前梯次'} // {agent.missions.length} 次任務</small></div><BadgeCheck className={agent.emblem ? 'verified' : ''} /></article>)}</div>
    {!loading && !results.length && <div className="empty-results">{query.length >= 2 ? 'NO MATCHING RECORDS // 查無符合資料' : '請輸入至少兩個字元開始查詢'}</div>}</>
}
