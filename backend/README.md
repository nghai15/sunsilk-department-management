# Backend · Supabase

PostgreSQL, Auth, Storage và Edge Functions. Xem [hướng dẫn chạy dự án](../README.md).

## Lệnh thường dùng

Chạy tại thư mục `backend`:

```powershell
npx.cmd supabase start
npx.cmd supabase functions serve
```

Giữ terminal `functions serve` mở để dùng các chức năng quản lý tài khoản.

- Xem trạng thái và khóa local: `npx.cmd supabase status`.
- Dừng và giữ dữ liệu: `npx.cmd supabase stop`.
- Studio: http://127.0.0.1:54323.
- API: http://127.0.0.1:54321.

## Database

Lần đầu Supabase chạy migrations rồi nạp seed. Hai thư mục `migrations/` và `supabase/migrations/` phải đồng bộ; CLI sử dụng thư mục thứ hai.

Khi chạy frontend bằng `npm run dev`, schema mới trong migration 006 tự cập nhật trên local. Không cần chạy seed hoặc reset riêng. Cơ chế này không cập nhật database online hoặc chạy lại migrations nền 001–005.

Không reset khi cần giữ dữ liệu. Không đưa `.env` hoặc khóa bí mật lên Git.

## Kiểm thử

Chạy tại thư mục gốc:

```powershell
npm.cmd --prefix backend/tests ci
npm.cmd --prefix backend/tests test
```

Kiểm thử cài mới và cập nhật tự động, cần Supabase local đang chạy:

```powershell
node backend/tests/fresh-install.local.test.mjs
```

Bài kiểm thử dùng database riêng và dọn sau khi xong, không reset database ứng dụng. Auth/Storage được giả lập tối thiểu.

OTP local dùng số thử `84900000099`, mã `936284`; tài khoản thử do bài kiểm thử tạo. SMS thật cần cấu hình nhà cung cấp. Chi tiết tại [tài liệu vận hành](../docs/van-hanh-va-trien-khai.md) và [kế hoạch SMS](../docs/ke-hoach-sms-otp.md).
