# Kế hoạch cải tiến ERP từ dự án bán lẻ điện thoại

Tài liệu này xác định các chức năng cần đưa từ dự án `E:\Igen\bán lẻ đt` vào Igen ERP, dựa trên mã nguồn của hai dự án tại ngày 20/10/2026. Mục tiêu là hoàn thiện vận hành bán lẻ trên nền ERP hiện có và giữ đúng ranh giới dữ liệu giữa các loại hình kinh doanh. Các trạng thái bên dưới mô tả mã nguồn hiện tại; việc đưa vào cửa hàng còn cần kiểm thử với dữ liệu và thiết bị thực tế.

**Quyết định sản phẩm:** Đối tác bán lẻ là một module riêng. Module Đối tác hiện hữu của ERP tiếp tục phục vụ giáo dục và lao động theo các luồng đang có. Hai module có menu, API, quyền, chính sách hoa hồng và dữ liệu nghiệp vụ riêng. Nhà cung cấp kho và khách hàng vẫn là các hồ sơ gốc được liên kết bằng ID, không sao chép thành nguồn dữ liệu thứ hai.

## 1. Phạm vi và hiện trạng

ERP đã có POS, đơn hàng, hóa đơn nội bộ, ca bán, IMEI/serial, công nợ, trả hàng cơ bản, sửa chữa, tài sản cố định và dự báo tồn kho. Công việc chủ yếu là hoàn thiện luồng, đối soát và kết nối các phân hệ. Bản bán lẻ điện thoại có thêm màn hình POS chuyên dụng, kiểm soát phiên và quỹ, mã ưu đãi, điểm thưởng, đối tác bán lẻ, sổ quỹ và cơ chế phục hồi giao dịch khi mạng gián đoạn.

| Khối nghiệp vụ | ERP hiện có | Khoảng cách cần xử lý |
|---|---|---|
| Bán hàng | POS, đơn treo, đơn hàng, thanh toán và in hóa đơn | Phiên POS theo nhân viên/máy, khôi phục giỏ và ý định thanh toán, xử lý giao dịch chờ xác nhận |
| Hậu mãi | Trả hàng và thu mua cơ bản, hoàn tồn/IMEI | Chứng từ và bằng chứng đối soát, chống ghi trùng, đồng bộ điểm, hạng khách và hoa hồng |
| Kho | Danh mục, tồn, IMEI, chuyển serial đơn lẻ, dự báo | Phiếu điều chuyển hai đầu cho nhiều mặt hàng, đảo phiếu xuất, đối soát tồn |
| Khách hàng | Hồ sơ và phân hạng theo doanh số | Sổ điểm thưởng, quy đổi điểm, điều chỉnh có lý do, tùy chọn phân hạng theo lãi gộp |
| Tài chính | Công nợ, nhắc nợ, tài sản | Quỹ/tài khoản, phiếu thu chi, đối soát tiền nguồn, chốt sổ và báo cáo lãi lỗ bán lẻ |
| Đối tác | Đối tác giới thiệu học viên và đối tác lao động | Module bán lẻ độc lập cho CTV, đại lý, chính sách hoa hồng theo đơn/SKU/sửa chữa |

Nguồn kiểm tra chính trong ERP: `src/modules/retail/`, `server/modules/retail/`, `src/pages/PartnersTab.tsx`, `src/config/businessTypes.ts`, `server/modules/student-management/models/partner.model.ts`, `server/modules/worker-management/labor-partners/`, `src/modules/finance/` và `src/components/inventory/`. Nguồn đối chiếu trong dự án bán lẻ là các thư mục `src/modules/retail/`, `server/modules/retail/`, `src/modules/partners/`, `server/modules/partners/`, `src/modules/finance/`, `server/modules/finance/` và `server/modules/inventory/`.

## 2. Hai module Đối tác

### 2.1. Đối tác ERP hiện hữu

