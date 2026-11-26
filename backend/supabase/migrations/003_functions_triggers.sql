-- Hàm tiện ích phân quyền, tính hóa đơn, trigger nghiệp vụ, RPC cho frontend.

-- 1. Hàm trợ giúp phân quyền (dùng trong RLS)
CREATE OR REPLACE FUNCTION vai_tro_hien_tai() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT vai_tro FROM public.nguoi_dung WHERE id = auth.uid() AND dang_hoat_dong
$$;

CREATE OR REPLACE FUNCTION public.la_nhan_su_khu_tro(p_khu_tro_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.vai_tro_hien_tai() IN ('chu_tro', 'quan_tri')
    OR (public.vai_tro_hien_tai() = 'quan_ly' AND EXISTS (
      SELECT 1 FROM public.nhan_su_khu_tro
      WHERE khu_tro_id = p_khu_tro_id AND nguoi_dung_id = auth.uid())), FALSE)
$$;

CREATE OR REPLACE FUNCTION la_nhan_su_phong(p_phong_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT public.la_nhan_su_khu_tro(r.khu_tro_id) FROM public.phong_tro r WHERE r.id = p_phong_id), FALSE)
$$;

CREATE OR REPLACE FUNCTION public.co_the_xu_ly_su_co(p_phong_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.vai_tro_hien_tai() = 'chu_tro'
    OR (public.vai_tro_hien_tai() = 'quan_ly' AND public.la_nhan_su_phong(p_phong_id)), FALSE)
