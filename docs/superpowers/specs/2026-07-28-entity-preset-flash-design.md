# Thiết kế loại bỏ nhấp nháy preset giáo dục

## Bối cảnh

Ứng dụng tùy biến phân hệ quản lý theo `entityPreset`, ví dụ `student` cho giáo dục và `worker` cho lao động. Hiện tại nhiều component gọi `useEntityLabel()` độc lập. Mỗi lần gọi hook đều khởi tạo bằng preset mặc định `student` rồi tự gọi API lấy cấu hình.

Sau khi tải lại trang của doanh nghiệp lao động, component cha có thể đã nhận `worker` và bắt đầu render, trong khi các component con mới mount vẫn tạm thời mang giá trị `student`. Vì các component con không đồng loạt chặn render theo `loading`, người dùng có thể nhìn thấy trường hoặc nội dung dành cho Học viên trước khi giao diện chuyển sang Lao động.

## Mục tiêu

- Không hiển thị bất kỳ nội dung giáo dục tạm thời nào khi preset thực tế là `worker`, `candidate` hoặc `customer`.
- Mọi consumer của `useEntityLabel()` dùng cùng một snapshot preset trong cùng một thời điểm.
- Thay đổi preset từ màn Cài đặt hoặc socket phải cập nhật toàn bộ giao diện ngay, không cần reload.
- Nếu sub-tab hiện tại không hợp lệ với preset mới, chuyển ngay về `TỔNG QUAN` và đồng bộ lại URL.
- Giữ nguyên API và cách dùng `useEntityLabel()` tại các component hiện có nếu có thể.

## Các phương án đã cân nhắc

### 1. Shared preset store — lựa chọn

Đưa trạng thái preset, loading và thao tác tải/cập nhật vào một store dùng chung. Hook chỉ đăng ký và đọc snapshot của store. Request đầu tiên được chia sẻ; consumer mount sau nhận ngay snapshot đã phân giải.

Ưu điểm: giải quyết nguyên nhân gốc, ít thay đổi tại hàng loạt consumer, cập nhật realtime nhất quán. Nhược điểm: cần quản lý vòng đời store và tránh request trùng.

### 2. Chặn render tại từng consumer

Mỗi component kiểm tra `entityLabel.loading` trước khi render.

Ưu điểm: thay đổi cục bộ. Nhược điểm: dễ bỏ sót, tiếp tục tạo nhiều request và không bảo đảm các component đổi preset đồng thời.

### 3. Dùng localStorage làm giá trị ban đầu

Khởi tạo hook từ preset lưu cục bộ rồi xác nhận lại bằng API.

Ưu điểm: phản hồi nhanh. Nhược điểm: có thể dùng nhầm preset giữa tenant hoặc sau khi cấu hình được đổi ở nơi khác.

## Thiết kế

### Shared store

Tạo một module store chuyên quản lý:

- snapshot hiện tại gồm `preset` và `loading`;
- danh sách subscriber;
- request tải cấu hình đang chạy để các consumer dùng chung;
- hàm cập nhật preset hợp lệ từ API, sự kiện trình duyệt hoặc socket;
- hàm reset dành cho kiểm thử và khi ngữ cảnh tenant thay đổi nếu luồng hiện tại yêu cầu.

Snapshot ban đầu vẫn ở trạng thái loading. Không consumer nào được xem preset mặc định như dữ liệu đã sẵn sàng. Khi API thành công, store phát một snapshot mới cho mọi subscriber trong cùng lượt cập nhật. Khi API lỗi, store dùng `DEFAULT_ENTITY_PRESET`, đánh dấu hết loading và giữ hành vi fallback hiện có.

`useEntityLabel()` đăng ký store bằng cơ chế subscription phù hợp với React, kích hoạt tải dữ liệu dùng chung và trả về label được suy ra từ snapshot. Listener `entity-label:changed` và `entity_preset_changed` chỉ cập nhật store một lần, thay vì tạo trạng thái riêng cho từng hook instance.

### Đồng bộ sub-tab

`StudentManagementTab` tiếp tục tạo danh sách route từ preset hiện tại. Logic router phải bảo đảm rằng khi route map thay đổi và active sub-tab không còn tồn tại:

1. Giá trị active được chuyển về `TỔNG QUAN`.
2. Tham số `?sub=` được xóa hoặc đổi thành slug Tổng quan trong cùng cập nhật.
3. Nội dung của sub-tab cũ không được render thêm một frame.

Việc xác thực active tab phải xảy ra trong đường render hoặc qua một giá trị active đã được resolve đồng bộ, không dựa duy nhất vào effect chạy sau khi trình duyệt đã paint.

### Luồng dữ liệu

1. Consumer đầu tiên mount và subscribe store.
2. Store bắt đầu một request cấu hình; giao diện cấp cao hiển thị loader.
3. API trả preset thực tế và store publish snapshot.
4. Component cha và mọi component con đọc cùng snapshot. Component con mount sau bước này nhận preset đã có ngay từ lần render đầu.
5. Khi đổi loại hình, response API hoặc socket cập nhật store; toàn bộ consumer render lại đồng thời.
6. Router resolve active sub-tab theo route map mới trước khi render nội dung.

## Xử lý lỗi

- Response preset không hợp lệ: dùng preset mặc định sau khi request hoàn tất.
- API tải cấu hình lỗi: giữ fallback hiện tại là preset mặc định và kết thúc loading để tránh treo màn hình.
- Sự kiện không có preset hợp lệ: tải lại cấu hình qua request dùng chung.
- Nhiều consumer mount đồng thời: chỉ một request được thực hiện.

## Kiểm thử

Thực hiện theo TDD với các ca tối thiểu:

- Nhiều consumer mount đồng thời chỉ gọi API một lần.
- Sau khi store đã phân giải `worker`, consumer mount sau nhận `worker` ngay trong lần render đầu và không từng render label `student`.
- Sự kiện trình duyệt và socket cập nhật tất cả consumer.
- Preset đổi từ `student` sang `worker` khi đang ở tab giáo dục sẽ resolve về Tổng quan, không render nội dung tab cũ.
- Các test hiện có của `useEntityLabel`, route và typecheck vẫn qua.

## Phạm vi ngoài

- Không thay đổi danh sách trường hoặc thuật ngữ riêng của từng preset.
- Không thay đổi API backend hay schema `ModuleSettings`.
- Không dùng localStorage làm nguồn sự thật cho preset.
- Không refactor các module nghiệp vụ không liên quan.
