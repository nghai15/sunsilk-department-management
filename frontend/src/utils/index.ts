// src/utils/index.ts
// Tiện ích chung cho hệ thống: Định dạng tiền tệ VNĐ, công thức điện nước mặt bằng, VietQR QuickLink, v.v.

import {
  tinhTienDienMatBang,
  tinhTienNuoc,
  taoUrlVietQR,
  DON_GIA_DIEN_MAT_BANG_MAC_DINH,
  DON_GIA_NUOC_MAT_BANG_MAC_DINH,
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
 * Tính tiền điện tiêu thụ theo công thức mặt bằng chung (đơn giá phẳng khu trọ).
 * Công thức: Số tiêu thụ (kWh) × Đơn giá điện (đồng/kWh)
 */
export function calculateElectricityCost(
  prevIndex: number,
  currIndex: number,
  unitPrice: number = DON_GIA_DIEN_MAT_BANG_MAC_DINH
): { usage: number; cost: number } {
  const kq = tinhTienDienMatBang(prevIndex, currIndex, unitPrice);
  return { usage: kq.soTieuThu, cost: kq.thanhTien };
}

/**
 * Tính tiền nước tiêu thụ theo công thức mặt bằng chung (đơn giá phẳng khu trọ).
 * Công thức: Số tiêu thụ (m³) × Đơn giá nước (đồng/m³)
 */
export function calculateWaterCost(
  prevIndex: number,
  currIndex: number,
  unitPrice: number = DON_GIA_NUOC_MAT_BANG_MAC_DINH
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
