# Chức năng và action trợ lý ERP — bản mở rộng

Ngày cập nhật: 23/11/2026. Nhánh `fix/erp-assistant-read-v2`. Đối chiếu working tree, catalog hiện tại và một số màn hình nguồn.

**Kế hoạch thực hiện khi thời gian hạn chế:** [Kiểm thử ưu tiên theo luồng người dùng](./ke-hoach-kiem-thu-uu-tien-theo-luong-tro-ly-erp.md). Bản đồ dưới đây dùng để tra cứu, không phải danh sách phải kiểm thử hết hoặc chia đều số case cho các module.

## 1. Phạm vi và sửa sai của bản trước

**Tạm bỏ qua Gym (3S theo yêu cầu người dùng) và Trợ lý kiến trúc mới thêm.** Không đánh giá thiếu/đủ, thiết kế hay kiểm thử hai phần này. Catalog nguồn toàn repo vẫn có 1.004 action để tra lịch sử; tài liệu này loại 8 action kiến trúc khỏi mẫu số. Không dùng từ “không thấy Gym trong catalog” để kết luận web không có Gym.

Bản trước chọn lọc 129 nhóm trên toàn repo; trong phạm vi còn lại là **126 nhóm**, chỉ hiển thị **545 action đại diện** và ánh xạ **860/996 action**. Như vậy **136 action** chưa được phân nhóm, trong đó có phân quyền, chi nhánh, thông báo, bảo hành, sổ quỹ và cấu hình. Đây là thiếu sót của tài liệu, không đồng nghĩa trợ lý không có các action đó.

Bản mở rộng có **174 nhóm chức năng** (thêm 48 nhóm so với phạm vi tương đương), liệt kê **đầy đủ 996 action trong phạm vi**, gồm **995 khả dụng trong catalog** và **1 bị đánh dấu không khả dụng**. Mỗi action nằm đúng một nhóm chính để không cộng trùng; các quan hệ dùng chung vẫn có cross-reference. Không cắt danh sách còn 6 action đại diện.

Ngoài ra ghi nhận **10 mục chức năng web chưa có action tương đương** từ phần source đã rà. Đây là các khoảng trống đã có bằng chứng, **không phải tổng số thiếu của toàn web**. Chưa có mẫu số đầy đủ của mọi nút/luồng UI nên chưa công bố tỷ lệ bao phủ web.

Các nhóm là cách đọc nghiệp vụ do biên tập. Một nhóm lớn như Lương có nhiều action và nhiều vòng đời, không được tính “1 nhóm = 1 case test”. Số nhóm không phải số API, số nút hay số luồng đã nghiệm thu.

## 2. Phân biệt các lớp bằng chứng

| Lớp | Ý nghĩa | Không được suy ra |
| --- | --- | --- |
| Có action trong catalog | Có hợp đồng ID, route/adapter, trường và quyền khai báo | Không chứng minh tài khoản đang bật hoặc thực thi thành công |
| Có quy trình nguồn | buildManualGuide có recipe và chứng cứ mã UI | Không chứng minh đã test trình duyệt, mọi điều kiện nhánh hoặc dữ liệu thực |
| Mới xác định màn hình | Đã gắn màn hình, chưa đủ recipe thao tác | Không gọi là phủ đủ chức năng |
| UI không có / đang ẩn | Catalog có action nhưng hướng dẫn chỉ ra UI chưa gắn, thiếu control hoặc đang ẩn | Không đồng nghĩa action backend bị tắt |
| Chưa xác minh UI | Chưa có chứng cứ đủ hoặc nguồn hướng dẫn cần rà | Không tự gán “web không có” |
| UI có, chưa có action tương đương | Có đường UI cụ thể và không có action đích danh khớp nghiệp vụ được rà | Không dùng một API gần giống hoặc module khác để thay thế |
| Có bằng chứng test | Có case/trace, snapshot và phạm vi kiểm chứng cụ thể | Không suy từ một GET hay preview thành cả nhóm đã chạy CRUD end-to-end |

Cột UI bên dưới tái sử dụng kiểm kê hướng dẫn trong code, kiểm tra file/snippet còn tồn tại; không biến nó thành kết quả test browser mới. Mỗi action trong tài liệu này **chưa được nghiệm thu lại bằng E2E trong đợt kiểm kê**. Các kết quả test trước được giữ ở báo cáo riêng và gắn với snapshot của từng lần chạy.

## 3. Tổng hợp theo module

