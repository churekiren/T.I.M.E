import { useCallback, useEffect, useRef, useState } from 'react'
import { accessTokenRepository } from '../repositories'

const MAX_POLLS = 360

export function useRegistrationAccess(rawToken) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const timer = useRef(null); const polls = useRef(0); const active = useRef(true)
  const check = useCallback(async () => {
    if (!rawToken || !active.current) return
    try {
      let access = await accessTokenRepository.inspect(rawToken)
      if (access.state === 'UNASSIGNED') {
        const waiting = await accessTokenRepository.requestWaiting(rawToken)
        if (waiting.state === 'INVALID') access = await accessTokenRepository.inspect(rawToken)
        else access = waiting
      }
      if (!active.current) return
      setState({ data: access, loading: false, error: '' })
      if ((access.state === 'WAITING' || access.state === 'UNASSIGNED') && polls.current < MAX_POLLS) {
        polls.current += 1
        timer.current = setTimeout(() => { if (!document.hidden) void check() }, 5000)
      }
    } catch (error) {
      if (!active.current) return
      setState((current) => ({ ...current, loading: false, error: error.message }))
      if (polls.current < MAX_POLLS) { polls.current += 1; timer.current = setTimeout(() => { if (!document.hidden) void check() }, 10000) }
    }
  }, [rawToken])
  useEffect(() => {
    active.current = true; polls.current = 0; void check()
    const foreground = () => { if (!document.hidden) { clearTimeout(timer.current); void check() } }
    document.addEventListener('visibilitychange', foreground); window.addEventListener('online', foreground)
    return () => { active.current = false; clearTimeout(timer.current); document.removeEventListener('visibilitychange', foreground); window.removeEventListener('online', foreground) }
  }, [check])
  return { ...state, retry: check }
}
