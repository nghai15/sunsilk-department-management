import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../services/supabase'
import { normalizePhone } from '../../utils/phone'
import type { NguoiDung, VaiTro } from '../../types'
import { AuthContext } from './AuthContext'

interface HangNguoiDung {
  id: string
  so_dien_thoai: string
  ho_ten: string
  cccd: string | null
  vai_tro: VaiTro
  anh_dai_dien: string | null
  dang_hoat_dong: boolean
  tao_luc: string
}

function toNguoiDung(r: HangNguoiDung): NguoiDung {
  return {
    id: r.id,
    soDienThoai: r.so_dien_thoai,
    hoTen: r.ho_ten,
    cccd: r.cccd ?? undefined,
    vaiTro: r.vai_tro,
    anhDaiDien: r.anh_dai_dien ?? undefined,
    dangHoatDong: r.dang_hoat_dong,
    taoLuc: r.tao_luc,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = chưa biết có phiên đăng nhập hay không
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [user, setUser] = useState<NguoiDung | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session === undefined ? undefined : (session?.user.id ?? null)

  useEffect(() => {
    if (userId === undefined) return
    if (userId === null) {
      setUser(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('nguoi_dung')
      .select('*')
      .eq('id', userId)
      .single()
      .then(async ({ data, error: err }) => {
        if (cancelled) return
        if (err || !data) {
          setError('Không tải được hồ sơ người dùng.')
          await supabase.auth.signOut()
          return
        }
        const nd = toNguoiDung(data as HangNguoiDung)
        if (!nd.dangHoatDong) {
          setError('Tài khoản đã bị khóa. Vui lòng liên hệ chủ trọ.')
          await supabase.auth.signOut()
          return
        }
        setUser(nd)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const signIn = async (phone: string, password: string) => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({
      phone: normalizePhone(phone),
      password,
    })
    if (err) throw new Error('Số điện thoại hoặc mật khẩu không đúng.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}