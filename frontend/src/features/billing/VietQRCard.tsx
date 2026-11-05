// src/features/billing/VietQRCard.tsx
// Card hiển thị mã VietQR QuickLink cho hóa đơn tiền phòng/điện nước.
// Cho phép người thuê quét mã để thanh toán nhanh qua app ngân hàng hoặc sao chép thông tin.

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
  tongTien: number;        // Số tiền cần thanh toán
  soPhong: string;
  thangNam: string;        // MM/YYYY hoặc YYYY-MM
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
  template = 'compact2',
}: VietQRCardProps) {
  const [daChepND, setDaChepND] = useState(false);
  const [daChepSTK, setDaChepSTK] = useState(false);

  const noiDung = noiDungCK || taoNoiDungChuyenKhoan(soPhong, thangNam);
  const qrUrl = taoUrlVietQR({
    maBin,
    soTaiKhoan,
    soTien: tongTien,
    noiDung,
    tenTaiKhoan,
    template,
    dinhDang: 'png',
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

  async function chepSoTaiKhoan() {
    try {
      await navigator.clipboard.writeText(soTaiKhoan);
      setDaChepSTK(true);
      setTimeout(() => setDaChepSTK(false), 2000);
    } catch {
      /* clipboard không được phép – bỏ qua */
    }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-100 flex items-center gap-1.5">
            <span>⚡</span>
            <span>Thanh toán VietQR QuickLink</span>
          </p>
          <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
            Tự động điền số tiền & nội dung
          </span>
        </div>
        <p className="mt-1.5 text-2xl font-black tracking-tight">{formatCurrencyVND(tongTien)}</p>
        <p className="text-xs text-blue-100 mt-0.5">
          Phòng {soPhong} · Tháng {thangNam}
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Khung hiển thị mã QR */}
        <div className="flex flex-col items-center justify-center p-3 bg-gray-50/80 rounded-xl border border-gray-100">
          <img
            src={qrUrl}
            alt={`Mã VietQR thanh toán phòng ${soPhong} tháng ${thangNam}`}
            className="h-64 w-auto max-w-full rounded-lg border border-gray-200 bg-white shadow-sm p-1"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="13">Không tải được QR</text></svg>';
            }}
          />
          <div className="flex gap-2 mt-2">
            <a
              href={qrUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={`VietQR_Phong${soPhong}_Thang${thangNam.replace('/', '_')}.png`}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium py-1 px-2.5 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-1"
            >
              <span>📥</span>
              <span>Tải ảnh QR</span>
            </a>
          </div>
        </div>

        {/* Thông tin tài khoản nhận tiền */}
        <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-gray-50/50 p-3 text-xs sm:text-sm">
          <div className="flex justify-between py-1.5">
            <dt className="text-gray-500">Ngân hàng thụ hưởng</dt>
            <dd className="font-semibold text-gray-800">{tenNganHang} ({maBin})</dd>
          </div>

          <div className="flex justify-between items-center py-1.5">
            <dt className="text-gray-500">Số tài khoản</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono font-bold text-gray-900 text-sm sm:text-base">{soTaiKhoan}</span>
              <button
                type="button"
                onClick={chepSoTaiKhoan}
                className="rounded bg-gray-200 hover:bg-gray-300 px-1.5 py-0.5 text-xs text-gray-700 transition-colors"
                title="Sao chép số tài khoản"
              >
                {daChepSTK ? '✓ Đã chép' : 'Chép'}
              </button>
            </dd>
          </div>

          <div className="flex justify-between py-1.5">
            <dt className="text-gray-500">Chủ tài khoản</dt>
            <dd className="font-bold text-gray-800 uppercase">{tenTaiKhoan}</dd>
          </div>

          <div className="flex justify-between py-1.5">
            <dt className="text-gray-500">Số tiền</dt>
            <dd className="font-black text-blue-700">{formatCurrencyVND(tongTien)}</dd>
          </div>
        </dl>

        {/* Khung nội dung chuyển khoản bắt buộc */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 space-y-1.5">
          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
            <span>📝</span>
            <span>Nội dung chuyển khoản (bắt buộc chính xác):</span>
          </p>
          <div className="flex items-center justify-between gap-2 bg-white rounded-lg p-2.5 border border-amber-200">
            <code className="text-sm sm:text-base font-black text-amber-950 font-mono tracking-wide">
              {noiDung}
            </code>
            <button
              type="button"
              onClick={chepNoiDung}
              className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors shadow-sm"
            >
              {daChepND ? '✓ Đã chép' : 'Sao chép'}
            </button>
          </div>
          <p className="text-[11px] text-amber-700">
            ⚠️ Vui lòng ghi chính xác nội dung này để hệ thống tự động gạch nợ hóa đơn.
          </p>
        </div>

        {/* Hướng dẫn */}
        <p className="text-xs text-gray-400 text-center">
          Mở ứng dụng ngân hàng bất kỳ (VCB, MB, Techcombank, ViettelPay...) và chọn <strong>Quét mã QR</strong>.
        </p>
      </div>
    </div>
  );
}
