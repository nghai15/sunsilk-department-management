# Kế hoạch SMS OTP cho Sunsilk

Ngày tra cứu: 18/11/2026. Phạm vi: SMS quên mật khẩu người thuê; không bao gồm hosting, tên miền, database hoặc công tích hợp. Chưa đăng ký tài khoản, chưa nạp tiền, chưa gửi SMS thật.

## Kết luận ngân sách

Chưa xác minh được mức nạp tối thiểu dài hạn của phương án ưu tiên SpeedSMS. Không coi 750đ (giá một SMS) là số tiền đủ để kích hoạt dịch vụ. Cần báo giá/tài khoản nhà cung cấp để chốt chi phí ban đầu.

| Phương án | Dữ kiện công khai | Phần còn phải xác nhận |
|---|---|---|
| SpeedSMS Verify | 750đ/SMS; bảng giá ghi gồm VAT; không phí đăng ký/duy trì Verify | Mức nạp nhỏ nhất, hạn số dư, cá nhân được kích hoạt hay không, sản lượng tối thiểu, giá hiện hành |
| eOTP của ViHAT | Có gói thử 100 OTP/30 ngày sau duyệt; SMS gói Developer trên trang tiếng Việt: 2.000đ/tin | Mức nạp nằm sau đăng nhập; VAT; giá trả phí sau gói thử; khả năng tích hợp với mã do Supabase tạo |

