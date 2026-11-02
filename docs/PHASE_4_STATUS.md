# Phase 4 — Bài thi, phục hồi và chấm kết hợp

Ngày 02/11/2026. **Đã hoàn tất mã và kiểm thử local Phase 4**: bài thi một lượt, autosave/deadline server, nộp/hết giờ, chấm quiz/tự luận và báo cáo. Chưa triển khai quyết định HR hoặc Inbox UI Phase 5; chưa deploy. Migration 0005 đã có trong workspace, project đang cấu hình chưa áp dụng.

## Chức năng đã triển khai

- Trang bài thi có phần giới thiệu và thao tác bắt đầu rõ ràng. Trước start không trả câu hỏi. Start khóa hồ sơ, kiểm tra CV/ALWAYS từ snapshot, ghi started_at/deadline_at đúng một lần. GET/start gọi lại không tạo lượt hoặc deadline mới.
- DTO bài thi chỉ chứa prompt/options, answers của ứng viên, deadline/server_now/version; không chứa đáp án đúng, rubric/guidance, CV hoặc snapshot. Sau nộp không trả lại đề qua runner DTO. Chỉ chủ hồ sơ dùng được API bài thi.
- Điều hướng từng câu trắc nghiệm/tự luận bằng bàn phím; timer và trạng thái lưu tách biệt. Autosave sau khoảng 1 giây dừng gõ, kiểm tra mỗi 10 giây khi còn thay đổi, có Lưu ngay. Câu tự luận tối đa 5.000 ký tự, request tối đa 100 KiB.
- answer_version dùng compare-and-set. Bản cũ nhận 409; UI giữ nội dung chưa lưu, báo xung đột và cho tải bản trên server theo lựa chọn rõ ràng. Không âm thầm ghi đè tab khác.
- Timer neo vào server_now và performance.now, lấy lại thời gian khi trở về tab/mỗi 5 giây. API/DB kiểm tra clock_timestamp; đồng hồ client không quyết định quyền lưu. Deadline giữ qua reload, đổi mode, đăng nhập hoặc thiết bị khác.
- Bộ đệm localStorage mặc định tắt. Nếu bật, key có user/application/schema/version; nội dung chỉ answers, timestamp/version. Không có CV/đề/đáp án đúng/rubric/token. Phục hồi cần xác nhận, bản khác version không tự ghi đè. TTL 24 giờ được kiểm tra và dọn khi đọc. Nộp/đăng xuất/tắt tùy chọn xóa buffer; logout dừng autosave và broadcast để tab khác không ghi lại buffer.
- Nộp bài có xác nhận inline và số câu bỏ trống. API chỉ nhận answer_version, không nhận answers hoặc điểm. gradeQuiz dùng bản lưu private; transaction row lock + source version chốt submitted_at/reason, quiz_result, task essay và Message/audit cùng lúc. Nộp lặp trả bản đã khóa.
- Worker sweep mỗi 15 giây, tối đa 100 hồ sơ/lượt, dùng cùng submitPersistedInterview với web. Worker khởi động lại phục hồi các bài đã hết giờ. Câu trả lời sau deadline bị từ chối, kể cả khi sweep chưa chạy; bản gửi muộn không được thay nội dung đã lưu.
- Quiz được chấm bằng hàm backend dùng chung, không gọi AI. Câu thiếu được normalize khi grader/evaluator đọc, không sửa muộn answers chỉ để thêm ô rỗng.
- Essay chỉ gửi câu trả lời tự luận/rubric tương ứng cho AI, kiểm tra ID/max/evidence từ đúng câu và điểm 0 cho câu trắng. buildInterviewEvaluation tính 40/60 từ điểm phần đã round2; CV không cộng vào tổng.
- SQL completion kiểm tra lease, input version, snapshot, quiz đã giữ, điểm/bằng chứng/tổng. Commit EVALUATED, báo cáo và hai Messages kết quả cùng transaction, deduplicate event_key. AI lỗi giữ quiz, essay/tổng null và trạng thái đang chấm.
- Retry essay chỉ FAILED/latest, hai generation thủ công/24 giờ/hồ sơ/loại, dùng chung ứng viên/HR. Mỗi generation vẫn giữ budget ba HTTP attempt và lease/heartbeat cũ.
- Ứng viên thấy CV, quiz, essay và tổng/tóm tắt riêng. HR có đáp án/chọn lựa, nội dung tự luận, từng tiêu chí và bằng chứng; API ứng viên không nhận phần chi tiết này.

## Kiểm chứng

