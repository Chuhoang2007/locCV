# Phản hồi khi đang tải — 03/11/2026

Yêu cầu: chuyển trang/bấm chức năng có phản hồi rõ để giao diện không có cảm giác bị đơ. Giữ nguyên thiết kế và luồng nghiệp vụ.

## Thay đổi

- Thanh chuyển động mảnh ở đầu màn hình và trạng thái “Đang tải nội dung…” trong lúc Next Link, router push/replace/refresh hoặc Suspense thực sự đang chờ. Không dùng phần trăm giả hoặc thời gian chờ tối thiểu; không chặn tương tác bằng lớp phủ.
- Khung nội dung chờ ở các nhóm trang và lần tải toàn trang. Khi dữ liệu về, tự thay bằng nội dung thật. Bộ đếm trạng thái được dọn khi chuyển xong/hủy hoặc component unmount.
- Button dùng chung hỗ trợ loading, aria-busy và chặn bấm lặp. Đã nối vào soạn tin thủ công, đăng/đóng tin, quyết định HR, xóa dữ liệu, tải CV, thử chấm lại và phân trang Inbox. Các nút đăng nhập/lưu hồ sơ/nộp CV vốn đã có spinner tiếp tục giữ phản hồi đó.
- Phân biệt đang tạo nháp AI và đang soạn thủ công; chuyển chế độ giữ nút khóa tới khi trang mới hoàn tất.
- File picker CV chờ hydration trước khi bật, tránh mất thao tác chọn file khi phần xử lý chưa sẵn sàng. Kiểm thử file chờ đúng trạng thái enabled, không dùng sleep cố định.
- Reduced motion giữ thông báo và thanh tĩnh, tắt chuyển động của các phần loading mới. Không thêm dependency hoặc raster asset. DESIGN.md và design.json giữ nguyên.

## Kiểm chứng

Kiểm thử mới dùng request có thể giữ/thả và độ trễ ở provider giả lập; không làm chậm ứng dụng production. Bao phủ chuyển trang chờ RSC, streaming skeleton, refresh, cùng trang/hash link, bấm lặp, lỗi API và thử lại, desktop/mobile, Axe và reduced motion. Ảnh QA trong `.impeccable/review/loading-*.png` là dữ liệu giả.

Hiệu ứng phản ánh thời gian chờ thực; không coi việc thêm loading là bằng chứng backend đã xử lý nhanh hơn.

Kết quả thực tế: lint, typecheck, production build và 101/101 test nghiệp vụ qua; scan 28 client asset files không có hai secret đang cấu hình. Lượt E2E tổng có 20/23 qua, ba ca CV phát hiện vấn đề chọn file trước hydration; sau sửa, cả ba ca CV chạy lại đều qua. Bốn ca loading mới đã qua, gồm kiểm tra chỉ một live status; ca streaming được chạy lại sau khi đổi phép đo overflow tức thời thành chờ reflow bằng expect.poll. Không dùng thời gian ngủ cố định để vượt kiểm thử.

Đã mở và rà soát 10 ảnh loading cùng hai ảnh CV desktop/mobile. Detector chạy một lần: 210 advisory, không có primary finding. Reviewer độc lập chấp nhận giao diện và nêu một lỗi thông báo trợ năng bị lặp; lỗi đã sửa, verdict sau cùng **ship** ở phạm vi lỗi đó. Không viết lại thiết kế hoặc sidecar.
