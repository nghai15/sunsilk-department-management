import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'
import type { TongQuanDashboard } from '../../types'

export interface KhuOption {
  id: string
  ten: string
}

export function useDashboard() {
  const [period, setPeriod] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7))
  const [revision, setRevision] = useState(0)
  const [khuList, setKhuList] = useState<KhuOption[]>([])
  const [khuId, setKhuId] = useState<string | null>(null)
  const [data, setData] = useState<TongQuanDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Danh sách khu mà người dùng được xem (RLS tự lọc)
  useEffect(() => {
    supabase
      .from('khu_tro')
      .select('id, ten')
      .order('ten')
      .then(({ data: rows, error: err }) => {
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }
        const list = (rows ?? []) as KhuOption[]
        setKhuList(list)
        setKhuId(current => list.some(k => k.id === current) ? current : list[0]?.id ?? null)
        setError(null)
        if (list.length === 0) setLoading(false)
      })
  }, [revision])

  // Tổng quan của khu đang chọn
  useEffect(() => {
    if (!khuId) return
    let cancelled = false
    setLoading(true)
    setData(null)
    supabase.rpc('tong_quan_dashboard', { p_khu_tro_id: khuId, p_ky: period ? `${period}-01` : null }).then(({ data: res, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      else {
        setData(res as TongQuanDashboard)
        setError(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [khuId, period, revision])

  return { period, setPeriod, khuList, khuId, setKhuId, data, loading, error, refresh: () => setRevision(n => n + 1) }
}
