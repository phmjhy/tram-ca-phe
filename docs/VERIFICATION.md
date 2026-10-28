# Verification — Trạm Cà Phê quản lý quán

Ngày cập nhật: 28/10/2026. Nhánh `feature/cafe-management`, dựa trên code PR #1 và thay yêu cầu nghiệp vụ bằng docs/REQUIREMENTS.md. Không thao tác main/production/database production.

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
