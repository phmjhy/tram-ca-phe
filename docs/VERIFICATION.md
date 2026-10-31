# Verification — Trạm Cà Phê quản lý quán

Ngày cập nhật: 28/10/2026. Nhánh `feature/cafe-management`, dựa trên code PR #1 và thay yêu cầu nghiệp vụ bằng docs/REQUIREMENTS.md. Không thao tác main/production/database production.

## MỚI NHẤT — 31/10/2026: toàn bộ luồng nghiệp vụ yêu cầu PASS trên Preview thật

Bằng chứng: [preview-cloud/business-verification-2026-10-31.json](preview-cloud/business-verification-2026-10-31.json). Bản đã test: commit e3961a617df074c35891f837544a31ddfdf15a6a, alias https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app . Hai Chrome contexts độc lập OWNER 1440x900 / STAFF 390x844; database identity SQL trước/sau đều neondb / br-bitter-butterfly-b8nl03v0.

| Luồng | Kết quả cloud | Bằng chứng |
|---|---|---|
| Đăng nhập/phân quyền hai role | PASS lại | HTTP200; OWNER 5 tab, STAFF 2 tab; 4 API quản trị trả403 cho STAFF; session cookies khác nhau |
| Lưu công thức | PASS | PATCH recipe HTTP200; SQL đúng 1 dòng, 20g/món cho món/nguyên liệu TEST đã có |
| Nhập kho | PASS | UI POST stock HTTP201; SQL đúng 1 purchase +100g, từ tồn đầu1000g thành1100g |
| STAFF ghi bán/trừ kho đúng một lần | PASS | UI rapid-click Lưu8 lần; HTTP201; SQL tổng đúng 1 đơn, qty2 × snapshot15000đ =30000đ; 1 consumption -40g; tồn1060g |
| Hai phiên tự đồng bộ đơn | PASS | OWNER thấy giao dịch STAFF trên UI bằng polling, không refresh thủ công |
| Thanh toán không trừ kho lần hai | PASS | OWNER UI POST payment HTTP200; STAFF UI tự hiện đã thanh toán; paidAt có giá trị; SQL 1 payment30000đ, consumption vẫn1 và tồn1060g |
| Dashboard/doanh thu OWNER | PASS | UI mở Dashboard, API sales30000/received30000/unpaid0 |
| STAFF đăng ký ca/check-in/out | PASS | UI POST shift201; attendance in/out200; SQL đúng1 ca, checked_out_at>checked_in_at |
| OWNER xem ca/thống kê | PASS | UI Nhân viên hiển thị ca; API có check-in/out; Dashboard staff có thống kê ca |
| Reload | PASS | STAFF reload vẫn có session và navigation |
| Đối chiếu ledger cuối | PASS read-only | stock1060 = sum(stock_movements)1060; opening1/purchase1/consumption1; migration vẫn3 |
| Protection token cleanup | PASS | Official Automation Bypass tạm thu hồi bằng API; protectionBypass map không còn token đã tạo |

**Phân biệt timeout:** lần cũ dừng ở selector nguyên liệu, chưa gửi PATCH và SQL recipes rỗng. Sửa riêng automation: scope theo parent của heading Công thức, dùng select/input trong section; lần thực thi thật sau sửa nhận PATCH200 và SQL xác minh một dòng. Không có bằng chứng lỗi API lưu công thức; không sửa source ứng dụng, migration hoặc tài khoản. Không tạo thêm món/nguyên liệu; dùng lại dữ liệu cũ, chỉ thêm đúng một purchase/order/payment/shift TEST theo luồng được yêu cầu. Hai món TEST cũ vẫn được giữ, không xóa dữ liệu.

Protection access dùng header x-vercel-protection-bypass giới hạn đúng origin Preview, không dùng token trên URL, không in token/credentials. Bypass tạm đã thu hồi; không tắt bảo vệ Production. Không chạy migration/seed DEMO, không dùng dữ liệu thật, không merge PR hoặc deploy Production. Không diễn giải một bài test này thành chứng nhận chịu tải, offline hoặc bàn phím điện thoại thật. Các kết quả BLOCKED bên dưới là lịch sử, đã được thay thế cho các luồng trong bảng này.

## MỚI NHẤT — 31/10/2026: OWNER/STAFF cloud login PASS, nghiệp vụ chưa hoàn tất

