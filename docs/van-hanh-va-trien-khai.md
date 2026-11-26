# Vận hành và triển khai

## Chạy local

Cần Node.js 22+, Docker Desktop đang chạy. Tại thư mục gốc:

```powershell
cd backend
npx.cmd supabase start
npx.cmd supabase functions serve
```

Sau khi pull code, `npm run dev` tự cập nhật schema tính năng mới (006) trên Supabase local và giữ dữ liệu. Không cần chạy seed hoặc reset riêng.

Giữ terminal chạy Edge Functions. Trong terminal khác:

```powershell
cd frontend
npm ci
# Lần đầu: copy .env.example thành .env, điền URL và anon key từ supabase status.
npm run dev
```

Ứng dụng: `http://localhost:5173`. Studio: `http://127.0.0.1:54323`. Khởi động bình thường giữ dữ liệu; không cần `db reset`. Reset sẽ xóa dữ liệu local, chỉ dùng khi chủ động muốn khởi tạo lại dữ liệu mẫu.

Tài khoản mẫu, mật khẩu `123456`, chỉ dùng local:

| Vai trò | Số điện thoại |
|---|---|
| Chủ trọ | 0901234567 |
| Quản trị | 0922222222 |
| Quản lý | 0911111111 |
| Người thuê P101 | 0987654321 |
| Người thuê P201 | 0976543210 |

## Một vòng nghiệp vụ

1. Chủ trọ/quản trị thêm khu tại **Khu & phòng**, cấu hình ngân hàng, giá điện nước ban đầu.
2. Thêm phòng và dịch vụ. Phòng có thể chuyển giữa trống/bảo trì khi không có hợp đồng.
3. Tạo người thuê tại **Người thuê**; tạo nhân sự tại **Nhân sự**, giao khu ở **Phân công**. Chủ trọ tạo được quản trị và quản lý; quản trị chỉ tạo được quản lý.
4. Tạo hợp đồng cho phòng trống: người thuê, ngày, tiền thuê/cọc, chỉ số bàn giao, dịch vụ và số lượng. Dịch vụ và chỉ số được lưu cùng giao dịch; lỗi sẽ hoàn tác toàn bộ.
5. Người thuê đăng nhập, vào **Hóa đơn & thanh toán → Ghi chỉ số**, chụp mới cả hai công tơ và gửi chỉ số.
6. Quản lý kiểm tra ảnh trong popup hóa đơn. Nếu trả lại, phải có lý do; người thuê thấy thông báo và bắt buộc nhập/chụp lại. Chỉ sau khi được duyệt mới có QR thanh toán.
7. Người thuê chuyển khoản, gửi biên lai. Nhân sự đối soát với ngân hàng rồi duyệt/từ chối. Hệ thống hỗ trợ thanh toán một phần; dashboard tính số tiền đã được duyệt.
8. Báo cáo sự cố tại **Sự cố**; quản lý được phân công xử lý, chủ trọ có toàn quyền, quản trị chỉ xem. Người thuê xem phản hồi và lịch sử.
9. **Thông báo** chứa thông báo cá nhân; nhân sự gửi thông báo chung tới người thuê đang có hợp đồng trong khu.
10. Đổi giá tại **Hóa đơn & thanh toán → Đơn giá**, có hiệu lực từ kỳ sau. Hóa đơn đã lập giữ giá riêng. Kết thúc hợp đồng sau khi hoàn tất hóa đơn; phòng trở về trống, lịch sử vẫn giữ.

## Kiểm thử

```powershell
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix backend/tests ci
npm --prefix backend/tests test
npm --prefix backend/tests run test:recovery
```

Hai bài tích hợp sau cần Supabase và Edge Functions local đang chạy. Chỉ tạo/sửa/xóa tài khoản thử mới, không đổi mật khẩu tài khoản mẫu:

```powershell
node backend/tests/tenants-local.test.mjs
node --experimental-strip-types backend/tests/password-recovery-local.test.mjs
```

Kiểm thử PWA bằng bản build:

```powershell
cd frontend
npm run build
npm run preview -- --host 127.0.0.1
```

Mở URL preview, cài ứng dụng nếu trình duyệt hỗ trợ. Mất mạng sẽ hiện trang ngoại tuyến; không lưu dữ liệu tài khoản/API vào cache và không tự gửi lại thao tác thanh toán. Camera cần localhost hoặc HTTPS.

## Triển khai online

