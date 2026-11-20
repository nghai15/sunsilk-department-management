import type { SupabaseClient } from '@supabase/supabase-js'

export function createPasswordRecovery(client: SupabaseClient) {
  let verifiedAt = 0
  let verifiedUser = ''
  async function clear() {
    verifiedAt = 0; verifiedUser = ''
    await client.auth.signOut({ scope: 'local' })
  }
  return {
    clear,
    async send(phone: string) {
      if (!/^84[35789]\d{8}$/.test(phone)) throw new Error('Nhập số di động Việt Nam hợp lệ.')
      await clear()
      const { error } = await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: false, channel: 'sms' } })
      if (error) {
        if (error.status === 429) throw new Error('Bạn gửi mã quá nhiều lần. Vui lòng chờ rồi thử lại.')
        // Không tiết lộ số điện thoại có tài khoản hay chưa.
        if (error.code === 'otp_disabled' || error.code === 'user_not_found' || error.code === 'signup_disabled') return
        throw new Error('Chưa gửi được SMS. Vui lòng thử lại sau.')
      }
    },
    async verify(phone: string, token: string) {
      verifiedAt = 0; verifiedUser = ''
      const { data, error } = await client.auth.verifyOtp({ phone, token, type: 'sms' })
      if (error || !data.session || !data.user) {
        throw new Error(error?.status === 429 ? 'Đã thử quá nhiều lần. Vui lòng chờ rồi xác minh lại.' : 'Mã OTP không đúng hoặc đã hết hạn.')
      }
      const profile = await client.from('nguoi_dung').select('vai_tro,dang_hoat_dong').eq('id', data.user.id).single()
      if (profile.error || profile.data?.vai_tro !== 'nguoi_thue' || !profile.data.dang_hoat_dong) {
        await clear()
        throw new Error('Chức năng này dành cho tài khoản người thuê đang hoạt động.')
      }
      verifiedAt = Date.now(); verifiedUser = data.user.id
    },
    async update(password: string) {
      if (!verifiedUser || Date.now() - verifiedAt > 10 * 60 * 1000) {
        await clear()
        throw new Error('Phiên xác minh đã hết hạn. Vui lòng lấy mã OTP mới.')
      }
      if (password.length < 8 || password.length > 72) throw new Error('Mật khẩu cần từ 8 đến 72 ký tự.')
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError || auth.user?.id !== verifiedUser) throw new Error('Phiên xác minh không còn hợp lệ. Vui lòng lấy mã OTP mới.')
      const { error } = await client.auth.updateUser({ password })
      if (error) {
        if (error.code === 'same_password') throw new Error('Mật khẩu mới phải khác mật khẩu cũ.')
        if (error.code === 'weak_password') throw new Error('Mật khẩu chưa đủ mạnh. Hãy dùng chữ hoa, chữ thường, số và ký tự đặc biệt.')
        throw new Error('Không đổi được mật khẩu. Vui lòng thử lại hoặc lấy mã OTP mới.')
      }
      await clear()
    },
  }
}
