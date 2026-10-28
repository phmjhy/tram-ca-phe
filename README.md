# Trạm Cà Phê

Một web React + Vite cho quán nhỏ, OWNER/STAFF, PostgreSQL chung qua API Vercel. Yêu cầu hiện hành: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). Không chọn kênh bán, bàn/bếp/mã giao dịch/phương thức thu tiền trên UI.

STAFF: Bán hàng, Ca làm. OWNER: Bán hàng, Dashboard, Kho & Menu, Chi phí, Nhân viên. Không fallback sang localStorage khi backend lỗi. Khóa cũ vẫn được giữ nguyên trên thiết bị; không tự import vào DB.

## Chạy và kiểm tra

Node 24, dependency theo lockfile:

```sh
npm ci
npm test
npm run build
```

Test tạo PostgreSQL native tạm qua `embedded-postgres`, không mock/emulator, không dùng DATABASE_URL có sẵn. Cần quyền initdb/postgres và cổng loopback. Cluster tự dừng/xóa sau test. Không tạo user hệ điều hành. Repo chưa có lint/typecheck riêng (JavaScript).

## Backend thử nghiệm

1. Chuẩn bị PostgreSQL/Neon thử nghiệm riêng. Không dùng dữ liệu khách hoặc database production.
2. Tạo `.env.local` theo `.env.example`; điền secret trực tiếp tại nơi quản lý secret: DATABASE_URL, BETTER_AUTH_SECRET >=32 ký tự, APP_ORIGIN chính xác, APP_ENV=development/preview. Không đặt tiền tố VITE_; không đưa giá trị vào chat/log/Git.
3. `npm run db:migrate`: checksum/advisory lock/transaction; chặn môi trường production. Không tự migrate trong build/request.
4. Cấp user bằng `npm run user:create`, qua biến riêng POS_USER_EMAIL, POS_USER_PASSWORD >=12 ký tự, POS_USER_NAME, POS_USER_ROLE=owner|staff. Không tài khoản mặc định, không public signup. Script chặn production.
5. Nếu cần DEMO local, database nghiệp vụ phải rỗng: APP_ENV=test hoặc development, CONFIRM_DEMO=YES, DEMO_OWNER_EMAIL là owner thử nghiệm; `npm run db:seed:demo`. Script từ chối mọi Vercel deployment và database đã có menu/kho. Công thức/giá trong seed là dữ liệu minh họa, không dùng cho quán thật.
6. `npm run build` rồi `npm start`: UI + API tại http://127.0.0.1:4176. `npm run dev` chỉ frontend Vite.

Vercel dùng Functions `api/[...path].js` và rewrite `/api/:path*` trong `vercel.json`, driver pg qua pooled URL/TLS của Neon. Preview dùng APP_ORIGIN hoặc VERCEL_URL đúng deployment, không wildcard origin. Không có credentials ở frontend. Chưa có cloud database; UI báo lỗi cấu hình thay vì sinh dữ liệu giả. Production hiện vẫn là main cũ và không bị thay đổi.

## Kiểm thử browser

```sh
node e2e/management.mjs --playwright=/private/tmp/tram-pos-browser/node_modules/playwright/index.mjs
```

Cần Playwright và Chrome; đường dẫn có thể thay qua tham số và POS_CHROME_PATH. Runner tự tạo DB/user DEMO/HTTP riêng, hai browser context độc lập, PC 1440×900/mobile 390×844 và 320×640. Kết quả/screenshot tại docs/management-evidence. Không lưu cookie/password/DB URL vào artifact. Script e2e/verify.mjs và ảnh docs/evidence là lịch sử PR #1 localStorage, **không** chứng minh backend hiện tại.

Xem [docs/VERIFICATION.md](docs/VERIFICATION.md) để biết PASS/FAIL/BLOCKED thực tế, [BACKEND_PLAN.md](BACKEND_PLAN.md) cho schema/API/triển khai và giới hạn còn mở. Chưa đủ điều kiện vận hành production khi thiếu Neon, cloud test, dữ liệu thật được đối soát và backup/restore.
