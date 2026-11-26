import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../services/supabase'

export function MeterReviewNotice({ userId }: { userId: string }) {
  const { pathname, search } = useLocation()
  const [requests, setRequests] = useState<{ id: string; thang_nam: string; ghi_chu_kiem_tra: string; hop_dong_id: string; ky: string }[]>([])
  useEffect(() => {
    let cancelled = false
    async function refresh() {
      const { data, error } = await supabase.from('hoa_don')
        .select('id,thang_nam,ghi_chu_kiem_tra,hop_dong_id,ky')
        .eq('la_ban_nhap', true).not('ghi_chu_kiem_tra', 'is', null).order('ky', { ascending: false })
      if (!cancelled && !error) setRequests(data ?? [])
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 15000)
    window.addEventListener('focus', refresh)
    window.addEventListener('meter-submitted', refresh)
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('meter-submitted', refresh) }
  }, [userId, pathname, search])
  return <div aria-live="polite">{requests.map(request => <section key={request.id} className="mx-4 mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <strong>Thông báo: cần gửi lại công tơ kỳ {request.thang_nam}</strong>
    <p className="mt-1">Lý do: {request.ghi_chu_kiem_tra}</p>
    <Link reloadDocument className="mt-2 inline-block font-semibold underline" to={`/billing/chi-so?contract=${request.hop_dong_id}&period=${request.ky}`}>Nhập lại chỉ số và chụp mới cả hai công tơ →</Link>
  </section>)}</div>
}