$$;
REVOKE ALL ON FUNCTION public.co_the_xu_ly_su_co(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.co_the_xu_ly_su_co(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ds_nguoi_xu_ly_su_co(p_khu_tro_id uuid) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(u.id), '{}') FROM public.nguoi_dung u
  WHERE u.dang_hoat_dong AND (u.vai_tro = 'chu_tro'
    OR (u.vai_tro = 'quan_ly' AND EXISTS (
      SELECT 1 FROM public.nhan_su_khu_tro s
      WHERE s.khu_tro_id = p_khu_tro_id AND s.nguoi_dung_id = u.id)))
$$;
REVOKE ALL ON FUNCTION public.ds_nguoi_xu_ly_su_co(uuid) FROM PUBLIC, anon, authenticated;

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
    SELECT id FROM public.nguoi_dung WHERE vai_tro IN ('chu_tro','quan_tri') AND dang_hoat_dong
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

-- 2. Tính tiền điện/nước theo đơn giá phẳng của khu
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

-- 3. Sinh hóa đơn tháng từ chỉ số + dịch vụ (tạo bản nháp)
CREATE OR REPLACE FUNCTION gia_theo_ky(p_loai text,p_id uuid,p_ky date,p_mac_dinh numeric) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT don_gia FROM lich_don_gia WHERE loai=p_loai AND doi_tuong_id=p_id AND tu_ky<=p_ky ORDER BY tu_ky DESC LIMIT 1),p_mac_dinh)
$$;
REVOKE ALL ON FUNCTION gia_theo_ky(text,uuid,date,numeric) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION tao_hoa_don_noi_bo(p_hop_dong_id uuid, p_ky date)
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


  SELECT * INTO e FROM chi_so_cong_to WHERE phong_id = r.id AND loai = 'dien' AND ky = v_period;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chưa nhập chỉ số điện kỳ %', v_month_year; END IF;
  SELECT * INTO w FROM chi_so_cong_to WHERE phong_id = r.id AND loai = 'nuoc' AND ky = v_period;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chưa nhập chỉ số nước kỳ %', v_month_year; END IF;

  p.don_gia_dien := gia_theo_ky('dien',p.id,v_period,p.don_gia_dien);
  p.don_gia_nuoc := gia_theo_ky('nuoc',p.id,v_period,p.don_gia_nuoc);
  c.gia_thue := gia_theo_ky('phong',r.id,v_period,c.gia_thue);
  v_elec := round(p.don_gia_dien * e.so_tieu_thu);
  v_water := round(p.don_gia_nuoc * w.so_tieu_thu);

  SELECT * INTO v_existing FROM hoa_don WHERE hop_dong_id = c.id AND thang_nam = v_month_year;
  IF FOUND THEN
    IF NOT v_existing.la_ban_nhap THEN
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
        p.don_gia_dien, v_elec),
    (v_bill.id, 'Tiền nước (' || w.so_tieu_thu || ' m³)', w.so_tieu_thu,
        p.don_gia_nuoc, v_water);

  FOR sv IN
    SELECT f.ten, gia_theo_ky('dich_vu',f.id,v_period,f.so_tien) AS so_tien,
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
REVOKE ALL ON FUNCTION tao_hoa_don_noi_bo(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tao_hoa_don(p_hop_dong_id uuid, p_ky date)
RETURNS hoa_don LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT la_nhan_su_hop_dong(p_hop_dong_id) THEN
    RAISE EXCEPTION 'Không có quyền tạo hóa đơn' USING ERRCODE = '42501';
  END IF;
  RETURN tao_hoa_don_noi_bo(p_hop_dong_id, p_ky);
END $$;


-- Phát hành hóa đơn nháp cho người thuê (kèm thông báo)
CREATE OR REPLACE FUNCTION phat_hanh_hoa_don(p_hoa_don_id uuid) RETURNS hoa_don
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b hoa_don; r phong_tro; v_tenant uuid;
BEGIN
  SELECT * INTO b FROM hoa_don WHERE id = p_hoa_don_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy hóa đơn'; END IF;
  SELECT * INTO r FROM phong_tro WHERE id = b.phong_id;
  IF auth.uid() IS NOT NULL AND NOT la_nhan_su_khu_tro(r.khu_tro_id) THEN
    RAISE EXCEPTION 'Không có quyền phát hành hóa đơn' USING ERRCODE = '42501';
  END IF;
  IF NOT b.la_ban_nhap THEN RETURN b; END IF;
  IF b.ghi_chu_kiem_tra IS NOT NULL THEN RAISE EXCEPTION 'Cần người thuê nhập và chụp lại công tơ trước khi duyệt' USING ERRCODE='22023'; END IF;

  UPDATE hoa_don SET la_ban_nhap = FALSE, ghi_chu_kiem_tra = NULL WHERE id = b.id RETURNING * INTO b;
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

-- 4. Thanh toán: người thuê gửi UNC -> chủ trọ duyệt
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

-- 5. Sự cố: lịch sử trạng thái + thông báo hai chiều
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
    PERFORM gui_thong_bao(ds_nguoi_xu_ly_su_co(r.khu_tro_id), 'su_co',
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

-- 6. Thông báo hàng loạt theo khu / tầng / phòng
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
  IF NULLIF(btrim(p_tieu_de),'') IS NULL OR NULLIF(btrim(p_noi_dung),'') IS NULL OR length(p_tieu_de)>200 OR length(p_noi_dung)>5000 THEN RAISE EXCEPTION 'Tiêu đề và nội dung thông báo không hợp lệ' USING ERRCODE='22023'; END IF;

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

-- 7. Dashboard + view danh sách phòng (cho FE: màu trạng thái, lọc nhanh)
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
      'tong_da_thu',   COALESCE(sum(COALESCE((SELECT sum(t.so_tien) FROM thanh_toan t WHERE t.hoa_don_id=b.id AND t.trang_thai='da_duyet'),0)), 0),
      'tong_con_no', COALESCE(sum(GREATEST(0,b.tong_tien-COALESCE((SELECT sum(t.so_tien) FROM thanh_toan t WHERE t.hoa_don_id=b.id AND t.trang_thai='da_duyet'),0))), 0),
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


CREATE OR REPLACE FUNCTION tao_hop_dong_day_du(p_du_lieu jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r phong_tro; v_id uuid; v_start date; v_period date; v_service jsonb; v_count int;
BEGIN
 IF COALESCE(vai_tro_hien_tai(),'') NOT IN ('chu_tro','quan_tri') THEN RAISE EXCEPTION 'Không có quyền tạo hợp đồng' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM phong_tro WHERE id=(p_du_lieu->>'phong_id')::uuid FOR UPDATE;
 IF NOT FOUND OR r.trang_thai<>'trong' THEN RAISE EXCEPTION 'Phòng không còn trống' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM nguoi_dung WHERE id=(p_du_lieu->>'nguoi_thue_id')::uuid AND vai_tro='nguoi_thue' AND dang_hoat_dong) THEN RAISE EXCEPTION 'Người thuê không hợp lệ' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM nguoi_dung WHERE id=(p_du_lieu->>'nguoi_thue_id')::uuid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM hop_dong WHERE nguoi_thue_id=(p_du_lieu->>'nguoi_thue_id')::uuid AND trang_thai='hieu_luc') THEN
  RAISE EXCEPTION 'Người thuê đã có hợp đồng đang hiệu lực. Cần kết thúc hợp đồng cũ trước khi tạo hợp đồng mới.' USING ERRCODE='22023';
 END IF;
 v_start:=(p_du_lieu->>'ngay_bat_dau')::date;
 v_count:=(p_du_lieu->>'so_nguoi_o')::int;
 IF v_start IS NULL OR v_start>(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date OR v_count IS NULL OR v_count<1 OR v_count>r.so_nguoi_toi_da
 OR COALESCE((p_du_lieu->>'gia_thue')::numeric,-1)<0 OR COALESCE((p_du_lieu->>'tien_coc')::numeric,-1)<0
 OR COALESCE((p_du_lieu->>'dien_ban_dau')::int,-1)<0 OR COALESCE((p_du_lieu->>'nuoc_ban_dau')::int,-1)<0 THEN RAISE EXCEPTION 'Ngày, số người, giá thuê hoặc chỉ số không hợp lệ' USING ERRCODE='22023'; END IF;
 INSERT INTO hop_dong(phong_id,nguoi_thue_id,ngay_bat_dau,ngay_ket_thuc,gia_thue,tien_coc,ngay_thanh_toan,so_nguoi_o,ghi_chu)
 VALUES(r.id,(p_du_lieu->>'nguoi_thue_id')::uuid,v_start,NULLIF(p_du_lieu->>'ngay_ket_thuc','')::date,(p_du_lieu->>'gia_thue')::numeric,(p_du_lieu->>'tien_coc')::numeric,(p_du_lieu->>'ngay_thanh_toan')::int,v_count,NULLIF(p_du_lieu->>'ghi_chu','')) RETURNING id INTO v_id;
 v_period:=(date_trunc('month',v_start)-interval '1 month')::date;
 INSERT INTO chi_so_cong_to(phong_id,loai,ky,chi_so_cu,chi_so_moi,nguoi_ghi_id) VALUES
 (r.id,'dien',v_period,(p_du_lieu->>'dien_ban_dau')::int,(p_du_lieu->>'dien_ban_dau')::int,auth.uid()),
 (r.id,'nuoc',v_period,(p_du_lieu->>'nuoc_ban_dau')::int,(p_du_lieu->>'nuoc_ban_dau')::int,auth.uid()) ON CONFLICT(phong_id,loai,ky) DO NOTHING;
 FOR v_service IN SELECT value FROM jsonb_array_elements(COALESCE(p_du_lieu->'dich_vu','[]')) LOOP
  IF NOT EXISTS(SELECT 1 FROM phi_dich_vu WHERE id=(v_service->>'id')::uuid AND khu_tro_id=r.khu_tro_id AND dang_hoat_dong) THEN RAISE EXCEPTION 'Dịch vụ không thuộc khu trọ' USING ERRCODE='22023'; END IF;
  INSERT INTO dich_vu_hop_dong(hop_dong_id,phi_dich_vu_id,so_luong) VALUES(v_id,(v_service->>'id')::uuid,(v_service->>'so_luong')::int);
 END LOOP;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION ket_thuc_hop_dong(p_id uuid,p_ngay date,p_ly_do text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c hop_dong;
BEGIN
 IF COALESCE(vai_tro_hien_tai(),'') NOT IN ('chu_tro','quan_tri') THEN RAISE EXCEPTION 'Không có quyền kết thúc hợp đồng' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM hop_dong WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.trang_thai<>'hieu_luc' THEN RAISE EXCEPTION 'Hợp đồng không còn hiệu lực' USING ERRCODE='22023'; END IF;
 IF p_ngay IS NULL OR p_ngay<c.ngay_bat_dau OR p_ngay>(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date OR NULLIF(btrim(p_ly_do),'') IS NULL THEN RAISE EXCEPTION 'Cần ngày kết thúc hợp lệ và lý do' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM hoa_don WHERE hop_dong_id=c.id AND (la_ban_nhap OR trang_thai_thanh_toan<>'da_thanh_toan')) THEN RAISE EXCEPTION 'Cần hoàn tất hóa đơn và thanh toán trước khi kết thúc hợp đồng' USING ERRCODE='22023'; END IF;
 UPDATE hop_dong SET trang_thai='cham_dut',ngay_ket_thuc=p_ngay,ghi_chu=concat_ws(E'\n',ghi_chu,'Kết thúc: '||btrim(p_ly_do)) WHERE id=c.id;
END $$;
REVOKE ALL ON FUNCTION tao_hop_dong_day_du(jsonb),ket_thuc_hop_dong(uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tao_hop_dong_day_du(jsonb),ket_thuc_hop_dong(uuid,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION bao_ve_xoa_danh_muc() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='khu_tro' THEN
  IF EXISTS(SELECT 1 FROM phong_tro WHERE khu_tro_id=OLD.id) OR EXISTS(SELECT 1 FROM phi_dich_vu WHERE khu_tro_id=OLD.id) THEN RAISE EXCEPTION 'Khu trọ đang có phòng hoặc dịch vụ' USING ERRCODE='23503'; END IF;
 ELSIF TG_TABLE_NAME='phong_tro' THEN
  IF EXISTS(SELECT 1 FROM hop_dong WHERE phong_id=OLD.id) OR EXISTS(SELECT 1 FROM chi_so_cong_to WHERE phong_id=OLD.id) OR EXISTS(SELECT 1 FROM su_co WHERE phong_id=OLD.id) THEN RAISE EXCEPTION 'Phòng đang có lịch sử liên quan' USING ERRCODE='23503'; END IF;
 ELSIF TG_TABLE_NAME='phi_dich_vu' THEN
  IF EXISTS(SELECT 1 FROM dich_vu_hop_dong WHERE phi_dich_vu_id=OLD.id) THEN RAISE EXCEPTION 'Dịch vụ đang gắn với hợp đồng' USING ERRCODE='23503'; END IF;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER trg_khu_bao_ve_xoa BEFORE DELETE ON khu_tro FOR EACH ROW EXECUTE FUNCTION bao_ve_xoa_danh_muc();
CREATE TRIGGER trg_phong_bao_ve_xoa BEFORE DELETE ON phong_tro FOR EACH ROW EXECUTE FUNCTION bao_ve_xoa_danh_muc();
CREATE TRIGGER trg_dich_vu_bao_ve_xoa BEFORE DELETE ON phi_dich_vu FOR EACH ROW EXECUTE FUNCTION bao_ve_xoa_danh_muc();
REVOKE ALL ON FUNCTION bao_ve_xoa_danh_muc() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION dong_bo_ho_so_auth() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE nguoi_dung SET
    so_dien_thoai=CASE WHEN NULLIF(NEW.phone,'') IS NOT NULL THEN regexp_replace(NEW.phone,'^\+?84','0') ELSE so_dien_thoai END,
    ho_ten=COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'ho_ten'),''),ho_ten),
    cccd=CASE WHEN NEW.raw_user_meta_data ? 'cccd' THEN NULLIF(NEW.raw_user_meta_data->>'cccd','') ELSE cccd END
  WHERE id=NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_auth_dong_bo_ho_so AFTER UPDATE OF phone,raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION dong_bo_ho_so_auth();

CREATE OR REPLACE FUNCTION bao_ve_xoa_nguoi_thue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ref record; used boolean;
BEGIN
  IF OLD.id IS NOT NULL THEN
    FOR ref IN SELECT c.conrelid::regclass AS tbl,a.attname AS col
      FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      WHERE c.contype='f' AND c.confrelid='public.nguoi_dung'::regclass
    LOOP
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE %I=$1)',ref.tbl,ref.col) INTO used USING OLD.id;
      IF used THEN RAISE EXCEPTION 'Không thể xóa người thuê đang có dữ liệu liên quan' USING ERRCODE='23503'; END IF;
    END LOOP;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_nguoi_thue_bao_ve_xoa BEFORE DELETE ON nguoi_dung
  FOR EACH ROW EXECUTE FUNCTION bao_ve_xoa_nguoi_thue();
REVOKE ALL ON FUNCTION dong_bo_ho_so_auth(),bao_ve_xoa_nguoi_thue() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION nguoi_thue_lap_hoa_don(
  p_hop_dong_id uuid, p_ky date, p_dien int, p_nuoc int,
  p_anh_dien text, p_anh_nuoc text, p_chup_dien timestamptz, p_chup_nuoc timestamptz
) RETURNS hoa_don LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c hop_dong; b hoa_don; v_dien int; v_nuoc int; v_prefix text;
BEGIN
  SELECT * INTO c FROM hop_dong WHERE id = p_hop_dong_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR vai_tro_hien_tai() IS DISTINCT FROM 'nguoi_thue'
     OR c.nguoi_thue_id <> auth.uid() OR c.trang_thai <> 'hieu_luc' THEN
    RAISE EXCEPTION 'Không có quyền lập hóa đơn cho hợp đồng này' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM phong_tro WHERE id = c.phong_id FOR UPDATE;
  SELECT * INTO b FROM hoa_don WHERE hop_dong_id=c.id AND ky=p_ky FOR UPDATE;
  IF b.id IS NOT NULL AND (NOT b.la_ban_nhap OR b.ghi_chu_kiem_tra IS NULL) THEN
    RAISE EXCEPTION 'Hóa đơn không có yêu cầu gửi lại chỉ số' USING ERRCODE='22023';
  END IF;
  IF b.id IS NULL AND p_ky IS DISTINCT FROM date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RAISE EXCEPTION 'Chỉ được ghi chỉ số cho kỳ hiện tại' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM phong_tro WHERE id = c.phong_id FOR UPDATE;
  IF b.id IS NULL AND EXISTS (SELECT 1 FROM chi_so_cong_to WHERE phong_id = c.phong_id AND ky = p_ky) THEN
    RAISE EXCEPTION 'Kỳ này đã được ghi chỉ số. Vui lòng liên hệ quản lý.' USING ERRCODE = '22023';
  END IF;
  SELECT chi_so_moi INTO v_dien FROM chi_so_cong_to WHERE phong_id = c.phong_id AND loai = 'dien' AND ky < p_ky ORDER BY ky DESC LIMIT 1;
  SELECT chi_so_moi INTO v_nuoc FROM chi_so_cong_to WHERE phong_id = c.phong_id AND loai = 'nuoc' AND ky < p_ky ORDER BY ky DESC LIMIT 1;
  IF v_dien IS NULL OR v_nuoc IS NULL THEN
    RAISE EXCEPTION 'Quản lý cần thiết lập chỉ số kỳ trước của cả hai công tơ' USING ERRCODE = '22023';
  END IF;
  IF p_dien IS NULL OR p_nuoc IS NULL OR p_dien < v_dien OR p_nuoc < v_nuoc THEN
    RAISE EXCEPTION 'Chỉ số mới không được nhỏ hơn chỉ số kỳ trước' USING ERRCODE = '22023';
  END IF;
  v_prefix := c.phong_id::text || '/' || auth.uid()::text || '/';
  IF p_anh_dien IS NULL OR p_anh_nuoc IS NULL OR p_anh_dien = p_anh_nuoc
     OR left(p_anh_dien, length(v_prefix)) <> v_prefix OR left(p_anh_nuoc, length(v_prefix)) <> v_prefix
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'anh-cong-to' AND name = p_anh_dien)
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'anh-cong-to' AND name = p_anh_nuoc) THEN
    RAISE EXCEPTION 'Cần tải đủ ảnh điện và nước của phòng đang thuê' USING ERRCODE = '22023';
  END IF;
  IF p_chup_dien IS NULL OR p_chup_nuoc IS NULL
     OR p_chup_dien NOT BETWEEN now() - interval '24 hours' AND now() + interval '1 minute'
     OR p_chup_nuoc NOT BETWEEN now() - interval '24 hours' AND now() + interval '1 minute' THEN
    RAISE EXCEPTION 'Vui lòng chụp lại ảnh công tơ trong ngày' USING ERRCODE = '22023';
  END IF;
  IF b.id IS NOT NULL AND (
    p_chup_dien < b.cap_nhat_luc OR p_chup_nuoc < b.cap_nhat_luc OR
    EXISTS (SELECT 1 FROM chi_so_cong_to WHERE phong_id=c.phong_id AND ky=p_ky AND duong_dan_anh IN (p_anh_dien,p_anh_nuoc))
  ) THEN RAISE EXCEPTION 'Phải chụp mới cả hai ảnh sau yêu cầu kiểm tra lại' USING ERRCODE='22023'; END IF;
  INSERT INTO chi_so_cong_to(phong_id, loai, ky, chi_so_cu, chi_so_moi, duong_dan_anh, chup_luc, nguoi_ghi_id) VALUES
    (c.phong_id, 'dien', p_ky, v_dien, p_dien, p_anh_dien, p_chup_dien, auth.uid()),
    (c.phong_id, 'nuoc', p_ky, v_nuoc, p_nuoc, p_anh_nuoc, p_chup_nuoc, auth.uid())
  ON CONFLICT (phong_id,loai,ky) DO UPDATE SET chi_so_moi=EXCLUDED.chi_so_moi,
    duong_dan_anh=EXCLUDED.duong_dan_anh,chup_luc=EXCLUDED.chup_luc,nguoi_ghi_id=EXCLUDED.nguoi_ghi_id;
  b := tao_hoa_don_noi_bo(c.id, p_ky);
  UPDATE hoa_don SET ghi_chu_kiem_tra=NULL,ly_do_dieu_chinh=CASE WHEN ghi_chu_kiem_tra IS NOT NULL THEN 'Người thuê gửi lại chỉ số và ảnh công tơ' ELSE NULL END WHERE id=b.id RETURNING * INTO b;

  PERFORM gui_thong_bao(ds_nhan_su_khu_tro((SELECT khu_tro_id FROM phong_tro WHERE id = c.phong_id)),
    'thanh_toan', 'Người thuê đã ghi chỉ số công tơ', 'Hóa đơn kỳ ' || b.thang_nam || ' đang chờ kiểm tra chỉ số.',
    '/billing/' || b.id, jsonb_build_object('hoa_don_id', b.id));
  RETURN b;
