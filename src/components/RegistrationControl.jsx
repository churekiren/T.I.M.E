import { useEffect, useState } from 'react'
import { Radio, ShieldCheck, XCircle } from 'lucide-react'
import { accessTokenRepository } from '../repositories'
import { useWorkingSession } from '../auth/WorkingSessionContext'

function duration(seconds) {
  const minutes = Math.floor(seconds / 60)
  return minutes ? `${minutes} 分 ${seconds % 60} 秒` : `${seconds} 秒`
}

export function RegistrationControl() {
  const { currentSession } = useWorkingSession(); const [waiting, setWaiting] = useState([]); const [selected, setSelected] = useState([]); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(true)
  const load = async () => { try { const rows = await accessTokenRepository.getWaitingPool(); setWaiting(rows); setSelected((ids) => ids.filter((id) => rows.some((row) => row.tokenId === id))); setMessage('') } catch (error) { setMessage(error.message) } finally { setLoading(false) } }
  useEffect(() => { void load(); const timer = setInterval(() => { if (!document.hidden) void load() }, 5000); const foreground = () => { if (!document.hidden) void load() }; document.addEventListener('visibilitychange', foreground); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', foreground) } }, [])
  const toggle = (id) => setSelected((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
  const authorize = async () => { if (!selected.length || currentSession.status !== 'ACTIVE') return; if (!window.confirm(`目前作業梯次：${currentSession.name}\n待授權憑證：${selected.length}\n\n開放這批穿梭者身份建檔？`)) return; try { const result = await accessTokenRepository.authorizeWaiting(selected, currentSession.id); setMessage(`${result.authorizedCount} CREDENTIALS AUTHORIZED`); setSelected([]); await load() } catch (error) { setMessage(error.message) } }
  const cancel = async () => { if (!selected.length) return; try { await accessTokenRepository.cancelWaiting(selected); setSelected([]); await load() } catch (error) { setMessage(error.message) } }
  return <section className="registration-control"><header><div><span>REGISTRATION CONTROL</span><h2>入局授權控制</h2><p>未分配憑證無法自動判斷現場；請選取目前場次確認的等待者，再授權至明確梯次。</p></div><Radio /></header><div className="registration-control-status"><span>WAITING<strong>{loading ? '—' : waiting.length}</strong></span><span>CURRENT SESSION<strong>{currentSession.name}</strong><small>{currentSession.status}</small></span></div>{message && <p className="admin-message">{message}</p>}<div className="waiting-actions"><button type="button" onClick={() => setSelected(waiting.map((item) => item.tokenId))}>全選目前畫面</button><button type="button" onClick={() => setSelected([])}>取消選取</button><button className="button button--ghost" type="button" disabled={!selected.length} onClick={cancel}><XCircle size={15} />取消等待</button><button className="button" type="button" disabled={!selected.length || currentSession.status !== 'ACTIVE'} onClick={authorize}><ShieldCheck size={15} />開放 {selected.length || ''} 位身份建檔</button></div><div className="waiting-pool">{waiting.map((item) => <label key={item.tokenId}><input type="checkbox" checked={selected.includes(item.tokenId)} onChange={() => toggle(item.tokenId)} /><strong>{item.shortCode}</strong><span>{new Date(item.requestedAt).toLocaleTimeString('zh-TW')}</span><span>等待 {duration(item.waitingSeconds)}</span><b>AWAITING</b></label>)}</div>{!loading && !waiting.length && <div className="waiting-empty">WAITING POOL CLEAR // 尚無等待中的穿梭者</div>}</section>
}