1. Tạo project Supabase riêng. Sao lưu database trước mỗi thay đổi; không dùng database local làm production.
2. Tại `backend`, đăng nhập CLI, `npx supabase link --project-ref <REF>`, kiểm tra migrations rồi `npx supabase db push`. Không nạp seed tài khoản mẫu lên production. Các bản migration trong `backend/migrations` và `backend/supabase/migrations` phải giống nhau. Nếu production đã chạy migration cũ, cần soạn và kiểm tra SQL nâng cấp theo schema thực tế; việc sửa file migration đã chạy không tự cập nhật database.
3. Deploy `manage-tenants`, `manage-staff`, `cron-reminders`, `send-webpush` bằng `npx supabase functions deploy <tên>`. Các function tự xác thực: quản lý tài khoản kiểm tra JWT và vai trò; cron/push chỉ nhận service key hoặc cron secret.
4. Tạo chủ trọ đầu tiên qua Supabase Auth, xác nhận đúng UUID và gán `chu_tro` trong database bằng quyền quản trị project. Không thêm form tự đăng ký chủ trọ.
5. Cấu hình nhà cung cấp SMS thật trong Supabase Auth, giới hạn gửi/xác minh. Không dùng Twilio `dummy` và không sao chép `auth.sms.test_otp` vào production. Thử quên mật khẩu bằng số có thật trước khi bàn giao.
6. Đặt `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` trên hosting. Không đặt service-role/private keys vào biến `VITE_`. Root build là `frontend`, lệnh `npm ci && npm run build`, output `dist`. Có sẵn SPA fallback cho Netlify và Vercel.
7. Dùng HTTPS, khai báo domain trong Supabase Auth Site URL/Redirect URLs. Kiểm tra tải trực tiếp các đường dẫn `/billing`, `/hop-dong`, `/quen-mat-khau`.
8. Nếu bật Web Push: tạo cặp VAPID, đặt khóa công khai tại frontend; đặt `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` và `CRON_SECRET` trong Supabase secrets. Cấu hình webhook `INSERT public.thong_bao` gọi `send-webpush` với header `x-cron-secret`. Không commit secrets.
9. Dùng `backend/scripts/schedule_cron.sql` để lên lịch nhắc nợ, điền URL và lưu cron secret qua Vault. Kiểm tra lịch và log chạy thực tế. Local không tự chạy lịch nhắc nợ production.
10. Kiểm tra cả 4 vai trò, phân công khu, upload ảnh, OTP thật, QR, đối soát và phục hồi backup trước khi đưa dữ liệu thật vào.

## Phạm vi hiện tại

- Thanh toán bằng QR chuyển khoản và đối soát biên lai; chưa có webhook ngân hàng tự xác nhận đã nhận tiền.
- Ảnh công tơ chụp trực tiếp, chưa tích hợp OCR; nhân sự đối chiếu bằng mắt.
- Giá thuê tính trọn tháng theo hợp đồng; chưa tính tự động tiền thuê theo ngày hoặc quyết toán hoàn cọc.
- Thông báo trong app hoạt động với database; SMS và Web Push bên ngoài cần khóa dịch vụ tương ứng.
- Luồng cốt lõi cần Internet. PWA hỗ trợ cài đặt và trang ngoại tuyến, không nhận giao dịch offline.


## Minh chứng và thu phí sửa chữa

- Quản lý/chủ trọ đính kèm ít nhất một ảnh/video khi hoàn tất sự cố. Video dưới 10 giây được kiểm tra trên trình duyệt; tối đa 20 MB. Kho lưu trữ giới hạn MIME và dung lượng, chưa có dịch vụ phân tích thời lượng video phía server.
- Tối đa 5 tệp, gồm 1 video. Bộ minh chứng được lưu vào lịch sử; người thuê và người có quyền xem sự cố xem được bằng liên kết tạm.
- Trường phí sửa chữa là số tiền thu người thuê, đặt 0 nếu chủ trọ chịu phí.
- Chỉ khi hoàn tất mới tạo khoản phí; xác định hợp đồng theo người báo, phòng và thời điểm báo sự cố. Không gán khoản cũ sang người thuê mới.
- Phí vào hóa đơn nháp sớm nhất từ tháng hoàn tất trở đi của đúng hợp đồng. Nếu chưa có hóa đơn phù hợp thì chờ lần lập hóa đơn tiếp theo. Hóa đơn đã phát hành giữ nguyên.
- Lập lại hóa đơn nháp không cộng trùng. Sửa phí hoặc mở lại sự cố trước khi phát hành tự cập nhật/gỡ khoản phí ở bản nháp. Sau khi hóa đơn phát hành, khóa phí, trạng thái và minh chứng; báo cáo sự cố tái diễn bằng báo cáo mới.
- Sự cố hoàn tất trước khi tính năng được triển khai không tự truy thu. Khoản phí của hợp đồng đã kết thúc cần được theo dõi khi lập hóa đơn cuối cùng, không chuyển sang hợp đồng khác.
- Schema/RPC nằm trong phần ISSUE_REPAIR_BILLING của migration 006 hiện có. Bản local đã được cập nhật không cần reset; máy đã áp dụng migration cũ cần cập nhật phần bổ sung và các hàm liên quan trước khi chạy frontend mới.


