import { useEffect, useMemo, useState } from 'react';
import type { Room } from '../../types';
import { roomService } from '../../services/roomService';
import Header from '../../components/layout/Header';
import RoomCard from './RoomCard';
import RoomFilters, { type Filters } from './RoomFilters';
import { getRoomStatus } from './roomStatus';

interface Props { onSelectRoom?: (room: Room) => void }

export default function RoomListPage({ onSelectRoom }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ floor: 'all', status: 'all' });

  useEffect(() => {
    roomService.getRooms().then(setRooms).finally(() => setLoading(false));
  }, []);

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b), [rooms]);
  const visible = rooms.filter(
    (r) =>
      (filters.floor === 'all' || r.floor === filters.floor) &&
      (filters.status === 'all' || getRoomStatus(r) === filters.status),
  );

  return (
    <>
      <Header title="Danh sách phòng" subtitle={`${visible.length}/${rooms.length} phòng`} />
      <RoomFilters value={filters} floors={floors} onChange={setFilters} />
      <div className="grid gap-3 px-4 pb-6 sm:grid-cols-2 xl:grid-cols-3">
        {loading && <p className="text-sm text-slate-500">Đang tải danh sách phòng…</p>}
        {!loading && visible.length === 0 && (
          <p className="text-sm text-slate-500">Không có phòng nào khớp bộ lọc. Hãy chọn “Tất cả” để xem lại.</p>
        )}
        {visible.map((r) => <RoomCard key={r.id} room={r} onSelect={onSelectRoom} />)}
      </div>
    </>
  );
}
