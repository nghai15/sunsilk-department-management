-- Quy trình xử lý sự cố và đối soát thanh toán.
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
CREATE OR REPLACE FUNCTION public.su_co_bao_ve_cot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phong_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN v_phong_id := NEW.phong_id;
  ELSE v_phong_id := OLD.phong_id;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.co_the_xu_ly_su_co(v_phong_id) THEN
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
    PERFORM gui_thong_bao(array_remove(ds_nguoi_xu_ly_su_co(r.khu_tro_id), auth.uid()), 'su_co',
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
        array_remove(array_remove(ds_nguoi_xu_ly_su_co(r.khu_tro_id), auth.uid()), NEW.nguoi_thue_id),
        'su_co', 'Phòng ' || r.so_phong || ' - sự cố: ' || v_label, v_noi_dung,
        '/issues/' || NEW.id,
        jsonb_build_object('su_co_id', NEW.id, 'trang_thai', NEW.trang_thai));
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- API cho màn hình xử lý sự cố. SECURITY INVOKER: vẫn chịu RLS 004.
-- Chủ trọ giám sát/can thiệp; quản trị chỉ xem.
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
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.co_the_xu_ly_su_co(v_su_co.phong_id) THEN
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
      'tong_da_thu', COALESCE(sum(COALESCE((SELECT sum(t.so_tien) FROM thanh_toan t WHERE t.hoa_don_id=b.id AND t.trang_thai='da_duyet'),0)), 0),
      'tong_con_no', COALESCE(sum(GREATEST(0,b.tong_tien-COALESCE((SELECT sum(t.so_tien) FROM thanh_toan t WHERE t.hoa_don_id=b.id AND t.trang_thai='da_duyet'),0))), 0),
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


-- 1. Chỉ chủ trọ được chuyển quyền chủ khu
CREATE OR REPLACE FUNCTION public.khu_tro_bao_ve_chu_so_huu() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.chu_tro_id IS DISTINCT FROM OLD.chu_tro_id AND auth.uid() IS NOT NULL THEN
    IF COALESCE(public.vai_tro_hien_tai(), '') <> 'chu_tro' THEN
      RAISE EXCEPTION 'Chỉ chủ trọ được chuyển quyền sở hữu khu' USING ERRCODE = '42501';
    END IF;
    IF NEW.chu_tro_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.nguoi_dung WHERE id = NEW.chu_tro_id AND vai_tro = 'chu_tro' AND dang_hoat_dong) THEN
      RAISE EXCEPTION 'Chủ khu mới phải là chủ trọ đang hoạt động' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_khu_tro_bao_ve_chu ON public.khu_tro;
CREATE TRIGGER trg_khu_tro_bao_ve_chu BEFORE UPDATE ON public.khu_tro
  FOR EACH ROW EXECUTE FUNCTION public.khu_tro_bao_ve_chu_so_huu();

-- 2. Đồng bộ trạng thái hóa đơn với các khoản thanh toán
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


-- SEPAY_AUTO_PAYMENT_BEGIN
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

ALTER TABLE public.khu_tro ADD COLUMN IF NOT EXISTS thanh_toan_tu_dong boolean NOT NULL DEFAULT false;
ALTER TABLE public.hoa_don ADD COLUMN IF NOT EXISTS ma_thanh_toan text
  GENERATED ALWAYS AS ('SS' || upper(replace(id::text, '-', ''))) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS hoa_don_ma_thanh_toan ON public.hoa_don(ma_thanh_toan);
CREATE TABLE IF NOT EXISTS public.giao_dich_ngan_hang (
  id bigint PRIMARY KEY,
  ma_bin text NOT NULL, tai_khoan text NOT NULL, noi_dung text NOT NULL,
  so_tien numeric(12,2) NOT NULL CHECK (so_tien > 0),
  hoa_don_id uuid REFERENCES public.hoa_don(id) ON DELETE RESTRICT,
  da_phan_bo numeric(12,2) NOT NULL DEFAULT 0 CHECK (da_phan_bo >= 0 AND da_phan_bo <= so_tien),
  trang_thai text NOT NULL DEFAULT 'can_doi_soat' CHECK (trang_thai IN ('can_doi_soat','da_khop','da_xu_ly')),
  ghi_chu text, nguoi_xu_ly uuid REFERENCES public.nguoi_dung(id),
  tao_luc timestamptz NOT NULL DEFAULT now(), xu_ly_luc timestamptz
);
ALTER TABLE public.giao_dich_ngan_hang ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.giao_dich_ngan_hang FROM anon, authenticated;
GRANT SELECT ON public.giao_dich_ngan_hang TO authenticated;
GRANT ALL ON public.giao_dich_ngan_hang TO service_role;
DROP POLICY IF EXISTS giao_dich_xem ON public.giao_dich_ngan_hang;
CREATE POLICY giao_dich_xem ON public.giao_dich_ngan_hang FOR SELECT TO authenticated
 USING (public.vai_tro_hien_tai() IN ('chu_tro','quan_tri'));
