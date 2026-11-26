import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'
import './dashboard.css'

interface HoaDonTom {
  id: string
  thang_nam: string
  tong_tien: number
  han_thanh_toan: string
  trang_thai_thanh_toan: string
}
const statuses: Record<string, string> = {
  chua_thanh_toan: 'Chưa thanh toán', cho_xac_nhan: 'Chờ xác nhận',
  thanh_toan_mot_phan: 'Đã trả một phần', da_thanh_toan: 'Đã thanh toán', qua_han: 'Quá hạn',
}
export default function TenantDashboard() {
  const { user } = useAuth()
  const [invoice, setInvoice] = useState<HoaDonTom | null>(null)
  const [issues, setIssues] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('hoa_don').select('id, thang_nam, tong_tien, han_thanh_toan, trang_thai_thanh_toan').eq('la_ban_nhap', false).order('ky', { ascending: false }).order('id').limit(1),
      supabase.from('su_co').select('id', { count: 'exact', head: true }).in('trang_thai', ['cho_tiep_nhan', 'dang_xu_ly', 'chua_the_xu_ly']),
    ]).then(([hd, sc]) => {
      if (cancelled) return
      if (hd.error || sc.error) setError((hd.error ?? sc.error)!.message)
      else { setInvoice((hd.data?.[0] as HoaDonTom | undefined) ?? null); setIssues(sc.count ?? 0); setError(null) }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [revision])
  function refresh() { setLoading(true); setRevision(n => n + 1) }
  return <main className="dashboard" aria-busy={loading}>
    <div className="dash-heading"><div><p className="dash-eyebrow">SUNSILK / KHÔNG GIAN CỦA BẠN</p><h1>Xin chào, {user?.hoTen}</h1><p>Hóa đơn, yêu cầu hỗ trợ và thông tin thuê nhà của bạn.</p></div><button className="dash-button" disabled={loading} onClick={refresh}>↻ Làm mới</button></div>
    <section className="dash-tenant-hero"><div><p className="dash-eyebrow">AN TÂM TRONG TỪNG NGÀY Ở</p><h2>Mọi tiện ích, ngay trong tầm tay.</h2><p>Gửi chỉ số điện nước, xem hóa đơn và theo dõi phản hồi từ quản lý.</p></div><Link className="dash-button" to="/billing/chi-so">Ghi chỉ số công tơ →</Link></section>
    {error && <div role="alert" className="dash-error">Không tải được dữ liệu. {error} <button onClick={refresh}>Thử lại</button></div>}
    {loading && <div role="status" className="dash-loading"><span />Đang tải thông tin của bạn…</div>}
    {!loading && !error && <div className="dash-two-columns">
      <section className="dash-panel"><div className="dash-panel-heading"><div><h2>Hóa đơn mới nhất</h2><p>Thông tin hóa đơn đã được phát hành</p></div><span className="dash-badge neutral">{invoice ? `Kỳ ${invoice.thang_nam}` : 'Chưa có hóa đơn'}</span></div>
        {invoice ? <><p className="dash-invoice-total">{Math.round(invoice.tong_tien).toLocaleString('vi-VN')} ₫</p><div className="dash-invoice-detail"><span>Trạng thái</span><strong>{statuses[invoice.trang_thai_thanh_toan] ?? invoice.trang_thai_thanh_toan}</strong></div><div className="dash-invoice-detail"><span>Hạn thanh toán</span><strong>{invoice.han_thanh_toan ? new Date(`${invoice.han_thanh_toan.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa có'}</strong></div><p className="dash-footnote">Đây là tổng giá trị hóa đơn. Xem chi tiết để kiểm tra số tiền còn phải thanh toán.</p><Link className="dash-button primary dash-invoice-action" to={`/billing/${invoice.id}`}>Xem hóa đơn & thanh toán →</Link></> : <div className="dash-empty"><h2>Chưa có hóa đơn được phát hành</h2><p>Hóa đơn sẽ xuất hiện sau khi quản lý kiểm tra và xác nhận chỉ số.</p><Link className="dash-button" to="/billing">Xem danh sách hóa đơn →</Link></div>}
      </section>
      <section className="dash-panel"><div className="dash-panel-heading"><div><h2>Tiện ích của bạn</h2><p>Chọn việc bạn cần thực hiện</p></div></div><div className="dash-shortcuts">
        <Link to="/billing/chi-so"><span className="dash-shortcut-top">01 <span>↗</span></span><strong>Ghi chỉ số</strong><span>Chụp công tơ điện & nước</span></Link>
        <Link to="/hop-dong"><span className="dash-shortcut-top">02 <span>↗</span></span><strong>Hợp đồng thuê</strong><span>Tra cứu thông tin hợp đồng</span></Link>
        <Link to="/issues/new"><span className="dash-shortcut-top">03 <span>↗</span></span><strong>Báo cáo sự cố</strong><span>Gửi yêu cầu đến quản lý</span></Link>
        <Link to="/thong_bao"><span className="dash-shortcut-top">04 <span>↗</span></span><strong>Thông báo</strong><span>Cập nhật từ khu trọ</span></Link>
      </div><Link className="dash-task" to="/issues" style={{ marginTop: 20 }}><span className="dash-task-icon blue" aria-hidden="true">!</span><div><strong>Yêu cầu đang mở</strong><p>Theo dõi tiến độ và phản hồi của quản lý</p></div><b className="dash-count">{issues}</b><span aria-hidden="true">→</span></Link></section>
    </div>}
  </main>
}
