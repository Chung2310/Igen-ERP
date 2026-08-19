# Marketing template drag-drop variables design

## Mục tiêu

Làm cho màn hình soạn nội dung marketing dễ dùng với người không kỹ thuật:

- Người dùng gõ nội dung như văn bản bình thường.
- Các biến động không lộ cú pháp `{{customerName}}`.
- Có danh sách “thẻ thông tin” thân thiện như “Tên khách hàng”, “Tên công ty”, “Mã đơn hàng”.
- Người dùng có thể kéo thả hoặc bấm để chèn thẻ vào cả `Tiêu đề` và `Nội dung`.
- Backend tiếp tục lưu và render bằng token hiện tại để không phải migrate dữ liệu.

## Ngoài phạm vi

- Không đổi chuẩn token backend hiện tại.
- Không mở rộng sang HR celebration trong cùng đợt này.
- Không thay đổi logic preview sample values của backend/service.
- Không thêm template engine mới.

## Hiện trạng

`TemplateEditor` hiện dùng:

- một `input` cho tiêu đề
- một `textarea` cho nội dung
- nhóm nút chèn biến vào vị trí con trỏ

Điểm đau UX:

- Người dùng vẫn phải thấy nội dung chèn ra là `{{customerName}}`, `{{companyName}}`, ...
- Cơ chế “bấm để chèn biến” vẫn mang cảm giác kỹ thuật.
- Không có mô hình kéo thả trực quan cho cả tiêu đề và nội dung.

## Phương án đã cân nhắc

### Phương án A — giữ input/textarea, chỉ đổi nhãn

- Nút chèn biến hiển thị tiếng Việt.
- Trong ô nhập vẫn chèn token text.

Ưu điểm:

- Nhẹ nhất.

Nhược điểm:

- Không đạt mục tiêu kéo thả.
- Token kỹ thuật vẫn lộ trong nội dung.

### Phương án B — rich text cho nội dung, input nâng cao cho tiêu đề

- Nội dung dùng editor giàu tương tác.
- Tiêu đề vẫn là input một dòng với cơ chế chip riêng.

Ưu điểm:

- Giảm độ phức tạp hơn full rich text.

Nhược điểm:

- Hai vùng soạn thảo khác mô hình tương tác.
- Kéo thả “cho cả hai” phải làm hai cách khác nhau.

### Phương án C — editor tokenized cho cả tiêu đề và nội dung

- Cả hai vùng đều là editor hiển thị text thường + chip biến.
- Token được serialize/deseralize sang `{{...}}` khi lưu/đọc.

Ưu điểm:

- Đồng nhất trải nghiệm.
- Đúng yêu cầu kéo thả cả tiêu đề lẫn nội dung.

Nhược điểm:

- Tốn công nhất trong frontend editor.

## Khuyến nghị

Chọn Phương án C.

Lý do:

- Khớp chính xác yêu cầu đã chốt.
- Giữ nguyên backend token nên rủi ro dữ liệu thấp.
- Có thể triển khai theo lớp adapter ở frontend thay vì thay hệ template.

## Thiết kế đề xuất

### 1. Mô hình biến thân thiện

Tạo một registry frontend cho biến marketing:

- `customerName` → `Tên khách hàng`
- `companyName` → `Tên công ty`
- `orderCode` → `Mã đơn hàng`
- `orderTotal` → `Tổng tiền đơn`
- `holidayName` → `Tên dịp lễ`
- `campaignName` → `Tên chiến dịch`
- `lastPurchaseDate` → `Ngày mua gần nhất`
- `inactiveDays` → `Số ngày chưa quay lại`

Mỗi biến có:

- `key`
- `label`
- `sample`
- tập automation type được phép dùng

Backend token vẫn là `{{key}}`.

### 2. Editor interaction model

Mỗi vùng `Tiêu đề` và `Nội dung` được biểu diễn bằng editor tokenized:

- text bình thường
- token-chip inline đại diện cho biến

Chip hiển thị:

- nhãn tiếng Việt
- nền màu nhẹ để phân biệt khỏi text thường
- không cho sửa text bên trong chip

Hành vi:

- gõ bình thường tạo text node
- kéo thả thẻ thông tin vào editor tạo chip node tại vị trí drop
- click thẻ thông tin chèn vào vị trí con trỏ hiện tại
- backspace/delete xóa cả chip như một đơn vị
- caret có thể đi qua trước/sau chip

### 3. Hai vùng soạn thảo

#### Tiêu đề

