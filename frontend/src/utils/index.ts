// src/utils/index.ts
// Tiện ích chung cho hệ thống: Định dạng tiền tệ VNĐ, công thức điện nước bậc thang, VietQR QuickLink, v.v.

import {
  tinhTienDienBacThang,
  tinhTienNuoc,
  taoUrlVietQR,
} from './billing';

export * from './billing';
export * from './phone';
export * from './suCo';

/**
 * Định dạng số thành định dạng tiền tệ Việt Nam (VNĐ)
 * @example formatCurrencyVND(3500000) => "3.500.000 ₫"
 */
export function formatCurrencyVND(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(safeAmount);
}

/**
 * Tính tiền điện tiêu thụ theo chỉ số mới và cũ.
 * Nếu không truyền unitPrice hoặc truyền unitPrice <= 0, sẽ tự động áp dụng công thức bậc thang EVN.
 */
export function calculateElectricityCost(
  prevIndex: number,
  currIndex: number,
  unitPrice?: number
): { usage: number; cost: number } {
  const usage = Math.max(0, currIndex - prevIndex);
  if (unitPrice && unitPrice > 0) {
    const cost = Math.round(usage * unitPrice);
    return { usage, cost };
  }
  const ketQua = tinhTienDienBacThang(prevIndex, currIndex);
  return { usage: ketQua.soTieuThu, cost: ketQua.thanhTien };
}

/**
 * Tính tiền nước tiêu thụ theo chỉ số mới và cũ (hoặc theo khối)
 */
export function calculateWaterCost(
  prevIndex: number,
  currIndex: number,
  unitPrice: number
): { usage: number; cost: number } {
  const kq = tinhTienNuoc(prevIndex, currIndex, unitPrice);
  return { usage: kq.soTieuThu, cost: kq.thanhTien };
}

/**
 * Tạo link mã VietQR nhanh (theo chuẩn VietQR QuickLink)
 * @param bankId Mã ngân hàng hoặc BIN (ví dụ: 'MB', 'VCB', 'ICB', '970422')
 * @param accountNo Số tài khoản nhận tiền
 * @param amount Số tiền thanh toán
 * @param memo Nội dung chuyển khoản (ví dụ: "Phong 101 thang 10")
 * @param accountName Tên người thụ hưởng (tùy chọn)
 */
export function generateVietQRQuickLink(
  bankId: string,
  accountNo: string,
  amount: number,
  memo: string,
  accountName?: string
): string {
  return taoUrlVietQR({
    maBin: bankId,
    soTaiKhoan: accountNo,
    soTien: amount,
    noiDung: memo,
    tenTaiKhoan: accountName,
    template: 'compact2',
    dinhDang: 'png',
  });
}
