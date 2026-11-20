import type { BillingInvoice } from './TenantBillingFlow'

export interface BillRow {
  chi_tiet_hoa_don?: { dien_giai: string; so_tien: number; su_co_id: string | null }[];
  la_ban_nhap?: boolean; ghi_chu_kiem_tra?: string | null;
  id: string; tien_phong: number; tien_dien: number; tien_nuoc: number; tien_dich_vu: number; tong_tien: number;
  chi_so_dien_cu: number; chi_so_dien_moi: number; chi_so_nuoc_cu: number; chi_so_nuoc_moi: number;
  ma_thanh_toan?: string; noi_dung_chuyen_khoan: string; han_thanh_toan: string;
}
export function toBill(row: BillRow, paid = 0, pending = false): BillingInvoice {
  return { repairs: row.chi_tiet_hoa_don?.filter(line => line.su_co_id).map(line => ({ label: line.dien_giai, amount: Number(line.so_tien) })) ?? [], draft: row.la_ban_nhap, reviewNote: row.ghi_chu_kiem_tra ?? undefined, id: row.id, rent: Number(row.tien_phong), electricity: Number(row.tien_dien), water: Number(row.tien_nuoc), services: Number(row.tien_dich_vu), total: Number(row.tong_tien), electricityUsage: row.chi_so_dien_moi - row.chi_so_dien_cu, waterUsage: row.chi_so_nuoc_moi - row.chi_so_nuoc_cu, memo: row.ma_thanh_toan ?? row.noi_dung_chuyen_khoan, due: row.han_thanh_toan, remaining: Math.max(0, Number(row.tong_tien) - paid), pending }
}
