import type { RoomStatus } from '../../types';
import { STATUS_LABEL } from './roomStatus';

export interface Filters { floor: number | 'all'; status: RoomStatus | 'all' }
interface Props { value: Filters; floors: number[]; onChange: (f: Filters) => void }

const chip = (on: boolean) =>
  `shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${
    on ? 'bg-teal-700 text-white ring-teal-700' : 'bg-white text-slate-700 ring-slate-300'
  }`;

export default function RoomFilters({ value, floors, onChange }: Props) {
  const statuses = Object.keys(STATUS_LABEL) as RoomStatus[];
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Lọc theo tình trạng">
        <button className={chip(value.status === 'all')} onClick={() => onChange({ ...value, status: 'all' })}>Tất cả</button>
        {statuses.map((s) => (
          <button key={s} className={chip(value.status === s)} onClick={() => onChange({ ...value, status: s })}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Lọc theo tầng">
        <button className={chip(value.floor === 'all')} onClick={() => onChange({ ...value, floor: 'all' })}>Mọi tầng</button>
        {floors.map((f) => (
          <button key={f} className={chip(value.floor === f)} onClick={() => onChange({ ...value, floor: f })}>Tầng {f}</button>
        ))}
      </div>
    </div>
  );
}
