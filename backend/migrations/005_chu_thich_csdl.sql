-- Migration: 005_chu_thich_csdl.sql
-- Chú thích tiếng Việt cho bảng/cột/view (hiện trong Supabase Studio và pgAdmin).
-- File này được sinh từ cùng nguồn với docs/co-so-du-lieu.md; sửa mô tả thì sửa cả hai.

COMMENT ON TABLE nguoi_dung IS 'Hồ sơ người dùng, gắn 1-1 với tài khoản đăng nhập (auth.users). Tự tạo khi có tài khoản mới.';
COMMENT ON COLUMN nguoi_dung.id IS 'Mã người dùng = id tài khoản Supabase Auth';
COMMENT ON COLUMN nguoi_dung.so_dien_thoai IS 'Số điện thoại dạng 0901234567 (dùng để đăng nhập)';
COMMENT ON COLUMN nguoi_dung.ho_ten IS 'Họ và tên';
COMMENT ON COLUMN nguoi_dung.cccd IS 'Số căn cước công dân';
COMMENT ON COLUMN nguoi_dung.vai_tro IS 'quan_tri | chu_tro | quan_ly | nguoi_thue (mặc định nguoi_thue, chỉ quản trị mới đổi được)';
COMMENT ON COLUMN nguoi_dung.anh_dai_dien IS 'Đường dẫn ảnh đại diện';
COMMENT ON COLUMN nguoi_dung.dang_hoat_dong IS 'false = khóa tài khoản';
COMMENT ON COLUMN nguoi_dung.tao_luc IS 'Thời điểm tạo';

COMMENT ON TABLE khu_tro IS 'Khu nhà trọ / căn hộ dịch vụ. Một chủ trọ có thể có nhiều khu.';
COMMENT ON COLUMN khu_tro.id IS 'Mã khu';
COMMENT ON COLUMN khu_tro.ten IS 'Tên khu trọ';
COMMENT ON COLUMN khu_tro.dia_chi IS 'Địa chỉ';
COMMENT ON COLUMN khu_tro.so_tang IS 'Số tầng';
COMMENT ON COLUMN khu_tro.don_gia_dien IS 'Đơn giá điện (đ/kWh), áp dụng cho mọi phòng trong khu';
COMMENT ON COLUMN khu_tro.don_gia_nuoc IS 'Đơn giá nước (đ/m³), áp dụng cho mọi phòng trong khu';
COMMENT ON COLUMN khu_tro.phi_internet IS 'Phí internet mặc định (chưa dùng trong tính hóa đơn; dùng bảng phi_dich_vu)';
COMMENT ON COLUMN khu_tro.chu_tro_id IS 'Chủ trọ sở hữu khu -> nguoi_dung';
COMMENT ON COLUMN khu_tro.ma_bin_ngan_hang IS 'Mã BIN ngân hàng nhận tiền để sinh VietQR (vd 970436 = Vietcombank)';
COMMENT ON COLUMN khu_tro.so_tai_khoan IS 'Số tài khoản nhận tiền';
COMMENT ON COLUMN khu_tro.ten_tai_khoan IS 'Tên chủ tài khoản (viết hoa không dấu)';
COMMENT ON COLUMN khu_tro.so_ngay_nhac_truoc IS 'Nhắc trước hạn bao nhiêu ngày (0 = tắt), mặc định 3';
COMMENT ON COLUMN khu_tro.so_ngay_lap_nhac_qua_han IS 'Quá hạn thì nhắc lại mỗi bao nhiêu ngày, mặc định 3';
COMMENT ON COLUMN khu_tro.tao_luc IS 'Thời điểm tạo';
COMMENT ON COLUMN khu_tro.cap_nhat_luc IS 'Lần sửa gần nhất';

COMMENT ON TABLE nhan_su_khu_tro IS 'Gán người quản lý (vai_tro = quan_ly) vào từng khu trọ.';
COMMENT ON COLUMN nhan_su_khu_tro.khu_tro_id IS 'Khu được gán';
COMMENT ON COLUMN nhan_su_khu_tro.nguoi_dung_id IS 'Người quản lý';

