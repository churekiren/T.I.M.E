import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { campConfig } from '../config/campConfig'
import { sessionRepository, wallRepository } from '../repositories'

export function Wall() {
  const [params] = useSearchParams(); const sessionId = params.get('session') || campConfig.currentSessionId
  const [sessionName, setSessionName] = useState(sessionId === campConfig.currentSessionId ? campConfig.currentSessionName : sessionId); const [agents, setAgents] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [arrival, setArrival] = useState(null); const knownIds = useRef(new Set())
  const load = useCallback(async (announce = false) => { try { const entries = await wallRepository.getBySession(sessionId); const visibleEntries = entries.filter((entry) => entry.emblem); if (announce) { const added = visibleEntries.find((entry) => !knownIds.current.has(entry.enrollmentId)); if (added) { setArrival(added); setTimeout(() => setArrival(null), 2800) } } knownIds.current = new Set(visibleEntries.map((entry) => entry.enrollmentId)); setAgents(visibleEntries); const session = await sessionRepository.getById(sessionId).catch(() => null); if (session?.name) setSessionName(session.name); setError('') } catch (loadError) { setError(loadError.message) } finally { setLoading(false) } }, [sessionId])
  useEffect(() => { void load(false); return wallRepository.subscribe(sessionId, () => { void load(true) }) }, [load, sessionId])
  return <div className="wall"><div className="wall-gridlines" /><header className="wall-head"><Brand compact /><div><h1>探員識別登錄牆</h1><p>{sessionName} // AGENT IDENTIFICATION ARCHIVE</p></div><span className="live"><i /> LIVE ARCHIVE</span></header>
    <main className="wall-content">{error ? <div className="waiting"><h2>ARCHIVE CONNECTION INTERRUPTED</h2><p>{error}</p><button className="button" onClick={() => load(false)}>重新連線</button></div> : agents.length ? <div className="agent-grid">{agents.map((agent, index) => <article className="agent-card" key={agent.enrollmentId} style={{ '--delay': `${index * 45}ms` }}><div className="emblem-frame"><img src={agent.emblem} alt={`${agent.codename} 徽章`} /></div><span>{agent.displayAgentNumber}</span><strong>{agent.codename}</strong>{agent.returningAgent ? <b className="returning-badge">RETURNING AGENT // 回歸探員</b> : <small>IDENTITY VERIFIED</small>}</article>)}</div> : <div className="waiting"><div className="radar"><i /></div><h2>{loading ? 'CONNECTING TO CENTRAL ARCHIVE' : 'WAITING FOR AGENT REGISTRATION'}</h2><p>{loading ? '正在讀取本梯次探員資料……' : '等待本梯次探員登錄……'}</p></div>}</main>
    <footer className="wall-footer"><span>TEMPORAL NODE // TW-07</span><span>{sessionName} // {String(agents.length).padStart(3, '0')}</span></footer>
    {arrival && <div className="arrival"><div className="arrival-ring"><img src={arrival.emblem} alt="" /></div><span>ACCESS GRANTED</span><h2>{arrival.returningAgent ? 'RETURNING AGENT VERIFIED' : 'NEW AGENT REGISTERED'}</h2><strong>{arrival.displayAgentNumber} / {arrival.codename}</strong>{arrival.returningAgent && <p>WELCOME BACK, AGENT {arrival.codename}.</p>}</div>}
  </div>
}
