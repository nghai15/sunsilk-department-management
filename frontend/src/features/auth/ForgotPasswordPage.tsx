import PasswordInput from '../../components/PasswordInput'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '../../utils/phone'
import { createPasswordRecovery } from './passwordRecovery'

const field = 'mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 focus:outline-emerald-700 disabled:bg-gray-50'
const primary = 'w-full rounded-xl bg-emerald-900 px-4 py-3 font-medium text-white disabled:opacity-50'

export default function ForgotPasswordPage() {
  const [recovery] = useState(() => createPasswordRecovery(createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `password-recovery-${crypto.randomUUID()}` },
  })))
  const [step, setStep] = useState<'phone' | 'otp' | 'password' | 'done'>('phone')
  const [phone, setPhone] = useState('')
  const [sentPhone, setSentPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [retryAt, setRetryAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [attempts, setAttempts] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  const pending = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(true)
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000))
  useEffect(() => {
    mounted.current = true
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    const network = () => setOnline(navigator.onLine)
    window.addEventListener('online', network); window.addEventListener('offline', network)
    return () => {
      mounted.current = false; window.clearInterval(timer)
      window.removeEventListener('online', network); window.removeEventListener('offline', network)
      void recovery.clear()
    }
  }, [recovery])
  useEffect(() => { heading.current?.focus() }, [step])
  async function run(action: () => Promise<void>) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setMessage('')
    try { await action() }
    catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Không kết nối được. Vui lòng thử lại.') }
    finally {
      pending.current = false
      if (mounted.current) setBusy(false)
      else void recovery.clear()
    }
  }
  async function send() {
    if (seconds > 0) return
    await run(async () => {
      const normalized = normalizePhone(step === 'otp' ? sentPhone : phone)
      await recovery.send(normalized)
      if (!mounted.current) return
      setSentPhone(normalized); setOtp(''); setAttempts(0)
      setRetryAt(Date.now() + 60000); setNow(Date.now()); setStep('otp')
      setMessage('Nếu số điện thoại đã đăng ký, bạn sẽ nhận được mã xác minh qua SMS.')
    })
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!online) return
    if (step === 'phone') { void send(); return }
    if (step === 'otp') {
      if (!/^\d{6}$/.test(otp) || attempts >= 5) return
      void run(async () => {
        setAttempts(n => n + 1)
        await recovery.verify(sentPhone, otp)
        if (mounted.current) { setOtp(''); setStep('password') }
      })
    } else if (step === 'password') {
      if (password !== confirmation) { setError('Hai mật khẩu chưa trùng nhau.'); return }
      void run(async () => {
        await recovery.update(password)
        if (mounted.current) { setPassword(''); setConfirmation(''); setStep('done') }
      })
    }
  }
  return <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4"><section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
    <p className="mb-3 text-xs font-semibold tracking-widest text-emerald-800">KHÔI PHỤC TÀI KHOẢN</p>
    <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">{step === 'phone' ? 'Quên mật khẩu?' : step === 'otp' ? 'Xác minh số điện thoại' : step === 'password' ? 'Đặt mật khẩu mới' : 'Đã đổi mật khẩu'}</h1>
    <p className="mt-3 text-sm text-gray-600">{step === 'phone' ? 'Nhập số điện thoại người thuê đã đăng ký để nhận mã OTP qua SMS.' : step === 'otp' ? `Nhập mã 6 số gửi đến số kết thúc bằng ${sentPhone.slice(-4)}.` : step === 'password' ? 'Tạo mật khẩu mới để đăng nhập lại tài khoản của bạn.' : 'Bạn có thể đăng nhập bằng số điện thoại và mật khẩu mới.'}</p>
    {!online && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Cần kết nối mạng để khôi phục mật khẩu.</p>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-emerald-800">{message}</p>}
    {step !== 'done' && <form onSubmit={submit} className="mt-6 space-y-4">
      {step === 'phone' && <label className="block text-sm">Số điện thoại<input className={field} type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xx xxx xxx" disabled={busy} /></label>}
      {step === 'otp' && <><label className="block text-sm">Mã OTP<input className={`${field} text-center text-2xl tracking-[0.35em]`} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} disabled={busy || attempts >= 5} /></label>{attempts >= 5 && <p role="alert" className="text-sm text-red-700">Đã thử 5 lần. Vui lòng yêu cầu mã mới.</p>}</>}
      {step === 'password' && <><label className="block text-sm">Mật khẩu mới<PasswordInput className={field} autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} aria-describedby="password-guidance" disabled={busy} /><span id="password-guidance" className="mt-2 block text-xs leading-relaxed text-gray-600">Mật khẩu từ 8–72 ký tự. Nên kết hợp chữ và số, tránh dùng số điện thoại hoặc ngày sinh.</span></label><label className="block text-sm">Xác nhận mật khẩu mới<PasswordInput className={field} autoComplete="new-password" minLength={8} maxLength={72} required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></label></>}
      <button className={primary} disabled={busy || !online || (step === 'phone' && seconds > 0) || (step === 'otp' && attempts >= 5)}>{busy ? 'Đang xử lý…' : step === 'phone' ? (seconds ? `Chờ ${seconds}s để gửi mã` : 'Gửi mã OTP') : step === 'otp' ? 'Xác minh mã' : 'Lưu mật khẩu mới'}</button>
    </form>}
    {step === 'otp' && <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm"><button disabled={busy || seconds > 0 || !online} className="text-emerald-900 underline disabled:opacity-50" onClick={() => void send()}>{seconds ? `Gửi lại sau ${seconds}s` : 'Gửi lại mã'}</button><button disabled={busy} className="text-gray-600 underline" onClick={() => { setStep('phone'); setError(''); setMessage(''); setOtp('') }}>Đổi số điện thoại</button></div>}
    {step === 'password' && <button disabled={busy} className="mt-4 text-sm text-emerald-900 underline" onClick={() => { void recovery.clear(); setStep('phone'); setError(''); setPassword(''); setConfirmation('') }}>Xác minh lại bằng OTP</button>}
    <Link className={step === 'done' ? `${primary} mt-6 block text-center` : 'mt-6 block text-center text-sm text-gray-600 underline'} to="/dang-nhap">{step === 'done' ? 'Đăng nhập' : '← Quay lại đăng nhập'}</Link>
  </section></main>
}

