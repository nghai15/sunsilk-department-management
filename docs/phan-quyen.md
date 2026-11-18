# Phân quyền

Thứ tự: `chu_tro` > `quan_tri` > `quan_ly` > `nguoi_thue`.

| Nghiệp vụ | Chủ trọ | Quản trị hệ thống | Quản lý | Người thuê |
|---|---|---|---|---|
| Quản lý tài khoản, đổi role | Tất cả | Chỉ tài khoản quản lý/người thuê; chỉ chuyển giữa hai role này | Chỉ sửa hồ sơ cá nhân | Chỉ sửa hồ sơ cá nhân |
| Tạo/xóa khu, phân công quản lý | Tất cả | Tất cả | Không | Không |
| Chuyển chủ sở hữu khu | Có | Không | Không | Không |
| Phòng, hợp đồng, phí, chỉ số, hóa đơn, duyệt thanh toán | Toàn hệ thống | Toàn hệ thống | Khu được giao | Xem dữ liệu được phép, gửi biên lai của mình |
| Xem sự cố, lịch sử | Toàn hệ thống | Toàn hệ thống | Khu được giao | Phòng đang thuê/báo cáo của mình |
| Xử lý sự cố, ghi chú, chi phí, xóa sự cố | Giám sát/can thiệp | Không | Trực tiếp xử lý trong khu được giao | Không |
| Gửi sự cố, sửa/hủy báo cáo đang chờ tiếp nhận | Có | Không | Khu được giao | Báo cáo của mình |
| Hộp thư cá nhân, đăng ký push | Của mình | Của mình | Của mình | Của mình |

Người thuê không được tự đổi role, trạng thái hoạt động, SĐT hay thông tin xử lý sự cố.
Quản trị chỉ đọc ảnh sự cố, không tải lên/xóa ảnh sự cố.

## Áp dụng

Chạy tại `backend` để tạo lại database local:

```powershell
npx.cmd supabase db reset --local
```

Reset xóa dữ liệu local và nạp lại dữ liệu mẫu.
