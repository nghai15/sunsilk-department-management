import PasswordInput from '../../components/PasswordInput'
import { useState, type FormEvent } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from './useAuth'
import { normalizePhone } from '../../utils/phone'
import { inputClass, primaryClass } from '../../components/Modal'

export default function AccountPage() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const form = event.currentTarget; const data = new FormData(form)
    setError(''); setMessage('')
    const password = String(data.get('password'))
    if (password !== data.get('confirmation')) { setError('Mật khẩu xác nhận chưa trùng nhau.'); return }
    setBusy(true)
    try {
      const login = await supabase.auth.signInWithPassword({ phone: normalizePhone(user!.soDienThoai), password: String(data.get('current')) })
      if (login.error) throw new Error('Mật khẩu hiện tại không đúng.')
      const result = await supabase.auth.updateUser({ password })
      if (result.error) throw new Error('Không đổi được mật khẩu. Hãy chọn mật khẩu mới đủ mạnh và khác mật khẩu cũ.')
      form.reset(); setMessage('Đã đổi mật khẩu thành công.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Không đổi được mật khẩu.') } finally { setBusy(false) }
  }
  return <main className="p-6"><h1 className="text-2xl font-semibold">Tài khoản của tôi</h1><section className="my-6 rounded-xl border bg-white p-5"><h2 className="font-semibold">{user?.hoTen}</h2><p className="mt-2 text-gray-600">{user?.soDienThoai}</p></section><form onSubmit={change} className="max-w-lg space-y-4 rounded-xl border bg-white p-5"><h2 className="font-semibold">Đổi mật khẩu</h2><label className="block text-sm">Mật khẩu hiện tại<PasswordInput required className={inputClass} name="current" autoComplete="current-password" disabled={busy} /></label><label className="block text-sm">Mật khẩu mới<PasswordInput required minLength={8} maxLength={72} className={inputClass} name="password" autoComplete="new-password" aria-describedby="password-guidance" disabled={busy} /><span id="password-guidance" className="mt-2 block text-xs leading-relaxed text-gray-600">Mật khẩu từ 8–72 ký tự. Nên kết hợp chữ và số, tránh dùng số điện thoại hoặc ngày sinh.</span></label><label className="block text-sm">Xác nhận mật khẩu mới<PasswordInput required minLength={8} maxLength={72} className={inputClass} name="confirmation" autoComplete="new-password" disabled={busy} /></label>{error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status" className="text-emerald-800">{message}</p>}<button disabled={busy} className={primaryClass}>{busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</button></form></main>
}

