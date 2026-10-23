# Trạm Cà Phê — nghiệp vụ POS đơn giản

Ngày cập nhật: 24/10/2026. Thay thế các đề xuất về pha chế, tích hợp app và phí giao hàng trong AUDIT.md; audit vẫn là bằng chứng lịch sử của bản cũ.

## A. Phạm vi và tiêu chí nghiệm thu

- React + Vite, một quán; đúng bốn kênh tạo đơn: `store` Tại quán, `takeaway` Mang đi, `app` App, `hotline` Hotline.
- App nhập thủ công; mã đơn app tùy chọn. Không API GrabFood/ShopeeFood. Mã app có nhập phải duy nhất trong các đơn mới; dữ liệu trùng đã có không bị xóa.
- Chỉ tạo/lưu đơn và xác nhận đã thanh toán. Đơn mới mặc định chưa thanh toán ở cả bốn kênh; có checkbox xác nhận đã thanh toán khi lưu. Không chọn tiền mặt/chuyển khoản. Không trạng thái pha chế, hoàn tất hoặc hủy mới.
- Hotline giữ tên tùy chọn, điện thoại và địa chỉ bắt buộc; không trường ship, không cộng ship. Chuyển khỏi Hotline không lưu thông tin khách vào kênh khác.
- Tổng đơn mới là tổng snapshot giá món × số lượng. Giá là số nguyên VND >= 0, số lượng nguyên từ 1 đến 999; tổng phải là safe integer. Không chấp nhận rỗng, NaN, Infinity, số âm hoặc số lẻ cho giá/số lượng.
- Snapshot giá được chốt khi tạo đơn từ menu mới nhất. Nếu giá đổi trong khi nhập, yêu cầu cập nhật giỏ và xác nhận lại trước khi lưu; món bị tắt không thể chốt. Giá đơn đã lưu bất biến khi menu đổi.
- Chống tạo trùng bằng khóa thao tác, ID giỏ dùng lại cho retry và kiểm tra mã app. Không chặn hai đơn giống món nhưng là hai lần bán có chủ ý. Dùng Web Locks cùng origin để tuần tự hóa thao tác; trình duyệt thiếu Web Locks chỉ được đọc và báo rõ khi ghi.
- Đánh dấu đã thanh toán một chiều, có `paidAt` ISO; thao tác lặp giữ nguyên timestamp. Không tự coi App là đã thu; không tạo thời điểm thu giả cho lịch sử cũ.
- Không quản lý bàn, đa chi nhánh, CRM; không thêm backend/framework trong PR UI này.
- Đây vẫn là demo localStorage: không đồng bộ PC/điện thoại, chưa auth/phân quyền, không dùng bán hàng thật hoặc thông tin khách thật. Giữ thông báo này trên cả PC/mobile.

## Báo cáo cuối ngày (Asia/Ho_Chi_Minh)

Chọn ngày, mặc định ngày hiện tại của quán:

1. **Doanh số đơn ngày:** tổng giá trị đơn được tạo trong ngày, kể cả chưa thanh toán; loại đơn cũ đã hủy.
2. **Đã thanh toán của đơn ngày / Chưa thanh toán của đơn ngày:** chia doanh số đơn theo trạng thái hiện tại; hai số cộng lại bằng doanh số. Khi thanh toán ngày sau, phần chia của ngày tạo đơn sẽ thay đổi.
3. **Khoản thanh toán ghi nhận trong ngày:** dựa riêng vào `paidAt`, có thể gồm đơn ngày trước. Đây là chỉ số khác doanh số đơn; không suy luận paidAt từ createdAt.
4. Bảng bốn kênh có số đơn, doanh số, đã thanh toán, chưa thanh toán; lịch sử kênh lạ có dòng riêng để không mất số liệu.
5. Đơn cũ paid=true nhưng chưa có paidAt vẫn thuộc phần đã thanh toán của ngày tạo; không vào khoản thanh toán theo ngày, kèm số lượng cảnh báo. Tổng cũ có ship được giữ nguyên và chú thích, không sửa sổ lịch sử.

## B. Đề xuất database (chỉ thiết kế, chưa migration)

PostgreSQL qua backend API, credentials chỉ trên server. Không kết nối DB từ Vite/browser.

