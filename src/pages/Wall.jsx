import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { enrollmentStore } from '../data/enrollmentStore'
import { sessionStore } from '../data/sessionStore'
import { agentRegistry } from '../services/agentRegistry'
import { useRegistryData } from '../hooks/useAgents'
import { accessTokenStore } from '../data/accessTokenStore'

export function Wall() {
  useRegistryData(); const [params] = useSearchParams(); const access = accessTokenStore.getByToken(params.get('access') || ''); const requestedSession = params.get('session'); const authorizedSession = access?.status === 'USED' && access.sessionId === requestedSession ? requestedSession : null; const session = sessionStore.getById(authorizedSession) || sessionStore.getCurrent(); const agents = agentRegistry.getRoster(session.id).filter((item) => item.agent.emblem)
  const [arrival, setArrival] = useState(null)
  useEffect(() => enrollmentStore.subscribe((event) => { if (event?.type !== 'enrollment-created' || event.enrollment?.sessionId !== session.id) return; const found = agentRegistry.getRoster(session.id).find((item) => item.enrollment.id === event.enrollment.id); if (found) { setArrival(found); setTimeout(() => setArrival(null), 2800) } }), [session.id])
  return <div className="wall"><div className="wall-gridlines" /><header className="wall-head"><Brand compact /><div><h1>探員識別登錄牆</h1><p>{session.name} // AGENT IDENTIFICATION ARCHIVE</p></div><span className="live"><i /> LIVE ARCHIVE</span></header>
    <main className="wall-content">{agents.length ? <div className="agent-grid">{agents.map(({ agent, enrollment }, i) => <article className="agent-card" key={enrollment.id} style={{ '--delay': `${i * 45}ms` }}><div className="emblem-frame"><img src={agent.emblem} alt={`${agent.codename} 徽章`} /></div><span>{enrollment.displayAgentNumber}</span><strong>{agent.codename}</strong>{enrollment.returningAgent ? <b className="returning-badge">RETURNING AGENT // 回歸探員</b> : <small>IDENTITY VERIFIED</small>}</article>)}</div> : <div className="waiting"><div className="radar"><i /></div><h2>WAITING FOR AGENT REGISTRATION</h2><p>等待本梯次探員登錄……</p></div>}</main>
    <footer className="wall-footer"><span>TEMPORAL NODE // TW-07</span><span>{session.name} // {String(agents.length).padStart(3, '0')}</span></footer>
    {arrival && <div className="arrival"><div className="arrival-ring"><img src={arrival.agent.emblem} alt="" /></div><span>ACCESS GRANTED</span><h2>{arrival.enrollment.returningAgent ? 'RETURNING AGENT VERIFIED' : 'NEW AGENT REGISTERED'}</h2><strong>{arrival.enrollment.displayAgentNumber} / {arrival.agent.codename}</strong>{arrival.enrollment.returningAgent && <p>WELCOME BACK, AGENT {arrival.agent.codename}.</p>}</div>}
  </div>
}
