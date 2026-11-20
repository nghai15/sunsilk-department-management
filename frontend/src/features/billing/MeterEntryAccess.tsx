import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../services/supabase'
import { inputClass, primaryClass, errorMessage } from '../../components/Modal'

export function MeterEntryAccess() {
  const [contracts, setContracts] = useState<{ id: string; phong_tro: { so_phong: string } | null; nguoi_thue: { ho_ten: string } | null }[]>([])
  const [id, setId] = useState('')
  const [period, setPeriod] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(0)
  const [history, setHistory] = useState<{ id: string; ky: string; den_luc: string; ly_do: string; su_dung_luc: string | null }[]>([])
  useEffect(() => {
    let cancelled = false
    void supabase.from('hop_dong').select('id,phong_tro(so_phong),nguoi_thue:nguoi_dung!hop_dong_nguoi_thue_id_fkey(ho_ten)').eq('trang_thai','hieu_luc').order('id').range(page * 50, page * 50 + 49).then(result => {
      if (cancelled) return
      if (result.error) setError(errorMessage(result.error)); else setContracts(result.data as unknown as typeof contracts)
    })
    return () => { cancelled = true }
  }, [page])
  useEffect(() => {
    let cancelled = false; setHistory([])
    if (id) void supabase.from('mo_nhap_cong_to').select('id,ky,den_luc,ly_do,su_dung_luc').eq('hop_dong_id',id).order('tao_luc',{ascending:false}).limit(10).then(result => { if (!cancelled) { if (result.error) setError(errorMessage(result.error)); else setHistory(result.data ?? []) } })
    return () => { cancelled = true }
  }, [id, message])
  async function open(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return
    const data = new FormData(e.currentTarget); setBusy(true); setError(''); setMessage('')
    const result = await supabase.rpc('mo_bo_sung_cong_to',{ p_id:id,p_ky:`${period}-01`,p_gio:Number(data.get('hours')),p_ly_do:data.get('reason') })
    setBusy(false)
    if (result.error) setError(errorMessage(result.error)); else setMessage('Đã mở thời gian nhập bổ sung và thông báo cho người thuê.')
  }
  return <section className="meter-card"><h2>Mở nhập chỉ số bổ sung</h2><p className="mt-2 text-sm text-gray-500">Dành cho kỳ đã quá hạn nhập và chưa có hóa đơn. Nếu người thuê đã gửi, dùng “Yêu cầu kiểm tra lại” trong chi tiết hóa đơn nháp. Mỗi lần mở có hiệu lực tối đa 72 giờ, tự đóng sau khi gửi.</p><form onSubmit={open} className="mt-5 space-y-4"><label className="block text-sm">Phòng / người thuê<select required className={inputClass} value={id} onChange={e=>setId(e.target.value)} disabled={busy}><option value="">Chọn hợp đồng</option>{contracts.map(c=><option key={c.id} value={c.id}>Phòng {c.phong_tro?.so_phong} · {c.nguoi_thue?.ho_ten}</option>)}</select></label><div className="flex gap-3 text-sm"><button type="button" disabled={!page||busy} onClick={()=>{setPage(n=>n-1);setId('')}}>← Danh sách trước</button><button type="button" disabled={contracts.length<50||busy} onClick={()=>{setPage(n=>n+1);setId('')}}>Danh sách sau →</button></div><label className="block text-sm">Kỳ điện nước<input type="month" required className={inputClass} value={period} onChange={e=>setPeriod(e.target.value)} disabled={busy} /></label><label className="block text-sm">Mở trong bao nhiêu giờ<input type="number" name="hours" min="1" max="72" defaultValue="24" required className={inputClass} disabled={busy} /></label><label className="block text-sm">Lý do mở bổ sung<textarea name="reason" required maxLength={1000} className={inputClass} disabled={busy} /></label>{error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status" className="text-emerald-800">{message}</p>}<button disabled={busy} className={primaryClass}>{busy?'Đang lưu…':'Mở bổ sung và thông báo'}</button></form>{history.length>0 && <div className="mt-5 border-t pt-4"><h3>Lịch sử mở bổ sung gần nhất</h3>{history.map(item=><p key={item.id} className="mt-3 text-sm">Kỳ {item.ky.slice(0,7)} · {item.su_dung_luc?'Đã gửi chỉ số':`Hết hiệu lực: ${new Date(item.den_luc).toLocaleString('vi-VN')}`}<span className="block text-gray-500">{item.ly_do}</span></p>)}</div>}</section>
}