COMMENT ON TABLE phong_tro IS 'Phòng trọ trong một khu. Trạng thái tự đồng bộ theo hợp đồng.';
COMMENT ON COLUMN phong_tro.id IS 'Mã phòng';
COMMENT ON COLUMN phong_tro.khu_tro_id IS 'Khu chứa phòng';
COMMENT ON COLUMN phong_tro.so_phong IS 'Số/tên phòng (vd P101), duy nhất trong khu';
COMMENT ON COLUMN phong_tro.tang IS 'Tầng';
COMMENT ON COLUMN phong_tro.gia_thue_co_ban IS 'Giá thuê niêm yết (đ/tháng)';
COMMENT ON COLUMN phong_tro.tien_coc IS 'Tiền cọc niêm yết';
COMMENT ON COLUMN phong_tro.trang_thai IS 'trong | dang_thue | bao_tri';
COMMENT ON COLUMN phong_tro.dien_tich_m2 IS 'Diện tích (m²)';
COMMENT ON COLUMN phong_tro.so_nguoi_toi_da IS 'Số người ở tối đa';
COMMENT ON COLUMN phong_tro.ghi_chu IS 'Ghi chú';
COMMENT ON COLUMN phong_tro.tao_luc IS 'Thời điểm tạo';
COMMENT ON COLUMN phong_tro.cap_nhat_luc IS 'Lần sửa gần nhất';

COMMENT ON TABLE hop_dong IS 'Hợp đồng thuê. Mỗi phòng chỉ có tối đa 1 hợp đồng hieu_luc.';
COMMENT ON COLUMN hop_dong.id IS 'Mã hợp đồng';
COMMENT ON COLUMN hop_dong.phong_id IS 'Phòng thuê';
COMMENT ON COLUMN hop_dong.nguoi_thue_id IS 'Người thuê (đại diện)';
COMMENT ON COLUMN hop_dong.ngay_bat_dau IS 'Ngày bắt đầu';
COMMENT ON COLUMN hop_dong.ngay_ket_thuc IS 'Ngày kết thúc (trống = chưa xác định)';
COMMENT ON COLUMN hop_dong.gia_thue IS 'Giá thuê thực tế (đ/tháng)';
COMMENT ON COLUMN hop_dong.tien_coc IS 'Tiền cọc đã thu';
COMMENT ON COLUMN hop_dong.ngay_thanh_toan IS 'Ngày trong tháng phải đóng tiền (1-28); hạn = ngày này của tháng sau kỳ tính';
COMMENT ON COLUMN hop_dong.trang_thai IS 'hieu_luc | het_han | cham_dut';
COMMENT ON COLUMN hop_dong.so_nguoi_o IS 'Số người đang ở (tính phí theo đầu người)';
COMMENT ON COLUMN hop_dong.ghi_chu IS 'Ghi chú';
COMMENT ON COLUMN hop_dong.tao_luc IS 'Thời điểm tạo';

COMMENT ON TABLE phi_dich_vu IS 'Danh mục phí dịch vụ cố định của khu (rác, wifi, gửi xe...).';
COMMENT ON COLUMN phi_dich_vu.id IS 'Mã phí';
COMMENT ON COLUMN phi_dich_vu.khu_tro_id IS 'Khu áp dụng';
COMMENT ON COLUMN phi_dich_vu.ten IS 'Tên phí';
COMMENT ON COLUMN phi_dich_vu.so_tien IS 'Số tiền một đơn vị';
COMMENT ON COLUMN phi_dich_vu.cach_tinh IS 'theo_phong (1 lần/phòng) | theo_nguoi (x số người ở) | theo_don_vi (x so_luong trong dich_vu_hop_dong)';
COMMENT ON COLUMN phi_dich_vu.dang_hoat_dong IS 'false = ngừng thu';

COMMENT ON TABLE dich_vu_hop_dong IS 'Phí dịch vụ mà từng hợp đồng đăng ký.';
COMMENT ON COLUMN dich_vu_hop_dong.hop_dong_id IS 'Hợp đồng';
COMMENT ON COLUMN dich_vu_hop_dong.phi_dich_vu_id IS 'Phí dịch vụ';
COMMENT ON COLUMN dich_vu_hop_dong.so_luong IS 'Số lượng (vd số xe)';

