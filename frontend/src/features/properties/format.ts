export const formatVND = (n: number) =>
  new Intl.NumberFormat('vi-VN').format(n) + ' đ';

export const formatDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN') : '';