## Hợp đồng gốc, thời hạn và yêu cầu của người thuê

- Hợp đồng phải có ngày hết hạn. Khi cập nhật dữ liệu cũ, hợp đồng chưa có ngày hết hạn được đặt 6 tháng từ ngày cập nhật (múi giờ Việt Nam). Các hạn đã có được giữ nguyên.
- Chủ trọ/quản trị vào Hợp đồng → Xem hợp đồng gốc để bổ sung ảnh hợp đồng giấy đã ký: JPG/PNG/WEBP, tối đa 10 ảnh, 5 MB mỗi ảnh. Không tự sinh ảnh hợp đồng; chưa tải ảnh thì màn hình hiển thị chưa có bản gốc. Ảnh nằm trong bucket riêng tư hop-dong-goc, xem bằng liên kết tạm.
- Người thuê gửi yêu cầu gia hạn hoặc chấm dứt kèm ngày mong muốn và lý do. Mỗi hợp đồng chỉ có một yêu cầu chờ xử lý. Chủ trọ/quản trị nhận thông báo trong ứng dụng và xử lý tại Hợp đồng → Yêu cầu hợp đồng chờ xử lý.
- Gia hạn chỉ đổi ngày hết hạn sau khi được duyệt. Ngày mới phải sau hạn cũ và ngày hiện tại. Chấp thuận/từ chối đều lưu người xử lý, thời gian, phản hồi và thông báo cho người thuê.
- Chấm dứt trực tiếp và chấp thuận yêu cầu chấm dứt đi qua bước Quyết toán & trả phòng bên dưới. Yêu cầu trả phòng trong tương lai giữ chờ đến ngày bàn giao.
- Trong 10 ngày cuối (kể cả ngày hết hạn), popup hiện khi người thuê mở ứng dụng. Có nút gửi yêu cầu gia hạn ngay trong popup. Đóng popup sẽ không nhắc lại trong cùng phiên/ngày; sang ngày khác sẽ nhắc lại. Khi có yêu cầu đang chờ, popup được ẩn. Đây là nhắc trong ứng dụng, chưa gửi SMS hay thông báo khi ứng dụng đã đóng.
- Phần nâng cấp nằm trong migration 006, mục CONTRACT_LIFECYCLE và các hàm cập nhật phía sau. Máy local đã áp dụng không cần reset.


## Khởi động dịch vụ quản lý người thuê local

`npm.cmd run dev` trong frontend tự kiểm tra Edge Functions khi VITE_SUPABASE_URL trỏ về localhost. Nếu container đã dừng, lệnh bật lại và chỉ mở Vite khi endpoint quản lý người thuê đã phản hồi. Container Edge Functions dùng restart policy unless-stopped để tự phục hồi khi gặp lỗi hoặc Docker khởi động lại; thao tác dừng thủ công vẫn được tôn trọng cho đến lần chạy dev tiếp theo.

Cần mở Docker Desktop trước. Nếu chưa tạo các container Supabase, chạy `npx.cmd supabase start` trong backend rồi chạy frontend. Cơ chế này không reset dữ liệu và không can thiệp backend khi frontend trỏ tới môi trường online.


## Thời gian nhập chỉ số công tơ

