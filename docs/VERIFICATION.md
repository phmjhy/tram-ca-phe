# Kiểm thử thực tế POS đơn giản — PR #1

Ngày: 24/10/2026 (Asia/Ho_Chi_Minh). Nhánh: `feature/simplify-pos-workflow`.

## Kết luận PASS / FAIL / BLOCKED

- **PASS:** 29 test Node; build; 37 trường hợp browser automation trên Chrome 155.0.8059.85. Các luồng yêu cầu chạy trên cả ba viewport; không còn console/page error hoặc request lỗi ở lượt cuối.
- **FAIL đã sửa:** nút lưu bị dock che ở viewport thấp; style desktop làm nhãn mobile xuống dòng/màu active khó đọc; favicon 404. Không còn FAIL trong bộ test sau sửa.
- **BLOCKED:** bàn phím ảo iOS/Android và touch/zoom trên thiết bị thật chưa có bằng chứng. Thu nhỏ viewport chỉ là phép thử proxy, không phải bàn phím ảo thật. Safari/Firefox chưa kiểm thử.
- **Merge bản demo:** các tiêu chí tự động Chromium đã đạt; **chưa xác nhận đủ toàn bộ nghiệm thu mobile và đề nghị giữ PR draft** đến khi kiểm tra bàn phím ảo thật. Không có cơ sở gắn PASS cho mục đó. Không đủ điều kiện vận hành bán hàng thật vì vẫn thiếu backend, bảo mật, backup và đồng bộ thiết bị.

## Môi trường và cách ly dữ liệu

- Git trước test: nhánh feature, working tree sạch; local commit `6a161fc`. GitHub PR head tương ứng trước lượt này là `66c87d6`; hai commit khác metadata nhưng cùng source tree `748572e463aca9378f569581306a9e20b86b4a93`.
- Node `v24.21.0`, Vite `6.4.5`; build được phục vụ bằng `npm run preview -- --host 127.0.0.1 --port 4175 --strictPort`.
- Chỉ truy cập `http://127.0.0.1:4175`, không URL production, không database hay environment secrets.
- Playwright cài ở `/private/tmp/tram-pos-browser`, không sửa dependency/lockfile project. Chrome headless có sandbox, không dùng profile cá nhân.
- Mỗi viewport dùng `browser.newContext` mới, timezone `Asia/Ho_Chi_Minh`, locale `vi-VN`; mobile có `isMobile` và `hasTouch`. Các thao tác UI bằng click Playwright; không tuyên bố đã kiểm tra gesture/bàn phím native.
- Mã/tên/điện thoại/địa chỉ đều TEST. Dữ liệu trong context bị hủy khi đóng; không xóa dữ liệu trình duyệt của chủ quán. Hai tab dùng chung context chỉ trong phép thử đồng thời.

User story: UI chọn món/kênh → repository lưu snapshot vào localStorage → xác nhận thanh toán ghi paidAt → báo cáo theo ngày tạo đơn và ngày thu. API/database không có trong phiên bản này, không đánh dấu PASS cho backend.

## Kiểm tra nền tảng

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Nhánh Git | PASS | `feature/simplify-pos-workflow`, không checkout/commit main |
| `npm test` | PASS | 29/29, 21 domain/storage + 8 JSX handlers |
| `npm run build` sau sửa | PASS | 1.578 modules; HTML 0,49 kB; CSS 9,87 kB; JS 169,72 kB, gzip 54,42 kB |
| `git diff --check` | PASS | Không lỗi whitespace |
| Lint/typecheck | BLOCKED | Chưa có script/tooling; không khai báo pass |
| Backend, auth, DB production | Ngoài phạm vi | Không truy cập hay thay đổi |

Test Node vẫn dùng hooks/storage mô phỏng; kết quả browser dưới đây độc lập, chạy React/DOM/Web Locks/localStorage thật trong Chrome.

## Ma trận kiểm thử browser thực tế

Bằng chứng machine-readable, gồm tên từng case và số đo layout: [browser-results.json](evidence/browser-results.json). Lượt đầu có lỗi: [browser-results-before.json](evidence/browser-results-before.json). Bộ runner: [e2e/verify.mjs](../e2e/verify.mjs).

