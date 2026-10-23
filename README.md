# Trạm Cà Phê — POS MVP

Website quản lý bán hàng **một quán cà phê**, hỗ trợ 3 hình thức: tại quán (không quản lý bàn), đơn từ app (GrabFood / ShopeeFood) và đơn từ hotline.

## Tính năng bản MVP
- Bán hàng POS: chọn món, số lượng, ghi chú, nguồn đơn.
- Hotline: tên khách, số điện thoại, địa chỉ và phí giao hàng.
- App: ghi mã đơn, chọn app.
- Danh sách đơn, trạng thái pha chế, xác nhận đã thu tiền, hủy đơn.
- Quản lý menu: thêm món, đổi giá, bật/tắt món.
- Báo cáo doanh thu theo ngày và kênh bán (chưa trừ chiết khấu app).
- Responsive cho PC và điện thoại.

## Chạy trong VS Code
1. Cài Node.js LTS và mở thư mục dự án bằng VS Code.
2. Mở Terminal và chạy `npm install`.
3. Chạy `npm run dev` rồi mở URL được in ra (thường là `http://localhost:5173`).
4. Kiểm tra bản build: `npm run build`.

## Đưa lên GitHub + Vercel
1. Tạo repository GitHub mới (ví dụ `tram-ca-phe-pos`).
2. Trong Terminal:
   ```bash
   git init
   git add .
   git commit -m "Initial Trạm Cà Phê POS MVP"
   git branch -M main
   git remote add origin https://github.com/USERNAME/tram-ca-phe-pos.git
   git push -u origin main
   ```
3. Vercel → Add New Project → Import repository GitHub → Framework Preset: **Vite** → Build Command: `npm run build` → Output Directory: `dist` → Deploy.
4. Sau này đẩy code lên nhánh `main`, Vercel tự cập nhật khi Git integration đã được thiết lập.

## QUAN TRỌNG — Chưa phải hệ thống production
Bản này cố ý chỉ là **demo frontend**: dữ liệu nằm trong `localStorage` của **từng trình duyệt**, không đồng bộ PC/điện thoại, không có tài khoản, phân quyền, database hay backup. Không dùng cho việc bán hàng thực tế, nhất là khi nhiều nhân viên cùng thao tác. Cần thêm backend, PostgreSQL, xác thực/phân quyền và giao dịch đơn hàng trước khi đưa quán vào vận hành. Không nhập thông tin khách thật trong bản demo công khai.
