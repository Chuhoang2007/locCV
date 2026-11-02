# Phase 3 — Tiếp nhận và đánh giá CV

Ngày 02/11/2026. **Đã hoàn tất mã và kiểm thử local của Phase 3; chấm CV giả qua Nine Router thật thành công. Project Supabase đang cấu hình chưa có migration 0004. Chưa deploy hoặc triển khai runner bài thi.**

## Chức năng

- Tin công khai có liên kết Ứng tuyển ngay. Chỉ người đăng nhập nộp được; cùng UUID chuyển mode vẫn bị server/DB chặn tự ứng tuyển.
- Nhận PDF/DOCX tối đa 5 MiB, PDF tối đa 20 trang. DOCX kiểm tra định dạng, không nhận zip giả, tối đa 200 entry/20 MiB tổng giải nén, kiểm tra cả dung lượng thực khi đọc stream. Không render HTML hoặc fetch tài nguyên ngoài.
- Parser Node riêng, không kế thừa biến môi trường chứa key, heap 128 MiB và timeout 10 giây. PDF scan/mật khẩu/hỏng, text ngắn hoặc quá dài nhận lỗi rõ và có cách chuyển sang dán text. Không OCR, không chấm file không đọc được.
- Ứng viên đọc preview và xác nhận nội dung/thông báo xử lý AI trước khi gửi. Văn bản 100–30.000 ký tự; không lưu CV trong localStorage. Với file, text xác nhận phải khớp kết quả parser server. Muốn sửa text thì chuyển sang nguồn TEXT.
- Tiếp nhận khóa Jobs, kiểm tra PUBLISHED/self-apply/unique, chốt snapshot/text/hash/acknowledgment, tạo Application, task, receipt Message và audit trong một transaction. API trả 202, Idempotency-Key ngăn tiếp nhận trùng. SHA-256 tính từ text đã xác nhận.
- Hồ sơ đã tiếp nhận vẫn được chấm từ snapshot dù tin đóng. Worker dùng cùng queue lease/heartbeat/budget với Phase 2; claim phân biệt GENERATE_JOB/EVALUATE_CV, chưa claim EVALUATE_ESSAY.
- Kết quả AI được kiểm tra schema, ID, điểm tối đa và trích dẫn nguyên văn. Server/SQL tự cộng điểm và so ngưỡng snapshot, ghi CV_PASSED/CV_FAILED và hai Messages kết quả cùng transaction. Sự kiện kết quả có event_key duy nhất.
- Điểm đúng ngưỡng được xét đủ điều kiện. CV_THRESHOLD khóa điểm thấp; ALWAYS vẫn cho đủ điều kiện sau khi CV được chấm thành công. Lỗi AI giữ CV_SUBMITTED và điểm null, không tạo kết quả trượt hoặc mở thi.
- Retry thủ công chỉ FAILED/latest, tối đa hai generation/24 giờ/hồ sơ, dùng chung HR/ứng viên. Budget ba HTTP attempt của mỗi generation không bị reset khi reclaim.
- Ứng viên xem danh sách, điểm/tóm tắt, task và eligibility, phục hồi khi tải lại. HR mở danh sách theo tin có lọc/phân trang và báo cáo bằng chứng từng tiêu chí.
- API ứng viên và HR tách riêng, kiểm tra ownership ở server, DTO không chứa snapshot/đáp án/storage path. Task DTO không có CV hoặc prompt. Response private/no-store; mutation kiểm tra origin.
- CV nằm trong bucket private; link tải 60 giây chỉ cấp cho chủ hồ sơ/chủ tin, có audit. Upload tạm có owner/path server cấp/TTL 24 giờ, rate limit 10/giờ và một lượt parser/file. File READY không parse lại.

## Kiểm chứng

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| Lint, TypeScript | Đạt, không warning từ lint/typecheck |
| Unit/database | Suite 64 bài/8 file đạt; sau bổ sung 2 bài về HTTP CV/hai consumer và lease, hai file integration liên quan đạt 10/10. Tổng 66 bài đã được chạy đạt |
| Chromium hồi quy | 12/12 đạt, bao gồm 9 kịch bản tài khoản/tin tuyển dụng và 3 kịch bản CV |
| Next.js production build | Đạt, gồm các route mới |
| Worker build | Đạt |
| Production output trace | Có parser-process.mjs, PDF.js library/worker, yauzl và saxes |
| Nine Router thật | EVALUATE_CV với ag/gemini-3.8-flash: 2 tiêu chí, điểm 100, schema/ID/giới hạn điểm/bằng chứng hợp lệ. Dữ liệu CV giả; không phải kết luận về ứng viên thật |
| Supabase đang cấu hình | Bucket cvs private, giới hạn 5 MiB đúng; migration 0004 chưa có, readiness báo không sẵn sàng và thoát code 2 |

