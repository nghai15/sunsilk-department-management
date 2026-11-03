# Từ điển cơ sở dữ liệu

Toàn bộ tên bảng, cột, hàm và giá trị trạng thái đều bằng tiếng Việt không dấu. Mô tả cũng có sẵn trong Supabase Studio (migration `005_chu_thich_csdl.sql`, cập nhật nghiệp vụ sự cố ở migration `006_quy_trinh_xu_ly_su_co.sql`).

## Quy ước đặt tên

- Bảng và cột: `snake_case` tiếng Việt không dấu. Khóa chính luôn là `id` (uuid); khóa ngoại là `<bảng>_id`, riêng người thì `nguoi_<vai trò>_id`.
- Thời điểm: hậu tố `_luc` (`tao_luc`, `cap_nhat_luc`, `doc_luc`). Cờ đúng/sai: tiền tố `la_` hoặc `dang_`/`da_`.
- Tiền: kiểu `DECIMAL`, đơn vị đồng. Ngày: `DATE`; giờ: `TIMESTAMPTZ`.
- Giữ nguyên tiếng Anh những thứ thuộc chuẩn bên ngoài: `id`, `endpoint`, `p256dh`, `auth.users`, `auth.uid()` của Supabase, khóa `title/body/data/url` trong payload Web Push (service worker đọc).

## Giá trị trạng thái (thay cho tiếng Anh cũ)

| Cột | Giá trị |
|---|---|
| `nguoi_dung.vai_tro` | `quan_tri` (admin) · `chu_tro` (landlord) · `quan_ly` (manager) · `nguoi_thue` (tenant) |
| `phong_tro.trang_thai` | `trong` (available) · `dang_thue` (occupied) · `bao_tri` (maintenance) |
| `hop_dong.trang_thai` | `hieu_luc` · `het_han` · `cham_dut` |
| `hoa_don.trang_thai_thanh_toan` | `chua_thanh_toan` · `cho_xac_nhan` · `thanh_toan_mot_phan` · `da_thanh_toan` · `qua_han` |
| `thanh_toan.trang_thai` | `cho_duyet` · `da_duyet` · `tu_choi` |
| `su_co.trang_thai` | `cho_tiep_nhan` (Chờ tiếp nhận) · `dang_xu_ly` (Đang xử lý) · `chua_the_xu_ly` (Chưa thể xử lý) · `hoan_tat` (Đã xử lý) · `da_huy` (Đã hủy) |
| `su_co.phan_loai` | `dien` · `nuoc` · `may_lanh` · `noi_that` · `mang` · `khac` |
| `chi_so_cong_to.loai` | `dien` · `nuoc` |
| `phi_dich_vu.cach_tinh` | `theo_phong` · `theo_nguoi` · `theo_don_vi` |
| `thong_bao.loai` | `hoa_don_sap_den_han` · `hoa_don_den_han` · `hoa_don_qua_han` · `thanh_toan` · `su_co` · `thong_bao_chung` |
| `thong_bao_chung.pham_vi` | `tat_ca` · `tang` · `phong` |
| `nhat_ky_nhac_no.loai` | `sap_den_han` · `den_han` · `qua_han` |

## Bảng đối chiếu tên cũ -> mới

| Cũ (tiếng Anh) | Mới |
|---|---|
| `users` | `nguoi_dung` |
| `properties` | `khu_tro` |
| `property_staff` | `nhan_su_khu_tro` |
| `rooms` | `phong_tro` |
| `contracts` | `hop_dong` |
| `service_fees` | `phi_dich_vu` |
| `contract_services` | `dich_vu_hop_dong` |
| `meter_readings` | `chi_so_cong_to` |
| `bills` | `hoa_don` |
| `bill_items` | `chi_tiet_hoa_don` |
| `payments` | `thanh_toan` |
| `issues` | `su_co` |
| `issue_events` | `lich_su_su_co` |
| `notifications` | `thong_bao` |
| `announcements` | `thong_bao_chung` |
| `push_subscriptions` | `dang_ky_push` |
| `reminder_log` | `nhat_ky_nhac_no` |
| `room_overview` | `tong_quan_phong` |
| `generate_bill()` | `tao_hoa_don()` |
| `publish_bill()` | `phat_hanh_hoa_don()` |
| `send_announcement()` | `gui_thong_bao_chung()` |
| `dashboard_summary()` | `tong_quan_dashboard()` |
| `mark_overdue_bills()` | `danh_dau_hoa_don_qua_han()` |
| `notify_users()` | `gui_thong_bao()` |
| `bills.month_year` | `hoa_don.thang_nam` |
| `bills.payment_status` | `hoa_don.trang_thai_thanh_toan` |
| `rooms.room_number` | `phong_tro.so_phong` |
| `users.phone / full_name` | `nguoi_dung.so_dien_thoai / ho_ten` |

