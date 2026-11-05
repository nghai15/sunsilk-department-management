// src/components/forms/DuyetThanhToanUNC.tsx
// Component dành cho chủ trọ / quản lý để xác nhận (duyệt hoặc từ chối) chuyển khoản UNC.

import { useState } from 'react';
import { formatCurrencyVND } from '../../utils';

// ─────────────────────────────────────────────
// Props & Interfaces
// ─────────────────────────────────────────────

export interface DuyetThanhToanUNCProps {
  hoaDonId: string;
  thanhToanId: string;
  soPhong: string;
  thangNam: string;
  tongTienHoaDon: number;
  soTienDaChuyen: number;
  anhBienLaiUrl?: string;
  maGiaoDich?: string;
  ghiChu?: string;
  thoiGianGui?: string;
  dangXuLy?: boolean;
  onXacNhan: (duyet: boolean, lyDoTuChoi?: string) => Promise<void> | void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function DuyetThanhToanUNC({
  soPhong,
  thangNam,
  tongTienHoaDon,
  soTienDaChuyen,
  anhBienLaiUrl,
  maGiaoDich,
  ghiChu,
  thoiGianGui,
  dangXuLy = false,
  onXacNhan,
}: DuyetThanhToanUNCProps) {
  const [moModalAnh, setMoModalAnh] = useState(false);
  const [hienFormTuChoi, setHienFormTuChoi] = useState(false);
  const [lyDoTuChoi, setLyDoTuChoi] = useState('');

  const chenhLech = soTienDaChuyen - tongTienHoaDon;
  const laKhopTien = chenhLech === 0;

  async function xuLyDuyet() {
    if (dangXuLy) return;
    await onXacNhan(true);
  }

  async function xuLyTuChoi(e: React.FormEvent) {
    e.preventDefault();
    if (dangXuLy) return;
    await onXacNhan(false, lyDoTuChoi.trim() || 'Biên lai chuyển khoản không hợp lệ');
  }

  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50/40 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-yellow-200/60 pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span>🛡️</span>
            <span>Xác nhận chuyển khoản UNC</span>
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Phòng {soPhong} · Hóa đơn tháng {thangNam}
          </p>
        </div>
        <span className="rounded-full bg-yellow-100 border border-yellow-300 px-3 py-1 text-xs font-semibold text-yellow-800">
          Chờ xác nhận
        </span>
      </div>

      {/* Thông tin đối soát tiền */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs text-gray-500">Cần thanh toán:</p>
          <p className="text-base font-bold text-gray-800">{formatCurrencyVND(tongTienHoaDon)}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs text-gray-500">Người thuê chuyển:</p>
          <p className={`text-base font-bold ${laKhopTien ? 'text-green-700' : 'text-blue-700'}`}>
            {formatCurrencyVND(soTienDaChuyen)}
          </p>
        </div>
      </div>

      {/* Cảnh báo nếu số tiền không khớp */}
      {!laKhopTien && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 px-3.5 py-2.5 text-xs text-orange-800">
          {chenhLech < 0 ? (
            <span>⚠️ Người thuê chuyển thiếu <strong>{formatCurrencyVND(Math.abs(chenhLech))}</strong>. Sau khi duyệt sẽ ghi nhận <em>thanh toán 1 phần</em>.</span>
          ) : (
            <span>ℹ️ Người thuê chuyển dư <strong>{formatCurrencyVND(chenhLech)}</strong>.</span>
          )}
        </div>
      )}

      {/* Chi tiết phụ: mã giao dịch, thời gian, ghi chú */}
      {(maGiaoDich || ghiChu || thoiGianGui) && (
        <div className="bg-white rounded-lg p-3 border border-gray-200 text-xs space-y-1.5 text-gray-600">
          {maGiaoDich && (
            <div className="flex justify-between">
              <span className="text-gray-500">Mã giao dịch UNC:</span>
              <span className="font-mono font-medium text-gray-800">{maGiaoDich}</span>
            </div>
          )}
          {thoiGianGui && (
            <div className="flex justify-between">
              <span className="text-gray-500">Thời gian gửi:</span>
              <span>{new Date(thoiGianGui).toLocaleString('vi-VN')}</span>
            </div>
          )}
          {ghiChu && (
            <div className="pt-1 border-t border-gray-100">
              <span className="text-gray-500">Ghi chú: </span>
              <span className="italic text-gray-700">{ghiChu}</span>
            </div>
          )}
        </div>
      )}

      {/* Ảnh biên lai UNC */}
      {anhBienLaiUrl && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-700">Ảnh chụp biên lai chuyển khoản UNC:</p>
          <div className="relative inline-block cursor-pointer" onClick={() => setMoModalAnh(true)}>
            <img
              src={anhBienLaiUrl}
              alt="Biên lai UNC"
              className="h-36 w-auto max-w-full rounded-lg border border-gray-300 object-contain hover:opacity-95 shadow-sm"
            />
            <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
              🔍 Bấm để phóng to
            </span>
          </div>
        </div>
      )}

      {/* Modal phóng to ảnh */}
      {moModalAnh && anhBienLaiUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setMoModalAnh(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={anhBienLaiUrl}
              alt="Biên lai phóng to"
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setMoModalAnh(false)}
              className="absolute -top-3 -right-3 rounded-full bg-white text-gray-800 w-8 h-8 flex items-center justify-center shadow-lg font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Form từ chối (kèm lý do) */}
      {hienFormTuChoi ? (
        <form onSubmit={xuLyTuChoi} className="bg-white p-3.5 rounded-lg border border-red-200 space-y-2.5">
          <label className="block text-xs font-semibold text-red-700">
            Lý do từ chối biên lai UNC <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={2}
            value={lyDoTuChoi}
            onChange={(e) => setLyDoTuChoi(e.target.value)}
            placeholder="VD: Tiền chưa vào tài khoản / Ảnh bị mờ không xem được..."
            className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setHienFormTuChoi(false)}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={dangXuLy}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {dangXuLy ? 'Đang gửi...' : 'Xác nhận từ chối'}
            </button>
          </div>
        </form>
      ) : (
        /* Các nút hành động chính */
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={xuLyDuyet}
            disabled={dangXuLy}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            <span>✓</span>
            <span>{dangXuLy ? 'Đang xử lý...' : 'Xác nhận chuyển khoản UNC'}</span>
          </button>

          <button
            type="button"
            onClick={() => setHienFormTuChoi(true)}
            disabled={dangXuLy}
            className="rounded-lg border border-red-300 bg-white px-3.5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Từ chối
          </button>
        </div>
      )}
    </div>
  );
}

