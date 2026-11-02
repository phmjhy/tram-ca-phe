# Menu và nguyên liệu cần duyệt trước vận hành

> 02/11/2026: nguồn mới và kết quả hiện hành ở [MENU_REVIEW_2026-11-02.md](MENU_REVIEW_2026-11-02.md). Nội dung bên dưới là đối chiếu nguồn cũ ngày01/11, không dùng làm danh sách nhập mới.

Ngày đọc:01/11/2026. Chỉ đọc, không sửa Sheets, không import vào Neon.
Nguồn được tìm thấy qua Google Drive đã kết nối: [quản lí cafe](https://docs.google.com/spreadsheets/d/1TTl_wsa8lhYHEDbhBOkegRuO7HEKHaSobUXPvp-1hNA/edit).

Đã đọc metadata và các vùng: `menu món!A1:J100` (sheetId123456789), `Danh sách NVL!A1:J100` (1142153512), `Công thức - cost!A8:J180` (303164769). Đây là phạm vi đã kiểm tra; không khẳng định đã rà mọi ô trong workbook. Không đọc các tab thông tin cá nhân/nhà cung cấp. Không đưa bảng giá vốn/chi tiết dữ liệu kinh doanh gốc vào Git.

## Đã có và còn thiếu

- Trong vùng đã đọc:46 dòng món có tên/giá;25 dòng nguyên liệu;31 dòng món chưa có giá vốn dạng số. Có công thức dạng văn bản và các khối nguyên liệu/định lượng, chưa phải dữ liệu chuẩn hóa được chủ quán duyệt.
- Không thấy tên nguyên liệu trùng sau trim/NFC/lowercase trong25 dòng; chưa giải quyết alias/tên gần giống hoặc trùng nghĩa. Không tự gộp.
- Chưa có snapshot dữ liệu thật đã ký duyệt, ngày hiệu lực, alias/trạng thái bán, tồn mở đầu/tồn tối thiểu từng nguyên liệu. Không mặc định các ô thiếu là0 hoặc đang bán.
- Dữ liệu trong source/demo và Neon Preview là TEST/demo, không thay thế dữ liệu thật.

## Bảng chủ quán duyệt

Các mục dưới đây là quyết định còn thiếu, không phải giá trị được tự đề xuất. Chủ quán điền trên bản dữ liệu private, không gửi password hoặc thông tin khách vào bảng này.

| Nguồn/phạm vi | Vấn đề đã quan sát | Cần xác nhận | Trạng thái |
|---|---|---|---|
| menu món,46 dòng | Chưa có cột duyệt/active/alias; mã hàng trống | Mã ổn định, tên chuẩn, giá hiệu lực, alias, bán/ngừng từng món | CHỜ DUYỆT |
| menu món dòng33 | Tên món được Sheets trả về dạng số | Xác nhận đây là tên thương mại, chuyển thành text rõ ràng | CHỜ DUYỆT |
| menu món dòng34 | Thiếu phân loại | Phân loại chính thức | CHỜ DUYỆT |
| menu món,31 dòng | Cost trống hoặc “Thiếu giá vốn” | Bổ sung đủ công thức/nguyên liệu; không lấy0 thay thế | CHỜ DUYỆT |
| Danh sách NVL,25 dòng | Chưa có tồn mở đầu/tồn tối thiểu | Số kiểm kê thực tại thời điểm cutover, đơn vị và người kiểm kê | CHỜ DUYỆT |
| NVL dòng8,16 | Thiếu giá/quy đổi | Giá/đơn vị chuẩn, nguồn chứng từ | CHỜ DUYỆT |
| NVL dòng9–15,17,21 | Có Hộp/Chai hoặc đóng gói khác đơn vị hệ thống | Quy đổi xác nhận sang cái/g/ml, giá mua theo thùng hay từng đơn vị | CHỜ DUYỆT |
| NVL dòng3,6,26 | Quy đổi g nguyên liệu thành ml thành phẩm | Hiệu suất pha chế thực, cách tính giá và tồn; không dùng mật độ tự đoán | CHỜ DUYỆT |
| NVL dòng18,24 | Thiếu đơn vị pha chế | Chọn g/ml/cái đúng nghiệp vụ | CHỜ DUYỆT |
| Công thức: sữa đặc | Ghi chú menu có ml, bảng định lượng dùng Gram | Đơn vị đo thực và lượng chuẩn, không tự đổi ml=g | CHỜ DUYỆT |
| Công thức: Bạc xỉu/Americano | Mô tả văn bản khác nguyên liệu/định lượng bảng công thức | Chọn công thức có hiệu lực và cách tính nước/đường | CHỜ DUYỆT |
| Tên món giữa menu/công thức | Matcha latte so với M/L; xúc xích so với tên mã; orange americano so với mô tả món dừa | Map rõ một món–một công thức, không đoán theo gần giống | CHỜ DUYỆT |
| Công thức kem muối/mì | Một số khối có tên nhưng trống nguyên liệu/định lượng | Công thức đủ; đồ đóng chai cần công thức1 cái nếu quản lý kho như nguyên liệu | CHỜ DUYỆT |
| Công thức có “muỗng”,“hủ”,“1/4 miếng” | Không phải đơn vị g/ml/cái định lượng rõ | Đo thực tế và xác nhận chuẩn; không tự đặt gram/ml | CHỜ DUYỆT |
| Phạm vi kinh doanh | Có hàng ngoài đồ uống trong sheet | Chủ quán duyệt mặt hàng nào thuộc lần mở bán này; không tự xóa hay tự thêm module | CHỜ DUYỆT |

## Dữ liệu bàn giao tối thiểu

1. **Món:** externalKey, name(text), category, priceVnd(số nguyên≥0), aliases, active, approvedBy, approvedAt.
2. **Nguyên liệu:** externalKey, name, unit chỉ g/ml/cái, opening≥0, minimum≥0, unitCost≥0; số thập phân tối đa3 chữ số theo numeric(15,3) và API hiện tại. Kèm nguồn quy đổi và ngày kiểm kê.
3. **Công thức:** productKey, ingredientKey, quantity>0 tối đa3 số thập phân, cùng đơn vị nguyên liệu. Mỗi cặp chỉ1 dòng; tối đa100 nguyên liệu/món theo API. Đánh dấu rõ món nào không mở bán vì chưa đủ công thức.
4. **Duyệt:** người duyệt, ngày hiệu lực, bản nguồn bất biến, mã phiên bản/hash, ghi chú ngoại lệ. Không đưa lịch sử đơn/payments hoặc credential vào file menu.

## Cách nhập đơn giản, chưa thực thi

Ưu tiên OWNER nhập qua UI hiện có khi danh sách đã duyệt: nguyên liệu/tồn mở đầu → món → công thức → kiểm tra lại giá vốn, sau đó bật bán. Tồn mở đầu phải tạo ledger opening bằng API, không update trực tiếp stock.

Nếu nhập hàng loạt cần thiết, làm một PR nhỏ riêng cho dry-run trước: đọc file private, không kết nối/ghi DB ở bước preview; báo lỗi theo dòng/mã, thiếu field, kiểu số, biên giá/số lượng, duplicate normalize, reference không tồn tại, sai đơn vị, thiếu công thức và thiếu approval. Số lượng bất thường chỉ cảnh báo để chủ quán xác nhận, không tự sửa. Chưa có ngưỡng nghiệp vụ được duyệt thì không tự đặt định mức.

Sau dry-run sạch: chủ quán duyệt diff, chạy lại đọc current version, dùng mapping externalKey→id và idempotency key theo bản nhập. Không nhận lại cùng tên như một món mới; collision khác giá/công thức phải báo conflict và duyệt riêng. Retry dùng lại key/resource, không tạo trùng. Có audit và kết quả từng dòng, dừng khi trạng thái ghi không chắc chắn. Không UPDATE/DELETE orders, payments, stock_movements hoặc tài khoản; không ghi đè giá vốn lịch sử. Chưa xây hoặc chạy importer trong lượt này.
