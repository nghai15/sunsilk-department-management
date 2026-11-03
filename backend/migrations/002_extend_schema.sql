-- Migration: 002_extend_schema.sql
-- Mở rộng schema 001 (giữ nguyên tên bảng/cột đã chốt với frontend/src/types):
--   liên kết Supabase Auth, phí dịch vụ, chỉ số công tơ,
--   thanh toán (UNC), thông báo, Web Push, nhật ký nhắc nợ.

-- =====================================================================
-- 0. Tiện ích chung
-- =====================================================================
CREATE OR REPLACE FUNCTION cap_nhat_thoi_gian_sua() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.cap_nhat_luc = NOW();
  RETURN NEW;
END $$;

-- =====================================================================
-- 1. nguoi_dung  <->  auth.users (đăng nhập bằng số điện thoại/mật khẩu)
-- =====================================================================
ALTER TABLE nguoi_dung ALTER COLUMN id DROP DEFAULT;
ALTER TABLE nguoi_dung
  ADD CONSTRAINT nguoi_dung_id_khoa_ngoai FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE nguoi_dung ADD COLUMN IF NOT EXISTS anh_dai_dien TEXT;
ALTER TABLE nguoi_dung ADD COLUMN IF NOT EXISTS dang_hoat_dong BOOLEAN NOT NULL DEFAULT TRUE;

-- Tự tạo hồ sơ khi có tài khoản Auth mới. Role KHÔNG lấy từ metadata do client gửi
-- (tránh tự phong quyền): luôn là 'nguoi_thue'; chủ trọ do admin nâng quyền bằng service vai_tro.
CREATE OR REPLACE FUNCTION xu_ly_tai_khoan_moi() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.nguoi_dung (id, so_dien_thoai, ho_ten, vai_tro)
  VALUES (
    NEW.id,
    -- Supabase lưu SĐT dạng E.164 không dấu '+': 84901234567 -> 0901234567
    regexp_replace(COALESCE(NULLIF(NEW.phone, ''), NEW.raw_user_meta_data ->> 'so_dien_thoai', NEW.id::text), '^\+?84', '0'),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'ho_ten', ''), 'Người dùng mới'),
    'nguoi_thue'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_nguoi_dung_tao ON auth.users;
CREATE TRIGGER on_auth_nguoi_dung_tao
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION xu_ly_tai_khoan_moi();