Bằng chứng: [preview-cloud/auth-verification-2026-10-31.json](preview-cloud/auth-verification-2026-10-31.json). Đã chạy thực tế Chrome/Playwright trên alias Preview, không dùng local server/mock.

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Private input | PASS | Email/mật khẩu riêng, mật khẩu 12–128 ký tự, role owner/staff; không log giá trị |
| Identity trước ghi | PASS | neondb / br-bitter-butterfly-b8nl03v0; direct connection; guard trên từng Pool connection |
| Tạo OWNER/STAFF | PASS | scripts/create-user.mjs hiện có, lần lượt báo Account provisioned; mỗi user JOIN user_access đúng role |
| OWNER cloud login/session | PASS | HTTP200 sign-in và /me, role owner, navigation đúng Bán hàng/Dashboard/Kho & Menu/Chi phí/Nhân viên |
| STAFF cloud login/session | PASS | HTTP200 sign-in và /me, role staff, navigation đúng Bán hàng/Ca làm |
| Hai phiên độc lập | PASS | Hai browser contexts 1440x900 và 390x844; session cookie tồn tại và khác nhau; không ghi cookie ra artifact |
| STAFF API quản trị | PASS | inventory/dashboard/expenses/reports/daily đều HTTP403 |
| OWNER tạo nguyên liệu/món TEST bằng UI | PASS phạm vi tạo | Nguyên liệu đã xuất hiện inventory; POST products HTTP201; dữ liệu TEST còn trên Preview |
| Công thức UI | BLOCKED automation | Timeout chọn nguyên liệu trong selector của script kiểm thử; chưa kết luận bug source, chưa có xác nhận lưu công thức |
| Trừ kho đúng một lần/thanh toán/dashboard/ca làm | Chưa kiểm chứng cloud | Không đánh dấu PASS từ local tests hoặc từ login |
| Lần retry browser cuối | BLOCKED Vercel Protection | Chưa vào app login; không phủ nhận lần login thành công đã ghi nhận trước |

Wrapper operator tạm ban đầu không hỗ trợ callback của Pool.query nên chờ; đã dừng và xác minh read-only chưa có user trước retry, sửa riêng wrapper ngoài repo rồi provisioning thành công. Không sửa script hiện có hoặc source ứng dụng. Public signup vẫn tắt theo server/auth.js. Dùng temporary access link do connector cấp để vượt lớp Vercel Authentication trong lần login PASS, không tắt Deployment Protection, không chia sẻ link/secret. Không đọc/decrypt secret Vercel; login PASS xác nhận runtime hoạt động, không phải chứng minh hai secret bằng nhau từng byte.

Không chạy lại migration, không seed DEMO, không dùng dữ liệu thật, không merge PR #2 hoặc thay Production. Tài khoản đã có: **không chạy lại create-user khi tiếp tục**; đọc trạng thái trước retry. Bước tiếp theo cho luồng nghiệp vụ là làm mới quyền truy cập Preview tạm và sửa selector test công thức, tiếp tục với nguyên liệu/món TEST hiện có. Các mục dưới là lịch sử.

## MỚI NHẤT — 30/10/2026: kiểm tra lại sau thông báo đổi password

Đọc lại trực tiếp cả hai file bằng node:util.parseEnv. Email khác nhau, cả hai password có giá trị và đúng độ dài, role đúng; nhưng boolean distinctPassword vẫn false. Provisioning wrapper đã dừng ở local validation trước kết nối database. Không tạo user/role hoặc thử login, không migration/seed/Production. Cần lưu thay đổi vào đúng .env.preview-owner.local hoặc .env.preview-staff.local trong workspace; chưa yêu cầu thêm secret hay database. Không ghi bất kỳ giá trị password/email nào vào báo cáo.

## MỚI NHẤT — 30/10/2026: input đủ trường nhưng trùng mật khẩu, provisioning BLOCKED

Kiểm tra lại hai file private: mode 600, regular/non-symlink, đủ email/password/name/role; email hợp lệ và khác nhau; role owner/staff đúng; cả hai password đạt 12–128 ký tự. Tuy nhiên hai password bằng nhau (so sánh boolean trong bộ nhớ, không log giá trị), trái yêu cầu mỗi tài khoản mật khẩu riêng.

Wrapper provisioning gọi script hiện có được chuẩn bị ngoài repo, nhưng local guard đã chặn trước mọi kết nối/ghi dữ liệu do mật khẩu trùng. Không tạo tài khoản hoặc role, không chạy migration/seed, không thử website login bằng tài khoản chưa tồn tại. Cloud login hai phiên và authorization vẫn BLOCKED, không PASS. Chủ quán cần đổi mật khẩu một tài khoản trực tiếp trong file private để hai mật khẩu khác nhau; không gửi giá trị qua chat. Production và PR #2 không thay đổi. Các mục dưới là lịch sử.

## MỚI NHẤT — 30/10/2026: redeploy Preview READY, provisioning BLOCKED bởi private input

| Bước | Kết quả | Bằng chứng |
|---|---|---|
| Private file security | PASS | Cả 3 file mode 600, gitignored; không in giá trị |
| Server local config | PASS validation | Đủ 4 biến, secret >=32 ký tự, APP_ENV preview, APP_ORIGIN alias nhánh, Neon direct/neondb |
| Secret đồng nhất | Chủ quán xác nhận, chưa kiểm chứng runtime | Không đọc/decrypt secret Vercel; cần authenticated login để kiểm tra tiếp |
| OWNER input | FAIL validation | Đủ trường nhưng mật khẩu ngoài khoảng 12–128 ký tự; chưa tạo user |
| STAFF input | BLOCKED | POS_USER_EMAIL/PASSWORD/NAME còn trống; role staff có sẵn |
| Redeploy Preview | PASS | dpl_DarMh6HVbK1jxUMoYtiyPX1gXGgH; READY; target=null; commit e3961a617df074c35891f837544a31ddfdf15a6a |
| Alias | PASS | deployment.alias chứa tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app |
| SQL identity | PASS read-only | neondb / br-bitter-butterfly-b8nl03v0 / transaction_read_only on; ROLLBACK |
| Existing schema/data | PASS | 3 schema_migrations; 19 bảng ứng dụng/auth đều 0 hàng, không có tài khoản; không chạy migration lại |
| Cloud GET /api/v1/version | PASS | HTTP200, configured=true, build e3961a6 |
| Cloud GET /api/v1/me anonymous | PASS | HTTP401, thay cho lỗi backend503 trước đây; không chứng minh login hoặc secret equality |
| Tạo OWNER/STAFF / xác minh role | BLOCKED, chưa chạy | Chờ sửa input private theo yêu cầu gửi chủ quán |
| Website login hai phiên / quyền / nghiệp vụ | BLOCKED, chưa chạy | Không gọi endpoint401 là login PASS |

