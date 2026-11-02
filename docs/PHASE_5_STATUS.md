# Nghiệm thu Phase 5

Ngày 02/11/2026. Đã hoàn thiện chức năng Phase 5 và bộ chuẩn bị triển khai trong workspace. Chưa triển khai hosting hoặc ghi/xóa dữ liệu thật để kiểm thử.

## Chức năng đã có

- HR chọn chấp thuận/từ chối, viết lời nhắn, xem lại và xác nhận. Chỉ chủ tin có quyền; EVALUATED được approve/reject, CV_FAILED chưa bắt đầu được reject. Row lock + version ngăn ghi đè; retry đúng nội dung trả kết quả cũ. Quyết định, một thư và audit commit cùng transaction; quyết định cuối không đổi lại.
- Inbox riêng người nhận, badge polling 30 giây, lọc chưa đọc, keyset pagination, chi tiết thư, read_at idempotent và liên kết hồ sơ theo đúng quyền. Body render bằng React text, không chạy HTML/script. DTO không phát snapshot, đề/đáp án hoặc payload riêng tư.
- Dashboard và chi tiết tin có số hồ sơ tổng/đang xử lý/chờ HR/đã quyết định từ SQL theo chủ tin.
- Settings tiếp nhận/hủy yêu cầu xóa trong 7 ngày, đóng tin đang tuyển ngay; giao diện báo rõ khi chính sách tự động xóa chưa kích hoạt. Các màn hình mới dùng múi giờ người dùng đã chọn.
- Maintenance dọn upload tạm hết 24 giờ, idempotency hết hạn; purge hồ sơ 180 ngày và tài khoản sau grace khi bật retention. Tombstone trước Storage; xóa file thành công rồi mới xóa FK. Bỏ qua task có lease sống, giữ dấu khi lỗi, retry Auth deletion. Buffer trình duyệt dọn theo TTL khi trang mở/lần mở tiếp theo.
- Safe logs, request/task IDs, số liệu queue/retry/failure/timeout/JSON/auto-submit lag, cảnh báo trong log, health/readiness, database timeout và shutdown có lease phục hồi.
- Dockerfile web/worker, Compose, secret injection lúc runtime, health checks, CI kiểm tra mã/build/E2E và container smoke; hướng dẫn migration, backup/staging restore, retention, sự cố và rollback.

## Bằng chứng local

- Bộ kiểm thử nghiệp vụ: **101/101** qua trên **16 file**, gồm retention 180 ngày, retry identifiers, auto-submit trong thời gian chờ xóa và bộ retention **8/8**.
- Bộ Playwright toàn ứng dụng: **19/19** qua (tài khoản, tin tuyển dụng, CV, bài thi, quyết định, Inbox, deletion request). Test timezone được bổ sung cho cả bốn màn hình và kiểm tra bằng Pacific/Honolulu.
- Hai luồng hoàn chỉnh: CV đạt → thi → EVALUATED → approve → Inbox; CV 59/60 theo ALWAYS → thi → EVALUATED → reject → Inbox. Danh tính ngoài không đọc hồ sơ/thư hoặc ra quyết định.
- 20 task, hai consumer, provider giả lập 502/network/JSON sai và crash sau khi tiêu thụ attempt: 16 thành công, 4 thất bại đúng JSON policy, không vượt ba attempt, không nhân đôi báo cáo. Đây không phải benchmark gateway thật hoặc kiểm chứng nhiều kết nối PostgreSQL độc lập.
- SQL thật 0001–0006 chạy trên PGlite. Các test race dùng transaction/state thực, nhưng PGlite serialize trên một kết nối; cần nghiệm thu đồng thời trên hosted staging.
- Dump/restore database PGlite giữ được dữ liệu/migration. Purge xác minh đúng FK, tài khoản khác còn nguyên, Storage failure giữ bản ghi để retry, lease sống không bị purge. Chưa diễn tập backup/restore Supabase hosted hoặc Storage thật.
- Lint, typecheck, worker build và Next production build đã qua. Scan 26 client asset files không tìm thấy hai secret đang cấu hình.
- Web local đã được khởi động lại tại `http://127.0.0.1:3000`; `/login` trả 200. `/api/health` trả 503 đúng với việc Supabase chưa có migration 0006. Không khởi động worker thật khi schema còn thiếu.
- 20 ảnh desktop/mobile, Axe WCAG 2A/AA và overflow qua. Detector chạy một lần: 209 advisory, không có primary finding. Rà soát độc lập ban đầu chấp nhận giao diện và yêu cầu sửa một lỗi múi giờ; lượt verdict sau khi sửa chấm lỗi này resolved, disposition **ship** ở phạm vi lỗi đã nêu. DESIGN.md và design.json giữ nguyên; không thêm raster asset.

## Môi trường thật còn cần kích hoạt

Read-only `npm run phase5:check` trả: migration **0005 có**, **0006 chưa có**, bucket `cvs` **private**, retention **chưa bật**. Không có PostgreSQL connection string hoặc management token trong cấu hình, nên chưa thể tự chạy DDL remote.

Chạy migration [0006_decisions_inbox_and_retention.sql](../supabase/migrations/0006_decisions_inbox_and_retention.sql) trong Supabase SQL Editor, rồi `npm run phase5:check` và khởi động lại web/worker. Không reset hoặc seed database đang dùng.

Máy hiện chưa có Docker; container build/runtime smoke chưa chạy local. CI đã cấu hình `npm run test:containers` trên Linux, nhưng chưa có bằng chứng một lượt GitHub Actions thực tế trong phiên này. Không coi cấu hình CI là CI đã xanh.

Trước production cần chốt chính sách lưu/xóa và backup, chạy container smoke + hosted staging acceptance/restore, xác nhận quota gateway, chọn hosting/domain và thực hiện lượt deploy cụ thể. Hướng dẫn chi tiết: [OPERATIONS.md](OPERATIONS.md).
