import { useState } from 'react'
import { BadgePlus, KeyRound, Pencil, QrCode, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionHead } from '../components/Layout'
import { StaffSessionBar } from '../components/StaffSessionBar'
import { EmblemPlaceholder } from '../components/EmblemPlaceholder'
import { campConfig } from '../config/campConfig'
import { useFieldAgentSearch } from '../hooks/useFieldAgentSearch'

const operations = [
  [Search, '找探員', '依 Codename、T-xxx、永久 Agent ID 或 REG 編號查找。'],
  [ShieldCheck, '既有探員歸隊', '確認永久身分，加入目前任務梯次。'],
  [QrCode, '產生／補發 QR', '紙本損壞或遺失時，撤銷舊憑證並補發唯讀入口。'],
  [BadgePlus, '重新開放徽章一次', '建立 20 分鐘有效、使用後立即失效的拍攝權限。'],
  [Pencil, '修正 Codename', '只處理現場輸入錯誤，系統保留修改紀錄。'],
  [KeyRound, '修正本梯資料', '處理目前梯次的 Enrollment 例外，不刪除永久探員。'],
]

export function Staff() {
  const [query, setQuery] = useState(''); const search = useFieldAgentSearch(query, campConfig.currentSessionId)
  return <><StaffSessionBar label="FIELD OPERATIONS CONSOLE" /><SectionHead eyebrow="FIELD OPERATIONS // CURRENT MISSION" title="現場任務作業台">先找回探員狀態，再選擇需要處理的現場問題。</SectionHead><div className="search-box"><Search /><input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="搜尋 Codename、T-xxx、Agent ID 或 REG-xxxx" /><kbd>FIELD</kbd></div>{search.error && <p className="admin-message">{search.error}</p>}<div className="result-list">{search.results.map((agent) => <article className="result-card" key={agent.id}><div className="result-emblem">{agent.emblem ? <img src={agent.emblem} alt="" /> : <EmblemPlaceholder />}</div><div><span>{agent.id}</span><strong>{agent.codename}</strong><small>{agent.currentEnrollment ? `${agent.currentEnrollment.displayAgentNumber} // ${agent.currentEnrollment.completionStatus}` : '尚未加入目前梯次'} // 徽章{agent.emblemPath ? '已完成' : '未完成'}</small></div></article>)}</div><div className="field-operation-grid">{operations.map(([Icon,title,description]) => <button type="button" className="field-operation" key={title}><Icon /><strong>{title}</strong><span>{description}</span></button>)}</div><Link className="button button--ghost" to="/wall">查看目前 Session Wall</Link></>
}
