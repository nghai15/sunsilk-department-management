import { ContractRequests, OriginalContract } from './ContractTools'
import { SettlementDialog, SettlementRecord } from './ContractSettlement'
import { sixMonthsAfter } from './contractDates'
import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'
import { Modal, inputClass, primaryClass, errorMessage } from '../../components/Modal'
import TenantContractPage from './TenantContractPage'

type Contract = { id: string; phong_id: string; nguoi_thue_id: string; ngay_bat_dau: string; ngay_ket_thuc: string | null; gia_thue: number; tien_coc: number; ngay_thanh_toan: number; so_nguoi_o: number; trang_thai: string; ghi_chu: string | null; phong_tro: { so_phong: string; khu_tro: { ten: string } | null } | null; nguoi_thue: { ho_ten: string; so_dien_thoai: string } | null }
type Room = { id: string; so_phong: string; khu_tro_id: string; gia_thue_co_ban: number; tien_coc: number; so_nguoi_toi_da: number; khu_tro: { ten: string } | null }
type Service = { id: string; khu_tro_id: string; ten: string; so_tien: number; cach_tinh: string }
const money = (n: number) => Number(n).toLocaleString('vi-VN') + ' ₫'
const date = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('vi-VN')
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())

export default function ContractsPage() {
  const { user } = useAuth()
  return user?.vaiTro === 'nguoi_thue' ? <TenantContractPage /> : <StaffContractsPage />
}