Preview immutable: https://tram-ca-h1f5ddbzi-tramsac.vercel.app . URL đăng nhập mục tiêu: https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app . Không seed, tạo account, chạy migration, merge PR hoặc thay Production. Chủ quán cần sửa mật khẩu OWNER và điền đủ 3 trường STAFF trực tiếp trong file private, không gửi chat. Các mục dưới là lịch sử.

## MỚI NHẤT — 30/10/2026: chuẩn bị tài khoản cloud, BLOCKED chờ private input

- Nhánh feature/cafe-management. Không chạy lại migration hoặc ghi dữ liệu cloud.
- BETTER_AUTH_SECRET local đạt tối thiểu 32 ký tự. Không cố đọc/decrypt secret Vercel; chưa có bằng chứng hai giá trị đồng nhất.
- Đã đọc scripts/create-user.mjs và server/auth.js: role owner/staff, mật khẩu 12–128 ký tự, runtime public signup bị tắt; provisioning chỉ qua script riêng. Script không nguyên tử giữa signup và cấp role nên phải kiểm tra dữ liệu trước mọi retry khi lỗi.
- Hai file .env.preview-owner.local và .env.preview-staff.local chưa tồn tại lúc kiểm tra. Đã tạo template private mode 600, các trường thông tin tài khoản để trống, chỉ role lần lượt owner/staff. Không tạo tài khoản mặc định.
- Cần chủ quán nhập email, password, name TEST riêng cho từng file, và đồng nhất secret ở local + Vercel Preview nhánh này. Không gửi giá trị qua chat.
- BLOCKED: redeploy với secret đồng nhất, provisioning, kiểm tra role, cloud login/nghiệp vụ/API authorization/two-session sync. Chưa đánh dấu PASS các kiểm thử chưa chạy.
- URL mục tiêu: https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app . Các kết quả migration đã PASS bên dưới được giữ nguyên; không tạo lại database.

## MỚI NHẤT — 29/10/2026: Migration Preview 000–002 PASS

Thực hiện theo phê duyệt rõ ràng của chủ quán: bỏ điều kiện đối chiếu auth secret cho riêng bước SQL; chưa xác nhận secret local khớp Vercel, giữ kiểm tra đó cho bước xác thực sau.

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Local guard | PASS | File mode 600, regular/non-symlink, APP_ENV=preview, Neon direct không -pooler, neondb, TLS |
| Identity ngay trước migration | PASS | Trên chính connection cấp cho runner: BEGIN READ ONLY; neondb / br-bitter-butterfly-b8nl03v0 / transaction_read_only=on; ROLLBACK trước gọi logic migration |
| Runner có sẵn | PASS | Gọi scripts/migrate.mjs qua wrapper tạm ngoài repo bổ sung identity guard cho Pool.connect; không chỉnh sửa runner/migration SQL hoặc bỏ guard hiện có |
| Migration | PASS | Runner báo Migration complete; transaction/advisory lock/checksum của server/migrate.js được giữ nguyên |
| schema_migrations | PASS | Đúng 3 bản ghi: 000_auth.sql, 001_pos.sql, 002_management.sql; SHA256 cả 3 khớp file nguồn |
| Schema sau migration | PASS | Đủ 19 bảng từ migration và schema_migrations (20 public base tables); không thiếu bảng |
| Dữ liệu sau migration | PASS | Cả 19 bảng từ migration đều count=0; không seed, không tạo tài khoản |
| Production / PR | Không thao tác | Chỉ connection có branch identity đúng mới được cấp cho runner; không merge PR #2 |

Xác minh sau migration dùng connection được guard lại cùng branch/database, transaction READ ONLY, kết thúc ROLLBACK. Các bảng: user, session, account, verification, rateLimit, user_access, products, orders, order_items, payments, idempotency, audit_logs, legacy_archives, ingredients, recipes, stock_movements, cancellations, shifts, expenses. Không đọc/in secret hoặc connection string. Chưa tạo OWNER/STAFF; chưa tuyên bố login hoặc đồng bộ cloud PASS. Các mục dưới là lịch sử.

## MỚI NHẤT — 29/10/2026: direct Preview preflight PASS, secret equality BLOCKED

