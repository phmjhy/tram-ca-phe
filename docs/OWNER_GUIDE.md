# Hướng dẫn quán — bản PR#2, 05/11/2026

Hiện chỉ dùng Preview để kiểm thử. Production vẫn bản cũ cho đến khi phê duyệt triển khai. Không nhập dữ liệu khách thật vào Preview.

## Mỗi ngày

1. Mở cùng website trên PC/điện thoại, đăng nhập tài khoản riêng. STAFF chỉ có Bán hàng/Ca làm; OWNER có thêm Dashboard, Kho & Menu, Chi phí, Nhân viên.
2. Chờ **Đã đồng bộ** trước khi lưu. Tìm món bằng tên, không dấu hoặc alias; Enter chọn món tìm được. Kiểm tra số lượng, ghi chú và tổng; chỉ tick **Đã thanh toán** khi đã nhận tiền.
3. Bấm **Lưu**. Chỉ coi là xong khi server xác nhận và đơn xuất hiện trong lịch sử. Mất mạng/lỗi: giữ nội dung, không nhập thành đơn mới. Giỏ chờ được giữ theo tài khoản trong phiên trình duyệt; reload và thử lại cùng thao tác.
4. Nếu thấy **Thao tác chờ xác nhận** (tạo món/NVL, kho, chi phí, ca), bấm nút thử lại tương ứng trước khi nhập nội dung mới. Không đổi dữ liệu của một thao tác đang chưa rõ kết quả.
5. Món chưa có công thức hoặc không đủ kho không bán được. Nhờ OWNER bổ sung; không nhập số tồn giả để vượt kiểm tra. Trước mở bán cần kiểm kê tồn đầu và đặt tồn tối thiểu thật.
6. STAFF đăng ký ca, check-in khi bắt đầu và check-out khi kết thúc. Giờ thực tế do server ghi; OWNER sửa sai giờ phải có lý do.

## OWNER quản lý

- **Món:** thêm tên/giá/alias, lưu rồi nhập công thức ngay. Giá bán là VND nguyên; giá NVL/định lượng tối đa3 số thập phân. Đơn vị g/ml/cái phải khớp; không tự đổi g sang ml. Đồ chai/hộp đếm riêng dùng cái. Ngừng bán thay cho xóa lịch sử.
- **Kho:** ghi Nhập hàng theo lượng/đơn giá cùng đơn vị. Nếu đã ghi tồn đầu của một lô thì không nhập hàng lần nữa cho cùng lô. Điều chỉnh tăng/giảm cần lý do; hệ thống chặn tồn âm. Khi báo dữ liệu đã đổi, tải lại trước khi sửa, không ghi đè draft của phiên khác.
- **Giá vốn:** chốt theo đơn giá lúc bán. Sửa giá NVL không đổi tồn hoặc giá vốn cũ; nhập hàng mới cập nhật đơn giá cho lần tiêu hao sau.
- **Thanh toán/hủy:** tick trả tiền sau không trừ kho lần hai. Hủy có lý do, hoàn đúng lượng tiêu hao một lần. Hủy đơn đã thu vẫn giữ chứng từ thu và hiện cảnh báo đối soát; phần mềm không tự hoàn tiền cho khách.
- **Chi phí:** chỉ ghi chi phí vận hành. Tiền mua NVL ghi ở Kho, không ghi thêm lần nữa vào Chi phí.
- **Cuối ngày:** Dashboard tách doanh số theo ngày bán với khoản thu theo ngày thanh toán, hiển thị chưa thu, giá vốn và chi phí. Đơn cũ thanh toán hôm nay làm tăng khoản thu hôm nay, không biến thành doanh số bán mới. Đối soát riêng đơn hủy đã thu.
- **Tài khoản:** OWNER tạo STAFF, khóa/mở và reset mật khẩu trong Nhân viên. Khóa/reset thu hồi session; nhân viên đăng nhập lại bằng thông tin riêng. Không chia sẻ tài khoản OWNER. Mất quyền OWNER: liên hệ người phụ trách đã xác minh, không mở đăng ký công khai.

## Khi có sự cố

- Phiên hết hạn/khóa tài khoản: đăng nhập lại hoặc nhờ OWNER; không tạo tài khoản mới để lách quyền.
- Mất mạng/lưu chậm: không báo đơn đã xong khi chưa có xác nhận. Thử lại đúng thao tác chờ; không xóa sessionStorage hoặc chuyển trình duyệt trước khi đối soát thao tác chưa rõ.
- DB/website không truy cập được: dừng ghi trên app, ghi nhận đơn tạm riêng theo quy trình quán. Báo thời điểm và mã lỗi nếu có; không gửi password/connection string. Sau phục hồi, đối soát trước khi nhập bù để tránh trùng.
- Sai dữ liệu: giữ nguyên chứng từ/ledger và backup; không sửa SQL hay xóa đơn. Khôi phục sang database mới và đối soát các giao dịch sau mốc backup trước khi chuyển kết nối. Xem PRODUCTION_RUNBOOK.md.

## Giữ dữ liệu cũ trước chuyển đổi

Mỗi thiết bị/browser/origin có localStorage riêng. Trên PC đang mở website cũ, nhờ người phụ trách chạy `scripts/export-legacy-browser.js` trong DevTools để tải JSON private. Script chỉ đọc các khóa tram_orders/tram_products/tram_products_v2/tram_order_v2:*, giữ nguyên chuỗi gốc, không đọc token hoặc sửa storage. Không gửi file kinh doanh vào chat/Git.

Điện thoại cần quy trình remote inspection phù hợp browser/thiết bị; chưa có quyền truy cập thiết bị thực nên chưa xuất được dữ liệu ở đó. Lập danh sách thiết bị và người giữ file, kiểm tra file tải được trước khi chuyển hệ thống. Không tự gộp hoặc xóa dữ liệu cũ.

Trước mở bán, chủ quán thử thêm bàn phím ảo trên điện thoại thật để chắc nút Lưu/nhập liệu không bị che. Kiểm thử hiện tại dùng browser viewport320/390px và thao tác keyboard, chưa chứng nhận bàn phím native iOS/Android.
