import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'
import { money } from './TenantBillingFlow'

type Transaction = { id: number; tai_khoan: string; noi_dung: string; so_tien: number; da_phan_bo: number; trang_thai: string; ghi_chu: string | null; tao_luc: string }
export function BankTransactions() {
  const [rows, setRows] = useState<Transaction[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(0)
  const [pendingOnly, setPendingOnly] = useState(true)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      let query = supabase.from('giao_dich_ngan_hang').select('*').order('tao_luc', { ascending: false }).order('id').range(page * 20, page * 20 + 19)
      if (pendingOnly) query = query.eq('trang_thai', 'can_doi_soat')
      const result = await query
      if (cancelled) return
      if (result.error) setError('Không tải được giao dịch ngân hàng. Hãy kiểm tra kết nối và cấu hình dữ liệu.')
      else setRows(result.data ?? [])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [revision, page, pendingOnly])
  return <section className="meter-card"><h2>Giao dịch ngân hàng</h2><p className="my-3 text-sm text-gray-600">Khoản chuyển đúng mã hóa đơn được tự ghi nhận. Kiểm tra khoản dư hoặc nội dung không khớp tại đây.</p>
    <div className="my-4 flex gap-4"><label><input type="checkbox" checked={pendingOnly} onChange={e => { setPendingOnly(e.target.checked); setPage(0) }} /> Chỉ hiện khoản cần đối soát</label><button className="underline" onClick={() => setRevision(n => n + 1)}>Làm mới</button></div>
    {error && <p role="alert">{error}</p>}{loading ? <p>Đang tải…</p> : !error && <>{!rows.length && <p>Chưa có giao dịch phù hợp.</p>}{rows.map(row => <TransactionCard key={`${row.id}-${revision}`} row={row} onSaved={() => setRevision(n => n + 1)} />)}<div className="mt-4 flex gap-4"><button disabled={page === 0} onClick={() => setPage(n => n - 1)}>← Trước</button><span>Trang {page + 1}</span><button disabled={rows.length < 20} onClick={() => setPage(n => n + 1)}>Sau →</button></div></>}
  </section>
}
function TransactionCard({ row, onSaved }: { row: Transaction; onSaved: () => void }) {
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [close, setClose] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <article className="my-4 rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{money(Number(row.so_tien))}</strong><span>{row.trang_thai === 'da_khop' ? 'Đã khớp hóa đơn' : row.trang_thai === 'da_xu_ly' ? 'Đã xử lý đối soát' : 'Cần đối soát'}</span></div><p className="my-2 break-all text-sm">{row.noi_dung}</p><p className="text-sm text-gray-600">SePay #{row.id} · Tài khoản {row.tai_khoan} · {new Date(row.tao_luc).toLocaleString('vi-VN')}</p><p className="my-2 text-sm">Đã ghi vào hóa đơn: {money(Number(row.da_phan_bo))} · Chưa phân bổ: {money(Number(row.so_tien) - Number(row.da_phan_bo))}</p>{row.ghi_chu && <p className="text-sm">Ghi chú xử lý: {row.ghi_chu}</p>}
    {row.trang_thai === 'can_doi_soat' && <details><summary className="cursor-pointer text-emerald-900">Xử lý giao dịch</summary><form className="mt-3 space-y-3" onSubmit={async e => {
      e.preventDefault(); if (busy) return
      setBusy(true); setError('')
      try {
        const result = await supabase.rpc('doi_soat_giao_dich', { p_id: row.id, p_ma: code.trim().toUpperCase(), p_ghi_chu: note.trim(), p_dong: close })
        if (result.error) throw result.error
        onSaved()
      } catch (err) { setError(err instanceof Error ? err.message : 'Không xử lý được. Kiểm tra mã hóa đơn, khoản dư và quyền truy cập.') }
      finally { setBusy(false) }
    }}><label className="block text-sm"><input type="checkbox" checked={close} disabled={busy} onChange={e => setClose(e.target.checked)} /> Đã xử lý khoản này bên ngoài (ví dụ đã hoàn tiền), không ghi thêm vào hóa đơn</label>{!close && <label className="block text-sm">Mã thanh toán của hóa đơn<input required pattern="[Ss][Ss][a-fA-F0-9]{32}" className="mt-1 block w-full rounded-lg border p-2" value={code} onChange={e => setCode(e.target.value)} disabled={busy} placeholder="SS…" /></label>}<label className="block text-sm">Lý do / thông tin đối soát<textarea required maxLength={1000} className="mt-1 block w-full rounded-lg border p-2" value={note} onChange={e => setNote(e.target.value)} disabled={busy} /></label>{error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy || !note.trim()} className="rounded-lg bg-emerald-900 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Đang xử lý…' : close ? 'Lưu kết quả đối soát' : 'Ghi nhận vào hóa đơn'}</button></form></details>}
  </article>
}
