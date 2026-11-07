// src/components/forms/NhapChiSoCongTo.tsx
// Form nhập chỉ số công tơ điện/nước kèm ảnh chụp công tơ.
// Áp dụng công thức tính tiền theo mặt bằng chung khu trọ (đơn giá phẳng).

import { useRef, useState } from 'react';
import type { LoaiCongTo } from '../../types';
import {
  tinhTienDienMatBang,
  tinhTienNuoc,
  xacNhanFileUNC,
  DON_GIA_DIEN_MAT_BANG_MAC_DINH,
  DON_GIA_NUOC_MAT_BANG_MAC_DINH,
} from '../../utils/billing';
import { formatCurrencyVND } from '../../utils';

// ─────────────────────────────────────────────
// Props & Data Interfaces
// ─────────────────────────────────────────────

export interface NhapChiSoCongToProps {
  loai: LoaiCongTo;
  chiSoCu: number;
  donGiaDien?: number;    // đ/kWh – dùng khi loai = 'dien' (mặc định 3.500 đ/kWh)
  donGiaNuoc?: number;    // đ/m³ – dùng khi loai = 'nuoc' (mặc định 20.000 đ/m³)
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
  donGiaDien = DON_GIA_DIEN_MAT_BANG_MAC_DINH,
  donGiaNuoc = DON_GIA_NUOC_MAT_BANG_MAC_DINH,
  dangLuu = false,
  onSubmit,
}: NhapChiSoCongToProps) {
  const [chiSoMoi, setChiSoMoi] = useState<string>('');
  const [anhFile, setAnhFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const soMoi = Number(chiSoMoi);
  const daNhap = chiSoMoi.trim() !== '';
  const hopLe = daNhap && !Number.isNaN(soMoi) && soMoi >= chiSoCu;

  // Tính toán ước tính mức tiêu thụ và chi phí theo công thức mặt bằng
  let soTieuThu = 0;
  let uocTinh = 0;

  if (hopLe) {
    if (loai === 'dien') {
      const ktDien = tinhTienDienMatBang(chiSoCu, soMoi, donGiaDien);
      soTieuThu = ktDien.soTieuThu;
      uocTinh = ktDien.thanhTien;
    } else {
      const ktNuoc = tinhTienNuoc(chiSoCu, soMoi, donGiaNuoc);
      soTieuThu = ktNuoc.soTieuThu;
      uocTinh = ktNuoc.thanhTien;
    }
  }

  function xuLyChonAnh(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const kiemTra = xacNhanFileUNC(file);
    if (!kiemTra.hopLe) {
      setLoi(kiemTra.loiVi ?? 'File ảnh không hợp lệ');
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
    if (!hopLe || dangLuu) return;
    await onSubmit({
      loai,
      chiSoCu,
      chiSoMoi: soMoi,
      anhFile: anhFile ?? undefined,
    });
  }

  const nhanLoai = loai === 'dien' ? 'Điện' : 'Nước';
  const donViLoai = loai === 'dien' ? 'kWh' : 'm³';
  const bieuTuong = loai === 'dien' ? '⚡' : '💧';
  const donGiaHienThi = loai === 'dien' ? donGiaDien : donGiaNuoc;

  return (
    <form
      onSubmit={xuLyNopForm}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
    >
      {/* Tiêu đề */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <span>{bieuTuong}</span>
          <span>Nhập chỉ số công tơ {nhanLoai}</span>
        </h3>
        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
          Mặt bằng: {donGiaHienThi.toLocaleString('vi-VN')} đ/{donViLoai}
        </span>
      </div>

      {/* Chỉ số cũ (chỉ đọc) */}
      <div className="flex items-center gap-3">
        <label className="w-32 shrink-0 text-sm text-gray-500">Chỉ số cũ ({donViLoai})</label>
        <input
          type="number"
          readOnly
          value={chiSoCu}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 font-mono cursor-not-allowed select-none"
        />
      </div>

      {/* Chỉ số mới */}
      <div className="flex items-center gap-3">
        <label className="w-32 shrink-0 text-sm text-gray-700 font-medium">
          Chỉ số mới <span className="text-red-500">*</span>
        </label>
        <div className="w-full">
          <input
            type="number"
            min={chiSoCu}
            step={1}
            value={chiSoMoi}
            onChange={(e) => {
              setChiSoMoi(e.target.value);
              setLoi(null);
            }}
            placeholder={`>= ${chiSoCu}`}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              daNhap && !hopLe
                ? 'border-red-400 bg-red-50'
                : 'border-gray-300 bg-white'
            }`}
            required
          />
        </div>
      </div>

      {/* Thông báo lỗi chỉ số */}
      {daNhap && !hopLe && (
        <p className="text-xs text-red-600 pl-35">
          ⚠️ Chỉ số mới phải là số nguyên &ge; chỉ số cũ ({chiSoCu} {donViLoai})
        </p>
      )}

      {/* Preview tính tiền theo công thức mặt bằng */}
      {hopLe && (
        <div className="rounded-lg bg-blue-50/80 border border-blue-100 px-4 py-3 text-sm space-y-1.5">
          <div className="flex items-center justify-between text-blue-900 font-medium">
            <span>Tiêu thụ kỳ này:</span>
            <span className="font-bold text-base font-mono">
              {soTieuThu} {donViLoai}
            </span>
          </div>

          <div className="flex items-center justify-between text-blue-800">
            <span>Ước tính thành tiền:</span>
            <span className="font-bold text-blue-700 text-base font-mono">
              {formatCurrencyVND(uocTinh)}
            </span>
          </div>

          <p className="text-xs text-blue-600 pt-1 border-t border-blue-200/50">
            * Tính theo công thức mặt bằng: {soTieuThu} {donViLoai} × {donGiaHienThi.toLocaleString('vi-VN')} đ = {formatCurrencyVND(uocTinh)}
          </p>
        </div>
      )}

      {/* Upload ảnh chụp công tơ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700 font-medium flex items-center gap-1.5">
            <span>📷</span>
            <span>Ảnh chụp công tơ</span>
          </label>
          <span className="text-xs text-gray-400">Tối đa 5MB</span>
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-colors"
        >
          <span>📸</span>
          <span>{anhFile ? anhFile.name : 'Chụp ảnh hoặc chọn file công tơ...'}</span>
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

        {/* Thumbnail Preview */}
        {preview && (
          <div className="relative mt-2 inline-block">
            <img
              src={preview}
              alt="Ảnh công tơ"
              className="h-32 w-auto max-w-full rounded-lg object-cover border border-gray-200 shadow-sm"
            />
            <button
              type="button"
              onClick={xuLyXoaAnh}
              className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white w-6 h-6 flex items-center justify-center text-sm shadow hover:bg-red-600 transition-colors"
              title="Xóa ảnh này"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Nút lưu */}
      <button
        type="submit"
        disabled={!hopLe || dangLuu}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {dangLuu ? '⏳ Đang lưu chỉ số...' : `Lưu chỉ số ${nhanLoai}`}
      </button>
    </form>
  );
}
