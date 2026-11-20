import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import './login.css'

export default function LoginPage() {
  const { user, signIn, error: authError } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  if (user) return <Navigate to={from} replace />
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (pending.current) return
    pending.current = true
    setSubmitting(true); setError(null)
    try { await signIn(phone, password) }
    catch (err) { setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.') }
    finally { pending.current = false; setSubmitting(false) }
  }
  return <main className="login-page">
    <div className="login-shell">
      <section className="login-story" aria-label="Sunsilk quản lý nhà trọ">
        <div className="login-brand"><span className="login-mark" aria-hidden="true">S</span><div><strong>SUNSILK</strong><span>QUẢN LÝ NHÀ TRỌ</span></div></div>
        <div className="login-story-copy"><p className="login-eyebrow">KẾT NỐI MỘT NƠI. AN TÂM MỖI NGÀY.</p><h2>Quản lý dễ dàng.<br /> An tâm tổ ấm.</h2><p>Từ thông tin phòng đến hóa đơn và hỗ trợ cư dân.<br className="login-desktop-break" /> Mọi việc đều ở đây, trong một không gian chung.</p></div>
        <svg className="login-buildings" viewBox="0 0 480 240" fill="none" aria-hidden="true"><circle cx="368" cy="61" r="36" fill="#c8dbb0" opacity=".85" /><path d="M25 222H455" stroke="#7fa18f" /><path d="M58 222V104L135 65L210 104V222" fill="#286451" stroke="#7ca78b" /><path d="M135 65V222M58 104L135 142L210 104" stroke="#7ca78b" /><path d="M210 222V38L300 13L389 38V222" fill="#205b49" stroke="#9db89a" /><path d="M300 13V222M210 38L300 65L389 38" stroke="#9db89a" /><path d="M324 83L347 77V103L324 109ZM324 129L347 123V149L324 155ZM324 175L347 169V195L324 201Z" fill="#d2dbb6" /><path d="M229 83L252 90V115L229 108ZM264 94L286 101V126L264 119ZM229 133L252 140V165L229 158ZM264 144L286 151V176L264 169Z" fill="#407c60" /><path d="M78 140L96 149V173L78 164ZM108 155L125 164V188L108 179ZM154 154L173 144V169L154 179Z" fill="#a2b999" /><path d="M401 222V160M421 222V179" stroke="#a4ba91" strokeWidth="3" /><ellipse cx="401" cy="150" rx="19" ry="32" fill="#62946c" /><ellipse cx="422" cy="174" rx="16" ry="25" fill="#8da77e" /></svg>
        <div className="login-story-footer"><span>Một nền tảng cho cả khu trọ</span><span className="login-story-dot" aria-hidden="true" /></div>
      </section>
      <section className="login-form-side" aria-labelledby="login-title">
        <div className="login-form-content"><span className="login-welcome">CHÀO MỪNG TRỞ LẠI</span><h1 id="login-title">Đăng nhập</h1><p className="login-description">Tiếp tục quản lý và theo dõi không gian sống của bạn.</p>
          <form onSubmit={onSubmit} aria-busy={submitting}>
            <label htmlFor="login-phone">Số điện thoại</label><div className="login-input-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 5h4M11 18h2" /></svg><input id="login-phone" name="username" type="tel" inputMode="tel" autoComplete="username" placeholder="Nhập số điện thoại đã đăng ký" value={phone} onChange={e => setPhone(e.target.value)} required disabled={submitting} /></div>
            <label htmlFor="login-password">Mật khẩu</label><div className="login-input-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="4" y="10" width="16" height="12" rx="3" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v4" /></svg><input id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Nhập mật khẩu của bạn" value={password} onChange={e => setPassword(e.target.value)} required disabled={submitting} /><button type="button" className="login-password-toggle" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible} onClick={() => setVisible(v => !v)}>{visible ? 'Ẩn' : 'Hiện'}</button></div>
            <div className="login-forgot"><Link to="/quen-mat-khau">Quên mật khẩu?</Link></div>
            {(error || authError) && <p className="login-error" role="alert">{error ?? authError}</p>}
            <button type="submit" className="login-submit" disabled={submitting}>{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}<span aria-hidden="true">{submitting ? '…' : '→'}</span></button>
          </form>
          <div className="login-help"><span>Chưa có tài khoản?</span><p>Liên hệ chủ trọ hoặc quản trị viên để được cấp tài khoản.</p></div>
        </div>
        <p className="login-bottom">SUNSILK <span aria-hidden="true">·</span> Đồng hành cùng nơi bạn ở</p>
      </section>
    </div>
  </main>
}

