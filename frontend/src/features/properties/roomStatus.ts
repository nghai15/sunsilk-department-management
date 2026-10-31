import type { Room, RoomStatus } from '../../types';

// Thứ tự ưu tiên hiển thị: sự cố > nợ > đã thuê > trống
export function getRoomStatus(room: Room, today = new Date()): RoomStatus {
  if (room.openIssues > 0) return 'issue';
  if (room.occupancy === 'vacant') return 'vacant';
  if (room.bill && room.bill.paid < room.bill.total && new Date(room.bill.dueDate) < today)
    return 'overdue';
  return 'occupied';
}

export const STATUS_LABEL: Record<RoomStatus, string> = {
  vacant: 'Trống',
  occupied: 'Đã thuê',
  overdue: 'Nợ tiền',
  issue: 'Có sự cố',
};

export const STATUS_STYLE: Record<RoomStatus, string> = {
  vacant: 'bg-slate-100 text-slate-700 ring-slate-300',
  occupied: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
  overdue: 'bg-rose-50 text-rose-800 ring-rose-300',
  issue: 'bg-amber-50 text-amber-900 ring-amber-300',
};
