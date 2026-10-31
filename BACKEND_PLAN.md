# Backend hiện thực và kế hoạch đưa vào sử dụng

Cập nhật 28/10/2026 theo yêu cầu mới. Đây là hướng dẫn cho code đã viết; trạng thái kiểm thử ở docs/VERIFICATION.md.

## Kiến trúc

Một React/Vite responsive → same-origin Vercel Function → Better Auth + pg → PostgreSQL/Neon. React không có credential DB. Cookie session HttpOnly/SameSite, secure trên HTTPS; origin chính xác + custom header + allowlist payload. User active/role lấy lại từ DB mỗi business request. Không public signup. Provision owner/staff ở script quản trị riêng, không seed mật khẩu. Rate limit đăng nhập lưu DB, không dùng bộ nhớ Function.

Frontend polling 3s khi tab visible, revalidate focus/online; không cache business data trong localStorage. Lỗi mạng/timeout15s khóa lưu và giữ draft. Pending create body/key giữ trong sessionStorage riêng theo user để retry sau reload. Server kiểm tra giá version; conflict yêu cầu xác nhận lại giá, không thay giá ngầm. Không gửi nền offline.

## Schema

- 000_auth: user/session/account/verification/rateLimit từ Better Auth 1.7.12.
- 001_pos: user_access, products, orders, order_items, payments, idempotency, audit_logs, legacy_archives. Snapshot giá, invariant tổng tiền/payment ở DB, chứng từ immutable.
- 002_management (additive): aliases/preparation_note trên products; note trên order_items; ingredients (g/ml/cái, stock/minimum/unit_cost/version), recipes, stock_movements, cancellations, shifts, expenses. Ledger/chi phí/hủy bất biến, unique tiêu hao/hoàn theo order+ingredient; một check-in đang mở mỗi nhân viên.
- Cột channel/code cũ vẫn còn để tương thích dữ liệu; giao dịch mới server tự ghi giá trị nội bộ, UI không yêu cầu/hiển thị chúng. Không rewrite lịch sử.

Lưu sale: lock idempotency actor+operation+key → lock menu theo ID → kiểm tra version/công thức → tổng lượng bằng SQL numeric → lock nguyên liệu theo ID → order+items+consumption+stock+payment tùy chọn+audit+idempotency → commit. Thiếu kho/công thức rollback toàn bộ. Key cùng payload trả cùng resource; key khác payload409. Những giao dịch cố ý khác key vẫn là hai giao dịch khác nhau.

Pay: lock order, payment UNIQUE(order), timestamp server; không đụng kho. Cancel OWNER: lock order, insert cancellation một lần, hoàn từ consumption snapshot đúng lượng/cost, audit lý do. Không xóa payment, không giả lập hoàn tiền; dashboard ghi rõ khoản đã thu bị hủy cần đối soát.

Giá vốn ước tính theo đơn giá nhập gần nhất lúc tiêu hao (ledger snapshot), không lấy lại giá nhập mới cho đơn cũ. Dashboard tính numeric ở PostgreSQL, ngày Asia/Ho_Chi_Minh, tách createdAt/paidAt. Tiền nhập hàng không đi qua bảng expenses.

## API v1

