# Báo cáo câu đầu vào của ma trận trợ lý ERP

## Phạm vi

- Ma trận hội thoại: 4.821 ca trên 736 thao tác thuộc 12 phân hệ.
- Có 745 câu đầu vào khác nhau sau khi gộp các ca lặp.
- Câu chuẩn được lấy trực tiếp từ tiêu đề thao tác trong catalog. Các ca thiếu dữ liệu, điều kiện không hỗ trợ và dữ liệu sai dùng lại câu chuẩn; câu hủy dùng một câu chung.
- Với thao tác có trường ngày giờ, ca probe thêm thời gian giả lập. Hai probe đặc biệt thêm nội dung địa điểm lớp và cấu hình lịch bảng lương.
- Ma trận cô lập một thao tác đã chọn cho mỗi ca; nó kiểm luồng hội thoại, thu thập trường, xác nhận, xử lý API giả lập và replay. Danh sách dưới đây không đo khả năng model tự chọn đúng phân hệ/chức năng từ một câu tự do.
- API, session và bản ghi được giả lập trong bộ test; không có truy cập hoặc ghi dữ liệu ERP thật.

## Các mẫu câu dùng chung trong ma trận diễn giải và kiểm tra trường

Các câu sau được chạy lặp lại trên các thao tác trong phạm vi ma trận:

1. Thực hiện thao tác này.
2. Vui lòng thực hiện thao tác này.
3. Làm theo thao tác này.
4. Hủy yêu cầu này.
5. Thực hiện yêu cầu với đầy đủ điều kiện tôi nêu.

Ma trận còn gửi một JSON không hợp lệ để xác nhận model response bị từ chối. Đây là đầu vào kỹ thuật, không phải câu người dùng.

## Danh sách prompt theo thao tác

`Câu chuẩn` được dùng cho các kịch bản `missing-data`, `unknown-condition`, `invalid-data` và thao tác không khả dụng. `Câu probe` được dùng cho kiểm tra API lỗi/thành công, hủy sau preview và kiểm tra phiên bản cũ. `cancel` luôn gửi `Hủy yêu cầu này`.

