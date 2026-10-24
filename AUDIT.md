# Audit Trạm Cà Phê POS

Ngày: 23/10/2026 (Asia/Ho_Chi_Minh). Source: commit `4509d460c24985ba4d6e351188e739655c34f2a5`, nhánh `main`.

## Kết luận

Dự án đáp ứng một bản demo POS trên một trình duyệt, chưa đủ điều kiện vận hành bán hàng thật hoặc phối hợp thu ngân–pha chế trên nhiều thiết bị. Các điểm chặn chính là lưu dữ liệu cục bộ, ghi đè dữ liệu giữa các tab, không có xác thực/phân quyền, và chưa kiểm soát tính toàn vẹn đơn hàng/thanh toán.

Audit chỉ đọc source và thực thi kiểm tra logic với dữ liệu giả trong bộ nhớ. Không sửa source ứng dụng, không thay đổi database, không cài dependency, không deploy. `npm run build` chỉ tái tạo `dist` đã được Git ignore. File báo cáo này là tài liệu mới duy nhất.

## Phạm vi và giới hạn bằng chứng

- Đọc toàn bộ 8 file được Git theo dõi: `.gitignore`, `README.md`, `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `src/main.jsx`, `src/style.css`.
- Kiểm tra scripts, dependency thực cài, file backend/env và trạng thái Git; không đọc giá trị secrets.
- Thực thi phần logic nguyên gốc của `App` trước JSX trong Node VM, với hooks React và localStorage mô phỏng. 16 kiểm tra có assertion đều đạt kỳ vọng, bao gồm các kỳ vọng tái hiện lỗi. Đây không phải 16 tính năng đều đúng.
- Chưa chạy browser E2E, chưa kiểm tra thao tác cảm ứng, overflow thực tế, console/network của trình duyệt hoặc accessibility bằng công cụ. Project chưa cài Playwright/Puppeteer.
- Không kiểm tra lại cấu hình environment trên Vercel hoặc database bên ngoài trong lượt audit này. Không có tích hợp Neon trong source được audit; không kết luận tài khoản người dùng không có Neon ở nơi khác.
- Không chạy truy vấn advisory/CVE; báo cáo không khẳng định dependency không có lỗ hổng.

## 1. Kiến trúc, framework, dependencies và scripts

| Hạng mục | Kết quả |
|---|---|
| Kiến trúc | SPA frontend, React render vào `#root`, không backend |
| Framework | React 18.3.1 + Vite 6.4.5 đang cài |
| Dependencies | `react`, `react-dom`, `lucide-react` 0.468.0 |
| Dev dependencies | `vite`, `@vitejs/plugin-react` 4.7.0 đang cài |
| Khai báo phiên bản | Dùng khoảng `^`; có `package-lock.json` lockfile v3, khớp khai báo gốc |
| Source | `App` + `OrderList` trong một file JSX 45 dòng, nhiều dòng rất dài; CSS một dòng |
| State | `useState`, đọc localStorage lúc khởi tạo, ghi toàn bộ mảng khi thay đổi |
| Routing | Không router; chọn màn hình bằng biến `page` |
| Scripts | `dev`: `vite --host 0.0.0.0`; `build`: `vite build`; `preview`: `vite preview --host 0.0.0.0` |
| Cấu hình Vite | Chỉ bật plugin React; không tùy chỉnh base/output/proxy |
| Backend/tooling | Không API directory, migrations, schema DB, TypeScript, lint config, test suite hoặc CI trong tập file được theo dõi |

Tổ chức hiện tại đơn giản, phù hợp demo nhỏ. Việc gộp UI, lưu trữ, tính tiền và chuyển trạng thái khiến quy tắc nghiệp vụ khó kiểm chứng khi mở rộng; chưa cần đổi framework để giải quyết.

## 2. Kết quả chạy kiểm tra

Môi trường: Node `v24.21.0`.

| Lệnh/kiểm tra | Kết quả |
|---|---|
| `npm run lint` | Không chạy được: `Missing script: lint` |
| `npm run typecheck` | Không chạy được: `Missing script: typecheck` |
| `npm test` | Không chạy được: `Missing script: test` |
| `npm run build` | PASS; Vite 6.4.5, 1.576 modules, khoảng 1,24 giây |
| Build output | HTML 0,43 kB; CSS 7,55 kB; JS 161,66 kB, gzip JS 51,30 kB |
| `npm ls --depth=0` | Liệt kê đủ 5 dependency trực tiếp, không báo thiếu/invalid |
| Kiểm tra logic bổ sung | 16/16 assertions đạt kỳ vọng, chi tiết bên dưới |