END $$;
REVOKE ALL ON FUNCTION nguoi_thue_lap_hoa_don(uuid,date,int,int,text,text,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION nguoi_thue_lap_hoa_don(uuid,date,int,int,text,text,timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION dat_don_gia(p_loai text,p_id uuid,p_tu_ky date,p_gia numeric,p_ly_do text) RETURNS lich_don_gia
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v lich_don_gia;
BEGIN
 IF COALESCE(vai_tro_hien_tai(),'') NOT IN ('chu_tro','quan_tri') THEN RAISE EXCEPTION 'Chỉ chủ trọ và quản trị được đặt đơn giá' USING ERRCODE='42501'; END IF;
 IF p_tu_ky IS NULL OR p_tu_ky <> date_trunc('month',p_tu_ky)::date OR p_tu_ky < (date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')+interval '1 month')::date THEN RAISE EXCEPTION 'Giá mới áp dụng từ kỳ tháng sau trở đi' USING ERRCODE='22023'; END IF;
 IF p_gia IS NULL OR p_gia < 0 OR p_gia > 9999999999 OR NULLIF(btrim(p_ly_do),'') IS NULL THEN RAISE EXCEPTION 'Đơn giá hoặc lý do không hợp lệ' USING ERRCODE='22023'; END IF;
 IF NOT ((p_loai IN ('dien','nuoc') AND EXISTS(SELECT 1 FROM khu_tro WHERE id=p_id)) OR (p_loai='phong' AND EXISTS(SELECT 1 FROM phong_tro WHERE id=p_id)) OR (p_loai='dich_vu' AND EXISTS(SELECT 1 FROM phi_dich_vu WHERE id=p_id))) THEN RAISE EXCEPTION 'Đối tượng áp dụng không hợp lệ' USING ERRCODE='22023'; END IF;
 INSERT INTO lich_don_gia(loai,doi_tuong_id,tu_ky,don_gia,ly_do,nguoi_tao_id) VALUES(p_loai,p_id,p_tu_ky,p_gia,btrim(p_ly_do),auth.uid()) RETURNING * INTO v;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION dat_don_gia(text,uuid,date,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dat_don_gia(text,uuid,date,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION gia_hop_dong(p_id uuid,p_ky date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c hop_dong; r phong_tro; k khu_tro;
BEGIN
 SELECT * INTO c FROM hop_dong WHERE id=p_id;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT (c.nguoi_thue_id=auth.uid() OR la_nhan_su_phong(c.phong_id)) THEN RAISE EXCEPTION 'Không có quyền xem giá hợp đồng' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM phong_tro WHERE id=c.phong_id;
 SELECT * INTO k FROM khu_tro WHERE id=r.khu_tro_id;
 RETURN jsonb_build_object('rent',gia_theo_ky('phong',r.id,p_ky,c.gia_thue),'electricityRate',gia_theo_ky('dien',k.id,p_ky,k.don_gia_dien),'waterRate',gia_theo_ky('nuoc',k.id,p_ky,k.don_gia_nuoc));
END $$;
REVOKE ALL ON FUNCTION gia_hop_dong(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gia_hop_dong(uuid,date) TO authenticated;

CREATE OR REPLACE FUNCTION kiem_tra_hoa_don(p_id uuid,p_dien int,p_nuoc int,p_ly_do text,p_duyet boolean) RETURNS hoa_don
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b hoa_don; de numeric; dn numeric;
BEGIN
 SELECT * INTO b FROM hoa_don WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT la_nhan_su_phong(b.phong_id) THEN RAISE EXCEPTION 'Không có quyền kiểm tra hóa đơn' USING ERRCODE='42501'; END IF;
 IF NOT b.la_ban_nhap THEN RAISE EXCEPTION 'Hóa đơn đã phát hành, không thể sửa' USING ERRCODE='22023'; END IF;
 IF p_duyet AND b.ghi_chu_kiem_tra IS NOT NULL THEN RAISE EXCEPTION 'Cần người thuê nhập và chụp lại công tơ trước khi duyệt' USING ERRCODE='22023'; END IF;
 IF p_dien IS NULL OR p_nuoc IS NULL OR p_dien < b.chi_so_dien_cu OR p_nuoc < b.chi_so_nuoc_cu OR p_duyet IS NULL THEN RAISE EXCEPTION 'Chỉ số không hợp lệ' USING ERRCODE='22023'; END IF;
 IF (NOT p_duyet OR p_dien<>b.chi_so_dien_moi OR p_nuoc<>b.chi_so_nuoc_moi) AND NULLIF(btrim(p_ly_do),'') IS NULL THEN RAISE EXCEPTION 'Cần lý do khi từ chối hoặc điều chỉnh' USING ERRCODE='22023'; END IF;
 SELECT don_gia INTO de FROM chi_tiet_hoa_don WHERE hoa_don_id=b.id AND dien_giai LIKE 'Tiền điện%' LIMIT 1;
 SELECT don_gia INTO dn FROM chi_tiet_hoa_don WHERE hoa_don_id=b.id AND dien_giai LIKE 'Tiền nước%' LIMIT 1;
 IF de IS NULL OR dn IS NULL THEN RAISE EXCEPTION 'Thiếu đơn giá lưu trên hóa đơn' USING ERRCODE='22023'; END IF;
 IF p_dien<>b.chi_so_dien_moi OR p_nuoc<>b.chi_so_nuoc_moi THEN
  UPDATE chi_so_cong_to SET chi_so_moi=CASE loai WHEN 'dien' THEN p_dien ELSE p_nuoc END WHERE phong_id=b.phong_id AND ky=b.ky;
  UPDATE chi_tiet_hoa_don SET so_luong=p_dien-b.chi_so_dien_cu,so_tien=round((p_dien-b.chi_so_dien_cu)*de),dien_giai='Tiền điện ('||(p_dien-b.chi_so_dien_cu)||' kWh)' WHERE hoa_don_id=b.id AND dien_giai LIKE 'Tiền điện%';
  UPDATE chi_tiet_hoa_don SET so_luong=p_nuoc-b.chi_so_nuoc_cu,so_tien=round((p_nuoc-b.chi_so_nuoc_cu)*dn),dien_giai='Tiền nước ('||(p_nuoc-b.chi_so_nuoc_cu)||' m³)' WHERE hoa_don_id=b.id AND dien_giai LIKE 'Tiền nước%';
 END IF;
 UPDATE hoa_don SET chi_so_dien_moi=p_dien,chi_so_nuoc_moi=p_nuoc,tien_dien=round((p_dien-b.chi_so_dien_cu)*de),tien_nuoc=round((p_nuoc-b.chi_so_nuoc_cu)*dn),
 tong_tien=tien_phong+tien_dich_vu+round((p_dien-b.chi_so_dien_cu)*de)+round((p_nuoc-b.chi_so_nuoc_cu)*dn),
 ghi_chu_kiem_tra=CASE WHEN p_duyet THEN NULL ELSE btrim(p_ly_do) END,ly_do_dieu_chinh=NULLIF(btrim(p_ly_do),'') WHERE id=b.id RETURNING * INTO b;
 IF p_duyet THEN RETURN phat_hanh_hoa_don(b.id); END IF;
 PERFORM gui_thong_bao(ARRAY[(SELECT nguoi_thue_id FROM hop_dong WHERE id=b.hop_dong_id)],'thanh_toan','Cần kiểm tra lại chỉ số',p_ly_do,'/billing/'||b.id);
 RETURN b;
END $$;
REVOKE ALL ON FUNCTION kiem_tra_hoa_don(uuid,int,int,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION kiem_tra_hoa_don(uuid,int,int,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION bao_ve_hoa_don_phat_hanh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT OLD.la_ban_nhap THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Không được xóa hóa đơn đã phát hành' USING ERRCODE='42501'; END IF;
  IF (to_jsonb(NEW)-ARRAY['trang_thai_thanh_toan','thanh_toan_luc','cap_nhat_luc','ma_thanh_toan']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['trang_thai_thanh_toan','thanh_toan_luc','cap_nhat_luc','ma_thanh_toan']) THEN RAISE EXCEPTION 'Không được đổi số tiền hoặc thông tin hóa đơn đã phát hành' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_hoa_don_khoa BEFORE UPDATE OR DELETE ON hoa_don FOR EACH ROW EXECUTE FUNCTION bao_ve_hoa_don_phat_hanh();
CREATE OR REPLACE FUNCTION ghi_nhat_ky_hoa_don() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
 INSERT INTO nhat_ky_hoa_don(hoa_don_id,nguoi_sua_id,ly_do,truoc,sau) VALUES(NEW.id,auth.uid(),NEW.ly_do_dieu_chinh,to_jsonb(OLD),to_jsonb(NEW));
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_hoa_don_nhat_ky AFTER UPDATE ON hoa_don FOR EACH ROW EXECUTE FUNCTION ghi_nhat_ky_hoa_don();

CREATE OR REPLACE FUNCTION khoa_chi_tiet_da_phat_hanh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 v_id := CASE WHEN TG_OP='INSERT' THEN NEW.hoa_don_id ELSE OLD.hoa_don_id END;
 IF EXISTS(SELECT 1 FROM hoa_don WHERE id=v_id AND NOT la_ban_nhap)
 OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM hoa_don WHERE id=NEW.hoa_don_id AND NOT la_ban_nhap)) THEN
 RAISE EXCEPTION 'Không được thay đổi chi tiết hóa đơn đã phát hành' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_chi_tiet_khoa BEFORE INSERT OR UPDATE OR DELETE ON chi_tiet_hoa_don FOR EACH ROW EXECUTE FUNCTION khoa_chi_tiet_da_phat_hanh();
CREATE OR REPLACE FUNCTION gia_goc_bao_ve() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND (
   (TG_TABLE_NAME='khu_tro' AND ((to_jsonb(NEW)->'don_gia_dien') IS DISTINCT FROM (to_jsonb(OLD)->'don_gia_dien') OR (to_jsonb(NEW)->'don_gia_nuoc') IS DISTINCT FROM (to_jsonb(OLD)->'don_gia_nuoc')))
   OR (TG_TABLE_NAME='hop_dong' AND NEW IS DISTINCT FROM OLD AND (to_jsonb(NEW)->'gia_thue') IS DISTINCT FROM (to_jsonb(OLD)->'gia_thue'))
   OR (TG_TABLE_NAME='phong_tro' AND (to_jsonb(NEW)->'gia_thue_co_ban') IS DISTINCT FROM (to_jsonb(OLD)->'gia_thue_co_ban'))
   OR (TG_TABLE_NAME='phi_dich_vu' AND (to_jsonb(NEW)->'so_tien') IS DISTINCT FROM (to_jsonb(OLD)->'so_tien'))
 ) THEN RAISE EXCEPTION 'Dùng lịch đơn giá để thay đổi giá từ kỳ sau' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_gia_khu BEFORE UPDATE ON khu_tro FOR EACH ROW EXECUTE FUNCTION gia_goc_bao_ve();
CREATE TRIGGER trg_gia_phong BEFORE UPDATE ON phong_tro FOR EACH ROW EXECUTE FUNCTION gia_goc_bao_ve();
CREATE TRIGGER trg_gia_hop_dong BEFORE UPDATE ON hop_dong FOR EACH ROW EXECUTE FUNCTION gia_goc_bao_ve();
CREATE TRIGGER trg_gia_dich_vu BEFORE UPDATE ON phi_dich_vu FOR EACH ROW EXECUTE FUNCTION gia_goc_bao_ve();
