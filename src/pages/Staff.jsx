import { BadgePlus, KeyRound, Pencil, QrCode, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionHead } from '../components/Layout'
import { StaffSessionBar } from '../components/StaffSessionBar'

const operations = [
  [Search, '找探員', '依 Codename、T-xxx、永久 Agent ID 或 REG 編號查找。'],
  [ShieldCheck, '既有探員歸隊', '確認永久身分，加入目前任務梯次。'],
  [QrCode, '產生／補發 QR', '紙本損壞或遺失時，撤銷舊憑證並補發唯讀入口。'],
  [BadgePlus, '重新開放徽章一次', '建立 20 分鐘有效、使用後立即失效的拍攝權限。'],
  [Pencil, '修正 Codename', '只處理現場輸入錯誤，系統保留修改紀錄。'],
  [KeyRound, '修正本梯資料', '處理目前梯次的 Enrollment 例外，不刪除永久探員。'],
]

export function Staff() {
  return <><StaffSessionBar label="FIELD OPERATIONS CONSOLE" /><SectionHead eyebrow="FIELD OPERATIONS // CURRENT MISSION" title="現場任務作業台">選擇現場發生的狀況。所有修正都會留下局方作業紀錄。</SectionHead><div className="field-operation-grid">{operations.map(([Icon,title,description]) => <button type="button" className="field-operation" key={title}><Icon /><strong>{title}</strong><span>{description}</span></button>)}</div><Link className="button button--ghost" to="/wall">查看目前 Session Wall</Link></>
}
