import { SettlementDialog } from './ContractSettlement'
import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../services/supabase'
import { Modal, inputClass, primaryClass, errorMessage } from '../../components/Modal'
import { useAuth } from '../auth/useAuth'
import { contractDate, contractToday, sixMonthsAfter, terminationReasons } from './contractDates'
import { IssueMediaPreview } from '../issues/IssueMedia'

type RequestRow = { id: string; hop_dong_id: string; loai: string; ngay_de_nghi: string; ly_do: string; trang_thai: string; phan_hoi: string | null; ngay_duyet: string | null; hop_dong?: { phong_tro: { so_phong: string } | null; nguoi_thue: { ho_ten: string } | null } | null }
export function ContractRequestForm({ contractId, end, kind, onSent }: { contractId: string; end: string; kind: 'gia_han' | 'cham_dut'; onSent: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return
    const data = new FormData(e.currentTarget)
    setBusy(true); setError('')
    const reason = [data.get('reason'), data.get('detail')].filter(Boolean).join(': ')
    const result = await supabase.rpc('gui_yeu_cau_hop_dong', { p_id: contractId, p_loai: kind, p_ngay: data.get('day'), p_ly_do: reason })
    setBusy(false)
    if (result.error) setError(errorMessage(result.error)); else onSent()
  }
  return <form onSubmit={send} className="space-y-4"><p className="text-sm text-gray-600">Yêu cầu được gửi đến chủ trọ và quản trị viên. Hợp đồng chỉ thay đổi sau khi được chấp thuận.</p><label className="block text-sm">{kind === 'gia_han' ? 'Đề nghị gia hạn đến ngày' : 'Ngày muốn chấm dứt'}<input type="date" name="day" className={inputClass} required min={kind === 'gia_han' && end > contractToday() ? end : contractToday()} defaultValue={kind === 'gia_han' ? sixMonthsAfter(end > contractToday() ? end : contractToday()) : contractToday()} disabled={busy} /></label>{kind === 'cham_dut' && <label className="block text-sm">Lý do<select name="reason" className={inputClass} required disabled={busy}>{terminationReasons.map(reason => <option key={reason}>{reason}</option>)}</select></label>}<label className="block text-sm">{kind === 'gia_han' ? 'Nội dung đề nghị' : 'Chi tiết lý do'}<textarea name="detail" required maxLength={700} className={inputClass} disabled={busy} /></label>{error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className={primaryClass}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button></form>
}

export function OriginalContract({ id, editable }: { id: string; editable: boolean }) {
  const [open, setOpen] = useState(false)
  const [paths, setPaths] = useState<string[]>([])
  const [urls, setUrls] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true); setError(''); setUrls([])
    void (async () => {
      const result = await supabase.from('hop_dong').select('anh_hop_dong').eq('id', id).single()
      if (cancelled) return
      if (result.error) { setError(errorMessage(result.error)); setLoading(false); return }
      const photos = result.data.anh_hop_dong as string[]
      const signed = photos.length ? await supabase.storage.from('hop-dong-goc').createSignedUrls(photos, 600) : null
      if (cancelled) return
      setPaths(photos); setUrls(signed?.data?.map(p => p.signedUrl).filter((url): url is string => Boolean(url)) ?? [])
      if (signed?.error) setError('Không tải được ảnh hợp đồng. Hãy tải lại.')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [open, id, revision])
  async function upload() {
    if (busy || !files.length) return
    setBusy(true); setError('')
    try {
      const added: string[] = []
      for (const file of files) {
        const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
        const path = `${id}/${crypto.randomUUID()}.${ext}`
        const result = await supabase.storage.from('hop-dong-goc').upload(path, file, { contentType: file.type, upsert: false })
        if (result.error) throw result.error
        added.push(path)
      }
      const result = await supabase.from('hop_dong').update({ anh_hop_dong: [...paths, ...added] }).eq('id', id).select('id').single()
      if (result.error) throw result.error
      setFiles([]); setRevision(n => n + 1)
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  return <><button type="button" className="text-sm text-emerald-900 underline" onClick={() => { setFiles([]); setOpen(true) }}>Xem hợp đồng gốc</button>{open && <Modal title="Hợp đồng giấy đã ký" busy={busy} onClose={() => setOpen(false)}>{loading ? <p>Đang tải…</p> : <>{!paths.length && <p className="text-sm text-gray-500">Chưa có ảnh hợp đồng giấy. Chủ trọ hoặc quản trị viên cần bổ sung.</p>}<div className="space-y-4">{urls.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Trang hợp đồng ${i + 1}`} className="my-3 w-full rounded-lg border" /></a>)}</div><button className="my-3 text-sm underline" onClick={() => setRevision(n => n + 1)}>Tải lại ảnh</button>{editable && <section className="mt-3 border-t pt-4"><label className="block text-sm">Thêm ảnh các trang hợp đồng giấy<input type="file" multiple accept="image/jpeg,image/png,image/webp" className={inputClass} disabled={busy} onChange={e => {
      const next = Array.from(e.target.files ?? []); e.target.value = ''; setError('')
      if (next.length + paths.length > 10 || next.some(f => !['image/jpeg','image/png','image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024 || f.size === 0)) { setError('Tối đa 10 ảnh JPG/PNG/WEBP, mỗi ảnh không quá 5 MB.'); return }
      setFiles(next)
    }} /></label><p className="mt-2 text-xs text-gray-500">Ảnh hợp đồng đã ký, tối đa 10 trang, mỗi ảnh 5 MB.</p><div className="my-3 grid grid-cols-2 gap-3">{files.map((file, index) => <IssueMediaPreview key={index} file={file} />)}</div><button disabled={busy || !files.length} className={primaryClass} onClick={() => void upload()}>{busy ? 'Đang lưu…' : 'Lưu ảnh hợp đồng'}</button></section>}</>}{error && <p role="alert" className="mt-3 text-red-700">{error}</p>}</Modal>}</>
}

export function ContractRequests({ contractId, end, active = true, onChanged }: { contractId?: string; end?: string; active?: boolean; onChanged?: () => void }) {
  const { user } = useAuth()
  const staff = user?.vaiTro === 'chu_tro' || user?.vaiTro === 'quan_tri'
  const [rows, setRows] = useState<RequestRow[]>([])
  const [kind, setKind] = useState<'gia_han' | 'cham_dut'>()
  const [review, setReview] = useState<RequestRow>()
  const [settling, setSettling] = useState<RequestRow>()
  const [decision, setDecision] = useState('yes')
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('')
    let query = supabase.from('yeu_cau_hop_dong').select('*,hop_dong(phong_tro(so_phong),nguoi_thue:nguoi_dung!hop_dong_nguoi_thue_id_fkey(ho_ten))').order('tao_luc', { ascending: false }).order('id').range(page * 20, page * 20 + 19)
    if (contractId) query = query.eq('hop_dong_id', contractId)
    if (staff) query = query.eq('trang_thai', 'cho_duyet')
    void query.then(result => { if (cancelled) return; if (result.error) setError(errorMessage(result.error)); else setRows(result.data as unknown as RequestRow[]); setLoading(false) })
    return () => { cancelled = true }
  }, [contractId, revision, page, staff])
  const pending = rows.some(row => row.trang_thai === 'cho_duyet')
  async function decide(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!review || busy) return
    if (review.loai === 'cham_dut' && decision === 'yes') {
      setError(''); setSettling(review); setReview(undefined); return
    }
    const data = new FormData(e.currentTarget); setBusy(true); setError('')
    const result = await supabase.rpc('duyet_yeu_cau_hop_dong', { p_id: review.id, p_duyet: data.get('decision') === 'yes', p_ngay: data.get('day') || null, p_phan_hoi: data.get('note') })
    setBusy(false)
    if (result.error) setError(errorMessage(result.error)); else { setReview(undefined); setRevision(n => n + 1); onChanged?.() }
  }
  return <section className="my-6 rounded-xl border bg-white p-5"><h2 className="font-semibold">{staff ? 'Yêu cầu hợp đồng chờ xử lý' : 'Yêu cầu của bạn'}</h2>{!staff && contractId && end && active && <div className="my-4 flex flex-wrap gap-3"><button disabled={loading || pending} className={primaryClass} onClick={() => setKind('gia_han')}>Yêu cầu gia hạn</button><button disabled={loading || pending} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" onClick={() => setKind('cham_dut')}>Yêu cầu chấm dứt</button></div>}{sent && <p role="status" className="my-3 text-emerald-800">Đã gửi yêu cầu đến chủ trọ và quản trị.</p>}{loading ? <p className="my-3 text-sm">Đang tải…</p> : rows.map(row => <article key={row.id} className="mt-3 border-t pt-3 text-sm"><strong>{row.loai === 'gia_han' ? 'Gia hạn' : 'Chấm dứt'} · {contractDate(row.ngay_de_nghi)}</strong>{staff && <p>{row.hop_dong?.nguoi_thue?.ho_ten} · Phòng {row.hop_dong?.phong_tro?.so_phong}</p>}<p className="my-2 whitespace-pre-wrap">{row.ly_do}</p><p>{{ cho_duyet: 'Đang chờ xử lý', da_duyet: 'Đã chấp thuận', tu_choi: 'Không chấp thuận' }[row.trang_thai]}</p>{row.phan_hoi && <p className="mt-2">Phản hồi: {row.phan_hoi}{row.ngay_duyet && ` · Ngày được duyệt: ${contractDate(row.ngay_duyet)}`}</p>}{staff && <button className="my-2 text-emerald-900 underline" onClick={() => { setDecision('yes'); setError(''); setReview(row) }}>Xử lý yêu cầu</button>}</article>)}{!loading && !rows.length && <p className="mt-3 text-sm text-gray-500">Chưa có yêu cầu.</p>}{(page > 0 || rows.length === 20) && <div className="mt-3 flex gap-3"><button disabled={!page} onClick={() => setPage(n => n - 1)}>Trước</button><button disabled={rows.length < 20} onClick={() => setPage(n => n + 1)}>Sau</button></div>}{error && <p role="alert" className="mt-3 text-red-700">{error}</p>}{kind && contractId && end && <Modal title={kind === 'gia_han' ? 'Đề nghị gia hạn hợp đồng' : 'Đề nghị chấm dứt hợp đồng'} onClose={() => setKind(undefined)}><ContractRequestForm contractId={contractId} end={end} kind={kind} onSent={() => { setKind(undefined); setSent(true); setPage(0); setRevision(n => n + 1) }} /></Modal>}{review && <Modal title="Xử lý yêu cầu hợp đồng" busy={busy} onClose={() => setReview(undefined)}>
      <form onSubmit={decide} className="space-y-4">
        <p>{review.ly_do} · Ngày đề nghị: {contractDate(review.ngay_de_nghi)}</p>
        <label className="block text-sm">Quyết định
          <select name="decision" className={inputClass} value={decision} disabled={busy} onChange={e => { setDecision(e.target.value); setError('') }}>
            <option value="yes">Chấp thuận</option>
            <option value="no">Không chấp thuận</option>
          </select>
        </label>
        {review.loai === 'cham_dut' && decision === 'yes' ? <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">Bước tiếp theo là đối chiếu công nợ, tiền cọc và xác nhận bàn giao. Yêu cầu chỉ được chấp thuận sau khi hoàn tất quyết toán. Nếu trả phòng trong tương lai, giữ yêu cầu chờ đến ngày bàn giao.</p> : <>
          {review.loai === 'gia_han' && decision === 'yes' && <label className="block text-sm">Ngày hết hạn mới<input type="date" name="day" required disabled={busy} className={inputClass} defaultValue={review.ngay_de_nghi} /></label>}
          <label className="block text-sm">{decision === 'no' ? 'Lý do không chấp thuận' : 'Phản hồi'}<textarea name="note" required disabled={busy} maxLength={1000} className={inputClass} /></label>
        </>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button disabled={busy} className={primaryClass}>{busy ? 'Đang lưu…' : review.loai === 'cham_dut' && decision === 'yes' ? 'Tiếp tục quyết toán' : decision === 'no' ? 'Xác nhận không chấp thuận' : 'Xác nhận gia hạn'}</button>
      </form>
    </Modal>}{settling && <SettlementDialog id={settling.hop_dong_id} requestId={settling.id} onClose={() => setSettling(undefined)} onDone={() => { setSettling(undefined); setRevision(n => n + 1); onChanged?.() }} />}</section>
}
