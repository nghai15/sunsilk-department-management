-- Seed data: dữ liệu mẫu phục vụ phát triển & test (CHỈ dùng môi trường dev/local)
-- Chạy sau khi đã apply toàn bộ migrations. Tài khoản mẫu, mật khẩu chung: 123456
--   Chủ trọ  : 0901234567     Quản lý : 0911111111
--   Người thuê: 0987654321 (P101), 0976543210 (P201)
-- Lưu ý: Auth lưu SĐT dạng 84xxxxxxxxx; client đăng nhập bằng +84... hoặc 84...

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tài khoản Auth (trigger tự tạo hồ sơ public.nguoi_dung với vai_tro 'nguoi_thue', sau đó nâng quyền)
INSERT INTO auth.users (id, instance_id, aud, role, phone, encrypted_password, phone_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.so_dien_thoai,
       crypt('123456', gen_salt('bf')), NOW(),
       '{"provider":"phone","providers":["phone"]}'::jsonb, jsonb_build_object('ho_ten', v.ho_ten), NOW(), NOW()
FROM (VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', '84901234567', 'Nguyễn Văn Chủ Nhà'),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', '84987654321', 'Trần Thị Thuê'),
  ('c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', '84976543210', 'Lê Văn Khách'),
  ('c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a34', '84911111111', 'Phạm Thị Quản Lý')
) AS v(id, so_dien_thoai, ho_ten)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at)
SELECT id, phone, jsonb_build_object('sub', id::text, 'phone', phone, 'phone_verified', true), 'phone', NOW()
FROM auth.users WHERE id IN ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a31','c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32',
                             'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33','c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a34')
  AND NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = auth.users.id);

UPDATE nguoi_dung SET vai_tro = 'chu_tro', cccd = '079090001122' WHERE id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a31';
UPDATE nguoi_dung SET cccd = '079092003344' WHERE id = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32';
UPDATE nguoi_dung SET cccd = '079095005566' WHERE id = 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
UPDATE nguoi_dung SET vai_tro = 'quan_ly' WHERE id = 'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a34';

-- 2. Khu trọ (kèm tài khoản nhận tiền để sinh VietQR: 970436 = Vietcombank)
INSERT INTO khu_tro (id, ten, dia_chi, so_tang, don_gia_dien, don_gia_nuoc, phi_internet,
                        chu_tro_id, ma_bin_ngan_hang, so_tai_khoan, ten_tai_khoan)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Nhà trọ Bình An', '123 Đường Số 5, Phường Linh Trung, TP. Thủ Đức',
        3, 3500.00, 20000.00, 100000.00,
        'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', '970436', '0011001234567', 'NGUYEN VAN CHU NHA')
ON CONFLICT (id) DO NOTHING;

INSERT INTO nhan_su_khu_tro (khu_tro_id, nguoi_dung_id)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a34')
ON CONFLICT DO NOTHING;

