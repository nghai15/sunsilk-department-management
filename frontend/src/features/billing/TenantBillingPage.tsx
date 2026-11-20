import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BillingNavigation } from './BillingNavigation'
import { supabase } from '../../services/supabase'
import { toBill, type BillRow } from './billingInvoice'
import { useAuth } from '../auth/useAuth'
import { TenantBillingFlow, type BillingConfig, type BillingInvoice, type BillingSubmission } from './TenantBillingFlow'

export default function TenantBillingPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const requestedContract = params.get('contract')
  const requestedPeriod = params.get('period')
  const [contracts, setContracts] = useState<{ id: string; phong_id: string }[]>([])
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    supabase.from('hop_dong').select('id, phong_id').eq('nguoi_thue_id', user!.id).eq('trang_thai', 'hieu_luc').then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError('Không tải được hợp đồng. Vui lòng tải lại trang.')
      else { setContracts(data ?? []); setSelected(data?.find(c => c.id === requestedContract)?.id ?? data?.[0]?.id ?? '') }
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [user, requestedContract])
  return <><BillingNavigation />{contracts.length > 1 && <div className="px-6 pb-3"><label className="text-sm">Hợp đồng <select value={selected} onChange={e => setSelected(e.target.value)}>{contracts.map((c, i) => <option value={c.id} key={c.id}>Hợp đồng {i + 1} · {c.id.slice(0, 8)}</option>)}</select></label></div>}{error ? <p role="alert" className="p-6">{error}</p> : !loaded ? <p className="p-6">Đang tải hợp đồng…</p> : !selected ? <p className="p-6">Bạn chưa có hợp đồng đang hiệu lực. Vui lòng liên hệ quản lý.</p> : <ConnectedBilling key={`${selected}-${requestedPeriod}`} requestedPeriod={requestedPeriod} contractId={selected} userId={user!.id} />}</>
}

function ConnectedBilling({ contractId, userId, requestedPeriod }: { contractId: string; userId: string; requestedPeriod: string | null }) {
  const [state, setState] = useState<{ config: BillingConfig; roomId: string; period: string }>()
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const refresh = () => setRevision(n => n + 1)
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const contract = await supabase.from('hop_dong').select('*').eq('id', contractId).single()
        if (contract.error) throw contract.error
        const room = await supabase.from('phong_tro').select('*').eq('id', contract.data.phong_id).single()
        if (room.error) throw room.error
        const property = await supabase.from('khu_tro').select('*').eq('id', room.data.khu_tro_id).single()
        if (property.error) throw property.error
        const entry = await supabase.rpc('trang_thai_nhap_cong_to', { p_id: contractId, p_ky: requestedPeriod && /^\d{4}-\d{2}-01$/.test(requestedPeriod) ? requestedPeriod : null })
        if (entry.error) throw entry.error
        const period = entry.data.period as string
        const rates = await supabase.rpc('gia_hop_dong', { p_id: contractId, p_ky: period })
        if (rates.error) throw rates.error
        const [readings, invoice] = await Promise.all([
          supabase.from('chi_so_cong_to').select('loai,chi_so_moi').eq('phong_id', room.data.id).lt('ky', period).order('ky', { ascending: false }),
          supabase.from('hoa_don').select('*,chi_tiet_hoa_don(dien_giai,so_tien,su_co_id)').eq('hop_dong_id', contractId).eq('ky', period).maybeSingle(),
        ])
        if (readings.error) throw readings.error
        if (invoice.error) throw invoice.error
        const electricity = readings.data.find(r => r.loai === 'dien'), water = readings.data.find(r => r.loai === 'nuoc')
        if ((!electricity || !water) && !invoice.data) throw new Error('Quản lý cần thiết lập chỉ số kỳ trước của cả hai công tơ trước khi bạn nhập kỳ này.')
        let initialBill: BillingInvoice | undefined
        if (invoice.data) {
          const payments = await supabase.from('thanh_toan').select('so_tien,trang_thai').eq('hoa_don_id', invoice.data.id)
          if (payments.error) throw payments.error
          initialBill = toBill(invoice.data, payments.data.filter(p => p.trang_thai === 'da_duyet').reduce((sum, p) => sum + Number(p.so_tien), 0), payments.data.some(p => p.trang_thai === 'cho_duyet'))
        }
        if (!cancelled) { setError(''); setState({ roomId: room.data.id, period, config: {
          entryWindow: entry.data, room: room.data.so_phong, property: property.data.ten, period: `${period.slice(5, 7)}/${period.slice(0, 4)}`,
          rent: Number(rates.data.rent), electricityRate: Number(rates.data.electricityRate), waterRate: Number(rates.data.waterRate),
          previousElectricity: invoice.data?.chi_so_dien_cu ?? electricity?.chi_so_moi ?? 0, previousWater: invoice.data?.chi_so_nuoc_cu ?? water?.chi_so_moi ?? 0,
          autoPayment: property.data.thanh_toan_tu_dong, bank: property.data.ma_bin_ngan_hang, account: property.data.so_tai_khoan, accountName: property.data.ten_tai_khoan, initialBill,
        } }) }
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được thông tin hóa đơn. Vui lòng tải lại trang.') }
    }
    void load()
    return () => { cancelled = true }
  }, [contractId, requestedPeriod, revision])

  async function submit(values: BillingSubmission) {
    if (!state) throw new Error('Chưa tải được thông tin phòng.')
    const entry = await supabase.rpc('trang_thai_nhap_cong_to', { p_id: contractId, p_ky: state.period })
    if (entry.error || !entry.data.allowed) { setRevision(n => n + 1); throw new Error(entry.error?.message ?? entry.data.reason) }
    const prefix = `${state.roomId}/${userId}/${crypto.randomUUID()}`
    const electricityPath = `${prefix}-dien.jpg`, waterPath = `${prefix}-nuoc.jpg`
    for (const [path, photo] of [[electricityPath, values.electricityPhoto], [waterPath, values.waterPhoto]] as const) {
      const upload = await supabase.storage.from('anh-cong-to').upload(path, photo.file, { contentType: 'image/jpeg', upsert: false })
      if (upload.error) throw new Error('Không tải được ảnh công tơ. Kiểm tra kết nối rồi thử lại.')
    }
    const result = await supabase.rpc('nguoi_thue_lap_hoa_don', {
      p_hop_dong_id: contractId, p_ky: state.period, p_dien: values.electricity, p_nuoc: values.water,
      p_anh_dien: electricityPath, p_anh_nuoc: waterPath,
      p_chup_dien: values.electricityPhoto.capturedAt, p_chup_nuoc: values.waterPhoto.capturedAt,
    })
    if (result.error) throw new Error(result.error.message)
    window.dispatchEvent(new Event('meter-submitted'))
    return toBill(result.data as BillRow)
  }
  if (error) return <p className="p-6" role="alert">{error}</p>
  if (!state) return <p className="p-6">Đang tải giá niêm yết và chỉ số kỳ trước…</p>
  return <TenantBillingFlow key={`${state.period}-${state.config.entryWindow?.allowed}-${state.config.initialBill?.id}-${state.config.initialBill?.draft}-${state.config.initialBill?.reviewNote}`} config={state.config} onSubmit={submit} />
}
