# Thiết lập Neon riêng cho PR #2 — không đụng production

Cập nhật 28/10/2026. Chỉ cấu hình và kiểm thử phạm vi đã có; không bổ sung tính năng.

URL dùng thống nhất cho đăng nhập/test:
https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app

## 1. Trạng thái mới nhất 29/10/2026 — Neon đã kết nối

Đã xác minh lại resource neon-aero-clock, project mute-thunder-42120324, store_fekuWjduCabPmDL7. Không yêu cầu tạo database mới. DATABASE_URL hiện cấp cho cả Preview/Production. BETTER_AUTH_SECRET, APP_ORIGIN, APP_ENV hiện có riêng Preview/feature/cafe-management; sensitive values không đọc lại được qua API. Metadata tích hợp có action Neon riêng Preview; webhook có thể override DB theo deployment, nên scope chung không đủ kết luận cùng database.

Đã redeploy đúng Preview: https://tram-ca-ahcfnf3ry-tramsac.vercel.app , target=null, READY. Version200 configured=true. Probe /me của deployment đã nhận config trả503, runtime SCHEMA_MISMATCH; chưa chạy migration. Chi tiết và bằng chứng vòng mới ở [VERIFICATION.md](VERIFICATION.md) và [preview-cloud/latest-status.json](preview-cloud/latest-status.json).

Đã vào được Neon Console: Production main/br-old-haze-b8fmcrjs và Preview preview/feature/cafe-management/br-bitter-butterfly-b8nl03v0 là hai branch riêng. Preview do Vercel tạo, liên kết cùng Git branch/commit27afa58. Bước email verification đã hoàn tất. SQL SELECT trên Preview chưa thu được kết quả do automation timeout; chưa migrate hay provision cloud. Hiện cần operator file .env.preview.local như mục4, không tạo lại database.

## 2. Dùng Neon hiện có và xác nhận cách ly trước migration

1. Vercel project → Storage → neon-aero-clock → Open in Neon. Neon Console hiện đã đăng nhập được. Không còn yêu cầu xác minh email; không tạo lại database.
2. Sau đăng nhập, xem branch Production/default và branch Preview do action deployment tạo. Đối chiếu branch ID/parent/endpoint với deployment PR #2; kiểm tra branch Preview khác branch Production. Không thay Production branch/integration/environment. Không suy ra cách ly chỉ vì tên Git branch là feature/cafe-management.
3. Read-only SQL đã thực thi trong Vercel resource mặc định: neondb/neondb_owner/branch br-old-haze-b8fmcrjs, không có public base tables, có các bảng neon_auth. Đây chưa phải chứng cứ branch Preview thực tế rỗng hoặc khác Production.
4. Chọn đúng branch Preview và chạy read-only schema/counts. Nếu có dữ liệu thật hoặc branch mapping không rõ thì dừng; không migrate vào resource mặc định dùng cho Production. Chỉ sau xác nhận DB Preview an toàn mới nạp operator credentials và chạy script mục5.
5. Theo [Neon managed integration](https://neon.com/docs/guides/vercel-managed-integration), Preview branching injects override riêng deployment, không hiện trong project env settings. Không xóa biến shared hoặc ngắt resource Production chỉ để thử cách ly. Nếu automatic branch không được tạo, cần cấp branch Preview riêng **trong project hiện có**, sau khi kiểm tra parent/data; không đoán connection URL.

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

## 7. Trạng thái lịch sử trước khi kết nối Neon (đã bị thay thế bởi mục1–2)

PASS: kiểm tra branch, source/env requirements, metadata không secret, API routing version200.

BLOCKED: kết nối Neon, preflight SQL, migration cloud, tạo OWNER/STAFF, đăng nhập/phân quyền/nghiệp vụ/two-session sync trên URL Preview. Nguyên nhân là chưa có database/access/secrets, không phải đã chạy rồi thất bại. Chưa chạy mutation cloud nào. Không merge main, không deploy/migrate production.