- Vẫn hiển thị một dòng về mặt UX
- Dùng editor tokenized nhưng giới hạn block đơn
- Không hỗ trợ xuống dòng

#### Nội dung

- Editor tokenized nhiều dòng
- Hỗ trợ xuống dòng và đoạn văn đơn giản
- Chưa thêm toolbar rich text khác trong đợt này

### 4. Danh sách “Thẻ thông tin”

Đặt cạnh hoặc ngay dưới khu vực editor:

- hiển thị theo automation type hiện tại
- có thể drag
- có thể click để chèn
- tooltip mẫu preview ngắn, ví dụ “Ví dụ: Chị Nguyễn Thu Lan”

Mục tiêu là người dùng hiểu “đây là thông tin hệ thống sẽ tự điền”.

### 5. Lưu trữ và chuyển đổi

Frontend cần 2 lớp chuyển đổi:

#### Parse khi mở dữ liệu

Từ:

- `Cảm ơn {{customerName}}`

Thành editor state:

- text `Cảm ơn `
- chip `Tên khách hàng`

#### Serialize khi lưu

Từ editor state:

- text `Cảm ơn `
- chip `Tên khách hàng`

Thành:

- `Cảm ơn {{customerName}}`

Nếu gặp token backend không có trong registry:

- hiển thị fallback dạng text thô để tránh mất dữ liệu
- không tự xoá hoặc phá template cũ

### 6. Preview

Preview tiếp tục dùng sample values hiện có.

Luồng:

- serialize editor state → template string chứa token thật
- chạy `fillSampleValues(...)`
- render preview

Như vậy không cần đổi service preview hiện tại.

### 7. Khả năng tương thích dữ liệu cũ

Template cũ đã lưu với `{{companyName}}`, `{{customerName}}`, ... phải mở lại được ngay:

- editor parse token cũ thành chip mới
- không cần migration dữ liệu

Đây là yêu cầu bắt buộc để rollout an toàn.

## Chi tiết kỹ thuật đề xuất

### Frontend modules

Tách `TemplateEditor` thành các phần:

- `marketingVariableRegistry.ts`
- `marketingTemplateTokenCodec.ts`
- `MarketingVariablePalette.tsx`
- `TokenEditor.tsx`
- `TemplateEditor.tsx` chỉ còn orchestration

### Editor implementation

Không thêm full WYSIWYG nặng ở đợt đầu nếu không cần.

Ưu tiên:

- contenteditable có token spans không editable
- model nội bộ đủ nhỏ để serialize chắc chắn

Điều kiện:

- phải kiểm soát được caret insertion và chip deletion
- test được parse/serialize rõ ràng

Nếu contenteditable gây quá nhiều edge case, fallback sang editor framework nhẹ là chấp nhận được, nhưng chỉ khi giữ nguyên scope và token backend.

## Error handling

- Drag sai vị trí: chèn vào cuối editor đang active
- Không có editor đang active khi click chip: mặc định chèn vào `Nội dung`
- Token lạ từ dữ liệu cũ: giữ nguyên text thô
- Paste text chứa `{{customerName}}`: parser có thể chuyển thành chip khi blur hoặc khi render lại

## Testing

### Unit

- parse token backend thành chip model
- serialize chip model thành token backend
- token lạ được giữ nguyên
- sample preview vẫn thay đúng giá trị

### Component

- render palette với đúng biến theo automation type
- click chip chèn vào tiêu đề
- click chip chèn vào nội dung
- drag chip vào tiêu đề
- drag chip vào nội dung
- mở template cũ có token thật thì hiện chip tiếng Việt
- lưu ra `onChange` vẫn là chuỗi `{{...}}`

### Regression

- thank_you vẫn preview đúng `orderCode`, `orderTotal`
- birthday không hiện biến không liên quan
- holiday và remarketing vẫn giới hạn palette đúng scope

## Rollout

Triển khai trong module Marketing trước:

- `thank_you`
- `birthday`
- `holiday`
- `remarketing`

Không chạm HR celebration trong cùng PR để giảm rủi ro.

## Tiêu chí hoàn thành

- Người dùng không còn thấy `{{companyName}}` trong trải nghiệm soạn nội dung thông thường.
- Có thể kéo hoặc bấm thẻ thông tin để chèn vào cả `Tiêu đề` và `Nội dung`.
- Dữ liệu lưu xuống backend vẫn dùng token hiện tại.
- Preview và backend render không bị thay đổi hành vi.
- Template cũ mở lại được mà không cần migrate dữ liệu.
