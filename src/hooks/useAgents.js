import { useEffect, useState } from 'react'
import { agentStore } from '../data/agentStore'
import { enrollmentStore } from '../data/enrollmentStore'
import { sessionStore } from '../data/sessionStore'
import { agentRegistry } from '../services/agentRegistry'
import { accessTokenStore } from '../data/accessTokenStore'

export function useAgents() {
  agentRegistry.initialize()
  const [agents, setAgents] = useState(() => agentStore.getAll())
  useEffect(() => agentStore.subscribe(() => setAgents(agentStore.getAll())), [])
  return agents
}

export function useRegistryData() {
  agentRegistry.initialize()
  const load = () => ({ agents: agentStore.getAll(), sessions: sessionStore.getAll(), enrollments: enrollmentStore.getAll(), tokens: accessTokenStore.getAll(), roster: agentRegistry.getRoster() })
  const [data, setData] = useState(load)
  useEffect(() => enrollmentStore.subscribe(() => setData(load())), [])
  return data
}
