// src/features/billing/HoaDonChiTiet.tsx
// Trang chi tiết hóa đơn tháng:
//   - Bảng các khoản thu (tiền phòng, điện mặt bằng, nước, dịch vụ)
//   - Card VietQR QuickLink để quét thanh toán nhanh
//   - Form người thuê gửi xác nhận chuyển khoản UNC kèm ảnh biên lai
//   - Khung chủ trọ / quản lý duyệt hoặc từ chối chuyển khoản UNC
//   - Trạng thái thanh toán và lịch sử giao dịch

import { useState } from 'react';
import type { HoaDon, ChiTietHoaDon, KhuTro, ThanhToan } from '../../types';
import { formatCurrencyVND } from '../../utils';
import {
  NHAN_TRANG_THAI_UNC,
  MAU_TRANG_THAI_UNC,
  type TrangThaiUNC,
} from '../../utils/billing';
import { VietQRCard } from './VietQRCard';
import { XacNhanThanhToanUNC, type XacNhanThanhToanUNCData } from '../../components/forms/XacNhanThanhToanUNC';
import { DuyetThanhToanUNC } from '../../components/forms/DuyetThanhToanUNC';

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
  /** Giao dịch thanh toán (UNC) đang chờ duyệt hoặc gần nhất */
  thanhToanHienTai?: ThanhToan | null;
  /** Lịch sử các lần thanh toán của hóa đơn */
  danhSachThanhToan?: ThanhToan[];
  /** Callback khi người thuê gửi biên lai UNC */
  onGuiBienLai?: (data: XacNhanThanhToanUNCData) => Promise<void>;
  /** Callback khi chủ trọ/quản lý duyệt hoặc từ chối UNC */
  onDuyetThanhToan?: (thanhToanId: string, duyet: boolean, lyDoTuChoi?: string) => Promise<void>;
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
  thanhToanHienTai,
  danhSachThanhToan = [],
  onGuiBienLai,
  onDuyetThanhToan,
}: HoaDonChiTietProps) {
  const [dangGui, setDangGui] = useState(false);
  const [daGui, setDaGui] = useState(false);
  const [dangDuyet, setDangDuyet] = useState(false);
  const [thongBaoDuyet, setThongBaoDuyet] = useState<string | null>(null);

  const laNguoiThue = vaiTro === 'nguoi_thue';
  const laQuanLyChuTro = vaiTro === 'chu_tro' || vaiTro === 'quan_ly' || vaiTro === 'quan_tri';

  const coTheGuiUNC =
    laNguoiThue &&
    !daGui &&
    hoaDon.trangThaiThanhToan !== 'da_thanh_toan' &&
    hoaDon.trangThaiThanhToan !== 'cho_xac_nhan';

  // Map trạng thái hóa đơn → badge UNC
  const trangThaiUNC = toTrangThaiUNC(hoaDon.trangThaiThanhToan);

  // Tính tiền điện theo công thức mặt bằng
  const donGiaDien = khuTro.donGiaDien || 3500;
  const soKwhDien = Math.max(0, hoaDon.chiSoDienMoi - hoaDon.chiSoDienCu);
  const tienDienMatBang = Math.round(soKwhDien * donGiaDien);

  async function xuLyGuiBienLai(data: XacNhanThanhToanUNCData) {
    if (!onGuiBienLai) return;
    setDangGui(true);
    try {
      await onGuiBienLai(data);
      setDaGui(true);
    } finally {
      setDangGui(false);
    }
  }

  async function xuLyDuyetUNC(duyet: boolean, lyDoTuChoi?: string) {
    const paymentId = thanhToanHienTai?.id || danhSachThanhToan.find((t) => t.trangThai === 'cho_duyet')?.id;
    if (!paymentId || !onDuyetThanhToan) return;

    setDangDuyet(true);
    try {
      await onDuyetThanhToan(paymentId, duyet, lyDoTuChoi);
      setThongBaoDuyet(duyet ? 'Đã xác nhận thanh toán UNC thành công!' : 'Đã từ chối biên lai UNC.');
    } finally {
      setDangDuyet(false);
    }
  }

  // Tìm thanh toán đang chờ duyệt
  const thanhToanChoDuyet =
    thanhToanHienTai?.trangThai === 'cho_duyet'
      ? thanhToanHienTai
      : danhSachThanhToan.find((t) => t.trangThai === 'cho_duyet');

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* ── Tiêu đề ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Hóa đơn tháng {hoaDon.thangNam}
          </h2>
          <p className="text-sm text-gray-500">Phòng {soPhong}</p>
        </div>
        {/* Badge trạng thái */}
        <BadgeTrangThai trangThai={hoaDon.trangThaiThanhToan} />
      </div>

      {/* ── Bảng chi tiết hóa đơn ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600 font-semibold">Khoản mục</th>
              <th className="px-4 py-3 text-right text-gray-600 font-semibold">Số lượng</th>
              <th className="px-4 py-3 text-right text-gray-600 font-semibold">Đơn giá</th>
              <th className="px-4 py-3 text-right text-gray-600 font-semibold">Thành tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {chiTiet.map((dong) => (
              <tr key={dong.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-800 font-medium">{dong.dienGiai}</td>
                <td className="px-4 py-3 text-right text-gray-600 font-mono">{dong.soLuong}</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {formatCurrencyVND(dong.donGia)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900 font-mono">
                  {formatCurrencyVND(dong.soTien)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-blue-50/80 border-t border-blue-100">
            <tr>
              <td colSpan={3} className="px-4 py-3.5 font-bold text-gray-800">
                Tổng cộng thanh toán
              </td>
              <td className="px-4 py-3.5 text-right font-black text-blue-700 text-lg font-mono">
                {formatCurrencyVND(hoaDon.tongTien)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Chi tiết tiền điện theo đơn giá mặt bằng ── */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm flex items-center justify-between text-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⚡</span>
          <div>
            <p className="font-semibold text-gray-800">Tiền điện theo đơn giá mặt bằng</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              {soKwhDien} kWh × {donGiaDien.toLocaleString('vi-VN')} đ/kWh
            </p>
          </div>
        </div>
        <span className="font-bold text-blue-700 font-mono text-base">
          {formatCurrencyVND(hoaDon.tienDien || tienDienMatBang)}
        </span>
      </div>

      {/* ── VietQR QuickLink (Chỉ hiển thị cho Người thuê để quét mã thanh toán) ── */}
      {laNguoiThue && hoaDon.trangThaiThanhToan !== 'da_thanh_toan' && (
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

      {/* ── Badge trạng thái UNC (chờ duyệt/đã duyệt/từ chối) ── */}
      {trangThaiUNC && (
        <div
          className={`rounded-xl px-5 py-3 text-sm font-medium border flex items-center justify-between ${MAU_TRANG_THAI_UNC[trangThaiUNC]}`}
        >
          <span>Trạng thái chuyển khoản UNC:</span>
          <span className="font-bold">{NHAN_TRANG_THAI_UNC[trangThaiUNC]}</span>
        </div>
      )}

      {/* ── Dành cho Quản lý / Chủ trọ: Xác nhận (duyệt/từ chối) chuyển khoản UNC ── */}
      {laQuanLyChuTro && thanhToanChoDuyet && onDuyetThanhToan && !thongBaoDuyet && (
        <DuyetThanhToanUNC
          hoaDonId={hoaDon.id}
          thanhToanId={thanhToanChoDuyet.id}
          soPhong={soPhong}
          thangNam={hoaDon.thangNam}
          tongTienHoaDon={hoaDon.tongTien}
          soTienDaChuyen={thanhToanChoDuyet.soTien}
          anhBienLaiUrl={thanhToanChoDuyet.duongDanBienLai}
          thoiGianGui={hoaDon.thanhToanLuc}
          dangXuLy={dangDuyet}
          onXacNhan={xuLyDuyetUNC}
        />
      )}

      {thongBaoDuyet && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800 font-medium text-center">
          🎉 {thongBaoDuyet}
        </div>
      )}

      {/* ── Dành cho Người thuê: Form gửi biên lai UNC ── */}
      {coTheGuiUNC && onGuiBienLai && (
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
          ✅ Đã gửi biên lai xác nhận chuyển khoản UNC – chờ chủ trọ duyệt đối soát.
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
  chua_thanh_toan:    { label: 'Chưa thanh toán',    cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  cho_xac_nhan:       { label: 'Chờ xác nhận UNC',   cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  thanh_toan_mot_phan:{ label: 'Thanh toán 1 phần',  cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  da_thanh_toan:      { label: 'Đã thanh toán',      cls: 'bg-green-100 text-green-800 border-green-200' },
  qua_han:            { label: 'Quá hạn thanh toán', cls: 'bg-red-100 text-red-700 border-red-200' },
};

function BadgeTrangThai({ trangThai }: { trangThai: TrangThaiHoaDon }) {
  const { label, cls } = BADGE_MAP[trangThai] ?? BADGE_MAP.chua_thanh_toan;
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}