Kiểm tra lại sau khi chủ quán cập nhật cả file local và Vercel. Không xuất giá trị secret.

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Nhánh làm việc | PASS | feature/cafe-management; không thao tác main |
| Bốn biến bắt buộc | PASS | Tất cả có giá trị; APP_ENV=preview, APP_ORIGIN khớp alias nhánh |
| File secret | PASS | Regular file, không symlink, gitignored, mode 600 |
| DATABASE_URL direct / neondb / TLS | PASS | Neon host không có -pooler, database neondb, TLS; SQL kết nối thành công |
| BETTER_AUTH_SECRET local | PASS độ dài | Đạt tối thiểu 32 ký tự của server config |
| Secret Vercel scope | PASS metadata | API trả sensitive, target preview, gitBranch feature/cafe-management; updatedAt=1793285217589 |
| Secret local khớp Vercel | BLOCKED xác minh độc lập | API không trả value, decrypted=false. Chủ quán xác nhận đã cập nhật cùng secret; không gọi xác nhận này là bằng chứng so sánh giá trị |
| SQL preflight chỉ đọc | PASS | neondb; neon.branch_id=br-bitter-butterfly-b8nl03v0; transaction_read_only=on; kết thúc ROLLBACK |
| Schema Preview trước migration | PASS | Không có public base tables; chỉ 9 bảng managed neon_auth, không đọc hàng |
| Migration 000–002 / schema sau migration | BLOCKED, chưa chạy | Người dùng yêu cầu tất cả PASS trước migration; equality secret chưa kiểm chứng |
| OWNER / STAFF | Chưa tạo | Theo yêu cầu báo kết quả trước tạo tài khoản |

Không thay Production, không merge PR #2. Không cần tạo Neon hoặc secret mới. Để tiếp tục mà không đọc lại secret từ Vercel: chủ quán có thể cho phép migration dựa trên SQL identity đã PASS và xác nhận đã đặt cùng secret; kiểm chứng secret ở runtime sẽ được thực hiện sau khi schema có sẵn. Đây là thay đổi điều kiện xác minh, không phải kết luận equality đã PASS. Các mục dưới là lịch sử.

## MỚI NHẤT — 29/10/2026: file đã có cấu hình, SQL Preview chỉ đọc PASS

Kiểm tra trực tiếp trên nhánh `feature/cafe-management`; không in connection string hoặc secret.

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Bốn biến DATABASE_URL/BETTER_AUTH_SECRET/APP_ORIGIN/APP_ENV | PASS có giá trị | Parse file riêng, chỉ xuất boolean |
| File an toàn | PASS | Regular file, không symlink, gitignored, mode 600 |
| APP_ENV / APP_ORIGIN | PASS | preview / alias HTTPS của feature/cafe-management |
| Database neondb / Neon / TLS | PASS | Kiểm tra URL và kết nối SQL thành công |
| Direct connection | FAIL | Host hiện dùng pooled connection; không tự sửa hostname hoặc file secret |
| BETTER_AUTH_SECRET hợp lệ | FAIL | Chưa đạt tối thiểu 32 ký tự của server/config.js; không xuất giá trị/độ dài thực tế |
| Secret khớp Vercel Preview | BLOCKED | Chưa đối chiếu được; không tuyên bố khớp từ metadata |
| SQL identity chỉ đọc | PASS | current_database=neondb; neon.branch_id=br-bitter-butterfly-b8nl03v0; transaction_read_only=on |
| Inventory schema | PASS | Không có public base tables; có 9 bảng neon_auth. Chỉ đọc tên bảng, không đọc hàng auth/khách |
| Migration 000–002 | BLOCKED, chưa chạy | Cần direct URL và secret hợp lệ; không có DDL/DML/cloud user creation |

Preflight thực hiện bằng pg client, BEGIN READ ONLY, timeout truy vấn 12s, kiểm tra branch ID chính xác trước đọc inventory, kết thúc ROLLBACK. Lần sandbox bị ENOTFOUND; chạy lại với quyền network được cấp đã PASS. Không kết nối Production. Không có bảng public chưa đồng nghĩa neon_auth không có dữ liệu; không đếm/đọc hàng ở schema managed này.

Chủ quán cần lấy connection string **Direct / Connection pooling OFF** từ đúng branch Preview hiện có, database neondb. Nhập BETTER_AUTH_SECRET tối thiểu 32 ký tự, cùng giá trị với cấu hình Vercel Preview; nếu thay secret thì chỉ cập nhật phạm vi Preview của feature/cafe-management, không Production. Nhập riêng bằng editor/secret manager, không gửi chat. Sau cập nhật phải kiểm tra lại branch qua SQL trước migration. Các mục dưới là lịch sử.

## MỚI NHẤT — 29/10/2026: kiểm tra file operator trên Mac

