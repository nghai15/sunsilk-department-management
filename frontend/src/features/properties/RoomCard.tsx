import type { Room } from '../../types';
import { formatVND } from './format';
import { getRoomStatus, STATUS_LABEL, STATUS_STYLE } from './roomStatus';

interface Props { room: Room; onSelect?: (room: Room) => void }

export default function RoomCard({ room, onSelect }: Props) {
  const status = getRoomStatus(room);
  const owed = room.bill ? room.bill.total - room.bill.paid : 0;

  return (
    <button
      onClick={() => onSelect?.(room)}
      className="w-full rounded-xl bg-white p-4 text-left ring-1 ring-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xl font-semibold text-slate-900">Phòng {room.number}</p>
          <p className="text-sm text-slate-500">Tầng {room.floor}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLE[status]}`}>
          {STATUS_LABEL[status]}
          {status === 'issue' && ` (${room.openIssues})`}
        </span>
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">Người thuê</dt><dd className="text-slate-900">{room.tenantName ?? '—'}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">Tiền phòng</dt><dd className="text-slate-900">{formatVND(room.rent)}</dd></div>
        {room.occupancy === 'occupied' && (
          <>
            <div className="flex justify-between"><dt className="text-slate-500">Điện / nước</dt><dd className="text-slate-900">{room.electricUsage ?? 0} kWh / {room.waterUsage ?? 0} m³</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Còn nợ</dt><dd className={owed > 0 ? 'font-medium text-rose-700' : 'text-slate-900'}>{owed > 0 ? formatVND(owed) : 'Đã thanh toán'}</dd></div>
          </>
        )}
      </dl>
    </button>
  );
}
