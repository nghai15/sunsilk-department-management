// src/components/forms/XacNhanThanhToanUNC.tsx
// Form người thuê gửi biên lai UNC (ủy nhiệm chi / ảnh chụp chuyển khoản ngân hàng).
// Sau khi người thuê gửi, hóa đơn chuyển sang trạng thái chờ chủ trọ duyệt.

import { useRef, useState } from 'react';
import { formatCurrencyVND } from '../../utils';
import { xacNhanFileUNC } from '../../utils/billing';

// ─────────────────────────────────────────────
// Props & Data Interfaces
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
  maGiaoDich?: string;
  ghiChu?: string;
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
  const [maGiaoDich, setMaGiaoDich] = useState<string>('');
  const [ghiChu, setGhiChu] = useState<string>('');
  const [anhFile, setAnhFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const soTien = Number(soTienStr.replace(/[^0-9]/g, ''));
  const hopLe = soTien > 0 && anhFile !== null;

  function xuLyChonAnh(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ketQua = xacNhanFileUNC(file);
    if (!ketQua.hopLe) {
      setLoi(ketQua.loiVi ?? 'File biên lai không hợp lệ');
      return;
    }

    setLoi(null);
    setAnhFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function xuLyXoaAnh() {
    setAnhFile(null);
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  }

  async function xuLyNopForm(e: React.FormEvent) {
    e.preventDefault();
    if (!hopLe || !anhFile || dangGui) return;

    await onSubmit({
      hoaDonId,
      soTien,
      anhBienLai: anhFile,
      maGiaoDich: maGiaoDich.trim() || undefined,
      ghiChu: ghiChu.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={xuLyNopForm}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
    >
      {/* Tiêu đề */}
      <div className="border-b border-gray-100 pb-3">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <span>🧾</span>
          <span>Xác nhận chuyển khoản UNC</span>
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Phòng {soPhong} · Hóa đơn tháng {thangNam}
        </p>
      </div>

      {/* Tổng tiền cần thanh toán */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 flex justify-between items-center">
        <span className="text-sm text-gray-600">Tổng tiền hóa đơn:</span>
        <span className="text-base font-bold text-blue-700">
          {formatCurrencyVND(tongTien)}
        </span>
      </div>

      {/* Số tiền thực chuyển */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Số tiền đã chuyển khoản (VNĐ) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min={1000}
          step={1000}
          value={soTienStr}
          onChange={(e) => setSoTienStr(e.target.value)}
          placeholder={String(tongTien)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        {soTien > 0 && (
          <div className="mt-1 text-xs">
            <span className="text-gray-500">Bằng chữ số: </span>
            <span className="font-semibold text-gray-800">{formatCurrencyVND(soTien)}</span>
            {soTien < tongTien && (
              <span className="ml-2 text-amber-600 font-medium">
                (⚠️ Ít hơn hóa đơn – ghi nhận thanh toán 1 phần)
              </span>
            )}
            {soTien > tongTien && (
              <span className="ml-2 text-blue-600 font-medium">
                (ℹ️ Nhiều hơn tổng tiền hóa đơn)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mã giao dịch / Tham chiếu ngân hàng (tùy chọn) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mã giao dịch / FT ngân hàng (nếu có)
        </label>
        <input
          type="text"
          value={maGiaoDich}
          onChange={(e) => setMaGiaoDich(e.target.value)}
          placeholder="VD: FT24100512345678"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
        />
      </div>

      {/* Upload biên lai UNC */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          Ảnh biên lai / Màn hình chuyển khoản UNC <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50/30 transition-colors"
        >
          <span>📎</span>
          <span>{anhFile ? anhFile.name : 'Tải lên ảnh chụp biên lai UNC...'}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={xuLyChonAnh}
        />
        {loi && <p className="text-xs text-red-600">⚠️ {loi}</p>}

        {/* Thumbnail Preview biên lai */}
        {preview && (
          <div className="relative mt-2 inline-block">
            <img
              src={preview}
              alt="Ảnh biên lai chuyển khoản"
              className="h-44 w-auto max-w-full rounded-lg object-contain border border-gray-200 bg-gray-50 shadow-sm"
            />
            <button
              type="button"
              onClick={xuLyXoaAnh}
              className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white w-6 h-6 flex items-center justify-center text-sm shadow hover:bg-red-600 transition-colors"
              title="Xóa ảnh"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Ghi chú thêm (tùy chọn) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ghi chú thêm
        </label>
        <textarea
          rows={2}
          value={ghiChu}
          onChange={(e) => setGhiChu(e.target.value)}
          placeholder="Nội dung nhắn thêm cho chủ trọ (nếu có)..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Nút gửi */}
      <button
        type="submit"
        disabled={!hopLe || dangGui}
        className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {dangGui ? '⏳ Đang gửi biên lai...' : 'Gửi biên lai xác nhận UNC'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Chủ trọ sẽ nhận được thông báo để đối soát và xác nhận thanh toán.
      </p>
    </form>
  );
}
