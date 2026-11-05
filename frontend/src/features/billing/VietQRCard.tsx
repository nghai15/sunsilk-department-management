// src/features/billing/VietQRCard.tsx
// Card hiển thị mã VietQR QuickLink cho hóa đơn.
// Dùng để người thuê quét mã và chuyển khoản nhanh.

import { useState } from 'react';
import { formatCurrencyVND } from '../../utils';
import { taoUrlVietQR, taoNoiDungChuyenKhoan } from '../../utils/billing';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface VietQRCardProps {
  maBin?: string;          // Mã BIN / Mã ngân hàng (mặc định 'MB')
  tenNganHang?: string;    // Tên ngân hàng hiển thị (mặc định 'MBBank')
  soTaiKhoan?: string;     // Số tài khoản nhận tiền (mặc định '132465798')
  tenTaiKhoan?: string;    // Chủ tài khoản (mặc định 'LE TRUNG TIN')
  tongTien: number;        // Số tiền tự tạo dựa vào mức thanh toán
  soPhong: string;
  thangNam: string;        // MM/YYYY
  /** Nội dung chuyển khoản tuỳ chỉnh (nếu không truyền sẽ tự sinh) */
  noiDungCK?: string;
  template?: 'compact' | 'compact2' | 'qr_only' | 'print';
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function VietQRCard({
  maBin = 'MB',
  tenNganHang = 'MBBank',
  soTaiKhoan = '132465798',
  tenTaiKhoan = 'LE TRUNG TIN',
  tongTien,
  soPhong,
  thangNam,
  noiDungCK,
  template = 'compact',
}: VietQRCardProps) {
  const [daChepND, setDaChepND] = useState(false);

  const noiDung = noiDungCK ?? taoNoiDungChuyenKhoan(soPhong, thangNam);
  const qrUrl = taoUrlVietQR({
    maBin,
    soTaiKhoan,
    soTien: tongTien,
    noiDung,
    template,
    dinhDang: 'svg',
  });

  async function chepNoiDung() {
    try {
      await navigator.clipboard.writeText(noiDung);
      setDaChepND(true);
      setTimeout(() => setDaChepND(false), 2000);
    } catch {
      /* clipboard không được phép – bỏ qua */
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4">
        <p className="text-xs font-medium text-blue-100 uppercase tracking-wide">Thanh toán qua VietQR</p>
        <p className="mt-1 text-xl font-bold text-white">{formatCurrencyVND(tongTien)}</p>
        <p className="text-xs text-blue-200 mt-0.5">
          Phòng {soPhong} · Tháng {thangNam}
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Mã QR */}
        <div className="flex justify-center">
          <img
            src={qrUrl}
            alt={`Mã VietQR thanh toán phòng ${soPhong} tháng ${thangNam}`}
            className="h-52 w-auto rounded-lg border border-gray-100"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="13">Không tải được QR</text></svg>';
            }}
          />
        </div>

        {/* Thông tin tài khoản */}
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Ngân hàng</dt>
            <dd className="font-medium text-gray-800">{tenNganHang} ({maBin})</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Số tài khoản</dt>
            <dd className="font-medium text-gray-800 font-mono">{soTaiKhoan}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Chủ tài khoản</dt>
            <dd className="font-medium text-gray-800 uppercase">{tenTaiKhoan}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Số tiền</dt>
            <dd className="font-bold text-blue-700">{formatCurrencyVND(tongTien)}</dd>
          </div>
        </dl>

        {/* Nội dung chuyển khoản */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-xs font-medium text-amber-700 mb-1">Nội dung chuyển khoản</p>
          <div className="flex items-center justify-between gap-2">
            <code className="text-sm font-bold text-amber-900 tracking-wide">{noiDung}</code>
            <button
              type="button"
              onClick={chepNoiDung}
              className="shrink-0 rounded-md bg-amber-200 px-2 py-1 text-xs text-amber-800 hover:bg-amber-300 transition-colors"
            >
              {daChepND ? '✓ Đã chép' : 'Chép'}
            </button>
          </div>
          <p className="mt-1 text-xs text-amber-600">
            ⚠ Nhập đúng nội dung để hệ thống xác nhận tự động.
          </p>
        </div>

        {/* Ghi chú */}
        <p className="text-xs text-gray-400 text-center">
          Quét mã bằng app ngân hàng hoặc nhập thủ công thông tin trên.
        </p>
      </div>
    </div>
  );
}

