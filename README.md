# PWA Quản Lý Nhà Trọ

Ứng dụng PWA (Progressive Web App) hỗ trợ quản lý nhà trọ, căn hộ dịch vụ với giao diện hiện đại (Mobile-First), hỗ trợ hoạt động offline, quét mã VietQR và gửi thông báo nhắc nợ qua Web Push.

## 📁 Cấu trúc dự án

```text
pwa-quan-ly-nha-tro/
├── .github/
│   └── workflows/              # CI/CD pipeline (build, test, deploy)
├── docs/                       # Tài liệu thiết kế DB, API specs, wireframe
├── backend/                    # Edge Functions hoặc Serverless backend
│   ├── functions/
│   │   ├── cron-reminders/     # Tác vụ định kỳ nhắc nợ trước/đúng/quá hạn
│   │   └── send-webpush/       # Xử lý đẩy Web Push notification
│   ├── migrations/             # SQL schema (Khu nhà, Phòng, Hóa đơn, Sự cố...)
│   └── seed/                   # Dữ liệu mẫu phục vụ phát triển & test
├── frontend/                   # Ứng dụng PWA (React/Vue + Tailwind CSS)
│   ├── public/
│   │   ├── icons/              # App icons kích thước PWA (192x192, 512x512)
│   │   ├── manifest.json       # Cấu hình PWA manifest
│   │   └── sw.js               # Service Worker (offline cache, push listener)
│   ├── src/
│   │   ├── assets/             # Hình ảnh, biểu tượng tĩnh
│   │   ├── components/         # UI components dùng chung
│   │   │   ├── common/         # Button, Input, Modal, Toast, Badge
│   │   │   ├── layout/         # Header, BottomNavigation, Sidebar
│   │   │   └── forms/          # Form chụp ảnh/upload ảnh công tơ, chuyển khoản
│   │   ├── features/           # Phân tách logic theo domain nghiệp vụ
│   │   │   ├── auth/           # Đăng nhập số điện thoại/mật khẩu, phân quyền role
│   │   │   ├── properties/     # Quản lý Khu trọ & Phòng, lọc phòng, hợp đồng
│   │   │   ├── billing/        # Nhập chỉ số, tính tiền, hóa đơn, VietQR
│   │   │   ├── issues/         # Báo sự cố, tiến độ xử lý, chi phí
│   │   │   ├── notifications/  # Hộp thông báo, cấu hình gửi theo phòng/khu
│   │   │   └── dashboard/      # Bảng tổng quan doanh thu, phòng trống, sự cố
│   │   ├── hooks/              # Custom hooks (useAuth, usePWAInstall, usePush)
│   │   ├── services/           # Tương tác Supabase/Firebase API, Storage
│   │   ├── types/              # TypeScript interface (Room, Bill, Issue, User)
│   │   ├── utils/              # Format tiền tệ VNĐ, công thức điện nước, tạo VietQR
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── vite.config.ts
└── README.md
```

## 🚀 Công nghệ sử dụng
- **Frontend**: React 18 / Vite / TypeScript / Tailwind CSS
- **PWA**: Service Worker, Web Push API, Manifest
- **Backend / BaaS**: Supabase / PostgreSQL / Edge Functions
- **Tiện ích**: VietQR generation, Image compression, Offline-first storage (IndexedDB)
