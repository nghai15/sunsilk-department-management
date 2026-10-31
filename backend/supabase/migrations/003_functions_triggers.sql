-- Migration: 003_functions_triggers.sql
-- Hàm tiện ích phân quyền, tính hóa đơn, trigger nghiệp vụ, RPC cho frontend.
-- Mọi hàm SECURITY DEFINER đều cố định search_path và tự kiểm tra quyền bên trong.

-- =====================================================================
-- 1. Hàm trợ giúp phân quyền (dùng trong RLS)
-- =====================================================================
CREATE OR REPLACE FUNCTION vai_tro_hien_tai() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT vai_tro FROM public.nguoi_dung WHERE id = auth.uid() AND dang_hoat_dong
$$;

CREATE OR REPLACE FUNCTION la_nhan_su_khu_tro(p_khu_tro_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    public.vai_tro_hien_tai() = 'quan_tri'
    OR EXISTS (SELECT 1 FROM public.khu_tro p
                WHERE p.id = p_khu_tro_id AND p.chu_tro_id = auth.uid()
                  AND public.vai_tro_hien_tai() = 'chu_tro')
    OR EXISTS (SELECT 1 FROM public.nhan_su_khu_tro s
                WHERE s.khu_tro_id = p_khu_tro_id AND s.nguoi_dung_id = auth.uid()
                  AND public.vai_tro_hien_tai() = 'quan_ly'),
    FALSE)
$$;

CREATE OR REPLACE FUNCTION la_nhan_su_phong(p_phong_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT public.la_nhan_su_khu_tro(r.khu_tro_id) FROM public.phong_tro r WHERE r.id = p_phong_id), FALSE)
$$;

CREATE OR REPLACE FUNCTION la_nguoi_thue_phong(p_phong_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hop_dong c
                  WHERE c.phong_id = p_phong_id AND c.nguoi_thue_id = auth.uid() AND c.trang_thai = 'hieu_luc')
$$;

-- Danh sách người nhận thông báo "phía quản lý" của một khu
CREATE OR REPLACE FUNCTION ds_nhan_su_khu_tro(p_khu_tro_id uuid) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT uid), '{}') FROM (
    SELECT chu_tro_id AS uid FROM public.khu_tro WHERE id = p_khu_tro_id AND chu_tro_id IS NOT NULL
    UNION ALL
    SELECT nguoi_dung_id FROM public.nhan_su_khu_tro WHERE khu_tro_id = p_khu_tro_id
  ) t
$$;

