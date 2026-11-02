# LocCV — Phase 5

Nền tảng tuyển dụng theo bộ thiết kế trong `docs/`. Đã có tài khoản, tin tuyển dụng, tiếp nhận/chấm CV, bài thi/autosave/timer server, kết quả 40/60, quyết định cuối của HR và Inbox riêng người nhận. Phase 5 bổ sung quản lý dữ liệu, health/monitoring, container và CI. Mã nguồn local hoàn chỉnh; trạng thái môi trường thật được ghi riêng.

## Bắt đầu Phase 5 khi đã có Phase 4

1. Trong **Supabase → SQL Editor**, chạy toàn bộ migration mới [0006_decisions_inbox_and_retention.sql](supabase/migrations/0006_decisions_inbox_and_retention.sql). Không chạy lại migration cũ, seed hoặc reset database đang dùng.
2. Chạy `npm run phase5:check`, cần `ok:true`. Lần kiểm tra mới nhất ngày 02/11/2026: **0005 đã có, 0006 chưa có, bucket CV private**. Workspace chưa có quyền quản trị SQL để tự áp migration remote.
3. Khởi động lại web (`npm run dev`) và worker (`npm run worker:build` rồi `npm run worker`) trong hai terminal.
4. HR mở hồ sơ đã `EVALUATED`, chọn Chấp thuận/Từ chối, viết lời nhắn và xác nhận gửi. CV trượt chưa bắt đầu bài thi có thể được từ chối. Quyết định đã chốt không đổi lại được. Ứng viên nhận phản hồi trong **Hộp thư**.
5. Settings có yêu cầu xóa dữ liệu và thời gian hủy 7 ngày. Tự purge hồ sơ/tài khoản mặc định chưa bật cho tới khi chốt chính sách; upload tạm không gắn hồ sơ vẫn được dọn sau 24 giờ. Xem cách bật và phạm vi xóa trong [hướng dẫn vận hành](docs/OPERATIONS.md).

[Báo cáo nghiệm thu Phase 5](docs/PHASE_5_STATUS.md) · [Vận hành, container, backup và rollback](docs/OPERATIONS.md).

Các mục Phase 1–4 bên dưới là hướng dẫn theo từng mốc; dùng trạng thái và hướng dẫn Phase 5 ở trên cho bản hiện tại.

## Bắt đầu Phase 4 khi đã có Phase 3

1. Trong **Supabase → SQL Editor**, chạy toàn bộ [0005_interview_and_inbox_transactions.sql](supabase/migrations/0005_interview_and_inbox_transactions.sql) sau các migration 0001–0004. Chỉ chạy migration mới; không reset database hoặc seed trên dữ liệu đang dùng.
2. Chạy `npm run phase4:check`. Lệnh chỉ kiểm tra cấu trúc/bucket, không tạo hồ sơ/bài thi và không in key. Khi đủ điều kiện sẽ báo `ok:true`.
3. Khởi động lại web và worker bằng mã mới:

```powershell
# Terminal 1
npm run dev
```

```powershell
# Terminal 2 — dừng worker cũ trước khi chạy
npm run worker:build
npm run worker
```

4. Ứng viên mở hồ sơ đủ điều kiện → **Xem hướng dẫn & bắt đầu** → **Bắt đầu bài thi**. Câu hỏi chỉ được trả sau thao tác bắt đầu. Chuyển chế độ, đóng tab, tải lại hoặc đăng nhập lại đều dùng deadline cũ.
5. Sau nộp, ứng viên xem riêng điểm CV, quiz, tự luận và tổng bài thi. HR mở hồ sơ để xem đáp án, điểm từng câu và bằng chứng tự luận. Tự luận lỗi giữ điểm quiz, chưa có điểm tổng và có retry giới hạn. Chấp thuận/từ chối cuối cùng được triển khai ở Phase 5.

Tại mốc nghiệm thu Phase 4 trước đây ngày 02/11/2026, project chưa có migration 0005. Lần kiểm tra Phase 5 mới nhất ở đầu README đã xác nhận 0005 hiện có; chỉ còn thiếu 0006. Xem [báo cáo Phase 4](docs/PHASE_4_STATUS.md) để biết bằng chứng của mốc trước.

