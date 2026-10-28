# Trạm Cà Phê — yêu cầu hiện hành (28/10/2026)

Nguồn: file yêu cầu “CODEX — Xây lại Trạm Cà Phê thành web quản lý quán đơn giản” do chủ quán cung cấp. Tài liệu này thay yêu cầu bốn kênh của PR #1: **không còn chọn kênh bán trên giao diện mới**.

## Vai trò và màn hình

- STAFF: **Bán hàng | Ca làm**.
- OWNER: **Bán hàng | Dashboard | Kho & Menu | Chi phí | Nhân viên**.
- Một frontend React + Vite responsive, dùng chung PostgreSQL qua API. Không lấy localStorage làm dữ liệu kinh doanh chính.
- Không bàn/bếp/in hóa đơn/mã đơn hiển thị/shipping/CRM/đa chi nhánh/luồng trạng thái phức tạp/API giao hàng.

## Bán hàng

Tìm tên, không dấu hoặc alias; `cafe` ra Cà phê. Chuột/touch hoặc Enter chọn kết quả đầu. Giá do menu cấp, +/- số lượng 1–999, xóa món, ghi chú mỗi món, tổng tự động, checkbox Đã thanh toán và nút Lưu. Không nhập mã, ngày giờ, kênh hoặc phương thức thu tiền.

Server tính lại giá theo version, chốt snapshot từng dòng; lưu giao dịch/món/tiêu hao công thức/thanh toán tùy chọn/audit/idempotency trong một transaction. Thiếu công thức, thiếu kho, giá cũ hoặc payload tiền tự nhập phải bị từ chối và rollback. Thanh toán sau chỉ tạo bản ghi tiền/paidAt, không tiêu hao thêm. OWNER hủy có lý do, audit, hoàn đúng lượng tiêu hao một lần. Hủy đã thu phải giữ chứng từ và cảnh báo đối soát hoàn tiền; không giả lập hoàn tiền.

Mất phản hồi: giữ nguyên body/key để thử lại, lưu pending draft trong sessionStorage theo user để reload không tạo key mới. Đây là bản chờ gửi/xác nhận, không phải kho dữ liệu kinh doanh. Không tự báo thành công trước khi server xác nhận. Không gửi offline.

## Kho & Menu (OWNER)

Menu gồm tên, alias, giá VND nguyên không âm, active (ngừng bán thay xóa lịch sử), note pha chế. Công thức tham chiếu nguyên liệu + lượng có tối đa 3 số lẻ; đơn vị giữ nguyên g/ml/cái của nguyên liệu, không tự đổi đơn vị.

Nguyên liệu: tên, đơn vị, tồn đầu, mức tối thiểu, đơn giá mỗi đơn vị. Nhập hàng: ngày, lượng dương, đơn giá, nhà cung cấp tùy chọn. Điều chỉnh: lượng có dấu, lý do bắt buộc, không tạo tồn âm. Sổ biến động bất biến gồm tồn đầu, nhập, điều chỉnh, tiêu hao, hoàn; tồn cache được cập nhật cùng transaction và khóa hàng theo thứ tự ID.

Đề xuất mua xét mức tối thiểu và tiêu hao 7 ngày gần nhất. Giá vốn **ước tính theo giá nhập gần nhất tại lúc tiêu hao**, chốt trong ledger, chỉ OWNER xem. Chưa có phương pháp kế toán FIFO/thuế hoặc dự báo nâng cao.

## Ca làm

STAFF đăng ký khung ngày giờ (tối đa 24h, không trùng lịch), xem ca của mình theo ngày/tuần/tháng, check-in/out theo giờ server, tổng giờ từ thời điểm thực tế. Mỗi người tối đa một ca đang check-in. OWNER xem mọi ca, sửa giờ thực tế với lý do/version/audit. Không payroll/GPS.

## Chi phí và Dashboard (OWNER)

Chi phí vận hành: ngày, khoản mục, số tiền dương, note. Tiền mua nguyên liệu chỉ ghi sổ kho, không cộng lần nữa vào chi phí vận hành.

Dashboard ngày/tuần/tháng: doanh số theo thời điểm bán, đã thu theo paidAt, chưa thu của giao dịch trong kỳ, món bán/top món/giờ tốt, giá vốn tiêu hao, lợi nhuận gộp, chi phí/kết quả ước tính, kho thấp và giờ nhân viên. Giao dịch hủy loại khỏi doanh số/tiêu hao hợp lệ; tiền đã ghi nhận giữ lịch sử và hiện khoản hủy cần đối soát. Không âm thầm coi khoản đã thu là đã hoàn.

## Dữ liệu cũ và an toàn

Không ghi/xóa/import tự động các khóa localStorage cũ. Domain/storage legacy và test bảo toàn còn giữ để đối soát; UI cũ không được đưa vào bundle mới. DB mở rộng bằng migration, không rewrite chứng từ cũ. Không tự nhập Excel: phải kiểm tra file, chủ quán xác nhận đơn vị/công thức/giá thiếu trước. Không seed DEMO vào production.

Không merge main, không deploy production, không migrate production. Cloud chỉ đạt nghiệm thu sau cấp DB thử, auth, migration thử, backup/restore drill và kiểm thử hai thiết bị trên Preview thật.
