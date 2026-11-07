// src/utils/billing.ts
// Tiện ích nghiệp vụ Hóa đơn & VietQR
// Dùng cho src/features/billing/ và src/components/forms/

// =====================================================================
// 1. Công thức tính tiền điện theo mặt bằng chung (đơn giá phẳng khu trọ)
// =====================================================================

/** Đơn giá điện mặt bằng chung của khu trọ (đồng/kWh) */
export const DON_GIA_DIEN_MAT_BANG_MAC_DINH = 3_500;

export interface KetQuaTinhDien {
  soTieuThu: number;
  donGia: number;
  thanhTien: number;
}

/**
 * Tính tiền điện theo công thức mặt bằng chung (đơn giá phẳng khu trọ).
 * Công thức: Số tiêu thụ (kWh) × Đơn giá điện (đồng/kWh)
 * @param chiSoCu   Chỉ số công tơ kỳ trước (kWh)
 * @param chiSoMoi  Chỉ số công tơ kỳ này (kWh, >= chiSoCu)
 * @param donGia    Đơn giá điện mặt bằng (mặc định 3.500 đ/kWh)
 */
export function tinhTienDienMatBang(
  chiSoCu: number,
  chiSoMoi: number,
  donGia: number = DON_GIA_DIEN_MAT_BANG_MAC_DINH
): KetQuaTinhDien {
  const soCu = Number.isFinite(chiSoCu) ? Math.max(0, chiSoCu) : 0;
  const soMoi = Number.isFinite(chiSoMoi) ? Math.max(0, chiSoMoi) : 0;
  const soTieuThu = Math.max(0, soMoi - soCu);
  const thanhTien = Math.round(soTieuThu * donGia);

  return { soTieuThu, donGia, thanhTien };
}

/** Alias chuẩn cho tính tiền điện mặt bằng */
export const tinhTienDien = tinhTienDienMatBang;

// =====================================================================
// 2. Biểu giá điện bậc thang EVN (khi cần tham chiếu hoặc đối soát)
// =====================================================================

export interface BacThangDien {
  denKwh: number;   // Giới hạn trên của bậc (kWh tính từ 0); Infinity = không giới hạn
  donGia: number;   // Đơn giá tương ứng của bậc (đồng/kWh)
  moTa?: string;    // Nhãn mô tả (vd: "Bậc 1 (0 - 50 kWh)")
}

/**
 * Biểu giá điện sinh hoạt bậc thang EVN (6 bậc, áp dụng theo Quyết định 2699/QĐ-BCT)
 */
export const BIEU_GIA_DIEN_BAC_THANG: BacThangDien[] = [
  { denKwh: 50,       donGia: 1_893, moTa: 'Bậc 1: Cho kWh từ 0 - 50' },
  { denKwh: 100,      donGia: 1_956, moTa: 'Bậc 2: Cho kWh từ 51 - 100' },
  { denKwh: 200,      donGia: 2_271, moTa: 'Bậc 3: Cho kWh từ 101 - 200' },
  { denKwh: 300,      donGia: 2_860, moTa: 'Bậc 4: Cho kWh từ 201 - 300' },
  { denKwh: 400,      donGia: 3_197, moTa: 'Bậc 5: Cho kWh từ 301 - 400' },
  { denKwh: Infinity, donGia: 3_302, moTa: 'Bậc 6: Cho kWh từ 401 trở lên' },
];

export interface ChiTietBacThang {
  bac: number;
  kwh: number;
  donGia: number;
  thanhTien: number;
  moTa?: string;
}

export interface KetQuaTinhDienBacThang {
  soTieuThu: number;
  thanhTien: number;        // Tổng thành tiền sau thuế (hoặc bằng tienChuaThue nếu vatRatio = 0)
  tienChuaThue: number;     // Tổng tiền điện bậc thang trước thuế
  tienThueVat: number;      // Tiền thuế VAT (nếu có)
  tongTien: number;         // Tổng cộng phải trả
  chiTietBac: ChiTietBacThang[];
}

