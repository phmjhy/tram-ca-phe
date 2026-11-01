# Chuẩn bị vận hành — 01/11/2026

Trạng thái: **READY FOR OWNER APPROVAL**, chưa đủ điều kiện mở bán Production.
Chỉ thử nghiệm backup Preview; không merge, không deploy/migrate/ghi Production.

## Trạng thái đã kiểm tra

- PR #2 Draft, nhánh `feature/cafe-management`, remote head `72846c3d036cf666ae21112b414e36d346f8c12c` trước cập nhật tài liệu này.
- Preview mới nhất READY, target=null: `dpl_4dX66WPrLrG8RveyZtUgnb3T2x8r`, commit trên. App không đổi so với bản đã kiểm thử `0b38424`.
- Production alias vẫn là `dpl_83ZuYYy6nrxbHZM5KjXzDjt3UhE9`, main `4509d460c24985ba4d6e351188e739655c34f2a5`, giao diện cũ dùng localStorage.
- Preview SQL chỉ đọc: `neondb`, `br-bitter-butterfly-b8nl03v0`, PostgreSQL18.6; 20 bảng public, gồm schema_migrations và19 bảng ứng dụng/auth. Không chạy lại000–002.
- Production branch được đối chiếu trước đây là `br-old-haze-b8fmcrjs`. **Chưa xác nhận lại SQL identity và số liệu Production trong lượt này**. Kết quả trước đây public rỗng không được dùng làm bằng chứng hiện tại.
- Neon integration hiện available, gói Free, resource `neon-aero-clock`. Các DATABASE_URL do integration quản lý có cả scope Preview/Production; điều đó không chứng minh hai scope dùng cùng branch hoặc đã cách ly. Preview identity đã xác minh; phải xác minh trực tiếp Production trước mọi thao tác ghi sau này.
- Metadata Vercel: APP_ENV, APP_ORIGIN, BETTER_AUTH_SECRET có override riêng feature Preview. Chưa thấy ba biến tương ứng dành riêng Production trong kết quả API đã đọc; cần chủ quán kiểm tra cả các biến Production ẩn trước cutover. Không đọc/decrypt secret.

## Backup, restore và PITR

Kết quả thực chạy nằm trong `preview-cloud/production-readiness-2026-11-01.json` và VERIFICATION.md. Công cụ `scripts/verify-preview-restore.mjs`:

1. Bắt buộc APP_ENV=preview, direct connection/database neondb; SQL kiểm tra branch chính xác và transaction read-only.
2. Repeatable-read/exported snapshot; pg_dump18.6 custom format schema public, no-owner/no-privileges, TLS verify-full. Snapshot dùng chung với phép đếm/checksum nguồn.
3. Dump trong thư mục private0700 ngoài Git, file0600. Có thông tin khách TEST, password hash và session nên phải coi là secret, không upload PR hoặc chat.
4. Tạo cluster PostgreSQL mới, user/mật khẩu ngẫu nhiên, chỉ bind127.0.0.1; database mới `tram_restore_test` và kiểm tra public chưa có bảng. Không dùng bất kỳ URL cloud nào làm đích restore.
5. pg_restore single-transaction/exit-on-error; giữ schema public rỗng do PostgreSQL tạo sẵn, bỏ duy nhất lệnh tạo lại schema đó trong TOC. Không dùng --clean/DROP, không sửa migration. Khôi phục mọi bảng, dữ liệu, sequence, index, function, trigger và FK của ứng dụng.
6. So sánh counts/checksum từng bảng trong snapshot; xác nhận FK được validate; đối chiếu stock với tổng ledger, tổng đơn với snapshot items, payment với đơn/paid_at, duplicate stock movement, thời gian check-in/out.
7. Dừng server với persistent=true; **giữ nguyên database, backup và cả artifact lần thất bại**. Không tự xóa.

Phạm vi public chứa user/account/session/verification/rateLimit, user_access, menu, nguyên liệu, recipes, orders/items/payments, stock_movements, cancellations, expenses, audit_logs, idempotency, legacy_archives, shifts, schema_migrations. Không backup cluster roles hoặc schema managed `neon_auth` bằng bài test này. App dùng Better Auth trong public; đây là **kiểm thử khôi phục database ứng dụng**, chưa phải chứng nhận restore toàn bộ dịch vụ Neon/Vercel hay đăng nhập sau thảm họa.

Thực thi thử nghiệm có chủ đích trên Mac đã có công cụ chính thức:

