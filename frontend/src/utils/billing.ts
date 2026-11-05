// Tiện ích nghiệp vụ Hóa đơn & VietQR
// Dùng cho src/features/billing/ và src/components/forms/

// =====================================================================
// 1. Công thức tính tiền điện bậc thang (theo biểu giá EVN 2024)
// =====================================================================

export interface BacThangDien {
  denKwh: number;   // giới hạn trên (kWh); Infinity = không giới hạn
  donGia: number;   // đồng/kWh
}

/** Biểu giá điện bậc thang EVN (6 bậc, áp dụng từ 11/2023) */
export const BIEU_GIA_DIEN_BAC_THANG: BacThangDien[] = [
  { denKwh: 50,       donGia: 1_893 },
  { denKwh: 100,      donGia: 1_956 },
  { denKwh: 200,      donGia: 2_271 },
  { denKwh: 300,      donGia: 2_860 },
  { denKwh: 400,      donGia: 3_197 },
  { denKwh: Infinity, donGia: 3_302 },
];

export interface KetQuaTinhDienBacThang {
  soTieuThu: number;
  thanhTien: number;
  chiTietBac: { bac: number; kwh: number; donGia: number; thanhTien: number }[];
}

/**
 * Tính tiền điện bậc thang theo biểu giá EVN.
 * @param chiSoCu  Chỉ số công tơ kỳ trước
 * @param chiSoMoi Chỉ số công tơ kỳ này (>= chiSoCu)
 * @param bieuGia  Biểu giá bậc thang (mặc định BIEU_GIA_DIEN_BAC_THANG)
 */
export function tinhTienDienBacThang(
  chiSoCu: number,
  chiSoMoi: number,
  bieuGia: BacThangDien[] = BIEU_GIA_DIEN_BAC_THANG
): KetQuaTinhDienBacThang {
  const soTieuThu = Math.max(0, chiSoMoi - chiSoCu);
  let con = soTieuThu;
  let thanhTien = 0;
  let daQua = 0; // kWh đã qua các bậc trước

  const chiTietBac = bieuGia.map((bac, idx) => {
    if (con <= 0) return { bac: idx + 1, kwh: 0, donGia: bac.donGia, thanhTien: 0 };
    const gioi = bac.denKwh === Infinity ? Infinity : bac.denKwh - daQua;
    const kwh = bac.denKwh === Infinity ? con : Math.min(con, gioi);
    const tien = kwh * bac.donGia;
    con -= kwh;
    daQua = bac.denKwh === Infinity ? daQua : bac.denKwh;
    thanhTien += tien;
    return { bac: idx + 1, kwh, donGia: bac.donGia, thanhTien: tien };
  });

  return { soTieuThu, thanhTien: Math.round(thanhTien), chiTietBac };
}

// =====================================================================
// 2. Tính tiền nước (đơn giá phẳng của khu trọ)
// =====================================================================

export interface KetQuaTinhNuoc {
  soTieuThu: number;
  thanhTien: number;
}

/**
 * Tính tiền nước theo đơn giá phẳng của khu trọ.
 */
export function tinhTienNuoc(
  chiSoCu: number,
  chiSoMoi: number,
  donGia: number
): KetQuaTinhNuoc {
  const soTieuThu = Math.max(0, chiSoMoi - chiSoCu);
  return { soTieuThu, thanhTien: soTieuThu * donGia };
}

// =====================================================================
// 3. Tạo VietQR QuickLink (chuẩn img.vietqr.io)
// =====================================================================

export interface ThamSoVietQR {
  maBin: string;       // Mã ngân hàng hoặc BIN (vd: 'MB', '970422', '970436' = Vietcombank)
  soTaiKhoan: string;  // Số tài khoản nhận tiền
  soTien: number;      // Số tiền (đồng)
  noiDung: string;     // Nội dung chuyển khoản (vd: "PHONG101 T10")
  template?: 'compact' | 'compact2' | 'qr_only' | 'print'; // mặc định compact
  dinhDang?: 'svg' | 'png'; // mặc định svg theo chuẩn VietQR QuickLink mới
}

/**
 * Tạo URL ảnh VietQR QuickLink để nhúng vào trang hóa đơn.
 * Hỗ trợ định dạng .svg (hoặc .png) và template (mặc định compact).
 * @example
 *   taoUrlVietQR({ maBin: 'MB', soTaiKhoan: '132465798', soTien: 3500000, noiDung: 'PHONGP101 T10' })
 *   => "https://img.vietqr.io/image/MB-132465798-compact.svg?amount=3500000&addInfo=PHONGP101%20T10"
 */
export function taoUrlVietQR({
  maBin,
  soTaiKhoan,
  soTien,
  noiDung,
  template = 'compact',
  dinhDang = 'svg',
}: ThamSoVietQR): string {
  const encodedInfo = encodeURIComponent(noiDung);
  return `https://img.vietqr.io/image/${maBin}-${soTaiKhoan}-${template}.${dinhDang}?amount=${soTien}&addInfo=${encodedInfo}`;
}

/**
 * Sinh nội dung chuyển khoản chuẩn từ số phòng và tháng/năm.
 * @example noiDungChuyenKhoan('P101', '10/2024') => "PHONGP101 T10"
 */
export function taoNoiDungChuyenKhoan(soPhong: string, thangNam: string): string {
  const soPhongChuan = soPhong.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const thang = thangNam.split('/')[0];
  return `PHONG${soPhongChuan} T${thang}`;
}

// =====================================================================
// 4. Kiểm tra & xác nhận UNC (Ủy Nhiệm Chi)
// =====================================================================

export type TrangThaiUNC = 'cho_duyet' | 'da_duyet' | 'tu_choi';

export interface KetQuaXacNhanUNC {
  hopLe: boolean;
  loiVi?: string;
}

/**
 * Kiểm tra ảnh biên lai UNC có hợp lệ để submit không.
 * Điều kiện: file phải là ảnh (image/*), kích thước <= 5MB.
 */
export function xacNhanFileUNC(file: File): KetQuaXacNhanUNC {
  if (!file.type.startsWith('image/')) {
    return { hopLe: false, loiVi: 'Chỉ chấp nhận file ảnh (JPG, PNG, WEBP...)' };
  }
  const MAX_SIZE_MB = 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { hopLe: false, loiVi: `Ảnh vượt quá ${MAX_SIZE_MB}MB` };
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
  cho_duyet: 'bg-yellow-100 text-yellow-800',
  da_duyet:  'bg-green-100 text-green-800',
  tu_choi:   'bg-red-100 text-red-800',
};

