// Chuẩn hoá SĐT về dạng 84xxxxxxxxx (khớp tài khoản mẫu)
export function normalizePhone(input: string): string {
  const digits = input.replace(/[\s.\-()]/g, '').replace(/^\+/, '')
  if (digits.startsWith('84')) return digits
  if (digits.startsWith('0')) return '84' + digits.slice(1)
  return digits
}