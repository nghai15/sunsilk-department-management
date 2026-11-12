
import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'
import { NHAN_TRANG_THAI_SU_CO } from '../../utils/suCo'
import type { TrangThaiSuCo } from '../../types'

type SuCoItem = {
  id: string
  phong_id: string
  nguoi_thue_id: string | null
  tieu_de: string
  mo_ta: string
  anh_urls: string[]
  chi_phi_sua_chua: number
  ghi_chu_xu_ly: string | null
  trang_thai: TrangThaiSuCo
  phan_loai: string
  tao_luc: string
}

type LichSuItem = {
  id: string
  tu_trang_thai: TrangThaiSuCo | null
  den_trang_thai: TrangThaiSuCo
  ghi_chu: string | null
  chi_phi_sua_chua: number | null
  tao_luc: string
}

type PhongItem = {
  id: string
  so_phong: string
  tang: number
}

const NHAN_PHAN_LOAI: Record<string, string> = {
  dien: 'Điện',
  nuoc: 'Nước',
  may_lanh: 'Máy lạnh',
  noi_that: 'Nội thất',
  mang: 'Mạng Internet',
  khac: 'Khác',
}

const CAC_TRANG_THAI: TrangThaiSuCo[] = [
  'cho_tiep_nhan',
  'dang_xu_ly',
  'chua_the_xu_ly',
  'hoan_tat',
  'da_huy',
]

