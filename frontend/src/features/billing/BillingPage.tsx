import { useAuth } from '../auth/useAuth'
import TenantInvoicesPage from './TenantInvoicesPage'
import StaffBillingPage from './StaffBillingPage'

export default function BillingPage() {
  const { user } = useAuth()
  return user?.vaiTro === 'nguoi_thue' ? <TenantInvoicesPage /> : <StaffBillingPage />
}
