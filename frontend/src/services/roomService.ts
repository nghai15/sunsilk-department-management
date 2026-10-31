import type { Contract, Property, Room } from '../types';

// Dữ liệu giả. Khi TV2 xong migrations, chỉ thay phần bên trong các hàm này bằng Supabase.
const properties: Property[] = [
  { id: 'p1', name: 'Dãy A', address: '12 Nguyễn Văn Linh, Q.7' },
];

const rooms: Room[] = [
  { id: 'r101', propertyId: 'p1', number: '101', floor: 1, rent: 2500000, occupancy: 'occupied', tenantName: 'Nguyễn Văn An', electricUsage: 96, waterUsage: 5, bill: { total: 3110000, paid: 3110000, dueDate: '2026-11-05' }, openIssues: 0 },
  { id: 'r102', propertyId: 'p1', number: '102', floor: 1, rent: 2500000, occupancy: 'vacant', openIssues: 0 },
  { id: 'r103', propertyId: 'p1', number: '103', floor: 1, rent: 2700000, occupancy: 'occupied', tenantName: 'Trần Thị Bích', electricUsage: 140, waterUsage: 7, bill: { total: 3540000, paid: 0, dueDate: '2026-10-05' }, openIssues: 0 },
  { id: 'r201', propertyId: 'p1', number: '201', floor: 2, rent: 2800000, occupancy: 'occupied', tenantName: 'Lê Hoàng Nam', electricUsage: 88, waterUsage: 4, bill: { total: 3300000, paid: 0, dueDate: '2026-11-05' }, openIssues: 1 },
  { id: 'r202', propertyId: 'p1', number: '202', floor: 2, rent: 2800000, occupancy: 'occupied', tenantName: 'Phạm Quỳnh Như', electricUsage: 120, waterUsage: 6, bill: { total: 3420000, paid: 3420000, dueDate: '2026-11-05' }, openIssues: 0 },
  { id: 'r203', propertyId: 'p1', number: '203', floor: 2, rent: 2800000, occupancy: 'vacant', openIssues: 0 },
];

export const roomService = {
  async getProperties(): Promise<Property[]> { return properties; },
  async getRooms(): Promise<Room[]> { return rooms; },
  async saveContract(c: Contract): Promise<Contract> {
    console.info('[mock] saveContract', c);
    return { ...c, id: c.id ?? crypto.randomUUID() };
  },
};
