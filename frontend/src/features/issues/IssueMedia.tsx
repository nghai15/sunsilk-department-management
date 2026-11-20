import { useEffect, useState } from 'react'

export function IssueMedia({ url, video = /\.(mp4|webm|mov)(?:\?|$)/i.test(url) }: { url: string; video?: boolean }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  return <div className="min-w-0">{video ? <video src={url} controls playsInline preload="metadata" onError={() => setFailed(true)} className="h-40 w-full rounded-lg border bg-black object-contain" /> : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Ảnh sự cố" loading="lazy" onError={() => setFailed(true)} className="h-40 w-full rounded-lg border object-contain" /></a>}{failed && <p className="mt-1 text-xs text-red-700">Không xem được tệp. <a href={url} target="_blank" rel="noreferrer" className="underline">Mở tệp</a> hoặc tải lại trang.</p>}</div>
}
export function IssueMediaPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next) }, [file])
  return url ? <IssueMedia url={url} video={file.type.startsWith('video/')} /> : null
}
