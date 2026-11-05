// src/features/billing/NhapChiSoPage.tsx
// Màn hình nhập chỉ số công tơ điện + nước cho một phòng (kỳ tính tiền).
// Dành cho chủ trọ / quản lý. Sau khi nhập xong, có thể gọi tao_hoa_don() (RPC).

import { useState } from 'react';
import type { PhongTro, KhuTro, LoaiCongTo } from '../../types';
import { NhapChiSoCongTo, type NhapChiSoCongToData } from '../../components/forms/NhapChiSoCongTo';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface NhapChiSoPageProps {
  phong: PhongTro;
  khuTro: KhuTro;
  ky: string;           // YYYY-MM-01
  chiSoCuDien?: number; // lấy từ kỳ trước; 0 nếu chưa có
  chiSoCuNuoc?: number;
  /** Callback thực tế lưu chỉ số lên Supabase */
  onLuuChiSo: (data: {
    phongId: string;
    loai: LoaiCongTo;
    ky: string;
    chiSoCu: number;
    chiSoMoi: number;
    anhFile?: File;
  }) => Promise<void>;
  /** Sau khi lưu cả hai loại, có thể gọi để sinh hóa đơn */
  onTaoHoaDon?: (phongId: string, ky: string) => Promise<void>;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function NhapChiSoPage({
  phong,
  khuTro,
  ky,
  chiSoCuDien = 0,
  chiSoCuNuoc = 0,
  onLuuChiSo,
  onTaoHoaDon,
}: NhapChiSoPageProps) {
  const [dangLuuDien, setDangLuuDien] = useState(false);
  const [dangLuuNuoc, setDangLuuNuoc] = useState(false);
  const [daLuuDien, setDaLuuDien] = useState(false);
  const [daLuuNuoc, setDaLuuNuoc] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangTaoHD, setDangTaoHD] = useState(false);
  const [taoHDThanhCong, setTaoHDThanhCong] = useState(false);

  const kyHienThi = new Date(ky).toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  });

  async function xuLyLuuChiSo(data: NhapChiSoCongToData) {
    setLoi(null);
    const setter = data.loai === 'dien' ? setDangLuuDien : setDangLuuNuoc;
    const doneSet = data.loai === 'dien' ? setDaLuuDien : setDaLuuNuoc;
    setter(true);
    try {
      await onLuuChiSo({
        phongId: phong.id,
        loai: data.loai,
        ky,
        chiSoCu: data.chiSoCu,
        chiSoMoi: data.chiSoMoi,
        anhFile: data.anhFile,
      });
      doneSet(true);
    } catch (err: unknown) {
      setLoi(err instanceof Error ? err.message : 'Lỗi khi lưu chỉ số');
    } finally {
      setter(false);
    }
  }

  async function xuLyTaoHoaDon() {
    if (!onTaoHoaDon) return;
    setDangTaoHD(true);
    setLoi(null);
    try {
      await onTaoHoaDon(phong.id, ky);
      setTaoHDThanhCong(true);
    } catch (err: unknown) {
      setLoi(err instanceof Error ? err.message : 'Lỗi khi tạo hóa đơn');
    } finally {
      setDangTaoHD(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 py-4">
      {/* Tiêu đề */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">Nhập chỉ số công tơ</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Phòng {phong.soPhong} · {kyHienThi}
        </p>
      </div>

      {/* Lỗi chung */}
      {loi && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {loi}
        </div>
      )}

      {/* Form điện */}
      {daLuuDien ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
          ✅ Đã lưu chỉ số <strong>điện</strong>
        </div>
      ) : (
        <NhapChiSoCongTo
          loai="dien"
          chiSoCu={chiSoCuDien}
          dangLuu={dangLuuDien}
          onSubmit={xuLyLuuChiSo}
        />
      )}

      {/* Form nước */}
      {daLuuNuoc ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
          ✅ Đã lưu chỉ số <strong>nước</strong>
        </div>
      ) : (
        <NhapChiSoCongTo
          loai="nuoc"
          chiSoCu={chiSoCuNuoc}
          donGiaNuoc={khuTro.donGiaNuoc}
          dangLuu={dangLuuNuoc}
          onSubmit={xuLyLuuChiSo}
        />
      )}

      {/* Nút tạo hóa đơn (khi đã lưu đủ cả hai) */}
      {daLuuDien && daLuuNuoc && onTaoHoaDon && !taoHDThanhCong && (
        <button
          type="button"
          onClick={xuLyTaoHoaDon}
          disabled={dangTaoHD}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {dangTaoHD ? '⏳ Đang tạo hóa đơn...' : '📄 Tạo hóa đơn nháp'}
        </button>
      )}

      {taoHDThanhCong && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-800 text-center font-medium">
          🎉 Hóa đơn nháp đã được tạo! Vào mục Hóa đơn để phát hành.
        </div>
      )}
    </div>
  );
}

