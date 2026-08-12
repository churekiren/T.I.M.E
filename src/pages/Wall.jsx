import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { campConfig } from '../config/campConfig'
import { sessionRepository, wallRepository } from '../repositories'
import { announceArrivalPresentation } from '../services/arrivalPresentation'
import { createWallArrivalQueue } from '../services/wallArrivalQueue'

const ARRIVAL_DURATION_MS = 2800
const ARRIVAL_FALLBACK_MS = ARRIVAL_DURATION_MS + 350

export function Wall() {
  const [params] = useSearchParams()
  const sessionId = params.get('session') || campConfig.currentSessionId
  const [sessionName, setSessionName] = useState(sessionId === campConfig.currentSessionId ? campConfig.currentSessionName : sessionId)
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [arrival, setArrival] = useState(null)
  const mountedRef = useRef(false)
  const refreshRunningRef = useRef(false)
  const refreshPendingRef = useRef(false)
  const announcePendingRef = useRef(false)
  const subscriptionReadyRef = useRef(false)
  const sessionGenerationRef = useRef(0)
  const queueRef = useRef(null)

  if (!queueRef.current) {
    queueRef.current = createWallArrivalQueue({
      onActiveChange: setArrival,
      onPresentationStart: announceArrivalPresentation,
    })
  }

  const requestRefresh = useCallback(async ({ announce = true } = {}) => {
    const generation = sessionGenerationRef.current
    refreshPendingRef.current = true
    announcePendingRef.current ||= announce
    if (refreshRunningRef.current) return

    refreshRunningRef.current = true
    try {
      while (refreshPendingRef.current && mountedRef.current && generation === sessionGenerationRef.current) {
        const shouldAnnounce = announcePendingRef.current
        refreshPendingRef.current = false
        announcePendingRef.current = false

        try {
          const entries = await wallRepository.getBySession(sessionId)
          if (!mountedRef.current || generation !== sessionGenerationRef.current) return
          const visibleEntries = entries.filter((entry) => entry.emblem)

          if (!queueRef.current.isInitialized()) queueRef.current.initialize(visibleEntries)
          else queueRef.current.reconcile(visibleEntries, { announce: shouldAnnounce })

          setAgents(visibleEntries)
          setError('')
        } catch (loadError) {
          if (mountedRef.current && generation === sessionGenerationRef.current) setError(loadError.message)
        } finally {
          if (mountedRef.current && generation === sessionGenerationRef.current) setLoading(false)
        }
      }
    } finally {
      if (generation !== sessionGenerationRef.current) return
      refreshRunningRef.current = false
      if (refreshPendingRef.current && mountedRef.current && generation === sessionGenerationRef.current) void requestRefresh({ announce: announcePendingRef.current })
    }
  }, [sessionId])

  useEffect(() => {
    sessionGenerationRef.current += 1
    const effectGeneration = sessionGenerationRef.current
    mountedRef.current = true
    queueRef.current.reset()
    refreshRunningRef.current = false
    refreshPendingRef.current = false
    announcePendingRef.current = false
    subscriptionReadyRef.current = false
    setAgents([])
    setLoading(true)
    setError('')

    void requestRefresh({ announce: false })
    const unsubscribe = wallRepository.subscribe(
      sessionId,
      () => { void requestRefresh({ announce: true }) },
      (status) => {
        if (status !== 'SUBSCRIBED') return
        if (subscriptionReadyRef.current) void requestRefresh({ announce: true })
        subscriptionReadyRef.current = true
      },
    )

    void sessionRepository.getById(sessionId).then((session) => {
      if (mountedRef.current && effectGeneration === sessionGenerationRef.current && session?.name) setSessionName(session.name)
    }).catch(() => {})

    return () => {
      mountedRef.current = false
      sessionGenerationRef.current += 1
      unsubscribe()
      queueRef.current.reset()
    }
  }, [requestRefresh, sessionId])

  useEffect(() => {
    if (!arrival) return undefined
    const id = arrival.enrollmentId
    const timer = window.setTimeout(() => queueRef.current.complete(id), ARRIVAL_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [arrival])

  const completeArrival = useCallback((event) => {
    if (event.animationName !== 'flashIn' || !arrival) return
    queueRef.current.complete(arrival.enrollmentId)
  }, [arrival])

  return <div className="wall"><div className="wall-gridlines" /><header className="wall-head"><Brand compact /><div><h1>MISSION WALL</h1><p>{sessionName} // AGENT IDENTIFICATION ARCHIVE</p></div><span className="live"><i /> LIVE ARCHIVE</span></header>
    <main className="wall-content">{error ? <div className="waiting"><h2>ARCHIVE CONNECTION INTERRUPTED</h2><p>{error}</p><button className="button" onClick={() => requestRefresh({ announce: false })}>重新連線</button></div> : agents.length ? <div className="agent-grid">{agents.map((agent, index) => <article className="agent-card" key={agent.enrollmentId} style={{ '--delay': `${index * 45}ms` }}><div className="emblem-frame"><img src={agent.emblem} alt={`${agent.codename} 徽章`} /></div><span>{agent.displayAgentNumber}</span><strong>{agent.codename}</strong>{agent.returningAgent ? <b className="returning-badge">RETURNING AGENT // 回歸探員</b> : <small>IDENTITY VERIFIED</small>}</article>)}</div> : <div className="waiting"><div className="radar"><i /></div><h2>{loading ? 'CONNECTING TO CENTRAL ARCHIVE' : 'WAITING FOR AGENT REGISTRATION'}</h2><p>{loading ? '正在讀取本梯次探員資料……' : '等待本梯次探員登錄……'}</p></div>}</main>
    <footer className="wall-footer"><span>TEMPORAL NODE // TW-07</span><span>{sessionName} // {String(agents.length).padStart(3, '0')}</span></footer>
    {arrival && <div className="arrival" key={arrival.enrollmentId} onAnimationEnd={completeArrival}><div className="arrival-ring"><img src={arrival.emblem} alt="" /></div><span>ACCESS GRANTED</span><h2>{arrival.returningAgent ? 'RETURNING AGENT VERIFIED' : 'NEW AGENT REGISTERED'}</h2><strong>{arrival.displayAgentNumber} / {arrival.codename}</strong>{arrival.returningAgent && <p>WELCOME BACK, AGENT {arrival.codename}.</p>}</div>}
  </div>
}