CREATE OR REPLACE FUNCTION gui_thong_bao(
  p_nguoi_nhan uuid[], p_loai text, p_tieu_de text, p_noi_dung text, p_duong_dan text DEFAULT NULL, p_du_lieu jsonb DEFAULT '{}'
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.thong_bao (nguoi_nhan_id, loai, tieu_de, noi_dung, duong_dan, du_lieu)
  SELECT u, p_loai, p_tieu_de, p_noi_dung, p_duong_dan, p_du_lieu FROM unnest(p_nguoi_nhan) AS u;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
-- Chỉ trigger/Edge Function (service vai_tro) được gọi trực tiếp; client không được tự bơm thông báo
REVOKE ALL ON FUNCTION gui_thong_bao(uuid[], text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- 2. Tính tiền điện/nước theo đơn giá phẳng của khu
-- =====================================================================
CREATE OR REPLACE FUNCTION tinh_tien_dien_nuoc(p_khu_tro_id uuid, p_loai text, p_so_tieu_thu int)
RETURNS numeric
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_don_gia numeric;
BEGIN
  IF p_so_tieu_thu IS NULL OR p_so_tieu_thu <= 0 THEN RETURN 0; END IF;

  SELECT CASE p_loai WHEN 'dien' THEN don_gia_dien ELSE don_gia_nuoc END
    INTO v_don_gia FROM khu_tro WHERE id = p_khu_tro_id;
  RETURN p_so_tieu_thu * COALESCE(v_don_gia, 0);
END $$;

-- =====================================================================
-- 3. Sinh hóa đơn tháng từ chỉ số + dịch vụ (tạo bản nháp)
-- =====================================================================
CREATE OR REPLACE FUNCTION tao_hoa_don(p_hop_dong_id uuid, p_ky date)
RETURNS hoa_don
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period date := date_trunc('month', p_ky)::date;
  v_month_year text := to_char(v_period, 'MM/YYYY');
  c hop_dong; r phong_tro; p khu_tro;
  e chi_so_cong_to; w chi_so_cong_to;
  v_elec numeric; v_water numeric; v_services numeric := 0;
  v_due date; v_bill hoa_don; v_existing hoa_don; sv record;
BEGIN
  SELECT * INTO c FROM hop_dong WHERE id = p_hop_dong_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy hợp đồng'; END IF;
  SELECT * INTO r FROM phong_tro WHERE id = c.phong_id;
  SELECT * INTO p FROM khu_tro WHERE id = r.khu_tro_id;

  -- Gọi từ client (có auth.uid) thì phải là nhân sự khu; service vai_tro (uid NULL) được phép
  IF auth.uid() IS NOT NULL AND NOT la_nhan_su_khu_tro(p.id) THEN
    RAISE EXCEPTION 'Không có quyền tạo hóa đơn cho khu này' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO e FROM chi_so_cong_to WHERE phong_id = r.id AND loai = 'dien' AND ky = v_period;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chưa nhập chỉ số điện kỳ %', v_month_year; END IF;
  SELECT * INTO w FROM chi_so_cong_to WHERE phong_id = r.id AND loai = 'nuoc' AND ky = v_period;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chưa nhập chỉ số nước kỳ %', v_month_year; END IF;

  v_elec  := tinh_tien_dien_nuoc(p.id, 'dien', e.so_tieu_thu);
  v_water := tinh_tien_dien_nuoc(p.id, 'nuoc', w.so_tieu_thu);

  SELECT * INTO v_existing FROM hoa_don WHERE hop_dong_id = c.id AND thang_nam = v_month_year;
  IF FOUND THEN
    IF NOT v_existing.la_ban_nhap AND (v_existing.trang_thai_thanh_toan <> 'chua_thanh_toan'
        OR EXISTS (SELECT 1 FROM thanh_toan WHERE hoa_don_id = v_existing.id)) THEN
      RAISE EXCEPTION 'Hóa đơn % đã phát hành/đã có thanh toán, không thể tạo lại', v_month_year;
    END IF;
    DELETE FROM chi_tiet_hoa_don WHERE hoa_don_id = v_existing.id;
  END IF;

  -- hạn thanh toán: ngày ngay_thanh_toan của tháng kế tiếp kỳ tính tiền
  v_due := (v_period + interval '1 month')::date + (c.ngay_thanh_toan - 1);

  INSERT INTO hoa_don (phong_id, hop_dong_id, thang_nam, ky, tien_phong,
                     chi_so_dien_cu, chi_so_dien_moi, tien_dien,
                     chi_so_nuoc_cu, chi_so_nuoc_moi, tien_nuoc,
                     phi_khac, tien_dich_vu, tong_tien, han_thanh_toan,
                     trang_thai_thanh_toan, la_ban_nhap, noi_dung_chuyen_khoan)
  VALUES (r.id, c.id, v_month_year, v_period, c.gia_thue,
          e.chi_so_cu, e.chi_so_moi, v_elec,
          w.chi_so_cu, w.chi_so_moi, v_water,
          0, 0, 0, v_due,
          'chua_thanh_toan', TRUE,
          'PHONG' || regexp_replace(upper(r.so_phong), '[^A-Z0-9]', '', 'g') || ' T' || to_char(v_period, 'FMMM'))
  ON CONFLICT (hop_dong_id, thang_nam) DO UPDATE SET
    tien_phong = EXCLUDED.tien_phong,
    chi_so_dien_cu = EXCLUDED.chi_so_dien_cu, chi_so_dien_moi = EXCLUDED.chi_so_dien_moi,
    tien_dien = EXCLUDED.tien_dien,
    chi_so_nuoc_cu = EXCLUDED.chi_so_nuoc_cu, chi_so_nuoc_moi = EXCLUDED.chi_so_nuoc_moi,
    tien_nuoc = EXCLUDED.tien_nuoc, han_thanh_toan = EXCLUDED.han_thanh_toan,
    la_ban_nhap = TRUE, trang_thai_thanh_toan = 'chua_thanh_toan', noi_dung_chuyen_khoan = EXCLUDED.noi_dung_chuyen_khoan
  RETURNING * INTO v_bill;

  INSERT INTO chi_tiet_hoa_don (hoa_don_id, dien_giai, so_luong, don_gia, so_tien) VALUES
    (v_bill.id, 'Tiền phòng ' || r.so_phong, 1, c.gia_thue, c.gia_thue),
    (v_bill.id, 'Tiền điện (' || e.so_tieu_thu || ' kWh)', e.so_tieu_thu,
        CASE WHEN e.so_tieu_thu > 0 THEN round(v_elec / e.so_tieu_thu, 2) ELSE 0 END, v_elec),
    (v_bill.id, 'Tiền nước (' || w.so_tieu_thu || ' m³)', w.so_tieu_thu,
        CASE WHEN w.so_tieu_thu > 0 THEN round(v_water / w.so_tieu_thu, 2) ELSE 0 END, v_water);

  FOR sv IN
    SELECT f.ten, f.so_tien,
           CASE f.cach_tinh WHEN 'theo_nguoi' THEN c.so_nguoi_o
                               WHEN 'theo_don_vi'   THEN cs.so_luong
                               ELSE 1 END AS qty
      FROM dich_vu_hop_dong cs JOIN phi_dich_vu f ON f.id = cs.phi_dich_vu_id
     WHERE cs.hop_dong_id = c.id AND f.dang_hoat_dong
  LOOP
    INSERT INTO chi_tiet_hoa_don (hoa_don_id, dien_giai, so_luong, don_gia, so_tien)
    VALUES (v_bill.id, sv.ten, sv.qty, sv.so_tien, sv.so_tien * sv.qty);
    v_services := v_services + sv.so_tien * sv.qty;
  END LOOP;

  UPDATE hoa_don SET tien_dich_vu = v_services, phi_khac = v_services,
                   tong_tien = c.gia_thue + v_elec + v_water + v_services
   WHERE id = v_bill.id RETURNING * INTO v_bill;
  RETURN v_bill;
END $$;

-- Phát hành hóa đơn nháp cho người thuê (kèm thông báo)
CREATE OR REPLACE FUNCTION phat_hanh_hoa_don(p_hoa_don_id uuid) RETURNS hoa_don
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b hoa_don; r phong_tro; v_tenant uuid;
BEGIN
  SELECT * INTO b FROM hoa_don WHERE id = p_hoa_don_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy hóa đơn'; END IF;
  SELECT * INTO r FROM phong_tro WHERE id = b.phong_id;
  IF auth.uid() IS NOT NULL AND NOT la_nhan_su_khu_tro(r.khu_tro_id) THEN
    RAISE EXCEPTION 'Không có quyền phát hành hóa đơn' USING ERRCODE = '42501';
  END IF;
  IF NOT b.la_ban_nhap THEN RETURN b; END IF;

  UPDATE hoa_don SET la_ban_nhap = FALSE WHERE id = b.id RETURNING * INTO b;
  SELECT nguoi_thue_id INTO v_tenant FROM hop_dong WHERE id = b.hop_dong_id;
  PERFORM gui_thong_bao(ARRAY[v_tenant], 'hoa_don_sap_den_han',
    'Hóa đơn tháng ' || b.thang_nam,
    'Phòng ' || r.so_phong || ': ' || to_char(b.tong_tien, 'FM999G999G999') || 'đ, hạn ' || to_char(b.han_thanh_toan, 'DD/MM/YYYY'),
    '/billing/' || b.id, jsonb_build_object('hoa_don_id', b.id));
  RETURN b;
END $$;

-- Đánh dấu quá hạn (gọi từ cron-reminders); múi giờ Việt Nam
CREATE OR REPLACE FUNCTION danh_dau_hoa_don_qua_han() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE hoa_don SET trang_thai_thanh_toan = 'qua_han'
   WHERE trang_thai_thanh_toan = 'chua_thanh_toan' AND NOT la_ban_nhap
     AND han_thanh_toan < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION danh_dau_hoa_don_qua_han() FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- 4. Thanh toán: người thuê gửi UNC -> chủ trọ duyệt
-- =====================================================================
CREATE OR REPLACE FUNCTION thanh_toan_sau_khi_them() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b hoa_don; r phong_tro;
BEGIN
  SELECT * INTO b FROM hoa_don WHERE id = NEW.hoa_don_id;
  SELECT * INTO r FROM phong_tro WHERE id = b.phong_id;
  IF NEW.trang_thai = 'cho_duyet' AND b.trang_thai_thanh_toan IN ('chua_thanh_toan', 'qua_han') THEN
    UPDATE hoa_don SET trang_thai_thanh_toan = 'cho_xac_nhan' WHERE id = b.id;
  END IF;
  IF NEW.trang_thai = 'cho_duyet' THEN
    PERFORM gui_thong_bao(ds_nhan_su_khu_tro(r.khu_tro_id), 'thanh_toan',
      'Phòng ' || r.so_phong || ' đã gửi biên lai',
      'Hóa đơn ' || b.thang_nam || ' - chờ bạn xác nhận thanh toán',
      '/billing/' || b.id, jsonb_build_object('hoa_don_id', b.id, 'thanh_toan_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_thanh_toan_sau_them AFTER INSERT ON thanh_toan
  FOR EACH ROW EXECUTE FUNCTION thanh_toan_sau_khi_them();

CREATE OR REPLACE FUNCTION thanh_toan_truoc_khi_sua() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai AND NEW.trang_thai <> 'cho_duyet' THEN
    NEW.nguoi_duyet_id := COALESCE(auth.uid(), NEW.nguoi_duyet_id);
    NEW.duyet_luc := NOW();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_thanh_toan_truoc_sua BEFORE UPDATE ON thanh_toan
  FOR EACH ROW EXECUTE FUNCTION thanh_toan_truoc_khi_sua();

CREATE OR REPLACE FUNCTION thanh_toan_sau_khi_sua() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b hoa_don; v_paid numeric; v_tenant uuid; v_new text;
BEGIN
  IF NEW.trang_thai = OLD.trang_thai THEN RETURN NEW; END IF;
  SELECT * INTO b FROM hoa_don WHERE id = NEW.hoa_don_id;
  SELECT nguoi_thue_id INTO v_tenant FROM hop_dong WHERE id = b.hop_dong_id;

  SELECT COALESCE(SUM(so_tien), 0) INTO v_paid FROM thanh_toan WHERE hoa_don_id = b.id AND trang_thai = 'da_duyet';

  IF v_paid >= b.tong_tien THEN
    UPDATE hoa_don SET trang_thai_thanh_toan = 'da_thanh_toan', thanh_toan_luc = NOW() WHERE id = b.id;
    v_new := 'da_thanh_toan';
  ELSIF v_paid > 0 THEN
    UPDATE hoa_don SET trang_thai_thanh_toan = 'thanh_toan_mot_phan' WHERE id = b.id;
    v_new := 'thanh_toan_mot_phan';
  ELSIF NOT EXISTS (SELECT 1 FROM thanh_toan WHERE hoa_don_id = b.id AND trang_thai = 'cho_duyet') THEN
    v_new := CASE WHEN b.han_thanh_toan < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN 'qua_han' ELSE 'chua_thanh_toan' END;
    UPDATE hoa_don SET trang_thai_thanh_toan = v_new, thanh_toan_luc = NULL WHERE id = b.id;
  END IF;

  IF NEW.trang_thai = 'da_duyet' THEN
    PERFORM gui_thong_bao(ARRAY[v_tenant], 'thanh_toan', 'Đã xác nhận thanh toán',
      'Hóa đơn ' || b.thang_nam || ' đã được ghi nhận. Cảm ơn bạn!', '/billing/' || b.id, jsonb_build_object('hoa_don_id', b.id));
  ELSIF NEW.trang_thai = 'tu_choi' THEN
    PERFORM gui_thong_bao(ARRAY[v_tenant], 'thanh_toan', 'Biên lai chưa được chấp nhận',
      COALESCE(NULLIF(NEW.ly_do_tu_choi, ''), 'Vui lòng kiểm tra và gửi lại biên lai') ,
      '/billing/' || b.id, jsonb_build_object('hoa_don_id', b.id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_thanh_toan_sau_sua AFTER UPDATE OF trang_thai ON thanh_toan
  FOR EACH ROW EXECUTE FUNCTION thanh_toan_sau_khi_sua();

-- =====================================================================
-- 5. Sự cố: lịch sử trạng thái + thông báo hai chiều
-- =====================================================================
CREATE OR REPLACE FUNCTION su_co_truoc_khi_ghi() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.nguoi_thue_id IS NULL THEN NEW.nguoi_thue_id := auth.uid(); END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.trang_thai = 'hoan_tat' AND OLD.trang_thai <> 'hoan_tat' THEN NEW.hoan_tat_luc := NOW();
    ELSIF NEW.trang_thai <> 'hoan_tat' THEN NEW.hoan_tat_luc := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_su_co_truoc_ghi BEFORE INSERT OR UPDATE ON su_co
  FOR EACH ROW EXECUTE FUNCTION su_co_truoc_khi_ghi();

CREATE OR REPLACE FUNCTION su_co_sau_khi_ghi() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r phong_tro; v_label text;
BEGIN
  SELECT * INTO r FROM phong_tro WHERE id = NEW.phong_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lich_su_su_co (su_co_id, tu_trang_thai, den_trang_thai, nguoi_thuc_hien_id)
    VALUES (NEW.id, NULL, NEW.trang_thai, auth.uid());
    PERFORM gui_thong_bao(ds_nhan_su_khu_tro(r.khu_tro_id), 'su_co',
      'Phòng ' || r.so_phong || ' báo sự cố', NEW.tieu_de,
      '/su_co/' || NEW.id, jsonb_build_object('su_co_id', NEW.id));
  ELSIF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai THEN
    INSERT INTO lich_su_su_co (su_co_id, tu_trang_thai, den_trang_thai, nguoi_thuc_hien_id)
    VALUES (NEW.id, OLD.trang_thai, NEW.trang_thai, auth.uid());
    v_label := CASE NEW.trang_thai WHEN 'cho_tiep_nhan' THEN 'Đã tiếp nhận' WHEN 'dang_xu_ly' THEN 'Đang xử lý'
                               WHEN 'hoan_tat' THEN 'Đã hoàn tất' ELSE 'Đã hủy' END;
    IF NEW.nguoi_thue_id IS NOT NULL THEN
      PERFORM gui_thong_bao(ARRAY[NEW.nguoi_thue_id], 'su_co', 'Sự cố: ' || v_label, NEW.tieu_de,
        '/su_co/' || NEW.id, jsonb_build_object('su_co_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_su_co_sau_ghi AFTER INSERT OR UPDATE ON su_co
  FOR EACH ROW EXECUTE FUNCTION su_co_sau_khi_ghi();

-- =====================================================================
-- 6. Thông báo hàng loạt theo khu / tầng / phòng
-- =====================================================================
CREATE OR REPLACE FUNCTION gui_thong_bao_chung(
  p_khu_tro_id uuid, p_tieu_de text, p_noi_dung text,
  p_pham_vi text DEFAULT 'tat_ca', p_cac_tang int[] DEFAULT '{}', p_cac_phong_id uuid[] DEFAULT '{}'
) RETURNS thong_bao_chung
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ann thong_bao_chung; v_users uuid[];
BEGIN
  IF NOT la_nhan_su_khu_tro(p_khu_tro_id) THEN
    RAISE EXCEPTION 'Không có quyền gửi thông báo cho khu này' USING ERRCODE = '42501';
  END IF;
  IF p_pham_vi NOT IN ('tat_ca', 'tang', 'phong') THEN RAISE EXCEPTION 'pham_vi không hợp lệ'; END IF;

  SELECT COALESCE(array_agg(DISTINCT c.nguoi_thue_id), '{}') INTO v_users
    FROM hop_dong c JOIN phong_tro r ON r.id = c.phong_id
   WHERE r.khu_tro_id = p_khu_tro_id AND c.trang_thai = 'hieu_luc'
     AND (p_pham_vi = 'tat_ca'
          OR (p_pham_vi = 'tang' AND r.tang = ANY (p_cac_tang))
          OR (p_pham_vi = 'phong'  AND r.id    = ANY (p_cac_phong_id)));

  INSERT INTO thong_bao_chung (khu_tro_id, nguoi_tao_id, tieu_de, noi_dung, pham_vi, cac_tang, cac_phong_id, so_nguoi_nhan)
  VALUES (p_khu_tro_id, auth.uid(), p_tieu_de, p_noi_dung, p_pham_vi, p_cac_tang, p_cac_phong_id, COALESCE(array_length(v_users, 1), 0))
  RETURNING * INTO v_ann;

  PERFORM gui_thong_bao(v_users, 'thong_bao_chung', p_tieu_de, p_noi_dung, '/thong_bao',
                       jsonb_build_object('thong_bao_chung_id', v_ann.id));
  RETURN v_ann;
END $$;

-- =====================================================================
-- 7. Dashboard + view danh sách phòng (cho FE: màu trạng thái, lọc nhanh)
-- =====================================================================
CREATE OR REPLACE FUNCTION tong_quan_dashboard(p_khu_tro_id uuid, p_ky date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_my text := to_char(COALESCE(p_ky, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date), 'MM/YYYY');
  v jsonb;
BEGIN
  IF NOT la_nhan_su_khu_tro(p_khu_tro_id) THEN
    RAISE EXCEPTION 'Không có quyền xem báo cáo khu này' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'thang_nam', v_my,
    'tong_so_phong',       count(*),
    'phong_dang_thue',    count(*) FILTER (WHERE trang_thai = 'dang_thue'),
    'phong_trong',   count(*) FILTER (WHERE trang_thai = 'trong'),
    'phong_bao_tri', count(*) FILTER (WHERE trang_thai = 'bao_tri'),
    'ty_le_phong_trong',      CASE WHEN count(*) = 0 THEN 0
                         ELSE round(100.0 * count(*) FILTER (WHERE trang_thai = 'trong') / count(*), 1) END
  ) INTO v FROM phong_tro WHERE khu_tro_id = p_khu_tro_id;

  RETURN v || (
    SELECT jsonb_build_object(
      'tong_phat_hanh',      COALESCE(sum(b.tong_tien), 0),
      'tong_da_thu',   COALESCE(sum(b.tong_tien) FILTER (WHERE b.trang_thai_thanh_toan = 'da_thanh_toan'), 0),
      'tong_con_no', COALESCE(sum(b.tong_tien) FILTER (WHERE b.trang_thai_thanh_toan <> 'da_thanh_toan'), 0),
      'so_hoa_don_qua_han',     count(*) FILTER (WHERE b.trang_thai_thanh_toan = 'qua_han'),
      'so_hoa_don_cho_xac_nhan', count(*) FILTER (WHERE b.trang_thai_thanh_toan = 'cho_xac_nhan'))
      FROM hoa_don b JOIN phong_tro r ON r.id = b.phong_id
     WHERE r.khu_tro_id = p_khu_tro_id AND b.thang_nam = v_my AND NOT b.la_ban_nhap
  ) || (
    SELECT jsonb_build_object('so_su_co_dang_mo', count(*))
      FROM su_co i JOIN phong_tro r ON r.id = i.phong_id
     WHERE r.khu_tro_id = p_khu_tro_id AND i.trang_thai IN ('cho_tiep_nhan', 'dang_xu_ly')
  );
END $$;

CREATE OR REPLACE VIEW tong_quan_phong WITH (security_invoker = true) AS
SELECT r.*,
       c.id AS hop_dong_id,
       c.nguoi_thue_id AS nguoi_thue_hien_tai_id,
       u.ho_ten AS ten_nguoi_thue,
       u.so_dien_thoai AS sdt_nguoi_thue,
       EXISTS (SELECT 1 FROM hoa_don b WHERE b.phong_id = r.id AND b.trang_thai_thanh_toan = 'qua_han' AND NOT b.la_ban_nhap) AS co_no_qua_han,
       (SELECT count(*) FROM su_co i WHERE i.phong_id = r.id AND i.trang_thai IN ('cho_tiep_nhan', 'dang_xu_ly')) AS so_su_co_dang_mo,
       CASE
         WHEN r.trang_thai = 'bao_tri' THEN 'bao_tri'
         WHEN r.trang_thai = 'trong' THEN 'trong'
         WHEN EXISTS (SELECT 1 FROM hoa_don b WHERE b.phong_id = r.id AND b.trang_thai_thanh_toan = 'qua_han' AND NOT b.la_ban_nhap) THEN 'no_tien'
         WHEN EXISTS (SELECT 1 FROM su_co i WHERE i.phong_id = r.id AND i.trang_thai IN ('cho_tiep_nhan', 'dang_xu_ly')) THEN 'co_su_co'
         ELSE 'dang_thue'
       END AS trang_thai_hien_thi
  FROM phong_tro r
  LEFT JOIN hop_dong c ON c.phong_id = r.id AND c.trang_thai = 'hieu_luc'
  LEFT JOIN nguoi_dung u ON u.id = c.nguoi_thue_id;

-- Quyền thực thi: client chỉ gọi các RPC đã tự kiểm tra quyền
REVOKE ALL ON FUNCTION tao_hoa_don(uuid, date), phat_hanh_hoa_don(uuid),
  gui_thong_bao_chung(uuid, text, text, text, int[], uuid[]), tong_quan_dashboard(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION tao_hoa_don(uuid, date), phat_hanh_hoa_don(uuid),
  gui_thong_bao_chung(uuid, text, text, text, int[], uuid[]), tong_quan_dashboard(uuid, date) TO authenticated;
