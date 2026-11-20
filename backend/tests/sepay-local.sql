\set ON_ERROR_STOP on
BEGIN;
-- Tất cả thay đổi trong phép thử được rollback, kể cả thông báo.
DO $$
DECLARE b hoa_don; k uuid; r jsonb; v_count int; v_amount numeric; v_status text; v_owner uuid; v_cols text; v_new uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO b FROM hoa_don ORDER BY tao_luc LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cần seed local có ít nhất một hóa đơn'; END IF;
 SELECT khu_tro_id INTO k FROM phong_tro WHERE id=b.phong_id;
 SELECT string_agg(quote_ident(attname),',') INTO v_cols FROM pg_attribute
 WHERE attrelid='public.hoa_don'::regclass AND attnum>0 AND NOT attisdropped AND attgenerated='';
 EXECUTE 'INSERT INTO hoa_don ('||v_cols||') SELECT '||v_cols||' FROM jsonb_populate_record(NULL::hoa_don,$1)' USING
 to_jsonb(b)||jsonb_build_object('id',v_new,'ky','2098-01-01','thang_nam','01/2098','la_ban_nhap',true,'tong_tien',100000,'trang_thai_thanh_toan','chua_thanh_toan','thanh_toan_luc',null);
 SELECT * INTO b FROM hoa_don WHERE id=v_new;
 UPDATE khu_tro SET thanh_toan_tu_dong=true,so_tai_khoan='TEST-SEPAY',ma_bin_ngan_hang='970436' WHERE id=k;
 UPDATE hoa_don SET la_ban_nhap=false,tong_tien=100000 WHERE id=b.id;
 PERFORM nhan_giao_dich_sepay(9000000000001,'970436','TEST-SEPAY',b.ma_thanh_toan,40000,b.ma_thanh_toan);
 SELECT trang_thai_thanh_toan INTO v_status FROM hoa_don WHERE id=b.id;
 ASSERT v_status='thanh_toan_mot_phan','Chuyển thiếu phải ghi nhận một phần';
 r:=nhan_giao_dich_sepay(9000000000001,'970436','TEST-SEPAY',b.ma_thanh_toan,40000,b.ma_thanh_toan);
 ASSERT (r->>'duplicate')::boolean,'Webhook lặp phải được nhận diện';
 SELECT count(*) INTO v_count FROM thanh_toan WHERE hoa_don_id=b.id;
 ASSERT v_count=1,'Không được ghi nhận hai lần';
 BEGIN
  PERFORM nhan_giao_dich_sepay(9000000000001,'970436','TEST-SEPAY',b.ma_thanh_toan,41000,b.ma_thanh_toan);
  RAISE EXCEPTION 'TEST FAILED: duplicate conflict accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='TEST FAILED: duplicate conflict accepted' THEN RAISE; END IF;
 END;
 PERFORM nhan_giao_dich_sepay(9000000000002,'970436','TEST-SEPAY',b.ma_thanh_toan,70000,b.ma_thanh_toan);
 SELECT trang_thai_thanh_toan INTO v_status FROM hoa_don WHERE id=b.id;
 ASSERT v_status='da_thanh_toan','Đủ tiền phải tự thanh toán';
 SELECT da_phan_bo INTO v_amount FROM giao_dich_ngan_hang WHERE id=9000000000002 AND trang_thai='can_doi_soat';
 ASSERT v_amount=60000,'Phải giữ riêng khoản dư';
 PERFORM nhan_giao_dich_sepay(9000000000003,'970436','TEST-SEPAY','Sai mã',10000,'');
 SELECT da_phan_bo INTO v_amount FROM giao_dich_ngan_hang WHERE id=9000000000003;
 ASSERT v_amount=0,'Không được đoán hóa đơn khi sai mã';
 PERFORM nhan_giao_dich_sepay(9000000000004,'970436','WRONG-ACCOUNT',b.ma_thanh_toan,10000,b.ma_thanh_toan);
 SELECT da_phan_bo INTO v_amount FROM giao_dich_ngan_hang WHERE id=9000000000004;
 ASSERT v_amount=0,'Không ghép sai tài khoản nhận';
 ALTER TABLE hoa_don DISABLE TRIGGER trg_hoa_don_khoa;
 UPDATE hoa_don SET la_ban_nhap=true WHERE id=b.id;
 ALTER TABLE hoa_don ENABLE TRIGGER trg_hoa_don_khoa;
 PERFORM nhan_giao_dich_sepay(9000000000005,'970436','TEST-SEPAY',b.ma_thanh_toan,10000,b.ma_thanh_toan);
 SELECT da_phan_bo INTO v_amount FROM giao_dich_ngan_hang WHERE id=9000000000005;
 ASSERT v_amount=0,'Không tự thanh toán hóa đơn nháp';
 ASSERT NOT has_function_privilege('authenticated','public.nhan_giao_dich_sepay(bigint,text,text,text,numeric,text)','EXECUTE'),'Người dùng không được giả lập tiền vào';
 ASSERT NOT has_function_privilege('authenticated','public.phan_bo_giao_dich(bigint,text)','EXECUTE'),'Không cho gọi thẳng hàm phân bổ';
 ASSERT NOT has_table_privilege('authenticated','public.giao_dich_ngan_hang','INSERT'),'Không cho tự thêm giao dịch';
 SELECT id INTO v_owner FROM nguoi_dung WHERE vai_tro='chu_tro' AND dang_hoat_dong LIMIT 1;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
 UPDATE hoa_don SET la_ban_nhap=false,tong_tien=120000 WHERE id=b.id;
 PERFORM doi_soat_giao_dich(9000000000003,b.ma_thanh_toan,'Đã kiểm tra giao dịch sai nội dung',false);
 SELECT da_phan_bo INTO v_amount FROM giao_dich_ngan_hang WHERE id=9000000000003;
 ASSERT v_amount=10000,'Chủ trọ phải ghép được giao dịch sai mã';
 PERFORM doi_soat_giao_dich(9000000000002,'','Đã hoàn khoản dư theo giao dịch kiểm thử',true);
 SELECT trang_thai INTO v_status FROM giao_dich_ngan_hang WHERE id=9000000000002;
 ASSERT v_status='da_xu_ly','Lưu kết quả xử lý khoản dư';
 RAISE NOTICE 'PASS: partial, paid, duplicate, conflict, excess, wrong memo/account, draft, privileges, reconciliation';
END $$;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 BEGIN
  UPDATE thanh_toan SET so_tien=1 WHERE giao_dich_ngan_hang_id=9000000000001;
  RAISE EXCEPTION 'TEST FAILED: bank payment modified';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
ROLLBACK;
