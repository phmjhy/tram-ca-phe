# Kết quả kiểm tra — POS đơn giản

Ngày: 24/10/2026. Nhánh: `feature/simplify-pos-workflow`.

## User story

Nhân viên chọn món và một trong bốn kênh → repository localStorage lưu đơn snapshot → xác nhận thanh toán ghi paidAt → báo cáo phân biệt doanh số theo ngày tạo và khoản thanh toán theo ngày thu. Không có API/database/backend trong thay đổi này.

## Kết quả

| Kiểm tra | Kết quả và bằng chứng |
|---|---|
| `npm test` | PASS: 29 test, 0 fail; Node test runner |
| Domain/storage | 21 test: validation giá/số lượng/tổng, snapshot, idempotency, app reference, lỗi ghi, schema lỗi, tương thích legacy, báo cáo/timezone |
| JSX/component handlers | 8 test: bốn kênh/navigation; submit nhanh; xác nhận thu; báo cáo; lỗi ghi giữ giỏ; Hotline; menu/snapshot; dữ liệu hỏng; overflow |
| `npm run build` | PASS: Vite 6.4.5, 1.578 modules; JS 169,72 kB (gzip 54,42 kB), CSS 9,52 kB |
| `git diff --check` | PASS |
| Local dev server | Vite ready trên `127.0.0.1:5173` |
| Browser/visual PC/mobile | CHƯA XÁC MINH: không có browser trong inventory; kết nối Safari timeout. Không có screenshot/console/real touch evidence |
| Lint/typecheck | Chưa có script/tooling; không khai báo pass |
| Database/production | Không truy cập/chỉnh sửa DB; không deploy production hoặc merge main |

## Cách kiểm thử và giới hạn

- Domain/storage test dùng storage trong bộ nhớ và hàng đợi mô phỏng Web Locks để kiểm chứng logic lưu tuần tự. Không chứng minh browser Web Locks/storage event hoạt động trên mọi thiết bị.
- JSX test biên dịch source thật bằng esbuild sẵn trong dependency tree Vite, chạy handler với hooks mô phỏng. Không cài module/framework mới. Không có DOM/layout engine, không thay thế React scheduling thật, browser native validation hoặc E2E.
- Test migration xác nhận byte gốc `tram_orders`/`tram_products` không đổi sau tạo đơn/thu/sửa menu, số bản ghi cũ trùng ID vẫn giữ và overlay không xóa lịch sử.
- Review React: hooks ở top level, cleanup listeners, functional cart updates, ref khóa submit, state chỉ xác nhận thành công sau persistence, report chỉ tính khi xem màn hình và memo hóa. Input có label, nút +/- có accessible name, bốn mục mobile; CSS hỗ trợ breakpoint nhưng chưa có visual QA.
- Web Locks chỉ bảo vệ các writer phiên bản mới cùng origin. Tab UI cũ có thể sửa mảng legacy; phải đóng các tab phiên bản cũ trước khi thử migration. Legacy source không phải database có transaction/version, nên đây vẫn là demo.

## Checklist review thủ công còn lại (trước merge)

- [ ] PC 1440px, mobile 390px và 320px: kiểm tra overflow ngoài vùng bảng, bàn phím ảo, scroll/nút lưu, navigation đáy.
- [ ] Trình duyệt thật: chọn/tăng/giảm/xóa món, tìm kiếm, bốn kênh; thử App không tự paid, Hotline required và không ship.
- [ ] Double-click/touch nhanh nút lưu; hai tab cùng origin tạo/thu đơn; reload và storage event; thử browser không Web Locks.
- [ ] Tạo đơn ngày trước, thu hôm nay; ngày theo timezone Việt Nam; unknown paidAt và phí giao lịch sử được chú thích.
- [ ] Thử lỗi quota/storage denied thực tế trên test profile: không báo lưu thành công, không mất giỏ.
- [ ] Dùng bản sao dữ liệu legacy trên test profile, đóng UI cũ, so số lượng/ID/tổng trước–sau; không thử bằng dữ liệu production.
- [ ] Keyboard/focus, screen-reader labels, confirm thu tiền; chưa có kiểm tra accessibility tự động.

## Hạn chế còn giữ có chủ ý

localStorage không có authentication/authorization, không đồng bộ PC/điện thoại, chưa có backup tự động, giỏ nháp mất khi reload. Không dùng bán hàng thật. Không có phân quyền sửa giá phía server; validation client không phải cơ chế bảo mật. Thiết kế backend/PostgreSQL và migration cần PR riêng theo `docs/REQUIREMENTS.md`.
