import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'

interface HoaDonTom {
  id: string
  thang_nam: string
  tong_tien: number
  han_thanh_toan: string
  trang_thai_thanh_toan: string
}

const NHAN_TRANG_THAI: Record<string, string> = {
  chua_thanh_toan: 'Chưa thanh toán',
  cho_xac_nhan: 'Chờ chủ trọ xác nhận',
  thanh_toan_mot_phan: 'Đã trả một phần',
  da_thanh_toan: 'Đã thanh toán',
  qua_han: 'Quá hạn',
}

export default function TenantDashboard() {
  const [hoaDon, setHoaDon] = useState<HoaDonTom | null>(null)
  const [suCoMo, setSuCoMo] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase
        .from('hoa_don')
        .select('id, thang_nam, tong_tien, han_thanh_toan, trang_thai_thanh_toan')
        .eq('la_ban_nhap', false)
        .order('ky', { ascending: false })
        .limit(1),
      supabase
        .from('su_co')
        .select('id', { count: 'exact', head: true })
        .in('trang_thai', ['cho_tiep_nhan', 'dang_xu_ly', 'chua_the_xu_ly']),
    ]).then(([hd, sc]) => {
      if (hd.error || sc.error) setError((hd.error ?? sc.error)!.message)
      else {
        setHoaDon((hd.data?.[0] as HoaDonTom | undefined) ?? null)
        setSuCoMo(sc.count ?? 0)
      }
      setLoading(false)
    })
  }, [])

  if (error) return <p className="text-red-600">Lỗi tải dữ liệu: {error}</p>
  if (loading) return <p>Đang tải...</p>

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold mb-2">Hóa đơn mới nhất</h2>
        {hoaDon ? (
          <div className="space-y-1 text-sm">
            <p>Kỳ {hoaDon.thang_nam}</p>
            <p className="text-2xl font-semibold">{Math.round(hoaDon.tong_tien).toLocaleString('vi-VN')} đ</p>
            <p>Hạn đóng: {new Date(hoaDon.han_thanh_toan).toLocaleDateString('vi-VN')}</p>
            <p>Trạng thái: {NHAN_TRANG_THAI[hoaDon.trang_thai_thanh_toan] ?? hoaDon.trang_thai_thanh_toan}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Chưa có hóa đơn nào.</p>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold mb-1">Sự cố đang xử lý</h2>
        <p className="text-2xl font-semibold">{suCoMo}</p>
      </section>
    </div>
  )
}