import { supabase } from '../services/supabase'
import { ContractExpiryNotice } from '../features/contracts/ContractExpiryNotice'

import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { InstallPrompt } from './InstallPrompt'
import { MeterReviewNotice } from '../features/billing/MeterReviewNotice'

const NHAN_VAI_TRO = {
  quan_tri: 'Quản trị hệ thống',
  chu_tro: 'Chủ trọ',
  quan_ly: 'Quản lý',
  nguoi_thue: 'Người thuê',
} as const

export function AppLayout({ wide = false }: { wide?: boolean }) {
  const { user, signOut } = useAuth()
  useEffect(() => {
    if (user?.vaiTro !== 'nguoi_thue') return
    const check = () => { if (navigator.onLine) void supabase.rpc('nhac_cong_to_cua_toi') }
    check(); const timer = setInterval(check, 15 * 60 * 1000)
    window.addEventListener('focus', check)
    return () => { clearInterval(timer); window.removeEventListener('focus', check) }
  }, [user?.id, user?.vaiTro])
  const logoutDialog = useRef<HTMLDialogElement>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  async function confirmLogout() {
    if (signingOut) return
    setSigningOut(true)
    setLogoutError('')
    try {
      await signOut()
      logoutDialog.current?.close()
    } catch {
      setLogoutError('Không thể đăng xuất. Vui lòng thử lại.')
    } finally {
      setSigningOut(false)
    }
  }
  const { pathname } = useLocation()
  const staff = user?.vaiTro !== 'nguoi_thue'
  const admin = user?.vaiTro === 'chu_tro' || user?.vaiTro === 'quan_tri'
  const links = [['/', 'Tổng quan'], ...(staff ? [['/khu-phong', 'Khu & phòng']] : []), ['/hop-dong', 'Hợp đồng'], ['/billing', 'Hóa đơn & thanh toán'], ...(admin ? [['/nguoi-thue', 'Người thuê'], ['/nhan-su', 'Nhân sự'], ['/phan-cong', 'Phân công']] : []), [staff ? '/issue-management' : '/issues', 'Sự cố']]
  const billingLinkClass = (active: boolean) => `rounded-lg border px-3 py-2 text-sm whitespace-nowrap ${active ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold leading-tight">
            {user?.hoTen}
          </p>
          <p className="text-xs text-gray-500">
            {user && NHAN_VAI_TRO[user.vaiTro]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/thong_bao" className={billingLinkClass(pathname === '/thong_bao')}>Thông báo</Link>
          <Link to="/tai-khoan" className={billingLinkClass(pathname === '/tai-khoan')}>Tài khoản</Link>

          <InstallPrompt />

          <button
            onClick={() => { setLogoutError(''); logoutDialog.current?.showModal() }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            Đăng xuất
          </button>
        </div>
      </header>
      <nav aria-label="Điều hướng chính" className="flex gap-2 overflow-x-auto border-b bg-white px-4 py-3">{links.map(([to, label]) => <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined} className={billingLinkClass(to === '/' ? pathname === to : pathname.startsWith(to))}>{label}</Link>)}</nav>
      <dialog ref={logoutDialog} aria-labelledby="logout-title" aria-describedby="logout-description"
        className="m-auto w-[calc(100%-32px)] max-w-sm rounded-2xl border-0 bg-white p-6 text-gray-900 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onCancel={event => { if (signingOut) event.preventDefault() }}
        onClick={event => { if (!signingOut && event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect()
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) logoutDialog.current?.close()
        } }}>
        <h2 id="logout-title" className="text-lg font-semibold">Xác nhận đăng xuất</h2>
        <p id="logout-description" className="mt-2 text-sm text-gray-600">Bạn có chắc muốn đăng xuất khỏi tài khoản?</p>
        {logoutError && <p role="alert" className="mt-3 text-sm text-red-700">{logoutError}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button autoFocus type="button" disabled={signingOut} onClick={() => logoutDialog.current?.close()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50">Hủy</button>
          <button type="button" disabled={signingOut} onClick={confirmLogout} className="rounded-lg bg-emerald-900 px-4 py-2 text-sm text-white disabled:opacity-50">{signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
        </div>
      </dialog>

      <div className={wide ? 'max-w-6xl mx-auto' : 'p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto'}>
        {user?.vaiTro === 'nguoi_thue' && <MeterReviewNotice userId={user.id} />}
        {user?.vaiTro === 'nguoi_thue' && <ContractExpiryNotice userId={user.id} />}
        <Outlet />
      </div>
    </div>
  )
}
