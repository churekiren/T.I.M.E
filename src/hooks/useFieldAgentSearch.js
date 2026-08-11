import { useEffect, useState } from 'react'
import { agentRepository } from '../repositories'

export function useFieldAgentSearch(query, sessionId) {
  const [state, setState] = useState({ results: [], loading: false, error: '' })
  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 2) { setState({ results: [], loading: false, error: '' }); return }
    let active = true
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, loading: true, error: '' }))
      agentRepository.fieldSearch(normalized, sessionId)
        .then((results) => { if (active) setState({ results, loading: false, error: '' }) })
        .catch((error) => { if (active) setState({ results: [], loading: false, error: error.message }) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [query, sessionId])
  return state
}