## Hàm (RPC) gọi từ frontend

| Hàm | Công dụng |
|---|---|
| `tao_hoa_don(p_hop_dong_id uuid, p_ky date)` | Tạo/tạo lại hóa đơn NHÁP từ chỉ số điện+nước (đơn giá phẳng của khu) và phí dịch vụ. Lỗi nếu thiếu chỉ số hoặc hóa đơn đã phát hành/đã có thanh toán. |
| `phat_hanh_hoa_don(p_hoa_don_id uuid)` | Phát hành hóa đơn nháp: người thuê thấy và nhận thông báo. |
| `gui_thong_bao_chung(p_khu_tro_id, p_tieu_de, p_noi_dung, p_pham_vi, p_cac_tang, p_cac_phong_id)` | Gửi thông báo cho toàn khu / theo tầng / theo phòng. |
| `tong_quan_dashboard(p_khu_tro_id uuid, p_ky date default null)` | JSON tổng quan: phòng trống/đang thuê, đã thu/còn nợ, hóa đơn quá hạn, sự cố đang mở. |
| `cap_nhat_xu_ly_su_co(p_su_co_id uuid, p_trang_thai text, p_ghi_chu_xu_ly text default null, p_chi_phi_sua_chua numeric default null)` | Nhân sự cập nhật sự cố trong khu có quyền. Trạng thái chưa thể xử lý bắt buộc có lý do; tự ghi lịch sử và thông báo người thuê. |
| `danh_dau_hoa_don_qua_han()` | Đánh dấu hóa đơn quá hạn (chỉ Edge Function/service role gọi). |
| `gui_thong_bao(...)` | Tạo thông báo hàng loạt (chỉ trigger và service role gọi). |

## Bảng và cột

### `nguoi_dung`

Hồ sơ người dùng, gắn 1-1 với tài khoản đăng nhập (auth.users). Tự tạo khi có tài khoản mới.

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã người dùng = id tài khoản Supabase Auth |
| `so_dien_thoai` | Số điện thoại dạng 0901234567 (dùng để đăng nhập) |
| `ho_ten` | Họ và tên |
| `cccd` | Số căn cước công dân |
| `vai_tro` | quan_tri | chu_tro | quan_ly | nguoi_thue (mặc định nguoi_thue, chỉ quản trị mới đổi được) |
| `anh_dai_dien` | Đường dẫn ảnh đại diện |
| `dang_hoat_dong` | false = khóa tài khoản |
| `tao_luc` | Thời điểm tạo |

### `khu_tro`

Khu nhà trọ / căn hộ dịch vụ. Một chủ trọ có thể có nhiều khu.

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã khu |
| `ten` | Tên khu trọ |
| `dia_chi` | Địa chỉ |
| `so_tang` | Số tầng |
| `don_gia_dien` | Đơn giá điện (đ/kWh), áp dụng cho mọi phòng trong khu |
| `don_gia_nuoc` | Đơn giá nước (đ/m³), áp dụng cho mọi phòng trong khu |
| `phi_internet` | Phí internet mặc định (chưa dùng trong tính hóa đơn; dùng bảng phi_dich_vu) |
| `chu_tro_id` | Chủ trọ sở hữu khu -> nguoi_dung |
| `ma_bin_ngan_hang` | Mã BIN ngân hàng nhận tiền để sinh VietQR (vd 970436 = Vietcombank) |
| `so_tai_khoan` | Số tài khoản nhận tiền |
| `ten_tai_khoan` | Tên chủ tài khoản (viết hoa không dấu) |
| `so_ngay_nhac_truoc` | Nhắc trước hạn bao nhiêu ngày (0 = tắt), mặc định 3 |
| `so_ngay_lap_nhac_qua_han` | Quá hạn thì nhắc lại mỗi bao nhiêu ngày, mặc định 3 |
| `tao_luc` | Thời điểm tạo |
| `cap_nhat_luc` | Lần sửa gần nhất |

