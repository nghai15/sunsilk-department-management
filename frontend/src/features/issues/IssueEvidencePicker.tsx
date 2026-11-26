import { useRef, useState } from 'react'
import { ISSUE_MEDIA_ACCEPT, ISSUE_MEDIA_HELP, validateMediaFiles, validateVideoDuration, readVideoDuration } from './issueMediaValidation'
import { IssueMediaPreview } from './IssueMedia'

export function IssueEvidencePicker({ files, disabled, onChange, onChecking, onError }: { files: File[]; disabled: boolean; onChange: (files: File[]) => void; onChecking: (checking: boolean) => void; onError: (message: string) => void }) {
  const pending = useRef(false)
  const [checking, setChecking] = useState(false)
  return <div><label className="block text-sm font-medium">Ảnh/video chứng minh đã xử lý<input className="mt-2 block w-full rounded-lg border p-2" type="file" multiple accept={ISSUE_MEDIA_ACCEPT} disabled={disabled || checking} onChange={async event => {
    const selected = Array.from(event.target.files ?? []); event.target.value = ''
    if (!selected.length || pending.current) return
    pending.current = true; setChecking(true); onChecking(true); onError('')
    try {
      const next = [...files, ...selected]; validateMediaFiles(next)
      for (const file of selected) if (file.type.startsWith('video/')) validateVideoDuration(await readVideoDuration(file))
      onChange(next)
    } catch (error) { onError(error instanceof Error ? error.message : 'Không đọc được tệp.') }
    finally { pending.current = false; setChecking(false); onChecking(false) }
  }} /></label><p className="mt-2 text-xs text-gray-500">{ISSUE_MEDIA_HELP} Khi chọn tệp mới, bộ minh chứng mới sẽ thay thế bộ đang lưu.</p>{checking && <p role="status">Đang kiểm tra video…</p>}<div className="mt-3 grid grid-cols-2 gap-3">{files.map((file, index) => <div key={`${file.name}-${index}`}><IssueMediaPreview file={file} /><p className="truncate text-xs">{file.name}</p><button type="button" disabled={disabled || checking} className="text-sm text-red-700 underline" onClick={() => onChange(files.filter((_, i) => i !== index))}>Xóa tệp</button></div>)}</div></div>
}
