# HR celebration email drag-drop variables design

## Mục tiêu

Làm cho phần soạn email chúc mừng nhân sự nội bộ dễ dùng với người không kỹ thuật, theo cùng mô hình đã áp dụng cho marketing:

- Người dùng gõ nội dung như văn bản bình thường.
- Biến động không lộ cú pháp kỹ thuật như `{{employeeName}}`.
- Có danh sách “thẻ thông tin” thân thiện để bấm hoặc kéo-thả vào `Tiêu đề` và `Nội dung`.
- Backend tiếp tục lưu dữ liệu bằng token hiện tại để không phải migrate dữ liệu.
- Giữ nguyên preview, save, history và upload ảnh của tab HR.

## Ngoài phạm vi

- Không đổi API backend của celebration email.
- Không đổi format dữ liệu template lưu trong database.
- Không thay đổi logic gửi email, lịch chạy, hay quyền của module HR celebration.
- Không gộp toàn bộ flow HR và marketing thành một module cấu hình chung trong đợt này.

## Hiện trạng

`src/components/hr/CelebrationEmailTab.tsx` đang có editor riêng:

- tiêu đề là `input`
- nội dung là `contenteditable` đơn giản
- biến được chèn bằng các nút `+ Tên NV`, `+ Tên Cty`, `+ Ngày Lễ`

Điểm đau UX:

- người dùng vẫn phải thấy token kỹ thuật như `{{employeeName}}`
- cách chèn biến còn mang tính kỹ thuật, chưa trực quan
- không có mô hình “thẻ thông tin” đồng nhất với marketing
- logic editor HR đang bị tách riêng, trong khi marketing đã có tokenized editor và variable palette

## Phương án đã cân nhắc

### Phương án A — giữ editor HR riêng, chỉ đổi nhãn hiển thị

Ưu điểm:

- ít sửa nhất

Nhược điểm:

- vẫn giữ logic editor tách biệt
- không giải quyết triệt để vấn đề tái sử dụng
- khó đồng bộ UX với marketing về sau

### Phương án B — copy cơ chế tokenized editor của marketing sang HR

Ưu điểm:

- nhanh hơn so với tổng quát hóa editor dùng chung

Nhược điểm:

- nhân đôi logic parse/serialize, palette, drag-drop
- tăng chi phí bảo trì

### Phương án C — tổng quát hóa editor marketing thành editor dùng chung cho template email

Ưu điểm:

- một chuẩn UX cho cả marketing và HR
- tái sử dụng token codec, palette, drag-drop
- giảm bảo trì dài hạn

Nhược điểm:

- cần chỉnh lại biên của editor hiện có để nhận variable config từ bên ngoài

## Khuyến nghị

Chọn Phương án C.

Lý do:

- đúng với hướng người dùng đã duyệt
- backend không phải đổi
- phần khó nhất đã có nền từ marketing, nên chi phí chủ yếu là tổng quát hóa cấu trúc editor thay vì viết mới

## Thiết kế đề xuất

### 1. Editor template dùng chung

Tách editor hiện tại của marketing thành editor dùng chung cho email template, nhận cấu hình từ ngoài thay vì hard-code theo automation type marketing.

Editor dùng chung nhận tối thiểu:

- `subject`
- `html`
- `variables`
- `disabled`
- `onChange`
- hook upload ảnh tùy chọn cho nội dung

Editor này tiếp tục hỗ trợ:

- hiển thị token thân thiện trong lúc soạn
- click để chèn
- drag-drop để chèn
- preview compatibility thông qua serialize về raw token

### 2. Variable registry riêng cho HR celebration

Tạo registry riêng cho HR celebration để editor dùng chung không phụ thuộc domain marketing.

Biến cần hỗ trợ:

- `employeeName` → `Tên nhân sự`
- `companyName` → `Tên công ty`
- `holidayName` → `Tên ngày lễ`

Phân bố theo template:

- birthday template: `employeeName`, `companyName`
- holiday template: `employeeName`, `companyName`, `holidayName`

Mỗi biến có:

- `key`
- `label`
- `sample`

