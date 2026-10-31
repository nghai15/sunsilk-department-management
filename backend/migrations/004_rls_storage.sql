-- Migration: 004_rls_storage.sql
-- Row Level Security + Storage.
--   * Người thuê (tenant): chỉ thấy dữ liệu phòng/hợp đồng/hóa đơn của chính mình.
--   * Chủ trọ (landlord): toàn quyền với các khu mình sở hữu. Quản lý (manager): các khu được gán.
--   * Admin: toàn hệ thống.
-- Edge Functions dùng service vai_tro nên bỏ qua RLS.

-- =====================================================================
-- 0. Hàm trợ giúp bổ sung
-- =====================================================================
CREATE OR REPLACE FUNCTION la_nguoi_thue_khu_tro(p_khu_tro_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hop_dong c JOIN public.phong_tro r ON r.id = c.phong_id
                  WHERE r.khu_tro_id = p_khu_tro_id AND c.nguoi_thue_id = auth.uid() AND c.trang_thai = 'hieu_luc')
$$;

CREATE OR REPLACE FUNCTION la_nguoi_thue_hop_dong(p_hop_dong_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hop_dong WHERE id = p_hop_dong_id AND nguoi_thue_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION la_nhan_su_hop_dong(p_hop_dong_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT public.la_nhan_su_phong(c.phong_id) FROM public.hop_dong c WHERE c.id = p_hop_dong_id), FALSE)
$$;

CREATE OR REPLACE FUNCTION la_nhan_su_hoa_don(p_hoa_don_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT public.la_nhan_su_phong(b.phong_id) FROM public.hoa_don b WHERE b.id = p_hoa_don_id), FALSE)
$$;

