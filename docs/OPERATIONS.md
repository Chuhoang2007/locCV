# Vận hành LocCV

Mã nguồn đã có luồng Phase 1–5. Triển khai lên hạ tầng thật, nghiệm thu Supabase hosted và diễn tập backup staging là các bước môi trường riêng; kết quả local không thay thế các bước đó.

## Cập nhật database đang dùng

1. Sao lưu trước khi thay đổi. Trong Supabase SQL Editor, chỉ chạy migration chưa có theo thứ tự trong `supabase/migrations/`. Không chạy seed/reset trên database đang dùng.
2. Project đã có 0001–0005: chạy toàn bộ **0006_decisions_inbox_and_retention.sql**. Migration có transaction; khi lỗi, kiểm tra lỗi trước khi chạy lại. Không sửa hoặc chạy lại migration cũ.
3. Chạy `npm run phase5:check`. Script chỉ đọc, cần kết quả `ok:true`, migration 0005/0006 và bucket private đều true.
4. Khởi động lại cả web và worker. Web `/api/health`, worker `/health` trả 200 khi schema/kết nối sẵn sàng; chưa cấu hình/schema thiếu trả 503.

Không có thông tin kết nối quản trị SQL trong workspace hiện tại. Secret API của Supabase không thay thế mật khẩu PostgreSQL hoặc quyền chạy migration.

## Chạy local

```powershell
npm ci
npm run phase5:check
npm run dev
```

Terminal khác:

```powershell
npm run worker:build
npm run worker
```

Web mặc định `127.0.0.1:3000`; worker health `127.0.0.1:3310`. Mỗi worker có hai consumer và sweep deadline 15 giây. Khi dừng bằng Ctrl+C/SIGTERM, worker ngừng nhận thêm việc, hủy HTTP và để lease phục hồi. Không reset task/budget để sửa lỗi mạng.

## Container

Hai image dùng Node 24, user không phải root, dependency được khóa bằng package-lock. Web build chỉ nhận hai biến public; secret được inject lúc chạy. `.dockerignore` loại mọi `.env.local`, ảnh QA và dữ liệu test khỏi build context.

```powershell
docker compose --env-file .env.local build
docker compose --env-file .env.local up -d
docker compose ps
docker compose logs --tail 100 worker
```

`RUNTIME_ENV_FILE` cho phép chọn file runtime khác; giữ quyền truy cập file hạn chế hoặc thay bằng secret manager của hạ tầng. Không đưa secret vào build args, Dockerfile hoặc Git. Hai biến public lúc build phải khớp project lúc runtime; đổi project cần build lại web. Chạy `npm run security:client` trên bản build để dò giá trị secret đã cấu hình trong client assets.

Compose chỉ mở web ở loopback; đặt reverse proxy HTTPS trước cổng này. Worker health chỉ dùng trong mạng quản trị, không publish ra Internet. `SITE_URL` phải là origin HTTPS thật; cập nhật Site URL/redirect URLs trong Supabase Auth (`/auth/callback`, `/auth/confirm`) tương ứng. Kiểm tra email xác nhận/khôi phục và giới hạn provider trên project staging trước khi đưa người dùng thật vào.

Filesystem container chỉ đọc, có `/tmp` giới hạn, bỏ capabilities và có giới hạn RAM. Worker chạy đúng `--conditions=react-server`. `npm run test:containers` là smoke Linux/Docker dùng Auth/Storage giả lập và database SQL thật trong PGlite: build image, health, đăng nhập, upload/extract PDF trong web image và dừng worker. Không gọi AI bên ngoài. Máy Windows hiện tại chưa có Docker nên chưa thực thi smoke này; CI đã cấu hình chạy nó.

## Chính sách dữ liệu

