import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'
import { money } from './TenantBillingFlow'

interface PriceTarget { id: string; label: string; value: number; type: string }
interface PriceSchedule { id: string; loai: string; doi_tuong_id: string; tu_ky: string; don_gia: number; ly_do: string; nguoi_tao_id: string | null; tao_luc: string }
const names: Record<string, string> = { dien: 'Điện / kWh', nuoc: 'Nước / m³', phong: 'Tiền phòng / tháng', dich_vu: 'Phí dịch vụ' }
const input = 'border border-gray-300 rounded-lg bg-white px-3 py-2 block w-full mt-1'

export function BillingPrices() {
  const [targets, setTargets] = useState<PriceTarget[]>([])
  const [history, setHistory] = useState<PriceSchedule[]>([])
  const [selected, setSelected] = useState('')
  const [price, setPrice] = useState('')
  const [month, setMonth] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    async function load() {
      const [areas, rooms, services, scheduled] = await Promise.all([
        supabase.from('khu_tro').select('id,ten,don_gia_dien,don_gia_nuoc'),
        supabase.from('phong_tro').select('id,so_phong,gia_thue_co_ban,khu_tro(ten)'),
        supabase.from('phi_dich_vu').select('id,ten,so_tien,khu_tro(ten)').eq('dang_hoat_dong', true),
        supabase.from('lich_don_gia').select('*').order('tu_ky', { ascending: false }),
      ])
      if (cancelled) return
      if (areas.error || rooms.error || services.error || scheduled.error) setError('Không tải được cấu hình giá. Kiểm tra database đã cập nhật rồi thử lại.')
      else {
        const areaTargets = areas.data.flatMap(k => [{ id: k.id, label: k.ten, type: 'dien', value: Number(k.don_gia_dien) }, { id: k.id, label: k.ten, type: 'nuoc', value: Number(k.don_gia_nuoc) }])
        setTargets([...areaTargets, ...rooms.data.map(r => ({ id: r.id, label: `${(r.khu_tro as unknown as { ten: string } | null)?.ten ?? ''} · ${r.so_phong}`, type: 'phong', value: Number(r.gia_thue_co_ban) })), ...services.data.map(s => ({ id: s.id, label: `${(s.khu_tro as unknown as { ten: string } | null)?.ten ?? ''} · ${s.ten}`, type: 'dich_vu', value: Number(s.so_tien) }))])
        setHistory(scheduled.data)
      }
      setLoading(false)
    }
    void load(); return () => { cancelled = true }
  }, [revision])
  const target = targets.find(t => `${t.type}:${t.id}` === selected)
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!target || busy || !month || !reason.trim() || price.trim() === '' || !Number.isFinite(Number(price)) || Number(price) < 0) return
    setBusy(true); setError(''); setMessage('')
    const { error: err } = await supabase.rpc('dat_don_gia', { p_loai: target.type, p_id: target.id, p_tu_ky: `${month}-01`, p_gia: Number(price), p_ly_do: reason })
    setBusy(false)
    if (err) setError(err.code === '23505' ? 'Đã có đơn giá cho đối tượng và kỳ này. Chọn một kỳ khác.' : err.message)
    else { setMessage(`Đã lên lịch giá ${money(Number(price))} từ kỳ ${month}.`); setReason(''); setRevision(n => n + 1) }
  }
  return <div className="space-y-5"><section className="meter-card"><h2>Đơn giá theo kỳ</h2><p className="text-sm text-gray-500 mt-2">Giá mới áp dụng từ tháng sau trở đi. Hóa đơn đã lập giữ nguyên đơn giá và tổng tiền.</p>
    {error && <p className="bill-error my-3" role="alert">{error} <button className="underline" onClick={() => setRevision(n => n + 1)}>Tải lại</button></p>}{message && <p className="text-emerald-800 my-3" role="status">{message}</p>}
    <form onSubmit={save} className="grid sm:grid-cols-2 gap-4 mt-5"><label>Khoản thu<select required className={input} value={selected} disabled={loading || busy} onChange={e => { setSelected(e.target.value); setPrice('') }}><option value="">Chọn khu / phòng / dịch vụ</option>{targets.map(t => <option key={`${t.type}:${t.id}`} value={`${t.type}:${t.id}`}>{names[t.type]} · {t.label}</option>)}</select></label><label>Đơn giá mới (đồng)<input className={input} type="number" min="0" max="9999999999" step="1" required value={price} onChange={e => setPrice(e.target.value)} disabled={busy} /></label><label>Áp dụng từ tháng<input className={input} type="month" required value={month} onChange={e => setMonth(e.target.value)} disabled={busy} /></label><label>Lý do thay đổi<input className={input} required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></label><button disabled={busy || loading || !target} className="bill-primary sm:col-span-2" type="submit">{busy ? 'Đang lưu…' : 'Lưu lịch áp dụng giá'}</button></form>
  </section><section className="meter-card"><h2 className="mb-4">Lịch áp dụng & người thay đổi</h2>{loading ? <p>Đang tải…</p> : history.length === 0 ? <p className="text-gray-500 text-sm">Chưa có lịch thay đổi đơn giá.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{['Khoản thu', 'Đối tượng', 'Từ kỳ', 'Đơn giá', 'Lý do / người tạo'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{history.map(h => <tr key={h.id} className="border-t"><td className="p-3">{names[h.loai]}</td><td className="p-3">{targets.find(t => t.id === h.doi_tuong_id && t.type === h.loai)?.label ?? h.doi_tuong_id}</td><td className="p-3 whitespace-nowrap">{h.tu_ky.slice(0, 7)}</td><td className="p-3 whitespace-nowrap">{money(Number(h.don_gia))}</td><td className="p-3">{h.ly_do}<small className="block text-gray-500">{h.nguoi_tao_id?.slice(0, 8)} · {new Date(h.tao_luc).toLocaleString('vi-VN')}</small></td></tr>)}</tbody></table></div>}</section></div>
}
