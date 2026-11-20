import { SettlementRecord } from './ContractSettlement'
import { ContractRequests, OriginalContract } from './ContractTools'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'
import { contractTerm } from './contractTerm'

type Contract = { id: string; ngay_bat_dau: string; ngay_ket_thuc: string; gia_thue: number; tien_coc: number; ngay_thanh_toan: number; so_nguoi_o: number; trang_thai: string; ghi_chu: string | null; phong_tro: { so_phong: string; khu_tro: { ten: string } | null } | null }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const date = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN')
const money = (value: number) => `${Number(value).toLocaleString('vi-VN')} ₫`

export default function TenantContractPage() {
  const { user } = useAuth()
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [currentDay, setCurrentDay] = useState(today)
  useEffect(() => {
    const timer = setInterval(() => setCurrentDay(today()), 60000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const query = () => supabase.from('hop_dong').select('id,ngay_bat_dau,ngay_ket_thuc,gia_thue,tien_coc,ngay_thanh_toan,so_nguoi_o,trang_thai,ghi_chu,phong_tro(so_phong,khu_tro(ten))').eq('nguoi_thue_id', user.id)
    async function load() {
      try {
        const active = await query().eq('trang_thai', 'hieu_luc').limit(2)
        if (active.error) throw active.error
        if (active.data.length > 1) throw new Error('Tài khoản đang có nhiều hợp đồng hiệu lực. Vui lòng liên hệ chủ trọ để kiểm tra.')
        const result = active.data.length ? active : await query().order('ngay_bat_dau', { ascending: false }).order('tao_luc', { ascending: false }).order('id').limit(1)
        if (result.error) throw result.error
        if (!cancelled) { setContract((result.data[0] as unknown as Contract) ?? null); setError('') }
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được hợp đồng. Vui lòng thử lại.') }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [user, revision])
  const term = contract ? contractTerm(contract.trang_thai, contract.ngay_ket_thuc, currentDay) : null
  return <main className="mx-auto max-w-4xl p-4 py-8 sm:p-8">
    <p className="text-xs font-semibold tracking-widest text-emerald-700">SUNSILK / HỢP ĐỒNG</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Hợp đồng của bạn</h1>
    <p className="mt-2 mb-7 text-sm text-gray-500">Thông tin thuê phòng và thời hạn hợp đồng.</p>
    {loading ? <p role="status" className="rounded-2xl border border-gray-200 bg-white p-8">Đang tải hợp đồng…</p> : error ? <div role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">{error}<button className="ml-3 underline" onClick={() => { setLoading(true); setRevision(n => n + 1) }}>Thử lại</button></div> : !contract ? <section className="rounded-2xl border border-gray-200 bg-white p-8"><h2 className="font-semibold">Chưa có hợp đồng thuê</h2><p className="mt-2 text-sm text-gray-500">Liên hệ chủ trọ hoặc quản trị viên để được cập nhật hợp đồng.</p></section> : <>
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-4 bg-emerald-900 p-6 text-white sm:p-8"><div><p className="text-sm text-emerald-100">{contract.phong_tro?.khu_tro?.ten}</p><h2 className="mt-2 text-2xl font-semibold">Phòng {contract.phong_tro?.so_phong ?? '—'}</h2><p className="mt-2 text-sm text-emerald-100">{user?.hoTen}</p></div><Link to="/billing" className="rounded-lg border border-emerald-600 px-4 py-3 text-sm hover:bg-emerald-800">Hóa đơn & thanh toán →</Link></header>
        <div className="p-6 sm:p-8"><div role="status" className={`rounded-xl border p-5 ${term?.tone === 'expired' ? 'border-red-200 bg-red-50 text-red-800' : term?.tone === 'soon' ? 'border-amber-200 bg-amber-50 text-amber-900' : term?.tone === 'neutral' ? 'border-gray-200 bg-gray-50 text-gray-700' : 'border-emerald-100 bg-emerald-50 text-emerald-900'}`}><p className="text-xs font-semibold uppercase tracking-wider">Thời hạn hợp đồng</p><p className="mt-2 text-2xl font-semibold">{term?.label}</p><p className="mt-2 text-sm">{term?.detail}</p></div>
          <dl className="mt-7 grid gap-6 sm:grid-cols-2">{[
            ['Ngày bắt đầu', date(contract.ngay_bat_dau)], ['Ngày kết thúc', contract.ngay_ket_thuc ? date(contract.ngay_ket_thuc) : 'Không xác định thời hạn'],
            ['Giá thuê trong hợp đồng', `${money(contract.gia_thue)} / tháng`], ['Tiền đặt cọc', money(contract.tien_coc)],
            ['Ngày thanh toán', `Ngày ${contract.ngay_thanh_toan} hằng tháng`], ['Số người ở', `${contract.so_nguoi_o} người`],
          ].map(([label, value]) => <div key={label} className="border-b border-gray-100 pb-5"><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-2 font-semibold">{value}</dd></div>)}</dl>
          {contract.ghi_chu && <div className="mt-6"><h3 className="text-sm font-semibold">Ghi chú hợp đồng</h3><p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{contract.ghi_chu}</p></div>}
          <div className="mt-6"><OriginalContract id={contract.id} editable={false} />{contract.trang_thai !== 'hieu_luc' && <div className="mt-3"><SettlementRecord id={contract.id} /></div>}</div><ContractRequests contractId={contract.id} end={contract.ngay_ket_thuc} active={contract.trang_thai === 'hieu_luc'} onChanged={() => setRevision(n => n + 1)} />
          <p className="mt-6 text-xs leading-relaxed text-gray-500">Giá và dịch vụ áp dụng theo từng kỳ được thể hiện trên hóa đơn. Liên hệ chủ trọ nếu bạn cần gia hạn hoặc thay đổi thông tin hợp đồng.</p>
        </div>
      </section>
    </>}
  </main>
}
