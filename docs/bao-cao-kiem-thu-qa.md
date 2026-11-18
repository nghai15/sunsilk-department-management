# BÁO CÁO KẾT QUẢ THỰC THI KIỂM THỬ HỆ THỐNG (QA TEST REPORT)

**Dự án:** Ứng dụng PWA Quản Lý Nhà Trọ  
**Người thực hiện:** Thành viên 6 (QA / UI-UX Specialist & Technical Writer)  
**Thời gian thực hiện:** 14/11/2026 – 18/11/2026  
**Phiên bản kiểm thử:** Release Candidate 1.0 (Nhánh `develop`)  
**Môi trường kiểm thử:**  
- **Thiết bị thật:** iPhone 13 (iOS 17.2, Safari), Xiaomi Redmi Note 12 (Android 13, Chrome 120), Samsung Galaxy A52 (Android 14).
- **Môi trường Web/PC:** Google Chrome 122 (Chế độ Device Emulation Responsive).
- **Hệ cơ sở dữ liệu:** PostgreSQL 15 / Supabase Local & Cloud Emulator.

---

## 1. TỔNG QUAN KẾT QUẢ KIỂM THỬ (EXECUTIVE SUMMARY)

| Chỉ số kiểm thử | Số lượng | Tỷ lệ (%) | Ghi chú |
| :--- | :---: | :---: | :--- |
| **Tổng số kịch bản kiểm thử (Test Cases)** | **25** | 100% | Bao phủ 7 phân hệ chính |
| **Kịch bản ĐẠT (Passed)** | **24** | **96.0%** | Hoạt động đúng yêu cầu đặc tả |
| **Kịch bản KHÔNG ĐẠT (Failed)** | **0** | **0.0%** | Không còn lỗi nghiêm trọng tồn đọng |
| **Kịch bản TẠM HOÃN (Deferred / Pending)** | **1** | **4.0%** | TC_NOTI_03 (Hộp thông báo in-app chờ TV5) |
| **Lỗi nghiêm trọng (Blocker/Critical)** | **0** | **0.0%** | Đã xử lý triệt để |

---

## 2. MA TRẬN KẾT QUẢ KIỂM THỬ CHI TIẾT THEO PHÂN HỆ

### 2.1 Phân hệ PWA, Service Worker & Web Push (TC_PWA)
- **TC_PWA_01 (Cài đặt PWA trên Android):** **PASSED**. Manifest `manifest.json` chuẩn `standalone`, icon maskable 192x192 và 512x512 hiển thị sắc nét, mở app không có thanh điều hướng trình duyệt.
- **TC_PWA_02 (Thêm PWA trên iOS Safari):** **PASSED**. Nhận diện tốt trên iOS 16.4+, thêm vào màn hình chính dạng Web Clip, mở mượt mà.
- **TC_PWA_03 (Trải nghiệm Offline Caching):** **PASSED**. Service Worker `sw.js` cache đầy đủ HTML, CSS, JavaScript và assets tĩnh; khi ngắt 4G/Wifi app vẫn xem được danh sách phòng và hóa đơn đã tải trước đó.
- **TC_PWA_04 (Đăng ký & Nhận Web Push):** **PASSED**. Đăng ký VAPID key thành công, push notification hiển thị chuẩn trên Android và iOS (khi ở chế độ Home Screen).
- **TC_PWA_05 (Fallback khi từ chối quyền Push):** **PASSED**. Ứng dụng không phát sinh crash, người dùng vẫn xem được nội dung bình thường.

### 2.2 Phân hệ Xác thực & Phân quyền RLS (TC_AUTH)
- **TC_AUTH_01 (Đăng nhập Chủ trọ):** **PASSED**. Đăng nhập số điện thoại thành công, chuyển hướng vào Dashboard, xem được toàn bộ danh sách phòng và doanh thu.
- **TC_AUTH_02 (Đăng nhập Người thuê):** **PASSED**. Supabase RLS hoạt động chuẩn xác: người thuê chỉ truy vấn được dữ liệu phòng của chính mình, các truy vấn can thiệp phòng khác đều bị PostgreSQL từ chối.
- **TC_AUTH_03 (Đăng nhập sai SĐT/Mật khẩu):** **PASSED**. Báo lỗi bảo mật chung, không rò rỉ thông tin nội bộ.
- **TC_AUTH_04 (Phân quyền Quản lý khu):** **PASSED**. Quản lý khu A chỉ thao tác được trong phạm vi khu A, không can thiệp được khu B.

### 2.3 Phân hệ Quản lý Khu trọ & Dashboard (TC_ROOM & TC_DASH)
- **TC_ROOM_01 (Màu sắc trạng thái phòng):** **PASSED**. Giao diện phân biệt rõ ràng: Phòng trống (Xanh lá), Đang thuê (Xanh dương), Nợ tiền (Đỏ cam), Có sự cố (Vàng).
- **TC_ROOM_02 (Lọc phòng theo trạng thái):** **PASSED**. Bộ lọc hoạt động phản hồi nhanh, chính xác.
- **TC_DASH_01 (Thống kê tỷ lệ phòng & Doanh thu):** **PASSED**. Tính đúng tổng số phòng, số phòng trống, số tiền đã thu, số tiền còn nợ và sự cố đang mở.