- Upload chưa gắn hồ sơ: hết quyền sử dụng sau 24 giờ và được maintenance dọn. File đang parse còn mới được bỏ qua; parse bỏ dở trên một phút có thể được dọn.
- Hồ sơ: mặc định 180 ngày từ quyết định HR, hoặc từ khi tạo nếu chưa quyết định. Khi hết hạn sẽ xóa cả CV, answers, evaluations, thư và audit liên quan.
- Xóa tài khoản: đóng tin đang tuyển ngay; có 7 ngày để hủy. Bài thi và chấm các hồ sơ đã tiếp nhận vẫn có thể hoàn tất trong thời gian chờ, kể cả auto-submit. Hết thời gian này, xóa hồ sơ ứng tuyển của tài khoản, hồ sơ thuộc tin do tài khoản sở hữu, file, tin tuyển dụng và Auth user. Không xóa tài khoản ứng viên khác. Hủy yêu cầu không mở lại tin đã đóng.
- Local answer buffer: dọn sau nộp/đăng xuất; TTL 24 giờ, dọn khi mở không gian cá nhân và mỗi phút khi trang còn mở. Ứng dụng web không thể chủ động xóa localStorage trên thiết bị đang đóng hoặc offline; lần mở tiếp theo sẽ dọn.

`DATA_RETENTION_ENABLED=false` là mặc định chuẩn bị: maintenance vẫn dọn upload tạm; hồ sơ và yêu cầu xóa tài khoản được ghi nhận nhưng chưa tự purge. Settings thông báo rõ khi chưa kích hoạt. Trước production, đơn vị vận hành phải chốt/công khai chính sách trên, lịch backup và phạm vi xóa hồ sơ của người khác trong tin HR; đặt `DATA_RETENTION_ENABLED=true` cho **cả web và worker** rồi khởi động lại. Không bật trên dữ liệu thật khi chưa kiểm tra chính sách và bản sao lưu.

Purge xử lý batch 25 hồ sơ + 25 upload, mỗi phút. Nó khóa hàng, bỏ qua lease còn hiệu lực, hủy task chưa chạy và ghi dấu đang xóa trước khi gọi Storage. Dấu này chặn sửa hồ sơ/tạo task mới. Chỉ sau khi Storage xác nhận xóa mới xóa FK trong DB; lỗi giữa chừng giữ dấu để lần sau thử lại. Auth deletion lỗi cũng được thử lại. Không đổi dữ liệu thành “ẩn danh” bằng cách giữ UUID/hash/điểm. Purge worker là đường duy nhất được xóa audit liên quan; service_role không có quyền DELETE audit trực tiếp.

## Giám sát và xử lý sự cố

Log JSON chỉ chứa mã lỗi, request/task ID và số đếm; không ghi CV, câu trả lời, email, prompt, token hoặc URL có secret. Thu thập stdout/stderr của hai service bằng hệ thống log nội bộ đã cấu hình. Chưa tự gửi cảnh báo ra email/Slack.

Worker ghi `OPERATIONS` mỗi phút: queue/running, tuổi task chờ lâu nhất, tổng retry, task lỗi trong 24 giờ, task có mã timeout/JSON hiện tại, trễ auto-submit và số hồ sơ đang purge. `AI_RETRY_*` ghi từng lần retry; `TASK_SUCCEEDED`/mã lỗi cuối có task ID. Thống kê mã lỗi DB phản ánh mã đang lưu, không phải lịch sử mọi HTTP attempt; dùng log để theo dõi các lỗi đã phục hồi.

`OPERATIONS_ATTENTION` xuất hiện khi tuổi queue >300 giây, auto-submit trễ >60 giây hoặc có task thất bại trong 24 giờ. Đây là ngưỡng khởi đầu để quan sát, chưa phải SLA. Không đưa `lc_operations` hoặc secret key vào frontend. Health check chỉ trả trạng thái và mức đồng thời đã cấu hình của worker, không trả các số liệu nghiệp vụ. Số task thực sự đang chạy nằm trong log OPERATIONS.