Kiểm tra AI chấm tự luận thật bằng dữ liệu giả (có dùng token): `npm run ai:check -- --essay`. Bài quiz vẫn chấm local trên backend, không gửi đáp án quiz hoặc CV sang model.

## Bắt đầu Phase 3 khi đã có Phase 2

1. Mở Supabase → SQL Editor. Chạy toàn bộ **chỉ migration mới** [0004_application_transactions.sql](supabase/migrations/0004_application_transactions.sql). Giữ nguyên dữ liệu và các migration 0001–0003 đã chạy; không reset database.
2. Giữ cấu hình Supabase ở **ba biến đầu** `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Nhóm `SUPABASE_TEST_*` ở cuối chỉ dành cho script kiểm thử; ứng dụng không đọc nhóm đó. Giữ cấu hình NINE_ROUTER_* đã có.
3. Kiểm tra môi trường và khởi động lại web/worker:

```powershell
npm run phase3:check
npm run dev
```

Trong terminal thứ hai:

```powershell
npm run worker:build
npm run worker
```

`phase3:check` chỉ đọc trạng thái migration/bucket, không tạo tài khoản hoặc hồ sơ. Chưa đủ cấu hình/migration sẽ thoát khác 0 và chỉ rõ bước còn thiếu. Dừng worker cũ trước khi chạy bản mới.

4. Dùng hai tài khoản riêng: HR đăng một tin → ứng viên chọn **Ứng tuyển ngay** → tải CV hoặc dán văn bản → xác nhận nội dung và thông báo AI → gửi hồ sơ. Ứng viên xem ở **Hồ sơ ứng tuyển**; HR mở tin → danh sách hồ sơ → báo cáo từng tiêu chí. Chuyển chế độ trên cùng tài khoản vẫn không được tự ứng tuyển.
5. Kiểm tra AI thật bằng dữ liệu giả (có dùng token): `npm run ai:check -- --cv`. Chi tiết nghiệm thu và giới hạn môi trường nằm trong [báo cáo Phase 3](docs/PHASE_3_STATUS.md).

Lần kiểm tra project đang cấu hình ngày 02/11/2026: bucket `cvs` đã private nhưng migration 0004 chưa có. Workspace đã chuẩn bị migration; khóa API server không cung cấp quyền thực thi DDL từ xa. Cần chạy bước 1 trên project của bạn để bật luồng Phase 3 tại đó.

## Bắt đầu Phase 2 khi đã có Phase 1

1. Chạy **chỉ migration mới** `supabase/migrations/0003_job_transactions.sql` trên Supabase project đã có hai migration Phase 1. Không reset database đang dùng.
2. Kiểm tra NINE_ROUTER_BASE_URL, NINE_ROUTER_API_KEY, NINE_ROUTER_MODEL trong `.env.local`, theo `.env.example`. Bản workspace này đã chuẩn bị cấu hình Nine Router cục bộ từ thông tin được cung cấp; các trường Supabase cần cấu hình project của bạn. Key chỉ ở server/worker, `.env.local` không được đưa vào Git.
3. Mở hai terminal tại thư mục dự án:

```powershell
# Terminal 1: web, http://127.0.0.1:3000
npm run dev
```

```powershell
# Terminal 2: worker nền
npm run worker:build
npm run worker
```

Đăng nhập → chuyển Tuyển dụng → Tạo tin tuyển dụng. Worker phải chạy để xử lý tác vụ; trang web tự theo dõi tiến trình, không gọi AI từ trình duyệt. Khi chỉnh worker có thể dùng `npm run worker:dev` thay cho hai lệnh build/run. Kiểm tra worker tại http://127.0.0.1:3310/health; HTTP 200 chỉ khi database còn kết nối được. Đổi WORKER_HEALTH_PORT nếu chạy nhiều tiến trình trên cùng máy.

**Thay đổi cấu hình đã được xác minh:** ngày 02/11/2026, gateway trả `404 model_not_found` với gpt-4o-mini. Cấu hình mẫu dùng **ag/gemini-3.8-flash**, đã tạo thành công JD, rubric tổng 100, 5 quiz và 2 essay qua module của dự án. Request gửi rõ `stream: false` vì gateway trả SSE khi không có trường này. Không tự fallback model; mỗi task lưu model/prompt_version để giữ provenance. Key thật đã được dùng trong RAM cho smoke test, không ghi vào repository hoặc cấu hình mẫu.

```powershell
# Liệt kê model mà cấu hình Nine Router hiện tại hỗ trợ, không tạo nội dung.
npm run ai:check
# Chủ động chạy một smoke test tạo nháp với dữ liệu giả, có sử dụng token.
npm run ai:check -- --generate
```

Các lệnh này đọc `.env.local`, không in key, prompt hay body lỗi. Cấu hình riêng của bạn có thể thay đổi theo tài khoản/gateway; danh sách model và smoke test mới là bằng chứng hiện hành.

## Chạy local

Yêu cầu Node.js từ 22.13 trở lên, npm. Môi trường đã kiểm tra: Windows PowerShell, Node 26.13.0. CI dùng Node 24. Các dependency được khóa phiên bản trong package.json và package-lock.json.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Mở **http://127.0.0.1:3000**. Khi chưa điền Supabase, trang đăng nhập/đăng ký vẫn xem được, có thông báo thiết lập và nút gửi bị khóa. `/setup` hướng dẫn cấu hình, chỉ tồn tại ở chế độ development. Không có tài khoản demo, mock session hoặc bypass Auth trong ứng dụng.

### 1. Cấu hình `.env.local`

| Biến | Nguồn | Được gửi vào browser? |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Project URL của Supabase | Có |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable key hoặc legacy anon key | Có |
| SUPABASE_SECRET_KEY | Secret key hoặc legacy service_role key | Không |
| SITE_URL | `http://127.0.0.1:3000` khi chạy local | Chỉ dùng server |