Kiểm tra trực tiếp `.env.preview.local` trên nhánh `feature/cafe-management`, không đọc giá trị ra log.

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| File tồn tại, regular file, không symlink, thuộc user hiện tại | PASS | Kiểm tra filesystem |
| Gitignore / không tracked | PASS | `git check-ignore` khớp; `git ls-files` không có file |
| Quyền truy cập | PASS sau sửa | Đổi từ 644 sang 600 và kiểm tra lại |
| Đủ bốn biến bắt buộc | BLOCKED | File rỗng, 0 byte, parser tìm thấy 0 biến; thiếu DATABASE_URL, BETTER_AUTH_SECRET, APP_ORIGIN, APP_ENV |
| Direct connection / neondb / branch Preview | BLOCKED | Chưa có connection string để kiểm tra; không suy ra branch từ tên file |
| Secret khớp Vercel Preview | BLOCKED | Không có secret local để đối chiếu |
| SQL preflight chỉ đọc | BLOCKED, chưa chạy | Thiếu cấu hình kết nối |
| Migration 000–002 | BLOCKED, chưa chạy | Chưa xác minh database bằng SQL; không mutation database |

Chủ quán cần nhập riêng bốn biến vào file này bằng editor/secret manager. DATABASE_URL lấy direct connection của branch `br-bitter-butterfly-b8nl03v0`, database `neondb`; BETTER_AUTH_SECRET phải dùng cùng giá trị Preview hiện có; APP_ORIGIN dùng URL alias nhánh và APP_ENV=preview. Không gửi secret qua chat. Không tạo thêm Neon, không merge PR, không thay Production. Các kết quả cloud trước đây bên dưới là lịch sử, không thay thế kiểm tra file lần này.

## MỚI NHẤT — 29/10/2026: Console đã mở, branch Preview riêng được xác minh

Nguồn: đọc lại Vercel metadata và Neon Console thật; [preview-cloud/latest-status.json](preview-cloud/latest-status.json). Không dùng kết luận envs=[] hoặc thiếu database của vòng trước.

| Kiểm tra | Trạng thái mới nhất | Bằng chứng |
|---|---|---|
| Neon hiện có | PASS | neon-aero-clock / mute-thunder-42120324; không tạo project/database khác |
| Console access | PASS | Email verification đã hoàn tất; vào được organization Vercel: Tramsac/project hiện có |
| Branch Production | PASS identity | main, br-old-haze-b8fmcrjs; Console ghi Production branch, backs Vercel Production |
| Branch Preview | PASS identity/cách ly branch | preview/feature/cafe-management, br-bitter-butterfly-b8nl03v0; parent main, created by Vercel; Console ghi Preview deployment của tram-ca-phe/Git branch feature/cafe-management/commit27afa58 |
| DATABASE_URL scope | PASS metadata; cần runtime đối chiếu | Shared Preview+Production ở cấp project; Neon có Preview deployment action. Không đổi shared env/Production hoặc kết luận chung DB chỉ từ metadata |
| BETTER_AUTH_SECRET/APP_ORIGIN/APP_ENV scope | PASS metadata | Riêng Preview + feature/cafe-management; Secret values không được trả lại qua API |
| Preview branch rỗng | BLOCKED, chưa xác minh đủ | Đã chọn đúng branch/neondb và gửi SELECT chỉ đọc; automation timeout, chưa lấy được kết quả. Không lấy public-schema-empty của main làm kết quả Preview |
| Runtime endpoint của bản Preview mới | BLOCKED đối chiếu SQL | Cần so branch_id từ connection operator và chứng minh app dùng đúng endpoint; nhãn branch trong Console liên kết deploymentFCqzto… cùng Git branch/commit |
| Redeploy Preview | PASS | dpl_7tY2fTVH82Nat7VXPsAHFLYHRCPf, target=null, READY; https://tram-ca-ahcfnf3ry-tramsac.vercel.app |
| /api/v1/version | PASS |200, commit27afa58, configured=true |
| /api/v1/me | FAIL backend readiness |503 BACKEND_UNAVAILABLE; log SCHEMA_MISMATCH, chưa có schema migration ứng dụng |
| Operator config local | BLOCKED | .env.preview.local và hai file user chưa tồn tại; không có DB URL trong process |
| Migration000–002, OWNER/STAFF, login/nghiệp vụ/two-session sync cloud | BLOCKED, chưa chạy | Cần direct credential Preview riêng và SQL preflight trước mọi mutation |

Không còn chặn bởi kích hoạt email. Thao tác chủ quán cần hiện tại là cấp **một file .env.preview.local riêng** theo PREVIEW_SETUP.md, với DATABASE_URL direct lấy đúng branch br-bitter-butterfly-b8nl03v0 và secret/origin/APP_ENV Preview. Không gửi các giá trị qua chat; không tạo lại DB. Sau đó agent sẽ kiểm tra read-only branch_id/schema/counts trước migration và tạo mật khẩu TEST ngẫu nhiên bằng script hiện có, không hardcode.

Gói migration nguyên tử được chuẩn bị ngoài repo (/private/tmp), giữ nguyên SQL000–002 và SHA256, guard branch_id chính xác + database neondb + public schema rỗng; chưa gửi mutation lên Neon. Local kiểm tra riêng đã PASS: áp dụng3 migration, từ chối chạy lại/public không rỗng và từ chối branch Production; không tính là migration cloud PASS. Browser automation lỗi/timeout không được ghi thành SQL PASS.

## Lịch sử vòng 28/10/2026 — Neon đã kết nối

