# KẾ HOẠCH TRIỂN KHAI THỬ NGHIỆM THỰC TẾ (UAT PLAN)
*(Áp dụng thử nghiệm trên 3 - 5 phòng trọ thật trong Tuần 8)*

**Người phụ trách:** Thành viên 6 (QA / UI-UX Specialist & Technical Writer)  
**Đối tượng tham gia:** Chủ nhà trọ, Người quản lý khu, 3-5 Khách thuê phòng thật.

---

## 1. MỤC TIÊU & PHẠM VI THỬ NGHIỆM

### 1.1 Mục tiêu
1. Kiểm tra tính khả dụng thực tế (Usability) của ứng dụng PWA trên nhiều thiết bị di động thật (iPhone, Samsung, Xiaomi, Oppo...).
2. Xác minh trọn vẹn **1 chu kỳ thu tiền tháng**: từ nhập chỉ số điện nước ➔ tự động tính tiền ➔ quét VietQR trả tiền ➔ xác nhận biên lai thành công.
3. Kiểm tra tính năng báo sự cố và cơ chế tự động gửi thông báo đẩy (Web Push) nhắc nợ trước 3 ngày.
4. Thu thập phản hồi từ người thuê (đặc biệt là mức độ dễ dùng đối với người lớn tuổi).

### 1.2 Danh sách phòng trọ thí điểm (Mẫu phân công)
- **Khu trọ thí điểm:** Nhà trọ Bình An (Khu A).
- **Phòng 101 (Tầng 1):** Đại diện nhóm gia đình / người đi làm (dùng iPhone).
- **Phòng 102 (Tầng 1):** Đại diện nhóm sinh viên (dùng Android Xiaomi).
- **Phòng 201 (Tầng 2):** Đại diện người lớn tuổi, ít rành công nghệ (dùng Android Samsung).
- **Phòng 202 (Tầng 2):** Phòng có trường hợp thử nghiệm báo hỏng máy lạnh / thiết bị.

---

## 2. KỊCH BẢN THỬ NGHIỆM CHI TIẾT (UAT SCENARIOS)

| Giai đoạn | Thời gian | Hoạt động chi tiết | Tiêu chí đạt (Acceptance Criteria) |
| :--- | :--- | :--- | :--- |
| **Giai đoạn 1: Onboarding** | Ngày 1 - 2 | 1. Hướng dẫn Chủ trọ và 4 khách thuê cài PWA ra màn hình chính.<br>2. Bật cấp quyền thông báo Web Push. | 100% người tham gia cài thành công PWA ra màn hình chính; mở app không bị lỗi trắng trang. |
| **Giai đoạn 2: Chốt số & Hóa đơn** | Ngày 3 | 1. Chủ trọ dùng điện thoại chụp ảnh công tơ điện nước từng phòng.<br>2. Nhập số và bấm xuất hóa đơn. | Công thức tự động nhân đúng tiền điện nước; hóa đơn hiện ngay trên máy người thuê. |
| **Giai đoạn 3: Nhắc nợ & Thanh toán** | Ngày 4 - 6 | 1. Hệ thống tự động kích hoạt Cron nhắc hạn đóng tiền.<br>2. Người thuê mở hóa đơn, quét mã VietQR bằng app ngân hàng.<br>3. Người thuê tải ảnh chuyển khoản lên app. | Điện thoại người thuê nhận thông báo đẩy; quét VietQR tự điền đúng 100% STK và số tiền; chủ trọ duyệt thành công. |
| **Giai đoạn 4: Thử nghiệm Sự cố** | Ngày 7 | 1. Người thuê tạo 1 báo cáo sự cố (ví dụ: bóng đèn chớp tắt).<br>2. Quản lý tiếp nhận, đổi trạng thái và ghi nhận chi phí sửa. | Quản lý nhận được thông báo sự cố; người thuê theo dõi được tiến độ sửa chữa từng bước. |

---

## 3. PHIẾU KHẢO SÁT & ĐÁNH GIÁ CỦA NGƯỜI DÙNG (USER SURVEY)

Sau khi hoàn tất đợt thử nghiệm, mỗi người dùng sẽ điền bảng khảo sát với thang điểm từ 1 (Rất tệ) đến 5 (Rất tốt):

1. **Giao diện & Cài đặt:**
   - Ứng dụng có dễ cài đặt lên màn hình chính điện thoại không? `[ 1 - 2 - 3 - 4 - 5 ]`
   - Chữ viết, màu sắc và các nút bấm có dễ nhìn, dễ bấm không? `[ 1 - 2 - 3 - 4 - 5 ]`
2. **Thanh toán VietQR:**
   - Việc quét mã VietQR trả tiền phòng có nhanh và thuận tiện hơn cách cũ không? `[ 1 - 2 - 3 - 4 - 5 ]`
   - Số tiền và thông tin chuyển khoản có chính xác tuyệt đối không? `[ 1 - 2 - 3 - 4 - 5 ]`
3. **Thông báo & Sự cố:**
   - Bạn có nhận được thông báo nhắc đóng tiền phòng đúng hẹn không? `[ Có / Không ]`
   - Tính năng báo hỏng hóc có giúp bạn đỡ phải gọi điện/nhắn tin lẻ tẻ không? `[ 1 - 2 - 3 - 4 - 5 ]`
4. **Góp ý cải tiến:** *(Ghi nhận ý kiến tự do của người dùng)*.

---

## 4. QUY TRÌNH TIẾP NHẬN & ĐÓNG GÓI BÀN GIAO (HANDOVER)

- **Biên bản nghiệm thu UAT:**
  - Tỷ lệ lỗi nghiêm trọng (Blocker/Critical): **0 lỗi**.
  - Tỷ lệ hài lòng của người thuê phòng: Đạt `>= 85%` đánh giá từ 4 sao trở lên.
  - Hoàn tất chu kỳ thu tiền 100% không phát sinh sai lệch sổ sách tài chính.
- **Bàn giao chính thức:** Sau khi đạt toàn bộ tiêu chí trên, TV6 phối hợp cùng TV1 bàn giao tài liệu kỹ thuật, tài liệu hướng dẫn và mã nguồn để đưa hệ thống vào áp dụng chính thức cho toàn bộ dãy trọ.