Build pass không thay thế lint, typecheck, test nghiệp vụ hoặc kiểm thử UI. npm có thêm thông báo không ghi được log ở thư mục cache; nguyên nhân chính của ba lệnh đầu vẫn là thiếu script.

### Kiểm tra logic bổ sung đã thực thi

1. Đơn tại quán: 22.000 + 27.000 = 49.000; `new → preparing → ready → paid → done`; báo cáo 49.000; khởi tạo lại cùng storage đọc được đơn.
2. Hotline thiếu số điện thoại/địa chỉ bị chặn; có đủ hai trường và ship 10.000 thì tổng đơn cà phê đen = 32.000.
3. GrabFood và ShopeeFood tự `paid=true`, được tính doanh thu ngay ở `new`.
4. Đơn đã thu bị hủy được loại khỏi doanh thu.
5. Hai phiên state dùng chung storage: tạo hai đơn nhưng bản lưu cuối chỉ còn một đơn; giao diện phiên còn lại giữ bản cũ.
6. Storage thiết bị độc lập không nhận đơn từ PC.
7. `setItem` ném lỗi: state đã thêm đơn, giỏ chưa xóa, storage chưa có đơn.
8. Khởi tạo lại làm mất giỏ nháp chưa tạo đơn.
9. JSON lịch sử hỏng bị thay bằng mảng đơn rỗng khi đọc.
10. Mảng sản phẩm `[null]` vượt qua `read`, sau đó predicate render truy cập `p.active` gây lỗi.
11. Phép chuyển đổi trong handler sửa giá chấp nhận `-1000`; đơn tạo từ giá đó có tổng âm.
12. Món trong giỏ vẫn giữ giá cũ và vẫn tạo đơn được sau khi sản phẩm bị tắt bán.
13. Hai đơn cùng kênh và mã app được lưu mà không kiểm tra trùng.
14. Công thức mã hiển thị cho cùng kết quả sau 100.000.000 ms, khoảng 27 giờ 47 phút.
15. Số điện thoại/địa chỉ đã nhập cho hotline vẫn được lưu vào đơn tại quán sau khi đổi kênh.
16. Đơn tạo ngày trước, đánh dấu đã thu hôm nay, không nằm trong doanh thu hôm nay.

Các kiểm tra trên không mô phỏng đầy đủ DOM, validation trình duyệt hoặc lịch React. Riêng giá âm được xác nhận ở handler và logic tính tiền; chưa xác nhận bằng nhập liệu trên trình duyệt.

## 3. Toàn bộ route và màn hình thực tế

Chỉ có entry URL `/`. Không khai báo các route `/pos`, `/orders`, `/kitchen`, `/menu`, `/reports` hay `/settings`. Không kiểm tra phản hồi HTTP cho các URL tự nhập này.

| State màn hình | Nhãn | Chức năng thực tế | Nguồn |
|---|---|---|---|
| `pos` | Bán hàng | Tìm/chọn món, số lượng, kênh bán, thông tin giao, ghi chú, phương thức thanh toán, tạo đơn | `src/main.jsx:36` |
| `orders` | Đơn hàng | Toàn bộ đơn cục bộ, đổi trạng thái, xác nhận đã thu, hủy | `src/main.jsx:37`, `:43` |
| `kitchen` | Pha chế | Chỉ đơn `new`, `preparing`; bắt đầu pha, pha xong | `src/main.jsx:38`, `:43` |
| `menu` | Sản phẩm | Thêm món, sửa giá, bật/tắt bán | `src/main.jsx:39` |
| `reports` | Báo cáo | Doanh thu hôm nay, số đơn hôm nay, đơn đang xử lý, doanh thu theo kênh | `src/main.jsx:40` |
| Không có | Cài đặt | Chưa triển khai | Navigation tại `src/main.jsx:32` |

