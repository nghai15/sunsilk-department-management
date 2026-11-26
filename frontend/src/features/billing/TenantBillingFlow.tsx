import { supabase } from '../../services/supabase'
import { useEffect, useRef, useState } from 'react'
import { CameraCapture, type MeterPhoto } from './CameraCapture'
import { taoUrlVietQR } from '../../utils/billing'
import './billing.css'

export interface BillingConfig {
  entryWindow?: { allowed: boolean; reason: string; opens: string; closes: string; due: string; extraUntil: string | null }; 
  room: string; property: string; period: string; rent: number; electricityRate: number; waterRate: number;
  previousElectricity: number; previousWater: number;
  autoPayment?: boolean; bank?: string; account?: string; accountName?: string; initialBill?: BillingInvoice;
}
export interface BillingSubmission { electricity: number; water: number; electricityPhoto: MeterPhoto; waterPhoto: MeterPhoto }
export interface BillingInvoice {
  repairs?: { label: string; amount: number }[];
  id: string; rent: number; electricity: number; water: number; services: number; total: number;
  electricityUsage: number; waterUsage: number; memo: string; due: string; remaining: number; pending?: boolean; draft?: boolean; reviewNote?: string;
}
export const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

export function TenantBillingFlow({ config, onSubmit, onPaymentUpdated, demo = false, invoiceOnly = false }: { config: BillingConfig; onPaymentUpdated?: (remaining: number, pending: boolean) => void; onSubmit?: (values: BillingSubmission) => Promise<BillingInvoice>; demo?: boolean; invoiceOnly?: boolean }) {
  const [electricity, setElectricity] = useState('')
  const [water, setWater] = useState('')
  const [electricityPhoto, setElectricityPhoto] = useState<MeterPhoto>()
  const [waterPhoto, setWaterPhoto] = useState<MeterPhoto>()
  const [bill, setBill] = useState(config.initialBill?.draft && config.initialBill.reviewNote && !invoiceOnly ? undefined : config.initialBill)
  const [paymentError, setPaymentError] = useState('')
  useEffect(() => {
    if (demo || !config.autoPayment || !bill || bill.draft || bill.remaining <= 0) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      if (!document.hidden && navigator.onLine) {
        const result = await supabase.from('thanh_toan').select('so_tien,trang_thai').eq('hoa_don_id', bill!.id)
        if (cancelled) return
        if (result.error) setPaymentError('Chưa cập nhật được thanh toán. Hệ thống sẽ tự thử lại; đừng chuyển tiền lần nữa nếu đã chuyển.')
        else {
          setPaymentError('')
          const paid = result.data.filter(p => p.trang_thai === 'da_duyet').reduce((sum, p) => sum + Number(p.so_tien), 0)
          const remaining = Math.max(0, bill!.total - paid)
          const pending = result.data.some(p => p.trang_thai === 'cho_duyet')
          setBill(current => current ? { ...current, remaining, pending } : current)
          onPaymentUpdated?.(remaining, pending)
        }
      }
      if (!cancelled) timer = setTimeout(() => { void refresh() }, 5000)
    }
    void refresh()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [bill?.id, bill?.draft, bill?.remaining, config.autoPayment, demo, onPaymentUpdated])
  const [payment, setPayment] = useState(false)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [error, setError] = useState('')
  const [qrFailed, setQrFailed] = useState(false)
  const [copied, setCopied] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const validReading = (value: string, old: number) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= old && Number(value) <= 2147483647
  const valid = validReading(electricity, config.previousElectricity) && validReading(water, config.previousWater) && electricityPhoto && waterPhoto
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!onSubmit || !valid || busy.current || !electricityPhoto || !waterPhoto) return
    busy.current = true; setSaving(true); setError('')
    try {
      const result = await onSubmit({ electricity: Number(electricity), water: Number(water), electricityPhoto, waterPhoto })
      setBill(result)
      requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
    } catch (err) { setError(err instanceof Error ? err.message : 'Chưa lưu được hóa đơn. Vui lòng thử lại.') }
    finally { busy.current = false; setSaving(false) }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied('Đã sao chép') }
    catch { setCopied('Không sao chép được. Bạn có thể chọn và sao chép thông tin bên dưới.') }
  }
  const meter = (kind: 'electricity' | 'water') => {
    const electric = kind === 'electricity', label = electric ? 'Điện' : 'Nước', unit = electric ? 'kWh' : 'm³'
    const old = electric ? config.previousElectricity : config.previousWater
    const value = electric ? electricity : water
    const isValid = validReading(value, old)
    return <section className="meter-card"><header><span className={`utility-icon ${electric ? 'electric' : 'water'}`}>{electric ? 'ϟ' : '◈'}</span><div><h2>Công tơ {label.toLowerCase()}</h2><p>Đơn giá niêm yết <strong>{money(electric ? config.electricityRate : config.waterRate)} / {unit}</strong></p></div></header><div className="meter-inputs"><div><span className="bill-label">Chỉ số kỳ trước</span><div className="previous-reading">{old.toLocaleString('vi-VN')} <small>{unit}</small></div></div><div><label className="bill-label" htmlFor={kind}>Chỉ số hiện tại <span aria-hidden="true">*</span></label><div className="reading-field"><input id={kind} inputMode="numeric" type="number" min={old} max={2147483647} step="1" required value={value} disabled={saving} placeholder="Nhập chỉ số" aria-describedby={`${kind}-help`} aria-invalid={Boolean(value && !isValid)} onChange={event => (electric ? setElectricity : setWater)(event.target.value)} /><span>{unit}</span></div></div></div><p id={`${kind}-help`} className={value && !isValid ? 'reading-error' : 'meter-hint'}>{value && !isValid ? `Nhập số nguyên từ ${old.toLocaleString('vi-VN')} trở lên.` : isValid ? `Tiêu thụ kỳ này: ${(Number(value) - old).toLocaleString('vi-VN')} ${unit}` : 'Nhập các chữ số trên công tơ, không gồm phần thập phân.'}</p><CameraCapture label={`công tơ ${label.toLowerCase()}`} photo={electric ? electricityPhoto : waterPhoto} onCapture={electric ? setElectricityPhoto : setWaterPhoto} disabled={saving} /></section>
  }
  const repairTotal = bill?.repairs?.reduce((sum, line) => sum + line.amount, 0) ?? 0
  const hasBank = config.bank && config.account && config.accountName
  const qr = bill && hasBank ? taoUrlVietQR({ maBin: config.bank!, soTaiKhoan: config.account!, tenTaiKhoan: config.accountName, soTien: bill.remaining, noiDung: bill.memo, template: 'qr_only' }) : ''
  return <div className="tenant-billing"><header className="billing-brand"><span className="brand-mark">S</span><strong>Sunsilk<span>Không gian sống của bạn</span></strong><span className="room-pill">Phòng {config.room}</span></header>
    {demo && <div className="demo-notice">Bản xem thử · Dữ liệu mẫu, chưa lưu vào hệ thống.</div>}
    <div className="billing-title"><div><p className="eyebrow">ĐIỆN NƯỚC & THANH TOÁN</p><h1 ref={heading} tabIndex={-1}>{bill ? 'Hóa đơn của bạn' : 'Ghi chỉ số, thanh toán dễ dàng.'}</h1><p>{config.property} <span className="dot">·</span> Kỳ tháng {config.period}</p></div><div className="period-chip"><small>KỲ THANH TOÁN</small><strong>{config.period}</strong></div></div>
    {!invoiceOnly && config.entryWindow && <section className="meter-card mb-5" role="status"><h2>{config.entryWindow.reason}</h2><p className="mt-2 text-sm">Kỳ {config.period} · Nhập từ {new Date(`${config.entryWindow.opens}T00:00:00`).toLocaleDateString('vi-VN')} đến hết {new Date(`${config.entryWindow.closes}T00:00:00`).toLocaleDateString('vi-VN')} · Hạn đóng tiền {new Date(`${config.entryWindow.due}T00:00:00`).toLocaleDateString('vi-VN')}.</p>{config.entryWindow.extraUntil && config.entryWindow.allowed && <p className="mt-2 text-sm">Được mở bổ sung đến {new Date(config.entryWindow.extraUntil).toLocaleString('vi-VN')}.</p>}</section>}
    {!invoiceOnly && <ol className="billing-steps">{['Ghi chỉ số', 'Xem hóa đơn', 'Thanh toán'].map((label, i) => <li key={label} className={(payment ? 2 : bill ? 1 : 0) >= i ? 'active' : ''} aria-current={(payment ? 2 : bill ? 1 : 0) === i ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}</ol>}
    {!bill && invoiceOnly ? <p>Chưa có hóa đơn được phát hành.</p> : !bill && config.entryWindow && !config.entryWindow.allowed ? <section className="meter-card"><h2>Chỉ số kỳ trước</h2><p className="mt-2 text-sm text-gray-500">Chỉ được xem trong thời gian khóa nhập. Chỉ số bàn giao ban đầu do quản lý thiết lập.</p><dl className="mt-5 grid grid-cols-2 gap-4"><div><dt>Điện</dt><dd className="text-xl font-semibold">{config.previousElectricity.toLocaleString('vi-VN')} kWh</dd></div><div><dt>Nước</dt><dd className="text-xl font-semibold">{config.previousWater.toLocaleString('vi-VN')} m³</dd></div></dl></section> : !bill ? <form onSubmit={submit}>{config.initialBill?.reviewNote && <p role="alert" className="bill-error mb-5">Quản lý yêu cầu gửi lại: {config.initialBill.reviewNote}. Bạn cần nhập lại chỉ số và chụp mới cả công tơ điện lẫn nước.</p>}<div className="billing-grid"><main><div className="section-intro"><h2>Chỉ số công tơ tháng này</h2><p>Chụp rõ mặt số của cả hai công tơ rồi nhập chỉ số tương ứng.</p></div><div className="meter-stack">{meter('electricity')}{meter('water')}</div></main><aside className="bill-aside"><div className="rate-card"><p className="eyebrow">THÔNG TIN PHÒNG</p><h2>Phòng {config.room}</h2><dl><div><dt>Tiền phòng / tháng</dt><dd>{money(config.rent)}</dd></div><div><dt>Điện / kWh</dt><dd>{money(config.electricityRate)}</dd></div><div><dt>Nước / m³</dt><dd>{money(config.waterRate)}</dd></div></dl><p>Đơn giá do chủ trọ niêm yết. Liên hệ quản lý nếu thông tin chưa chính xác.</p></div><div className="capture-tip"><span>01 / CHỤP RÕ MẶT SỐ</span><h3>Mỗi công tơ, một ảnh mới.</h3><p>Chụp trực tiếp bằng camera để lưu bằng chứng cùng chỉ số của kỳ này.</p><div className="meter-illustration" aria-hidden="true"><div>kWh</div><strong>0 1 4 2 5</strong><span>● ━━━━━ ●</span></div></div></aside></div><div className="billing-submit">{error && <p className="bill-error" role="alert">{error}</p>}<p>{electricityPhoto && waterPhoto ? 'Đã có ảnh của cả hai công tơ.' : 'Cần chụp đủ ảnh công tơ điện và nước để lập hóa đơn.'}</p><button className="bill-primary" disabled={!valid || saving} type="submit">{saving ? 'Đang lưu & lập hóa đơn…' : 'Gửi chỉ số để kiểm tra'} <span aria-hidden="true">→</span></button></div></form>
      : <div className="invoice-grid"><section className="invoice-card"><header><div><p className="eyebrow">HÓA ĐƠN TIỀN PHÒNG</p><h2>Tháng {config.period}</h2><p>Phòng {config.room} · {config.property}</p></div><span className="invoice-status">{bill.draft ? 'Chờ kiểm tra chỉ số' : bill.remaining <= 0 ? 'Đã thanh toán' : bill.pending ? 'Chờ xác nhận' : bill.remaining < bill.total ? 'Đã thanh toán một phần' : 'Chưa thanh toán'}</span></header><div className="invoice-reference"><span>Mã hóa đơn <strong>{bill.id.slice(0, 8).toUpperCase()}</strong></span><span>Hạn thanh toán <strong>{new Date(`${bill.due}T00:00:00`).toLocaleDateString('vi-VN')}</strong></span></div><div className="invoice-lines"><div><span>Khoản thu</span><span>Thành tiền</span></div><div><span><strong>Tiền phòng</strong><small>Phòng {config.room} · 1 tháng</small></span><strong>{money(bill.rent)}</strong></div><div><span><strong>Tiền điện</strong><small>{bill.electricityUsage} kWh</small></span><strong>{money(bill.electricity)}</strong></div><div><span><strong>Tiền nước</strong><small>{bill.waterUsage} m³</small></span><strong>{money(bill.water)}</strong></div>{bill.services - repairTotal > 0 && <div><span><strong>Phí dịch vụ</strong><small>Theo hợp đồng</small></span><strong>{money(bill.services - repairTotal)}</strong></div>}{bill.repairs?.map((line, index) => <div key={index}><span><strong>{line.label}</strong><small>Phí sửa chữa · thu cùng tiền phòng</small></span><strong>{money(line.amount)}</strong></div>)}</div><div className="invoice-total"><span>Tổng cộng</span><strong>{money(bill.total)}</strong></div>{bill.remaining < bill.total && <div className="invoice-reference"><span>Còn phải thanh toán</span><strong>{money(bill.remaining)}</strong></div>}<p className="invoice-footnote">Ảnh và chỉ số công tơ được lưu cùng kỳ hóa đơn để đối chiếu.</p></section><aside className="payment-card"><span className="payment-symbol">↗</span><h2>{bill.draft ? 'Hóa đơn tạm tính' : bill.remaining <= 0 ? 'Thanh toán hoàn tất' : 'Thanh toán chuyển khoản'}</h2><p>{bill.draft ? (bill.reviewNote || 'Quản lý đang kiểm tra ảnh và chỉ số. Mã QR sẽ xuất hiện sau khi hóa đơn được phát hành.') : bill.remaining <= 0 ? 'Hệ thống đã ghi nhận thanh toán của hóa đơn này.' : bill.pending ? 'Biên lai đang chờ xác nhận. Hãy chờ đối soát trước khi chuyển thêm.' : 'Quét mã bằng ứng dụng ngân hàng. Số tiền và nội dung đã được điền sẵn.'}</p>{!bill.draft && bill.remaining > 0 && !bill.pending && <>{!payment ? <button type="button" className="bill-primary" onClick={() => setPayment(true)}>Hiện mã QR thanh toán →</button> : !hasBank ? <p className="bill-error" role="alert">Chủ trọ chưa cấu hình đủ thông tin ngân hàng. Vui lòng liên hệ quản lý.</p> : <><div className="payment-qr">{!qrFailed ? <img src={qr} alt={`QR thanh toán ${money(bill.remaining)}`} onError={() => setQrFailed(true)} /> : <div role="alert"><p>Chưa tải được mã QR.</p><button className="bill-link" onClick={() => setQrFailed(false)}>Thử lại</button></div>}</div><strong className="payment-amount">{money(bill.remaining)}</strong><dl><div><dt>Ngân hàng</dt><dd>{config.bank}</dd></div><div><dt>Chủ tài khoản</dt><dd>{config.accountName}</dd></div><div><dt>Số tài khoản</dt><dd><button className="bill-link" onClick={() => copy(config.account!)} aria-label="Sao chép số tài khoản">{config.account} ⧉</button></dd></div><div><dt>Nội dung</dt><dd><button className="bill-link" onClick={() => copy(bill.memo)} aria-label="Sao chép nội dung chuyển khoản">{bill.memo} ⧉</button></dd></div></dl><p role="status">{copied}</p><p className="payment-note">{config.autoPayment ? 'Thanh toán được tự động cập nhật khi ngân hàng báo tiền vào. Giữ nguyên nội dung chuyển khoản; không cần gửi biên lai.' : 'Hóa đơn chỉ được đánh dấu đã thanh toán sau khi giao dịch được xác nhận.'}</p></>}</>}</aside></div>}
    {paymentError && <p role="status" className="bill-error">{paymentError}</p>}<footer className="billing-footer"><span>SUNSILK RESIDENCE</span><span>Thông tin rõ ràng. Thanh toán thuận tiện.</span></footer>
  </div>
}
