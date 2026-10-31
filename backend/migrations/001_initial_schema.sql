-- Migration: 001_initial_schema.sql
-- CSDL Quản lý Nhà Trọ

-- 1. Bảng Khu nhà (Properties)
CREATE TABLE IF NOT EXISTS khu_tro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ten VARCHAR(255) NOT NULL,
    dia_chi TEXT NOT NULL,
    so_tang INT DEFAULT 1,
    don_gia_dien DECIMAL(10, 2) NOT NULL DEFAULT 3500.00,
    don_gia_nuoc DECIMAL(10, 2) NOT NULL DEFAULT 20000.00,
    phi_internet DECIMAL(10, 2) DEFAULT 100000.00,
    tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cap_nhat_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng Phòng trọ (Rooms)
CREATE TABLE IF NOT EXISTS phong_tro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    khu_tro_id UUID REFERENCES khu_tro(id) ON DELETE CASCADE,
    so_phong VARCHAR(50) NOT NULL,
    tang INT DEFAULT 1,
    gia_thue_co_ban DECIMAL(12, 2) NOT NULL,
    tien_coc DECIMAL(12, 2) DEFAULT 0,
    trang_thai VARCHAR(20) DEFAULT 'trong' CHECK (trang_thai IN ('trong', 'dang_thue', 'bao_tri')),
    dien_tich_m2 DECIMAL(6, 2),
    tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cap_nhat_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bảng Người dùng & Khách thuê (Users)
CREATE TABLE IF NOT EXISTS nguoi_dung (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    so_dien_thoai VARCHAR(20) UNIQUE NOT NULL,
    ho_ten VARCHAR(100) NOT NULL,
    cccd VARCHAR(20),
    vai_tro VARCHAR(20) DEFAULT 'nguoi_thue' CHECK (vai_tro IN ('quan_tri', 'chu_tro', 'nguoi_thue', 'quan_ly')),
    tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bảng Hợp đồng (Contracts)
CREATE TABLE IF NOT EXISTS hop_dong (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phong_id UUID REFERENCES phong_tro(id) ON DELETE RESTRICT,
    nguoi_thue_id UUID REFERENCES nguoi_dung(id) ON DELETE RESTRICT,
    ngay_bat_dau DATE NOT NULL,
    ngay_ket_thuc DATE,
    gia_thue DECIMAL(12, 2) NOT NULL,
    tien_coc DECIMAL(12, 2) NOT NULL,
    ngay_thanh_toan INT DEFAULT 5,
    trang_thai VARCHAR(20) DEFAULT 'hieu_luc' CHECK (trang_thai IN ('hieu_luc', 'het_han', 'cham_dut')),
    tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Bảng Hóa đơn & Tiền phòng (Bills)
CREATE TABLE IF NOT EXISTS hoa_don (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phong_id UUID REFERENCES phong_tro(id) ON DELETE RESTRICT,
    hop_dong_id UUID REFERENCES hop_dong(id) ON DELETE RESTRICT,
    thang_nam VARCHAR(7) NOT NULL, -- MM/YYYY
    tien_phong DECIMAL(12, 2) NOT NULL,
    chi_so_dien_cu INT NOT NULL,
    chi_so_dien_moi INT NOT NULL,
    tien_dien DECIMAL(12, 2) NOT NULL,
    chi_so_nuoc_cu INT NOT NULL,
    chi_so_nuoc_moi INT NOT NULL,
    tien_nuoc DECIMAL(12, 2) NOT NULL,
    phi_khac DECIMAL(12, 2) DEFAULT 0,
    tong_tien DECIMAL(12, 2) NOT NULL,
    han_thanh_toan DATE NOT NULL,
    trang_thai_thanh_toan VARCHAR(20) DEFAULT 'chua_thanh_toan' CHECK (trang_thai_thanh_toan IN ('chua_thanh_toan', 'da_thanh_toan', 'thanh_toan_mot_phan', 'qua_han')),
    vietqr_url TEXT,
    thanh_toan_luc TIMESTAMP WITH TIME ZONE,
    tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Bảng Báo cáo Sự cố (Issues)
CREATE TABLE IF NOT EXISTS su_co (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phong_id UUID REFERENCES phong_tro(id) ON DELETE CASCADE,
    nguoi_thue_id UUID REFERENCES nguoi_dung(id) ON DELETE SET NULL,
    tieu_de VARCHAR(200) NOT NULL,
    mo_ta TEXT,
    anh_urls TEXT[],
    chi_phi_sua_chua DECIMAL(12, 2) DEFAULT 0,
    trang_thai VARCHAR(20) DEFAULT 'cho_tiep_nhan' CHECK (trang_thai IN ('cho_tiep_nhan', 'dang_xu_ly', 'hoan_tat', 'da_huy')),
    tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    hoan_tat_luc TIMESTAMP WITH TIME ZONE
);