Nguồn bằng chứng mới: [preview-cloud/latest-status.json](preview-cloud/latest-status.json). Các phần envs=[]/CONFIGURATION_REQUIRED bên dưới là **lịch sử trước khi chủ quán kết nối Neon**, không còn mô tả hiện tại.

| Kiểm tra mới | Kết quả | Bằng chứng |
|---|---|---|
| PR #2 / nhánh | PASS | Draft, chưa merge; feature/cafe-management, head27afa58 trước tài liệu vòng này |
| Neon resource thực | PASS | neon-aero-clock; project mute-thunder-42120324; store_fekuWjduCabPmDL7, available |
| DATABASE_URL | PASS đã có; cách ly chưa xác nhận | env sensitivity metadata cấp chung Preview+Production, không có override DB nhánh |
| BETTER_AUTH_SECRET, APP_ORIGIN, APP_ENV | PASS phạm vi | Chỉ Preview + feature/cafe-management; sensitive, API không trả value (decrypted=false) |
| Giá trị secret/origin/APP_ENV | PARTIAL/BLOCKED | Runtime đi qua config validation ở probe /me; không in secret; chưa đọc được giá trị để xác nhận origin bằng alias và APP_ENV=preview |
| Preview Branching | PASS metadata, BLOCKED branch identity | Resource có deployment action Neon cho Preview. Project env không phản ánh override webhook theo từng deployment; không được kết luận dùng chung DB chỉ từ scope |
| Read-only SQL resource mặc định | PASS | neondb / neondb_owner / br-old-haze-b8fmcrjs; không public base tables, có9 neon_auth tables. Không đọc hàng khách |
| DB Preview rỗng và độc lập Production | BLOCKED | Chưa đối chiếu branch/endpoint của deployment với branch Production; branch mặc định rỗng nghiệp vụ không chứng minh cách ly |
| Redeploy đúng Preview | PASS | dpl_7tY2fTVH82Nat7VXPsAHFLYHRCPf, target=null, READY; https://tram-ca-ahcfnf3ry-tramsac.vercel.app |
| Version probe bản Preview đúng target | PASS |200, build27afa58f458246b6078a0ee9a990d6cfab2910fc, configured=true |
| /me trên Preview đúng target | FAIL backend readiness |503 BACKEND_UNAVAILABLE; request020c2617-9f60-4563-9945-30f941d3d8fa; runtime code SCHEMA_MISMATCH. Chưa có migration ứng dụng |
| Neon Console qua Open in Neon SSO | BLOCKED | Trang Email Verification yêu cầu chủ quán kích hoạt email trước khi xem Console/branch |
| Migration000–002, user OWNER/STAFF, test nghiệp vụ/two-session cloud | BLOCKED, chưa chạy | Không mutation DB cho tới khi branch Preview an toàn được xác nhận và có operator access |

**Không yêu cầu tạo lại database.** Dùng resource Neon đã có. Bước chủ quán cần ngay: hoàn tất link kích hoạt email Neon trong tab Email Verification; không gửi link/secret qua chat. Sau đó mới đối chiếu branch Preview, branch Production, endpoint và kiểm tra schema/counts trước migration. Nếu vẫn cần credential operator, cấp riêng qua file .env.preview*.local/secret manager, không paste vào chat.

Lỗi thao tác redeploy được ghi rõ: API không nhận target=preview; lần dùng staging gán alias phụ tram-ca-phe-tramsac.vercel.app sang staging. Đã khôi phục alias phụ về deployment production83ZuYY… và kiểm tra lại alias chính tram-ca-phe.vercel.app/main vẫn production4509d46. Bản dùng review cuối là target=null (Preview), không staging. Không có migration, tài khoản hay dữ liệu nghiệp vụ cloud được tạo; không merge main hoặc deploy production.

Chỉ tài liệu/bằng chứng được cập nhật trong vòng này; local42/42 và E2E21/21 cũ không được tính là cloud PASS.

## Môi trường và phạm vi

Node 24, React18/Vite6, Better Auth1.7.12, pg8.23.1; PostgreSQL **native 18.4** riêng do test fixture tạo và tự xóa. Không emulator, không sử dụng DATABASE_URL production. User/nguyên liệu/món/note đều DEMO/TEST. Chrome156 headless qua Playwright, timezone Asia/Ho_Chi_Minh, hai context độc lập (cookie/localStorage khác nhau).

Vercel đọc metadata, không decrypt secret: project `tram-ca-phe`, team `tramsac` chưa có environment variables (`envs=[]`, hiddenProductionEnvCount=0), integration configurations `[]`. Production vẫn commit main `4509d46`; PR #1 Draft, chưa merge. Không thể suy ra PC/điện thoại thật đang mở URL nào vì chưa có phiên thiết bị người dùng; production URL và preview PR #1 khác commit đã được xác định qua deployment metadata.