### 2.4 Phân hệ Hóa đơn & VietQR (TC_BILL)
- **TC_BILL_01 (Nhập chỉ số điện nước & tính tiền):** **PASSED**. Công thức tính tiền điện nước nhân đúng đơn giá, cộng chính xác các khoản phí dịch vụ cố định (rác, wifi).
- **TC_BILL_02 (Cảnh báo chỉ số công tơ bất thường):** **PASSED**. Khi chỉ số mới < chỉ số cũ, giao diện bật cảnh báo màu cam ngăn ngừa nhập nhầm.
- **TC_BILL_03 (Sinh mã VietQR QuickLink):** **PASSED**. Tạo mã QR chuẩn Vietcombank (970436), có sẵn STK, số tiền chính xác đến từng đồng và nội dung chuyển khoản theo cú pháp `PHONG... T...`.
- **TC_BILL_04 (Quét VietQR bằng App Ngân hàng thật):** **PASSED**. Quét thành công qua app Vietcombank, Techcombank, MB Bank; nhận đúng 100% người thụ hưởng và số tiền.
- **TC_BILL_05 (Tải ảnh UNC & Duyệt thanh toán):** **PASSED**. Người thuê tải ảnh biên lai thành công ➔ Hóa đơn sang `cho_xac_nhan` ➔ Chủ trọ duyệt ➔ Hóa đơn sang `da_thanh_toan`.

### 2.5 Phân hệ Quy trình Xử lý Sự cố (TC_ISSUE)
- **TC_ISSUE_01 (Báo sự cố kèm hình ảnh):** **PASSED**. Người thuê gửi sự cố kèm ảnh chụp hỏng hóc, lưu trữ an toàn trong Supabase Storage bucket `issue-images`.
- **TC_ISSUE_02 (Cập nhật tiến độ `dang_xu_ly`):** **PASSED**. Quản lý đổi trạng thái, hệ thống ghi log lịch sử và người thực hiện.
- **TC_ISSUE_03 (Ràng buộc lý do khi `chua_the_xu_ly`):** **PASSED**. Database CHECK constraint chặn thành công nếu để trống lý do hoãn xử lý.
- **TC_ISSUE_04 (Hoàn tất & Ghi nhận chi phí sửa chữa):** **PASSED**. Trạng thái hoàn tất tự động ghi nhận mốc thời gian và chi phí thực tế.
- **TC_ISSUE_05 (Bảo mật vai trò Người thuê):** **PASSED**. RLS chặn người thuê không được tự đóng sự cố hoặc sửa chi phí.

### 2.6 Phân hệ Thông báo & Tác vụ Cron (TC_NOTI)
- **TC_NOTI_01 (Cron nhắc nợ trước 3 ngày):** **PASSED**. Edge Function `cron-reminders` quét đúng danh sách hóa đơn sắp đến hạn và gửi thông báo.
- **TC_NOTI_02 (Cron nhắc quá hạn):** **PASSED**. Cập nhật hóa đơn sang `qua_han`, kích hoạt nhắc nợ tự động định kỳ.
- **TC_NOTI_03 (Hộp thông báo in-app):** **DEFERRED**. Chờ phân hệ Frontend Notifications hoàn thiện từ TV5.

---

## 3. NHẬT KÝ THEO DÕI LỖI (DEFECT / BUG LOG)

| Mã Bug | Mô tả lỗi | Mức độ | Người sửa | Trạng thái |
| :---: | :--- | :---: | :---: | :---: |
| **BUG-01** | Lỗi 500 khi đăng nhập do thiếu `created_at`/`updated_at` trong bảng `auth.identities` | Critical | Nguyễn Thành (TV2) | **Đã sửa & Verify** (Commit `6ff9506`) |
| **BUG-02** | Sai lệch phép tính bậc thang lũy tiến điện nước ở mức số âm | High | Nhật Tiến (TV4) | **Đã sửa & Verify** (Commit `ddd3e67`) |
| **BUG-03** | Thiếu ràng buộc lý do khi hoãn sự cố dẫn đến lỗi logic nghiệp vụ | High | Nguyễn Thành (TV2) | **Đã sửa & Verify** (Migration `006`) |
| **BUG-04** | Giao diện nút bấm trên màn hình nhỏ dưới 360px bị tràn hàng | Medium | Võ Ngọc Định (TV6) | **Đã chuẩn hóa** (Đặc tả Wireframe UI/UX) |

---

## 4. KẾT LUẬN & ĐÁNH GIÁ CHẤT LƯỢNG

1. **Tính sẵn sàng:** Hệ thống đạt **96%** tỷ lệ pass trên các bài kiểm tra thực tế, không có lỗi chặn luồng (Blocker).
2. **Khả năng tương thích:** Ứng dụng đáp ứng tốt chuẩn Responsive, chạy mượt mà trên cả iOS Safari và Android Chrome.
3. **Độ an toàn dữ liệu:** Cơ chế phân quyền Supabase RLS và hàm RPC hoạt động chặt chẽ, đảm bảo tính bảo mật giữa các phòng trọ.
4. **Khuyến nghị:** Cho phép tiến hành nghiệm thu thực tế (UAT) với 4 phòng trọ thí điểm.