- Lint, TypeScript và worker build đã đạt. **86 kiểm thử unit/database trong 13 file đạt**: quyền/schema, chấm quiz đúng/sai/thiếu, 100 + 80 → 88, AI evidence/ID/max, timer và buffer, deadline/mode, CAS, submit đồng thời, timeout recovery, essay failure/retry quota và lease cũ.
- **16/16 kịch bản Chromium hồi quy đạt trong lượt cuối**, gồm tài khoản/tin/CV và bốn kịch bản Phase 4: start/autosave/reload/đổi đồng hồ/nhiều tab/phục hồi/nộp/kết quả; timeout khi browser offline; essay lỗi/thử lại; logout nhiều tab không tái tạo buffer. Capture xác nhận có Axe WCAG A/AA và kiểm tra overflow. Lỗi tương phản hover của mode switch đã sửa bằng màu pine hiện có trước lượt cuối.
- Next.js production build và worker build đạt. Kiểm tra 24 file JS/JSON/map trong client static output không thấy giá trị thật của Supabase secret hoặc Nine Router key.
- Đã kiểm tra Nine Router thật với CV/quiz giả: EVALUATE_ESSAY, model ag/gemini-3.8-flash, một câu tự luận, quiz 100, essay 100, tổng 100, ID/schema/giới hạn điểm/bằng chứng hợp lệ. Đây là smoke test tích hợp, không phải kết luận về ứng viên thật.
- `npm run phase4:check` trên project cấu hình hiện có: migration_0004=true, private_cv_bucket=true, migration_0005=false; báo chưa sẵn sàng và exit code 2. Không báo pass giả.

Unit/integration chạy SQL migration thật trên PGlite với Auth/Storage bootstrap. PGlite tuần tự hóa query; các competing-call tests xác minh thứ tự/unique/CAS nhưng không thay thế nghiệm thu row-lock nhiều kết nối trên PostgreSQL/Supabase hosted. Test deadline dịch timestamp trong fixture database riêng, không có cờ giả thời gian hoặc bypass trong production.

E2E dùng Next.js/worker thật, SQL thật trên PGlite qua HTTP Auth/PostgREST/Storage adapter chỉ có trong tests; transport Nine Router được giả lập riêng. Key môi trường test ghi đè rõ ràng và không gọi gateway thật. Smoke test Nine Router được chạy tách biệt với dữ liệu giả. Chưa chạy đầy đủ bài thi trên Supabase hosted vì thiếu migration mới.

## Giao diện và tài liệu

Giao diện kế thừa DESIGN.md/.impeccable/design.json, dùng cùng workspace/form/notice. Không có thay đổi thương hiệu hoặc raster shipping. Brief: .impeccable/briefs/phase4-interview.md. Đã mở và xác minh đủ 18 capture desktop 1440×960 và mobile 390×844 cho prestart, runner, conflict, recovery, confirm, submitted, candidate/HR result và essay error.

Fresh finish reviewer kết luận **disposition: ship**, phạm vi 18 capture hợp lệ, direction contract và source được đọc mẫu; không có material fix. Giữ nguyên DESIGN.md và sidecar vì đây là phần mở rộng. Detector chạy một lần, lưu đủ JSON: 201 advisory về token kiểu chữ/màu/radius, không có finding non-advisory; gồm cả CSS lịch sử. Không tự sửa tài liệu hệ thống theo advisory và không coi review giao diện là nghiệm thu backend/hosted.

## Áp dụng vào môi trường đang có Phase 3

1. Supabase → SQL Editor → chạy toàn bộ `supabase/migrations/0005_interview_and_inbox_transactions.sql`. Chạy sau 0001–0004, không reset/seed database đang dùng.
2. Chạy `npm run phase4:check` đến khi `ok:true`.
3. Khởi động lại web `npm run dev`. Dừng worker cũ, chạy `npm run worker:build`, sau đó `npm run worker`. Worker mới kiểm tra RPC deadline khi báo readiness tại http://127.0.0.1:3310/health.
4. Dùng hai tài khoản và dữ liệu giả: ứng viên đủ điều kiện mở bài, làm/lưu/tải lại/nộp; HR xem điểm 40/60 và từng câu. Thử thêm dưới ngưỡng với ALWAYS, mất mạng, hai tab, câu bỏ trống và lỗi AI.
5. Có thể chủ động chạy `npm run ai:check -- --essay` để kiểm tra dịch vụ thật, có dùng token. Không dùng bài làm thật để smoke test.

Không có kết nối quản trị SQL/DDL trong workspace để áp migration từ xa bằng API key hiện tại. Lượt này chỉ đọc metadata project và gọi AI bằng dữ liệu giả; không tạo/sửa hồ sơ hoặc bài thi trên database remote.

## Còn ngoài phạm vi

Approve/Reject HR, Inbox UI/badge/read_at, purge theo retention và container/deployment thuộc Phase 5. Notification rows cần cho Phase 4 đã được ghi nguyên tử, nhưng chưa có hộp thư UI. Production cần áp migration, nghiệm thu Auth/Storage/PostgreSQL hosted và chính sách lưu/xóa dữ liệu. Deadline luôn khóa sửa kể cả khi worker tắt; kết quả tự nộp/chấm sẽ hoàn tất sau khi worker phục hồi.