Module `partner` hiện tại giữ nguyên trách nhiệm và dữ liệu đang vận hành. Với `businessType=education`, tab Đối tác mở luồng giới thiệu học viên, học phí và hoa hồng. Với `businessType=labor`, tab này mở luồng đối tác cung ứng lao động, chính sách theo người lao động/giờ và đối soát theo kỳ. Hai luồng đã có model riêng và không chuyển sang model bán lẻ.

`src/pages/PartnersTab.tsx` và `src/router/route-config.tsx` đang chọn luồng và quyền theo `businessType`: `relationship:*` cho giáo dục, `labor-partner:*` cho lao động. Module này giữ đường đi, dữ liệu và quyền của khách hàng ERP hiện hữu.

### 2.2. Đối tác bán lẻ

Tạo module Đối tác bán lẻ riêng cho CTV, đại lý và nhà cung cấp. Một hồ sơ có thể mang nhiều vai trò nhưng chỉ có một mã trong phạm vi công ty. CTV được chọn ở POS và phiếu sửa chữa; đơn/phiếu lưu ID đối tác cùng ảnh chụp chính sách hoa hồng tại thời điểm xác nhận. Chính sách có thể áp dụng chung, theo CTV, nhóm hàng hoặc SKU; quy tắc SKU cụ thể được ưu tiên khi có cấu hình.

Module gồm hồ sơ, chính sách có ngày hiệu lực, sổ hoa hồng không sửa lịch sử, KPI, sao kê, xác nhận chi trả và cổng tự xem của đối tác. Chỉ ghi nhận hoa hồng khi giao dịch đủ điều kiện thanh toán/giao hàng. Hủy đơn, trả hàng hoặc hoàn tiền công sửa chữa tạo bút toán đảo; khoản đã chi giữ chứng từ và được bù trừ kỳ sau. Thu mua lại không mặc nhiên đảo hoa hồng lần bán trước.

Nhà cung cấp trong module bán lẻ liên kết đến `Supplier` của kho qua `supplierId`. Thông tin NCC ở kho là nguồn chính cho nhập hàng và công nợ. Hồ sơ đối tác chỉ giữ vai trò, quyền truy cập và quan hệ kinh doanh của module bán lẻ.

### 2.3. Điều hướng, bật module và quyền

ERP hiện chỉ có hai `businessType`: `education` và `labor`. `retail` là module có thể bật thêm, chưa phải một giá trị `businessType`. Phương án triển khai hiện tại là thêm module key và mục điều hướng riêng cho Đối tác bán lẻ, chỉ hiện khi doanh nghiệp được bật `retail` và người dùng có quyền phù hợp. Mục `ĐỐI TÁC` hiện hữu tiếp tục điều hướng theo giáo dục/lao động. Nếu sau này thêm `businessType=retail`, cần rà toàn bộ quy tắc bật module và tenant như một thay đổi nền tảng riêng.

Quyền tối thiểu của module mới gồm xem hồ sơ, quản lý hồ sơ, quản lý chính sách, xác nhận chi trả và tự xem sao kê. API tự xem suy ra hồ sơ từ tài khoản đã đăng nhập; ID đối tác do client gửi không được dùng để quyết định quyền. Thu ngân POS chỉ cần quyền chọn CTV hợp lệ, không cần xem toàn bộ sao kê hoặc cấu hình hoa hồng.

### 2.4. Ranh giới dữ liệu và chuyển đổi

Không dùng lại collection `Partner` của giáo dục hoặc `LaborPartner` của lao động cho bán lẻ. Hồ sơ bán lẻ có khóa duy nhất theo công ty và mã đối tác; chứng từ tham chiếu bằng ID ổn định. Không gộp hồ sơ chỉ dựa trên tên hoặc số điện thoại vì một người có thể tham gia nhiều nghiệp vụ với chính sách và quyền khác nhau.

