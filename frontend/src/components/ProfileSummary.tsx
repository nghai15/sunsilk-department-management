import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../features/auth/useAuth'
import { supabase } from '../services/supabase'
import { Modal, errorMessage } from './Modal'
import { contractDate } from '../features/contracts/contractDates'

function ProfilePhotoPreview({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])
  return <dialog ref={dialogRef} aria-label={`Ảnh đại diện ${name}`} onCancel={event => { event.preventDefault(); onClose() }} onClick={onClose} style={{ margin: 'auto', padding: 0, border: 0, background: 'transparent', maxWidth: '92vw', maxHeight: '90dvh', overflow: 'visible' }} className="backdrop:bg-black/80">
    <img src={src} alt={`Ảnh đại diện ${name}`} referrerPolicy="no-referrer" onClick={event => event.stopPropagation()} style={{ display: 'block', width: 'min(560px, 88vw, 85dvh)', height: 'min(560px, 88vw, 85dvh)', objectFit: 'cover', borderRadius: '50%' }} />
  </dialog>
}

function ProfileImage({ src, name, large = false }: { src?: string; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>()
  useEffect(() => {
    let cancelled = false
    if (!src) return
    if (/^https?:\/\//.test(src)) { setImageUrl(src); return }
    const load = () => { void supabase.storage.from('anh-dai-dien').createSignedUrl(src, 3600).then(({ data }) => { if (!cancelled) setImageUrl(data?.signedUrl) }) }
    load()
    const timer = setInterval(load, 50 * 60 * 1000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [src])
  const size = large ? 'h-24 w-24 text-3xl' : 'h-10 w-10 text-sm'
  const pixels = large ? 96 : 40
  const avatar = <span style={{ display: 'inline-flex', width: pixels, height: pixels, minWidth: pixels, maxWidth: pixels, minHeight: pixels, maxHeight: pixels, flex: '0 0 auto', overflow: 'hidden', borderRadius: '50%' }} className={`${size} items-center justify-center bg-emerald-100 font-semibold text-emerald-900 ring-1 ring-emerald-900/10`}>
    {imageUrl && !failed ? <img src={imageUrl} alt={`Ảnh đại diện ${name}`} width={pixels} height={pixels} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', minWidth: 0 }} onError={() => setFailed(true)} referrerPolicy="no-referrer" /> : <span aria-label={`Ảnh đại diện mặc định của ${name}`}>{name.trim().split(/\s+/).slice(-2).map(word => word[0]).join('').toUpperCase() || 'S'}</span>}
  </span>
  if (!large || !imageUrl || failed) return avatar
  return <>
    <button type="button" onClick={() => setPreviewOpen(true)} aria-label="Phóng to ảnh đại diện" aria-haspopup="dialog" style={{ padding: 0, border: 0, background: 'transparent', borderRadius: '50%', display: 'inline-flex', cursor: 'zoom-in' }}>
      {avatar}
    </button>
    {previewOpen && <ProfilePhotoPreview src={imageUrl} name={name} onClose={() => setPreviewOpen(false)} />}
  </>
}

type Contract = { ngay_thanh_toan: number; ngay_ket_thuc: string | null }
export function ProfileSummary({ roleLabel }: { roleLabel: string }) {
  const { user, updateProfilePhoto } = useAuth()
  const picker = useRef<HTMLInputElement>(null)
  const uploadLock = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [photoMessage, setPhotoMessage] = useState('')
  const [open, setOpen] = useState(false)
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!open || !user || user.vaiTro !== 'nguoi_thue') return
    let cancelled = false
    setLoading(true); setError(''); setContract(null)
    async function load() {
      try {
        const result = await supabase.from('hop_dong').select('ngay_thanh_toan,ngay_ket_thuc').eq('nguoi_thue_id', user!.id).eq('trang_thai', 'hieu_luc').maybeSingle()
        if (result.error) throw result.error
        if (!cancelled) setContract(result.data)
      } catch (err) { if (!cancelled) setError(errorMessage(err)) }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [open, user?.id, user?.vaiTro, revision])
  async function changePhoto(file?: File) {
    if (!file || !user || uploadLock.current) return
    uploadLock.current = true; setUploading(true); setPhotoError(''); setPhotoMessage('')
    let uploaded: string | undefined
    let saved = false
    try {
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
      if (!extension) throw new Error('Chọn ảnh JPG, PNG hoặc WebP.')
      if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh tối đa 5 MB. Vui lòng chọn ảnh nhỏ hơn.')
      const preview = URL.createObjectURL(file)
      try { const image = new Image(); image.src = preview; await image.decode() }
      catch { throw new Error('Không đọc được ảnh. Vui lòng chọn ảnh khác.') }
      finally { URL.revokeObjectURL(preview) }
      const random = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
      const path = `${user.id}/${random}.${extension}`
      const result = await supabase.storage.from('anh-dai-dien').upload(path, file, { contentType: file.type, upsert: false })
      if (result.error) throw result.error
      uploaded = path
      await updateProfilePhoto(path); saved = true
      setPhotoMessage('Đã cập nhật ảnh đại diện.')
      if (user.anhDaiDien?.startsWith(`${user.id}/`)) await supabase.storage.from('anh-dai-dien').remove([user.anhDaiDien])
    } catch (err) {
      if (uploaded && !saved) await supabase.storage.from('anh-dai-dien').remove([uploaded])
      setPhotoError(errorMessage(err))
    } finally { uploadLock.current = false; setUploading(false) }
  }
  if (!user) return null
  const isTenant = user.vaiTro === 'nguoi_thue'
  const payment = !isTenant ? 'Không áp dụng' : loading ? 'Đang tải…' : error ? 'Chưa tải được' : contract ? `Ngày ${contract.ngay_thanh_toan} hằng tháng` : 'Chưa có hợp đồng hiệu lực'
  const expiry = !isTenant ? 'Không áp dụng' : loading ? 'Đang tải…' : error ? 'Chưa tải được' : contract ? contract.ngay_ket_thuc ? contractDate(contract.ngay_ket_thuc) : 'Chưa cập nhật' : 'Chưa có hợp đồng hiệu lực'
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Xem hồ sơ ${user.hoTen}`} aria-haspopup="dialog" className="flex max-w-full min-w-0 items-center gap-2 rounded-xl p-1 text-left hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:gap-3">
      <ProfileImage key={user.anhDaiDien} src={user.anhDaiDien} name={user.hoTen} />
      <span className="min-w-0"><span className="block truncate text-sm font-semibold leading-tight sm:text-base">{user.hoTen}</span><span className="mt-1 block text-xs text-gray-500">{roleLabel}</span></span>
    </button>
    {open && <Modal title="Thông tin cá nhân" busy={uploading} onClose={() => setOpen(false)}>
      <div className="flex flex-col items-center gap-3 border-b border-gray-100 pb-6 text-center">
        <ProfileImage key={user.anhDaiDien} src={user.anhDaiDien} name={user.hoTen} large />
        <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Chọn ảnh đại diện" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void changePhoto(file) }} />
        <button type="button" disabled={uploading} onClick={() => picker.current?.click()} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-50">{uploading ? 'Đang lưu ảnh…' : 'Đổi ảnh đại diện'}</button>
        <p className="text-xs text-gray-500">JPG, PNG hoặc WebP · Tối đa 5 MB</p>
        {photoError && <p role="alert" className="text-sm text-red-700">{photoError}</p>}
        {photoMessage && <p role="status" className="text-sm text-emerald-800">{photoMessage}</p>}
        <div><h3 className="text-xl font-semibold text-emerald-950">{user.hoTen}</h3><p className="mt-1 text-sm text-gray-500">{roleLabel}</p></div>
      </div>
      <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        {[['Họ và tên', user.hoTen], ['Số điện thoại', user.soDienThoai || 'Chưa cập nhật'], ['Ngày đóng tiền', payment], ['Ngày hết hạn hợp đồng', expiry]].map(([label, value]) => <div key={label}><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
      </dl>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<button type="button" className="ml-2 underline" onClick={() => setRevision(n => n + 1)}>Thử lại</button></p>}
    </Modal>}
  </>
}
