-- Migration 006: quản lý xử lý sự cố trong khu được phân công.
-- Áp dụng sau 001–005; giữ nguyên giá trị hoan_tat để tương thích dữ liệu cũ.
-- Gồm 2 phần: A. quy trình xử lý sự cố; B. vá phân quyền và đối soát thanh toán (cuối file).
-- Gồm cả: đường dẫn thông báo khớp route frontend (/issues/<id>, /notifications),
-- báo chủ trọ/quản lý khi có sự cố mới và khi đổi trạng thái, quy tắc ghi chú rõ ràng
-- (NULL = giữ ghi chú nếu không đổi trạng thái, rỗng = xóa). An toàn khi chạy lại.
BEGIN;

-- Sửa đường dẫn của thông báo đã tạo trước đó (nếu có)
UPDATE public.thong_bao SET duong_dan = '/issues/' || substr(duong_dan, length('/su_co/') + 1)
 WHERE duong_dan LIKE '/su_co/%';
UPDATE public.thong_bao SET duong_dan = '/notifications' WHERE duong_dan = '/thong_bao';

-- Thông báo chung dùng đường dẫn /notifications
CREATE OR REPLACE FUNCTION public.gui_thong_bao_chung(
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

  PERFORM gui_thong_bao(v_users, 'thong_bao_chung', p_tieu_de, p_noi_dung, '/notifications',
                       jsonb_build_object('thong_bao_chung_id', v_ann.id));
  RETURN v_ann;
END $$;

ALTER TABLE public.su_co ADD COLUMN IF NOT EXISTS ghi_chu_xu_ly TEXT;
ALTER TABLE public.su_co DROP CONSTRAINT IF EXISTS su_co_trang_thai_check;
ALTER TABLE public.su_co ADD CONSTRAINT su_co_trang_thai_check
  CHECK (trang_thai IN ('cho_tiep_nhan', 'dang_xu_ly', 'chua_the_xu_ly', 'hoan_tat', 'da_huy'));
ALTER TABLE public.su_co DROP CONSTRAINT IF EXISTS su_co_chua_the_xu_ly_ly_do_check;
ALTER TABLE public.su_co ADD CONSTRAINT su_co_chua_the_xu_ly_ly_do_check
  CHECK (trang_thai <> 'chua_the_xu_ly' OR NULLIF(btrim(ghi_chu_xu_ly, E' \t\n\r\f'), '') IS NOT NULL);

-- Không suy diễn chi phí của các lần cập nhật cũ: để NULL nếu trước đây chưa lưu.
ALTER TABLE public.lich_su_su_co ADD COLUMN IF NOT EXISTS chi_phi_sua_chua DECIMAL(12, 2);

-- Bảo vệ ghi chú/chi phí/thời điểm hoàn tất cả khi INSERT lẫn UPDATE trực tiếp.
-- RLS 004 tiếp tục giới hạn nhân sự theo khu và chỉ cho người thuê hủy báo cáo
-- của mình khi còn chờ tiếp nhận.
CREATE OR REPLACE FUNCTION public.su_co_bao_ve_cot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phong_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN v_phong_id := NEW.phong_id;
  ELSE v_phong_id := OLD.phong_id;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.la_nhan_su_phong(v_phong_id) THEN
    IF TG_OP = 'INSERT' THEN
      IF COALESCE(NEW.chi_phi_sua_chua, 0) <> 0
         OR NULLIF(btrim(NEW.ghi_chu_xu_ly, E' \t\n\r\f'), '') IS NOT NULL
         OR NEW.hoan_tat_luc IS NOT NULL THEN
        RAISE EXCEPTION 'Người thuê không được ghi chi phí, ghi chú xử lý hoặc thời điểm hoàn tất'
          USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.chi_phi_sua_chua IS DISTINCT FROM OLD.chi_phi_sua_chua
       OR NEW.ghi_chu_xu_ly IS DISTINCT FROM OLD.ghi_chu_xu_ly
       OR NEW.hoan_tat_luc IS DISTINCT FROM OLD.hoan_tat_luc
       OR NEW.phong_id IS DISTINCT FROM OLD.phong_id
       OR NEW.nguoi_thue_id IS DISTINCT FROM OLD.nguoi_thue_id
       OR NEW.phan_loai IS DISTINCT FROM OLD.phan_loai THEN
      RAISE EXCEPTION 'Người thuê không được sửa thông tin xử lý, chi phí hoặc phòng của sự cố'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_su_co_protect ON public.su_co;
CREATE TRIGGER trg_su_co_protect BEFORE INSERT OR UPDATE ON public.su_co
  FOR EACH ROW EXECUTE FUNCTION public.su_co_bao_ve_cot();

CREATE OR REPLACE FUNCTION public.su_co_truoc_khi_ghi() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.ghi_chu_xu_ly := NULLIF(btrim(NEW.ghi_chu_xu_ly, E' \t\n\r\f'), '');
  IF TG_OP = 'INSERT' THEN
    IF NEW.nguoi_thue_id IS NULL THEN NEW.nguoi_thue_id := auth.uid(); END IF;
    NEW.hoan_tat_luc := CASE WHEN NEW.trang_thai = 'hoan_tat' THEN NOW() ELSE NULL END;
  ELSIF NEW.trang_thai = 'hoan_tat' THEN
    IF OLD.trang_thai IS DISTINCT FROM 'hoan_tat' THEN NEW.hoan_tat_luc := NOW();
    ELSE NEW.hoan_tat_luc := OLD.hoan_tat_luc;
    END IF;
  ELSE
    NEW.hoan_tat_luc := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.su_co_sau_khi_ghi() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r phong_tro; v_label text; v_noi_dung text;
BEGIN
  SELECT * INTO r FROM phong_tro WHERE id = NEW.phong_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lich_su_su_co
      (su_co_id, tu_trang_thai, den_trang_thai, ghi_chu, chi_phi_sua_chua, nguoi_thuc_hien_id)
    VALUES (NEW.id, NULL, NEW.trang_thai, NEW.ghi_chu_xu_ly, NEW.chi_phi_sua_chua, auth.uid());
    -- Không báo lại cho chính người vừa tạo báo cáo (vd quản lý tự báo)
    PERFORM gui_thong_bao(array_remove(ds_nhan_su_khu_tro(r.khu_tro_id), auth.uid()), 'su_co',
      'Phòng ' || r.so_phong || ' báo sự cố', NEW.tieu_de,
      '/issues/' || NEW.id, jsonb_build_object('su_co_id', NEW.id));
  ELSE
    IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai
       OR NEW.ghi_chu_xu_ly IS DISTINCT FROM OLD.ghi_chu_xu_ly
       OR NEW.chi_phi_sua_chua IS DISTINCT FROM OLD.chi_phi_sua_chua THEN
      INSERT INTO lich_su_su_co
        (su_co_id, tu_trang_thai, den_trang_thai, ghi_chu, chi_phi_sua_chua, nguoi_thuc_hien_id)
      VALUES (NEW.id, OLD.trang_thai, NEW.trang_thai, NEW.ghi_chu_xu_ly, NEW.chi_phi_sua_chua, auth.uid());
    END IF;

    -- Ghi chú/chi phí thay đổi vẫn có lịch sử; chỉ đổi trạng thái mới gửi thông báo.
    IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai THEN
      v_label := CASE NEW.trang_thai
        WHEN 'cho_tiep_nhan' THEN 'Chờ tiếp nhận'
        WHEN 'dang_xu_ly' THEN 'Đang xử lý'
        WHEN 'chua_the_xu_ly' THEN 'Chưa thể xử lý'
        WHEN 'hoan_tat' THEN 'Đã xử lý'
        WHEN 'da_huy' THEN 'Đã hủy'
      END;
      v_noi_dung := NEW.tieu_de || CASE WHEN NEW.ghi_chu_xu_ly IS NULL THEN ''
                                       ELSE E'\n' || NEW.ghi_chu_xu_ly END;
      -- Mỗi người chỉ nhận 1 thông báo và không tự nhận thông báo của chính mình:
      -- người báo cáo nhận bản "Sự cố: ..."; nhân sự khu (trừ người báo cáo và người vừa
      -- thao tác) nhận bản "Phòng ... - sự cố: ...".
      IF NEW.nguoi_thue_id IS NOT NULL AND NEW.nguoi_thue_id IS DISTINCT FROM auth.uid() THEN
        PERFORM gui_thong_bao(ARRAY[NEW.nguoi_thue_id], 'su_co', 'Sự cố: ' || v_label, v_noi_dung,
          '/issues/' || NEW.id,
          jsonb_build_object('su_co_id', NEW.id, 'trang_thai', NEW.trang_thai));
      END IF;
      PERFORM gui_thong_bao(
        array_remove(array_remove(ds_nhan_su_khu_tro(r.khu_tro_id), auth.uid()), NEW.nguoi_thue_id),
        'su_co', 'Phòng ' || r.so_phong || ' - sự cố: ' || v_label, v_noi_dung,
        '/issues/' || NEW.id,
        jsonb_build_object('su_co_id', NEW.id, 'trang_thai', NEW.trang_thai));
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- API cho màn hình xử lý sự cố. SECURITY INVOKER: vẫn chịu RLS 004.
-- Chủ trọ/quản trị có quyền giám sát và can thiệp theo phạm vi hiện có.
CREATE OR REPLACE FUNCTION public.cap_nhat_xu_ly_su_co(
  p_su_co_id uuid,
  p_trang_thai text,
  p_ghi_chu_xu_ly text DEFAULT NULL,
  p_chi_phi_sua_chua numeric DEFAULT NULL
) RETURNS public.su_co
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_su_co public.su_co; v_ghi_chu text;
BEGIN
  SELECT * INTO v_su_co FROM public.su_co WHERE id = p_su_co_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.la_nhan_su_phong(v_su_co.phong_id) THEN
    RAISE EXCEPTION 'Không có quyền xử lý sự cố này' USING ERRCODE = '42501';
  END IF;
  IF p_trang_thai IS NULL OR p_trang_thai NOT IN ('dang_xu_ly', 'chua_the_xu_ly', 'hoan_tat', 'da_huy') THEN
    RAISE EXCEPTION 'Trạng thái xử lý không hợp lệ' USING ERRCODE = '22023';
  END IF;
  IF p_chi_phi_sua_chua IS NOT NULL AND p_chi_phi_sua_chua < 0 THEN
    RAISE EXCEPTION 'Chi phí sửa chữa không được âm' USING ERRCODE = '22023';
  END IF;
  -- Tính ghi chú sẽ lưu trước, rồi mới kiểm tra lý do: chỉ sửa chi phí khi đang
  -- "Chưa thể xử lý" thì lý do cũ được giữ nên không bắt nhập lại.
  v_ghi_chu := CASE
    WHEN p_ghi_chu_xu_ly IS NOT NULL THEN NULLIF(btrim(p_ghi_chu_xu_ly, E' \t\n\r\f'), '')
    WHEN p_trang_thai IS DISTINCT FROM v_su_co.trang_thai THEN NULL
    ELSE v_su_co.ghi_chu_xu_ly
  END;
  IF p_trang_thai = 'chua_the_xu_ly' AND v_ghi_chu IS NULL THEN
    RAISE EXCEPTION 'Phải ghi lý do chưa thể xử lý' USING ERRCODE = '22023';
  END IF;

  UPDATE public.su_co
     SET trang_thai = p_trang_thai,
         ghi_chu_xu_ly = v_ghi_chu,
         chi_phi_sua_chua = COALESCE(p_chi_phi_sua_chua, chi_phi_sua_chua)
   WHERE id = p_su_co_id
   RETURNING * INTO v_su_co;
  RETURN v_su_co;
END $$;

REVOKE ALL ON FUNCTION public.cap_nhat_xu_ly_su_co(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cap_nhat_xu_ly_su_co(uuid, text, text, numeric) TO authenticated;

-- Sự cố chưa thể xử lý vẫn đang mở: tính trong dashboard và cảnh báo của phòng.
CREATE OR REPLACE FUNCTION public.tong_quan_dashboard(p_khu_tro_id uuid, p_ky date DEFAULT NULL)
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
    'tong_so_phong', count(*),
    'phong_dang_thue', count(*) FILTER (WHERE trang_thai = 'dang_thue'),
    'phong_trong', count(*) FILTER (WHERE trang_thai = 'trong'),
    'phong_bao_tri', count(*) FILTER (WHERE trang_thai = 'bao_tri'),
    'ty_le_phong_trong', CASE WHEN count(*) = 0 THEN 0
      ELSE round(100.0 * count(*) FILTER (WHERE trang_thai = 'trong') / count(*), 1) END
  ) INTO v FROM phong_tro WHERE khu_tro_id = p_khu_tro_id;

  RETURN v || (
    SELECT jsonb_build_object(
      'tong_phat_hanh', COALESCE(sum(b.tong_tien), 0),
      'tong_da_thu', COALESCE(sum(b.tong_tien) FILTER (WHERE b.trang_thai_thanh_toan = 'da_thanh_toan'), 0),
      'tong_con_no', COALESCE(sum(b.tong_tien) FILTER (WHERE b.trang_thai_thanh_toan <> 'da_thanh_toan'), 0),
      'so_hoa_don_qua_han', count(*) FILTER (WHERE b.trang_thai_thanh_toan = 'qua_han'),
      'so_hoa_don_cho_xac_nhan', count(*) FILTER (WHERE b.trang_thai_thanh_toan = 'cho_xac_nhan'))
      FROM hoa_don b JOIN phong_tro r ON r.id = b.phong_id
     WHERE r.khu_tro_id = p_khu_tro_id AND b.thang_nam = v_my AND NOT b.la_ban_nhap
  ) || (
    SELECT jsonb_build_object('so_su_co_dang_mo', count(*))
      FROM su_co i JOIN phong_tro r ON r.id = i.phong_id
     WHERE r.khu_tro_id = p_khu_tro_id
       AND i.trang_thai IN ('cho_tiep_nhan', 'dang_xu_ly', 'chua_the_xu_ly')
  );
END $$;

CREATE OR REPLACE VIEW public.tong_quan_phong WITH (security_invoker = true) AS
SELECT r.*,
       c.id AS hop_dong_id,
       c.nguoi_thue_id AS nguoi_thue_hien_tai_id,
       u.ho_ten AS ten_nguoi_thue,
       u.so_dien_thoai AS sdt_nguoi_thue,
       EXISTS (SELECT 1 FROM hoa_don b WHERE b.phong_id = r.id AND b.trang_thai_thanh_toan = 'qua_han' AND NOT b.la_ban_nhap) AS co_no_qua_han,
       (SELECT count(*) FROM su_co i WHERE i.phong_id = r.id
         AND i.trang_thai IN ('cho_tiep_nhan', 'dang_xu_ly', 'chua_the_xu_ly')) AS so_su_co_dang_mo,
       CASE
         WHEN r.trang_thai = 'bao_tri' THEN 'bao_tri'
         WHEN r.trang_thai = 'trong' THEN 'trong'
         WHEN EXISTS (SELECT 1 FROM hoa_don b WHERE b.phong_id = r.id AND b.trang_thai_thanh_toan = 'qua_han' AND NOT b.la_ban_nhap) THEN 'no_tien'
         WHEN EXISTS (SELECT 1 FROM su_co i WHERE i.phong_id = r.id
                       AND i.trang_thai IN ('cho_tiep_nhan', 'dang_xu_ly', 'chua_the_xu_ly')) THEN 'co_su_co'
         ELSE 'dang_thue'
       END AS trang_thai_hien_thi
  FROM phong_tro r
  LEFT JOIN hop_dong c ON c.phong_id = r.id AND c.trang_thai = 'hieu_luc'
  LEFT JOIN nguoi_dung u ON u.id = c.nguoi_thue_id;

COMMENT ON COLUMN public.su_co.trang_thai IS
  'cho_tiep_nhan | dang_xu_ly | chua_the_xu_ly | hoan_tat (Đã xử lý) | da_huy';
COMMENT ON COLUMN public.su_co.ghi_chu_xu_ly IS
  'Ghi chú của nhân sự xử lý; bắt buộc ghi lý do khi chưa thể xử lý. Mỗi lần cập nhật có lịch sử.';
COMMENT ON COLUMN public.lich_su_su_co.chi_phi_sua_chua IS
  'Chi phí tại thời điểm cập nhật; NULL với lịch sử cũ chưa lưu chi phí.';
COMMENT ON TABLE public.lich_su_su_co IS
  'Lịch sử trạng thái, ghi chú và chi phí sự cố; trigger tự lưu người cập nhật và thời gian.';
COMMENT ON FUNCTION public.cap_nhat_xu_ly_su_co(uuid, text, text, numeric) IS
  'Nhân sự cập nhật trạng thái, ghi chú, chi phí sự cố trong khu có quyền. Ghi chú NULL = giữ cũ (nếu không đổi trạng thái), rỗng = xóa. Tự ghi lịch sử và thông báo.';


-- ---------------------------------------------------------------------
-- 1. Bảo vệ cột nhạy cảm của nguoi_dung (an toàn với NULL)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nguoi_dung_bao_ve_cot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND COALESCE(public.vai_tro_hien_tai(), '') <> 'quan_tri'
     AND (NEW.vai_tro IS DISTINCT FROM OLD.vai_tro OR NEW.dang_hoat_dong IS DISTINCT FROM OLD.dang_hoat_dong
          OR NEW.so_dien_thoai IS DISTINCT FROM OLD.so_dien_thoai) THEN
    RAISE EXCEPTION 'Không được tự đổi vai trò/trạng thái/số điện thoại' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- 2. Chỉ quản trị hoặc chủ trọ hiện tại được chuyển quyền chủ khu
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.khu_tro_bao_ve_chu_so_huu() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.chu_tro_id IS DISTINCT FROM OLD.chu_tro_id AND auth.uid() IS NOT NULL THEN
    IF NOT (COALESCE(public.vai_tro_hien_tai(), '') = 'quan_tri'
            OR (public.vai_tro_hien_tai() = 'chu_tro' AND OLD.chu_tro_id = auth.uid())) THEN
      RAISE EXCEPTION 'Chỉ quản trị hoặc chủ trọ hiện tại mới được đổi chủ khu trọ' USING ERRCODE = '42501';
    END IF;
    IF NEW.chu_tro_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.nguoi_dung WHERE id = NEW.chu_tro_id AND vai_tro = 'chu_tro' AND dang_hoat_dong) THEN
      RAISE EXCEPTION 'Chủ khu mới phải là tài khoản chủ trọ đang hoạt động' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_khu_tro_bao_ve_chu ON public.khu_tro;