-- =====================================================================
-- 2. khu_tro: chủ sở hữu, tài khoản nhận tiền (VietQR), cấu hình nhắc nợ
-- =====================================================================
ALTER TABLE khu_tro
  ADD COLUMN IF NOT EXISTS chu_tro_id UUID REFERENCES nguoi_dung(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ma_bin_ngan_hang VARCHAR(10),            -- mã BIN ngân hàng (VD 970436 = Vietcombank)
  ADD COLUMN IF NOT EXISTS so_tai_khoan VARCHAR(30),
  ADD COLUMN IF NOT EXISTS ten_tai_khoan VARCHAR(100),
  ADD COLUMN IF NOT EXISTS so_ngay_nhac_truoc INT NOT NULL DEFAULT 3 CHECK (so_ngay_nhac_truoc BETWEEN 0 AND 15),
  ADD COLUMN IF NOT EXISTS so_ngay_lap_nhac_qua_han INT NOT NULL DEFAULT 3 CHECK (so_ngay_lap_nhac_qua_han BETWEEN 1 AND 30);

CREATE TRIGGER trg_khu_tro_cap_nhat BEFORE UPDATE ON khu_tro
  FOR EACH ROW EXECUTE FUNCTION cap_nhat_thoi_gian_sua();

-- Nhân sự quản lý (vai_tro 'quan_ly') được gán vào từng khu
CREATE TABLE IF NOT EXISTS nhan_su_khu_tro (
  khu_tro_id UUID NOT NULL REFERENCES khu_tro(id) ON DELETE CASCADE,
  nguoi_dung_id     UUID NOT NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE,
  PRIMARY KEY (khu_tro_id, nguoi_dung_id)
);

-- =====================================================================
-- 3. phong_tro / hop_dong
-- =====================================================================
ALTER TABLE phong_tro
  ALTER COLUMN khu_tro_id SET NOT NULL,
  ADD COLUMN IF NOT EXISTS so_nguoi_toi_da INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS ghi_chu TEXT,
  ADD CONSTRAINT phong_tro_khu_tro_so_phong_khoa UNIQUE (khu_tro_id, so_phong);
CREATE TRIGGER trg_phong_tro_cap_nhat BEFORE UPDATE ON phong_tro
  FOR EACH ROW EXECUTE FUNCTION cap_nhat_thoi_gian_sua();
CREATE INDEX IF NOT EXISTS idx_phong_tro_khu_tro_trang_thai ON phong_tro(khu_tro_id, trang_thai);

ALTER TABLE hop_dong
  ALTER COLUMN phong_id SET NOT NULL,
  ALTER COLUMN nguoi_thue_id SET NOT NULL,
  ADD COLUMN IF NOT EXISTS so_nguoi_o INT NOT NULL DEFAULT 1 CHECK (so_nguoi_o > 0),
  ADD COLUMN IF NOT EXISTS ghi_chu TEXT,
  ADD CONSTRAINT hop_dong_ngay_kiem_tra CHECK (ngay_ket_thuc IS NULL OR ngay_ket_thuc >= ngay_bat_dau),
  ADD CONSTRAINT hop_dong_thanh_toan_ngay_kiem_tra CHECK (ngay_thanh_toan BETWEEN 1 AND 28);
-- Mỗi phòng chỉ có tối đa 1 hợp đồng đang hiệu lực
CREATE UNIQUE INDEX IF NOT EXISTS uq_hop_dong_mot_hieu_luc_moi_phong
  ON hop_dong(phong_id) WHERE trang_thai = 'hieu_luc';
CREATE INDEX IF NOT EXISTS idx_hop_dong_nguoi_thue ON hop_dong(nguoi_thue_id) WHERE trang_thai = 'hieu_luc';

-- Đồng bộ trạng thái phòng theo hợp đồng
CREATE OR REPLACE FUNCTION dong_bo_trang_thai_phong() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.trang_thai = 'hieu_luc' THEN
    UPDATE phong_tro SET trang_thai = 'dang_thue' WHERE id = NEW.phong_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.trang_thai = 'hieu_luc' THEN
    UPDATE phong_tro SET trang_thai = 'trong'
     WHERE id = NEW.phong_id AND trang_thai = 'dang_thue';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_hop_dong_phong_trang_thai
  AFTER INSERT OR UPDATE OF trang_thai ON hop_dong
  FOR EACH ROW EXECUTE FUNCTION dong_bo_trang_thai_phong();

-- =====================================================================
-- 4. Phí dịch vụ cố định
-- =====================================================================
-- Tiền điện/nước tính theo đơn giá phẳng khu_tro.don_gia_dien / don_gia_nuoc (đ/kWh, đ/m³).

CREATE TABLE IF NOT EXISTS phi_dich_vu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  khu_tro_id UUID NOT NULL REFERENCES khu_tro(id) ON DELETE CASCADE,
  ten VARCHAR(100) NOT NULL,                       -- Rác, Wifi, Gửi xe...
  so_tien DECIMAL(12, 2) NOT NULL CHECK (so_tien >= 0),
  cach_tinh VARCHAR(12) NOT NULL DEFAULT 'theo_phong'
    CHECK (cach_tinh IN ('theo_phong', 'theo_nguoi', 'theo_don_vi')),
  dang_hoat_dong BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (khu_tro_id, ten)
);

-- Dịch vụ áp dụng cho từng hợp đồng (so_luong: số xe, số thiết bị...)
CREATE TABLE IF NOT EXISTS dich_vu_hop_dong (
  hop_dong_id UUID NOT NULL REFERENCES hop_dong(id) ON DELETE CASCADE,
  phi_dich_vu_id UUID NOT NULL REFERENCES phi_dich_vu(id) ON DELETE CASCADE,
  so_luong INT NOT NULL DEFAULT 1 CHECK (so_luong > 0),
  PRIMARY KEY (hop_dong_id, phi_dich_vu_id)
);

-- =====================================================================
-- 5. Chỉ số công tơ (kèm ảnh bằng chứng)
-- =====================================================================
CREATE TABLE IF NOT EXISTS chi_so_cong_to (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phong_id UUID NOT NULL REFERENCES phong_tro(id) ON DELETE CASCADE,
  loai VARCHAR(12) NOT NULL CHECK (loai IN ('dien', 'nuoc')),
  ky DATE NOT NULL CHECK (ky = date_trunc('month', ky)::date),   -- ngày 1 của tháng tính tiền
  chi_so_cu INT NOT NULL CHECK (chi_so_cu >= 0),
  chi_so_moi INT NOT NULL,
  so_tieu_thu INT GENERATED ALWAYS AS (chi_so_moi - chi_so_cu) STORED,
  duong_dan_anh TEXT,                                  -- đường dẫn trong bucket 'anh-cong-to'
  bat_thuong BOOLEAN NOT NULL DEFAULT FALSE,
  ly_do_bat_thuong TEXT,
  nguoi_ghi_id UUID REFERENCES nguoi_dung(id) ON DELETE SET NULL,
  tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chi_so_tang_dan_kiem_tra CHECK (chi_so_moi >= chi_so_cu),
  UNIQUE (phong_id, loai, ky)
);

