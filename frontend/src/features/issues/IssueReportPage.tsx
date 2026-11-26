import { ISSUE_MEDIA_ACCEPT, ISSUE_MEDIA_HELP, mediaExtensions, validateMediaFiles, validateVideoDuration, readVideoDuration } from './issueMediaValidation'
import { IssueMediaPreview } from './IssueMedia'

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
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


export default function IssueReportPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<{ id: string; phong_tro: { so_phong: string } | null }[]>([])
  const [contractId, setContractId] = useState('')
  useEffect(() => {
    let cancelled = false
    supabase.from('hop_dong').select('id,phong_tro(so_phong)').eq('nguoi_thue_id', user!.id).eq('trang_thai', 'hieu_luc').then(result => {
      if (cancelled) return
      if (result.error) setLoi('Không tải được phòng đang thuê.')
      else { setContracts(result.data as unknown as { id: string; phong_tro: { so_phong: string } | null }[]); setContractId(result.data?.[0]?.id ?? '') }
    })
    return () => { cancelled = true }
  }, [user?.id])

  const [tieuDe, setTieuDe] = useState('')
  const [phanLoai, setPhanLoai] = useState<PhanLoaiSuCo>('dien')
  const [moTa, setMoTa] = useState('')
  const [anh, setAnh] = useState<File[]>([])
  const [checking, setChecking] = useState(false)
  const checkingRef = useRef(false)
  const sendingRef = useRef(false)
  const [dangGui, setDangGui] = useState(false)
  const [thongBao, setThongBao] = useState('')
  const [loi, setLoi] = useState('')

  async function chonAnh(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length || checkingRef.current || sendingRef.current) return
    checkingRef.current = true; setChecking(true); setLoi('')
    try {
      validateMediaFiles([...anh, ...files])
      for (const file of files) {
        if (file.type.startsWith('video/')) validateVideoDuration(await readVideoDuration(file))
      }
      setAnh(current => [...current, ...files])
    } catch (error) { setLoi(error instanceof Error ? error.message : 'Không đọc được tệp đã chọn.') }
    finally { checkingRef.current = false; setChecking(false) }
  }

  async function guiBaoCao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sendingRef.current || checkingRef.current) return
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

    sendingRef.current = true
    setDangGui(true)
    const cacDuongDanAnh: string[] = []

    try {
      const { data: hopDong, error: loiHopDong } = await supabase
        .from('hop_dong')
        .select('phong_id')
        .eq('nguoi_thue_id', user.id)
        .eq('trang_thai', 'hieu_luc')
        .eq('id', contractId)
        .limit(1)
        .maybeSingle()

      if (loiHopDong) throw loiHopDong

      if (!hopDong?.phong_id) {
        throw new Error('Không tìm thấy hợp đồng thuê phòng đang hiệu lực.')
      }

      const phongId = hopDong.phong_id as string
      validateMediaFiles(anh)

      for (const file of anh) {
        const duoiFile = mediaExtensions[file.type]
        const tenFile = `${crypto.randomUUID()}.${duoiFile}`
        const duongDan = `${phongId}/${user.id}/${tenFile}`

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
      if (cacDuongDanAnh.length) await supabase.storage.from('anh-su-co').remove(cacDuongDanAnh)
      setLoi(
        error instanceof Error
          ? error.message
          : 'Không thể gửi báo cáo. Vui lòng thử lại.',
      )
    } finally {
      sendingRef.current = false
      setDangGui(false)
    }
  }

  return (
    <div className="w-full max-w-2xl p-6 mx-auto space-y-4">
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
        <label className="block text-sm">Phòng báo sự cố<select className="mt-1 w-full rounded-lg border p-2" required value={contractId} onChange={e => setContractId(e.target.value)} disabled={dangGui}><option value="">Chọn phòng đang thuê</option>{contracts.map(c => <option key={c.id} value={c.id}>Phòng {c.phong_tro?.so_phong}</option>)}</select></label>
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
            Ảnh và video sự cố
          </label>
          <input
            id="anh-su-co"
            type="file"
            accept={ISSUE_MEDIA_ACCEPT}
            disabled={dangGui || checking}
            multiple
            onChange={chonAnh}
            className="w-full border rounded-lg p-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            {ISSUE_MEDIA_HELP}
          </p>

          {checking && <p role="status" className="mt-2 text-sm text-gray-600">Đang kiểm tra video…</p>}
          {anh.length > 0 && <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{anh.map((file, index) => <div key={`${file.name}-${index}`} className="rounded-xl border p-2"><IssueMediaPreview file={file} /><p className="mt-2 truncate text-xs" title={file.name}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p><button type="button" disabled={dangGui || checking} className="mt-2 text-sm text-red-700 underline disabled:opacity-50" onClick={() => setAnh(current => current.filter((_, i) => i !== index))}>Xóa tệp</button></div>)}</div>}

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
          disabled={dangGui || checking}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-3 font-medium"
        >
          {dangGui ? 'Đang gửi báo cáo...' : 'Gửi báo cáo sự cố'}
        </button>
      </form>
    </div>
  )
}
