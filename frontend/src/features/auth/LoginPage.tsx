import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export default function LoginPage() {
  const { user, signIn, error: authError } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={from} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(phone, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold text-center">Đăng nhập</h1>

        <label className="block text-sm">
          Số điện thoại
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09xx xxx xxx hoặc +84..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="mt-1 w-full border rounded-lg px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          Mật khẩu
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full border rounded-lg px-3 py-2"
          />
        </label>

        {(error || authError) && <p className="text-sm text-red-600">{error ?? authError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white rounded-lg py-2 disabled:opacity-60"
        >
          {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  )
}