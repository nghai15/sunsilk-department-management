// Tiện ích: Format tiền tệ VNĐ, công thức điện nước, tạo VietQR

/**
 * Định dạng số thành định dạng tiền tệ Việt Nam (VNĐ)
 * @example formatCurrencyVND(3500000) => "3.500.000 ₫"
 */
export function formatCurrencyVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

/**
 * Tính tiền điện tiêu thụ theo chỉ số mới và cũ
 */
export function calculateElectricityCost(
  prevIndex: number,
  currIndex: number,
  unitPrice: number
): { usage: number; cost: number } {
  const usage = Math.max(0, currIndex - prevIndex);
  const cost = usage * unitPrice;
  return { usage, cost };
}

/**
 * Tính tiền nước tiêu thụ theo chỉ số mới và cũ (hoặc theo khối)
 */
export function calculateWaterCost(
  prevIndex: number,
  currIndex: number,
  unitPrice: number
): { usage: number; cost: number } {
  const usage = Math.max(0, currIndex - prevIndex);
  const cost = usage * unitPrice;
  return { usage, cost };
}

/**
 * Tạo link mã VietQR nhanh (theo chuẩn VietQR QuickLink)
 * @param bankId Mã ngân hàng (ví dụ: 'MB', 'VCB', 'ICB')
 * @param accountNo Số tài khoản nhận tiền
 * @param amount Số tiền thanh toán
 * @param memo Nội dung chuyển khoản (ví dụ: "Phong 101 thang 10")
 */
export function generateVietQRQuickLink(
  bankId: string,
  accountNo: string,
  amount: number,
  memo: string
): string {
  const encodedMemo = encodeURIComponent(memo);
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodedMemo}`;
}