### Nhân sự (198 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `employee.list` | Tra cứu nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `employee.create` | Tạo nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `employee.update` | Cập nhật nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `employee.delete` | Xóa tài khoản nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `employee.birthday.next-month` | Báo cáo sinh nhật nhân sự tháng tới | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `employee.count` | Đếm số nhân sự trong công ty hoặc chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `employee.detail` | Xem thông tin chi tiết nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `department.list` | Tra cứu phòng ban | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `department.create` | Tạo phòng ban | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `department.update` | Cập nhật phòng ban | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `department.delete` | Xóa phòng ban | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `department.lookup` | Tra cứu thông tin phòng ban | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `department.employees.list` | Danh sách nhân sự theo phòng ban | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `department.unmanaged.list` | Danh sách phòng ban chưa có quản lý | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `project.list` | Tra cứu dự án | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `project.create` | Tạo dự án | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `project.update` | Cập nhật dự án | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `project.delete` | Xóa dự án | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `task.list` | Tra cứu công việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `task.create` | Tạo công việc | Tạo công việc bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `task.update` | Cập nhật công việc | Cập nhật công việc bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `task.delete` | Xóa công việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `branch.list` | Tra cứu chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `training.list` | Tra cứu khóa đào tạo | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `training.create` | Tạo khóa đào tạo | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `training.update` | Cập nhật khóa đào tạo | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `training.delete` | Xóa khóa đào tạo nội bộ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `branch.create` | Tạo chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `branch.pending.delete` | Hủy chi nhánh chưa thiết lập chủ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `branch.update` | Cập nhật chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `access.permission-catalog.list` | Tra cứu danh mục quyền hệ thống | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `access.permission-catalog.detail` | Xem chi tiết một quyền hệ thống | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `access.role-permissions.save` | Cập nhật phân quyền vai trò | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `access.role-permissions.list` | Tra cứu cấu hình quyền theo vai trò | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `access.role-permissions.detail` | Xem cấu hình quyền của một vai trò | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.today.me` | Tra cứu chấm công hôm nay của tôi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.list` | Tra cứu chấm công nhân sự trong ngày | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.monthly.report` | Tổng hợp chấm công theo tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.d2e63aaeb8682c88` | Tra cứu lần chấm công bị từ chối | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.company.location` | Tra cứu địa điểm và khung giờ chấm công | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.patch.cbf8c2b9d544f837` | Cập nhật địa điểm và khung giờ chấm công | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.d632a938b9c72492` | Tra cứu ca làm việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.4e68581113f1ef79` | Tạo ca làm việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.patch.08411917f1ed9b75` | Cập nhật ca làm việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.delete.39330ed93a819149` | Xóa ca làm việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.efd26957a4dbe889` | Tra cứu phân ca nhân viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.5511b45cf3a736d1` | Phân ca cho nhân viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.5d0d3ea4fc0d9efb` | Tra cứu giờ làm nhân viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.patch.6bc968347283a069` | Cập nhật giờ làm nhân viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `timekeeping.work-calendar.list` | Tra cứu lịch ngày lễ và lịch làm việc công ty | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.work-calendar.sync` | Đồng bộ lịch nghỉ lễ đã được duyệt | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `timekeeping.work-calendar.create` | Thêm ngày nghỉ hoặc ngày làm việc ngoại lệ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `timekeeping.work-calendar.update` | Cập nhật ngày trong lịch công ty | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.delete.5725128cf1fe0911` | Xóa chấm công công việc lịch làm việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `timekeeping.work-calendar.audit` | Xem lịch sử thay đổi ngày trong lịch công ty | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.reconciliation.schedule.get` | Tra cứu lịch phát hành đối soát lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.reconciliation.schedule.update` | Cài đặt lịch phát hành đối soát lương | Cài đặt lịch phát hành đối soát lương monthly schedule enabled | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.reconciliation.list` | Tra cứu trạng thái đối soát lương của nhân viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.run.reconciliation.publish` | Phát hành bảng lương tạm tính để đối soát | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.reconciliation.action` | Phản hồi hoặc xử lý khiếu nại lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.employee.me.reconciliation` | Tra cứu đối soát lương của tôi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.employee.reconciliation.action` | Xác nhận hoặc trao đổi về đối soát lương của tôi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.period.variables.list` | Tra cứu biến dữ liệu đầu vào bảng lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.period.variables.create` | Tạo biến dữ liệu đầu vào bảng lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.period.variables.update` | Cập nhật biến dữ liệu đầu vào bảng lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.period.variables.activate` | Kích hoạt biến dữ liệu đầu vào bảng lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.period.variables.retire` | Ngừng biến dữ liệu đầu vào bảng lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.79f4d36088c00b86` | Tra cứu dữ liệu đầu vào kỳ lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.period.input.update` | Cập nhật dữ liệu đầu vào lương nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.period.inputs.bulk` | Cập nhật dữ liệu đầu vào lương hàng loạt | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview, stale-version |
| `payroll.period.line-overrides.list` | Tra cứu các khoản lương được ghi đè thủ công | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.period.line-overrides.bulk` | Ghi đè các khoản lương theo nhân viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview, stale-version |
| `payroll.formula.list` | Tra cứu công thức tính lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.formula.create` | Tạo công thức tính lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.formula.update` | Cập nhật công thức tính lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.formula.activate` | Kích hoạt công thức tính lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.formula.retire` | Ngừng công thức tính lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.formula.clone` | Sao chép công thức tính lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.list` | Tra cứu lượt chạy lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.run.create` | Tạo bản nháp lượt chạy lương định kỳ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.sync-attendance` | Đồng bộ công vào lượt chạy lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.lock-attendance` | Khóa snapshot công của lượt lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.policy.list` | Tra cứu chính sách lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.policy.create` | Tạo chính sách lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.policy.activate` | Áp dụng chính sách lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.policy.retire` | Ngừng chính sách lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.policy.update` | Cập nhật chính sách lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.policy.clone` | Sao chép chính sách lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.policy.delete` | Xóa chính sách lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.review` | Gửi lượt lương sang chờ duyệt | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.close` | Chốt lượt lương đã duyệt | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.reopen` | Mở lại lượt lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.mark-paid` | Đánh dấu lượt lương đã thanh toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.f2ac09bb2c5e311f` | Xem nhật ký thao tác của một lượt lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.run.calculate` | Tính lương cho lượt đã khóa công | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.recalculate` | Tính lại lương cho lượt đã khóa công | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.issues.list` | Xem lỗi và cảnh báo của lượt lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.run.line.detail` | Xem chi tiết lương nhân viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.run.payslips.publish` | Công bố phiếu lương trong ứng dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.payslips.withdraw` | Thu hồi phiếu lương đã công bố | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.employee.me.payslips` | Tra cứu phiếu lương của tôi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.employee.me.payslip.review-requests` | Tra cứu yêu cầu kiểm tra phiếu lương của tôi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.employee.me.payslip.review.request` | Yêu cầu kiểm tra lại phiếu lương của tôi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.payslip.review-requests.list` | Tra cứu yêu cầu kiểm tra phiếu lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.run.payslip.review-request.resolve` | Phản hồi yêu cầu kiểm tra phiếu lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.payments.list` | Tra cứu các đợt thanh toán lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.run.payment.create` | Tạo đợt thanh toán lương nháp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.payment.confirm` | Xác nhận đợt thanh toán lương đã chuyển tiền | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.payment.cancel` | Hủy đợt thanh toán lương nháp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.payment.reverse` | Đảo xác nhận đợt thanh toán lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.ac427b464961eae6` | Xem nhật ký xử lý của kỳ lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.8a6bcc27085077c3` | Xem kết quả chấm công dùng để tính lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.period.reset` | Đặt lại kỳ lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.adjustment.approve` | Phê duyệt khoản điều chỉnh lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.adjustment.reject` | Từ chối khoản điều chỉnh lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.adjustment.list` | Tra cứu khoản điều chỉnh lương trong kỳ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `payroll.adjustment.create` | Tạo khoản điều chỉnh lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `leave.balance.me` | Tra cứu số dư phép năm của tôi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `leave.balances.report` | Thống kê số dư phép năm nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.0c557a74cbc907f9` | Tra cứu hợp đồng nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.564251c483731a91` | Tạo hợp đồng nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.patch.7d7b8c0cbce4fe1c` | Cập nhật hợp đồng nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `hr.contract.settings.get` | Xem cài đặt cảnh báo hợp đồng nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.contract.settings.update` | Cập nhật cài đặt cảnh báo hợp đồng nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.b44c64519e939e0a` | Tra cứu lịch sử gia hạn hợp đồng nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.8dad6fff5226b63c` | Gia hạn hợp đồng nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `company-email.smtp.config` | Xem tóm tắt cấu hình SMTP công ty | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `company-email.smtp.verify` | Kiểm tra kết nối SMTP công ty | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `company-email.smtp.test` | Gửi email thử SMTP | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `company-email.celebration.config` | Xem tóm tắt cài đặt email chúc mừng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `company-email.celebration.update` | Cập nhật cài đặt email chúc mừng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `company-email.celebration.preview` | Xem trước email chúc mừng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `company-email.celebration.history` | Tổng hợp lịch sử email chúc mừng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `recruitment.job.list` | Tra cứu vị trí tuyển dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `recruitment.report` | Báo cáo tuyển dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `recruitment.job.create` | Tạo vị trí tuyển dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.job.detail` | Xem vị trí tuyển dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `recruitment.job.update` | Cập nhật vị trí tuyển dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.job.status` | Đổi trạng thái vị trí tuyển dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.job.delete` | Xóa mềm vị trí tuyển dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.job.restore` | Khôi phục vị trí tuyển dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.pipeline.get` | Tra cứu các bước tuyển dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `recruitment.applicant.list` | Tra cứu ứng viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `recruitment.applicant.create` | Thêm ứng viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.applicant.detail` | Xem hồ sơ ứng viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `recruitment.applicant.update` | Cập nhật hồ sơ ứng viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.applicant.transition` | Chuyển bước tuyển dụng cho ứng viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.applicant.delete` | Xóa mềm hồ sơ ứng viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.applicant.restore` | Khôi phục hồ sơ ứng viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.applicant.history` | Xem lịch sử tuyển dụng ứng viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `recruitment.interview.list` | Tra cứu lịch phỏng vấn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `recruitment.interview.create` | Tạo lịch phỏng vấn | Tạo lịch phỏng vấn bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.interview.detail` | Xem lịch phỏng vấn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `recruitment.interview.update` | Cập nhật lịch phỏng vấn | Cập nhật lịch phỏng vấn bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.interview.delete` | Xóa lịch phỏng vấn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `recruitment.interview.restore` | Khôi phục lịch phỏng vấn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `dashboard.business-overview` | Xem tổng quan hoạt động doanh nghiệp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.38c4520f180b420b` | Xem tổng quan hoạt động doanh nghiệp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.a0937fb0c693e329` | Xem việc cần xử lý hôm nay | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.15793bc7bd272c4c` | Xem chỉ số công việc theo tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `task.activity.update` | Cập nhật hoạt động công việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `hr.workflow.list` | Tra cứu quy trình làm việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.workflow.create` | Tạo quy trình làm việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `hr.workflow.update` | Cập nhật quy trình làm việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `hr.workflow.delete` | Xóa quy trình làm việc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `hr.contract.missing.list` | Báo cáo nhân sự chưa có hợp đồng hiệu lực | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.overview` | Báo cáo tổng quan chấm công hôm nay | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.late` | Báo cáo nhân sự đi muộn hôm nay | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.absent` | Báo cáo nhân sự vắng hôm nay | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.unrecorded` | Báo cáo nhân sự chưa chấm công hôm nay | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.leave` | Báo cáo nhân sự nghỉ phép hôm nay | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.monthly.overview` | Tổng hợp chấm công theo tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.monthly.under-threshold` | Nhân sự chưa đủ ngưỡng công trong tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.monthly.most-absent` | Nhân sự nghỉ nhiều nhất trong tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.monthly.most-late` | Thống kê lượt đi làm trễ trong tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.monthly.most-leave` | Nhân sự nghỉ phép nhiều nhất trong tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.monthly.leave-summary` | Tổng hợp tất cả nhân sự nghỉ phép trong tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.records.monthly.unrecorded` | Nhân sự chưa chấm công trong tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `task.kpi.monthly` | Báo cáo KPI công việc theo tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.leave.applications.list` | Tra cứu đơn nghỉ phép và làm việc từ xa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.calendar.events.list` | Tra cứu sự kiện nội bộ và lịch hôm nay | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.calendar.event.create` | Tạo sự kiện nội bộ | Tạo sự kiện nội bộ bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `hr.calendar.event.update` | Cập nhật sự kiện nội bộ | Cập nhật sự kiện nội bộ bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `leave.balances.list` | Thống kê số phép năm còn lại của nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `leave.balances.minimum` | Nhân sự còn ít nhất số ngày phép được yêu cầu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `leave.balances.exhausted` | Nhân sự đã hết phép năm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.work-calendar.month-holidays` | Ngày nghỉ trong tháng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `timekeeping.work-calendar.named-holiday` | Tra cứu ngày nghỉ theo tên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.contract.expiring.list` | Báo cáo hợp đồng nhân sự sắp hết hạn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.contract.list` | Tra cứu hợp đồng nhân sự để chọn hợp đồng cần gia hạn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.contract.extend` | Gia hạn hợp đồng nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `hr.training.incomplete.list` | Báo cáo tiến độ đào tạo nội bộ chưa hoàn thành | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.contract.create` | Tạo hợp đồng nhân sự | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `timekeeping.record.update` | Điều chỉnh dữ liệu chấm công | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `payroll.run.complaints.list` | Tổng hợp khiếu nại bảng lương | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.workflow.category.create` | Tạo nhãn phân loại quy trình | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `hr.daily.overview` | Báo cáo tình hình nhân sự hôm nay | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `hr.training.progress` | Báo cáo toàn bộ tiến độ đào tạo nội bộ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |

### Kho & Sản phẩm (68 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `category.list` | Tra cứu danh mục kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `category.create` | Tạo danh mục kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `category.update` | Cập nhật danh mục kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `category.delete` | Xóa danh mục kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `product.list` | Tra cứu sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.catalog.workspace.get` | Xem thông tin chung về sản phẩm và kho hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.catalog.workspace.update` | Đổi cách quản lý danh mục sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.prices.list` | Tra cứu giá bán và giá vốn SKU | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.put.f369bafc104121fe` | Cập nhật giá nhập và giá bán SKU | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.catalog.defaults.seed` | Tạo dữ liệu danh mục kho mặc định | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.catalog.resource.list` | Tra cứu danh mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.c29d50d7a2ebd989` | Tạo thể loại / thư mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.patch.ad1b26d154f5621c` | Cập nhật dữ liệu dùng chung cho sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.delete.9301905784a3a33e` | Xóa dữ liệu danh mục sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.catalog.template.list` | Tra cứu mẫu sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.705bdfe1a603a06f` | Tạo mẫu sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.patch.401f92bc17a703e3` | Cập nhật mẫu sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.product.create.sellable` | Tạo sản phẩm và SKU kèm giá bán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.5905a76c5b33f482` | Tạo sản phẩm với nhiều SKU | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.product.detail` | Xem chi tiết sản phẩm và SKU | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.patch.ec4179bd45d62cbf` | Cập nhật thông tin sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.delete.cc58d03a74329723` | Xóa kho hàng danh mục sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.435334a57fb9c949` | Thêm nhiều SKU cho sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.variant.create.sellable` | Thêm SKU kèm giá bán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.variant.bulk.update` | Cập nhật nhiều SKU | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.variant.bulk.delete` | Xóa nhiều SKU | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.patch.78eb0c3b82d1f735` | Cập nhật thông tin SKU | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.supplier.list` | Tra cứu nhà cung cấp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.patch.d638d3bb0a56b64b` | Cập nhật nhà cung cấp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.supplier.delete` | Xóa nhà cung cấp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.receipt.list` | Tra cứu phiếu nhập kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.receipt.create` | Tạo phiếu nhập kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.receipt.update` | Cập nhật phiếu nhập kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.receipt.submit` | Gửi phiếu nhập xác nhận | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.receipt.start` | Bắt đầu nhận hàng vào kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.receipt.confirm` | Xác nhận nhập kho và cập nhật tồn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.receipt.cancel` | Hủy phiếu nhập kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.warehouse.locations.list` | Tra cứu kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.count.list` | Tra cứu phiếu kiểm kê kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.count.detail` | Xem phiếu kiểm kê kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.feaf71a366c8880e` | Tạo phiếu kiểm kê kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.count.item.update` | Cập nhật dòng kiểm kê kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.5e0381daf5057103` | Quét mã vào phiếu kiểm kê | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.f03e901c8ee14a8f` | Bắt đầu kiểm kê kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.a9dc1045ea6b35ab` | Gửi phiếu kiểm kê để duyệt | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.454f78ec53f74015` | Hủy phiếu kiểm kê | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.96a0f20fbf238627` | Phê duyệt kiểm kê và cập nhật tồn kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.count.recreate` | Tạo lại phiếu kiểm kê bị xung đột | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.serial.list` | Tra cứu IMEI, serial và mã đơn vị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.serial.history` | Xem lịch sử IMEI hoặc serial | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.serial.detail` | Xem chi tiết IMEI hoặc serial | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.serial.create` | Đăng ký IMEI hoặc serial vào tồn kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.serial.transition` | Cập nhật trạng thái IMEI hoặc serial | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.serial.transfer.local` | Chuyển IMEI hoặc serial giữa các kho trong chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.serial.transfer.request` | Gửi IMEI hoặc serial sang chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.serial.transfer.accept` | Nhận IMEI hoặc serial được điều chuyển | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.serial.transfer.cancel` | Hủy điều chuyển IMEI hoặc serial | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.transfer.list` | Tra cứu phiếu điều chuyển kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.transfer.detail` | Xem chi tiết phiếu điều chuyển kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.transfer.create` | Tạo phiếu điều chuyển kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.transfer.accept` | Nhận phiếu điều chuyển kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.transfer.cancel` | Hủy phiếu điều chuyển kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `tiktok-shop.status` | Kiểm tra kết nối TikTok Shop | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.reconciliation.warehouses.list` | Tra cứu kho để đối soát tồn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.reconciliation.run` | Đối soát dữ liệu tồn kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.stock-log.reverse` | Đảo phiếu xuất kho thủ công | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `inventory.stock-log.list` | Tra cứu phiếu nhập xuất kho | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `inventory.catalog.unit.create` | Tạo đơn vị tính | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |

### Sửa chữa & bảo hành (36 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `repair.list` | Tra cứu phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `repair.refund.summary` | Tra cứu số dư hoàn tiền sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `repair.refund.vouchers` | Tìm phiếu chi đủ điều kiện hoàn tiền sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `repair.refund.create` | Ghi nhận hoàn tiền sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `repair.device.lookup` | Tra cứu thiết bị đã bán theo mã | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.5bc56e7749f48d08` | Tra cứu phiếu sửa chữa theo số sê-ri thiết bị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.a647fdd78184d877` | Xem chi tiết phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.79291125e27b1d36` | Tạo phiếu sửa chữa dịch vụ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.951d43982cb708bc` | Cập nhật trạng thái phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.dd4d2216f9ecc537` | Báo giá phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.1ee164077121787a` | Duyệt báo giá sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.572b64fca460dafc` | Giao thiết bị sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.ad54adfbaa37674b` | Ghi nhận thanh toán sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.8cb8202ecb5a1164` | Đối chiếu tiền đã thu trên phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.e8ac82522784cf77` | Tra cứu một giao dịch thanh toán sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.cd0981c57831ef5c` | Xem lịch sử chăm sóc của phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.30630b0bdc49b30c` | Ghi nhận trao đổi chăm sóc khách hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.6fda6d726245dee1` | Cập nhật trạng thái chăm sóc khách hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.c5fac63d8679d159` | Xem lịch sử chăm sóc khách hàng sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.5a64bf0894869ec7` | Hủy phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `repair.feedback.link.create` | Tạo liên kết đánh giá cho phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `repair.parts.list` | Tra cứu linh kiện đã xuất cho phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.aed04d8555cb4291` | Xuất linh kiện cho phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.2b44c18916b1a882` | Hoàn linh kiện sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.7517d0cca9ca76c9` | Tra cứu lịch sử sửa chữa theo khách hoặc thiết bị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.8ed57322c93cc536` | Phân công kỹ thuật viên sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.742b8c7c7d343778` | Ghi nhận đánh giá sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.2c71c36e4f1d283e` | Tra cứu đánh giá sau sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.d2d1a3ba9b169ce6` | Xem tin nhắn đã gửi về phiếu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `repair.notification.resend` | Gá»­i láº¡i thÃ´ng bÃ¡o phiáº¿u sá»­a chá»¯a | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.da5aa81551ee7ce6` | Xem cấu hình thông báo sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.put.b1eda41fa88b2cc9` | Cáº¥u hÃ¬nh thÃ´ng bÃ¡o phiáº¿u sá»­a chá»¯a | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.3938bd395acae1c5` | Xem doanh thu sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.25ab7ad5caa4684f` | Xem mức sử dụng linh kiện sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.68886fa48772aa78` | Xem hiệu suất kỹ thuật viên sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.e25284fbbeeaf62d` | Tổng hợp đánh giá khách hàng sửa chữa | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |

### Tài chính (69 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `finance.treasury.accounts.list` | Tra các quỹ tiền mặt và tài khoản ngân hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.treasury.vouchers.list` | Tra phiếu thu chi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.treasury.bank-lines.list` | Tra giao dịch ngân hàng chờ đối soát | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.treasury.periods.list` | Tra cứu kỳ tài chính | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.f571d5d6bb5d51ab` | Xem tổng quan tài chính | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.03a093fc9349a692` | Xem báo cáo doanh thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.c611407da8136c5f` | Xem tổng hợp khoản phải thu theo hạn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.614b2375b202f4b6` | Xem báo cáo chi phí | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.88b9d2165759d798` | Xem chi phí vận hành | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.c1af6a4524808fc9` | Tạo báo cáo vận hành chi phí | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.delete.9dfafef7e83ee5f0` | Xóa báo cáo vận hành chi phí | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.4621ea131565f025` | Xem báo cáo lãi lỗ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.65204362fe283948` | Xem báo cáo tài chính quản trị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.management.debts.list` | Tra cứu khoản phải thu, phải trả và phiếu nhập chưa ghi công nợ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.c7f205ec27eeab37` | Tạo tài chính quản lý khoản phải trả | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.voucher.create` | Tạo phiếu thu hoặc chi tài chính | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.5213d6b07cbffd29` | Thực hiện tài chính quản lý phiếu thu chi đảo giao dịch | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.00f98f7f46e21cf0` | Tạo tài chính quản lý theo dõi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.tax.from-invoice` | Ghi nhận VAT từ hóa đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.tax.create` | Ghi nhận VAT thủ công | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.put.86ec1b1dded51aa0` | Cập nhật tài chính quản lý cài đặt | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.debt.list` | Tra cứu công nợ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.f050d7804ae747a3` | Ghi nhận công nợ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.fd3f5b4a8cf47782` | Ghi nhận thanh toán công nợ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.vat.list` | Tra cứu hóa đơn VAT | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.748a178f1689567e` | Ghi nhận hóa đơn VAT | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.put.7e0d95e6f48a16a7` | Cập nhật số dư VAT chuyển kỳ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.d8e2ed96478d8a3e` | Xem báo cáo lợi nhuận tài chính | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.ac04b554927d4696` | Ghi nhận chi phí | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.reporting.breakeven` | Tra cứu điểm hòa vốn và kế hoạch tài chính | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.reporting.plan.update` | Cập nhật kế hoạch tài chính và điểm hòa vốn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.e7edb97470c1d234` | Tạo quỹ tiền mặt hoặc tài khoản ngân hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.treasury.vouchers.create` | Lập phiếu thu, chi hoặc chuyển quỹ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.treasury.vouchers.decision` | Duyệt hoặc từ chối phiếu thu chi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.treasury.reconciliation.create` | Ghi nhận đối soát quỹ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.treasury.bank-lines.create` | Nhập giao dịch ngân hàng để đối soát | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.treasury.bank-lines.match` | Ghép giao dịch ngân hàng với phiếu thu chi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.treasury.period.update` | Chốt hoặc mở lại kỳ tài chính | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.asset.list` | Tra cứu tài sản cố định | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.asset.depreciations.list` | Tra cứu khấu hao tài sản theo kỳ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.asset.detail` | Xem tài sản cố định | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.asset.schedule` | Xem lịch khấu hao tài sản | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.c77ec95f9e22a52a` | Tạo tài sản cố định | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.patch.147cb912f34dd4d1` | Cập nhật tài sản cố định | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.9adaea0274bd3aac` | Chuyển tài sản sang chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.a5ab5625c92c88b1` | Thanh lý tài sản cố định | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.b8a7093520fc5d21` | Lập kế hoạch khấu hao tài sản | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.f178e9522abebc03` | Ghi sổ khấu hao tài sản | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.asset.inventory.list` | Tra cứu phiên kiểm kê tài sản | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.asset.inventory.detail` | Xem phiên kiểm kê tài sản | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.asset.inventory.variance` | Xem chênh lệch kiểm kê tài sản | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.asset.inventory.open` | Mở phiên kiểm kê tài sản tại chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.asset.inventory.count` | Ghi nhận kết quả kiểm kê tài sản | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.asset.inventory.finalize` | Chốt phiên kiểm kê tài sản | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.receivable.list` | Tra cứu khoản phải thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.receivable.aging` | Tổng hợp tuổi nợ phải thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.receivable.by-customer` | Tổng hợp khoản phải thu theo khách hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.receivable.detail` | Xem khoản phải thu và các bút toán có thể đảo | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.ed7ac98d2498702f` | Thu tiền khoản phải thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.5d88cf81f1042ab2` | Điều chỉnh khoản phải thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.ec8517952b42a8d0` | Ghi xóa khoản phải thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.receivable.suspend` | Tạm dừng nhắc khoản phải thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.receivable.extend` | Gia hạn khoản phải thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.receivable.entry.reversal` | Đảo khoản thu hoặc điều chỉnh phải thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.reminders.runs.list` | Xem các lượt rà soát công nợ quá hạn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.reminders.runs.detail` | Xem chi tiết lượt rà soát nhắc công nợ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.reminders.retryable-deliveries.list` | Chọn thông báo nhắc công nợ nội bộ cần thử lại | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `finance.reminders.run` | Rà soát và xếp hàng nhắc công nợ quá hạn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `finance.reminders.delivery.retry-in-app` | Thử lại thông báo công nợ nội bộ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |

### Quản lý học viên (109 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `account.business-settings.update` | Cập nhật lĩnh vực đào tạo của tài khoản đang đăng nhập | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.unassigned.list` | Tra cứu học viên chưa có chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.patch.6d0c5baf91c41cc1` | Chuyển học viên chưa gán chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.create` | Tạo hồ sơ học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.bulk.create` | Tạo nhiều hồ sơ học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.bulk.preview` | Kiểm tra danh sách học viên trước khi nhập | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.bulk.delete` | Xóa nhiều hồ sơ học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.bulk.delete.preview` | Xem trước ảnh hưởng khi xóa học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.list` | Tra cứu học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.learning-history` | Xem tiến độ học tập của học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.installments.list` | Tra cứu các đợt học phí của học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.installment.create` | Tạo đợt học phí cho học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.installment.update` | Cập nhật đợt học phí của học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.detail` | Xem thông tin học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.update` | Cập nhật hồ sơ học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.patch.5bb1b2bfdbad4548` | Đánh dấu đợt học phí đã thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.exam.create` | Tạo kỳ thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.exam.list` | Tra cứu kỳ thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.exam.eligible-students.list` | Chọn học viên đủ điều kiện của lớp trong kỳ thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.exam.grade-roster.list` | Chọn thí sinh trong kỳ thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.exam.assigned-students.list` | Xem học viên đang được gán vào kỳ thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.exam.detail` | Xem thông tin kỳ thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.exam.update` | Cập nhật kỳ thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.exam.delete` | Xóa kỳ thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.exam.assign` | Gán học viên đủ điều kiện vào kỳ thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.exam.unassign` | Gỡ học viên khỏi kỳ thi và xóa mục lịch sử thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.exam.result.update` | Cập nhật kết quả một thí sinh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.exam.grade-results.update` | Nhập hoặc cập nhật điểm thi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.payment.create` | Ghi nhận khoản thu học phí | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.payment.list` | Tra cứu giao dịch học phí | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.payment.update` | Sửa thông tin giao dịch học phí | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.payment.delete` | Xóa giao dịch học phí | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.notification.create` | Tạo bản ghi thông báo học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.notification.list` | Tra cứu thông báo học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.notification.update` | Sửa bản ghi thông báo học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.notification.delete` | Xóa bản ghi thông báo học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.a6cfd8985d17e407` | Phân tích AI | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `course.category.list` | Tra cứu danh mục khóa học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `course.category.create` | Tạo phân loại khóa học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `course.category.delete` | Xóa danh mục khóa học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `course.create` | Tạo khóa học cho học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `course.list` | Tra cứu khóa học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `course.detail` | Xem chi tiết khóa học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `course.update` | Cập nhật khóa học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `course.delete` | Xóa khóa học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.resource.category.list` | Tra cứu loại phòng học, thiết bị và tài nguyên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.resource.category.create` | Thêm loại phòng học, thiết bị hoặc tài nguyên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.resource.category.delete` | Xóa loại phòng học, thiết bị hoặc tài nguyên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.resource.create` | Thêm phòng học hoặc thiết bị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.resource.list` | Tra cứu phòng học, thiết bị và tài nguyên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.resource.detail` | Xem chi tiết phòng học hoặc thiết bị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.resource.update` | Sửa phòng học hoặc thiết bị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.resource.delete` | Xóa phòng học hoặc thiết bị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.resource.booking.create` | Đặt lịch phòng học hoặc thiết bị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.resource.booking.delete` | Hủy lịch đặt phòng học hoặc thiết bị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.batch.progress-colors.list` | Xem màu đánh giá tiến độ lớp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.batch.progress-colors.update` | Cập nhật màu đánh giá tiến độ lớp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.batch.create` | Tạo lớp học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `batch.list` | Tra cứu lớp học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.batch.detail` | Xem thông tin lớp học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.batch.update` | Cập nhật lớp học | Cập nhật lớp học location QA Room | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.batch.delete` | Xóa lớp học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.batch.enrollments.list` | Tra cứu học viên và trạng thái ghi danh trong lớp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.batch.learner.add` | Thêm học viên vào lớp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.batch.learner.remove` | Xóa học viên khỏi lớp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.batch.enrollment.update` | Cập nhật trạng thái học viên trong lớp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `batch.attendance.learners` | Chọn học viên trong lớp để cập nhật điểm danh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `batch.attendance.record.update` | Cập nhật điểm danh một học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `batch.attendance.delete` | Xóa điểm danh của lớp trong ngày | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.schedule.list` | Tra cứu lịch lớp, kỳ thi và lịch đặt tài nguyên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.custom-field.list` | Tra cứu trường dữ liệu tùy chỉnh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.custom-field.create` | Tạo trường dữ liệu tùy chỉnh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.custom-field.update` | Cập nhật trường dữ liệu tùy chỉnh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.custom-field.delete` | Xóa trường dữ liệu tùy chỉnh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.custom-field.archive` | Lưu trữ trường dữ liệu tùy chỉnh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.custom-field.restore` | Khôi phục trường dữ liệu tùy chỉnh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.module-settings.get` | Xem loại hồ sơ đang áp dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.standard-fields.list` | Tra cứu trường tiêu chuẩn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.standard-fields.update` | Cập nhật một trường tiêu chuẩn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.assignment.create` | Tạo bài tập cho lớp | Tạo bài tập cho lớp bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.assignment.list` | Tra cứu bài tập trong lớp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.assignment.submissions.list` | Tra cứu tình trạng nộp bài | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.ed6d61a8578e4260` | Nộp bài thay cho học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.assignment.grade` | Chấm điểm bài tập | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.quality.thresholds.list` | Xem ngưỡng đánh giá chất lượng học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.quality.thresholds.update` | Cập nhật ngưỡng đánh giá chất lượng học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.quality.list` | Tra cứu chất lượng học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.quality.mini-tests.list` | Tra cứu bài kiểm tra ngắn của học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.quality.assessment.update` | Cập nhật đánh giá học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.quality.mini-test.create` | Tạo bài kiểm tra ngắn cho học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.quality.mini-test.update` | Cập nhật mini test của học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.quality.mini-test.delete` | Xóa điểm mini test của học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.quality.assignment.grade` | Chấm hoặc cập nhật điểm bài tập | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.learning-roadmap.list` | Tra cứu lộ trình học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.learning-roadmap.steps.list` | Tra cứu chặng của lộ trình | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.learning-roadmap.create` | Tạo lộ trình học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.learning-roadmap.update` | Cập nhật lộ trình học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.learning-roadmap.delete` | Xóa lộ trình học | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.learning-roadmap.progression.list` | Xem điều kiện và quyết định lên lớp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.learning-roadmap.progression.update` | Cập nhật quyết định học tiếp hoặc bảo lưu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.learning-roadmap.promote` | Chuyển học viên lên lớp tiếp theo | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.learning-roadmap.waitlist.list` | Tra cứu học viên trong danh sách chờ lộ trình | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.learning-roadmap.waitlist.place` | Xếp học viên trong danh sách chờ vào lớp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.online-attendance.create-sessions` | Gửi mã điểm danh trực tuyến cho lớp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.e5e08c5df6457528` | Tra cứu các lần xác thực điểm danh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.email.send` | Gửi email theo yêu cầu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `student.resource.bookings.list` | Tra cứu lịch đặt phòng học hoặc tài nguyên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.batch.attendance.summary` | Báo cáo điểm danh lớp học theo ngày | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `student.payment.reconcile` | Đối chiếu học phí học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |

### Đối tác (14 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `partner.commission.levels.list` | Tra cứu cấu hình hoa hồng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.dda51f40f1cbd125` | Tạo cấu hình hoa hồng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.patch.c3613ac62ed49013` | Cập nhật cấu hình hoa hồng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.delete.abafb6f27753de55` | Xóa cấp bậc hoa hồng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `partner.bulk.create` | Tạo nhiều đối tác | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.682981444c12f0aa` | Tạo cộng tác viên giới thiệu học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `partner.list` | Tra cứu đối tác | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.74c43c3c00197209` | Xem thông tin đối tác | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.patch.fee44cbce47ae377` | Cập nhật thông tin liên hệ đối tác | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.delete.9043f4e5cc3aefab` | Xóa đối tác giới thiệu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.5e1017ef3a76d4f1` | Ghi nhận chi trả hoa hồng đối tác | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `partner.bank-details.update` | Cập nhật thông tin chuyển khoản đối tác | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `partner.commission.update` | Cấu hình hoa hồng cho đối tác | Giống câu chuẩn | unavailable-operation |
| `partner.analysis` | Phân tích đối tác học viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |

### Bán lẻ & POS (72 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `retail.coupon.tier.list` | Tra cứu hạng khách hàng để áp dụng mã ưu đãi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.coupon.assistant-options.list` | Tra cứu mã ưu đãi có thể áp dụng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.905fb162eeadc421` | Xem thiết lập bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.3b0987c2af0ac3e5` | Xem thiết lập in hóa đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.put.124a0326bcb934fc` | Cập nhật cài đặt bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.shift.current` | Xem ca POS hiện tại | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.shift.cashier.list` | Tra cứu nhân viên thu ngân | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.shift.drawer.list` | Tra cứu quầy và két POS | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.c9d60252b9a973dd` | Tạo quầy hoặc két POS | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.shift.settlements.list` | Tra cứu khoản thu POS chưa đối soát | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.65aaf7d2d6ae9faf` | Đánh dấu khoản thu POS đã kiểm tra | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.shift.list` | Tra cứu ca thu ngân POS | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.fc665b5fde526b87` | Xem chi tiết ca thu ngân | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.b0d4095fce422005` | Mở ca thu ngân POS | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.shift.resume` | Tiếp tục ca POS của bạn trên thiết bị hiện tại | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.shift.pause` | Tạm dừng ca POS của bạn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.accc645ed354d2b5` | Ghi thu hoặc chi tiền mặt trong ca POS | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.00a6a513fba7ada4` | Chuyển quầy hoặc két tiền cho ca bán hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.12e203d82e400c19` | Đóng ca thu ngân POS | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.b2e3520270c7234f` | Đối soát ca thu ngân POS | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.order.checkout` | Tạo và thanh toán đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.order.quote` | Tính thử đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.order.products.list` | Tra cứu sản phẩm bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.1f691abad0a10ee8` | Tra cứu nhóm hàng có thể bán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.cc59ef5991d28f6a` | Tìm thiết bị theo số sê-ri để bán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.order.list` | Tra cứu đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.order.draft.create` | Tạo đơn nháp bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.order.detail` | Xem chi tiết đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.c15de085b05fbedf` | Kiểm tra tình trạng thanh toán đơn hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.order.draft.update` | Cập nhật đơn nháp bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.order.confirm` | Xác nhận đơn nháp bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.order.collect` | Thu thêm tiền đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.order.cancel` | Hủy đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.delete.1f12700de51c1e66` | Xóa bán lẻ đơn hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.invoice.list` | Tra cứu hóa đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.invoice.detail` | Xem chi tiết hóa đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.report.summary` | Tổng hợp doanh số bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.receivable.customer.history` | Tra cứu lịch sử công nợ bán lẻ của khách hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.receivable.reconciliation.latest` | Xem kết quả đối soát công nợ bán lẻ gần nhất | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.receivable.reconciliation.run` | Đối soát công nợ bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.debt-reminders.runs.list` | Tra cứu lịch sử nhắc công nợ bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.debt-reminders.runs.detail` | Xem thống kê lượt nhắc công nợ bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.debt-reminders.retryable-deliveries.list` | Chọn email nhắc công nợ lỗi tạm thời để thử lại | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.debt-reminders.run` | Chạy nhắc công nợ bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.debt-reminders.delivery.retry` | Thử lại email nhắc công nợ lỗi tạm thời | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.717dc1604d98a981` | Tra cứu thiết bị đã bán và thời hạn bảo hành | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.33957f831ebdde02` | Tra cứu bảo hành theo mã thiết bị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.warranty.lookup.phone` | Tra cứu bảo hành theo số điện thoại khách hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.5ac7dee040f9bb15` | Tìm thiết bị sắp hết hạn bảo hành | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.65279c2bb28cac4b` | Tìm thiết bị có nguy cơ thiếu thông tin bảo hành | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.warranty.serial.update` | Cập nhật thời hạn bảo hành cho thiết bị | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.after-sale.detail` | Xem chứng từ đổi trả hoặc thu mua | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.after-sale.list` | Tra cứu chứng từ đổi trả và thu mua | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.after-sale.create` | Tạo phiếu đổi trả hoặc thu mua bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.payment-review.pending` | Tra cứu giao dịch chuyển khoản chờ rà soát | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.payment-review.review` | Ghi nhận rà soát giao dịch chuyển khoản | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.points.policy.get` | Tra cứu chính sách tích điểm bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.points.policy.update` | Cập nhật chính sách tích điểm bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.points.customer.search` | Tìm khách hàng để tra cứu điểm thưởng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.47d83644d10887c0` | Xem điểm thưởng của khách hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.6c5a8520aa90cc8e` | Điều chỉnh điểm khách hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.finance.cashbook.list` | Tra cứu sổ quỹ bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.finance.cashbook.voucher.create` | Tạo phiếu thu chi sổ quỹ bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.finance.cashbook.close` | Chốt kỳ sổ quỹ bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.finance.cashbook.reconcile` | Đối soát sổ quỹ bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.070d48d67bb5ed90` | Xem lợi nhuận bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.7cae37ab77856122` | Xem chính sách hoa hồng cộng tác viên bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.finance.commission.policy.update` | Cấu hình hoa hồng SKU cho cộng tác viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.203a9f8e9a785680` | Xem hoa hồng bán lẻ của tôi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.78da159ec226e07e` | Phân tích hoa hồng đối tác bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.coupon.create` | Tạo mã ưu đãi | Tạo mã ưu đãi bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.invoice.summary` | Tổng hợp hóa đơn bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |

