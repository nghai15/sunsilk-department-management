import { useState } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'
import { XacNhanThanhToanUNC, type XacNhanThanhToanUNCData } from '../../components/forms/XacNhanThanhToanUNC'

export function TenantReceipt({ billId, roomId, room, period, remaining, onSent }: { billId: string; roomId: string; room: string; period: string; remaining: number; onSent: () => void }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(data: XacNhanThanhToanUNCData) {
    if (busy || !user) return
    setBusy(true); setError('')
    try {
      if (!Number.isInteger(data.soTien) || data.soTien <= 0 || data.soTien > remaining) throw new Error('Số tiền phải lớn hơn 0 và không vượt số tiền còn phải trả.')
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(data.anhBienLai.type)) throw new Error('Chọn biên lai định dạng JPG, PNG hoặc WebP.')
      const path = `${roomId}/${user.id}/${crypto.randomUUID()}.${data.anhBienLai.type === 'image/png' ? 'png' : data.anhBienLai.type === 'image/webp' ? 'webp' : 'jpg'}`
      const uploaded = await supabase.storage.from('bien-lai').upload(path, data.anhBienLai, { upsert: false })
      if (uploaded.error) throw new Error('Không tải được biên lai. Vui lòng thử lại.')
      const inserted = await supabase.from('thanh_toan').insert({ hoa_don_id: billId, so_tien: data.soTien, duong_dan_bien_lai: path, nguoi_gui_id: user.id, trang_thai: 'cho_duyet', ma_giao_dich: data.maGiaoDich, ghi_chu: data.ghiChu })
      if (inserted.error) throw new Error(inserted.error.message)
      onSent()
    } catch (err) { setError(err instanceof Error ? err.message : 'Không gửi được biên lai.') }
    finally { setBusy(false) }
  }
  return <section className="max-w-xl mx-auto p-5">{error && <p className="bill-error mb-3" role="alert">{error}</p>}<XacNhanThanhToanUNC hoaDonId={billId} tongTien={remaining} thangNam={period} soPhong={room} dangGui={busy} onSubmit={submit} /></section>
}
