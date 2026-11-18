# BẢNG KỊCH BẢN KIỂM THỬ HỆ THỐNG (TEST CASES SPECIFICATION)

**Dự án:** Ứng dụng PWA Quản Lý Nhà Trọ  
**Phụ trách:** Thành viên 6 (QA / UI-UX Specialist & Technical Writer)  
**Mục tiêu:** Đảm bảo toàn bộ các tính năng hoạt động chính xác trên môi trường thiết bị di động (Android Chrome, iOS Safari 16.4+), hỗ trợ tốt chế độ Offline và luồng thanh toán VietQR.

---

## 1. QUY ƯỚC MÃ KIỂM THỬ & MỨC ĐỘ ƯU TIÊN

- **Mã tiền tố:**
  - `TC_PWA`: Kiểm thử tính năng PWA, Service Worker Cache, Web Push.
  - `TC_AUTH`: Xác thực, đăng nhập SĐT, phân quyền người dùng.
  - `TC_ROOM`: Quản lý khu trọ, danh sách phòng, trạng thái, hợp đồng.
  - `TC_BILL`: Ghi điện nước, tính tiền, VietQR, duyệt ủy nhiệm chi.
  - `TC_ISSUE`: Quy trình báo và xử lý sự cố.
  - `TC_NOTI`: Thông báo nội bộ và Cron nhắc nợ tự động.
  - `TC_DASH`: Bảng tổng quan doanh thu và báo cáo.
- **Mức độ ưu tiên:**
  - `P0 (Critical)`: Tính năng cốt lõi, chặn luồng người dùng nếu lỗi (Đăng nhập, tính tiền, VietQR).
  - `P1 (High)`: Tính năng quan trọng phục vụ vận hành hàng ngày (Báo sự cố, nhắc nợ, PWA cache).
  - `P2 (Medium)`: Tính năng bổ trợ, lọc dữ liệu, giao diện thông báo.

---

## 2. MA TRẬN TEST CASES CHI TIẾT

### PHÂN HỆ 1: PWA, SERVICE WORKER & WEB PUSH (TC_PWA)

| Mã TC | Tên kịch bản | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Môi trường | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC_PWA_01** | Cài đặt PWA lên màn hình chính (Android) | Mở trình duyệt Chrome trên Android, truy cập URL app | 1. Nhấn nút "Cài đặt ứng dụng" trên banner hoặc menu 3 chấm.<br>2. Xác nhận "Cài đặt". | App được cài vào màn hình chính dạng Standalone, có icon 192x192 maskable, mở app không có thanh URL. | Android Chrome | **P0** |
| **TC_PWA_02** | Thêm PWA vào màn hình chính (iOS) | Mở Safari trên iPhone (iOS 16.4+) | 1. Bấm nút Chia sẻ (Share).<br>2. Chọn "Thêm vào MH chính" (Add to Home Screen).<br>3. Mở app từ màn hình chính. | App mở dạng toàn màn hình không có thanh điều hướng Safari; hiển thị đúng tên "Nhà Trọ PWA". | iOS Safari 16.4+ | **P0** |
| **TC_PWA_03** | Trải nghiệm chế độ Ngoại tuyến (Offline Caching) | Đã truy cập app ít nhất 1 lần khi có mạng | 1. Bật chế độ máy bay (ngắt hoàn toàn 4G/Wifi).<br>2. Mở lại ứng dụng PWA.<br>3. Điều hướng xem danh sách phòng/hóa đơn đã tải. | Giao diện vẫn hiển thị mượt mà từ Cache của Service Worker, hiển thị thông báo nhẹ "Đang hoạt động ngoại tuyến". | Android, iOS | **P1** |
| **TC_PWA_04** | Đăng ký & Nhận Web Push Notification | Đã cài app vào màn hình chính | 1. Đăng nhập người thuê.<br>2. Bật "Cho phép thông báo".<br>3. Kích hoạt thông báo từ backend. | Thiết bị rung/chuông và hiện thông báo đẩy chuẩn VAPID; bấm vào mở đúng URL chi tiết hóa đơn. | Android, iOS (Standalone) | **P0** |
| **TC_PWA_05** | Fallback khi người dùng từ chối cấp quyền Push | Chưa cấp quyền thông báo | 1. Bấm "Từ chối" khi trình duyệt hỏi quyền Push.<br>2. Gửi thông báo từ phía quản lý. | Hệ thống không crash, thông báo vẫn lưu và hiển thị đầy đủ trong "Hộp thông báo in-app". | Mọi trình duyệt | **P1** |

---

### PHÂN HỆ 2: XÁC THỰC & PHÂN QUYỀN (TC_AUTH)

