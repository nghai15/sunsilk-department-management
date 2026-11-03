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

## Các lệnh thường dùng

Chạy tại thư mục `backend`:

| Thao tác | Lệnh |
|---|---|
| Khởi động | `npx.cmd supabase start` |
| Xem trạng thái | `npx.cmd supabase status` |
| Dừng và giữ dữ liệu | `npx.cmd supabase stop` |