Không đặt secret/service_role hoặc Nine Router key vào biến NEXT_PUBLIC. Server từ chối nếu phát hiện Supabase server key trong cấu hình public. `.env`, `.env.*` đều được gitignore, chỉ `.env.example` được lưu. Auth vẫn hoạt động khi chưa điền Nine Router; HR có thể tạo và lưu nháp thủ công.

Sau khi thay biến môi trường, khởi động lại dev server. Với production, build lại khi thay biến NEXT_PUBLIC vì Next.js đưa giá trị vào bundle lúc build. SITE_URL phải đúng origin sử dụng thực tế: dùng 127.0.0.1 nhất quán hoặc đổi toàn bộ SITE_URL/redirect URLs sang localhost; API mutation kiểm tra Origin để chống CSRF.

### 2. Chạy migration

Chỉ chạy trên project mới hoặc database test chuyên biệt. Hai migration tạo các bảng/fn có tên được định nghĩa trong bộ thiết kế, không tự ghi đè hệ thống có sẵn.

**Có Supabase CLI và Docker:**

```powershell
supabase start
supabase db reset
```

Lấy URL/key do CLI trả về để điền `.env.local`. `supabase db reset` xóa dữ liệu local trước khi dựng lại; chỉ dùng với database phát triển của dự án. Local Studio ở http://127.0.0.1:54323, hộp thư test ở http://127.0.0.1:54324.

**Dùng Supabase hosted:** vào SQL Editor của project TEST, chạy lần lượt nguyên nội dung:

1. `supabase/migrations/0001_core_tables.sql`
2. `supabase/migrations/0002_security_and_storage.sql`
3. `supabase/migrations/0003_job_transactions.sql`

Không chạy `seed.sql` vào production. Seed chứa hai Auth/profile fixture `@example.test`, không có mật khẩu/hash nên không dùng để đăng nhập. Để thử thao tác bằng giao diện, đăng ký hai tài khoản có email mà bạn kiểm soát; hoặc dùng script live test bên dưới để tạo rồi xóa fixture tự động.

