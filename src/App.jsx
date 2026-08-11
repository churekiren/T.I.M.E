import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Register } from './pages/Register'
import { Upload } from './pages/Upload'
import { Wall } from './pages/Wall'
import { AgentFile } from './pages/AgentFile'
import { Agents } from './pages/Agents'
import { Admin } from './pages/Admin'
import { Access } from './pages/Access'
import { QrPrint } from './pages/QrPrint'
import { Staff } from './pages/Staff'
import { StaffManagement } from './pages/StaffManagement'
import { StaffLogin } from './pages/StaffLogin'
import { StaffGate } from './auth/StaffGate'
import { StaffSessionBar } from './components/StaffSessionBar'
import { WorkingSessionProvider } from './auth/WorkingSessionContext'

function AdminConsole() { return <WorkingSessionProvider><StaffSessionBar label="BUREAU ADMINISTRATION" /><Admin /></WorkingSessionProvider> }
function AppRoutes() { const location = useLocation(); const full = location.pathname === '/wall' || location.pathname === '/admin/qr-print'; return <Layout full={full}><Routes><Route path="/" element={<Home />} /><Route path="/register" element={<Register />} /><Route path="/access/:token" element={<Access />} /><Route path="/upload" element={<Upload />} /><Route path="/wall" element={<Wall />} /><Route path="/agent/:id" element={<AgentFile />} /><Route path="/agents" element={<StaffGate roles={['OWNER','ADMIN','STAFF']}><WorkingSessionProvider><Agents /></WorkingSessionProvider></StaffGate>} /><Route path="/staff/login" element={<StaffLogin />} /><Route path="/staff" element={<StaffGate roles={['OWNER','ADMIN','STAFF']}><WorkingSessionProvider><Staff /></WorkingSessionProvider></StaffGate>} /><Route path="/admin" element={<StaffGate roles={['OWNER','ADMIN']}><AdminConsole /></StaffGate>} /><Route path="/admin/staff" element={<StaffGate roles={['OWNER']}><StaffManagement /></StaffGate>} /><Route path="/admin/qr-print" element={<StaffGate roles={['OWNER','ADMIN']}><QrPrint /></StaffGate>} /><Route path="*" element={<Home />} /></Routes></Layout> }
export default function App() { return <BrowserRouter basename={import.meta.env.BASE_URL}><AppRoutes /></BrowserRouter> }
