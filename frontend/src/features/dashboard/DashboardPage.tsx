import { useEffect, useState } from 'react';
import type { Room } from '../../types';
import { roomService } from '../../services/roomService';
import Header from '../../components/layout/Header';
import { formatVND } from '../properties/format';

export default function DashboardPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  useEffect(() => { roomService.getRooms().then(setRooms); }, []);

  const vacant = rooms.filter((r) => r.occupancy === 'vacant').length;
  const total = rooms.reduce((s, r) => s + (r.bill?.total ?? 0), 0);
  const collected = rooms.reduce((s, r) => s + (r.bill?.paid ?? 0), 0);
  const issues = rooms.reduce((s, r) => s + r.openIssues, 0);
  const rate = rooms.length ? Math.round((vacant / rooms.length) * 100) : 0;
  const pct = total ? Math.round((collected / total) * 100) : 0;

  return (
    <>
      <Header title="Tổng quan tháng này" />
      <div className="space-y-4 p-4">
        <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Đã thu / dự kiến thu</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatVND(collected)} <span className="text-base font-normal text-slate-500">/ {formatVND(total)}</span></p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-teal-600" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-600">Còn thiếu {formatVND(total - collected)}</p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Phòng trống</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{vacant}/{rooms.length}</p>
            <p className="text-sm text-slate-500">{rate}% số phòng</p>
          </section>
          <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Sự cố đang mở</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{issues}</p>
            <p className="text-sm text-slate-500">cần xử lý</p>
          </section>
        </div>
      </div>
    </>
  );
}
