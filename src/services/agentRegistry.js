import { campConfig } from '../config/campConfig'
import { accessTokenStore } from '../data/accessTokenStore'
import { agentStore } from '../data/agentStore'
import { enrollmentStore } from '../data/enrollmentStore'
import { migrateLegacyData } from '../data/migration'
import { sessionStore } from '../data/sessionStore'

function ready() { sessionStore.getAll(); migrateLegacyData() }

export const agentRegistry = {
  initialize: ready,
  registerNew({ codename, emblem }) { ready(); const agent = agentStore.create({ codename, emblem }); const enrollment = enrollmentStore.create({ agentId: agent.id, sessionId: campConfig.currentSessionId }); return { agent, enrollment, session: sessionStore.getCurrent() } },
  registerWithToken({ token, codename, emblem }) {
    ready(); const access = accessTokenStore.getByToken(token)
    if (!access || access.status !== 'UNUSED') throw new Error('此登錄憑證無效或已經使用。')
    const agent = agentStore.create({ codename, emblem })
    let enrollment
    try {
      enrollment = enrollmentStore.create({ agentId: agent.id, sessionId: access.sessionId })
      const usedToken = accessTokenStore.markUsed(token, { agentId: agent.id, enrollmentId: enrollment.id })
      return { agent, enrollment, session: sessionStore.getById(access.sessionId), accessToken: usedToken }
    } catch (error) {
      if (enrollment) enrollmentStore.remove(enrollment.id)
      agentStore.remove(agent.id)
      throw error
    }
  },
  registerReturning(agentId, sessionId = campConfig.currentSessionId) { ready(); const agent = agentStore.getById(agentId); if (!agent) throw new Error('找不到探員檔案。'); if (enrollmentStore.exists(agentId, sessionId)) return { agent, enrollment: enrollmentStore.getByAgent(agentId).find((e) => e.sessionId === sessionId), session: sessionStore.getById(sessionId), alreadyEnrolled: true }; const enrollment = enrollmentStore.create({ agentId, sessionId, returningAgent: true }); return { agent, enrollment, session: sessionStore.getById(sessionId), alreadyEnrolled: false } },
  getRoster(sessionId = campConfig.currentSessionId) { ready(); return enrollmentStore.getBySession(sessionId).map((enrollment) => ({ enrollment, agent: agentStore.getById(enrollment.agentId), session: sessionStore.getById(enrollment.sessionId) })).filter((item) => item.agent) },
  getAgentFile(idOrToken) { ready(); const agent = agentStore.getById(idOrToken) || agentStore.getByAccessToken(idOrToken); if (!agent) return null; const missions = enrollmentStore.getByAgent(agent.id).map((enrollment) => ({ enrollment, session: sessionStore.getById(enrollment.sessionId) })).sort((a, b) => new Date(a.enrollment.joinedAt) - new Date(b.enrollment.joinedAt)); return { agent, missions } },
}
