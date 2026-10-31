import { useState } from 'react';
import type { Contract } from '../../types';
import { roomService } from '../../services/roomService';

interface Props { roomId: string; initial?: Contract; onSaved?: (c: Contract) => void }
type Errors = Partial<Record<keyof Contract, string>>;

function validate(c: Contract): Errors {
  const e: Errors = {};
  if (!c.tenantName.trim()) e.tenantName = 'Nhập tên người thuê.';
  if (!/^0\d{9}$/.test(c.tenantPhone)) e.tenantPhone = 'Số điện thoại gồm 10 số, bắt đầu bằng 0.';
  if (!c.startDate) e.startDate = 'Chọn ngày vào ở.';
  if (!c.endDate) e.endDate = 'Chọn ngày hết hợp đồng.';
  else if (c.startDate && c.endDate <= c.startDate) e.endDate = 'Ngày hết hạn phải sau ngày vào ở.';
  if (c.deposit < 0) e.deposit = 'Tiền cọc không được âm.';
  if (!Number.isInteger(c.occupants) || c.occupants < 1) e.occupants = 'Số người ở tối thiểu là 1.';
  return e;
}

const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600';

export default function ContractForm({ roomId, initial, onSaved }: Props) {
  const [c, setC] = useState<Contract>(
    initial ?? { roomId, tenantName: '', tenantPhone: '', startDate: '', endDate: '', deposit: 0, occupants: 1 },
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = <K extends keyof Contract>(k: K, v: Contract[K]) => setC((p) => ({ ...p, [k]: v }));

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate(c);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const saved = await roomService.saveContract(c);
    setSaving(false);
    setDone(true);
    onSaved?.(saved);
  }

  const field = (label: string, k: keyof Contract, el: React.ReactNode) => (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {el}
      {errors[k] && <span role="alert" className="mt-1 block text-sm text-rose-700">{errors[k]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-4 p-4" noValidate>
      {field('Tên người thuê', 'tenantName',
        <input className={input} value={c.tenantName} onChange={(e) => set('tenantName', e.target.value)} />)}
      {field('Số điện thoại', 'tenantPhone',
        <input className={input} inputMode="tel" value={c.tenantPhone} onChange={(e) => set('tenantPhone', e.target.value)} />)}
      <div className="grid grid-cols-2 gap-3">
        {field('Ngày vào ở', 'startDate',
          <input type="date" className={input} value={c.startDate} onChange={(e) => set('startDate', e.target.value)} />)}
        {field('Ngày hết hợp đồng', 'endDate',
          <input type="date" className={input} value={c.endDate} onChange={(e) => set('endDate', e.target.value)} />)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('Tiền cọc (đ)', 'deposit',
          <input type="number" min={0} inputMode="numeric" className={input} value={c.deposit} onChange={(e) => set('deposit', Number(e.target.value))} />)}
        {field('Số người ở', 'occupants',
          <input type="number" min={1} inputMode="numeric" className={input} value={c.occupants} onChange={(e) => set('occupants', Number(e.target.value))} />)}
      </div>
      <button
        disabled={saving}
        className="min-h-12 w-full rounded-lg bg-teal-700 font-semibold text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        {saving ? 'Đang lưu…' : 'Lưu hợp đồng'}
      </button>
      {done && <p role="status" className="text-sm text-emerald-700">Đã lưu hợp đồng.</p>}
    </form>
  );
}
