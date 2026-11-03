# Chạy worker trên Render, website trên Vercel

Sau khi thiết lập này hoạt động, máy cá nhân không cần chạy `npm run worker:build` và `npm run worker`. Website Vercel tạo tác vụ trong Supabase; worker trên Render nhận tác vụ và ghi kết quả vào cùng database. Website tự đọc kết quả cập nhật. Không cần tạo database mới hoặc URL công khai cho worker.

## Chi phí và cấu hình có sẵn

`render.yaml` tạo một **Background Worker** trả phí ở Singapore, gói `0.5c-512mb` (0,5 CPU, 512 MB RAM). Xem mức phí Render hiển thị trước khi bấm triển khai. File này chưa tạo dịch vụ hoặc phát sinh chi phí trên tài khoản của bạn.

Render dùng `Dockerfile.worker` sẵn có để build TypeScript và khởi động bằng `node --conditions=react-server dist/worker/main.js`. Dockerfile dùng Node 24. Không nhập thêm Build Command hoặc Docker Command. Một instance worker có hai consumer như cấu hình ứng dụng hiện tại.

## 1. Đưa cấu hình lên GitHub một lần

Trong thư mục AppLocCV:

```powershell
git add -- render.yaml docs/RENDER_WORKER.md README.md docs/OPERATIONS.md
git commit -m "Configure Render background worker"
git push origin main
```

Đây là bước cập nhật cấu hình một lần. Sau này Render tự build và khởi động lại khi commit trên `main` vượt qua các kiểm tra CI. Nếu cần triển khai lại cùng commit, dùng **Manual Deploy** trên Render.

## 2. Tạo Blueprint trên Render

1. Đăng nhập [Render Dashboard](https://dashboard.render.com/) bằng GitHub.
2. Chọn **New → Blueprint**.
3. Kết nối repository `Chuhoang2007/locCV`.
4. Chọn branch `main`, Blueprint Path `render.yaml` nếu biểu mẫu hỏi.
5. Kiểm tra danh sách có một dịch vụ `loccv-worker`, loại **Background Worker**, Docker, một instance.
6. Nhập sáu biến Render yêu cầu theo bảng dưới.
7. Kiểm tra gói và mức phí rồi bấm **Deploy Blueprint** hoặc **Apply** theo nút hiển thị trên tài khoản.

Nếu đã có worker Render cùng tên, kiểm tra dịch vụ hiện có trước khi tạo thêm để tránh chạy hai dịch vụ và trả phí hai lần.

## 3. Biến môi trường

Lấy giá trị từ cấu hình Production của ứng dụng hoặc `.env.local` đang hoạt động. URL Supabase phải trùng với website Vercel; secret key phải thuộc đúng project đó.

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase đang được website sử dụng |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key hoặc anon key của cùng project |
| `SUPABASE_SECRET_KEY` | Secret key hoặc legacy service_role key của cùng project |
| `NINE_ROUTER_BASE_URL` | URL gateway giống cấu hình website, bao gồm `/v1` nếu cấu hình hiện tại có |
| `NINE_ROUTER_API_KEY` | API key gateway đang hoạt động |
| `NINE_ROUTER_MODEL` | Model giống cấu hình trên website |

Không nhập tên biến hoặc dấu `=` vào ô Value. Không đưa secret vào `render.yaml`, GitHub hoặc ảnh chụp. Các biến `sync: false` được hỏi ở lần tạo đầu; khi cần thay đổi sau đó, vào **loccv-worker → Environment**, lưu và triển khai lại.

`DATA_RETENTION_ENABLED=false` đã có trong Blueprint, giữ chế độ chưa tự purge hồ sơ/tài khoản. Không đổi chính sách retention trong lượt thiết lập này. Worker không cần `SITE_URL`; giữ `SITE_URL` trên Vercel là tên miền production của website.

## 4. Kiểm tra và ngừng chạy worker trên máy

1. Mở **loccv-worker → Logs**. Khi tiến trình khởi động, ứng dụng ghi `WORKER_STARTED`. Dòng này xác nhận tiến trình đã khởi động, chưa xác nhận gateway AI và database đều hoạt động.
2. Nếu worker local còn chạy, bấm **Ctrl+C** trong terminal chạy `npm run worker`. Giữ terminal này dừng trong lúc kiểm thử để biết tác vụ được xử lý trên Render.
3. Mở website Vercel, tạo một bản nháp AI bằng dữ liệu giả. Worker sẽ gọi dịch vụ AI theo cấu hình, có thể sử dụng quota/token như khi chạy local.
4. Xem Logs trên Render có `TASK_SUCCEEDED`, và website chuyển từ chờ sang bản nháp có nội dung.
5. Sau khi đã xác nhận Render xử lý thành công, bạn có thể đóng terminal và tắt máy cá nhân. Worker tiếp tục chạy trên Render trong thời gian dịch vụ được duy trì hoạt động.

Nếu tác vụ cũ đã báo lỗi, dùng **Thử lại** theo trạng thái giao diện; không tạo lại nhiều tác vụ giống nhau khi một tác vụ vẫn đang chạy.

## Xử lý lỗi thường gặp

| Log hoặc hiện tượng | Kiểm tra |
|---|---|
| `WORKER_CONFIGURATION_OR_STARTUP_ERROR` | Đủ sáu biến, URL gateway HTTPS hợp lệ, key và model không trống |
| `QUEUE_UNAVAILABLE` | URL/secret Supabase cùng project, kết nối và migration database đã đủ |
| `UPSTREAM_AUTH` | Key Nine Router và quyền sử dụng gateway |
| `MODEL_UNAVAILABLE` | Model có trên gateway và khớp cấu hình website |
| Website chờ nhưng worker không nhận tác vụ | So sánh URL Supabase ở Render với Vercel; kiểm tra worker thực sự đang chạy |
| Bản cập nhật chưa tự deploy | Kiểm tra **Application checks** trên GitHub vì Blueprint đợi CI thành công |

Không chạy lại migration cũ, seed hoặc reset database để xử lý lỗi worker. Việc tải CV qua Vercel vẫn chịu giới hạn request của Vercel; triển khai worker này không thay đổi đường upload file.

## Tài liệu nhà cung cấp

- [Render Background Workers](https://render.com/docs/background-workers)
- [Render Docker](https://render.com/docs/docker)
- [Render Blueprint YAML](https://render.com/docs/blueprint-spec)
- [Giới hạn dịch vụ miễn phí](https://render.com/docs/free)