### `nhan_su_khu_tro`

Gán người quản lý (vai_tro = quan_ly) vào từng khu trọ.

| Cột | Ý nghĩa |
|---|---|
| `khu_tro_id` | Khu được gán |
| `nguoi_dung_id` | Người quản lý |

### `phong_tro`

Phòng trọ trong một khu. Trạng thái tự đồng bộ theo hợp đồng.

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã phòng |
| `khu_tro_id` | Khu chứa phòng |
| `so_phong` | Số/tên phòng (vd P101), duy nhất trong khu |
| `tang` | Tầng |
| `gia_thue_co_ban` | Giá thuê niêm yết (đ/tháng) |
| `tien_coc` | Tiền cọc niêm yết |
| `trang_thai` | trong | dang_thue | bao_tri |
| `dien_tich_m2` | Diện tích (m²) |
| `so_nguoi_toi_da` | Số người ở tối đa |
| `ghi_chu` | Ghi chú |
| `tao_luc` | Thời điểm tạo |
| `cap_nhat_luc` | Lần sửa gần nhất |

### `hop_dong`

Hợp đồng thuê. Mỗi phòng chỉ có tối đa 1 hợp đồng hieu_luc.

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã hợp đồng |
| `phong_id` | Phòng thuê |
| `nguoi_thue_id` | Người thuê (đại diện) |
| `ngay_bat_dau` | Ngày bắt đầu |
| `ngay_ket_thuc` | Ngày kết thúc (trống = chưa xác định) |
| `gia_thue` | Giá thuê thực tế (đ/tháng) |
| `tien_coc` | Tiền cọc đã thu |
| `ngay_thanh_toan` | Ngày trong tháng phải đóng tiền (1-28); hạn = ngày này của tháng sau kỳ tính |
| `trang_thai` | hieu_luc | het_han | cham_dut |
| `so_nguoi_o` | Số người đang ở (tính phí theo đầu người) |
| `ghi_chu` | Ghi chú |
| `tao_luc` | Thời điểm tạo |

### `phi_dich_vu`

Danh mục phí dịch vụ cố định của khu (rác, wifi, gửi xe...).

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã phí |
| `khu_tro_id` | Khu áp dụng |
| `ten` | Tên phí |
| `so_tien` | Số tiền một đơn vị |
| `cach_tinh` | theo_phong (1 lần/phòng) | theo_nguoi (x số người ở) | theo_don_vi (x so_luong trong dich_vu_hop_dong) |
| `dang_hoat_dong` | false = ngừng thu |

### `dich_vu_hop_dong`

Phí dịch vụ mà từng hợp đồng đăng ký.

| Cột | Ý nghĩa |
|---|---|
| `hop_dong_id` | Hợp đồng |
| `phi_dich_vu_id` | Phí dịch vụ |
| `so_luong` | Số lượng (vd số xe) |

### `chi_so_cong_to`

Chỉ số công tơ điện/nước theo tháng, kèm ảnh bằng chứng. chi_so_cu tự lấy từ kỳ trước nếu để 0.

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã bản ghi |
| `phong_id` | Phòng |
| `loai` | dien | nuoc |
| `ky` | Kỳ tính tiền = ngày 1 của tháng |
| `chi_so_cu` | Chỉ số kỳ trước |
| `chi_so_moi` | Chỉ số kỳ này (>= chi_so_cu) |
| `so_tieu_thu` | Tiêu thụ = chi_so_moi - chi_so_cu (tự tính) |
| `duong_dan_anh` | Đường dẫn ảnh công tơ trong bucket anh-cong-to |
| `bat_thuong` | true nếu tiêu thụ > 2 lần trung bình 3 kỳ gần nhất hoặc bằng 0 |
| `ly_do_bat_thuong` | Giải thích cảnh báo |
| `nguoi_ghi_id` | Người ghi chỉ số |
| `tao_luc` | Thời điểm ghi |

