# Thanh toán tự động qua SePay

Đã triển khai trong sunsilk-department-management. Chưa kết nối ngân hàng thật.
Mặc định `khu_tro.thanh_toan_tu_dong=false`; chỉ bật sau khi cấu hình đúng ngân hàng và webhook.
Phiên bản này dùng một tài khoản nhận tiền / một ngân hàng cho mỗi môi trường, có thể dùng chung cho nhiều khu trọ. Nếu mỗi chủ trọ dùng một tài khoản khác nhau, cần mở rộng cấu hình webhook theo tài khoản trước khi triển khai mô hình đó.

## Luồng sử dụng

1. Quản lý kiểm tra công tơ, phát hành hóa đơn như hiện tại.
2. Người thuê quét QR chứa số còn nợ và mã `SS` + 32 ký tự của hóa đơn. Không sửa nội dung chuyển khoản.
3. SePay gửi thông báo tiền vào. Backend xác thực API key và kiểm tra tài khoản, ngân hàng, số tiền, mã hóa đơn đã phát hành.
4. Khoản hợp lệ tự ghi nhận, thông báo người thuê. Trang hóa đơn đang mở cập nhật mỗi 5 giây khi có mạng và đang được xem.
5. Chuyển thiếu: còn nợ phần còn lại. Chuyển thừa: phân bổ tối đa số còn nợ, phần dư nằm ở mục Giao dịch ngân hàng.
6. Sai mã, nhiều mã hoặc chưa phát hành: giữ ở mục Giao dịch ngân hàng, không tự đoán người thuê theo số tiền.
7. Chủ trọ/quản trị có thể ghép giao dịch sai nội dung vào mã hóa đơn đúng và ghi lý do. Khoản dư cần hoàn tiền/xử lý bên ngoài rồi ghi kết quả; nút lưu đối soát không thực hiện chuyển tiền hay hoàn tiền.

Giao dịch tự động không được sửa/xóa bằng tài khoản người dùng. Biên lai thủ công vẫn là cách hỗ trợ; không duyệt lại một khoản đã được SePay ghi nhận. Giới hạn tổng đã thu chặn cộng vượt hóa đơn, nhưng người đối soát vẫn cần kiểm tra biên lai có trùng khoản tự động hay không, nhất là khoản trả từng phần.

## 1. Kiểm thử tự động, không cần SePay

Tại thư mục gốc dự án:

```powershell
node --experimental-strip-types backend/tests/sepay-webhook.test.mjs
npm.cmd --prefix backend/tests test
Get-Content -Raw backend/tests/sepay-local.sql | docker exec -i supabase_db_nha-tro-pwa psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Phép thử SQL chỉ chạy với Docker local có dữ liệu seed. Tạo hóa đơn thử trong transaction rồi ROLLBACK, không lưu thay đổi vào hóa đơn đang dùng. Bao gồm trả thiếu/đủ/thừa, thông báo lặp, trùng ID nhưng khác dữ liệu, sai tài khoản/mã, hóa đơn nháp, quyền truy cập và đối soát thủ công.

Schema nằm trong migration 006 hiện có, bản mirror ở backend/supabase/migrations cũng được cập nhật. Máy local hiện tại đã áp dụng phần bổ sung, không cần reset. Với máy đã chạy migration cũ, trích riêng phần giữa `SEPAY_AUTO_PAYMENT_BEGIN` và `SEPAY_AUTO_PAYMENT_END` trong migration 006 để áp dụng sau khi sao lưu; không chạy lại toàn bộ migration hay reset dữ liệu đang sử dụng.

## 2. Thử trên giao diện local

File `backend/sepay.env.local` (được Git bỏ qua) đã có khóa ngẫu nhiên và tài khoản giả TEST-SEPAY cho local. Nếu tạo mới, sao chép các biến SEPAY từ backend/.env.example và tạo khóa ngẫu nhiên tối thiểu 32 ký tự. Không đưa khóa vào frontend hoặc gửi lên chat.

Chạy từ thư mục backend, giữ cửa sổ này mở:

```powershell
npx.cmd supabase functions serve --env-file sepay.env.local
```

Trong giao diện chủ trọ: Khu trọ & phòng → Khu trọ → Sửa có ô “Tự động xác nhận chuyển khoản qua SePay”. Với tài khoản thật, điền đủ thông tin nhận tiền rồi bật sau khi kiểm tra kết nối. Riêng tài khoản giả TEST-SEPAY không phải số tài khoản hợp lệ, cấu hình bằng Supabase Studio local: Với dữ liệu giả chỉ dùng kiểm thử:

```sql
UPDATE public.khu_tro
SET so_tai_khoan='TEST-SEPAY', ma_bin_ngan_hang='970436',
    thanh_toan_tu_dong=true
