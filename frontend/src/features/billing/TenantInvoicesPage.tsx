import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'
import { BillingNavigation } from './BillingNavigation'
import { TenantReceipt } from './TenantReceipt'
import { TenantBillingFlow, money, type BillingConfig } from './TenantBillingFlow'
import { toBill, type BillRow } from './billingInvoice'

interface InvoiceRow extends BillRow {
  phong_id: string; hop_dong_id: string; ky: string;
  thang_nam: string;
  trang_thai_thanh_toan: string;
  phong_tro: { so_phong: string; khu_tro: {
    ten: string; thanh_toan_tu_dong: boolean; ma_bin_ngan_hang: string | null; so_tai_khoan: string | null; ten_tai_khoan: string | null;
  } | null } | null;
}
const labels: Record<string, string> = {
  chua_thanh_toan: 'Chưa thanh toán', cho_xac_nhan: 'Chờ xác nhận',
  thanh_toan_mot_phan: 'Đã thanh toán một phần', da_thanh_toan: 'Đã thanh toán', qua_han: 'Quá hạn',
}

export default function TenantInvoicesPage() {
  const { billId } = useParams()
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [config, setConfig] = useState<BillingConfig>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const paymentUpdated = useCallback((remaining: number, pending: boolean) => {
    setConfig(current => {
      if (!current?.initialBill || (current.initialBill.remaining === remaining && current.initialBill.pending === pending)) return current
      return { ...current, initialBill: { ...current.initialBill, remaining, pending } }
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(''); setConfig(undefined)
      try {
        let query = supabase.from('hoa_don').select(`*, chi_tiet_hoa_don(dien_giai,so_tien,su_co_id), phong_tro(so_phong, khu_tro(ten, thanh_toan_tu_dong, ma_bin_ngan_hang, so_tai_khoan, ten_tai_khoan))`).order('ky', { ascending: false })
        if (billId) query = query.eq('id', billId)
        const result = await query
        if (result.error) throw new Error('Không tải được hóa đơn. Vui lòng thử lại.')
        const rows = (result.data ?? []) as unknown as InvoiceRow[]
        if (billId) {
          const bill = rows[0]
          if (!bill) throw new Error('Hóa đơn chưa được phát hành, không tồn tại hoặc bạn không có quyền xem.')
          const payments = await supabase.from('thanh_toan').select('so_tien,trang_thai').eq('hoa_don_id', bill.id)
          if (payments.error) throw new Error('Không tải được tình trạng thanh toán. Vui lòng thử lại.')
          const paid = payments.data.filter(p => p.trang_thai === 'da_duyet').reduce((sum, p) => sum + Number(p.so_tien), 0)
          const property = bill.phong_tro?.khu_tro
          if (!cancelled) setConfig({
            room: bill.phong_tro?.so_phong ?? 'Theo hợp đồng', property: property?.ten ?? 'Hóa đơn theo hợp đồng',
            period: bill.thang_nam, rent: Number(bill.tien_phong),
            electricityRate: 0, waterRate: 0, previousElectricity: bill.chi_so_dien_cu, previousWater: bill.chi_so_nuoc_cu,
            autoPayment: property?.thanh_toan_tu_dong, bank: property?.ma_bin_ngan_hang ?? undefined, account: property?.so_tai_khoan ?? undefined,
            accountName: property?.ten_tai_khoan ?? undefined,
            initialBill: toBill(bill, paid, payments.data.some(p => p.trang_thai === 'cho_duyet')),
          })
        }
        if (!cancelled) setInvoices(rows)
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được hóa đơn.') }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [billId, user?.id, retry])

  return <>
    <BillingNavigation />
    {loading ? <p className="p-6" role="status">Đang tải hóa đơn…</p>
      : error ? <div className="p-6"><p role="alert">{error}</p><button className="mt-3 underline" onClick={() => setRetry(n => n + 1)}>Thử lại</button></div>
        : billId && config ? <>{invoices[0]?.la_ban_nhap && invoices[0]?.ghi_chu_kiem_tra && <div className="p-6" role="alert"><p className="bill-error">Yêu cầu gửi lại: {invoices[0].ghi_chu_kiem_tra}</p><Link className="bill-primary mt-3" to={`/billing/chi-so?contract=${invoices[0].hop_dong_id}&period=${invoices[0].ky}`}>Nhập và chụp lại công tơ</Link></div>}<TenantBillingFlow key={`${billId}-${retry}`} config={config} invoiceOnly onPaymentUpdated={paymentUpdated} />{config.initialBill && !config.initialBill.draft && !config.initialBill.pending && config.initialBill.remaining > 0 && invoices[0] && <details className="mx-6 my-4 rounded-xl border p-4"><summary className="cursor-pointer">Cần hỗ trợ đối soát? Gửi biên lai</summary><TenantReceipt billId={billId} roomId={invoices[0].phong_id} room={config.room} period={config.period} remaining={config.initialBill.remaining} onSent={() => setRetry(n => n + 1)} /></details>}</>
          : <main className="tenant-billing"><div className="billing-title"><div><p className="eyebrow">HÓA ĐƠN & THANH TOÁN</p><h1>Hóa đơn của bạn</h1><p>Theo dõi hóa đơn tạm tính, đã phát hành và thông tin thanh toán.</p></div></div>
            {invoices.length === 0 ? <section className="meter-card"><h2>Chưa có hóa đơn</h2><p>Hóa đơn sẽ xuất hiện ở đây sau khi được phát hành.</p></section>
              : <div className="meter-stack">{invoices.map(bill => <Link key={bill.id} to={`/billing/${bill.id}`} className="meter-card flex items-center justify-between gap-4 flex-wrap hover:border-emerald-700"><div><h2>Tháng {bill.thang_nam}</h2><p className="text-sm text-gray-500">{bill.phong_tro ? `Phòng ${bill.phong_tro.so_phong} · ` : ''}Hạn {new Date(`${bill.han_thanh_toan}T00:00:00`).toLocaleDateString('vi-VN')}</p><span className="text-xs">{bill.la_ban_nhap ? (bill.ghi_chu_kiem_tra ? 'Cần nhập và chụp lại công tơ' : 'Chờ kiểm tra chỉ số') : labels[bill.trang_thai_thanh_toan] ?? bill.trang_thai_thanh_toan}</span></div><div className="text-right"><strong className="text-xl">{money(Number(bill.tong_tien))}</strong><p className="text-sm">Xem hóa đơn →</p></div></Link>)}</div>}
          </main>}
  </>
}
