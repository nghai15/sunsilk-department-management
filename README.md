# Sunsilk · Quản lý nhà trọ

Ứng dụng React + TypeScript + Supabase cho chủ trọ, quản trị, quản lý và người thuê. Quản lý phòng, hợp đồng, điện nước, hóa đơn, thanh toán, sự cố và thông báo.

## Chạy local

Cần Node.js 22+ và Docker Desktop đang chạy.

Tại `backend`, chạy và giữ terminal mở:

```powershell
npx.cmd supabase start
npx.cmd supabase functions serve
```

Tại `frontend`, cài thư viện và tạo cấu hình ở lần đầu:

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Điền `VITE_SUPABASE_ANON_KEY` trong `.env` bằng anon key từ `npx.cmd supabase status` (chạy tại `backend`). Sau đó:

```powershell
npm.cmd run dev
```

Mở http://localhost:5173. Sau khi pull code, chạy lại `npm.cmd run dev`; các cập nhật schema mới trong migration 006 được áp dụng tự động trên local, giữ nguyên dữ liệu.

## Tài khoản mẫu

Mật khẩu chung: `123456` — chỉ dùng local.

| Vai trò | Số điện thoại |
|---|---|
| Chủ trọ | `0901234567` |
| Quản trị | `0922222222` |
| Quản lý | `0911111111` |
| Người thuê P101 | `0987654321` |
| Người thuê P201 | `0976543210` |

## Tài liệu

- [Vận hành, kiểm thử và triển khai](docs/van-hanh-va-trien-khai.md)
- [Backend](backend/README.md)
- [Phân quyền](docs/phan-quyen.md)
- [Thanh toán tự động SePay](docs/thanh-toan-tu-dong-sepay.md)
- [Kế hoạch SMS](docs/ke-hoach-sms-otp.md)
