import { Printer } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { QrCode } from '../components/QrCode'
import { buildAccessUrl, isLocalOnlyOrigin } from '../utils/accessUrl'
import { readRegistrationPrintBatch } from '../services/registrationPrintCache'

export function QrPrint() {
  const [params] = useSearchParams()
  const tokens = readRegistrationPrintBatch(params.get('batch') || '')
  const localOnlyOrigin = isLocalOnlyOrigin()
  return <main className="qr-print-page"><section className="print-preview-controls"><div><strong>QR 貼紙列印預覽</strong><p>列印時請選擇 100%／實際大小，請勿使用「符合頁面」。</p></div><button className="button" onClick={() => window.print()} disabled={!tokens.length || localOnlyOrigin}><Printer size={17} />列印 QR 貼紙</button></section>
    {localOnlyOrigin && <div className="print-empty qr-origin-warning"><strong>目前使用本機網址開啟列印頁。</strong><span>請改用區域網路 IP 開啟管理端，避免產生手機無法使用的 QR Code。</span></div>}
    {!tokens.length && <div className="print-empty">沒有可列印的 QR 憑證，請返回管理端重新選取。</div>}
    {!localOnlyOrigin && <section className="qr-print-sheet" aria-label="A4 QR 貼紙排版">{tokens.map((access) => <article className="qr-sticker" key={access.id}><QrCode value={buildAccessUrl(access.rawToken)} label={access.shortCode} /><strong>{access.shortCode}</strong></article>)}</section>}
  </main>
}
