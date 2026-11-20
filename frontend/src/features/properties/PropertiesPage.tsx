import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/useAuth'
import { Modal, inputClass, primaryClass, errorMessage } from '../../components/Modal'

type Row = Record<string, string | number | null>
type Field = { key: string; label: string; type?: string; min?: number; max?: number; optional?: boolean; initial?: string; fixed?: boolean }
const definitions: Record<string, { title: string; table: string; search: string; fields: Field[] }> = {
  khu: { title: 'Khu trọ', table: 'khu_tro', search: 'ten', fields: [
    { key: 'ten', label: 'Tên khu trọ' }, { key: 'dia_chi', label: 'Địa chỉ' }, { key: 'so_tang', label: 'Số tầng', type: 'number', min: 1, initial: '1' },
    { key: 'don_gia_dien', label: 'Giá điện ban đầu / kWh', type: 'number', min: 0, initial: '3500', fixed: true }, { key: 'don_gia_nuoc', label: 'Giá nước ban đầu / m³', type: 'number', min: 0, initial: '20000', fixed: true },
    { key: 'ma_bin_ngan_hang', label: 'Mã BIN ngân hàng (6 số)', optional: true }, { key: 'so_tai_khoan', label: 'Số tài khoản nhận tiền', optional: true }, { key: 'ten_tai_khoan', label: 'Tên chủ tài khoản', optional: true },
    { key: 'thanh_toan_tu_dong', label: 'Tự động xác nhận chuyển khoản qua SePay', type: 'automatic', initial: 'false' },
  ] },
  phong: { title: 'Phòng trọ', table: 'phong_tro', search: 'so_phong', fields: [
    { key: 'khu_tro_id', label: 'Khu trọ', type: 'area', fixed: true }, { key: 'so_phong', label: 'Số phòng' }, { key: 'tang', label: 'Tầng', type: 'number', min: 0, initial: '1' },
    { key: 'dien_tich_m2', label: 'Diện tích (m²)', type: 'number', min: 1, optional: true }, { key: 'so_nguoi_toi_da', label: 'Số người tối đa', type: 'number', min: 1, initial: '2' },
    { key: 'gia_thue_co_ban', label: 'Giá thuê ban đầu / tháng', type: 'number', min: 0, fixed: true }, { key: 'tien_coc', label: 'Tiền cọc', type: 'number', min: 0, initial: '0' }, { key: 'ghi_chu', label: 'Ghi chú', optional: true },
  ] },
  dichvu: { title: 'Dịch vụ', table: 'phi_dich_vu', search: 'ten', fields: [
    { key: 'khu_tro_id', label: 'Khu trọ', type: 'area', fixed: true }, { key: 'ten', label: 'Tên dịch vụ' }, { key: 'so_tien', label: 'Đơn giá ban đầu', type: 'number', min: 0, fixed: true }, { key: 'cach_tinh', label: 'Cách tính', type: 'method', fixed: true, initial: 'theo_phong' },
  ] },
}
const methods: Record<string, string> = { theo_phong: 'Theo phòng', theo_nguoi: 'Theo người', theo_don_vi: 'Theo số lượng' }

