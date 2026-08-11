import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function QrCode({ value, label, downloadable = false }) {
  const [src, setSrc] = useState('')
  useEffect(() => { let active = true; QRCode.toDataURL(value, { width: 440, margin: 2, color: { dark: '#161712', light: '#f2efe5' }, errorCorrectionLevel: 'M' }).then((data) => active && setSrc(data)); return () => { active = false } }, [value])
  if (!src) return <div className="qr-loading">GENERATING QR…</div>
  return <div className="qr-code"><img src={src} alt={`${label} QR Code`} />{downloadable && <a className="text-link" href={src} download={`${label}.png`}>下載 QR PNG</a>}</div>
}
