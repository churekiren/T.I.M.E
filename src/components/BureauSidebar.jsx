import { Fingerprint, IdCard, KeyRound, LayoutDashboard, Radio, Search, ShieldCheck, Ticket, UserRoundCheck, Users, Wallpaper } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const sections = [
  { label: '現場控制', en: 'MISSION CONTROL', items: [
    [LayoutDashboard, '控制中心', '/admin'],
    [Radio, 'Waiting Pool', '/admin/operations#waiting-pool'],
    [ShieldCheck, 'Authorization', '/admin/operations#authorization'],
    [Wallpaper, 'Wall', '/wall', true],
  ] },
  { label: '探員管理', en: 'AGENT DIVISION', items: [
    [Search, '探員名冊', '/admin/agents'],
    [UserRoundCheck, '探員回歸', '/admin/agents/returning'],
  ] },
  { label: '任務管理', en: 'MISSION MANAGEMENT', items: [
    [LayoutDashboard, 'Session Management', '/admin/missions#sessions'],
    [Ticket, 'Universal Credential', '/admin/missions#credentials'],
    [IdCard, 'QR Print', '/admin/missions#qr-print'],
    [Search, 'Token Metadata', '/admin/missions#token-metadata'],
  ] },
  { label: '組織管理', en: 'BUREAU MANAGEMENT', items: [
    [Users, '工作人員管理', '/admin/staff'],
  ] },
  { label: '系統', en: 'SYSTEM', items: [
    [Fingerprint, 'Passkey', '/admin/system/passkeys'],
    [KeyRound, '登入密碼', '/staff/activate'],
  ] },
]

export function BureauSidebar({ wallUrl, wallSession }) {
  const location = useLocation()
  const isActive = (target) => {
    const [pathname, hash = ''] = target.split('#')
    return location.pathname === pathname && location.hash === (hash ? `#${hash}` : '')
  }
  return <aside className="bureau-sidebar"><header><strong>T.I.M.E.</strong><span>BUREAU CONSOLE</span></header><nav aria-label="Bureau Console">
    {sections.map((section) => <section key={section.en}><div><span>{section.label}</span><small>{section.en}</small></div>{section.items.map(([Icon, label, to, wall]) => wall
      ? <a href={wallUrl} target="_blank" rel="noreferrer" key={label} aria-disabled={!wallSession?.id} onClick={(event) => { if (!wallSession?.id || !window.confirm(`即將開啟 Mission Wall\n\n${wallSession.name}\n${wallSession.id}\n\n請確認這是現場要顯示的梯次。`)) event.preventDefault() }}><Icon size={15} /><span>{label}</span></a>
      : <Link to={to} key={label} className={isActive(to) ? 'is-active' : ''}><Icon size={15} /><span>{label}</span></Link>)}</section>)}
  </nav></aside>
}
