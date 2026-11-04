# Phong cách giao diện Nhân sự — mẫu áp dụng cho các phân hệ ERP

Tài liệu này ghi lại những quyết định thị giác đã được chấp nhận ở phân hệ Nhân sự. Dùng nó khi thiết kế phần **nội dung nghiệp vụ** của phân hệ khác. Các token nền tảng và quy tắc theme vẫn lấy từ [DESIGN.md](DESIGN.md); header và sidebar dùng các component điều hướng chung hiện có.

## 1. Tinh thần giao diện

- Sáng, gọn, có thứ bậc rõ ràng. Người dùng nhận ra tên trang, bộ lọc, hành động chính và dữ liệu quan trọng ngay khi nhìn lướt.
- Nền trắng là nơi đọc và thao tác. Màu rực rỡ nằm ở những vùng có ý nghĩa: hành động chính, trạng thái, thống kê hoặc một ô minh họa nhỏ.
- Ưu tiên mật độ thông tin hữu ích. Một dòng công cụ có trật tự và một card đủ dữ liệu tốt hơn nhiều card trang trí hoặc khoảng trống lớn không có mục đích.
- Hình minh họa 2D đơn giản, gắn với nghiệp vụ và giữ vai trò phụ; dữ liệu luôn là trọng tâm.

## 2. Nền, màu chữ và đường viền

| Vai trò | Cách dùng | Token / màu hiện hành |
|---|---|---|
| Nền trang | Tạo lớp nền rất sáng sau các panel | `bg-surface` / `#f6f8fd` |
| Panel và card đọc dữ liệu | Trắng sạch, không phủ xanh hoặc xám đậm | `bg-surface-container-lowest` / `#ffffff` |
| Chữ chính | Tên, giá trị, nhãn quan trọng | `text-on-surface` / `#071629` |
| Chữ phụ | Mô tả, ngày, metadata | `text-on-surface-variant` / `#475569` |
| Viền phân nhóm | Chia nhóm bằng nét mảnh, không dùng đổ bóng dày | `border-outline-variant` / `#d8e2f0` |
| Hành động chính | Xanh thương hiệu | `bg-primary` / `#00adfc`, chữ `text-on-primary` |

Đây là các token ngữ nghĩa trong `src/index.css`. Khi chuyển style sang phân hệ khác, dùng token trước; chỉ dùng màu cố định cho trạng thái hoặc hình minh họa có ý nghĩa riêng. Chế độ tối tiếp tục đi theo token theme, không lấy nền trắng làm giá trị cố định cho toàn bộ màn hình.

## 3. Hình khối và nhịp bố cục

- Panel nội dung và card có viền **1 px**, bo góc nhìn xa gần như vuông. Trong vùng Nhân sự, các panel có viền được chuẩn hóa về **6 px**; bóng chỉ đủ tách card khỏi nền (`0 1px 2px rgb(15 23 42 / 6%)`). Nguồn: [hr-tab.css](src/pages/hr-tab.css).
- Dùng khoảng cách bên trong đủ thoáng để đọc, nhưng không kéo card cao chỉ để lấp chỗ. Các danh sách và lưới thường dùng khoảng cách khoảng **12 px** giữa mục; thanh công cụ gọn hơn card nội dung.
- Ở desktop, tiêu đề, bộ lọc và hành động cùng một vùng đầu trang. Khi không đủ chỗ, cho chúng xuống dòng theo nhóm; không ép một hàng gây tràn ngang.
- Lưới card phải tận dụng chiều rộng thực tế. Ví dụ Chi nhánh dùng tối đa ba cột ở `xl`, bốn cột ở `2xl`; thẻ khóa học được bố trí để desktop hiển thị ít nhất ba mục trên một hàng khi đủ rộng.
- Khi có nhiều nhóm nghiệp vụ như Bảng lương, dùng **tab ngang dưới tiêu đề** để chỉ hiện một nhóm tại một thời điểm. Tab đang chọn có gạch chân xanh; tránh dồn tất cả nhóm thành một trang dài.
- Bảng dữ liệu dùng header nền sáng, chữ phụ, đường kẻ hàng mảnh và số liệu dễ quét. Dữ liệu dài dùng `truncate` hoặc `line-clamp` và giữ tên đầy đủ trong `title` khi cần.

## 4. Thứ bậc nội dung của một màn

1. **Tiêu đề:** ngắn, rõ nghiệp vụ; dùng `HrPageTitle` hoặc cỡ chữ tương đương, khoảng `text-lg font-semibold`.
2. **Thao tác:** tìm kiếm và bộ lọc gần dữ liệu; hành động chính nằm cuối hàng, dùng nút xanh. Các thao tác phụ dùng viền hoặc nút biểu tượng.
3. **Tổng quan:** chỉ hiện số liệu khi giúp quyết định hoặc lọc nhanh. Card thống kê có nhãn nhỏ, số lớn hơn và icon hỗ trợ.
4. **Nội dung chính:** một bảng hoặc lưới card với cấp thông tin nhất quán giữa các mục.
5. **Trạng thái rỗng:** một thông báo rõ, hình minh họa xám vừa đủ và hành động tiếp theo khi có thể thao tác.

## 5. Card nghiệp vụ

**Công thức chung:** nền trắng + viền mảnh + bo nhẹ + tên đậm vừa + metadata nhỏ + hành động đặt ở vị trí ổn định. Đừng để icon hoặc dải màu chiếm nhiều diện tích hơn thông tin chính.

