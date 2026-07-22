# Thiết kế điều hướng sơ đồ tổ chức bằng touchpad

## Mục tiêu

Cải thiện thao tác trên sơ đồ tổ chức để người dùng touchpad có thể di chuyển và thu phóng tự nhiên, đồng thời giữ nguyên trải nghiệm hiện tại của người dùng chuột.

## Phạm vi

Thay đổi chỉ áp dụng cho vùng tương tác của sơ đồ trong `src/components/hr/OrgChartTab.tsx`. Không thay đổi cách dựng cây, kéo thả thẻ nhân sự, chọn nhân sự, dữ liệu hoặc API.

## Hành vi tương tác

- Với touchpad, vuốt hai ngón theo chiều ngang hoặc dọc sẽ cuộn vùng chứa để di chuyển sơ đồ.
- Pinch trên touchpad, được trình duyệt biểu diễn bằng wheel kèm phím điều khiển, sẽ thu phóng sơ đồ.
- Với chuột, con lăn không kèm phím điều khiển tiếp tục thu phóng như hiện tại.
- Kéo chuột trái trên nền trống tiếp tục di chuyển sơ đồ.
- Thanh zoom và nút vừa màn hình tiếp tục hoạt động.
- Các thao tác trên nút, trường nhập và thẻ nhân sự không khởi động thao tác kéo nền.

## Nhận diện đầu vào

Wheel event được phân loại bằng đặc điểm của sự kiện:

- `ctrlKey` là pinch/zoom.
- Delta có giá trị nhỏ, độ phân giải cao hoặc có chuyển động ngang được xem là touchpad và dùng để pan.
- Delta theo nấc lớn, chủ yếu theo chiều dọc được xem là con lăn chuột và dùng để zoom.

Việc nhận diện là heuristic vì trình duyệt không cung cấp loại thiết bị wheel trực tiếp. Hàm phân loại sẽ được tách thành helper thuần để có thể kiểm thử độc lập.

## Zoom

Zoom thay đổi tỷ lệ thuận với độ lớn delta thay vì cộng hoặc trừ cố định 5%. Giá trị được kẹp trong giới hạn hiện có từ `0.5` đến `1.5`. Mọi thao tác zoom thủ công sẽ thoát trạng thái vừa màn hình.

Pinch và wheel zoom phải gọi `preventDefault()` để không làm zoom hoặc cuộn trang ngoài ý muốn. Pan bằng touchpad sẽ cập nhật `scrollLeft` và `scrollTop` của vùng sơ đồ, đồng thời ngăn trang cha cuộn khi sơ đồ có thể tiếp tục di chuyển theo hướng đó.

## Hướng dẫn sử dụng

Hiển thị hướng dẫn ngắn, không che nội dung: kéo nền hoặc vuốt hai ngón để di chuyển; dùng con lăn, pinch hoặc thanh zoom để thu phóng. Không thêm chế độ hay công tắc mới.

## Xử lý biên

- Chuẩn hóa `deltaMode` để wheel theo pixel, dòng hoặc trang có độ nhạy hợp lý.
- Bỏ qua delta bằng 0 và bảo vệ giá trị zoom khỏi `NaN`.
- Không thay đổi xử lý Safari hiện có cho phép biến đổi tỷ lệ.
- Khi pan đã chạm biên, cho phép trang cha cuộn theo hướng không còn nội dung để tránh bẫy cuộn.

## Kiểm thử và tiêu chí hoàn thành

- Unit test helper phân loại: pinch, touchpad dọc, touchpad ngang và con lăn chuột.
- Unit test tính zoom: tỷ lệ theo delta và giới hạn `0.5–1.5`.
- Kiểm tra thủ công trên touchpad: vuốt hai ngón pan theo cả hai trục; pinch zoom mượt.
- Kiểm tra thủ công bằng chuột: kéo nền pan; con lăn zoom; nút và thanh zoom hoạt động.
- Xác nhận click và kéo thả thẻ nhân sự không bị ảnh hưởng.
- Chạy kiểm tra TypeScript và bộ test liên quan của dự án.

## Không thuộc phạm vi

- Thay thư viện dựng sơ đồ.
- Thêm minimap, chế độ điều hướng hoặc cài đặt độ nhạy cho người dùng.
- Thay đổi bố cục, màu sắc hoặc dữ liệu sơ đồ tổ chức.
