# BIÊN BẢN NGHIỆM THU THỬ NGHIỆM THỰC TẾ (UAT SIGN-OFF REPORT)

**Dự án:** Ứng dụng PWA Quản Lý Nhà Trọ  
**Địa điểm thử nghiệm:** Khu trọ Bình An (Khu A) – 12/14 Lê Văn Việt, Tăng Nhơn Phú A, TP. Thủ Đức  
**Thời gian thử nghiệm:** 12/11/2026 – 18/11/2026 (7 ngày trọn vẹn)  
**Phụ trách nghiệm thu:** Thành viên 6 (QA & Technical Writer) phối hợp cùng Chủ trọ và Tech Lead  

---

## 1. THÀNH PHẦN THAM GIA NGHIỆM THU

1. **Đại diện Ban Quản lý / Chủ trọ:**
   - Ông: **Nguyễn Văn Chủ Nhà** – Chủ cơ sở nhà trọ Bình An.
   - Bà: **Phạm Thị Quản Lý** – Quản lý vận hành dãy trọ.
2. **Đại diện Đội ngũ Phát triển:**
   - **Nguyễn Hữu Nghĩa** – Tech Lead / Đại diện kỹ thuật (TV1).
   - **Võ Ngọc Định** – QA Lead & Technical Writer (TV6).
3. **Đại diện Khách thuê phòng tham gia thí điểm:**
   - Phòng 101: Anh **Nguyễn Văn A** (Thiết bị: iPhone 13 / iOS 17).
   - Phòng 102: Bạn **Trần Thị Thuê** (Thiết bị: Xiaomi Redmi Note 12 / Android 13).
   - Phòng 201: Bác **Lê Văn Khách** (Đại diện người lớn tuổi, Thiết bị: Samsung Galaxy / Android 14).
   - Phòng 202: Anh **Hoàng Minh D** (Thử nghiệm tính năng báo hỏng thiết bị).

---

## 2. NHẬT KÝ VẬN HÀNH THỬ NGHIỆM (7 NGÀY)

| Ngày | Hoạt động triển khai | Kết quả thực tế ghi nhận | Đánh giá |
| :---: | :--- | :--- | :---: |
| **Ngày 1 - 2** | Hướng dẫn 4 phòng cài đặt PWA ra màn hình chính (Add to Home Screen) và bật thông báo Web Push. | 4/4 khách thuê cài thành công PWA lên màn hình điện thoại trong vòng dưới 2 phút; không cần qua kho ứng dụng App Store/CH Play. Bác Khách (P201) thao tác thuận lợi nhờ nút bấm lớn. | **ĐẠT** |
| **Ngày 3** | Chủ trọ đi chốt chỉ số điện nước cuối kỳ: chụp ảnh công tơ điện nước từng phòng và xuất hóa đơn trên app. | Chụp 4 ảnh công tơ thành công, số liệu tự động tính tiền phòng + điện (130 kWh) + nước + wifi + rác; hóa đơn phát hành tức thì. | **ĐẠT** |
| **Ngày 4** | Hệ thống tự động chạy tác vụ Cron lúc 07:00 sáng nhắc hạn đóng tiền phòng trước 3 ngày. | 4/4 máy người thuê rung chuông nhận thông báo đẩy Web Push: *"Hóa đơn tiền phòng tháng 11 đã sẵn sàng, hạn đóng 18/11"*. | **ĐẠT** |
| **Ngày 5** | Thử nghiệm quét mã VietQR và thanh toán không tiền mặt. | - P101 (quét qua app Vietcombank): 3.850.000đ.<br>- P102 (quét qua app MB Bank): 2.450.000đ.<br>- Cả 2 ngân hàng tự động điền đúng 100% STK nhận, người nhận và nội dung chuyển khoản `PHONG... T11`. | **ĐẠT** |
| **Ngày 6** | Tải ảnh ủy nhiệm chi (UNC) và Chủ trọ bấm duyệt thanh toán. | Khách thuê tải ảnh chụp chuyển khoản thành công; Chủ trọ bấm "Duyệt thanh toán" trên điện thoại; hóa đơn chuyển sang màu xanh `Đã thanh toán`. Tiền phòng không lệch 1 đồng. | **ĐẠT** |
| **Ngày 7** | Thử nghiệm báo sự cố hỏng hóc từ P202: "Máy lạnh không lạnh, chảy nước". | Khách thuê chụp ảnh gửi qua mục "Báo sự cố"; Quản lý tiếp nhận, chuyển trạng thái `Đang xử lý` và hoàn tất sửa chữa với chi phí 250.000đ ghi nhận minh bạch vào hệ thống. | **ĐẠT** |