COMMENT ON TABLE chi_so_cong_to IS 'Chỉ số công tơ điện/nước theo tháng, kèm ảnh bằng chứng. chi_so_cu tự lấy từ kỳ trước nếu để 0.';
COMMENT ON COLUMN chi_so_cong_to.id IS 'Mã bản ghi';
COMMENT ON COLUMN chi_so_cong_to.phong_id IS 'Phòng';
COMMENT ON COLUMN chi_so_cong_to.loai IS 'dien | nuoc';
COMMENT ON COLUMN chi_so_cong_to.ky IS 'Kỳ tính tiền = ngày 1 của tháng';
COMMENT ON COLUMN chi_so_cong_to.chi_so_cu IS 'Chỉ số kỳ trước';
COMMENT ON COLUMN chi_so_cong_to.chi_so_moi IS 'Chỉ số kỳ này (>= chi_so_cu)';
COMMENT ON COLUMN chi_so_cong_to.so_tieu_thu IS 'Tiêu thụ = chi_so_moi - chi_so_cu (tự tính)';
COMMENT ON COLUMN chi_so_cong_to.duong_dan_anh IS 'Đường dẫn ảnh công tơ trong bucket anh-cong-to';
COMMENT ON COLUMN chi_so_cong_to.bat_thuong IS 'true nếu tiêu thụ > 2 lần trung bình 3 kỳ gần nhất hoặc bằng 0';
COMMENT ON COLUMN chi_so_cong_to.ly_do_bat_thuong IS 'Giải thích cảnh báo';
COMMENT ON COLUMN chi_so_cong_to.nguoi_ghi_id IS 'Người ghi chỉ số';
COMMENT ON COLUMN chi_so_cong_to.tao_luc IS 'Thời điểm ghi';

COMMENT ON TABLE hoa_don IS 'Hóa đơn tháng của một hợp đồng. Sinh bằng tao_hoa_don() ở dạng nháp, phát hành bằng phat_hanh_hoa_don().';
COMMENT ON COLUMN hoa_don.id IS 'Mã hóa đơn';
COMMENT ON COLUMN hoa_don.phong_id IS 'Phòng';
COMMENT ON COLUMN hoa_don.hop_dong_id IS 'Hợp đồng';
COMMENT ON COLUMN hoa_don.thang_nam IS 'Kỳ dạng MM/YYYY (để hiển thị)';
COMMENT ON COLUMN hoa_don.ky IS 'Kỳ dạng ngày (ngày 1 của tháng) - dùng để lọc/sắp xếp';
COMMENT ON COLUMN hoa_don.tien_phong IS 'Tiền phòng';
COMMENT ON COLUMN hoa_don.chi_so_dien_cu IS 'Chỉ số điện cũ';
COMMENT ON COLUMN hoa_don.chi_so_dien_moi IS 'Chỉ số điện mới';
COMMENT ON COLUMN hoa_don.tien_dien IS 'Tiền điện = so_tieu_thu × khu_tro.don_gia_dien';
COMMENT ON COLUMN hoa_don.chi_so_nuoc_cu IS 'Chỉ số nước cũ';
COMMENT ON COLUMN hoa_don.chi_so_nuoc_moi IS 'Chỉ số nước mới';
COMMENT ON COLUMN hoa_don.tien_nuoc IS 'Tiền nước';
COMMENT ON COLUMN hoa_don.phi_khac IS 'Tổng phí dịch vụ (bằng tien_dich_vu)';
COMMENT ON COLUMN hoa_don.tien_dich_vu IS 'Tổng phí dịch vụ cố định';
COMMENT ON COLUMN hoa_don.tong_tien IS 'Tổng phải trả';
COMMENT ON COLUMN hoa_don.han_thanh_toan IS 'Hạn đóng tiền';
COMMENT ON COLUMN hoa_don.trang_thai_thanh_toan IS 'chua_thanh_toan | cho_xac_nhan | thanh_toan_mot_phan | da_thanh_toan | qua_han';
COMMENT ON COLUMN hoa_don.vietqr_url IS 'Link ảnh VietQR (frontend sinh, có thể để trống)';
COMMENT ON COLUMN hoa_don.noi_dung_chuyen_khoan IS 'Nội dung chuyển khoản gợi ý, vd PHONGP101 T10';
COMMENT ON COLUMN hoa_don.la_ban_nhap IS 'true = chưa phát hành, người thuê chưa thấy';
COMMENT ON COLUMN hoa_don.thanh_toan_luc IS 'Thời điểm thu đủ tiền';
COMMENT ON COLUMN hoa_don.tao_luc IS 'Thời điểm tạo';
COMMENT ON COLUMN hoa_don.cap_nhat_luc IS 'Lần sửa gần nhất';

