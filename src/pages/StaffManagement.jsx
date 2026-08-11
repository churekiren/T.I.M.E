import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { SectionHead } from '../components/Layout'
import { StaffSessionBar } from '../components/StaffSessionBar'
import { staffRepository } from '../repositories'

export function StaffManagement() {
  const [staff, setStaff] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('STAFF')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { setStaff(await staffRepository.list()); setMessage('') } catch (error) { setMessage(error.message) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const invite = async (event) => { event.preventDefault(); try { await staffRepository.invite(email, role); setEmail(''); setMessage('邀請已送出；對方需由 Email 自行設定密碼。'); await load() } catch (error) { setMessage(error.message) } }
  const update = async (member, changes) => { try { await staffRepository.updateAccess(member.user_id, changes.role ?? member.role, changes.active ?? member.active); await load() } catch (error) { setMessage(error.message) } }
  return <><StaffSessionBar label="BUREAU ADMINISTRATION" /><SectionHead eyebrow="OWNER CLEARANCE // STAFF MANAGEMENT" title="工作人員權限管理">查看角色、停用狀態與登入紀錄。局方不會顯示或保存任何人的密碼。</SectionHead>
    <form className="staff-invite" onSubmit={invite}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="STAFF">STAFF</option><option value="ADMIN">ADMIN</option><option value="OWNER">OWNER</option></select></label><button className="button"><UserPlus size={16} />邀請工作人員</button></form>
    {message && <p className="admin-message">{message}</p>}<section className="staff-directory">{loading ? <p>正在讀取工作人員名冊……</p> : staff.map((member) => <article key={member.user_id}><div><strong>{member.display_name || member.email}</strong><span>{member.email}</span><small>LAST LOGIN // {member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleString('zh-TW') : '尚未登入'}</small></div><select value={member.role} disabled={member.role === 'OWNER'} onChange={(event) => update(member, { role: event.target.value })}><option>OWNER</option><option>ADMIN</option><option>STAFF</option></select><button className="button button--ghost" disabled={member.role === 'OWNER'} onClick={() => update(member, { active: !member.active })}>{member.active ? '停用' : '重新啟用'}</button></article>)}</section></>
}