Trước khi chuyển dữ liệu, lập bảng ánh xạ ID đối tác, tài khoản, NCC, đơn bán và phiếu sửa; phát hiện mã trùng, tài khoản đã liên kết, NCC thiếu nguồn và giao dịch có hoa hồng lịch sử. Chạy kiểm tra đọc trước, đối chiếu số lượng/số dư, rồi mới áp dụng dữ liệu. Đơn lịch sử thiếu CTV hoặc ảnh chụp chính sách không tự tính hoa hồng hồi tố.

## 3. Danh sách cải tiến cần triển khai

`P0` là điều kiện vận hành hoặc luồng có thể gây trùng giao dịch, sai tiền và tồn. `P1` hoàn thiện khách hàng, kho và tài chính. `P2` mở rộng hiệu quả vận hành sau khi dữ liệu lõi ổn định.

| ID | Ưu tiên | Cải tiến | Kết quả cần đạt |
|---|---|---|---|
| R01 | P0 | Tách Đối tác bán lẻ | Menu, API, quyền và model riêng; Đối tác ERP hiện hữu giữ nguyên; POS/sửa chữa chọn đúng CTV bán lẻ |
| R02 | P0 | Phiên POS theo thu ngân và máy | Quản lý mở phiên cho nhân viên; thu ngân chỉ bán trong phiên hợp lệ; chuyển máy/tạm dừng/đóng phiên có trạng thái rõ |
| R03 | P0 | Thu chi và đối soát phiên | Ghi tiền đầu phiên, thu/rút quỹ, kiểm đếm, chênh lệch có lý do, người duyệt và giao dịch theo phiên |
| R04 | P0 | Phục hồi giao dịch POS | Lưu giỏ, giữ khóa yêu cầu, tra kết quả trước khi gửi lại, xử lý đơn hoặc thanh toán chưa rõ kết quả khi mất mạng |
| R05 | P0 | Chuyển khoản chờ xác nhận | POS hiển thị trạng thái chờ SePay; chỉ ghi đã thu khi có bằng chứng; khoản thu ngoài phiên vào danh sách kiểm tra |
| R06 | P0 | Đổi trả và thu mua an toàn | Phiếu liên kết đơn gốc, chọn dòng/IMEI, giới hạn số lượng, nhập tồn đúng nguồn, hoàn tiền và đối soát chống lặp |
| R07 | P1 | Mã ưu đãi POS | Mã giảm tiền hoặc phần trăm, thời hạn, hạn mức, khách/hạng áp dụng; backend xác thực và khóa lượt dùng khi chốt |
| R08 | P1 | Tự động tặng mã | Chương trình sinh nhật hoặc sau mua đạt ngưỡng; phát mã một lần theo sự kiện, theo dõi trạng thái gửi |
| R09 | P1 | Điểm thưởng khách hàng | Chính sách tích/tiêu, sổ phát sinh, điều chỉnh có lý do; hủy/trả hàng đảo đúng điểm và cập nhật hạng |
| R10 | P1 | Phiếu điều chuyển kho | Phiếu nhiều hàng/IMEI, trạng thái đang chuyển, kho nhận xác nhận, hủy có lý do; hai đầu đối soát tồn |
| R11 | P1 | Đảo phiếu và đối soát kho | Phiếu đảo có chứng từ tham chiếu; chặn đảo lặp; phát hiện lệch giữa sổ kho, tồn và registry IMEI |
| R12 | P1 | Sổ quỹ và dòng tiền | Quỹ tiền mặt/ngân hàng, phiếu thu chi, gắn giao dịch nguồn, đối soát và chốt kỳ; không ghi thu/chi hai lần |
| R13 | P1 | Lãi lỗ bán lẻ | Doanh thu, giá vốn, lãi gộp/ròng theo sản phẩm, SKU, chi nhánh và chứng từ; cảnh báo thiếu giá vốn/bán dưới giá vốn |
| R14 | P1 | Hoa hồng Đối tác bán lẻ | Chính sách theo CTV/SKU/sửa chữa, sổ phát sinh và đảo, KPI, sao kê, chi trả, cổng tự xem |
| R15 | P2 | Thu tiền sửa chữa an toàn | Khóa chống ghi trùng và đối soát số đã thu/số còn lại khi yêu cầu lỗi mạng hoặc được gửi lại |
| R16 | P2 | CSKH gắn phiếu sửa chữa | Hội thoại, lịch sử và trạng thái xử lý theo khách/phiếu; kết nối Zalo OA khi có tài khoản và kiểm thử tích hợp |
| R17 | P2 | Hoàn thiện dự báo tồn kho | ERP đã có màn hình dự báo; chỉ đưa sang cảnh báo/điều hướng hữu ích sau khi so chất lượng với dữ liệu thực |

