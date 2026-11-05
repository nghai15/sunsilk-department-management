// src/components/forms/NhapChiSoCongTo.tsx
// Form nhập chỉ số công tơ điện/nước kèm ảnh chụp công tơ.
// Dùng cho màn hình Hóa đơn của chủ trọ / quản lý.

import { useRef, useState } from 'react';
import type { LoaiCongTo } from '../../types';
import { tinhTienDienBacThang, tinhTienNuoc } from '../../utils/billing';
import { formatCurrencyVND } from '../../utils';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface NhapChiSoCongToProps {
  loai: LoaiCongTo;
  chiSoCu: number;
  donGiaNuoc?: number;    // đ/m³ – chỉ dùng khi loai = 'nuoc'
  dangLuu?: boolean;
  onSubmit: (data: NhapChiSoCongToData) => void | Promise<void>;
}

export interface NhapChiSoCongToData {
  loai: LoaiCongTo;
  chiSoCu: number;
  chiSoMoi: number;
  anhFile?: File;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function NhapChiSoCongTo({
  loai,
  chiSoCu,
  donGiaNuoc = 20_000,
  dangLuu = false,
  onSubmit,
}: NhapChiSoCongToProps) {
  const [chiSoMoi, setChiSoMoi] = useState<string>('');
  const [anhFile, setAnhFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const soMoi = Number(chiSoMoi);
  const hopLe = chiSoMoi !== '' && soMoi >= chiSoCu;

  // Tính tạm (preview) tiền sử dụng
  let soTieuThu = 0;
  let uocTinh = 0;
  if (hopLe) {
    if (loai === 'dien') {
      const kt = tinhTienDienBacThang(chiSoCu, soMoi);
      soTieuThu = kt.soTieuThu;
      uocTinh = kt.thanhTien;
    } else {
      const kt = tinhTienNuoc(chiSoCu, soMoi, donGiaNuoc);
      soTieuThu = kt.soTieuThu;
      uocTinh = kt.thanhTien;
    }
  }

  function xuLyChonAnh(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLoi('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP...)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLoi('Ảnh vượt quá 5 MB');
      return;
    }
    setLoi(null);
    setAnhFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function xuLyNopForm(e: React.FormEvent) {
    e.preventDefault();
    if (!hopLe) return;
    await onSubmit({ loai, chiSoCu, chiSoMoi: soMoi, anhFile: anhFile ?? undefined });
  }

  const nhanLoai = loai === 'dien' ? 'Điện' : 'Nước';
  const donViLoai = loai === 'dien' ? 'kWh' : 'm³';

  return (
    <form
      onSubmit={xuLyNopForm}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
    >
      {/* Tiêu đề */}
      <h3 className="text-base font-semibold text-gray-800">
        Nhập chỉ số công tơ {nhanLoai}
      </h3>

      {/* Chỉ số cũ (chỉ đọc) */}
      <div className="flex items-center gap-3">
        <label className="w-32 shrink-0 text-sm text-gray-500">Chỉ số cũ</label>
        <input
          type="number"
          readOnly
          value={chiSoCu}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
        />
      </div>

      {/* Chỉ số mới */}
      <div className="flex items-center gap-3">
        <label className="w-32 shrink-0 text-sm text-gray-700 font-medium">
          Chỉ số mới <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min={chiSoCu}
          step={1}
          value={chiSoMoi}
          onChange={(e) => { setChiSoMoi(e.target.value); setLoi(null); }}
          placeholder={`>= ${chiSoCu}`}
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
            chiSoMoi !== '' && !hopLe
              ? 'border-red-400 bg-red-50'
              : 'border-gray-300 bg-white'
          }`}
        />
      </div>

      {/* Lỗi chỉ số */}
      {chiSoMoi !== '' && !hopLe && (
        <p className="text-xs text-red-600">Chỉ số mới phải &ge; chỉ số cũ ({chiSoCu})</p>
      )}

      {/* Preview tính tiền bậc thang */}
      {hopLe && (
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm space-y-1">
          <p className="font-medium text-blue-800">Ước tính tiêu thụ</p>
          <div className="flex justify-between text-blue-700">
            <span>Tiêu thụ:</span>
            <span className="font-semibold">{soTieuThu} {donViLoai}</span>
          </div>
          <div className="flex justify-between text-blue-700">
            <span>Thành tiền:</span>
            <span className="font-semibold">{formatCurrencyVND(uocTinh)}</span>
          </div>
          {loai === 'dien' && (
            <p className="text-xs text-blue-500">* Tính theo biểu giá bậc thang EVN</p>
          )}
        </div>
      )}

      {/* Upload ảnh công tơ */}
      <div>
        <p className="text-sm text-gray-700 font-medium mb-2">Ảnh chụp công tơ</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <span>📷</span>
          {anhFile ? anhFile.name : 'Chọn ảnh...'}
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

        {/* Preview ảnh */}
        {preview && (
          <div className="mt-3 relative w-fit">
            <img
              src={preview}
              alt="Ảnh công tơ"
              className="h-32 w-auto rounded-lg object-cover border border-gray-200"
            />
            <button
              type="button"
              onClick={() => { setAnhFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
              className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs"
              title="Xóa ảnh"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Nút submit */}
      <button
        type="submit"
        disabled={!hopLe || dangLuu}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {dangLuu ? 'Đang lưu...' : `Lưu chỉ số ${nhanLoai}`}
      </button>
    </form>
  );
}

