# Nghiệm thu kỹ thuật — 04–05/11/2026

**Preview đã kiểm thử; Production BLOCKED, chưa yêu cầu phê duyệt go-live.** Không merge/main, không deploy/migrate/import Production. Dữ liệu menu thật chỉ được chuẩn hóa và chạy PostgreSQL local; cloud chỉ TEST.

## Lỗi P1 đã sửa

1. POST tạo món trước đây bỏ qua idempotency key: mất phản hồi rồi thử lại có thể tạo trùng. Nay product/audit/idempotency cùng transaction; thử5 request đồng thời một key chỉ có1 món, đổi payload409.
2. Form kho/chi phí/NVL/món/ca mất key khi reload. Nay journal sessionStorage theo user, giữ body/key bất biến, có nút thử lại sau reload; dữ liệu khác bị chặn cho đến khi giải quyết pending. Không journal password hoặc lấy sessionStorage làm DB kinh doanh. Reset form sau xác nhận để không giữ nội dung cũ thành lần nhập mới.
3. Lưu được nhưng refresh lỗi trước đây trả thất bại cho thao tác đã được server xác nhận. Nay giữ kết quả lưu, báo lỗi đồng bộ riêng và khóa thao tác khi chưa đồng bộ.
4. Timeout trước đây kết thúc sau HTTP headers, không bao phủ đọc JSON. Nay deadline15s còn hiệu lực khi đọc body; kết quả chưa rõ vẫn giữ journal/key.
5. pg pool runtime thiếu listener lỗi idle: thêm listener chỉ log mã lỗi, để pool thay kết nối hỏng. Có bài terminate một backend idle PostgreSQL local và query lại thành công; không thực hiện failover/terminate Neon.
6. Script tạo tài khoản ghi user và role qua hai bước không atomic. Nay user/credential/role/audit cùng transaction, khóa theo email; Better Auth chịu trách nhiệm hash. Quy trình recovery OWNER được test local: đổi credential, thu hồi session, audit, từ chối STAFF/public signup. Production guard vẫn chặn, không chạy/reset tài khoản cloud hiện có.

Không tìm thấy P0/P1 còn mở trong những luồng đã kiểm thử; không coi điều đó là chứng nhận tuyệt đối mọi tình huống/tải thực tế. Hạng mục chưa kiểm chứng nằm riêng ở bảng blockers.

## Bằng chứng thực chạy

