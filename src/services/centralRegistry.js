import { accessTokenRepository, emblemRepository } from '../repositories'
import { normalizeRpcAgent, normalizeRpcEnrollment, runQuery } from '../repositories/repositoryCore'

const RETRY_DELAYS = [0, 300]
const registrationFlights = new Map()

function isTimeout(error) {
  return error?.code === 'REQUEST_TIMEOUT' || error?.cause?.name === 'AbortError'
}

async function retry(operation) {
  let lastError
  for (const delay of RETRY_DELAYS) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    try { return await operation() } catch (error) { lastError = error; if (isTimeout(error)) break }
  }
  throw lastError
}

async function cleanup(paths) {
  try {
    await retry(() => emblemRepository.remove(paths))
    return true
  } catch {
    return false
  }
}

function createTimingDiagnostics(emblemProcessingMs = 0, onTiming) {
  const startedAt = performance.now()
  const timings = { 'emblem processing': Math.round(emblemProcessingMs || 0) }
  return {
    timings,
    async measure(label, operation) {
      const started = performance.now()
      try { return await operation() }
      finally {
        timings[label] = Math.round(performance.now() - started)
        onTiming?.({ ...timings })
        if (import.meta.env.DEV) console.info(`[T.I.M.E. registration] ${label}: ${timings[label]}ms`)
      }
    },
    finish() {
      timings['total registration time'] = Math.round(performance.now() - startedAt)
      onTiming?.({ ...timings })
      if (import.meta.env.DEV) console.table(timings)
      return timings
    },
  }
}

export const centralRegistry = {
  inspectAccess: (rawToken) => accessTokenRepository.inspect(rawToken),
  registerNew(parameters) {
    const existing = registrationFlights.get(parameters.rawToken)
    if (existing) return existing
    const flight = this.commitNewRegistration(parameters).finally(() => registrationFlights.delete(parameters.rawToken))
    registrationFlights.set(parameters.rawToken, flight)
    return flight
  },
  async commitNewRegistration({ rawToken, codename, emblem, emblemProcessingMs, onTiming }) {
    let temporaryPath = ''
    let finalPath = ''
    let databaseRegistered = false
    let emblemFinalized = false
    const diagnostics = createTimingDiagnostics(emblemProcessingMs, onTiming)
    try {
      temporaryPath = await diagnostics.measure('prepare upload path', () => emblemRepository.prepareTemporary(rawToken))
      const temporary = await diagnostics.measure('temporary upload', () => emblemRepository.uploadTemporary(temporaryPath, emblem))
      const data = await diagnostics.measure('register_new_agent', () => runQuery((client) => client.rpc('register_new_agent', { p_raw_token: rawToken, p_codename: codename })))
      databaseRegistered = true
      const agent = normalizeRpcAgent(data.agent)
      const enrollment = normalizeRpcEnrollment(data.enrollment)
      finalPath = await diagnostics.measure('final emblem operation', () => retry(() => emblemRepository.uploadFinal(agent.internalId, temporary.blob)))
      await diagnostics.measure('finalize_agent_emblem', () => retry(() => runQuery((client) => client.rpc('finalize_agent_emblem', { p_raw_token: rawToken, p_emblem_path: finalPath }))))
      emblemFinalized = true
      const timings = diagnostics.finish()
      void diagnostics.measure('temporary cleanup', () => cleanup([temporaryPath])).then(() => diagnostics.finish())
      return {
        agent: { ...agent, emblem, emblemPath: finalPath },
        enrollment,
        cleanupPending: true,
        timings,
      }
    } catch (error) {
      const cleanupTargets = emblemFinalized ? [temporaryPath] : [temporaryPath, finalPath]
      void diagnostics.measure('temporary cleanup', () => cleanup(cleanupTargets)).then(() => diagnostics.finish())
      error.registrationTimings = diagnostics.finish()
      if (databaseRegistered && !emblemFinalized) {
        const recoveryError = new Error('探員資料已建立，但徽章封存未完成。請勿重複登錄，並請現場工作人員協助處理。', { cause: error })
        recoveryError.code = 'EMBLEM_FINALIZATION_INCOMPLETE'
        throw recoveryError
      }
      throw error
    }
  },
  async registerReturning(permanentAgentId, sessionId) {
    const data = await runQuery((client) => client.rpc('register_returning_agent', { p_permanent_agent_id: permanentAgentId, p_session_id: sessionId }))
    return { agent: normalizeRpcAgent(data.agent), enrollment: normalizeRpcEnrollment(data.enrollment) }
  },
}