| Mã TC | Tên kịch bản | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC_AUTH_01** | Đăng nhập Chủ trọ thành công | Có tài khoản Chủ trọ trong CSDL | Nhập số điện thoại + mật khẩu hợp lệ ➔ Bấm Đăng nhập. | Chuyển hướng vào màn hình Dashboard/Danh sách phòng; thấy toàn bộ các phòng và khu trọ thuộc quyền sở hữu. | **P0** |
| **TC_AUTH_02** | Đăng nhập Người thuê thành công | Có tài khoản Người thuê gắn với hợp đồng hiệu lực | Nhập SĐT + mật khẩu của Người thuê. | Chỉ thấy dữ liệu phòng mình đang thuê, hóa đơn cá nhân, nút báo sự cố; không xem được phòng người khác (RLS chặn). | **P0** |
| **TC_AUTH_03** | Đăng nhập thất bại (Sai mật khẩu/SĐT) | Bất kỳ | Nhập SĐT không tồn tại hoặc sai mật khẩu. | Báo lỗi rõ ràng: "Số điện thoại hoặc mật khẩu không chính xác", không tiết lộ cụ thể trường nào sai. | **P1** |
| **TC_AUTH_04** | Phân quyền Quản lý khu trọ (Property Staff) | Tài khoản có vai trò `quan_ly` được gán vào Khu A | Đăng nhập với tài khoản Quản lý. | Chỉ xem và xử lý phòng/sự cố thuộc Khu A; không xem hoặc sửa được Khu B (bị chặn bởi RLS). | **P1** |

---

### PHÂN HỆ 3: QUẢN LÝ KHU TRỌ, PHÒNG & HỢP ĐỒNG (TC_ROOM)

| Mã TC | Tên kịch bản | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC_ROOM_01** | Hiển thị màu sắc trạng thái phòng | Có dữ liệu mẫu nhiều phòng | Mở màn hình Danh sách phòng. | Phòng trống (Xanh lá/Xám), Đang thuê (Xanh dương), Nợ tiền (Đỏ/Cam), Có sự cố (Vàng cảnh báo). | **P1** |
| **TC_ROOM_02** | Lọc danh sách phòng theo tầng & tình trạng | Danh sách > 10 phòng | 1. Chọn lọc "Tầng 2".<br>2. Chọn trạng thái "Có sự cố". | Danh sách cập nhật tức thì, chỉ hiển thị đúng các phòng ở Tầng 2 đang có sự cố mở. | **P2** |
| **TC_ROOM_03** | Thêm mới Hợp đồng thuê phòng | Phòng đang ở trạng thái `trong` | 1. Chọn phòng ➔ Bấm "Tạo hợp đồng".<br>2. Chọn người thuê, ngày bắt đầu, giá thuê, tiền cọc ➔ Lưu. | Hợp đồng lưu thành công, trạng thái phòng chuyển ngay sang `dang_thue`. | **P0** |
| **TC_ROOM_04** | Chặn tạo hợp đồng trùng lặp | Phòng đã có hợp đồng `hieu_luc` | Cố ý tạo thêm hợp đồng cho cùng phòng đó. | Hệ thống từ chối và cảnh báo phòng đang có người thuê. | **P1** |

---

### PHÂN HỆ 4: ĐIỆN NƯỚC, HÓA ĐƠN & VIETQR (TC_BILL)

| Mã TC | Tên kịch bản | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC_BILL_01** | Nhập chỉ số điện nước hợp lệ | Cuối kỳ chốt tiền | 1. Nhập chỉ số mới (lớn hơn chỉ số cũ).<br>2. Chụp/tải ảnh công tơ làm chứng từ.<br>3. Bấm Tạo hóa đơn. | Hệ thống tính đúng số tiêu thụ (`mới - cũ`) và nhân đơn giá; hóa đơn lưu thành công ở trạng thái `chua_thanh_toan`. | **P0** |
| **TC_BILL_02** | Cảnh báo chỉ số công tơ bất thường | Đã có chỉ số cũ | Nhập chỉ số mới nhỏ hơn chỉ số cũ (hoặc tăng đột biến gấp 5 lần). | Hiển thị cảnh báo màu cam: "Chỉ số mới nhỏ hơn chỉ số cũ hoặc bất thường, vui lòng kiểm tra lại ảnh chụp". | **P1** |
| **TC_BILL_03** | Sinh mã VietQR QuickLink chính xác | Hóa đơn đã phát hành | Mở chi tiết hóa đơn (Người thuê hoặc Chủ trọ). | Hiển thị mã QR chứa đúng: Mã ngân hàng, Số tài khoản, Số tiền chính xác đến từng đồng, Nội dung chuyển khoản chuẩn (vd: `PHONG101 T11`). | **P0** |
| **TC_BILL_04** | Quét VietQR bằng ứng dụng Ngân hàng thật | Có app ngân hàng (MB, VCB, Vietinbank...) | Dùng app ngân hàng quét mã VietQR trên màn hình PWA. | App ngân hàng tự động điền đúng 100% STK nhận, người nhận, số tiền và nội dung chuyển khoản mà không cần gõ tay. | **P0** |
| **TC_BILL_05** | Tải ảnh ủy nhiệm chi (UNC) & Duyệt thanh toán | Hóa đơn chưa thanh toán | 1. Người thuê tải ảnh chuyển khoản thành công ➔ Hóa đơn sang `cho_xac_nhan`.<br>2. Chủ trọ đối soát và bấm "Xác nhận đã nhận tiền". | Hóa đơn chuyển trạng thái sang `da_thanh_toan`, phòng hết cảnh báo nợ tiền; người thuê nhận thông báo xác nhận. | **P0** |

