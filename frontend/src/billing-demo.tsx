import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DemoBillingPage } from './features/billing/DemoBillingPage'
import './index.css'

createRoot(document.getElementById('root')!).render(<StrictMode><DemoBillingPage /></StrictMode>)
