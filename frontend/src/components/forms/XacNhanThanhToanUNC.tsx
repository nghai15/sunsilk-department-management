// src/components/forms/XacNhanThanhToanUNC.tsx
// Form người thuê gửi biên lai UNC (ủy nhiệm chi / chụp màn hình chuyển khoản).
// Chủ trọ sẽ duyệt hoặc từ chối sau khi nhận.

import { useRef, useState } from 'react';
import { formatCurrencyVND } from '../../utils';
import { xacNhanFileUNC } from '../../utils/billing';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface XacNhanThanhToanUNCProps {
  hoaDonId: string;
  tongTien: number;
  thangNam: string;
  soPhong: string;
  dangGui?: boolean;
  onSubmit: (data: XacNhanThanhToanUNCData) => void | Promise<void>;
}

export interface XacNhanThanhToanUNCData {
  hoaDonId: string;
  soTien: number;
  anhBienLai: File;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function XacNhanThanhToanUNC({
  hoaDonId,
  tongTien,
  thangNam,
  soPhong,
  dangGui = false,
  onSubmit,
}: XacNhanThanhToanUNCProps) {
  const [soTienStr, setSoTienStr] = useState<string>(String(tongTien));
  const [anhFile, setAnhFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const soTien = Number(soTienStr.replace(/[^0-9]/g, ''));
  const hopLe = soTien > 0 && anhFile !== null;

  function xuLyChonAnh(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ket = xacNhanFileUNC(file);
    if (!ket.hopLe) {
      setLoi(ket.loiVi ?? 'File không hợp lệ');
      return;
    }
    setLoi(null);
    setAnhFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function xuLyNopForm(e: React.FormEvent) {
    e.preventDefault();
    if (!hopLe || !anhFile) return;
    await onSubmit({ hoaDonId, soTien, anhBienLai: anhFile });
  }

  return (
    <form
      onSubmit={xuLyNopForm}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
    >
      {/* Tiêu đề */}
      <div>
        <h3 className="text-base font-semibold text-gray-800">Xác nhận chuyển khoản</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Phòng {soPhong} · Hóa đơn tháng {thangNam}
        </p>
      </div>

      {/* Tổng tiền */}
      <div className="rounded-lg bg-gray-50 px-4 py-3 flex justify-between items-center">
        <span className="text-sm text-gray-600">Tổng cần thanh toán</span>
        <span className="text-lg font-bold text-blue-700">{formatCurrencyVND(tongTien)}</span>
      </div>

      {/* Số tiền thực chuyển */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Số tiền đã chuyển <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min={1}
          max={tongTien * 2}
          step={1000}
          value={soTienStr}
          onChange={(e) => setSoTienStr(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {soTien > 0 && soTien !== tongTien && (
          <p className="mt-1 text-xs text-amber-600">
            {soTien < tongTien ? '⚠️ Chuyển thiếu – sẽ ghi nhận thanh toán một phần' : '✅ Chuyển nhiều hơn'}
          </p>
        )}
      </div>

      {/* Upload biên lai */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ảnh biên lai / màn hình chuyển khoản <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <span>📎</span>
          {anhFile ? anhFile.name : 'Chọn ảnh biên lai...'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={xuLyChonAnh}
        />
        {loi && <p className="mt-1 text-xs text-red-600">{loi}</p>}

        {/* Preview biên lai */}
        {preview && (
          <div className="mt-3 relative w-fit">
            <img
              src={preview}
              alt="Biên lai"
              className="h-40 w-auto rounded-lg object-contain border border-gray-200 bg-gray-50"
            />
            <button
              type="button"
              onClick={() => {
                setAnhFile(null);
                setPreview(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs"
              title="Xóa ảnh"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Nút gửi */}
      <button
        type="submit"
        disabled={!hopLe || dangGui}
        className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {dangGui ? 'Đang gửi...' : 'Gửi biên lai xác nhận'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Chủ trọ sẽ kiểm tra và xác nhận trong vòng 24 giờ.
      </p>
    </form>
  );
}

