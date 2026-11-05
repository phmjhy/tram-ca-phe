# Dữ liệu chuẩn bị nhập website — 03/11/2026

Nguồn: [Untitled spreadsheet](https://docs.google.com/spreadsheets/d/1wVG22sTug8KtlkYAy_GF2aPOo6pqgqNS4XP7_QuJcc8/edit). Đọc mới3 tab: menu A1:C1001, Danh sách NVL A1:I1001, công thức A1:M1000; metadata tên tab không đổi. Lấy công thức làm danh sách gốc, giá bán từ menu. Không sửa Sheets. Hash snapshot: `a2a291a2f992fbd1af43ffac5526d993022e6647a3b0c0cdaa5bf13bf6b67564`.

## Quyết định đã áp dụng

- Đơn giá NVL làm tròn half-up tối đa3 số thập phân, tính từ chuỗi thập phân bằng BigInt để xử lý đúng điểm giữa (116.6665→116.667). Làm tròn mỗi đơn giá trước khi tính giá vốn, không sửa lịch sử.
- Chai/Hộp đếm riêng→cái; giữ nguyên số lượng. Gram→g,Ml→ml chỉ là chuẩn hóa nhãn. Không tự đổi g↔ml.
- Chanh0đ; mứt dâu đã là Gram ở cả NVL và công thức dâu.
- S2 nguồn mới khớp65000đ/50 cái=1300đ/cái,2 cái/phần, giá bán5000đ, giá vốn2600đ/phần. Không phải override ngầm trong dữ liệu.
- Món không có công thức bỏ qua; Cacao dầm có ghi chú ngừng bán nên không chuẩn bị để bán.

## Sẵn sàng về giá/công thức:16 món

Đã test bán mỗi món một phần qua API với PostgreSQL local. **Đây chưa phải chứng nhận tồn kho thực hoặc Production readiness.**

| Món từ menu | Giá bán VND | Kiểm thử giá vốn/trừ kho/thanh toán |
|---|---|---|
| Cà phê đen | 15000 | PASS local |
| Cà phê sữa | 18000 | PASS local |
| Bạc xỉu | 25000 | PASS local |
| Sữa chua đá | 20000 | PASS local |
| xúc xích s2 | 5000 | PASS local |
| Matcha dâu | 35000 | PASS local |
| Americano | 25000 | PASS local |
| Nước cam | 20000 | PASS local |
| Sữa chua dâu | 25000 | PASS local |
| Cacao latte | 25000 | PASS local |
| mocha cacao | 35000 | PASS local |
| Cà phê sữa tươi | 25000 | PASS local |
| 247 coffee | 18000 | PASS local |
| Redbull | 20000 | PASS local |
| Coca | 18000 | PASS local |
| vải - mirinda | 18000 | PASS local |

## Còn chặn do tên:9 công thức

Không tự ghép tên gần giống hoặc lấy giá từ cột công thức khi không có menu khớp.

| Công thức | Cần quyết định |
|---|---|
| Matcha latte (M) | Menu chỉ có Matcha latte; xác nhận mapping/size và giá menu riêng nếu cần. |
| Matcha latte (L) | Menu chỉ có Matcha latte; không tự dùng giá của M. |
| Matcha dừa tươi | Chưa có tên menu khớp: bổ sung tên/giá menu hoặc bỏ qua. |
| cacao dâu | Chưa có tên menu khớp: bổ sung tên/giá menu hoặc bỏ qua. |
| orange americano | Chưa có tên menu khớp; không tự ghép với Americano dừa. |
| Olong tea plus+ | Có olong trong menu nhưng chưa xác nhận là cùng món. |
| Sting đỏ | Có Sting trong menu nhưng chưa xác nhận biến thể. |
| sprite lon | Có sprite trong menu nhưng chưa xác nhận quy cách. |
| Mì modern | Có Mì trong menu nhưng chưa xác nhận loại. |

Kết quả dry-run:26 công thức có tên=16 READY+9 cần xác nhận+1 ngừng bán.29 dòng menu không có công thức khớp được bỏ qua (một phần liên quan tên đang chặn ở trên). Không phát hiện trùng nguồn, tham chiếu NVL thiếu, định lượng sai hoặc đơn vị không khớp trong16 món. Không tự xác nhận ngưỡng tiêu hao nghiệp vụ ngoài định lượng đã cung cấp.

## Gói dữ liệu chuẩn hóa

Giữ snapshot,dry-run,api-plan.json và bảng MANUAL_ENTRY.md trong thư mục private0700 ngoài Git `/private/tmp/tram-menu-review-20261103`; file0600. Bảng riêng chứa16 NVL dùng bởi16 món, đơn giá chuẩn hóa và định lượng/giá vốn mỗi phần; không đưa toàn bộ dữ liệu kinh doanh gốc lên PR. Thư mục tạm cần chủ quán lưu bản riêng nếu muốn dùng lâu dài.

API hiện tại đủ dùng, không thêm endpoint hoặc module. Plan có createFields theo API nguyên liệu (name/unit/unitCost), món(name/price), recipe(quantity,ingredientKey cần đổi sang id). Trước tạo NVL còn phải điền **opening/minimum thật**: Sheet không cung cấp, không tự đặt0 cho vận hành. API món đã có mặc định category=Menu,active=true,aliases trống; không coi các field optional này là blocker mới. Phiên local dùng opening/minimum0 và lượng nhập3 lần nhu cầu công thức chỉ làm fixture, không phải số liệu kinh doanh.

CLI offline:

```sh
node scripts/menu-dry-run.mjs /private/path/source.json --owner-approved
node scripts/verify-menu-local.mjs /private/path/source.json
```

Chỉ flag owner-approved áp dụng quyết định03/11; chế độ mặc định vẫn báo các lỗi precision/đơn vị chưa duyệt. **Lượt mới exit2 vì9 tên chưa khớp**, không phải cloud FAIL. Không tự điền giá bán từ tab công thức.

## Kiểm thử thực tế

- **PASS12/12** `node --test tests/menu-dry-run.test.js`: quyết định làm tròn/đơn vị/chanh/S2, không tự ghép tên, duplicate và số sai, payload không bịa opening/minimum.
- **PASS PostgreSQL local18.4 qua API handler thật**, OWNER/STAFF login riêng; tạo16 NVL,16 món/công thức; replay nhập kho1 lần; STAFF không được ghi kho.
- **PASS16/16 món**: ba request bán cùng key→một đơn, tiêu hao đúng định lượng một lần, COGS đối chiếu độc lập bằng số nguyên micro-VND; hai phiên tick paid→một payment/paidAt, không đổi tồn.
- **PASS** đổi giá S2 local1300→1301 không thay tồn hoặc ledger cũ, lần bán sau COGS2602; đây là thay đổi fixture local, không thay giá nguồn/gói nhập.
- **PASS** thiếu kho rollback đơn/tồn; ledger đối soát tồn; dashboard sales=paid+unpaid và COGS khớp consumption.
- **PASS** npm run build; không thay runtime/frontend/schema. Lượt sandbox ban đầu bị EPERM khi bind loopback; sau cấp quyền chạy local đã PASS, không phải lỗi API.
- Không chạy cloud/browser E2E, không kết nối/ghi Neon, không migration cloud/merge/Production. Trùng trong database đích chưa kiểm tra; trước nhập phải đối chiếu tên/id/version và diff. Tạo món API hiện không idempotent: không tự retry import hàng loạt; nhập qua UI có kiểm tra tên trước và xác minh sau timeout.

Bằng chứng: [menu-local-2026-11-03.json](preview-cloud/menu-local-2026-11-03.json). Các database local persistent đã dừng và giữ nguyên, không xóa.