- **Chi nhánh:** một dải minh họa hẹp ở trái, tên và mã ở trên, địa chỉ cùng hành động bên dưới. Dải màu gradient sáng thay đổi ổn định theo định danh; hình 2D phản ánh loại hình doanh nghiệp nếu biết, dùng hình chung khi có nhiều loại hình. Nguồn: [BranchManagementTab.tsx](src/components/settings/BranchManagementTab.tsx), [BranchManagementTab.css](src/components/settings/BranchManagementTab.css).
- **Đào tạo:** hình minh họa 2D nhỏ ở trái theo phân loại khóa học; bên phải là tên, loại, ngày, người tạo và tiến độ. Nút hành động chính cùng kích cỡ giữa các card và dùng nhãn ngắn. Phân loại mới vẫn có hình mặc định phù hợp. Nguồn: [TrainingTab.tsx](src/components/hr/TrainingTab.tsx), [TrainingCourseCardArtwork.tsx](src/components/hr/TrainingCourseCardArtwork.tsx).
- **Quy trình:** danh sách gọn để nhìn nhiều quy trình cùng lúc; tên, số bước và hành động là dữ liệu cần thấy trước. Dùng bảng khi cần so sánh nhiều trường. Sơ đồ chi tiết mở riêng; vùng sơ đồ tận dụng chiều rộng, không lồng nhiều card rỗng. Nguồn: [WorkflowTab.tsx](src/components/hr/WorkflowTab.tsx).
- **Giao việc:** cột có nền rất nhạt, thẻ công việc **trắng**, viền trái trạng thái **2 px**. Trong card: tên → nhãn/dự án → hạn → ưu tiên, KPI, người phụ trách. Tên và nhãn dài rút gọn bằng dấu ba chấm; rê chuột không đổi màu tên. Nguồn: [KanbanTab.tsx](src/components/hr/KanbanTab.tsx).

## 6. Màu nhấn và gradient

Gradient dùng để tạo cảm giác tươi sáng ở **một vùng nhỏ có chủ đích**, không phủ lên toàn bộ panel. Các card thống kê Phòng ban dùng một lớp sáng trắng rất nhẹ trên nền gradient chéo; nhãn cột Kanban dùng cùng cách phối. Nguồn: [HrDepartmentManager.css](src/components/hr/HrDepartmentManager.css), [KanbanTab.css](src/components/hr/KanbanTab.css).

| Ngữ cảnh đã dùng | Dải màu tham khảo |
|---|---|
| Thống kê tím | `#7950e9` → `#6247e1` |
| Thống kê xanh dương | `#4269f0` → `#2a60eb` |
| Thống kê cyan | `#0b92be` → `#06b2e6` |
| Thống kê cam | `#d85c27` → `#f47835` |
| Hoàn thành ở Kanban | `#169b63` → `#2bbb81` |

Khi áp dụng sang phân hệ mới, chọn màu theo **ý nghĩa dữ liệu** và độ tương phản chữ, không gán ngẫu nhiên mỗi card một màu. Một nhóm thẻ cùng vai trò dùng cùng hệ màu; các trạng thái khác nhau cần phân biệt được cả bằng chữ, biểu tượng hoặc vị trí. Minh họa card có thể dùng các cặp cyan, xanh dương, cam, xanh ngọc, tím, hồng sáng từ [cardArtworkTones.ts](src/components/hr/cardArtworkTones.ts). Màu được chọn ổn định theo ID, không đổi mỗi lần tải trang.

## 7. Nút, ô nhập và trạng thái tương tác

- Dùng component và pattern chung trước khi tạo biến thể mới. Nút tạo mới dùng [primaryCreateButtonClass](src/components/common/primaryCreateButton.ts); nút phụ có viền nhẹ và nền trắng.
- Ô tìm kiếm nghiệp vụ có viền `outline-variant`, icon kính lúp ở đầu và viền `primary` khi focus. Tìm kiếm toàn ERP thuộc hàng đầu của sidebar; không thêm ô tìm kiếm lớn vào header.
- Nút chỉ có icon phải có tên truy cập (`aria-label`), trạng thái focus nhìn rõ và vùng bấm đủ rộng. Với các lựa chọn dạng tab/chế độ xem, thể hiện mục đang chọn bằng cả màu và dấu hiệu hình học như gạch chân hoặc nền chọn.
- Trạng thái tải, trống, lỗi và vô hiệu hóa cần giữ chỗ hợp lý trong bố cục; không biến nội dung thành một khoảng trắng khó hiểu.

## 8. Khi áp style này cho phân hệ khác

1. Giữ header và sidebar chung của ERP; thay phần nội dung nghiệp vụ.
2. Bắt đầu từ token nền, chữ và viền của `DESIGN.md`; dựng một khung nội dung trắng, bo nhẹ.
3. Xác định một cấp tiêu đề, một hàng công cụ, một vùng nội dung chính. Chỉ thêm thống kê hoặc tab khi nghiệp vụ thật sự cần.
4. Với từng loại card, chọn **một** sơ đồ thông tin nhất quán và chỉ một vùng màu minh họa/trạng thái. Nếu bảng giúp so sánh tốt hơn, dùng bảng.
5. Kiểm tra màn hình hẹp, hover, focus, dark mode, trạng thái rỗng và tên dài trước khi coi style là hoàn chỉnh.

Tài liệu này mô tả **hướng thiết kế đã được duyệt ở Nhân sự**, không yêu cầu các phân hệ khác sao chép nguyên các trường dữ liệu, biểu tượng hay toàn bộ bảng màu của Nhân sự.
