export const ISSUE_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime'
export const ISSUE_MEDIA_HELP = 'Tối đa 5 tệp, gồm tối đa 1 video. Ảnh JPG/PNG/WEBP tối đa 5 MB; video MP4/WebM/MOV dưới 10 giây, tối đa 20 MB.'
export const mediaExtensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }
export function validateMediaFiles(files: Pick<File, 'type' | 'size'>[]) {
  if (files.length > 5) throw new Error('Mỗi báo cáo được gửi tối đa 5 tệp.')
  if (files.filter(file => file.type.startsWith('video/')).length > 1) throw new Error('Mỗi báo cáo được gửi tối đa 1 video.')
  for (const file of files) {
    if (!mediaExtensions[file.type]) throw new Error('Chỉ nhận ảnh JPG, PNG, WEBP hoặc video MP4, WebM, MOV.')
    const video = file.type.startsWith('video/')
    if (!file.size || file.size > (video ? 20 : 5) * 1024 * 1024) throw new Error(video ? 'Video phải có dữ liệu và không vượt quá 20 MB.' : 'Ảnh phải có dữ liệu và không vượt quá 5 MB.')
  }
}
export function validateVideoDuration(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Không đọc được thời lượng video. Hãy chọn video MP4 khác.')
  if (duration >= 10) throw new Error('Video phải ngắn hơn 10 giây. Hãy cắt ngắn video rồi chọn lại.')
}
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    const finish = (error?: Error) => {
      const duration = video.duration
      clearTimeout(timer); video.onloadedmetadata = null; video.onerror = null
      video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url)
      if (error) reject(error); else resolve(duration)
    }
    const timer = setTimeout(() => finish(new Error('Không đọc được video. Hãy thử một video MP4 khác.')), 10000)
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish()
    video.onerror = () => finish(new Error('Trình duyệt không đọc được video này. Hãy chọn video MP4 khác.'))
    video.src = url
  })
}
