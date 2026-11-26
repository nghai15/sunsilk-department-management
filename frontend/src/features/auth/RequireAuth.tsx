import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { VaiTro } from '../../types'
import { useAuth } from './useAuth'

export function RequireAuth({ roles }: { roles?: VaiTro[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="p-6 text-center">Đang tải...</div>
  if (!user) return <Navigate to="/dang-nhap" replace state={{ from: location }} />
  if (roles && !roles.includes(user.vaiTro)) return <Navigate to="/khong-co-quyen" replace />
  return <Outlet />
}