- Kỳ điện nước tháng M có hạn đóng tiền là ngày thanh toán của hợp đồng trong tháng M+1. Ví dụ hạn 05/12 thì kỳ tháng 11 mở từ 02/12 đến hết 04/12 (múi giờ Việt Nam).
- Người thuê chỉ gửi chỉ số/ảnh trong 3 ngày trước hạn. Ngoài cửa sổ, màn hình hiển thị lịch và chỉ số kỳ trước, không mở ô nhập/camera. Backend kiểm tra lại thời gian khi gửi, không tin đồng hồ thiết bị.
- Nếu hạn là ngày 1, cửa sổ bắt đầu từ cuối tháng trước. Màn hình tự chọn kỳ dựa trên lịch thanh toán; yêu cầu chụp lại hoặc mở bổ sung đang hiệu lực được ưu tiên. Kỳ trước ngày bắt đầu hợp đồng và kỳ tương lai không được gửi.
- Gửi xong khóa nhập. Quản lý từ chối trên hóa đơn nháp sẽ mở lại cho việc chụp mới cả hai ảnh; hóa đơn đã phát hành không được sửa.
- Nhân sự có quyền với hợp đồng vào Hóa đơn & thanh toán → Mở nhập bổ sung. Chỉ dùng cho kỳ đã qua hạn nhập, chưa có chỉ số/hóa đơn; nhập lý do và thời gian 1–72 giờ. Người thuê nhận thông báo trong ứng dụng. Lưu lịch sử người mở, lý do, thời hạn và lần gửi đã sử dụng.
- Cơ chế lịch nằm trong phần METER_ENTRY_WINDOW và hàm nguoi_thue_lap_hoa_don cập nhật phía sau trong migration 006. Local đã áp dụng, không cần reset dữ liệu.


## Thông báo nhắc nhập công tơ

Thông báo trong ứng dụng ở ba mốc: mở nhập (trước hạn đóng tiền 3 ngày), ngày cuối (trước hạn 1 ngày), quá hạn nhập (từ ngày đóng tiền). Mỗi kỳ chỉ nhắc một lần/mốc; chỉ tạo nếu chưa có hóa đơn hoặc chỉ số. Nếu máy nghỉ qua một mốc, lần chạy tiếp theo chỉ nhắc mốc phù hợp lúc đó, không gửi dồn các mốc cũ. Không truy nhắc các kỳ có hạn đóng tiền trước ngày bật tính năng.

Local đã chạy `backend/scripts/schedule_meter_reminders.sql`: pg_cron kiểm tra mỗi 15 phút, không phụ thuộc Edge Functions. Docker/Supabase cần chạy; máy tắt thì chưa thể tạo thông báo. Khi mở web, người thuê có một lần kiểm tra bù cho tài khoản của mình. Lịch chống trùng được giữ riêng, kể cả người thuê xóa thông báo đã đọc.

Khi triển khai môi trường mới, chạy script lịch trên sau migrations. Edge Function cron-reminders cũng gọi cùng hàm để dùng chung luồng Web Push đã có khi cấu hình push đầy đủ. Không gửi SMS. Lịch trong database chỉ tạo thông báo trong ứng dụng; muốn đẩy ra màn hình khóa cần vận hành lịch đẩy Web Push riêng hiện có.


## Quyết toán và bàn giao trả phòng

- Chủ trọ/quản trị vào Hợp đồng → Quyết toán & trả phòng; yêu cầu chấm dứt của người thuê cũng đi qua bước này.
- Tổng hợp các hóa đơn đã phát hành, trừ khoản thanh toán đã duyệt. Tiền cọc theo hợp đồng được cấn vào số còn nợ: cọc dư thì hoàn, cọc thiếu thì thu thêm. Có bảng đối chiếu từng hóa đơn và chỉ số gần nhất.
- Chặn khi còn hóa đơn nháp, biên lai chờ duyệt hoặc phí sửa chữa chưa lên hóa đơn. Điện nước cuối kỳ phải được chốt trước; tính năng không tự chia tiền phòng theo ngày hay tạo phí cuối kỳ.
- Người xác nhận phải kiểm tra cọc thực nhận, xác nhận đã giao nhận tiền và nhận bàn giao phòng/tài sản; ghi ngày, lý do, hình thức và nội dung giao nhận. Đây là ghi nhận thủ công sau khi đã thu/hoàn tiền thật, không tự chuyển tiền ngân hàng.
- Một lần lưu tạo biên bản, phân bổ cọc và khoản thu thêm vào các hóa đơn, kết thúc hợp đồng và trả phòng về trạng thái trống. Nếu số liệu thay đổi sau khi mở popup, phải tải lại và kiểm tra trước khi xác nhận. Không thể xác nhận trùng hoặc sửa khoản thanh toán sau quyết toán.
- Chủ trọ/quản trị và người thuê liên quan xem lại biên bản trên hợp đồng đã kết thúc. Hợp đồng cũ chưa có biên bản được hiển thị rõ, không tự tạo số liệu quyết toán lịch sử.
- Schema nằm trong phần MOVE_OUT_SETTLEMENT của migration 006 và các trigger ngay sau đó; hai thư mục migrations được đồng bộ. Local nâng cấp bổ sung, không reset dữ liệu.
