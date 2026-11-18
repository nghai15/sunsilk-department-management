import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'
import type { TongQuanDashboard } from '../../types'

export interface KhuOption {
  id: string
  ten: string
}

export function useDashboard() {
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
        setKhuId(list[0]?.id ?? null)
        if (list.length === 0) setLoading(false)
      })
  }, [])

  // Tổng quan của khu đang chọn
  useEffect(() => {
    if (!khuId) return
    let cancelled = false
    setLoading(true)
    supabase.rpc('tong_quan_dashboard', { p_khu_tro_id: khuId }).then(({ data: res, error: err }) => {
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
  }, [khuId])

  return { khuList, khuId, setKhuId, data, loading, error }
}