## 4. Luồng xuyên module cần giữ nhất quán

### 4.1. Bán hàng và thanh toán

POS xác định phiên, nhân viên, chi nhánh và máy trước khi tạo chứng từ. Giá bán, giảm giá, mã ưu đãi và điểm sử dụng được tính ở backend. Đơn lưu ảnh chụp dòng hàng, IMEI, khách, CTV, chính sách giá/hoa hồng và thanh toán. Gửi lại cùng khóa yêu cầu phải trả về kết quả cũ hoặc trạng thái cần đối soát; không tạo thêm đơn, trừ tồn hoặc thu tiền lần hai.

### 4.2. Trả hàng, hủy đơn và sửa chữa

Trả hàng tạo phiếu riêng và ghi nhận kho/IMEI theo trạng thái, không sửa mất lịch sử đơn gốc. Hoàn tiền, công nợ, điểm, hạng và hoa hồng phải được tính lại từ cùng sự kiện nghiệp vụ. Hủy đơn và trả hàng không đảo hai lần cùng một quyền lợi. Thu mua lại là chứng từ mua hàng và chi tiền riêng. Với sửa chữa, chỉ phần tiền công theo chính sách mới là cơ sở hoa hồng CTV; hoàn tiền công tạo bút toán đảo tương ứng.

### 4.3. Kho và tài chính

Mỗi di chuyển tồn có chứng từ nguồn và khóa chống lặp. Phiếu điều chuyển theo dõi hàng đang vận chuyển đến khi bên nhận xác nhận hoặc bên gửi hủy hợp lệ. Phiếu thu/chi quỹ tham chiếu khoản thanh toán gốc; gắn nguồn vào sổ quỹ không thực hiện lại nghiệp vụ thu/chi. Báo cáo lãi lỗ hiển thị nguồn giá vốn và trạng thái thiếu dữ liệu, không mặc định giá vốn bằng 0.

## 5. Thứ tự thực hiện và điều kiện hoàn thành

1. **Nền tảng module:** chốt định danh và quyền Đối tác bán lẻ, ranh giới NCC/khách hàng, bảng ánh xạ dữ liệu và cách bật menu. Hoàn thành R01 trước khi gắn CTV vào đơn hoặc phiếu sửa.
2. **Vòng đời giao dịch:** triển khai R02–R06. Kiểm thử đồng thời, mất mạng, gửi lại, đổi máy, hoàn tiền và chênh lệch quỹ bằng dữ liệu nhiều chi nhánh.
3. **Khách hàng và kho:** triển khai R07–R11; kiểm tra mã ưu đãi/điểm với đơn hủy, trả hàng và điều chuyển nhiều IMEI qua hai chi nhánh.
4. **Tài chính và hoa hồng:** triển khai R12–R14; đối soát doanh thu, tiền thực, giá vốn và hoa hồng theo chứng từ gốc trước khi mở sao kê cho đối tác.
5. **Mở rộng:** triển khai R15–R17 theo nhu cầu vận hành và điều kiện tích hợp bên ngoài.