| Method/path | Quyền | Chức năng |
|---|---|---|
| GET /version, /me | version public, me login | commit/configuration, phiên/quyền |
| GET /products | OWNER/STAFF | menu không có giá vốn |
| POST /products; PATCH /products/:id | OWNER | tạo/sửa tên/alias/giá/active/note, optimistic version |
| PATCH /products/:id/recipe | OWNER | thay công thức nguyên tử, tăng version menu |
| GET /inventory | OWNER | tồn, recipe, ledger 200 dòng gần nhất, đề xuất nhập |
| POST /ingredients; PATCH /ingredients/:id | OWNER | danh mục/tồn đầu/đơn vị/minimum/cost; sửa tên/minimum theo version |
| POST /stock | OWNER | nhập hoặc điều chỉnh có lý do, idempotency |
| GET/POST /orders | OWNER/STAFF | 100 giao dịch mới nhất; create items{id,qty,version,note},paid |
| POST /orders/:id/payment | OWNER/STAFF | thu tiền, không client amount/paidAt |
| POST /orders/:id/cancel | OWNER | lý do, hoàn kho đúng một lần |
| GET/POST /shifts | STAFF riêng mình, OWNER tất cả | lịch theo from/to, đăng ký ca bản thân |
| POST /shifts/:id/attendance | Chủ ca | check-in/out giờ server |
| PATCH /shifts/:id | OWNER | sửa giờ thực tế, reason/version, before/after audit |
| GET/POST /expenses | OWNER | đọc theo kỳ, ghi chi phí có idempotency |
| GET /dashboard?from=&to= | OWNER | doanh số/thu/chưa thu/cost/chi phí/top/giờ/kho/ca |
| GET /reports/daily | OWNER | tương thích báo cáo cũ, không dùng cho UI mới |
| GET /operations/:key | Actor sở hữu key | đối soát kết quả retry |

Mọi POST nghiệp vụ cần Idempotency-Key UUID, Origin chính xác, JSON và X-Tram-Request:1. Auth whitelist sign-in/email, sign-out, get-session, change-password. STAFF gọi owner endpoints nhận403 phía server.

## Migration cũ / Excel

Không tự import. Đầu tiên kiểm kê từng origin/thiết bị, export raw có checksum, owner phân loại TEST/thật, xác nhận duplicate/paidAt chưa biết. Giữ chứng từ gốc, không cộng ship/khôi phục tồn từ giả định. Excel chưa được cung cấp; cần xem file và xác nhận đơn vị g/ml/cái, lượng mỗi món, đơn giá mỗi đơn vị. Những trường thiếu phải đưa vào hàng chờ đối soát, không đoán công thức/cost. Dry-run import vào DB thử rồi đối chiếu số chứng từ/tổng tiền/tồn. Chưa có importer production; legacy_archives chỉ dành cho bước review sau.

## Triển khai, backup, rollback

1. PR review trước. Không merge PR #1 hoặc nhánh mới tự động.
2. Tạo Neon **Preview riêng** và credential hạn chế. Cấu hình DATABASE_URL, BETTER_AUTH_SECRET, APP_ORIGIN/VERCEL_URL ở server Preview; không chọn Production. Chạy migration thủ công qua môi trường thử; provision user thử.
3. Test cùng Preview trên PC/mobile đăng nhập riêng, menu/order/payment/kho/report và quyền; không suy rộng local PG thành cloud PASS.
4. Trước production: backup DB + raw browser có kiểm soát truy cập; restore thử DB khác, đối chiếu counts/tổng/ledger; owner duyệt cutover/credentials/dữ liệu thật. Backup/PITR policy theo gói Neon phải được xác minh khi có tài khoản.
5. Nếu lỗi: dừng ghi, giữ ledger và backup, rollback frontend/deployment về bản tương thích schema. Không reverse/drop migration đã có dữ liệu; DB additive cho phép điều tra/fix forward. Không rollback sang UI localStorage rồi tiếp tục ghi độc lập.

Migration runner hiện chủ động **chặn production**, chưa cung cấp lối chạy prod tự động. Chưa thực hiện backup/restore cloud, production migration, merge hay production deployment.

## Hạng mục còn cần nghiệm thu

Neon cloud/auth/Preview hai thiết bị; owner bootstrap/account recovery production; backup/restore drill; nhập Excel/legacy sau xác nhận; pagination hơn100 giao dịch/200 ledger; quản lý nhân sự/tài khoản nâng cao ngoài script; review accessibility và thiết bị iOS/Android thật. Các mục này không được đánh dấu hoàn tất chỉ từ local tests.
