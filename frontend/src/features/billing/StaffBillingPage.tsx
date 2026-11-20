import { MeterEntryAccess } from './MeterEntryAccess'
import { BankTransactions } from './BankTransactions'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'
import { money } from './TenantBillingFlow'
import { BillingPrices } from './BillingPrices'
import type { BillRow } from './billingInvoice'
import './billing.css'

export interface StaffBill extends BillRow {
  phong_id: string; ky: string; thang_nam: string; trang_thai_thanh_toan: string; ly_do_dieu_chinh: string | null;
  phong_tro: { so_phong: string; khu_tro_id: string; khu_tro: { ten: string } | null } | null;
  hop_dong: { nguoi_thue: { ho_ten: string } | null } | null;
  thanh_toan: { id: string; so_tien: number; trang_thai: string }[];
}
const button = 'rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
const field = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm'
const status = (bill: StaffBill) => bill.la_ban_nhap ? (bill.ghi_chu_kiem_tra ? 'Cần kiểm tra lại' : 'Chờ kiểm tra chỉ số') : ({ da_thanh_toan: 'Đã thanh toán', cho_xac_nhan: 'Chờ đối soát', thanh_toan_mot_phan: 'Thanh toán một phần', qua_han: 'Quá hạn', chua_thanh_toan: 'Chưa thanh toán' }[bill.trang_thai_thanh_toan] ?? bill.trang_thai_thanh_toan)

