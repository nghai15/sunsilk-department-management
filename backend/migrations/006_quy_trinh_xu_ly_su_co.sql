-- Migration 006: quản lý xử lý sự cố trong khu được phân công.
-- Áp dụng sau 001–005; giữ nguyên giá trị hoan_tat để tương thích dữ liệu cũ.
BEGIN;

ALTER TABLE public.su_co ADD COLUMN IF NOT EXISTS ghi_chu_xu_ly TEXT;
ALTER TABLE public.su_co DROP CONSTRAINT IF EXISTS su_co_trang_thai_check;
ALTER TABLE public.su_co ADD CONSTRAINT su_co_trang_thai_check
  CHECK (trang_thai IN ('cho_tiep_nhan', 'dang_xu_ly', 'chua_the_xu_ly', 'hoan_tat', 'da_huy'));
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
    PERFORM gui_thong_bao(ds_nhan_su_khu_tro(r.khu_tro_id), 'su_co',
      'Phòng ' || r.so_phong || ' báo sự cố', NEW.tieu_de,
      '/su_co/' || NEW.id, jsonb_build_object('su_co_id', NEW.id));
  ELSE
    IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai
       OR NEW.ghi_chu_xu_ly IS DISTINCT FROM OLD.ghi_chu_xu_ly
       OR NEW.chi_phi_sua_chua IS DISTINCT FROM OLD.chi_phi_sua_chua THEN
      INSERT INTO lich_su_su_co
        (su_co_id, tu_trang_thai, den_trang_thai, ghi_chu, chi_phi_sua_chua, nguoi_thuc_hien_id)
      VALUES (NEW.id, OLD.trang_thai, NEW.trang_thai, NEW.ghi_chu_xu_ly, NEW.chi_phi_sua_chua, auth.uid());
    END IF;

    -- Ghi chú/chi phí thay đổi vẫn có lịch sử; chỉ đổi trạng thái mới gửi thông báo.
    IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai AND NEW.nguoi_thue_id IS NOT NULL THEN
      v_label := CASE NEW.trang_thai
        WHEN 'cho_tiep_nhan' THEN 'Chờ tiếp nhận'
        WHEN 'dang_xu_ly' THEN 'Đang xử lý'
        WHEN 'chua_the_xu_ly' THEN 'Chưa thể xử lý'
        WHEN 'hoan_tat' THEN 'Đã xử lý'
        WHEN 'da_huy' THEN 'Đã hủy'
      END;
      v_noi_dung := NEW.tieu_de || CASE WHEN NEW.ghi_chu_xu_ly IS NULL THEN ''
                                       ELSE E'\n' || NEW.ghi_chu_xu_ly END;
      PERFORM gui_thong_bao(ARRAY[NEW.nguoi_thue_id], 'su_co', 'Sự cố: ' || v_label, v_noi_dung,
        '/su_co/' || NEW.id,
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
DECLARE v_su_co public.su_co;
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
  IF p_trang_thai = 'chua_the_xu_ly' AND NULLIF(btrim(p_ghi_chu_xu_ly, E' \t\n\r\f'), '') IS NULL THEN
    RAISE EXCEPTION 'Phải ghi lý do chưa thể xử lý' USING ERRCODE = '22023';
  END IF;

  UPDATE public.su_co
     SET trang_thai = p_trang_thai,
         ghi_chu_xu_ly = NULLIF(btrim(p_ghi_chu_xu_ly, E' \t\n\r\f'), ''),
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
  'Nhân sự cập nhật trạng thái, ghi chú và chi phí sự cố trong khu có quyền; tự ghi lịch sử và thông báo.';

COMMIT;