Unit/database dùng PostgreSQL nhúng PGlite chạy bốn migration thật với schema Auth/Storage bootstrap. Đã kiểm tra unique/idempotency, các thứ tự apply/close, snapshot/hash, quyền upload/parser, TTL/quota, kết quả/bằng chứng, lỗi AI, retry quota, lease cũ và Messages không trùng. PGlite tuần tự hóa query; competing-call tests không thay cho nghiệm thu row-lock nhiều kết nối trên Supabase/PostgreSQL hosted.

E2E chạy Next.js và worker thật với HTTP Auth/PostgREST/Storage adapter chỉ có trong tests, SQL nghiệp vụ thật trên PGlite và Nine Router transport giả lập. Chạy cả PDF/DOCX parser thật. Đã kiểm tra xem/xác nhận, tải lại, lỗi scan chuyển sang text, lỗi AI/thử lại, điểm bằng ngưỡng, dưới ngưỡng cho hai policy, self-apply cả hai mode, người ngoài bị 404, HR không nhận DTO ứng viên và ngược lại, link file private và từ chối link hết hạn trong fixture. E2E không gọi AI thật hoặc dùng key thật; kết nối AI thật kiểm tra riêng bằng smoke test.

## Giao diện

Đã mở và kiểm tra 10 ảnh full-page: apply, kết quả ứng viên, báo cáo HR, lỗi file và lỗi AI, mỗi trạng thái ở desktop 1440×960 và mobile 390×844. Các kịch bản có Axe WCAG A/AA và kiểm tra overflow. Hai lỗi ở lượt kiểm tra đầu (nút lỗi bị bó hẹp trên mobile và trạng thái file native không khớp) đã sửa trước lượt chụp cuối.

Fresh finish reviewer kết luận **disposition: ship**, phạm vi 10 captures, tham chiếu Phase 2, direction contract và implementation được đọc mẫu; không có material fix. DESIGN.md và .impeccable/design.json được giữ nguyên vì đây là phần mở rộng hệ thống hiện có. Detector chạy một lần; output lớn bị rút gọn, có advisory token màu/cỡ chữ/radius trên CSS lịch sử và phần mở rộng. Không coi verdict này là chứng nhận detector đầy đủ hoặc nghiệm thu production.

## Đưa vào project đang có Phase 2

1. Trong Supabase SQL Editor, chạy toàn bộ `supabase/migrations/0004_application_transactions.sql` sau 0001–0003. Không reset database hoặc chạy seed trên dữ liệu đang dùng.
2. Giữ ba biến Supabase ứng dụng ở đầu `.env.local` và NINE_ROUTER_* hiện có. SUPABASE_TEST_* chỉ dành cho script live test riêng.
3. Chạy `npm run phase3:check`. Chỉ tiếp tục kiểm thử hồ sơ thật khi lệnh báo `ok:true`. Lệnh chỉ đọc metadata/bucket/RPC với UUID ngẫu nhiên, không tạo tài khoản/hồ sơ hoặc in key.
4. Khởi động web bằng `npm run dev`. Terminal thứ hai: `npm run worker:build`, rồi `npm run worker`. Dừng worker cũ khi cập nhật; kiểm tra http://127.0.0.1:3310/health.
5. Dùng hai tài khoản riêng và dữ liệu CV giả: HR đăng tin → ứng viên nộp → xem điểm → HR đọc báo cáo. Thử thêm CV thấp với CV_THRESHOLD/ALWAYS, tin đóng và người dùng thứ ba.

Workspace có service API key nhưng không có kết nối quản trị SQL/DDL để tự áp migration remote. Không có database remote/deployment nào bị sửa trong lượt triển khai Phase 3. Đây là bước cấu hình môi trường còn cần thực hiện, không được ghi nhận thành pass giả.

## Giới hạn phạm vi

Chưa có runner/timer/autosave/nộp bài Phase 4, quyết định HR/Inbox UI/purge Phase 5. Eligibility đã được tính và hiển thị nhưng chưa có nút bắt đầu thi giả. TTL upload chặn sử dụng lại; chưa có sweep tự xóa object hết hạn. Cần chốt retention và nghiệm thu trên Supabase hosted trước production. Parser có process/heap/time budget, không phải OS sandbox và vẫn cần hạ tầng triển khai giữ các giới hạn tài nguyên phù hợp.
