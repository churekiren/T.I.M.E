import { useMemo, useState } from 'react'
import { Search, ArrowUpRight, BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionHead } from '../components/Layout'
import { useAgents } from '../hooks/useAgents'
import { EmblemPlaceholder } from '../components/EmblemPlaceholder'

export function Agents() {
  const agents = useAgents(); const [query, setQuery] = useState('')
  const results = useMemo(() => { const q = query.trim().toUpperCase(); return q ? agents.filter((a) => a.id.includes(q) || a.codename.includes(q) || a.accessToken?.includes(q)) : [] }, [agents, query])
  return <><SectionHead eyebrow="ARCHIVE QUERY // TERMINAL Q-02" title="探員檔案查詢">輸入永久 Agent ID、英文代號或存取代碼，開啟永久探員檔案。</SectionHead>
    <div className="search-box"><Search /><input value={query} onChange={(e) => setQuery(e.target.value.toUpperCase())} placeholder="搜尋 AGENT-000042、NOVA 或 access token" autoFocus /><kbd>SEARCH</kbd></div>
    <div className="result-meta"><span>ARCHIVE RESULTS</span><strong>{String(results.length).padStart(2, '0')} 筆</strong></div>
    <div className="result-list">{results.map((a) => <Link to={`/agent/${a.id}`} className="result-card" key={a.id}><div className="result-emblem">{a.emblem ? <img src={a.emblem} alt="" /> : <EmblemPlaceholder />}</div><div><span>{a.id}</span><strong>{a.codename}</strong><small>FIRST REGISTERED // {new Date(a.firstRegisteredAt).getFullYear()}</small></div><BadgeCheck className={a.emblem ? 'verified' : ''} /><ArrowUpRight /></Link>)}</div>
    {!results.length && <div className="empty-results">{query ? 'NO MATCHING RECORDS // 查無符合資料' : '請輸入探員識別資料開始查詢'}</div>}</>
}
