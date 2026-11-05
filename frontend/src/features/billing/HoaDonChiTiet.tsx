// src/features/billing/HoaDonChiTiet.tsx
// Trang chi tiết hóa đơn tháng:
//   - Bảng các khoản thu (tiền phòng, điện bậc thang, nước, dịch vụ)
//   - Card VietQR để thanh toán nhanh
//   - Form gửi biên lai UNC (người thuê)
//   - Trạng thái thanh toán + badge

import { useState } from 'react';
import type { HoaDon, ChiTietHoaDon, KhuTro } from '../../types';
import { formatCurrencyVND } from '../../utils';
import {
  NHAN_TRANG_THAI_UNC,
  MAU_TRANG_THAI_UNC,
  tinhTienDienBacThang,
  type TrangThaiUNC,
} from '../../utils/billing';
import { VietQRCard } from './VietQRCard';
import { XacNhanThanhToanUNC } from '../../components/forms/XacNhanThanhToanUNC';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface HoaDonChiTietProps {
  hoaDon: HoaDon;
  chiTiet: ChiTietHoaDon[];
  khuTro: KhuTro;
  soPhong: string;
  /** Vai trò của người dùng hiện tại */
  vaiTro: 'chu_tro' | 'quan_ly' | 'nguoi_thue' | 'quan_tri';
  /** Callback khi người thuê gửi biên lai */
  onGuiBienLai?: (data: { hoaDonId: string; soTien: number; anhBienLai: File }) => Promise<void>;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Map trạng thái hóa đơn → badge UNC. 'cho_xac_nhan' = biên lai đang chờ duyệt. */
function toTrangThaiUNC(tt: string): TrangThaiUNC | null {
  if (tt === 'cho_xac_nhan') return 'cho_duyet';
  if (tt === 'da_duyet' || tt === 'tu_choi') return tt as TrangThaiUNC;
  return null;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function HoaDonChiTiet({
  hoaDon,
  chiTiet,
  khuTro,
  soPhong,
  vaiTro,
  onGuiBienLai,
}: HoaDonChiTietProps) {
  const [dangGui, setDangGui] = useState(false);
  const [daGui, setDaGui] = useState(false);

  const laNguoiThue = vaiTro === 'nguoi_thue';
  const coTheGui =
    laNguoiThue &&
    !daGui &&
    hoaDon.trangThaiThanhToan !== 'da_thanh_toan' &&
    hoaDon.trangThaiThanhToan !== 'cho_xac_nhan';

  // Map trạng thái hóa đơn → badge UNC
  const trangThaiUNC = toTrangThaiUNC(hoaDon.trangThaiThanhToan);

  // Chi tiết bậc thang điện (tính lại ở FE để hiển thị)
  const bacThangDien = tinhTienDienBacThang(hoaDon.chiSoDienCu, hoaDon.chiSoDienMoi);

  async function xuLyGuiBienLai(data: {
    hoaDonId: string;
    soTien: number;
    anhBienLai: File;
  }) {
    if (!onGuiBienLai) return;
    setDangGui(true);
    try {
      await onGuiBienLai(data);
      setDaGui(true);
    } finally {
      setDangGui(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* ── Tiêu đề ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Hóa đơn tháng {hoaDon.thangNam}
          </h2>
          <p className="text-sm text-gray-500">Phòng {soPhong}</p>
        </div>
        {/* Badge trạng thái */}
        <BadgeTrangThai trangThai={hoaDon.trangThaiThanhToan} />
      </div>

      {/* ── Bảng chi tiết ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">Khoản mục</th>
              <th className="px-4 py-3 text-right text-gray-600 font-medium">Số lượng</th>
              <th className="px-4 py-3 text-right text-gray-600 font-medium">Đơn giá</th>
              <th className="px-4 py-3 text-right text-gray-600 font-medium">Thành tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {chiTiet.map((dong) => (
              <tr key={dong.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800">{dong.dienGiai}</td>
                <td className="px-4 py-3 text-right text-gray-600">{dong.soLuong}</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {formatCurrencyVND(dong.donGia)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatCurrencyVND(dong.soTien)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-blue-50">
            <tr>
              <td colSpan={3} className="px-4 py-3 font-bold text-gray-700">
                Tổng cộng
              </td>
              <td className="px-4 py-3 text-right font-bold text-blue-700 text-base">
                {formatCurrencyVND(hoaDon.tongTien)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Chi tiết bậc thang điện ── */}
      <details className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
          📊 Chi tiết tính tiền điện bậc thang ({bacThangDien.soTieuThu} kWh)
        </summary>
        <div className="px-5 pb-4">
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left pb-1">Bậc</th>
                <th className="text-right pb-1">kWh</th>
                <th className="text-right pb-1">Đơn giá</th>
                <th className="text-right pb-1">Tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bacThangDien.chiTietBac
                .filter((b) => b.kwh > 0)
                .map((b) => (
                  <tr key={b.bac}>
                    <td className="py-1 text-gray-700">Bậc {b.bac}</td>
                    <td className="py-1 text-right text-gray-700">{b.kwh}</td>
                    <td className="py-1 text-right text-gray-600">
                      {b.donGia.toLocaleString('vi-VN')} ₫
                    </td>
                    <td className="py-1 text-right font-medium text-gray-800">
                      {formatCurrencyVND(b.thanhTien)}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={3} className="pt-2 font-semibold text-gray-700 text-xs">Tổng tiền điện</td>
                <td className="pt-2 text-right font-bold text-blue-700 text-xs">
                  {formatCurrencyVND(bacThangDien.thanhTien)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>

      {/* ── VietQR (người thuê & chủ trọ) ── */}
      {hoaDon.trangThaiThanhToan !== 'da_thanh_toan' && (
        <VietQRCard
          maBin={khuTro.maBinNganHang || 'MB'}
          tenNganHang="MBBank"
          soTaiKhoan={khuTro.soTaiKhoan || '132465798'}
          tenTaiKhoan={khuTro.tenTaiKhoan || 'LE TRUNG TIN'}
          tongTien={hoaDon.tongTien}
          soPhong={soPhong}
          thangNam={hoaDon.thangNam}
          noiDungCK={hoaDon.noiDungChuyenKhoan}
        />
      )}

      {/* ── Badge trạng thái UNC (nếu đang chờ xác nhận) ── */}
      {trangThaiUNC && (
        <div
          className={`rounded-xl px-5 py-3 text-sm font-medium ${MAU_TRANG_THAI_UNC[trangThaiUNC]}`}
        >
          Trạng thái biên lai: {NHAN_TRANG_THAI_UNC[trangThaiUNC]}
        </div>
      )}

      {/* ── Form gửi biên lai UNC ── */}
      {coTheGui && onGuiBienLai && (
        <XacNhanThanhToanUNC
          hoaDonId={hoaDon.id}
          tongTien={hoaDon.tongTien}
          thangNam={hoaDon.thangNam}
          soPhong={soPhong}
          dangGui={dangGui}
          onSubmit={xuLyGuiBienLai}
        />
      )}

      {daGui && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 text-sm text-green-800 font-medium text-center">
          ✅ Đã gửi biên lai – chờ chủ trọ xác nhận.
        </div>
      )}

      {/* ── Thông tin hạn thanh toán ── */}
      <div className="text-xs text-gray-400 text-center">
        Hạn thanh toán:{' '}
        <span className="font-medium text-gray-600">
          {new Date(hoaDon.hanThanhToan).toLocaleDateString('vi-VN')}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Badge trạng thái hóa đơn
// ─────────────────────────────────────────────

type TrangThaiHoaDon = HoaDon['trangThaiThanhToan'];

const BADGE_MAP: Record<TrangThaiHoaDon, { label: string; cls: string }> = {
  chua_thanh_toan:    { label: 'Chưa thanh toán', cls: 'bg-gray-100 text-gray-700' },
  cho_xac_nhan:       { label: 'Chờ xác nhận',    cls: 'bg-yellow-100 text-yellow-800' },
  thanh_toan_mot_phan:{ label: 'Thanh toán 1 phần',cls: 'bg-orange-100 text-orange-800' },
  da_thanh_toan:      { label: 'Đã thanh toán',   cls: 'bg-green-100 text-green-800' },
  qua_han:            { label: 'Quá hạn',          cls: 'bg-red-100 text-red-700' },
};

function BadgeTrangThai({ trangThai }: { trangThai: TrangThaiHoaDon }) {
  const { label, cls } = BADGE_MAP[trangThai] ?? BADGE_MAP.chua_thanh_toan;
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>
  );
}

