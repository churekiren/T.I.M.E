import { useNavigate } from 'react-router-dom'
import { SectionHead } from '../components/Layout'
import { PasskeyManager } from '../components/PasskeyManager'

export function PasskeySettings() {
  const navigate = useNavigate()
  return <><SectionHead eyebrow="SYSTEM // PERSONAL AUTHENTICATION" title="Passkey 快速登入">管理目前工作人員帳號的安全驗證裝置。</SectionHead><PasskeyManager onClose={() => navigate('/admin')} /></>
}
