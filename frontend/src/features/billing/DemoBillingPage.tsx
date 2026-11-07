// src/features/billing/DemoBillingPage.tsx
// Màn hình Demo & Kiểm thử toàn bộ tính năng TV4 (Hóa đơn & VietQR):
// 1. Nhập chỉ số điện nước kèm ảnh chụp công tơ
// 2. Công thức tính tiền điện & nước theo mặt bằng chung
// 3. Tạo mã VietQR QuickLink
// 4. Xác nhận chuyển khoản UNC (cả phía người thuê & chủ trọ)

import { useState } from 'react';
import { NhapChiSoCongTo, type NhapChiSoCongToData } from '../../components/forms/NhapChiSoCongTo';
import { XacNhanThanhToanUNC, type XacNhanThanhToanUNCData } from '../../components/forms/XacNhanThanhToanUNC';
import { DuyetThanhToanUNC } from '../../components/forms/DuyetThanhToanUNC';
import { VietQRCard } from './VietQRCard';
import { HoaDonChiTiet } from './HoaDonChiTiet';
import { tinhTienDienMatBang, formatCurrencyVND } from '../../utils';
import type { HoaDon, ChiTietHoaDon, KhuTro, PhongTro } from '../../types';

export function DemoBillingPage() {
  const [tabHienTai, setTabHienTai] = useState<'nhap_chi_so' | 'hoa_don_vietqr' | 'gui_unc' | 'duyet_unc' | 'cong_thuc'>('hoa_don_vietqr');
  const [vaiTroHienTai, setVaiTroHienTai] = useState<'nguoi_thue' | 'chu_tro'>('nguoi_thue');
  const [thongBao, setThongBao] = useState<string | null>(null);

  // Dữ liệu mẫu khu trọ
  const khuTroMau: KhuTro = {
    id: 'khu-1',
    ten: 'Nhà trọ Hướng Dương',
    diaChi: '123 Đường Số 5, P. Linh Trung, TP. Thủ Đức',
    soTang: 3,
    donGiaDien: 3500, // Đơn giá điện mặt bằng
    donGiaNuoc: 20000, // Đơn giá nước mặt bằng
    maBinNganHang: 'MB',
    soTaiKhoan: '132465798',
    tenTaiKhoan: 'LE TRUNG TIN',
    soNgayNhacTruoc: 3,
    soNgayLapNhacQuaHan: 2,
    taoLuc: '2026-01-01',
  };

  // Dữ liệu mẫu phòng
  const phongMau: PhongTro = {
    id: 'phong-101',
    khuTroId: 'khu-1',
    soPhong: 'P101',
    tang: 1,
    giaThueCoBan: 3500000,
    tienCoc: 3500000,
    trangThai: 'dang_thue',
    soNguoiToiDa: 2,
  };

  // 175 kWh * 3.500 đ = 612.500 đ
  const tienDienMau = (1425 - 1250) * 3500;
  const tienNuocMau = 8 * 20000; // 160.000 đ
  const tongTienMau = 3500000 + tienDienMau + tienNuocMau + 130000;

  // Dữ liệu mẫu hóa đơn
  const [hoaDonMau, setHoaDonMau] = useState<HoaDon>({
    id: 'hd-001',
    phongId: 'phong-101',
    hopDongId: 'hdong-001',
    thangNam: '11/2026',
    ky: '2026-11-01',
    tienPhong: 3500000,
    chiSoDienCu: 1250,
    chiSoDienMoi: 1425, // dùng 175 kWh
    tienDien: tienDienMau,
    chiSoNuocCu: 45,
    chiSoNuocMoi: 53, // dùng 8 m³
    tienNuoc: tienNuocMau,
    tienDichVu: 130000,
    phiKhac: 0,
    tongTien: tongTienMau,
    hanThanhToan: '2026-11-10',
    trangThaiThanhToan: 'chua_thanh_toan',
    noiDungChuyenKhoan: 'PHONGP101 T11',
    laBanNhap: false,
  });

  const chiTietMau: ChiTietHoaDon[] = [
    { id: 'ct-1', hoaDonId: 'hd-001', dienGiai: 'Tiền thuê phòng P101 (Tháng 11/2026)', soLuong: 1, donGia: 3500000, soTien: 3500000 },
    { id: 'ct-2', hoaDonId: 'hd-001', dienGiai: 'Tiền điện mặt bằng (175 kWh)', soLuong: 175, donGia: 3500, soTien: tienDienMau },
    { id: 'ct-3', hoaDonId: 'hd-001', dienGiai: 'Tiền nước sinh hoạt (8 m³)', soLuong: 8, donGia: 20000, soTien: tienNuocMau },
    { id: 'ct-4', hoaDonId: 'hd-001', dienGiai: 'Phí dịch vụ & internet', soLuong: 1, donGia: 130000, soTien: 130000 },
  ];

  // Trạng thái UNC mẫu
  const [anhBienLaiMau, setAnhBienLaiMau] = useState<string | undefined>(
    'https://placehold.co/600x800/png?text=Bien+Lai+Chuyen+Khoan+UNC'
  );

  function baoThanhCong(msg: string) {
    setThongBao(msg);
    setTimeout(() => setThongBao(null), 4000);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Banner tiêu đề */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                TV4 - Kiểm thử tính năng
              </span>
              <h1 className="text-2xl font-black text-gray-900 mt-2">
                Frontend: Hóa đơn & VietQR QuickLink
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Công thức tính tiền điện theo mặt bằng chung • Nhập chỉ số kèm ảnh công tơ • VietQR QuickLink • Xác nhận UNC
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 px-3 py-2 rounded-xl border border-green-200">
              <span>●</span>
              <span>Đã sẵn sàng kiểm thử</span>
            </div>
          </div>

          {/* Tab điều hướng */}
          <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={() => setTabHienTai('hoa_don_vietqr')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                tabHienTai === 'hoa_don_vietqr'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📄 Hóa đơn & VietQR
            </button>
            <button
              onClick={() => setTabHienTai('nhap_chi_so')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                tabHienTai === 'nhap_chi_so'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ⚡ Ghi chỉ số & Ảnh công tơ
            </button>
            <button
              onClick={() => setTabHienTai('gui_unc')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                tabHienTai === 'gui_unc'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🧾 Gửi biên lai UNC (Người thuê)
            </button>
            <button
              onClick={() => setTabHienTai('duyet_unc')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                tabHienTai === 'duyet_unc'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🛡️ Duyệt UNC (Chủ trọ)
            </button>
            <button
              onClick={() => setTabHienTai('cong_thuc')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                tabHienTai === 'cong_thuc'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🧮 Test Công thức mặt bằng
            </button>
          </div>
        </div>

        {/* Thông báo thao tác */}
        {thongBao && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm font-medium text-green-800 shadow-sm animate-fade-in">
            ✅ {thongBao}
          </div>
        )}

        {/* ── TAB 1: Hóa đơn & VietQR Card ── */}
        {tabHienTai === 'hoa_don_vietqr' && (
          <div className="space-y-6">
            {/* Bộ chọn vai trò để kiểm thử hiển thị VietQR */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-gray-800">Chọn vai trò đang xem:</span>
                <p className="text-xs text-gray-500">Mã VietQR chỉ hiển thị khi vai trò là "Người thuê" để thanh toán</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVaiTroHienTai('nguoi_thue')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    vaiTroHienTai === 'nguoi_thue'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  👤 Người thuê (Có VietQR)
                </button>
                <button
                  type="button"
                  onClick={() => setVaiTroHienTai('chu_tro')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    vaiTroHienTai === 'chu_tro'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🔑 Chủ trọ (Ẩn VietQR)
                </button>
              </div>
            </div>

            <HoaDonChiTiet
              hoaDon={hoaDonMau}
              chiTiet={chiTietMau}
              khuTro={khuTroMau}
              soPhong={phongMau.soPhong}
              vaiTro={vaiTroHienTai}
              onGuiBienLai={async (data) => {
                setHoaDonMau((prev) => ({ ...prev, trangThaiThanhToan: 'cho_xac_nhan' }));
                baoThanhCong(`Đã gửi xác nhận chuyển khoản UNC: ${formatCurrencyVND(data.soTien)} kèm file ${data.anhBienLai.name}`);
              }}
              onDuyetThanhToan={async (_id, duyet, lyDo) => {
                if (duyet) {
                  setHoaDonMau((prev) => ({ ...prev, trangThaiThanhToan: 'da_thanh_toan' }));
                  baoThanhCong('Chủ trọ đã DUYỆT thành công chuyển khoản UNC!');
                } else {
                  setHoaDonMau((prev) => ({ ...prev, trangThaiThanhToan: 'chua_thanh_toan' }));
                  baoThanhCong(`Đã TỪ CHỐI biên lai UNC. Lý do: "${lyDo}"`);
                }
              }}
            />
          </div>
        )}

        {/* ── TAB 2: Ghi chỉ số & Ảnh công tơ ── */}
        {tabHienTai === 'nhap_chi_so' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-3">1. Nhập chỉ số Điện (Đơn giá mặt bằng 3.500 đ)</h2>
              <NhapChiSoCongTo
                loai="dien"
                chiSoCu={1250}
                donGiaDien={3500}
                onSubmit={(data: NhapChiSoCongToData) => {
                  const kt = tinhTienDienMatBang(data.chiSoCu, data.chiSoMoi, 3500);
                  baoThanhCong(`Đã lưu chỉ số điện: ${data.chiSoMoi} kWh (tiêu thụ ${kt.soTieuThu} kWh × 3.500đ = ${formatCurrencyVND(kt.thanhTien)})${data.anhFile ? ` kèm ảnh ${data.anhFile.name}` : ''}`);
                }}
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-3">2. Nhập chỉ số Nước (Đơn giá mặt bằng 20.000 đ)</h2>
              <NhapChiSoCongTo
                loai="nuoc"
                chiSoCu={45}
                donGiaNuoc={20000}
                onSubmit={(data: NhapChiSoCongToData) => {
                  const soM3 = data.chiSoMoi - data.chiSoCu;
                  baoThanhCong(`Đã lưu chỉ số nước: ${data.chiSoMoi} m³ (tiêu thụ ${soM3} m³ × 20.000đ = ${formatCurrencyVND(soM3 * 20000)})${data.anhFile ? ` kèm ảnh ${data.anhFile.name}` : ''}`);
                }}
              />
            </div>
          </div>
        )}

        {/* ── TAB 3: Gửi biên lai UNC (Người thuê) ── */}
        {tabHienTai === 'gui_unc' && (
          <div className="max-w-lg mx-auto">
            <XacNhanThanhToanUNC
              hoaDonId={hoaDonMau.id}
              tongTien={hoaDonMau.tongTien}
              thangNam={hoaDonMau.thangNam}
              soPhong={phongMau.soPhong}
              onSubmit={async (data: XacNhanThanhToanUNCData) => {
                if (data.anhBienLai) {
                  setAnhBienLaiMau(URL.createObjectURL(data.anhBienLai));
                }
                setHoaDonMau((prev) => ({ ...prev, trangThaiThanhToan: 'cho_xac_nhan' }));
                baoThanhCong(`Gửi biên lai UNC thành công! Số tiền: ${formatCurrencyVND(data.soTien)}, Mã FT: ${data.maGiaoDich || 'Không có'}`);
                setTabHienTai('duyet_unc');
              }}
            />
          </div>
        )}

        {/* ── TAB 4: Duyệt UNC (Chủ trọ) ── */}
        {tabHienTai === 'duyet_unc' && (
          <div className="max-w-lg mx-auto">
            <DuyetThanhToanUNC
              hoaDonId={hoaDonMau.id}
              thanhToanId="tt-001"
              soPhong={phongMau.soPhong}
              thangNam={hoaDonMau.thangNam}
              tongTienHoaDon={hoaDonMau.tongTien}
              soTienDaChuyen={hoaDonMau.tongTien}
              anhBienLaiUrl={anhBienLaiMau}
              maGiaoDich="FT26110588992"
              thoiGianGui={new Date().toISOString()}
              onXacNhan={async (duyet, lyDo) => {
                if (duyet) {
                  setHoaDonMau((prev) => ({ ...prev, trangThaiThanhToan: 'da_thanh_toan' }));
                  baoThanhCong('Chủ trọ đã DUYỆT thành công chuyển khoản UNC!');
                } else {
                  setHoaDonMau((prev) => ({ ...prev, trangThaiThanhToan: 'chua_thanh_toan' }));
                  baoThanhCong(`Đã TỪ CHỐI biên lai UNC. Lý do: "${lyDo}"`);
                }
              }}
            />
          </div>
        )}

        {/* ── TAB 5: Bảng test công thức mặt bằng ── */}
        {tabHienTai === 'cong_thuc' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Kiểm thử công thức tính tiền điện theo mặt bằng</h2>
              <p className="text-xs text-gray-500">Công thức chuẩn: Thành tiền = Số điện tiêu thụ (kWh) × Đơn giá điện mặt bằng (đ/kWh)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[50, 100, 175].map((kwh) => {
                const kt = tinhTienDienMatBang(0, kwh, 3500);
                return (
                  <div key={kwh} className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2">
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Mức {kwh} kWh (3.500 đ/kWh)</p>
                    <p className="text-xl font-black text-blue-900">{formatCurrencyVND(kt.thanhTien)}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {kwh} kWh × 3.500 đ = {formatCurrencyVND(kt.thanhTien)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-2">VietQR QuickLink URL trực tiếp:</h3>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <VietQRCard
                  tongTien={hoaDonMau.tongTien}
                  soPhong={phongMau.soPhong}
                  thangNam={hoaDonMau.thangNam}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
