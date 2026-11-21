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
  // Menu chỉ mở khi đường dẫn lúc mở trùng đường dẫn hiện tại, nên tự đóng khi chuyển trang (kể cả nút Back).
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const menuOpen = menuPath === pathname
  const setMenuOpen = (open: boolean) => setMenuPath(open ? pathname : null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuPath(null) }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    closeButton.current?.focus()
    const button = menuButton.current
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      button?.focus()
    }
  }, [menuOpen])
  const staff = user?.vaiTro !== 'nguoi_thue'
  const admin = user?.vaiTro === 'chu_tro' || user?.vaiTro === 'quan_tri'
  const links = [['/', 'Tổng quan'], ...(staff ? [['/khu-phong', 'Khu & phòng']] : []), ['/hop-dong', 'Hợp đồng'], ['/billing', 'Hóa đơn & thanh toán'], ...(admin ? [['/nguoi-thue', 'Người thuê'], ['/nhan-su', 'Nhân sự'], ['/phan-cong', 'Phân công']] : []), [staff ? '/issue-management' : '/issues', 'Sự cố']]
  const drawerLinkClass = (active: boolean) => `flex min-h-11 items-center rounded-lg px-4 py-3 text-base ${active ? 'bg-emerald-900 font-medium text-white' : 'text-gray-800 hover:bg-emerald-50'}`

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-white px-4 py-3 shadow-sm">
        <button
          ref={menuButton}
          type="button"
          aria-label="Mở menu"
          aria-expanded={menuOpen}
          aria-controls="menu-chinh"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <span aria-hidden="true" className="h-0.5 w-5 rounded bg-emerald-900" />
          <span aria-hidden="true" className="h-0.5 w-5 rounded bg-emerald-900" />
          <span aria-hidden="true" className="h-0.5 w-5 rounded bg-emerald-900" />
        </button>
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{user?.hoTen}</p>
          <p className="text-xs text-gray-500">{user && NHAN_VAI_TRO[user.vaiTro]}</p>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={() => setMenuOpen(false)} />
          <aside
            id="menu-chinh"
            role="dialog"
            aria-modal="true"
            aria-label="Menu chính"
            className="drawer-in absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight">{user?.hoTen}</p>
                <p className="text-xs text-gray-500">{user && NHAN_VAI_TRO[user.vaiTro]}</p>
              </div>
              <button
                ref={closeButton}
                type="button"
                aria-label="Đóng menu"
                onClick={() => setMenuOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-xl leading-none hover:bg-gray-50"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <nav aria-label="Điều hướng chính" className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {links.map(([to, label]) => {
                const active = to === '/' ? pathname === to : pathname.startsWith(to)
                return <Link key={to} to={to} aria-current={active ? 'page' : undefined} className={drawerLinkClass(active)}>{label}</Link>
              })}
              <div className="my-3 border-t" role="separator" />
              <Link to="/thong_bao" aria-current={pathname === '/thong_bao' ? 'page' : undefined} className={drawerLinkClass(pathname === '/thong_bao')}>Thông báo</Link>
              <Link to="/tai-khoan" aria-current={pathname === '/tai-khoan' ? 'page' : undefined} className={drawerLinkClass(pathname === '/tai-khoan')}>Tài khoản</Link>
            </nav>

            <div className="space-y-2 border-t px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <InstallPrompt />
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setLogoutError(''); logoutDialog.current?.showModal() }}
                className="min-h-11 w-full rounded-lg border px-4 py-2 text-base"
              >
                Đăng xuất
              </button>
            </div>
          </aside>
        </div>
      )}
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