---

### PHÂN HỆ 5: QUY TRÌNH XỬ LÝ SỰ CỐ (TC_ISSUE)

| Mã TC | Tên kịch bản | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC_ISSUE_01** | Người thuê gửi báo cáo sự cố kèm ảnh | Đang thuê phòng | Chọn loại sự cố (Điện/Nước/Máy lạnh), nhập mô tả, chụp ảnh hỏng hóc ➔ Bấm Gửi. | Sự cố lưu thành công ở trạng thái `cho_tiep_nhan`; biểu tượng cảnh báo sự cố hiện lên trên danh sách phòng của Quản lý. | **P0** |
| **TC_ISSUE_02** | Quản lý chuyển trạng thái `dang_xu_ly` | Sự cố đang `cho_tiep_nhan` | Quản lý mở chi tiết sự cố ➔ Chọn "Tiếp nhận & Đang xử lý" ➔ Lưu. | Trạng thái chuyển sang `dang_xu_ly`; lưu lịch sử người xử lý; người thuê nhận thông báo. | **P1** |
| **TC_ISSUE_03** | Bắt buộc nhập lý do khi `chua_the_xu_ly` | Sự cố đang mở | Chọn trạng thái `chua_the_xu_ly` nhưng để trống ô ghi chú. | Hệ thống chặn không cho lưu (Ràng buộc CHECK CSDL); yêu cầu nhập rõ lý do (ví dụ: Chờ linh kiện, người thuê vắng nhà). | **P0** |
| **TC_ISSUE_04** | Hoàn tất sự cố & Ghi nhận chi phí | Sự cố đã xử lý xong | Chọn trạng thái `hoan_tat`, nhập chi phí sửa chữa (vd: 250.000đ) ➔ Lưu. | Sự cố đóng lại, tự động ghi `hoan_tat_luc`, lưu chi phí vào lịch sử; phòng mất biểu tượng cảnh báo sự cố. | **P0** |
| **TC_ISSUE_05** | Bảo mật: Người thuê không được tự đổi trạng thái | Đang xem sự cố của mình | Người thuê mở chi tiết sự cố. | Không hiển thị nút chuyển trạng thái sang `hoan_tat` hoặc chỉnh sửa chi phí (bị khóa ở UI và chặn bởi RLS). | **P0** |

---

### PHÂN HỆ 6: THÔNG BÁO & CRON NHẮC NỢ (TC_NOTI)

| Mã TC | Tên kịch bản | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC_NOTI_01** | Cron nhắc nợ tự động mốc trước 3 ngày | Hóa đơn còn 3 ngày đến hạn | Kích hoạt Edge Function `cron-reminders`. | Tạo thông báo loại `hoa_don_sap_den_han`, gửi Push tới người thuê; ghi nhật ký chống gửi lặp trong ngày. | **P1** |
| **TC_NOTI_02** | Cron nhắc đúng hạn và quá hạn định kỳ | Hóa đơn quá hạn thanh toán | Chạy `cron-reminders` hàng ngày. | Hóa đơn được cập nhật sang trạng thái `qua_han`; gửi cảnh báo nhắc nhở lặp lại sau mỗi M ngày cấu hình. | **P1** |
| **TC_NOTI_03** | Gửi thông báo chung toàn dãy / theo tầng | Chủ trọ đăng nhập | Soạn thông báo "Cắt nước bảo trì", chọn phạm vi "Tầng 2" ➔ Gửi. | Tất cả người thuê ở Tầng 2 nhận được thông báo in-app và Web Push; người ở tầng khác không nhận. | **P2** |

---

## 3. BIỂU MẪU BÁO CÁO LỖI (BUG REPORT TEMPLATE)

Khi kiểm thử viên phát hiện lỗi, bắt buộc ghi nhận theo mẫu sau:

```markdown
- **Mã lỗi:** BUG_[PHÂN_HỆ]_[SỐ_THỨ_TỰ] (Ví dụ: BUG_BILL_001)
- **Tiêu đề:** Tóm tắt ngắn gọn lỗi phát sinh
- **Mức độ nghiêm trọng:** Blocker / Major / Normal / Minor
- **Môi trường gặp lỗi:** iPhone 13 (iOS 17.2, Safari Standalone) / Xiaomi Redmi Note 11 (Android 13, Chrome)
- **Các bước tái hiện:**
  1. Bước 1...
  2. Bước 2...
- **Kết quả thực tế:** Những gì đang xảy ra sai lệch
- **Kết quả mong đợi:** Những gì hệ thống đúng phải hiển thị/thực hiện
- **Ảnh chụp / Video bằng chứng:** Đính kèm screenshot hoặc video log console
```
