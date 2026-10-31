// TypeScript Interfaces cho hệ thống Quản Lý Nhà Trọ
//
// Quy ước: tên trường = tên cột trong CSDL (snake_case tiếng Việt) chuyển sang camelCase.
//   vd cột `so_dien_thoai` -> `soDienThoai`, bảng `phong_tro` -> `PhongTro`.
// Từ điển đầy đủ: docs/co-so-du-lieu.md. Khi đổi schema phải cập nhật file này.

export type VaiTro = 'quan_tri' | 'chu_tro' | 'quan_ly' | 'nguoi_thue';

export interface NguoiDung {
  id: string;
  soDienThoai: string;
  hoTen: string;
  cccd?: string;
  vaiTro: VaiTro;
  anhDaiDien?: string;
  dangHoatDong: boolean;
  taoLuc: string;
}

export interface KhuTro {
  id: string;
  ten: string;
  diaChi: string;
  soTang: number;
  donGiaDien: number; // đồng/kWh
  donGiaNuoc: number; // đồng/m³
  phiInternet?: number;
  chuTroId?: string;
  maBinNganHang?: string; // mã BIN ngân hàng để sinh VietQR
  soTaiKhoan?: string;
  tenTaiKhoan?: string;
  soNgayNhacTruoc: number;
  soNgayLapNhacQuaHan: number;
  taoLuc: string;
}

export type TrangThaiPhong = 'trong' | 'dang_thue' | 'bao_tri';

/** Màu hiển thị trên danh sách phòng (cột trang_thai_hien_thi của view tong_quan_phong) */
export type TrangThaiHienThiPhong = 'trong' | 'dang_thue' | 'no_tien' | 'co_su_co' | 'bao_tri';

export interface PhongTro {
  id: string;
  khuTroId: string;
  soPhong: string;
  tang: number;
  giaThueCoBan: number;
  tienCoc: number;
  trangThai: TrangThaiPhong;
  dienTichM2?: number;
  soNguoiToiDa: number;
  ghiChu?: string;
}

/** Một dòng của view tong_quan_phong */
export interface TongQuanPhong extends PhongTro {
  hopDongId?: string;
  nguoiThueHienTaiId?: string;
  tenNguoiThue?: string;
  sdtNguoiThue?: string;
  coNoQuaHan: boolean;
  soSuCoDangMo: number;
  trangThaiHienThi: TrangThaiHienThiPhong;
}

export type TrangThaiHopDong = 'hieu_luc' | 'het_han' | 'cham_dut';

export interface HopDong {
  id: string;
  phongId: string;
  nguoiThueId: string;
  ngayBatDau: string;
  ngayKetThuc?: string;
  giaThue: number;
  tienCoc: number;
  ngayThanhToan: number; // 1-28
  soNguoiO: number;
  trangThai: TrangThaiHopDong;
  ghiChu?: string;
}

export type LoaiCongTo = 'dien' | 'nuoc';

export interface ChiSoCongTo {
  id: string;
  phongId: string;
  loai: LoaiCongTo;
  ky: string; // ngày 1 của tháng tính tiền (YYYY-MM-01)
  chiSoCu: number;
  chiSoMoi: number;
  soTieuThu: number; // tự tính ở CSDL
  duongDanAnh?: string; // bucket anh-cong-to, dạng <phong_id>/<tên-file>
  batThuong: boolean;
  lyDoBatThuong?: string;
}

export type TrangThaiThanhToanHoaDon =
  | 'chua_thanh_toan'
  | 'cho_xac_nhan' // người thuê đã gửi biên lai, chờ chủ trọ duyệt
  | 'thanh_toan_mot_phan'
  | 'da_thanh_toan'
  | 'qua_han';

export interface HoaDon {
  id: string;
  phongId: string;
  hopDongId: string;
  thangNam: string; // MM/YYYY
  ky: string; // YYYY-MM-01
  tienPhong: number;
  chiSoDienCu: number;
  chiSoDienMoi: number;
  tienDien: number;
  chiSoNuocCu: number;
  chiSoNuocMoi: number;
  tienNuoc: number;
  tienDichVu: number;
  phiKhac: number;
  tongTien: number;
  hanThanhToan: string;
  trangThaiThanhToan: TrangThaiThanhToanHoaDon;
  noiDungChuyenKhoan?: string; // vd PHONGP101 T10
  vietqrUrl?: string;
  laBanNhap: boolean;
  thanhToanLuc?: string;
}

export interface ChiTietHoaDon {
  id: string;
  hoaDonId: string;
  dienGiai: string;
  soLuong: number;
  donGia: number;
  soTien: number;
}

export type TrangThaiThanhToan = 'cho_duyet' | 'da_duyet' | 'tu_choi';

export interface ThanhToan {
  id: string;
  hoaDonId: string;
  soTien: number;
  duongDanBienLai?: string; // bucket bien-lai
  trangThai: TrangThaiThanhToan;
  nguoiGuiId?: string;
  lyDoTuChoi?: string;
}

export type TrangThaiSuCo =
  | 'cho_tiep_nhan'
  | 'dang_xu_ly'
  | 'chua_the_xu_ly'
  | 'hoan_tat' // hiển thị: Đã xử lý
  | 'da_huy';
export type PhanLoaiSuCo = 'dien' | 'nuoc' | 'may_lanh' | 'noi_that' | 'mang' | 'khac';

export interface SuCo {
  id: string;
  phongId: string;
  nguoiThueId?: string;
  tieuDe: string;
  moTa: string;
  anhUrls: string[]; // bucket anh-su-co
  chiPhiSuaChua: number;
  ghiChuXuLy?: string | null; // bắt buộc khi trangThai = chua_the_xu_ly
  trangThai: TrangThaiSuCo;
  phanLoai: PhanLoaiSuCo;
  taoLuc: string;
  hoanTatLuc?: string;
}

export interface LichSuSuCo {
  id: string;
  suCoId: string;
  tuTrangThai: TrangThaiSuCo | null;
  denTrangThai: TrangThaiSuCo;
  ghiChu: string | null;
  chiPhiSuaChua: number | null; // bản ghi cũ trước migration 006 có thể chưa có
  nguoiThucHienId: string | null;
  taoLuc: string;
}

export type LoaiThongBao =
  | 'hoa_don_sap_den_han'
  | 'hoa_don_den_han'
  | 'hoa_don_qua_han'
  | 'thanh_toan'
  | 'su_co'
  | 'thong_bao_chung';

export interface ThongBao {
  id: string;
  nguoiNhanId: string;
  loai: LoaiThongBao;
  tieuDe: string;
  noiDung: string;
  duongDan?: string;
  duLieu: Record<string, unknown>;
  docLuc?: string; // trống = chưa đọc
  taoLuc: string;
}

/** Kết quả RPC tong_quan_dashboard(p_khu_tro_id, p_ky) */
export interface TongQuanDashboard {
  thang_nam: string;
  tong_so_phong: number;
  phong_dang_thue: number;
  phong_trong: number;
  phong_bao_tri: number;
  ty_le_phong_trong: number;
  tong_phat_hanh: number;
  tong_da_thu: number;
  tong_con_no: number;
  so_hoa_don_qua_han: number;
  so_hoa_don_cho_xac_nhan: number;
  so_su_co_dang_mo: number;
}
