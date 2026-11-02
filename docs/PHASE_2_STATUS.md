# Phase 2 — Kết quả triển khai

Ngày 02/11/2026. Phạm vi: **đã triển khai luồng Phase 2 trong workspace; Nine Router thật đã tạo nháp thành công; migration Supabase mới cần áp dụng vào môi trường của bạn**. Chưa triển khai Phase 3 hoặc deploy.

## Chức năng đã có

- HR tạo bản nháp thủ công hoặc từ mô tả bằng AI. Mỗi bản nháp có JD, rubric CV, ngưỡng qua vòng và bài thi gồm quiz/essay.
- Chỉnh sửa JD, kỹ năng, lương, địa điểm, trách nhiệm, yêu cầu và quyền lợi; thêm/sửa/xóa tiêu chí CV, câu hỏi, lựa chọn và tiêu chí chấm tự luận.
- Preview toàn bộ nội dung trước khi duyệt. Nháp được phép lưu khi chưa đủ nội dung; publish kiểm tra đầy đủ schema, tổng CV 100, ID, đáp án và điểm essay.
- Lỗi ở tab khác tự mở đúng tab, focus trường cần sửa, có aria-invalid/aria-describedby và thông báo cạnh control. Save kiểm tra tại client và server; publish luôn kiểm tra trên dữ liệu đã lưu ở server.
- Đăng/đóng tin theo transaction, version và chủ sở hữu. Nội dung đánh giá bất biến sau đăng; đóng tin gỡ khỏi danh sách và detail công khai ở lần đọc tiếp theo.
- Danh sách HR có lọc trạng thái và cursor; trang việc làm public tìm từ khóa có/không dấu, kỹ năng, khoảng lương VND/tháng và phân trang.
- DTO công khai chỉ có JD/thông tin kỳ thi; không gửi câu hỏi, đáp án, hướng dẫn chấm hoặc raw HR prompt. Routes `/jobs` dùng public layout để khách chưa đăng nhập xem được.

## AI và queue

- Client server-only dựa trên mã tài liệu 03, native fetch, timeout 60 giây cho mỗi attempt, tối đa hai retry cho 502/504/network/timeout; JSON sanitizer và Zod strict.
- Request gửi rõ `stream: false`; HTTP 200 chưa đủ để thành công, kết quả phải hợp lệ cả JSON và các bất biến.
- AiTasks là queue bền vững, claim SKIP LOCKED, lease mới cho mỗi claim, TTL 90 giây, heartbeat mỗi 15 giây. Worker có hai consumer và endpoint readiness riêng.
- Budget ghi trước HTTP request, không reset sau crash/reclaim; lease cũ không thể heartbeat hoặc commit. Shutdown hủy request và để worker tiếp theo phục hồi theo lease.
- Chỉ ghi kết quả nếu tin vẫn DRAFT và input_version chưa thay đổi. HR lưu trong lúc AI chạy sẽ giữ nội dung HR và từ chối kết quả cũ.
- Idempotency-Key trong transaction, kiểm tra hash, replay không tạo trùng; quota SQL 5 generation/giờ và 20/24 giờ/user, tối đa 30 nháp mới/giờ.
- Retry thủ công tạo task/generation mới, giữ lịch sử thất bại; trạng thái frontend lấy từ DB bằng polling, không giả phần trăm tiến độ.

## Kết nối Nine Router thật

Trong smoke test, gateway được kiểm tra bằng cấu hình đã cung cấp; key được nạp vào RAM của tiến trình Node, không ghi vào source/.env.example hoặc log. Sau khi kiểm tra đã chuẩn bị cấu hình cục bộ trong `.env.local` được Git bỏ qua như mô tả ở cuối báo cáo.

| Kiểm tra | Kết quả |
| --- | --- |
| Model gốc `gpt-4o-mini` | HTTP 404, error code `model_not_found` |
| GET `/v1/models` | HTTP 200, lấy được model được gateway quảng bá |
| Alias `Coding-Agent` | HTTP 400; không chọn làm mặc định |
| `ag/gemini-3.8-flash`, không ghi stream | Gateway trả SSE; không phù hợp hợp đồng response JSON hiện tại |
| `ag/gemini-3.8-flash`, `stream: false` | **HTTP 200 application/json; module tạo nháp và validation thành công: 3 tiêu chí, tổng 100, 5 quiz, 2 essay** |

