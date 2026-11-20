# Sunsilk · Quản lý nhà trọ

Ứng dụng React + TypeScript + Supabase cho chủ trọ, quản trị, quản lý khu trọ và người thuê.

## Chức năng

- Khu trọ, phòng, ngân hàng nhận tiền, dịch vụ và đơn giá theo kỳ.
- Người thuê, tài khoản nhân sự, phân công quản lý theo khu.
- Tạo/kết thúc hợp đồng, chỉ số bàn giao và dịch vụ áp dụng.
- Chụp công tơ trên web, duyệt hoặc yêu cầu chụp lại, hóa đơn và VietQR.
- Biên lai, đối soát và thanh toán một phần; báo cáo theo kỳ, xuất CSV.
- Sự cố, phản hồi, lịch sử xử lý; thông báo trong app và tích hợp Web Push.
- Đăng nhập, quên mật khẩu OTP SMS, đổi mật khẩu, xác nhận đăng xuất.
- PWA có trang ngoại tuyến, giao diện dùng trên điện thoại và máy tính.

## Bắt đầu

1. Mở Docker Desktop.
2. Tại `backend`: `npx supabase start`, rồi `npx supabase functions serve`.
3. Tại `frontend`: `npm ci`, tạo `.env` theo `.env.example`, rồi `npm run dev`.
4. Mở `http://localhost:5173`.

Mật khẩu tài khoản mẫu local: `123456`. Chủ trọ `0901234567`, quản trị `0922222222`, quản lý `0911111111`, người thuê `0987654321` hoặc `0976543210`.

## Tài liệu

- [Hướng dẫn chạy local, nghiệp vụ, kiểm thử và triển khai](docs/van-hanh-va-trien-khai.md)
- [Backend và OTP local](backend/README.md)
- [Phân quyền](docs/phan-quyen.md)
- [Quy trình sự cố](docs/quy-trinh-xu-ly-su-co.md)

SMS thật, Web Push và lịch nhắc nợ cần cấu hình dịch vụ. QR chưa tự đối soát ngân hàng; công tơ chưa dùng OCR. Giá thuê tính theo tháng. Không chạy reset database khi cần giữ dữ liệu.

[Hướng dẫn thanh toán tự động qua SePay](docs/thanh-toan-tu-dong-sepay.md) — cấu hình, thử local, đối soát và kết nối ngân hàng thật.
