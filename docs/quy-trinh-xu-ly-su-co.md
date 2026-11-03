# Quy trình xử lý sự cố

Quản lý xem báo cáo trong các khu được phân công, kiểm tra thực tế, xử lý hoặc liên hệ thợ, rồi cập nhật tiến độ. Người thuê theo dõi trạng thái và nhận thông báo trong app khi trạng thái thay đổi. Web Push sử dụng cơ chế webhook/Edge Function đã có nếu được cấu hình.

## Vai trò và phạm vi

| Vai trò | Thao tác với sự cố |
|---|---|
| Người thuê | Gửi báo cáo kèm ảnh; xem sự cố của phòng và lịch sử; sửa nội dung hoặc hủy báo cáo của mình khi còn chờ tiếp nhận |
| Quản lý | Xem, cập nhật trạng thái, ghi chú và chi phí trong khu được gán qua `nhan_su_khu_tro` |
| Chủ trọ | Xem và can thiệp đối với sự cố thuộc khu mình sở hữu |
| Quản trị | Xem và can thiệp đối với sự cố trong các khu của hệ thống |

Người thuê không được tự đánh dấu đã xử lý, điền ghi chú xử lý hoặc thay đổi chi phí. Người quản lý không xem hay xử lý được sự cố ở khu chưa được phân công. RLS và trigger kiểm tra cả khi gọi RPC lẫn cập nhật bảng trực tiếp.

## Trạng thái

| Giá trị DB | Nhãn hiển thị | Ý nghĩa |
|---|---|---|
| `cho_tiep_nhan` | Chờ tiếp nhận | Báo cáo mới gửi, chưa được xử lý |
| `dang_xu_ly` | Đang xử lý | Quản lý đang kiểm tra, sửa chữa hoặc phối hợp với thợ |
| `chua_the_xu_ly` | Chưa thể xử lý | Bắt buộc ghi lý do, ví dụ chờ linh kiện hoặc chờ người thuê mở cửa |
| `hoan_tat` | Đã xử lý | Đã khắc phục; có thể ghi kết quả và chi phí |
| `da_huy` | Đã hủy | Báo cáo nhầm, trùng hoặc không còn cần xử lý |

Ví dụ: **Chờ tiếp nhận → Đang xử lý → Chưa thể xử lý → Đang xử lý → Đã xử lý**. Đây là ví dụ luồng thường gặp; hệ thống không bắt buộc quản lý phải đi qua từng bước. Nhân sự có thể mở lại sự cố đã hoàn tất bằng trạng thái Đang xử lý.

`hoan_tat` giữ nguyên giá trị đã dùng trong database; giao diện hiển thị là **Đã xử lý**. Sự cố Chưa thể xử lý vẫn tính vào tổng sự cố còn mở và cảnh báo trên danh sách phòng.

## Dữ liệu và lịch sử

- `su_co.ghi_chu_xu_ly`: ghi chú mới nhất của người xử lý; không được rỗng hoặc chỉ có khoảng trắng khi trạng thái là Chưa thể xử lý.
- `su_co.hoan_tat_luc`: database tự ghi khi hoàn tất; giữ nguyên nếu chỉ sửa ghi chú của sự cố đã hoàn tất; xóa khi mở lại.
- `lich_su_su_co`: tự ghi trạng thái trước/sau, ghi chú, chi phí tại thời điểm cập nhật, người thực hiện và thời gian.
- Cập nhật ghi chú hoặc chi phí mà giữ nguyên trạng thái vẫn tạo lịch sử. Lưu lại dữ liệu không đổi không tạo lịch sử trùng.
- Đổi trạng thái gửi thông báo cho người báo cáo, kèm ghi chú để họ biết lý do chưa thể xử lý. Chỉ sửa ghi chú/chi phí không tạo thông báo lặp.
- Lịch sử cũ được giữ nguyên. Cột chi phí của các bản ghi lịch sử trước migration 006 để NULL vì trước đây chưa lưu số liệu này.

## API cho frontend

Danh sách sự cố sử dụng bảng `su_co`; RLS tự giới hạn phạm vi theo phiên đăng nhập. Có thể lọc theo `phong_id`, `phan_loai`, `trang_thai` và sắp xếp theo `tao_luc`. Lịch sử đọc từ bảng `lich_su_su_co`, lọc theo `su_co_id`.

Nhân sự cập nhật bằng RPC:

```ts
const { data, error } = await supabase.rpc('cap_nhat_xu_ly_su_co', {
  p_su_co_id: suCoId,
  p_trang_thai: 'chua_the_xu_ly',
  p_ghi_chu_xu_ly: 'Chờ linh kiện thay thế, sẽ cập nhật khi có hàng.',
});
```

Hoàn tất và ghi nhận chi phí:

```ts
const { data, error } = await supabase.rpc('cap_nhat_xu_ly_su_co', {
  p_su_co_id: suCoId,
  p_trang_thai: 'hoan_tat',
  p_ghi_chu_xu_ly: 'Đã thay linh kiện và kiểm tra hoạt động.',
  p_chi_phi_sua_chua: 350000,
});
```

RPC chấp nhận `dang_xu_ly`, `chua_the_xu_ly`, `hoan_tat`, `da_huy`. Trạng thái ban đầu Chờ tiếp nhận được tạo khi gửi báo cáo. Chi phí bỏ qua hoặc NULL sẽ giữ số cũ; truyền 0 để đặt về 0. Ghi chú bỏ qua hoặc NULL sẽ xóa ghi chú hiện tại, nhưng ghi chú cũ vẫn nằm trong lịch sử. Mỗi lần chọn Chưa thể xử lý phải truyền lý do không rỗng.

RPC trả về dòng `su_co` với tên cột `snake_case`. Frontend chuyển `ghi_chu_xu_ly` thành `ghiChuXuLy`, `chi_phi_sua_chua` thành `chiPhiSuaChua`, cùng quy ước đã có trong `src/types/index.ts`.

Các nhãn và danh sách trạng thái còn mở có sẵn tại `frontend/src/utils/suCo.ts`. Kiểu lịch sử là `LichSuSuCo`. Màn hình `features/issues` chưa có trong bản mã nguồn hiện tại; cần nối giao diện vào API trên.

## Cập nhật database

Nếu database đã áp dụng 001–005, chạy file `backend/migrations/006_quy_trinh_xu_ly_su_co.sql` trong Supabase SQL Editor. Migration bổ sung cột, trạng thái và thay hàm/trigger/view liên quan; giữ dữ liệu cũ. Không xóa database và không cần chạy lại seed.

Database mới áp dụng lần lượt 001–006, sau đó seed như hướng dẫn trong `backend/README.md`. Nếu dùng Supabase CLI, cập nhật bản copy/liên kết trong `backend/supabase/migrations` trước khi áp dụng migration.

## Kiểm thử

```bash
cd backend/tests
npm install
npm test
```

Bộ kiểm thử chạy PostgreSQL trong bộ nhớ bằng PGlite, áp dụng migrations 001–006 của dự án và giả lập phần Auth/Storage. Không kết nối database thật. Các kịch bản kiểm tra quyền quản lý theo khu, quyền người thuê, lý do bắt buộc, lịch sử, thông báo trong app, chi phí, hoàn tất/mở lại, dashboard và nâng cấp giữ dữ liệu cũ.

Chạy kiểm thử Supabase Auth, Realtime, webhook và Web Push trên môi trường Supabase riêng trước khi triển khai thực tế; bộ kiểm thử này chỉ xác minh nghiệp vụ SQL/RLS và bản ghi thông báo trong app.
