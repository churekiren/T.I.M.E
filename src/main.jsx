import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './styles/token.css'
import './styles/passkey.css'
import './styles/staff-security.css'
import { centralRegistry } from './services/centralRegistry'
import { StaffAuthProvider } from './auth/StaffAuthContext'

void centralRegistry
createRoot(document.getElementById('root')).render(<StrictMode><StaffAuthProvider><App /></StaffAuthProvider></StrictMode>)
