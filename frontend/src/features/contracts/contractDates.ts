export const contractToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
export const contractDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN')
export function expiryDays(end: string, today: string) { return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) }
export function sixMonthsAfter(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1 + 6, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(date, last))
  return first.toISOString().slice(0, 10)
}
export const terminationReasons = ['Chuyển nơi ở / công tác', 'Hết nhu cầu thuê', 'Điều kiện phòng không phù hợp', 'Vi phạm thỏa thuận hợp đồng', 'Hai bên thống nhất chấm dứt', 'Khác']