Reload luôn về `pos`; navigation không cập nhật URL, không hỗ trợ deep link/back theo từng màn hình. Không có màn hình đăng nhập, bàn hoặc đa chi nhánh. Không có bàn/đa chi nhánh là đúng phạm vi quán.

## 4. Đã hoàn thành

Các chức năng dưới đây đã có source đầy đủ trong giới hạn demo cục bộ; không đồng nghĩa đã nghiệm thu trên thiết bị thật.

- React + Vite build được, điểm vào HTML và assets hợp lệ trong output build.
- POS có bốn kênh biểu diễn ba hình thức bán: tại quán, GrabFood, ShopeeFood, hotline.
- Tìm tên món không phân biệt hoa/thường, thêm/bớt số lượng, ghi chú cấp đơn.
- Hotline yêu cầu số điện thoại và địa chỉ không rỗng; có phí giao hàng cộng vào tổng.
- Lưu snapshot tên/giá/số lượng từng món vào đơn; sửa menu sau đó không tự sửa lịch sử đơn.
- Có hàng chờ pha chế, trạng thái đơn, đánh dấu đã thu và hủy bằng hộp xác nhận.
- Có thêm món, sửa giá, bật/tắt bán và báo cáo ngày/theo kênh ở mức cơ bản.
- CSS có breakpoint 1050px, 700px và navigation đáy trên mobile; chưa xác nhận visual/device QA.

## 5. Hoạt động nhưng chưa hoàn chỉnh

| Mảng | Giới hạn |
|---|---|
| POS | Không lưu giỏ nháp; không kiểm tra lại món còn bán/giá tại thời điểm chốt; chưa có tiền khách đưa/tiền thừa, in phiếu |
| Đơn app | Nhập thủ công; mã app tùy chọn, không chống trùng; không tích hợp Grab/Shopee |
| Hotline | Chỉ kiểm tra có nội dung, không chuẩn hóa số điện thoại; phí ship không tách trong báo cáo |
| Đơn hàng | Không tìm/lọc/phân trang; không có lịch sử người thao tác; hoàn tất được dù chưa thu |
| Pha chế | Chỉ thấy state cục bộ; đơn `ready` biến mất khỏi hàng chờ; xếp mới nhất trước do prepend |
| Thanh toán | `paid` boolean và `payment` cash/transfer; không có giao dịch, thời điểm thu, người thu, đối soát hoặc hoàn tiền |
| Sản phẩm | Sửa giá trực tiếp mỗi lần nhập; không quyền quản lý/validation đủ; không sửa tên/nhóm món đã tạo |
| Báo cáo | Chỉ ngày hiện tại theo múi giờ thiết bị; căn cứ ngày tạo đơn, tính tổng cả ship, chưa trừ phí app; không lọc kỳ/xuất dữ liệu |
| Responsive | Có CSS hỗ trợ PC/mobile; chưa kiểm tra thực tế bàn phím ảo, viewport nhỏ, cuộn và thao tác cảm ứng |

## 6. Chưa triển khai: dữ liệu, API và bảo mật

- **Dữ liệu:** `tram_products` và `tram_orders` trong localStorage theo origin/trình duyệt/profile. Sáu sản phẩm `seed` là dữ liệu mẫu; đơn mặc định rỗng. Đơn do người dùng nhập là dữ liệu cục bộ, không phải dữ liệu mock tải từ API (`src/main.jsx:6–23`).
- **Database/Neon:** không package driver, connection code, schema, migration hay truy vấn SQL trong source. Không có database thật được ứng dụng sử dụng.
- **API:** không `fetch`, axios, route API hay server handler trong source.
- **Authentication/authorization:** không login/session/role hoặc kiểm tra quyền phía server. Ai dùng được ứng dụng trong một profile trình duyệt đều có UI sửa giá/đơn và xem thông tin hotline của profile đó.
- **Environment:** không file `.env*` ở root khi kiểm tra; source không tham chiếu `import.meta.env` hoặc `process.env`. `.gitignore` bỏ qua `.env`, `.env.*`, `.vercel`. Chưa kiểm tra giá trị cấu hình Vercel; ignore không thay thế quy trình quản lý secrets.
- **Đồng bộ:** không server chung, realtime, polling, `storage` listener hay cơ chế merge/version. PC và điện thoại tách biệt; ngay cả hai tab cùng trình duyệt cũng giữ state riêng.
- **Khôi phục:** chưa backup, export/import, version dữ liệu, schema validation hoặc quy trình xử lý storage bị đầy/hỏng.
- **Cài đặt:** chưa có cấu hình quán, múi giờ nghiệp vụ, phí app hoặc cấu hình thanh toán.

