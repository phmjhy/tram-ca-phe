# Trạm Cà Phê — POS demo

React + Vite cho một quán nhỏ, giao diện PC/mobile. Bốn kênh: **Tại quán, Mang đi, App, Hotline**. Đơn App nhập tay; không tích hợp API app giao hàng. Không quản lý bàn, đa chi nhánh, CRM hoặc pha chế.

## Chạy và kiểm tra

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

`npm test` dùng Node test runner, không thêm framework. Các test JSX dùng esbuild có sẵn qua Vite để chạy handler của component trong bộ giả lập hooks, không thay thế browser E2E. Chưa có lint/typecheck script. Dùng Node 24 như môi trường kiểm tra hiện tại.

## Nghiệp vụ

Chọn món → chọn kênh → lưu đơn (mặc định chưa thanh toán) → xác nhận đã thanh toán. Có thể đánh dấu đã thanh toán ngay khi lưu, ghi `paidAt`. Không có phí ship hoặc lựa chọn tiền mặt/chuyển khoản. Giá món được snapshot khi tạo đơn; sửa menu không sửa lịch sử.

Báo cáo theo ngày Việt Nam: doanh số đơn và phần đã/chưa thanh toán của các đơn tạo trong ngày; khoản thanh toán theo `paidAt` được trình bày riêng.

Chi tiết: [Yêu cầu, database đề xuất, tương thích và test](docs/REQUIREMENTS.md), [Audit bản gốc](AUDIT.md), [Kết quả kiểm tra thay đổi](docs/VERIFICATION.md).

## Dữ liệu và giới hạn

**Chỉ là demo localStorage. Không dùng bán hàng thật hoặc nhập thông tin khách thật. Chưa có backend, PostgreSQL, đăng nhập hay phân quyền; không đồng bộ PC/điện thoại.**

- Khóa dữ liệu cũ `tram_orders`, `tram_products` giữ nguyên, chỉ đọc. `grab`/`shopee` được hiển thị dưới App; giữ nguyên tổng tiền và snapshot cũ, kể cả tổng có phí giao. Không tự suy luận thời điểm thu cho đơn cũ.
- Ghi mới theo từng `tram_order_v2:<storageId>` và `tram_products_v2`; không xóa/trộn các bản ghi cũ cùng ID. Dùng Web Locks để tránh race ở các tab cùng origin; storage event cập nhật view. Trình duyệt thiếu Web Locks chỉ xem được dữ liệu.
- JSON/schema lỗi được báo rõ và chặn ghi; lỗi quota không xóa giỏ. Không tự sửa dữ liệu. Xóa dữ liệu trình duyệt vẫn gây mất dữ liệu; chưa có backup tự động.
- Rollback UI cũ không đọc được ghi mới v2. Cần phương án xuất/import có review trước rollback hoặc migration thực tế.
- PostgreSQL, API, transaction, backup và phân quyền vẫn là điều kiện bắt buộc trước triển khai vận hành thật; thiết kế trong tài liệu chỉ là đề xuất, chưa áp dụng database.

Production branch vẫn `main`; Vercel build `npm run build`, output `dist`. PR này không cho phép merge hoặc deploy production tự động.
