# Thiết lập Neon riêng cho PR #2 — không đụng production

Cập nhật 28/10/2026. Chỉ cấu hình và kiểm thử phạm vi đã có; không bổ sung tính năng.

URL dùng thống nhất cho đăng nhập/test:
https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app

## 1. Kết quả kiểm tra hiện tại

- Nhánh local: feature/cafe-management, sạch trước khi cập nhật tài liệu.
- Vercel team tramsac, project tram-ca-phe; Preview a06ccb8 build READY.
- Env metadata riêng nhánh: không có biến; không decrypt giá trị.
- Integration configurations cấp team: rỗng. Không có Neon connector trong công cụ hiện tại. Điều này không chứng minh chủ quán không có Neon ở tài khoản khác; hiện chưa có kết nối được cấp cho phiên làm việc này.
- Máy làm việc: chưa có .env.local/.env.preview.local, DATABASE_URL/BETTER_AUTH_SECRET/APP_ORIGIN/APP_ENV/NEON_API_KEY/VERCEL_TOKEN không có trong process; chưa có Vercel CLI. Chỉ kiểm tra tồn tại, không đọc/in giá trị.
- GET /api/v1/version:200, build a06ccb8ce8f3e054ecb5e407fc384ca10f38a057, configured=false.
- GET /api/v1/me:503, code CONFIGURATION_REQUIRED. Đây là chặn cấu hình, không phải cloud login PASS.

## 2. Chủ quán tạo database thử riêng

