
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../services/supabase'
import type { PhanLoaiSuCo } from '../../types'

const DANH_SACH_LOAI: { value: PhanLoaiSuCo; label: string }[] = [
  { value: 'dien', label: 'Điện' },
  { value: 'nuoc', label: 'Nước' },
  { value: 'may_lanh', label: 'Máy lạnh' },
  { value: 'noi_that', label: 'Nội thất' },
  { value: 'mang', label: 'Mạng Internet' },
  { value: 'khac', label: 'Khác' },
]

const DUNG_LUONG_TOI_DA = 5 * 1024 * 1024
const LOAI_ANH_HOP_LE = ['image/jpeg', 'image/png', 'image/webp']

export default function IssueReportPage() {
  const { user } = useAuth()

  const [tieuDe, setTieuDe] = useState('')
  const [phanLoai, setPhanLoai] = useState<PhanLoaiSuCo>('dien')
  const [moTa, setMoTa] = useState('')
  const [anh, setAnh] = useState<File[]>([])
  const [dangGui, setDangGui] = useState(false)
  const [thongBao, setThongBao] = useState('')
  const [loi, setLoi] = useState('')

  function chonAnh(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    setLoi('')

    if (files.some((file) => !LOAI_ANH_HOP_LE.includes(file.type))) {
      setLoi('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.')
      event.target.value = ''
      return
    }

    if (files.some((file) => file.size > DUNG_LUONG_TOI_DA)) {
      setLoi('Mỗi ảnh không được vượt quá 5 MB.')
      event.target.value = ''
      return
    }

    setAnh(files)
  }

  async function guiBaoCao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoi('')
    setThongBao('')

    if (!user) {
      setLoi('Bạn cần đăng nhập để gửi báo cáo.')
      return
    }

    if (!tieuDe.trim() || !moTa.trim()) {
      setLoi('Vui lòng nhập tiêu đề và mô tả sự cố.')
      return
    }

    setDangGui(true)

    try {
      const { data: hopDong, error: loiHopDong } = await supabase
        .from('hop_dong')
        .select('phong_id')
        .eq('nguoi_thue_id', user.id)
        .eq('trang_thai', 'hieu_luc')
        .limit(1)
        .maybeSingle()

      if (loiHopDong) throw loiHopDong

      if (!hopDong?.phong_id) {
        throw new Error('Không tìm thấy hợp đồng thuê phòng đang hiệu lực.')
      }

      const phongId = hopDong.phong_id as string
      const cacDuongDanAnh: string[] = []

      for (const file of anh) {
        const duoiFile = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const tenFile = `${crypto.randomUUID()}.${duoiFile}`
        const duongDan = `${phongId}/${tenFile}`

        const { error: loiTaiAnh } = await supabase.storage
          .from('anh-su-co')
          .upload(duongDan, file, {
            contentType: file.type,
            upsert: false,
          })

        if (loiTaiAnh) throw loiTaiAnh

        cacDuongDanAnh.push(duongDan)
      }

      const { error: loiTaoSuCo } = await supabase
        .from('su_co')
        .insert({
          phong_id: phongId,
          nguoi_thue_id: user.id,
          tieu_de: tieuDe.trim(),
          mo_ta: moTa.trim(),
          phan_loai: phanLoai,
          anh_urls: cacDuongDanAnh,
          trang_thai: 'cho_tiep_nhan',
        })

      if (loiTaoSuCo) throw loiTaoSuCo

      setTieuDe('')
      setPhanLoai('dien')
      setMoTa('')
      setAnh([])
      setThongBao('Gửi báo cáo sự cố thành công!')

      const inputAnh = document.getElementById('anh-su-co') as HTMLInputElement | null
      if (inputAnh) inputAnh.value = ''
    } catch (error) {
      console.error('Lỗi gửi báo cáo sự cố:', error)
      setLoi(
        error instanceof Error
          ? error.message
          : 'Không thể gửi báo cáo. Vui lòng thử lại.',
      )
    } finally {
      setDangGui(false)
    }
  }

  return (
    <div className="w-full md:w-1/2 mx-auto space-y-4">
      {/* Tiêu đề */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Báo cáo sự cố
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Gửi thông tin sự cố tại phòng trọ để ban quản lý hỗ trợ.
        </p>
      </div>

      {/* Form báo cáo */}
      <form
        onSubmit={guiBaoCao}
        className="bg-white border rounded-xl p-4 space-y-4 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            Tiêu đề sự cố
          </label>
          <input
            value={tieuDe}
            onChange={(event) => setTieuDe(event.target.value)}
            maxLength={200}
            placeholder="Ví dụ: Bóng đèn phòng bị hỏng"
            className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Loại sự cố
          </label>
          <select
            value={phanLoai}
            onChange={(event) =>
              setPhanLoai(event.target.value as PhanLoaiSuCo)
            }
            className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            {DANH_SACH_LOAI.map((loai) => (
              <option key={loai.value} value={loai.value}>
                {loai.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Mô tả chi tiết
          </label>
          <textarea
            value={moTa}
            onChange={(event) => setMoTa(event.target.value)}
            rows={3}
            placeholder="Mô tả tình trạng sự cố..."
            className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Hình ảnh sự cố
          </label>
          <input
            id="anh-su-co"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={chonAnh}
            className="w-full border rounded-lg p-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Chỉ nhận JPG, PNG, WEBP. Tối đa 5 MB mỗi ảnh.
          </p>

          {anh.length > 0 && (
            <p className="text-sm text-gray-600 mt-2">
              Đã chọn {anh.length} ảnh.
            </p>
          )}
        </div>

        {loi && (
          <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">
            {loi}
          </div>
        )}

        {thongBao && (
          <div className="rounded-lg bg-green-50 text-green-700 p-3 text-sm">
            {thongBao}
          </div>
        )}

        <button
          type="submit"
          disabled={dangGui}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-3 font-medium"
        >
          {dangGui ? 'Đang gửi báo cáo...' : 'Gửi báo cáo sự cố'}
        </button>
      </form>
    </div>
  )
}