`.env.example` được cập nhật sang model đã smoke test thành công. Đây là kết quả tại thời điểm kiểm tra, không phải cam kết model luôn có sẵn. Không fallback tự động; gateway báo model mất thì task trả `MODEL_UNAVAILABLE` an toàn. Dùng `npm run ai:check` để xem danh sách và `npm run ai:check -- --generate` để chủ động chạy smoke test bằng dữ liệu giả.

## Kiểm chứng local

- Lint và TypeScript đạt, không warning. Next.js production build và worker build thành công.
- **51 kiểm thử unit/database trong 5 file đều đạt**, gồm sanitizer, timeout, retry, hủy, schema, model không khả dụng, quyền, publish/search/close, quota, idempotency, version và lease/budget phục hồi.
- **9 kịch bản Chromium đều đạt trong lần chạy cuối**, bao gồm hồi quy tài khoản, pipeline AI qua 502/504, chỉnh ba phần, đăng/tìm/xem/đóng tin, JSON lỗi/retry/reload và chặn actor giả. Kịch bản HR kiểm tra cả lỗi Save ở tab không được chọn và lỗi Publish do server trả về. Suite vẫn dùng fixture riêng khi `.env.local` đã có key thật; không gọi gateway thật từ E2E.
- E2E dùng Next.js và worker production, SQL migrations thật trên PostgreSQL nhúng qua HTTP adapter. Auth và Nine Router transport trong E2E là fixture; không có mock mode trong ứng dụng. Kết nối Nine Router thật được kiểm tra riêng như bảng trên.
- Axe WCAG A/AA kiểm tra editor/search và các trang tài khoản; kiểm tra overflow ở desktop 1440px và mobile 390px.
- Review ban đầu yêu cầu sửa validation recovery. Verdict pass sau sửa: **ship, finding validation recovery đã resolved**; phạm vi verdict là finding đó. Các ảnh resting tiếp tục giữ hệ thống giao diện hiện có. DESIGN.md được giữ nguyên.
- Detector đã chạy; có advisory về màu/cỡ chữ/radius chưa được ghi hết trong DESIGN.md, bao gồm các giá trị Phase 1 đã có. Không coi các advisory này là một chứng nhận pass toàn bộ thiết kế và không tự viết lại design system.

## Cách đưa vào môi trường đang có Phase 1

1. Chạy `supabase/migrations/0003_job_transactions.sql` trên project đã có 0001/0002. Không reset database đang có dữ liệu.
2. Cấu hình ba biến NINE_ROUTER_* theo `.env.example`, giữ nguyên cấu hình Supabase của bạn; chỉnh model sang tên hiện khả dụng.
3. Chạy `npm run dev` và, trong terminal thứ hai, `npm run worker:build` rồi `npm run worker`.
4. Thử một tin dữ liệu giả từ tạo nháp đến đóng tin trên project TEST của bạn. Hướng dẫn chi tiết trong [README](../README.md).

Đã chuẩn bị `.env.local` được Git bỏ qua, chỉ điền cấu hình Nine Router từ thông tin đã được cung cấp; không in key. Các trường Supabase vẫn chưa có thông tin project để áp migration lên một database thật trong lượt này. Không có thay đổi remote database/deployment nào được thực hiện. Giới hạn này không ảnh hưởng kết quả unit/SQL/E2E local hoặc smoke test Nine Router, nhưng không được coi là đã nghiệm thu full Supabase hosted.

## Giới hạn phạm vi

Chưa có tiếp nhận CV, chấm CV của ứng viên, runner bài thi, nộp bài hoặc Inbox UI. Các module AI chấm CV/essay dùng chung đã có từ mẫu kỹ thuật, nhưng không có API tính năng của Phase 3/4 được bật. Nút ứng tuyển trên tin công khai nói rõ tính năng chưa mở.
