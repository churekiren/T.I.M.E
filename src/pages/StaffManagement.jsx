import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { SectionHead } from '../components/Layout'
import { staffRepository } from '../repositories'

export function StaffManagement() {
  const { profile } = useStaffAuth()
  const isOwner = profile.role === 'OWNER'
  const [staff, setStaff] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('STAFF')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try { setStaff(await staffRepository.list()); setMessage('') }
    catch (error) { setMessage(error.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const invite = async (event) => {
    event.preventDefault()
    try {
      await staffRepository.invite(email, isOwner ? role : 'STAFF')
      setEmail(''); setRole('STAFF'); setMessage('邀請已送出；對方需由 Email 自行設定密碼。')
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const toggleAccess = async (member) => {
    if (member.role !== 'STAFF') return
    try { await staffRepository.updateAccess(member.user_id, 'STAFF', !member.active); await load() }
    catch (error) { setMessage(error.message) }
  }

  return <><SectionHead eyebrow={`${profile.role} CLEARANCE // STAFF MANAGEMENT`} title="工作人員權限管理">邀請與管理一般 STAFF；OWNER 與 ADMIN 核心帳號受資料庫保護，不會進入一般變更流程。</SectionHead>
    <form className="staff-invite" onSubmit={invite}>
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="STAFF">STAFF</option>{isOwner && <option value="ADMIN">ADMIN</option>}</select></label>
      <button className="button"><UserPlus size={16} />邀請工作人員</button>
    </form>
    {message && <p className="admin-message">{message}</p>}
    <section className="staff-directory">{loading ? <p>正在讀取工作人員名冊……</p> : staff.map((member) => {
      const manageable = member.role === 'STAFF'
      return <article key={member.user_id}><div><strong>{member.display_name || member.email}</strong><span>{member.email}</span><small>LAST LOGIN // {member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleString('zh-TW') : '尚未登入'}</small></div><span className={`staff-role staff-role--${member.role.toLowerCase()}`}>{member.role}{!manageable && ' // CORE PROTECTED'}</span><button className="button button--ghost" type="button" disabled={!manageable} onClick={() => toggleAccess(member)}>{manageable ? member.active ? '停用' : '重新啟用' : '核心帳號受保護'}</button></article>
    })}</section>
  </>
}
