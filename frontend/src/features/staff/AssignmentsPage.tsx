import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../services/supabase'
import { inputClass, primaryClass, errorMessage, Modal } from '../../components/Modal'

type Assignment = { khu_tro_id: string; nguoi_dung_id: string }
export default function AssignmentsPage() {
  const [areas, setAreas] = useState<{ id: string; ten: string }[]>([])
  const [staff, setStaff] = useState<{ id: string; ho_ten: string; so_dien_thoai: string }[]>([])
  const [rows, setRows] = useState<Assignment[]>([])
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<Assignment>()
  useEffect(() => {
    let cancelled = false; setLoading(true)
    async function load() {
      const [a, s, r] = await Promise.all([supabase.from('khu_tro').select('id,ten'), supabase.from('nguoi_dung').select('id,ho_ten,so_dien_thoai').eq('vai_tro', 'quan_ly').eq('dang_hoat_dong', true), supabase.from('nhan_su_khu_tro').select('*')])
      if (cancelled) return
      if (a.error || s.error || r.error) setError('Không tải được phân công.')
      else { setAreas(a.data); setStaff(s.data); setRows(r.data) }
      setLoading(false)
    }
    void load(); return () => { cancelled = true }
  }, [revision])
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const data = new FormData(event.currentTarget); setBusy(true); setError('')
    const result = await supabase.from('nhan_su_khu_tro').insert({ khu_tro_id: data.get('area'), nguoi_dung_id: data.get('staff') })
    setBusy(false)
    if (result.error) setError(errorMessage(result.error)); else setRevision(n => n + 1)
  }
  async function remove() {
    if (!removing || busy) return
    setBusy(true); setError('')
    const result = await supabase.from('nhan_su_khu_tro').delete().eq('khu_tro_id', removing.khu_tro_id).eq('nguoi_dung_id', removing.nguoi_dung_id)
    setBusy(false)
    if (result.error) setError(errorMessage(result.error)); else { setRemoving(undefined); setRevision(n => n + 1) }
  }
  return <main className="p-6"><h1 className="text-2xl font-semibold">Phân công quản lý</h1><p className="my-3 text-sm text-gray-500">Quản lý chỉ xem và xử lý dữ liệu tại các khu được phân công.</p>{error && <p role="alert" className="my-4 text-red-700">{error}</p>}
    <form onSubmit={add} className="my-6 grid items-end gap-4 rounded-xl border bg-white p-5 sm:grid-cols-3"><label className="text-sm">Khu trọ<select name="area" required className={inputClass}><option value="">Chọn khu</option>{areas.map(a => <option key={a.id} value={a.id}>{a.ten}</option>)}</select></label><label className="text-sm">Quản lý<select required name="staff" className={inputClass}><option value="">Chọn quản lý</option>{staff.map(s => <option key={s.id} value={s.id}>{s.ho_ten} · {s.so_dien_thoai}</option>)}</select></label><button className={primaryClass} disabled={busy || loading}>Thêm phân công</button></form>
    {loading ? <p>Đang tải…</p> : <div className="space-y-3">{rows.map(r => <article className="flex items-center justify-between gap-4 rounded-xl border bg-white p-5" key={`${r.khu_tro_id}-${r.nguoi_dung_id}`}><div><h2 className="font-semibold">{areas.find(a => a.id === r.khu_tro_id)?.ten}</h2><p className="mt-1 text-sm">{staff.find(s => s.id === r.nguoi_dung_id)?.ho_ten ?? 'Tài khoản không còn là quản lý hoạt động'}</p></div><button className="text-sm text-red-700 underline" onClick={() => setRemoving(r)}>Gỡ phân công</button></article>)}{!rows.length && <p>Chưa có phân công quản lý.</p>}</div>}
    {removing && <Modal title="Gỡ phân công quản lý?" busy={busy} onClose={() => setRemoving(undefined)}><p>Nhân sự này sẽ không còn quyền quản lý khu trọ đã chọn.</p><button disabled={busy} className="mt-5 rounded-lg bg-red-700 px-4 py-2 text-white" onClick={() => void remove()}>Xác nhận gỡ</button></Modal>}
  </main>
}