### `hoa_don`

Hóa đơn tháng của một hợp đồng. Sinh bằng tao_hoa_don() ở dạng nháp, phát hành bằng phat_hanh_hoa_don().

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã hóa đơn |
| `phong_id` | Phòng |
| `hop_dong_id` | Hợp đồng |
| `thang_nam` | Kỳ dạng MM/YYYY (để hiển thị) |
| `ky` | Kỳ dạng ngày (ngày 1 của tháng) - dùng để lọc/sắp xếp |
| `tien_phong` | Tiền phòng |
| `chi_so_dien_cu` | Chỉ số điện cũ |
| `chi_so_dien_moi` | Chỉ số điện mới |
| `tien_dien` | Tiền điện = so_tieu_thu × khu_tro.don_gia_dien |
| `chi_so_nuoc_cu` | Chỉ số nước cũ |
| `chi_so_nuoc_moi` | Chỉ số nước mới |
| `tien_nuoc` | Tiền nước |
| `phi_khac` | Tổng phí dịch vụ (bằng tien_dich_vu) |
| `tien_dich_vu` | Tổng phí dịch vụ cố định |
| `tong_tien` | Tổng phải trả |
| `han_thanh_toan` | Hạn đóng tiền |
| `trang_thai_thanh_toan` | chua_thanh_toan | cho_xac_nhan | thanh_toan_mot_phan | da_thanh_toan | qua_han |
| `vietqr_url` | Link ảnh VietQR (frontend sinh, có thể để trống) |
| `noi_dung_chuyen_khoan` | Nội dung chuyển khoản gợi ý, vd PHONGP101 T10 |
| `la_ban_nhap` | true = chưa phát hành, người thuê chưa thấy |
| `thanh_toan_luc` | Thời điểm thu đủ tiền |
| `tao_luc` | Thời điểm tạo |
| `cap_nhat_luc` | Lần sửa gần nhất |

### `chi_tiet_hoa_don`

Các dòng chi tiết của hóa đơn (tiền phòng, điện, nước, từng phí dịch vụ).

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã dòng |
| `hoa_don_id` | Hóa đơn |
| `dien_giai` | Diễn giải dòng |
| `so_luong` | Số lượng |
| `don_gia` | Đơn giá |
| `so_tien` | Thành tiền |

### `thanh_toan`

Biên lai/ủy nhiệm chi người thuê gửi lên để chủ trọ duyệt.

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã thanh toán |
| `hoa_don_id` | Hóa đơn |
| `so_tien` | Số tiền đã chuyển |
| `duong_dan_bien_lai` | Đường dẫn ảnh biên lai trong bucket bien-lai |
| `trang_thai` | cho_duyet | da_duyet | tu_choi |
| `nguoi_gui_id` | Người gửi biên lai |
| `nguoi_duyet_id` | Người duyệt (tự điền) |
| `duyet_luc` | Thời điểm duyệt (tự điền) |
| `ly_do_tu_choi` | Lý do từ chối |
| `tao_luc` | Thời điểm gửi |

### `su_co`

Sự cố/báo hỏng thiết bị do người thuê báo. Quản lý xử lý trong khu được giao; chủ trọ/quản trị có thể giám sát và can thiệp theo phạm vi hiện có. Trạng thái `chua_the_xu_ly` vẫn là sự cố đang mở.

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã sự cố |
| `phong_id` | Phòng |
| `nguoi_thue_id` | Người báo |
| `tieu_de` | Tiêu đề ngắn |
| `mo_ta` | Mô tả chi tiết |
| `anh_urls` | Danh sách đường dẫn ảnh trong bucket anh-su-co |
| `chi_phi_sua_chua` | Chi phí sửa (chỉ nhân sự khu được sửa) |
| `ghi_chu_xu_ly` | Ghi chú tiến độ/kết quả; bắt buộc có lý do khi chưa thể xử lý |
| `trang_thai` | `cho_tiep_nhan` · `dang_xu_ly` · `chua_the_xu_ly` · `hoan_tat` (Đã xử lý) · `da_huy` |
| `phan_loai` | dien | nuoc | may_lanh | noi_that | mang | khac |
| `tao_luc` | Thời điểm báo |
| `hoan_tat_luc` | Thời điểm hoàn tất (tự điền) |
| `cap_nhat_luc` | Lần sửa gần nhất |