/**
 * Tính tiền điện bậc thang theo biểu giá luỹ tiến EVN.
 * @param chiSoCu   Chỉ số công tơ kỳ trước (kWh)
 * @param chiSoMoi  Chỉ số công tơ kỳ này (kWh, >= chiSoCu)
 * @param bieuGia   Biểu giá bậc thang tuỳ chọn (mặc định BIEU_GIA_DIEN_BAC_THANG)
 * @param vatRatio  Tỷ lệ thuế VAT (ví dụ: 0.08 = 8%, mặc định 0)
 */
export function tinhTienDienBacThang(
  chiSoCu: number,
  chiSoMoi: number,
  bieuGia: BacThangDien[] = BIEU_GIA_DIEN_BAC_THANG,
  vatRatio: number = 0
): KetQuaTinhDienBacThang {
  const soCu = Number.isFinite(chiSoCu) ? Math.max(0, chiSoCu) : 0;
  const soMoi = Number.isFinite(chiSoMoi) ? Math.max(0, chiSoMoi) : 0;
  const soTieuThu = Math.max(0, soMoi - soCu);

  let con = soTieuThu;
  let tienChuaThue = 0;
  let daQua = 0; // kWh đã được phân bổ vào các bậc trước

  const chiTietBac: ChiTietBacThang[] = bieuGia.map((bac, idx) => {
    if (con <= 0) {
      return {
        bac: idx + 1,
        kwh: 0,
        donGia: bac.donGia,
        thanhTien: 0,
        moTa: bac.moTa,
      };
    }

    const dungTichBac = bac.denKwh === Infinity ? Infinity : Math.max(0, bac.denKwh - daQua);
    const kwh = bac.denKwh === Infinity ? con : Math.min(con, dungTichBac);
    const tien = kwh * bac.donGia;

    con -= kwh;
    daQua = bac.denKwh === Infinity ? daQua : bac.denKwh;
    tienChuaThue += tien;

    return {
      bac: idx + 1,
      kwh,
      donGia: bac.donGia,
      thanhTien: tien,
      moTa: bac.moTa,
    };
  });

  const tienThueVat = vatRatio > 0 ? Math.round(tienChuaThue * vatRatio) : 0;
  const tongTien = Math.round(tienChuaThue + tienThueVat);

  return {
    soTieuThu,
    thanhTien: tongTien,
    tienChuaThue: Math.round(tienChuaThue),
    tienThueVat,
    tongTien,
    chiTietBac,
  };
}

// =====================================================================
// 3. Tính tiền nước (theo đơn giá mặt bằng của khu trọ)
// =====================================================================

export const DON_GIA_NUOC_MAT_BANG_MAC_DINH = 20_000; // đồng/m³

export interface KetQuaTinhNuoc {
  soTieuThu: number;
  thanhTien: number;
}

/**
 * Tính tiền nước theo đơn giá mặt bằng phẳng của khu trọ.
 * Công thức: Số tiêu thụ (m³) × Đơn giá nước (đồng/m³)
 */
export function tinhTienNuoc(
  chiSoCu: number,
  chiSoMoi: number,
  donGia: number = DON_GIA_NUOC_MAT_BANG_MAC_DINH
): KetQuaTinhNuoc {
  const soTieuThu = Math.max(0, chiSoMoi - chiSoCu);
  return { soTieuThu, thanhTien: Math.round(soTieuThu * donGia) };
}

// =====================================================================
// 4. Tạo VietQR QuickLink (chuẩn img.vietqr.io)
// =====================================================================

export interface ThamSoVietQR {
  maBin: string;          // Mã ngân hàng hoặc BIN (vd: 'MB', '970422', 'VCB')
  soTaiKhoan: string;     // Số tài khoản nhận tiền
  soTien: number;         // Số tiền (đồng)
  noiDung: string;        // Nội dung chuyển khoản (vd: "PHONGP101 T10")
  tenTaiKhoan?: string;   // Tên chủ tài khoản (hiển thị trên ảnh VietQR)
  template?: 'compact' | 'compact2' | 'qr_only' | 'print'; // mặc định compact2
  dinhDang?: 'svg' | 'png'; // mặc định png/svg theo chuẩn VietQR QuickLink
}