| Luồng / kiểm tra | 1440×900 | 390×844 | 320×640 | Assertion thực tế |
|---|---|---|---|---|
| Profile test rỗng, đúng 4 kênh | PASS | PASS | PASS | 0 đơn ban đầu; 4 nút kênh; Web Locks khả dụng |
| Thêm/tăng/giảm/xóa món, ghi chú | PASS | PASS | PASS | Tăng đen lên 2 rồi giảm 1; xóa sữa rồi thêm lại; snapshot 22.000 + 27.000 = 49.000; ghi chú giữ nguyên |
| Tại quán chưa thanh toán | PASS | PASS | PASS | channel=store, paid=false, paidAt=null |
| Mang đi | PASS | PASS | PASS | channel=takeaway được lưu và reload |
| App nhập thủ công | PASS | PASS | PASS | Mã TEST được lưu; paid=false, paidAt=null, không tự đã thu |
| Hotline thiếu cả hai trường | PASS | PASS | PASS | Alert; số đơn không tăng |
| Hotline có SĐT nhưng thiếu địa chỉ | PASS | PASS | PASS | Alert; số đơn không tăng |
| Hotline đủ thông tin, không ship | PASS | PASS | PASS | Tổng 22.000; không thuộc tính shipping hoặc ô nhập phí ship |
| Xác nhận đã thanh toán | PASS | PASS | PASS | paid=true, paidAt parse được; UI bỏ nút thu sau thành công |
| Rapid-click nút lưu | PASS | PASS | PASS | 5 DOM click cùng lượt event; chỉ thêm đúng 1 đơn. Đây là stress handler, không phải đo tốc độ ngón tay thật |
| Doanh số/đã thu/chưa thu | PASS | PASS | PASS | Sau 5 đơn: doanh số 137.000, đã thanh toán 49.000, chưa thanh toán 88.000; bốn hàng kênh |
| Khoản thu hôm nay | PASS | PASS | PASS | 49.000 theo paidAt, tách chỉ số doanh số 137.000 |
| Hai tab tạo đơn đồng thời | PASS | PASS | PASS | Cả TEST TAB-A và TEST TAB-B đều giữ; tổng 7 đơn, không ghi đè |
| Hai tab thu hai đơn đồng thời | PASS | PASS | PASS | Cả hai paid=true, có paidAt; storage event cập nhật UI |
| Hai tab cùng thu một đơn | PASS | PASS | PASS | Hai handler xếp hàng sau Web Lock thật; thu idempotent; cùng paidAt, không mất đơn |
| Reload | PASS | PASS | PASS | Toàn bộ record/snapshot/paidAt trước–sau giống nhau; render đủ 7 thẻ đơn |
| Overflow toàn trang | PASS | PASS | PASS | scrollWidth bằng innerWidth ở POS, đơn, sản phẩm, báo cáo; bảng có vùng cuộn riêng |
| Menu mobile | Không áp dụng | PASS | PASS | 4 nút, click tới đúng màn hình, hit-test không bị che, nhãn một dòng, active không dùng nền desktop tối |
| Nút lưu | PASS | PASS | PASS | Hit-test điểm giữa nút tới đúng nút; thao tác lưu thực tế thành công |
| Viewport thấp thay bàn phím (proxy) | Không áp dụng | PASS ở 390×544 | PASS ở 320×340 sau sửa | Nút lưu truy cập được khi focus ghi chú, không bị dock che |
| Bàn phím ảo native | Không áp dụng | BLOCKED | BLOCKED | Chưa có thiết bị iOS/Android thật; không suy rộng từ proxy |
| Console/page errors | PASS | PASS | PASS | Lượt cuối: 0 console error, 0 pageerror |
| Failed HTTP/network requests | PASS | PASS | PASS | Lượt cuối: 0; favicon trả tài nguyên hợp lệ |

37 case cấp suite trong JSON gom nhiều assertion thuộc bảng trên; không phải mỗi ô bảng là một test độc lập.

### Trường hợp bổ sung: khác ngày và legacy

**PASS trên context desktop mới:** khởi tạo ba đơn TEST legacy, gồm hai record cùng ID, kênh grab/shopee và một record cancelled. UI giữ đủ ba thẻ. Xác nhận thanh toán cho đơn tạo hôm trước:

- `tram_orders` giữ nguyên byte gốc; thay đổi chỉ ở overlay v2.
- Hôm nay: doanh số 0; khoản thu 22.000 theo paidAt mới.
- Ngày tạo đơn: doanh số 44.000, đã thanh toán 44.000, chưa thanh toán 0, khoản thu ghi nhận ngày đó 0.
- Record cancelled không vào tổng; đơn paid=true cũ không có paidAt có cảnh báo riêng, không bị bịa ngày thu.