## Commands

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| `npm test` | PASS — 42/42 | 16 integration PostgreSQL + 22 legacy compatibility/domain + 4 UI/search SSR |
| `npm run build` | PASS | Vite: 30 modules; JS170.21kB, CSS13.56kB ở bản kiểm tra cuối |
| `git diff --check` | PASS | không lỗi whitespace |
| Lint / typecheck | N/A | repo JavaScript chưa có script/config riêng; không coi build là typecheck |
| Browser desktop/mobile | PASS — 21/21 | [management-evidence/results.json](management-evidence/results.json) |
| Neon/cloud end-to-end | BLOCKED | chưa có DB/auth/environment Preview |
| Bàn phím ảo iOS/Android thật | BLOCKED | viewport emulation không kiểm chứng OS keyboard |

## Integration tests có thực thi DB/API thật

| Luồng | Kết quả |
|---|---|
| Migrations000–002 chạy đúng một lần; checksum; production target bị chặn | PASS |
| Anonymous401, signup403, sai mật khẩu, Origin khác bị chặn | PASS |
| STAFF không được menu write / inventory / recipe / chi phí / dashboard / báo cáo cũ | PASS |
| Cà phê15000 ×2 =30000, note snapshot, createdAt server | PASS |
| 8 create đồng thời cùng key → 1 order, 40g tiêu hao; khác payload409 | PASS |
| Nhiều payment từ hai user → 1 payment/paidAt bất biến, không tiêu hao thêm | PASS |
| Sửa giá menu không đổi snapshot order cũ; version cũ409 | PASS |
| Từ chối client price/total/channel/shipping/cash/paidAt; qty sai; giá âm | PASS |
| Thiếu công thức/không đủ nguyên liệu → rollback order/items/payment/ledger | PASS |
| Hai phiên riêng thấy cùng menu/orders; menu STAFF không lộ cost | PASS |
| Hủy OWNER, STAFF403, 5 lần hủy khác key → hoàn đúng một lần; hủy rồi không thu | PASS |
| Nhập kho retry không trùng, điều chỉnh âm bị chặn, recipe version bảo vệ | PASS |
| Hai đơn khác key tranh nguyên liệu cuối → một201, một409; không âm | PASS |
| Đăng ký ca/trùng lịch/check-in/out/giờ thực tế; STAFF chỉ ca mình | PASS |
| OWNER sửa giờ cần lý do/version/audit; STAFF403; ca sửa8 giờ đúng | PASS |
| Dashboard sales=paid+unpaid, bỏ hủy, COGS/chi phí tách tiền nhập nguyên liệu | PASS |
| Ngày bán hôm trước, ngày thu hôm nay được tách; expense date không đổi múi giờ | PASS |
| Ledger tổng biến động = stock cache, tên/minimum edit version/role kiểm tra | PASS |
| Chứng từ/ledger bất biến, khóa user mất quyền, seed từ chối DB có nghiệp vụ | PASS |

## Browser tests

Runner: `node e2e/management.mjs --playwright=/private/tmp/tram-pos-browser/node_modules/playwright/index.mjs`. Các case cụ thể và timestamp/resource ID TEST nằm trong results.json, không chứa token/password/DB URL.

Mỗi cặp PC1440×900 + mobile390×844 hoặc320×640 kiểm tra: login riêng và navigation chính xác theo role; tìm cafe/Enter/qty2/rapid-save; mobile tạo PC tự thấy; PC thu mobile tự thấy paidAt, stock không đổi; PC sửa giá mobile tự cập nhật ≤12s không refresh, snapshot cũ giữ nguyên; STAFF API403; +/-/xóa/note/paid khi tạo; mất phản hồi **sau commit**, reload rồi retry không trùng; offline khóa lưu/online hồi phục; đăng ký/check-in/out; giữ raw localStorage khác nhau; toàn bộ màn hình OWNER/STAFF không overflow ngang/nút ra ngoài viewport. Kiểm tra không JavaScript pageerror hoặc HTTP5xx.

Bằng chứng xem nhanh:

- [Mobile320 bán hàng](management-evidence/mobile-320-sales.png), [Mobile390 bán hàng](management-evidence/mobile-390-sales.png).
- [Desktop bán hàng](management-evidence/desktop-390-sales.png), [Desktop Dashboard](management-evidence/desktop-390-dashboard.png).
- [Kho & Menu320](management-evidence/owner-320-inventory.png), [Chi phí320](management-evidence/owner-320-expenses.png), [Nhân viên320](management-evidence/owner-320-staff.png), [Ca làm320](management-evidence/mobile-320-shifts.png).

Đây là bằng chứng hai phiên browser độc lập trên **backend/database local riêng**. Không phải bằng chứng Neon hay hai thiết bị vật lý ngoài mạng. Tình huống cố ý401/403 và network abort được test riêng; không coi là lỗi runtime. Console chưa có bộ phân loại toàn bộ thông báo ngoài pageerror/HTTP5xx, không khẳng định đã audit mọi console warning.

## Bugs phát hiện và đã sửa