### Đối tác bán lẻ (19 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `api.get.09ba89f080717c4a` | Xem danh sách cộng tác viên bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.partner.supplier.list` | Tra cứu nhà cung cấp liên kết | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.partner.user.list` | Tra cứu tài khoản cộng tác viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.partner.customer.list` | Tra cứu khách hàng đại lý | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.partner.commission.policy.list` | Tra cứu cấu hình hoa hồng bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.78762121730098ad` | Tạo cấu hình hoa hồng bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.patch.2776df6160261ce4` | Cập nhật cấu hình hoa hồng bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.d9daa6226ed98e83` | Tra cứu mức hoa hồng theo sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.partner.product.commissions.update` | Cấu hình hoa hồng theo sản phẩm | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.partner.product.commission.products` | Tra cứu sản phẩm và SKU để cấu hình hoa hồng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.9ca47ce89d0dd0f0` | Xem hồ sơ cộng tác viên bán lẻ của tôi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.partner.list` | Tra cứu đối tác bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `retail.partner.update` | Cập nhật đối tác bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.9102a0fae468bcab` | Đối soát hoa hồng cộng tác viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.7c1d9c9cda4722a9` | Xem bảng kê hoa hồng cộng tác viên bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.3c5a416752fe6656` | Chi trả hoa hồng cộng tác viên | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.partner.create.collaborator` | Tạo cộng tác viên bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.partner.create.dealer` | Tạo đại lý bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `retail.partner.create.supplier` | Tạo nhà cung cấp bán lẻ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |

### Đối tác lao động (32 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `worker.partner.list` | Tra cứu đối tác cung ứng lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.51cd07ea5eae455b` | Tạo cộng tác viên lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.partner.policy.list` | Tra cứu chính sách hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.e57ae0da3cdf14f8` | Tạo chính sách hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.partner.policy.detail` | Xem chính sách hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.patch.2971d5a8a97f8be8` | Cập nhật chính sách hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.a58fa4b9dd69941c` | Kích hoạt chính sách hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.6346fd99746602d2` | Ngừng áp dụng chính sách hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.delete.b01de2c5e1417d90` | Xóa chính sách hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.c7d183398e44331e` | Sao chép chính sách hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.f7d7b097f3b2fca2` | Phân tích KPI và số lao động giới thiệu của đối tác | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.partner.kpi.set` | Đặt KPI giới thiệu cho đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.partner.worker-referral.list` | Tra cứu đối tác giới thiệu của người lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.partner.referrals.list` | Tra cứu người lao động được đối tác giới thiệu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.post.15425a2f24638e8c` | Thực hiện lao động quản lý đối tác giới thiệu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.partner.referral.confirm` | Xác nhận referral của người lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.816c2559aba41930` | Thực hiện lao động quản lý đối tác giới thiệu kết thúc | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.partner.settlement.calculate` | Tính đối soát hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.2ed06bd0339e10ae` | Xem tổng quan quyết toán đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.4ecb05d1dddb3fdc` | Xem báo cáo hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.partner.settlements.list` | Tra cứu kỳ đối soát hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.partner.settlement.detail` | Xem chi tiết kỳ đối soát hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.partner.settlement.recalculate` | Tính lại kỳ đối soát hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.4b815164a8bb4143` | Thực hiện lao động quản lý đối tác đối soát hủy hiệu lực | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.0137e041d2b60a80` | Thực hiện lao động quản lý đối tác đối soát điều chỉnh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.db51d33ae72d81b2` | Phê duyệt lao động quản lý đối tác đối soát | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.post.92a650eadaee6bcd` | Thực hiện lao động quản lý đối tác đối soát chi trả | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.partner.payout.reverse` | Đảo khoản chi trả hoa hồng đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.get.8e68db2c21d01a51` | Xem tổng quan một đối tác lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.8ee13f2f02a5abfd` | Xem đối tác cung ứng lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.patch.4309612e371b6aa2` | Cập nhật đối tác cung ứng lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `api.delete.047cfef00a296a0d` | Xóa lao động quản lý đối tác | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |

