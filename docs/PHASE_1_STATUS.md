# Phase 1 — Kết quả triển khai

Ngày: 02/11/2026. Trạng thái: **đã triển khai và kiểm tra local; chờ nghiệm thu kết nối Supabase thật**. Chưa chuyển sang Phase 2.

## Phần đã hoàn thành

- Next.js 16.4.4, React 19.3.1, TypeScript strict, Tailwind, các thành phần UI cơ bản và form có Zod validation; package-lock khóa phiên bản.
- Đăng ký/xác nhận email, đăng nhập, khôi phục/đổi mật khẩu, đăng xuất; cookie SSR và session refresh bằng Proxy. API/DAL xác minh user độc lập với cookie và chế độ giao diện.
- Hồ sơ cá nhân và chuyển HR/Ứng viên bằng cùng một UUID, preference lưu database. Trang HR/Ứng viên là empty state đúng phạm vi, không có tin hoặc kết quả giả.
- Bảy bảng theo thiết kế, Auth profile trigger, FK/check/unique/index, trigger self-apply/snapshot/bất biến/chuyển trạng thái, RLS và grants mặc định từ chối browser; bucket CV private.
- DTO allowlist, giới hạn body, kiểm tra Origin, thông báo lỗi an toàn, chặn secret trong biến public trước build, gitignore môi trường và không log request URL chứa token xác nhận.
- Database types sinh từ metadata migration; seed hai tài khoản giả không có password/hash; CI và script kiểm tra Supabase test.

## Bằng chứng kiểm thử

| Hạng mục | Kết quả thực tế |
| --- | --- |
| `npm run lint` | Đạt, không warning |
| `npm run typecheck` | Đạt |
| `npm test` | 29 kiểm thử đạt trong 3 file |
| SQL migrations | Chạy từ database rỗng trên PostgreSQL nhúng PGlite; Auth/Storage schema được giả lập |
| `npm run build` | Production build thành công |
| `npm run test:e2e` | 6 kịch bản Chromium đạt; Next.js/SDK/cookie/API thật, provider Auth/PostgREST HTTP fixture |
| Accessibility | Axe WCAG A/AA trên đăng nhập/cài đặt không có violation; kiểm tra desktop 1440px và mobile 390px không tràn ngang |
| Review giao diện | Disposition `ship`, phạm vi đăng nhập/cài đặt desktop/mobile; không có lỗi material trên các bề mặt đã xem |
| Kiểm tra production thiếu env | Login/signup/forgot trả 200 và khóa gửi; API me trả 401, settings chuyển về login |
| Kiểm tra secret | Không có key Nine Router đã cung cấp hoặc server fixture secret trong source/bundle trình duyệt production |
| `npm audit --omit=dev` | Không có advisory dependency runtime tại thời điểm chạy |
| `npm audit` toàn bộ | 16 advisory mức moderate trong chuỗi công cụ lint/minimatch; chưa ép nâng major dependency để che kết quả |
| `npm run test:live` | Chưa chạy do thiếu ba biến SUPABASE_TEST_*; không tính là pass |

Tất cả test dùng dữ liệu giả. Không gọi Nine Router, không gửi email thật, không tạo project hoặc deploy lên dịch vụ bên ngoài. Các kiểm thử PGlite/HTTP fixture không thay thế nghiệm thu full Supabase hoặc việc email đến hộp thư thật.

## Phần cần thực hiện trên môi trường thật

1. Tạo/chọn Supabase project TEST, sao chép `.env.example` thành `.env.local`, điền URL/publishable key/secret key. Không chia sẻ secret trong chat hoặc đưa vào Git.
2. Chạy hai migration theo thứ tự trên project TEST; cấu hình Site URL, redirect URLs và email templates theo [README](../README.md).
3. Khởi động lại `npm run dev`, đăng ký hai tài khoản email do bạn kiểm soát; xác nhận email và thử đăng nhập, chuyển mode, sửa profile, khôi phục và đăng xuất.
4. Điền ba biến SUPABASE_TEST_* của cùng project TEST và chạy `npm run test:live` để kiểm tra Auth/DB/quyền thật; chỉ sau khi đạt mới nghiệm thu cổng kết nối Phase 1.

## Giới hạn có chủ đích

Phase 1 chưa mở API đăng tin, nộp CV, chấm điểm, bài thi hoặc Inbox. Full JSON validation và transaction publish/apply/submit/decision được bổ sung cùng Phase sở hữu tính năng, không dùng direct SQL thay API ứng dụng. Không có mock/demo mode trong `src/` để giả lập kết nối thật. Hai file thiết kế nền `PRODUCT.md`/`DESIGN.md` ghi bối cảnh và token dùng cho các Phase tiếp theo; bốn tài liệu gốc trong `docs/` vẫn là hợp đồng nghiệp vụ.
