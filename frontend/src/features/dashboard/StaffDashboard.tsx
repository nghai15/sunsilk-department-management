import { useDashboard } from './useDashboard'

const tien = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} đ`

function Card({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</p>
    </div>
  )
}

export default function StaffDashboard() {
  const { khuList, khuId, setKhuId, data, loading, error } = useDashboard()

  if (error) return <p className="text-red-600">Lỗi tải dữ liệu: {error}</p>
  if (loading && !data) return <p>Đang tải...</p>
  if (khuList.length === 0) return <p>Bạn chưa được gán khu trọ nào.</p>

  return (
    <div className="space-y-4">
      {khuList.length > 1 && (
        <select
          value={khuId ?? ''}
          onChange={(e) => setKhuId(e.target.value)}
          className="border rounded-lg px-3 py-2 w-full bg-white"
        >
          {khuList.map((k) => (
            <option key={k.id} value={k.id}>{k.ten}</option>
          ))}
        </select>
      )}
      {khuList.length === 1 && <h1 className="text-lg font-semibold">{khuList[0].ten}</h1>}

      {data && (
        <>
          <p className="text-sm text-gray-500">Kỳ {data.thang_nam}</p>

          <section className="grid grid-cols-2 gap-3">
            <Card label="Đang thuê" value={`${data.phong_dang_thue}/${data.tong_so_phong}`} />
            <Card label="Phòng trống" value={data.phong_trong} />
            <Card label="Đang bảo trì" value={data.phong_bao_tri} />
            <Card label="Sự cố đang mở" value={data.so_su_co_dang_mo} tone={data.so_su_co_dang_mo ? 'text-orange-600' : ''} />
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Card label="Đã thu" value={tien(data.tong_da_thu)} tone="text-green-600" />
            <Card label="Còn nợ" value={tien(data.tong_con_no)} tone={data.tong_con_no ? 'text-red-600' : ''} />
            <Card label="Hóa đơn quá hạn" value={data.so_hoa_don_qua_han} tone={data.so_hoa_don_qua_han ? 'text-red-600' : ''} />
            <Card label="Chờ xác nhận thanh toán" value={data.so_hoa_don_cho_xac_nhan} />
          </section>
        </>
      )}
    </div>
  )
}