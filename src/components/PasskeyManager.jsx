import { useCallback, useEffect, useState } from 'react'
import { Fingerprint, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { useStaffAuth } from '../auth/StaffAuthContext'

function formatTimestamp(value, fallback = '尚未使用') {
  return value ? new Date(value).toLocaleString('zh-TW') : fallback
}

function safePasskeyMessage(error) {
  const name = error?.name || error?.cause?.name || ''
  if (name === 'NotAllowedError' || /cancel|not.?allowed/i.test(error?.message || '')) return 'Passkey 操作已取消；Email 與密碼登入不受影響。'
  return 'Passkey 操作未完成，請稍後再試。Email 與密碼登入不受影響。'
}

export function PasskeyManager({ onClose }) {
  const { listPasskeys, registerPasskey, renamePasskey, deletePasskey } = useStaffAuth()
  const [passkeys, setPasskeys] = useState([])
  const [names, setNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listPasskeys()
      setPasskeys(rows)
      setNames(Object.fromEntries(rows.map((item) => [item.id, item.friendly_name || ''])))
      setMessage('')
    } catch (error) { setMessage(safePasskeyMessage(error)) }
    finally { setLoading(false) }
  }, [listPasskeys])

  useEffect(() => { void load() }, [load])

  const add = async () => {
    if (busy) return
    setBusy('new'); setMessage('')
    try { await registerPasskey(); await load(); setMessage('新的 Passkey 已安全登錄。') }
    catch (error) { setMessage(safePasskeyMessage(error)) }
    finally { setBusy('') }
  }
  const rename = async (item) => {
    const friendlyName = (names[item.id] || '').trim()
    if (!friendlyName || friendlyName === item.friendly_name || busy) return
    setBusy(item.id); setMessage('')
    try { await renamePasskey(item.id, friendlyName); await load(); setMessage('Passkey 名稱已更新。') }
    catch (error) { setMessage(safePasskeyMessage(error)) }
    finally { setBusy('') }
  }
  const remove = async (item) => {
    if (busy || !window.confirm(`確定刪除 Passkey「${item.friendly_name || '未命名裝置'}」？Email 與密碼登入仍會保留。`)) return
    setBusy(item.id); setMessage('')
    try { await deletePasskey(item.id); await load(); setMessage('Passkey 已刪除；Email 與密碼登入仍可使用。') }
    catch (error) { setMessage(safePasskeyMessage(error)) }
    finally { setBusy('') }
  }

  return <section className="passkey-manager" aria-labelledby="passkey-manager-title">
    <header><div><span>PERSONAL AUTHENTICATOR CONTROL</span><h2 id="passkey-manager-title">Passkey 快速登入管理</h2><p>僅管理目前登入帳號自己的 Passkeys。Email 與密碼將永久保留。</p></div><button className="icon-button" type="button" aria-label="關閉 Passkey 管理" onClick={onClose}><X size={18} /></button></header>
    <div className="passkey-manager-actions"><button className="button" type="button" disabled={Boolean(busy)} onClick={add}><Plus size={17} />{busy === 'new' ? '正在啟動系統驗證……' : '新增 Passkey'}</button><small><ShieldCheck size={14} />生物辨識資料只由裝置與驗證器處理，T.I.M.E. 不會保存。</small></div>
    {message && <p className="passkey-message">{message}</p>}
    {loading ? <p className="passkey-empty">正在讀取個人 Passkeys……</p> : passkeys.length === 0 ? <p className="passkey-empty">尚未登錄 Passkey。您仍可繼續使用 Email 與密碼登入。</p> : <div className="passkey-list">{passkeys.map((item) => <article key={item.id}><Fingerprint /><div className="passkey-fields"><label>FRIENDLY NAME<input value={names[item.id] ?? ''} maxLength={120} onChange={(event) => setNames((current) => ({ ...current, [item.id]: event.target.value }))} /></label><span>CREATED // {formatTimestamp(item.created_at)}</span><span>LAST USED // {formatTimestamp(item.last_used_at)}</span></div><div className="passkey-item-actions"><button className="button button--ghost" type="button" disabled={Boolean(busy) || !(names[item.id] || '').trim() || names[item.id].trim() === item.friendly_name} onClick={() => rename(item)}><Pencil size={14} />儲存名稱</button><button className="button button--danger" type="button" disabled={Boolean(busy)} onClick={() => remove(item)}><Trash2 size={14} />刪除</button></div></article>)}</div>}
  </section>
}