COMMENT ON TABLE chi_tiet_hoa_don IS 'Các dòng chi tiết của hóa đơn (tiền phòng, điện, nước, từng phí dịch vụ).';
COMMENT ON COLUMN chi_tiet_hoa_don.id IS 'Mã dòng';
COMMENT ON COLUMN chi_tiet_hoa_don.hoa_don_id IS 'Hóa đơn';
COMMENT ON COLUMN chi_tiet_hoa_don.dien_giai IS 'Diễn giải dòng';
COMMENT ON COLUMN chi_tiet_hoa_don.so_luong IS 'Số lượng';
COMMENT ON COLUMN chi_tiet_hoa_don.don_gia IS 'Đơn giá';
COMMENT ON COLUMN chi_tiet_hoa_don.so_tien IS 'Thành tiền';

COMMENT ON TABLE thanh_toan IS 'Biên lai/ủy nhiệm chi người thuê gửi lên để chủ trọ duyệt.';
COMMENT ON COLUMN thanh_toan.id IS 'Mã thanh toán';
COMMENT ON COLUMN thanh_toan.hoa_don_id IS 'Hóa đơn';
COMMENT ON COLUMN thanh_toan.so_tien IS 'Số tiền đã chuyển';
COMMENT ON COLUMN thanh_toan.duong_dan_bien_lai IS 'Đường dẫn ảnh biên lai trong bucket bien-lai';
COMMENT ON COLUMN thanh_toan.trang_thai IS 'cho_duyet | da_duyet | tu_choi';
COMMENT ON COLUMN thanh_toan.nguoi_gui_id IS 'Người gửi biên lai';
COMMENT ON COLUMN thanh_toan.nguoi_duyet_id IS 'Người duyệt (tự điền)';
COMMENT ON COLUMN thanh_toan.duyet_luc IS 'Thời điểm duyệt (tự điền)';
COMMENT ON COLUMN thanh_toan.ly_do_tu_choi IS 'Lý do từ chối';
COMMENT ON COLUMN thanh_toan.tao_luc IS 'Thời điểm gửi';

COMMENT ON TABLE su_co IS 'Sự cố/báo hỏng thiết bị do người thuê báo.';
COMMENT ON COLUMN su_co.id IS 'Mã sự cố';
COMMENT ON COLUMN su_co.phong_id IS 'Phòng';
COMMENT ON COLUMN su_co.nguoi_thue_id IS 'Người báo';
COMMENT ON COLUMN su_co.tieu_de IS 'Tiêu đề ngắn';
COMMENT ON COLUMN su_co.mo_ta IS 'Mô tả chi tiết';
COMMENT ON COLUMN su_co.anh_urls IS 'Danh sách đường dẫn ảnh trong bucket anh-su-co';
COMMENT ON COLUMN su_co.chi_phi_sua_chua IS 'Chi phí sửa (chỉ nhân sự khu được sửa)';
COMMENT ON COLUMN su_co.trang_thai IS 'cho_tiep_nhan | dang_xu_ly | hoan_tat | da_huy';
COMMENT ON COLUMN su_co.phan_loai IS 'dien | nuoc | may_lanh | noi_that | mang | khac';
COMMENT ON COLUMN su_co.tao_luc IS 'Thời điểm báo';
COMMENT ON COLUMN su_co.hoan_tat_luc IS 'Thời điểm hoàn tất (tự điền)';
COMMENT ON COLUMN su_co.cap_nhat_luc IS 'Lần sửa gần nhất';

COMMENT ON TABLE lich_su_su_co IS 'Lịch sử đổi trạng thái của sự cố (trigger tự ghi).';
COMMENT ON COLUMN lich_su_su_co.id IS 'Mã';
COMMENT ON COLUMN lich_su_su_co.su_co_id IS 'Sự cố';
COMMENT ON COLUMN lich_su_su_co.tu_trang_thai IS 'Trạng thái trước (trống = vừa tạo)';
COMMENT ON COLUMN lich_su_su_co.den_trang_thai IS 'Trạng thái sau';
COMMENT ON COLUMN lich_su_su_co.ghi_chu IS 'Ghi chú';
COMMENT ON COLUMN lich_su_su_co.nguoi_thuc_hien_id IS 'Người thực hiện';
COMMENT ON COLUMN lich_su_su_co.tao_luc IS 'Thời điểm';

