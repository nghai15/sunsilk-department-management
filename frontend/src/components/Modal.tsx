import { useEffect, useRef, type ReactNode } from 'react'

export function Modal({ title, children, onClose, busy = false, closeOnBackdrop = true }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; closeOnBackdrop?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; const overflow = document.body.style.overflow; dialog?.showModal(); document.body.style.overflow = 'hidden'; return () => { dialog?.close(); document.body.style.overflow = overflow } }, [])
  return <dialog ref={ref} aria-label={title} onClick={event => { if (!closeOnBackdrop || busy || event.target !== event.currentTarget) return; const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() }} onCancel={e => { e.preventDefault(); if (!busy) onClose() }} className="m-auto w-[calc(100%-24px)] max-w-2xl max-h-[90dvh] rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-black/40 overflow-hidden"><div className="max-h-[90dvh] overflow-auto p-6"><header className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{title}</h2><button type="button" autoFocus disabled={busy} onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Đóng</button></header>{children}</div></dialog>
}

export const inputClass = 'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:bg-gray-100'
export const primaryClass = 'rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
export function errorMessage(error: unknown) {
  const e = error as { code?: string; message?: string }
  if (e.code === '23503') return 'Dữ liệu đang được sử dụng. Không thể xóa.'
  if (e.code === '23505') return 'Thông tin đã tồn tại. Kiểm tra tên, số phòng hoặc hợp đồng.'
  if (e.code === '42501') return 'Bạn không có quyền thực hiện thao tác này.'
  if (e.code === '23502' || e.code === '23514' || e.code === '22P02') return 'Thông tin nhập chưa hợp lệ hoặc còn thiếu. Vui lòng kiểm tra lại.'
  return e.message ?? 'Không xử lý được yêu cầu. Vui lòng thử lại.'
}