Bằng chứng: case `Legacy real browser: prior-day order paid today / raw preservation` trong JSON và [ảnh báo cáo khác ngày](evidence/legacy-cross-day-report.png).

## Lỗi tìm thấy và sửa

| ID | Mức | Trước sửa | Sửa | Regression |
|---|---|---|---|---|
| UI-01 | Medium | 320×340: nút lưu rect x=30, y=295,75, w=260, h=44; elementFromPoint ở giữa trả dock, hit=false | Khi mobile cao ≤500px, dock về normal flow, không overlay nội dung | 390×544 và 320×340 focus ghi chú, scroll và hit-test nút lưu PASS; ảnh short-viewport |
| UI-02 | Low | Style global `nav button` áp nền tối/padding desktop lên mobile; ảnh 320px cho thấy label xuống dòng, active tương phản kém | Padding/nowrap/mobile active background riêng | Cả 390px/320px: nhãn cao <20px, một dòng; đo style và kiểm tra ảnh |
| UI-03 | Low | Chrome console 404 tại `http://127.0.0.1:4175/favicon.ico` (probe xác nhận URL) | Thêm `public/favicon.svg` và link trong HTML | Lượt cuối không console/page error và không request lỗi |

Không phát hiện Critical/High mới trong các luồng đã test; không coi đây là chứng minh localStorage an toàn cho vận hành thật.

## Bằng chứng hình ảnh sau sửa

| Viewport | POS | Đơn hàng | Sản phẩm | Báo cáo |
|---|---|---|---|---|
| 1440×900 | [Ảnh](evidence/1440x900-pos.png) | [Ảnh](evidence/1440x900-orders.png) | [Ảnh](evidence/1440x900-products.png) | [Ảnh](evidence/1440x900-reports.png) |
| 390×844 | [Ảnh](evidence/390x844-pos.png) | [Ảnh](evidence/390x844-orders.png) | [Ảnh](evidence/390x844-products.png) | [Ảnh](evidence/390x844-reports.png) |
| 320×640 | [Ảnh](evidence/320x640-pos.png) | [Ảnh](evidence/320x640-orders.png) | [Ảnh](evidence/320x640-products.png) | [Ảnh](evidence/320x640-reports.png) |

Viewport thấp: [390×544](evidence/390x844-short-viewport.png), [320×340](evidence/320x640-short-viewport.png). Tên file giữ viewport gốc để liên hệ ca test; kích thước ảnh là viewport đã giảm.

## Chạy lại

Không thêm Playwright vào dependencies ứng dụng. Ví dụ cài QA tool ở thư mục tạm:

```sh
npm install --prefix /private/tmp/tram-pos-browser --no-package-lock --no-audit --no-fund playwright
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4175 --strictPort
# Terminal khác; Chrome cài sẵn trên macOS:
node e2e/verify.mjs --playwright=/private/tmp/tram-pos-browser/node_modules/playwright/index.mjs
```

Runner cho phép `POS_CHROME_PATH` trỏ browser binary khác và `POS_PLAYWRIGHT_MODULE` trỏ module QA đã cài. Mặc định chỉ test localhost:4175. `--extra-only` chạy bổ sung ca legacy trên profile mới, giữ bằng chứng các viewport ở lượt trước; lượt cuối được thực hiện theo cách này sau khi toàn bộ ba viewport đã pass.

## Việc còn lại trước nghiệm thu đầy đủ

- [ ] Thiết bị iOS/Android thật: mở bàn phím ở ghi chú/Hotline, zoom, scroll, tap lưu và menu ở ba kích thước gần tương ứng; xác nhận không che control.
- [ ] Safari/Firefox browser thật nếu đưa vào danh sách trình duyệt hỗ trợ; screen reader và accessibility tự động chưa kiểm tra.
- [ ] Thử quota/storage-denied ở browser thật. Test Node/JSX đã pass nhưng không đánh dấu PASS cho browser case này.

PR vẫn là demo: chưa backend/auth/authorization/backup/đồng bộ PC-mobile; giỏ nháp chưa lưu qua reload. Không merge main, không deploy production, không thay đổi DB production trong lượt kiểm thử này.
