import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { supabase } from '../../services/supabase'
import { ContractRequestForm } from './ContractTools'
import { contractDate, contractToday, expiryDays } from './contractDates'

export function ContractExpiryNotice({ userId }: { userId: string }) {
  const [contract, setContract] = useState<{ id: string; ngay_ket_thuc: string }>()
  const [requesting, setRequesting] = useState(false)
  const [dismissed, setDismissed] = useState('')
  useEffect(() => {
    let cancelled = false
    async function check() {
      const result = await supabase.from('hop_dong').select('id,ngay_ket_thuc').eq('nguoi_thue_id', userId).eq('trang_thai', 'hieu_luc').limit(1)
      if (cancelled || result.error) return
      const row = result.data[0]
      const days = row ? expiryDays(row.ngay_ket_thuc, contractToday()) : -1
      if (!row || days < 0 || days > 10) { setContract(undefined); return }
      const key = `contract-expiry:${userId}:${row.id}:${row.ngay_ket_thuc}:${contractToday()}`
      let hidden = dismissed === key
      try { hidden ||= sessionStorage.getItem(key) === 'dismissed' } catch { /* Bộ nhớ phiên có thể bị tắt. */ }
      if (hidden) { setContract(undefined); return }
      const pending = await supabase.from('yeu_cau_hop_dong').select('id').eq('hop_dong_id', row.id).eq('trang_thai', 'cho_duyet').limit(1)
      if (!cancelled && !pending.error) setContract(pending.data.length ? undefined : row)
    }
    void check(); const timer = setInterval(() => { void check() }, 60000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [userId, dismissed])
  function dismiss() {
    if (contract) {
      const key = `contract-expiry:${userId}:${contract.id}:${contract.ngay_ket_thuc}:${contractToday()}`
      try { sessionStorage.setItem(key, 'dismissed') } catch { /* Vẫn đóng được popup. */ }
      setDismissed(key)
    }
    setContract(undefined); setRequesting(false)
  }
  if (!contract) return null
  const days = expiryDays(contract.ngay_ket_thuc, contractToday())
  return <Modal title={days === 0 ? 'Hợp đồng hết hạn hôm nay' : 'Hợp đồng sắp hết hạn'} onClose={dismiss}><p className="mb-4">Hợp đồng của bạn hết hạn ngày <strong>{contractDate(contract.ngay_ket_thuc)}</strong>{days > 0 ? `, còn ${days} ngày.` : '.'}</p>{requesting ? <ContractRequestForm contractId={contract.id} end={contract.ngay_ket_thuc} kind="gia_han" onSent={dismiss} /> : <div className="flex flex-wrap gap-3"><button className="rounded-lg bg-emerald-900 px-4 py-3 text-white" onClick={() => setRequesting(true)}>Gửi yêu cầu gia hạn</button><button className="rounded-lg border px-4 py-3" onClick={dismiss}>Nhắc lại sau</button></div>}</Modal>
}