### Quản lý lao động (31 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `worker.list` | Tra cứu người lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.create` | Tạo hồ sơ lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.bulk.create` | Tạo nhiều hồ sơ lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.bulk.delete` | Xóa mềm nhiều hồ sơ lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.update` | Cập nhật hồ sơ lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.delete` | Xóa hồ sơ lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.project.list` | Tra cứu dự án lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.project.detail` | Xem thông tin dự án lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.project.create` | Tạo dự án lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.project.update` | Cập nhật dự án lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.project.delete` | Xóa dự án lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.project.workers.add` | Thêm nhiều lao động vào dự án | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.project.worker.add` | Thêm lao động vào dự án | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.project.worker.remove` | Gỡ lao động khỏi dự án | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.labor.contract.list` | Tra cứu hợp đồng lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `api.get.975d2e3032a3229a` | Tổng hợp hợp đồng sắp hết hạn | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.labor.contract.detail` | Xem chi tiết hợp đồng lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.labor.contract.history` | Xem lịch sử gia hạn hợp đồng lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.labor.contract.create` | Tạo hợp đồng lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.labor.contract.update` | Cập nhật hợp đồng lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.labor.contract.renew` | Gia hạn hợp đồng lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.labor.contract.delete` | Xóa hợp đồng lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.attendance.mark` | Ghi nhận chấm công lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.attendance.list` | Tra cứu bảng chấm công dự án | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.attendance.update` | Điều chỉnh giờ chấm công | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.dashboard` | Xem tổng quan lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.notification.list` | Tra cứu thông báo lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.notification.create` | Gửi thông báo lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.standard-fields.list` | Tra cứu trường hồ sơ lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `worker.standard-fields.update` | Cập nhật trường hồ sơ lao động | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `worker.report` | Báo cáo chấm công và thiếu lao động theo dự án | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |

### Quản lý y tế (28 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `healthcare.overview` | Xem tổng quan y tế | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.patient.list` | Tra cứu bệnh nhân | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.patient.create` | Tạo bệnh nhân | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.patient.update` | Cập nhật bệnh nhân | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.visit.list` | Tra cứu lượt khám | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.visit.create` | Tạo lượt khám | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.visit.update` | Cập nhật lượt khám | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.appointment.list` | Tra cứu lịch hẹn khám | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.appointment.create` | Tạo lịch hẹn khám | Tạo lịch hẹn khám bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.appointment.update` | Cập nhật lịch hẹn khám | Cập nhật lịch hẹn khám bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.care.list` | Tra cứu công việc chăm sóc bệnh nhân | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.care.create` | Tạo công việc chăm sóc bệnh nhân | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.care.update` | Cập nhật công việc chăm sóc bệnh nhân | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.patient.detail` | Xem hồ sơ bệnh nhân | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.patient.bulk-delete-preview` | Xem dữ liệu liên quan trước khi xóa bệnh nhân | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.patient.bulk-delete` | Xóa bệnh nhân và dữ liệu y tế liên quan | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.visit.report` | Xem phiếu khám bệnh viện đã nhập | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.catalog.list` | Tra cứu danh mục bác sĩ, phòng khám, dịch vụ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.catalog.create` | Tạo danh mục y tế | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.catalog.update` | Cập nhật hoặc ngừng sử dụng danh mục y tế | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.staff.list` | Tra cứu nhân viên chăm sóc tại chi nhánh | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.import.list` | Tra cứu lịch sử nhập Excel y tế | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.import.detail` | Xem tiến độ và kết quả đợt nhập y tế | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.import.rows` | Tra cứu từng dòng dữ liệu nhập y tế | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `healthcare.import.commit` | Xác nhận ghi dữ liệu Excel y tế đã kiểm tra | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.import.retry` | Thử lại đợt nhập Excel y tế bị lỗi | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.import.preview` | Kiểm tra tệp Excel bệnh nhân, lượt khám hoặc báo cáo bệnh viện | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `healthcare.import.template` | Tải mẫu Excel bệnh nhân hoặc lượt khám | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |

### Báo giá (60 thao tác)

