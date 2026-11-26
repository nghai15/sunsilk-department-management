import { Link, useLocation } from 'react-router-dom'

export function BillingNavigation() {
  const { pathname } = useLocation()
  const meterActive = pathname === '/billing/chi-so'
  const tabClass = (active: boolean) => `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${active ? 'bg-emerald-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`

  return <nav className="px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-5 flex-wrap" aria-label="Hóa đơn và thanh toán">
    <Link to="/" className="text-sm text-gray-600 hover:underline">← Tổng quan</Link>
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1">
      <Link to="/billing" className={tabClass(!meterActive)} aria-current={!meterActive ? 'location' : undefined}>Xem hóa đơn</Link>
      <Link to="/billing/chi-so" className={tabClass(meterActive)} aria-current={meterActive ? 'page' : undefined}>Ghi chỉ số công tơ</Link>
    </div>
  </nav>
}