export default function IssueManagementPage() {
  const { user } = useAuth()

  const [danhSach, setDanhSach] = useState<SuCoItem[]>([])
  const [danhSachPhong, setDanhSachPhong] = useState<PhongItem[]>([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [suCoChon, setSuCoChon] = useState<SuCoItem | null>(null)

  const [trangThaiMoi, setTrangThaiMoi] =
    useState<TrangThaiSuCo>('dang_xu_ly')
  const [ghiChu, setGhiChu] = useState('')
  const [chiPhi, setChiPhi] = useState('0')
  const [dangCapNhat, setDangCapNhat] = useState(false)

  const [lichSu, setLichSu] = useState<LichSuItem[]>([])
  const [anhDaKy, setAnhDaKy] = useState<string[]>([])

  async function taiDanhSach() {
    setDangTai(true)
    setLoi('')

    const { data, error } = await supabase
      .from('su_co')
      .select('*')
      .order('tao_luc', { ascending: false })

    if (error) {
      setLoi(error.message)
      setDangTai(false)
      return
    }

    const suCoList = (data ?? []) as SuCoItem[]
    setDanhSach(suCoList)

    const phongIds = [...new Set(suCoList.map(item => item.phong_id))]

    if (phongIds.length > 0) {
      const { data: phongData, error: phongError } = await supabase
        .from('phong_tro')
        .select('id, so_phong, tang')
        .in('id', phongIds)

      if (phongError) {
        setLoi(phongError.message)
      } else {
        setDanhSachPhong((phongData ?? []) as PhongItem[])
      }
    } else {
      setDanhSachPhong([])
    }

    setDangTai(false)
  }

  useEffect(() => {
    void taiDanhSach()
  }, [])

  async function moChiTiet(item: SuCoItem) {
    setSuCoChon(item)
    setTrangThaiMoi(
      item.trang_thai === 'cho_tiep_nhan'
        ? 'dang_xu_ly'
        : item.trang_thai
    )
    setGhiChu(item.ghi_chu_xu_ly ?? '')
    setChiPhi(String(item.chi_phi_sua_chua ?? 0))
    setLichSu([])
    setAnhDaKy([])
    setLoi('')

    const { data: historyData, error: historyError } = await supabase
      .from('lich_su_su_co')
      .select('*')
      .eq('su_co_id', item.id)
      .order('tao_luc', { ascending: false })

    if (historyError) {
      setLoi(historyError.message)
    } else {
      setLichSu((historyData ?? []) as LichSuItem[])
    }

    if (item.anh_urls?.length) {
      const ketQuaAnh = await Promise.all(
        item.anh_urls.map(path =>
          supabase.storage
            .from('anh-su-co')
            .createSignedUrl(path, 3600)
        )
      )

      setAnhDaKy(
        ketQuaAnh
          .map(result => result.data?.signedUrl)
          .filter((url): url is string => Boolean(url))
      )
    }
  }

  async function capNhatSuCo() {
    if (!suCoChon || !user) return

    const chiPhiSo = Number(chiPhi)

    if (!Number.isFinite(chiPhiSo) || chiPhiSo < 0) {
      setLoi('Chi phí sửa chữa phải là số không âm.')
      return
    }

    if (trangThaiMoi === 'chua_the_xu_ly' && !ghiChu.trim()) {
      setLoi('Vui lòng nhập lý do chưa thể xử lý.')
      return
    }

    setDangCapNhat(true)
    setLoi('')

    const { error } = await supabase.rpc('cap_nhat_xu_ly_su_co', {
      p_su_co_id: suCoChon.id,
      p_trang_thai: trangThaiMoi,
      p_ghi_chu_xu_ly: ghiChu.trim() || null,
      p_chi_phi_sua_chua: chiPhiSo,
    })

    setDangCapNhat(false)

    if (error) {
      setLoi(error.message)
      return
    }

    alert('Cập nhật xử lý sự cố thành công!')

    const idSuCo = suCoChon.id
    await taiDanhSach()

    const { data } = await supabase
      .from('su_co')
      .select('*')
      .eq('id', idSuCo)
      .single()

    if (data) {
      await moChiTiet(data as SuCoItem)
    }
  }

  function tenPhong(phongId: string) {
    const phong = danhSachPhong.find(item => item.id === phongId)

    return phong
      ? `Phòng ${phong.so_phong} - Tầng ${phong.tang}`
      : 'Không xác định'
  }

  function dinhDangNgay(value: string) {
    return new Date(value).toLocaleString('vi-VN')
  }

  if (
    user &&
    user.vaiTro !== 'chu_tro' &&
    user.vaiTro !== 'quan_ly' &&
    user.vaiTro !== 'quan_tri'
  ) {
    return <p className="p-4">Bạn không có quyền quản lý sự cố.</p>
  }

  return (
    <div className="w-full md:w-1/2 mx-auto space-y-4">
      {/* Tiêu đề */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Quản lý sự cố</h1>
          <p className="text-sm text-gray-500">
            Theo dõi và cập nhật tình trạng sửa chữa
          </p>
        </div>

        <button
          onClick={() => void taiDanhSach()}
          className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
        >
          Làm mới
        </button>
      </div>

      {/* Thông báo lỗi */}
      {loi && (
        <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">
          {loi}
        </div>
      )}

      {/* Danh sách sự cố */}
      {dangTai ? (
        <p className="text-gray-500">Đang tải danh sách sự cố...</p>
      ) : danhSach.length === 0 ? (
        <div className="bg-white rounded-xl border p-6 text-center text-gray-500">
          Chưa có báo cáo sự cố nào.
        </div>
      ) : (
        <div className="space-y-2">
          {danhSach.map(item => (
            <button
              key={item.id}
              onClick={() => void moChiTiet(item)}
              className={`w-full text-left border rounded-lg px-3 py-2 transition ${
                suCoChon?.id === item.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'bg-white hover:border-blue-400'
              }`}
            >
              <div className="flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-sm truncate">
                    {item.tieu_de}
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    {tenPhong(item.phong_id)} ·{' '}
                    {NHAN_PHAN_LOAI[item.phan_loai] ?? item.phan_loai}
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    {dinhDangNgay(item.tao_luc)}
                  </p>
                </div>

                <span className="shrink-0 text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-1">
                  {NHAN_TRANG_THAI_SU_CO[item.trang_thai]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Chi tiết sự cố */}
      {suCoChon && (
        <div className="bg-white border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Chi tiết sự cố</h2>

            <button
              onClick={() => {
                setSuCoChon(null)
                setLoi('')
              }}
              className="border rounded-lg px-3 py-1 text-sm hover:bg-gray-100"
            >
              Đóng
            </button>
          </div>

          {/* Lý do báo cáo */}
          <div>
            <p className="font-semibold">{suCoChon.tieu_de}</p>
            <p className="text-sm text-gray-500">
              {tenPhong(suCoChon.phong_id)}
            </p>

            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <p className="text-sm font-medium mb-1">Lý do báo cáo</p>
              <p className="text-sm whitespace-pre-wrap">
                {suCoChon.mo_ta}
              </p>
            </div>
          </div>

          {/* Ảnh sự cố */}
          {anhDaKy.length > 0 && (
            <div>
              <p className="font-medium mb-2">Ảnh sự cố</p>

              <div className="grid grid-cols-2 gap-2">
                {anhDaKy.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={url}
                      alt={`Ảnh sự cố ${index + 1}`}
                      className="w-full h-36 object-cover rounded-lg border"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Cập nhật xử lý */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold">Cập nhật xử lý</h3>

            <div>
              <label className="block text-sm font-medium mb-1">
                Trạng thái
              </label>

              <select
                value={trangThaiMoi}
                onChange={e =>
                  setTrangThaiMoi(e.target.value as TrangThaiSuCo)
                }
                className="w-full border rounded-lg p-2"
              >
                {CAC_TRANG_THAI.map(status => (
                  <option key={status} value={status}>
                    {NHAN_TRANG_THAI_SU_CO[status]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Ghi chú xử lý / Lý do
              </label>

              <textarea
                value={ghiChu}
                onChange={e => setGhiChu(e.target.value)}
                rows={3}
                className="w-full border rounded-lg p-2"
                placeholder="Nhập ghi chú xử lý..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Chi phí sửa chữa (VNĐ)
              </label>

              <input
                type="number"
                min="0"
                value={chiPhi}
                onChange={e => setChiPhi(e.target.value)}
                className="w-full border rounded-lg p-2"
              />
            </div>

            <button
              onClick={() => void capNhatSuCo()}
              disabled={dangCapNhat}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-3 font-medium"
            >
              {dangCapNhat ? 'Đang cập nhật...' : 'Lưu cập nhật'}
            </button>
          </div>

          {/* Lịch sử xử lý */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Lịch sử xử lý</h3>

            {lichSu.length === 0 ? (
              <p className="text-sm text-gray-500">
                Chưa có lịch sử xử lý.
              </p>
            ) : (
              <div className="space-y-3">
                {lichSu.map(item => (
                  <div
                    key={item.id}
                    className="border-l-2 border-blue-300 pl-3"
                  >
                    <p className="font-medium text-sm">
                      {item.tu_trang_thai
                        ? NHAN_TRANG_THAI_SU_CO[item.tu_trang_thai]
                        : 'Tạo mới'}
                      {' → '}
                      {NHAN_TRANG_THAI_SU_CO[item.den_trang_thai]}
                    </p>

                    {item.ghi_chu && (
                      <p className="text-sm text-gray-600">
                        {item.ghi_chu}
                      </p>
                    )}

                    {item.chi_phi_sua_chua !== null && (
                      <p className="text-sm text-gray-600">
                        Chi phí:{' '}
                        {Number(item.chi_phi_sua_chua).toLocaleString('vi-VN')} VNĐ
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-1">
                      {dinhDangNgay(item.tao_luc)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
