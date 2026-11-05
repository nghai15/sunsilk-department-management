import { Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { InstallPrompt } from './InstallPrompt'

const NHAN_VAI_TRO = {
  quan_tri: 'Quản trị',
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
          <p className="font-semibold leading-tight">{user?.hoTen}</p>
          <p className="text-xs text-gray-500">{user && NHAN_VAI_TRO[user.vaiTro]}</p>
        </div>
        <div className="flex items-center gap-2">
          <InstallPrompt />
          <button onClick={signOut} className="border rounded-lg px-3 py-2 text-sm">
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