CREATE OR REPLACE FUNCTION co_the_xem_nguoi_dung(p_nguoi_dung_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_nguoi_dung_id = auth.uid()
      OR public.vai_tro_hien_tai() = 'quan_tri'
      OR EXISTS (SELECT 1 FROM public.hop_dong c JOIN public.phong_tro r ON r.id = c.phong_id
                  WHERE c.nguoi_thue_id = p_nguoi_dung_id AND public.la_nhan_su_khu_tro(r.khu_tro_id))
$$;

CREATE OR REPLACE FUNCTION uuid_an_toan(p text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN p::uuid; EXCEPTION WHEN others THEN RETURN NULL; END $$;

-- =====================================================================
-- 1. Bảo vệ cột nhạy cảm (RLS không giới hạn theo cột)
-- =====================================================================
CREATE OR REPLACE FUNCTION nguoi_dung_bao_ve_cot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.vai_tro_hien_tai() <> 'quan_tri'
     AND (NEW.vai_tro IS DISTINCT FROM OLD.vai_tro OR NEW.dang_hoat_dong IS DISTINCT FROM OLD.dang_hoat_dong
          OR NEW.so_dien_thoai IS DISTINCT FROM OLD.so_dien_thoai) THEN
    RAISE EXCEPTION 'Không được tự đổi vai trò/trạng thái/số điện thoại' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_nguoi_dung_protect BEFORE UPDATE ON nguoi_dung
  FOR EACH ROW EXECUTE FUNCTION nguoi_dung_bao_ve_cot();

CREATE OR REPLACE FUNCTION su_co_bao_ve_cot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.la_nhan_su_phong(OLD.phong_id)
     AND (NEW.chi_phi_sua_chua IS DISTINCT FROM OLD.chi_phi_sua_chua
          OR NEW.phong_id IS DISTINCT FROM OLD.phong_id
          OR NEW.nguoi_thue_id IS DISTINCT FROM OLD.nguoi_thue_id
          OR NEW.phan_loai IS DISTINCT FROM OLD.phan_loai) THEN
    RAISE EXCEPTION 'Người thuê không được sửa chi phí/phòng/phân loại sự cố' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_su_co_protect BEFORE UPDATE ON su_co
  FOR EACH ROW EXECUTE FUNCTION su_co_bao_ve_cot();

CREATE OR REPLACE FUNCTION thong_bao_bao_ve_cot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (NEW.nguoi_nhan_id IS DISTINCT FROM OLD.nguoi_nhan_id
      OR NEW.tieu_de IS DISTINCT FROM OLD.tieu_de OR NEW.noi_dung IS DISTINCT FROM OLD.noi_dung
      OR NEW.loai IS DISTINCT FROM OLD.loai OR NEW.da_gui_push_luc IS DISTINCT FROM OLD.da_gui_push_luc) THEN
    RAISE EXCEPTION 'Chỉ được cập nhật trạng thái đã đọc' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_thong_bao_protect BEFORE UPDATE ON thong_bao
  FOR EACH ROW EXECUTE FUNCTION thong_bao_bao_ve_cot();

-- =====================================================================
-- 2. Bật RLS + quyền bảng
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['nguoi_dung','khu_tro','nhan_su_khu_tro','phong_tro','hop_dong',
    'phi_dich_vu','dich_vu_hop_dong','chi_so_cong_to','hoa_don','chi_tiet_hoa_don','thanh_toan','su_co',
    'lich_su_su_co','thong_bao','thong_bao_chung','dang_ky_push','nhat_ky_nhac_no']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
REVOKE ALL ON nhat_ky_nhac_no FROM authenticated;   -- chỉ service vai_tro

-- =====================================================================
-- 3. Policies
-- =====================================================================
-- nguoi_dung
CREATE POLICY nguoi_dung_xem ON nguoi_dung FOR SELECT TO authenticated USING (co_the_xem_nguoi_dung(id));
CREATE POLICY nguoi_dung_sua_chinh_minh ON nguoi_dung FOR UPDATE TO authenticated
  USING (id = auth.uid() OR vai_tro_hien_tai() = 'quan_tri') WITH CHECK (id = auth.uid() OR vai_tro_hien_tai() = 'quan_tri');
CREATE POLICY nguoi_dung_quan_tri_xoa ON nguoi_dung FOR DELETE TO authenticated USING (vai_tro_hien_tai() = 'quan_tri');

-- khu_tro
CREATE POLICY khu_tro_xem ON khu_tro FOR SELECT TO authenticated
  USING (la_nhan_su_khu_tro(id) OR la_nguoi_thue_khu_tro(id));
CREATE POLICY khu_tro_them ON khu_tro FOR INSERT TO authenticated
  WITH CHECK (vai_tro_hien_tai() = 'quan_tri' OR (vai_tro_hien_tai() = 'chu_tro' AND chu_tro_id = auth.uid()));
CREATE POLICY khu_tro_sua ON khu_tro FOR UPDATE TO authenticated
  USING (la_nhan_su_khu_tro(id)) WITH CHECK (la_nhan_su_khu_tro(id));
CREATE POLICY khu_tro_xoa ON khu_tro FOR DELETE TO authenticated
  USING (vai_tro_hien_tai() = 'quan_tri' OR (vai_tro_hien_tai() = 'chu_tro' AND chu_tro_id = auth.uid()));

-- nhan_su_khu_tro (chủ trọ gán quản lý)
CREATE POLICY nhan_su_xem ON nhan_su_khu_tro FOR SELECT TO authenticated
  USING (nguoi_dung_id = auth.uid() OR la_nhan_su_khu_tro(khu_tro_id));
CREATE POLICY nhan_su_ghi ON nhan_su_khu_tro FOR ALL TO authenticated
  USING (vai_tro_hien_tai() = 'quan_tri' OR EXISTS (SELECT 1 FROM khu_tro p WHERE p.id = khu_tro_id AND p.chu_tro_id = auth.uid()))
  WITH CHECK (vai_tro_hien_tai() = 'quan_tri' OR EXISTS (SELECT 1 FROM khu_tro p WHERE p.id = khu_tro_id AND p.chu_tro_id = auth.uid()));

-- phong_tro
CREATE POLICY phong_tro_xem ON phong_tro FOR SELECT TO authenticated
  USING (la_nhan_su_khu_tro(khu_tro_id) OR la_nguoi_thue_phong(id));
CREATE POLICY phong_tro_ghi ON phong_tro FOR ALL TO authenticated
  USING (la_nhan_su_khu_tro(khu_tro_id)) WITH CHECK (la_nhan_su_khu_tro(khu_tro_id));

-- hop_dong
CREATE POLICY hop_dong_xem ON hop_dong FOR SELECT TO authenticated
  USING (nguoi_thue_id = auth.uid() OR la_nhan_su_phong(phong_id));
CREATE POLICY hop_dong_ghi ON hop_dong FOR ALL TO authenticated
  USING (la_nhan_su_phong(phong_id)) WITH CHECK (la_nhan_su_phong(phong_id));

-- phi_dich_vu (cấu hình giá: người thuê được xem)
CREATE POLICY phi_dich_vu_xem ON phi_dich_vu FOR SELECT TO authenticated
  USING (la_nhan_su_khu_tro(khu_tro_id) OR la_nguoi_thue_khu_tro(khu_tro_id));
CREATE POLICY phi_dich_vu_ghi ON phi_dich_vu FOR ALL TO authenticated
  USING (la_nhan_su_khu_tro(khu_tro_id)) WITH CHECK (la_nhan_su_khu_tro(khu_tro_id));

-- dich_vu_hop_dong
CREATE POLICY dich_vu_hop_dong_xem ON dich_vu_hop_dong FOR SELECT TO authenticated
  USING (la_nguoi_thue_hop_dong(hop_dong_id) OR la_nhan_su_hop_dong(hop_dong_id));
CREATE POLICY dich_vu_hop_dong_ghi ON dich_vu_hop_dong FOR ALL TO authenticated
  USING (la_nhan_su_hop_dong(hop_dong_id)) WITH CHECK (la_nhan_su_hop_dong(hop_dong_id));

-- chi_so_cong_to
CREATE POLICY chi_so_xem ON chi_so_cong_to FOR SELECT TO authenticated
  USING (la_nhan_su_phong(phong_id) OR la_nguoi_thue_phong(phong_id));
CREATE POLICY chi_so_ghi ON chi_so_cong_to FOR ALL TO authenticated
  USING (la_nhan_su_phong(phong_id)) WITH CHECK (la_nhan_su_phong(phong_id));

-- hoa_don: người thuê chỉ thấy hóa đơn đã phát hành của hợp đồng mình
CREATE POLICY hoa_don_xem ON hoa_don FOR SELECT TO authenticated
  USING (la_nhan_su_phong(phong_id) OR (NOT la_ban_nhap AND la_nguoi_thue_hop_dong(hop_dong_id)));
CREATE POLICY hoa_don_ghi ON hoa_don FOR ALL TO authenticated
  USING (la_nhan_su_phong(phong_id)) WITH CHECK (la_nhan_su_phong(phong_id));

-- chi_tiet_hoa_don (kế thừa quyền xem hóa đơn)
CREATE POLICY chi_tiet_hoa_don_xem ON chi_tiet_hoa_don FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hoa_don b WHERE b.id = hoa_don_id));
CREATE POLICY chi_tiet_hoa_don_ghi ON chi_tiet_hoa_don FOR ALL TO authenticated
  USING (la_nhan_su_hoa_don(hoa_don_id)) WITH CHECK (la_nhan_su_hoa_don(hoa_don_id));