| Module | Nhóm cũ trong phạm vi | Nhóm mở rộng | Action liệt kê đủ | Không khả dụng |
| --- | ---: | ---: | ---: | ---: |
| [Nhân sự](#module-hr) | 11 | 16 | 198 | 0 |
| [Kho & Sản phẩm](#module-inventory) | 9 | 10 | 68 | 0 |
| [Quản lý tài nguyên](#module-resource) | 5 | 6 | 17 | 0 |
| [Trò chuyện](#module-chat) | 5 | 9 | 32 | 0 |
| [Quản lý học viên](#module-student) | 11 | 17 | 109 | 0 |
| [Quản lý lao động](#module-worker) | 6 | 8 | 31 | 0 |
| [Đối tác tuyển sinh](#module-student-partner) | 4 | 4 | 14 | 1 |
| [Đối tác lao động](#module-labor-partner) | 6 | 6 | 32 | 0 |
| [Khách hàng](#module-customer) | 4 | 4 | 16 | 0 |
| [Đối tác cũ](#module-partner) | 0 | 0 | 0 | 0 |
| [Bán lẻ & POS](#module-retail) | 8 | 13 | 72 | 0 |
| [Đối tác bán lẻ](#module-retail-partner) | 4 | 4 | 19 | 0 |
| [Sửa chữa & bảo hành](#module-repair) | 7 | 11 | 36 | 0 |
| [Tài chính](#module-finance) | 8 | 11 | 69 | 0 |
| [Marketing tự động](#module-marketing) | 3 | 3 | 8 | 0 |
| [Chiến dịch nội dung](#module-social-marketing) | 8 | 14 | 122 | 0 |
| [Hộp thư đa kênh](#module-omni-inbox) | 5 | 11 | 42 | 0 |
| [Kho tri thức](#module-company-knowledge) | 5 | 7 | 15 | 0 |
| [Văn bản pháp luật](#module-legal-reference) | 4 | 4 | 8 | 0 |
| [Báo giá](#module-quotation) | 7 | 10 | 60 | 0 |
| [Quản lý y tế](#module-healthcare) | 6 | 6 | 28 | 0 |

### Những phần quan trọng bản cũ đã bỏ sót

- Nhân sự: chi nhánh, phân quyền vai trò, email công ty/chúc mừng, lịch và tổng quan công việc.
- Học viên/Lao động: thông báo, cấu hình trường dữ liệu, màu đánh giá và các thiết lập hồ sơ.
- Bán lẻ: bảo hành, sổ quỹ, lợi nhuận/hoa hồng, cấu hình và tra hàng theo serial.
- Sửa chữa: chăm sóc khách, phản hồi/đánh giá, thông báo và lịch sử.
- Marketing/CRM: flow hội thoại, thu thập lead, cấu hình AI, SePay, Telegram đơn hàng, thư viện sản phẩm, chứng từ và gói sử dụng.
- Kho tri thức/Báo giá: quản trị dữ liệu, tài khoản, thông tin bên bán, tổng quan và hạn mức.

## 4. Chức năng web chưa có action tương đương đã xác định

Các mục dưới không được cộng vào “action đã có”. API tồn tại không đồng nghĩa đã có adapter, source đọc, validation hoặc completion cho trợ lý. Đây chỉ là rà tĩnh mã nguồn; chưa thực thi các luồng.

### WEB-INV-01. Tạo/sửa/xóa phiếu xuất nhập thủ công — `inventory`

Màn Xuất hàng có biểu mẫu và callback tạo/sửa/xóa phiếu. Catalog hiện chỉ có tra phiếu và đảo phiếu xuất; không có ba action đích danh tương ứng.

API chưa có action đích danh: `POST /crud/stock-logs`, `PATCH /crud/stock-logs/:id`, `DELETE /crud/stock-logs/:id`.

Bằng chứng source: [src/pages/InventoryTab.tsx:930](../src/pages/InventoryTab.tsx#L930), [src/services/inventoryStockLogService.ts:100](../src/services/inventoryStockLogService.ts#L100), [src/services/inventoryStockLogService.ts:145](../src/services/inventoryStockLogService.ts#L145).

Cần làm tiếp: Thiết kế hợp đồng xuất thủ công, kiểm soát tồn/serial, idempotency và vòng đời phiếu. Không dùng checkout POS thay thao tác xuất thủ công.

### WEB-INV-02. Tra tồn thực tế theo kho/SKU — `inventory`

WarehouseSection gọi listBalances để lấy tồn theo kho; action inventory.warehouse.locations.list chỉ liệt kê kho, không tương đương API trả tồn thực tế.

API chưa có action đích danh: `GET /inventory/warehouses/balances`.

Bằng chứng source: [src/pages/InventoryTab.tsx:762](../src/pages/InventoryTab.tsx#L762), [src/components/inventory/WarehouseSection.tsx:67](../src/components/inventory/WarehouseSection.tsx#L67), [src/services/inventoryReceivingService.ts:26](../src/services/inventoryReceivingService.ts#L26).

Cần làm tiếp: Đăng ký nguồn tồn theo kho và hợp đồng phạm vi/lọc phù hợp. Không suy ra tồn từ số dòng danh mục sản phẩm.

### WEB-INV-03. Sửa ngưỡng tồn tối thiểu/tối đa — `inventory`

Màn kho có handler updateBalanceThresholds. Chưa có action cho route sửa ngưỡng tồn này trong catalog.

API chưa có action đích danh: `PATCH /inventory/warehouses/balances/:id/thresholds`.

Bằng chứng source: [src/components/inventory/WarehouseSection.tsx:325](../src/components/inventory/WarehouseSection.tsx#L325), [src/services/inventoryReceivingService.ts:27](../src/services/inventoryReceivingService.ts#L27).

Cần làm tiếp: Thiết kế chọn đúng balance kho/SKU, giữ version nếu API có và xác nhận min/max trước ghi.

### WEB-INV-04. Dự báo tồn và gợi ý nhập hàng — `inventory`

Tab Dự báo render AiForecastPanel; mã hiện có phép tính forecast ở client. Không có action forecast tương đương trong catalog inventory.

Bằng chứng source: [src/pages/InventoryTab.tsx:951](../src/pages/InventoryTab.tsx#L951), [src/components/inventory/AiForecastPanel.tsx:33](../src/components/inventory/AiForecastPanel.tsx#L33), [src/utils/inventoryForecast.ts:270](../src/utils/inventoryForecast.ts#L270).

Cần làm tiếp: Định nghĩa phép tính/nguồn lịch sử và kỳ dự báo phía server; không chỉ đổi tên product.list thành báo cáo dự báo.

### WEB-HC-01. Hồ sơ thiết bị y tế và kiểm định — `healthcare`

Trang Y tế có tab Thiết bị, bảng/editor thiết bị và kiểm định. Chưa có action /healthcare/logistics trong catalog y tế.

Bằng chứng source: [src/modules/healthcare/HealthcarePage.tsx:320](../src/modules/healthcare/HealthcarePage.tsx#L320), [src/modules/healthcare/logistics/EquipmentEditor.tsx:74](../src/modules/healthcare/logistics/EquipmentEditor.tsx#L74), [src/modules/healthcare/logistics/EquipmentCompliance.tsx:27](../src/modules/healthcare/logistics/EquipmentCompliance.tsx#L27).

Cần làm tiếp: Tách hồ sơ thiết bị, kiểm định và tệp đính kèm thành hợp đồng rõ ràng; không dùng patient.create hoặc catalog dịch vụ thay thế.

### WEB-HC-02. Mượn/trả thiết bị y tế — `healthcare`

LogisticsPage có chế độ Mượn / trả và lịch sử yêu cầu. Catalog y tế hiện không có nhóm action logistics tương ứng.

Bằng chứng source: [src/modules/healthcare/logistics/LogisticsPage.tsx:132](../src/modules/healthcare/logistics/LogisticsPage.tsx#L132), [src/modules/healthcare/logistics/EquipmentRequestPicker.tsx:19](../src/modules/healthcare/logistics/EquipmentRequestPicker.tsx#L19).

Cần làm tiếp: Thiết kế request mượn/trả và bước duyệt, khóa trạng thái thiết bị trước thực thi.

### WEB-HC-03. Danh mục vật tư và đơn vị quy đổi — `healthcare`

Tab Vật tư có danh mục vật tư và Đơn vị quy đổi; chưa có action logistics trong catalog.

Bằng chứng source: [src/modules/healthcare/HealthcarePage.tsx:320](../src/modules/healthcare/HealthcarePage.tsx#L320), [src/modules/healthcare/logistics/SupplyWorkspace.tsx:19](../src/modules/healthcare/logistics/SupplyWorkspace.tsx#L19), [src/modules/healthcare/logistics/SupplyCatalog.tsx:144](../src/modules/healthcare/logistics/SupplyCatalog.tsx#L144).

Cần làm tiếp: Bổ sung hợp đồng vật tư, đơn vị và quy đổi; phân biệt danh mục vật tư với danh mục bác sĩ/phòng khám/dịch vụ.

### WEB-HC-04. Nhập/xuất kho vật tư y tế — `healthcare`

SupplyWorkspace có tab Nhập / Xuất kho, gọi LogisticsPage cho transactions. Chưa có action logistics để thao tác chứng từ.

Bằng chứng source: [src/modules/healthcare/logistics/SupplyWorkspace.tsx:14](../src/modules/healthcare/logistics/SupplyWorkspace.tsx#L14), [src/modules/healthcare/logistics/SupplyWorkspace.tsx:14](../src/modules/healthcare/logistics/SupplyWorkspace.tsx#L14).

Cần làm tiếp: Kiểm kê vòng đời chứng từ nháp/gửi/duyệt/ghi sổ/hủy và kiểm tra tồn trước khi thiết kế adapter.

### WEB-HC-05. Nhà cung cấp, kho và phân loại vật tư — `healthcare`

SupplyWorkspace có các mục Nhà cung cấp, Kho lưu trữ và Phân loại; DirectoryPage có biểu mẫu gọi logistics/directories. Chưa có action tương ứng.

Bằng chứng source: [src/modules/healthcare/logistics/SupplyWorkspace.tsx:15](../src/modules/healthcare/logistics/SupplyWorkspace.tsx#L15), [src/modules/healthcare/logistics/SupplyWorkspace.tsx:16](../src/modules/healthcare/logistics/SupplyWorkspace.tsx#L16), [src/modules/healthcare/logistics/DirectoryPage.tsx:41](../src/modules/healthcare/logistics/DirectoryPage.tsx#L41).

Cần làm tiếp: Phân biệt scope/định danh của danh mục y tế với nhà cung cấp và kho của Inventory; không tự tái sử dụng action khác module.

### WEB-HC-06. Tồn vật tư theo lô và lịch sử — `healthcare`

Tab Tồn theo lô và các nguồn ledger/profiles có trong UI y tế, nhưng chưa được đăng ký action logistics cho trợ lý.

Bằng chứng source: [src/modules/healthcare/logistics/SupplyWorkspace.tsx:18](../src/modules/healthcare/logistics/SupplyWorkspace.tsx#L18), [src/modules/healthcare/logistics/SupplyCatalog.tsx:667](../src/modules/healthcare/logistics/SupplyCatalog.tsx#L667), [src/modules/healthcare/logistics/SupplyProfiles.tsx:149](../src/modules/healthcare/logistics/SupplyProfiles.tsx#L149).

Cần làm tiếp: Thiết kế nguồn tồn theo lô/hạn dùng và truy vết, đọc đủ trang và giữ scope chi nhánh.

## 5. Danh sách đầy đủ chức năng và action trong phạm vi

Quy tắc phân nhóm: thêm các nhóm bị bỏ sót, ưu tiên nhóm mới mô tả đích nghiệp vụ cụ thể; khi một action liên quan nhiều nhóm, chọn nhóm đặc thù hơn làm nhóm chính. Không thay op.module, featureKey hoặc quyền runtime. JSON lưu cả nhóm chính và liên quan.

Các dòng Đọc/Ghi theo metadata, không đoán chỉ từ HTTP method. Dù catalog khả dụng, runtime vẫn phải kiểm tra quyền, workflow, scope, dữ liệu và xác nhận. Các route giữ nguyên theo catalog; adapter có thể thực thi nội bộ.

<a id="module-hr"></a>
### Nhân sự — `hr`

**16 nhóm · 198 action (198 khả dụng, 0 không khả dụng).**

#### 1. Hồ sơ nhân sự

Chức năng: Tra cứu, thêm, cập nhật hồ sơ và thống kê nhân sự.

Ví dụ: “Thêm nhân sự NHAN-SU-QA vào chi nhánh đã chọn.”

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `employee.birthday.next-month` | Báo cáo sinh nhật nhân sự tháng tới | Đọc | `GET /auth/users` | Khả dụng | Có quy trình nguồn |
| `employee.count` | Đếm số nhân sự trong công ty hoặc chi nhánh | Đọc | `GET /auth/users/count` | Khả dụng | UI không có / đang ẩn |
| `employee.create` | Tạo nhân sự | Ghi | `POST /auth/register-user` | Khả dụng | Có quy trình nguồn |
| `employee.delete` | Xóa tài khoản nhân sự | Ghi | `DELETE /auth/users/:id` | Khả dụng | Có quy trình nguồn |
| `employee.detail` | Xem thông tin chi tiết nhân sự | Đọc | `GET /auth/users` | Khả dụng | Có quy trình nguồn |
| `employee.list` | Tra cứu nhân sự | Đọc | `GET /auth/users` | Khả dụng | Có quy trình nguồn |
| `employee.update` | Cập nhật nhân sự | Ghi | `PATCH /auth/users/:id` | Khả dụng | Có quy trình nguồn |

#### 2. Phòng ban

Chức năng: Quản lý cơ cấu phòng ban và danh sách nhân sự thuộc phòng.

Ví dụ: “Liệt kê nhân sự của phòng PHONG-QA.”

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `department.create` | Tạo phòng ban | Ghi | `POST /hr/departments` | Khả dụng | Có quy trình nguồn |
| `department.delete` | Xóa phòng ban | Ghi | `DELETE /hr/departments/:id` | Khả dụng | Có quy trình nguồn |
| `department.employees.list` | Danh sách nhân sự theo phòng ban | Đọc | `GET /auth/users` | Khả dụng | Có quy trình nguồn |
| `department.list` | Tra cứu phòng ban | Đọc | `GET /hr/departments` | Khả dụng | Có quy trình nguồn |
| `department.lookup` | Tra cứu thông tin phòng ban | Đọc | `GET /hr/departments` | Khả dụng | Có quy trình nguồn |
| `department.unmanaged.list` | Danh sách phòng ban chưa có quản lý | Đọc | `GET /hr/departments` | Khả dụng | Có quy trình nguồn |
| `department.update` | Cập nhật phòng ban | Ghi | `PATCH /hr/departments/:id` | Khả dụng | Có quy trình nguồn |

#### 3. Hợp đồng nhân sự

Chức năng: Lập, sửa, gia hạn và theo dõi hợp đồng của nhân sự công ty.

Ví dụ: “Hợp đồng nhân sự nào sắp hết hạn?”

Liệt kê đầy đủ **12 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `hr.contract.create` | Tạo hợp đồng nhân sự | Ghi | `POST /hr-contracts` | Khả dụng | Có quy trình nguồn |
| `hr.contract.expiring.list` | Báo cáo hợp đồng nhân sự sắp hết hạn | Đọc | `GET /hr-contracts` | Khả dụng | Có quy trình nguồn |
| `hr.contract.extend` | Gia hạn hợp đồng nhân sự | Ghi | `POST /hr-contracts/:id/extensions` | Khả dụng | Có quy trình nguồn |
| `hr.contract.list` | Tra cứu hợp đồng nhân sự để chọn hợp đồng cần gia hạn | Đọc | `GET /hr-contracts` | Khả dụng | Có quy trình nguồn |
| `hr.contract.missing.list` | Báo cáo nhân sự chưa có hợp đồng hiệu lực | Đọc | `GET /hr-contracts` | Khả dụng | Có quy trình nguồn |
| `hr.contract.settings.get` | Xem cài đặt cảnh báo hợp đồng nhân sự | Đọc | `GET /hr-contracts/settings` | Khả dụng | Có quy trình nguồn |
| `hr.contract.settings.update` | Cập nhật cài đặt cảnh báo hợp đồng nhân sự | Ghi | `PUT /hr-contracts/settings` | Khả dụng | Có quy trình nguồn |
| `api.get.0c557a74cbc907f9` | Tra cứu hợp đồng nhân sự | Đọc | `GET /hr-contracts` | Khả dụng | Có quy trình nguồn |
| `api.get.b44c64519e939e0a` | Tra cứu lịch sử gia hạn hợp đồng nhân sự | Đọc | `GET /hr-contracts/extensions/list` | Khả dụng | Có quy trình nguồn |
| `api.patch.7d7b8c0cbce4fe1c` | Cập nhật hợp đồng nhân sự | Ghi | `PATCH /hr-contracts/:id` | Khả dụng | Có quy trình nguồn |
| `api.post.564251c483731a91` | Tạo hợp đồng nhân sự | Ghi | `POST /hr-contracts` | Khả dụng | Có quy trình nguồn |
| `api.post.8dad6fff5226b63c` | Gia hạn hợp đồng nhân sự | Ghi | `POST /hr-contracts/:id/extensions` | Khả dụng | Có quy trình nguồn |

#### 4. Chấm công và lịch làm việc

Chức năng: Quản lý ca, lịch, giờ làm và dữ liệu chấm công nhân sự.

Ví dụ: “Xem giờ làm của NHAN-SU-QA trong kỳ đã chọn.”

Liệt kê đầy đủ **35 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.39330ed93a819149` | Xóa ca làm việc | Ghi | `DELETE /timekeeping/shifts/:id` | Khả dụng | UI không có / đang ẩn |
| `api.delete.5725128cf1fe0911` | Xóa chấm công công việc lịch làm việc | Ghi | `DELETE /timekeeping/work-calendar/:id` | Khả dụng | Có quy trình nguồn |
| `api.get.5d0d3ea4fc0d9efb` | Tra cứu giờ làm nhân viên | Đọc | `GET /timekeeping/work-hours` | Khả dụng | Có quy trình nguồn |
| `api.get.d2e63aaeb8682c88` | Tra cứu lần chấm công bị từ chối | Đọc | `GET /timekeeping/attempts` | Khả dụng | Có quy trình nguồn |
| `api.get.d632a938b9c72492` | Tra cứu ca làm việc | Đọc | `GET /timekeeping/shifts` | Khả dụng | Có quy trình nguồn |
| `api.get.efd26957a4dbe889` | Tra cứu phân ca nhân viên | Đọc | `GET /timekeeping/shift-assignments` | Khả dụng | Có quy trình nguồn |
| `api.patch.08411917f1ed9b75` | Cập nhật ca làm việc | Ghi | `PATCH /timekeeping/shifts/:id` | Khả dụng | Có quy trình nguồn |
| `api.patch.6bc968347283a069` | Cập nhật giờ làm nhân viên | Ghi | `PATCH /timekeeping/work-hours/:uid` | Khả dụng | Có quy trình nguồn |
| `api.patch.cbf8c2b9d544f837` | Cập nhật địa điểm và khung giờ chấm công | Ghi | `PATCH /timekeeping/company-location` | Khả dụng | Có quy trình nguồn |
| `api.post.4e68581113f1ef79` | Tạo ca làm việc | Ghi | `POST /timekeeping/shifts` | Khả dụng | Có quy trình nguồn |
| `api.post.5511b45cf3a736d1` | Phân ca cho nhân viên | Ghi | `POST /timekeeping/shift-assignments` | Khả dụng | Có quy trình nguồn |
| `timekeeping.company.location` | Tra cứu địa điểm và khung giờ chấm công | Đọc | `GET /timekeeping/company-location` | Khả dụng | Có quy trình nguồn |
| `timekeeping.record.update` | Điều chỉnh dữ liệu chấm công | Ghi | `PATCH /timekeeping/records/adjust` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.absent` | Báo cáo nhân sự vắng hôm nay | Đọc | `GET /timekeeping/records` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.late` | Báo cáo nhân sự đi muộn hôm nay | Đọc | `GET /timekeeping/records` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.leave` | Báo cáo nhân sự nghỉ phép hôm nay | Đọc | `GET /timekeeping/records` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.list` | Tra cứu chấm công nhân sự trong ngày | Đọc | `GET /timekeeping/records` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.monthly.leave-summary` | Tổng hợp tất cả nhân sự nghỉ phép trong tháng | Đọc | `GET /timekeeping/monthly-report` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.monthly.most-absent` | Nhân sự nghỉ nhiều nhất trong tháng | Đọc | `GET /timekeeping/monthly-report` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.monthly.most-late` | Thống kê lượt đi làm trễ trong tháng | Đọc | `GET /timekeeping/monthly-report` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.monthly.most-leave` | Nhân sự nghỉ phép nhiều nhất trong tháng | Đọc | `GET /timekeeping/monthly-report` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.monthly.overview` | Tổng hợp chấm công theo tháng | Đọc | `GET /timekeeping/monthly-report` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.monthly.report` | Tổng hợp chấm công theo tháng | Đọc | `GET /timekeeping/monthly-report` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.monthly.under-threshold` | Nhân sự chưa đủ ngưỡng công trong tháng | Đọc | `GET /timekeeping/monthly-report` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.monthly.unrecorded` | Nhân sự chưa chấm công trong tháng | Đọc | `GET /timekeeping/monthly-report` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.overview` | Báo cáo tổng quan chấm công hôm nay | Đọc | `GET /timekeeping/records` | Khả dụng | Có quy trình nguồn |
| `timekeeping.records.unrecorded` | Báo cáo nhân sự chưa chấm công hôm nay | Đọc | `GET /timekeeping/records` | Khả dụng | Có quy trình nguồn |
| `timekeeping.today.me` | Tra cứu chấm công hôm nay của tôi | Đọc | `GET /timekeeping/today` | Khả dụng | Có quy trình nguồn |
| `timekeeping.work-calendar.audit` | Xem lịch sử thay đổi ngày trong lịch công ty | Đọc | `GET /timekeeping/work-calendar/:id/audit` | Khả dụng | UI không có / đang ẩn |
| `timekeeping.work-calendar.create` | Thêm ngày nghỉ hoặc ngày làm việc ngoại lệ | Ghi | `POST /timekeeping/work-calendar` | Khả dụng | Có quy trình nguồn |
| `timekeeping.work-calendar.list` | Tra cứu lịch ngày lễ và lịch làm việc công ty | Đọc | `GET /timekeeping/work-calendar` | Khả dụng | Có quy trình nguồn |
| `timekeeping.work-calendar.month-holidays` | Ngày nghỉ trong tháng | Đọc | `GET /timekeeping/work-calendar` | Khả dụng | Có quy trình nguồn |
| `timekeeping.work-calendar.named-holiday` | Tra cứu ngày nghỉ theo tên | Đọc | `GET /timekeeping/work-calendar` | Khả dụng | Có quy trình nguồn |
| `timekeeping.work-calendar.sync` | Đồng bộ lịch nghỉ lễ đã được duyệt | Ghi | `POST /timekeeping/work-calendar/sync` | Khả dụng | Có quy trình nguồn |
| `timekeeping.work-calendar.update` | Cập nhật ngày trong lịch công ty | Ghi | `PATCH /timekeeping/work-calendar/:id` | Khả dụng | Có quy trình nguồn |

#### 5. Nghỉ phép

Chức năng: Tra cứu đơn, phép năm và xử lý yêu cầu nghỉ theo quyền.

Ví dụ: “Tôi còn bao nhiêu ngày phép năm?”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `hr.leave.applications.list` | Tra cứu đơn nghỉ phép và làm việc từ xa | Đọc | `GET /crud/hr-leave-applications` | Khả dụng | Có quy trình nguồn |
| `leave.balance.me` | Tra cứu số dư phép năm của tôi | Đọc | `GET /leave/balance` | Khả dụng | Có quy trình nguồn |
| `leave.balances.exhausted` | Nhân sự đã hết phép năm | Đọc | `GET /leave/balances` | Khả dụng | UI không có / đang ẩn |
| `leave.balances.list` | Thống kê số phép năm còn lại của nhân sự | Đọc | `GET /leave/balances` | Khả dụng | UI không có / đang ẩn |
| `leave.balances.minimum` | Nhân sự còn ít nhất số ngày phép được yêu cầu | Đọc | `GET /leave/balances` | Khả dụng | UI không có / đang ẩn |
| `leave.balances.report` | Thống kê số dư phép năm nhân sự | Đọc | `GET /leave/balances` | Khả dụng | UI không có / đang ẩn |

#### 6. Tính lương

Chức năng: Quản lý kỳ lương, đầu vào, điều chỉnh và các bước xử lý lương.

Ví dụ: “Xem dữ liệu đầu vào kỳ lương tháng 11/2026.”

Liệt kê đầy đủ **63 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.79f4d36088c00b86` | Tra cứu dữ liệu đầu vào kỳ lương | Đọc | `GET /payroll/periods/:periodKey/inputs` | Khả dụng | UI không có / đang ẩn |
| `api.get.8a6bcc27085077c3` | Xem kết quả chấm công dùng để tính lương | Đọc | `GET /payroll/periods/:periodKey/results` | Khả dụng | Có quy trình nguồn |
| `api.get.ac427b464961eae6` | Xem nhật ký xử lý của kỳ lương | Đọc | `GET /payroll/periods/:periodKey/audit` | Khả dụng | UI không có / đang ẩn |
| `api.get.f2ac09bb2c5e311f` | Xem nhật ký thao tác của một lượt lương | Đọc | `GET /payroll/runs/:id/audit` | Khả dụng | UI không có / đang ẩn |
| `payroll.adjustment.approve` | Phê duyệt khoản điều chỉnh lương | Ghi | `POST /payroll/periods/:periodKey/adjustments/:adjustmentId/approve` | Khả dụng | Có quy trình nguồn |
| `payroll.adjustment.create` | Tạo khoản điều chỉnh lương | Ghi | `POST /payroll/periods/:periodKey/adjustments` | Khả dụng | Có quy trình nguồn |
| `payroll.adjustment.list` | Tra cứu khoản điều chỉnh lương trong kỳ | Đọc | `GET /payroll/periods/:periodKey/adjustments` | Khả dụng | Có quy trình nguồn |
| `payroll.adjustment.reject` | Từ chối khoản điều chỉnh lương | Ghi | `POST /payroll/periods/:periodKey/adjustments/:adjustmentId/reject` | Khả dụng | Có quy trình nguồn |
| `payroll.employee.me.payslip.review-requests` | Tra cứu yêu cầu kiểm tra phiếu lương của tôi | Đọc | `GET /payroll/employee/me/payslip-review-requests` | Khả dụng | Có quy trình nguồn |
| `payroll.employee.me.payslip.review.request` | Yêu cầu kiểm tra lại phiếu lương của tôi | Ghi | `POST /payroll/employee/me/payslips/:id/review-requests` | Khả dụng | Có quy trình nguồn |
| `payroll.employee.me.payslips` | Tra cứu phiếu lương của tôi | Đọc | `GET /payroll/employee/me/payslips` | Khả dụng | Có quy trình nguồn |
| `payroll.employee.me.reconciliation` | Tra cứu đối soát lương của tôi | Đọc | `GET /payroll/employee/me/reconciliation` | Khả dụng | Có quy trình nguồn |
| `payroll.employee.reconciliation.action` | Xác nhận hoặc trao đổi về đối soát lương của tôi | Ghi | `POST /payroll/employee/me/reconciliation/:id/actions` | Khả dụng | Có quy trình nguồn |
| `payroll.formula.activate` | Kích hoạt công thức tính lương | Ghi | `POST /payroll/formulas/:id/activate` | Khả dụng | UI không có / đang ẩn |
| `payroll.formula.clone` | Sao chép công thức tính lương | Ghi | `POST /payroll/formulas/:id/clone` | Khả dụng | UI không có / đang ẩn |
| `payroll.formula.create` | Tạo công thức tính lương | Ghi | `POST /payroll/formulas` | Khả dụng | UI không có / đang ẩn |
| `payroll.formula.list` | Tra cứu công thức tính lương | Đọc | `GET /payroll/formulas` | Khả dụng | UI không có / đang ẩn |
| `payroll.formula.retire` | Ngừng công thức tính lương | Ghi | `POST /payroll/formulas/:id/retire` | Khả dụng | UI không có / đang ẩn |
| `payroll.formula.update` | Cập nhật công thức tính lương | Ghi | `PATCH /payroll/formulas/:id` | Khả dụng | UI không có / đang ẩn |
| `payroll.payment.cancel` | Hủy đợt thanh toán lương nháp | Ghi | `POST /payroll/payments/:id/cancel` | Khả dụng | UI không có / đang ẩn |
| `payroll.payment.confirm` | Xác nhận đợt thanh toán lương đã chuyển tiền | Ghi | `POST /payroll/payments/:id/confirm` | Khả dụng | UI không có / đang ẩn |
| `payroll.payment.reverse` | Đảo xác nhận đợt thanh toán lương | Ghi | `POST /payroll/payments/:id/reverse` | Khả dụng | UI không có / đang ẩn |
| `payroll.period.input.update` | Cập nhật dữ liệu đầu vào lương nhân sự | Ghi | `PUT /payroll/periods/:periodKey/inputs/:employeeId` | Khả dụng | UI không có / đang ẩn |
| `payroll.period.inputs.bulk` | Cập nhật dữ liệu đầu vào lương hàng loạt | Ghi | `PUT /payroll/periods/:periodKey/inputs` | Khả dụng | UI không có / đang ẩn |
| `payroll.period.line-overrides.bulk` | Ghi đè các khoản lương theo nhân viên | Ghi | `PUT /payroll/periods/:periodKey/line-overrides` | Khả dụng | Có quy trình nguồn |
| `payroll.period.line-overrides.list` | Tra cứu các khoản lương được ghi đè thủ công | Đọc | `GET /payroll/periods/:periodKey/line-overrides` | Khả dụng | Có quy trình nguồn |
| `payroll.period.reset` | Đặt lại kỳ lương | Ghi | `DELETE /payroll/periods/:periodKey` | Khả dụng | Có quy trình nguồn |
| `payroll.period.variables.activate` | Kích hoạt biến dữ liệu đầu vào bảng lương | Ghi | `POST /payroll/period-input-variables/:id/activate` | Khả dụng | Có quy trình nguồn |
| `payroll.period.variables.create` | Tạo biến dữ liệu đầu vào bảng lương | Ghi | `POST /payroll/period-input-variables` | Khả dụng | Có quy trình nguồn |
| `payroll.period.variables.list` | Tra cứu biến dữ liệu đầu vào bảng lương | Đọc | `GET /payroll/period-input-variables` | Khả dụng | Có quy trình nguồn |
| `payroll.period.variables.retire` | Ngừng biến dữ liệu đầu vào bảng lương | Ghi | `POST /payroll/period-input-variables/:id/retire` | Khả dụng | Có quy trình nguồn |
| `payroll.period.variables.update` | Cập nhật biến dữ liệu đầu vào bảng lương | Ghi | `PATCH /payroll/period-input-variables/:id` | Khả dụng | UI không có / đang ẩn |
| `payroll.policy.activate` | Áp dụng chính sách lương | Ghi | `POST /payroll/policies/:id/activate` | Khả dụng | Có quy trình nguồn |
| `payroll.policy.clone` | Sao chép chính sách lương | Ghi | `POST /payroll/policies/:id/clone` | Khả dụng | Có quy trình nguồn |
| `payroll.policy.create` | Tạo chính sách lương | Ghi | `POST /payroll/policies` | Khả dụng | Có quy trình nguồn |
| `payroll.policy.delete` | Xóa chính sách lương | Ghi | `DELETE /payroll/policies/:id` | Khả dụng | Có quy trình nguồn |
| `payroll.policy.list` | Tra cứu chính sách lương | Đọc | `GET /payroll/policies` | Khả dụng | Có quy trình nguồn |
| `payroll.policy.retire` | Ngừng chính sách lương | Ghi | `POST /payroll/policies/:id/retire` | Khả dụng | Có quy trình nguồn |
| `payroll.policy.update` | Cập nhật chính sách lương | Ghi | `PATCH /payroll/policies/:id` | Khả dụng | Có quy trình nguồn |
| `payroll.reconciliation.schedule.get` | Tra cứu lịch phát hành đối soát lương | Đọc | `GET /payroll/reconciliation-schedule` | Khả dụng | Có quy trình nguồn |
| `payroll.reconciliation.schedule.update` | Cài đặt lịch phát hành đối soát lương | Ghi | `PUT /payroll/reconciliation-schedule` | Khả dụng | Có quy trình nguồn |
| `payroll.run.calculate` | Tính lương cho lượt đã khóa công | Ghi | `POST /payroll/runs/:id/calculate` | Khả dụng | Có quy trình nguồn |
| `payroll.run.close` | Chốt lượt lương đã duyệt | Ghi | `POST /payroll/runs/:id/close` | Khả dụng | Có quy trình nguồn |
| `payroll.run.complaints.list` | Tổng hợp khiếu nại bảng lương | Đọc | `GET /payroll/runs/:id/reconciliation` | Khả dụng | Có quy trình nguồn |
| `payroll.run.create` | Tạo bản nháp lượt chạy lương định kỳ | Ghi | `POST /payroll/runs` | Khả dụng | UI không có / đang ẩn |
| `payroll.run.issues.list` | Xem lỗi và cảnh báo của lượt lương | Đọc | `GET /payroll/runs/:id/issues` | Khả dụng | UI không có / đang ẩn |
| `payroll.run.line.detail` | Xem chi tiết lương nhân viên | Đọc | `GET /payroll/runs/:id/lines/:employeeId` | Khả dụng | Có quy trình nguồn |
| `payroll.run.list` | Tra cứu lượt chạy lương | Đọc | `GET /payroll/runs` | Khả dụng | UI không có / đang ẩn |
| `payroll.run.lock-attendance` | Khóa snapshot công của lượt lương | Ghi | `POST /payroll/runs/:id/lock-attendance` | Khả dụng | UI không có / đang ẩn |
| `payroll.run.mark-paid` | Đánh dấu lượt lương đã thanh toán | Ghi | `POST /payroll/runs/:id/mark-paid` | Khả dụng | Có quy trình nguồn |
| `payroll.run.payment.create` | Tạo đợt thanh toán lương nháp | Ghi | `POST /payroll/runs/:id/payments` | Khả dụng | UI không có / đang ẩn |
| `payroll.run.payments.list` | Tra cứu các đợt thanh toán lương | Đọc | `GET /payroll/runs/:id/payments` | Khả dụng | UI không có / đang ẩn |
| `payroll.run.payslip.review-request.resolve` | Phản hồi yêu cầu kiểm tra phiếu lương | Ghi | `POST /payroll/runs/:id/payslip-review-requests/:requestId/resolve` | Khả dụng | Có quy trình nguồn |
| `payroll.run.payslip.review-requests.list` | Tra cứu yêu cầu kiểm tra phiếu lương | Đọc | `GET /payroll/runs/:id/payslip-review-requests` | Khả dụng | Có quy trình nguồn |
| `payroll.run.payslips.publish` | Công bố phiếu lương trong ứng dụng | Ghi | `POST /payroll/runs/:id/payslips/publish` | Khả dụng | Có quy trình nguồn |
| `payroll.run.payslips.withdraw` | Thu hồi phiếu lương đã công bố | Ghi | `POST /payroll/runs/:id/payslips/:employeeId/withdraw` | Khả dụng | UI không có / đang ẩn |
| `payroll.run.recalculate` | Tính lại lương cho lượt đã khóa công | Ghi | `POST /payroll/runs/:id/recalculate` | Khả dụng | UI không có / đang ẩn |
| `payroll.run.reconciliation.action` | Phản hồi hoặc xử lý khiếu nại lương | Ghi | `POST /payroll/runs/:id/reconciliation/:employeeId/actions` | Khả dụng | Có quy trình nguồn |
| `payroll.run.reconciliation.list` | Tra cứu trạng thái đối soát lương của nhân viên | Đọc | `GET /payroll/runs/:id/reconciliation` | Khả dụng | Có quy trình nguồn |
| `payroll.run.reconciliation.publish` | Phát hành bảng lương tạm tính để đối soát | Ghi | `POST /payroll/runs/:id/reconciliation/publish` | Khả dụng | Có quy trình nguồn |
| `payroll.run.reopen` | Mở lại lượt lương | Ghi | `POST /payroll/runs/:id/reopen` | Khả dụng | Có quy trình nguồn |
| `payroll.run.review` | Gửi lượt lương sang chờ duyệt | Ghi | `POST /payroll/runs/:id/review` | Khả dụng | Có quy trình nguồn |
| `payroll.run.sync-attendance` | Đồng bộ công vào lượt chạy lương | Ghi | `POST /payroll/runs/:id/sync-attendance` | Khả dụng | UI không có / đang ẩn |

#### 7. Tuyển dụng

Chức năng: Quản lý ứng viên, nhu cầu tuyển và các bước tuyển dụng.

Ví dụ: “Thêm ứng viên UNG-VIEN-QA vào đợt tuyển đang chọn.”

Liệt kê đầy đủ **23 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `recruitment.applicant.create` | Thêm ứng viên | Ghi | `POST /recruitment/applicants` | Khả dụng | Có quy trình nguồn |
| `recruitment.applicant.delete` | Xóa mềm hồ sơ ứng viên | Ghi | `POST /recruitment/applicants/:id/delete` | Khả dụng | UI không có / đang ẩn |
| `recruitment.applicant.detail` | Xem hồ sơ ứng viên | Đọc | `GET /recruitment/applicants/:id` | Khả dụng | Có quy trình nguồn |
| `recruitment.applicant.history` | Xem lịch sử tuyển dụng ứng viên | Đọc | `GET /recruitment/applicants/:id/history` | Khả dụng | Có quy trình nguồn |
| `recruitment.applicant.list` | Tra cứu ứng viên | Đọc | `GET /recruitment/applicants` | Khả dụng | Có quy trình nguồn |
| `recruitment.applicant.restore` | Khôi phục hồ sơ ứng viên | Ghi | `POST /recruitment/applicants/:id/restore` | Khả dụng | UI không có / đang ẩn |
| `recruitment.applicant.transition` | Chuyển bước tuyển dụng cho ứng viên | Ghi | `POST /recruitment/applicants/:id/transition` | Khả dụng | Có quy trình nguồn |
| `recruitment.applicant.update` | Cập nhật hồ sơ ứng viên | Ghi | `PATCH /recruitment/applicants/:id` | Khả dụng | Có quy trình nguồn |
| `recruitment.interview.create` | Tạo lịch phỏng vấn | Ghi | `POST /recruitment/interviews` | Khả dụng | Có quy trình nguồn |
| `recruitment.interview.delete` | Xóa lịch phỏng vấn | Ghi | `POST /recruitment/interviews/:id/delete` | Khả dụng | Có quy trình nguồn |
| `recruitment.interview.detail` | Xem lịch phỏng vấn | Đọc | `GET /recruitment/interviews/:id` | Khả dụng | Có quy trình nguồn |
| `recruitment.interview.list` | Tra cứu lịch phỏng vấn | Đọc | `GET /recruitment/interviews` | Khả dụng | Có quy trình nguồn |
| `recruitment.interview.restore` | Khôi phục lịch phỏng vấn | Ghi | `POST /recruitment/interviews/:id/restore` | Khả dụng | UI không có / đang ẩn |
| `recruitment.interview.update` | Cập nhật lịch phỏng vấn | Ghi | `PATCH /recruitment/interviews/:id` | Khả dụng | Có quy trình nguồn |
| `recruitment.job.create` | Tạo vị trí tuyển dụng | Ghi | `POST /recruitment/jobs` | Khả dụng | Có quy trình nguồn |
| `recruitment.job.delete` | Xóa mềm vị trí tuyển dụng | Ghi | `POST /recruitment/jobs/:id/delete` | Khả dụng | Có quy trình nguồn |
| `recruitment.job.detail` | Xem vị trí tuyển dụng | Đọc | `GET /recruitment/jobs/:id` | Khả dụng | Có quy trình nguồn |
| `recruitment.job.list` | Tra cứu vị trí tuyển dụng | Đọc | `GET /recruitment/jobs` | Khả dụng | Có quy trình nguồn |
| `recruitment.job.restore` | Khôi phục vị trí tuyển dụng | Ghi | `POST /recruitment/jobs/:id/restore` | Khả dụng | UI không có / đang ẩn |
| `recruitment.job.status` | Đổi trạng thái vị trí tuyển dụng | Ghi | `POST /recruitment/jobs/:id/status` | Khả dụng | Có quy trình nguồn |
| `recruitment.job.update` | Cập nhật vị trí tuyển dụng | Ghi | `PATCH /recruitment/jobs/:id` | Khả dụng | Có quy trình nguồn |
| `recruitment.pipeline.get` | Tra cứu các bước tuyển dụng | Đọc | `GET /recruitment/pipeline` | Khả dụng | Có quy trình nguồn |
| `recruitment.report` | Báo cáo tuyển dụng | Đọc | `GET /recruitment/reports/assistant` | Khả dụng | UI không có / đang ẩn |

#### 8. Dự án nhân sự

Chức năng: Tạo, xem, sửa, xóa dự án nội bộ thuộc Nhân sự.

Ví dụ: “Tạo dự án DU-AN-NOI-BO-QA trong Nhân sự.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `project.create` | Tạo dự án | Ghi | `POST /kanban/projects` | Khả dụng | Có quy trình nguồn |
| `project.delete` | Xóa dự án | Ghi | `DELETE /kanban/projects/:id` | Khả dụng | Có quy trình nguồn |
| `project.list` | Tra cứu dự án | Đọc | `GET /kanban/projects` | Khả dụng | Có quy trình nguồn |
| `project.update` | Cập nhật dự án | Ghi | `PATCH /kanban/projects/:id` | Khả dụng | Có quy trình nguồn |

Lưu ý: Không dùng nhóm này cho dự án quản lý lao động; loại đó thuộc worker.project.*.

#### 9. Công việc

Chức năng: Tạo, cập nhật, theo dõi và xóa công việc.

Ví dụ: “Tạo công việc CONG-VIEC-QA cho dự án đã chọn.”

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `task.activity.update` | Cập nhật hoạt động công việc | Ghi | `PATCH /kanban/tasks/:id/activity` | Khả dụng | Có quy trình nguồn |
| `task.create` | Tạo công việc | Ghi | `POST /kanban/tasks` | Khả dụng | Có quy trình nguồn |
| `task.delete` | Xóa công việc | Ghi | `DELETE /kanban/tasks/:id` | Khả dụng | Có quy trình nguồn |
| `task.kpi.monthly` | Báo cáo KPI công việc theo tháng | Đọc | `GET /kanban/kpi/monthly` | Khả dụng | Có quy trình nguồn |
| `task.list` | Tra cứu công việc | Đọc | `GET /kanban/tasks` | Khả dụng | Có quy trình nguồn |
| `task.update` | Cập nhật công việc | Ghi | `PATCH /kanban/tasks/:id` | Khả dụng | Có quy trình nguồn |
| `api.get.15793bc7bd272c4c` | Xem chỉ số công việc theo tháng | Đọc | `GET /kanban/kpi/monthly` | Khả dụng | Có quy trình nguồn |

#### 10. Đào tạo nội bộ

Chức năng: Quản lý khóa đào tạo và tiến độ học của nhân sự.

Ví dụ: “Báo cáo tiến độ khóa đào tạo DAO-TAO-QA.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `hr.training.incomplete.list` | Báo cáo tiến độ đào tạo nội bộ chưa hoàn thành | Đọc | `GET /crud/training-enrollments` | Khả dụng | Có quy trình nguồn |
| `hr.training.progress` | Báo cáo toàn bộ tiến độ đào tạo nội bộ | Đọc | `GET /crud/training-enrollments` | Khả dụng | Có quy trình nguồn |
| `training.create` | Tạo khóa đào tạo | Ghi | `POST /crud/training-courses` | Khả dụng | Có quy trình nguồn |
| `training.delete` | Xóa khóa đào tạo nội bộ | Ghi | `DELETE /crud/training-courses/:id` | Khả dụng | Có quy trình nguồn |
| `training.list` | Tra cứu khóa đào tạo | Đọc | `GET /crud/training-courses` | Khả dụng | Có quy trình nguồn |
| `training.update` | Cập nhật khóa đào tạo | Ghi | `PATCH /crud/training-courses/:id` | Khả dụng | Có quy trình nguồn |

Lưu ý: Khác khóa học/lớp dành cho học viên ở module student.

#### 11. Quy trình làm việc

Chức năng: Tạo và chỉnh sửa quy trình, các bước và nhãn phân loại.

Ví dụ: “Đổi tên một bước trong quy trình QUY-TRINH-QA.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `hr.workflow.category.create` | Tạo nhãn phân loại quy trình | Ghi | `POST /crud/workflow-categories` | Khả dụng | Có quy trình nguồn |
| `hr.workflow.create` | Tạo quy trình làm việc | Ghi | `POST /crud/workflows` | Khả dụng | Có quy trình nguồn |
| `hr.workflow.delete` | Xóa quy trình làm việc | Ghi | `DELETE /crud/workflows/:id` | Khả dụng | Có quy trình nguồn |
| `hr.workflow.list` | Tra cứu quy trình làm việc | Đọc | `GET /crud/workflows` | Khả dụng | Có quy trình nguồn |
| `hr.workflow.update` | Cập nhật quy trình làm việc | Ghi | `PATCH /crud/workflows/:id` | Khả dụng | Có quy trình nguồn |

#### 12. Chi nhánh — bổ sung

Chức năng: Tra cứu, tạo, cập nhật và hủy chi nhánh chưa hoàn tất thiết lập.

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `branch.create` | Tạo chi nhánh | Ghi | `POST /auth/branches` | Khả dụng | Có quy trình nguồn |
| `branch.list` | Tra cứu chi nhánh | Đọc | `GET /auth/branches` | Khả dụng | Có quy trình nguồn |
| `branch.pending.delete` | Hủy chi nhánh chưa thiết lập chủ | Ghi | `DELETE /auth/branches/:id/pending` | Khả dụng | Có quy trình nguồn |
| `branch.update` | Cập nhật chi nhánh | Ghi | `PATCH /auth/branches/:id` | Khả dụng | Có quy trình nguồn |

#### 13. Phân quyền vai trò — bổ sung

Chức năng: Tra danh mục quyền, xem và thay cấu hình quyền theo vai trò.

Ví dụ: “Xem quyền của vai trò đang chọn.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `access.permission-catalog.detail` | Xem chi tiết một quyền hệ thống | Đọc | `GET /permissions/:code` | Khả dụng | Chưa xác minh UI |
| `access.permission-catalog.list` | Tra cứu danh mục quyền hệ thống | Đọc | `GET /permissions` | Khả dụng | Chưa xác minh UI |
| `access.role-permissions.detail` | Xem cấu hình quyền của một vai trò | Đọc | `GET /role-permissions/:role` | Khả dụng | Chưa xác minh UI |
| `access.role-permissions.list` | Tra cứu cấu hình quyền theo vai trò | Đọc | `GET /role-permissions` | Khả dụng | Chưa xác minh UI |
| `access.role-permissions.save` | Cập nhật phân quyền vai trò | Ghi | `POST /role-permissions` | Khả dụng | Chưa xác minh UI |

Lưu ý: Cập nhật quyền thay toàn bộ tập quyền của vai trò, không phải chỉnh một quyền ngầm.

#### 14. Email chúc mừng và cấu hình gửi công ty — bổ sung

Chức năng: Xem/cập nhật email chúc mừng, kiểm tra SMTP, gửi thử và xem lịch sử.

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `company-email.celebration.config` | Xem tóm tắt cài đặt email chúc mừng | Đọc | `GET /company-email/celebration` | Khả dụng | Có quy trình nguồn |
| `company-email.celebration.history` | Tổng hợp lịch sử email chúc mừng | Đọc | `GET /company-email/celebration/history` | Khả dụng | Có quy trình nguồn |
| `company-email.celebration.preview` | Xem trước email chúc mừng | Đọc | `POST /company-email/celebration/preview` | Khả dụng | Có quy trình nguồn |
| `company-email.celebration.update` | Cập nhật cài đặt email chúc mừng | Ghi | `PATCH /company-email/celebration` | Khả dụng | Có quy trình nguồn |
| `company-email.smtp.config` | Xem tóm tắt cấu hình SMTP công ty | Đọc | `GET /company-email/smtp` | Khả dụng | Chưa xác minh UI |
| `company-email.smtp.test` | Gửi email thử SMTP | Ghi | `POST /company-email/smtp/test` | Khả dụng | Chưa xác minh UI |
| `company-email.smtp.verify` | Kiểm tra kết nối SMTP công ty | Ghi | `POST /company-email/smtp/verify` | Khả dụng | Chưa xác minh UI |

#### 15. Lịch và sự kiện nội bộ — bổ sung

Chức năng: Tra cứu, tạo hoặc cập nhật sự kiện theo action đã đăng ký.

Ví dụ: “Xem lịch sự kiện nội bộ.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `hr.calendar.event.create` | Tạo sự kiện nội bộ | Ghi | `POST /crud/hr-calendar-events` | Khả dụng | UI không có / đang ẩn |
| `hr.calendar.event.update` | Cập nhật sự kiện nội bộ | Ghi | `PATCH /crud/hr-calendar-events/:id` | Khả dụng | UI không có / đang ẩn |
| `hr.calendar.events.list` | Tra cứu sự kiện nội bộ và lịch hôm nay | Đọc | `GET /crud/hr-calendar-events` | Khả dụng | Có quy trình nguồn |

Lưu ý: Có API/catal og tạo sự kiện không có nghĩa form tạo đã được nối vào màn Lịch. Xem bằng chứng UI theo từng action.

#### 16. Tổng quan doanh nghiệp và việc trong ngày — bổ sung

Chức năng: Xem dashboard, việc cần xử lý và báo cáo nhân sự hôm nay.

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `hr.daily.overview` | Báo cáo tình hình nhân sự hôm nay | Đọc | `GET /timekeeping/records` | Khả dụng | Có quy trình nguồn |
| `api.get.38c4520f180b420b` | Xem tổng quan hoạt động doanh nghiệp | Đọc | `GET /dashboard/summary` | Khả dụng | Chưa xác minh UI |
| `api.get.a0937fb0c693e329` | Xem việc cần xử lý hôm nay | Đọc | `GET /dashboard/action-items` | Khả dụng | Chưa xác minh UI |
| `dashboard.business-overview` | Xem tổng quan hoạt động doanh nghiệp | Đọc | `GET /dashboard/business-overview` | Khả dụng | Chưa xác minh UI |

<a id="module-inventory"></a>
### Kho & Sản phẩm — `inventory`

**10 nhóm · 68 action (68 khả dụng, 0 không khả dụng).**

#### 1. Sản phẩm, SKU và giá

Chức năng: Quản lý sản phẩm, biến thể bán được, giá bán và giá vốn.

Ví dụ: “Tạo sản phẩm SAN-PHAM-QA với SKU và giá bán.”

Liệt kê đầy đủ **13 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.cc58d03a74329723` | Xóa kho hàng danh mục sản phẩm | Ghi | `DELETE /inventory/catalog/products/:id` | Khả dụng | Có quy trình nguồn |
| `api.patch.78eb0c3b82d1f735` | Cập nhật thông tin SKU | Ghi | `PATCH /inventory/catalog/variants/:id` | Khả dụng | Có quy trình nguồn |
| `api.patch.ec4179bd45d62cbf` | Cập nhật thông tin sản phẩm | Ghi | `PATCH /inventory/catalog/products/:id` | Khả dụng | Có quy trình nguồn |
| `api.post.435334a57fb9c949` | Thêm nhiều SKU cho sản phẩm | Ghi | `POST /inventory/catalog/products/:id/variants/bulk` | Khả dụng | Có quy trình nguồn |
| `api.post.5905a76c5b33f482` | Tạo sản phẩm với nhiều SKU | Ghi | `POST /inventory/catalog/products/bulk-create-with-variants` | Khả dụng | Có quy trình nguồn |
| `api.put.f369bafc104121fe` | Cập nhật giá nhập và giá bán SKU | Ghi | `PUT /inventory/catalog/prices/:variantId` | Khả dụng | Có quy trình nguồn |
| `inventory.prices.list` | Tra cứu giá bán và giá vốn SKU | Đọc | `GET /inventory/catalog/prices` | Khả dụng | Có quy trình nguồn |
| `inventory.product.create.sellable` | Tạo sản phẩm và SKU kèm giá bán | Ghi | `POST /inventory/catalog/products/with-price` | Khả dụng | Có quy trình nguồn |
| `inventory.product.detail` | Xem chi tiết sản phẩm và SKU | Đọc | `GET /inventory/catalog/products/:id` | Khả dụng | Có quy trình nguồn |
| `product.list` | Tra cứu sản phẩm | Đọc | `GET /inventory/catalog/products` | Khả dụng | Có quy trình nguồn |
| `inventory.variant.bulk.delete` | Xóa nhiều SKU | Ghi | `DELETE /inventory/catalog/variants/bulk` | Khả dụng | Có quy trình nguồn |
| `inventory.variant.bulk.update` | Cập nhật nhiều SKU | Ghi | `PATCH /inventory/catalog/variants/bulk` | Khả dụng | UI không có / đang ẩn |
| `inventory.variant.create.sellable` | Thêm SKU kèm giá bán | Ghi | `POST /inventory/catalog/products/:id/variants/with-price` | Khả dụng | Có quy trình nguồn |

Lưu ý: ID dòng SKU khác ID sản phẩm. Không dùng ID SKU thay cho đích sản phẩm.

#### 2. Danh mục sản phẩm

Chức năng: Quản lý thể loại, thương hiệu, đơn vị, thuộc tính và mẫu.

Ví dụ: “Tạo danh mục DANH-MUC-QA.”

Liệt kê đầy đủ **14 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `inventory.catalog.defaults.seed` | Tạo dữ liệu danh mục kho mặc định | Ghi | `POST /inventory/catalog/resources/seed/defaults` | Khả dụng | UI không có / đang ẩn |
| `inventory.catalog.resource.list` | Tra cứu danh mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm | Đọc | `GET /inventory/catalog/resources/:kind` | Khả dụng | Có quy trình nguồn |
| `inventory.catalog.template.list` | Tra cứu mẫu sản phẩm | Đọc | `GET /inventory/catalog/templates` | Khả dụng | UI không có / đang ẩn |
| `inventory.catalog.unit.create` | Tạo đơn vị tính | Ghi | `POST /inventory/catalog/resources/:kind` | Khả dụng | Có quy trình nguồn |
| `inventory.catalog.workspace.update` | Đổi cách quản lý danh mục sản phẩm | Ghi | `PATCH /inventory/catalog/workspace` | Khả dụng | Có quy trình nguồn |
| `category.create` | Tạo danh mục kho | Ghi | `POST /crud/categories` | Khả dụng | UI không có / đang ẩn |
| `category.delete` | Xóa danh mục kho | Ghi | `DELETE /crud/categories/:id` | Khả dụng | UI không có / đang ẩn |
| `category.list` | Tra cứu danh mục kho | Đọc | `GET /crud/categories` | Khả dụng | UI không có / đang ẩn |
| `category.update` | Cập nhật danh mục kho | Ghi | `PATCH /crud/categories/:id` | Khả dụng | UI không có / đang ẩn |
| `api.delete.9301905784a3a33e` | Xóa dữ liệu danh mục sản phẩm | Ghi | `DELETE /inventory/catalog/resources/:kind/:id` | Khả dụng | Có quy trình nguồn |
| `api.patch.401f92bc17a703e3` | Cập nhật mẫu sản phẩm | Ghi | `PATCH /inventory/catalog/templates/:id` | Khả dụng | UI không có / đang ẩn |
| `api.patch.ad1b26d154f5621c` | Cập nhật dữ liệu dùng chung cho sản phẩm | Ghi | `PATCH /inventory/catalog/resources/:kind/:id` | Khả dụng | Có quy trình nguồn |
| `api.post.705bdfe1a603a06f` | Tạo mẫu sản phẩm | Ghi | `POST /inventory/catalog/templates` | Khả dụng | UI không có / đang ẩn |
| `api.post.c29d50d7a2ebd989` | Tạo thể loại / thư mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm | Ghi | `POST /inventory/catalog/resources/:kind` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `inventory.catalog.workspace.get`.

#### 3. Nhà cung cấp

Chức năng: Tra cứu, cập nhật hoặc xóa nhà cung cấp đã có.

Ví dụ: “Sửa thông tin nhà cung cấp NHA-CUNG-CAP-QA.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.patch.d638d3bb0a56b64b` | Cập nhật nhà cung cấp | Ghi | `PATCH /inventory/receiving/suppliers/:id` | Khả dụng | UI không có / đang ẩn |
| `inventory.supplier.delete` | Xóa nhà cung cấp | Ghi | `DELETE /inventory/receiving/suppliers/:id` | Khả dụng | UI không có / đang ẩn |
| `inventory.supplier.list` | Tra cứu nhà cung cấp | Đọc | `GET /inventory/receiving/suppliers` | Khả dụng | Có quy trình nguồn |

Lưu ý: Catalog hiện không có action tạo nhà cung cấp riêng trong module inventory; không tự suy ra CRUD đầy đủ.

#### 4. Tra cứu kho và tồn

Chức năng: Xem kho, thông tin tồn và vị trí IMEI/serial trong phạm vi cho phép.

Ví dụ: “Tìm IMEI-QA đang nằm ở kho nào.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `inventory.catalog.workspace.get` | Xem thông tin chung về sản phẩm và kho hàng | Đọc | `GET /inventory/catalog/workspace` | Khả dụng | Có quy trình nguồn |
| `inventory.serial.detail` | Xem chi tiết IMEI hoặc serial | Đọc | `GET /inventory/serials/:id` | Khả dụng | Có quy trình nguồn |
| `inventory.serial.list` | Tra cứu IMEI, serial và mã đơn vị | Đọc | `GET /inventory/serials` | Khả dụng | Có quy trình nguồn |
| `inventory.warehouse.locations.list` | Tra cứu kho | Đọc | `GET /inventory/warehouses` | Khả dụng | Có quy trình nguồn |

Lưu ý: Không đồng nhất số lượng dòng sản phẩm với số tồn. Chi tiết tồn phụ thuộc nguồn/đầu ra được chọn.

#### 5. Nhập kho

Chức năng: Lập, sửa, gửi, nhận, xác nhận hoặc hủy phiếu nhập.

Ví dụ: “Tạo phiếu nhập cho nhà cung cấp NHA-CUNG-CAP-QA.”

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `inventory.receipt.cancel` | Hủy phiếu nhập kho | Ghi | `POST /inventory/receiving/receipts/:id/cancel` | Khả dụng | Có quy trình nguồn |
| `inventory.receipt.confirm` | Xác nhận nhập kho và cập nhật tồn | Ghi | `POST /inventory/receiving/receipts/:id/confirm` | Khả dụng | Có quy trình nguồn |
| `inventory.receipt.create` | Tạo phiếu nhập kho | Ghi | `POST /inventory/receiving/receipts` | Khả dụng | Có quy trình nguồn |
| `inventory.receipt.list` | Tra cứu phiếu nhập kho | Đọc | `GET /inventory/receiving/receipts` | Khả dụng | Có quy trình nguồn |
| `inventory.receipt.start` | Bắt đầu nhận hàng vào kho | Ghi | `POST /inventory/receiving/receipts/:id/start-receiving` | Khả dụng | Có quy trình nguồn |
| `inventory.receipt.submit` | Gửi phiếu nhập xác nhận | Ghi | `POST /inventory/receiving/receipts/:id/submit` | Khả dụng | Có quy trình nguồn |
| `inventory.receipt.update` | Cập nhật phiếu nhập kho | Ghi | `PATCH /inventory/receiving/receipts/:id` | Khả dụng | Có quy trình nguồn |

#### 6. Xuất kho và phiếu nhập xuất

Chức năng: Tra lịch sử nhập xuất và đảo phiếu xuất thủ công đã có.

Ví dụ: “Xem các phiếu xuất của kho KHO-QA.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `inventory.stock-log.list` | Tra cứu phiếu nhập xuất kho | Đọc | `GET /crud/stock-logs` | Khả dụng | Có quy trình nguồn |
| `inventory.stock-log.reverse` | Đảo phiếu xuất kho thủ công | Ghi | `POST /inventory/stock-logs/:id/reverse` | Khả dụng | Có quy trình nguồn |

Lưu ý: Không thấy action tạo phiếu xuất thủ công độc lập trong catalog inventory. Xuất khi bán hàng hoặc cấp linh kiện đi qua nghiệp vụ retail/repair tương ứng; chưa được coi nhóm này có đủ tạo/sửa/xóa.

#### 7. Điều chuyển kho

Chức năng: Tạo, tra, nhận hoặc hủy điều chuyển giữa kho/chi nhánh.

Ví dụ: “Chuyển hàng từ KHO-QA-A sang KHO-QA-B.”

Liệt kê đầy đủ **9 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `inventory.serial.transfer.accept` | Nhận IMEI hoặc serial được điều chuyển | Ghi | `POST /inventory/serials/:id/transfer/accept` | Khả dụng | UI không có / đang ẩn |
| `inventory.serial.transfer.cancel` | Hủy điều chuyển IMEI hoặc serial | Ghi | `POST /inventory/serials/:id/transfer/cancel` | Khả dụng | UI không có / đang ẩn |
| `inventory.serial.transfer.local` | Chuyển IMEI hoặc serial giữa các kho trong chi nhánh | Ghi | `POST /inventory/serials/:id/transfer` | Khả dụng | UI không có / đang ẩn |
| `inventory.serial.transfer.request` | Gửi IMEI hoặc serial sang chi nhánh | Ghi | `POST /inventory/serials/:id/transfer/request` | Khả dụng | UI không có / đang ẩn |
| `inventory.transfer.accept` | Nhận phiếu điều chuyển kho | Ghi | `POST /inventory/transfers/:id/accept` | Khả dụng | Có quy trình nguồn |
| `inventory.transfer.cancel` | Hủy phiếu điều chuyển kho | Ghi | `POST /inventory/transfers/:id/cancel` | Khả dụng | Có quy trình nguồn |
| `inventory.transfer.create` | Tạo phiếu điều chuyển kho | Ghi | `POST /inventory/transfers` | Khả dụng | Có quy trình nguồn |
| `inventory.transfer.detail` | Xem chi tiết phiếu điều chuyển kho | Đọc | `GET /inventory/transfers/:id` | Khả dụng | Có quy trình nguồn |
| `inventory.transfer.list` | Tra cứu phiếu điều chuyển kho | Đọc | `GET /inventory/transfers` | Khả dụng | Có quy trình nguồn |

#### 8. Kiểm kê và đối soát

Chức năng: Mở, ghi nhận, duyệt kiểm kê và đối soát dữ liệu tồn.

Ví dụ: “Mở phiếu kiểm kê tại KHO-QA.”

Liệt kê đầy đủ **12 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.454f78ec53f74015` | Hủy phiếu kiểm kê | Ghi | `POST /inventory/counts/:id/cancel` | Khả dụng | Có quy trình nguồn |
| `api.post.5e0381daf5057103` | Quét mã vào phiếu kiểm kê | Ghi | `POST /inventory/counts/:id/scan` | Khả dụng | Có quy trình nguồn |
| `api.post.a9dc1045ea6b35ab` | Gửi phiếu kiểm kê để duyệt | Ghi | `POST /inventory/counts/:id/submit` | Khả dụng | Có quy trình nguồn |
| `api.post.f03e901c8ee14a8f` | Bắt đầu kiểm kê kho | Ghi | `POST /inventory/counts/:id/start` | Khả dụng | Có quy trình nguồn |
| `api.post.feaf71a366c8880e` | Tạo phiếu kiểm kê kho | Ghi | `POST /inventory/counts` | Khả dụng | Có quy trình nguồn |
| `inventory.count.approve` | Phê duyệt kiểm kê và cập nhật tồn kho | Ghi | `POST /inventory/counts/:id/approve` | Khả dụng | Có quy trình nguồn |
| `inventory.count.detail` | Xem phiếu kiểm kê kho | Đọc | `GET /inventory/counts/:id` | Khả dụng | Có quy trình nguồn |
| `inventory.count.item.update` | Cập nhật dòng kiểm kê kho | Ghi | `PATCH /inventory/counts/:id/items/:itemId` | Khả dụng | Có quy trình nguồn |
| `inventory.count.list` | Tra cứu phiếu kiểm kê kho | Đọc | `GET /inventory/counts` | Khả dụng | Có quy trình nguồn |
| `inventory.count.recreate` | Tạo lại phiếu kiểm kê bị xung đột | Ghi | `POST /inventory/counts/:id/recreate` | Khả dụng | Có quy trình nguồn |
| `inventory.reconciliation.run` | Đối soát dữ liệu tồn kho | Đọc | `POST /inventory/reconciliation/runs` | Khả dụng | UI không có / đang ẩn |
| `inventory.reconciliation.warehouses.list` | Tra cứu kho để đối soát tồn | Đọc | `GET /inventory/reconciliation/warehouses` | Khả dụng | UI không có / đang ẩn |

Lưu ý: Một số test ma trận kiểm kê vẫn thất bại từ baseline. Đăng ký catalog không chứng minh toàn luồng đã đạt.

#### 9. IMEI và serial

Chức năng: Đăng ký, tra lịch sử, cập nhật trạng thái và vị trí từng thiết bị.

Ví dụ: “Xem lịch sử IMEI-QA.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `inventory.serial.create` | Đăng ký IMEI hoặc serial vào tồn kho | Ghi | `POST /inventory/serials` | Khả dụng | UI không có / đang ẩn |
| `inventory.serial.history` | Xem lịch sử IMEI hoặc serial | Đọc | `GET /inventory/serials/:id/history` | Khả dụng | Có quy trình nguồn |
| `inventory.serial.transition` | Cập nhật trạng thái IMEI hoặc serial | Ghi | `POST /inventory/serials/:id/transition` | Khả dụng | UI không có / đang ẩn |

Action liên quan, đã liệt kê ở nhóm chính khác: `inventory.serial.detail`, `inventory.serial.list`, `inventory.serial.transfer.accept`, `inventory.serial.transfer.cancel`, `inventory.serial.transfer.local`, `inventory.serial.transfer.request`.

#### 10. Kết nối TikTok Shop — bổ sung

Chức năng: Kiểm tra trạng thái kết nối TikTok Shop.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `tiktok-shop.status` | Kiểm tra kết nối TikTok Shop | Đọc | `GET /integrations/tiktok-shop/status` | Khả dụng | Chưa xác minh UI |

<a id="module-resource"></a>
### Quản lý tài nguyên — `resource`

**6 nhóm · 17 action (17 khả dụng, 0 không khả dụng).**

#### 1. Tìm và xem tài liệu

Chức năng: Tra cứu tài nguyên nội bộ, Drive cá nhân và Drive dùng chung.

Ví dụ: “Tìm tài liệu TAI-LIEU-QA.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `resource.google-drive.list` | Tra cứu tệp Drive cá nhân | Đọc | `GET /integrations/google-drive/resources` | Khả dụng | Chưa xác minh UI |
| `api.get.57750a4ce5759120` | Xem thông tin tệp hoặc thư mục | Đọc | `GET /resources/:id` | Khả dụng | Có quy trình nguồn |
| `api.get.8d100f7d89820c43` | Tìm tệp trong Google Drive dùng chung | Đọc | `GET /resources/drive/files` | Khả dụng | UI không có / đang ẩn |
| `resource.list` | Tra cứu tài nguyên | Đọc | `GET /resources` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `api.get.5a8c34f32c006c0b`, `api.get.70715572be0f86f6`.

#### 2. Tạo thư mục và liên kết tệp

Chức năng: Tạo thư mục hoặc đưa liên kết/tài nguyên Drive vào kho.

Ví dụ: “Tạo thư mục THU-MUC-QA.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.4fac47294c399fc8` | Tạo thư mục tài nguyên | Ghi | `POST /resources/folder` | Khả dụng | Có quy trình nguồn |
| `api.post.515c5d870391cc6f` | Tạo tài nguyên Google Drive | Ghi | `POST /resources/drive` | Khả dụng | UI không có / đang ẩn |
| `api.post.f16467714880abd7` | Thêm liên kết tệp vào kho tài nguyên | Ghi | `POST /resources/file` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `resource.google-drive.move`.

#### 3. Đổi tên tài nguyên

Chức năng: Đổi tên tệp hoặc thư mục ở nguồn tương ứng.

Ví dụ: “Đổi tên THU-MUC-QA thành TAI-LIEU-QA.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `resource.google-drive.rename` | Đổi tên tệp hoặc thư mục Drive cá nhân | Ghi | `PATCH /integrations/google-drive/resources/:id/rename` | Khả dụng | Chưa xác minh UI |
| `api.patch.120dc3a54509fc0c` | Cập nhật tài nguyên đổi tên | Ghi | `PATCH /resources/:id/rename` | Khả dụng | Có quy trình nguồn |

#### 4. Di chuyển tài nguyên

Chức năng: Di chuyển tệp hoặc thư mục sang vị trí đích.

Ví dụ: “Chuyển TAI-LIEU-QA vào THU-MUC-QA.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `resource.google-drive.move` | Di chuyển tệp trong Google Drive cá nhân | Ghi | `POST /integrations/google-drive/resources/move` | Khả dụng | Chưa xác minh UI |
| `api.patch.1cfa9b644fbe938f` | Cập nhật tài nguyên di chuyển | Ghi | `PATCH /resources/:id/move` | Khả dụng | Có quy trình nguồn |

#### 5. Xóa và khôi phục

Chức năng: Xóa tài nguyên, xem thùng rác và khôi phục.

Ví dụ: “Khôi phục TAI-LIEU-QA trong thùng rác.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.53bdaed9e11523ef` | Xóa tài nguyên Google Drive tệp | Ghi | `DELETE /resources/drive/files/:fileId` | Khả dụng | UI không có / đang ẩn |
| `api.delete.771468fb212b7e25` | Xóa tài nguyên | Ghi | `DELETE /resources/:id` | Khả dụng | Có quy trình nguồn |
| `resource.restore` | Khôi phục tài nguyên | Ghi | `POST /resources/:id/restore` | Khả dụng | Có quy trình nguồn |
| `resource.trash.list` | Tra cứu thùng rác tài nguyên | Đọc | `GET /resources/trash` | Khả dụng | Có quy trình nguồn |

#### 6. Thông tin vị trí và quyền chia sẻ tài nguyên — bổ sung

Chức năng: Xem đường dẫn thư mục và quyền chia sẻ hiện có.

Ví dụ: “Xem quyền chia sẻ của tài liệu đã chọn.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.5a8c34f32c006c0b` | Xem đường dẫn thư mục của tài nguyên | Đọc | `GET /resources/breadcrumb/:id` | Khả dụng | Có quy trình nguồn |
| `api.get.70715572be0f86f6` | Xem quyền chia sẻ của tài nguyên | Đọc | `GET /resources/:id/shares` | Khả dụng | Có quy trình nguồn |

Lưu ý: Action đọc quyền chia sẻ không đồng nghĩa trợ lý có action cấp hoặc thu hồi quyền chia sẻ.

<a id="module-chat"></a>
### Trò chuyện — `chat`

**9 nhóm · 32 action (32 khả dụng, 0 không khả dụng).**

#### 1. Phòng trò chuyện

Chức năng: Tra, tạo và quản lý phòng, trạng thái ghim hoặc rời nhóm.

Ví dụ: “Tạo phòng PHONG-CHAT-QA.”

Liệt kê đầy đủ **10 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.2cad6a5af287c9ed` | Rời phòng trò chuyện | Ghi | `DELETE /chat/rooms/:roomId/leave` | Khả dụng | Có quy trình nguồn |
| `api.delete.6b7e088799881047` | Xóa phòng trò chuyện | Ghi | `DELETE /chat/rooms/:roomId` | Khả dụng | Có quy trình nguồn |
| `api.get.0a45433dc8df2971` | Tìm tin nhắn theo từ khóa trong phòng chat | Đọc | `GET /chat/rooms/:roomId/search` | Khả dụng | Có quy trình nguồn |
| `api.patch.d4060a45017e2ff2` | Cập nhật thông tin phòng trò chuyện | Ghi | `PATCH /chat/rooms/:roomId` | Khả dụng | Có quy trình nguồn |
| `api.post.0ca30bd0f44e4447` | Tạo phòng trò chuyện | Ghi | `POST /chat/rooms` | Khả dụng | Có quy trình nguồn |
| `api.post.383280e18fd7151d` | Ghim hoặc bỏ ghim phòng trò chuyện | Ghi | `POST /chat/rooms/:roomId/toggle-pin` | Khả dụng | Có quy trình nguồn |
| `api.post.42aabe336dd32361` | Ghim trò chuyện phòng trò chuyện | Ghi | `POST /chat/rooms/:roomId/pin` | Khả dụng | Có quy trình nguồn |
| `api.post.98ca589fbd77b8d0` | Bỏ ghim trò chuyện phòng trò chuyện | Ghi | `POST /chat/rooms/:roomId/unpin` | Khả dụng | Có quy trình nguồn |
| `api.post.d63432efae84cbc1` | Thực hiện trò chuyện phòng trò chuyện đã đọc | Ghi | `POST /chat/rooms/:roomId/read` | Khả dụng | Có quy trình nguồn |
| `chat.rooms.list` | Tra cứu phòng trò chuyện | Đọc | `GET /chat/rooms` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `chat.room.members.list`, `chat.room.transfer-admin`.

#### 2. Xem tin nhắn

Chức năng: Đọc lịch sử tin nhắn trong phòng có quyền.

Ví dụ: “Xem tin nhắn của PHONG-CHAT-QA.”

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `chat.room.messages.list` | Xem danh sách tin nhắn trong phòng chat | Đọc | `GET /chat/rooms/:roomId/messages` | Khả dụng | Có quy trình nguồn |

#### 3. Gửi và quản lý tin nhắn

Chức năng: Gửi hoặc xóa tin nhắn trong phạm vi được phép.

Ví dụ: “Gửi tin nhắn thử nghiệm vào PHONG-CHAT-QA.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.405c62abccc22d73` | Xóa tin nhắn trong phòng chat | Ghi | `DELETE /chat/rooms/:roomId/messages/:messageId` | Khả dụng | Có quy trình nguồn |
| `api.patch.9f9de0519c320dba` | Sửa nội dung tin nhắn trong phòng chat | Ghi | `PATCH /chat/rooms/:roomId/messages/:messageId` | Khả dụng | Có quy trình nguồn |
| `api.post.34721e0ad003aba8` | Gửi tin nhắn trò chuyện phòng trò chuyện | Ghi | `POST /chat/rooms/:roomId/messages` | Khả dụng | Có quy trình nguồn |
| `api.post.37d3c6ae92576f7d` | Thực hiện trò chuyện phòng trò chuyện tin nhắn bày tỏ cảm xúc | Ghi | `POST /chat/rooms/:roomId/messages/:messageId/react` | Khả dụng | Có quy trình nguồn |

#### 4. Thành viên và quản trị phòng

Chức năng: Tra thành viên, đổi vai trò, chuyển trưởng nhóm và loại thành viên.

Ví dụ: “Thêm TAI-KHOAN-QA vào PHONG-CHAT-QA.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.15ba51d677614349` | Thực hiện trò chuyện phòng trò chuyện thành viên | Ghi | `POST /chat/rooms/:roomId/members` | Khả dụng | Có quy trình nguồn |
| `chat.room.member.remove` | Xóa thành viên khỏi phòng chat | Ghi | `DELETE /chat/rooms/:roomId/members/:userId` | Khả dụng | Có quy trình nguồn |
| `chat.room.member.role.update` | Cập nhật vai trò thành viên trong phòng chat | Ghi | `POST /chat/rooms/:roomId/members/:userId/role` | Khả dụng | Có quy trình nguồn |
| `chat.room.members.list` | Tra cứu thành viên trong phòng chat | Đọc | `GET /chat/rooms/:roomId` | Khả dụng | Có quy trình nguồn |
| `chat.room.transfer-admin` | Chuyển quyền Trưởng nhóm trong phòng chat | Ghi | `POST /chat/rooms/:roomId/transfer-admin` | Khả dụng | UI không có / đang ẩn |

Action liên quan, đã liệt kê ở nhóm chính khác: `chat.room.messages.list`.

#### 5. Thông báo

Chức năng: Tra thông báo, đánh dấu đã đọc, xóa hoặc gửi thông báo.

Ví dụ: “Đánh dấu toàn bộ thông báo của tôi là đã đọc.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `notification.delete` | Xóa một thông báo của tôi | Ghi | `DELETE /notifications/:id` | Khả dụng | Chưa xác minh UI |
| `notification.list` | Xem thông báo của tôi | Đọc | `GET /notifications` | Khả dụng | Chưa xác minh UI |
| `notification.mark-all-read` | Đánh dấu đã đọc toàn bộ thông báo của tôi | Ghi | `PATCH /notifications/read-all` | Khả dụng | Chưa xác minh UI |
| `notification.mark-read` | Đánh dấu đã đọc một thông báo | Ghi | `PATCH /notifications/:id/read` | Khả dụng | Chưa xác minh UI |
| `api.post.7cae6bbc334b2879` | Gửi thông báo | Ghi | `POST /notifications` | Khả dụng | Chưa xác minh UI |

#### 6. Hồ sơ cá nhân và đồng nghiệp — bổ sung

Chức năng: Xem/cập nhật hồ sơ của tôi, tra đồng nghiệp.

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `account.colleagues.list` | Tra cứu đồng nghiệp trong công ty | Đọc | `GET /auth/users/colleagues` | Khả dụng | Chưa xác minh UI |
| `account.profile.me` | Xem hồ sơ cá nhân | Đọc | `GET /auth/me` | Khả dụng | Chưa xác minh UI |
| `account.profile.update` | Cập nhật tên hiển thị của tôi | Ghi | `PATCH /auth/profile` | Khả dụng | Chưa xác minh UI |

#### 7. Cài đặt trợ lý cá nhân — bổ sung

Chức năng: Đọc và cập nhật cài đặt trợ lý của tài khoản hiện tại.

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `account.assistant-settings.read` | Xem cài đặt trợ lý của tôi | Đọc | `GET /chatbot/assistant/settings` | Khả dụng | Chưa xác minh UI |
| `account.assistant-settings.update` | Cập nhật cài đặt trợ lý của tôi | Ghi | `PATCH /chatbot/assistant/settings` | Khả dụng | Chưa xác minh UI |

#### 8. Liên kết Telegram cá nhân — bổ sung

Chức năng: Xem trạng thái liên kết Telegram của tài khoản.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `account.telegram-link.status` | Xem trạng thái liên kết Telegram của tôi | Đọc | `GET /auth/telegram-link` | Khả dụng | Chưa xác minh UI |

#### 9. Xem trước liên kết trong chat — bổ sung

Chức năng: Lấy thông tin xem trước đường dẫn được gửi trong hội thoại.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.6646f41687f69fcf` | Xem bản xem trước đường dẫn | Đọc | `GET /chat/link-preview` | Khả dụng | Chưa xác minh UI |

<a id="module-student"></a>
### Quản lý học viên — `student`

**17 nhóm · 109 action (109 khả dụng, 0 không khả dụng).**

#### 1. Hồ sơ học viên

Chức năng: Tra cứu, tạo, sửa, xóa hoặc nhập nhiều học viên.

Ví dụ: “Tạo học viên HOC-VIEN-QA với số điện thoại giả.”

Liệt kê đầy đủ **9 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.bulk.create` | Tạo nhiều hồ sơ học viên | Ghi | `POST /students/bulk` | Khả dụng | Có quy trình nguồn |
| `student.bulk.delete` | Xóa nhiều hồ sơ học viên | Ghi | `POST /students/bulk-delete` | Khả dụng | Có quy trình nguồn |
| `student.bulk.delete.preview` | Xem trước ảnh hưởng khi xóa học viên | Đọc | `POST /students/bulk-delete-preview` | Khả dụng | Có quy trình nguồn |
| `student.bulk.preview` | Kiểm tra danh sách học viên trước khi nhập | Đọc | `POST /students/bulk-preview` | Khả dụng | Có quy trình nguồn |
| `api.patch.6d0c5baf91c41cc1` | Chuyển học viên chưa gán chi nhánh | Ghi | `PATCH /students/:id/assign-branch` | Khả dụng | UI không có / đang ẩn |
| `student.create` | Tạo hồ sơ học viên | Ghi | `POST /students` | Khả dụng | Có quy trình nguồn |
| `student.detail` | Xem thông tin học viên | Đọc | `GET /students/:id` | Khả dụng | Có quy trình nguồn |
| `student.update` | Cập nhật hồ sơ học viên | Ghi | `PATCH /students/:id` | Khả dụng | Có quy trình nguồn |
| `student.unassigned.list` | Tra cứu học viên chưa có chi nhánh | Đọc | `GET /students/unassigned` | Khả dụng | UI không có / đang ẩn |

Action liên quan, đã liệt kê ở nhóm chính khác: `api.patch.5bb1b2bfdbad4548`, `student.list`.

#### 2. Khóa học

Chức năng: Quản lý khóa học và phân loại dành cho học viên.

Ví dụ: “Tạo khóa KHOA-HOC-QA.”

Liệt kê đầy đủ **8 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `course.category.create` | Tạo phân loại khóa học | Ghi | `POST /courses/categories` | Khả dụng | Có quy trình nguồn |
| `course.category.delete` | Xóa danh mục khóa học | Ghi | `DELETE /courses/categories/:id` | Khả dụng | Có quy trình nguồn |
| `course.category.list` | Tra cứu danh mục khóa học | Đọc | `GET /courses/categories` | Khả dụng | Có quy trình nguồn |
| `course.create` | Tạo khóa học cho học viên | Ghi | `POST /courses` | Khả dụng | Có quy trình nguồn |
| `course.delete` | Xóa khóa học | Ghi | `DELETE /courses/:id` | Khả dụng | Có quy trình nguồn |
| `course.detail` | Xem chi tiết khóa học | Đọc | `GET /courses/:id` | Khả dụng | Có quy trình nguồn |
| `course.list` | Tra cứu khóa học | Đọc | `GET /courses` | Khả dụng | Có quy trình nguồn |
| `course.update` | Cập nhật khóa học | Ghi | `PATCH /courses/:id` | Khả dụng | Có quy trình nguồn |

#### 3. Lớp học và ghi danh

Chức năng: Tạo lớp, chỉnh sửa và quản lý học viên trong lớp.

Ví dụ: “Thêm HOC-VIEN-QA vào LOP-QA.”

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `batch.list` | Tra cứu lớp học | Đọc | `GET /batches` | Khả dụng | Có quy trình nguồn |
| `student.batch.create` | Tạo lớp học | Ghi | `POST /batches` | Khả dụng | Có quy trình nguồn |
| `student.batch.delete` | Xóa lớp học | Ghi | `DELETE /batches/:id` | Khả dụng | Có quy trình nguồn |
| `student.batch.enrollment.update` | Cập nhật trạng thái học viên trong lớp | Ghi | `PATCH /batches/:id/learners/:studentId/enrollment-status` | Khả dụng | Có quy trình nguồn |
| `student.batch.enrollments.list` | Tra cứu học viên và trạng thái ghi danh trong lớp | Đọc | `GET /batches/:id/enrollments` | Khả dụng | Có quy trình nguồn |
| `student.batch.learner.add` | Thêm học viên vào lớp | Ghi | `POST /batches/:id/learners` | Khả dụng | Có quy trình nguồn |
| `student.batch.learner.remove` | Xóa học viên khỏi lớp | Ghi | `DELETE /batches/:id/learners/:studentId` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `student.batch.detail`, `student.batch.update`.

#### 4. Lịch học

Chức năng: Tra lịch lớp, kỳ thi và lịch đặt tài nguyên; xem giờ/ngày của lớp.

Ví dụ: “LOP-QA học những ngày nào trong tuần?”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.batch.detail` | Xem thông tin lớp học | Đọc | `GET /batches/:id` | Khả dụng | Có quy trình nguồn |
| `student.batch.update` | Cập nhật lớp học | Ghi | `PATCH /batches/:id` | Khả dụng | Có quy trình nguồn |
| `student.schedule.list` | Tra cứu lịch lớp, kỳ thi và lịch đặt tài nguyên | Đọc | `GET /schedule` | Khả dụng | UI không có / đang ẩn |

#### 5. Điểm danh

Chức năng: Tra, ghi nhận, chỉnh sửa hoặc tổng hợp điểm danh lớp.

Ví dụ: “Hôm nay LOP-QA có ai vắng?”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.e5e08c5df6457528` | Tra cứu các lần xác thực điểm danh | Đọc | `GET /attendance/attempts` | Khả dụng | Chưa xác minh UI |
| `batch.attendance.delete` | Xóa điểm danh của lớp trong ngày | Ghi | `DELETE /batches/:id/attendance` | Khả dụng | Có quy trình nguồn |
| `batch.attendance.learners` | Chọn học viên trong lớp để cập nhật điểm danh | Đọc | `GET /batches/:id/attendance/learners` | Khả dụng | Có quy trình nguồn |
| `batch.attendance.record.update` | Cập nhật điểm danh một học viên | Ghi | `PATCH /batches/:id/attendance/learner` | Khả dụng | Có quy trình nguồn |
| `student.batch.attendance.summary` | Báo cáo điểm danh lớp học theo ngày | Đọc | `GET /batches/:id` | Khả dụng | Có quy trình nguồn |
| `student.online-attendance.create-sessions` | Gửi mã điểm danh trực tuyến cho lớp | Ghi | `POST /attendance/online/sessions` | Khả dụng | Chưa xác minh UI |

#### 6. Học phí và công nợ

Chức năng: Ghi nhận khoản thu, quản lý đợt thu và đối chiếu số tiền còn nợ.

Ví dụ: “Học viên nào còn nợ học phí?”

Liệt kê đầy đủ **10 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.installment.create` | Tạo đợt học phí cho học viên | Ghi | `POST /students/:id/installments` | Khả dụng | UI không có / đang ẩn |
| `student.installment.update` | Cập nhật đợt học phí của học viên | Ghi | `PATCH /students/:id/installments/:no` | Khả dụng | UI không có / đang ẩn |
| `student.installments.list` | Tra cứu các đợt học phí của học viên | Đọc | `GET /students/:id/installments` | Khả dụng | UI không có / đang ẩn |
| `student.payment.create` | Ghi nhận khoản thu học phí | Ghi | `POST /payments` | Khả dụng | Có quy trình nguồn |
| `student.payment.delete` | Xóa giao dịch học phí | Ghi | `DELETE /payments/:id` | Khả dụng | Có quy trình nguồn |
| `student.payment.list` | Tra cứu giao dịch học phí | Đọc | `GET /payments` | Khả dụng | Có quy trình nguồn |
| `student.payment.reconcile` | Đối chiếu học phí học viên | Đọc | `GET /payments/reconciliation/:id` | Khả dụng | UI không có / đang ẩn |
| `student.payment.update` | Sửa thông tin giao dịch học phí | Ghi | `PATCH /payments/:id` | Khả dụng | Có quy trình nguồn |
| `api.patch.5bb1b2bfdbad4548` | Đánh dấu đợt học phí đã thu | Ghi | `PATCH /students/:id/installment/:no/mark-paid` | Khả dụng | Có quy trình nguồn |
| `student.list` | Tra cứu học viên | Đọc | `GET /students` | Khả dụng | Có quy trình nguồn |

Lưu ý: Danh sách còn nợ dùng quan hệ server students-with-tuition-debt: student.list + student.payment.list, đọc đủ trang và tính tiền. student.payment.reconcile phục vụ đối chiếu một học viên; không phải cùng một action báo cáo toàn bộ.

#### 7. Bài tập

Chức năng: Tạo/giao bài, xem bài nộp và chấm điểm.

Ví dụ: “Giao bài BAI-TAP-QA cho LOP-QA.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.assignment.create` | Tạo bài tập cho lớp | Ghi | `POST /assignments` | Khả dụng | Có quy trình nguồn |
| `student.assignment.grade` | Chấm điểm bài tập | Ghi | `POST /assignments/:id/students/:studentId/grade` | Khả dụng | Có quy trình nguồn |
| `student.assignment.list` | Tra cứu bài tập trong lớp | Đọc | `GET /assignments` | Khả dụng | Có quy trình nguồn |
| `student.assignment.submissions.list` | Tra cứu tình trạng nộp bài | Đọc | `GET /assignments/:id/submissions` | Khả dụng | Có quy trình nguồn |
| `api.post.ed6d61a8578e4260` | Nộp bài thay cho học viên | Ghi | `POST /assignments/:id/students/:studentId/submit` | Khả dụng | Có quy trình nguồn |
| `student.quality.assignment.grade` | Chấm hoặc cập nhật điểm bài tập | Ghi | `PATCH /student-quality/batches/:batchId/students/:studentId/assignments/:assignmentId` | Khả dụng | Có quy trình nguồn |

#### 8. Chất lượng và tiến độ

Chức năng: Theo dõi đánh giá, bài kiểm tra ngắn và tiến độ học.

Ví dụ: “Xem tiến độ học của HOC-VIEN-QA.”

Liệt kê đầy đủ **9 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.learning-history` | Xem tiến độ học tập của học viên | Đọc | `GET /students/:id/learning-history` | Khả dụng | Có quy trình nguồn |
| `student.quality.assessment.update` | Cập nhật đánh giá học viên | Ghi | `PATCH /student-quality/batches/:batchId/students/:studentId` | Khả dụng | Có quy trình nguồn |
| `student.quality.list` | Tra cứu chất lượng học viên | Đọc | `GET /student-quality` | Khả dụng | Có quy trình nguồn |
| `student.quality.mini-test.create` | Tạo bài kiểm tra ngắn cho học viên | Ghi | `POST /student-quality/batches/:batchId/students/:studentId/mini-tests` | Khả dụng | Có quy trình nguồn |
| `student.quality.mini-test.delete` | Xóa điểm mini test của học viên | Ghi | `DELETE /student-quality/batches/:batchId/students/:studentId/mini-tests/:miniTestId` | Khả dụng | Có quy trình nguồn |
| `student.quality.mini-test.update` | Cập nhật mini test của học viên | Ghi | `PATCH /student-quality/batches/:batchId/students/:studentId/mini-tests/:miniTestId` | Khả dụng | Có quy trình nguồn |
| `student.quality.mini-tests.list` | Tra cứu bài kiểm tra ngắn của học viên | Đọc | `GET /student-quality/batches/:batchId/students/:studentId` | Khả dụng | Có quy trình nguồn |
| `student.quality.thresholds.list` | Xem ngưỡng đánh giá chất lượng học viên | Đọc | `GET /student-quality/settings/thresholds` | Khả dụng | Có quy trình nguồn |
| `student.quality.thresholds.update` | Cập nhật ngưỡng đánh giá chất lượng học viên | Ghi | `PATCH /student-quality/settings/thresholds` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `student.quality.assignment.grade`.

#### 9. Kỳ thi

Chức năng: Tạo kỳ thi, chọn học viên và quản lý kết quả theo hợp đồng API.

Ví dụ: “Gán HOC-VIEN-QA vào kỳ thi KY-THI-QA.”

Liệt kê đầy đủ **12 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.exam.assign` | Gán học viên đủ điều kiện vào kỳ thi | Ghi | `POST /exams/:id/assign` | Khả dụng | Có quy trình nguồn |
| `student.exam.assigned-students.list` | Xem học viên đang được gán vào kỳ thi | Đọc | `GET /exams/:id/assigned-students` | Khả dụng | Có quy trình nguồn |
| `student.exam.create` | Tạo kỳ thi | Ghi | `POST /exams` | Khả dụng | Có quy trình nguồn |
| `student.exam.delete` | Xóa kỳ thi | Ghi | `DELETE /exams/:id` | Khả dụng | Có quy trình nguồn |
| `student.exam.detail` | Xem thông tin kỳ thi | Đọc | `GET /exams/:id` | Khả dụng | Có quy trình nguồn |
| `student.exam.eligible-students.list` | Chọn học viên đủ điều kiện của lớp trong kỳ thi | Đọc | `GET /exams/:id/eligible-students` | Khả dụng | Có quy trình nguồn |
| `student.exam.grade-results.update` | Nhập hoặc cập nhật điểm thi | Ghi | `PATCH /exams/:id/results` | Khả dụng | Có quy trình nguồn |
| `student.exam.grade-roster.list` | Chọn thí sinh trong kỳ thi | Đọc | `GET /exams/:id/grade-roster` | Khả dụng | Có quy trình nguồn |
| `student.exam.list` | Tra cứu kỳ thi | Đọc | `GET /exams` | Khả dụng | Có quy trình nguồn |
| `student.exam.result.update` | Cập nhật kết quả một thí sinh | Ghi | `POST /exams/:id/students/:studentId/result` | Khả dụng | Có quy trình nguồn |
| `student.exam.unassign` | Gỡ học viên khỏi kỳ thi và xóa mục lịch sử thi | Ghi | `POST /exams/:id/unassign` | Khả dụng | Có quy trình nguồn |
| `student.exam.update` | Cập nhật kỳ thi | Ghi | `PATCH /exams/:id` | Khả dụng | Có quy trình nguồn |

#### 10. Lộ trình học

Chức năng: Quản lý lộ trình và các bước học của học viên.

Ví dụ: “Tạo lộ trình LO-TRINH-QA.”

Liệt kê đầy đủ **10 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.learning-roadmap.create` | Tạo lộ trình học | Ghi | `POST /learning-roadmaps` | Khả dụng | Có quy trình nguồn |
| `student.learning-roadmap.delete` | Xóa lộ trình học | Ghi | `DELETE /learning-roadmaps/:id` | Khả dụng | UI không có / đang ẩn |
| `student.learning-roadmap.list` | Tra cứu lộ trình học | Đọc | `GET /learning-roadmaps` | Khả dụng | Có quy trình nguồn |
| `student.learning-roadmap.progression.list` | Xem điều kiện và quyết định lên lớp | Đọc | `GET /learning-roadmaps/batches/:batchId/progression` | Khả dụng | Có quy trình nguồn |
| `student.learning-roadmap.progression.update` | Cập nhật quyết định học tiếp hoặc bảo lưu | Ghi | `PATCH /learning-roadmaps/batches/:batchId/students/:studentId/progression` | Khả dụng | Có quy trình nguồn |
| `student.learning-roadmap.promote` | Chuyển học viên lên lớp tiếp theo | Ghi | `POST /learning-roadmaps/batches/:batchId/promote` | Khả dụng | Có quy trình nguồn |
| `student.learning-roadmap.steps.list` | Tra cứu chặng của lộ trình | Đọc | `GET /learning-roadmaps/:id/steps` | Khả dụng | Có quy trình nguồn |
| `student.learning-roadmap.update` | Cập nhật lộ trình học | Ghi | `PATCH /learning-roadmaps/:id` | Khả dụng | Có quy trình nguồn |
| `student.learning-roadmap.waitlist.list` | Tra cứu học viên trong danh sách chờ lộ trình | Đọc | `GET /learning-roadmaps/waitlist` | Khả dụng | Có quy trình nguồn |
| `student.learning-roadmap.waitlist.place` | Xếp học viên trong danh sách chờ vào lớp | Ghi | `POST /learning-roadmaps/waitlist/place` | Khả dụng | Có quy trình nguồn |

#### 11. Phòng học và thiết bị

Chức năng: Quản lý tài nguyên đào tạo và lịch sử dụng.

Ví dụ: “Đặt PHONG-QA cho lịch học đã chọn.”

Liệt kê đầy đủ **11 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.resource.booking.create` | Đặt lịch phòng học hoặc thiết bị | Ghi | `POST /student-resources/:id/bookings` | Khả dụng | Có quy trình nguồn |
| `student.resource.booking.delete` | Hủy lịch đặt phòng học hoặc thiết bị | Ghi | `DELETE /student-resources/:id/bookings/:bookingId` | Khả dụng | Có quy trình nguồn |
| `student.resource.bookings.list` | Tra cứu lịch đặt phòng học hoặc tài nguyên | Đọc | `GET /student-resources/:id` | Khả dụng | Có quy trình nguồn |
| `student.resource.category.create` | Thêm loại phòng học, thiết bị hoặc tài nguyên | Ghi | `POST /student-resources/categories` | Khả dụng | Có quy trình nguồn |
| `student.resource.category.delete` | Xóa loại phòng học, thiết bị hoặc tài nguyên | Ghi | `DELETE /student-resources/categories/:id` | Khả dụng | Có quy trình nguồn |
| `student.resource.category.list` | Tra cứu loại phòng học, thiết bị và tài nguyên | Đọc | `GET /student-resources/categories` | Khả dụng | Có quy trình nguồn |
| `student.resource.create` | Thêm phòng học hoặc thiết bị | Ghi | `POST /student-resources` | Khả dụng | Có quy trình nguồn |
| `student.resource.delete` | Xóa phòng học hoặc thiết bị | Ghi | `DELETE /student-resources/:id` | Khả dụng | Có quy trình nguồn |
| `student.resource.detail` | Xem chi tiết phòng học hoặc thiết bị | Đọc | `GET /student-resources/:id` | Khả dụng | Có quy trình nguồn |
| `student.resource.list` | Tra cứu phòng học, thiết bị và tài nguyên | Đọc | `GET /student-resources` | Khả dụng | Có quy trình nguồn |
| `student.resource.update` | Sửa phòng học hoặc thiết bị | Ghi | `PATCH /student-resources/:id` | Khả dụng | Có quy trình nguồn |

#### 12. Trường hồ sơ và loại dữ liệu học viên — bổ sung

Chức năng: Quản lý trường chuẩn, trường tùy chỉnh, lưu trữ/khôi phục trường và xem loại hồ sơ đang dùng.

Liệt kê đầy đủ **9 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.custom-field.archive` | Lưu trữ trường dữ liệu tùy chỉnh | Ghi | `POST /student-management/custom-fields/:moduleKey/:id/archive` | Khả dụng | Chưa xác minh UI |
| `student.custom-field.create` | Tạo trường dữ liệu tùy chỉnh | Ghi | `POST /student-management/custom-fields/:moduleKey` | Khả dụng | Chưa xác minh UI |
| `student.custom-field.delete` | Xóa trường dữ liệu tùy chỉnh | Ghi | `POST /student-management/custom-fields/:moduleKey/:id/delete` | Khả dụng | Chưa xác minh UI |
| `student.custom-field.list` | Tra cứu trường dữ liệu tùy chỉnh | Đọc | `GET /student-management/custom-fields/:moduleKey` | Khả dụng | Chưa xác minh UI |
| `student.custom-field.restore` | Khôi phục trường dữ liệu tùy chỉnh | Ghi | `POST /student-management/custom-fields/:moduleKey/:id/restore` | Khả dụng | Chưa xác minh UI |
| `student.custom-field.update` | Cập nhật trường dữ liệu tùy chỉnh | Ghi | `PATCH /student-management/custom-fields/:moduleKey/:id` | Khả dụng | Chưa xác minh UI |
| `student.module-settings.get` | Xem loại hồ sơ đang áp dụng | Đọc | `GET /student-management/settings` | Khả dụng | Chưa xác minh UI |
| `student.standard-fields.list` | Tra cứu trường tiêu chuẩn | Đọc | `GET /student-management/standard-fields/:moduleKey` | Khả dụng | Chưa xác minh UI |
| `student.standard-fields.update` | Cập nhật một trường tiêu chuẩn | Ghi | `PUT /student-management/standard-fields/:moduleKey` | Khả dụng | Chưa xác minh UI |

#### 13. Thông báo học viên — bổ sung

Chức năng: Tạo, tra, sửa và xóa thông báo học viên.

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.notification.create` | Tạo bản ghi thông báo học viên | Ghi | `POST /student-notifications` | Khả dụng | UI không có / đang ẩn |
| `student.notification.delete` | Xóa bản ghi thông báo học viên | Ghi | `DELETE /student-notifications/:id` | Khả dụng | Có quy trình nguồn |
| `student.notification.list` | Tra cứu thông báo học viên | Đọc | `GET /student-notifications` | Khả dụng | Có quy trình nguồn |
| `student.notification.update` | Sửa bản ghi thông báo học viên | Ghi | `PATCH /student-notifications/:id` | Khả dụng | UI không có / đang ẩn |

#### 14. Gửi email theo yêu cầu — bổ sung

Chức năng: Gửi email theo nội dung và người nhận đã xác định.

Ví dụ: “Soạn email cho học viên đã chọn.”

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.email.send` | Gửi email theo yêu cầu | Ghi | `POST /send-email` | Khả dụng | Chưa xác minh UI |

Lưu ý: Đây là tác động liên lạc bên ngoài, cần kiểm tra người nhận và xác nhận theo chính sách.

#### 15. Cấu hình màu đánh giá tiến độ lớp — bổ sung

Chức năng: Tra và sửa các mốc màu dùng hiển thị tiến độ lớp.

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `student.batch.progress-colors.list` | Xem màu đánh giá tiến độ lớp | Đọc | `GET /batches/settings/progress-colors` | Khả dụng | Có quy trình nguồn |
| `student.batch.progress-colors.update` | Cập nhật màu đánh giá tiến độ lớp | Ghi | `PATCH /batches/settings/progress-colors` | Khả dụng | Có quy trình nguồn |

#### 16. Lĩnh vực đào tạo của tài khoản — bổ sung

Chức năng: Cập nhật loại/lĩnh vực đào tạo của tài khoản đang đăng nhập.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `account.business-settings.update` | Cập nhật lĩnh vực đào tạo của tài khoản đang đăng nhập | Ghi | `PATCH /auth/business-settings` | Khả dụng | Chưa xác minh UI |

#### 17. Phân tích AI trong quản lý học viên — bổ sung

Chức năng: Gọi action phân tích AI đã đăng ký cho phân hệ học viên.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.a6cfd8985d17e407` | Phân tích AI | Ghi | `POST /ai/analyze` | Khả dụng | Chưa xác minh UI |

Lưu ý: Phải kiểm tra đúng hợp đồng đầu vào và dữ liệu được phép gửi. Không suy ra action này dùng được cho mọi module chỉ vì route tên /ai/analyze.

<a id="module-worker"></a>
### Quản lý lao động — `worker`

**8 nhóm · 31 action (31 khả dụng, 0 không khả dụng).**

#### 1. Hồ sơ lao động

Chức năng: Tra cứu, tạo, sửa và xóa hồ sơ lao động dự án.

Ví dụ: “Thêm LAO-DONG-QA vào quản lý lao động.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `worker.bulk.create` | Tạo nhiều hồ sơ lao động | Ghi | `POST /worker-management/workers/bulk` | Khả dụng | Có quy trình nguồn |
| `worker.bulk.delete` | Xóa mềm nhiều hồ sơ lao động | Ghi | `POST /worker-management/workers/bulk-delete` | Khả dụng | Có quy trình nguồn |
| `worker.create` | Tạo hồ sơ lao động | Ghi | `POST /worker-management/workers` | Khả dụng | Có quy trình nguồn |
| `worker.delete` | Xóa hồ sơ lao động | Ghi | `DELETE /worker-management/workers/:id` | Khả dụng | Có quy trình nguồn |
| `worker.list` | Tra cứu người lao động | Đọc | `GET /worker-management/workers` | Khả dụng | Có quy trình nguồn |
| `worker.update` | Cập nhật hồ sơ lao động | Ghi | `PATCH /worker-management/workers/:id` | Khả dụng | Có quy trình nguồn |

#### 2. Dự án lao động

Chức năng: Tạo, xem, sửa hoặc xóa dự án thuộc quản lý lao động.

Ví dụ: “Tạo dự án DU-AN-LAO-DONG-QA trong quản lý lao động.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `worker.project.create` | Tạo dự án lao động | Ghi | `POST /worker-management/projects` | Khả dụng | Có quy trình nguồn |
| `worker.project.delete` | Xóa dự án lao động | Ghi | `DELETE /worker-management/projects/:id` | Khả dụng | Có quy trình nguồn |
| `worker.project.detail` | Xem thông tin dự án lao động | Đọc | `GET /worker-management/projects/:id` | Khả dụng | Có quy trình nguồn |
| `worker.project.list` | Tra cứu dự án lao động | Đọc | `GET /worker-management/projects` | Khả dụng | Có quy trình nguồn |
| `worker.project.update` | Cập nhật dự án lao động | Ghi | `PATCH /worker-management/projects/:id` | Khả dụng | Có quy trình nguồn |

#### 3. Phân bổ lao động

Chức năng: Thêm hoặc loại lao động khỏi dự án.

Ví dụ: “Thêm LAO-DONG-QA vào DU-AN-LAO-DONG-QA.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `worker.project.worker.add` | Thêm lao động vào dự án | Ghi | `POST /worker-management/projects/:id/workers` | Khả dụng | Có quy trình nguồn |
| `worker.project.worker.remove` | Gỡ lao động khỏi dự án | Ghi | `DELETE /worker-management/projects/:id/workers/:workerId` | Khả dụng | Có quy trình nguồn |
| `worker.project.workers.add` | Thêm nhiều lao động vào dự án | Ghi | `POST /worker-management/projects/:id/workers/bulk` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `worker.project.detail`, `worker.project.list`.

#### 4. Chấm công lao động

Chức năng: Tra, ghi nhận và điều chỉnh giờ công tại dự án.

Ví dụ: “Chấm công LAO-DONG-QA cho ngày đã chọn.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `worker.attendance.list` | Tra cứu bảng chấm công dự án | Đọc | `GET /worker-management/attendance` | Khả dụng | Có quy trình nguồn |
| `worker.attendance.mark` | Ghi nhận chấm công lao động | Ghi | `POST /worker-management/attendance/mark` | Khả dụng | Có quy trình nguồn |
| `worker.attendance.update` | Điều chỉnh giờ chấm công | Ghi | `PATCH /worker-management/attendance/:id` | Khả dụng | UI không có / đang ẩn |

#### 5. Hợp đồng lao động

Chức năng: Quản lý hợp đồng của lao động và theo dõi sắp hết hạn.

Ví dụ: “Cập nhật đơn vị sử dụng trên hợp đồng của LAO-DONG-QA.”

Liệt kê đầy đủ **8 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `worker.labor.contract.create` | Tạo hợp đồng lao động | Ghi | `POST /worker-management/labor-contracts` | Khả dụng | Có quy trình nguồn |
| `worker.labor.contract.delete` | Xóa hợp đồng lao động | Ghi | `DELETE /worker-management/labor-contracts/:id` | Khả dụng | Có quy trình nguồn |
| `worker.labor.contract.detail` | Xem chi tiết hợp đồng lao động | Đọc | `GET /worker-management/labor-contracts/:id` | Khả dụng | Có quy trình nguồn |
| `worker.labor.contract.history` | Xem lịch sử gia hạn hợp đồng lao động | Đọc | `GET /worker-management/labor-contracts/:id/history` | Khả dụng | Có quy trình nguồn |
| `worker.labor.contract.list` | Tra cứu hợp đồng lao động | Đọc | `GET /worker-management/labor-contracts` | Khả dụng | Có quy trình nguồn |
| `worker.labor.contract.renew` | Gia hạn hợp đồng lao động | Ghi | `POST /worker-management/labor-contracts/:id/renew` | Khả dụng | Có quy trình nguồn |
| `worker.labor.contract.update` | Cập nhật hợp đồng lao động | Ghi | `PATCH /worker-management/labor-contracts/:id` | Khả dụng | Có quy trình nguồn |
| `api.get.975d2e3032a3229a` | Tổng hợp hợp đồng sắp hết hạn | Đọc | `GET /worker-management/labor-contracts/expiring-summary` | Khả dụng | Có quy trình nguồn |

Lưu ý: Khác hợp đồng nhân sự hr.contract.*. Danh sách lao động chưa có hợp đồng dùng quan hệ server workers-without-contracts, không chỉ lọc trạng thái hồ sơ.

#### 6. Báo cáo lao động

Chức năng: Xem tổng quan, thiếu nhân công, vắng/đi muộn và báo cáo theo dự án.

Ví dụ: “Dự án nào đang thiếu lao động?”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `worker.dashboard` | Xem tổng quan lao động | Đọc | `GET /worker-management/dashboard` | Khả dụng | Chưa xác minh UI |
| `worker.report` | Báo cáo chấm công và thiếu lao động theo dự án | Đọc | `GET /worker-management/reports/assistant` | Khả dụng | Chưa xác minh UI |

#### 7. Thông báo lao động — bổ sung

Chức năng: Gửi và tra thông báo cho lao động.

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `worker.notification.create` | Gửi thông báo lao động | Ghi | `POST /worker-management/notifications` | Khả dụng | Có quy trình nguồn |
| `worker.notification.list` | Tra cứu thông báo lao động | Đọc | `GET /worker-management/notifications` | Khả dụng | Có quy trình nguồn |

#### 8. Cấu hình trường hồ sơ lao động — bổ sung

Chức năng: Tra và cập nhật trường hồ sơ lao động.

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `worker.standard-fields.list` | Tra cứu trường hồ sơ lao động | Đọc | `GET /worker-management/standard-fields` | Khả dụng | Chưa xác minh UI |
| `worker.standard-fields.update` | Cập nhật trường hồ sơ lao động | Ghi | `PUT /worker-management/standard-fields` | Khả dụng | Chưa xác minh UI |

<a id="module-student-partner"></a>
### Đối tác tuyển sinh — `student-partner`

**4 nhóm · 14 action (13 khả dụng, 1 không khả dụng).**

#### 1. Hồ sơ đối tác tuyển sinh

Chức năng: Tra, tạo, sửa hoặc xóa cộng tác viên giới thiệu học viên.

Ví dụ: “Tạo cộng tác viên DOI-TAC-TUYEN-SINH-QA.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.9043f4e5cc3aefab` | Xóa đối tác giới thiệu | Ghi | `DELETE /partners/:id` | Khả dụng | Có quy trình nguồn |
| `api.get.74c43c3c00197209` | Xem thông tin đối tác | Đọc | `GET /partners/:id` | Khả dụng | Có quy trình nguồn |
| `api.patch.fee44cbce47ae377` | Cập nhật thông tin liên hệ đối tác | Ghi | `PATCH /partners/:id` | Khả dụng | Có quy trình nguồn |
| `api.post.682981444c12f0aa` | Tạo cộng tác viên giới thiệu học viên | Ghi | `POST /partners` | Khả dụng | Có quy trình nguồn |
| `partner.list` | Tra cứu đối tác | Đọc | `GET /partners` | Khả dụng | Có quy trình nguồn |
| `partner.bulk.create` | Tạo nhiều đối tác | Ghi | `POST /partners/bulk` | Khả dụng | Có quy trình nguồn |

#### 2. Cấp bậc và cấu hình hoa hồng

Chức năng: Quản lý cấp bậc/cấu hình tính hoa hồng tuyển sinh.

Ví dụ: “Tạo cấp bậc hoa hồng HOA-HONG-QA.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.abafb6f27753de55` | Xóa cấp bậc hoa hồng | Ghi | `DELETE /partners/commission-levels/:id` | Khả dụng | Có quy trình nguồn |
| `api.patch.c3613ac62ed49013` | Cập nhật cấu hình hoa hồng | Ghi | `PATCH /partners/commission-levels/:id` | Khả dụng | Có quy trình nguồn |
| `api.post.dda51f40f1cbd125` | Tạo cấu hình hoa hồng | Ghi | `POST /partners/commission-levels` | Khả dụng | Có quy trình nguồn |
| `partner.commission.levels.list` | Tra cứu cấu hình hoa hồng | Đọc | `GET /partners/commission-levels` | Khả dụng | Có quy trình nguồn |
| `partner.commission.update` | Cấu hình hoa hồng cho đối tác | Ghi | `PATCH /partners/:id` | Không khả dụng | Có quy trình nguồn |

Lưu ý: partner.commission.update đang bị đánh dấu không khả dụng: cập nhật mức riêng trên hồ sơ không thay công thức hoa hồng theo cấp bậc.

Lý do khóa `partner.commission.update`: Hoa hồng đối tác học viên hiện được tính theo cấp bậc và tổng học phí giới thiệu. Lưu mức riêng trên hồ sơ không thay đổi kết quả tính. Mình chưa lưu. Bạn cần chọn cấp bậc hoa hồng muốn điều chỉnh.

#### 3. Thông tin chuyển khoản và chi trả

Chức năng: Cập nhật tài khoản nhận tiền và ghi nhận khoản chi hoa hồng.

Ví dụ: “Ghi nhận khoản chi cho DOI-TAC-TUYEN-SINH-QA.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.5e1017ef3a76d4f1` | Ghi nhận chi trả hoa hồng đối tác | Ghi | `POST /partners/:id/payouts` | Khả dụng | Có quy trình nguồn |
| `partner.bank-details.update` | Cập nhật thông tin chuyển khoản đối tác | Ghi | `PATCH /partners/:id` | Khả dụng | Có quy trình nguồn |

#### 4. Phân tích kết quả giới thiệu

Chức năng: Xem hiệu quả và dữ liệu phân tích đối tác học viên.

Ví dụ: “Phân tích kết quả DOI-TAC-TUYEN-SINH-QA.”

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `partner.analysis` | Phân tích đối tác học viên | Đọc | `GET /partners` | Khả dụng | Có quy trình nguồn |

<a id="module-labor-partner"></a>
### Đối tác lao động — `labor-partner`

**6 nhóm · 32 action (32 khả dụng, 0 không khả dụng).**

#### 1. Hồ sơ đối tác lao động

Chức năng: Tra, tạo, sửa và xóa đối tác cung ứng/giới thiệu lao động.

Ví dụ: “Tạo đối tác DOI-TAC-LAO-DONG-QA.”

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.047cfef00a296a0d` | Xóa lao động quản lý đối tác | Ghi | `DELETE /worker-management/partners/:partnerId` | Khả dụng | UI không có / đang ẩn |
| `api.get.8ee13f2f02a5abfd` | Xem đối tác cung ứng lao động | Đọc | `GET /worker-management/partners/:partnerId` | Khả dụng | Có quy trình nguồn |
| `api.patch.4309612e371b6aa2` | Cập nhật đối tác cung ứng lao động | Ghi | `PATCH /worker-management/partners/:partnerId` | Khả dụng | Có quy trình nguồn |
| `api.post.51cd07ea5eae455b` | Tạo cộng tác viên lao động | Ghi | `POST /worker-management/partners` | Khả dụng | Có quy trình nguồn |
| `worker.partner.list` | Tra cứu đối tác cung ứng lao động | Đọc | `GET /worker-management/partners` | Khả dụng | Có quy trình nguồn |
| `api.get.2ed06bd0339e10ae` | Xem tổng quan quyết toán đối tác lao động | Đọc | `GET /worker-management/partners/dashboard` | Khả dụng | Có quy trình nguồn |
| `api.get.8e68db2c21d01a51` | Xem tổng quan một đối tác lao động | Đọc | `GET /worker-management/partners/:partnerId/overview` | Khả dụng | Có quy trình nguồn |

#### 2. Lao động được giới thiệu

Chức năng: Tạo lượt giới thiệu, xác nhận, kết thúc và tra liên kết người lao động.

Ví dụ: “Xác nhận lượt giới thiệu của LAO-DONG-QA.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.15425a2f24638e8c` | Thực hiện lao động quản lý đối tác giới thiệu | Ghi | `POST /worker-management/partners/:partnerId/referrals` | Khả dụng | Có quy trình nguồn |
| `api.post.816c2559aba41930` | Thực hiện lao động quản lý đối tác giới thiệu kết thúc | Ghi | `POST /worker-management/partners/:partnerId/referrals/:referralId/end` | Khả dụng | Có quy trình nguồn |
| `worker.partner.referral.confirm` | Xác nhận referral của người lao động | Ghi | `POST /worker-management/partners/:partnerId/referrals/:referralId/confirm` | Khả dụng | Có quy trình nguồn |
| `worker.partner.referrals.list` | Tra cứu người lao động được đối tác giới thiệu | Đọc | `GET /worker-management/partners/:partnerId/referrals` | Khả dụng | Có quy trình nguồn |
| `worker.partner.worker-referral.list` | Tra cứu đối tác giới thiệu của người lao động | Đọc | `GET /worker-management/partners/workers/:workerId/referral` | Khả dụng | Có quy trình nguồn |

#### 3. KPI giới thiệu

Chức năng: Thiết lập và phân tích mức hoàn thành KPI của đối tác.

Ví dụ: “Đối tác nào chưa đạt KPI tháng đã chọn?”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.f7d7b097f3b2fca2` | Phân tích KPI và số lao động giới thiệu của đối tác | Đọc | `GET /worker-management/partners/kpi` | Khả dụng | Có quy trình nguồn |
| `worker.partner.kpi.set` | Đặt KPI giới thiệu cho đối tác lao động | Ghi | `PUT /worker-management/partners/kpi/:partnerId` | Khả dụng | Có quy trình nguồn |

#### 4. Chính sách hoa hồng

Chức năng: Lập, sửa, kích hoạt, sao chép hoặc ngừng chính sách.

Ví dụ: “Tạo chính sách CHINH-SACH-QA cho đối tác lao động.”

Liệt kê đầy đủ **8 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.b01de2c5e1417d90` | Xóa chính sách hoa hồng đối tác lao động | Ghi | `DELETE /worker-management/partners/policies/:policyId` | Khả dụng | Có quy trình nguồn |
| `api.patch.2971d5a8a97f8be8` | Cập nhật chính sách hoa hồng đối tác lao động | Ghi | `PATCH /worker-management/partners/policies/:policyId` | Khả dụng | Có quy trình nguồn |
| `api.post.6346fd99746602d2` | Ngừng áp dụng chính sách hoa hồng đối tác lao động | Ghi | `POST /worker-management/partners/policies/:policyId/retire` | Khả dụng | Có quy trình nguồn |
| `api.post.a58fa4b9dd69941c` | Kích hoạt chính sách hoa hồng đối tác lao động | Ghi | `POST /worker-management/partners/policies/:policyId/activate` | Khả dụng | Có quy trình nguồn |
| `api.post.c7d183398e44331e` | Sao chép chính sách hoa hồng đối tác lao động | Ghi | `POST /worker-management/partners/policies/:policyId/clone` | Khả dụng | UI không có / đang ẩn |
| `api.post.e57ae0da3cdf14f8` | Tạo chính sách hoa hồng đối tác lao động | Ghi | `POST /worker-management/partners/policies` | Khả dụng | Có quy trình nguồn |
| `worker.partner.policy.detail` | Xem chính sách hoa hồng đối tác lao động | Đọc | `GET /worker-management/partners/policies/:policyId` | Khả dụng | Có quy trình nguồn |
| `worker.partner.policy.list` | Tra cứu chính sách hoa hồng đối tác lao động | Đọc | `GET /worker-management/partners/policies` | Khả dụng | Có quy trình nguồn |

#### 5. Đối soát hoa hồng

Chức năng: Tính, kiểm tra, điều chỉnh, duyệt hoặc hủy hiệu lực kỳ đối soát.

Ví dụ: “Tính đối soát kỳ đã chọn cho DOI-TAC-LAO-DONG-QA.”

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.0137e041d2b60a80` | Thực hiện lao động quản lý đối tác đối soát điều chỉnh | Ghi | `POST /worker-management/partners/settlements/:settlementId/adjustments` | Khả dụng | Có quy trình nguồn |
| `api.post.4b815164a8bb4143` | Thực hiện lao động quản lý đối tác đối soát hủy hiệu lực | Ghi | `POST /worker-management/partners/settlements/:settlementId/void` | Khả dụng | Có quy trình nguồn |
| `api.post.db51d33ae72d81b2` | Phê duyệt lao động quản lý đối tác đối soát | Ghi | `POST /worker-management/partners/settlements/:settlementId/approve` | Khả dụng | Có quy trình nguồn |
| `worker.partner.settlement.calculate` | Tính đối soát hoa hồng đối tác lao động | Ghi | `POST /worker-management/partners/settlements/calculate` | Khả dụng | Có quy trình nguồn |
| `worker.partner.settlement.detail` | Xem chi tiết kỳ đối soát hoa hồng đối tác lao động | Đọc | `GET /worker-management/partners/settlements/:settlementId` | Khả dụng | Có quy trình nguồn |
| `worker.partner.settlement.recalculate` | Tính lại kỳ đối soát hoa hồng đối tác lao động | Ghi | `POST /worker-management/partners/settlements/:settlementId/recalculate` | Khả dụng | Có quy trình nguồn |
| `worker.partner.settlements.list` | Tra cứu kỳ đối soát hoa hồng đối tác lao động | Đọc | `GET /worker-management/partners/settlements` | Khả dụng | Có quy trình nguồn |

#### 6. Chi trả hoa hồng

Chức năng: Ghi nhận khoản chi, đảo khoản chi và tra báo cáo hoa hồng.

Ví dụ: “Chi trả kỳ đối soát đã được duyệt.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.4ecb05d1dddb3fdc` | Xem báo cáo hoa hồng đối tác lao động | Đọc | `GET /worker-management/partners/reports/commission` | Khả dụng | Có quy trình nguồn |
| `worker.partner.payout.reverse` | Đảo khoản chi trả hoa hồng đối tác lao động | Ghi | `POST /worker-management/partners/payouts/:payoutId/reverse` | Khả dụng | Có quy trình nguồn |
| `api.post.92a650eadaee6bcd` | Thực hiện lao động quản lý đối tác đối soát chi trả | Ghi | `POST /worker-management/partners/settlements/:settlementId/payouts` | Khả dụng | Có quy trình nguồn |

<a id="module-customer"></a>
### Khách hàng — `customer`

**4 nhóm · 16 action (16 khả dụng, 0 không khả dụng).**

#### 1. Hồ sơ khách hàng

Chức năng: Tìm, tạo, sửa và thay đổi trạng thái khách hàng.

Ví dụ: “Sửa địa chỉ KHACH-HANG-QA.”

Liệt kê đầy đủ **10 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.0e86266c268fecac` | Xem lịch sử sửa chữa của khách hàng | Đọc | `GET /customers/:id/repairs` | Khả dụng | Có quy trình nguồn |
| `api.get.51885b828100e376` | Tìm khách hàng | Đọc | `GET /customers/search` | Khả dụng | Có quy trình nguồn |
| `api.get.c739a754761eb2a2` | Xem lịch sử mua hàng của khách hàng | Đọc | `GET /customers/:id/purchase-history` | Khả dụng | Có quy trình nguồn |
| `api.get.fe5907605a3c317a` | Xem hồ sơ khách hàng | Đọc | `GET /customers/:id` | Khả dụng | Có quy trình nguồn |
| `customer.activate` | Kích hoạt khách hàng | Ghi | `POST /customers/:id/activate` | Khả dụng | Có quy trình nguồn |
| `customer.create` | Tạo khách hàng | Ghi | `POST /customers` | Khả dụng | Có quy trình nguồn |
| `customer.deactivate` | Ngừng hoạt động khách hàng | Ghi | `POST /customers/:id/deactivate` | Khả dụng | Có quy trình nguồn |
| `customer.list` | Danh sách khách hàng | Đọc | `GET /customers` | Khả dụng | Có quy trình nguồn |
| `customer.update` | Cập nhật thông tin khách hàng | Ghi | `PATCH /customers/:id` | Khả dụng | Có quy trình nguồn |
| `customer.quick.create` | Tạo nhanh khách hàng tại POS | Ghi | `POST /customers/quick` | Khả dụng | Có quy trình nguồn |

#### 2. Lịch sử giao dịch

Chức năng: Xem lịch sử và chi tiết giao dịch của khách.

Ví dụ: “Xem giao dịch của KHACH-HANG-QA.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `customer.transaction.detail` | Xem chi tiết giao dịch khách hàng | Đọc | `GET /customers/:id/transactions/:kind/:sourceId` | Khả dụng | Có quy trình nguồn |
| `customer.transactions` | Tra cứu lịch sử giao dịch khách hàng | Đọc | `GET /customers/:id/transactions` | Khả dụng | Có quy trình nguồn |

#### 3. Phân hạng khách hàng

Chức năng: Tra và cập nhật cài đặt phân hạng.

Ví dụ: “Xem cài đặt phân hạng khách hàng.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `customer.settings.get` | Xem cài đặt phân hạng khách hàng | Đọc | `GET /customers/settings` | Khả dụng | Có quy trình nguồn |
| `customer.settings.update` | Cập nhật phân hạng khách hàng | Ghi | `PATCH /customers/settings` | Khả dụng | Có quy trình nguồn |

#### 4. Hồ sơ xuất hóa đơn

Chức năng: Tra hoặc tạo thông tin xuất hóa đơn của khách.

Ví dụ: “Tạo hồ sơ xuất hóa đơn cho KHACH-HANG-QA.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `customer.billing.profile.create` | Tạo hồ sơ xuất hóa đơn khách hàng | Ghi | `POST /customers/:id/billing-profiles` | Khả dụng | Có quy trình nguồn |
| `customer.billing.profile.list` | Tra cứu hồ sơ xuất hóa đơn khách hàng | Đọc | `GET /customers/:id/billing-profiles` | Khả dụng | Có quy trình nguồn |

<a id="module-partner"></a>
### Đối tác cũ — `partner`

**0 nhóm · 0 action (0 khả dụng, 0 không khả dụng).**

Mã tương thích cũ, không có action riêng. Dùng Đối tác tuyển sinh/Đối tác lao động đúng loại nghiệp vụ.

<a id="module-retail"></a>
### Bán lẻ & POS — `retail`

**13 nhóm · 72 action (72 khả dụng, 0 không khả dụng).**

#### 1. Đơn hàng bán lẻ

Chức năng: Tạo đơn nháp, tính thử, cập nhật, xác nhận và hủy đơn.

Ví dụ: “Tạo đơn nháp cho KHACH-HANG-QA.”

Liệt kê đầy đủ **9 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.1f12700de51c1e66` | Xóa bán lẻ đơn hàng | Ghi | `DELETE /retail/orders/:id` | Khả dụng | UI không có / đang ẩn |
| `api.get.c15de085b05fbedf` | Kiểm tra tình trạng thanh toán đơn hàng | Đọc | `GET /retail/orders/:id/payment-status` | Khả dụng | Có quy trình nguồn |
| `retail.order.cancel` | Hủy đơn bán lẻ | Ghi | `POST /retail/orders/:id/cancel` | Khả dụng | Có quy trình nguồn |
| `retail.order.confirm` | Xác nhận đơn nháp bán lẻ | Ghi | `POST /retail/orders/:id/confirm` | Khả dụng | UI không có / đang ẩn |
| `retail.order.detail` | Xem chi tiết đơn bán lẻ | Đọc | `GET /retail/orders/:id` | Khả dụng | Có quy trình nguồn |
| `retail.order.draft.create` | Tạo đơn nháp bán lẻ | Ghi | `POST /retail/orders` | Khả dụng | UI không có / đang ẩn |
| `retail.order.draft.update` | Cập nhật đơn nháp bán lẻ | Ghi | `PATCH /retail/orders/:id` | Khả dụng | UI không có / đang ẩn |
| `retail.order.list` | Tra cứu đơn bán lẻ | Đọc | `GET /retail/orders` | Khả dụng | Có quy trình nguồn |
| `retail.order.quote` | Tính thử đơn bán lẻ | Đọc | `POST /retail/orders/quote` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `api.get.1f691abad0a10ee8`, `api.get.cc59ef5991d28f6a`, `retail.order.checkout`, `retail.order.collect`, `retail.order.products.list`.

#### 2. Thanh toán đơn hàng

Chức năng: Checkout, thu thêm tiền và rà soát chuyển khoản.

Ví dụ: “Thu thêm tiền cho DON-HANG-QA.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `retail.order.checkout` | Tạo và thanh toán đơn bán lẻ | Ghi | `POST /retail/orders/checkout` | Khả dụng | Có quy trình nguồn |
| `retail.order.collect` | Thu thêm tiền đơn bán lẻ | Ghi | `POST /retail/orders/:id/payments` | Khả dụng | Có quy trình nguồn |
| `retail.payment-review.pending` | Tra cứu giao dịch chuyển khoản chờ rà soát | Đọc | `GET /retail/payment-review` | Khả dụng | UI không có / đang ẩn |
| `retail.payment-review.review` | Ghi nhận rà soát giao dịch chuyển khoản | Ghi | `POST /retail/payment-review/:id/review` | Khả dụng | UI không có / đang ẩn |

#### 3. Ca thu ngân

Chức năng: Xem, mở/đóng hoặc chuyển trạng thái ca theo action được đăng ký.

Ví dụ: “Xem ca POS hiện tại.”

Liệt kê đầy đủ **15 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.fc665b5fde526b87` | Xem chi tiết ca thu ngân | Đọc | `GET /retail/shifts/:id` | Khả dụng | Có quy trình nguồn |
| `api.post.00a6a513fba7ada4` | Chuyển quầy hoặc két tiền cho ca bán hàng | Ghi | `POST /retail/shifts/:id/drawer` | Khả dụng | UI không có / đang ẩn |
| `api.post.12e203d82e400c19` | Đóng ca thu ngân POS | Ghi | `POST /retail/shifts/:id/close` | Khả dụng | Có quy trình nguồn |
| `api.post.65aaf7d2d6ae9faf` | Đánh dấu khoản thu POS đã kiểm tra | Ghi | `POST /retail/shifts/settlements/review` | Khả dụng | UI không có / đang ẩn |
| `api.post.accc645ed354d2b5` | Ghi thu hoặc chi tiền mặt trong ca POS | Ghi | `POST /retail/shifts/:id/cash-movements` | Khả dụng | Có quy trình nguồn |
| `api.post.b0d4095fce422005` | Mở ca thu ngân POS | Ghi | `POST /retail/shifts/open` | Khả dụng | Có quy trình nguồn |
| `api.post.b2e3520270c7234f` | Đối soát ca thu ngân POS | Ghi | `POST /retail/shifts/:id/reconcile` | Khả dụng | Có quy trình nguồn |
| `api.post.c9d60252b9a973dd` | Tạo quầy hoặc két POS | Ghi | `POST /retail/shifts/drawers` | Khả dụng | UI không có / đang ẩn |
| `retail.shift.cashier.list` | Tra cứu nhân viên thu ngân | Đọc | `GET /retail/shifts/cashiers` | Khả dụng | Có quy trình nguồn |
| `retail.shift.current` | Xem ca POS hiện tại | Đọc | `GET /retail/shifts/current` | Khả dụng | Có quy trình nguồn |
| `retail.shift.drawer.list` | Tra cứu quầy và két POS | Đọc | `GET /retail/shifts/drawers` | Khả dụng | UI không có / đang ẩn |
| `retail.shift.list` | Tra cứu ca thu ngân POS | Đọc | `GET /retail/shifts` | Khả dụng | Có quy trình nguồn |
| `retail.shift.pause` | Tạm dừng ca POS của bạn | Ghi | `POST /retail/shifts/:id/pause` | Khả dụng | UI không có / đang ẩn |
| `retail.shift.resume` | Tiếp tục ca POS của bạn trên thiết bị hiện tại | Ghi | `POST /retail/shifts/:id/resume` | Khả dụng | Có quy trình nguồn |
| `retail.shift.settlements.list` | Tra cứu khoản thu POS chưa đối soát | Đọc | `GET /retail/shifts/settlements` | Khả dụng | UI không có / đang ẩn |

#### 4. Hóa đơn bán lẻ

Chức năng: Tra danh sách, chi tiết và tổng hợp hóa đơn.

Ví dụ: “Xem hóa đơn của DON-HANG-QA.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `retail.invoice.detail` | Xem chi tiết hóa đơn bán lẻ | Đọc | `GET /retail/invoices/:id` | Khả dụng | Có quy trình nguồn |
| `retail.invoice.list` | Tra cứu hóa đơn bán lẻ | Đọc | `GET /retail/invoices` | Khả dụng | Có quy trình nguồn |
| `retail.invoice.summary` | Tổng hợp hóa đơn bán lẻ | Đọc | `GET /retail/invoices/summary` | Khả dụng | UI không có / đang ẩn |

#### 5. Đổi trả và thu mua

Chức năng: Lập và tra chứng từ sau bán hàng.

Ví dụ: “Tạo phiếu đổi trả cho đơn đã chọn.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `retail.after-sale.create` | Tạo phiếu đổi trả hoặc thu mua bán lẻ | Ghi | `POST /retail/after-sales` | Khả dụng | Có quy trình nguồn |
| `retail.after-sale.detail` | Xem chứng từ đổi trả hoặc thu mua | Đọc | `GET /retail/after-sales/:id` | Khả dụng | UI không có / đang ẩn |
| `retail.after-sale.list` | Tra cứu chứng từ đổi trả và thu mua | Đọc | `GET /retail/after-sales` | Khả dụng | Có quy trình nguồn |

#### 6. Công nợ bán lẻ

Chức năng: Tra, đối soát và nhắc công nợ khách hàng.

Ví dụ: “Đối soát công nợ KHACH-HANG-QA.”

Liệt kê đầy đủ **8 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `retail.debt-reminders.delivery.retry` | Thử lại email nhắc công nợ lỗi tạm thời | Ghi | `POST /retail/debt-reminders/deliveries/:id/retry` | Khả dụng | UI không có / đang ẩn |
| `retail.debt-reminders.retryable-deliveries.list` | Chọn email nhắc công nợ lỗi tạm thời để thử lại | Đọc | `GET /retail/debt-reminders/deliveries/retryable` | Khả dụng | UI không có / đang ẩn |
| `retail.debt-reminders.run` | Chạy nhắc công nợ bán lẻ | Ghi | `POST /retail/debt-reminders/run` | Khả dụng | UI không có / đang ẩn |
| `retail.debt-reminders.runs.detail` | Xem thống kê lượt nhắc công nợ bán lẻ | Đọc | `GET /retail/debt-reminders/runs/:id` | Khả dụng | UI không có / đang ẩn |
| `retail.debt-reminders.runs.list` | Tra cứu lịch sử nhắc công nợ bán lẻ | Đọc | `GET /retail/debt-reminders/runs` | Khả dụng | UI không có / đang ẩn |
| `retail.receivable.customer.history` | Tra cứu lịch sử công nợ bán lẻ của khách hàng | Đọc | `GET /retail/receivables/customers/:customerId` | Khả dụng | Có quy trình nguồn |
| `retail.receivable.reconciliation.latest` | Xem kết quả đối soát công nợ bán lẻ gần nhất | Đọc | `GET /retail/receivables/reconciliations/latest` | Khả dụng | UI không có / đang ẩn |
| `retail.receivable.reconciliation.run` | Đối soát công nợ bán lẻ | Ghi | `POST /retail/receivables/reconciliations` | Khả dụng | UI không có / đang ẩn |

#### 7. Ưu đãi và điểm thưởng

Chức năng: Quản lý mã ưu đãi, điều kiện áp dụng và chính sách tích điểm.

Ví dụ: “Tạo mã ưu đãi UU-DAI-QA với thời hạn xác định.”

Liệt kê đầy đủ **8 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.47d83644d10887c0` | Xem điểm thưởng của khách hàng | Đọc | `GET /retail/points/customers/:id` | Khả dụng | Có quy trình nguồn |
| `api.post.6c5a8520aa90cc8e` | Điều chỉnh điểm khách hàng | Ghi | `POST /retail/points/customers/:id/adjust` | Khả dụng | Có quy trình nguồn |
| `retail.coupon.assistant-options.list` | Tra cứu mã ưu đãi có thể áp dụng | Đọc | `GET /retail/coupons/assistant-options` | Khả dụng | UI không có / đang ẩn |
| `retail.coupon.create` | Tạo mã ưu đãi | Ghi | `POST /retail/coupons` | Khả dụng | Có quy trình nguồn |
| `retail.coupon.tier.list` | Tra cứu hạng khách hàng để áp dụng mã ưu đãi | Đọc | `GET /retail/coupons/tiers` | Khả dụng | Có quy trình nguồn |
| `retail.points.customer.search` | Tìm khách hàng để tra cứu điểm thưởng | Đọc | `GET /retail/points/customers/search` | Khả dụng | Có quy trình nguồn |
| `retail.points.policy.get` | Tra cứu chính sách tích điểm bán lẻ | Đọc | `GET /retail/points/policy` | Khả dụng | Có quy trình nguồn |
| `retail.points.policy.update` | Cập nhật chính sách tích điểm bán lẻ | Ghi | `PUT /retail/points/policy` | Khả dụng | Có quy trình nguồn |

#### 8. Báo cáo doanh số

Chức năng: Tổng hợp doanh số theo phạm vi/kỳ được yêu cầu.

Ví dụ: “Báo cáo doanh số tháng 11/2026.”

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `retail.report.summary` | Tổng hợp doanh số bán lẻ | Đọc | `GET /retail/reports/summary` | Khả dụng | Có quy trình nguồn |

#### 9. Bảo hành thiết bị đã bán — bổ sung

Chức năng: Tra bảo hành theo khách/mã thiết bị, xem cảnh báo và cập nhật thời hạn theo action hiện có.

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.33957f831ebdde02` | Tra cứu bảo hành theo mã thiết bị | Đọc | `GET /retail/warranty/lookup/:code` | Khả dụng | Có quy trình nguồn |
| `api.get.5ac7dee040f9bb15` | Tìm thiết bị sắp hết hạn bảo hành | Đọc | `GET /retail/warranty/expiring` | Khả dụng | UI không có / đang ẩn |
| `api.get.65279c2bb28cac4b` | Tìm thiết bị có nguy cơ thiếu thông tin bảo hành | Đọc | `GET /retail/warranty/gap-risk` | Khả dụng | UI không có / đang ẩn |
| `api.get.717dc1604d98a981` | Tra cứu thiết bị đã bán và thời hạn bảo hành | Đọc | `GET /retail/warranty/orders` | Khả dụng | Có quy trình nguồn |
| `retail.warranty.lookup.phone` | Tra cứu bảo hành theo số điện thoại khách hàng | Đọc | `GET /retail/warranty/lookup-phone/:phone` | Khả dụng | Có quy trình nguồn |
| `retail.warranty.serial.update` | Cập nhật thời hạn bảo hành cho thiết bị | Ghi | `PATCH /retail/warranty/serial/by-code/:code` | Khả dụng | UI không có / đang ẩn |

#### 10. Sổ quỹ bán lẻ — bổ sung

Chức năng: Tra sổ, lập phiếu thu chi, đối soát và chốt kỳ sổ quỹ bán lẻ.

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `retail.finance.cashbook.close` | Chốt kỳ sổ quỹ bán lẻ | Ghi | `POST /retail/finance/cashbook/close` | Khả dụng | Có quy trình nguồn |
| `retail.finance.cashbook.list` | Tra cứu sổ quỹ bán lẻ | Đọc | `GET /retail/finance/cashbook` | Khả dụng | UI không có / đang ẩn |
| `retail.finance.cashbook.reconcile` | Đối soát sổ quỹ bán lẻ | Đọc | `GET /retail/finance/cashbook/reconcile` | Khả dụng | Có quy trình nguồn |
| `retail.finance.cashbook.voucher.create` | Tạo phiếu thu chi sổ quỹ bán lẻ | Ghi | `POST /retail/finance/cashbook/vouchers` | Khả dụng | Có quy trình nguồn |

#### 11. Hoa hồng và lợi nhuận bán lẻ — bổ sung

Chức năng: Xem/cấu hình chính sách hoa hồng, phân tích KPI hoa hồng và lợi nhuận bán lẻ.

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.070d48d67bb5ed90` | Xem lợi nhuận bán lẻ | Đọc | `GET /retail/finance/profit` | Khả dụng | Có quy trình nguồn |
| `api.get.203a9f8e9a785680` | Xem hoa hồng bán lẻ của tôi | Đọc | `GET /retail/finance/commission/me` | Khả dụng | Có quy trình nguồn |
| `api.get.78da159ec226e07e` | Phân tích hoa hồng đối tác bán lẻ | Đọc | `GET /retail/finance/commission/kpi` | Khả dụng | Có quy trình nguồn |
| `api.get.7cae37ab77856122` | Xem chính sách hoa hồng cộng tác viên bán lẻ | Đọc | `GET /retail/finance/commission/policies` | Khả dụng | UI không có / đang ẩn |
| `retail.finance.commission.policy.update` | Cấu hình hoa hồng SKU cho cộng tác viên | Ghi | `PUT /retail/finance/commission/policies` | Khả dụng | UI không có / đang ẩn |

#### 12. Cài đặt bán lẻ và in hóa đơn — bổ sung

Chức năng: Đọc/cập nhật cấu hình POS, xem thiết lập in hóa đơn.

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.3b0987c2af0ac3e5` | Xem thiết lập in hóa đơn bán lẻ | Đọc | `GET /retail/settings/print` | Khả dụng | Có quy trình nguồn |
| `api.get.905fb162eeadc421` | Xem thiết lập bán lẻ | Đọc | `GET /retail/settings` | Khả dụng | Có quy trình nguồn |
| `api.put.124a0326bcb934fc` | Cập nhật cài đặt bán lẻ | Ghi | `PUT /retail/settings` | Khả dụng | Có quy trình nguồn |

#### 13. Tra cứu hàng để bán — bổ sung

Chức năng: Tra danh mục hàng, SKU/serial và sản phẩm có thể đưa vào đơn POS.

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.1f691abad0a10ee8` | Tra cứu nhóm hàng có thể bán | Đọc | `GET /retail/orders/categories` | Khả dụng | Có quy trình nguồn |
| `api.get.cc59ef5991d28f6a` | Tìm thiết bị theo số sê-ri để bán | Đọc | `GET /retail/orders/serials` | Khả dụng | UI không có / đang ẩn |
| `retail.order.products.list` | Tra cứu sản phẩm bán lẻ | Đọc | `GET /retail/orders/products` | Khả dụng | Có quy trình nguồn |

<a id="module-retail-partner"></a>
### Đối tác bán lẻ — `retail-partner`

**4 nhóm · 19 action (19 khả dụng, 0 không khả dụng).**

#### 1. Hồ sơ đối tác bán lẻ

Chức năng: Tạo và cập nhật đại lý, nhà cung cấp, cộng tác viên.

Ví dụ: “Tạo đại lý DOI-TAC-BAN-LE-QA.”

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `retail.partner.create.collaborator` | Tạo cộng tác viên bán lẻ | Ghi | `POST /retail/partners` | Khả dụng | Có quy trình nguồn |
| `retail.partner.create.dealer` | Tạo đại lý bán lẻ | Ghi | `POST /retail/partners` | Khả dụng | Có quy trình nguồn |
| `retail.partner.create.supplier` | Tạo nhà cung cấp bán lẻ | Ghi | `POST /retail/partners` | Khả dụng | Có quy trình nguồn |
| `retail.partner.customer.list` | Tra cứu khách hàng đại lý | Đọc | `GET /retail/partners/customers` | Khả dụng | Có quy trình nguồn |
| `retail.partner.list` | Tra cứu đối tác bán lẻ | Đọc | `GET /retail/partners` | Khả dụng | Có quy trình nguồn |
| `retail.partner.supplier.list` | Tra cứu nhà cung cấp liên kết | Đọc | `GET /retail/partners/suppliers` | Khả dụng | Có quy trình nguồn |
| `retail.partner.update` | Cập nhật đối tác bán lẻ | Ghi | `PATCH /retail/partners/:id` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `api.get.09ba89f080717c4a`, `api.get.9ca47ce89d0dd0f0`.

#### 2. Hoa hồng chung, đối soát và chi trả

Chức năng: Quản lý chính sách chung và các chứng từ hoa hồng cộng tác viên.

Ví dụ: “Tạo chính sách hoa hồng bán lẻ với các mức đã nêu.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.7c1d9c9cda4722a9` | Xem bảng kê hoa hồng cộng tác viên bán lẻ | Đọc | `GET /retail/finance/commission/partners/:id/statement` | Khả dụng | Có quy trình nguồn |
| `api.patch.2776df6160261ce4` | Cập nhật cấu hình hoa hồng bán lẻ | Ghi | `PATCH /retail/partners/commission-policies/:id` | Khả dụng | Có quy trình nguồn |
| `api.post.3c5a416752fe6656` | Chi trả hoa hồng cộng tác viên | Ghi | `POST /retail/finance/commission/partners/:id/payouts` | Khả dụng | Có quy trình nguồn |
| `api.post.78762121730098ad` | Tạo cấu hình hoa hồng bán lẻ | Ghi | `POST /retail/partners/commission-policies` | Khả dụng | Có quy trình nguồn |
| `api.post.9102a0fae468bcab` | Đối soát hoa hồng cộng tác viên | Ghi | `POST /retail/finance/commission/partners/:id/reconcile` | Khả dụng | Có quy trình nguồn |
| `retail.partner.commission.policy.list` | Tra cứu cấu hình hoa hồng bán lẻ | Đọc | `GET /retail/partners/commission-policies` | Khả dụng | Có quy trình nguồn |

#### 3. Hoa hồng theo sản phẩm

Chức năng: Tìm SKU và đặt mức hoa hồng riêng theo sản phẩm.

Ví dụ: “Cấu hình hoa hồng cho SAN-PHAM-QA.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.d9daa6226ed98e83` | Tra cứu mức hoa hồng theo sản phẩm | Đọc | `GET /retail/partners/product-commissions` | Khả dụng | Có quy trình nguồn |
| `retail.partner.product.commission.products` | Tra cứu sản phẩm và SKU để cấu hình hoa hồng | Đọc | `GET /retail/partners/policy-products` | Khả dụng | UI không có / đang ẩn |
| `retail.partner.product.commissions.update` | Cấu hình hoa hồng theo sản phẩm | Ghi | `PUT /retail/partners/product-commissions` | Khả dụng | Có quy trình nguồn |

#### 4. Tài khoản cộng tác viên

Chức năng: Tra các tài khoản và hồ sơ cộng tác viên liên quan.

Ví dụ: “Xem tài khoản cộng tác viên bán lẻ.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.09ba89f080717c4a` | Xem danh sách cộng tác viên bán lẻ | Đọc | `GET /retail/partners/collaborators` | Khả dụng | Có quy trình nguồn |
| `api.get.9ca47ce89d0dd0f0` | Xem hồ sơ cộng tác viên bán lẻ của tôi | Đọc | `GET /retail/partners/me` | Khả dụng | Có quy trình nguồn |
| `retail.partner.user.list` | Tra cứu tài khoản cộng tác viên | Đọc | `GET /retail/partners/users` | Khả dụng | Có quy trình nguồn |

<a id="module-repair"></a>
### Sửa chữa & bảo hành — `repair`

**11 nhóm · 36 action (36 khả dụng, 0 không khả dụng).**

#### 1. Phiếu sửa chữa

Chức năng: Tiếp nhận, tra cứu và hủy phiếu sửa chữa.

Ví dụ: “Tạo phiếu sửa cho THIET-BI-QA.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `repair.device.lookup` | Tra cứu thiết bị đã bán theo mã | Đọc | `POST /repair/tickets/lookup-device` | Khả dụng | UI không có / đang ẩn |
| `api.get.5bc56e7749f48d08` | Tra cứu phiếu sửa chữa theo số sê-ri thiết bị | Đọc | `GET /repair/tickets/by-serial/:serialNumber` | Khả dụng | UI không có / đang ẩn |
| `api.get.a647fdd78184d877` | Xem chi tiết phiếu sửa chữa | Đọc | `GET /repair/tickets/:id` | Khả dụng | Có quy trình nguồn |
| `api.post.5a64bf0894869ec7` | Hủy phiếu sửa chữa | Ghi | `POST /repair/tickets/:id/cancel` | Khả dụng | Có quy trình nguồn |
| `api.post.79291125e27b1d36` | Tạo phiếu sửa chữa dịch vụ | Ghi | `POST /repair/tickets` | Khả dụng | Có quy trình nguồn |
| `repair.list` | Tra cứu phiếu sửa chữa | Đọc | `GET /repair/tickets` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `api.post.8ed57322c93cc536`.

#### 2. Phân công kỹ thuật viên

Chức năng: Giao người thực hiện cho phiếu sửa.

Ví dụ: “Phân công KY-THUAT-QA cho PHIEU-SUA-QA.”

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.8ed57322c93cc536` | Phân công kỹ thuật viên sửa chữa | Ghi | `POST /repair/tickets/:id/assign` | Khả dụng | Có quy trình nguồn |

#### 3. Báo giá sửa chữa

Chức năng: Lập và duyệt báo giá của phiếu sửa.

Ví dụ: “Báo giá cho PHIEU-SUA-QA.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.1ee164077121787a` | Duyệt báo giá sửa chữa | Ghi | `POST /repair/tickets/:id/approve-quote` | Khả dụng | Có quy trình nguồn |
| `api.post.dd4d2216f9ecc537` | Báo giá phiếu sửa chữa | Ghi | `POST /repair/tickets/:id/quote` | Khả dụng | Có quy trình nguồn |

#### 4. Trạng thái và giao thiết bị

Chức năng: Cập nhật tiến trình hoặc ghi nhận giao thiết bị.

Ví dụ: “Cập nhật trạng thái PHIEU-SUA-QA.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.572b64fca460dafc` | Giao thiết bị sửa chữa | Ghi | `POST /repair/tickets/:id/deliver` | Khả dụng | Có quy trình nguồn |
| `api.post.951d43982cb708bc` | Cập nhật trạng thái phiếu sửa chữa | Ghi | `POST /repair/tickets/:id/status` | Khả dụng | Có quy trình nguồn |

#### 5. Linh kiện sửa chữa

Chức năng: Tra, xuất và hoàn linh kiện cho phiếu.

Ví dụ: “Xuất linh kiện LINH-KIEN-QA cho PHIEU-SUA-QA.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `repair.parts.list` | Tra cứu linh kiện đã xuất cho phiếu sửa chữa | Đọc | `GET /repair/tickets/:id/parts` | Khả dụng | Có quy trình nguồn |
| `api.get.25ab7ad5caa4684f` | Xem mức sử dụng linh kiện sửa chữa | Đọc | `GET /repair/reports/part-usage` | Khả dụng | UI không có / đang ẩn |
| `api.post.2b44c18916b1a882` | Hoàn linh kiện sửa chữa | Ghi | `POST /repair/tickets/:id/parts/:partId/return` | Khả dụng | Có quy trình nguồn |
| `api.post.aed04d8555cb4291` | Xuất linh kiện cho phiếu sửa chữa | Ghi | `POST /repair/tickets/:id/parts` | Khả dụng | Có quy trình nguồn |

#### 6. Thanh toán và hoàn tiền

Chức năng: Ghi nhận, đối chiếu tiền thu và xử lý hoàn tiền.

Ví dụ: “Đối chiếu tiền đã thu của PHIEU-SUA-QA.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `repair.refund.create` | Ghi nhận hoàn tiền sửa chữa | Ghi | `POST /repair/tickets/:id/refunds` | Khả dụng | Có quy trình nguồn |
| `repair.refund.summary` | Tra cứu số dư hoàn tiền sửa chữa | Đọc | `GET /repair/tickets/:id/refunds` | Khả dụng | Có quy trình nguồn |
| `repair.refund.vouchers` | Tìm phiếu chi đủ điều kiện hoàn tiền sửa chữa | Đọc | `GET /repair/tickets/:id/refunds/vouchers` | Khả dụng | Có quy trình nguồn |
| `api.get.8cb8202ecb5a1164` | Đối chiếu tiền đã thu trên phiếu sửa chữa | Đọc | `GET /repair/tickets/:id/payments/reconcile` | Khả dụng | Có quy trình nguồn |
| `api.get.e8ac82522784cf77` | Tra cứu một giao dịch thanh toán sửa chữa | Đọc | `GET /repair/tickets/:id/payments/:key` | Khả dụng | UI không có / đang ẩn |
| `api.post.ad54adfbaa37674b` | Ghi nhận thanh toán sửa chữa | Ghi | `POST /repair/tickets/:id/payments` | Khả dụng | Có quy trình nguồn |

#### 7. Báo cáo sửa chữa

Chức năng: Xem doanh thu, hiệu suất kỹ thuật viên và chất lượng sau sửa.

Ví dụ: “Xem doanh thu sửa chữa tháng đã chọn.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.3938bd395acae1c5` | Xem doanh thu sửa chữa | Đọc | `GET /repair/reports/revenue` | Khả dụng | Có quy trình nguồn |
| `api.get.68886fa48772aa78` | Xem hiệu suất kỹ thuật viên sửa chữa | Đọc | `GET /repair/reports/technician-performance` | Khả dụng | Có quy trình nguồn |
| `api.get.e25284fbbeeaf62d` | Tổng hợp đánh giá khách hàng sửa chữa | Đọc | `GET /repair/reports/feedback-summary` | Khả dụng | UI không có / đang ẩn |

Action liên quan, đã liệt kê ở nhóm chính khác: `api.get.25ab7ad5caa4684f`.

#### 8. Chăm sóc sau sửa chữa — bổ sung

Chức năng: Xem lịch sử chăm sóc theo khách/phiếu, ghi nhận trao đổi và cập nhật trạng thái chăm sóc.

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.c5fac63d8679d159` | Xem lịch sử chăm sóc khách hàng sửa chữa | Đọc | `GET /repair/care/customers/:id` | Khả dụng | Có quy trình nguồn |
| `api.get.cd0981c57831ef5c` | Xem lịch sử chăm sóc của phiếu sửa chữa | Đọc | `GET /repair/tickets/:id/care` | Khả dụng | Có quy trình nguồn |
| `api.post.30630b0bdc49b30c` | Ghi nhận trao đổi chăm sóc khách hàng | Ghi | `POST /repair/tickets/:id/care/messages` | Khả dụng | Có quy trình nguồn |
| `api.post.6fda6d726245dee1` | Cập nhật trạng thái chăm sóc khách hàng | Ghi | `POST /repair/tickets/:id/care/status` | Khả dụng | Có quy trình nguồn |

#### 9. Đánh giá sau sửa chữa — bổ sung

Chức năng: Tạo liên kết đánh giá, ghi nhận và tra đánh giá của khách.

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `repair.feedback.link.create` | Tạo liên kết đánh giá cho phiếu sửa chữa | Ghi | `POST /repair/tickets/:id/feedback-qr` | Khả dụng | UI không có / đang ẩn |
| `api.get.2c71c36e4f1d283e` | Tra cứu đánh giá sau sửa chữa | Đọc | `GET /repair/feedback` | Khả dụng | UI không có / đang ẩn |
| `api.post.742b8c7c7d343778` | Ghi nhận đánh giá sửa chữa | Ghi | `POST /repair/tickets/:id/feedback` | Khả dụng | Có quy trình nguồn |

#### 10. Thông báo sửa chữa — bổ sung

Chức năng: Xem lịch sử gửi, gửi lại và quản lý cấu hình thông báo.

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `repair.notification.resend` | Gá»­i láº¡i thÃ´ng bÃ¡o phiáº¿u sá»­a chá»¯a | Ghi | `POST /repair/tickets/:id/notifications/resend` | Khả dụng | Có quy trình nguồn |
| `api.get.d2d1a3ba9b169ce6` | Xem tin nhắn đã gửi về phiếu sửa chữa | Đọc | `GET /repair/tickets/:id/notifications` | Khả dụng | Có quy trình nguồn |
| `api.get.da5aa81551ee7ce6` | Xem cấu hình thông báo sửa chữa | Đọc | `GET /repair/settings/notifications` | Khả dụng | UI không có / đang ẩn |
| `api.put.b1eda41fa88b2cc9` | Cáº¥u hÃ¬nh thÃ´ng bÃ¡o phiáº¿u sá»­a chá»¯a | Ghi | `PUT /repair/settings/notifications` | Khả dụng | UI không có / đang ẩn |

#### 11. Lịch sử sửa chữa — bổ sung

Chức năng: Tra cứu lịch sử sửa theo khách hoặc thiết bị.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.7517d0cca9ca76c9` | Tra cứu lịch sử sửa chữa theo khách hoặc thiết bị | Đọc | `GET /repair/history` | Khả dụng | UI không có / đang ẩn |

<a id="module-finance"></a>
### Tài chính — `finance`

**11 nhóm · 69 action (69 khả dụng, 0 không khả dụng).**

#### 1. Thu chi tài chính

Chức năng: Lập phiếu thu/chi/chuyển quỹ và duyệt hoặc đảo chứng từ theo quyền.

Ví dụ: “Tạo phiếu chi với quỹ và số tiền đã chỉ định.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.5213d6b07cbffd29` | Thực hiện tài chính quản lý phiếu thu chi đảo giao dịch | Ghi | `POST /finance/management/vouchers/:id/reversal` | Khả dụng | Có quy trình nguồn |
| `finance.treasury.vouchers.create` | Lập phiếu thu, chi hoặc chuyển quỹ | Ghi | `POST /finance/reporting/treasury/vouchers` | Khả dụng | Có quy trình nguồn |
| `finance.treasury.vouchers.decision` | Duyệt hoặc từ chối phiếu thu chi | Ghi | `POST /finance/reporting/treasury/vouchers/:id/decision` | Khả dụng | Có quy trình nguồn |
| `finance.treasury.vouchers.list` | Tra phiếu thu chi | Đọc | `GET /finance/reporting/treasury` | Khả dụng | Có quy trình nguồn |
| `finance.voucher.create` | Tạo phiếu thu hoặc chi tài chính | Ghi | `POST /finance/management/vouchers` | Khả dụng | Có quy trình nguồn |

#### 2. Quỹ và ngân hàng

Chức năng: Tra/tạo tài khoản quỹ, xem sổ và quản lý kỳ tài chính.

Ví dụ: “Xem các quỹ và tài khoản ngân hàng.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.e7edb97470c1d234` | Tạo quỹ tiền mặt hoặc tài khoản ngân hàng | Ghi | `POST /finance/reporting/treasury/accounts` | Khả dụng | Có quy trình nguồn |
| `finance.treasury.accounts.list` | Tra các quỹ tiền mặt và tài khoản ngân hàng | Đọc | `GET /finance/reporting/treasury` | Khả dụng | Có quy trình nguồn |
| `finance.treasury.period.update` | Chốt hoặc mở lại kỳ tài chính | Ghi | `POST /finance/reporting/treasury/periods` | Khả dụng | Có quy trình nguồn |
| `finance.treasury.periods.list` | Tra cứu kỳ tài chính | Đọc | `GET /finance/reporting/treasury` | Khả dụng | Có quy trình nguồn |

#### 3. Khoản phải thu

Chức năng: Theo dõi tuổi nợ, thu tiền, điều chỉnh và gia hạn khoản phải thu.

Ví dụ: “Khách hàng nào đang quá hạn phải thu?”

Liệt kê đầy đủ **15 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `finance.receivable.aging` | Tổng hợp tuổi nợ phải thu | Đọc | `GET /finance/receivables/aging` | Khả dụng | Có quy trình nguồn |
| `finance.receivable.by-customer` | Tổng hợp khoản phải thu theo khách hàng | Đọc | `GET /finance/receivables/by-customer` | Khả dụng | UI không có / đang ẩn |
| `finance.receivable.detail` | Xem khoản phải thu và các bút toán có thể đảo | Đọc | `GET /finance/receivables/:id` | Khả dụng | Có quy trình nguồn |
| `finance.receivable.entry.reversal` | Đảo khoản thu hoặc điều chỉnh phải thu | Ghi | `POST /finance/receivables/:id/entries/:entryId/reversal` | Khả dụng | Có quy trình nguồn |
| `finance.receivable.extend` | Gia hạn khoản phải thu | Ghi | `POST /finance/receivables/:id/extend` | Khả dụng | Có quy trình nguồn |
| `finance.receivable.list` | Tra cứu khoản phải thu | Đọc | `GET /finance/receivables` | Khả dụng | Có quy trình nguồn |
| `finance.receivable.suspend` | Tạm dừng nhắc khoản phải thu | Ghi | `POST /finance/receivables/:id/suspend` | Khả dụng | UI không có / đang ẩn |
| `finance.reminders.delivery.retry-in-app` | Thử lại thông báo công nợ nội bộ | Ghi | `POST /finance/reminders/deliveries/:id/retry-in-app` | Khả dụng | UI không có / đang ẩn |
| `finance.reminders.retryable-deliveries.list` | Chọn thông báo nhắc công nợ nội bộ cần thử lại | Đọc | `GET /finance/reminders/deliveries/retryable` | Khả dụng | UI không có / đang ẩn |
| `finance.reminders.run` | Rà soát và xếp hàng nhắc công nợ quá hạn | Ghi | `POST /finance/reminders/runs` | Khả dụng | Có quy trình nguồn |
| `finance.reminders.runs.detail` | Xem chi tiết lượt rà soát nhắc công nợ | Đọc | `GET /finance/reminders/runs/:id` | Khả dụng | Có quy trình nguồn |
| `finance.reminders.runs.list` | Xem các lượt rà soát công nợ quá hạn | Đọc | `GET /finance/reminders/runs` | Khả dụng | Có quy trình nguồn |
| `api.post.5d88cf81f1042ab2` | Điều chỉnh khoản phải thu | Ghi | `POST /finance/receivables/:id/adjustments` | Khả dụng | Có quy trình nguồn |
| `api.post.ec8517952b42a8d0` | Ghi xóa khoản phải thu | Ghi | `POST /finance/receivables/:id/write-off` | Khả dụng | UI không có / đang ẩn |
| `api.post.ed7ac98d2498702f` | Thu tiền khoản phải thu | Ghi | `POST /finance/receivables/:id/payments` | Khả dụng | Có quy trình nguồn |

#### 4. Khoản phải trả và công nợ tổng hợp

Chức năng: Ghi nhận khoản phải trả, tra công nợ và thanh toán theo hợp đồng API.

Ví dụ: “Xem các khoản phải trả còn lại.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `finance.debt.list` | Tra cứu công nợ | Đọc | `GET /finance/reporting/debts` | Khả dụng | Chưa xác minh UI |
| `finance.management.debts.list` | Tra cứu khoản phải thu, phải trả và phiếu nhập chưa ghi công nợ | Đọc | `GET /finance/management/debts` | Khả dụng | Có quy trình nguồn |
| `api.post.c7f205ec27eeab37` | Tạo tài chính quản lý khoản phải trả | Ghi | `POST /finance/management/payables` | Khả dụng | Có quy trình nguồn |
| `api.post.f050d7804ae747a3` | Ghi nhận công nợ | Ghi | `POST /finance/reporting/debts` | Khả dụng | Chưa xác minh UI |
| `api.post.fd3f5b4a8cf47782` | Ghi nhận thanh toán công nợ | Ghi | `POST /finance/reporting/debts/:id/payments` | Khả dụng | Chưa xác minh UI |

#### 5. Đối soát quỹ và ngân hàng

Chức năng: Nhập giao dịch, ghép phiếu thu chi và ghi nhận đối soát.

Ví dụ: “Ghép GIAO-DICH-QA với PHIEU-THU-QA.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `finance.treasury.bank-lines.create` | Nhập giao dịch ngân hàng để đối soát | Ghi | `POST /finance/reporting/treasury/bank-lines` | Khả dụng | Có quy trình nguồn |
| `finance.treasury.bank-lines.list` | Tra giao dịch ngân hàng chờ đối soát | Đọc | `GET /finance/reporting/treasury` | Khả dụng | Có quy trình nguồn |
| `finance.treasury.bank-lines.match` | Ghép giao dịch ngân hàng với phiếu thu chi | Ghi | `POST /finance/reporting/treasury/bank-lines/:id/match` | Khả dụng | Có quy trình nguồn |
| `finance.treasury.reconciliation.create` | Ghi nhận đối soát quỹ | Ghi | `POST /finance/reporting/treasury/reconciliations` | Khả dụng | Có quy trình nguồn |

Lưu ý: finance.treasury.bank-lines.match vẫn có test thất bại từ baseline; cần kiểm thử luồng riêng trước khi kết luận hoạt động đầy đủ.

#### 6. Tài sản cố định

Chức năng: Quản lý hồ sơ, chuyển/ thanh lý, khấu hao và kiểm kê tài sản.

Ví dụ: “Mở phiên kiểm kê tài sản chi nhánh đã chọn.”

Liệt kê đầy đủ **16 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `finance.asset.depreciations.list` | Tra cứu khấu hao tài sản theo kỳ | Đọc | `GET /finance/assets/depreciations` | Khả dụng | Có quy trình nguồn |
| `finance.asset.detail` | Xem tài sản cố định | Đọc | `GET /finance/assets/:id` | Khả dụng | Có quy trình nguồn |
| `finance.asset.inventory.count` | Ghi nhận kết quả kiểm kê tài sản | Ghi | `POST /finance/asset-inventories/:id/counts` | Khả dụng | Có quy trình nguồn |
| `finance.asset.inventory.detail` | Xem phiên kiểm kê tài sản | Đọc | `GET /finance/asset-inventories/:id` | Khả dụng | Có quy trình nguồn |
| `finance.asset.inventory.finalize` | Chốt phiên kiểm kê tài sản | Ghi | `POST /finance/asset-inventories/:id/finalize` | Khả dụng | Có quy trình nguồn |
| `finance.asset.inventory.list` | Tra cứu phiên kiểm kê tài sản | Đọc | `GET /finance/asset-inventories` | Khả dụng | Có quy trình nguồn |
| `finance.asset.inventory.open` | Mở phiên kiểm kê tài sản tại chi nhánh | Ghi | `POST /finance/asset-inventories` | Khả dụng | Có quy trình nguồn |
| `finance.asset.inventory.variance` | Xem chênh lệch kiểm kê tài sản | Đọc | `GET /finance/asset-inventories/:id/variance` | Khả dụng | Có quy trình nguồn |
| `finance.asset.list` | Tra cứu tài sản cố định | Đọc | `GET /finance/assets` | Khả dụng | Có quy trình nguồn |
| `finance.asset.schedule` | Xem lịch khấu hao tài sản | Đọc | `GET /finance/assets/:id/schedule` | Khả dụng | Có quy trình nguồn |
| `api.patch.147cb912f34dd4d1` | Cập nhật tài sản cố định | Ghi | `PATCH /finance/assets/:id` | Khả dụng | Có quy trình nguồn |
| `api.post.9adaea0274bd3aac` | Chuyển tài sản sang chi nhánh | Ghi | `POST /finance/assets/:id/transfer` | Khả dụng | Có quy trình nguồn |
| `api.post.a5ab5625c92c88b1` | Thanh lý tài sản cố định | Ghi | `POST /finance/assets/:id/disposal` | Khả dụng | Có quy trình nguồn |
| `api.post.b8a7093520fc5d21` | Lập kế hoạch khấu hao tài sản | Ghi | `POST /finance/assets/depreciations/run` | Khả dụng | Có quy trình nguồn |
| `api.post.c77ec95f9e22a52a` | Tạo tài sản cố định | Ghi | `POST /finance/assets` | Khả dụng | Có quy trình nguồn |
| `api.post.f178e9522abebc03` | Ghi sổ khấu hao tài sản | Ghi | `POST /finance/assets/depreciations/post` | Khả dụng | Có quy trình nguồn |

#### 7. VAT và hóa đơn thuế

Chức năng: Ghi nhận VAT thủ công/từ hóa đơn và tra số dư kỳ.

Ví dụ: “Ghi nhận VAT từ hóa đơn đã chọn.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.748a178f1689567e` | Ghi nhận hóa đơn VAT | Ghi | `POST /finance/reporting/vat/invoices` | Khả dụng | Chưa xác minh UI |
| `api.put.7e0d95e6f48a16a7` | Cập nhật số dư VAT chuyển kỳ | Ghi | `PUT /finance/reporting/vat/period` | Khả dụng | Chưa xác minh UI |
| `finance.tax.create` | Ghi nhận VAT thủ công | Ghi | `POST /finance/management/tax` | Khả dụng | Có quy trình nguồn |
| `finance.tax.from-invoice` | Ghi nhận VAT từ hóa đơn bán lẻ | Ghi | `POST /finance/management/tax/from-invoice/:id` | Khả dụng | Có quy trình nguồn |
| `finance.vat.list` | Tra cứu hóa đơn VAT | Đọc | `GET /finance/reporting/vat` | Khả dụng | Chưa xác minh UI |

#### 8. Báo cáo tài chính

Chức năng: Tra doanh thu, chi phí, lãi lỗ, lợi nhuận và điểm hòa vốn.

Ví dụ: “Xem báo cáo lãi lỗ tháng 11/2026.”

Liệt kê đầy đủ **12 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.9dfafef7e83ee5f0` | Xóa báo cáo vận hành chi phí | Ghi | `DELETE /analytics/operating-expenses/:id` | Khả dụng | UI không có / đang ẩn |
| `api.get.03a093fc9349a692` | Xem báo cáo doanh thu | Đọc | `GET /analytics/revenue` | Khả dụng | Có quy trình nguồn |
| `api.get.4621ea131565f025` | Xem báo cáo lãi lỗ | Đọc | `GET /analytics/pnl` | Khả dụng | UI không có / đang ẩn |
| `api.get.614b2375b202f4b6` | Xem báo cáo chi phí | Đọc | `GET /analytics/expenses` | Khả dụng | Có quy trình nguồn |
| `api.get.88b9d2165759d798` | Xem chi phí vận hành | Đọc | `GET /analytics/operating-expenses` | Khả dụng | UI không có / đang ẩn |
| `api.get.c611407da8136c5f` | Xem tổng hợp khoản phải thu theo hạn | Đọc | `GET /analytics/receivables` | Khả dụng | Có quy trình nguồn |
| `api.get.f571d5d6bb5d51ab` | Xem tổng quan tài chính | Đọc | `GET /analytics/meta` | Khả dụng | Có quy trình nguồn |
| `api.post.c1af6a4524808fc9` | Tạo báo cáo vận hành chi phí | Ghi | `POST /analytics/operating-expenses` | Khả dụng | Có quy trình nguồn |
| `finance.reporting.breakeven` | Tra cứu điểm hòa vốn và kế hoạch tài chính | Đọc | `GET /finance/reporting/breakeven` | Khả dụng | Chưa xác minh UI |
| `finance.reporting.plan.update` | Cập nhật kế hoạch tài chính và điểm hòa vốn | Ghi | `PUT /finance/reporting/plan` | Khả dụng | Chưa xác minh UI |
| `api.get.65204362fe283948` | Xem báo cáo tài chính quản trị | Đọc | `GET /finance/management/report` | Khả dụng | Có quy trình nguồn |
| `api.get.d8e2ed96478d8a3e` | Xem báo cáo lợi nhuận tài chính | Đọc | `GET /finance/reporting/profit` | Khả dụng | Chưa xác minh UI |

#### 9. Ghi nhận chi phí — bổ sung

Chức năng: Ghi nhận chi phí tài chính theo hợp đồng API.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.ac04b554927d4696` | Ghi nhận chi phí | Ghi | `POST /finance/reporting/expenses` | Khả dụng | Chưa xác minh UI |

#### 10. Theo dõi xử lý công nợ quản trị — bổ sung

Chức năng: Tạo ghi nhận theo dõi trong quản lý tài chính.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.post.00f98f7f46e21cf0` | Tạo tài chính quản lý theo dõi | Ghi | `POST /finance/management/followups` | Khả dụng | Có quy trình nguồn |

#### 11. Cài đặt quản lý tài chính — bổ sung

Chức năng: Cập nhật cấu hình nghiệp vụ tài chính quản trị.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.put.86ec1b1dded51aa0` | Cập nhật tài chính quản lý cài đặt | Ghi | `PUT /finance/management/settings` | Khả dụng | Có quy trình nguồn |

<a id="module-marketing"></a>
### Marketing tự động — `marketing`

**3 nhóm · 8 action (8 khả dụng, 0 không khả dụng).**

#### 1. Chiến dịch email

Chức năng: Tạo nháp, tra, bật/tắt và xóa chiến dịch email.

Ví dụ: “Tạo bản nháp chiến dịch EMAIL-QA.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.holiday-campaign.create-draft` | Tạo bản nháp chiến dịch email | Ghi | `POST /marketing/campaigns` | Khả dụng | UI không có / đang ẩn |
| `marketing.holiday-campaign.delete` | Xóa chiến dịch email lễ/tết | Ghi | `DELETE /marketing/campaigns/:id` | Khả dụng | Có quy trình nguồn |
| `marketing.holiday-campaign.enabled.update` | Bật hoặc tắt chiến dịch email lễ/tết | Ghi | `PATCH /marketing/campaigns/:id` | Khả dụng | Có quy trình nguồn |
| `marketing.holiday-campaign.list` | Tra cứu chiến dịch email lễ/tết | Đọc | `GET /marketing/campaigns` | Khả dụng | Có quy trình nguồn |

Lưu ý: Tạo nháp không có nghĩa đã gửi email. Bật chiến dịch hoặc đổi cấu hình có thể tạo tác động ngoài hệ thống sau đó.

#### 2. Cấu hình gửi

Chức năng: Xem và cập nhật cài đặt tiếp thị.

Ví dụ: “Xem cấu hình gửi email marketing.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.ddf0c072158be296` | Xem trạng thái cấu hình marketing | Đọc | `GET /marketing/settings` | Khả dụng | Có quy trình nguồn |
| `marketing.settings.update` | Cập nhật cài đặt tiếp thị | Ghi | `PUT /marketing/settings` | Khả dụng | Có quy trình nguồn |

#### 3. Kết quả gửi

Chức năng: Tra các lượt chạy và trạng thái phát nội dung.

Ví dụ: “Xem kết quả gửi chiến dịch EMAIL-QA.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.34a8d9d0814701f9` | Tra cứu kết quả gửi nội dung marketing | Đọc | `GET /marketing/deliveries` | Khả dụng | Có quy trình nguồn |
| `api.get.790586d43d8979d7` | Tra cứu các lượt chạy marketing | Đọc | `GET /marketing/runs` | Khả dụng | UI không có / đang ẩn |

<a id="module-social-marketing"></a>
### Chiến dịch nội dung — `social-marketing`

**14 nhóm · 122 action (122 khả dụng, 0 không khả dụng).**

#### 1. Chiến dịch nội dung

Chức năng: Lập ý tưởng/kế hoạch, tra chiến dịch và chuyển trạng thái.

Ví dụ: “Lập kế hoạch nội dung cho CHIEN-DICH-QA.”

Liệt kê đầy đủ **15 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.ai.campaign-ideas` | Tạo ý tưởng chiến dịch marketing bằng AI | Ghi | `POST /gemini/marketing-ideas` | Khả dụng | UI không có / đang ẩn |
| `marketing.ai.content-pillars` | Tạo trụ cột nội dung marketing bằng AI | Ghi | `POST /gemini/marketing-pillars` | Khả dụng | UI không có / đang ẩn |
| `marketing.ai.scheduled-campaign` | Lập kế hoạch chiến dịch marketing bằng AI | Ghi | `POST /gemini/scheduled-campaign` | Khả dụng | UI không có / đang ẩn |
| `marketing.ai.topic-suggestions` | Gợi ý chủ đề marketing bằng AI | Đọc | `GET /gemini/marketing-suggestions` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.lifecycle` | Thay đổi trạng thái chiến dịch marketing | Ghi | `POST /marketing-campaigns/:id/:action` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.list` | Tra cứu chiến dịch marketing | Đọc | `GET /marketing-campaigns/assistant/summaries` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.sheet.ai.job.cancel` | Hủy lượt AI Content Sheet | Ghi | `POST /marketing-campaigns/:id/sheet/ai/jobs/:jobId/cancel` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.sheet.ai.job.retry` | Chạy lại lượt AI Content Sheet | Ghi | `POST /marketing-campaigns/:id/sheet/ai/jobs/:jobId/retry` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.sheet.ai.jobs.list` | Tra trạng thái các lượt AI Content Sheet | Đọc | `GET /marketing-campaigns/:id/sheet/ai/jobs/assistant-summaries` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.sheet.cells.update` | Cập nhật các ô Content Sheet | Ghi | `PATCH /marketing-campaigns/:id/sheet/cells` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.sheet.columns.list` | Tra cứu cột Content Sheet theo tên | Đọc | `GET /marketing-campaigns/:id/sheet/columns/assistant-summaries` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.sheet.revisions.list` | Tra cứu lịch sử phiên bản Content Sheet | Đọc | `GET /marketing-campaigns/:id/sheet/revisions` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.sheet.revisions.revert` | Hoàn tác thay đổi Content Sheet | Ghi | `POST /marketing-campaigns/:id/sheet/revisions/:revisionId/revert` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.sheet.slots.list` | Chọn dòng Content Sheet theo tên | Đọc | `GET /marketing-campaigns/:id/sheet/slots` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.slot.content.update` | Cập nhật nội dung slot chiến dịch | Ghi | `PATCH /marketing-campaigns/:id/slots/:slotId/content` | Khả dụng | UI không có / đang ẩn |

Action liên quan, đã liệt kê ở nhóm chính khác: `marketing.campaign.analytics.summary`, `marketing.campaign.asset-order.ai.apply`, `marketing.campaign.asset-order.ai.dismiss`, `marketing.campaign.asset-order.ai.job.cancel`, `marketing.campaign.asset-order.ai.jobs.list`, `marketing.campaign.asset-order.ai.preview`, `marketing.campaign.asset-order.archive`, `marketing.campaign.asset-order.create`, `marketing.campaign.asset-order.update`, `marketing.campaign.asset-orders.list`, `marketing.campaign.bulk-import.jobs.list`, `marketing.campaign.calendar`, `marketing.campaign.slot.approve`, `marketing.campaign.slot.publish-now`, `marketing.campaign.slot.reject`, `marketing.campaign.slot.retry`.

#### 2. Sản xuất nội dung

Chức năng: Tạo, sửa bản nháp và quản lý Order sản xuất.

Ví dụ: “Tạo Order sản xuất nội dung cho CHIEN-DICH-QA.”

Liệt kê đầy đủ **15 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.ai.draft-posts` | Phát triển bản nháp bài đăng marketing bằng AI | Ghi | `POST /gemini/marketing-develop` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.asset-order.ai.apply` | Áp dụng brief AI cho Order sản xuất | Ghi | `POST /marketing-campaigns/:id/asset-orders/:orderId/ai/apply` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.asset-order.ai.dismiss` | Bỏ đề xuất AI của Order sản xuất | Ghi | `POST /marketing-campaigns/:id/asset-orders/:orderId/ai/dismiss` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.asset-order.ai.job.cancel` | Hủy lượt AI điền Order | Ghi | `POST /marketing-campaigns/:id/asset-orders/ai/jobs/:jobId/cancel` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.asset-order.ai.jobs.list` | Tra cứu lượt AI điền Order | Đọc | `GET /marketing-campaigns/:id/asset-orders/ai/jobs/assistant-summaries` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.asset-order.ai.preview` | Tạo bản đề xuất brief Order bằng AI | Ghi | `POST /marketing-campaigns/:id/asset-orders/:orderId/ai/preview` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.asset-order.archive` | Hủy Order sản xuất nội dung | Ghi | `DELETE /marketing-campaigns/:id/asset-orders/:orderId` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.asset-order.create` | Tạo Order sản xuất nội dung | Ghi | `POST /marketing-campaigns/:id/asset-orders` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.asset-order.update` | Cập nhật Order sản xuất nội dung | Ghi | `PATCH /marketing-campaigns/:id/asset-orders/:orderId` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.asset-orders.list` | Tra cứu Order sản xuất trong chiến dịch | Đọc | `GET /marketing-campaigns/:id/asset-orders/assistant-summaries` | Khả dụng | UI không có / đang ẩn |
| `marketing.content.detail` | Xem nội dung marketing đã lưu | Đọc | `GET /marketing-contents/:id` | Khả dụng | UI không có / đang ẩn |
| `marketing.content.draft.create` | Tạo bản nháp nội dung marketing | Ghi | `POST /marketing-contents/assistant/drafts` | Khả dụng | UI không có / đang ẩn |
| `marketing.content.draft.delete` | Xóa bản nháp nội dung marketing | Ghi | `DELETE /marketing-contents/assistant/drafts/:id` | Khả dụng | UI không có / đang ẩn |
| `marketing.content.draft.update` | Cập nhật bản nháp nội dung marketing | Ghi | `PATCH /marketing-contents/assistant/drafts/:id` | Khả dụng | UI không có / đang ẩn |
| `marketing.content.list` | Tra cứu nội dung marketing đã lưu | Đọc | `GET /marketing-contents` | Khả dụng | UI không có / đang ẩn |

#### 3. Bảng nội dung

Chức năng: Quản lý cột/dòng, nhập dữ liệu và áp dụng đề xuất AI vào Content Sheet.

Ví dụ: “Thêm dòng vào bảng nội dung CHIEN-DICH-QA.”

Liệt kê đầy đủ **13 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.06e367cdefd81e60` | Xóa trường thông tin đơn hàng chiến dịch | Ghi | `DELETE /marketing-campaigns/:id/asset-orders/custom-fields/:fieldKey` | Khả dụng | UI không có / đang ẩn |
| `api.delete.821abe66f21dcede` | Lưu trữ cột trong bảng nội dung chiến dịch | Ghi | `DELETE /marketing-campaigns/:id/sheet/columns/:columnId` | Khả dụng | UI không có / đang ẩn |
| `api.patch.4da13a2c42665d10` | Cập nhật dòng trong bảng nội dung chiến dịch | Ghi | `PATCH /marketing-campaigns/:id/sheet/rows/:slotId` | Khả dụng | UI không có / đang ẩn |
| `api.patch.568b7733e09d2fd4` | Cập nhật cột trong bảng nội dung chiến dịch | Ghi | `PATCH /marketing-campaigns/:id/sheet/columns/:columnId` | Khả dụng | UI không có / đang ẩn |
| `api.post.0b24bc4450142162` | Xem trước dữ liệu nhập nhiều đơn hàng chiến dịch | Ghi | `POST /marketing-campaigns/:id/asset-orders/bulk-import/preview` | Khả dụng | UI không có / đang ẩn |
| `api.post.2e5c57691eaca5f3` | Tạo lượt AI điền nội dung cho bảng chiến dịch | Ghi | `POST /marketing-campaigns/:id/sheet/ai/jobs` | Khả dụng | UI không có / đang ẩn |
| `api.post.44271d4a548fc225` | Thêm dòng vào bảng dữ liệu chiến dịch | Ghi | `POST /marketing-campaigns/:id/sheet/rows` | Khả dụng | UI không có / đang ẩn |
| `api.post.6e7eaeb9be19d13b` | Thêm trường thông tin cho đơn hàng chiến dịch | Ghi | `POST /marketing-campaigns/:id/asset-orders/custom-fields` | Khả dụng | UI không có / đang ẩn |
| `api.post.8f4e6b6e62376095` | Áp dụng nội dung AI đề xuất vào bảng chiến dịch | Ghi | `POST /marketing-campaigns/:id/sheet/ai/jobs/:jobId/apply` | Khả dụng | UI không có / đang ẩn |
| `api.post.94df372cee3d43f4` | Xem trước dữ liệu đơn hàng từ Google Drive | Ghi | `POST /marketing-campaigns/:id/asset-orders/drive-import/preview` | Khả dụng | UI không có / đang ẩn |
| `api.post.9fe634492244a76b` | Thêm cột vào bảng dữ liệu chiến dịch | Ghi | `POST /marketing-campaigns/:id/sheet/columns` | Khả dụng | UI không có / đang ẩn |
| `api.post.bb225803a96e0b2e` | Nhập dữ liệu đơn hàng từ Google Drive | Ghi | `POST /marketing-campaigns/:id/asset-orders/drive-import/apply` | Khả dụng | UI không có / đang ẩn |
| `api.post.d88657dd722cb73f` | Xem trước nội dung AI đề xuất cho bảng chiến dịch | Ghi | `POST /marketing-campaigns/:id/sheet/ai/preview` | Khả dụng | UI không có / đang ẩn |

Action liên quan, đã liệt kê ở nhóm chính khác: `api.post.ef223f5f2995bc38`, `marketing.ai.content-pillars`, `marketing.campaign.asset-order.ai.apply`, `marketing.campaign.asset-order.ai.dismiss`, `marketing.campaign.asset-order.ai.job.cancel`, `marketing.campaign.asset-order.ai.jobs.list`, `marketing.campaign.asset-order.ai.preview`, `marketing.campaign.asset-order.archive`, `marketing.campaign.asset-order.update`, `marketing.campaign.asset-orders.list`, `marketing.campaign.bulk-import.jobs.list`, `marketing.campaign.sheet.ai.job.cancel`, `marketing.campaign.sheet.ai.job.retry`, `marketing.campaign.sheet.ai.jobs.list`, `marketing.campaign.sheet.cells.update`, `marketing.campaign.sheet.columns.list`, `marketing.campaign.sheet.revisions.list`, `marketing.campaign.sheet.revisions.revert`, `marketing.campaign.sheet.slots.list`, `api.post.2ff1ac15e0ff3989`, `api.post.f74c1ae26e5c4c3d`, `api.post.f7c8bd07314d5116`.

#### 4. Ảnh AI

Chức năng: Tạo/chỉnh sửa ảnh, quản lý mẫu và tạo ảnh hàng loạt.

Ví dụ: “Tạo bản xem trước ảnh cho nội dung giả lập.”

Liệt kê đầy đủ **25 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.delete.0db37a086a255cd2` | Xóa mẫu tạo ảnh hàng loạt | Ghi | `DELETE /bulk-create/templates/:id` | Khả dụng | UI không có / đang ẩn |
| `api.delete.e873e19cbd43da2f` | Xóa nội dung tạo ảnh hàng loạt | Ghi | `DELETE /bulk-create/assets/:id` | Khả dụng | UI không có / đang ẩn |
| `api.get.3489b2175c9d356c` | Tra cứu mẫu bài đăng dùng nhiều lần | Đọc | `GET /bulk-create/templates/paged` | Khả dụng | UI không có / đang ẩn |
| `api.get.78cd5e06164e908a` | Tra cứu tệp ảnh và video dùng cho bài đăng | Đọc | `GET /bulk-create/assets` | Khả dụng | UI không có / đang ẩn |
| `api.post.7367d21b7163500b` | Thêm ảnh hoặc video vào thư viện tạo nội dung hàng loạt | Ghi | `POST /bulk-create/assets` | Khả dụng | UI không có / đang ẩn |
| `api.post.8ee0e1e6992ff475` | Xem trước nội dung ảnh sẽ tạo từ bảng tính | Ghi | `POST /bulk-create/workbooks/preview` | Khả dụng | UI không có / đang ẩn |
| `api.post.ef223f5f2995bc38` | Xem trước hàng loạt tạo Google bảng dữ liệu | Ghi | `POST /bulk-create/google-sheets/preview` | Khả dụng | UI không có / đang ẩn |
| `marketing.ai.image.edit` | Chỉnh sửa ảnh bằng AI | Ghi | `POST /gemini/edit-image` | Khả dụng | UI không có / đang ẩn |
| `marketing.ai.image.generate` | Tạo ảnh marketing bằng AI | Ghi | `POST /gemini/generate-image` | Khả dụng | UI không có / đang ẩn |
| `marketing.ai.optimize-image-prompt` | Biên tập mô tả hình ảnh bằng AI | Ghi | `POST /gemini/optimize-prompt` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.jobs.cancel` | Hủy lượt tạo ảnh hàng loạt | Ghi | `POST /bulk-create/jobs/:id/cancel` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.jobs.detail` | Xem trạng thái lượt tạo ảnh hàng loạt | Đọc | `GET /bulk-create/jobs/:id` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.jobs.list` | Theo dõi lượt tạo ảnh hàng loạt | Đọc | `GET /bulk-create/jobs` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.jobs.retry` | Thử lại ảnh lỗi trong lượt tạo hàng loạt | Ghi | `POST /bulk-create/jobs/:id/retry` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.templates.community.list` | Tra cứu mẫu thiết kế cộng đồng | Đọc | `GET /bulk-create/templates/community` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.templates.community.use` | Sao chép mẫu cộng đồng vào doanh nghiệp | Ghi | `POST /bulk-create/templates/:id/use` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.templates.detail` | Xem trạng thái mẫu thiết kế tạo ảnh hàng loạt | Đọc | `GET /bulk-create/templates/:id` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.templates.list` | Tra cứu mẫu thiết kế tạo ảnh hàng loạt | Đọc | `GET /bulk-create/templates` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.templates.publish` | Chia sẻ mẫu thiết kế với cộng đồng | Ghi | `POST /bulk-create/templates/:id/publish` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.templates.rename` | Đổi tên mẫu thiết kế tạo ảnh hàng loạt | Ghi | `PATCH /bulk-create/templates/:id` | Khả dụng | UI không có / đang ẩn |
| `marketing.bulk-create.templates.unpublish` | Ngừng chia sẻ mẫu thiết kế | Ghi | `POST /bulk-create/templates/:id/unpublish` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.bulk-import.jobs.list` | Tra cứu lượt tạo ảnh liên quan đến chiến dịch | Đọc | `GET /marketing-campaigns/:id/asset-orders/bulk-import/jobs` | Khả dụng | UI không có / đang ẩn |
| `api.post.2ff1ac15e0ff3989` | Tạo ảnh cho đơn hàng chiến dịch | Ghi | `POST /marketing-campaigns/:id/asset-orders/:orderId/bulk` | Khả dụng | UI không có / đang ẩn |
| `api.post.f74c1ae26e5c4c3d` | Xem trước ảnh sẽ tạo cho đơn hàng chiến dịch | Ghi | `POST /marketing-campaigns/:id/asset-orders/:orderId/bulk/preview` | Khả dụng | UI không có / đang ẩn |
| `api.post.f7c8bd07314d5116` | Bổ sung nội dung còn thiếu cho đơn hàng sản xuất ảnh | Ghi | `POST /marketing-campaigns/:id/asset-orders/ai/fill-all` | Khả dụng | UI không có / đang ẩn |

Action liên quan, đã liệt kê ở nhóm chính khác: `marketing.media-history.delete`, `marketing.media-history.list`, `marketing.video-caption.project.generate-context`, `api.get.66991e7cdf8da27d`.

#### 5. Giọng đọc và phụ đề video

Chức năng: Tạo giọng đọc, nhận dạng lời thoại, biên tập và kết xuất phụ đề.

Ví dụ: “Tạo bản nháp phụ đề cho video thử nghiệm.”

Liệt kê đầy đủ **24 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.ai.optimize-script` | Biên tập văn bản cho phát thanh | Ghi | `POST /gemini/optimize-script` | Khả dụng | UI không có / đang ẩn |
| `marketing.elevenlabs.custom-voice.preview` | Tạo bản nghe thử giọng tự thiết kế | Ghi | `POST /elevenlabs/custom-voice-preview` | Khả dụng | UI không có / đang ẩn |
| `marketing.elevenlabs.models.list` | Tra model tạo giọng đọc ElevenLabs | Đọc | `GET /elevenlabs/models` | Khả dụng | UI không có / đang ẩn |
| `marketing.elevenlabs.voice-settings.read` | Xem cài đặt giọng đọc ElevenLabs | Đọc | `GET /elevenlabs/voices/:voiceId/settings` | Khả dụng | UI không có / đang ẩn |
| `marketing.elevenlabs.voice-settings.update` | Cập nhật cài đặt giọng đọc ElevenLabs | Ghi | `POST /elevenlabs/voices/:voiceId/settings` | Khả dụng | UI không có / đang ẩn |
| `marketing.elevenlabs.voice.delete` | Xóa giọng đọc ElevenLabs tùy chỉnh | Ghi | `DELETE /elevenlabs/voices/:voiceId` | Khả dụng | UI không có / đang ẩn |
| `marketing.elevenlabs.voice.detail` | Xem thông tin giọng đọc ElevenLabs | Đọc | `GET /elevenlabs/voices/:voiceId` | Khả dụng | UI không có / đang ẩn |
| `marketing.elevenlabs.voice.generate` | Tạo tệp giọng đọc AI | Ghi | `POST /elevenlabs/generate-voice` | Khả dụng | UI không có / đang ẩn |
| `marketing.elevenlabs.voices.list` | Tra giọng đọc ElevenLabs theo tài khoản | Đọc | `GET /elevenlabs/voices` | Khả dụng | UI không có / đang ẩn |
| `marketing.media-history.delete` | Xóa mục lịch sử ảnh hoặc giọng đọc | Ghi | `DELETE /gemini/media-history/:id` | Khả dụng | UI không có / đang ẩn |
| `marketing.media-history.list` | Xem lịch sử ảnh và giọng đọc AI | Đọc | `GET /gemini/media-history` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.drive-videos.list` | Tìm video trong thư mục Google Drive để làm phụ đề | Đọc | `POST /video-caption-projects/resolve-drive-folder` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.project.analyze` | Phân tích video nguồn | Ghi | `POST /video-caption-projects/:id/analyze` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.project.cancel` | Hủy dự án phụ đề video | Ghi | `POST /video-caption-projects/:id/cancel` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.project.create` | Tạo bản nháp dự án phụ đề video | Ghi | `POST /video-caption-projects` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.project.detail` | Xem tóm tắt dự án phụ đề video | Đọc | `GET /video-caption-projects/:id` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.project.generate-context` | Tạo caption theo ngữ cảnh video | Ghi | `POST /video-caption-projects/:id/generate-context` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.project.list` | Tra cứu dự án phụ đề video | Đọc | `GET /video-caption-projects` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.project.render` | Kết xuất phụ đề video | Ghi | `POST /video-caption-projects/:id/render` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.project.retry` | Thử lại dự án phụ đề video | Ghi | `POST /video-caption-projects/:id/retry` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.project.transcribe` | Nhận dạng lời thoại trong video | Ghi | `POST /video-caption-projects/:id/transcribe` | Khả dụng | UI không có / đang ẩn |
| `marketing.video-caption.project.update` | Cập nhật dự án phụ đề video | Ghi | `PATCH /video-caption-projects/:id` | Khả dụng | UI không có / đang ẩn |
| `api.get.66991e7cdf8da27d` | Tra cứu nội dung và chiến dịch làm ngữ cảnh phụ đề | Đọc | `GET /video-caption-projects/context-options` | Khả dụng | UI không có / đang ẩn |
| `api.get.c380a8600a6b601f` | Xem tiến độ xử lý phụ đề video | Đọc | `GET /video-caption-projects/:id/jobs` | Khả dụng | UI không có / đang ẩn |

#### 6. Duyệt, lên lịch và đăng bài

Chức năng: Duyệt/từ chối nội dung và đăng hoặc đặt lịch lên kênh.

Ví dụ: “Lên lịch bài giả lập cho thời điểm đã chọn.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.campaign.calendar` | Tra lịch đăng nội dung chiến dịch | Đọc | `GET /marketing-campaigns/calendar` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.slot.approve` | Duyệt nội dung Facebook trong lịch chiến dịch | Ghi | `POST /marketing-campaigns/:id/slots/:slotId/approve` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.slot.publish-now` | Đăng ngay nội dung Facebook trong lịch chiến dịch | Ghi | `POST /marketing-campaigns/:id/slots/:slotId/publish-now` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.slot.reject` | Từ chối slot nội dung đang chờ duyệt | Ghi | `POST /marketing-campaigns/:id/slots/:slotId/reject` | Khả dụng | UI không có / đang ẩn |
| `marketing.campaign.slot.retry` | Đưa slot nội dung lỗi về hàng đợi thử lại | Ghi | `POST /marketing-campaigns/:id/slots/:slotId/retry` | Khả dụng | UI không có / đang ẩn |
| `marketing.scheduler.schedule-post` | Lên lịch đăng bài mạng xã hội | Ghi | `POST /scheduler/schedule-post` | Khả dụng | UI không có / đang ẩn |

Lưu ý: Đăng ngay/lên lịch là tác động bên ngoài ERP; trong phép thử chỉ dừng ở xác nhận.

#### 7. Tài khoản và kết nối kênh

Chức năng: Tra tài khoản, kết nối mạng xã hội và tích hợp phục vụ nội dung.

Ví dụ: “Xem trạng thái kết nối kênh của tài khoản tôi.”

Liệt kê đầy đủ **8 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.account.list` | Tra cứu tài khoản mạng xã hội cho chiến dịch | Đọc | `GET /marketing-campaigns/accounts` | Khả dụng | UI không có / đang ẩn |
| `marketing.account.telegram-link.create` | Tạo mã liên kết Telegram cho tài khoản | Ghi | `POST /marketing-settings/telegram-link` | Khả dụng | UI không có / đang ẩn |
| `marketing.account.telegram-link.status` | Xem trạng thái liên kết Telegram của tài khoản | Đọc | `GET /marketing-settings/telegram-link` | Khả dụng | UI không có / đang ẩn |
| `marketing.account.telegram-link.unlink` | Hủy liên kết Telegram và tạo mã mới | Ghi | `DELETE /marketing-settings/telegram-link` | Khả dụng | UI không có / đang ẩn |
| `marketing.author.integration-status` | Xem trạng thái kết nối kênh của nhân sự | Đọc | `GET /marketing-settings/authors/:id` | Khả dụng | UI không có / đang ẩn |
| `marketing.canva.designs.list` | Tra thiết kế Canva của tôi | Đọc | `GET /canva/designs` | Khả dụng | UI không có / đang ẩn |
| `marketing.canva.status` | Xem trạng thái kết nối Canva của tôi | Đọc | `GET /canva/status` | Khả dụng | UI không có / đang ẩn |
| `marketing.facebook-app-config.read` | Kiểm tra cấu hình Facebook App | Đọc | `GET /facebook/config` | Khả dụng | UI không có / đang ẩn |

#### 8. Thống kê chiến dịch

Chức năng: Theo dõi thống kê và kết quả hoạt động chiến dịch.

Ví dụ: “Xem thống kê CHIEN-DICH-QA.”

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.campaign.analytics.summary` | Xem thống kê chiến dịch marketing | Đọc | `GET /marketing-campaigns/assistant/analytics` | Khả dụng | UI không có / đang ẩn |

#### 9. Cấu hình AI trả lời tự động — bổ sung

Chức năng: Cập nhật cấu hình trợ lý trả lời tự động.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.auto-reply.config.update` | Cập nhật cài đặt trợ lý trả lời tự động | Ghi | `PATCH /marketing-settings/auto-reply` | Khả dụng | UI không có / đang ẩn |

#### 10. Quy trình hội thoại trên Page — bổ sung

Chức năng: Xem, tạo nháp, gợi ý và kích hoạt phiên bản quy trình hội thoại.

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.chat-flow.activate` | Kích hoạt bản nháp workflow hội thoại | Ghi | `POST /marketing-settings/chat-flows/:pageId/:version/activate` | Khả dụng | UI không có / đang ẩn |
| `marketing.chat-flow.draft.create` | Tạo bản nháp quy trình trả lời tự động trên Trang Facebook | Ghi | `POST /marketing-settings/chat-flows/:pageId/draft` | Khả dụng | UI không có / đang ẩn |
| `marketing.chat-flow.list` | Xem quy trình trả lời tự động trên Trang Facebook | Đọc | `GET /marketing-settings/chat-flows/:pageId` | Khả dụng | UI không có / đang ẩn |
| `marketing.chat-flow.suggest` | Gợi ý nội dung quy trình trả lời tự động trên Trang Facebook | Đọc | `POST /marketing-settings/chat-flows/:pageId/suggest` | Khả dụng | UI không có / đang ẩn |

#### 11. Thu thập thông tin khách tiềm năng — bổ sung

Chức năng: Tạo nháp, xem, gợi ý câu hỏi, áp dụng hoặc ngừng cấu hình tiếp nhận lead.

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.lead-intake-profile.activate` | Áp dụng cấu hình thu thập khách hàng tiềm năng | Ghi | `POST /marketing-settings/lead-intake-profiles/:version/activate` | Khả dụng | UI không có / đang ẩn |
| `marketing.lead-intake-profile.archive` | Tắt cấu hình thu thập khách hàng tiềm năng đang áp dụng | Ghi | `POST /marketing-settings/lead-intake-profiles/archive-active` | Khả dụng | UI không có / đang ẩn |
| `marketing.lead-intake-profile.draft.create` | Tạo bản nháp thu thập thông tin khách hàng tiềm năng | Ghi | `POST /marketing-settings/lead-intake-profiles/draft` | Khả dụng | UI không có / đang ẩn |
| `marketing.lead-intake-profile.list` | Xem cài đặt tiếp nhận khách hàng tiềm năng | Đọc | `GET /marketing-settings/lead-intake-profiles` | Khả dụng | UI không có / đang ẩn |
| `marketing.lead-intake-profile.suggest` | Gợi ý câu hỏi thu thập thông tin khách hàng tiềm năng | Đọc | `POST /marketing-settings/lead-intake-profiles/suggest` | Khả dụng | UI không có / đang ẩn |

#### 12. Gói AI và lượt sử dụng — bổ sung

Chức năng: Xem các gói và mức sử dụng AI.

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.ai-subscription.plans` | Xem các gói AI đang cung cấp | Đọc | `GET /marketing-subscription/plans` | Khả dụng | UI không có / đang ẩn |
| `marketing.ai-subscription.summary` | Xem gói AI và lượt sử dụng | Đọc | `GET /marketing-subscription` | Khả dụng | UI không có / đang ẩn |

#### 13. Cấu hình đọc hóa đơn và hợp đồng theo kênh — bổ sung

Chức năng: Xem cấu hình đọc chứng từ theo tài khoản/kênh.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.0e783589312053eb` | Xem cấu hình đọc hóa đơn và hợp đồng | Đọc | `GET /marketing-settings/telecom-invoices/:platform/:pageId` | Khả dụng | UI không có / đang ẩn |

#### 14. Điều kiện đăng TikTok — bổ sung

Chức năng: Kiểm tra điều kiện đăng của tài khoản TikTok/TikTok doanh nghiệp.

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.tiktok-business.creator-info` | Tra cứu điều kiện đăng của tài khoản TikTok doanh nghiệp | Đọc | `POST /tiktok-business/creator-info` | Khả dụng | UI không có / đang ẩn |
| `marketing.tiktok.creator-info` | Tra cứu điều kiện đăng của tài khoản TikTok | Đọc | `POST /tiktok/creator-info` | Khả dụng | UI không có / đang ẩn |

<a id="module-omni-inbox"></a>
### Hộp thư đa kênh — `omni-inbox`

**11 nhóm · 42 action (42 khả dụng, 0 không khả dụng).**

#### 1. Xem hội thoại

Chức năng: Tra hội thoại/tin nhắn Facebook, TikTok và Zalo.

Ví dụ: “Xem các hội thoại TikTok gần đây.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.facebook-conversations.list` | Tra hội thoại Facebook gần đây | Đọc | `GET /facebook/messenger/conversations` | Khả dụng | Có quy trình nguồn |
| `marketing.order-sheet.orders.list` | Tra cứu đơn hàng từ tin nhắn | Đọc | `GET /order-sheets/orders` | Khả dụng | Chưa xác minh UI |
| `api.get.06681c767355ea2d` | Tra cứu khách tiềm năng theo hội thoại | Đọc | `GET /omni-inbox/leads/by-conversation` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.tiktok-conversations.list` | Tra hội thoại TikTok gần đây | Đọc | `GET /tiktok/messenger/conversations` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.zalo-conversations.list` | Tra hội thoại Zalo gần đây | Đọc | `GET /zalo/conversations` | Khả dụng | Có quy trình nguồn |

#### 2. Trả lời khách hàng

Chức năng: Gửi phản hồi và quản lý trạng thái đọc theo kênh.

Ví dụ: “Soạn phản hồi thử nghiệm cho hội thoại đã chọn.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.facebook-conversation.mark-read` | Đánh dấu hội thoại Facebook đã đọc | Ghi | `POST /facebook/messenger/conversations/:recipientId/mark-read` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.facebook-conversation.reply` | Gửi phản hồi qua Facebook | Ghi | `POST /facebook/messenger/reply` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.tiktok-conversation.mark-read` | Đánh dấu hội thoại TikTok đã đọc | Ghi | `POST /tiktok/messenger/conversations/:conversationId/mark-read` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.tiktok-conversation.reply` | Gửi phản hồi qua TikTok | Ghi | `POST /tiktok/messenger/reply` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.zalo-conversation.mark-read` | Đánh dấu hội thoại Zalo đã đọc | Ghi | `POST /zalo/conversations/:recipientId/mark-read` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.zalo-conversation.reply` | Gửi phản hồi qua Zalo | Ghi | `POST /zalo/reply` | Khả dụng | Có quy trình nguồn |

Lưu ý: Gửi phản hồi là hành động liên lạc bên ngoài. Kịch bản kiểm thử chỉ đến bản xem trước/xác nhận.

#### 3. Khách tiềm năng

Chức năng: Tạo, cập nhật, tra lead và đồng bộ bảng tính khi được yêu cầu.

Ví dụ: “Tạo lead LEAD-QA với email leadqa@example.test.”

Liệt kê đầy đủ **9 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.lead-sheet.retry` | Thử đồng bộ lại khách hàng tiềm năng sang Google Sheets | Ghi | `POST /order-sheets/integrations/:integrationId/leads/retry` | Khả dụng | Chưa xác minh UI |
| `omni-inbox.lead-sheet.test` | Kiểm tra kết nối nhận khách hàng tiềm năng | Ghi | `POST /order-sheets/integrations/:integrationId/leads/test` | Khả dụng | Chưa xác minh UI |
| `omni-inbox.leads.create` | Tạo khách tiềm năng | Ghi | `POST /omni-inbox/leads` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.leads.export-google-sheets` | Gửi các khách tiềm năng đã chọn sang Google Sheets | Ghi | `POST /omni-inbox/leads/export-google-sheets` | Khả dụng | UI không có / đang ẩn |
| `omni-inbox.leads.list` | Tra cứu khách tiềm năng | Đọc | `GET /omni-inbox/leads` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.leads.update` | Cập nhật khách tiềm năng | Ghi | `PATCH /omni-inbox/leads/:id` | Khả dụng | Có quy trình nguồn |
| `api.get.e30354974a18d912` | Xem khách tiềm năng | Đọc | `GET /omni-inbox/leads/:id` | Khả dụng | Có quy trình nguồn |
| `api.get.d89b9a22f3011fb5` | Xem khách hàng tiềm năng từ bảng đơn hàng | Đọc | `GET /order-sheets/integrations/:integrationId/leads` | Khả dụng | Chưa xác minh UI |
| `api.put.fa5a4973ae409caa` | Cập nhật thông tin nhận khách hàng tiềm năng từ bảng đơn hàng | Ghi | `PUT /order-sheets/integrations/:integrationId/leads` | Khả dụng | Chưa xác minh UI |

Action liên quan, đã liệt kê ở nhóm chính khác: `api.get.06681c767355ea2d`.

#### 4. Liên kết hồ sơ nghiệp vụ

Chức năng: Chuyển/liên kết lead với học viên, lao động hoặc bệnh nhân đúng loại.

Ví dụ: “Liên kết LEAD-QA với hồ sơ học viên.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.leads.link-patient` | Liên kết khách tiềm năng với bệnh nhân | Ghi | `POST /omni-inbox/leads/:id/module-sync` | Khả dụng | Chưa xác minh UI |
| `omni-inbox.leads.link-student` | Liên kết khách tiềm năng với học viên | Ghi | `POST /omni-inbox/leads/:id/module-sync` | Khả dụng | Chưa xác minh UI |
| `omni-inbox.leads.link-worker` | Liên kết khách tiềm năng với người lao động | Ghi | `POST /omni-inbox/leads/:id/module-sync` | Khả dụng | Chưa xác minh UI |

#### 5. AI trả lời hộp thư

Chức năng: Quản lý cấu hình, bật lại AI, xem log và đánh giá/thử câu trả lời.

Ví dụ: “Xem phản hồi AI gần đây của hộp thư.”

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.account.ai-config.update` | Cập nhật cấu hình trợ lý AI cho tài khoản nhắn tin | Ghi | `PATCH /omni-inbox/accounts/:id/ai-config` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.ai-reply.test` | Thử câu trả lời của trợ lý AI | Ghi | `POST /gemini/test-reply` | Khả dụng | Chưa xác minh UI |
| `omni-inbox.ai-reply-log.feedback.update` | Đánh giá chất lượng phản hồi AI | Ghi | `PATCH /gemini/ai-reply-logs/:id/feedback` | Khả dụng | Chưa xác minh UI |
| `omni-inbox.ai-reply-logs.list` | Tra phản hồi gần đây của trợ lý hộp thư | Đọc | `GET /gemini/ai-reply-logs` | Khả dụng | Chưa xác minh UI |
| `omni-inbox.facebook-conversation.resume-ai` | Bật lại trợ lý AI cho hội thoại Facebook | Ghi | `POST /facebook/messenger/conversations/:recipientId/resume-ai` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.tiktok-conversation.resume-ai` | Bật lại trợ lý AI cho hội thoại TikTok | Ghi | `POST /tiktok/messenger/conversations/:conversationId/resume-ai` | Khả dụng | Có quy trình nguồn |
| `omni-inbox.zalo-conversation.resume-ai` | Bật lại trợ lý AI cho hội thoại Zalo | Ghi | `POST /zalo/conversations/:recipientId/resume-ai` | Khả dụng | Có quy trình nguồn |

#### 6. Tài khoản nhắn tin — bổ sung

Chức năng: Tra danh sách tài khoản/kênh nhắn tin.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.account.list` | Tra cứu tài khoản nhắn tin | Đọc | `GET /omni-inbox/accounts` | Khả dụng | Có quy trình nguồn |

#### 7. Thư viện ảnh sản phẩm dùng khi tư vấn — bổ sung

Chức năng: Xem, kiểm tra và cập nhật cấu hình thư viện sản phẩm.

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.product-catalog.config` | Xem cấu hình thư viện ảnh sản phẩm | Đọc | `GET /company-cake-catalog` | Khả dụng | Chưa xác minh UI |
| `marketing.product-catalog.config.test` | Kiểm tra thư viện ảnh sản phẩm | Ghi | `POST /company-cake-catalog/test` | Khả dụng | Chưa xác minh UI |
| `marketing.product-catalog.config.update` | Cập nhật cấu hình thư viện ảnh sản phẩm | Ghi | `PUT /company-cake-catalog` | Khả dụng | Chưa xác minh UI |

#### 8. Thanh toán SePay và đặt cọc — bổ sung

Chức năng: Xem/cập nhật cấu hình thanh toán và tỷ lệ đặt cọc.

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.sepay.config` | Xem trạng thái cấu hình thanh toán SePay | Đọc | `GET /company-sepay` | Khả dụng | Chưa xác minh UI |
| `marketing.sepay.config.update` | Cập nhật trạng thái thanh toán và tỷ lệ đặt cọc SePay | Ghi | `PUT /company-sepay` | Khả dụng | Chưa xác minh UI |

#### 9. Thông báo đơn hàng qua Telegram — bổ sung

Chức năng: Tra và bật/tắt cấu hình báo đơn qua Telegram.

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `marketing.telegram-order.config-status` | Xem trạng thái thông báo đơn hàng qua Telegram | Đọc | `GET /company-telegram-order` | Khả dụng | Chưa xác minh UI |
| `marketing.telegram-order.config.update` | Bật hoặc tắt thông báo đơn hàng qua Telegram | Ghi | `PUT /company-telegram-order` | Khả dụng | Chưa xác minh UI |

#### 10. Ảnh hợp đồng và nhà cung cấp hợp đồng — bổ sung

Chức năng: Tra ảnh hợp đồng của lead, hàng chờ rà soát và nhà cung cấp.

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `omni.contract.providers.list` | Tra cứu nhà cung cấp hợp đồng | Đọc | `GET /omni-inbox/lead-contracts/providers` | Khả dụng | Có quy trình nguồn |
| `api.get.618343e099d57959` | Tra cứu ảnh hợp đồng của khách tiềm năng | Đọc | `GET /omni-inbox/leads/:id/contract-photos` | Khả dụng | Có quy trình nguồn |
| `api.get.ec14b8bc333c1211` | Tra cứu ảnh hợp đồng cần rà soát | Đọc | `GET /omni-inbox/lead-contracts/review` | Khả dụng | Có quy trình nguồn |

#### 11. Hóa đơn viễn thông của lead — bổ sung

Chức năng: Tra các hóa đơn viễn thông gắn với hồ sơ lead.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `api.get.d3b0949a7f9b099b` | Tra cứu hóa đơn viễn thông của khách tiềm năng | Đọc | `GET /omni-inbox/leads/:id/telecom-invoices` | Khả dụng | Có quy trình nguồn |

<a id="module-company-knowledge"></a>
### Kho tri thức — `company-knowledge`

**7 nhóm · 15 action (15 khả dụng, 0 không khả dụng).**

#### 1. Tài liệu tri thức

Chức năng: Tra và xóa tài liệu trong kho tri thức doanh nghiệp.

Ví dụ: “Tìm tài liệu TAI-LIEU-QA trong kho tri thức.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.documents.delete` | Xóa tài liệu khỏi kho tri thức | Ghi | `DELETE /company-knowledge/documents/:id` | Khả dụng | Có quy trình nguồn |
| `company-knowledge.documents.list` | Tra cứu tài liệu kho tri thức doanh nghiệp | Đọc | `GET /company-knowledge/documents` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `company-knowledge.documents.scopes.update`.

Lưu ý: Catalog này có list/delete/update scope, không tự khẳng định có action upload tài liệu qua trợ lý.

#### 2. Phạm vi tài liệu

Chức năng: Cập nhật phạm vi sử dụng tài liệu cho đúng kênh/tài khoản.

Ví dụ: “Đổi phạm vi tài liệu TAI-LIEU-QA.”

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.documents.scopes.update` | Cập nhật phạm vi tài liệu kho tri thức | Ghi | `PATCH /company-knowledge/documents/:id/scopes` | Khả dụng | Có quy trình nguồn |

#### 3. Tìm kiếm tri thức

Chức năng: Thử truy xuất nội dung liên quan từ kho.

Ví dụ: “Thử tìm nội dung liên quan đến CHU-DE-QA.”

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.test-search` | Thử tìm kiếm trong kho tri thức | Ghi | `POST /company-knowledge/test-search` | Khả dụng | Có quy trình nguồn |

#### 4. Đề xuất và duyệt FAQ

Chức năng: Phân tích hội thoại, xem đề xuất và duyệt/từ chối FAQ.

Ví dụ: “Liệt kê FAQ đang chờ duyệt.”

Liệt kê đầy đủ **5 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.faq-candidate.approve` | Duyệt FAQ vào kho tri thức | Ghi | `POST /company-knowledge/faq-candidates/:id/approve` | Khả dụng | Có quy trình nguồn |
| `company-knowledge.faq-candidate.delete` | Xóa đề xuất FAQ | Ghi | `DELETE /company-knowledge/faq-candidates/:id` | Khả dụng | Có quy trình nguồn |
| `company-knowledge.faq-candidate.reject` | Bỏ qua FAQ được đề xuất | Ghi | `POST /company-knowledge/faq-candidates/:id/reject` | Khả dụng | Có quy trình nguồn |
| `company-knowledge.faq-candidates.analyze` | Phân tích hội thoại để đề xuất FAQ | Ghi | `POST /company-knowledge/faq-candidates/analyze` | Khả dụng | Có quy trình nguồn |
| `company-knowledge.faq-candidates.list` | Tra cứu câu hỏi thường gặp AI đề xuất | Đọc | `GET /company-knowledge/faq-candidates` | Khả dụng | Có quy trình nguồn |

#### 5. Chất lượng kho tri thức

Chức năng: Xem trạng thái, mâu thuẫn và mô phỏng câu trả lời dùng tri thức.

Ví dụ: “Kiểm tra mâu thuẫn trong kho tri thức.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.conflicts.list` | Kiểm tra mâu thuẫn trong kho tri thức | Đọc | `GET /company-knowledge/conflicts` | Khả dụng | Có quy trình nguồn |
| `company-knowledge.health` | Tra cứu trạng thái kho tri thức AI của công ty | Đọc | `GET /gemini/knowledge-health` | Khả dụng | Có quy trình nguồn |
| `company-knowledge.page-chat.simulate` | Mô phỏng câu trả lời chatbot Page | Ghi | `POST /company-knowledge/simulate-page-chat` | Khả dụng | Có quy trình nguồn |

#### 6. Tài khoản sử dụng kho tri thức — bổ sung

Chức năng: Tra tài khoản mạng xã hội liên quan kho tri thức.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.account.list` | Tra cứu tài khoản mạng xã hội cho kho tri thức | Đọc | `GET /company-knowledge/accounts` | Khả dụng | Có quy trình nguồn |

#### 7. Quản trị và xóa dữ liệu tri thức — bổ sung

Chức năng: Xóa toàn bộ tri thức hoặc kịch bản chăm sóc theo scope được phép.

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.clear-all` | Xóa toàn bộ tài liệu và dữ liệu tri thức AI của công ty | Ghi | `POST /gemini/clear-knowledge` | Khả dụng | Có quy trình nguồn |
| `company-knowledge.scenario.clear` | Xóa kịch bản chăm sóc khách hàng khỏi kho tri thức | Ghi | `DELETE /gemini/customer-service-scenario` | Khả dụng | UI không có / đang ẩn |

Lưu ý: Đây là thao tác xóa dữ liệu, khác việc bỏ một nội dung trong cấu hình tài khoản; không dùng thay thế hai phạm vi cho nhau.

<a id="module-legal-reference"></a>
### Văn bản pháp luật — `legal-reference`

**4 nhóm · 8 action (8 khả dụng, 0 không khả dụng).**

#### 1. Tra cứu văn bản

Chức năng: Tìm theo danh mục hoặc nội dung văn bản pháp lý.

Ví dụ: “Tìm văn bản liên quan CHU-DE-QA.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `legal.document.list` | Tra cứu danh mục văn bản pháp lý | Đọc | `GET /legal-reference/documents` | Khả dụng | Có quy trình nguồn |
| `legal.document.search` | Tìm nội dung trong kho văn bản pháp lý | Đọc | `POST /legal-reference/search` | Khả dụng | Có quy trình nguồn |

#### 2. Hỏi đáp từ văn bản

Chức năng: Giải đáp dựa trên kho văn bản và phạm vi được chọn.

Ví dụ: “Giải thích nội dung văn bản đã chọn.”

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `legal.document.answer` | Giải đáp từ kho văn bản pháp lý | Đọc | `POST /legal-reference/answer` | Khả dụng | Có quy trình nguồn |

Lưu ý: Đây là khả năng đăng ký trong catalog, không phải xác nhận tính đúng của kết luận pháp lý.

#### 3. Đồng bộ kho pháp lý

Chức năng: Xem sức khỏe kho và khởi động đồng bộ khi được cấp quyền.

Ví dụ: “Xem tình trạng kho văn bản pháp lý.”

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `legal.repository.status` | Xem tình trạng kho văn bản | Đọc | `GET /legal-reference/health` | Khả dụng | Có quy trình nguồn |
| `legal.repository.sync` | Đồng bộ kho văn bản pháp lý | Ghi | `POST /legal-reference/sync` | Khả dụng | Có quy trình nguồn |

#### 4. Rà soát và duyệt văn bản

Chức năng: Tra mục chờ rà soát, sửa nội dung và quyết định duyệt/từ chối.

Ví dụ: “Liệt kê văn bản đang chờ rà soát.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `legal.review.content.update` | Sửa nội dung văn bản đang rà soát | Ghi | `POST /legal-reference/review-queue/:id/content` | Khả dụng | Có quy trình nguồn |
| `legal.review.decision` | Duyệt hoặc từ chối văn bản rà soát | Ghi | `POST /legal-reference/review-queue/:id/decision` | Khả dụng | Có quy trình nguồn |
| `legal.review.list` | Tra cứu văn bản chờ rà soát | Đọc | `GET /legal-reference/review-queue` | Khả dụng | Có quy trình nguồn |

<a id="module-quotation"></a>
### Báo giá — `quotation`

**10 nhóm · 60 action (60 khả dụng, 0 không khả dụng).**

#### 1. Bảng giá

Chức năng: Quản lý sản phẩm, giá và các tệp bảng giá đã nhập.

Ví dụ: “Thêm DICH-VU-QA vào bảng giá.”

Liệt kê đầy đủ **10 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `quotation.catalog.bulk` | Cập nhật hàng loạt sản phẩm trong bảng giá Báo giá | Ghi | `POST /quotation/catalog/bulk` | Khả dụng | Có quy trình nguồn |
| `quotation.catalog.create` | Thêm sản phẩm vào bảng giá Báo giá | Ghi | `POST /quotation/catalog` | Khả dụng | Có quy trình nguồn |
| `quotation.catalog.delete` | Xóa sản phẩm trong bảng giá Báo giá | Ghi | `DELETE /quotation/catalog/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.catalog.duplicate` | Nhân bản sản phẩm trong bảng giá Báo giá | Ghi | `POST /quotation/catalog/:id/duplicate` | Khả dụng | Có quy trình nguồn |
| `quotation.catalog.import` | Nhập bảng giá Excel/CSV đã kiểm tra | Ghi | `POST /quotation/catalog/import/confirm` | Khả dụng | Có quy trình nguồn |
| `quotation.catalog.import-preview` | Kiểm tra bảng giá Excel/CSV trước khi nhập | Đọc | `POST /quotation/catalog/import/preview` | Khả dụng | Có quy trình nguồn |
| `quotation.catalog.list` | Tra cứu sản phẩm trong bảng giá Báo giá | Đọc | `GET /quotation/catalog` | Khả dụng | Có quy trình nguồn |
| `quotation.catalog.restore` | Khôi phục sản phẩm đã xóa trong bảng giá Báo giá | Ghi | `POST /quotation/catalog/:id/restore` | Khả dụng | Có quy trình nguồn |
| `quotation.catalog.update` | Cập nhật sản phẩm trong bảng giá Báo giá | Ghi | `PATCH /quotation/catalog/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.price-list.list` | Tra cứu các tệp bảng giá đã nhập | Đọc | `GET /quotation/price-list` | Khả dụng | Có quy trình nguồn |

#### 2. Báo giá khách hàng

Chức năng: Lập, tra, chỉnh sửa báo giá từ bảng giá.

Ví dụ: “Lập báo giá cho KHACH-HANG-QA.”

Liệt kê đầy đủ **11 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `quotation.customer-quote.create` | Lập báo giá khách hàng từ bảng giá | Ghi | `POST /quotation/customer-quotes` | Khả dụng | Có quy trình nguồn |
| `quotation.customer-quote.suggest` | Đề xuất sản phẩm cho báo giá khách hàng | Ghi | `POST /quotation/customer-quotes/suggest` | Khả dụng | Có quy trình nguồn |
| `quotation.quote.delete` | Xóa báo giá hoặc dự toán | Ghi | `DELETE /quotation/quotes/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.quote.detail` | Xem chi tiết báo giá hoặc dự toán | Đọc | `GET /quotation/quotes/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.quote.export-retry` | Thử tạo lại file báo giá hoặc dự toán | Ghi | `POST /quotation/quotes/:id/export/retry` | Khả dụng | Có quy trình nguồn |
| `quotation.quote.list` | Tra cứu báo giá và dự toán | Đọc | `GET /quotation/quotes` | Khả dụng | Có quy trình nguồn |
| `quotation.quote.pdf` | Xuất PDF báo giá đã duyệt | Đọc | `GET /quotation/quotes/:id/pdf` | Khả dụng | UI không có / đang ẩn |
| `quotation.quote.recalculate` | Tính lại bằng AI báo giá hoặc dự toán | Ghi | `POST /quotation/quotes/:id/recalculate` | Khả dụng | UI không có / đang ẩn |
| `quotation.quote.reject` | Trả lại báo giá hoặc dự toán | Ghi | `POST /quotation/quotes/:id/reject` | Khả dụng | Có quy trình nguồn |
| `quotation.quote.submit-review` | Gửi duyệt báo giá hoặc dự toán | Ghi | `POST /quotation/quotes/:id/submit-review` | Khả dụng | UI không có / đang ẩn |
| `quotation.quote.update` | Cập nhật hoặc bổ sung báo giá, dự toán | Ghi | `PATCH /quotation/quotes/:id` | Khả dụng | Có quy trình nguồn |

#### 3. Dự toán và ngân sách

Chức năng: Nhận/phân tích yêu cầu và lập phương án theo ngân sách.

Ví dụ: “Đề xuất dự toán theo ngân sách đã nêu.”

Liệt kê đầy đủ **12 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `quotation.budget.answer` | Trả lời câu hỏi của phương án ngân sách | Ghi | `PATCH /quotation/budget-plans/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.budget.assumption` | Xác nhận hoặc sửa giả định của phương án ngân sách | Ghi | `PATCH /quotation/budget-plans/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.budget.create` | Đề xuất phương án dự toán theo ngân sách | Ghi | `POST /quotation/budget-plans/suggest` | Khả dụng | Có quy trình nguồn |
| `quotation.budget.list` | Tra cứu phương án dự toán theo ngân sách | Đọc | `GET /quotation/budget-plans` | Khả dụng | Có quy trình nguồn |
| `quotation.budget.missing` | Bổ sung hạng mục còn thiếu vào phương án ngân sách | Ghi | `PATCH /quotation/budget-plans/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.budget.quantity` | Xác nhận số lượng sản phẩm trong phương án ngân sách | Ghi | `PATCH /quotation/budget-plans/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.budget.recalculate` | Tính lại phương án dự toán theo ngân sách | Ghi | `PATCH /quotation/budget-plans/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.estimate.create` | Lập dự toán từ yêu cầu đã phân tích | Ghi | `POST /quotation/quotes` | Khả dụng | Có quy trình nguồn |
| `quotation.estimate.from-customer` | Lập dự toán từ báo giá khách hàng | Ghi | `POST /quotation/quotes/from-customer` | Khả dụng | Có quy trình nguồn |
| `quotation.request.analyze` | Phân tích yêu cầu lập dự toán bằng AI | Ghi | `POST /quotation/quote-requests/:id/analyze` | Khả dụng | UI không có / đang ẩn |
| `quotation.request.create` | Tạo yêu cầu lập dự toán | Ghi | `POST /quotation/quote-requests` | Khả dụng | UI không có / đang ẩn |
| `quotation.request.list` | Tra cứu yêu cầu lập dự toán | Đọc | `GET /quotation/quote-requests` | Khả dụng | UI không có / đang ẩn |

Action liên quan, đã liệt kê ở nhóm chính khác: `quotation.budget.export`.

#### 4. Duyệt báo giá/dự toán

Chức năng: Duyệt chứng từ đã chuẩn bị, theo phiên bản và quyền.

Ví dụ: “Duyệt báo giá BAO-GIA-QA.”

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `quotation.quote.approve` | Duyệt báo giá hoặc dự toán | Ghi | `POST /quotation/quotes/:id/approve` | Khả dụng | Có quy trình nguồn |

#### 5. Hợp đồng báo giá

Chức năng: Lập hợp đồng từ dự toán đã duyệt và quản lý vòng đời hợp đồng.

Ví dụ: “Tạo hợp đồng từ dự toán DU-TOAN-QA đã duyệt.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `quotation.contract.create` | Tạo hợp đồng từ dự toán đã duyệt | Ghi | `POST /quotation/contracts` | Khả dụng | Có quy trình nguồn |
| `quotation.contract.detail` | Xem chi tiết hợp đồng Báo giá | Đọc | `GET /quotation/contracts/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.contract.export` | Xuất file hợp đồng | Đọc | `GET /quotation/contracts/:id/file` | Khả dụng | Có quy trình nguồn |
| `quotation.contract.list` | Tra cứu hợp đồng trong Báo giá | Đọc | `GET /quotation/contracts` | Khả dụng | Có quy trình nguồn |
| `quotation.contract.sign` | Xác nhận đã ký hợp đồng Báo giá | Ghi | `POST /quotation/contracts/:id/sign` | Khả dụng | Có quy trình nguồn |
| `quotation.contract.update` | Cập nhật hợp đồng Báo giá đang nháp | Ghi | `PATCH /quotation/contracts/:id` | Khả dụng | Có quy trình nguồn |

#### 6. Nghiệm thu

Chức năng: Lập, sửa và hoàn tất biên bản nghiệm thu từ hợp đồng đã ký.

Ví dụ: “Lập nghiệm thu cho HOP-DONG-QA.”

Liệt kê đầy đủ **7 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `quotation.acceptance.complete` | Hoàn tất biên bản nghiệm thu | Ghi | `POST /quotation/acceptance-records/:id/complete` | Khả dụng | Có quy trình nguồn |
| `quotation.acceptance.create` | Lập biên bản nghiệm thu từ hợp đồng đã ký | Ghi | `POST /quotation/acceptance-records` | Khả dụng | Có quy trình nguồn |
| `quotation.acceptance.detail` | Xem chi tiết biên bản nghiệm thu | Đọc | `GET /quotation/acceptance-records/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.acceptance.export` | Xuất file biên bản nghiệm thu | Đọc | `GET /quotation/acceptance-records/:id/file` | Khả dụng | Có quy trình nguồn |
| `quotation.acceptance.list` | Tra cứu biên bản nghiệm thu | Đọc | `GET /quotation/acceptance-records` | Khả dụng | Có quy trình nguồn |
| `quotation.acceptance.settlement` | Xuất file quyết toán nghiệm thu | Đọc | `GET /quotation/acceptance-records/:id/settlement/file` | Khả dụng | UI không có / đang ẩn |
| `quotation.acceptance.update` | Cập nhật biên bản nghiệm thu đang nháp | Ghi | `PATCH /quotation/acceptance-records/:id` | Khả dụng | Có quy trình nguồn |

#### 7. Xuất tài liệu

Chức năng: Xuất, theo dõi và tải file báo giá/hợp đồng/nghiệm thu.

Ví dụ: “Xuất file hợp đồng HOP-DONG-QA.”

Liệt kê đầy đủ **9 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `quotation.budget.export` | Xuất file phương án ngân sách | Đọc | `GET /quotation/budget-plans/:id/export` | Khả dụng | Có quy trình nguồn |
| `quotation.export.latest` | Xem tiến độ và file xuất mới nhất của chứng từ | Đọc | `GET /quotation/generated-export-files/latest` | Khả dụng | Có quy trình nguồn |
| `quotation.file.download` | Tải file đã tạo trong Báo giá | Đọc | `GET /quotation/files/:id/download` | Khả dụng | Có quy trình nguồn |
| `quotation.file.list` | Tra cứu file đã tạo trong Báo giá | Đọc | `GET /quotation/files` | Khả dụng | Có quy trình nguồn |
| `quotation.quote.export` | Xuất file báo giá hoặc dự toán theo mẫu | Đọc | `GET /quotation/quotes/:id/export` | Khả dụng | Có quy trình nguồn |
| `quotation.template.delete` | Xóa mẫu tài liệu Báo giá | Ghi | `DELETE /quotation/quote-template/:id` | Khả dụng | Có quy trình nguồn |
| `quotation.template.download` | Tải mẫu tài liệu Báo giá | Đọc | `GET /quotation/quote-template/:id/file` | Khả dụng | Có quy trình nguồn |
| `quotation.template.list` | Tra cứu mẫu báo giá, dự toán, hợp đồng, nghiệm thu | Đọc | `GET /quotation/quote-templates` | Khả dụng | Có quy trình nguồn |
| `quotation.template.update` | Chuyển loại mẫu tài liệu Báo giá | Ghi | `PATCH /quotation/quote-template/:id/category` | Khả dụng | Có quy trình nguồn |

Action liên quan, đã liệt kê ở nhóm chính khác: `quotation.acceptance.export`, `quotation.contract.export`.

#### 8. Tổng quan báo giá — bổ sung

Chức năng: Xem dashboard/tổng quan của phân hệ Báo giá.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `quotation.overview` | Xem tổng quan Báo giá | Đọc | `GET /quotation/overview` | Khả dụng | Chưa xác minh UI |

#### 9. Thông tin bên bán — bổ sung

Chức năng: Xem và cập nhật thông tin bên bán dùng trên chứng từ.

Liệt kê đầy đủ **2 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `quotation.settings.list` | Xem thông tin bên bán trong Báo giá | Đọc | `GET /quotation/settings` | Khả dụng | Chưa xác minh UI |
| `quotation.settings.update` | Cập nhật thông tin bên bán trong Báo giá | Ghi | `PUT /quotation/settings` | Khả dụng | Chưa xác minh UI |

#### 10. Hạn mức sử dụng Báo giá — bổ sung

Chức năng: Xem hạn mức hiện có của phân hệ.

Liệt kê đầy đủ **1 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `quotation.usage` | Xem hạn mức sử dụng Báo giá | Đọc | `GET /quotation/usage` | Khả dụng | Chưa xác minh UI |

<a id="module-healthcare"></a>
### Quản lý y tế — `healthcare`

**6 nhóm · 28 action (28 khả dụng, 0 không khả dụng).**

#### 1. Hồ sơ bệnh nhân

Chức năng: Tạo, tra, sửa và xóa hồ sơ cùng bước xem ảnh hưởng khi xóa.

Ví dụ: “Tạo bệnh nhân BENH-NHAN-QA.”

Liệt kê đầy đủ **6 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `healthcare.patient.bulk-delete` | Xóa bệnh nhân và dữ liệu y tế liên quan | Ghi | `POST /healthcare/patients/bulk-delete` | Khả dụng | Có quy trình nguồn |
| `healthcare.patient.bulk-delete-preview` | Xem dữ liệu liên quan trước khi xóa bệnh nhân | Đọc | `POST /healthcare/patients/bulk-delete-preview` | Khả dụng | Có quy trình nguồn |
| `healthcare.patient.create` | Tạo bệnh nhân | Ghi | `POST /healthcare/patients` | Khả dụng | Có quy trình nguồn |
| `healthcare.patient.detail` | Xem hồ sơ bệnh nhân | Đọc | `GET /healthcare/patients/:id` | Khả dụng | Có quy trình nguồn |
| `healthcare.patient.list` | Tra cứu bệnh nhân | Đọc | `POST /healthcare/patients/search` | Khả dụng | Có quy trình nguồn |
| `healthcare.patient.update` | Cập nhật bệnh nhân | Ghi | `PATCH /healthcare/patients/:id` | Khả dụng | Có quy trình nguồn |

#### 2. Lượt khám

Chức năng: Ghi nhận, tra, cập nhật lượt khám và xem báo cáo bệnh viện đã nhập.

Ví dụ: “Tạo lượt khám cho BENH-NHAN-QA.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `healthcare.visit.create` | Tạo lượt khám | Ghi | `POST /healthcare/visits` | Khả dụng | Có quy trình nguồn |
| `healthcare.visit.list` | Tra cứu lượt khám | Đọc | `POST /healthcare/visits/search` | Khả dụng | Có quy trình nguồn |
| `healthcare.visit.report` | Xem phiếu khám bệnh viện đã nhập | Đọc | `GET /healthcare/visits/:id/report` | Khả dụng | Có quy trình nguồn |
| `healthcare.visit.update` | Cập nhật lượt khám | Ghi | `PATCH /healthcare/visits/:id` | Khả dụng | Có quy trình nguồn |

#### 3. Lịch hẹn khám

Chức năng: Tạo, tra và cập nhật lịch hẹn.

Ví dụ: “Đặt lịch khám cho BENH-NHAN-QA.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `healthcare.appointment.create` | Tạo lịch hẹn khám | Ghi | `POST /healthcare/appointments` | Khả dụng | Có quy trình nguồn |
| `healthcare.appointment.list` | Tra cứu lịch hẹn khám | Đọc | `POST /healthcare/appointments/search` | Khả dụng | Có quy trình nguồn |
| `healthcare.appointment.update` | Cập nhật lịch hẹn khám | Ghi | `PATCH /healthcare/appointments/:id` | Khả dụng | Có quy trình nguồn |

#### 4. Chăm sóc bệnh nhân

Chức năng: Tạo, tra và cập nhật công việc chăm sóc.

Ví dụ: “Tạo công việc chăm sóc BENH-NHAN-QA.”

Liệt kê đầy đủ **4 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `healthcare.care.create` | Tạo công việc chăm sóc bệnh nhân | Ghi | `POST /healthcare/care` | Khả dụng | Có quy trình nguồn |
| `healthcare.care.list` | Tra cứu công việc chăm sóc bệnh nhân | Đọc | `POST /healthcare/care/search` | Khả dụng | Có quy trình nguồn |
| `healthcare.care.update` | Cập nhật công việc chăm sóc bệnh nhân | Ghi | `PATCH /healthcare/care/:id` | Khả dụng | Có quy trình nguồn |
| `healthcare.staff.list` | Tra cứu nhân viên chăm sóc tại chi nhánh | Đọc | `GET /healthcare/staff` | Khả dụng | Có quy trình nguồn |

#### 5. Danh mục y tế

Chức năng: Quản lý bác sĩ, phòng khám và dịch vụ.

Ví dụ: “Tạo danh mục dịch vụ DICH-VU-Y-TE-QA.”

Liệt kê đầy đủ **3 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `healthcare.catalog.create` | Tạo danh mục y tế | Ghi | `POST /healthcare/catalog` | Khả dụng | Có quy trình nguồn |
| `healthcare.catalog.list` | Tra cứu danh mục bác sĩ, phòng khám, dịch vụ | Đọc | `GET /healthcare/catalog` | Khả dụng | Có quy trình nguồn |
| `healthcare.catalog.update` | Cập nhật hoặc ngừng sử dụng danh mục y tế | Ghi | `PATCH /healthcare/catalog/:id` | Khả dụng | Có quy trình nguồn |

#### 6. Nhập Excel y tế

Chức năng: Xem trước, sửa dòng, xác nhận ghi và theo dõi/khôi phục lượt nhập.

Ví dụ: “Kiểm tra tệp Excel bệnh nhân giả lập trước khi nhập.”

Liệt kê đầy đủ **8 action thuộc nhóm chính này**.

| Action ID | Chức năng cụ thể | Đọc/ghi | API / route | Catalog | Đối chiếu UI |
| --- | --- | --- | --- | --- | --- |
| `healthcare.import.detail` | Xem tiến độ và kết quả đợt nhập y tế | Đọc | `GET /healthcare/imports/:id` | Khả dụng | Có quy trình nguồn |
| `healthcare.import.list` | Tra cứu lịch sử nhập Excel y tế | Đọc | `GET /healthcare/imports` | Khả dụng | Có quy trình nguồn |
| `healthcare.import.retry` | Thử lại đợt nhập Excel y tế bị lỗi | Ghi | `POST /healthcare/imports/:id/retry` | Khả dụng | Có quy trình nguồn |
| `healthcare.overview` | Xem tổng quan y tế | Đọc | `GET /healthcare/overview` | Khả dụng | Chưa xác minh UI |
| `healthcare.import.commit` | Xác nhận ghi dữ liệu Excel y tế đã kiểm tra | Ghi | `POST /healthcare/imports/:id/commit` | Khả dụng | Có quy trình nguồn |
| `healthcare.import.preview` | Kiểm tra tệp Excel bệnh nhân, lượt khám hoặc báo cáo bệnh viện | Ghi | `POST /healthcare/imports/preview/:kind` | Khả dụng | Có quy trình nguồn |
| `healthcare.import.rows` | Tra cứu từng dòng dữ liệu nhập y tế | Đọc | `POST /healthcare/imports/:id/rows/search` | Khả dụng | Có quy trình nguồn |
| `healthcare.import.template` | Tải mẫu Excel bệnh nhân hoặc lượt khám | Đọc | `GET /healthcare/imports/template/:kind` | Khả dụng | Có quy trình nguồn |

Lưu ý: Preview và commit là hai action khác nhau. Trong thử nghiệm chưa xác nhận commit dữ liệu thật.

## 6. Chức năng dùng nhiều action và thứ tự kiểm thử

- Học viên còn nợ học phí: `student.list` + `student.payment.list`, quan hệ server `students-with-tuition-debt`, đọc đủ nguồn và tính tiền; không chỉ lọc trạng thái hồ sơ.
- Lao động chưa có hợp đồng: `worker.list` + `worker.labor.contract.list`, quan hệ `workers-without-contracts`. Không tự ghép tên thay định danh.
- Sau tạo: bắt buộc kiểm tra shared completion, bảng kết quả, hỏi trường tùy chọn, đồng ý/bỏ qua và cập nhật đúng hồ sơ vừa tạo.
- Nhóm có nhiều trạng thái phải test chuyển trạng thái và điều kiện tiên quyết: nhập/kiểm kê, lương, đối soát hoa hồng, hợp đồng/nghiệm thu, thu chi. Không gộp thành một case “thêm/sửa/xóa”.

Khi một luồng được chọn theo kế hoạch ưu tiên, lấy các tình huống phù hợp từ thư viện tiêu chí: đủ/thiếu dữ liệu, hồ sơ trùng tên, quyền, xác nhận/sửa/hủy, dữ liệu thay đổi, lỗi API, retry và follow-up. Với đọc/tổng hợp xét thêm phân trang, thiếu nguồn và bộ lọc. Không triển khai toàn bộ tiêu chí cho từng action trong catalog và không đặt một số case cố định cho mỗi module.

Theo phạm vi kiểm thử đã thống nhất trong hội thoại: dùng dữ liệu giả; AI thật phải trong ngân sách đã được phép; ghi/liên lạc/tạo job thật dừng ở xác nhận; phần commit/completion kiểm bằng fixture riêng. Việc sửa tài liệu này không cho phép chạy các tác vụ đó.

## 7. Nguồn, kiểm tra và giới hạn

- Kiểm kê đủ 996/996 action thuộc phạm vi; mỗi action đúng một nhóm chính, không có ID bịa, không cắt ví dụ, không còn bucket otherActionIds chưa phân loại.
- UI theo nguồn: UI không có / đang ẩn: 255; Có quy trình nguồn: 663; Chưa xác minh UI: 78. Đây là phân loại bằng chứng source, không phải số chức năng web đã pass.
- Chưa rà hết mọi control, quyền và nhánh UI của toàn web. 10 mục khoảng trống được ghi rõ nguồn/route; chưa dùng danh sách này làm mẫu số bao phủ.
- Gym và Trợ lý kiến trúc đã loại theo yêu cầu. Không lập backlog hoặc đánh giá thiếu của hai phần này trong đợt này.
- Dashboard, Cài đặt, Quản trị user và Tích hợp là các bề mặt dùng chung, không luôn có module catalog riêng. Action tương ứng nằm ở hr/chat/marketing/omni-inbox; cần đối chiếu theo luồng, không chỉ theo số item sidebar.
- Nhóm cũ trước sửa được giữ tại `docs/archive/chuc-nang-chinh-va-action-tro-ly-erp-129-nhom-2026-11-23.md` để so sánh.
- [Catalog gốc đầy đủ toàn repo](./danh-sach-action-tro-ly-erp-theo-module.md); có chứa phần kiến trúc ngoài phạm vi tài liệu này.
- [Bản ánh xạ JSON](./chuc-nang-chinh-va-action-tro-ly-erp.json) chứa toàn bộ action, nhóm, nguồn UI và các khoảng trống đã rà.
- Báo cáo cũ: [21 ca AI thật](./ket-qua-test-phan-he-khac-va-no-hoc-phi.md), [hồi quy cách trả lời](./cai-thien-giong-dieu-tra-loi-tro-ly-erp.md). Các lần chạy có phạm vi/snapshot riêng, chưa nghiệm thu lại tất cả action.
- Không đổi runtime/production, không gọi AI/API nghiệp vụ/DB. Kiểm tra bằng script tĩnh, không chạy lại test chức năng chỉ để xuất tài liệu.
- Generator: `tmp/assistant-function-map-2026-11-23/build.mjs`; định nghĩa bổ sung: `expand-groups.mjs`, bằng chứng khoảng trống: `web-gaps.mjs`.
