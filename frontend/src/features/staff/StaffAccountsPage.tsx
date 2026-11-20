import PasswordInput from '../../components/PasswordInput'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'

interface Tenant { id: string; ho_ten: string; so_dien_thoai: string; cccd: string | null; dang_hoat_dong: boolean; vai_tro: string }
const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2'
const primary = 'rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
type Action = { kind: 'create' } | { kind: 'update' | 'delete'; tenant: Tenant }

export default function StaffAccountsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Tenant[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [action, setAction] = useState<Action>()
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    const timer = window.setTimeout(async () => {
      let query = supabase.from('nguoi_dung').select('id,ho_ten,so_dien_thoai,cccd,dang_hoat_dong,vai_tro', { count: 'exact' }).in('vai_tro', user?.vaiTro === 'chu_tro' ? ['quan_tri', 'quan_ly'] : ['quan_ly'])
      const term = search.trim().replace(/[^\p{L}\p{N}\s]/gu, '')
      if (term) query = query.or(`ho_ten.ilike.%${term}%,so_dien_thoai.ilike.%${term}%`)
      const result = await query.order('tao_luc', { ascending: false }).order('id').range(page * 20, page * 20 + 19)
      if (cancelled) return
      if (result.error) setError('Không tải được danh sách nhân sự.')
      else { setRows(result.data ?? []); setTotal(result.count ?? 0) }
      setLoading(false)
    }, 200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [search, page, revision, user?.vaiTro])
  return <main className="p-6">
    <Link className="text-sm text-emerald-900 underline" to="/">← Tổng quan</Link>
    <div className="my-6 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">Quản lý nhân sự</h1><p className="mt-1 text-sm text-gray-500">{total} nhân sự trong hệ thống</p></div><button className={primary} onClick={() => setAction({ kind: 'create' })}>+ Thêm nhân sự</button></div>
    <label className="block max-w-md text-sm">Tìm theo tên hoặc số điện thoại<input className={inputClass} value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Nhập tên hoặc số điện thoại" /></label>
    {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-900">{message}</p>}
    {error && <p role="alert" className="mt-4 text-red-700">{error} <button className="underline" onClick={() => setRevision(n => n + 1)}>Thử lại</button></p>}
    <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-emerald-50"><tr>{['Họ tên', 'Số điện thoại', 'CCCD', 'Trạng thái', 'Thao tác'].map(h => <th key={h} className="p-4 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{!loading && !error && rows.map(tenant => <tr key={tenant.id} className="border-t border-gray-100"><td className="p-4 font-medium">{tenant.ho_ten}<small className="block text-gray-500">{tenant.vai_tro === 'quan_tri' ? 'Quản trị hệ thống' : 'Quản lý khu trọ'}</small></td><td className="p-4">{tenant.so_dien_thoai}</td><td className="p-4">{tenant.cccd ?? '—'}</td><td className="p-4 whitespace-nowrap">{tenant.dang_hoat_dong ? 'Đang hoạt động' : 'Đã khóa'}</td><td className="p-4"><div className="flex gap-4"><button className="text-emerald-900 underline" onClick={() => setAction({ kind: 'update', tenant })}>Sửa</button><button className="text-red-700 underline" onClick={() => setAction({ kind: 'delete', tenant })}>Xóa</button></div></td></tr>)}</tbody></table>{loading ? <p role="status" className="p-6">Đang tải…</p> : !error && !rows.length && <p className="p-6 text-gray-500">Không tìm thấy nhân sự.</p>}</div>
    <div className="mt-4 flex items-center justify-end gap-4 text-sm"><button disabled={!page || loading} className="disabled:opacity-40" onClick={() => setPage(n => n - 1)}>← Trước</button><span>Trang {page + 1} / {Math.max(1, Math.ceil(total / 20))}</span><button disabled={(page + 1) * 20 >= total || loading} className="disabled:opacity-40" onClick={() => setPage(n => n + 1)}>Sau →</button></div>
    {action && <TenantDialog action={action} onClose={() => setAction(undefined)} onSaved={() => { setMessage(action.kind === 'create' ? 'Đã thêm nhân sự. Tài khoản có thể đăng nhập bằng số điện thoại và mật khẩu vừa tạo.' : action.kind === 'update' ? 'Đã lưu thông tin nhân sự.' : 'Đã xóa nhân sự và tài khoản đăng nhập.'); setAction(undefined); setPage(0); setRevision(n => n + 1) }} />}
  </main>
}

function TenantDialog({ action, onClose, onSaved }: { action: Action; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const [role, setRole] = useState(action.kind === 'create' ? 'quan_ly' : action.tenant.vai_tro)
  const dialog = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const tenant = action.kind === 'create' ? undefined : action.tenant
  const [name, setName] = useState(tenant?.ho_ten ?? '')
  const [phone, setPhone] = useState(tenant?.so_dien_thoai ?? '')
  const [cccd, setCccd] = useState(tenant?.cccd ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    if (action.kind === 'create' && password !== confirmation) { setError('Mật khẩu xác nhận chưa trùng khớp.'); return }
    submitting.current = true; setBusy(true); setError('')
    try {
      const result = await supabase.functions.invoke('manage-staff', { body: { action: action.kind, id: tenant?.id, name, phone, cccd, role, ...(action.kind === 'create' ? { password } : {}) } })
      if (result.error) {
        let message = 'Không kết nối được dịch vụ quản lý nhân sự. Vui lòng thử lại.'
        if (result.error.context instanceof Response) {
          const body = await result.error.context.json().catch(() => null)
          if (typeof body?.error === 'string') message = body.error
        }
        throw new Error(message)
      }
      if (result.data?.error) throw new Error(result.data.error)
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được dữ liệu.') }
    finally { submitting.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} aria-labelledby="tenant-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }} className="m-auto w-[calc(100%-32px)] max-w-lg max-h-[90dvh] overflow-auto rounded-2xl border-0 bg-white p-6 shadow-2xl backdrop:bg-black/40">
    <h2 id="tenant-dialog-title" className="text-xl font-semibold">{action.kind === 'create' ? 'Thêm nhân sự' : action.kind === 'update' ? 'Sửa nhân sự' : 'Xác nhận xóa nhân sự'}</h2>
    <form onSubmit={save} className="mt-5 space-y-4">
      {action.kind === 'delete' ? <p>Bạn muốn xóa <strong>{tenant?.ho_ten}</strong> ({tenant?.so_dien_thoai}) và tài khoản đăng nhập? Chỉ xóa được khi chưa có dữ liệu liên quan.</p> : <>
        <label className="block text-sm">Họ tên<input autoFocus className={inputClass} required maxLength={100} value={name} onChange={e => setName(e.target.value)} disabled={busy} autoComplete="off" /></label>
        <label className="block text-sm">Số điện thoại đăng nhập<input className={inputClass} type="tel" required maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} placeholder="0901234567" autoComplete="off" /></label>
        <label className="block text-sm">CCCD (không bắt buộc)<input className={inputClass} inputMode="numeric" pattern="[0-9]{12}" maxLength={12} value={cccd} onChange={e => setCccd(e.target.value)} disabled={busy} autoComplete="off" /></label>
        {action.kind === 'create' && <label className="block text-sm">Mật khẩu đăng nhập<PasswordInput className={inputClass} required minLength={8} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} autoComplete="new-password" /><span className="mt-1 block text-xs text-gray-500">Mật khẩu từ 8–72 ký tự. Nên kết hợp chữ và số, tránh dùng số điện thoại hoặc ngày sinh. Cung cấp mật khẩu này cho nhân sự.</span></label>}
        {action.kind === 'create' && <label className="block text-sm">Xác nhận mật khẩu<PasswordInput className={inputClass} required minLength={8} maxLength={72} value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} autoComplete="new-password" /></label>}
      </>}
      {action.kind !== 'delete' && <label className="block text-sm">Vai trò<select className={inputClass} value={role} onChange={e => setRole(e.target.value)} disabled={busy}><option value="quan_ly">Quản lý khu trọ</option>{user?.vaiTro === 'chu_tro' && <option value="quan_tri">Quản trị hệ thống</option>}</select></label>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 pt-2"><button autoFocus={action.kind === 'delete'} type="button" disabled={busy} className="rounded-lg border px-4 py-2 text-sm" onClick={onClose}>Hủy</button><button type="submit" disabled={busy} className={action.kind === 'delete' ? 'rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50' : primary}>{busy ? 'Đang xử lý…' : action.kind === 'delete' ? 'Xóa nhân sự' : action.kind === 'create' ? 'Thêm nhân sự' : 'Lưu thay đổi'}</button></div>
    </form>
  </dialog>
}