Không có bằng chứng từ source cho thấy trình duyệt khác có thể đọc từ xa localStorage của người dùng. Thông tin hotline đang lưu dạng JSON rõ trong profile trình duyệt; rủi ro được xác nhận là người dùng chung thiết bị và các script cùng origin có thể truy cập. React đang render chuỗi bằng JSX; không thấy `dangerouslySetInnerHTML`, không đủ cơ sở kết luận có XSS khai thác được.

## 7. Luồng tạo đơn → pha chế → thanh toán → báo cáo

1. `place` tạo UUID, mã hiển thị từ 8 chữ số cuối timestamp, snapshot giỏ, tổng tiền, thời gian tạo; lưu toàn bộ mảng đơn (`src/main.jsx:28`).
2. Luồng UI: `new → preparing → ready → done`; hủy được ở `new`/`preparing`. Pha chế chỉ thấy hai trạng thái đầu (`:38`, `:43`).
3. Đơn tại quán/hotline khởi tạo chưa thu. Nút “Đã thu tiền” dùng được ở mọi trạng thái chưa hủy, kể cả sau hoàn tất. Nút “Hoàn tất” không yêu cầu `paid=true` (`:43`).
4. Đơn app tự coi là đã thu ngay khi tạo. Chọn cash/transfer vẫn được lưu nhưng không đại diện một giao dịch/đối soát app (`:28`, `:36`).
5. Báo cáo lấy đơn có **ngày tạo hôm nay**, `paid=true`, chưa hủy, cộng toàn bộ `total`. Không cần pha xong/hoàn tất (`:30–31`, `:40`).

Luồng cơ bản đã chạy trong kiểm tra logic. Không có transaction hoặc invariant bảo vệ chuyển trạng thái. Doanh thu theo ngày tạo có thể phù hợp một định nghĩa “doanh thu đơn phát sinh”, nhưng nhãn “đã thu hôm nay” không khớp trường hợp thu tiền đơn ngày trước; cần chốt định nghĩa với chủ quán.

## 8. Bugs và rủi ro

Severity tính theo việc dùng ứng dụng này bán hàng thật. Critical là thiếu nền tảng bảo vệ dữ liệu tài chính; High là mất dữ liệu/sai tiền hoặc quy trình; Medium/Low là giới hạn vận hành và bảo trì. Đây không phải điểm CVSS.

