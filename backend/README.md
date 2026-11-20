# Backend – PWA Quản Lý Nhà Trọ

Sử dụng Supabase: PostgreSQL, Auth, Storage và Edge Functions.

## Yêu cầu

- Node.js từ phiên bản 20 trở lên.
- Docker Desktop đã cài và đang chạy.

## Cài đặt

Mở Terminal PowerShell trong VS Code tại thư mục gốc dự án:

```powershell
cd backend
New-Item -ItemType Directory -Path .\supabase\migrations -Force | Out-Null
Copy-Item .\migrations\*.sql .\supabase\migrations -Force
npx.cmd supabase start
```

Nếu đã liên kết thư mục migrations, bỏ qua hai dòng tạo thư mục và copy.

Lần đầu Supabase sẽ tải Docker image, chạy migrations và nạp dữ liệu mẫu. Nếu hỏi cài package, nhập `y`.

- Studio: http://127.0.0.1:54323
- API: http://127.0.0.1:54321

## Tài khoản mẫu

Mật khẩu chung: `123456` — chỉ dùng local/dev.

| Vai trò | SĐT đăng nhập |
|---|---|
| Chủ trọ | `84901234567` |
| Quản lý | `84911111111` |
| Người thuê P101 | `84987654321` |
| Người thuê P201 | `84976543210` |

## Quên mật khẩu người thuê

Trang `/quen-mat-khau`: số điện thoại → OTP SMS → mật khẩu mới. Luồng chỉ yêu cầu OTP cho tài khoản có sẵn; phiên xác minh không lưu vào bộ nhớ trình duyệt và không thay thế phiên đăng nhập chính. Giao diện cho gửi lại sau 60 giây, yêu cầu mã mới sau 5 lần xác minh thất bại. Supabase local giới hạn 10 lần xác minh OTP trong 5 phút trên mỗi IP.

Local dùng số giả `84900000099` và OTP `936284` trong `auth.sms.test_otp`. Không cấu hình mã thử trên production. Số này không được tạo sẵn; bài kiểm thử tự tạo rồi xóa tài khoản thử:

```powershell
# Tại thư mục gốc project, sau khi Supabase và functions serve đang chạy
node --experimental-strip-types backend/tests/password-recovery-local.test.mjs
npm --prefix backend/tests run test:recovery
```

Để gửi SMS thật, cấu hình nhà cung cấp SMS trong Supabase Authentication → Phone, cùng giới hạn gửi SMS và xác minh OTP. Cấu hình Twilio `dummy` trong local không gửi được SMS thật. Lưu khóa nhà cung cấp ở backend/Supabase, không đưa vào biến `VITE_` hoặc mã frontend. Thử nhận OTP trên điện thoại thật trước khi triển khai.

Tài liệu: [Phone OTP](https://supabase.com/docs/guides/auth/phone-login), [cấu hình giới hạn Auth](https://supabase.com/docs/guides/local-development/cli/config).

## Các lệnh thường dùng

Để dùng thêm, sửa, xóa người thuê trong giao diện, chạy thêm một terminal tại `backend`:

```powershell
npx.cmd supabase functions serve
```

API `manage-tenants` kiểm tra phiên đăng nhập và chỉ cho phép chủ trọ hoặc quản trị viên. Tài khoản mới luôn là người thuê; hồ sơ có dữ liệu liên quan không thể xóa.

Chạy tại thư mục `backend`:

| Thao tác | Lệnh |
|---|---|
| Khởi động | `npx.cmd supabase start` |
| Xem trạng thái | `npx.cmd supabase status` |
| Dừng và giữ dữ liệu | `npx.cmd supabase stop` |
| Khởi động lại dữ liệu | `npx.cmd supabase db reset --local` |