ALTER TABLE public.thanh_toan ADD COLUMN IF NOT EXISTS giao_dich_ngan_hang_id bigint UNIQUE
 REFERENCES public.giao_dich_ngan_hang(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.bao_ve_thanh_toan_tu_dong() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user = 'authenticated' AND
   (CASE WHEN TG_OP='INSERT' THEN NEW.giao_dich_ngan_hang_id IS NOT NULL
    WHEN TG_OP='DELETE' THEN OLD.giao_dich_ngan_hang_id IS NOT NULL
    ELSE OLD.giao_dich_ngan_hang_id IS NOT NULL OR NEW.giao_dich_ngan_hang_id IS NOT NULL END) THEN
  RAISE EXCEPTION 'Không được sửa giao dịch ngân hàng tự động' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bao_ve_thanh_toan_tu_dong ON public.thanh_toan;
CREATE TRIGGER trg_bao_ve_thanh_toan_tu_dong BEFORE INSERT OR UPDATE OR DELETE ON public.thanh_toan
 FOR EACH ROW EXECUTE FUNCTION public.bao_ve_thanh_toan_tu_dong();

CREATE OR REPLACE FUNCTION public.phan_bo_giao_dich(p_id bigint,p_ma text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g giao_dich_ngan_hang; b hoa_don; v_paid numeric; v_amount numeric; v_tenant uuid;
BEGIN
 SELECT * INTO g FROM giao_dich_ngan_hang WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR g.da_phan_bo>0 OR g.trang_thai='da_xu_ly' THEN RETURN; END IF;
 SELECT h.* INTO b FROM hoa_don h JOIN phong_tro r ON r.id=h.phong_id JOIN khu_tro k ON k.id=r.khu_tro_id
 WHERE h.ma_thanh_toan=upper(trim(p_ma)) AND NOT h.la_ban_nhap
 AND k.thanh_toan_tu_dong AND k.ma_bin_ngan_hang=g.ma_bin AND k.so_tai_khoan=g.tai_khoan FOR UPDATE OF h;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT coalesce(sum(so_tien),0) INTO v_paid FROM thanh_toan WHERE hoa_don_id=b.id AND trang_thai='da_duyet';
 v_amount:=least(g.so_tien,greatest(0,b.tong_tien-v_paid));
 UPDATE giao_dich_ngan_hang SET hoa_don_id=b.id,da_phan_bo=v_amount,
 trang_thai=CASE WHEN v_amount=g.so_tien THEN 'da_khop' ELSE 'can_doi_soat' END WHERE id=g.id;
 IF v_amount=0 THEN RETURN; END IF;
 SELECT nguoi_thue_id INTO v_tenant FROM hop_dong WHERE id=b.hop_dong_id;
 INSERT INTO thanh_toan(hoa_don_id,so_tien,trang_thai,duyet_luc,ma_giao_dich,ghi_chu,giao_dich_ngan_hang_id)
 VALUES(b.id,v_amount,'da_duyet',now(),'SEPAY-'||g.id,'Tự động xác nhận qua SePay',g.id);
 PERFORM dong_bo_trang_thai_hoa_don(b.id);
 PERFORM gui_thong_bao(ARRAY[v_tenant],'thanh_toan','Đã nhận tiền chuyển khoản',
 'Hóa đơn '||b.thang_nam||' đã ghi nhận '||v_amount||' đồng.','/billing/'||b.id,jsonb_build_object('hoa_don_id',b.id));
END $$;
REVOKE ALL ON FUNCTION public.phan_bo_giao_dich(bigint,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.nhan_giao_dich_sepay(p_id bigint,p_bin text,p_account text,p_content text,p_amount numeric,p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id bigint; g giao_dich_ngan_hang;
BEGIN
 IF p_id<=0 OR p_amount<=0 OR p_amount<>trunc(p_amount) OR p_amount>9999999999 THEN RAISE EXCEPTION 'Giao dịch không hợp lệ'; END IF;
 INSERT INTO giao_dich_ngan_hang(id,ma_bin,tai_khoan,noi_dung,so_tien)
 VALUES(p_id,p_bin,p_account,p_content,p_amount) ON CONFLICT(id) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN
  SELECT * INTO g FROM giao_dich_ngan_hang WHERE id=p_id;
  IF g.ma_bin<>p_bin OR g.tai_khoan<>p_account OR g.so_tien<>p_amount OR g.noi_dung<>p_content THEN
   RAISE EXCEPTION 'Mã giao dịch đã tồn tại với dữ liệu khác';
  END IF;
  RETURN jsonb_build_object('success',true,'duplicate',true);
 END IF;
 PERFORM phan_bo_giao_dich(p_id,p_code);
 RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION public.nhan_giao_dich_sepay(bigint,text,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_giao_dich_sepay(bigint,text,text,text,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.doi_soat_giao_dich(p_id bigint,p_ma text,p_ghi_chu text,p_dong boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g giao_dich_ngan_hang;
BEGIN
 IF auth.uid() IS NULL OR coalesce(vai_tro_hien_tai(),'') NOT IN ('chu_tro','quan_tri') THEN RAISE EXCEPTION 'Không có quyền đối soát' USING ERRCODE='42501'; END IF;
 IF nullif(trim(p_ghi_chu),'') IS NULL OR length(p_ghi_chu)>1000 THEN RAISE EXCEPTION 'Cần ghi rõ lý do xử lý'; END IF;
 SELECT * INTO g FROM giao_dich_ngan_hang WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR g.trang_thai<>'can_doi_soat' THEN RAISE EXCEPTION 'Giao dịch không còn chờ đối soát'; END IF;
 IF NOT p_dong THEN
  PERFORM phan_bo_giao_dich(p_id,p_ma);
  IF NOT EXISTS(SELECT 1 FROM giao_dich_ngan_hang WHERE id=p_id AND da_phan_bo>g.da_phan_bo) THEN RAISE EXCEPTION 'Không khớp hóa đơn hoặc đã phân bổ. Kiểm tra mã, ngân hàng và số còn nợ.'; END IF;
 END IF;
 UPDATE giao_dich_ngan_hang SET ghi_chu=trim(p_ghi_chu),nguoi_xu_ly=auth.uid(),xu_ly_luc=now(),
 trang_thai=CASE WHEN p_dong THEN 'da_xu_ly' ELSE trang_thai END WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.doi_soat_giao_dich(bigint,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.doi_soat_giao_dich(bigint,text,text,boolean) TO authenticated;
-- SEPAY_AUTO_PAYMENT_END

-- ISSUE_REPAIR_BILLING_BEGIN
ALTER TABLE public.su_co ADD COLUMN IF NOT EXISTS minh_chung_xu_ly text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.lich_su_su_co ADD COLUMN IF NOT EXISTS minh_chung_xu_ly text[] NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS public.phi_sua_chua (
 su_co_id uuid PRIMARY KEY REFERENCES public.su_co(id) ON DELETE CASCADE,
 hop_dong_id uuid NOT NULL REFERENCES public.hop_dong(id) ON DELETE RESTRICT,
 tu_ky date NOT NULL, so_tien numeric(12,2) NOT NULL CHECK (so_tien>0),
 dien_giai text NOT NULL, hoa_don_id uuid REFERENCES public.hoa_don(id) ON DELETE RESTRICT
);
ALTER TABLE public.phi_sua_chua ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phi_sua_chua FROM anon,authenticated;
GRANT SELECT ON public.phi_sua_chua TO authenticated;
DROP POLICY IF EXISTS phi_sua_chua_xem ON public.phi_sua_chua;
CREATE POLICY phi_sua_chua_xem ON public.phi_sua_chua FOR SELECT TO authenticated
 USING (la_nguoi_thue_hop_dong(hop_dong_id) OR la_nhan_su_hop_dong(hop_dong_id));
ALTER TABLE public.chi_tiet_hoa_don ADD COLUMN IF NOT EXISTS su_co_id uuid UNIQUE REFERENCES public.su_co(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.dong_bo_phi_sua_chua(p_bill uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b hoa_don; v_old numeric; v_new numeric;
BEGIN
 SELECT * INTO b FROM hoa_don WHERE id=p_bill FOR UPDATE;
 IF NOT FOUND OR NOT b.la_ban_nhap THEN RETURN; END IF;
 SELECT coalesce(sum(so_tien),0) INTO v_old FROM chi_tiet_hoa_don WHERE hoa_don_id=b.id AND su_co_id IS NOT NULL;
 DELETE FROM chi_tiet_hoa_don WHERE hoa_don_id=b.id AND su_co_id IS NOT NULL;
 UPDATE phi_sua_chua SET hoa_don_id=b.id WHERE hop_dong_id=b.hop_dong_id AND hoa_don_id IS NULL AND tu_ky<=b.ky;
 INSERT INTO chi_tiet_hoa_don(hoa_don_id,dien_giai,so_luong,don_gia,so_tien,su_co_id)
 SELECT b.id,left(dien_giai,150),1,so_tien,so_tien,su_co_id FROM phi_sua_chua WHERE hoa_don_id=b.id;
 SELECT coalesce(sum(so_tien),0) INTO v_new FROM phi_sua_chua WHERE hoa_don_id=b.id;
 UPDATE hoa_don SET tien_dich_vu=tien_dich_vu-v_old+v_new,phi_khac=phi_khac-v_old+v_new,
 tong_tien=tong_tien-v_old+v_new WHERE id=b.id;
END $$;
REVOKE ALL ON FUNCTION public.dong_bo_phi_sua_chua(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.kiem_tra_minh_chung_su_co() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_path text;
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM phi_sua_chua WHERE su_co_id=OLD.id) THEN RAISE EXCEPTION 'Sự cố có chi phí thu tiền, không được xóa' USING ERRCODE='42501'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM phi_sua_chua WHERE su_co_id=OLD.id) AND (NEW.phong_id IS DISTINCT FROM OLD.phong_id OR NEW.nguoi_thue_id IS DISTINCT FROM OLD.nguoi_thue_id) THEN RAISE EXCEPTION 'Không đổi người thuê hoặc phòng của khoản sửa chữa đã ghi nhận' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' THEN PERFORM 1 FROM hoa_don b JOIN phi_sua_chua f ON f.hoa_don_id=b.id WHERE f.su_co_id=OLD.id FOR UPDATE OF b; END IF;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM phi_sua_chua f JOIN hoa_don b ON b.id=f.hoa_don_id WHERE f.su_co_id=OLD.id AND NOT b.la_ban_nhap)
 AND (NEW.chi_phi_sua_chua IS DISTINCT FROM OLD.chi_phi_sua_chua OR NEW.trang_thai IS DISTINCT FROM OLD.trang_thai
 OR NEW.phong_id IS DISTINCT FROM OLD.phong_id OR NEW.nguoi_thue_id IS DISTINCT FROM OLD.nguoi_thue_id OR NEW.tieu_de IS DISTINCT FROM OLD.tieu_de
 OR NEW.minh_chung_xu_ly IS DISTINCT FROM OLD.minh_chung_xu_ly) THEN
  RAISE EXCEPTION 'Chi phí sửa chữa đã lên hóa đơn phát hành, không thể thay đổi. Hãy tạo báo cáo mới nếu sự cố tái diễn.' USING ERRCODE='42501';
 END IF;
 IF auth.uid() IS NOT NULL AND NOT coalesce(co_the_xu_ly_su_co(NEW.phong_id),false) THEN
  IF (TG_OP='INSERT' AND cardinality(NEW.minh_chung_xu_ly)>0) OR (TG_OP='UPDATE' AND NEW.minh_chung_xu_ly IS DISTINCT FROM OLD.minh_chung_xu_ly) THEN
   RAISE EXCEPTION 'Chỉ nhân sự xử lý được gửi minh chứng' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.trang_thai='hoan_tat' AND (TG_OP='INSERT' OR OLD.trang_thai IS DISTINCT FROM 'hoan_tat' OR NEW.minh_chung_xu_ly IS DISTINCT FROM OLD.minh_chung_xu_ly) AND cardinality(NEW.minh_chung_xu_ly)=0 THEN
  RAISE EXCEPTION 'Cần ít nhất một ảnh hoặc video chứng minh đã xử lý' USING ERRCODE='22023';
 END IF;
 IF cardinality(NEW.minh_chung_xu_ly)>5 OR (SELECT count(*) FROM unnest(NEW.minh_chung_xu_ly) p WHERE p ~* '\.(mp4|webm|mov)$')>1 THEN
  RAISE EXCEPTION 'Minh chứng tối đa 5 tệp và 1 video' USING ERRCODE='22023';
 END IF;
 IF TG_OP='INSERT' OR NEW.minh_chung_xu_ly IS DISTINCT FROM OLD.minh_chung_xu_ly THEN
  FOREACH v_path IN ARRAY NEW.minh_chung_xu_ly LOOP
   IF v_path IS NULL OR split_part(v_path,'/',1)<>NEW.phong_id::text OR split_part(v_path,'/',2)<>'xu-ly'
    OR split_part(v_path,'/',3)<>NEW.id::text OR v_path !~* '\.(jpg|jpeg|png|webp|mp4|webm|mov)$'
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='anh-su-co' AND name=v_path) THEN
    RAISE EXCEPTION 'Minh chứng không hợp lệ hoặc chưa tải lên' USING ERRCODE='22023';
   END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_su_co_minh_chung ON public.su_co;
CREATE TRIGGER trg_su_co_minh_chung BEFORE INSERT OR UPDATE OR DELETE ON public.su_co FOR EACH ROW EXECUTE FUNCTION public.kiem_tra_minh_chung_su_co();

CREATE OR REPLACE FUNCTION public.su_co_tinh_phi() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f phi_sua_chua; v_contract uuid; v_bill uuid; v_ky date;
BEGIN
 IF TG_OP='UPDATE' AND NEW.trang_thai IS NOT DISTINCT FROM OLD.trang_thai AND NEW.chi_phi_sua_chua IS NOT DISTINCT FROM OLD.chi_phi_sua_chua THEN RETURN NEW; END IF;
 SELECT * INTO f FROM phi_sua_chua WHERE su_co_id=NEW.id;
 IF NEW.trang_thai='hoan_tat' AND NEW.chi_phi_sua_chua>0 THEN
  v_contract:=f.hop_dong_id;
  IF v_contract IS NULL THEN
   SELECT id INTO v_contract FROM hop_dong WHERE phong_id=NEW.phong_id AND nguoi_thue_id=NEW.nguoi_thue_id
    AND ngay_bat_dau <= (NEW.tao_luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    AND (ngay_ket_thuc IS NULL OR ngay_ket_thuc >= (NEW.tao_luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
    ORDER BY ngay_bat_dau DESC LIMIT 1;
  END IF;
  IF v_contract IS NULL THEN RAISE EXCEPTION 'Không xác định được hợp đồng người báo sự cố để thu chi phí'; END IF;
  PERFORM 1 FROM hop_dong WHERE id=v_contract FOR UPDATE;
  v_ky:=coalesce(f.tu_ky,date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
  INSERT INTO phi_sua_chua(su_co_id,hop_dong_id,tu_ky,so_tien,dien_giai)
  VALUES(NEW.id,v_contract,v_ky,NEW.chi_phi_sua_chua,'Sửa chữa: '||NEW.tieu_de)
  ON CONFLICT(su_co_id) DO UPDATE SET so_tien=EXCLUDED.so_tien,dien_giai=EXCLUDED.dien_giai;
  v_bill:=f.hoa_don_id;
  IF v_bill IS NULL THEN SELECT id INTO v_bill FROM hoa_don WHERE hop_dong_id=v_contract AND la_ban_nhap AND ky>=v_ky ORDER BY ky LIMIT 1; END IF;
 ELSE
  DELETE FROM phi_sua_chua WHERE su_co_id=NEW.id;
  v_bill:=f.hoa_don_id;
 END IF;
 IF v_bill IS NOT NULL THEN PERFORM dong_bo_phi_sua_chua(v_bill); END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_su_co_tinh_phi ON public.su_co;
CREATE TRIGGER trg_su_co_tinh_phi AFTER INSERT OR UPDATE ON public.su_co FOR EACH ROW EXECUTE FUNCTION public.su_co_tinh_phi();
-- ISSUE_REPAIR_BILLING_END

DROP FUNCTION IF EXISTS public.cap_nhat_xu_ly_su_co(uuid,text,text,numeric);
CREATE OR REPLACE FUNCTION public.cap_nhat_xu_ly_su_co(
  p_su_co_id uuid,
  p_trang_thai text,
  p_ghi_chu_xu_ly text DEFAULT NULL,
  p_chi_phi_sua_chua numeric DEFAULT NULL,
  p_minh_chung text[] DEFAULT NULL
) RETURNS public.su_co
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_su_co public.su_co; v_ghi_chu text;
BEGIN
  SELECT * INTO v_su_co FROM public.su_co WHERE id = p_su_co_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.co_the_xu_ly_su_co(v_su_co.phong_id) THEN
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
         chi_phi_sua_chua = COALESCE(p_chi_phi_sua_chua, chi_phi_sua_chua),
         minh_chung_xu_ly = COALESCE(p_minh_chung, minh_chung_xu_ly)
   WHERE id = p_su_co_id
   RETURNING * INTO v_su_co;
  RETURN v_su_co;
END $$;

REVOKE ALL ON FUNCTION public.cap_nhat_xu_ly_su_co(uuid, text, text, numeric, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cap_nhat_xu_ly_su_co(uuid, text, text, numeric, text[]) TO authenticated;


CREATE OR REPLACE FUNCTION public.su_co_sau_khi_ghi() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r phong_tro; v_label text; v_noi_dung text;
BEGIN
  SELECT * INTO r FROM phong_tro WHERE id = NEW.phong_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lich_su_su_co
      (su_co_id, tu_trang_thai, den_trang_thai, ghi_chu, chi_phi_sua_chua, nguoi_thuc_hien_id, minh_chung_xu_ly)
    VALUES (NEW.id, NULL, NEW.trang_thai, NEW.ghi_chu_xu_ly, NEW.chi_phi_sua_chua, auth.uid(), NEW.minh_chung_xu_ly);
    -- Không báo lại cho chính người vừa tạo báo cáo (vd quản lý tự báo)
    PERFORM gui_thong_bao(array_remove(ds_nguoi_xu_ly_su_co(r.khu_tro_id), auth.uid()), 'su_co',
      'Phòng ' || r.so_phong || ' báo sự cố', NEW.tieu_de,
      '/issues/' || NEW.id, jsonb_build_object('su_co_id', NEW.id));
  ELSE
    IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai
       OR NEW.ghi_chu_xu_ly IS DISTINCT FROM OLD.ghi_chu_xu_ly
       OR NEW.chi_phi_sua_chua IS DISTINCT FROM OLD.chi_phi_sua_chua
       OR NEW.minh_chung_xu_ly IS DISTINCT FROM OLD.minh_chung_xu_ly THEN
      INSERT INTO lich_su_su_co
        (su_co_id, tu_trang_thai, den_trang_thai, ghi_chu, chi_phi_sua_chua, nguoi_thuc_hien_id, minh_chung_xu_ly)
      VALUES (NEW.id, OLD.trang_thai, NEW.trang_thai, NEW.ghi_chu_xu_ly, NEW.chi_phi_sua_chua, auth.uid(), NEW.minh_chung_xu_ly);
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
        array_remove(array_remove(ds_nguoi_xu_ly_su_co(r.khu_tro_id), auth.uid()), NEW.nguoi_thue_id),
        'su_co', 'Phòng ' || r.so_phong || ' - sự cố: ' || v_label, v_noi_dung,
        '/issues/' || NEW.id,
        jsonb_build_object('su_co_id', NEW.id, 'trang_thai', NEW.trang_thai));
    END IF;
  END IF;
  RETURN NEW;
END $$;


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
  SELECT * INTO c FROM hop_dong WHERE id = p_hop_dong_id FOR UPDATE;
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
  PERFORM dong_bo_phi_sua_chua(v_bill.id);
  SELECT * INTO v_bill FROM hoa_don WHERE id=v_bill.id;
  RETURN v_bill;
END $$;
REVOKE ALL ON FUNCTION tao_hoa_don_noi_bo(uuid, date) FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.bao_ve_dong_phi_sua_chua() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user='authenticated' AND (CASE WHEN TG_OP='INSERT' THEN NEW.su_co_id IS NOT NULL WHEN TG_OP='DELETE' THEN OLD.su_co_id IS NOT NULL ELSE OLD.su_co_id IS NOT NULL OR NEW.su_co_id IS NOT NULL END) THEN
  RAISE EXCEPTION 'Dòng phí sửa chữa được đồng bộ từ sự cố, không sửa trực tiếp' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_phi_sua_chua_bao_ve ON public.chi_tiet_hoa_don;
CREATE TRIGGER trg_phi_sua_chua_bao_ve BEFORE INSERT OR UPDATE OR DELETE ON public.chi_tiet_hoa_don FOR EACH ROW EXECUTE FUNCTION public.bao_ve_dong_phi_sua_chua();

DROP POLICY IF EXISTS minh_chung_da_luu_khong_xoa ON storage.objects;
CREATE POLICY minh_chung_da_luu_khong_xoa ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING (bucket_id<>'anh-su-co' OR (
 NOT EXISTS(SELECT 1 FROM public.su_co s WHERE storage.objects.name=ANY(s.minh_chung_xu_ly))
 AND NOT EXISTS(SELECT 1 FROM public.lich_su_su_co h WHERE storage.objects.name=ANY(h.minh_chung_xu_ly))));

-- CONTRACT_LIFECYCLE_BEGIN
UPDATE public.hop_dong SET ngay_ket_thuc=(greatest(ngay_bat_dau,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)+interval '6 months')::date WHERE ngay_ket_thuc IS NULL;
ALTER TABLE public.hop_dong ALTER COLUMN ngay_ket_thuc SET NOT NULL;
ALTER TABLE public.hop_dong ALTER COLUMN ngay_ket_thuc SET DEFAULT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+interval '6 months')::date;
ALTER TABLE public.hop_dong ADD COLUMN IF NOT EXISTS anh_hop_dong text[] NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS public.yeu_cau_hop_dong (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hop_dong_id uuid NOT NULL REFERENCES hop_dong(id) ON DELETE RESTRICT,
 loai text NOT NULL CHECK(loai IN ('gia_han','cham_dut')), ngay_de_nghi date NOT NULL, ly_do text NOT NULL,
 trang_thai text NOT NULL DEFAULT 'cho_duyet' CHECK(trang_thai IN ('cho_duyet','da_duyet','tu_choi')),
 nguoi_gui_id uuid NOT NULL REFERENCES nguoi_dung(id), nguoi_duyet_id uuid REFERENCES nguoi_dung(id),
 phan_hoi text, ngay_duyet date, tao_luc timestamptz NOT NULL DEFAULT now(), xu_ly_luc timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS yeu_cau_hop_dong_dang_cho ON public.yeu_cau_hop_dong(hop_dong_id) WHERE trang_thai='cho_duyet';
ALTER TABLE public.yeu_cau_hop_dong ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.yeu_cau_hop_dong FROM anon,authenticated;
GRANT SELECT ON public.yeu_cau_hop_dong TO authenticated;
DROP POLICY IF EXISTS yeu_cau_hop_dong_xem ON public.yeu_cau_hop_dong;
CREATE POLICY yeu_cau_hop_dong_xem ON public.yeu_cau_hop_dong FOR SELECT TO authenticated
 USING (nguoi_gui_id=auth.uid() OR vai_tro_hien_tai() IN ('chu_tro','quan_tri'));

CREATE OR REPLACE FUNCTION public.gui_yeu_cau_hop_dong(p_id uuid,p_loai text,p_ngay date,p_ly_do text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c hop_dong; v_id uuid; recipients uuid[];
BEGIN
 SELECT * INTO c FROM hop_dong WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR c.nguoi_thue_id<>auth.uid() OR coalesce(vai_tro_hien_tai(),'')<>'nguoi_thue' THEN RAISE EXCEPTION 'Không có quyền gửi yêu cầu' USING ERRCODE='42501'; END IF;
 IF c.trang_thai<>'hieu_luc' THEN RAISE EXCEPTION 'Hợp đồng đã kết thúc'; END IF;
 IF p_loai IS NULL OR p_loai NOT IN ('gia_han','cham_dut') OR p_ngay IS NULL OR p_ngay<(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date OR p_ngay<c.ngay_bat_dau
 OR (p_loai='gia_han' AND p_ngay<=c.ngay_ket_thuc) OR nullif(trim(p_ly_do),'') IS NULL OR length(p_ly_do)>1000 THEN RAISE EXCEPTION 'Kiểm tra ngày đề nghị và lý do'; END IF;
 IF EXISTS(SELECT 1 FROM yeu_cau_hop_dong WHERE hop_dong_id=p_id AND trang_thai='cho_duyet') THEN RAISE EXCEPTION 'Đã có yêu cầu đang chờ xử lý'; END IF;
 INSERT INTO yeu_cau_hop_dong(hop_dong_id,loai,ngay_de_nghi,ly_do,nguoi_gui_id) VALUES(p_id,p_loai,p_ngay,trim(p_ly_do),auth.uid()) RETURNING id INTO v_id;
 SELECT array_agg(id) INTO recipients FROM nguoi_dung WHERE dang_hoat_dong AND vai_tro IN ('chu_tro','quan_tri');
 PERFORM gui_thong_bao(recipients,'thong_bao_chung',CASE p_loai WHEN 'gia_han' THEN 'Yêu cầu gia hạn hợp đồng' ELSE 'Yêu cầu chấm dứt hợp đồng' END,trim(p_ly_do),'/hop-dong',jsonb_build_object('yeu_cau_id',v_id));
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.gui_yeu_cau_hop_dong(uuid,text,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gui_yeu_cau_hop_dong(uuid,text,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.duyet_yeu_cau_hop_dong(p_id uuid,p_duyet boolean,p_ngay date,p_phan_hoi text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r yeu_cau_hop_dong; c hop_dong;
BEGIN
 IF coalesce(vai_tro_hien_tai(),'') NOT IN ('chu_tro','quan_tri') THEN RAISE EXCEPTION 'Chỉ chủ trọ và quản trị được xử lý' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM yeu_cau_hop_dong WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.trang_thai<>'cho_duyet' THEN RAISE EXCEPTION 'Yêu cầu không còn chờ duyệt'; END IF;
 SELECT * INTO c FROM hop_dong WHERE id=r.hop_dong_id FOR UPDATE;
 IF p_duyet IS NULL OR nullif(trim(p_phan_hoi),'') IS NULL OR length(p_phan_hoi)>1000 THEN RAISE EXCEPTION 'Cần ghi phản hồi xử lý'; END IF;
 IF p_duyet THEN
  IF c.trang_thai<>'hieu_luc' THEN RAISE EXCEPTION 'Hợp đồng đã kết thúc'; END IF;
  IF r.loai='gia_han' THEN
   IF p_ngay IS NULL OR p_ngay<=c.ngay_ket_thuc OR p_ngay<=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN RAISE EXCEPTION 'Ngày gia hạn phải sau ngày hết hạn và ngày hiện tại'; END IF;
   UPDATE hop_dong SET ngay_ket_thuc=p_ngay,ghi_chu=concat_ws(E'\n',ghi_chu,'Gia hạn đến '||p_ngay||': '||trim(p_phan_hoi)) WHERE id=c.id;
  ELSE
   PERFORM ket_thuc_hop_dong(c.id,p_ngay, r.ly_do||' — '||trim(p_phan_hoi));
  END IF;
 END IF;
 UPDATE yeu_cau_hop_dong SET trang_thai=CASE WHEN p_duyet THEN 'da_duyet' ELSE 'tu_choi' END,phan_hoi=trim(p_phan_hoi),ngay_duyet=CASE WHEN p_duyet THEN p_ngay ELSE NULL END,nguoi_duyet_id=auth.uid(),xu_ly_luc=now() WHERE id=r.id;
 PERFORM gui_thong_bao(ARRAY[r.nguoi_gui_id],'thong_bao_chung',CASE WHEN p_duyet THEN 'Yêu cầu hợp đồng đã được chấp thuận' ELSE 'Yêu cầu hợp đồng chưa được chấp thuận' END,trim(p_phan_hoi),'/hop-dong',jsonb_build_object('yeu_cau_id',r.id));
END $$;
REVOKE ALL ON FUNCTION public.duyet_yeu_cau_hop_dong(uuid,boolean,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.duyet_yeu_cau_hop_dong(uuid,boolean,date,text) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('hop-dong-goc','hop-dong-goc',false,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS hop_dong_goc_xem ON storage.objects;
CREATE POLICY hop_dong_goc_xem ON storage.objects FOR SELECT TO authenticated USING(bucket_id='hop-dong-goc' AND (la_nguoi_thue_hop_dong(uuid_an_toan((storage.foldername(name))[1])) OR la_nhan_su_hop_dong(uuid_an_toan((storage.foldername(name))[1]))));
DROP POLICY IF EXISTS hop_dong_goc_them ON storage.objects;
CREATE POLICY hop_dong_goc_them ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='hop-dong-goc' AND vai_tro_hien_tai() IN ('chu_tro','quan_tri') AND EXISTS(SELECT 1 FROM hop_dong WHERE id=uuid_an_toan((storage.foldername(name))[1])));
DROP POLICY IF EXISTS hop_dong_goc_xoa ON storage.objects;
CREATE POLICY hop_dong_goc_xoa ON storage.objects FOR DELETE TO authenticated USING(bucket_id='hop-dong-goc' AND vai_tro_hien_tai() IN ('chu_tro','quan_tri') AND NOT EXISTS(SELECT 1 FROM hop_dong WHERE storage.objects.name=ANY(anh_hop_dong)));
CREATE OR REPLACE FUNCTION public.kiem_tra_anh_hop_dong() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p text;
BEGIN
 IF cardinality(NEW.anh_hop_dong)>10 THEN RAISE EXCEPTION 'Tối đa 10 ảnh hợp đồng'; END IF;
 IF TG_OP='INSERT' OR NEW.anh_hop_dong IS DISTINCT FROM OLD.anh_hop_dong THEN
  FOREACH p IN ARRAY NEW.anh_hop_dong LOOP
   IF p IS NULL OR split_part(p,'/',1)<>NEW.id::text OR p !~* '\.(jpg|jpeg|png|webp)$' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='hop-dong-goc' AND name=p) THEN RAISE EXCEPTION 'Ảnh hợp đồng không hợp lệ'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_anh_hop_dong ON public.hop_dong;
CREATE TRIGGER trg_anh_hop_dong BEFORE INSERT OR UPDATE ON public.hop_dong FOR EACH ROW EXECUTE FUNCTION public.kiem_tra_anh_hop_dong();
-- CONTRACT_LIFECYCLE_END

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
 VALUES(r.id,(p_du_lieu->>'nguoi_thue_id')::uuid,v_start,COALESCE(NULLIF(p_du_lieu->>'ngay_ket_thuc','')::date,(v_start+interval '6 months')::date),(p_du_lieu->>'gia_thue')::numeric,(p_du_lieu->>'tien_coc')::numeric,(p_du_lieu->>'ngay_thanh_toan')::int,v_count,NULLIF(p_du_lieu->>'ghi_chu','')) RETURNING id INTO v_id;
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
 IF EXISTS(SELECT 1 FROM phi_sua_chua WHERE hop_dong_id=c.id AND hoa_don_id IS NULL) THEN RAISE EXCEPTION 'Cần lập hóa đơn cho phí sửa chữa còn chờ trước khi kết thúc hợp đồng'; END IF;
 UPDATE hop_dong SET trang_thai='cham_dut',ngay_ket_thuc=p_ngay,ghi_chu=concat_ws(E'\n',ghi_chu,'Kết thúc: '||btrim(p_ly_do)) WHERE id=c.id;
END $$;

-- METER_ENTRY_WINDOW_BEGIN
CREATE TABLE IF NOT EXISTS public.mo_nhap_cong_to (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),hop_dong_id uuid NOT NULL REFERENCES hop_dong(id),ky date NOT NULL,
 den_luc timestamptz NOT NULL,ly_do text NOT NULL,nguoi_mo_id uuid NOT NULL REFERENCES nguoi_dung(id),
 tao_luc timestamptz NOT NULL DEFAULT now(),su_dung_luc timestamptz
);
ALTER TABLE public.mo_nhap_cong_to ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mo_nhap_cong_to FROM anon,authenticated;
GRANT SELECT ON public.mo_nhap_cong_to TO authenticated;
DROP POLICY IF EXISTS mo_cong_to_xem ON public.mo_nhap_cong_to;
CREATE POLICY mo_cong_to_xem ON public.mo_nhap_cong_to FOR SELECT TO authenticated USING(la_nguoi_thue_hop_dong(hop_dong_id) OR la_nhan_su_hop_dong(hop_dong_id));
CREATE OR REPLACE FUNCTION public.lich_nhap_cong_to(p_ky date,p_ngay int) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('due',d,'opens',d-3,'closes',d-1) FROM (SELECT (p_ky+interval '1 month')::date+p_ngay-1 AS d) t;
$$;
CREATE OR REPLACE FUNCTION public.trang_thai_nhap_cong_to(p_id uuid,p_ky date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c hop_dong;b hoa_don; k date; d date; t date:=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date; reason text; allow_entry boolean:=false; extra timestamptz;
BEGIN
 SELECT * INTO c FROM hop_dong WHERE id=p_id;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT (la_nguoi_thue_hop_dong(c.id) OR la_nhan_su_hop_dong(c.id)) THEN RAISE EXCEPTION 'Không có quyền xem lịch nhập chỉ số' USING ERRCODE='42501'; END IF;
 k:=p_ky;
 IF k IS NULL THEN
  SELECT ky INTO k FROM hoa_don WHERE hop_dong_id=c.id AND la_ban_nhap AND ghi_chu_kiem_tra IS NOT NULL ORDER BY ky LIMIT 1;
  IF k IS NULL THEN SELECT ky INTO k FROM mo_nhap_cong_to WHERE hop_dong_id=c.id AND su_dung_luc IS NULL AND den_luc>now() ORDER BY ky LIMIT 1; END IF;
  IF k IS NULL THEN
   k:=(date_trunc('month',t)-interval '1 month')::date;
   IF t >= (date_trunc('month',t)+interval '1 month')::date+c.ngay_thanh_toan-4 THEN k:=date_trunc('month',t)::date; END IF;
   k:=greatest(k,date_trunc('month',c.ngay_bat_dau)::date);
  END IF;
 END IF;
 IF k<>date_trunc('month',k)::date THEN RAISE EXCEPTION 'Kỳ không hợp lệ' USING ERRCODE='22023'; END IF;
 d:=(k+interval '1 month')::date+c.ngay_thanh_toan-1;
 SELECT * INTO b FROM hoa_don WHERE hop_dong_id=c.id AND ky=k;
 SELECT max(den_luc) INTO extra FROM mo_nhap_cong_to WHERE hop_dong_id=c.id AND ky=k AND su_dung_luc IS NULL AND den_luc>now();
 IF c.trang_thai<>'hieu_luc' THEN reason:='Hợp đồng đã kết thúc.';
 ELSIF k<date_trunc('month',c.ngay_bat_dau)::date OR k>date_trunc('month',t)::date THEN reason:='Kỳ này không thuộc thời gian được ghi chỉ số.';
 ELSIF b.id IS NOT NULL AND NOT b.la_ban_nhap THEN reason:='Hóa đơn đã phát hành, không được sửa chỉ số.';
 ELSIF b.id IS NOT NULL AND b.ghi_chu_kiem_tra IS NULL THEN reason:='Đã gửi chỉ số, đang chờ quản lý kiểm tra.';
 ELSIF b.id IS NULL AND EXISTS(SELECT 1 FROM chi_so_cong_to WHERE phong_id=c.phong_id AND ky=k) THEN reason:='Kỳ này đã có chỉ số. Liên hệ quản lý để kiểm tra.';
 ELSIF b.ghi_chu_kiem_tra IS NOT NULL THEN allow_entry:=true; reason:='Quản lý yêu cầu nhập và chụp lại: '||b.ghi_chu_kiem_tra;
 ELSIF extra IS NOT NULL THEN allow_entry:=true; reason:='Quản lý đã mở bổ sung thời gian nhập.';
 ELSIF t BETWEEN d-3 AND d-1 THEN allow_entry:=true; reason:='Đang trong thời gian ghi chỉ số.';
 ELSIF t<d-3 THEN reason:='Chưa đến thời gian ghi chỉ số kỳ này.';
 ELSE reason:='Đã quá hạn nhập và chưa gửi chỉ số. Liên hệ quản lý để mở bổ sung.';
 END IF;
 RETURN lich_nhap_cong_to(k,c.ngay_thanh_toan)||jsonb_build_object('period',k,'allowed',allow_entry,'reason',reason,'extraUntil',extra,'today',t);
END $$;
REVOKE ALL ON FUNCTION public.trang_thai_nhap_cong_to(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.trang_thai_nhap_cong_to(uuid,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.mo_bo_sung_cong_to(p_id uuid,p_ky date,p_gio int,p_ly_do text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c hop_dong;b hoa_don;d date;
BEGIN
 SELECT * INTO c FROM hop_dong WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT coalesce(la_nhan_su_hop_dong(c.id),false) THEN RAISE EXCEPTION 'Không có quyền mở nhập cho hợp đồng này' USING ERRCODE='42501'; END IF;
 IF c.trang_thai<>'hieu_luc' OR p_ky IS NULL OR p_ky<>date_trunc('month',p_ky)::date OR p_ky<date_trunc('month',c.ngay_bat_dau)::date OR p_gio IS NULL OR p_gio NOT BETWEEN 1 AND 72 OR nullif(trim(p_ly_do),'') IS NULL OR length(p_ly_do)>1000 THEN RAISE EXCEPTION 'Kiểm tra kỳ, thời gian mở (1–72 giờ) và lý do' USING ERRCODE='22023'; END IF;
 d:=(p_ky+interval '1 month')::date+c.ngay_thanh_toan-1;
 IF (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date<d THEN RAISE EXCEPTION 'Chỉ mở bổ sung khi đã qua hạn nhập chỉ số' USING ERRCODE='22023'; END IF;
 SELECT * INTO b FROM hoa_don WHERE hop_dong_id=c.id AND ky=p_ky FOR UPDATE;
 IF b.id IS NOT NULL THEN RAISE EXCEPTION 'Kỳ này đã có hóa đơn. Dùng Yêu cầu kiểm tra lại nếu hóa đơn còn nháp.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM chi_so_cong_to WHERE phong_id=c.phong_id AND ky=p_ky) THEN RAISE EXCEPTION 'Kỳ này đã có chỉ số, cần quản lý kiểm tra trực tiếp'; END IF;
 INSERT INTO mo_nhap_cong_to(hop_dong_id,ky,den_luc,ly_do,nguoi_mo_id) VALUES(c.id,p_ky,now()+make_interval(hours=>p_gio),trim(p_ly_do),auth.uid());
 PERFORM gui_thong_bao(ARRAY[c.nguoi_thue_id],'thanh_toan','Đã mở bổ sung ghi chỉ số công tơ',trim(p_ly_do),'/billing/chi-so?contract='||c.id||'&period='||p_ky,jsonb_build_object('hop_dong_id',c.id));
END $$;
REVOKE ALL ON FUNCTION public.mo_bo_sung_cong_to(uuid,date,int,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mo_bo_sung_cong_to(uuid,date,int,text) TO authenticated;
DROP POLICY IF EXISTS cong_to_anh_nguoi_thue_them ON storage.objects;
CREATE POLICY cong_to_anh_nguoi_thue_them ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='anh-cong-to' AND vai_tro_hien_tai()='nguoi_thue' AND (storage.foldername(name))[2]=auth.uid()::text
 AND EXISTS(SELECT 1 FROM hop_dong c WHERE c.phong_id=uuid_an_toan((storage.foldername(name))[1]) AND c.nguoi_thue_id=auth.uid() AND c.trang_thai='hieu_luc' AND (trang_thai_nhap_cong_to(c.id)->>'allowed')::boolean));
-- METER_ENTRY_WINDOW_END

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
  IF NOT (trang_thai_nhap_cong_to(c.id,p_ky)->>'allowed')::boolean THEN
    RAISE EXCEPTION '%',trang_thai_nhap_cong_to(c.id,p_ky)->>'reason' USING ERRCODE='22023';
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
  UPDATE mo_nhap_cong_to SET su_dung_luc=now() WHERE hop_dong_id=c.id AND ky=p_ky AND su_dung_luc IS NULL;
  RETURN b;
END $$;
REVOKE ALL ON FUNCTION nguoi_thue_lap_hoa_don(uuid,date,int,int,text,text,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION nguoi_thue_lap_hoa_don(uuid,date,int,int,text,text,timestamptz,timestamptz) TO authenticated;


-- METER_REMINDERS_BEGIN
CREATE TABLE IF NOT EXISTS public.cau_hinh_nhac_cong_to (id boolean PRIMARY KEY DEFAULT true CHECK(id),bat_dau date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
INSERT INTO public.cau_hinh_nhac_cong_to(id) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE public.cau_hinh_nhac_cong_to ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cau_hinh_nhac_cong_to FROM anon,authenticated;
CREATE TABLE IF NOT EXISTS public.nhat_ky_nhac_cong_to (
 hop_dong_id uuid NOT NULL REFERENCES hop_dong(id) ON DELETE CASCADE,ky date NOT NULL,
 loai text NOT NULL CHECK(loai IN ('mo_nhap','ngay_cuoi','qua_han')),ngay_gui date NOT NULL,
 PRIMARY KEY(hop_dong_id,ky,loai)
);
ALTER TABLE public.nhat_ky_nhac_cong_to ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nhat_ky_nhac_cong_to FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.moc_nhac_cong_to(p_due date,p_today date) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN p_today>=p_due THEN 'qua_han' WHEN p_today=p_due-1 THEN 'ngay_cuoi' WHEN p_today BETWEEN p_due-3 AND p_due-2 THEN 'mo_nhap' END $$;
CREATE OR REPLACE FUNCTION public.tao_nhac_cong_to_noi_bo(p_user uuid,p_today date) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c hop_dong;k date;d date;kind text;claimed int;n int:=0;start_day date;title text;body text;
BEGIN
 SELECT bat_dau INTO start_day FROM cau_hinh_nhac_cong_to WHERE id;
 IF start_day IS NULL OR p_today<start_day THEN RETURN 0; END IF;
 FOR c IN SELECT h.* FROM hop_dong h JOIN nguoi_dung u ON u.id=h.nguoi_thue_id
 WHERE h.trang_thai='hieu_luc' AND u.dang_hoat_dong AND (p_user IS NULL OR h.nguoi_thue_id=p_user) ORDER BY h.id FOR UPDATE OF h LOOP
  FOR k IN SELECT generate_series(greatest(date_trunc('month',c.ngay_bat_dau)::date,(date_trunc('month',start_day)-interval '1 month')::date),date_trunc('month',p_today)::date,interval '1 month')::date LOOP
   d:=(k+interval '1 month')::date+c.ngay_thanh_toan-1;
   kind:=moc_nhac_cong_to(d,p_today);
   IF kind IS NULL OR d<start_day OR EXISTS(SELECT 1 FROM hoa_don WHERE hop_dong_id=c.id AND ky=k)
    OR EXISTS(SELECT 1 FROM chi_so_cong_to WHERE phong_id=c.phong_id AND ky=k) THEN CONTINUE; END IF;
   INSERT INTO nhat_ky_nhac_cong_to(hop_dong_id,ky,loai,ngay_gui) VALUES(c.id,k,kind,p_today) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS claimed=ROW_COUNT;
   IF claimed=0 THEN CONTINUE; END IF;
   title:=CASE kind WHEN 'mo_nhap' THEN 'Đã đến ngày nhập chỉ số công tơ' WHEN 'ngay_cuoi' THEN 'Hôm nay là ngày cuối nhập chỉ số công tơ' ELSE 'Đã quá hạn nhập chỉ số công tơ' END;
   body:='Kỳ '||to_char(k,'MM/YYYY')||': '||CASE kind
    WHEN 'mo_nhap' THEN 'bạn có thể nhập từ '||to_char(d-3,'DD/MM/YYYY')||' đến hết '||to_char(d-1,'DD/MM/YYYY')||'. Hãy chụp ảnh và gửi chỉ số điện, nước.'
    WHEN 'ngay_cuoi' THEN 'bạn chưa gửi chỉ số. Vui lòng nhập và chụp công tơ trước khi hết hôm nay.'
    ELSE 'bạn chưa gửi chỉ số trước hạn '||to_char(d-1,'DD/MM/YYYY')||'. Kiểm tra thời gian mở bổ sung hoặc liên hệ quản lý.' END;
   PERFORM gui_thong_bao(ARRAY[c.nguoi_thue_id],'thong_bao_chung',title,body,'/billing/chi-so?contract='||c.id||'&period='||k,jsonb_build_object('hop_dong_id',c.id,'ky',k,'moc_cong_to',kind));
   n:=n+1;
  END LOOP;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.tao_nhac_cong_to_noi_bo(uuid,date) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.gui_nhac_cong_to() RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT tao_nhac_cong_to_noi_bo(NULL,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) $$;
REVOKE ALL ON FUNCTION public.gui_nhac_cong_to() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gui_nhac_cong_to() TO service_role;
CREATE OR REPLACE FUNCTION public.nhac_cong_to_cua_toi() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR coalesce(vai_tro_hien_tai(),'')<>'nguoi_thue' THEN RETURN 0; END IF;
 RETURN tao_nhac_cong_to_noi_bo(auth.uid(),(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
END $$;
REVOKE ALL ON FUNCTION public.nhac_cong_to_cua_toi() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nhac_cong_to_cua_toi() TO authenticated;
-- METER_REMINDERS_END

-- MOVE_OUT_SETTLEMENT_BEGIN
CREATE TABLE IF NOT EXISTS public.quyet_toan_hop_dong (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hop_dong_id uuid NOT NULL UNIQUE REFERENCES hop_dong(id) ON DELETE RESTRICT,
 ngay_tra date NOT NULL, ly_do text NOT NULL, tien_coc numeric(12,2) NOT NULL,tong_con_no numeric(12,2) NOT NULL,
 can_coc numeric(12,2) NOT NULL,thu_them numeric(12,2) NOT NULL,hoan_lai numeric(12,2) NOT NULL,
 hinh_thuc text NOT NULL CHECK(hinh_thuc IN ('tien_mat','chuyen_khoan')),ghi_chu text NOT NULL,
 chi_tiet jsonb NOT NULL,nguoi_xac_nhan_id uuid NOT NULL REFERENCES nguoi_dung(id),tao_luc timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quyet_toan_hop_dong ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quyet_toan_hop_dong FROM anon,authenticated;
GRANT SELECT ON public.quyet_toan_hop_dong TO authenticated;
DROP POLICY IF EXISTS quyet_toan_xem ON public.quyet_toan_hop_dong;
CREATE POLICY quyet_toan_xem ON public.quyet_toan_hop_dong FOR SELECT TO authenticated USING(la_nguoi_thue_hop_dong(hop_dong_id) OR coalesce(vai_tro_hien_tai(),'') IN ('chu_tro','quan_tri'));
ALTER TABLE public.thanh_toan ADD COLUMN IF NOT EXISTS quyet_toan_id uuid REFERENCES public.quyet_toan_hop_dong(id) ON DELETE RESTRICT;
ALTER TABLE public.thanh_toan ADD COLUMN IF NOT EXISTS tien_coc_can_tru numeric(12,2) NOT NULL DEFAULT 0 CHECK(tien_coc_can_tru>=0 AND tien_coc_can_tru<=so_tien);
CREATE UNIQUE INDEX IF NOT EXISTS thanh_toan_quyet_toan_mot_lan ON public.thanh_toan(quyet_toan_id,hoa_don_id) WHERE quyet_toan_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.xem_quyet_toan(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c hop_dong; bills jsonb;meters jsonb; repairs jsonb; debt numeric; drafts int;pending int;v jsonb;
BEGIN
 SELECT * INTO c FROM hop_dong WHERE id=p_id;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT (c.nguoi_thue_id=auth.uid() OR coalesce(vai_tro_hien_tai(),'') IN ('chu_tro','quan_tri')) THEN RAISE EXCEPTION 'Không có quyền xem quyết toán' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'period',b.thang_nam,'total',b.tong_tien,'paid',coalesce(p.paid,0),'remaining',greatest(0,b.tong_tien-coalesce(p.paid,0))) ORDER BY b.ky,b.id),'[]'::jsonb),coalesce(sum(greatest(0,b.tong_tien-coalesce(p.paid,0))),0)
 INTO bills,debt FROM hoa_don b LEFT JOIN LATERAL(SELECT sum(so_tien) paid FROM thanh_toan WHERE hoa_don_id=b.id AND trang_thai='da_duyet') p ON true
 WHERE b.hop_dong_id=c.id AND NOT b.la_ban_nhap;
 SELECT count(*) INTO drafts FROM hoa_don WHERE hop_dong_id=c.id AND la_ban_nhap;
 SELECT count(*) INTO pending FROM thanh_toan t JOIN hoa_don b ON b.id=t.hoa_don_id WHERE b.hop_dong_id=c.id AND t.trang_thai='cho_duyet';
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',su_co_id,'label',dien_giai,'amount',so_tien) ORDER BY su_co_id),'[]'::jsonb) INTO repairs FROM phi_sua_chua WHERE hop_dong_id=c.id AND hoa_don_id IS NULL;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.loai),'[]'::jsonb) INTO meters FROM (SELECT DISTINCT ON(loai) loai,ky,chi_so_moi,chup_luc FROM chi_so_cong_to WHERE phong_id=c.phong_id ORDER BY loai,ky DESC) t;
 v:=jsonb_build_object('contractId',c.id,'start',c.ngay_bat_dau,'room',(SELECT so_phong FROM phong_tro WHERE id=c.phong_id),'tenant',(SELECT ho_ten FROM nguoi_dung WHERE id=c.nguoi_thue_id),'deposit',c.tien_coc,'debt',debt,'depositUsed',least(c.tien_coc,debt),'collect',greatest(0,debt-c.tien_coc),'refund',greatest(0,c.tien_coc-debt),'bills',bills,'drafts',drafts,'pendingPayments',pending,'unbilledRepairs',repairs,'meters',meters,'status',c.trang_thai);
 RETURN v||jsonb_build_object('version',md5(v::text),'ready',c.trang_thai='hieu_luc' AND drafts=0 AND pending=0 AND jsonb_array_length(repairs)=0);
END $$;
REVOKE ALL ON FUNCTION public.xem_quyet_toan(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xem_quyet_toan(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bao_ve_quyet_toan() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_contract uuid;
BEGIN
 IF current_user='authenticated' AND (CASE WHEN TG_OP='INSERT' THEN NEW.quyet_toan_id IS NOT NULL OR NEW.tien_coc_can_tru<>0 WHEN TG_OP='DELETE' THEN OLD.quyet_toan_id IS NOT NULL ELSE OLD.quyet_toan_id IS NOT NULL OR NEW.quyet_toan_id IS NOT NULL OR NEW.tien_coc_can_tru IS DISTINCT FROM OLD.tien_coc_can_tru END) THEN RAISE EXCEPTION 'Không sửa khoản đã quyết toán hoặc tự cấn cọc' USING ERRCODE='42501'; END IF;
 IF TG_OP IN ('UPDATE','DELETE') THEN
  SELECT hop_dong_id INTO v_contract FROM hoa_don WHERE id=OLD.hoa_don_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM quyet_toan_hop_dong WHERE hop_dong_id=v_contract) THEN RAISE EXCEPTION 'Không thay đổi khoản thanh toán của hợp đồng đã quyết toán' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='INSERT' THEN
  SELECT hop_dong_id INTO v_contract FROM hoa_don WHERE id=NEW.hoa_don_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM quyet_toan_hop_dong WHERE hop_dong_id=v_contract AND id IS DISTINCT FROM NEW.quyet_toan_id) THEN RAISE EXCEPTION 'Hợp đồng đã quyết toán, không ghi thêm biên lai' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_thanh_toan_quyet_toan ON public.thanh_toan;
CREATE TRIGGER trg_thanh_toan_quyet_toan BEFORE INSERT OR UPDATE OR DELETE ON public.thanh_toan FOR EACH ROW EXECUTE FUNCTION public.bao_ve_quyet_toan();

CREATE OR REPLACE FUNCTION public.hop_dong_can_quyet_toan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.trang_thai IN ('cham_dut','het_han') AND OLD.trang_thai='hieu_luc' AND auth.uid() IS NOT NULL AND NOT EXISTS(SELECT 1 FROM quyet_toan_hop_dong WHERE hop_dong_id=OLD.id) THEN RAISE EXCEPTION 'Cần xác nhận quyết toán và bàn giao trước khi kết thúc hợp đồng' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM quyet_toan_hop_dong WHERE hop_dong_id=OLD.id) AND (NEW.tien_coc IS DISTINCT FROM OLD.tien_coc OR NEW.nguoi_thue_id IS DISTINCT FROM OLD.nguoi_thue_id OR NEW.phong_id IS DISTINCT FROM OLD.phong_id OR (OLD.trang_thai='cham_dut' AND NEW.trang_thai IS DISTINCT FROM OLD.trang_thai)) THEN RAISE EXCEPTION 'Hợp đồng đã quyết toán, không đổi tiền cọc/người thuê/phòng hoặc mở lại' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_hop_dong_quyet_toan ON public.hop_dong;
CREATE TRIGGER trg_hop_dong_quyet_toan BEFORE UPDATE ON public.hop_dong FOR EACH ROW EXECUTE FUNCTION public.hop_dong_can_quyet_toan();

CREATE OR REPLACE FUNCTION public.xac_nhan_quyet_toan(p_id uuid,p_ngay date,p_ly_do text,p_version text,p_hinh_thuc text,p_ghi_chu text,p_da_chot_dien_nuoc boolean,p_da_giao_nhan_tien boolean,p_da_ban_giao boolean,p_yeu_cau uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c hop_dong;s jsonb;q uuid;b record;due numeric;deposit_left numeric;used numeric;r yeu_cau_hop_dong;
BEGIN
 IF auth.uid() IS NULL OR coalesce(vai_tro_hien_tai(),'') NOT IN ('chu_tro','quan_tri') THEN RAISE EXCEPTION 'Chỉ chủ trọ và quản trị được quyết toán' USING ERRCODE='42501'; END IF;
 IF p_yeu_cau IS NOT NULL THEN
  SELECT * INTO r FROM yeu_cau_hop_dong WHERE id=p_yeu_cau FOR UPDATE;
  IF NOT FOUND OR r.hop_dong_id<>p_id OR r.loai<>'cham_dut' OR r.trang_thai<>'cho_duyet' THEN RAISE EXCEPTION 'Yêu cầu chấm dứt không còn hợp lệ'; END IF;
 END IF;
 SELECT * INTO c FROM hop_dong WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.trang_thai<>'hieu_luc' OR EXISTS(SELECT 1 FROM quyet_toan_hop_dong WHERE hop_dong_id=c.id) THEN RAISE EXCEPTION 'Hợp đồng không còn chờ quyết toán'; END IF;
 IF p_ngay IS NULL OR p_ngay<c.ngay_bat_dau OR p_ngay>(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date OR nullif(trim(p_ly_do),'') IS NULL OR length(p_ly_do)>1000 OR nullif(trim(p_ghi_chu),'') IS NULL OR length(p_ghi_chu)>2000 OR p_hinh_thuc IS NULL OR p_hinh_thuc NOT IN ('tien_mat','chuyen_khoan') THEN RAISE EXCEPTION 'Kiểm tra ngày trả phòng, lý do, hình thức và ghi chú giao nhận'; END IF;
 IF p_da_chot_dien_nuoc IS DISTINCT FROM true OR p_da_giao_nhan_tien IS DISTINCT FROM true OR p_da_ban_giao IS DISTINCT FROM true THEN RAISE EXCEPTION 'Cần xác nhận điện nước cuối kỳ, giao nhận tiền và bàn giao phòng'; END IF;
 PERFORM 1 FROM phong_tro WHERE id=c.phong_id FOR UPDATE;
 PERFORM 1 FROM hoa_don WHERE hop_dong_id=c.id ORDER BY id FOR UPDATE;
 PERFORM 1 FROM phi_sua_chua WHERE hop_dong_id=c.id ORDER BY su_co_id FOR UPDATE;
 s:=xem_quyet_toan(c.id);
 IF NOT (s->>'ready')::boolean THEN RAISE EXCEPTION 'Cần phát hành hóa đơn nháp, đối soát biên lai và đưa đủ phí sửa chữa lên hóa đơn trước'; END IF;
 IF p_version IS NULL OR p_version<>s->>'version' THEN RAISE EXCEPTION 'Số liệu đã thay đổi. Tải lại quyết toán và kiểm tra số tiền trước khi xác nhận'; END IF;
 INSERT INTO quyet_toan_hop_dong(hop_dong_id,ngay_tra,ly_do,tien_coc,tong_con_no,can_coc,thu_them,hoan_lai,hinh_thuc,ghi_chu,chi_tiet,nguoi_xac_nhan_id)
 VALUES(c.id,p_ngay,trim(p_ly_do),c.tien_coc,(s->>'debt')::numeric,(s->>'depositUsed')::numeric,(s->>'collect')::numeric,(s->>'refund')::numeric,p_hinh_thuc,trim(p_ghi_chu),s,auth.uid()) RETURNING id INTO q;
 deposit_left:=c.tien_coc;
 FOR b IN SELECT value FROM jsonb_array_elements(s->'bills') LOOP
  due:=(b.value->>'remaining')::numeric;
  IF due<=0 THEN CONTINUE; END IF;
  used:=least(deposit_left,due);deposit_left:=deposit_left-used;
  INSERT INTO thanh_toan(hoa_don_id,so_tien,trang_thai,nguoi_gui_id,nguoi_duyet_id,duyet_luc,ghi_chu,ma_giao_dich,quyet_toan_id,tien_coc_can_tru)
  VALUES((b.value->>'id')::uuid,due,'da_duyet',auth.uid(),auth.uid(),now(),'Quyết toán trả phòng: cấn cọc '||used||' đ; thu thêm '||(due-used)||' đ. '||trim(p_ghi_chu),'QT-'||q,q,used);
  PERFORM dong_bo_trang_thai_hoa_don((b.value->>'id')::uuid);
 END LOOP;
 PERFORM ket_thuc_hop_dong(c.id,p_ngay,p_ly_do);
 UPDATE yeu_cau_hop_dong SET trang_thai=CASE WHEN id=p_yeu_cau THEN 'da_duyet' ELSE 'tu_choi' END,phan_hoi=CASE WHEN id=p_yeu_cau THEN 'Đã quyết toán và bàn giao: '||trim(p_ghi_chu) ELSE 'Hợp đồng đã được quyết toán và kết thúc.' END,ngay_duyet=CASE WHEN id=p_yeu_cau THEN p_ngay ELSE NULL END,nguoi_duyet_id=auth.uid(),xu_ly_luc=now() WHERE hop_dong_id=c.id AND trang_thai='cho_duyet';
 PERFORM gui_thong_bao(ARRAY[c.nguoi_thue_id],'thong_bao_chung','Đã quyết toán trả phòng','Cấn cọc: '||(s->>'depositUsed')||' đ; thu thêm: '||(s->>'collect')||' đ; hoàn lại: '||(s->>'refund')||' đ. Xem chi tiết trong hợp đồng.','/hop-dong',jsonb_build_object('quyet_toan_id',q));
 RETURN q;
END $$;
REVOKE ALL ON FUNCTION public.xac_nhan_quyet_toan(uuid,date,text,text,text,text,boolean,boolean,boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xac_nhan_quyet_toan(uuid,date,text,text,text,text,boolean,boolean,boolean,uuid) TO authenticated;
-- MOVE_OUT_SETTLEMENT_END

CREATE OR REPLACE FUNCTION public.khoa_phat_sinh_sau_quyet_toan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM hop_dong WHERE id=NEW.hop_dong_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM quyet_toan_hop_dong WHERE hop_dong_id=NEW.hop_dong_id) THEN RAISE EXCEPTION 'Hợp đồng đã quyết toán, không phát sinh hóa đơn/phí mới' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_hoa_don_sau_quyet_toan ON public.hoa_don;
CREATE TRIGGER trg_hoa_don_sau_quyet_toan BEFORE INSERT ON public.hoa_don FOR EACH ROW EXECUTE FUNCTION public.khoa_phat_sinh_sau_quyet_toan();
DROP TRIGGER IF EXISTS trg_phi_sau_quyet_toan ON public.phi_sua_chua;
CREATE TRIGGER trg_phi_sau_quyet_toan BEFORE INSERT OR UPDATE ON public.phi_sua_chua FOR EACH ROW EXECUTE FUNCTION public.khoa_phat_sinh_sau_quyet_toan();

COMMIT;
