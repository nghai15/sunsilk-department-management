import { useAuth } from '../auth/useAuth'
import StaffDashboard from './StaffDashboard'
import TenantDashboard from './TenantDashboard'

export default function DashboardPage() {
  const { user } = useAuth()
  return user?.vaiTro === 'nguoi_thue' ? <TenantDashboard /> : <StaffDashboard />
}