export default function StaffBillingPage() {
  const { user } = useAuth()
  const { billId } = useParams()
  const canPrice = user?.vaiTro === 'chu_tro' || user?.vaiTro === 'quan_tri'
  const [tab, setTab] = useState<'bills' | 'review' | 'prices' | 'bank' | 'meterAccess'>('bills')
  const [rows, setRows] = useState<StaffBill[]>([])
  const [page, setPage] = useState(0)
  const [area, setArea] = useState('')
  const [month, setMonth] = useState('')
  const [room, setRoom] = useState('')
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(billId ?? '')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    async function load() {
      const all: StaffBill[] = []
      for (let offset = 0; !cancelled; offset += 500) {
        const result = await supabase.from('hoa_don').select('*,chi_tiet_hoa_don(dien_giai,so_tien,su_co_id),phong_tro(so_phong,khu_tro_id,khu_tro(ten)),hop_dong(nguoi_thue:nguoi_dung!hop_dong_nguoi_thue_id_fkey(ho_ten)),thanh_toan(id,so_tien,trang_thai)').order('ky', { ascending: false }).order('id').range(offset, offset + 499)
        if (cancelled) return
        if (result.error) { setError('Không tải được hóa đơn. Vui lòng thử lại.'); setLoading(false); return }
        all.push(...result.data as unknown as StaffBill[])
        if (result.data.length < 500) break
      }
      if (!cancelled) { setRows(all); setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [revision, user?.id])
  const areas = [...new Map(rows.filter(b => b.phong_tro).map(b => [b.phong_tro!.khu_tro_id, b.phong_tro!.khu_tro?.ten ?? 'Khu trọ'])).entries()]
  const waiting = (b: StaffBill) => b.la_ban_nhap || b.thanh_toan.some(p => p.trang_thai === 'cho_duyet')
  const filtered = rows.filter(b => (!area || b.phong_tro?.khu_tro_id === area) && (!month || b.ky.startsWith(month)) && (!room || b.phong_tro?.so_phong.toLowerCase().includes(room.toLowerCase())) && (!filter || (filter === 'draft' ? b.la_ban_nhap : !b.la_ban_nhap && b.trang_thai_thanh_toan === filter)) && (tab !== 'review' || waiting(b)))
  const paid = (b: StaffBill) => b.thanh_toan.filter(p => p.trang_thai === 'da_duyet').reduce((sum, p) => sum + Number(p.so_tien), 0)
  const selectedBill = rows.find(b => b.id === selected)
  useEffect(() => { setPage(0) }, [area, month, room, filter, tab])
  function exportCsv() {
    const escape = (v: unknown) => { let text = String(v ?? ''); if (/^[=+\-@\t\r]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"' }
    const data = [['Phòng', 'Khu trọ', 'Người thuê', 'Kỳ', 'Tổng tiền', 'Đã thu', 'Còn nợ', 'Trạng thái'], ...filtered.map(b => [b.phong_tro?.so_phong, b.phong_tro?.khu_tro?.ten, b.hop_dong?.nguoi_thue?.ho_ten, b.thang_nam, b.tong_tien, paid(b), b.la_ban_nhap ? '' : Math.max(0, Number(b.tong_tien) - paid(b)), status(b)])]
    const url = URL.createObjectURL(new Blob(['\ufeff' + data.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'hoa-don.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="tenant-billing"><Link className="bill-link" to="/">← Tổng quan</Link><div className="billing-title"><div><p className="eyebrow">QUẢN LÝ THU TIỀN</p><h1>Hóa đơn & thanh toán</h1><p>{user?.vaiTro === 'quan_ly' ? 'Theo dõi và kiểm tra trong khu được phân công.' : 'Theo dõi công nợ, kiểm tra chỉ số và đối soát thanh toán.'}</p></div></div>
    <nav className="flex flex-wrap gap-2 mb-6" aria-label="Quản lý hóa đơn">{([['bills', 'Hóa đơn'], ['meterAccess', 'Mở nhập bổ sung'], ['review', `Chờ xác nhận (${rows.filter(waiting).length})`], ...(canPrice ? [['bank', 'Giao dịch ngân hàng'], ['prices', 'Đơn giá']] : [])] as [typeof tab, string][]).map(([value, label]) => <button key={value} className={tab === value ? button : `${field} text-gray-600`} onClick={() => { setTab(value); setSelected('') }} aria-pressed={tab === value}>{label}</button>)}</nav>
    {tab === 'meterAccess' ? <MeterEntryAccess /> : tab === 'bank' && canPrice ? <BankTransactions /> : tab === 'prices' && canPrice ? <BillingPrices /> : <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">{[['Đã thu', money(filtered.reduce((sum, b) => sum + paid(b), 0))], ['Còn phải thu', money(filtered.filter(b => !b.la_ban_nhap).reduce((sum, b) => sum + Math.max(0, Number(b.tong_tien) - paid(b)), 0))], ['Chờ kiểm tra chỉ số', String(filtered.filter(b => b.la_ban_nhap).length)]].map(([label, value]) => <div key={label} className="meter-card"><p className="text-xs text-gray-500">{label}</p><strong className="text-2xl">{value}</strong></div>)}</div>
      <div className="flex gap-3 flex-wrap mb-5"><label className="text-xs">Khu trọ<select className={`${field} block mt-1`} value={area} onChange={e => setArea(e.target.value)}><option value="">Tất cả khu được xem</option>{areas.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label className="text-xs">Kỳ hóa đơn<input className={`${field} block mt-1`} type="month" value={month} onChange={e => setMonth(e.target.value)} /></label><label className="text-xs">Phòng<input className={`${field} block mt-1`} placeholder="Tìm số phòng" value={room} onChange={e => setRoom(e.target.value)} /></label><label className="text-xs">Trạng thái<select className={`${field} block mt-1`} value={filter} onChange={e => setFilter(e.target.value)}><option value="">Tất cả</option><option value="draft">Chờ kiểm tra chỉ số</option><option value="chua_thanh_toan">Chưa thanh toán</option><option value="cho_xac_nhan">Chờ đối soát</option><option value="thanh_toan_mot_phan">Thanh toán một phần</option><option value="da_thanh_toan">Đã thanh toán</option><option value="qua_han">Quá hạn</option></select></label></div>
      {error && <p role="alert" className="bill-error">{error} <button className="underline" onClick={() => setRevision(n => n + 1)}>Thử lại</button></p>}
      {loading ? <p role="status">Đang tải hóa đơn…</p> : <><div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-sm text-left"><thead className="bg-emerald-50"><tr>{['Phòng / Khu', 'Kỳ', 'Tổng tiền', 'Còn nợ', 'Trạng thái', ''].map((h, i) => <th key={i} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{filtered.slice(page * 20, page * 20 + 20).map(b => <tr key={b.id} className="border-t border-gray-100"><td className="p-4"><strong>{b.phong_tro?.so_phong}</strong><small className="block text-gray-500">{b.phong_tro?.khu_tro?.ten}</small></td><td className="p-4 whitespace-nowrap">{b.thang_nam}</td><td className="p-4 whitespace-nowrap">{money(Number(b.tong_tien))}</td><td className="p-4 whitespace-nowrap">{b.la_ban_nhap ? 'Tạm tính' : money(Math.max(0, Number(b.tong_tien) - paid(b)))}</td><td className="p-4">{status(b)}</td><td className="p-4"><button className="bill-link whitespace-nowrap" onClick={() => setSelected(b.id)}>Chi tiết</button></td></tr>)}</tbody></table>{!filtered.length && <p className="p-6 text-gray-500">Không có hóa đơn phù hợp.</p>}</div><div className="my-4 flex flex-wrap items-center justify-between gap-4 text-sm"><button className="bill-link" onClick={exportCsv} disabled={!filtered.length}>Xuất CSV theo bộ lọc</button><div className="flex gap-4"><button disabled={!page} onClick={() => setPage(n => n - 1)}>← Trước</button><span>{filtered.length} hóa đơn · Trang {page + 1}</span><button disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage(n => n + 1)}>Sau →</button></div></div>
      {selectedBill && <StaffBillDetail key={`${selected}-${revision}`} bill={selectedBill} onSaved={() => setRevision(n => n + 1)} onClose={() => setSelected('')} />}
      {selected && !selectedBill && <p className="bill-error mt-4">Không tìm thấy hóa đơn trong danh sách được phép xem.</p>}
      </>}
    </>}
  </div>
}

function StaffBillDetail({ bill, onSaved, onClose }: { bill: StaffBill; onSaved: () => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])
  const [electricity, setElectricity] = useState(String(bill.chi_so_dien_moi))
  const [water, setWater] = useState(String(bill.chi_so_nuoc_moi))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState<{ label: string; url?: string; capturedAt?: string | null; error?: string }[]>([])
  const [payments, setPayments] = useState<{ id: string; so_tien: number; trang_thai: string; ma_giao_dich: string | null; duong_dan_bien_lai: string | null; url?: string }[]>([])
  const [history, setHistory] = useState<{ id: string; tao_luc: string; nguoi_sua_id: string | null; ly_do: string | null }[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [meters, transfers, logs] = await Promise.all([
          supabase.from('chi_so_cong_to').select('loai,duong_dan_anh,chup_luc').eq('phong_id', bill.phong_id).eq('ky', bill.ky),
          supabase.from('thanh_toan').select('id,so_tien,trang_thai,ma_giao_dich,duong_dan_bien_lai').eq('hoa_don_id', bill.id).order('tao_luc', { ascending: false }),
          supabase.from('nhat_ky_hoa_don').select('id,tao_luc,nguoi_sua_id,ly_do').eq('hoa_don_id', bill.id).order('tao_luc', { ascending: false }),
        ])
        if (meters.error || transfers.error || logs.error) throw new Error('Không tải được dữ liệu đối chiếu. Vui lòng đóng và mở lại chi tiết.')
        const images = await Promise.all(['dien', 'nuoc'].map(async type => {
          const m = meters.data.find(meter => meter.loai === type)
          const photo = { label: type === 'dien' ? 'Ảnh công tơ điện' : 'Ảnh công tơ nước', capturedAt: m?.chup_luc }
          if (!m?.duong_dan_anh) return photo
          const result = await supabase.storage.from('anh-cong-to').createSignedUrl(m.duong_dan_anh, 600)
          if (result.error) return { ...photo, error: 'Không tải được ảnh. Đóng và mở lại chi tiết để thử lại.' }
          return { ...photo, url: result.data.signedUrl }
        }))
        if (!cancelled) setPhotos(images)
        const receipts = await Promise.all(transfers.data.map(async p => {
          if (!p.duong_dan_bien_lai) return p
          const result = await supabase.storage.from('bien-lai').createSignedUrl(p.duong_dan_bien_lai, 600)
          if (result.error) throw new Error('Không tải được ảnh biên lai.')
          return { ...p, url: result.data.signedUrl }
        }))
        if (!cancelled) { setPhotos(images); setPayments(receipts); setHistory(logs.data); setLoaded(true) }
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Lỗi tải chi tiết.') }
    }
    void load(); return () => { cancelled = true }
  }, [bill.id, bill.phong_id, bill.ky])
  async function review(approve: boolean) {
    if (busy) return
    setBusy(true); setError('')
    const { error: err } = await supabase.rpc('kiem_tra_hoa_don', { p_id: bill.id, p_dien: Number(electricity), p_nuoc: Number(water), p_ly_do: reason, p_duyet: approve })
    setBusy(false)
    if (err) setError(err.message); else onSaved()
  }
  async function reviewPayment(id: string, approve: boolean) {
    if (busy) return
    if (!approve && !reason.trim()) { setError('Nhập lý do từ chối biên lai.'); return }
    setBusy(true); setError('')
    const { data, error: err } = await supabase.from('thanh_toan').update({ trang_thai: approve ? 'da_duyet' : 'tu_choi', ly_do_tu_choi: approve ? null : reason.trim() }).eq('id', id).eq('trang_thai', 'cho_duyet').select('id')
    setBusy(false)
    if (err) setError(err.message); else if (!data.length) setError('Giao dịch đã được xử lý. Vui lòng tải lại.'); else onSaved()
  }
  const valid = /^\d+$/.test(electricity) && /^\d+$/.test(water) && Number(electricity) >= bill.chi_so_dien_cu && Number(water) >= bill.chi_so_nuoc_cu
  return <dialog ref={dialogRef} className="bill-detail-dialog" aria-labelledby="bill-detail-title" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="meter-card"><header className="flex justify-between gap-3 mb-5"><div><h2 id="bill-detail-title">Phòng {bill.phong_tro?.so_phong} · {bill.thang_nam}</h2><p className="text-sm">Người thuê: <strong>{bill.hop_dong?.nguoi_thue?.ho_ten ?? 'Chưa có thông tin'}</strong></p><p className="text-sm text-gray-500">{status(bill)}</p></div><button autoFocus type="button" className="bill-link" onClick={onClose}>Đóng chi tiết</button></header>
    <div className="grid sm:grid-cols-4 gap-3 mb-5">{[['Tiền phòng', bill.tien_phong], ['Tiền điện', bill.tien_dien], ['Tiền nước', bill.tien_nuoc], ['Dịch vụ', bill.tien_dich_vu]].map(([name, amount]) => <div key={String(name)}><span className="text-xs text-gray-500">{name}</span><strong className="block">{money(Number(amount))}</strong></div>)}</div>
    {error && <p role="alert" className="bill-error">{error}</p>}
    <div className="grid sm:grid-cols-2 gap-4 my-5">{photos.map(p => <figure key={p.label} className="rounded-xl border border-gray-200 p-3">
      <figcaption className="font-medium mb-3">{p.label}</figcaption>
      {p.url && !p.error ? <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Xem lớn ${p.label.toLowerCase()}`}><img className="w-full h-56 object-contain rounded-lg bg-gray-100" src={p.url} alt={p.label} onError={() => setPhotos(current => current.map(photo => photo.label === p.label ? { ...photo, error: 'Không hiển thị được ảnh. Đóng và mở lại chi tiết để thử lại.' } : photo))} /><span className="bill-link block text-xs mt-2">Bấm để xem ảnh lớn</span></a> : <div className="flex items-center justify-center min-h-32 rounded-lg bg-gray-50 p-4 text-sm text-gray-500" role={p.error ? 'alert' : undefined}>{p.error ?? 'Chưa có ảnh công tơ được gửi cho kỳ này.'}</div>}
      {p.capturedAt && <p className="text-xs text-gray-500 mt-2">Chụp lúc {new Date(p.capturedAt).toLocaleString('vi-VN')}</p>}
    </figure>)}</div>
    {!loaded && !error && <p>Đang tải ảnh và lịch sử…</p>}
    {bill.ghi_chu_kiem_tra && <p className="bill-error">Đang chờ người thuê nhập và chụp lại công tơ. Lý do: {bill.ghi_chu_kiem_tra}</p>}
    <div className="grid sm:grid-cols-2 gap-4 mb-4"><label>Chỉ số điện <span className="text-xs text-gray-500">(cũ: {bill.chi_so_dien_cu})</span><input className={`${field} block w-full mt-1`} disabled={!bill.la_ban_nhap || busy} type="number" step="1" min={bill.chi_so_dien_cu} value={electricity} onChange={e => setElectricity(e.target.value)} /></label><label>Chỉ số nước <span className="text-xs text-gray-500">(cũ: {bill.chi_so_nuoc_cu})</span><input className={`${field} block w-full mt-1`} disabled={!bill.la_ban_nhap || busy} type="number" step="1" min={bill.chi_so_nuoc_cu} value={water} onChange={e => setWater(e.target.value)} /></label></div>
    {(bill.la_ban_nhap || payments.some(p => p.trang_thai === 'cho_duyet')) && <label className="block my-4">Lý do điều chỉnh / từ chối<textarea className={`${field} block w-full mt-1`} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ghi rõ nội dung cần kiểm tra hoặc điều chỉnh" /></label>}
    {bill.la_ban_nhap && <div className="flex gap-3 flex-wrap"><button className={button} disabled={busy || !loaded || !valid || Boolean(bill.ghi_chu_kiem_tra)} onClick={() => review(true)}>Xác nhận chỉ số & phát hành</button><button className={field} disabled={busy || !loaded || !valid || !reason.trim()} onClick={() => review(false)}>Yêu cầu kiểm tra lại</button></div>}
    <p className="my-3 break-all text-sm">Mã thanh toán: <strong>{bill.ma_thanh_toan ?? bill.noi_dung_chuyen_khoan}</strong></p><section className="my-4">{bill.chi_tiet_hoa_don?.filter(line => line.su_co_id).map(line => <p className="flex justify-between gap-3 text-sm" key={line.su_co_id}><span>{line.dien_giai}</span><strong>{money(Number(line.so_tien))}</strong></p>)}</section><h3 className="font-semibold mt-7 mb-3">Giao dịch thanh toán</h3>{!payments.length && <p className="text-sm text-gray-500">Chưa có biên lai.</p>}{payments.map(p => <div className="border rounded-lg p-4 mb-3" key={p.id}><strong>{money(Number(p.so_tien))}</strong><p className="text-xs text-gray-500">{p.ma_giao_dich || 'Không có mã giao dịch'} · {p.trang_thai}</p>{p.url && <a href={p.url} target="_blank" rel="noreferrer"><img className="max-h-52 my-3 rounded" src={p.url} alt="Biên lai chuyển khoản" /></a>}{p.trang_thai === 'cho_duyet' && <div className="flex gap-3 mt-3"><button disabled={busy || !loaded} className={button} onClick={() => reviewPayment(p.id, true)}>Đã nhận tiền — duyệt</button><button disabled={busy || !reason.trim()} className={field} onClick={() => reviewPayment(p.id, false)}>Từ chối</button></div>}</div>)}
    <h3 className="font-semibold mt-7 mb-3">Lịch sử thay đổi</h3>{history.map(h => <p key={h.id} className="text-xs border-t py-2 text-gray-600">{new Date(h.tao_luc).toLocaleString('vi-VN')} · {h.nguoi_sua_id?.slice(0, 8) ?? 'Hệ thống'} · {h.ly_do || 'Cập nhật hóa đơn / trạng thái'}</p>)}
  </section></dialog>
}