| Hạng mục | Kết quả | Phạm vi |
|---|---|---|
| npm test | **72/72 PASS local**; CI commit bàn giao kiểm tra sau publish | Toàn bộ unit/integration hiện hành, có PostgreSQL thật |
| npm run build | PASS | React+Vite; không đổi framework |
| Local browser | 50/50 PASS | management21, UX10, extra8, stability5, giá6;320/390/1440, hai context, Enter/touch, không lỗi JS |
| Dữ liệu thật local | 16/16 món +10 nhóm kiểm tra PASS | API thật, PostgreSQL và browser HTTP; bán S2 bằng keyboard; preflight/reimport2 lần, hủy/hoàn, COGS/ledger/dashboard |
| Preview cloud | 29/29 PASS trên app commit af34ad8 | UX10+extra8+stability6+giá5; API version đúng SHA, SQL br-bitter-butterfly-b8nl03v0/neondb; hai phiên auth |
| CI ứng dụng | PASS | [GitHub Actions](https://github.com/phmjhy/tram-ca-phe/actions/runs/41943317304), af34ad8. CI tự chạy lại trên commit bàn giao gồm tool/operator/tests/docs |
| Backup mã hóa/restore | PASS | snapshot05/11/2026; AES-256-GCM, xác thực/tamper reject, giải mã rồi pg_restore mới;20 bảng count/checksum,20 FK,0 sai lệch |
| Production SQL/PITR | BLOCKED | Không có file readonly credential; Console automation timeout, integration không trả history window |

[Evidence chi tiết](release-evidence/verification-2026-11-05.json). Lượt đầu stability timeout do locator test sai nhãn; sửa locator rồi5/5 PASS. Fixture test recovery ban đầu bỏ sót password do pg.options không enumerable; sửa fixture, không log credential. Lượt cloud đầu chưa tạo dữ liệu do thiếu Playwright trong thư mục tạm; khôi phục đúng1.56.1 rồi chạy thành công. Những lỗi công cụ này không được ghi nhận là app PASS trong lượt lỗi.

App commit đầy đủ đã kiểm thử: `af34ad8d1164d417ec34c377a1481bb3748dd330`, deployment `dpl_5BUAyfpZj25QWUh1nX1xGh2V8sSj`, READY/target=null. Các thay đổi bàn giao sau đó có thêm xử lý pool idle (test PostgreSQL local), operator/scripts/docs. Commit cuối phải qua CI và `e2e/preview-session-smoke.mjs` kiểm tra SHA/OWNER/STAFF/DB sau publish; kết quả cuối được nêu trong bàn giao, không tự dùng SHA af34ad8 làm SHA cuối. Bypass automation chỉ phục vụ TEST và phải thu hồi sau smoke cuối, không tắt Deployment Protection.

Runner `e2e/verify.mjs` là browser UI PR#1 cũ, không phù hợp yêu cầu mới nên không chạy trên UI mới. Unit legacy storage vẫn chạy và export chỉ đọc có test; không tuyên bố browser UI cũ PASS. Native keyboard/thiết bị thật và load test quota chưa kiểm chứng. Giới hạn P2 từ source OrderHistory: polling cập nhật30 đơn đầu; dòng đã tải sâu ngoài30 cần tải lại/lọc ngày để nhận thay đổi của phiên khác. Không ảnh hưởng unique payment/hoàn kho phía server; chưa bổ sung batch revalidation cho trang lịch sử sâu.

## Menu mới nhất

Sheets được đọc04/11 và đối chiếu lại05/11: ba vùng dữ liệu không thay đổi. [Nguồn](https://docs.google.com/spreadsheets/d/1wVG22sTug8KtlkYAy_GF2aPOo6pqgqNS4XP7_QuJcc8/edit). Lấy công thức làm gốc, giá bán menu, decimal half-up3 số lẻ; Chai/Hộp→cái, chanh0, mứt dâu g; S2 đúng2×1300=2600, giá5000. Không tự đổi g/ml.

**16 món hợp lệ về giá/công thức:** Cà phê đen, Cà phê sữa, Bạc xỉu, Sữa chua đá, Xúc xích S2, Matcha dâu, Americano, Nước cam, Sữa chua dâu, Cacao latte, Mocha cacao, Cà phê sữa tươi,247 coffee,Redbull,Coca,Vải–Mirinda.

**9 tên chưa khớp để ngoài nhập:** Matcha latte M/L,Matcha dừa tươi,Cacao dâu,Orange americano,Olong tea plus+,Sting đỏ,Sprite lon,Mì modern. Cacao dầm ngừng bán;29 menu không có công thức khớp bỏ qua. Các món này không chặn16 món hợp lệ.

Gói nhập PRIVATE ngoài Git: `/private/tmp/tram-menu-review-20261104/{source.json,dry-run.json,api-plan.json,MANUAL_ENTRY.md}`. Đơn giá chuẩn được tính bằng phép chia decimal/rational chính xác giá nhập/định lượng sử dụng có sẵn rồi half-up3, không dựa vào nhiễu binary float của ô công thức. Giữ nguyên số lượng/thông tin lô nguồn trong purchaseBasis, không tự đổi g↔ml. Mã ổn định theo hash tên chuẩn có namespace, không theo số dòng; đổi tên cần mapping được duyệt. Snapshot hash trong evidence. `menu-local-import.mjs` có target preflight, phát hiện tên trùng/giá/đơn vị/công thức khác và retry bỏ qua dữ liệu khớp; chỉ cho loopback, từ chối Neon, không phải importer Production.

**Yêu cầu mới nhất thay quyết định0 trước đó:** opening/minimum thật còn thiếu, không tự gán0; plan không có hai field này. Local fixture dùng0 và lượng nhập TEST chỉ để kiểm thử. Bảng kiểm kê16 NVL ở MANUAL_ENTRY.md. Bản03/11 đã đánh dấu superseded. Không đưa dữ liệu thật lên Preview.

## Blockers trước Production

- Chưa SQL-verify identity/schema/data Production hiện tại. `node scripts/production-preflight.mjs` đã chạy và trả BLOCKED/ENOENT, không kết nối vì thiếu `.env.production-readonly.local`. File cần600, gitignored, DATABASE_URL direct neondb của Production và APP_ENV=production. Script READ ONLY, kiểm tra branch br-old-haze-b8fmcrjs; lệch thì dừng, không tự đổi identity.
- Metadata Vercel actual: DATABASE_URL tích hợp có Preview/Production; APP_ENV/APP_ORIGIN/BETTER_AUTH_SECRET riêng hiện chỉ Preview, hiddenProductionEnvCount=0. Chưa có config/secret chính thức Production và OWNER thật. Không copy secret/tài khoản TEST.
- PITR/history_retention_seconds, earliest restore time và usage/autosuspend chưa xác minh vì chưa có quyền Neon đọc phù hợp; không suy đoán từ plan Free. Tool CUA đọc Console timeout, không phải bằng chứng PITR tắt.
- Backup đã mã hóa+restore nhưng hiện ở thư mục private tạm. Cần nơi lưu mã hóa dài hạn độc lập và người giữ key riêng; key hiện giữ local0600 phục vụ diễn tập, không coi cùng thư mục là key custody dài hạn. Managed neon_auth/cluster roles không nằm trong backup ứng dụng public. Snapshot trước một số TEST cloud phát sinh sau đó; không coi là backup cuối trước go-live.
- Cần số kiểm kê opening/minimum, quyết định9 tên nếu muốn đưa thêm;16 món hợp lệ không phải chờ9 tên.
- Chưa xuất/đối soát localStorage trên từng PC/điện thoại thật. Có script export chỉ đọc và test bảo toàn byte gốc; không tự xóa/gộp. Chưa thử keyboard native.
- Migration/OWNER Production cần operator runbook được review gắn identity/checksum/backup và phê duyệt riêng; lệnh hiện có vẫn chặn Production. Library provisioning/recovery đã test local, chưa chạy Production; không gọi target=preview để lách guard.

Neon metadata thực tế: Free,1GB/project,100CU-hours/project,max2CU/8GB,regioniad1. Chưa có usage endpoint metrics nên chưa chứng minh hạn mức đáp ứng giờ mở cửa/tháng. Runtime poolmax5/worker,connect8s,idle20s; client deadline15s, polling foreground3s. Có test ngắt idle connection và reconnect, không có load test hoặc cam kết SLA/PITR.

## Go-live có thứ tự — chưa thực hiện

1. Giải quyết các blockers: readonly identity/schema/data; PITR/quota/key custody; OWNER/config; kiểm kê; xuất dữ liệu cũ. Chốt người vận hành/khôi phục. Nếu thiếu hoặc conflict, dừng trước ghi.
2. Đóng băng ghi hệ thống cũ; xuất từng thiết bị, đối soát; backup Production mới nhất mã hóa và restore vào đích mới. Chốt RPO/RTO thực, lưu mốc giờ và các giao dịch sau backup.
3. Review operator plan từ preflight: chỉ migration thiếu, checksum khớp, transaction+advisory lock, không down/drop; thêm operator thực thi có phê duyệt riêng, không sửa guard thành preview. Test trên database cách ly với schema tương ứng trước apply Production.
4. Chuẩn bị OWNER chính thức và recovery/thu hồi session bằng Better Auth, config Production riêng; nhập chỉ cohort hợp lệ đã duyệt sau target diff, có stable keys/journal/audit. Giữ lịch sử/ledger, không overwrite số tồn hoặc đơn cũ.
5. Chỉ khi đủ điều kiện, trình chủ quán **một kế hoạch go-live cụ thể để phê duyệt riêng**, ghi SHA, migration thiếu, DB branch, backup/restore point, dữ liệu nhập, tài khoản, cửa sổ dừng và rollback. Lượt này chưa yêu cầu vì blockers còn tồn tại.
6. Sau phê duyệt mới merge/deploy/apply thao tác được duyệt; smoke hai thiết bị và đối soát tiền/kho/ca trước mở bán. Có lỗi thì dừng ghi, giữ log/chứng từ, dùng build tương thích database hoặc restore sang branch mới rồi đối soát giao dịch sau backup. Không coi app main cũ localStorage là rollback dữ liệu an toàn; không restore đè database đang có đơn mới.

Hướng dẫn hằng ngày: [OWNER_GUIDE.md](OWNER_GUIDE.md). Không có secret/connection string/key backup trong repo/evidence.