Mỗi hạng mục ghi tiền, tồn, điểm hoặc hoa hồng chỉ hoàn thành khi có quyền theo công ty/chi nhánh, khóa chống lặp ở dữ liệu, lịch sử kiểm tra được, xử lý lỗi gửi lại, kiểm thử nghiệp vụ trọng yếu và phương án chuyển đổi dữ liệu đang hoạt động. Giao diện mới dùng tiếng Việt, component và token thiết kế hiện có của ERP. POS cần kiểm thử máy quét và thiết bị thanh toán thực tế trước khi triển khai cửa hàng.

## 6. Quyết định nghiệp vụ cần chốt

| Chủ đề | Quyết định cần có trước khi xây dựng |
|---|---|
| Loại hình bán lẻ | Giữ bán lẻ là module bật thêm như hiện tại, hay bổ sung `businessType=retail` cho doanh nghiệp thuần bán lẻ? Phương án trong tài liệu dùng module bật thêm. |
| Phạm vi Đối tác bán lẻ | CTV, đại lý và NCC dùng chung hồ sơ nhiều vai trò; có cấp tài khoản tự xem cho đại lý hay chỉ CTV? |
| Hoa hồng | Mốc ghi nhận, cơ sở tính sau giảm giá/thuế, SKU thiếu cấu hình, thưởng KPI, thời điểm chốt và bù trừ khoản đã chi khi hoàn hàng. |
| Điểm và hạng khách | Dùng doanh số hay lãi gộp để xét hạng; tỷ lệ tích/tiêu và cách xử lý giá vốn chưa xác định. |
| Quỹ và doanh thu | Thời điểm ghi doanh thu, cách gắn thanh toán SePay, nguồn tiền hoàn/thu mua và kỳ chốt sổ. |
| Dữ liệu chuyển đổi | Dữ liệu bán lẻ cần chuyển, đối tác/NCC trùng, số dư hoa hồng đầu kỳ và người xác nhận kết quả đối soát. |

## 7. Tệp nguồn để triển khai

| Nội dung | ERP | Dự án bán lẻ điện thoại |
|---|---|---|
| Điều hướng Đối tác | `src/pages/PartnersTab.tsx`, `src/router/route-config.tsx`, `src/config/businessTypes.ts` | `src/modules/partners/PartnersPage.tsx`, `src/modules/partners/partnerAccess.ts` |
| Model Đối tác | `server/modules/student-management/models/partner.model.ts`, `server/modules/worker-management/labor-partners/models/labor-partner.model.ts` | `server/modules/partners/partner.models.ts`, `server/modules/partners/router.ts` |
| Hoa hồng | `server/modules/worker-management/labor-partners/` | `server/modules/partners/commission.service.ts`, `server/modules/partners/product-commission.service.ts` |
| POS và phiên | `src/modules/retail/pages/RetailPosPage.tsx`, `src/modules/retail/pages/RetailShiftWorkspace.tsx` | `src/modules/retail/pages/RetailPosPage.tsx`, `src/modules/retail/pages/RetailPosEntry.tsx`, `src/modules/retail/pages/RetailShiftWorkspace.tsx` |
| Đổi trả | `server/modules/retail/services/retail-after-sale.service.ts` | `server/modules/retail/services/retail-after-sale.service.ts`, `src/modules/retail/pages/RetailReturnsPage.tsx` |
| Ưu đãi và điểm | `server/modules/customer-management/` | `server/modules/retail/services/retail-coupon.service.ts`, `server/modules/customer-management/services/customer-point.service.ts` |
| Kho và tài chính | `src/components/inventory/`, `src/modules/finance/` | `src/components/inventory/InventoryTransferSection.tsx`, `src/modules/finance/pages/TreasuryPage.tsx` |

Các đặc tả Retail cũ trong `docs/` phản ánh những giai đoạn khác nhau. Khi triển khai, lấy mã nguồn hiện tại và các quyết định trong tài liệu này làm cơ sở đối chiếu; cập nhật đặc tả kỹ thuật liên quan sau khi chốt phạm vi từng hạng mục.
