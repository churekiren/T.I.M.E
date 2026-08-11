import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Brand } from './Brand'

export function Layout({ children, full = false }) {
  const location = useLocation()
  if (full) return <>{children}</>
  return <div className="app-shell">
    <div className="scanline" />
    <header className="topbar">
      <Link to="/" aria-label="回首頁"><Brand compact /></Link>
      <div className="system-state"><ShieldCheck size={15} /> SECURE NETWORK <span>● ONLINE</span></div>
    </header>
    <main className="page-wrap">
      {location.pathname !== '/' && <Link to="/" className="back-link"><ArrowLeft size={16} /> 返回中央入口</Link>}
      {children}
    </main>
    <footer><span>T.I.M.E. INTERNAL SYSTEM</span><span>LOCAL NODE // {new Date().getFullYear()}</span></footer>
  </div>
}

export function SectionHead({ eyebrow, title, children }) {
  return <header className="section-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>{children && <p>{children}</p>}</header>
}
