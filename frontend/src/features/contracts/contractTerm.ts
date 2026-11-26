export function contractTerm(status: string, end: string | null, today: string) {
  if (status === 'cham_dut') return { label: 'Hợp đồng đã kết thúc', detail: 'Liên hệ chủ trọ nếu bạn cần thuê tiếp.', tone: 'neutral' }
  if (!end) return status === 'het_han'
    ? { label: 'Hợp đồng đã hết hạn', detail: 'Liên hệ chủ trọ để được kiểm tra và gia hạn.', tone: 'expired' }
    : { label: 'Không xác định thời hạn', detail: 'Hợp đồng chưa quy định ngày kết thúc.', tone: 'normal' }
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  if (status === 'het_han' || days < 0) return { label: days < 0 ? `Đã hết hạn ${-days} ngày` : 'Hợp đồng đã hết hạn', detail: 'Liên hệ chủ trọ để được kiểm tra và gia hạn.', tone: 'expired' }
  if (days === 0) return { label: 'Hết hạn hôm nay', detail: 'Liên hệ chủ trọ để trao đổi việc gia hạn hợp đồng.', tone: 'soon' }
  return { label: `Còn ${days} ngày đến hạn`, detail: days <= 30 ? 'Hợp đồng sắp hết hạn. Bạn nên trao đổi với chủ trọ về việc gia hạn.' : 'Thời gian còn lại được tính đến ngày kết thúc hợp đồng.', tone: days <= 30 ? 'soon' : 'normal' }
}