### `lich_su_su_co`

Lịch sử đổi trạng thái, ghi chú và chi phí của sự cố (trigger tự ghi người thực hiện và thời gian). Đổi ghi chú/chi phí mà giữ nguyên trạng thái vẫn có lịch sử; khi đó `tu_trang_thai` bằng `den_trang_thai`.

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã |
| `su_co_id` | Sự cố |
| `tu_trang_thai` | Trạng thái trước (trống = vừa tạo) |
| `den_trang_thai` | Trạng thái sau |
| `ghi_chu` | Ghi chú |
| `chi_phi_sua_chua` | Chi phí tại thời điểm cập nhật; NULL với lịch sử cũ chưa lưu chi phí |
| `nguoi_thuc_hien_id` | Người thực hiện |
| `tao_luc` | Thời điểm |

### `thong_bao`

Hộp thư trong app; mỗi dòng là một thông báo gửi cho một người. Insert vào đây sẽ kích hoạt Web Push (qua webhook).

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã thông báo |
| `nguoi_nhan_id` | Người nhận |
| `loai` | hoa_don_sap_den_han | hoa_don_den_han | hoa_don_qua_han | thanh_toan | su_co | thong_bao_chung |
| `tieu_de` | Tiêu đề |
| `noi_dung` | Nội dung |
| `duong_dan` | Đường dẫn trong app khi bấm vào, vd /billing/<id> |
| `du_lieu` | Dữ liệu kèm theo (JSON) |
| `doc_luc` | Thời điểm đã đọc (trống = chưa đọc) |
| `da_gui_push_luc` | Đã đẩy Web Push lúc nào (chống gửi trùng) |
| `tao_luc` | Thời điểm tạo |

### `thong_bao_chung`

Thông báo hàng loạt của chủ trọ (toàn khu / theo tầng / theo phòng). Tạo bằng gui_thong_bao_chung().

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã |
| `khu_tro_id` | Khu |
| `nguoi_tao_id` | Người gửi |
| `tieu_de` | Tiêu đề |
| `noi_dung` | Nội dung |
| `pham_vi` | tat_ca | tang | phong |
| `cac_tang` | Các tầng nhận (khi pham_vi = tang) |
| `cac_phong_id` | Các phòng nhận (khi pham_vi = phong) |
| `so_nguoi_nhan` | Số người nhận thực tế |
| `tao_luc` | Thời điểm gửi |

### `dang_ky_push`

Thiết bị đã đăng ký nhận Web Push của từng người dùng.

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã |
| `nguoi_dung_id` | Chủ thiết bị |
| `endpoint` | Endpoint của PushSubscription |
| `p256dh` | Khóa công khai p256dh |
| `khoa_auth` | Khóa auth của PushSubscription |
| `trinh_duyet` | User-Agent |
| `tao_luc` | Thời điểm đăng ký |

### `nhat_ky_nhac_no`

Nhật ký nhắc nợ, chống nhắc trùng (duy nhất theo hóa đơn + loại + ngày). Chỉ Edge Function đọc/ghi.

| Cột | Ý nghĩa |
|---|---|
| `id` | Mã |
| `hoa_don_id` | Hóa đơn |
| `loai` | sap_den_han | den_han | qua_han |
| `ngay_gui` | Ngày nhắc (giờ Việt Nam) |
| `tao_luc` | Thời điểm ghi |

### View `tong_quan_phong`

View cho màn hình danh sách phòng: mọi cột của phong_tro + hợp đồng/người thuê hiện tại + co_no_qua_han + so_su_co_dang_mo + trang_thai_hien_thi (trong | dang_thue | no_tien | co_su_co | bao_tri) để tô màu.

`so_su_co_dang_mo` trong view và dashboard đếm cả `cho_tiep_nhan`, `dang_xu_ly`, `chua_the_xu_ly`.