- `products`: UUID, tên, nhóm, `price_vnd bigint CHECK >=0`, active, version, timestamps.
- `orders`: UUID, unique idempotency_key, code unique, channel CHECK trong bốn kênh, created_at timestamptz do server cấp, total_vnd bigint CHECK >=0; thông tin Hotline chỉ tại đơn, app_reference nullable với unique index cho giá trị không rỗng. Không bảng CRM.
- `order_items`: order_id, product_id nullable, name_snapshot, price_snapshot_vnd CHECK >=0, quantity CHECK 1..999. Transaction tạo đơn tính lại tổng và kiểm tra món/giá/version; không tin tổng client.
- `order_payments`: unique order_id (phạm vi hiện tại thanh toán toàn phần một lần), amount_vnd, paid_at, actor_id, unique idempotency_key. Transaction cùng kiểm tra tổng; không phương thức tiền mặt/chuyển khoản trong yêu cầu hiện tại.
- `users/roles`, `audit_events`: chủ quán sửa menu/xem báo cáo; thu ngân tạo đơn/ghi nhận thu; server kiểm tra quyền. Không vai trò pha chế.
- `legacy_imports`: dữ liệu gốc, batch/source ID, checksum, thời gian import; giữ legacy channel/status/shipping/payment và paidAt chưa biết. Lưu cancelled cũ dưới metadata lịch sử, không mở workflow hủy mới. Import transaction có đối chiếu số lượng/tổng theo kênh/ngày và unique source ID.
- Backup/restore được nghiệm thu trước dùng thật. Tiền nguyên VND, quy tắc timezone ở server, UI không tự phát minh timestamp. Migration production phải là công việc được review riêng.

## B. Đề xuất giao diện

Bốn màn hình: Bán hàng, Đơn hàng, Sản phẩm, Báo cáo. Sidebar PC, thanh đáy bốn mục mobile. POS gồm lưới món và giỏ, bốn kênh, thông tin theo kênh, ghi chú, checkbox đã thanh toán, tổng, nút lưu có trạng thái chờ. Đơn chỉ hiển thị đã/chưa thanh toán và nút xác nhận thu; đơn hủy cũ chỉ đọc. Sản phẩm lưu giá bằng form xác nhận, không ghi ở từng phím. Báo cáo có chọn ngày và nhãn phân biệt doanh số/khoản thu. Lỗi lưu giữ giỏ và hiển thị; chỉ cập nhật thành công sau persistence.

## C. Tương thích dữ liệu cũ

- Không ghi đè/xóa `tram_orders`, `tram_products`; không chạy migration tự động khi load. Đọc và chuẩn hóa trong bộ nhớ, giữ raw legacy trong metadata khi có thao tác cập nhật.
- `grab`/`shopee` => `app` ở view, giữ kênh gốc trong metadata. `store` và `hotline` giữ nguyên. ID lưu riêng theo vị trí bản ghi legacy để không gộp nhầm các ID/mã trùng; không deduplicate lịch sử.
- Các trạng thái cũ new/preparing/ready/done không còn workflow, trạng thái thu theo paid; cancelled cũ giữ cờ lịch sử, không đưa doanh số và không cho thu tiền.
- Giữ tổng tiền/snapshot/ship/payment/thông tin gốc; không trừ ship hoặc sửa paid cũ. paid=true không có paidAt => null, cảnh báo chưa biết ngày thu. Chỉ thao tác thu mới cấp paidAt.
- Đơn mới/cập nhật dùng từng khóa `tram_order_v2:<storageId>`, version 2. Menu mới dùng `tram_products_v2`. Đọc legacy + overlay v2; không rewrite toàn bộ mảng đơn. Web Locks ngăn race giữa các tab hỗ trợ; storage event làm mới view. Không hứa đồng bộ thiết bị. Phải đóng các tab UI phiên bản cũ trước thử chuyển đổi; writer bản cũ không tham gia Web Locks và có thể sửa legacy source.
- JSON/schema hỏng: báo lỗi, khóa ghi và không fallback mảng rỗng; giữ nguyên dữ liệu gốc. Quota/storage denied: lỗi rõ ràng, không xóa giỏ hay báo thành công. Không tự sửa hoặc loại dữ liệu lỗi.
- Rollback về UI cũ vẫn thấy dữ liệu gốc nhưng không thấy ghi mới v2; cần xuất/import có review khi rollback thực tế. Không dual-write vào mảng cũ vì có thể ghi đè dữ liệu; không tự deploy nhánh này.

## D. Test cần chạy

- Domain: đúng bốn kênh; mọi kênh mặc định unpaid; chọn paid cấp paidAt; thu lặp idempotent; snapshot và totals; zero/negative/fraction/NaN/Infinity/overflow/qty 0/1000; Hotline required, không ship/phương thức.
- Idempotency: submit đôi, retry, trùng app reference; hai đơn giống món có chủ ý; hai tab tạo/thu đồng thời không mất đơn và giữ paidAt; lỗi storage/retry.
- Migration: mọi trạng thái/kênh legacy, cancelled, paidAt unknown, tổng có ship, duplicate IDs, unknown channel, raw không thay đổi, overlay giữ lịch sử, reload, JSON/schema hỏng chặn ghi.
- Reports: bốn kênh, paid + unpaid = sales, cancelled loại, paidAt ngày sau/đơn ngày trước, ranh giới ngày VN, ngày có/không đơn, legacy unknown timestamp.
- UI: không pha chế/ship/cash-transfer; bốn navigation và kênh; thao tác giỏ/Hotline/App/lưu/thu/menu/báo cáo; lỗi giữ giỏ; rapid click; viewport PC/mobile, label/keyboard, không overflow.
- Build: `npm test`, `npm run build`, kiểm tra source diff, review React. Không khai báo lint/typecheck pass khi chưa có tooling.
