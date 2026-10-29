// TypeScript Interfaces cho hệ thống Quản Lý Nhà Trọ

export type UserRole = 'admin' | 'landlord' | 'tenant' | 'manager';

export interface User {
  id: string;
  phone: string;
  fullName: string;
  identityCard?: string;
  role: UserRole;
  createdAt: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  totalFloors: number;
  electricityRate: number;
  waterRate: number;
  internetRate?: number;
  createdAt: string;
}

export type RoomStatus = 'available' | 'occupied' | 'maintenance';

export interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor: number;
  basePrice: number;
  depositAmount: number;
  status: RoomStatus;
  areaSqm?: number;
  currentTenant?: User;
}

export type PaymentStatus = 'unpaid' | 'paid' | 'partially_paid' | 'overdue';

export interface Bill {
  id: string;
  roomId: string;
  contractId: string;
  monthYear: string; // MM/YYYY
  roomAmount: number;
  prevElectricityIndex: number;
  currElectricityIndex: number;
  electricityCost: number;
  prevWaterIndex: number;
  currWaterIndex: number;
  waterCost: number;
  otherFees: number;
  totalAmount: number;
  dueDate: string;
  paymentStatus: PaymentStatus;
  vietqrUrl?: string;
  paidAt?: string;
}

export type IssueStatus = 'pending' | 'processing' | 'resolved' | 'cancelled';

export interface Issue {
  id: string;
  roomId: string;
  tenantId?: string;
  title: string;
  description: string;
  imageUrls: string[];
  repairCost: number;
  status: IssueStatus;
  createdAt: string;
  resolvedAt?: string;
}
