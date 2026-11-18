
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { InstallPrompt } from './InstallPrompt'

const NHAN_VAI_TRO = {
  quan_tri: 'Quản trị hệ thống',
  chu_tro: 'Chủ trọ',
  quan_ly: 'Quản lý',
  nguoi_thue: 'Người thuê',
} as const

export function AppLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold leading-tight">
            {user?.hoTen}
          </p>
          <p className="text-xs text-gray-500">
            {user && NHAN_VAI_TRO[user.vaiTro]}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.vaiTro === 'nguoi_thue' && (
            <Link
              to="/issues"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 text-sm"
            >
              Báo cáo sự cố
            </Link>
          )}

          {user && ['chu_tro', 'quan_ly', 'quan_tri'].includes(user.vaiTro) && (
            <Link
              to="/issue-management"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 text-sm"
            >
              Quản lý sự cố
            </Link>
          )}

          <InstallPrompt />

          <button
            onClick={signOut}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
