import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, CalendarDays, CheckCircle2, ExternalLink, Pencil, Play, Plus, X } from 'lucide-react'
import { useWorkingSession } from '../auth/WorkingSessionContext'
import { sessionRepository } from '../repositories'

const EMPTY_FORM = { id: '', name: '', startDate: '', endDate: '', status: 'PLANNED' }
const STATUS_ORDER = { PLANNED: 0, ACTIVE: 1, COMPLETE: 2, ARCHIVED: 3 }
const STATUS_LABELS = { PLANNED: '準備中', ACTIVE: '進行中', COMPLETE: '已完成', ARCHIVED: '已封存' }
const NEXT_STATUS = {
  PLANNED: { status: 'ACTIVE', label: '啟動任務', Icon: Play },
  ACTIVE: { status: 'COMPLETE', label: '完成任務', Icon: CheckCircle2 },
  COMPLETE: { status: 'ARCHIVED', label: '封存任務', Icon: Archive },
}

function formatDateRange(session) {
  if (!session.startDate && !session.endDate) return '日期尚未設定'
  if (session.startDate && session.endDate) return `${session.startDate} — ${session.endDate}`
  return session.startDate || session.endDate
}

function openMissionWall(session) {
  if (!window.confirm(`即將開啟 Mission Wall\n\n${session.name}\n${session.id}\n\n請確認這是現場要顯示的梯次。`)) return
  const url = `${import.meta.env.BASE_URL}wall?session=${encodeURIComponent(session.id)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function SessionManagement() {
  const { setSessionId, refresh: refreshWorkingSessions } = useWorkingSession()
  const [sessions, setSessions] = useState([])
  const [mode, setMode] = useState('list')
  const [form, setForm] = useState(EMPTY_FORM)
  const [created, setCreated] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      setSessions(await sessionRepository.getAll())
      setMessage('')
    } catch (error) { setMessage(error.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadSessions() }, [loadSessions])

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => {
    const statusDifference = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    if (statusDifference) return statusDifference
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  }), [sessions])

  const beginCreate = () => { setForm(EMPTY_FORM); setCreated(null); setMessage(''); setMode('create') }
  const beginEdit = (session) => { setForm({ ...session }); setCreated(null); setMessage(''); setMode('edit') }
  const returnToList = () => { setMode('list'); setForm(EMPTY_FORM); setCreated(null); setMessage('') }

  const refreshAll = async () => { await Promise.all([loadSessions(), refreshWorkingSessions()]) }

  const createSession = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true); setMessage('')
    try {
      const result = await sessionRepository.create({ ...form, status: 'PLANNED' })
      setCreated(result)
      await refreshAll()
    } catch (error) { setMessage(error.message) }
    finally { setSubmitting(false) }
  }

  const saveSession = async (event) => {
    event.preventDefault()
    if (submitting || form.status === 'ARCHIVED') return
    setSubmitting(true); setMessage('')
    try {
      const result = await sessionRepository.update(form.id, form)
      setForm(result)
      setMessage('梯次資料已儲存。')
      await refreshAll()
    } catch (error) { setMessage(error.message) }
    finally { setSubmitting(false) }
  }

  const advanceLifecycle = async () => {
    const next = NEXT_STATUS[form.status]
    if (!next || submitting) return
    if (!window.confirm(`任務狀態即將變更：\n${form.status} → ${next.status}\n\n${form.name}\n${form.id}`)) return
    setSubmitting(true); setMessage('')
    try {
      const result = await sessionRepository.update(form.id, { ...form, status: next.status })
      setForm(result)
      setMessage(`任務狀態已更新為 ${next.status}。`)
      await refreshAll()
    } catch (error) { setMessage(error.message) }
    finally { setSubmitting(false) }
  }

  return <section className="session-management" id="sessions">
    <header className="mission-management-head"><div><span>MISSION MANAGEMENT</span><h2>任務生命週期管理</h2><p>建立、啟動、完成與封存各梯次任務。Session ID 建立後永久固定。</p></div>{mode === 'list' ? <button className="button" type="button" onClick={beginCreate}><Plus size={16} />建立新梯次</button> : <button className="button button--ghost" type="button" onClick={returnToList}><X size={16} />返回任務列表</button>}</header>

    {message && <p className="admin-message">{message}</p>}

    {mode === 'list' && <div className="mission-session-list">
      {loading ? <div className="mission-list-empty">READING MISSION ARCHIVE…</div> : sortedSessions.map((session) => <article key={session.id} className={`mission-session-card status-${session.status.toLowerCase()}`}>
        <div><span>{session.id}</span><h3>{session.name}</h3><small><CalendarDays size={13} />{formatDateRange(session)}</small></div>
        <strong>{STATUS_LABELS[session.status] || session.status}<small>{session.status}</small></strong>
        <button className="button button--ghost" type="button" onClick={() => beginEdit(session)}><Pencil size={15} />管理</button>
      </article>)}
      {!loading && !sortedSessions.length && <div className="mission-list-empty">尚未建立任何任務梯次。</div>}
    </div>}

    {mode === 'create' && !created && <form className="mission-session-form" onSubmit={createSession}>
      <div className="mission-form-title"><span>CREATE NEW MISSION</span><h3>建立新梯次</h3><p>新梯次將以 PLANNED 狀態建立。若 Session ID 已存在，系統會拒絕建立，不會覆寫原資料。</p></div>
      <label>梯次名稱<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：2026 夏季第二梯" /></label>
      <label>Session ID<input required value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value.toUpperCase() })} placeholder="例如：2026-SUMMER-02" pattern="[A-Z0-9][A-Z0-9-]{2,39}" /><small>永久識別碼，建立後不可修改。限大寫英數字與連字號。</small></label>
      <div className="mission-date-fields"><label>開始日期<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label><label>結束日期<input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label></div>
      <div className="mission-fixed-status"><span>INITIAL STATUS</span><strong>PLANNED</strong><small>建立後可由任務管理介面正式啟動。</small></div>
      <button className="button" disabled={submitting}>{submitting ? '正在建立任務……' : '建立新梯次'}</button>
    </form>}

    {mode === 'create' && created && <div className="mission-create-success"><CheckCircle2 /><span>MISSION CREATED</span><h3>建立成功</h3><strong>{created.name}</strong><small>{created.id} // {created.status}</small><div><button className="button" type="button" onClick={() => setSessionId(created.id)}>設為我的作業梯次</button><button className="button button--ghost" type="button" onClick={() => openMissionWall(created)}><ExternalLink size={15} />開啟此梯次探員牆</button><button className="text-link" type="button" onClick={returnToList}>稍後處理</button></div></div>}

    {mode === 'edit' && <form className="mission-session-form" onSubmit={saveSession}>
      <div className="mission-form-title"><span>EDIT MISSION</span><h3>編輯梯次</h3><p>正在編輯：{form.name}</p></div>
      <label>梯次名稱<input required disabled={form.status === 'ARCHIVED'} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Session ID<input readOnly value={form.id} /><small>永久識別碼，不能修改。</small></label>
      <div className="mission-date-fields"><label>開始日期<input type="date" disabled={form.status === 'ARCHIVED'} value={form.startDate || ''} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label><label>結束日期<input type="date" disabled={form.status === 'ARCHIVED'} value={form.endDate || ''} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label></div>
      <div className="mission-lifecycle"><span>CURRENT STATUS</span><strong>{form.status}</strong><small>{form.status === 'ARCHIVED' ? '此任務已封存，資料為唯讀。' : '狀態只能依任務生命週期向前推進。'}</small></div>
      <div className="mission-form-actions">{form.status !== 'ARCHIVED' && <button className="button button--ghost" disabled={submitting}>儲存變更</button>}{NEXT_STATUS[form.status] && (() => { const { Icon, label } = NEXT_STATUS[form.status]; return <button className="button" type="button" disabled={submitting} onClick={advanceLifecycle}><Icon size={15} />{label}</button> })()}<button className="button button--ghost" type="button" onClick={() => openMissionWall(form)}><ExternalLink size={15} />開啟 Mission Wall</button></div>
    </form>}
  </section>
}
