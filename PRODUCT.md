# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Storage. Người dùng đã yêu cầu hoàn tất phần còn lại, gồm Phase 5 theo `docs/04_IMPLEMENTATION_PLAN.md`.

## Users

Người tuyển dụng cá nhân và ứng viên. Một tài khoản chuyển giữa hai chế độ; quyền luôn dựa vào chủ sở hữu tài nguyên.

## Product Purpose

Tạo và quản lý quy trình tuyển dụng có AI hỗ trợ, có HR duyệt nội dung và quyết định cuối cùng. Phase 1 cung cấp tài khoản và phân quyền. Phase 2 cung cấp tạo nháp AI, chỉnh JD/rubric/bài thi, đăng/đóng tin và tìm việc công khai. Phase 3 tiếp nhận CV, xác nhận nội dung, chấm theo snapshot và hiển thị kết quả/điều kiện làm bài cùng báo cáo riêng HR. Phase 4 bổ sung bài thi một lượt, lưu tự động/phục hồi, deadline server và chấm quiz/tự luận theo tỷ trọng 40/60.

## Operating Context

Giao diện tiếng Việt, dùng trên desktop và điện thoại. Người dùng đăng ký, xác nhận email, đăng nhập, khôi phục mật khẩu, chỉnh hồ sơ và chuyển chế độ. Dữ liệu thời gian UTC, hiển thị theo múi giờ người dùng.

## Capabilities and Constraints

- Một danh tính, hai chế độ, không tự ứng tuyển tin của mình.
- Secret chỉ nằm ở server. CV, đáp án và snapshot không được đọc trực tiếp bằng tài khoản trình duyệt.
- Triển khai local đến Phase 5: tài khoản, tin tuyển dụng, CV, bài thi, autosave/timer/phục hồi, chấm kết hợp, quyết định HR và Inbox riêng người nhận; tích hợp Nine Router từ server/worker, chưa deploy.
- Quyết định cuối có phiên bản, lời nhắn và xác nhận; cùng transaction với thông báo, không đổi lại. Inbox có badge chưa đọc, đọc idempotent và phân trang.
- Settings tiếp nhận/hủy yêu cầu xóa trong 7 ngày; đóng tin ngay. Chính sách dự kiến lưu hồ sơ 180 ngày cần được công khai và bật trên cả web/worker trước production. Giao diện nói rõ khi tự xóa chưa kích hoạt.
- AI chạy qua queue có lease/heartbeat và budget ba HTTP attempt. HR duyệt trước khi nội dung được công khai.
- Gateway không còn gpt-4o-mini tại lần kiểm tra 02/11/2026; ag/gemini-3.8-flash đã trả về output hợp lệ. Model vẫn là cấu hình server, không có fallback tự động.
- Không tạo phiên đăng nhập giả khi chưa cấu hình Supabase.
- Tên hiển thị tạm thời lấy từ workspace là LocCV; tên thương hiệu chính thức chưa được quyết định.

## Evidence on Hand

Bốn tài liệu trong `docs/` là nguồn sự thật nghiệp vụ. Chưa có khách hàng, số liệu hiệu quả, đối tác, đánh giá hoặc tin tuyển dụng thật để sử dụng làm tuyên bố sản phẩm.

## Product Principles

- AI hỗ trợ, con người quyết định.
- Quyền được xác minh tại server, không phụ thuộc chế độ đang xem.
- Nói rõ trạng thái thật; dữ liệu chưa có được trình bày bằng empty state.
- Có thể tiếp tục công việc sau tải lại hoặc gián đoạn.

## Accessibility & Inclusion

Label rõ ràng, dùng bằng bàn phím, focus nhìn thấy được, lỗi gắn với trường nhập, màu luôn đi cùng chữ, tôn trọng reduced motion.
