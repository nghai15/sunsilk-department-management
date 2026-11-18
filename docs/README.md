# HỆ THỐNG TÀI LIỆU DỰ ÁN PWA QUẢN LÝ NHÀ TRỌ

Thư mục này lưu trữ toàn bộ tài liệu kỹ thuật, đặc tả giao diện UI/UX, kịch bản kiểm thử, báo cáo chất lượng và kế hoạch nghiệm thu thực tế của dự án do **Thành viên 6 (QA / UI-UX Specialist & Technical Writer)** chủ trì biên soạn và hoàn thiện:

---

## 📚 DANH MỤC TÀI LIỆU DỰ ÁN

### 1. Đặc Tả Giao Diện & Trải Nghiệm Người Dùng (UI/UX)
- 🎨 [**Đặc tả Thiết kế UI/UX & Wireframe (Mobile-First)**](wireframe-ui-ux.md): Quy chuẩn nút bấm tối thiểu 48px cho người lớn tuổi, bảng màu trạng thái phòng chuẩn hóa, thanh điều hướng đáy Bottom Navigation và bản vẽ Wireframe 4 màn hình chính.
- 📱 [**Bản Mô Phỏng Wireframe Tương Tác (Interactive Prototype)**](prototype/wireframe-preview.html): Trang HTML mô phỏng trải nghiệm ứng dụng trên khung điện thoại thông minh, cho phép click chuyển đổi trực quan giữa các màn hình.

### 2. Kế Hoạch & Báo Cáo Kiểm Thử Chất Lượng (QA / Testing)
- 🧪 [**Kịch bản Kiểm thử Hệ thống (Test Cases Specification)**](kich-ban-kiem-thu-test-cases.md): Bộ 25+ test cases chi tiết bao phủ các phân hệ: PWA Offline, Web Push VAPID, Xác thực & RLS, Hóa đơn & VietQR, Sự cố, Cron tự động và biểu mẫu Bug Report.
- 📊 [**Báo cáo Kết quả Thực thi Kiểm thử (QA Test Execution Report)**](bao-cao-kiem-thu-qa.md): Đánh giá chi tiết kết quả chạy kiểm thử thực tế, tỷ lệ đạt 96%, nhật ký theo dõi lỗi (Defect Log) và xác nhận độ sẵn sàng phát hành.

### 3. Triển Khai Thử Nghiệm Thực Tế & Nghiệm Thu (UAT)
- 🚀 [**Kế hoạch Thử nghiệm UAT (3 - 5 phòng thật)**](ke-hoach-uat-3-5-phong.md): Quy trình triển khai 1 chu kỳ thu tiền tháng với 4 phòng trọ thí điểm, tiêu chí nghiệm thu (Acceptance Criteria) và phiếu khảo sát người dùng.
- 📝 [**Biên bản Nghiệm thu Thử nghiệm Thực tế (UAT Sign-off Report)**](bien-ban-nghiem-thu-uat.md): Nhật ký 7 ngày vận hành thực tế tại Nhà trọ Bình An, bảng kết quả khảo sát sự hài lòng CSAT đạt 97%, xác nhận 0 lỗi tài chính với đầy đủ chữ ký các bên.

### 4. Hướng Dẫn Vận Hành & Người Dùng Cuối
- 📲 [**Hướng dẫn Cài đặt & Sử dụng PWA cho Người thuê**](huong-dan-cai-dat-pwa.md): Cẩm nang chi tiết từng bước thêm ứng dụng ra màn hình chính trên iOS Safari (iOS 16.4+) và Android Chrome, bật Web Push, quét VietQR trả tiền và gửi biên lai UNC.

### 5. Kiến Trúc Dữ Liệu & Nghiệp Vụ Backend
- 🗄️ [**Từ điển Cơ sở dữ liệu (Database Schema)**](co-so-du-lieu.md): Danh mục chuẩn hóa tiếng Việt của toàn bộ bảng, cột, kiểu dữ liệu, ràng buộc và hàm/trigger trên PostgreSQL/Supabase.
- 🔐 [**Phân quyền Vai trò & Row Level Security (RLS)**](phan-quyen.md): Ma trận phân quyền giữa Chủ trọ, Quản lý và Người thuê phòng.
- ⚙️ [**Quy trình Xử lý Sự cố & Phân quyền Quản lý**](quy-trinh-xu-ly-su-co.md): Chi tiết vòng đời trạng thái sự cố, ràng buộc lý do khi hoãn xử lý, ghi nhận chi phí và tài liệu API RPC cho Frontend.
