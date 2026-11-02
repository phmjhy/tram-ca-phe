# Đối chiếu menu mới — 02/11/2026

Nguồn chỉ đọc: [Sheets mới](https://docs.google.com/spreadsheets/d/1wVG22sTug8KtlkYAy_GF2aPOo6pqgqNS4XP7_QuJcc8/edit). Thay nguồn cũ cho đợt chuẩn bị này. Danh sách gốc là tab **công thức**, không lấy menu để tự tạo công thức.

Đã đọc metadata và đủ chiều cao3 tab trong các cột dữ liệu: menu A1:C1001 (sheetId0), Danh sách NVL A1:I1001 (1186236459), công thức A1:M1000 (564321779). Các khối mẫu không tên/không nguyên liệu được bỏ qua, không coi giá bán sót trong mẫu là món. Không sửa nguồn.

## Kết quả dry-run

- 26 công thức có tên:0 READY,25 NEEDS_CONFIRMATION,1 SKIP_STOPPED. Đây là kết quả kiểm tra dữ liệu, không phải lỗi kết nối cloud.
- 46 dòng menu,25 NVL có tên; không trùng tên chuẩn hóa NFC/trim/lowercase trong menu/NVL/công thức, không lặp NVL trong công thức. Không dùng fuzzy matching, không bỏ dấu để tự ghép tên.
- Định lượng có tên NVL đều dương và đúng giới hạn3 số lẻ. Các tham chiếu NVL đều tìm thấy sau chuẩn hóa chữ hoa/khoảng trắng. Chưa có ngưỡng định lượng nghiệp vụ được duyệt để kết luận mức tiêu hao là hợp lý.
- 30 dòng menu không có tên công thức khớp được bỏ qua. Một số là tên gần giống đang chờ mapping, không được tự tạo mới.
- Giá bán lấy duy nhất tab menu. Nước cam,247 coffee,Coca,Vải - mirinda có giá công thức khác menu: chỉ cảnh báo, **không yêu cầu quyết định lại nguồn giá**.
- Không đổi Gram↔Ml. Chỉ chuẩn hóa nhãn Gram→g, Ml→ml, Cái→cái. Giữ nguyên định lượng/đơn giá nguồn; Hộp/Chai chưa tự đổi sang cái.

## Từng công thức

| Dòng công thức | Món | Kết quả / lý do |
|---|---|---|
| 2 | Cà phê đen | Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 6 | Cà phê sữa | Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 10 | Bạc xỉu | Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 14 | Sữa chua đá | Công thức dùng Hộp/Chai; NVL dùng Hộp/Chai; Đơn giá NVL vượt3 số lẻ; chưa làm tròn; Giá chanh=0 cần xác nhận |
| 18 | xúc xích | Không có tên khớp trong menu; Đóng gói50 cái nhưng lượng dùng được25 cái |
| 22 | Cacao dầm | BỎ QUA: menu ghi ngừng bán |
| 26 | Matcha latte (M) | Không có tên khớp trong menu; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 30 | Matcha latte (L) | Không có tên khớp trong menu; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 42 | Matcha dâu | Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 46 | Matcha dừa tươi | Không có tên khớp trong menu; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 50 | cacao dâu | Không có tên khớp trong menu; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 54 | americano | Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 58 | orange americano | Không có tên khớp trong menu; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 62 | nước cam | Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 66 | sữa chua dâu | Công thức dùng Hộp/Chai; NVL dùng Hộp/Chai; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 74 | cacao latte | Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 78 | mocha cacao | Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 86 | Cà phê sữa tươi | Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 106 | 247 coffee | Công thức dùng Hộp/Chai; NVL dùng Hộp/Chai |
| 110 | redbull | Công thức dùng Hộp/Chai; NVL dùng Hộp/Chai; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 114 | coca | Công thức dùng Hộp/Chai; NVL dùng Hộp/Chai |
| 118 | Olong tea plus+ | Không có tên khớp trong menu; Công thức dùng Hộp/Chai; NVL dùng Hộp/Chai; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 122 | Sting đỏ | Không có tên khớp trong menu; Công thức dùng Hộp/Chai; NVL dùng Hộp/Chai; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 126 | sprite lon | Không có tên khớp trong menu; Công thức dùng Hộp/Chai; NVL dùng Hộp/Chai; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 130 | Mì modern | Không có tên khớp trong menu; Công thức dùng Hộp/Chai; NVL dùng Hộp/Chai; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |
| 138 | Vải - mirinda | Công thức dùng Hộp/Chai; NVL dùng Hộp/Chai; Đơn giá NVL vượt3 số lẻ; chưa làm tròn |

**9 món có tên/giá/định lượng/đơn vị khớp, chỉ chờ chính sách làm tròn giá NVL:** Cà phê đen, Cà phê sữa, Bạc xỉu, Matcha dâu, Americano, Nước cam, Cacao latte, mocha cacao, Cà phê sữa tươi. Chưa ghi READY vì backend hiện chỉ nhận3 chữ số thập phân, còn nguồn có số dài hơn.

## Chỉ các quyết định cần chủ quán chốt

1. **Độ chính xác giá NVL:** chấp thuận làm tròn đơn giá nguồn về3 chữ số thập phân (cần chốt cách làm tròn), hoặc cung cấp đơn giá chuẩn đã làm tròn. Chưa áp dụng chính sách nào. Ví dụ đơn giá sữa đặc,Robusta,đường,cam và đồ đóng chai có nhiều số lẻ. Không làm tròn giá bán.
2. **Tên/mapping10 công thức:** xúc xích ↔ xúc xích s2? Matcha latte(M)/(L) có chung món Matcha latte hay phải có2 mục menu riêng và giá nào? Olong tea plus+ ↔ olong? Sting đỏ ↔ Sting? sprite lon ↔ sprite? Mì modern ↔ Mì? Matcha dừa tươi,cacao dâu,orange americano chưa có tên khớp: thêm vào menu hay bỏ qua? Không tự map orange americano sang Americano dừa. Giá tab công thức không được dùng thay giá menu thiếu.
3. **Đơn vị đếm:** xác nhận1 Chai=1 cái và1 Hộp sữa chua/mì=1 cái cho từng NVL liên quan; giữ định lượng1 đơn vị trên một phần theo nguồn. Không tự đổi sang gram từ tên100g.
4. **Hai thông tin NVL:** dòng19 xúc xích đóng gói50 cái nhưng lượng pha chế25 cái, dẫn tới giá/đơn vị gấp đôi cách chia50: xác nhận hiệu suất đúng hay sửa nguồn. Dòng28 chanh có đơn giá0 và quy đổi Gram→Ml: xác nhận giá0 là chủ đích hay bổ sung giá/định lượng đúng. Dòng23 Mứt dâu ghi bao bì1000 Chai nhưng pha chế1000Ml: xác nhận nhãn bao bì. Các yield Gram/Kg→Ml khác đã có trong nguồn được giữ nguyên làm thông tin nguồn, không tự tính quy đổi mới.

Cacao dầm đã có ghi chú ngừng bán nên bỏ qua; không cần hỏi lại. Món chỉ có trong menu nhưng không có công thức thì bỏ qua theo yêu cầu.

## Danh sách menu tạm bỏ qua vì không khớp công thức

Cà phê kem muối, Chanh muối, Dừa, Nước chanh, Chanh sữa, Trà đường, Trà lai, Trà lipton, Lipton sữa, Trà tắc, Nước suối, C2, sprite, revive, Sting, Yuzu tea+, 7up, Mì, Mì trứng, Saigon bạc, Demi, Saigon dưa lưới, 333, xúc xích s2, olong, Americano dừa, Matcha latte, tắm, 333 anh, aquarius.

## Chuẩn bị nhập — chưa ghi database

`scripts/menu-dry-run.mjs` là validator offline đọc snapshot JSON private, chỉ dùng module built-in; không có import pg/HTTP, không đọc env/credential và không có chế độ ghi. Lệnh:

```sh
node scripts/menu-dry-run.mjs /private/path/source.json
```

Exit0 khi toàn bộ kiểm tra dữ liệu đạt, exit2 khi có lỗi/chờ xác nhận, exit1 khi input không đọc/parse được. Output chứa thông tin kinh doanh nên lưu private ngoài Git. Snapshot và kết quả lượt này giữ0600 trong thư mục0700 `/private/tmp/tram-menu-review-20261102`; không phải dữ liệu đã được duyệt để import. SHA256 nguồn: `3b342cca890ed1014a321d65979348857fd25e810b19ea16420313cb720c751b`.

Đã chạy dry-run thực tế và7/7 test validator (giá từ menu, bỏ món thiếu công thức/ngừng bán, duplicate, Hộp/Chai, số sai, precision, mismatch tên/đơn vị). Không chạy lại bài test cloud hoặc migration.

Trùng được kiểm tra **trong nguồn**, chưa đối chiếu database đích vì không kết nối Neon. Trước một lần nhập được duyệt phải kiểm tra tên/id/version đích và diff; không coi tên gần giống là cùng món. Retry phải dùng lại idempotency key; không ghi đè order/payment/ledger/lịch sử. Chưa xây importer, không thêm tính năng ứng dụng.

Thông tin nhập đầy đủ còn cần category cho món và tồn mở đầu/minimum cho NVL vì sheet này không cung cấp; không tự mặc định0. Alias có thể để trống nếu chủ quán không dùng. Chưa ghi giá trị active cho món thiếu quyết định; món ngừng bán giữ ngoài phạm vi. Đây là dữ liệu cần bổ sung khi chốt bản nhập, không phải lý do tự tạo công thức mới.