-- Tự điền chỉ số cũ từ kỳ trước và gắn cờ bất thường (> 2x trung bình 3 kỳ gần nhất, hoặc = 0 khi trước đó có dùng)
CREATE OR REPLACE FUNCTION chi_so_truoc_khi_ghi() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_last INT;
  v_avg NUMERIC;
BEGIN
  IF NEW.chi_so_cu IS NULL OR NEW.chi_so_cu = 0 THEN
    SELECT chi_so_moi INTO v_last FROM chi_so_cong_to
     WHERE phong_id = NEW.phong_id AND loai = NEW.loai AND ky < NEW.ky
     ORDER BY ky DESC LIMIT 1;
    IF v_last IS NOT NULL THEN NEW.chi_so_cu := v_last; END IF;
  END IF;

  SELECT AVG(so_tieu_thu) INTO v_avg FROM (
    SELECT so_tieu_thu FROM chi_so_cong_to
     WHERE phong_id = NEW.phong_id AND loai = NEW.loai AND ky < NEW.ky
     ORDER BY ky DESC LIMIT 3) t;

  NEW.bat_thuong := FALSE; NEW.ly_do_bat_thuong := NULL;
  IF v_avg IS NOT NULL AND v_avg > 0 THEN
    IF (NEW.chi_so_moi - NEW.chi_so_cu) > 2 * v_avg THEN
      NEW.bat_thuong := TRUE;
      NEW.ly_do_bat_thuong := 'Tiêu thụ cao hơn 2 lần mức trung bình 3 kỳ gần nhất';
    ELSIF (NEW.chi_so_moi - NEW.chi_so_cu) = 0 THEN
      NEW.bat_thuong := TRUE;
      NEW.ly_do_bat_thuong := 'Không phát sinh tiêu thụ trong khi các kỳ trước có dùng';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cong_to_chi_so_ghi BEFORE INSERT OR UPDATE ON chi_so_cong_to
  FOR EACH ROW EXECUTE FUNCTION chi_so_truoc_khi_ghi();

-- =====================================================================
-- 6. hoa_don: bổ sung kỳ, nội dung chuyển khoản, trạng thái chờ duyệt UNC
-- =====================================================================
ALTER TABLE hoa_don
  ALTER COLUMN phong_id SET NOT NULL,
  ALTER COLUMN hop_dong_id SET NOT NULL,
  ADD COLUMN IF NOT EXISTS ky DATE,
  ADD COLUMN IF NOT EXISTS noi_dung_chuyen_khoan VARCHAR(60),   -- VD: PHONG101 T10 (FE dùng để sinh VietQR)
  ADD COLUMN IF NOT EXISTS tien_dich_vu DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS la_ban_nhap BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cap_nhat_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE hoa_don DROP CONSTRAINT IF EXISTS hoa_don_trang_thai_thanh_toan_check;  -- tên do Postgres tự sinh từ cột ở migration 001