function StaffContractsPage() {
  const { user } = useAuth()
  const canWrite = user?.vaiTro === 'chu_tro' || user?.vaiTro === 'quan_tri'
  const [rows, setRows] = useState<Contract[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [tenants, setTenants] = useState<{ id: string; ho_ten: string; so_dien_thoai: string }[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedServices, setSelectedServices] = useState<Record<string, number>>({})
  const [roomId, setRoomId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Contract>()
  const [ending, setEnding] = useState<Contract>()
  const room = rooms.find(r => r.id === roomId)
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('')
    async function load() {
      let query = supabase.from('hop_dong').select('*,phong_tro(so_phong,khu_tro(ten)),nguoi_thue:nguoi_dung!hop_dong_nguoi_thue_id_fkey(ho_ten,so_dien_thoai)', { count: 'exact' }).order('tao_luc', { ascending: false }).order('id').range(page * 20, page * 20 + 19)
      if (status) query = query.eq('trang_thai', status)
      const list = await query
      if (cancelled) return
      if (list.error) setError(errorMessage(list.error))
      else { setRows(list.data as unknown as Contract[]); setCount(list.count ?? 0) }
      setLoading(false)
    }
    void load(); return () => { cancelled = true }
  }, [status, page, revision])
  async function openCreate() {
    setBusy(true); setError('')
    const [r, t, s] = await Promise.all([
      supabase.from('phong_tro').select('id,so_phong,khu_tro_id,gia_thue_co_ban,tien_coc,so_nguoi_toi_da,khu_tro(ten)').eq('trang_thai', 'trong').order('so_phong'),
      supabase.from('nguoi_dung').select('id,ho_ten,so_dien_thoai').eq('vai_tro', 'nguoi_thue').eq('dang_hoat_dong', true).order('ho_ten'),
      supabase.from('phi_dich_vu').select('id,khu_tro_id,ten,so_tien,cach_tinh').eq('dang_hoat_dong', true),
    ])
    setBusy(false)
    if (r.error || t.error || s.error) { setError('Không tải được thông tin tạo hợp đồng.'); return }
    setRooms(r.data as unknown as Room[]); setTenants(t.data); setServices(s.data); setRoomId(''); setSelectedServices({}); setCreating(true)
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !room) return
    setBusy(true); setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const result = await supabase.rpc('tao_hop_dong_day_du', { p_du_lieu: { ...data, phong_id: room.id, dich_vu: Object.entries(selectedServices).filter(([, n]) => n > 0).map(([id, so_luong]) => ({ id, so_luong })) } })
    setBusy(false)
    if (result.error) setError(errorMessage(result.error))
    else { setCreating(false); setRevision(n => n + 1); setMessage('Đã tạo hợp đồng, áp dụng dịch vụ và chuẩn bị chỉ số ban đầu.'); setPage(0) }
  }
  return <main className="p-6"><div className="mb-6 flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-semibold">Hợp đồng thuê</h1><p className="mt-2 text-sm text-gray-500">Theo dõi người thuê, thời hạn và các khoản thu.</p></div>{canWrite && <button className={primaryClass} disabled={busy} onClick={() => void openCreate()}>+ Tạo hợp đồng</button>}</div>
    {canWrite && <ContractRequests onChanged={() => setRevision(n => n + 1)} />}
    <label className="block max-w-xs text-sm mb-5">Trạng thái<select className={inputClass} value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}><option value="">Tất cả</option><option value="hieu_luc">Đang hiệu lực</option><option value="cham_dut">Đã kết thúc</option><option value="het_han">Hết hạn</option></select></label>
    {error && !creating && !ending && <p role="alert" className="my-4 text-red-700">{error}<button className="ml-2 underline" onClick={() => setRevision(n => n + 1)}>Thử lại</button></p>}{message && <p role="status" className="my-4 text-emerald-800">{message}</p>}
    {loading ? <p>Đang tải…</p> : <div className="grid gap-4 md:grid-cols-2">{rows.map(c => <article key={c.id} className="rounded-xl border bg-white p-5"><div className="flex justify-between gap-3"><h2 className="font-semibold">Phòng {c.phong_tro?.so_phong} · {c.phong_tro?.khu_tro?.ten}</h2><span className="text-xs text-emerald-800">{c.trang_thai === 'hieu_luc' ? 'Đang hiệu lực' : 'Đã kết thúc'}</span></div><p className="mt-3">{c.nguoi_thue?.ho_ten}</p><p className="mt-1 text-sm text-gray-500">{date(c.ngay_bat_dau)} → {c.ngay_ket_thuc ? date(c.ngay_ket_thuc) : 'Không thời hạn'}</p><p className="mt-3 font-semibold">{money(c.gia_thue)} / tháng</p><div className="mt-4 flex flex-wrap gap-4 text-sm"><button className="text-emerald-900 underline" onClick={() => setSelected(c)}>Chi tiết</button><OriginalContract id={c.id} editable={canWrite} />{canWrite && c.trang_thai !== 'hieu_luc' && <SettlementRecord id={c.id} />}{canWrite && c.trang_thai === 'hieu_luc' && <button className="text-red-700 underline" onClick={() => { setError(''); setEnding(c) }}>Quyết toán & trả phòng</button>}</div></article>)}{!rows.length && <p className="text-gray-500">Chưa có hợp đồng phù hợp.</p>}</div>}
    <div className="mt-5 flex justify-end gap-4 text-sm"><button disabled={!page || loading} onClick={() => setPage(n => n - 1)}>← Trước</button><span>{count} hợp đồng · Trang {page + 1}</span><button disabled={(page + 1) * 20 >= count || loading} onClick={() => setPage(n => n + 1)}>Sau →</button></div>
    {creating && <Modal title="Tạo hợp đồng thuê" busy={busy} onClose={() => setCreating(false)}><form onSubmit={create} className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Phòng trống<select required className={inputClass} value={roomId} onChange={e => { setRoomId(e.target.value); setSelectedServices({}) }}><option value="">Chọn phòng</option>{rooms.map(r => <option value={r.id} key={r.id}>{r.khu_tro?.ten} · {r.so_phong}</option>)}</select></label><label className="text-sm">Người thuê<select required name="nguoi_thue_id" className={inputClass}><option value="">Chọn người thuê</option>{tenants.map(t => <option value={t.id} key={t.id}>{t.ho_ten} · {t.so_dien_thoai}</option>)}</select></label>
      {room && <fieldset key={room.id} className="contents">{[{ key: 'ngay_bat_dau', label: 'Ngày bắt đầu', type: 'date', value: today() }, { key: 'ngay_ket_thuc', label: 'Ngày hết hạn', type: 'date', value: sixMonthsAfter(today()) }, { key: 'gia_thue', label: 'Giá thuê / tháng', value: room.gia_thue_co_ban }, { key: 'tien_coc', label: 'Tiền cọc', value: room.tien_coc }, { key: 'ngay_thanh_toan', label: 'Ngày thanh toán mỗi tháng (1–28)', value: 5 }, { key: 'so_nguoi_o', label: 'Số người ở', value: 1 }, { key: 'dien_ban_dau', label: 'Chỉ số điện bàn giao', value: 0 }, { key: 'nuoc_ban_dau', label: 'Chỉ số nước bàn giao', value: 0 }].map(f => <label key={f.key} className="text-sm">{f.label}<input name={f.key} type={f.type ?? 'number'} required className={inputClass} defaultValue={f.value} min={f.type ? undefined : f.key === 'ngay_thanh_toan' || f.key === 'so_nguoi_o' ? 1 : 0} max={f.key === 'ngay_thanh_toan' ? 28 : f.key === 'so_nguoi_o' ? room.so_nguoi_toi_da : f.key === 'ngay_bat_dau' ? today() : undefined} /></label>)}</fieldset>}
      <p className="text-xs text-gray-500 sm:col-span-2">Chỉ số bàn giao dùng để khởi tạo kỳ trước nếu phòng chưa có lịch sử. Chỉ số đã lưu không bị ghi đè. Giá thuê tính theo tháng, chưa chia theo ngày.</p>
      <fieldset className="sm:col-span-2"><legend className="font-medium mb-2">Dịch vụ áp dụng</legend>{services.filter(s => s.khu_tro_id === room?.khu_tro_id).map(s => <div key={s.id} className="flex items-center gap-3 py-2"><label className="flex flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(selectedServices[s.id])} onChange={e => setSelectedServices(v => ({ ...v, [s.id]: e.target.checked ? 1 : 0 }))} />{s.ten} · {money(s.so_tien)} / {{ theo_phong: 'phòng', theo_nguoi: 'người', theo_don_vi: 'đơn vị' }[s.cach_tinh]}</label>{selectedServices[s.id] > 0 && s.cach_tinh === 'theo_don_vi' && <input aria-label={`Số lượng ${s.ten}`} type="number" min="1" max="1000" className="w-20 rounded border p-2" value={selectedServices[s.id]} onChange={e => setSelectedServices(v => ({ ...v, [s.id]: Number(e.target.value) }))} />}</div>)}</fieldset>
      <label className="sm:col-span-2 text-sm">Ghi chú<textarea name="ghi_chu" maxLength={2000} className={inputClass} /></label>{error && <p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}<button disabled={busy || !room} className={`${primaryClass} sm:col-span-2`}>{busy ? 'Đang tạo…' : 'Tạo hợp đồng'}</button>
    </form></Modal>}
    {selected && <Modal title={`Hợp đồng phòng ${selected.phong_tro?.so_phong}`} onClose={() => setSelected(undefined)}><dl className="grid gap-4 sm:grid-cols-2">{[['Người thuê', selected.nguoi_thue?.ho_ten], ['Số điện thoại', selected.nguoi_thue?.so_dien_thoai], ['Bắt đầu', date(selected.ngay_bat_dau)], ['Hết hạn dự kiến', selected.ngay_ket_thuc ? date(selected.ngay_ket_thuc) : 'Không thời hạn'], ['Giá thuê', money(selected.gia_thue)], ['Tiền cọc', money(selected.tien_coc)], ['Ngày thanh toán', selected.ngay_thanh_toan], ['Số người', selected.so_nguoi_o]].map(([label, value]) => <div key={String(label)}><dt className="text-sm text-gray-500">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl><p className="mt-5 whitespace-pre-wrap text-sm">{selected.ghi_chu}</p><p className="mt-4 text-xs text-gray-500">Giá áp dụng theo kỳ được thể hiện trên hóa đơn.</p></Modal>}
    {ending && <SettlementDialog id={ending.id} onClose={() => setEnding(undefined)} onDone={() => { setEnding(undefined); setRevision(n => n + 1); setMessage('Đã quyết toán, kết thúc hợp đồng và chuyển phòng về trạng thái trống.') }} />}
  </main>
}