/**
 * Tạo URL ảnh VietQR QuickLink để hiển thị hoặc quét chuyển khoản.
 * Chuẩn: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.<EXT>?amount=<AMOUNT>&addInfo=<MEMO>&accountName=<NAME>
 */
export function taoUrlVietQR({
  maBin,
  soTaiKhoan,
  soTien,
  noiDung,
  tenTaiKhoan,
  template = 'compact2',
  dinhDang = 'png',
}: ThamSoVietQR): string {
  const bankBin = (maBin || 'MB').trim();
  const accNo = (soTaiKhoan || '').trim();
  const params = new URLSearchParams();

  if (soTien > 0) {
    params.set('amount', String(Math.round(soTien)));
  }
  if (noiDung) {
    params.set('addInfo', noiDung.trim());
  }
  if (tenTaiKhoan) {
    params.set('accountName', tenTaiKhoan.trim());
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  return `https://img.vietqr.io/image/${bankBin}-${accNo}-${template}.${dinhDang}${query}`;
}

/**
 * Sinh nội dung chuyển khoản chuẩn từ số phòng và tháng/năm.
 * Khớp với quy tắc lưu trong cơ sở dữ liệu (PHONG<SoPhong> T<Thang>).
 * @example taoNoiDungChuyenKhoan('P101', '10/2024') => "PHONGP101 T10"
 * @example taoNoiDungChuyenKhoan('101', '05/2024')  => "PHONG101 T5"
 */
export function taoNoiDungChuyenKhoan(soPhong: string, thangNam: string): string {
  let phongClean = (soPhong || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (phongClean.startsWith('PHONG')) {
    phongClean = phongClean.replace(/^PHONG/, '');
  }

  let rawThang = thangNam;
  if (thangNam.includes('/')) {
    rawThang = thangNam.split('/')[0];
  } else if (thangNam.includes('-')) {
    rawThang = thangNam.split('-')[1] || thangNam;
  }
  const thangSo = parseInt(rawThang, 10);
  const thangStr = Number.isFinite(thangSo) ? String(thangSo) : rawThang;

  return `PHONG${phongClean} T${thangStr}`;
}

// =====================================================================
// 5. Kiểm tra & xác nhận UNC (Ủy Nhiệm Chi)
// =====================================================================

export type TrangThaiUNC = 'cho_duyet' | 'da_duyet' | 'tu_choi';

export interface KetQuaXacNhanUNC {
  hopLe: boolean;
  loiVi?: string;
}

/**
 * Kiểm tra file biên lai chuyển khoản UNC có hợp lệ để tải lên không.
 * Điều kiện: file phải là ảnh (JPG, PNG, WEBP, HEIC...), dung lượng <= 5MB.
 */
export function xacNhanFileUNC(file: File): KetQuaXacNhanUNC {
  if (!file) {
    return { hopLe: false, loiVi: 'Vui lòng chọn file biên lai' };
  }

  const isImageMime = file.type.startsWith('image/');
  const isImageExt = /\.(jpe?g|png|webp|heic|bmp|gif)$/i.test(file.name);

  if (!isImageMime && !isImageExt) {
    return { hopLe: false, loiVi: 'Chỉ chấp nhận file ảnh (JPG, PNG, WEBP...)' };
  }

  const MAX_SIZE_MB = 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { hopLe: false, loiVi: `Ảnh biên lai vượt quá dung lượng ${MAX_SIZE_MB}MB` };
  }

  return { hopLe: true };
}

/**
 * Nhãn hiển thị cho trạng thái UNC / thanh toán.
 */
export const NHAN_TRANG_THAI_UNC: Record<TrangThaiUNC, string> = {
  cho_duyet: 'Chờ xác nhận',
  da_duyet:  'Đã xác nhận',
  tu_choi:   'Từ chối',
};

/**
 * Màu badge cho trạng thái UNC (dùng với Tailwind CSS).
 */
export const MAU_TRANG_THAI_UNC: Record<TrangThaiUNC, string> = {
  cho_duyet: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  da_duyet:  'bg-green-100 text-green-800 border-green-200',
  tu_choi:   'bg-red-100 text-red-800 border-red-200',
};