Backend token vẫn giữ nguyên dạng `{{key}}`.

### 3. Token codec và dữ liệu hiển thị

Frontend cần tiếp tục dùng lớp chuyển đổi giữa:

- raw token lưu trữ: `{{employeeName}}`
- friendly token hiển thị: `[Tên nhân sự]`

Luồng khi mở dữ liệu:

- lấy template raw từ backend
- parse sang nội dung thân thiện để hiển thị trong editor

Luồng khi save hoặc preview:

- serialize nội dung đang soạn về raw token
- gửi raw token qua API hiện tại

Nếu gặp token cũ hoặc token lạ không nằm trong registry:

- giữ nguyên như text thô
- không tự xóa hay phá nội dung cũ

### 4. Áp dụng vào CelebrationEmailTab

Thay `RichTextEditor` hiện tại trong `CelebrationEmailTab` bằng editor dùng chung.

Áp dụng cho cả:

- `birthdayTemplate`
- `holidayTemplate`

Giữ nguyên:

- `companyEmailApi.saveCelebration`
- `companyEmailApi.preview`
- `companyEmailApi.history`
- luồng upload ảnh qua `authService.uploadManagedFile(..., "hr.celebration")`

Upload ảnh vẫn là concern của HR tab; editor dùng chung chỉ nhận callback upload/insertion thay vì tự gắn cứng vào domain marketing.

### 5. Hành vi người dùng

Trong editor HR:

- người dùng gõ văn bản thường như hiện tại
- người dùng thấy danh sách thẻ thông tin dễ hiểu
- bấm thẻ sẽ chèn vào vị trí con trỏ của subject hoặc body
- kéo-thả thẻ sẽ chèn vào đúng vùng thả
- trong editor chỉ thấy nhãn thân thiện, không thấy token kỹ thuật

Với subject:

- vẫn là trải nghiệm một dòng
- không cho xuống dòng

Với body:

- hỗ trợ nhiều dòng
- giữ khả năng chèn ảnh như hiện tại

### 6. Tương thích dữ liệu cũ

Template HR đã lưu từ trước với `{{employeeName}}`, `{{companyName}}`, `{{holidayName}}` phải mở lại được ngay mà không cần migration.

Đây là yêu cầu rollout bắt buộc để tránh làm hỏng cấu hình đã có của khách hàng.

## Error handling

- Nếu click thẻ khi chưa có vùng active, mặc định chèn vào body của template đang mở tương tác gần nhất.
- Nếu drag-drop vào vị trí không xác định rõ, chèn vào cuối vùng editor đích.
- Nếu upload ảnh lỗi, giữ nguyên hành vi toast lỗi hiện tại.
- Nếu preview/save thất bại, payload vẫn là raw token nên hành vi lỗi backend không đổi.

## Testing

### Unit

- parse raw token HR thành friendly token
- serialize friendly token HR thành raw token
- token lạ được giữ nguyên

### Component

- render đúng palette biến cho birthday template
- render đúng palette biến cho holiday template
- click thẻ để chèn vào subject
- click thẻ để chèn vào body
- drag-drop thẻ vào subject
- drag-drop thẻ vào body
- preview/save gửi raw token thay vì friendly label
- upload ảnh vẫn chèn được vào nội dung body

## Rủi ro kỹ thuật

- Editor dùng chung phải không làm vỡ hành vi marketing đã có.
- `CelebrationEmailTab` đang tự quản lý upload ảnh; khi tổng quát hóa editor cần giữ rõ biên trách nhiệm.
- Subject và body có behavior hơi khác nhau; phần refactor phải tránh trộn logic quá mức làm tăng edge case caret/selection.

## Tiêu chí hoàn thành

- Người dùng HR không còn thấy token `{{...}}` trong lúc soạn email chúc mừng.
- Có thể bấm hoặc kéo-thả thẻ thông tin vào cả tiêu đề và nội dung.
- Preview và save của HR vẫn dùng raw token hiện tại.
- Upload ảnh trong nội dung vẫn hoạt động.
- Marketing editor hiện có không bị regression.