Các bảng: users, jobs, applications, messages, ai_tasks, idempotency_keys, audit_events. Auth trigger tạo profile idempotent. RLS bật và anon/authenticated bị thu hồi quyền đọc/ghi trực tiếp trên tất cả bảng nghiệp vụ. Backend dùng server secret và tự kiểm tra user/ownership. Bucket `cvs` là private, giới hạn 5 MiB và có restrictive policies chống vô tình cấp quyền browser.

Phase 2 đã có RPC tạo/lưu/đăng/đóng tin, tạo task idempotent, quota và các thao tác lease/heartbeat/attempt/complete/fail. RPC chỉ cấp cho service_role; API xác thực actor trước khi gọi. Zod kiểm tra đầy đủ cấu trúc/giới hạn JSON; transaction SQL kiểm tra lại các bất biến tổng điểm/ID/đáp án/thang điểm và trạng thái. Apply/submit/decision chưa được mở. Không dùng SQL trực tiếp để thay thế các transaction chưa triển khai.

### 3. Auth URLs và email templates

Trong Supabase Auth → URL Configuration:

- Site URL: `http://127.0.0.1:3000`
- Redirect URLs: `http://127.0.0.1:3000/auth/callback`, `http://127.0.0.1:3000/auth/callback?flow=recovery`, `http://127.0.0.1:3000/auth/confirm`
- Bật xác nhận email; đặt độ dài mật khẩu tối thiểu 12 ký tự, nhất quán với ứng dụng.

Khuyến nghị dùng token_hash templates để người dùng mở email trên thiết bị khác vẫn xác nhận được. Giữ nguyên các biến template dưới đây:

**Confirm signup** — URL nút xác nhận:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Xác nhận tài khoản</a>
```

**Reset password** — URL nút khôi phục:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Đặt mật khẩu mới</a>
```

Ứng dụng cũng hỗ trợ PKCE qua `/auth/callback?code=...`; PKCE cần browser đã khởi tạo yêu cầu có cookie code verifier. Callback chỉ điều hướng đến allowlist nội bộ, bỏ token khỏi URL đích và trả `no-store`/`no-referrer`. Reset password yêu cầu session được Auth xác nhận, sau khi đổi thành công sẽ đăng xuất và yêu cầu đăng nhập lại.

## Chức năng hiện có

- `/login`, `/signup`, `/forgot-password`, `/reset-password`: input kiểm tra ở client và server, lỗi an toàn, hiện/ẩn mật khẩu, trạng thái gửi và kết quả email không tiết lộ tài khoản có tồn tại.
- `/auth/callback`, `/auth/confirm`: xác nhận và khôi phục tài khoản.
- `/settings`: tên hiển thị, timezone, email và đường dẫn đổi mật khẩu.
- Navbar đổi hai chế độ bằng PATCH `/api/me`; giữ nguyên UUID, preference lưu database.
- `/hr`, `/hr/jobs/new`, `/hr/jobs/:id`, `/hr/jobs/:id/edit`: danh sách có lọc/phân trang, soạn thủ công hoặc bằng AI, chỉnh JD/rubric/câu hỏi/lựa chọn/đáp án, xem trước, duyệt đăng và đóng tin.
- `/jobs`, `/jobs/:id`: khách chưa đăng nhập cũng xem được, tìm có/không dấu theo từ khóa, kỹ năng, khoảng lương VND/tháng, phân trang cursor. DTO và HTML công khai không có đề/đáp án/hướng dẫn chấm.
- `/jobs/:id/apply`: PDF/DOCX/văn bản, xem và xác nhận nội dung, thông báo xử lý AI, chống nộp trùng.
- `/candidate/applications`, `/candidate/applications/:id`: danh sách, tiến trình CV và điểm/tóm tắt, điều kiện bài thi từ snapshot, thử chấm lại sau lỗi AI.
- `/hr/jobs/:id`, `/hr/applications/:id`: danh sách hồ sơ có lọc/phân trang, CV và báo cáo bằng chứng từng tiêu chí; tải file bằng link private 60 giây.
- `/candidate/applications/:id/interview`: giới thiệu, bắt đầu một lần, câu hỏi không có đáp án/rubric, lưu tự động, phục hồi/xung đột và xác nhận nộp.
- GET `/api/applications/:id/interview`, POST `/interview/start`, PUT `/answers`, POST `/interview/submit` dưới cùng application: chỉ chủ hồ sơ, kiểm tra quyền/phiên bản/deadline tại server. HR xem kết quả qua API HR riêng.
- GET `/api/tasks/:id`, POST `/api/tasks/:id/retry`: chủ tin cho nháp; chủ hồ sơ/chủ tin cho chấm CV. DTO an toàn, retry tạo generation mới, không reset budget cũ.
- GET `/api/me`: chỉ hồ sơ của session hiện tại; PATCH chỉ cho display_name/preferred_mode/timezone, từ chối id/role/điểm giả.
- Đăng xuất xóa session cookie và buffer trả lời có prefix của ứng dụng. Trang riêng bị chặn khi chưa đăng nhập.

