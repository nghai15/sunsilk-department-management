# ĐẶC TẢ THIẾT KẾ UI/UX & WIREFRAME PWA QUẢN LÝ NHÀ TRỌ

**Người phụ trách:** Thành viên 6 (QA / UI-UX Specialist & Technical Writer)  
**Tiêu chuẩn thiết kế:** Mobile-First, Thumb-Friendly (Thao tác một tay), Tối ưu người dùng lớn tuổi, Tương thích PWA Display Standalone.

---

## 1. NGUYÊN TẮC THIẾT KẾ UI/UX (DESIGN SYSTEM GUIDELINES)

### 1.1 Khả năng tiếp cận & Người dùng lớn tuổi (Accessibility)
- **Kích thước nút bấm (Touch Target):** Chiều cao tối thiểu **48px** cho tất cả các nút bấm chính, khoảng cách giữa các phần tử tối thiểu **8px** để tránh bấm nhầm.
- **Cỡ chữ (Typography):**
  - Tiêu đề màn hình: `20px - 24px` (Bold).
  - Nội dung chính / Số tiền: `16px - 18px` (Medium/Semibold).
  - Nhãn phụ / Ghi chú: tối thiểu `14px` (Không dùng font dưới 13px).
- **Độ tương phản màu sắc (Contrast Ratio):** Đạt chuẩn WCAG AA (độ tương phản chữ trên nền >= 4.5:1), nền sáng chủ đạo `#F8FAFC`, màu nhấn thương hiệu `#2563EB` (Xanh dương hiện đại, tin cậy).

### 1.2 Bảng màu trạng thái quy chuẩn (Status Color Palette)

| Trạng thái | Màu sắc | Mã màu | Ý nghĩa trên giao diện |
| :--- | :--- | :--- | :--- |
| **Phòng trống** | Xanh lá nhạt / Xám | `#10B981` / `#64748B` | Sẵn sàng cho thuê |
| **Đang thuê** | Xanh dương | `#2563EB` | Bình thường, không có nợ hay sự cố |
| **Nợ tiền / Quá hạn**| Đỏ cam | `#EF4444` | Cần nhắc nợ hoặc xử lý hóa đơn |
| **Có sự cố** | Vàng cảnh báo | `#F59E0B` | Có hỏng hóc đang chờ hoặc đang xử lý |
| **Bảo trì phòng** | Tím xám | `#8B5CF6` | Đang sửa sang toàn diện |

---

## 2. KIẾN TRÚC ĐIỀU HƯỚNG (NAVIGATION ARCHITECTURE)

Hệ thống sử dụng thanh điều hướng đáy **Bottom Navigation Bar** cố định ở chân màn hình, giúp ngón tay cái dễ dàng thao tác một tay:

```text
┌─────────────────────────────────────────────────────────────┐
│                      NỘI DUNG MÀN HÌNH                      │
│                                                             │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│   [ 🏢 ]    │   [ 📋 ]    │   [ ⚠️ ]    │      [ 🔔 ]       │
│ Danh sách   │   Hóa đơn   │   Sự cố     │     Thông báo     │
│   phòng     │   & Điện    │   hỏng hóc  │      in-app       │
└─────────────┴─────────────┴─────────────┴───────────────────┘
```

---

## 3. BẢN VẼ WIREFRAME MÀN HÌNH CHÍNH (ASCII WIREFRAMES)

### 3.1 Màn hình 1: Danh sách phòng & Tổng quan (Dành cho Chủ trọ/Quản lý)

