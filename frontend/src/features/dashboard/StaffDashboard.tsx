import { Link } from 'react-router-dom'
import { useDashboard } from './useDashboard'
import { useAuth } from '../auth/useAuth'
import './dashboard.css'

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} ₫`
const percent = (n: number, total: number) => total > 0 ? Math.min(100, Math.max(0, Math.round(n / total * 100))) : 0

export default function StaffDashboard() {
  const { user } = useAuth()
  const { period, setPeriod, khuList, khuId, setKhuId, data, loading, error, refresh } = useDashboard()
  const admin = user?.vaiTro === 'chu_tro' || user?.vaiTro === 'quan_tri'
  const occupancy = data ? percent(data.phong_dang_thue, data.tong_so_phong) : 0
  const collection = data ? percent(data.tong_da_thu, data.tong_phat_hanh) : 0
  return <main className="dashboard" aria-busy={loading}>
    <div className="dash-heading"><div><p className="dash-eyebrow">SUNSILK / TỔNG QUAN</p><h1>Tổng quan vận hành</h1><p>Theo dõi tài chính, phòng và công việc của bạn tại một nơi.</p></div><button className="dash-button" onClick={refresh} disabled={loading}><span aria-hidden="true">↻</span> Làm mới</button></div>
    <section className="dash-filters" aria-label="Bộ lọc tổng quan"><div className="dash-scope"><span className="dash-property-symbol" aria-hidden="true">S</span><div><strong>{khuList.find(k => k.id === khuId)?.ten || 'Danh mục khu trọ'}</strong><span>Phạm vi dữ liệu được phân quyền</span></div></div><div className="dash-filter-fields"><label>Khu trọ<select value={khuId ?? ''} onChange={e => setKhuId(e.target.value)} disabled={!khuList.length}>{!khuList.length && <option value="">Chưa có khu trọ</option>}{khuList.map(k => <option key={k.id} value={k.id}>{k.ten}</option>)}</select></label><label>Kỳ tài chính<input type="month" required value={period} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setPeriod(e.target.value) }} /></label></div></section>
    {error && <div className="dash-error" role="alert">Không tải được tổng quan. {error} <button onClick={refresh}>Thử lại</button></div>}
    {loading && <div className="dash-loading" role="status"><span />Đang cập nhật số liệu…</div>}
    {!loading && !error && !khuList.length && <section className="dash-panel dash-empty"><h2>{admin ? 'Bắt đầu với khu trọ đầu tiên' : 'Chưa có khu trọ được phân công'}</h2><p>{admin ? 'Thêm khu trọ và phòng để bắt đầu theo dõi hoạt động.' : 'Liên hệ chủ trọ hoặc quản trị viên để được phân công khu quản lý.'}</p>{admin && <Link className="dash-button primary" to="/khu-phong">Quản lý khu & phòng →</Link>}</section>}
    {!loading && !error && data && <>
      <section className="dash-kpis" aria-label="Chỉ số chính">
        <article className="dash-kpi featured"><div className="dash-kpi-label">Tiền đã thu <span className="dash-mini-tag">Đã duyệt</span></div><strong>{money(data.tong_da_thu)}</strong><span>Từ hóa đơn kỳ {data.thang_nam}</span></article>
        <article className="dash-kpi"><div className="dash-kpi-label">Công nợ còn lại <i className="dash-dot amber" /></div><strong>{money(data.tong_con_no)}</strong><span>{data.so_hoa_don_qua_han} hóa đơn quá hạn trong kỳ</span></article>
        <article className="dash-kpi"><div className="dash-kpi-label">Phòng đang thuê <i className="dash-dot" /></div><strong>{data.phong_dang_thue}<small> / {data.tong_so_phong} phòng</small></strong><span>{data.phong_trong} phòng trống · {occupancy}% lấp đầy hiện tại</span></article>
        <article className="dash-kpi"><div className="dash-kpi-label">Sự cố đang mở <i className="dash-dot blue" /></div><strong>{data.so_su_co_dang_mo}<small> yêu cầu</small></strong><span>Chờ tiếp nhận, đang xử lý hoặc còn vướng mắc</span></article>
      </section>
      <div className="dash-two-columns">
        <section className="dash-panel"><div className="dash-panel-heading"><div><h2>Tình hình thu tiền</h2><p>Hóa đơn đã phát hành · Kỳ {data.thang_nam}</p></div><Link className="dash-text-link" to="/billing">Xem hóa đơn ↗</Link></div>
          <div className="dash-collection"><div><span>Tổng giá trị phát hành</span><strong>{money(data.tong_phat_hanh)}</strong></div><span className="dash-badge">{data.tong_phat_hanh > 0 ? `${collection}% đã thu` : 'Chưa phát hành'}</span></div>
          <div className="dash-progress" role="img" aria-label={`Đã thu ${collection}% giá trị hóa đơn`}><span style={{ width: `${collection}%` }} /></div>
          <div className="dash-money-legend"><div><span><i className="dash-dot" />Đã thu</span><strong>{money(data.tong_da_thu)}</strong></div><div><span><i className="dash-dot amber" />Còn phải thu</span><strong>{money(data.tong_con_no)}</strong></div></div>
          <p className="dash-footnote">Ghi nhận các khoản đã được duyệt, bao gồm thanh toán một phần.</p>
        </section>
        <section className="dash-panel"><div className="dash-panel-heading"><div><h2>Tình trạng phòng</h2><p>Số liệu hiện tại của khu đang chọn</p></div><Link className="dash-text-link" to="/khu-phong">Xem phòng ↗</Link></div>
          <div className="dash-occupancy"><div className="dash-ring" role="img" aria-label={`${occupancy}% phòng đang thuê`} style={{ background: `conic-gradient(#147d64 0% ${occupancy}%, #e8eeeb ${occupancy}% 100%)` }}><div><strong>{data.tong_so_phong ? `${occupancy}%` : '—'}</strong><span>Lấp đầy</span></div></div><dl className="dash-room-legend">{[['Đang thuê', data.phong_dang_thue, ''], ['Còn trống', data.phong_trong, 'light'], ['Đang bảo trì', data.phong_bao_tri, 'amber']].map(([label, count, tone]) => <div key={label}><dt><i className={`dash-dot ${tone}`} />{label}</dt><dd>{count}<span> phòng</span></dd></div>)}</dl></div>
        </section>
      </div>
      <div className="dash-two-columns bottom">
        <section className="dash-panel"><div className="dash-panel-heading"><div><h2>Cần theo dõi</h2><p>Các đầu việc để giữ hoạt động thông suốt</p></div><span className="dash-badge neutral">Ưu tiên</span></div>
          <Link className="dash-task" to="/billing"><span className="dash-task-icon amber" aria-hidden="true">₫</span><div><strong>Hóa đơn quá hạn</strong><p>Kiểm tra công nợ trong kỳ {data.thang_nam}</p></div><b className={data.so_hoa_don_qua_han ? 'dash-count red' : 'dash-count'}>{data.so_hoa_don_qua_han}</b><span aria-hidden="true">→</span></Link>
          <Link className="dash-task" to="/billing"><span className="dash-task-icon" aria-hidden="true">✓</span><div><strong>Thanh toán chờ xác nhận</strong><p>Đối chiếu biên lai trước khi ghi nhận tiền thu</p></div><b className="dash-count">{data.so_hoa_don_cho_xac_nhan}</b><span aria-hidden="true">→</span></Link>
          <Link className="dash-task" to="/issue-management"><span className="dash-task-icon blue" aria-hidden="true">!</span><div><strong>Sự cố chưa hoàn tất</strong><p>{user?.vaiTro === 'quan_tri' ? 'Theo dõi tiến độ xử lý của quản lý' : 'Tiếp nhận và phản hồi yêu cầu của người thuê'}</p></div><b className="dash-count">{data.so_su_co_dang_mo}</b><span aria-hidden="true">→</span></Link>
        </section>
        <section className="dash-panel"><div className="dash-panel-heading"><div><h2>Truy cập nhanh</h2><p>Các chức năng thường dùng</p></div></div><div className="dash-shortcuts">
          <Link to="/hop-dong"><span className="dash-shortcut-top">01 <span>↗</span></span><strong>Hợp đồng</strong><span>{admin ? 'Quản lý hợp đồng thuê' : 'Tra cứu hợp đồng'}</span></Link>
          <Link to={admin ? '/nguoi-thue' : '/khu-phong'}><span className="dash-shortcut-top">02 <span>↗</span></span><strong>{admin ? 'Người thuê' : 'Khu & phòng'}</strong><span>{admin ? 'Hồ sơ và tài khoản' : 'Thông tin phòng trọ'}</span></Link>
          <Link to="/billing"><span className="dash-shortcut-top">03 <span>↗</span></span><strong>Hóa đơn</strong><span>Đối soát & thanh toán</span></Link>
          <Link to="/thong_bao"><span className="dash-shortcut-top">04 <span>↗</span></span><strong>Thông báo</strong><span>Cập nhật & gửi thông tin</span></Link>
        </div></section>
      </div>
    </>}
  </main>
}