WHERE id='<UUID khu trọ thử>';
```

Không dùng tài khoản TEST-SEPAY để chuyển tiền thật. Chọn một hóa đơn thử đã phát hành, lấy mã SS trong popup chi tiết hoặc phần QR. Từ thư mục gốc:

```powershell
node backend/scripts/simulate-sepay.mjs SS<32-ký-tự-mã-hóa-đơn> 10000 9000000001
```

Lệnh này chỉ gửi đến localhost, nhưng **có lưu khoản thanh toán giả vào dữ liệu local**. Chỉ dùng hóa đơn thử, không dùng hóa đơn vận hành thật. Gửi lại cùng mã giao dịch và dữ liệu để thử chống lặp; đổi ID khi muốn mô phỏng một lần chuyển khác. Đăng nhập người thuê, mở chi tiết hóa đơn để thấy số còn nợ tự thay đổi. Chủ trọ xem tab Giao dịch ngân hàng để đối soát.

Có thể kiểm tra endpoint HTTP đã chạy bằng `node backend/tests/sepay-http-local.test.mjs`: script dùng tài khoản TEST-SEPAY, kiểm tra xác thực, retry và tự xóa giao dịch thử.

## 3. Chuyển khoản thật khi backend vẫn chạy local

- Kết nối tài khoản ngân hàng được hỗ trợ trong SePay.
- Thay SEPAY_ACCOUNT_NUMBER, SEPAY_BANK_BIN, SEPAY_GATEWAY bằng thông tin thật trong file env. Gateway phải đúng tên SePay gửi (ví dụ Vietcombank); BIN là mã ngân hàng dùng trong VietQR. Đặt cùng số tài khoản/BIN và tên chủ tài khoản trong cấu hình khu trọ.
- Dùng khóa webhook mới cho kết nối thật và khởi động lại `functions serve`. Không dùng bộ giả lập với dữ liệu vận hành.
- Khởi động proxy chỉ cho webhook từ thư mục gốc:

```powershell
node backend/scripts/sepay-local-proxy.mjs
```

- Sau khi cài cloudflared, mở terminal khác:

```powershell
cloudflared tunnel --url http://127.0.0.1:8788
```

Không trỏ tunnel trực tiếp vào cổng 54321 hoặc Studio. Proxy chỉ chuyển tiếp POST /sepay-webhook; các đường dẫn khác bị từ chối.

- Trong SePay tạo webhook: sự kiện Có tiền vào; tài khoản đúng; JSON; xác thực API Key bằng SEPAY_WEBHOOK_API_KEY; URL `https://<địa-chỉ-tạm>.trycloudflare.com/sepay-webhook`.
- Không đặt bộ lọc tiền tố nếu muốn thu cả giao dịch sai nội dung để đối soát.
- Bật gửi lại khi server trả lỗi ngoài 200–299. Thử gửi payload có mã hóa đơn thử, rồi thử một hóa đơn số tiền nhỏ bằng chuyển khoản thật.
- Bật thanh_toan_tu_dong cho đúng khu sau khi kết nối hoạt động. Hóa đơn phải được phát hành trước khi chuyển.

Máy local, Docker, functions serve, proxy và tunnel cần chạy trong suốt thời gian thử. Đường dẫn tunnel đổi khi khởi động lại, phải cập nhật trong SePay. Khi máy tắt lâu, kiểm tra nhật ký webhook và gửi lại các giao dịch bị lỗi. Hiện chưa có tác vụ tự kéo giao dịch bù từ API khi bỏ lỡ webhook.

## 4. Triển khai thật

Dùng Supabase triển khai ổn định, áp dụng schema đã kiểm thử và cấu hình secrets phía backend. Triển khai `sepay-webhook` với verify_jwt=false (function tự kiểm tra API Key), đổi URL webhook thành `https://<project>.supabase.co/functions/v1/sepay-webhook`.
Không đưa file môi trường local/test lên môi trường thật. Chỉ bật chế độ tự động cho khu đã xác nhận đúng kết nối ngân hàng. Theo dõi các lần webhook thất bại và mục cần đối soát mỗi ngày.

## Nguồn tích hợp

- SePay: https://docs.sepay.vn/tich-hop-webhooks.html — Authorization Apikey, JSON, trả success:true và chống lặp theo ID.
- Cloudflare: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ — tunnel HTTPS tạm để thử local, không dùng làm dịch vụ vận hành lâu dài.