Proxy chỉ refresh session. Mỗi DAL/API vẫn xác minh bằng `auth.getUser()` từ Auth server; không tin `getSession()` hoặc user object trong cookie. Service role bypass RLS nên mọi API dùng nó phải lấy actor từ session, dựng DTO allowlist và không nhận actor từ body.

## Kiểm thử

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run worker:build
npx playwright install chromium
npm run test:e2e
```

- Unit: schema, state machine, safe redirects, HTTP/CSRF, secret boundary, sanitizer, timeout 60s, retry ba attempt, model không khả dụng và DTO không lộ đáp án.
- Integration: chạy SQL thật trên PostgreSQL nhúng PGlite, với schema Auth/Storage tối thiểu giả lập. Phase 1 được kiểm tra ở schema lịch sử; bộ Phase 2 chạy cả ba migration, kiểm tra publish/search/close, quota, idempotency, version conflict, lease cũ, hai consumer và budget phục hồi. Đây không phải full Supabase stack.
- Playwright: Next.js thật trên port 3000, HTTP Auth/PostgREST adapter trên 54329 và worker production trên 3310. Adapter chạy các bảng/RPC trên PostgreSQL nhúng đã migrate; chỉ Auth và Nine Router transport được mô phỏng. Kịch bản từ tạo AI qua 502/504 → sửa ba phần → đăng → khách tìm/xem → đóng được chạy qua UI/API thật. Test thêm validation ở tab không được chọn, JSON lỗi/retry/reload, quyền và hồi quy tài khoản. Fixture chỉ ở tests, không có mock mode trong mã ứng dụng.
- E2E tạo screenshot trong `.impeccable/review/`; trace lỗi ở `test-results/`. Không gọi Nine Router, không gửi email thật. Dừng dev server trên port 3000 trước khi chạy E2E; Playwright không dùng lại server không rõ cấu hình.

### Kiểm tra trên Supabase thật

Điền **ba biến SUPABASE_TEST_*** vào `.env.local` của project TEST đã chạy migration, rồi chạy:

```powershell
npm run test:live
```

Script không dùng lại các biến project chính để tránh chạy nhầm. Nó tạo hai tài khoản fixture bằng Admin Auth, mật khẩu ngẫu nhiên trong RAM, kiểm tra login/logout/profile/mode/quyền đọc, rồi chỉ xóa các tài khoản vừa tạo. Không in mật khẩu hoặc key. Thiếu biến sẽ thoát code 2 với thông báo chưa chạy, không báo pass giả. Script chưa kiểm thử việc email thật được gửi tới người nhận; kiểm tra đăng ký/khôi phục bằng hộp thư test là bước nghiệm thu kết nối thực tế.

### Kiểu dữ liệu database

`src/lib/db.types.ts` được sinh từ metadata của PostgreSQL sau khi chạy migration, không ép `any` cho Supabase client.

```powershell
npm run db:types:local
# Hoặc khi có full Supabase local:
npm run db:types
```

Lệnh local dùng PGlite, không cần Docker và không thay đổi database thật. CI dựng lại types để phát hiện schema drift. Nếu dùng generator Supabase CLI, metadata Relationships có thể phong phú hơn bản local; cập nhật CI generator thống nhất cùng thay đổi đó.

## Nguồn kỹ thuật

Triển khai dựa trên [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase password Auth](https://supabase.com/docs/guides/auth/passwords), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) và [Next.js Vitest](https://nextjs.org/docs/app/guides/testing/vitest).

## Quy tắc vận hành Phase 2

- API tạo task và trả 201/202 sớm; không giữ HTTP browser chờ AI. Poll mỗi 2–5 giây và có thể khôi phục sau tải lại.
- Mỗi generation tối đa ba HTTP attempt, timeout 60.000 ms mỗi lần; chỉ retry 502/504/network/timeout. 401/429/JSON/schema/model sai không tự retry.
- Queue claim bằng SKIP LOCKED, lease token mới mỗi claim, TTL 90 giây, heartbeat 15 giây. Budget được ghi trước mỗi HTTP request; mất lease không được ghi kết quả. Đóng worker để lease hết hạn, worker khác có thể phục hồi.
- Chỉ ghi AI nếu job vẫn DRAFT và đúng input_version. Nếu HR lưu thay đổi trong lúc AI chạy, kết quả cũ bị từ chối; thay đổi HR không bị ghi đè.
- Tối đa 5 generation/giờ và 20/24 giờ/user; giới hạn này nằm trong transaction SQL, không phụ thuộc bộ nhớ của web. Tạo nháp tối đa 30/giờ để hạn chế spam. Replay Idempotency-Key cùng payload không tiêu thêm quota; payload khác trả 409.
- HR lưu nháp trước khi đăng. Validation trả đường dẫn lỗi, tự mở đúng tab/focus, gắn aria-invalid và thông báo cạnh trường cần sửa. Tổng CV phải 100; mỗi essay rubric cộng đúng điểm câu hỏi; ID duy nhất, đáp án thuộc lựa chọn.
- Sau đăng không sửa JD/rubric/questions/policy; muốn thay đánh giá thì tạo tin mới. Đóng tin có xác nhận và gỡ khỏi search/detail công khai ngay ở request kế tiếp.

Kết quả lịch sử ở [báo cáo Phase 2](docs/PHASE_2_STATUS.md) và [Phase 3](docs/PHASE_3_STATUS.md). Trạng thái hiện tại ở [báo cáo Phase 4](docs/PHASE_4_STATUS.md). Kế hoạch Phase 5 ở `docs/04_IMPLEMENTATION_PLAN.md`.

## Quy tắc vận hành Phase 4

- `started_at`/`deadline_at` ghi một lần dưới row lock, luôn dùng snapshot. GET không khởi tạo bài mới; start gọi lại giữ thời gian cũ. UI dùng server_now và đồng hồ monotonic, đồng bộ lại khi trở về tab/mỗi 5 giây. Đổi đồng hồ thiết bị không thay đổi quyền lưu/nộp.
- Lưu sau khoảng 1 giây dừng gõ và kiểm tra ít nhất mỗi 10 giây khi còn thay đổi. `answer_version` là CAS; bản cũ nhận 409, không ghi đè tab khác. Tổng body tối đa 100 KiB; tự luận tối đa 5.000 ký tự/câu. Chưa lưu thì hiển thị rõ, có Lưu ngay và cảnh báo khi rời trang.
- Bộ đệm localStorage mặc định tắt. Bật sẽ lưu duy nhất answers + timestamp/version theo user/application/schema; không lưu CV, đề, rubric, token hoặc đáp án đúng. Hết TTL 24 giờ sẽ được bỏ/dọn khi đọc; phải xác nhận mới khôi phục, bản dựa trên version cũ không tự ghi đè. Xóa khi nộp/đăng xuất/tắt lựa chọn. Broadcast ngăn tab khác ghi lại buffer sau logout.
- Nộp bài chỉ gửi `answer_version`; không nhận câu trả lời hoặc điểm trong body. Grader `gradeQuiz` dùng câu trả lời đã lưu từ nguồn private. SQL khóa hàng, kiểm tra version nguồn chưa đổi rồi ghi submitted_at, quiz_result, task essay, Message/audit cùng transaction. Callback timeout dùng chính hàm này. Câu thiếu được chuẩn hóa khi chấm; không chèn nội dung mới sau deadline.
- Worker quét deadline mỗi 15 giây, tối đa 100 hồ sơ/lượt, phục hồi khi chạy lại. Kể cả worker tạm dừng, deadline vẫn chặn sửa; khi phục hồi chỉ bản đã lưu được chấm. Không dựa vào timer trình duyệt để đảm bảo nộp.
- Essay chỉ nhận bài tự luận/rubric của từng câu; kiểm tra ID, max_points, evidence từ đúng câu trả lời, điểm 0 cho câu trắng. `buildInterviewEvaluation` dùng điểm phần đã round2 theo 40/60; CV không cộng vào tổng. SQL kiểm tra kết quả với snapshot/quiz đã giữ lại, commit báo cáo + EVALUATED + hai Messages nguyên tử.
- Tối đa hai generation retry thủ công/24 giờ/hồ sơ cho EVALUATE_ESSAY, dùng chung HR/ứng viên, chỉ FAILED/latest. Lease/budget ba HTTP attempt giống CV. Lỗi AI không đổi quiz_result, không gán essay/tổng bằng 0 và không chuyển EVALUATED trước khi hoàn tất.

## Quy tắc vận hành Phase 3

- CV tối đa 5 MiB; PDF tối đa 20 trang. DOCX tối đa 200 entry và 20 MiB tổng giải nén; không render HTML hoặc tải tài nguyên bên ngoài.
- Parser chạy trong child process không kế thừa secret, Node heap 128 MiB và timeout 10 giây. Không OCR. File scan/hỏng/mật khẩu không tạo hồ sơ hoặc task AI; người dùng đổi file hoặc dán text 100–30.000 ký tự.
- Upload tạm có owner, path UUID server cấp và TTL 24 giờ; tối đa 10 upload/giờ/user. Một upload chỉ chạy parser một lần; retry request sau READY lấy lại kết quả. File FAILED cần đổi file hoặc dán text. Sau nộp, file chỉ được lấy qua quyền của Application.
- Tiếp nhận khóa hàng Jobs, kiểm tra tin mở/self-apply/unique, chốt text/hash/snapshot/acknowledgment, tạo task và Message cùng transaction. Đóng tin không dừng hồ sơ đã tiếp nhận.
- Worker dùng rubric snapshot, kiểm tra ID/điểm/bằng chứng trích nguyên văn, tự cộng tổng và xét `score >= threshold`. ALWAYS cho phép làm bài sau khi CV chấm thành công, kể cả điểm dưới ngưỡng. AI lỗi giữ CV_SUBMITTED và điểm null.
- Tối đa hai retry thủ công cho EVALUATE_CV/hồ sơ trong 24 giờ, dùng chung cho HR và ứng viên, chỉ FAILED/latest. Mỗi generation vẫn có tối đa ba HTTP attempt. Messages kết quả deduplicate theo hồ sơ/sự kiện/người nhận.
- API ứng viên chỉ có điểm/tóm tắt; API HR riêng có chi tiết tiêu chí. Không trả snapshot, đáp án hoặc storage path. Response private/no-store, kiểm tra CSRF khi ghi, audit khi cấp link tải.
- Dọn file tạm hết TTL và chính sách lưu/xóa dữ liệu được hoàn thiện ở Phase 5; hiện TTL chặn sử dụng lại, chưa tự xóa object đã lưu. Parser là process riêng có budget, không được quảng bá như một OS sandbox.

Parser dựa trên [PDF.js Node text extraction](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs) và [yauzl lazy entry/size validation](https://github.com/thejoshwolfe/yauzl/blob/master/README.md). Bản đầu chỉ dùng text, không dựng HTML từ CV.