-- thanh_toan: người thuê chỉ được gửi biên lai 'cho_duyet'; duyệt/từ chối là việc của nhân sự khu
CREATE POLICY thanh_toan_xem ON thanh_toan FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hoa_don b WHERE b.id = hoa_don_id));
CREATE POLICY thanh_toan_them ON thanh_toan FOR INSERT TO authenticated
  WITH CHECK (trang_thai = 'cho_duyet' AND nguoi_gui_id = auth.uid()
    AND EXISTS (SELECT 1 FROM hoa_don b WHERE b.id = hoa_don_id AND NOT b.la_ban_nhap
                  AND (la_nguoi_thue_hop_dong(b.hop_dong_id) OR la_nhan_su_phong(b.phong_id))));
CREATE POLICY thanh_toan_sua ON thanh_toan FOR UPDATE TO authenticated
  USING (la_nhan_su_hoa_don(hoa_don_id)) WITH CHECK (la_nhan_su_hoa_don(hoa_don_id));
CREATE POLICY thanh_toan_xoa ON thanh_toan FOR DELETE TO authenticated
  USING (la_nhan_su_hoa_don(hoa_don_id));

-- su_co
CREATE POLICY su_co_xem ON su_co FOR SELECT TO authenticated
  USING (nguoi_thue_id = auth.uid() OR la_nhan_su_phong(phong_id) OR la_nguoi_thue_phong(phong_id));