1. Vào [Neon Console](https://console.neon.tech), tạo **project mới** tên ví dụ tram-ca-phe-preview. Chọn vùng phù hợp với Function hiện tại iad1 (US East) để hạn chế độ trễ thử nghiệm. Không tạo bản sao/branch có dữ liệu khách từ production.
2. Dùng database rỗng của project mới, tên mặc định neondb hoặc tên thử nghiệm rõ ràng. Branch có thể mang tên main trong project **thử nghiệm mới**; tên này không phải nhánh Git main và không làm nó thành database production. Ghi lại project/branch/database để đối chiếu trước khi chạy SQL.
3. Trong Connect chọn đúng project/branch/database/role. Giữ TLS theo connection string Neon cung cấp. Chọn pooled connection cho Vercel runtime; lấy direct connection tới **cùng database thử nghiệm** cho migration/operator. Không sửa hostname để đoán URL direct.
4. Không cần bật Neon Auth: ứng dụng đang dùng Better Auth với các bảng SQL hiện có. Không cần API giao hàng hoặc thêm dịch vụ mới.
5. Không bắt buộc cài Marketplace integration nếu đã cấp DATABASE_URL thủ công. Nếu dùng integration, kiểm tra rõ chỉ Preview của dự án này; không nối Production hoặc tự tạo branch từ dữ liệu thật.

Tài liệu chính thức: [Neon projects](https://neon.com/docs/manage/projects), [connection pooling](https://neon.com/docs/connect/connection-pooling).

## 3. Cấu hình Vercel, chỉ nhánh PR #2

Mở [Environment Variables](https://vercel.com/tramsac/tram-ca-phe/settings/environment-variables). Chọn Preview, branch override **feature/cafe-management**; bỏ Production/Development nếu không có nhu cầu khác. Không chỉnh environment production.

| Biến | Giá trị / cách cấp | Phân loại |
|---|---|---|
| DATABASE_URL | Neon pooled/TLS của DB thử vừa tạo | Secret |
| BETTER_AUTH_SECRET | Ngẫu nhiên riêng cho Preview, tối thiểu32 ký tự, lưu trong password manager | Secret |
| APP_ORIGIN | https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app | Config |
| APP_ENV | preview | Config, cần cho script operator |

Không dùng VITE_ cho secret. Không đưa POS_USER_PASSWORD hoặc tài khoản bootstrap vào deployment env: chỉ cấp riêng cho script trên máy operator. Không cần PORT trên Vercel. VERCEL_URL/VERCEL_ENV/VERCEL_GIT_COMMIT_SHA do Vercel cấp; không tự giả mạo.

**Vì sao cần APP_ORIGIN cố định:** server/config.js có fallback sang VERCEL_URL là hostname deployment bất biến. Khi mở alias nhánh, Origin không trùng sẽ làm POST bị403. Better Auth cũng chỉ tin origin chính xác. Chọn alias trên làm URL duy nhất cho mọi phiên PC/mobile, không đổi qua production hoặc URL bất biến lúc login. Không thêm wildcard vercel.app.

Sau khi lưu env, redeploy deployment **Preview** mới nhất của nhánh này, không bấm Promote/Production. Env mới không tự xuất hiện trong deployment cũ. GET /api/v1/version configured=true chỉ cho biết có DATABASE_URL/secret, **không chứng minh DB kết nối hoặc schema/auth đã chạy**.

Nguồn: [Vercel environment variables](https://vercel.com/docs/environment-variables), [branch-scoped Preview variables](https://vercel.com/kb/guide/how-to-add-vercel-environment-variables).

## 4. Cấp cấu hình private cho operator

Chỉ thiết lập secret trên Vercel chưa đủ để chạy scripts ở máy hiện tại. Preview Secrets có thể không được trả về qua env pull; không dựa vào CLI để lấy lại secret, không yêu cầu decrypt qua MCP. Chủ quán cấp trực tiếp qua password manager/file riêng trên máy này, không qua chat.

Tạo ba file sau **tại thư mục repo**, dùng editor an toàn và quyền600; .gitignore đã bỏ qua .env.* (ngoại trừ .env.example). Không commit, upload artifact, mở cat hoặc ghi chúng vào log.

`.env.preview.local`:

```dotenv
# Điền riêng, không để placeholder khi chạy. DATABASE_URL là direct cùng DB Preview.
DATABASE_URL=
BETTER_AUTH_SECRET=
APP_ORIGIN=https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app
APP_ENV=preview
```

BETTER_AUTH_SECRET phải giống secret Preview trên Vercel. Không dùng .env.local development hiện có để tránh nhập nhầm database.

`.env.preview-owner.local`:

```dotenv
POS_USER_EMAIL=
POS_USER_PASSWORD=
POS_USER_NAME=TEST Preview Owner
POS_USER_ROLE=owner
```

`.env.preview-staff.local`:

```dotenv
POS_USER_EMAIL=
POS_USER_PASSWORD=
POS_USER_NAME=TEST Preview Staff
POS_USER_ROLE=staff
```

Email phải là hai địa chỉ thử khác nhau, không thông tin khách. Mật khẩu riêng từng tài khoản, ngẫu nhiên12–128 ký tự (nên20+), nhập từ password manager, không hardcode trong source/shell arguments. Khai báo mật khẩu có ký tự đặc biệt đúng cú pháp quoted dotenv của Node.

Thông tin có thể báo qua chat: project/branch/database **thử nghiệm** nào đã được tạo, đã đặt env và file private, đã cấp quyền sử dụng database đó. Không báo mật khẩu/connection string/auth secret.

## 5. Operator preflight, migration và provision — CHƯA CHẠY

Chỉ sau khi chủ quán xác nhận cấp quyền/config và đối chiếu DB đúng project Preview. APP_ENV=preview tự nó **không chứng minh URL trỏ DB thử**, nên cần xác minh danh tính DB trước bất kỳ mutation nào.

Preflight cần kiểm tra kín:

- URL/TLS và project/branch/database theo Neon Console khớp hai connection string runtime/operator; không phải production.
- APP_ORIGIN đúng alias, APP_ENV=preview, không có VERCEL_ENV=production.
- Read-only query current_database/current_user, danh sách public tables và counts nếu có schema. DB mới phải không có dữ liệu kinh doanh. Không log URL, password hoặc email/password user.
- File secret đã gitignored, quyền600. Dừng nếu cấu hình thiếu, DB identity không rõ hoặc phát hiện dữ liệu thật.

Dùng Node24 để chạy **script hiện có**, nạp rõ file Preview thay vì npm script mặc định .env.local:

```sh
node --env-file=.env.preview.local scripts/migrate.mjs
node --env-file=.env.preview.local --env-file=.env.preview-owner.local scripts/create-user.mjs
node --env-file=.env.preview.local --env-file=.env.preview-staff.local scripts/create-user.mjs
```

Migration000_auth.sql,001_pos.sql,002_management.sql cùng transaction/checksum/advisory lock; runner chặn production. Sau migrate, xác nhận đúng3 schema_migrations và checksum. Không migrate trong build/request. Script account không có public signup/default password và kiểm tra role owner/staff. Kiểm tra hai user_access sau khi chạy. Không lặp mù script tạo user nếu response không rõ: đối chiếu DB trước, tránh account đã tạo nhưng thiếu role do lần trước lỗi.

Không chạy seed-demo.mjs ở cloud: script hiện cố ý chặn môi trường Vercel/Preview. Tạo dữ liệu TEST qua màn hình OWNER/API đã có, không import Excel/localStorage và không tự sửa guard để seed được.

## 6. Ma trận cloud bắt buộc — hiện tất cả BLOCKED

Hai browser context độc lập cùng alias, owner PC1440×900 và staff mobile390×844; lặp kiểm tra320×640. Không chia cookie/localStorage; browser có quyền Deployment Protection hợp lệ nếu Preview được bảo vệ, không tắt protection.

1. Đăng nhập cả hai, /me đúng role; logout và mật khẩu sai được xử lý. STAFF không có owner nav; gọi inventory/dashboard/expenses/menu write trả403.
2. OWNER tạo nguyên liệu TEST (g, tồn1000, minimum100, đơn giá rõ ràng); món TEST Cà phê15000, alias cafe, recipe20g/món. STAFF tự thấy qua polling, không refresh và không localStorage data.
3. STAFF nhập cafe, chọn2, ghi chú, lưu chưa thu: tổng30000, tồn960; PC tự thấy. Rapid-click/retry cùng key chỉ một order/tiêu hao. Không dùng mã hiển thị hoặc thêm kênh.
4. PC tick Đã thanh toán: paidAt server, mobile cập nhật; tồn vẫn960. Dashboard ngày bán/ngày thu đúng, sales/receipts tách rõ.
5. OWNER nhập hàng TEST100g; tồn1060, ledger purchase, không cộng vào operating expense. Mobile tiếp tục đọc menu/orders từ chung DB.
6. OWNER sửa giá; STAFF nhận giá mới tự động; order cũ giữ snapshot15000. Thiếu công thức/thiếu kho/stale version phải báo lỗi và không ghi nửa chừng.
7. STAFF đăng ký ca, check-in/out; owner thấy cùng ca, giờ đúng timestamp; sửa ca có reason/audit nếu cần. STAFF không sửa ca người khác.
8. Reload, thử mất mạng/mất phản hồi, giữ dữ liệu và retry không trùng. Không log cookie/auth header/DB secrets vào ảnh hoặc trace.
9. Đối chiếu API và DB counts/ledger/payment/audit bằng dữ liệu TEST; chỉ ghi PASS sau thực thi, không suy từ local42/42 hoặc E2E21/21 cũ. Lưu thời điểm, deployment SHA, viewport, kết quả và ảnh đã loại secrets.

Dữ liệu TEST có tiền/kho cần giữ ledger, không tự DELETE bảng để cleanup; owner đối soát/hủy bằng chức năng hiện có nếu cần.

## 7. Trạng thái hiện tại

PASS: kiểm tra branch, source/env requirements, metadata không secret, API routing version200.

BLOCKED: kết nối Neon, preflight SQL, migration cloud, tạo OWNER/STAFF, đăng nhập/phân quyền/nghiệp vụ/two-session sync trên URL Preview. Nguyên nhân là chưa có database/access/secrets, không phải đã chạy rồi thất bại. Chưa chạy mutation cloud nào. Không merge main, không deploy/migrate production.
