import { BadgePlus, MonitorUp, Search, MoveDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { assetUrl } from '../utils/basePath'

const entries = [
  { to: '/register', no: '01', icon: BadgePlus, zh: '首次入局登錄', en: 'NEW AGENT REGISTRATION' },
  { to: '/wall', no: '02', icon: MonitorUp, zh: '探員識別牆', en: 'IDENTIFICATION WALL' },
  { to: '/agents', no: '03', icon: Search, zh: '探員檔案查詢', en: 'ARCHIVE SEARCH' },
]

export function Home() {
  return <div className="home">
    <div className="dial dial--one" /><div className="dial dial--two" />
    <section className="hero">
      <div className="classification">RESTRICTED ACCESS <span>// NODE TW-07</span></div>
      <img className="hero-emblem" src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 時界異常事件處理局正式局徽" />
      <p className="hero-official-name">TEMPORAL &amp; INTERDIMENSIONAL MANAGEMENT OF EMERGENCIES</p>
      <p className="hero-copy">探員身分驗證暨個人識別徽章管理終端</p>
      <div className="timecode"><span>LOCAL TEMPORAL INDEX</span><strong>{new Date().toLocaleDateString('zh-TW')}</strong></div>
      <MoveDown className="hero-down" />
    </section>
    <section className="entry-section">
      <div className="entry-label"><span>SYSTEM DIRECTORY</span><span>選擇授權程序</span></div>
      <div className="entry-grid">{entries.map(({ to, no, icon: Icon, zh, en }) => <Link className="entry-card" to={to} key={to}>
        <span className="entry-no">{no}</span><Icon /><div><strong>{zh}</strong><small>{en}</small></div><span className="entry-arrow">↗</span>
      </Link>)}</div>
    </section>
  </div>
}
