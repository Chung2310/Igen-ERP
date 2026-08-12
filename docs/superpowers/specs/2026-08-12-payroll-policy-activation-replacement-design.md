# Thiết kế thay thế công thức lương đang áp dụng

## Mục tiêu

Cho phép quản lý áp dụng một công thức lương mới khi thời gian hiệu lực chồng với công thức đang áp dụng, mà không phải tự ngưng công thức cũ trước và không làm mất lịch sử áp dụng.

## Hành vi giao diện

Nút `Áp dụng` trước tiên gửi yêu cầu áp dụng thông thường. Nếu máy chủ trả về `PAYROLL_POLICY_OVERLAP`, giao diện hiển thị popup xác nhận thay thế, gồm:

- Tên và mã công thức mới.
- Danh sách công thức đang áp dụng bị ảnh hưởng.
- Ngày kết thúc dự kiến của từng công thức cũ, hoặc thông báo công thức cũ sẽ được chuyển sang `retired` nếu có cùng ngày bắt đầu.
- Hai hành động `Hủy` và `Xác nhận thay thế`.

Hủy xác nhận không thay đổi dữ liệu. Xác nhận gửi yêu cầu kích hoạt với cờ thay thế rõ ràng; giao diện không tự gọi tuần tự API ngưng và áp dụng.

## Quy tắc nghiệp vụ

- Không có thời gian chồng lấn: kích hoạt công thức mới như hiện tại.
- Công thức cũ bắt đầu trước công thức mới: đặt `effectiveTo` của công thức cũ bằng ngày liền trước `effectiveFrom` của công thức mới và giữ trạng thái `active` để lịch sử vẫn có thể được chọn theo ngày.
- Công thức cũ có cùng ngày bắt đầu với công thức mới: chuyển công thức cũ sang `retired`, vì không tồn tại khoảng hiệu lực hợp lệ để giữ lại.
- Nếu công thức cũ bắt đầu sau công thức mới, công thức cũ cũng được chuyển sang `retired`; việc cắt nó về trước ngày bắt đầu mới sẽ tạo khoảng ngày không hợp lệ.
- Xử lý tất cả công thức active đang chồng lấn, không chỉ công thức đầu tiên.
- Công thức mới chỉ được chuyển từ `draft` sang `active`.
- Các kỳ lương đã chốt không bị tính lại hoặc thay đổi. Kỳ nháp chỉ nhận công thức mới khi người dùng chủ động chạy lại thao tác đồng bộ/tính lương.

## API và tính nguyên tử

Endpoint kích hoạt nhận payload tùy chọn `{ replaceOverlaps: true }`.

- Không có cờ: giữ hành vi hiện tại và trả `PAYROLL_POLICY_OVERLAP` để giao diện xin xác nhận.
- Có cờ: thực hiện việc điều chỉnh các công thức cũ và kích hoạt công thức mới trong một MongoDB transaction/session.
- Mọi truy vấn và cập nhật đều giới hạn theo `companyCode`.
- Nếu bất kỳ cập nhật hoặc audit nào thất bại, transaction được hủy và không có trạng thái dở dang.
- Kiểm tra lại trạng thái và các khoảng chồng lấn bên trong transaction để tránh dữ liệu thay đổi giữa lúc cảnh báo và xác nhận.

Phản hồi lỗi chồng lấn bổ sung metadata công thức bị ảnh hưởng để popup có thể giải thích chính xác, nhưng giữ nguyên mã lỗi `PAYROLL_POLICY_OVERLAP` cho khả năng tương thích.

## Audit

Trong cùng transaction, ghi:

- Một audit cho mỗi công thức cũ với thao tác `truncate_policy` hoặc `retire_overlapping_policy`, gồm trạng thái/khoảng ngày trước và sau.
- Một audit `activate_policy` cho công thức mới, kèm danh sách mã định danh các công thức đã được thay thế.

## Xử lý lỗi

- Nếu công thức mới không còn là bản nháp khi xác nhận, trả `PAYROLL_POLICY_INVALID_STATE`.
- Nếu phiên bản active đã thay đổi trước khi transaction cập nhật, hủy transaction và trả conflict để người dùng tải lại.
- Lỗi API được hiển thị bằng tiếng Việt; danh sách được tải lại sau thao tác thành công hoặc conflict.
- Nút xác nhận bị vô hiệu hóa trong lúc gửi yêu cầu để tránh kích hoạt lặp.

## Kiểm thử

- Unit test tính ngày liền trước và phân loại `truncate`/`retire`.
- Service test kích hoạt không chồng lấn.
- Service test giữ lỗi hiện tại khi chưa có cờ thay thế.
- Service test cắt công thức cũ bắt đầu sớm hơn.
- Service test retire công thức cũ cùng ngày hoặc bắt đầu muộn hơn.
- Service test xử lý nhiều công thức chồng lấn.
- Service test rollback khi một cập nhật hoặc audit thất bại.
- Controller/schema test payload `replaceOverlaps` và metadata conflict.
- Component test popup xác nhận, hủy, xác nhận thay thế và trạng thái đang xử lý.
- Chạy lại kiểm thử vòng đời công thức lương và typecheck toàn dự án.

## Tiêu chí hoàn thành

- Người dùng có thể thay thế công thức đang áp dụng bằng một lần xác nhận.
- Không tồn tại hai công thức active có khoảng hiệu lực chồng nhau sau thao tác.
- Lịch sử công thức cũ được giữ lại khi có một khoảng ngày hợp lệ.
- Thao tác có tính nguyên tử và có audit đầy đủ.
- Không tự động thay đổi kết quả kỳ lương đã chốt hoặc tự tính lại kỳ nháp.
