import { useCallback, useEffect, useRef, useState } from 'react'

export function useAsyncResource(loader, dependencies) {
  const loaderRef = useRef(loader)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ data: null, loading: true, error: null })
  loaderRef.current = loader

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))
    Promise.resolve()
      .then(() => loaderRef.current())
      .then((data) => { if (active) setState({ data, loading: false, error: null }) })
      .catch((error) => { if (active) setState({ data: null, loading: false, error }) })
    return () => { active = false }
  }, [...dependencies, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { ...state, retry }
}
