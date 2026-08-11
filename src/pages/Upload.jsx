import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmblemCapture } from '../components/EmblemCapture'
import { SectionHead } from '../components/Layout'
import { useAgents } from '../hooks/useAgents'
import { agentStore } from '../data/agentStore'

export function Upload() {
  const agents = useAgents()
  const [params] = useSearchParams()
  const [selected, setSelected] = useState(params.get('agent') || '')
  const [emblem, setEmblem] = useState({ source: '', cropped: '' })
  const [done, setDone] = useState(null)
  const updateEmblem = useCallback((next) => setEmblem(next), [])
  useEffect(() => { if (!selected && agents[0]) setSelected(agents[0].id) }, [agents, selected])

  const save = () => {
    if (selected && emblem.cropped) setDone(agentStore.setEmblem(selected, emblem.cropped))
  }

  if (done) return <section className="success-panel"><div className="success-mark"><CheckCircle2 /></div><span className="eyebrow">ARCHIVE UPDATED</span><h1>IDENTITY EMBLEM UPDATED</h1><h2>永久個人識別徽章更新完成</h2><img className="success-emblem" src={done.emblem} alt={`${done.codename} 的個人識別徽章`} /><div className="receipt"><span>PERMANENT ID<strong>{done.id}</strong></span><span>CODENAME<strong>{done.codename}</strong></span></div><div className="button-row"><Link className="button" to="/wall">進入本梯次識別牆</Link><Link className="button button--ghost" to={`/agent/${done.id}`}>查看探員檔案</Link></div></section>

  return <><SectionHead eyebrow="STAFF EMBLEM REGISTRATION // FORM E-07" title="工作人員徽章補登">為已建立的探員補登或更換個人識別徽章。</SectionHead>
    <div className="staff-upload"><label><span>選擇探員 <small>ASSIGNED AGENT</small></span><select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">尚無可用探員</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.id} / {agent.codename}</option>)}</select></label>
      {!agents.length && <Link className="text-link" to="/register">請先完成新探員登錄 →</Link>}
      <EmblemCapture value={emblem} onChange={updateEmblem} />
      <button className="button staff-upload-submit" disabled={!selected || !emblem.cropped} onClick={save}>確認補登識別徽章</button>
    </div></>
}
