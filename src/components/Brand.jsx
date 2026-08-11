export function Brand({ compact = false }) {
  return <div className={`brand ${compact ? 'brand--compact' : ''}`}>
    <img src={assetUrl('assets/time-emblem.png')} alt="T.I.M.E. 時界異常事件處理局局徽" />
    <div><strong>T.I.M.E.</strong>{!compact && <><span>時界異常事件處理局</span><small>TEMPORAL ANOMALY MANAGEMENT BUREAU</small></>}</div>
  </div>
}
import { assetUrl } from '../utils/basePath'