- High: nguy cơ lưu lại sau server commit nhưng mất phản hồi/reload — body/key pending giữ sessionStorage theo user, retry cùng key; browser đã mô phỏng.
- Medium: thiếu import CSS ở entry mới — khôi phục, build có CSS, screenshot kiểm tra.
- High: Preview thực trả404 cho /api/v1/* vì file catch-all được định tuyến tĩnh — thêm rewrite Vercel tới Function. Endpoint cấu hình phải trả JSON503 khi chưa có DB, không404.
- Medium: nhãn select lồng options không match chính xác accessible label — thêm aria-label.
- High: endpoint expense lỗi truy vấn vì tên cột ngày bị lặp sau định dạng ngày — chọn cột tường minh; bổ sung integration test danh sách và ngày chi phí.
- Test script: chờ chữ “Đã thanh toán” từng match nút của đơn chưa thu — đổi sang dòng trạng thái; không tính kết quả lần chạy lỗi là PASS.

## Còn mở / cổng nghiệm thu

| Mức | Việc còn mở | Trạng thái |
|---|---|---|
| High | Neon Preview + secret/auth riêng; migration thử trên cloud; provision tài khoản thử | BLOCKED cấu hình |
| High | Hai thiết bị trên Preview thật, latency/network ngoài localhost | BLOCKED phụ thuộc cloud |
| High | Backup/restore drill, production owner bootstrap/recovery, cutover dữ liệu owner duyệt | Chưa thực hiện |
| Medium | Import Excel/legacy (chưa có file và xác nhận đơn vị/công thức) | Chưa thực hiện, không tự nhập |
| Medium | Pagination UI lịch sử >100 đơn, ledger >200 dòng | Chưa triển khai |
| Medium | Hủy đã thu cần đối soát hoàn tiền thủ công; app không giả lập đã hoàn | Hiển thị rõ, cần quy trình owner |
| Low | iOS/Android thực, bàn phím ảo, audit accessibility chuyên sâu | Chưa kiểm chứng |

Đủ để review code và demo **cục bộ với dữ liệu TEST** khi kết quả cuối PASS. Chưa đủ để đưa quán vào vận hành thật hoặc merge/production release không kiểm tra cloud. Kết quả PR #1 cũ lưu riêng ở docs/PR1_VERIFICATION.md; không áp dụng giao diện/kênh cũ cho phiên bản này.

## Preview review

PR: https://github.com/phmjhy/tram-ca-phe/pull/2 (Draft). Vercel Preview alias: https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app . Deployment đầu f6dabc4 build READY, static HTML200, nhưng API version/me404 do thiếu rewrite; bản sửa routing nằm cùng PR. Trạng thái route sau sửa được ghi ở PR review. Không có cloud DB/auth; không đánh dấu cloud đồng bộ PASS.

## PR #2 — vòng mở khóa Neon Preview (28/10/2026)

Phạm vi: cấu hình/test hiện có, không thêm tính năng. Hướng dẫn thao tác chủ quán và operator: [PREVIEW_SETUP.md](PREVIEW_SETUP.md).

| Kiểm tra thực tế vòng này | Kết quả | Bằng chứng |
|---|---|---|
| Nhánh feature/cafe-management, working tree trước tài liệu | PASS | git status sạch; không main |
| Biến bắt buộc theo source | PASS | server/config.js: DATABASE_URL, BETTER_AUTH_SECRET>=32, APP_ORIGIN hoặc VERCEL_URL; scripts cần APP_ENV=preview |
| Vercel branch env metadata, decrypt=false | BLOCKED cấu hình | envs=[]; hiddenProductionEnvCount=0 |
| Integration configurations team tramsac | BLOCKED kết nối | [] (không kết luận về Neon ngoài tài khoản/kết nối này) |
| Cấu hình operator local | BLOCKED | không .env.local/.env.preview.local; các key DB/auth không có trong process; chưa có Vercel CLI |
| GET alias /api/v1/version | PASS routing | 200, build a06ccb8ce8f3e054ecb5e407fc384ca10f38a057, configured=false |
| GET alias /api/v1/me | BLOCKED | 503 CONFIGURATION_REQUIRED, JSON ứng dụng; không còn404 |
| SQL preflight DB Preview / migration000–002 | BLOCKED, chưa chạy | chưa có DB identity/quyền/credential Preview |
| Provision OWNER + STAFF qua script hiện có | BLOCKED, chưa chạy | không password hardcode, chưa có private env |
| Cloud login và role403, món/recipe/trừ kho/thanh toán/nhập hàng/dashboard | BLOCKED, chưa chạy | phụ thuộc DB/auth/user thử |
| Cloud đăng ký ca/check-in/out | BLOCKED, chưa chạy | phụ thuộc DB/auth/user thử |
| Hai phiên độc lập cùng alias, tự đồng bộ | BLOCKED, chưa chạy | local E2E cũ không tính thành cloud PASS |

Không phát hiện bug nghiệp vụ mới từ vòng kiểm tra này vì backend vẫn chưa qua bước cấu hình. Nguồn có rủi ro thao tác cần tránh: nếu để fallback VERCEL_URL nhưng test ở alias nhánh, Origin sẽ khác; đã hướng dẫn đặt APP_ORIGIN đúng alias cố định, không mở wildcard hoặc sửa tính năng auth.

Các số42 unit/integration và21 E2E ở phần trên là lần chạy **local trước**, không chạy lại và không đổi thành kết quả cloud trong vòng này. Chỉ cập nhật tài liệu; không cần chạy lại tests/build ứng dụng khi không có thay đổi code.
