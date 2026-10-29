# Tài Liệu Thiết Kế Hệ Thống PWA Quản Lý Nhà Trọ

Thư mục này chứa các tài liệu liên quan đến:
1. **Thiết kế Cơ sở dữ liệu (Database Schema)**
   - Bảng Khu nhà (`properties`)
   - Bảng Phòng trọ (`rooms`)
   - Bảng Khách thuê (`tenants` / `users`)
   - Bảng Hợp đồng (`contracts`)
   - Bảng Hóa đơn & Chỉ số điện nước (`bills`, `meter_readings`)
   - Bảng Báo cáo sự cố (`issues`)
   - Bảng Thông báo (`notifications`)

2. **API Specifications & Edge Functions**
   - Định dạng dữ liệu RESTful/GraphQL/RPC.
   - Cron nhắc hạn thanh toán.
   - Web Push Notification Payload.

3. **Wireframe & UI Flow**
   - Thiết kế UX/UI cho Mobile PWA.
   - Quy trình ghi điện nước nhanh và tạo VietQR.