```text
┌─────────────────────────────────────────────────────────────┐
│ 🏠 NHÀ TRỌ BÌNH AN                    [🔍 Tìm] [👤 Hồ sơ]   │
│ Khu A - 12/14 Lê Văn Việt, TP. Thủ Đức                      │
├─────────────────────────────────────────────────────────────┤
│ 📊 TỔNG QUAN THÁNG 11:                                      │
│ ┌──────────────┬──────────────┬──────────────┬────────────┐ │
│ │ Tổng phòng   │ Đang thuê    │ Phòng trống  │ Nợ tiền    │ │
│ │     16       │      14      │      2       │   3 phòng  │ │
│ └──────────────┴──────────────┴──────────────┴────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ BỘ LỌC NHANH:                                               │
│ [ Tất cả (16) ]  [ 🔴 Nợ tiền (3) ]  [ ⚠️ Sự cố (1) ]       │
│ Tầng: [ Tất cả v ]                                          │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Phòng 101 (Tầng 1)                   [ 🔴 Nợ 3.850.000đ]│ │
│ │ Khách: Nguyễn Văn A • 0908.123.xxx                      │ │
│ │ Điện: 1.450 -> 1.580 kWh (130 kWh)                      │ │
│ │ [ Báo nợ Zalo ]  [ Xem hóa đơn ]                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Phòng 102 (Tầng 1)                   [ ⚠️ Có sự cố điện]│ │
│ │ Khách: Trần Thị B • 0912.456.xxx                        │ │
│ │ Sự cố: "Cháy cầu dao máy lạnh phòng ngủ"                │ │
│ │ [ Xem tiến độ xử lý ]                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Phòng 103 (Tầng 1)                   [ 🟢 Đã thanh toán]│ │
│ │ Khách: Lê Hoàng C • 0989.789.xxx                        │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.2 Màn hình 2: Nhập số điện nước nhanh kèm ảnh chụp công tơ

```text
┌─────────────────────────────────────────────────────────────┐
│ < Quay lại       GHI CHỈ SỐ ĐIỆN NƯỚC (P.101)               │
├─────────────────────────────────────────────────────────────┤
│ Kỳ tính tiền: Tháng 11/2026                                 │
│                                                             │
│ ⚡ CHỈ SỐ ĐIỆN (kWh):                                       │
│ Số cũ tháng trước: 1.450 kWh                                │
│ Số mới: [ 1.580           ] kWh                             │
│ ➔ Tiêu thụ: 130 kWh x 3.500đ = 455.000đ                     │
│                                                             │
│ 📷 ẢNH CHỤP CÔNG TƠ ĐIỆN:                                   │
│ ┌─────────────────────────┐                                 │
│ │   [ Đính kèm ảnh mới ]  │  (Giúp minh bạch bằng chứng)    │
│ │   [ Chụp bằng camera ]  │                                 │
│ └─────────────────────────┘                                 │
│                                                             │
│ 💧 CHỈ SỐ NƯỚC (m³):                                        │
│ Số cũ tháng trước: 112 m³                                   │
│ Số mới: [ 120             ] m³                              │
│ ➔ Tiêu thụ: 8 m³ x 20.000đ = 160.000đ                       │
│                                                             │
│ ⚠️ CẢNH BÁO TỰ ĐỘNG:                                        │
│ (Nếu gõ số mới < số cũ: Hệ thống báo đỏ và chặn lưu)        │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │          [ TÍNH TIỀN & XUẤT HÓA ĐƠN NGAY ]              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.3 Màn hình 3: Màn hình Người thuê xem hóa đơn & Quét VietQR

```text
┌─────────────────────────────────────────────────────────────┐
│ HÓA ĐƠN TIỀN NHÀ THÁNG 11/2026                              │
│ Phòng 101 • Hạn đóng: 05/11/2026 (Còn 2 ngày)               │
├─────────────────────────────────────────────────────────────┤
│ 1. Tiền phòng:                                 3.000.000 đ  │
│ 2. Tiền điện (130 kWh x 3.500đ):                 455.000 đ  │
│ 3. Tiền nước (8 m³ x 20.000đ):                   160.000 đ  │
│ 4. Tiền rác & wifi (Cố định):                    150.000 đ  │
│ ─────────────────────────────────────────────────────────── │
│ TỔNG CỘNG THANH TOÁN:                          3.765.000 đ  │
├─────────────────────────────────────────────────────────────┤
│ 📲 QUÉT MÃ VIETQR ĐỂ CHUYỂN KHOẢN:                          │
│                                                             │
│             ┌─────────────────────────┐                     │
│             │   █▀▀▀█ ▀█▄ █▀▀▀█       │                     │
│             │   █   █ ▄▄█ █   █       │                     │
│             │   ▀▀▀▀▀ ▀ ▀ ▀▀▀▀▀       │                     │
│             │   [ Mã VietQR QuickLink]│                     │
│             │   MB Bank - 0908123xxx  │                     │
│             └─────────────────────────┘                     │
│             Nội dung tự động: PHONG101 T11                  │
│                                                             │
│ [ 💾 Lưu ảnh mã QR ]        [ 🔗 Mở App Ngân Hàng ]         │
├─────────────────────────────────────────────────────────────┤
│ ĐÃ CHUYỂN KHOẢN XONG?                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │          [ 📤 Tải ảnh biên lai chuyển tiền lên ]         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.4 Màn hình 4: Luồng Báo hỏng hóc thiết bị & Cập nhật sự cố

```text
┌─────────────────────────────────────────────────────────────┐
│ < Quay lại       BÁO CÁO SỰ CỐ / HỎNG THIẾT BỊ              │
├─────────────────────────────────────────────────────────────┤
│ Chọn loại sự cố:                                            │
│ (o) Điện       ( ) Nước       ( ) Máy lạnh    ( ) Khác      │
│                                                             │
│ Tiêu đề sự cố:                                              │
│ [ Máy lạnh phòng ngủ chảy nước và kêu to                  ] │
│                                                             │
│ Mô tả chi tiết:                                             │
│ [ Máy lạnh nhỏ nước xuống giường, bật không mát từ tối qua] │
│                                                             │
│ Đính kèm hình ảnh thực tế:                                  │
│ [ 📷 Chụp ảnh hiện trường ]  [ 🖼️ Chọn ảnh từ thư viện ]    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                  [ GỬI BÁO CÁO CHO CHỦ TRỌ ]            │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ TIẾN ĐỘ THEO DÕI:                                           │
│ 🟢 Báo cáo đã gửi (08:30)                                   │
│ 🔵 Quản lý đã tiếp nhận (09:15)                             │
│ 🟠 Chưa thể xử lý: "Chờ thợ mang linh kiện lúc 14:00"       │
│ ⚪ Đã hoàn tất sửa chữa                                     │
└─────────────────────────────────────────────────────────────┘
```