Khi gateway lỗi: kiểm tra mã lỗi/model/quota và tình trạng mạng; task chỉ retry 502/504/network/timeout, tối đa ba HTTP attempt/generation. JSON sai không retry tự động. UI cho phép tối đa hai generation thủ công/24 giờ/hồ sơ/loại. Không dùng điểm 0 thay lỗi dịch vụ. Nếu worker tắt qua deadline: deadline vẫn chặn sửa; bật worker và kiểm tra `INTERVIEW_SUBMITTED`/kết quả từ answers đã lưu, không sửa deadline hay copy local buffer vào bài đã hết giờ.

Khi purge lỗi: kiểm tra Storage/Auth connectivity, `PURGE_RETRY_REQUIRED`, `ACCOUNT_PURGE_RETRY_REQUIRED` và `purge_pending`; phục hồi kết nối rồi để worker chạy tiếp. Không xóa tay bản ghi trước object. Lease phục hồi và tombstone giúp xử lý lại sau crash; không cần reset database.

Log Docker có xoay file theo dung lượng. Cấu hình collector xóa log kỹ thuật sau 30 ngày và kiểm tra định kỳ; xoay dung lượng không bảo đảm giới hạn ngày. Xác nhận quota/năng lực Nine Router bằng test staging được phép dùng token trước khi tăng số worker; bài test 20 task dùng provider giả lập không đo tải gateway thật.

## Backup và khôi phục staging

1. Dùng project staging riêng và dữ liệu giả. Lưu bản backup PostgreSQL gồm Auth/public schema, cấu hình Storage và nội dung object private, cùng cấu hình cần thiết ngoài DB. Kiểm tra nội dung thực tế của bản backup, không chỉ trạng thái “backup thành công”. Mã hóa và giới hạn quyền đọc.
2. Ghi lại phiên bản migration, thời điểm snapshot và danh sách file để đối chiếu. Chọn RPO/RTO, lịch chạy và thời hạn lưu backup trước production; theo dõi kết quả công việc sao lưu.
3. Khôi phục vào project staging mới, không ghi đè project đang dùng. Giữ worker tắt và `DATA_RETENTION_ENABLED=false` trong lúc phục hồi. Khôi phục cả object private và dữ liệu Auth cần thiết theo công cụ của hạ tầng.
4. Chạy `phase5:check`, kiểm tra số lượng synthetic records, Auth, RLS, link CV riêng tư, câu trả lời/điểm/quyết định/thư. Chạy nghiệm thu ba danh tính HR A/ứng viên B/người ngoài C. Bật worker để kiểm tra task lease phục hồi và deadline sweep, không tạo generation trùng.
5. Thử yêu cầu xóa bằng tài khoản giả, kiểm tra Storage và tất cả FK đã mất, tài khoản khác còn nguyên. Ghi ngày, người thực hiện, RPO/RTO đo được và kết quả. Công bố việc dữ liệu có thể còn trong backup tới hết thời hạn riêng; khi khôi phục cần áp lại các yêu cầu xóa sau snapshot trước khi mở truy cập.

Test local `retention.test.ts` đã dump/restore PGlite và kiểm tra schema/data, xóa theo FK và retry Storage. Đây chưa phải diễn tập backup của Supabase hosted hoặc Storage thật.

## Rollback và phát hành

Migration 0006 thêm cột/index/RPC/trigger; giữ schema khi rollback image, không tự DROP cột/bảng hoặc khôi phục backup lên production. Tắt retention để dừng claim mới nếu có sự cố (claim đang dang dở giữ tombstone); chọn image đã được kiểm thử tương thích schema, dừng/khởi động lại worker để tránh chạy mã hai phiên bản. Khi có sửa SQL, tạo migration tiếp theo thay vì sửa file đã chạy.

Trước phát hành: CI xanh, container smoke trên Linux, hosted staging nghiệm thu và backup restore thành công, HTTPS/Auth redirects/secret injection đúng, chính sách dữ liệu và quota đã chốt. Chọn hạ tầng/domain và phê duyệt lượt triển khai cụ thể sau khi các artifact được kiểm tra. Chưa có đích hosting hoặc deployment nào được tạo trong lượt hoàn thiện local này.