Nguồn: [SpeedSMS giá](https://speedsms.vn/bang-gia-dich-vu-tin-nhan-hien-thi-dau-so/), [SpeedSMS OTP](https://speedsms.vn/sms-otp-service/), [eOTP](https://eotp.com.vn/vi/), [điều khoản eOTP, mục 7](https://eotp.com.vn/en/terms).

OTPS Cloud có kết quả tìm kiếm nêu nạp 100.000đ, nhưng trang trực tiếp trả lỗi 502 khi kiểm tra. Chưa dùng con số này để chọn dịch vụ hoặc khẳng định mức thấp nhất thị trường. Không sử dụng dịch vụ thuê số nhận OTP: đó là loại dịch vụ khác với gửi OTP cho người thuê.

## Mô hình chi phí ưu tiên

Tạm tính theo SpeedSMS Verify, mỗi yêu cầu gửi tương ứng một SMS ngắn; cộng cả gửi lại và các tin bị tính phí dù người nhận chưa nhập mã. Giá cần được nhà cung cấp xác nhận trước khi mua.

| Tin/tháng | Tiền sử dụng/tháng | Tiền sử dụng/năm |
|---:|---:|---:|
| 5 | 3.750đ | 45.000đ |
| 10 | 7.500đ | 90.000đ |
| 20 | 15.000đ | 180.000đ |
| 50 | 37.500đ | 450.000đ |

Các giá trị là phép nhân dự toán, không phải cam kết về lượng dùng. Không có số tin tối thiểu bắt buộc đã được xác minh. Tháng không gửi có tiền SMS biến đổi bằng 0; vẫn phải xác nhận cam kết doanh số/phí khác.

Tiền nạp là số dư trả trước, không tự động đồng nghĩa với chi phí mỗi tháng. Nếu nhà cung cấp chấp nhận nạp 100.000đ và không hết hạn số dư, khoản đó mua được 133 SMS theo giá 750đ; trừ 10 SMS kiểm tra còn 123 SMS. Đây chỉ là ví dụ, KHÔNG phải mức nạp tối thiểu đã xác nhận.

## Giai đoạn 1 — Chốt điều kiện thương mại

Chủ dự án lấy xác nhận bằng văn bản từ SpeedSMS trước khi mua. Nếu không phù hợp, lấy báo giá eSMS/eOTP để so sánh tổng chi phí 12 tháng, gồm phí khởi tạo, duy trì, cam kết sử dụng và số dư có thể hết hạn.

Cần hỏi: cá nhân/hộ kinh doanh đăng ký được không; số tiền nạp tối thiểu; tiền có hết hạn không; tháng không gửi có mất phí không; giá SMS OTP cho 5–20 tin/tháng và VAT; gửi thất bại có trừ tiền/hoàn tiền không; tên gửi và mẫu nội dung; có cho gửi mã do Supabase sinh không; yêu cầu duyệt website; hỗ trợ khi không nhận được SMS.

Chỉ chọn sau khi nhận đủ thông tin về khoản nạp đầu tiên và phí cố định. Ngân sách chuẩn bị nội bộ có thể là 100.000đ, nhưng không nạp cho đến khi xác nhận gói đáp ứng ngân sách.

## Giai đoạn 2 — Tích hợp theo kiến trúc hiện tại

Luồng đang có dùng Supabase để tạo mã, xác minh mã và cấp phiên đổi mật khẩu. Phương án ưu tiên giữ luồng này: Supabase → Send SMS Hook → hàm backend → API gửi SMS của nhà cung cấp → điện thoại. [Tài liệu Supabase](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook).

- Thêm hàm backend gửi SMS, kiểm tra chữ ký của hook trước khi xử lý. Chỉ gọi API nhà cung cấp bằng HTTPS.
- Khóa API chỉ lưu trong secrets phía máy chủ; không đặt trong biến VITE hoặc mã giao diện.
- Giữ shouldCreateUser:false. Chặn gửi cho hồ sơ không phải người thuê/đã khóa ở phía máy chủ, tránh chỉ kiểm tra sau khi người dùng nhập OTP.
- Tắt mã OTP thử và cấu hình SMS giả trên môi trường thật.
- Dùng một SMS ngắn cho mỗi lần gửi; không ghi OTP, mật khẩu hoặc toàn bộ nội dung SMS vào nhật ký.
- Xác nhận phản hồi gửi được chấp nhận khác với đã giao đến điện thoại; lưu mã giao dịch và trạng thái giao tin nếu nhà cung cấp hỗ trợ.
- eOTP tự tạo/xác minh mã theo API công khai. Không thay khóa API vào luồng hiện tại rồi cho rằng hoạt động: phải xác minh chế độ gửi mã bên ngoài hoặc thiết kế lại xác minh phía backend. Ưu tiên tránh việc này nếu chỉ cần ít SMS. [API eOTP](https://eotp.com.vn/docs/).

## Giai đoạn 3 — Giới hạn chi phí và chống gửi lặp

Đề xuất ban đầu, cần hiệu chỉnh theo số người thuê:

- OTP 6 số, hiệu lực 5 phút; gửi lại cách nhau tối thiểu 60 giây.
- Tối đa 3 lần gửi/số/giờ, 5 lần/số/ngày; giới hạn bổ sung theo IP. Kiểm tra trên máy chủ, không chỉ khóa nút giao diện.
- Tối đa 5 lần nhập sai/mã; mã đã dùng hoặc đã hết hạn không đổi được mật khẩu.
- CAPTCHA được kiểm tra phía máy chủ; thông báo chung để không tiết lộ số nào có tài khoản.
- Ngân sách đề xuất 50 SMS/tháng (37.500đ theo giá tham khảo), cảnh báo ở 40 tin; ngừng gửi khi chạm trần và báo quản trị. Không bật tự nạp tiền trong giai đoạn đầu.
- Bộ đếm dùng database và cập nhật nguyên tử để nhiều yêu cầu đồng thời không vượt hạn mức. Timeout không tự gửi lại ngay vì có thể nhà cung cấp đã tính phí.
- Đăng nhập bằng mật khẩu vẫn hoạt động nếu SMS hết tiền/lỗi. Trang quên mật khẩu báo rõ dịch vụ tạm gián đoạn; không thay thế OTP bằng mã cố định.

Các giới hạn trên là công việc cần triển khai/kiểm tra thêm, không phải tất cả đã có trong bản local.

## Giai đoạn 4 — Kiểm tra và đưa vào dùng

1. Kiểm tra local bằng nhà cung cấp giả, không phát SMS tính phí.
2. Sau khi chủ dự án đăng ký và chấp thuận chi phí: dùng 6–10 SMS kiểm tra trên số điện thoại được phép, ưu tiên Viettel, VinaPhone, MobiFone. Ngân sách 10 SMS là 7.500đ theo giá tham khảo.
3. Kiểm tra mã đúng/sai/hết hạn/tái sử dụng; số không có tài khoản; tài khoản khóa; nhiều lần bấm và nhiều tab; gửi lại; nhà cung cấp lỗi; hết số dư/hạn mức; chữ ký hook sai.
4. Xác minh đổi mật khẩu xong mật khẩu cũ không đăng nhập được, tài khoản khác không bị thay đổi.
5. Đối chiếu nhật ký với số dư nhà cung cấp. Không có OTP/secrets trong log hoặc trình duyệt.
6. Chạy thử với một nhóm người thuê trong 7 ngày; xem tỷ lệ giao tin, thời gian nhận và chi phí thật.
7. Khi đạt yêu cầu mới mở cho toàn bộ người thuê. Kiểm tra số dư và chi phí hằng tuần trong tháng đầu.

## Điều kiện còn thiếu để triển khai

- Nhà cung cấp và báo giá xác nhận mức nạp/phí cố định.
- Tài khoản được duyệt, website HTTPS, mẫu OTP được chấp nhận.
- Secrets do chủ dự án nhập trong môi trường triển khai.
- Số điện thoại thử được chủ số đồng ý; ngân sách gửi thật.
- Kiểm thử đạt yêu cầu trước khi bỏ chế độ giả lập.
