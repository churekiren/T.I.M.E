import { Outlet } from 'react-router-dom'
import { useWorkingSession } from '../auth/WorkingSessionContext'
import { BureauSidebar } from './BureauSidebar'
import { StaffSessionBar } from './StaffSessionBar'

export function BureauConsoleLayout() {
  const { sessionId, currentSession } = useWorkingSession()
  const wallUrl = `${import.meta.env.BASE_URL}wall?session=${encodeURIComponent(sessionId)}`
  return <div className="bureau-console"><BureauSidebar wallUrl={wallUrl} wallSession={currentSession} /><div className="bureau-console-main"><StaffSessionBar label="BUREAU CONSOLE" /><div className="bureau-console-content"><Outlet /></div></div></div>
}