ALTER TABLE hoa_don ADD CONSTRAINT hoa_don_trang_thai_thanh_toan_check
  CHECK (trang_thai_thanh_toan IN ('chua_thanh_toan', 'cho_xac_nhan', 'da_thanh_toan', 'thanh_toan_mot_phan', 'qua_han'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_hoa_don_hop_dong_thang ON hoa_don(hop_dong_id, thang_nam);
CREATE INDEX IF NOT EXISTS idx_hoa_don_phong ON hoa_don(phong_id);
CREATE INDEX IF NOT EXISTS idx_hoa_don_han_mo ON hoa_don(han_thanh_toan)
  WHERE trang_thai_thanh_toan IN ('chua_thanh_toan', 'qua_han', 'cho_xac_nhan');
CREATE TRIGGER trg_hoa_don_cap_nhat BEFORE UPDATE ON hoa_don
  FOR EACH ROW EXECUTE FUNCTION cap_nhat_thoi_gian_sua();

CREATE TABLE IF NOT EXISTS chi_tiet_hoa_don (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hoa_don_id UUID NOT NULL REFERENCES hoa_don(id) ON DELETE CASCADE,
  dien_giai VARCHAR(150) NOT NULL,
  so_luong DECIMAL(10, 2) NOT NULL DEFAULT 1,
  don_gia DECIMAL(12, 2) NOT NULL DEFAULT 0,
  so_tien DECIMAL(12, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chi_tiet_hoa_don_hoa_don ON chi_tiet_hoa_don(hoa_don_id);

-- =====================================================================
-- 7. thanh_toan: người thuê tải UNC, chủ trọ duyệt
-- =====================================================================
CREATE TABLE IF NOT EXISTS thanh_toan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hoa_don_id UUID NOT NULL REFERENCES hoa_don(id) ON DELETE CASCADE,
  so_tien DECIMAL(12, 2) NOT NULL CHECK (so_tien > 0),
  duong_dan_bien_lai TEXT,                                  -- ảnh biên lai trong bucket 'bien-lai'
  trang_thai VARCHAR(10) NOT NULL DEFAULT 'cho_duyet' CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'tu_choi')),
  nguoi_gui_id UUID REFERENCES nguoi_dung(id) ON DELETE SET NULL,
  nguoi_duyet_id UUID REFERENCES nguoi_dung(id) ON DELETE SET NULL,
  duyet_luc TIMESTAMP WITH TIME ZONE,
  ly_do_tu_choi TEXT,
  tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_thanh_toan_hoa_don ON thanh_toan(hoa_don_id);

-- =====================================================================
-- 8. su_co: phân loại + lịch sử trạng thái
-- =====================================================================
ALTER TABLE su_co
  ALTER COLUMN phong_id SET NOT NULL,
  ADD COLUMN IF NOT EXISTS phan_loai VARCHAR(12) NOT NULL DEFAULT 'khac'
    CHECK (phan_loai IN ('dien', 'nuoc', 'may_lanh', 'noi_that', 'mang', 'khac')),
  ADD COLUMN IF NOT EXISTS cap_nhat_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE su_co ALTER COLUMN anh_urls SET DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_su_co_phong_trang_thai ON su_co(phong_id, trang_thai);
CREATE TRIGGER trg_su_co_cap_nhat BEFORE UPDATE ON su_co
  FOR EACH ROW EXECUTE FUNCTION cap_nhat_thoi_gian_sua();

CREATE TABLE IF NOT EXISTS lich_su_su_co (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  su_co_id UUID NOT NULL REFERENCES su_co(id) ON DELETE CASCADE,
  tu_trang_thai VARCHAR(20),
  den_trang_thai VARCHAR(20) NOT NULL,
  ghi_chu TEXT,
  nguoi_thuc_hien_id UUID REFERENCES nguoi_dung(id) ON DELETE SET NULL,
  tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================================
-- 9. Thông báo trong app + Web Push + nhật ký nhắc nợ
-- =====================================================================
CREATE TABLE IF NOT EXISTS thong_bao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nguoi_nhan_id UUID NOT NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE,
  loai VARCHAR(20) NOT NULL
    CHECK (loai IN ('hoa_don_sap_den_han', 'hoa_don_den_han', 'hoa_don_qua_han', 'thanh_toan', 'su_co', 'thong_bao_chung')),
  tieu_de VARCHAR(200) NOT NULL,
  noi_dung TEXT NOT NULL,
  duong_dan TEXT,                                         -- route trong PWA khi bấm vào thông báo
  du_lieu JSONB NOT NULL DEFAULT '{}',
  doc_luc TIMESTAMP WITH TIME ZONE,
  da_gui_push_luc TIMESTAMP WITH TIME ZONE,            -- đã đẩy Web Push (chống gửi trùng)
  tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_thong_bao_nguoi_nhan ON thong_bao(nguoi_nhan_id, tao_luc DESC);
CREATE INDEX IF NOT EXISTS idx_thong_bao_chua_doc ON thong_bao(nguoi_nhan_id) WHERE doc_luc IS NULL;

CREATE TABLE IF NOT EXISTS thong_bao_chung (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  khu_tro_id UUID NOT NULL REFERENCES khu_tro(id) ON DELETE CASCADE,
  nguoi_tao_id UUID REFERENCES nguoi_dung(id) ON DELETE SET NULL,
  tieu_de VARCHAR(200) NOT NULL,
  noi_dung TEXT NOT NULL,
  pham_vi VARCHAR(10) NOT NULL DEFAULT 'tat_ca' CHECK (pham_vi IN ('tat_ca', 'tang', 'phong')),
  cac_tang INT[] NOT NULL DEFAULT '{}',
  cac_phong_id UUID[] NOT NULL DEFAULT '{}',
  so_nguoi_nhan INT NOT NULL DEFAULT 0,
  tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dang_ky_push (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nguoi_dung_id UUID NOT NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  khoa_auth TEXT NOT NULL,
  trinh_duyet TEXT,
  tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dang_ky_push_nguoi_dung ON dang_ky_push(nguoi_dung_id);

-- Mỗi hóa đơn chỉ nhắc 1 lần/loại/ngày
CREATE TABLE IF NOT EXISTS nhat_ky_nhac_no (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hoa_don_id UUID NOT NULL REFERENCES hoa_don(id) ON DELETE CASCADE,
  loai VARCHAR(10) NOT NULL CHECK (loai IN ('sap_den_han', 'den_han', 'qua_han')),
  ngay_gui DATE NOT NULL,
  tao_luc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (hoa_don_id, loai, ngay_gui)
);