export default function PropertiesPage() {
  const { user } = useAuth()
  const canWrite = user?.vaiTro === 'chu_tro' || user?.vaiTro === 'quan_tri'
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'phong'
  const def = definitions[tab] ?? definitions.phong
  const [rows, setRows] = useState<Row[]>([])
  const [areas, setAreas] = useState<{ id: string; ten: string }[]>([])
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<Row | null>()
  const [deleting, setDeleting] = useState<Row>()
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('')
    const timer = setTimeout(async () => {
      let query = supabase.from(def.table).select('*', { count: 'exact' }).order(def.search).order('id').range(page * 20, page * 20 + 19)
      if (search.trim()) query = query.ilike(def.search, `%${search.trim().replace(/[%_]/g, '')}%`)
      if (area && def.table !== 'khu_tro') query = query.eq('khu_tro_id', area)
      const [result, list] = await Promise.all([query, supabase.from('khu_tro').select('id,ten').order('ten')])
      if (cancelled) return
      if (result.error || list.error) setError('Không tải được dữ liệu. Vui lòng thử lại.')
      else { setRows(result.data ?? []); setTotal(result.count ?? 0); setAreas(list.data ?? []) }
      setLoading(false)
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [def, search, area, page, revision])
  function open(row: Row | null) {
    setValues(Object.fromEntries(def.fields.map(f => [f.key, row?.[f.key]?.toString() ?? f.initial ?? (f.type === 'area' ? area || areas[0]?.id || '' : '')])))
    if (row?.trang_thai) setValues(v => ({ ...v, trang_thai: String(row.trang_thai) }))
    setError(''); setEditing(row)
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try {
      const body: Record<string, unknown> = {}
      for (const f of def.fields) {
        if (editing && f.fixed) continue
        const v = values[f.key]?.trim() ?? ''
        body[f.key] = f.type === 'automatic' ? v === 'true' : v === '' && f.optional ? null : f.type === 'number' ? Number(v) : v
      }
      if (def.table === 'khu_tro') {
        const bank = ['ma_bin_ngan_hang', 'so_tai_khoan', 'ten_tai_khoan'].map(k => values[k]?.trim())
        if (values.thanh_toan_tu_dong === 'true' && !bank.every(Boolean)) throw new Error('Cần nhập đủ thông tin ngân hàng trước khi bật tự động xác nhận.')
        if (bank.some(Boolean) && (!bank.every(Boolean) || !/^\d{6}$/.test(bank[0]) || !/^\d{4,30}$/.test(bank[1]))) throw new Error('Nhập đủ mã BIN 6 số, số tài khoản và tên người nhận.')
        if (!editing && user?.vaiTro === 'chu_tro') body.chu_tro_id = user.id
      }
      if (def.table === 'phong_tro' && editing && editing.trang_thai !== 'dang_thue') body.trang_thai = values.trang_thai ?? editing.trang_thai
      const result = editing ? await supabase.from(def.table).update(body).eq('id', editing.id).select('id').single() : await supabase.from(def.table).insert(body).select('id').single()
      if (result.error) throw result.error
      setEditing(undefined); setMessage('Đã lưu thông tin.'); setRevision(n => n + 1)
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!deleting || busy) return
    setBusy(true); setError('')
    const result = await supabase.from(def.table).delete().eq('id', deleting.id).select('id').single()
    if (result.error) setError(errorMessage(result.error))
    else { setDeleting(undefined); setMessage('Đã xóa.'); setPage(0); setRevision(n => n + 1) }
    setBusy(false)
  }
  return <main className="p-6"><div className="mb-6 flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-semibold">Khu trọ & phòng</h1><p className="mt-2 text-sm text-gray-500">Quản lý phòng, thông tin nhận tiền và danh mục dịch vụ.</p></div>{canWrite && <button className={primaryClass} onClick={() => open(null)}>+ Thêm {def.title.toLowerCase()}</button>}</div>
    <nav className="mb-6 flex gap-2">{Object.entries(definitions).map(([key, d]) => <button key={key} className={def === d ? primaryClass : 'rounded-lg border px-4 py-2 text-sm'} onClick={() => { setParams({ tab: key }); setSearch(''); setPage(0); setMessage('') }}>{d.title}</button>)}</nav>
    <div className="mb-4 flex flex-wrap gap-4"><label className="text-sm">Tìm kiếm<input className={inputClass} value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} /></label>{def.table !== 'khu_tro' && <label className="text-sm">Khu trọ<select className={inputClass} value={area} onChange={e => { setArea(e.target.value); setPage(0) }}><option value="">Tất cả</option>{areas.map(a => <option key={a.id} value={a.id}>{a.ten}</option>)}</select></label>}</div>
    {message && <p role="status" className="mb-4 text-emerald-800">{message}</p>}{error && editing === undefined && !deleting && <p role="alert" className="mb-4 text-red-700">{error} <button className="underline" onClick={() => setRevision(n => n + 1)}>Thử lại</button></p>}
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm text-left"><thead className="bg-emerald-50"><tr>{def.fields.slice(0, 5).map(f => <th key={f.key} className="p-4 whitespace-nowrap">{f.label.replace(' ban đầu', '')}</th>)}{def.table === 'phong_tro' && <th className="p-4">Trạng thái</th>}{canWrite && <th className="p-4">Thao tác</th>}</tr></thead><tbody>{!loading && rows.map(row => <tr key={row.id} className="border-t">{def.fields.slice(0, 5).map(f => <td key={f.key} className="p-4">{f.type === 'area' ? areas.find(a => a.id === row[f.key])?.ten : f.type === 'method' ? methods[String(row[f.key])] : f.type === 'number' ? Number(row[f.key] ?? 0).toLocaleString('vi-VN') : row[f.key] || '—'}</td>)}{def.table === 'phong_tro' && <td className="p-4">{{ trong: 'Trống', dang_thue: 'Đang thuê', bao_tri: 'Bảo trì' }[String(row.trang_thai)]}</td>}{canWrite && <td className="p-4"><div className="flex gap-3"><button className="text-emerald-800 underline" onClick={() => open(row)}>Sửa</button><button className="text-red-700 underline" onClick={() => { setError(''); setDeleting(row) }}>Xóa</button></div></td>}</tr>)}</tbody></table>{loading ? <p className="p-6">Đang tải…</p> : !rows.length && <p className="p-6 text-gray-500">Chưa có dữ liệu phù hợp.</p>}</div>
    <div className="mt-4 flex justify-end gap-4 text-sm"><button disabled={!page || loading} onClick={() => setPage(n => n - 1)}>← Trước</button><span>{total} mục · Trang {page + 1}</span><button disabled={(page + 1) * 20 >= total || loading} onClick={() => setPage(n => n + 1)}>Sau →</button></div>
    {editing !== undefined && <Modal title={`${editing ? 'Sửa' : 'Thêm'} ${def.title.toLowerCase()}`} busy={busy} onClose={() => setEditing(undefined)}><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">{def.fields.map(f => <label className="text-sm" key={f.key}>{f.label}{f.optional ? ' (tùy chọn)' : ''}{f.type === 'automatic' ? <><input className="ml-3" type="checkbox" checked={values[f.key] === 'true'} disabled={busy} onChange={e => setValues(v => ({ ...v, [f.key]: String(e.target.checked) }))} /><span className="mt-2 block text-xs text-gray-500">Chỉ bật sau khi đã kết nối SePay với đúng tài khoản nhận tiền và thử nhận giao dịch thành công.</span></> : f.type === 'area' || f.type === 'method' ? <select className={inputClass} required value={values[f.key]} disabled={busy || Boolean(editing && f.fixed)} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}>{f.type === 'area' ? <><option value="">Chọn khu</option>{areas.map(a => <option value={a.id} key={a.id}>{a.ten}</option>)}</> : Object.entries(methods).map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select> : <input className={inputClass} type={f.type ?? 'text'} min={f.min} max={f.max ?? (f.type === 'number' ? 999999999 : undefined)} maxLength={f.key === 'dia_chi' || f.key === 'ghi_chu' ? 1000 : 100} required={!f.optional} disabled={busy || Boolean(editing && f.fixed)} value={values[f.key]} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} />}</label>)}{editing && def.table === 'phong_tro' && editing.trang_thai !== 'dang_thue' && <label className="text-sm">Tình trạng phòng<select className={inputClass} value={values.trang_thai} onChange={e => setValues(v => ({ ...v, trang_thai: e.target.value }))}><option value="trong">Trống</option><option value="bao_tri">Bảo trì</option></select></label>}{editing && <p className="text-xs text-gray-500 sm:col-span-2">Đổi giá cho kỳ sau tại Hóa đơn & thanh toán → Đơn giá.</p>}{error && <p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}<button className={`${primaryClass} sm:col-span-2`} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thông tin'}</button></form></Modal>}
    {deleting && <Modal title="Xác nhận xóa" busy={busy} onClose={() => setDeleting(undefined)}><p>Xóa {def.title.toLowerCase()} <strong>{deleting[def.search]}</strong>? Dữ liệu đang có hợp đồng hoặc lịch sử liên quan sẽ không xóa được.</p>{error && <p role="alert" className="mt-3 text-red-700">{error}</p>}<button disabled={busy} className="mt-5 rounded-lg bg-red-700 px-4 py-2 text-white" onClick={() => void remove()}>Xóa</button></Modal>}
  </main>
}