CREATE TRIGGER trg_khu_tro_bao_ve_chu BEFORE UPDATE ON public.khu_tro
  FOR EACH ROW EXECUTE FUNCTION public.khu_tro_bao_ve_chu_so_huu();

-- ---------------------------------------------------------------------
-- 3. Đồng bộ trạng thái hóa đơn với các khoản thanh toán
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dong_bo_trang_thai_hoa_don(p_hoa_don_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.hoa_don; v_paid numeric; v_new text;
BEGIN
  SELECT * INTO b FROM public.hoa_don WHERE id = p_hoa_don_id FOR UPDATE;
  IF NOT FOUND OR b.la_ban_nhap THEN RETURN; END IF;

  SELECT COALESCE(SUM(so_tien), 0) INTO v_paid
    FROM public.thanh_toan WHERE hoa_don_id = b.id AND trang_thai = 'da_duyet';

  v_new := CASE
    WHEN v_paid >= b.tong_tien AND v_paid > 0 THEN 'da_thanh_toan'
    WHEN v_paid > 0 THEN 'thanh_toan_mot_phan'
    WHEN EXISTS (SELECT 1 FROM public.thanh_toan WHERE hoa_don_id = b.id AND trang_thai = 'cho_duyet') THEN 'cho_xac_nhan'
    WHEN b.han_thanh_toan < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN 'qua_han'
    ELSE 'chua_thanh_toan'
  END;

  IF v_new IS DISTINCT FROM b.trang_thai_thanh_toan
     OR (v_new = 'da_thanh_toan') IS DISTINCT FROM (b.thanh_toan_luc IS NOT NULL) THEN
    UPDATE public.hoa_don
       SET trang_thai_thanh_toan = v_new,
           thanh_toan_luc = CASE WHEN v_new = 'da_thanh_toan' THEN COALESCE(b.thanh_toan_luc, NOW()) ELSE NULL END
     WHERE id = b.id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.dong_bo_trang_thai_hoa_don(uuid) FROM PUBLIC, anon, authenticated;

-- Trước khi sửa: khóa các trường làm lệch số liệu, ghi nhận người/thời điểm duyệt
CREATE OR REPLACE FUNCTION public.thanh_toan_truoc_khi_sua() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tong numeric; v_khac numeric;
BEGIN
  IF NEW.hoa_don_id IS DISTINCT FROM OLD.hoa_don_id THEN
    RAISE EXCEPTION 'Không được chuyển khoản thanh toán sang hóa đơn khác' USING ERRCODE = '22023';
  END IF;
  IF NEW.so_tien IS DISTINCT FROM OLD.so_tien AND 'da_duyet' IN (OLD.trang_thai, NEW.trang_thai) THEN
    RAISE EXCEPTION 'Không được sửa số tiền của khoản đã duyệt; hãy hủy duyệt trước' USING ERRCODE = '22023';
  END IF;

  IF NEW.trang_thai = 'da_duyet' AND OLD.trang_thai <> 'da_duyet' THEN
    SELECT tong_tien INTO v_tong FROM public.hoa_don WHERE id = NEW.hoa_don_id FOR UPDATE;
    SELECT COALESCE(SUM(so_tien), 0) INTO v_khac FROM public.thanh_toan
     WHERE hoa_don_id = NEW.hoa_don_id AND trang_thai = 'da_duyet' AND id <> NEW.id;
    IF v_khac + NEW.so_tien > v_tong THEN
      RAISE EXCEPTION 'Tổng số tiền đã duyệt (%) vượt tổng hóa đơn (%)', v_khac + NEW.so_tien, v_tong
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai THEN
    IF NEW.trang_thai = 'cho_duyet' THEN
      NEW.nguoi_duyet_id := NULL; NEW.duyet_luc := NULL;
    ELSE
      NEW.nguoi_duyet_id := COALESCE(auth.uid(), NEW.nguoi_duyet_id);
      NEW.duyet_luc := NOW();
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Sau khi sửa BẤT KỲ cột nào hoặc xóa: tính lại trạng thái hóa đơn; thông báo khi đổi trạng thái khoản thanh toán
CREATE OR REPLACE FUNCTION public.thanh_toan_sau_khi_sua() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.hoa_don; v_tenant uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.dong_bo_trang_thai_hoa_don(OLD.hoa_don_id);
    RETURN OLD;
  END IF;

  PERFORM public.dong_bo_trang_thai_hoa_don(NEW.hoa_don_id);
  IF NEW.trang_thai = OLD.trang_thai THEN RETURN NEW; END IF;

  SELECT * INTO b FROM public.hoa_don WHERE id = NEW.hoa_don_id;
  SELECT nguoi_thue_id INTO v_tenant FROM public.hop_dong WHERE id = b.hop_dong_id;
  IF NEW.trang_thai = 'da_duyet' THEN
    PERFORM public.gui_thong_bao(ARRAY[v_tenant], 'thanh_toan', 'Đã xác nhận thanh toán',
      'Hóa đơn ' || b.thang_nam || ' đã được ghi nhận. Cảm ơn bạn!', '/billing/' || b.id,
      jsonb_build_object('hoa_don_id', b.id));
  ELSIF NEW.trang_thai = 'tu_choi' THEN
    PERFORM public.gui_thong_bao(ARRAY[v_tenant], 'thanh_toan', 'Biên lai chưa được chấp nhận',
      COALESCE(NULLIF(NEW.ly_do_tu_choi, ''), 'Vui lòng kiểm tra và gửi lại biên lai'),
      '/billing/' || b.id, jsonb_build_object('hoa_don_id', b.id));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_thanh_toan_sau_sua ON public.thanh_toan;
CREATE TRIGGER trg_thanh_toan_sau_sua AFTER UPDATE ON public.thanh_toan
  FOR EACH ROW EXECUTE FUNCTION public.thanh_toan_sau_khi_sua();
DROP TRIGGER IF EXISTS trg_thanh_toan_sau_xoa ON public.thanh_toan;
CREATE TRIGGER trg_thanh_toan_sau_xoa AFTER DELETE ON public.thanh_toan
  FOR EACH ROW EXECUTE FUNCTION public.thanh_toan_sau_khi_sua();

COMMIT;