CREATE POLICY su_co_them ON su_co FOR INSERT TO authenticated
  WITH CHECK (la_nhan_su_phong(phong_id)
    OR (la_nguoi_thue_phong(phong_id) AND COALESCE(nguoi_thue_id, auth.uid()) = auth.uid() AND trang_thai = 'cho_tiep_nhan'));
CREATE POLICY su_co_sua ON su_co FOR UPDATE TO authenticated
  USING (la_nhan_su_phong(phong_id) OR (nguoi_thue_id = auth.uid() AND trang_thai = 'cho_tiep_nhan'))
  WITH CHECK (la_nhan_su_phong(phong_id) OR (nguoi_thue_id = auth.uid() AND trang_thai IN ('cho_tiep_nhan', 'da_huy')));
CREATE POLICY su_co_xoa ON su_co FOR DELETE TO authenticated USING (la_nhan_su_phong(phong_id));

CREATE POLICY lich_su_su_co_xem ON lich_su_su_co FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM su_co i WHERE i.id = su_co_id));

-- thong_bao: mỗi người chỉ thấy/đánh dấu đọc thông báo của mình (tạo mới qua trigger/RPC)
CREATE POLICY thong_bao_xem ON thong_bao FOR SELECT TO authenticated USING (nguoi_nhan_id = auth.uid());
CREATE POLICY thong_bao_sua ON thong_bao FOR UPDATE TO authenticated
  USING (nguoi_nhan_id = auth.uid()) WITH CHECK (nguoi_nhan_id = auth.uid());
CREATE POLICY thong_bao_xoa ON thong_bao FOR DELETE TO authenticated USING (nguoi_nhan_id = auth.uid());

CREATE POLICY thong_bao_chung_xem ON thong_bao_chung FOR SELECT TO authenticated USING (la_nhan_su_khu_tro(khu_tro_id));
CREATE POLICY thong_bao_chung_xoa ON thong_bao_chung FOR DELETE TO authenticated USING (la_nhan_su_khu_tro(khu_tro_id));

CREATE POLICY dang_ky_push_cua_minh ON dang_ky_push FOR ALL TO authenticated
  USING (nguoi_dung_id = auth.uid()) WITH CHECK (nguoi_dung_id = auth.uid());

-- Realtime: hộp thư in-app cập nhật tức thì
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND tablename = 'thong_bao') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.thong_bao;
  END IF;
END $$;

-- =====================================================================
-- 4. Storage: đường dẫn file bắt buộc dạng  <phong_id>/<tên-file>
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('anh-cong-to',   'anh-cong-to',   FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('bien-lai', 'bien-lai', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('anh-su-co',   'anh-su-co',   FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit,
                               allowed_mime_types = EXCLUDED.allowed_mime_types, public = FALSE;

-- Ảnh công tơ: nhân sự ghi/sửa; người thuê phòng đó chỉ xem
CREATE POLICY cong_to_anh_nhan_su ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'anh-cong-to' AND la_nhan_su_phong(uuid_an_toan((storage.foldername(name))[1])))
  WITH CHECK (bucket_id = 'anh-cong-to' AND la_nhan_su_phong(uuid_an_toan((storage.foldername(name))[1])));
CREATE POLICY cong_to_anh_nguoi_thue_doc ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'anh-cong-to' AND la_nguoi_thue_phong(uuid_an_toan((storage.foldername(name))[1])));

-- Biên lai & ảnh sự cố: nhân sự + người thuê phòng đó được xem/tải lên; chỉ nhân sự được xóa
CREATE POLICY phong_tep_xem ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('bien-lai', 'anh-su-co')
    AND (la_nhan_su_phong(uuid_an_toan((storage.foldername(name))[1])) OR la_nguoi_thue_phong(uuid_an_toan((storage.foldername(name))[1]))));
CREATE POLICY phong_tep_them ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('bien-lai', 'anh-su-co')
    AND (la_nhan_su_phong(uuid_an_toan((storage.foldername(name))[1])) OR la_nguoi_thue_phong(uuid_an_toan((storage.foldername(name))[1]))));
CREATE POLICY phong_tep_xoa ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('bien-lai', 'anh-su-co') AND la_nhan_su_phong(uuid_an_toan((storage.foldername(name))[1])));

GRANT SELECT ON tong_quan_phong TO authenticated;