| ID | Mức | Phát hiện và bằng chứng | Tác động |
|---|---|---|---|
| C1 | Critical | Không auth/authorization hoặc nguồn dữ liệu server đáng tin; sửa menu và đơn hoàn toàn client (`:22–29`, `:39`, `:43`) | Không thể giới hạn người sửa giá, hủy/đánh dấu đã thu hay bảo đảm tính toàn vẹn sổ bán hàng. Không phải bằng chứng sửa dữ liệu của thiết bị khác từ xa |
| H1 | High | Hai tab ghi toàn bộ mảng từ snapshot riêng, không merge/listener (`:19`, `:22–29`); đã tái hiện chỉ còn 1/2 đơn | Mất đơn hoặc ghi đè trạng thái; UI các tab không thống nhất |
| H2 | High | `setState` trước `setItem`, không catch lỗi ghi (`:22–23`); đã tái hiện lỗi quota | UI có đơn chưa được lưu; reload mất đơn; thử lại có nguy cơ tạo trạng thái không nhất quán |
| H3 | High | localStorage là bản dữ liệu duy nhất; đọc JSON lỗi âm thầm fallback (`:16`) | Xóa dữ liệu site/profile mất lịch sử; lỗi JSON có thể che lịch sử rồi lần ghi sau thay thế bằng dữ liệu mới; không backup |
| H4 | High | Không đồng bộ PC/mobile; đã kiểm tra storage độc lập | Pha chế trên điện thoại không nhận đơn từ PC; không đáp ứng vận hành đa thiết bị |
| H5 | High | Handler sửa giá dùng `Number` không kiểm tra hữu hạn/không âm (`:39`); tổng không validation (`:25`, `:28`); đã tái hiện -1.000 | Giá âm có thể tạo tổng âm; `min` trên input ngoài form submit không bảo vệ handler |
| H6 | High | App tự đã thu; hoàn tất đơn chưa thu; không paidAt/refund/transaction (`:28`, `:43`) | Không phân biệt đã giao/đã thu/đã đối soát; dễ bỏ sót tiền hoặc phản ánh sai dòng tiền |
| H7 | High | Không uniqueness mã app hoặc idempotency (`:28`); đã lưu hai đơn cùng mã app | Một đơn ngoài app có thể nhập nhiều lần, tăng giả số đơn/doanh thu. Chưa tái hiện double-click gây hai đơn trong browser |
| M1 | Medium | Lọc báo cáo theo createdAt và timezone máy (`:17`, `:30–31`); đã tái hiện thu đơn hôm trước không vào hôm nay | Nhãn “đã thu hôm nay” không đúng dòng tiền thực tế; máy khác timezone có thể phân ngày khác |
| M2 | Medium | Cart giữ snapshot giá/active (`:26`, `:28`); đã kiểm tra món tắt bán vẫn chốt được | Thiếu quyết định rõ về giữ giá cũ/revalidate lúc chốt; có thể bán món đã ngừng |
| M3 | Medium | `read` chỉ kiểm tra Array; đã tái hiện `[null]` gây lỗi render (`:16`, `:36`) | Dữ liệu cục bộ hỏng làm UI không hoạt động, không có cơ chế phục hồi |
| M4 | Medium | Hotline phone/address vẫn lưu sau đổi kênh (`:20`, `:28`); đã tái hiện | Lưu thừa thông tin khách vào đơn khác, tăng rủi ro trên máy dùng chung |
| M5 | Medium | Giỏ chỉ trong state, đã kiểm tra mất sau khởi tạo lại (`:20`) | Reload/đóng tab làm mất đơn đang nhập |
| M6 | Medium | Mã hiển thị chỉ 8 chữ số cuối timestamp (`:28`), lặp sau khoảng 27,78 giờ hoặc cùng ms | Có thể nhầm khi tìm/đối soát. UUID nội bộ riêng nên không kết luận đè record do trùng mã hiển thị |
| M7 | Medium | Không lint/typecheck/tests/CI trong repository | Không có kiểm tra hồi quy nghiệp vụ trước release |
| L1 | Low | Navigation chỉ state (`:19`, `:32`); không deep link/back từng màn hình | Giảm khả năng điều hướng và khôi phục ngữ cảnh |
| L2 | Low | JSX/CSS nén thành các dòng dài; nút +/- chỉ icon, nhiều field chỉ placeholder (`:36`, `:39`) | Khó review/bảo trì; thiếu accessible name/label rõ ràng ở một số điều khiển |

Không xác nhận lỗi tính số học ở luồng hợp lệ 49.000 và hotline 32.000. Rủi ro sai tổng hiện được tái hiện qua giá âm, dữ liệu không được kiểm tra và quy tắc thu tiền; không suy rộng thành mọi đơn đều tính sai.

## 9. Đối chiếu yêu cầu quán nhỏ

| Yêu cầu | Đánh giá |
|---|---|
| Một quán, không bàn/đa chi nhánh | Đúng phạm vi hiện tại |
| Tại quán | Có luồng demo; thiếu bảo vệ dữ liệu và kiểm soát thu tiền |
| GrabFood/ShopeeFood | Có nhập thủ công; chưa đồng bộ app, chống trùng/đối soát |
| Hotline | Có dữ liệu giao và ship; chưa hoàn chỉnh validation/bảo vệ thông tin |
| Thu ngân–pha chế–thanh toán | Có UI trạng thái; chưa liên thông nhiều thiết bị hoặc ràng buộc nghiệp vụ |
| Sản phẩm và giá | Có CRUD một phần; thiếu quyền quản lý và validation |
| Báo cáo | Có số liệu cục bộ theo ngày tạo; chưa là sổ thu tiền đáng tin |
| PC và điện thoại | Có responsive CSS; không đồng bộ dữ liệu; chưa nghiệm thu UI thiết bị |
| Cài đặt | Chưa có |

