import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'
import { inputClass, primaryClass, errorMessage } from '../../components/Modal'

type Notice = { id: string; tieu_de: string; noi_dung: string; duong_dan: string | null; tao_luc: string; doc_luc: string | null }
export default function NotificationsPage() {
  const { user } = useAuth()
  const staff = user?.vaiTro !== 'nguoi_thue'
  const [rows, setRows] = useState<Notice[]>([])
  const [areas, setAreas] = useState<{ id: string; ten: string }[]>([])
  const [unread, setUnread] = useState(false)
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [compose, setCompose] = useState(false)
  useEffect(() => {
    let cancelled = false; setLoading(true)
    async function load() {
      let query = supabase.from('thong_bao').select('*', { count: 'exact' }).order('tao_luc', { ascending: false }).order('id').range(page * 20, page * 20 + 19)
      if (unread) query = query.is('doc_luc', null)
      const result = await query
      if (cancelled) return
      if (result.error) setError(errorMessage(result.error)); else { setRows(result.data ?? []); setCount(result.count ?? 0) }
      setLoading(false)
    }
    void load(); return () => { cancelled = true }
  }, [page, unread, revision])
  useEffect(() => {
    const channel = supabase.channel(`notifications-${user?.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thong_bao', filter: `nguoi_nhan_id=eq.${user?.id}` }, () => setRevision(n => n + 1)).subscribe()
    const timer = setInterval(() => setRevision(n => n + 1), 30000)
    return () => { void supabase.removeChannel(channel); clearInterval(timer) }
  }, [user?.id])
  async function markRead(id?: string) {
    setBusy(true); setError('')
    let query = supabase.from('thong_bao').update({ doc_luc: new Date().toISOString() }).eq('nguoi_nhan_id', user!.id).is('doc_luc', null)
    if (id) query = query.eq('id', id)
    const { error: err } = await query
    setBusy(false)
    if (err) setError(errorMessage(err)); else setRevision(n => n + 1)
  }
  async function openCompose() {
    setError('')
    const result = await supabase.from('khu_tro').select('id,ten').order('ten')
    if (result.error) setError(errorMessage(result.error)); else { setAreas(result.data); setCompose(v => !v) }
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const form = event.currentTarget; const data = new FormData(form)
    setBusy(true); setError('')
    const result = await supabase.rpc('gui_thong_bao_chung', { p_khu_tro_id: data.get('area'), p_tieu_de: String(data.get('title')).trim(), p_noi_dung: String(data.get('body')).trim() })
    setBusy(false)
    if (result.error) setError(errorMessage(result.error))
    else { setMessage(`Đã gửi thông báo đến ${result.data.so_nguoi_nhan} người thuê đang có hợp đồng trong khu.`); form.reset(); setCompose(false) }
  }
  async function enablePush() {
    setBusy(true); setError('')
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Trình duyệt này chưa hỗ trợ thông báo đẩy.')
      if (await Notification.requestPermission() !== 'granted') throw new Error('Bạn chưa cho phép nhận thông báo trên thiết bị này.')
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const key = import.meta.env.VITE_VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/')
      const bytes = Uint8Array.from(atob(key.padEnd(Math.ceil(key.length / 4) * 4, '=')), c => c.charCodeAt(0))
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
      const json = subscription.toJSON()
      const result = await supabase.from('dang_ky_push').upsert({ nguoi_dung_id: user!.id, endpoint: subscription.endpoint, p256dh: json.keys!.p256dh, khoa_auth: json.keys!.auth }, { onConflict: 'endpoint' })
      if (result.error) throw result.error
      setMessage('Đã bật thông báo trên thiết bị này.')
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <main className="p-6"><div className="mb-6 flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-semibold">Thông báo</h1><p className="mt-2 text-sm text-gray-500">Cập nhật hóa đơn, thanh toán và yêu cầu xử lý.</p></div>{staff && <button className={primaryClass} onClick={() => void openCompose()}>{compose ? 'Đóng soạn tin' : '+ Gửi thông báo khu trọ'}</button>}</div>
    <div className="mb-5 flex flex-wrap items-center gap-4 text-sm"><label className="flex gap-2"><input type="checkbox" checked={unread} onChange={e => { setUnread(e.target.checked); setPage(0) }} />Chỉ chưa đọc</label><button disabled={busy} className="text-emerald-900 underline" onClick={() => void markRead()}>Đánh dấu tất cả đã đọc</button>{import.meta.env.VITE_VAPID_PUBLIC_KEY && <button disabled={busy} className="text-emerald-900 underline" onClick={() => void enablePush()}>Bật thông báo trên thiết bị</button>}</div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}{message && <p role="status" className="mb-4 text-emerald-800">{message}</p>}
    {compose && <form onSubmit={send} className="mb-6 space-y-4 rounded-xl border bg-white p-5"><h2 className="font-semibold">Gửi cho người thuê đang có hợp đồng</h2><label className="block text-sm">Khu trọ<select required name="area" className={inputClass}><option value="">Chọn khu</option>{areas.map(a => <option key={a.id} value={a.id}>{a.ten}</option>)}</select></label><label className="block text-sm">Tiêu đề<input required name="title" maxLength={200} className={inputClass} /></label><label className="block text-sm">Nội dung<textarea required name="body" maxLength={5000} rows={4} className={inputClass} /></label><button disabled={busy} className={primaryClass}>Gửi thông báo</button></form>}
    {loading ? <p>Đang tải…</p> : <div className="space-y-3">{rows.map(n => <article key={n.id} className={`rounded-xl border p-5 ${n.doc_luc ? 'bg-white' : 'bg-emerald-50 border-emerald-200'}`}><div className="flex justify-between gap-4"><h2 className="font-semibold">{n.tieu_de}</h2>{!n.doc_luc && <span className="text-xs text-emerald-800">Mới</span>}</div><p className="mt-2 whitespace-pre-wrap text-sm">{n.noi_dung}</p><p className="mt-3 text-xs text-gray-500">{new Date(n.tao_luc).toLocaleString('vi-VN')}</p><div className="mt-3 flex gap-4 text-sm">{n.duong_dan?.startsWith('/') && !n.duong_dan.startsWith('//') && <Link className="text-emerald-900 underline" to={n.duong_dan} onClick={() => { void markRead(n.id) }}>Xem chi tiết</Link>}{!n.doc_luc && <button disabled={busy} className="underline" onClick={() => void markRead(n.id)}>Đã đọc</button>}</div></article>)}{!rows.length && <p className="rounded-xl border bg-white p-6 text-gray-500">Bạn chưa có thông báo{unread ? ' chưa đọc' : ''}.</p>}</div>}
    <div className="mt-5 flex justify-end gap-4 text-sm"><button disabled={!page || loading} onClick={() => setPage(n => n - 1)}>← Trước</button><span>{count} thông báo · Trang {page + 1}</span><button disabled={(page + 1) * 20 >= count || loading} onClick={() => setPage(n => n + 1)}>Sau →</button></div>
  </main>
}