| Thao tác | Câu chuẩn | Câu probe | Kịch bản |
|---|---|---|---|
| `quotation.overview` | Xem tổng quan Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.usage` | Xem hạn mức sử dụng Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.settings.list` | Xem thông tin bên bán trong Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.settings.update` | Cập nhật thông tin bên bán trong Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.catalog.list` | Tra cứu sản phẩm trong bảng giá Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.catalog.create` | Thêm sản phẩm vào bảng giá Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.catalog.update` | Cập nhật sản phẩm trong bảng giá Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.catalog.duplicate` | Nhân bản sản phẩm trong bảng giá Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.catalog.delete` | Xóa sản phẩm trong bảng giá Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.catalog.restore` | Khôi phục sản phẩm đã xóa trong bảng giá Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.catalog.bulk` | Cập nhật hàng loạt sản phẩm trong bảng giá Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.catalog.import-preview` | Kiểm tra bảng giá Excel/CSV trước khi nhập | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.catalog.import` | Nhập bảng giá Excel/CSV đã kiểm tra | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.price-list.list` | Tra cứu các tệp bảng giá đã nhập | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.template.list` | Tra cứu mẫu báo giá, dự toán, hợp đồng, nghiệm thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.template.update` | Chuyển loại mẫu tài liệu Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.template.delete` | Xóa mẫu tài liệu Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.template.download` | Tải mẫu tài liệu Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.request.list` | Tra cứu yêu cầu lập dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.request.create` | Tạo yêu cầu lập dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.request.analyze` | Phân tích yêu cầu lập dự toán bằng AI | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.customer-quote.suggest` | Đề xuất sản phẩm cho báo giá khách hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.quote.list` | Tra cứu báo giá và dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.quote.detail` | Xem chi tiết báo giá hoặc dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.customer-quote.create` | Lập báo giá khách hàng từ bảng giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.estimate.create` | Lập dự toán từ yêu cầu đã phân tích | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.estimate.from-customer` | Lập dự toán từ báo giá khách hàng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.quote.update` | Cập nhật hoặc bổ sung báo giá, dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.quote.submit-review` | Gửi duyệt báo giá hoặc dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.quote.approve` | Duyệt báo giá hoặc dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.quote.reject` | Trả lại báo giá hoặc dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.quote.recalculate` | Tính lại bằng AI báo giá hoặc dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.quote.export-retry` | Thử tạo lại file báo giá hoặc dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.quote.delete` | Xóa báo giá hoặc dự toán | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.budget.list` | Tra cứu phương án dự toán theo ngân sách | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.budget.create` | Đề xuất phương án dự toán theo ngân sách | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.budget.quantity` | Xác nhận số lượng sản phẩm trong phương án ngân sách | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.budget.answer` | Trả lời câu hỏi của phương án ngân sách | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.budget.assumption` | Xác nhận hoặc sửa giả định của phương án ngân sách | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.budget.missing` | Bổ sung hạng mục còn thiếu vào phương án ngân sách | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.budget.recalculate` | Tính lại phương án dự toán theo ngân sách | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.contract.list` | Tra cứu hợp đồng trong Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.contract.detail` | Xem chi tiết hợp đồng Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.contract.create` | Tạo hợp đồng từ dự toán đã duyệt | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.contract.update` | Cập nhật hợp đồng Báo giá đang nháp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.contract.sign` | Xác nhận đã ký hợp đồng Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.acceptance.list` | Tra cứu biên bản nghiệm thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.acceptance.detail` | Xem chi tiết biên bản nghiệm thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.acceptance.create` | Lập biên bản nghiệm thu từ hợp đồng đã ký | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.acceptance.update` | Cập nhật biên bản nghiệm thu đang nháp | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.acceptance.complete` | Hoàn tất biên bản nghiệm thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| `quotation.quote.export` | Xuất file báo giá hoặc dự toán theo mẫu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.quote.pdf` | Xuất PDF báo giá đã duyệt | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.budget.export` | Xuất file phương án ngân sách | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.contract.export` | Xuất file hợp đồng | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.acceptance.export` | Xuất file biên bản nghiệm thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.acceptance.settlement` | Xuất file quyết toán nghiệm thu | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.file.list` | Tra cứu file đã tạo trong Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.file.download` | Tải file đã tạo trong Báo giá | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |
| `quotation.export.latest` | Xem tiến độ và file xuất mới nhất của chứng từ | Giống câu chuẩn | missing-data, unknown-condition, cancel, invalid-data, api-rejection-probe, success-probe |

## Số lần xuất hiện của các câu đã gộp

Bảng này liệt kê toàn bộ câu đầu vào khác nhau trong ma trận hội thoại. Cột số lần cho biết câu được tái sử dụng trên bao nhiêu ca; câu chuẩn và câu probe có thể cùng thuộc một thao tác.

| Câu đầu vào | Số ca | Phân hệ | Kịch bản |
|---|---:|---|---|
| Áp dụng chính sách lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Báo cáo chấm công và thiếu lao động theo dự án | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo điểm danh lớp học theo ngày | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo hợp đồng nhân sự sắp hết hạn | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo KPI công việc theo tháng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo nhân sự chưa chấm công hôm nay | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo nhân sự chưa có hợp đồng hiệu lực | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo nhân sự đi muộn hôm nay | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo nhân sự nghỉ phép hôm nay | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo nhân sự vắng hôm nay | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo sinh nhật nhân sự tháng tới | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo tiến độ đào tạo nội bộ chưa hoàn thành | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo tình hình nhân sự hôm nay | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo toàn bộ tiến độ đào tạo nội bộ | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo tổng quan chấm công hôm nay | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo cáo tuyển dụng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Báo giá phiếu sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Bắt đầu kiểm kê kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Bắt đầu nhận hàng vào kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Bổ sung hạng mục còn thiếu vào phương án ngân sách | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cài đặt lịch phát hành đối soát lương | 3 | Nhân sự | missing-data, unknown-condition, invalid-data |
| Cài đặt lịch phát hành đối soát lương monthly schedule enabled | 3 | Nhân sự | api-rejection-probe, success-probe, cancel-preview |
| Cáº¥u hÃ¬nh thÃ´ng bÃ¡o phiáº¿u sá»­a chá»¯a | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật bệnh nhân | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật biên bản nghiệm thu đang nháp | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật biến dữ liệu đầu vào bảng lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật ca làm việc | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật cài đặt bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật cài đặt cảnh báo hợp đồng nhân sự | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật cài đặt email chúc mừng | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật cấu hình hoa hồng | 6 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật cấu hình hoa hồng bán lẻ | 6 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật chi nhánh | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật chính sách hoa hồng đối tác lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật chính sách lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật chính sách tích điểm bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật công thức tính lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật công việc | 3 | Nhân sự | missing-data, unknown-condition, invalid-data |
| Cập nhật công việc bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | 3 | Nhân sự | api-rejection-probe, success-probe, cancel-preview |
| Cập nhật công việc chăm sóc bệnh nhân | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật danh mục kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật dòng kiểm kê kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật dự án | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật dự án lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật dữ liệu dùng chung cho sản phẩm | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật dữ liệu đầu vào lương hàng loạt | 7 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview, stale-version |
| Cập nhật dữ liệu đầu vào lương nhân sự | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật đánh giá học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật địa điểm và khung giờ chấm công | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật điểm danh một học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật đối tác bán lẻ | 6 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật đối tác cung ứng lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật đơn nháp bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật đợt học phí của học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật giá nhập và giá bán SKU | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật giờ làm nhân viên | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật hàng loạt sản phẩm trong bảng giá Báo giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật hoạt động công việc | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật hoặc bổ sung báo giá, dự toán | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật hoặc ngừng sử dụng danh mục y tế | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật hồ sơ học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật hồ sơ lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật hồ sơ ứng viên | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật hợp đồng Báo giá đang nháp | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật hợp đồng lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật hợp đồng nhân sự | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật kế hoạch tài chính và điểm hòa vốn | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật kết quả một thí sinh | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật khóa đào tạo | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật khóa học | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật kỳ thi | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật lịch hẹn khám | 3 | Quản lý y tế | missing-data, unknown-condition, invalid-data |
| Cập nhật lịch hẹn khám bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | 3 | Quản lý y tế | api-rejection-probe, success-probe, cancel-preview |
| Cập nhật lịch phỏng vấn | 3 | Nhân sự | missing-data, unknown-condition, invalid-data |
| Cập nhật lịch phỏng vấn bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | 3 | Nhân sự | api-rejection-probe, success-probe, cancel-preview |
| Cập nhật lĩnh vực đào tạo của tài khoản đang đăng nhập | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật lộ trình học | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật lớp học | 3 | Quản lý học viên | missing-data, unknown-condition, invalid-data |
| Cập nhật lớp học location QA Room | 3 | Quản lý học viên | api-rejection-probe, success-probe, cancel-preview |
| Cập nhật lượt khám | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật màu đánh giá tiến độ lớp | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật mẫu sản phẩm | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật mini test của học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật một trường tiêu chuẩn | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật ngày trong lịch công ty | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật ngưỡng đánh giá chất lượng học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật nhà cung cấp | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật nhân sự | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật nhiều SKU | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật phân quyền vai trò | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật phiếu nhập kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật phòng ban | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật quy trình làm việc | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật quyết định học tiếp hoặc bảo lưu | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật sản phẩm trong bảng giá Báo giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật số dư VAT chuyển kỳ | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật sự kiện nội bộ | 3 | Nhân sự | missing-data, unknown-condition, invalid-data |
| Cập nhật sự kiện nội bộ bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | 3 | Nhân sự | api-rejection-probe, success-probe, cancel-preview |
| Cập nhật tài chính quản lý cài đặt | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật tài sản cố định | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật thông tin bên bán trong Báo giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật thông tin chuyển khoản đối tác | 6 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật thông tin liên hệ đối tác | 6 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật thông tin sản phẩm | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật thông tin SKU | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật thời hạn bảo hành cho thiết bị | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật trạng thái chăm sóc khách hàng | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật trạng thái học viên trong lớp | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật trạng thái IMEI hoặc serial | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật trạng thái phiếu sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật trường dữ liệu tùy chỉnh | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật trường hồ sơ lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cập nhật vị trí tuyển dụng | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cấu hình hoa hồng cho đối tác | 1 | Đối tác | unavailable-operation |
| Cấu hình hoa hồng SKU cho cộng tác viên | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Cấu hình hoa hồng theo sản phẩm | 6 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chạy nhắc công nợ bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chấm điểm bài tập | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chấm hoặc cập nhật điểm bài tập | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chi trả hoa hồng cộng tác viên | 6 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chọn email nhắc công nợ lỗi tạm thời để thử lại | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Chọn học viên đủ điều kiện của lớp trong kỳ thi | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Chọn học viên trong lớp để cập nhật điểm danh | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Chọn thí sinh trong kỳ thi | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Chọn thông báo nhắc công nợ nội bộ cần thử lại | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Chốt hoặc mở lại kỳ tài chính | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chốt kỳ sổ quỹ bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chốt lượt lương đã duyệt | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chốt phiên kiểm kê tài sản | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chuyển bước tuyển dụng cho ứng viên | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chuyển học viên chưa gán chi nhánh | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chuyển học viên lên lớp tiếp theo | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chuyển IMEI hoặc serial giữa các kho trong chi nhánh | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chuyển loại mẫu tài liệu Báo giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chuyển quầy hoặc két tiền cho ca bán hàng | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Chuyển tài sản sang chi nhánh | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Công bố phiếu lương trong ứng dụng | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Danh sách nhân sự theo phòng ban | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Danh sách phòng ban chưa có quản lý | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Duyệt báo giá hoặc dự toán | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Duyệt báo giá sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Duyệt hoặc từ chối phiếu thu chi | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đánh dấu đợt học phí đã thu | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đánh dấu khoản thu POS đã kiểm tra | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đánh dấu lượt lương đã thanh toán | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đảo khoản chi trả hoa hồng đối tác lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đảo khoản thu hoặc điều chỉnh phải thu | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đảo phiếu xuất kho thủ công | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đảo xác nhận đợt thanh toán lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đăng ký IMEI hoặc serial vào tồn kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đặt KPI giới thiệu cho đối tác lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đặt lại kỳ lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đặt lịch phòng học hoặc thiết bị | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đề xuất phương án dự toán theo ngân sách | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đề xuất sản phẩm cho báo giá khách hàng | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đếm số nhân sự trong công ty hoặc chi nhánh | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Điều chỉnh dữ liệu chấm công | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Điều chỉnh điểm khách hàng | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Điều chỉnh giờ chấm công | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Điều chỉnh khoản phải thu | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đóng ca thu ngân POS | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đổi cách quản lý danh mục sản phẩm | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đối chiếu học phí học viên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Đối chiếu tiền đã thu trên phiếu sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Đối soát ca thu ngân POS | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đối soát công nợ bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đối soát dữ liệu tồn kho | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Đối soát hoa hồng cộng tác viên | 6 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đối soát sổ quỹ bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Đổi trạng thái vị trí tuyển dụng | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đồng bộ công vào lượt chạy lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Đồng bộ lịch nghỉ lễ đã được duyệt | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gá»­i láº¡i thÃ´ng bÃ¡o phiáº¿u sá»­a chá»¯a | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gán học viên đủ điều kiện vào kỳ thi | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghép giao dịch ngân hàng với phiếu thu chi | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi đè các khoản lương theo nhân viên | 7 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview, stale-version |
| Ghi nhận chấm công lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận chi phí | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận chi trả hoa hồng đối tác | 6 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận công nợ | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận đánh giá sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận đối soát quỹ | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận hóa đơn VAT | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận hoàn tiền sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận kết quả kiểm kê tài sản | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận khoản thu học phí | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận rà soát giao dịch chuyển khoản | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận thanh toán công nợ | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận thanh toán sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận trao đổi chăm sóc khách hàng | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận VAT thủ công | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi nhận VAT từ hóa đơn bán lẻ | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi sổ khấu hao tài sản | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi thu hoặc chi tiền mặt trong ca POS | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ghi xóa khoản phải thu | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gia hạn hợp đồng lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gia hạn hợp đồng nhân sự | 12 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gia hạn khoản phải thu | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Giao thiết bị sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gỡ học viên khỏi kỳ thi và xóa mục lịch sử thi | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gỡ lao động khỏi dự án | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gửi duyệt báo giá hoặc dự toán | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gửi email theo yêu cầu | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gửi email thử SMTP | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gửi IMEI hoặc serial sang chi nhánh | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gửi lượt lương sang chờ duyệt | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gửi mã điểm danh trực tuyến cho lớp | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gửi phiếu kiểm kê để duyệt | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gửi phiếu nhập xác nhận | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Gửi thông báo lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hoàn linh kiện sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hoàn tất biên bản nghiệm thu | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hủy chi nhánh chưa thiết lập chủ | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hủy điều chuyển IMEI hoặc serial | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hủy đơn bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hủy đợt thanh toán lương nháp | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hủy lịch đặt phòng học hoặc thiết bị | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hủy phiếu điều chuyển kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hủy phiếu kiểm kê | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hủy phiếu nhập kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hủy phiếu sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Hủy yêu cầu này | 735 | Nhân sự, Kho & Sản phẩm, Sửa chữa & bảo hành, Tài chính, Quản lý học viên, Đối tác, Bán lẻ & POS, Đối tác bán lẻ, Đối tác lao động, Quản lý lao động, Quản lý y tế, Báo giá | cancel |
| Khóa snapshot công của lượt lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Khôi phục hồ sơ ứng viên | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Khôi phục lịch phỏng vấn | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Khôi phục sản phẩm đã xóa trong bảng giá Báo giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Khôi phục trường dữ liệu tùy chỉnh | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Khôi phục vị trí tuyển dụng | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Kích hoạt biến dữ liệu đầu vào bảng lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Kích hoạt chính sách hoa hồng đối tác lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Kích hoạt công thức tính lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Kiểm tra bảng giá Excel/CSV trước khi nhập | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Kiểm tra danh sách học viên trước khi nhập | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Kiểm tra kết nối SMTP công ty | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Kiểm tra kết nối TikTok Shop | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Kiểm tra tệp Excel bệnh nhân, lượt khám hoặc báo cáo bệnh viện | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Kiểm tra tình trạng thanh toán đơn hàng | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Lập báo giá khách hàng từ bảng giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Lập biên bản nghiệm thu từ hợp đồng đã ký | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Lập dự toán từ báo giá khách hàng | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Lập dự toán từ yêu cầu đã phân tích | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Lập kế hoạch khấu hao tài sản | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Lập phiếu thu, chi hoặc chuyển quỹ | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Lưu trữ trường dữ liệu tùy chỉnh | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Mở ca thu ngân POS | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Mở lại lượt lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Mở phiên kiểm kê tài sản tại chi nhánh | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ngày nghỉ trong tháng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Ngừng áp dụng chính sách hoa hồng đối tác lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ngừng biến dữ liệu đầu vào bảng lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ngừng chính sách lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Ngừng công thức tính lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Nhân bản sản phẩm trong bảng giá Báo giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Nhận IMEI hoặc serial được điều chuyển | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Nhận phiếu điều chuyển kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Nhân sự chưa chấm công trong tháng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Nhân sự chưa đủ ngưỡng công trong tháng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Nhân sự còn ít nhất số ngày phép được yêu cầu | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Nhân sự đã hết phép năm | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Nhân sự nghỉ nhiều nhất trong tháng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Nhân sự nghỉ phép nhiều nhất trong tháng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Nhập bảng giá Excel/CSV đã kiểm tra | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Nhập giao dịch ngân hàng để đối soát | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Nhập hoặc cập nhật điểm thi | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Nộp bài thay cho học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Phản hồi hoặc xử lý khiếu nại lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Phản hồi yêu cầu kiểm tra phiếu lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Phát hành bảng lương tạm tính để đối soát | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Phân ca cho nhân viên | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Phân công kỹ thuật viên sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Phân tích AI | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Phân tích đối tác học viên | 5 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Phân tích hoa hồng đối tác bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Phân tích KPI và số lao động giới thiệu của đối tác | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Phân tích yêu cầu lập dự toán bằng AI | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Phê duyệt khoản điều chỉnh lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Phê duyệt kiểm kê và cập nhật tồn kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Phê duyệt lao động quản lý đối tác đối soát | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Quét mã vào phiếu kiểm kê | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Rà soát và xếp hàng nhắc công nợ quá hạn | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Sao chép chính sách hoa hồng đối tác lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Sao chép chính sách lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Sao chép công thức tính lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Sửa bản ghi thông báo học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Sửa phòng học hoặc thiết bị | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Sửa thông tin giao dịch học phí | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tải file đã tạo trong Báo giá | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tải mẫu Excel bệnh nhân hoặc lượt khám | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tải mẫu tài liệu Báo giá | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tạm dừng ca POS của bạn | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạm dừng nhắc khoản phải thu | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo bài kiểm tra ngắn cho học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo bài tập cho lớp | 3 | Quản lý học viên | missing-data, unknown-condition, invalid-data |
| Tạo bài tập cho lớp bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | 3 | Quản lý học viên | api-rejection-probe, success-probe, cancel-preview |
| Tạo bản ghi thông báo học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo bản nháp lượt chạy lương định kỳ | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo báo cáo vận hành chi phí | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo bệnh nhân | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo biến dữ liệu đầu vào bảng lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo ca làm việc | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo cấu hình hoa hồng | 6 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo cấu hình hoa hồng bán lẻ | 6 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo chi nhánh | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo chính sách hoa hồng đối tác lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo chính sách lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo cộng tác viên bán lẻ | 6 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo cộng tác viên giới thiệu học viên | 6 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo cộng tác viên lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo công thức tính lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo công việc | 3 | Nhân sự | missing-data, unknown-condition, invalid-data |
| Tạo công việc bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | 3 | Nhân sự | api-rejection-probe, success-probe, cancel-preview |
| Tạo công việc chăm sóc bệnh nhân | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo danh mục kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo danh mục y tế | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo dự án | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo dự án lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo dữ liệu danh mục kho mặc định | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo đại lý bán lẻ | 6 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo đơn nháp bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo đơn vị tính | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo đợt học phí cho học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo đợt thanh toán lương nháp | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo hồ sơ học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo hồ sơ lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo hợp đồng lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo hợp đồng nhân sự | 12 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo hợp đồng từ dự toán đã duyệt | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo khóa đào tạo | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo khóa học cho học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo khoản điều chỉnh lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo kỳ thi | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo lại phiếu kiểm kê bị xung đột | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo lịch hẹn khám | 3 | Quản lý y tế | missing-data, unknown-condition, invalid-data |
| Tạo lịch hẹn khám bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | 3 | Quản lý y tế | api-rejection-probe, success-probe, cancel-preview |
| Tạo lịch phỏng vấn | 3 | Nhân sự | missing-data, unknown-condition, invalid-data |
| Tạo lịch phỏng vấn bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | 3 | Nhân sự | api-rejection-probe, success-probe, cancel-preview |
| Tạo liên kết đánh giá cho phiếu sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo lộ trình học | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo lớp học | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo lượt khám | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo mã ưu đãi | 3 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data |
| Tạo mã ưu đãi bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | 3 | Bán lẻ & POS | api-rejection-probe, success-probe, cancel-preview |
| Tạo mẫu sản phẩm | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo nhà cung cấp bán lẻ | 6 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo nhãn phân loại quy trình | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo nhân sự | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo nhiều đối tác | 6 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo nhiều hồ sơ học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo nhiều hồ sơ lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo phân loại khóa học | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo phiếu điều chuyển kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo phiếu đổi trả hoặc thu mua bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo phiếu kiểm kê kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo phiếu nhập kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo phiếu sửa chữa dịch vụ | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo phiếu thu chi sổ quỹ bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo phiếu thu hoặc chi tài chính | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo phòng ban | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo quầy hoặc két POS | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo quỹ tiền mặt hoặc tài khoản ngân hàng | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo quy trình làm việc | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo sản phẩm và SKU kèm giá bán | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo sản phẩm với nhiều SKU | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo sự kiện nội bộ | 3 | Nhân sự | missing-data, unknown-condition, invalid-data |
| Tạo sự kiện nội bộ bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày | 3 | Nhân sự | api-rejection-probe, success-probe, cancel-preview |
| Tạo tài chính quản lý khoản phải trả | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo tài chính quản lý theo dõi | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo tài sản cố định | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo thể loại / thư mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo trường dữ liệu tùy chỉnh | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo và thanh toán đơn bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo vị trí tuyển dụng | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tạo yêu cầu lập dự toán | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thanh lý tài sản cố định | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thêm học viên vào lớp | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thêm lao động vào dự án | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thêm loại phòng học, thiết bị hoặc tài nguyên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thêm ngày nghỉ hoặc ngày làm việc ngoại lệ | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thêm nhiều lao động vào dự án | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thêm nhiều SKU cho sản phẩm | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thêm phòng học hoặc thiết bị | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thêm sản phẩm vào bảng giá Báo giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thêm SKU kèm giá bán | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thêm ứng viên | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thống kê lượt đi làm trễ trong tháng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Thống kê số dư phép năm nhân sự | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Thống kê số phép năm còn lại của nhân sự | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Thu hồi phiếu lương đã công bố | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thu thêm tiền đơn bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thu tiền khoản phải thu | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thử lại đợt nhập Excel y tế bị lỗi | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thử lại email nhắc công nợ lỗi tạm thời | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thử lại thông báo công nợ nội bộ | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thử tạo lại file báo giá hoặc dự toán | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thực hiện lao động quản lý đối tác đối soát chi trả | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thực hiện lao động quản lý đối tác đối soát điều chỉnh | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thực hiện lao động quản lý đối tác đối soát hủy hiệu lực | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thực hiện lao động quản lý đối tác giới thiệu | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thực hiện lao động quản lý đối tác giới thiệu kết thúc | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Thực hiện tài chính quản lý phiếu thu chi đảo giao dịch | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tiếp tục ca POS của bạn trên thiết bị hiện tại | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tìm khách hàng để tra cứu điểm thưởng | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tìm phiếu chi đủ điều kiện hoàn tiền sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tìm thiết bị có nguy cơ thiếu thông tin bảo hành | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tìm thiết bị sắp hết hạn bảo hành | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tìm thiết bị theo số sê-ri để bán | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tính đối soát hoa hồng đối tác lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tính lại bằng AI báo giá hoặc dự toán | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tính lại kỳ đối soát hoa hồng đối tác lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tính lại lương cho lượt đã khóa công | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tính lại phương án dự toán theo ngân sách | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tính lương cho lượt đã khóa công | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tính thử đơn bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tổng hợp chấm công theo tháng | 10 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tổng hợp doanh số bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tổng hợp đánh giá khách hàng sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tổng hợp hóa đơn bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tổng hợp hợp đồng sắp hết hạn | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tổng hợp khiếu nại bảng lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tổng hợp khoản phải thu theo khách hàng | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tổng hợp lịch sử email chúc mừng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tổng hợp tất cả nhân sự nghỉ phép trong tháng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tổng hợp tuổi nợ phải thu | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra các quỹ tiền mặt và tài khoản ngân hàng | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu bài kiểm tra ngắn của học viên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu bài tập trong lớp | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu bảng chấm công dự án | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu báo giá và dự toán | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu bảo hành theo mã thiết bị | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu bảo hành theo số điện thoại khách hàng | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu bệnh nhân | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu biên bản nghiệm thu | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu biến dữ liệu đầu vào bảng lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu ca làm việc | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu ca thu ngân POS | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu các bước tuyển dụng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu các đợt học phí của học viên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu các đợt thanh toán lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu các khoản lương được ghi đè thủ công | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu các lần xác thực điểm danh | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu các tệp bảng giá đã nhập | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu cấu hình hoa hồng | 5 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu cấu hình hoa hồng bán lẻ | 5 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu cấu hình quyền theo vai trò | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu chặng của lộ trình | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu chấm công hôm nay của tôi | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu chấm công nhân sự trong ngày | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu chất lượng học viên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu chi nhánh | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu chính sách hoa hồng đối tác lao động | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu chính sách lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu chính sách tích điểm bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu chứng từ đổi trả và thu mua | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu công nợ | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu công thức tính lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu công việc | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu công việc chăm sóc bệnh nhân | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu danh mục bác sĩ, phòng khám, dịch vụ | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu danh mục kho | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu danh mục khóa học | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu danh mục quyền hệ thống | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu danh mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu dự án | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu dự án lao động | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu dữ liệu đầu vào kỳ lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu đánh giá sau sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu địa điểm và khung giờ chấm công | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu điểm hòa vốn và kế hoạch tài chính | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu đối soát lương của tôi | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu đối tác | 5 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu đối tác bán lẻ | 5 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu đối tác cung ứng lao động | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu đối tác giới thiệu của người lao động | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu đơn bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu đơn nghỉ phép và làm việc từ xa | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu file đã tạo trong Báo giá | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu giá bán và giá vốn SKU | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu giao dịch chuyển khoản chờ rà soát | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu giao dịch học phí | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu giờ làm nhân viên | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu hạng khách hàng để áp dụng mã ưu đãi | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu hóa đơn bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu hóa đơn VAT | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu học viên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu học viên chưa có chi nhánh | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu học viên trong danh sách chờ lộ trình | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu học viên và trạng thái ghi danh trong lớp | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu hợp đồng lao động | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu hợp đồng nhân sự | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu hợp đồng nhân sự để chọn hợp đồng cần gia hạn | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu hợp đồng trong Báo giá | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu IMEI, serial và mã đơn vị | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu khách hàng đại lý | 5 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu khấu hao tài sản theo kỳ | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu kho | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu kho để đối soát tồn | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu khóa đào tạo | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu khóa học | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu khoản điều chỉnh lương trong kỳ | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu khoản phải thu | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu khoản phải thu, phải trả và phiếu nhập chưa ghi công nợ | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu khoản thu POS chưa đối soát | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu kỳ đối soát hoa hồng đối tác lao động | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu kỳ tài chính | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu kỳ thi | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lần chấm công bị từ chối | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch đặt phòng học hoặc tài nguyên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch hẹn khám | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch lớp, kỳ thi và lịch đặt tài nguyên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch ngày lễ và lịch làm việc công ty | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch phát hành đối soát lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch phỏng vấn | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch sử công nợ bán lẻ của khách hàng | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch sử gia hạn hợp đồng nhân sự | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch sử nhắc công nợ bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch sử nhập Excel y tế | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lịch sử sửa chữa theo khách hoặc thiết bị | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu linh kiện đã xuất cho phiếu sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu loại phòng học, thiết bị và tài nguyên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lộ trình học | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lớp học | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lượt chạy lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu lượt khám | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu mã ưu đãi có thể áp dụng | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu mẫu báo giá, dự toán, hợp đồng, nghiệm thu | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu mẫu sản phẩm | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu một giao dịch thanh toán sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu mức hoa hồng theo sản phẩm | 5 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu ngày nghỉ theo tên | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu người lao động | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu người lao động được đối tác giới thiệu | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu nhà cung cấp | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu nhà cung cấp liên kết | 5 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu nhân sự | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu nhân viên chăm sóc tại chi nhánh | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu nhân viên thu ngân | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu nhóm hàng có thể bán | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phân ca nhân viên | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phiên kiểm kê tài sản | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phiếu điều chuyển kho | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phiếu kiểm kê kho | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phiếu lương của tôi | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phiếu nhập kho | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phiếu nhập xuất kho | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phiếu sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phiếu sửa chữa theo số sê-ri thiết bị | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phòng ban | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phòng học, thiết bị và tài nguyên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu phương án dự toán theo ngân sách | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu quầy và két POS | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu quy trình làm việc | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu sản phẩm | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu sản phẩm bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu sản phẩm trong bảng giá Báo giá | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu sản phẩm và SKU để cấu hình hoa hồng | 5 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu số dư hoàn tiền sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu số dư phép năm của tôi | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu sổ quỹ bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu sự kiện nội bộ và lịch hôm nay | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu tài khoản cộng tác viên | 5 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu tài sản cố định | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu thiết bị đã bán theo mã | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu thiết bị đã bán và thời hạn bảo hành | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu thông báo học viên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu thông báo lao động | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu thông tin phòng ban | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu tình trạng nộp bài | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu trạng thái đối soát lương của nhân viên | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu trường dữ liệu tùy chỉnh | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu trường hồ sơ lao động | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu trường tiêu chuẩn | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu từng dòng dữ liệu nhập y tế | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu ứng viên | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu vị trí tuyển dụng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu yêu cầu kiểm tra phiếu lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu yêu cầu kiểm tra phiếu lương của tôi | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra cứu yêu cầu lập dự toán | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Tra giao dịch ngân hàng chờ đối soát | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Trả lại báo giá hoặc dự toán | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Trả lời câu hỏi của phương án ngân sách | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Tra phiếu thu chi | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Từ chối khoản điều chỉnh lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xác nhận đã ký hợp đồng Báo giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xác nhận đơn nháp bán lẻ | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xác nhận đợt thanh toán lương đã chuyển tiền | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xác nhận ghi dữ liệu Excel y tế đã kiểm tra | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xác nhận hoặc sửa giả định của phương án ngân sách | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xác nhận hoặc trao đổi về đối soát lương của tôi | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xác nhận nhập kho và cập nhật tồn | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xác nhận referral của người lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xác nhận số lượng sản phẩm trong phương án ngân sách | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xem bảng kê hoa hồng cộng tác viên bán lẻ | 5 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem báo cáo chi phí | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem báo cáo doanh thu | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem báo cáo hoa hồng đối tác lao động | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem báo cáo lãi lỗ | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem báo cáo lợi nhuận tài chính | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem báo cáo tài chính quản trị | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem ca POS hiện tại | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem các lượt rà soát công nợ quá hạn | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem cài đặt cảnh báo hợp đồng nhân sự | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem cấu hình quyền của một vai trò | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem cấu hình thông báo sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chênh lệch kiểm kê tài sản | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi phí vận hành | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chỉ số công việc theo tháng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết báo giá hoặc dự toán | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết biên bản nghiệm thu | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết ca thu ngân | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết đơn bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết hóa đơn bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết hợp đồng Báo giá | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết hợp đồng lao động | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết IMEI hoặc serial | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết khóa học | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết kỳ đối soát hoa hồng đối tác lao động | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết lương nhân viên | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết lượt rà soát nhắc công nợ | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết một quyền hệ thống | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết phiếu điều chuyển kho | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết phiếu sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết phòng học hoặc thiết bị | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chi tiết sản phẩm và SKU | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chính sách hoa hồng cộng tác viên bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chính sách hoa hồng đối tác lao động | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem chứng từ đổi trả hoặc thu mua | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem danh sách cộng tác viên bán lẻ | 5 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem doanh thu sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem dữ liệu liên quan trước khi xóa bệnh nhân | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem điểm thưởng của khách hàng | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem điều kiện và quyết định lên lớp | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem đối tác cung ứng lao động | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem hạn mức sử dụng Báo giá | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem hiệu suất kỹ thuật viên sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem hoa hồng bán lẻ của tôi | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem học viên đang được gán vào kỳ thi | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem hồ sơ bệnh nhân | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem hồ sơ cộng tác viên bán lẻ của tôi | 5 | Đối tác bán lẻ | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem hồ sơ ứng viên | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem kết quả chấm công dùng để tính lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem kết quả đối soát công nợ bán lẻ gần nhất | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem khoản phải thu và các bút toán có thể đảo | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem lịch khấu hao tài sản | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem lịch phỏng vấn | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem lịch sử chăm sóc của phiếu sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem lịch sử chăm sóc khách hàng sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem lịch sử gia hạn hợp đồng lao động | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem lịch sử IMEI hoặc serial | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem lịch sử thay đổi ngày trong lịch công ty | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem lịch sử tuyển dụng ứng viên | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem loại hồ sơ đang áp dụng | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem lỗi và cảnh báo của lượt lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem lợi nhuận bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem màu đánh giá tiến độ lớp | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem mức sử dụng linh kiện sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem ngưỡng đánh giá chất lượng học viên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem nhật ký thao tác của một lượt lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem nhật ký xử lý của kỳ lương | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem phiên kiểm kê tài sản | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem phiếu khám bệnh viện đã nhập | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem phiếu kiểm kê kho | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tài sản cố định | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thiết lập bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thiết lập in hóa đơn bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thống kê lượt nhắc công nợ bán lẻ | 5 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thông tin bên bán trong Báo giá | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thông tin chi tiết nhân sự | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thông tin chung về sản phẩm và kho hàng | 5 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thông tin dự án lao động | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thông tin đối tác | 5 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thông tin học viên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thông tin kỳ thi | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem thông tin lớp học | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tiến độ học tập của học viên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tiến độ và file xuất mới nhất của chứng từ | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tiến độ và kết quả đợt nhập y tế | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tin nhắn đã gửi về phiếu sửa chữa | 5 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tóm tắt cài đặt email chúc mừng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tóm tắt cấu hình SMTP công ty | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tổng hợp khoản phải thu theo hạn | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tổng quan Báo giá | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tổng quan hoạt động doanh nghiệp | 10 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tổng quan lao động | 5 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tổng quan một đối tác lao động | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tổng quan quyết toán đối tác lao động | 5 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tổng quan tài chính | 5 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem tổng quan y tế | 5 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem trước ảnh hưởng khi xóa học viên | 5 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem trước email chúc mừng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem vị trí tuyển dụng | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xem việc cần xử lý hôm nay | 5 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xếp học viên trong danh sách chờ vào lớp | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa bản ghi thông báo học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa bán lẻ đơn hàng | 6 | Bán lẻ & POS | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa báo cáo vận hành chi phí | 6 | Tài chính | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa báo giá hoặc dự toán | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa bệnh nhân và dữ liệu y tế liên quan | 6 | Quản lý y tế | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa ca làm việc | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa cấp bậc hoa hồng | 6 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa chấm công công việc lịch làm việc | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa chính sách hoa hồng đối tác lao động | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa chính sách lương | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa công việc | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa danh mục kho | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa danh mục khóa học | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa dự án | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa dự án lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa dữ liệu danh mục sản phẩm | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa điểm danh của lớp trong ngày | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa điểm mini test của học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa đối tác giới thiệu | 6 | Đối tác | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa giao dịch học phí | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa học viên khỏi lớp | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa hồ sơ lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa hợp đồng lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa kho hàng danh mục sản phẩm | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa khóa đào tạo nội bộ | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa khóa học | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa kỳ thi | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa lao động quản lý đối tác | 6 | Đối tác lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa lịch phỏng vấn | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa loại phòng học, thiết bị hoặc tài nguyên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa lộ trình học | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa lớp học | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa mẫu tài liệu Báo giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa mềm hồ sơ ứng viên | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa mềm nhiều hồ sơ lao động | 6 | Quản lý lao động | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa mềm vị trí tuyển dụng | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa nhà cung cấp | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa nhiều hồ sơ học viên | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa nhiều SKU | 6 | Kho & Sản phẩm | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa phòng ban | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa phòng học hoặc thiết bị | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa quy trình làm việc | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa sản phẩm trong bảng giá Báo giá | 6 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa tài khoản nhân sự | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xóa trường dữ liệu tùy chỉnh | 6 | Quản lý học viên | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xuất file báo giá hoặc dự toán theo mẫu | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xuất file biên bản nghiệm thu | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xuất file hợp đồng | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xuất file phương án ngân sách | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xuất file quyết toán nghiệm thu | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Xuất linh kiện cho phiếu sửa chữa | 6 | Sửa chữa & bảo hành | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
| Xuất PDF báo giá đã duyệt | 5 | Báo giá | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe |
| Yêu cầu kiểm tra lại phiếu lương của tôi | 6 | Nhân sự | missing-data, unknown-condition, invalid-data, api-rejection-probe, success-probe, cancel-preview |