-- 3. Phòng
INSERT INTO phong_tro (id, khu_tro_id, so_phong, tang, gia_thue_co_ban, tien_coc, trang_thai, dien_tich_m2)
VALUES
 ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'P101', 1, 3200000, 3200000, 'trong', 25.0),
 ('b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'P102', 1, 3000000, 3000000, 'trong', 22.0),
 ('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'P201', 2, 3500000, 3500000, 'trong', 28.0),
 ('b4eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'P202', 2, 3300000, 3300000, 'bao_tri', 26.0)
ON CONFLICT (id) DO NOTHING;

-- 4. Phí dịch vụ cố định (điện 3.500đ/kWh, nước 20.000đ/m³ lấy từ khu_tro.don_gia_dien / don_gia_nuoc)
INSERT INTO phi_dich_vu (id, khu_tro_id, ten, so_tien, cach_tinh) VALUES
 ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Rác', 30000, 'theo_phong'),
 ('d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Wifi', 100000, 'theo_phong'),
 ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Gửi xe', 50000, 'theo_don_vi')
ON CONFLICT DO NOTHING;

-- 5. Hợp đồng (trigger tự chuyển phòng sang 'dang_thue')
INSERT INTO hop_dong (id, phong_id, nguoi_thue_id, ngay_bat_dau, gia_thue, tien_coc, ngay_thanh_toan, so_nguoi_o, trang_thai)
VALUES
 ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32',
  (date_trunc('month', now()) - interval '4 months')::date, 3200000, 3200000, 5, 2, 'hieu_luc'),
 ('e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a52', 'b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  (date_trunc('month', now()) - interval '4 months')::date, 3500000, 3500000, 5, 1, 'hieu_luc')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dich_vu_hop_dong (hop_dong_id, phi_dich_vu_id, so_luong) VALUES
 ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 1),
 ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'd2eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 1),
 ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 2),
 ('e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a52', 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 1),
 ('e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a52', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 1)
ON CONFLICT DO NOTHING;

-- 6. Chỉ số 3 kỳ gần nhất (kỳ hiện tại của P101 cố ý tăng đột biến để demo cảnh báo bất thường)
-- m2 = 2 tháng trước, m1 = tháng trước, m0 = tháng hiện tại (tính theo ngày chạy seed)
INSERT INTO chi_so_cong_to (phong_id, loai, ky, chi_so_cu, chi_so_moi, nguoi_ghi_id)
SELECT phong_id, loai, (date_trunc('month', now()) - (k || ' months')::interval)::date, chi_so_cu, chi_so_moi,
       'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a31'
FROM (VALUES
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, 'dien', 2, 1000, 1120),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, 'dien', 1, 1120, 1250),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, 'dien', 0, 1250, 1550),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, 'nuoc',       2,   50,   58),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, 'nuoc',       1,   58,   67),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, 'nuoc',       0,   67,   75),
  ('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a24'::uuid, 'dien', 2,  500,  560),
  ('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a24'::uuid, 'dien', 1,  560,  630),
  ('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a24'::uuid, 'dien', 0,  630,  690),
  ('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a24'::uuid, 'nuoc',       2,   20,   24),
  ('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a24'::uuid, 'nuoc',       1,   24,   29),
  ('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a24'::uuid, 'nuoc',       0,   29,   33)
) AS t(phong_id, loai, k, chi_so_cu, chi_so_moi)
ON CONFLICT (phong_id, loai, ky) DO NOTHING;

-- 7. Hóa đơn: kỳ m2 đã thanh toán, kỳ m1 (P101 quá hạn, P201 chờ duyệt biên lai), kỳ m0 để nháp
DO $$
DECLARE
  m0 date := date_trunc('month', now())::date;
  c record; b hoa_don; pay uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM hoa_don) THEN RETURN; END IF;

  FOR c IN SELECT id FROM hop_dong WHERE trang_thai = 'hieu_luc' LOOP
    -- kỳ m2: phát hành + thanh toán đủ
    b := tao_hoa_don(c.id, (m0 - interval '2 months')::date);
    b := phat_hanh_hoa_don(b.id);
    INSERT INTO thanh_toan (hoa_don_id, so_tien, trang_thai) VALUES (b.id, b.tong_tien, 'cho_duyet') RETURNING id INTO pay;
    UPDATE thanh_toan SET trang_thai = 'da_duyet' WHERE id = pay;

    -- kỳ m1: phát hành
    b := tao_hoa_don(c.id, (m0 - interval '1 month')::date);
    PERFORM phat_hanh_hoa_don(b.id);

    -- kỳ m0: chỉ tạo bản nháp
    PERFORM tao_hoa_don(c.id, m0);
  END LOOP;

  -- P201 đã gửi biên lai kỳ m1 (chờ chủ trọ duyệt)
  INSERT INTO thanh_toan (hoa_don_id, so_tien, trang_thai, nguoi_gui_id)
  SELECT id, tong_tien, 'cho_duyet', 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'
    FROM hoa_don WHERE hop_dong_id = 'e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a52' AND ky = (m0 - interval '1 month')::date;

  PERFORM danh_dau_hoa_don_qua_han();
END $$;

-- 8. Sự cố mẫu
INSERT INTO su_co (phong_id, nguoi_thue_id, tieu_de, mo_ta, phan_loai, trang_thai)
SELECT 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32',
       'Máy lạnh không mát', 'Bật máy lạnh 30 phút vẫn không mát, có tiếng kêu lạ.', 'may_lanh', 'cho_tiep_nhan'
WHERE NOT EXISTS (SELECT 1 FROM su_co);