COMMENT ON TABLE thong_bao IS 'Hộp thư trong app; mỗi dòng là một thông báo gửi cho một người. Insert vào đây sẽ kích hoạt Web Push (qua webhook).';
COMMENT ON COLUMN thong_bao.id IS 'Mã thông báo';
COMMENT ON COLUMN thong_bao.nguoi_nhan_id IS 'Người nhận';
COMMENT ON COLUMN thong_bao.loai IS 'hoa_don_sap_den_han | hoa_don_den_han | hoa_don_qua_han | thanh_toan | su_co | thong_bao_chung';
COMMENT ON COLUMN thong_bao.tieu_de IS 'Tiêu đề';
COMMENT ON COLUMN thong_bao.noi_dung IS 'Nội dung';
COMMENT ON COLUMN thong_bao.duong_dan IS 'Đường dẫn trong app khi bấm vào, vd /billing/<id>';
COMMENT ON COLUMN thong_bao.du_lieu IS 'Dữ liệu kèm theo (JSON)';
COMMENT ON COLUMN thong_bao.doc_luc IS 'Thời điểm đã đọc (trống = chưa đọc)';
COMMENT ON COLUMN thong_bao.da_gui_push_luc IS 'Đã đẩy Web Push lúc nào (chống gửi trùng)';
COMMENT ON COLUMN thong_bao.tao_luc IS 'Thời điểm tạo';

COMMENT ON TABLE thong_bao_chung IS 'Thông báo hàng loạt của chủ trọ (toàn khu / theo tầng / theo phòng). Tạo bằng gui_thong_bao_chung().';
COMMENT ON COLUMN thong_bao_chung.id IS 'Mã';
COMMENT ON COLUMN thong_bao_chung.khu_tro_id IS 'Khu';
COMMENT ON COLUMN thong_bao_chung.nguoi_tao_id IS 'Người gửi';
COMMENT ON COLUMN thong_bao_chung.tieu_de IS 'Tiêu đề';
COMMENT ON COLUMN thong_bao_chung.noi_dung IS 'Nội dung';
COMMENT ON COLUMN thong_bao_chung.pham_vi IS 'tat_ca | tang | phong';
COMMENT ON COLUMN thong_bao_chung.cac_tang IS 'Các tầng nhận (khi pham_vi = tang)';
COMMENT ON COLUMN thong_bao_chung.cac_phong_id IS 'Các phòng nhận (khi pham_vi = phong)';
COMMENT ON COLUMN thong_bao_chung.so_nguoi_nhan IS 'Số người nhận thực tế';
COMMENT ON COLUMN thong_bao_chung.tao_luc IS 'Thời điểm gửi';

COMMENT ON TABLE dang_ky_push IS 'Thiết bị đã đăng ký nhận Web Push của từng người dùng.';
COMMENT ON COLUMN dang_ky_push.id IS 'Mã';
COMMENT ON COLUMN dang_ky_push.nguoi_dung_id IS 'Chủ thiết bị';
COMMENT ON COLUMN dang_ky_push.endpoint IS 'Endpoint của PushSubscription';
COMMENT ON COLUMN dang_ky_push.p256dh IS 'Khóa công khai p256dh';
COMMENT ON COLUMN dang_ky_push.khoa_auth IS 'Khóa auth của PushSubscription';
COMMENT ON COLUMN dang_ky_push.trinh_duyet IS 'User-Agent';
COMMENT ON COLUMN dang_ky_push.tao_luc IS 'Thời điểm đăng ký';

COMMENT ON TABLE nhat_ky_nhac_no IS 'Nhật ký nhắc nợ, chống nhắc trùng (duy nhất theo hóa đơn + loại + ngày). Chỉ Edge Function đọc/ghi.';
COMMENT ON COLUMN nhat_ky_nhac_no.id IS 'Mã';
COMMENT ON COLUMN nhat_ky_nhac_no.hoa_don_id IS 'Hóa đơn';
COMMENT ON COLUMN nhat_ky_nhac_no.loai IS 'sap_den_han | den_han | qua_han';
COMMENT ON COLUMN nhat_ky_nhac_no.ngay_gui IS 'Ngày nhắc (giờ Việt Nam)';
COMMENT ON COLUMN nhat_ky_nhac_no.tao_luc IS 'Thời điểm ghi';

COMMENT ON VIEW tong_quan_phong IS 'View cho màn hình danh sách phòng: mọi cột của phong_tro + hợp đồng/người thuê hiện tại + co_no_qua_han + so_su_co_dang_mo + trang_thai_hien_thi (trong | dang_thue | no_tien | co_su_co | bao_tri) để tô màu.';
