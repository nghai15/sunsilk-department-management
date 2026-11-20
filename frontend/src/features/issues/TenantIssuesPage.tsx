import { IssueMedia } from './IssueMedia'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'
import { NHAN_TRANG_THAI_SU_CO } from '../../utils/suCo'
import type { TrangThaiSuCo } from '../../types'
import { Modal, errorMessage, primaryClass } from '../../components/Modal'
import IssueManagementPage from './IssueManagementPage'

type Issue = { id: string; tieu_de: string; mo_ta: string; trang_thai: TrangThaiSuCo; ghi_chu_xu_ly: string | null; tao_luc: string; anh_urls: string[]; minh_chung_xu_ly: string[]; chi_phi_sua_chua: number; phong_tro: { so_phong: string } | null }
export default function TenantIssuesPage() {
  const { user } = useAuth()
  return user?.vaiTro === 'nguoi_thue' ? <TenantIssueList /> : <IssueManagementPage />
}
function TenantIssueList() {
  const { issueId } = useParams()
  const [rows, setRows] = useState<Issue[]>([])
  const [selected, setSelected] = useState<Issue>()
  const [proofs, setProofs] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [history, setHistory] = useState<{ id: string; tao_luc: string; den_trang_thai: TrangThaiSuCo; ghi_chu: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    supabase.from('su_co').select('*,phong_tro(so_phong)').order('tao_luc', { ascending: false }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(errorMessage(err)); else { setRows(data ?? []); if (issueId) setSelected(data?.find(i => i.id === issueId)) }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [issueId, revision])
  useEffect(() => {
    let cancelled = false; setImages([]); setProofs([]); setHistory([])
    if (selected) {
      void supabase.storage.from('anh-su-co').createSignedUrls(selected.minh_chung_xu_ly ?? [], 600).then(result => { if (!cancelled) { setProofs(result.data?.map(p => p.signedUrl).filter((url): url is string => Boolean(url)) ?? []); if (result.error) setError('Không tải được minh chứng xử lý.') } })
      void Promise.all([supabase.storage.from('anh-su-co').createSignedUrls(selected.anh_urls ?? [], 600), supabase.from('lich_su_su_co').select('id,tao_luc,den_trang_thai,ghi_chu').eq('su_co_id', selected.id).order('tao_luc', { ascending: false })]).then(([photos, logs]) => {
        if (cancelled) return
        if (logs.error || (selected.anh_urls.length > 0 && photos.error)) setError('Không tải đủ ảnh, video hoặc lịch sử. Vui lòng thử lại.')
        setImages(photos.data?.map(p => p.signedUrl).filter((url): url is string => Boolean(url)) ?? []); setHistory(logs.data ?? [])
      })
    }
    return () => { cancelled = true }
  }, [selected])
  return <main className="p-6"><div className="mb-6 flex justify-between gap-4"><h1 className="text-2xl font-semibold">Sự cố của bạn</h1><Link className={primaryClass} to="/issues/new">+ Báo sự cố</Link></div>{error && <p role="alert" className="my-4 text-red-700">{error}</p>}<button className="mb-4 text-sm underline" onClick={() => setRevision(n => n + 1)}>Làm mới</button>{loading ? <p>Đang tải…</p> : <div className="space-y-3">{rows.map(i => <button key={i.id} className="block w-full rounded-xl border bg-white p-5 text-left" onClick={() => { setError(''); setSelected(i) }}><span className="float-right text-xs text-emerald-800">{NHAN_TRANG_THAI_SU_CO[i.trang_thai]}</span><h2 className="font-semibold">{i.tieu_de}</h2><p className="mt-2 text-sm text-gray-500">Phòng {i.phong_tro?.so_phong} · {new Date(i.tao_luc).toLocaleString('vi-VN')}</p></button>)}{!rows.length && <p>Chưa có báo cáo sự cố.</p>}</div>}{selected && <Modal title={selected.tieu_de} onClose={() => setSelected(undefined)}><p className="whitespace-pre-wrap">{selected.mo_ta}</p><p className="my-3 font-medium">{NHAN_TRANG_THAI_SU_CO[selected.trang_thai]}</p>{selected.ghi_chu_xu_ly && <p className="rounded-lg bg-emerald-50 p-3">Phản hồi: {selected.ghi_chu_xu_ly}</p>}<div className="my-4 grid grid-cols-2 gap-3">{images.map(url => <IssueMedia key={url} url={url} />)}</div><h3 className="font-semibold">Minh chứng xử lý</h3><div className="my-4 grid grid-cols-2 gap-3">{proofs.map(url => <IssueMedia key={url} url={url} />)}</div>{selected.trang_thai === 'hoan_tat' && selected.chi_phi_sua_chua > 0 && <p className="mb-4 text-sm">Phí sửa chữa: {Number(selected.chi_phi_sua_chua).toLocaleString('vi-VN')} đ · thu chung trên hóa đơn tiền phòng.</p>}<h3 className="font-semibold">Lịch sử xử lý</h3>{history.map(h => <p key={h.id} className="mt-3 border-t pt-3 text-sm">{new Date(h.tao_luc).toLocaleString('vi-VN')} · {NHAN_TRANG_THAI_SU_CO[h.den_trang_thai]}<span className="block text-gray-600">{h.ghi_chu}</span></p>)}</Modal>}</main>
}