## 10. Backlog P0/P1/P2

### P0 — trước khi dùng bán hàng thật

- Chốt định nghĩa tổng tiền, thu tiền, app settlement, hoàn tất/hủy/hoàn tiền và thời điểm ghi nhận báo cáo.
- Thiết kế API + database dùng chung, transaction, constraints, idempotency và version chống ghi đè. Neon/PostgreSQL là phương án xem xét, chưa được cấu hình hay thay đổi trong audit.
- Xác thực và quyền tối thiểu chủ quán/thu ngân/pha chế; bảo vệ thao tác sửa giá, hủy/hoàn tiền và dữ liệu khách ở server.
- Validation server cho giá/số lượng/phí ship; chốt snapshot giá khi tạo đơn; timestamp/ID đáng tin; xử lý lỗi lưu minh bạch.
- Backup/restore và phương án bảo toàn dữ liệu demo hiện có trước migration; không tự đưa localStorage hiện tại thành sổ kế toán chuẩn.
- Thêm kiểm thử trọng yếu: tạo đơn idempotent, hai phiên đồng thời, chuyển trạng thái, thanh toán, tổng tiền, báo cáo; không cho rollout nếu mất/sai đơn.

### P1 — hoàn chỉnh vận hành một quán

- Đồng bộ thu ngân–pha chế PC/mobile, reconnect và hiển thị trạng thái đồng bộ; kiểm thử hai thiết bị thật.
- Nhật ký người thao tác, lịch sử thanh toán/hủy/hoàn tiền và đối soát theo phương thức/kênh.
- Báo cáo theo múi giờ quán, khoảng ngày, phân biệt tiền món/ship/phí app và thu tiền theo thời điểm giao dịch.
- Lọc/tìm đơn, phân trang; hiển thị rõ chưa thu/đã thu; quyết định màn hình bàn giao đơn `ready`.
- Bảo toàn giỏ nháp, xử lý storage hỏng, tránh giữ thông tin hotline khi đổi kênh.
- Lint và kiểm tra kiểu phù hợp stack đã thống nhất, CI build/test; QA responsive/accessibility trên PC/mobile.

### P2 — nâng chất lượng theo nhu cầu đã xác nhận

- Tách logic lưu trữ/nghiệp vụ khỏi component, định dạng source; giữ React/Vite nếu vẫn phù hợp.
- Sửa tên/nhóm món, cấu hình quán, xuất báo cáo, in phiếu nếu chủ quán cần.
- Navigation theo URL và khôi phục màn hình; cải thiện tìm kiếm tiếng Việt nếu cần.
- Xem xét tích hợp chính thức app giao đồ ăn sau khi xác nhận quyền API và quy trình đối soát.
- Không thêm quản lý bàn hoặc đa chi nhánh vào backlog hiện tại.

## 11. Đề xuất 5 thay đổi ưu tiên tiếp theo

1. **Chốt quy tắc đơn hàng và thanh toán:** đặc tả state machine, thời điểm thu, app settlement, hủy/hoàn tiền và tiêu chí báo cáo; dùng làm tiêu chí nghiệm thu.
2. **Bổ sung dữ liệu dùng chung qua backend/database:** giao dịch, unique constraints và idempotency để không mất/trùng đơn; kèm backup và phục hồi.
3. **Bổ sung xác thực và phân quyền phía server:** chỉ người được phép sửa giá/hủy/thu tiền; ghi nhật ký thao tác, giới hạn truy cập thông tin khách.
4. **Bảo vệ tổng tiền và luồng lưu:** validation, snapshot giá rõ ràng, ràng buộc chuyển trạng thái, ghi nhận giao dịch thu/hoàn tiền và báo lỗi lưu đúng thực tế.
5. **Đồng bộ PC–điện thoại và nghiệm thu bằng kiểm thử:** xác nhận thu ngân tạo đơn, pha chế nhận/xử lý, thu tiền, báo cáo khớp trên hai thiết bị; thêm test hồi quy cho 16 tình huống đã khảo sát.

Các mục trên là đề xuất sau audit, chưa được triển khai. Chưa chọn thêm module/framework, chưa thay đổi database và chưa phát hành phiên bản mới.
