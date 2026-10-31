import type { TrangThaiSuCo } from '../types';

export const NHAN_TRANG_THAI_SU_CO: Record<TrangThaiSuCo, string> = {
  cho_tiep_nhan: 'Chờ tiếp nhận',
  dang_xu_ly: 'Đang xử lý',
  chua_the_xu_ly: 'Chưa thể xử lý',
  hoan_tat: 'Đã xử lý',
  da_huy: 'Đã hủy',
};

export const TRANG_THAI_SU_CO_DANG_MO: readonly TrangThaiSuCo[] = [
  'cho_tiep_nhan',
  'dang_xu_ly',
  'chua_the_xu_ly',
];

export function laSuCoDangMo(trangThai: TrangThaiSuCo): boolean {
  return TRANG_THAI_SU_CO_DANG_MO.includes(trangThai);
}
