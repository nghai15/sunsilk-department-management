import { useEffect, useRef, useState } from 'react'

export interface MeterPhoto { file: File; preview: string; capturedAt: string }

export function CameraCapture({ label, photo, onCapture, disabled = false }: {
  label: string; photo?: MeterPhoto; onCapture: (photo: MeterPhoto) => void; disabled?: boolean
}) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const request = useRef(0)
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [capturing, setCapturing] = useState(false)

  function stop() {
    request.current++
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
  }
  function close() { stop(); setOpen(false); setReady(false); setCapturing(false) }
  useEffect(() => () => { request.current++; stream.current?.getTracks().forEach(track => track.stop()) }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const onHide = () => { if (document.hidden) close() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onHide)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onHide) }
  }, [open])

  async function start() {
    setError(''); setReady(false); setOpen(true)
    const current = ++request.current
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera cần HTTPS hoặc localhost. Hãy mở trang bằng kết nối bảo mật.')
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      if (current !== request.current) { media.getTracks().forEach(track => track.stop()); return }
      stream.current = media
      if (video.current) { video.current.srcObject = media; await video.current.play() }
    } catch (err) {
      if (current !== request.current) return
      stop()
      setError(err instanceof DOMException ? (err.name === 'NotAllowedError' ? 'Bạn chưa cho phép camera. Hãy cấp quyền camera trong trình duyệt rồi thử lại.' : 'Không mở được camera. Kiểm tra thiết bị hoặc đóng ứng dụng đang dùng camera.') : err instanceof Error ? err.message : 'Không mở được camera.')
    }
  }
  async function capture() {
    const element = video.current
    if (!element || !ready || !element.videoWidth || capturing) return
    const current = request.current
    setCapturing(true)
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1920 / Math.max(element.videoWidth, element.videoHeight))
    canvas.width = Math.round(element.videoWidth * scale); canvas.height = Math.round(element.videoHeight * scale)
    canvas.getContext('2d')!.drawImage(element, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (current !== request.current) return
    if (!blob) { setError('Không lưu được ảnh. Vui lòng chụp lại.'); setCapturing(false); return }
    onCapture({ file: new File([blob], `cong-to-${crypto.randomUUID()}.jpg`, { type: 'image/jpeg' }), preview: canvas.toDataURL('image/jpeg', 0.9), capturedAt: new Date().toISOString() })
    close()
  }

  return <>
    {photo ? <div className="meter-photo"><img src={photo.preview} alt={`Ảnh ${label}`} /><div><strong>Đã chụp ảnh công tơ</strong><small>{new Date(photo.capturedAt).toLocaleString('vi-VN')}</small><button type="button" className="bill-link" disabled={disabled} onClick={start}>Chụp lại</button></div></div>
      : <button type="button" className="camera-trigger" disabled={disabled} onClick={start}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 5l1-2h6l1 2h4v15H4V5z"/><circle cx="12" cy="12" r="4"/></svg><strong>Chụp ảnh công tơ</strong><span>Mở camera để chụp rõ mặt số</span></button>}
    {open && <div className="camera-overlay" role="dialog" aria-modal="true" aria-label={`Chụp ${label}`}><div className="camera-dialog"><header><h2>Chụp {label}</h2><button type="button" onClick={close} autoFocus aria-label="Đóng camera">✕</button></header><div className="camera-view"><video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} /><div className="camera-guide" /></div><p>Đưa toàn bộ mặt số vào khung, giữ máy ổn định và tránh ánh sáng phản chiếu.</p>{error && <p role="alert" className="bill-error">{error}</p>}<footer><button type="button" className="bill-secondary" onClick={close}>Hủy</button>{error ? <button type="button" className="bill-primary" onClick={start}>Thử lại</button> : <button type="button" className="bill-primary" disabled={!ready || capturing} onClick={capture}>{capturing ? 'Đang lưu ảnh…' : 'Chụp ảnh'}</button>}</footer></div></div>}
  </>
}