---

## 3. KẾT QUẢ KHẢO SÁT SỰ HÀI LÒNG CỦA NGƯỜI DÙNG (CSAT SURVEY)

Đánh giá theo thang điểm từ **1 (Rất không hài lòng)** đến **5 (Rất hài lòng)**:

| Tiêu chí khảo sát | P101 (iPhone) | P102 (Xiaomi) | P201 (Samsung) | P202 (Android) | Điểm trung bình |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Cài đặt PWA & Độ mượt ứng dụng** | 5/5 | 5/5 | 4/5 | 5/5 | **4.75 / 5** |
| **2. Kích thước nút bấm & Font chữ (Dễ nhìn)** | 5/5 | 4/5 | 5/5 | 5/5 | **4.75 / 5** |
| **3. Quét mã VietQR (Nhanh & Chính xác)** | 5/5 | 5/5 | 5/5 | 5/5 | **5.00 / 5** |
| **4. Minh bạch chỉ số điện nước có ảnh chụp** | 5/5 | 5/5 | 5/5 | 5/5 | **5.00 / 5** |
| **5. Tính năng thông báo & Báo hỏng thiết bị** | 5/5 | 5/5 | 4/5 | 5/5 | **4.75 / 5** |
| **TỶ LỆ HÀI LÒNG CHUNG (OVERALL SATISFACTION)** | **100%** | **96%** | **92%** | **100%** | **97.0%** |

> **Phản hồi của Bác Lê Văn Khách (Phòng 201 - 62 tuổi):**  
> *"Trước đây mỗi lần chuyển khoản tiền phòng phải hỏi đi hỏi lại số tài khoản rồi gõ từng số sợ sai. Giờ có cái mã QR bấm mở là ngân hàng nó tự điền hết số tiền với tên chủ nhà, tiện và an tâm hẳn. Chữ to rõ ràng không phải đeo kính lão khi xem."*

---

## 4. KẾT LUẬN NGHIỆM THU & BÀN GIAO (SIGN-OFF)

- **Số lỗi nghiêm trọng (Blocker/Critical):** **0 lỗi**.
- **Sai lệch số liệu tài chính:** **0 đồng** (Khớp 100% giữa hóa đơn và biên lai ngân hàng).
- **Tiêu chuẩn nghiệm thu:** Toàn bộ tiêu chí đề ra tại Kế hoạch UAT (`ke-hoach-uat-3-5-phong.md`) đã được đáp ứng xuất sắc.

**KẾT LUẬN:** Ban Quản lý Nhà trọ Bình An và Đội ngũ Kỹ thuật thống nhất **NGHIỆM THU ĐẠT CHẤT LƯỢNG** và đồng ý đưa Ứng dụng PWA Quản Lý Nhà Trọ vào vận hành chính thức cho toàn bộ các phòng trọ của cơ sở.

---

### XÁC NHẬN CỦA CÁC BÊN LIÊN QUAN

| ĐẠI DIỆN CHỦ NHÀ TRỌ | ĐẠI DIỆN TECH LEAD (TV1) | ĐẠI DIỆN QA & TECH WRITER (TV6) |
| :---: | :---: | :---: |
| *(Đã ký & xác nhận)* | *(Đã ký & xác nhận)* | *(Đã ký & xác nhận)* |
| **Nguyễn Văn Chủ Nhà** | **Nguyễn Hữu Nghĩa** | **Võ Ngọc Định** |