```sh
PG_TOOLS_BIN=/private/path/to/postgresql18/bin node --env-file=.env.preview.local scripts/verify-preview-restore.mjs
```

Công cụ không cần secret auth. Không dùng script cho Production. PostgreSQL tools tải từ [Postgres.app](https://postgresapp.com/downloads.html); không thêm dependency ứng dụng. `pg_dump` hỗ trợ snapshot nhất quán, nhưng không backup global roles: [PostgreSQL18](https://www.postgresql.org/docs/18/app-pgdump.html).

**PITR: BLOCKED/chưa xác minh.** API integration không trả history_retention_seconds; không có Neon API credential và chưa lấy được đúng trang Settings qua phiên Console. Gói Free không chứng minh PITR đang bật. Chủ quán mở đúng project → Settings/Instant restore, ghi nhận history window thực tế, thời điểm sớm nhất có thể restore, retention và giới hạn gói. Chỉ xem, không bấm Restore/Reset. Hướng dẫn chính thức: [Neon history window](https://github.com/neondatabase/website/blob/main/content/docs/postgres/backup-restore/history-window.md).

Bản sao `/private/tmp` chỉ phục vụ diễn tập, **không phải nơi giữ backup dài hạn**. Trước vận hành, chọn nơi backup mã hóa ngoài máy, phân quyền tối thiểu, lịch lưu và retention được duyệt. Mục tiêu đề xuất cần chủ quán duyệt: RPO≤1 ngày với dump hằng ngày; RTO≤4 giờ sau khi có người xử lý. Nếu cần RPO nhỏ hơn, phải xác minh/thiết lập PITR phù hợp và diễn tập riêng; chưa cam kết đạt RPO/RTO.

### Chủ quán làm gì khi có sự cố

1. Ngừng ghi/bán trên app; ghi đơn tạm riêng theo quy trình quán, không thử bấm lưu liên tục. Báo người phụ trách kèm thời điểm/lỗi, không gửi password hoặc URL kết nối.
2. Giữ nguyên database bị lỗi và log; xác định sự cố code, credentials hay dữ liệu. Chưa restore đè, chưa xóa branch.
3. Người phụ trách đối chiếu đúng Production branch, backup gần nhất/PITR thực tế và các giao dịch phát sinh sau mốc backup.
4. Sau phê duyệt riêng, khôi phục sang branch/database mới, chạy đối soát như diễn tập, kiểm tra auth và hai thiết bị. Database cũ vẫn giữ để truy vết.
5. Chỉ chuyển kết nối sau khi chủ quán duyệt số liệu và kế hoạch đối soát đơn sau backup. Không giả định restore mốc cũ sẽ giữ các đơn mới hơn.

## Dữ liệu thật

Xem [MENU_APPROVAL.md](MENU_APPROVAL.md). Có Sheets nguồn thật, chưa có bản dữ liệu đã duyệt. Không copy dữ liệu TEST hoặc auth Preview sang Production. localStorage trên các PC/mobile cũ có thể chứa đơn riêng; cần xuất backup riêng từ từng thiết bị, không xóa hoặc tự nhập/gộp.

## Tài khoản và bảo mật

| Nội dung | Đã có | Việc còn phải làm |
|---|---|---|
| OWNER chính thức | Chưa tạo; tài khoản hiện tại là TEST Preview | Chủ quán cung cấp email/name/password riêng qua file private0600; xác nhận người giữ quyền và người khôi phục |
| STAFF | OWNER tạo/khóa/mở/reset qua API, transaction+audit; không sửa OWNER qua API này | Lập danh sách STAFF thật riêng, duyệt quyền; không copy TEST |
| Phân quyền | Server kiểm tra active/role mỗi request; STAFF API quản trị403 | Smoke test lại trên Production sau phê duyệt |
| Session | 8 giờ, cập nhật30 phút, không cache cookie; lock/reset xóa session | Duyệt thời gian ca và quy trình đăng xuất thiết bị dùng chung |
| Cookie/origin | HTTPS Secure, HttpOnly, SameSite=Lax; origin chính xác; mutation guard | Kiểm tra HTTPS/custom domain/cookie thực tế sau triển khai |
| Đăng ký/rate limit | Public signup tắt; DB rate limit100/phút, signin10/phút; thao tác STAFF10/phút/OWNER | Kiểm tra Production, theo dõi lỗi; chưa kiểm thử tải thực tế |
| OWNER mất mật khẩu | Không có self-service/email recovery; script hiện có chặn Production | **BLOCKED** đến khi có thủ tục operator được review/diễn tập: xác minh chủ quán, hash bằng Better Auth, đổi credential+thu hồi session+audit trong transaction, không đưa password vào SQL/log |

Các biến Production thực sự cần: DATABASE_URL server-only, BETTER_AUTH_SECRET mới riêng Production (≥32 ký tự), APP_ORIGIN=`https://tram-ca-phe.vercel.app`, APP_ENV=production cho guard vận hành. Runtime có fallback VERCEL_URL nhưng không dựa vào fallback đó cho domain chính thức. Dùng direct URL riêng cho thao tác operator; có thể dùng pooled URL cho runtime theo cấu hình được review. Không thêm VITE_ cho credential, không copy env Preview. VITE_NEON_AUTH_URL của integration là endpoint được khai báo; không coi nó là mật khẩu và không đưa nó vào auth mới khi chưa cần.

**Migration và bootstrap hiện chặn Production theo code.** Không đặt APP_ENV=preview hoặc sửa guard để lách. Cần PR/operator runbook được review riêng, kiểm tra SQL identity, backup đã kiểm thử, hash/checksum migration, advisory lock/transaction, kế hoạch khôi phục và bước phê duyệt rõ ràng. Bài này không mở guard hay thực thi các thao tác đó.

## Thứ tự cutover — chỉ kế hoạch, chưa thực thi

1. Duyệt PR #2 và blockers: PITR/backup dài hạn, identity & dữ liệu Production, menu, OWNER/recovery/operator procedure. PR vẫn Draft cho đến khi chủ quán đồng ý.
2. Xuất localStorage cũ trên từng thiết bị ra nơi private; lập danh sách đơn/menu cần giữ và đối soát, không tự trộn với database mới. Chốt thời gian ngừng ghi và mốc chuyển đổi.
3. Đọc trực tiếp Production: current_database, neon.branch_id, server version, schema/migrations/counts; so sánh với Preview và map env của deployment. Sai hoặc chưa rõ → dừng.
4. Backup Production trước mọi thay đổi; thử restore vào đích mới cách ly. Lưu mốc giờ, checksum, số liệu và nơi giữ mã hóa, kiểm tra PITR. Không chép dump Preview sang Production.
5. Chuẩn bị ba secret/config riêng Production và direct operator URL, quyền tối thiểu; kiểm tra HTTPS/domain/APP_ORIGIN. Không in giá trị hoặc đưa credential vào frontend.
6. Sau phê duyệt thao tác dữ liệu riêng, dùng quy trình migration/operator đã review để áp dụng chỉ các migration thiếu, đối chiếu checksum000–002 và schema. Tuyệt đối không chạy lại bản đã có hoặc bỏ guard.
7. Sau phê duyệt riêng, tạo OWNER chính thức theo quy trình an toàn; tắt provisioning lại ngay; test đăng nhập/thu hồi session/phân quyền. Không public signup.
8. Chủ quán duyệt dữ liệu thật, đơn vị/quy đổi/tồn mở đầu; dry-run trước, xác nhận diff rồi nhập bằng UI/API có audit/idempotency. Không sửa đơn, payment, ledger lịch sử. Tồn mở đầu qua movement, không UPDATE stock tùy ý.
9. Chủ quán phê duyệt merge và Production deployment cụ thể. Xác minh deployment SHA/target/env trước và sau; không chỉ nhìn alias. Chỉ lúc này mới merge/deploy bằng quy trình được duyệt.
10. Smoke test có kiểm soát trên hai phiên độc lập PC/mobile: login/role, menu/recipe/stock, bán test được chủ quán duyệt, trừ kho1 lần, tick paid không trừ kho lần2, dashboard/ca làm/đồng bộ. Đối soát và xử lý đơn thử bằng audit hợp lệ, không xóa ledger.
11. Theo dõi lỗi/lưu/mạng/idempotency, số đơn/thu tiền/tồn kho; chủ quán xác nhận mở bán. Nếu lỗi: dừng ghi, giữ dữ liệu, dùng build tương thích schema đã được kiểm thử hoặc khôi phục sang branch mới theo quy trình trên.

**Rollback:** main cũ dùng localStorage không đọc database mới; không thể coi việc quay lại main cũ là rollback dữ liệu an toàn. Sau đơn thật đầu tiên, không restore mốc cũ hoặc quay về app cũ rồi tiếp tục bán mà chưa đối soát. Không DROP/down migration. Giữ database hiện tại và dữ liệu sau backup, chốt phương án recovery với chủ quán.
