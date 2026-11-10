import { createContext } from 'react'
import type { NguoiDung } from '../../types'

export interface AuthContextValue {
  user: NguoiDung | null
  loading: boolean
  /** Lỗi chung (vd tài khoản bị khóa), hiện ở màn đăng nhập */
  error: string | null
  signIn: (phone: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)