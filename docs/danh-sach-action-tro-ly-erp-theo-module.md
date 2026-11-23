# Danh sách action trợ lý ERP theo module

Ngày xuất: 23/11/2026. Nguồn: catalog đã được hợp nhất lúc import `ASSISTANT_OPERATIONS` trong working tree hiện tại, không chỉ file catalog sinh tự động.

Tổng: **1004 action**, **1003 khả dụng trong catalog**, **1 bị đánh dấu không khả dụng**, thuộc **21/22 mã module**.

## Cách đọc

- `actionId` là mã thao tác mà AI trả về; server dùng mã này để tra hợp đồng thực thi. Mã `api.*` là ID sinh tự động, vẫn được liệt kê nguyên văn để tham chiếu.
- Module là phân hệ chính `op.module`; không nhân đôi một action khi nó khai báo thêm scope module hoặc góc nhìn chức năng.
- Nhóm chức năng lấy từ metadata dùng cho bước chọn nhóm của AI. Các góc nhìn phụ `functionAreas` không tạo thêm action.
- Đọc/ghi lấy từ `assistantMetadata.effect`: một số POST có thể là thao tác chỉ đọc. Không suy luận chỉ bằng HTTP method.
- Cột xác nhận là cờ bắt buộc trong catalog. Cài đặt `alwaysConfirm`, workflow và điều kiện runtime có thể yêu cầu thêm; dấu — không có nghĩa là được phép bỏ xác nhận ở mọi môi trường.
- Khả dụng trong catalog chưa đồng nghĩa tài khoản đang được phép chạy. Runtime còn kiểm tra bật/tắt phân hệ, workflow, quyền, vai trò, công ty/chi nhánh, dữ liệu và cấu hình.
- Đây là kiểm kê tĩnh, không phải chứng nhận mọi action đã chạy đúng end-to-end. Không gọi AI, API nghiệp vụ hoặc DB khi xuất tài liệu.
- Đường dẫn API giữ đúng giá trị trong catalog; adapter có thể xử lý nội bộ thay vì gọi HTTP trực tiếp.

## Tổng hợp theo module

| Module | Mã module | Tổng | Đọc | Ghi | Không khả dụng |
| --- | --- | ---: | ---: | ---: | ---: |
| [Nhân sự](#module-hr) | `hr` | 198 | 95 | 103 | 0 |
| [Kho & Sản phẩm](#module-inventory) | `inventory` | 68 | 21 | 47 | 0 |
| [Quản lý tài nguyên](#module-resource) | `resource` | 17 | 7 | 10 | 0 |
| [Trò chuyện](#module-chat) | `chat` | 32 | 10 | 22 | 0 |
| [Quản lý học viên](#module-student) | `student` | 109 | 42 | 67 | 0 |
| [Quản lý lao động](#module-worker) | `worker` | 31 | 12 | 19 | 0 |
| [Đối tác tuyển sinh](#module-student-partner) | `student-partner` | 14 | 4 | 10 | 1 |
| [Đối tác lao động](#module-labor-partner) | `labor-partner` | 32 | 12 | 20 | 0 |
| [Khách hàng](#module-customer) | `customer` | 16 | 9 | 7 | 0 |
| [Đối tác cũ](#module-partner) | `partner` | 0 | 0 | 0 | 0 |
| [Bán lẻ & POS](#module-retail) | `retail` | 72 | 43 | 29 | 0 |
| [Đối tác bán lẻ](#module-retail-partner) | `retail-partner` | 19 | 10 | 9 | 0 |
| [Sửa chữa & bảo hành](#module-repair) | `repair` | 36 | 19 | 17 | 0 |
| [Tài chính](#module-finance) | `finance` | 69 | 30 | 39 | 0 |
| [Marketing tự động](#module-marketing) | `marketing` | 8 | 4 | 4 | 0 |
| [Chiến dịch nội dung](#module-social-marketing) | `social-marketing` | 122 | 45 | 77 | 0 |
| [Hộp thư đa kênh](#module-omni-inbox) | `omni-inbox` | 42 | 17 | 25 | 0 |
| [Kho tri thức](#module-company-knowledge) | `company-knowledge` | 15 | 5 | 10 | 0 |
| [Văn bản pháp luật](#module-legal-reference) | `legal-reference` | 8 | 5 | 3 | 0 |
| [Báo giá](#module-quotation) | `quotation` | 60 | 25 | 35 | 0 |
| [Quản lý y tế](#module-healthcare) | `healthcare` | 28 | 14 | 14 | 0 |
| [Trợ lý kiến trúc](#module-architect-assistant) | `architect-assistant` | 8 | 2 | 6 | 0 |

<a id="module-hr"></a>
## Nhân sự — `hr`

Tổng 198 action: 95 đọc, 103 ghi; 0 không khả dụng.

### Chấm công và lịch làm việc — `hr:timekeeping`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.39330ed93a819149` | Xóa ca làm việc | Xóa · Ghi | `DELETE /timekeeping/shifts/:id` | Có | Khả dụng |
| `api.delete.5725128cf1fe0911` | Xóa chấm công công việc lịch làm việc | Xóa · Ghi | `DELETE /timekeeping/work-calendar/:id` | Có | Khả dụng |
| `api.get.5d0d3ea4fc0d9efb` | Tra cứu giờ làm nhân viên | Tra cứu · Đọc | `GET /timekeeping/work-hours` | — | Khả dụng |
| `api.get.d2e63aaeb8682c88` | Tra cứu lần chấm công bị từ chối | Tra cứu · Đọc | `GET /timekeeping/attempts` | — | Khả dụng |
| `api.get.d632a938b9c72492` | Tra cứu ca làm việc | Tra cứu · Đọc | `GET /timekeeping/shifts` | — | Khả dụng |
| `api.get.efd26957a4dbe889` | Tra cứu phân ca nhân viên | Tra cứu · Đọc | `GET /timekeeping/shift-assignments` | — | Khả dụng |
| `api.patch.08411917f1ed9b75` | Cập nhật ca làm việc | Sửa · Ghi | `PATCH /timekeeping/shifts/:id` | Có | Khả dụng |
| `api.patch.6bc968347283a069` | Cập nhật giờ làm nhân viên | Sửa · Ghi | `PATCH /timekeeping/work-hours/:uid` | Có | Khả dụng |
| `api.patch.cbf8c2b9d544f837` | Cập nhật địa điểm và khung giờ chấm công | Sửa · Ghi | `PATCH /timekeeping/company-location` | Có | Khả dụng |
| `api.post.4e68581113f1ef79` | Tạo ca làm việc | Tạo · Ghi | `POST /timekeeping/shifts` | Có | Khả dụng |
| `api.post.5511b45cf3a736d1` | Phân ca cho nhân viên | Tạo · Ghi | `POST /timekeeping/shift-assignments` | Có | Khả dụng |
| `timekeeping.company.location` | Tra cứu địa điểm và khung giờ chấm công | Tra cứu · Đọc | `GET /timekeeping/company-location` | — | Khả dụng |
| `timekeeping.record.update` | Điều chỉnh dữ liệu chấm công | Sửa · Ghi | `PATCH /timekeeping/records/adjust` | Có | Khả dụng |
| `timekeeping.records.absent` | Báo cáo nhân sự vắng hôm nay | Báo cáo · Đọc | `GET /timekeeping/records` | — | Khả dụng |
| `timekeeping.records.late` | Báo cáo nhân sự đi muộn hôm nay | Báo cáo · Đọc | `GET /timekeeping/records` | — | Khả dụng |
| `timekeeping.records.leave` | Báo cáo nhân sự nghỉ phép hôm nay | Báo cáo · Đọc | `GET /timekeeping/records` | — | Khả dụng |
| `timekeeping.records.list` | Tra cứu chấm công nhân sự trong ngày | Tra cứu · Đọc | `GET /timekeeping/records` | — | Khả dụng |
| `timekeeping.records.monthly.leave-summary` | Tổng hợp tất cả nhân sự nghỉ phép trong tháng | Báo cáo · Đọc | `GET /timekeeping/monthly-report` | — | Khả dụng |
| `timekeeping.records.monthly.most-absent` | Nhân sự nghỉ nhiều nhất trong tháng | Tra cứu · Đọc | `GET /timekeeping/monthly-report` | — | Khả dụng |
| `timekeeping.records.monthly.most-late` | Thống kê lượt đi làm trễ trong tháng | Báo cáo · Đọc | `GET /timekeeping/monthly-report` | — | Khả dụng |
| `timekeeping.records.monthly.most-leave` | Nhân sự nghỉ phép nhiều nhất trong tháng | Tra cứu · Đọc | `GET /timekeeping/monthly-report` | — | Khả dụng |
| `timekeeping.records.monthly.overview` | Tổng hợp chấm công theo tháng | Báo cáo · Đọc | `GET /timekeeping/monthly-report` | — | Khả dụng |
| `timekeeping.records.monthly.report` | Tổng hợp chấm công theo tháng | Báo cáo · Đọc | `GET /timekeeping/monthly-report` | — | Khả dụng |
| `timekeeping.records.monthly.under-threshold` | Nhân sự chưa đủ ngưỡng công trong tháng | Tra cứu · Đọc | `GET /timekeeping/monthly-report` | — | Khả dụng |
| `timekeeping.records.monthly.unrecorded` | Nhân sự chưa chấm công trong tháng | Tra cứu · Đọc | `GET /timekeeping/monthly-report` | — | Khả dụng |
| `timekeeping.records.overview` | Báo cáo tổng quan chấm công hôm nay | Báo cáo · Đọc | `GET /timekeeping/records` | — | Khả dụng |
| `timekeeping.records.unrecorded` | Báo cáo nhân sự chưa chấm công hôm nay | Báo cáo · Đọc | `GET /timekeeping/records` | — | Khả dụng |
| `timekeeping.today.me` | Tra cứu chấm công hôm nay của tôi | Tra cứu · Đọc | `GET /timekeeping/today` | — | Khả dụng |
| `timekeeping.work-calendar.audit` | Xem lịch sử thay đổi ngày trong lịch công ty | Tra cứu · Đọc | `GET /timekeeping/work-calendar/:id/audit` | — | Khả dụng |
| `timekeeping.work-calendar.create` | Thêm ngày nghỉ hoặc ngày làm việc ngoại lệ | Tạo · Ghi | `POST /timekeeping/work-calendar` | Có | Khả dụng |
| `timekeeping.work-calendar.list` | Tra cứu lịch ngày lễ và lịch làm việc công ty | Tra cứu · Đọc | `GET /timekeeping/work-calendar` | — | Khả dụng |
| `timekeeping.work-calendar.month-holidays` | Ngày nghỉ trong tháng | Tra cứu · Đọc | `GET /timekeeping/work-calendar` | — | Khả dụng |
| `timekeeping.work-calendar.named-holiday` | Tra cứu ngày nghỉ theo tên | Tra cứu · Đọc | `GET /timekeeping/work-calendar` | — | Khả dụng |
| `timekeeping.work-calendar.sync` | Đồng bộ lịch nghỉ lễ đã được duyệt | Duyệt · Ghi | `POST /timekeeping/work-calendar/sync` | Có | Khả dụng |
| `timekeeping.work-calendar.update` | Cập nhật ngày trong lịch công ty | Sửa · Ghi | `PATCH /timekeeping/work-calendar/:id` | Có | Khả dụng |

### Chi nhánh — `hr:branch`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `branch.create` | Tạo chi nhánh | Tạo · Ghi | `POST /auth/branches` | Có | Khả dụng |
| `branch.list` | Tra cứu chi nhánh | Tra cứu · Đọc | `GET /auth/branches` | — | Khả dụng |
| `branch.pending.delete` | Hủy chi nhánh chưa thiết lập chủ | Xóa · Ghi | `DELETE /auth/branches/:id/pending` | Có | Khả dụng |
| `branch.update` | Cập nhật chi nhánh | Sửa · Ghi | `PATCH /auth/branches/:id` | Có | Khả dụng |

### company-email — `hr:company-email`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-email.celebration.config` | Xem tóm tắt cài đặt email chúc mừng | Tra cứu · Đọc | `GET /company-email/celebration` | — | Khả dụng |
| `company-email.celebration.history` | Tổng hợp lịch sử email chúc mừng | Báo cáo · Đọc | `GET /company-email/celebration/history` | — | Khả dụng |
| `company-email.celebration.preview` | Xem trước email chúc mừng | Tra cứu · Đọc | `POST /company-email/celebration/preview` | — | Khả dụng |
| `company-email.celebration.update` | Cập nhật cài đặt email chúc mừng | Sửa · Ghi | `PATCH /company-email/celebration` | Có | Khả dụng |
| `company-email.smtp.config` | Xem tóm tắt cấu hình SMTP công ty | Tra cứu · Đọc | `GET /company-email/smtp` | — | Khả dụng |
| `company-email.smtp.test` | Gửi email thử SMTP | Tạo · Ghi | `POST /company-email/smtp/test` | Có | Khả dụng |
| `company-email.smtp.verify` | Kiểm tra kết nối SMTP công ty | Tạo · Ghi | `POST /company-email/smtp/verify` | Có | Khả dụng |

### Công việc — `hr:task`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `task.activity.update` | Cập nhật hoạt động công việc | Sửa · Ghi | `PATCH /kanban/tasks/:id/activity` | Có | Khả dụng |
| `task.create` | Tạo công việc | Tạo · Ghi | `POST /kanban/tasks` | Có | Khả dụng |
| `task.delete` | Xóa công việc | Xóa · Ghi | `DELETE /kanban/tasks/:id` | Có | Khả dụng |
| `task.kpi.monthly` | Báo cáo KPI công việc theo tháng | Báo cáo · Đọc | `GET /kanban/kpi/monthly` | — | Khả dụng |
| `task.list` | Tra cứu công việc | Tra cứu · Đọc | `GET /kanban/tasks` | — | Khả dụng |
| `task.update` | Cập nhật công việc | Sửa · Ghi | `PATCH /kanban/tasks/:id` | Có | Khả dụng |

### daily — `hr:daily`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `hr.daily.overview` | Báo cáo tình hình nhân sự hôm nay | Báo cáo · Đọc | `GET /timekeeping/records` | — | Khả dụng |

### dashboard — `hr:dashboard`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.38c4520f180b420b` | Xem tổng quan hoạt động doanh nghiệp | Tra cứu · Đọc | `GET /dashboard/summary` | — | Khả dụng |
| `api.get.a0937fb0c693e329` | Xem việc cần xử lý hôm nay | Tra cứu · Đọc | `GET /dashboard/action-items` | — | Khả dụng |
| `dashboard.business-overview` | Xem tổng quan hoạt động doanh nghiệp | Báo cáo · Đọc | `GET /dashboard/business-overview` | — | Khả dụng |

### Dự án — `hr:project`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `project.create` | Tạo dự án | Tạo · Ghi | `POST /kanban/projects` | Có | Khả dụng |
| `project.delete` | Xóa dự án | Xóa · Ghi | `DELETE /kanban/projects/:id` | Có | Khả dụng |
| `project.list` | Tra cứu dự án | Tra cứu · Đọc | `GET /kanban/projects` | — | Khả dụng |
| `project.update` | Cập nhật dự án | Sửa · Ghi | `PATCH /kanban/projects/:id` | Có | Khả dụng |

### Đào tạo — `hr:training`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `hr.training.incomplete.list` | Báo cáo tiến độ đào tạo nội bộ chưa hoàn thành | Báo cáo · Đọc | `GET /crud/training-enrollments` | — | Khả dụng |
| `hr.training.progress` | Báo cáo toàn bộ tiến độ đào tạo nội bộ | Báo cáo · Đọc | `GET /crud/training-enrollments` | — | Khả dụng |
| `training.create` | Tạo khóa đào tạo | Tạo · Ghi | `POST /crud/training-courses` | Có | Khả dụng |
| `training.delete` | Xóa khóa đào tạo nội bộ | Xóa · Ghi | `DELETE /crud/training-courses/:id` | Có | Khả dụng |
| `training.list` | Tra cứu khóa đào tạo | Tra cứu · Đọc | `GET /crud/training-courses` | — | Khả dụng |
| `training.update` | Cập nhật khóa đào tạo | Sửa · Ghi | `PATCH /crud/training-courses/:id` | Có | Khả dụng |

### Hồ sơ nhân sự — `hr:employee`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `employee.birthday.next-month` | Báo cáo sinh nhật nhân sự tháng tới | Báo cáo · Đọc | `GET /auth/users` | — | Khả dụng |
| `employee.count` | Đếm số nhân sự trong công ty hoặc chi nhánh | Báo cáo · Đọc | `GET /auth/users/count` | — | Khả dụng |
| `employee.create` | Tạo nhân sự | Tạo · Ghi | `POST /auth/register-user` | Có | Khả dụng |
| `employee.delete` | Xóa tài khoản nhân sự | Xóa · Ghi | `DELETE /auth/users/:id` | Có | Khả dụng |
| `employee.detail` | Xem thông tin chi tiết nhân sự | Tra cứu · Đọc | `GET /auth/users` | — | Khả dụng |
| `employee.list` | Tra cứu nhân sự | Tra cứu · Đọc | `GET /auth/users` | — | Khả dụng |
| `employee.update` | Cập nhật nhân sự | Sửa · Ghi | `PATCH /auth/users/:id` | Có | Khả dụng |

### Hợp đồng — `hr:contract`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `hr.contract.create` | Tạo hợp đồng nhân sự | Tạo · Ghi | `POST /hr-contracts` | Có | Khả dụng |
| `hr.contract.expiring.list` | Báo cáo hợp đồng nhân sự sắp hết hạn | Báo cáo · Đọc | `GET /hr-contracts` | — | Khả dụng |
| `hr.contract.extend` | Gia hạn hợp đồng nhân sự | Tạo · Ghi | `POST /hr-contracts/:id/extensions` | Có | Khả dụng |
| `hr.contract.list` | Tra cứu hợp đồng nhân sự để chọn hợp đồng cần gia hạn | Tra cứu · Đọc | `GET /hr-contracts` | — | Khả dụng |
| `hr.contract.missing.list` | Báo cáo nhân sự chưa có hợp đồng hiệu lực | Báo cáo · Đọc | `GET /hr-contracts` | — | Khả dụng |
| `hr.contract.settings.get` | Xem cài đặt cảnh báo hợp đồng nhân sự | Tra cứu · Đọc | `GET /hr-contracts/settings` | — | Khả dụng |
| `hr.contract.settings.update` | Cập nhật cài đặt cảnh báo hợp đồng nhân sự | Sửa · Ghi | `PUT /hr-contracts/settings` | Có | Khả dụng |

### hr contracts — `hr:hr-contracts`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.0c557a74cbc907f9` | Tra cứu hợp đồng nhân sự | Tra cứu · Đọc | `GET /hr-contracts` | — | Khả dụng |
| `api.get.b44c64519e939e0a` | Tra cứu lịch sử gia hạn hợp đồng nhân sự | Tra cứu · Đọc | `GET /hr-contracts/extensions/list` | — | Khả dụng |
| `api.patch.7d7b8c0cbce4fe1c` | Cập nhật hợp đồng nhân sự | Sửa · Ghi | `PATCH /hr-contracts/:id` | Có | Khả dụng |
| `api.post.564251c483731a91` | Tạo hợp đồng nhân sự | Tạo · Ghi | `POST /hr-contracts` | Có | Khả dụng |
| `api.post.8dad6fff5226b63c` | Gia hạn hợp đồng nhân sự | Tạo · Ghi | `POST /hr-contracts/:id/extensions` | Có | Khả dụng |

### kanban — `hr:kanban`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.15793bc7bd272c4c` | Xem chỉ số công việc theo tháng | Báo cáo · Đọc | `GET /kanban/kpi/monthly` | — | Khả dụng |

### Lịch — `hr:calendar`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `hr.calendar.event.create` | Tạo sự kiện nội bộ | Tạo · Ghi | `POST /crud/hr-calendar-events` | Có | Khả dụng |
| `hr.calendar.event.update` | Cập nhật sự kiện nội bộ | Sửa · Ghi | `PATCH /crud/hr-calendar-events/:id` | Có | Khả dụng |
| `hr.calendar.events.list` | Tra cứu sự kiện nội bộ và lịch hôm nay | Tra cứu · Đọc | `GET /crud/hr-calendar-events` | — | Khả dụng |

### Lương — `hr:payroll`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.79f4d36088c00b86` | Tra cứu dữ liệu đầu vào kỳ lương | Tra cứu · Đọc | `GET /payroll/periods/:periodKey/inputs` | — | Khả dụng |
| `api.get.8a6bcc27085077c3` | Xem kết quả chấm công dùng để tính lương | Tra cứu · Đọc | `GET /payroll/periods/:periodKey/results` | — | Khả dụng |
| `api.get.ac427b464961eae6` | Xem nhật ký xử lý của kỳ lương | Tra cứu · Đọc | `GET /payroll/periods/:periodKey/audit` | — | Khả dụng |
| `api.get.f2ac09bb2c5e311f` | Xem nhật ký thao tác của một lượt lương | Tra cứu · Đọc | `GET /payroll/runs/:id/audit` | — | Khả dụng |
| `payroll.adjustment.approve` | Phê duyệt khoản điều chỉnh lương | Duyệt · Ghi | `POST /payroll/periods/:periodKey/adjustments/:adjustmentId/approve` | Có | Khả dụng |
| `payroll.adjustment.create` | Tạo khoản điều chỉnh lương | Tạo · Ghi | `POST /payroll/periods/:periodKey/adjustments` | Có | Khả dụng |
| `payroll.adjustment.list` | Tra cứu khoản điều chỉnh lương trong kỳ | Tra cứu · Đọc | `GET /payroll/periods/:periodKey/adjustments` | — | Khả dụng |
| `payroll.adjustment.reject` | Từ chối khoản điều chỉnh lương | Duyệt · Ghi | `POST /payroll/periods/:periodKey/adjustments/:adjustmentId/reject` | Có | Khả dụng |
| `payroll.employee.me.payslip.review-requests` | Tra cứu yêu cầu kiểm tra phiếu lương của tôi | Tra cứu · Đọc | `GET /payroll/employee/me/payslip-review-requests` | — | Khả dụng |
| `payroll.employee.me.payslip.review.request` | Yêu cầu kiểm tra lại phiếu lương của tôi | Tạo · Ghi | `POST /payroll/employee/me/payslips/:id/review-requests` | Có | Khả dụng |
| `payroll.employee.me.payslips` | Tra cứu phiếu lương của tôi | Tra cứu · Đọc | `GET /payroll/employee/me/payslips` | — | Khả dụng |
| `payroll.employee.me.reconciliation` | Tra cứu đối soát lương của tôi | Tra cứu · Đọc | `GET /payroll/employee/me/reconciliation` | — | Khả dụng |
| `payroll.employee.reconciliation.action` | Xác nhận hoặc trao đổi về đối soát lương của tôi | Tạo · Ghi | `POST /payroll/employee/me/reconciliation/:id/actions` | Có | Khả dụng |
| `payroll.formula.activate` | Kích hoạt công thức tính lương | Sửa · Ghi | `POST /payroll/formulas/:id/activate` | Có | Khả dụng |
| `payroll.formula.clone` | Sao chép công thức tính lương | Tạo · Ghi | `POST /payroll/formulas/:id/clone` | Có | Khả dụng |
| `payroll.formula.create` | Tạo công thức tính lương | Tạo · Ghi | `POST /payroll/formulas` | Có | Khả dụng |
| `payroll.formula.list` | Tra cứu công thức tính lương | Tra cứu · Đọc | `GET /payroll/formulas` | — | Khả dụng |
| `payroll.formula.retire` | Ngừng công thức tính lương | Tạo · Ghi | `POST /payroll/formulas/:id/retire` | Có | Khả dụng |
| `payroll.formula.update` | Cập nhật công thức tính lương | Sửa · Ghi | `PATCH /payroll/formulas/:id` | Có | Khả dụng |
| `payroll.payment.cancel` | Hủy đợt thanh toán lương nháp | Hủy · Ghi | `POST /payroll/payments/:id/cancel` | Có | Khả dụng |
| `payroll.payment.confirm` | Xác nhận đợt thanh toán lương đã chuyển tiền | Tạo · Ghi | `POST /payroll/payments/:id/confirm` | Có | Khả dụng |
| `payroll.payment.reverse` | Đảo xác nhận đợt thanh toán lương | Tạo · Ghi | `POST /payroll/payments/:id/reverse` | Có | Khả dụng |
| `payroll.period.input.update` | Cập nhật dữ liệu đầu vào lương nhân sự | Sửa · Ghi | `PUT /payroll/periods/:periodKey/inputs/:employeeId` | Có | Khả dụng |
| `payroll.period.inputs.bulk` | Cập nhật dữ liệu đầu vào lương hàng loạt | Sửa · Ghi | `PUT /payroll/periods/:periodKey/inputs` | Có | Khả dụng |
| `payroll.period.line-overrides.bulk` | Ghi đè các khoản lương theo nhân viên | Tạo · Ghi | `PUT /payroll/periods/:periodKey/line-overrides` | Có | Khả dụng |
| `payroll.period.line-overrides.list` | Tra cứu các khoản lương được ghi đè thủ công | Tra cứu · Đọc | `GET /payroll/periods/:periodKey/line-overrides` | — | Khả dụng |
| `payroll.period.reset` | Đặt lại kỳ lương | Tạo · Ghi | `DELETE /payroll/periods/:periodKey` | Có | Khả dụng |
| `payroll.period.variables.activate` | Kích hoạt biến dữ liệu đầu vào bảng lương | Sửa · Ghi | `POST /payroll/period-input-variables/:id/activate` | Có | Khả dụng |
| `payroll.period.variables.create` | Tạo biến dữ liệu đầu vào bảng lương | Tạo · Ghi | `POST /payroll/period-input-variables` | Có | Khả dụng |
| `payroll.period.variables.list` | Tra cứu biến dữ liệu đầu vào bảng lương | Tra cứu · Đọc | `GET /payroll/period-input-variables` | — | Khả dụng |
| `payroll.period.variables.retire` | Ngừng biến dữ liệu đầu vào bảng lương | Tạo · Ghi | `POST /payroll/period-input-variables/:id/retire` | Có | Khả dụng |
| `payroll.period.variables.update` | Cập nhật biến dữ liệu đầu vào bảng lương | Sửa · Ghi | `PATCH /payroll/period-input-variables/:id` | Có | Khả dụng |
| `payroll.policy.activate` | Áp dụng chính sách lương | Sửa · Ghi | `POST /payroll/policies/:id/activate` | Có | Khả dụng |
| `payroll.policy.clone` | Sao chép chính sách lương | Tạo · Ghi | `POST /payroll/policies/:id/clone` | Có | Khả dụng |
| `payroll.policy.create` | Tạo chính sách lương | Tạo · Ghi | `POST /payroll/policies` | Có | Khả dụng |
| `payroll.policy.delete` | Xóa chính sách lương | Xóa · Ghi | `DELETE /payroll/policies/:id` | Có | Khả dụng |
| `payroll.policy.list` | Tra cứu chính sách lương | Tra cứu · Đọc | `GET /payroll/policies` | — | Khả dụng |
| `payroll.policy.retire` | Ngừng chính sách lương | Tạo · Ghi | `POST /payroll/policies/:id/retire` | Có | Khả dụng |
| `payroll.policy.update` | Cập nhật chính sách lương | Sửa · Ghi | `PATCH /payroll/policies/:id` | Có | Khả dụng |
| `payroll.reconciliation.schedule.get` | Tra cứu lịch phát hành đối soát lương | Tra cứu · Đọc | `GET /payroll/reconciliation-schedule` | — | Khả dụng |
| `payroll.reconciliation.schedule.update` | Cài đặt lịch phát hành đối soát lương | Sửa · Ghi | `PUT /payroll/reconciliation-schedule` | Có | Khả dụng |
| `payroll.run.calculate` | Tính lương cho lượt đã khóa công | Tạo · Ghi | `POST /payroll/runs/:id/calculate` | Có | Khả dụng |
| `payroll.run.close` | Chốt lượt lương đã duyệt | Xử lý · Ghi | `POST /payroll/runs/:id/close` | Có | Khả dụng |
| `payroll.run.complaints.list` | Tổng hợp khiếu nại bảng lương | Báo cáo · Đọc | `GET /payroll/runs/:id/reconciliation` | — | Khả dụng |
| `payroll.run.create` | Tạo bản nháp lượt chạy lương định kỳ | Tạo · Ghi | `POST /payroll/runs` | Có | Khả dụng |
| `payroll.run.issues.list` | Xem lỗi và cảnh báo của lượt lương | Tra cứu · Đọc | `GET /payroll/runs/:id/issues` | — | Khả dụng |
| `payroll.run.line.detail` | Xem chi tiết lương nhân viên | Tra cứu · Đọc | `GET /payroll/runs/:id/lines/:employeeId` | — | Khả dụng |
| `payroll.run.list` | Tra cứu lượt chạy lương | Tra cứu · Đọc | `GET /payroll/runs` | — | Khả dụng |
| `payroll.run.lock-attendance` | Khóa snapshot công của lượt lương | Tạo · Ghi | `POST /payroll/runs/:id/lock-attendance` | Có | Khả dụng |
| `payroll.run.mark-paid` | Đánh dấu lượt lương đã thanh toán | Tạo · Ghi | `POST /payroll/runs/:id/mark-paid` | Có | Khả dụng |
| `payroll.run.payment.create` | Tạo đợt thanh toán lương nháp | Tạo · Ghi | `POST /payroll/runs/:id/payments` | Có | Khả dụng |
| `payroll.run.payments.list` | Tra cứu các đợt thanh toán lương | Tra cứu · Đọc | `GET /payroll/runs/:id/payments` | — | Khả dụng |
| `payroll.run.payslip.review-request.resolve` | Phản hồi yêu cầu kiểm tra phiếu lương | Tạo · Ghi | `POST /payroll/runs/:id/payslip-review-requests/:requestId/resolve` | Có | Khả dụng |
| `payroll.run.payslip.review-requests.list` | Tra cứu yêu cầu kiểm tra phiếu lương | Tra cứu · Đọc | `GET /payroll/runs/:id/payslip-review-requests` | — | Khả dụng |
| `payroll.run.payslips.publish` | Công bố phiếu lương trong ứng dụng | Tạo · Ghi | `POST /payroll/runs/:id/payslips/publish` | Có | Khả dụng |
| `payroll.run.payslips.withdraw` | Thu hồi phiếu lương đã công bố | Hủy · Ghi | `POST /payroll/runs/:id/payslips/:employeeId/withdraw` | Có | Khả dụng |
| `payroll.run.recalculate` | Tính lại lương cho lượt đã khóa công | Tạo · Ghi | `POST /payroll/runs/:id/recalculate` | Có | Khả dụng |
| `payroll.run.reconciliation.action` | Phản hồi hoặc xử lý khiếu nại lương | Tạo · Ghi | `POST /payroll/runs/:id/reconciliation/:employeeId/actions` | Có | Khả dụng |
| `payroll.run.reconciliation.list` | Tra cứu trạng thái đối soát lương của nhân viên | Tra cứu · Đọc | `GET /payroll/runs/:id/reconciliation` | — | Khả dụng |
| `payroll.run.reconciliation.publish` | Phát hành bảng lương tạm tính để đối soát | Tạo · Ghi | `POST /payroll/runs/:id/reconciliation/publish` | Có | Khả dụng |
| `payroll.run.reopen` | Mở lại lượt lương | Xử lý · Ghi | `POST /payroll/runs/:id/reopen` | Có | Khả dụng |
| `payroll.run.review` | Gửi lượt lương sang chờ duyệt | Duyệt · Ghi | `POST /payroll/runs/:id/review` | Có | Khả dụng |
| `payroll.run.sync-attendance` | Đồng bộ công vào lượt chạy lương | Tạo · Ghi | `POST /payroll/runs/:id/sync-attendance` | Có | Khả dụng |

### Nghỉ phép — `hr:leave`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `hr.leave.applications.list` | Tra cứu đơn nghỉ phép và làm việc từ xa | Tra cứu · Đọc | `GET /crud/hr-leave-applications` | — | Khả dụng |
| `leave.balance.me` | Tra cứu số dư phép năm của tôi | Tra cứu · Đọc | `GET /leave/balance` | — | Khả dụng |
| `leave.balances.exhausted` | Nhân sự đã hết phép năm | Tra cứu · Đọc | `GET /leave/balances` | — | Khả dụng |
| `leave.balances.list` | Thống kê số phép năm còn lại của nhân sự | Báo cáo · Đọc | `GET /leave/balances` | — | Khả dụng |
| `leave.balances.minimum` | Nhân sự còn ít nhất số ngày phép được yêu cầu | Tra cứu · Đọc | `GET /leave/balances` | — | Khả dụng |
| `leave.balances.report` | Thống kê số dư phép năm nhân sự | Báo cáo · Đọc | `GET /leave/balances` | — | Khả dụng |

### Phân quyền — `hr:access`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `access.permission-catalog.detail` | Xem chi tiết một quyền hệ thống | Tra cứu · Đọc | `GET /permissions/:code` | — | Khả dụng |
| `access.permission-catalog.list` | Tra cứu danh mục quyền hệ thống | Tra cứu · Đọc | `GET /permissions` | — | Khả dụng |
| `access.role-permissions.detail` | Xem cấu hình quyền của một vai trò | Tra cứu · Đọc | `GET /role-permissions/:role` | — | Khả dụng |
| `access.role-permissions.list` | Tra cứu cấu hình quyền theo vai trò | Tra cứu · Đọc | `GET /role-permissions` | — | Khả dụng |
| `access.role-permissions.save` | Cập nhật phân quyền vai trò | Sửa · Ghi | `POST /role-permissions` | Có | Khả dụng |

### Phòng ban — `hr:department`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `department.create` | Tạo phòng ban | Tạo · Ghi | `POST /hr/departments` | Có | Khả dụng |
| `department.delete` | Xóa phòng ban | Xóa · Ghi | `DELETE /hr/departments/:id` | Có | Khả dụng |
| `department.employees.list` | Danh sách nhân sự theo phòng ban | Tra cứu · Đọc | `GET /auth/users` | — | Khả dụng |
| `department.list` | Tra cứu phòng ban | Tra cứu · Đọc | `GET /hr/departments` | — | Khả dụng |
| `department.lookup` | Tra cứu thông tin phòng ban | Tra cứu · Đọc | `GET /hr/departments` | — | Khả dụng |
| `department.unmanaged.list` | Danh sách phòng ban chưa có quản lý | Tra cứu · Đọc | `GET /hr/departments` | — | Khả dụng |
| `department.update` | Cập nhật phòng ban | Sửa · Ghi | `PATCH /hr/departments/:id` | Có | Khả dụng |

### Tuyển dụng — `hr:recruitment`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `recruitment.applicant.create` | Thêm ứng viên | Tạo · Ghi | `POST /recruitment/applicants` | Có | Khả dụng |
| `recruitment.applicant.delete` | Xóa mềm hồ sơ ứng viên | Xóa · Ghi | `POST /recruitment/applicants/:id/delete` | Có | Khả dụng |
| `recruitment.applicant.detail` | Xem hồ sơ ứng viên | Tra cứu · Đọc | `GET /recruitment/applicants/:id` | — | Khả dụng |
| `recruitment.applicant.history` | Xem lịch sử tuyển dụng ứng viên | Tra cứu · Đọc | `GET /recruitment/applicants/:id/history` | — | Khả dụng |
| `recruitment.applicant.list` | Tra cứu ứng viên | Tra cứu · Đọc | `GET /recruitment/applicants` | — | Khả dụng |
| `recruitment.applicant.restore` | Khôi phục hồ sơ ứng viên | Sửa · Ghi | `POST /recruitment/applicants/:id/restore` | Có | Khả dụng |
| `recruitment.applicant.transition` | Chuyển bước tuyển dụng cho ứng viên | Tạo · Ghi | `POST /recruitment/applicants/:id/transition` | Có | Khả dụng |
| `recruitment.applicant.update` | Cập nhật hồ sơ ứng viên | Sửa · Ghi | `PATCH /recruitment/applicants/:id` | Có | Khả dụng |
| `recruitment.interview.create` | Tạo lịch phỏng vấn | Tạo · Ghi | `POST /recruitment/interviews` | Có | Khả dụng |
| `recruitment.interview.delete` | Xóa lịch phỏng vấn | Xóa · Ghi | `POST /recruitment/interviews/:id/delete` | Có | Khả dụng |
| `recruitment.interview.detail` | Xem lịch phỏng vấn | Tra cứu · Đọc | `GET /recruitment/interviews/:id` | — | Khả dụng |
| `recruitment.interview.list` | Tra cứu lịch phỏng vấn | Tra cứu · Đọc | `GET /recruitment/interviews` | — | Khả dụng |
| `recruitment.interview.restore` | Khôi phục lịch phỏng vấn | Sửa · Ghi | `POST /recruitment/interviews/:id/restore` | Có | Khả dụng |
| `recruitment.interview.update` | Cập nhật lịch phỏng vấn | Sửa · Ghi | `PATCH /recruitment/interviews/:id` | Có | Khả dụng |
| `recruitment.job.create` | Tạo vị trí tuyển dụng | Tạo · Ghi | `POST /recruitment/jobs` | Có | Khả dụng |
| `recruitment.job.delete` | Xóa mềm vị trí tuyển dụng | Xóa · Ghi | `POST /recruitment/jobs/:id/delete` | Có | Khả dụng |
| `recruitment.job.detail` | Xem vị trí tuyển dụng | Tra cứu · Đọc | `GET /recruitment/jobs/:id` | — | Khả dụng |
| `recruitment.job.list` | Tra cứu vị trí tuyển dụng | Tra cứu · Đọc | `GET /recruitment/jobs` | — | Khả dụng |
| `recruitment.job.restore` | Khôi phục vị trí tuyển dụng | Sửa · Ghi | `POST /recruitment/jobs/:id/restore` | Có | Khả dụng |
| `recruitment.job.status` | Đổi trạng thái vị trí tuyển dụng | Tra cứu · Ghi | `POST /recruitment/jobs/:id/status` | Có | Khả dụng |
| `recruitment.job.update` | Cập nhật vị trí tuyển dụng | Sửa · Ghi | `PATCH /recruitment/jobs/:id` | Có | Khả dụng |
| `recruitment.pipeline.get` | Tra cứu các bước tuyển dụng | Tra cứu · Đọc | `GET /recruitment/pipeline` | — | Khả dụng |
| `recruitment.report` | Báo cáo tuyển dụng | Báo cáo · Đọc | `GET /recruitment/reports/assistant` | — | Khả dụng |

### workflow — `hr:workflow`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `hr.workflow.category.create` | Tạo nhãn phân loại quy trình | Tạo · Ghi | `POST /crud/workflow-categories` | Có | Khả dụng |
| `hr.workflow.create` | Tạo quy trình làm việc | Tạo · Ghi | `POST /crud/workflows` | Có | Khả dụng |
| `hr.workflow.delete` | Xóa quy trình làm việc | Xóa · Ghi | `DELETE /crud/workflows/:id` | Có | Khả dụng |
| `hr.workflow.list` | Tra cứu quy trình làm việc | Tra cứu · Đọc | `GET /crud/workflows` | — | Khả dụng |
| `hr.workflow.update` | Cập nhật quy trình làm việc | Sửa · Ghi | `PATCH /crud/workflows/:id` | Có | Khả dụng |

<a id="module-inventory"></a>
## Kho & Sản phẩm — `inventory`

Tổng 68 action: 21 đọc, 47 ghi; 0 không khả dụng.

### catalog — `inventory:catalog`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.catalog.defaults.seed` | Tạo dữ liệu danh mục kho mặc định | Tạo · Ghi | `POST /inventory/catalog/resources/seed/defaults` | Có | Khả dụng |
| `inventory.catalog.resource.list` | Tra cứu danh mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm | Tra cứu · Đọc | `GET /inventory/catalog/resources/:kind` | — | Khả dụng |
| `inventory.catalog.template.list` | Tra cứu mẫu sản phẩm | Tra cứu · Đọc | `GET /inventory/catalog/templates` | — | Khả dụng |
| `inventory.catalog.unit.create` | Tạo đơn vị tính | Tạo · Ghi | `POST /inventory/catalog/resources/:kind` | Có | Khả dụng |
| `inventory.catalog.workspace.get` | Xem thông tin chung về sản phẩm và kho hàng | Tra cứu · Đọc | `GET /inventory/catalog/workspace` | — | Khả dụng |
| `inventory.catalog.workspace.update` | Đổi cách quản lý danh mục sản phẩm | Sửa · Ghi | `PATCH /inventory/catalog/workspace` | Có | Khả dụng |

### category — `inventory:category`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `category.create` | Tạo danh mục kho | Tạo · Ghi | `POST /crud/categories` | Có | Khả dụng |
| `category.delete` | Xóa danh mục kho | Xóa · Ghi | `DELETE /crud/categories/:id` | Có | Khả dụng |
| `category.list` | Tra cứu danh mục kho | Tra cứu · Đọc | `GET /crud/categories` | — | Khả dụng |
| `category.update` | Cập nhật danh mục kho | Sửa · Ghi | `PATCH /crud/categories/:id` | Có | Khả dụng |

### Kho — `inventory:inventory`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.9301905784a3a33e` | Xóa dữ liệu danh mục sản phẩm | Xóa · Ghi | `DELETE /inventory/catalog/resources/:kind/:id` | Có | Khả dụng |
| `api.delete.cc58d03a74329723` | Xóa kho hàng danh mục sản phẩm | Xóa · Ghi | `DELETE /inventory/catalog/products/:id` | Có | Khả dụng |
| `api.patch.401f92bc17a703e3` | Cập nhật mẫu sản phẩm | Sửa · Ghi | `PATCH /inventory/catalog/templates/:id` | Có | Khả dụng |
| `api.patch.78eb0c3b82d1f735` | Cập nhật thông tin SKU | Sửa · Ghi | `PATCH /inventory/catalog/variants/:id` | Có | Khả dụng |
| `api.patch.ad1b26d154f5621c` | Cập nhật dữ liệu dùng chung cho sản phẩm | Sửa · Ghi | `PATCH /inventory/catalog/resources/:kind/:id` | Có | Khả dụng |
| `api.patch.d638d3bb0a56b64b` | Cập nhật nhà cung cấp | Sửa · Ghi | `PATCH /inventory/receiving/suppliers/:id` | Có | Khả dụng |
| `api.patch.ec4179bd45d62cbf` | Cập nhật thông tin sản phẩm | Sửa · Ghi | `PATCH /inventory/catalog/products/:id` | Có | Khả dụng |
| `api.post.435334a57fb9c949` | Thêm nhiều SKU cho sản phẩm | Tạo · Ghi | `POST /inventory/catalog/products/:id/variants/bulk` | Có | Khả dụng |
| `api.post.454f78ec53f74015` | Hủy phiếu kiểm kê | Hủy · Ghi | `POST /inventory/counts/:id/cancel` | Có | Khả dụng |
| `api.post.5905a76c5b33f482` | Tạo sản phẩm với nhiều SKU | Tạo · Ghi | `POST /inventory/catalog/products/bulk-create-with-variants` | Có | Khả dụng |
| `api.post.5e0381daf5057103` | Quét mã vào phiếu kiểm kê | Tạo · Ghi | `POST /inventory/counts/:id/scan` | Có | Khả dụng |
| `api.post.705bdfe1a603a06f` | Tạo mẫu sản phẩm | Tạo · Ghi | `POST /inventory/catalog/templates` | Có | Khả dụng |
| `api.post.a9dc1045ea6b35ab` | Gửi phiếu kiểm kê để duyệt | Duyệt · Ghi | `POST /inventory/counts/:id/submit` | Có | Khả dụng |
| `api.post.c29d50d7a2ebd989` | Tạo thể loại / thư mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm | Tạo · Ghi | `POST /inventory/catalog/resources/:kind` | Có | Khả dụng |
| `api.post.f03e901c8ee14a8f` | Bắt đầu kiểm kê kho | Tạo · Ghi | `POST /inventory/counts/:id/start` | Có | Khả dụng |
| `api.post.feaf71a366c8880e` | Tạo phiếu kiểm kê kho | Tạo · Ghi | `POST /inventory/counts` | Có | Khả dụng |
| `api.put.f369bafc104121fe` | Cập nhật giá nhập và giá bán SKU | Sửa · Ghi | `PUT /inventory/catalog/prices/:variantId` | Có | Khả dụng |
| `inventory.count.approve` | Phê duyệt kiểm kê và cập nhật tồn kho | Duyệt · Ghi | `POST /inventory/counts/:id/approve` | Có | Khả dụng |
| `inventory.count.detail` | Xem phiếu kiểm kê kho | Báo cáo · Đọc | `GET /inventory/counts/:id` | — | Khả dụng |
| `inventory.count.item.update` | Cập nhật dòng kiểm kê kho | Sửa · Ghi | `PATCH /inventory/counts/:id/items/:itemId` | Có | Khả dụng |
| `inventory.count.list` | Tra cứu phiếu kiểm kê kho | Báo cáo · Đọc | `GET /inventory/counts` | — | Khả dụng |
| `inventory.count.recreate` | Tạo lại phiếu kiểm kê bị xung đột | Báo cáo · Ghi | `POST /inventory/counts/:id/recreate` | Có | Khả dụng |

### prices — `inventory:prices`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.prices.list` | Tra cứu giá bán và giá vốn SKU | Tra cứu · Đọc | `GET /inventory/catalog/prices` | — | Khả dụng |

### receipt — `inventory:receipt`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.receipt.cancel` | Hủy phiếu nhập kho | Hủy · Ghi | `POST /inventory/receiving/receipts/:id/cancel` | Có | Khả dụng |
| `inventory.receipt.confirm` | Xác nhận nhập kho và cập nhật tồn | Sửa · Ghi | `POST /inventory/receiving/receipts/:id/confirm` | Có | Khả dụng |
| `inventory.receipt.create` | Tạo phiếu nhập kho | Tạo · Ghi | `POST /inventory/receiving/receipts` | Có | Khả dụng |
| `inventory.receipt.list` | Tra cứu phiếu nhập kho | Tra cứu · Đọc | `GET /inventory/receiving/receipts` | — | Khả dụng |
| `inventory.receipt.start` | Bắt đầu nhận hàng vào kho | Tạo · Ghi | `POST /inventory/receiving/receipts/:id/start-receiving` | Có | Khả dụng |
| `inventory.receipt.submit` | Gửi phiếu nhập xác nhận | Xử lý · Ghi | `POST /inventory/receiving/receipts/:id/submit` | Có | Khả dụng |
| `inventory.receipt.update` | Cập nhật phiếu nhập kho | Sửa · Ghi | `PATCH /inventory/receiving/receipts/:id` | Có | Khả dụng |

### reconciliation — `inventory:reconciliation`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.reconciliation.run` | Đối soát dữ liệu tồn kho | Tra cứu · Đọc | `POST /inventory/reconciliation/runs` | — | Khả dụng |
| `inventory.reconciliation.warehouses.list` | Tra cứu kho để đối soát tồn | Tra cứu · Đọc | `GET /inventory/reconciliation/warehouses` | — | Khả dụng |

### Sản phẩm — `inventory:product`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.product.create.sellable` | Tạo sản phẩm và SKU kèm giá bán | Tạo · Ghi | `POST /inventory/catalog/products/with-price` | Có | Khả dụng |
| `inventory.product.detail` | Xem chi tiết sản phẩm và SKU | Tra cứu · Đọc | `GET /inventory/catalog/products/:id` | — | Khả dụng |
| `product.list` | Tra cứu sản phẩm | Tra cứu · Đọc | `GET /inventory/catalog/products` | — | Khả dụng |

### serial — `inventory:serial`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.serial.create` | Đăng ký IMEI hoặc serial vào tồn kho | Tạo · Ghi | `POST /inventory/serials` | Có | Khả dụng |
| `inventory.serial.detail` | Xem chi tiết IMEI hoặc serial | Tra cứu · Đọc | `GET /inventory/serials/:id` | — | Khả dụng |
| `inventory.serial.history` | Xem lịch sử IMEI hoặc serial | Tra cứu · Đọc | `GET /inventory/serials/:id/history` | — | Khả dụng |
| `inventory.serial.list` | Tra cứu IMEI, serial và mã đơn vị | Tra cứu · Đọc | `GET /inventory/serials` | — | Khả dụng |
| `inventory.serial.transfer.accept` | Nhận IMEI hoặc serial được điều chuyển | Duyệt · Ghi | `POST /inventory/serials/:id/transfer/accept` | Có | Khả dụng |
| `inventory.serial.transfer.cancel` | Hủy điều chuyển IMEI hoặc serial | Hủy · Ghi | `POST /inventory/serials/:id/transfer/cancel` | Có | Khả dụng |
| `inventory.serial.transfer.local` | Chuyển IMEI hoặc serial giữa các kho trong chi nhánh | Tạo · Ghi | `POST /inventory/serials/:id/transfer` | Có | Khả dụng |
| `inventory.serial.transfer.request` | Gửi IMEI hoặc serial sang chi nhánh | Tạo · Ghi | `POST /inventory/serials/:id/transfer/request` | Có | Khả dụng |
| `inventory.serial.transition` | Cập nhật trạng thái IMEI hoặc serial | Sửa · Ghi | `POST /inventory/serials/:id/transition` | Có | Khả dụng |

### stock-log — `inventory:stock-log`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.stock-log.list` | Tra cứu phiếu nhập xuất kho | Tra cứu · Đọc | `GET /crud/stock-logs` | — | Khả dụng |
| `inventory.stock-log.reverse` | Đảo phiếu xuất kho thủ công | Xuất · Ghi | `POST /inventory/stock-logs/:id/reverse` | Có | Khả dụng |

### supplier — `inventory:supplier`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.supplier.delete` | Xóa nhà cung cấp | Xóa · Ghi | `DELETE /inventory/receiving/suppliers/:id` | Có | Khả dụng |
| `inventory.supplier.list` | Tra cứu nhà cung cấp | Tra cứu · Đọc | `GET /inventory/receiving/suppliers` | — | Khả dụng |

### tiktok-shop — `inventory:tiktok-shop`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `tiktok-shop.status` | Kiểm tra kết nối TikTok Shop | Tra cứu · Đọc | `GET /integrations/tiktok-shop/status` | — | Khả dụng |

### transfer — `inventory:transfer`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.transfer.accept` | Nhận phiếu điều chuyển kho | Duyệt · Ghi | `POST /inventory/transfers/:id/accept` | Có | Khả dụng |
| `inventory.transfer.cancel` | Hủy phiếu điều chuyển kho | Hủy · Ghi | `POST /inventory/transfers/:id/cancel` | Có | Khả dụng |
| `inventory.transfer.create` | Tạo phiếu điều chuyển kho | Tạo · Ghi | `POST /inventory/transfers` | Có | Khả dụng |
| `inventory.transfer.detail` | Xem chi tiết phiếu điều chuyển kho | Tra cứu · Đọc | `GET /inventory/transfers/:id` | — | Khả dụng |
| `inventory.transfer.list` | Tra cứu phiếu điều chuyển kho | Tra cứu · Đọc | `GET /inventory/transfers` | — | Khả dụng |

### variant — `inventory:variant`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.variant.bulk.delete` | Xóa nhiều SKU | Xóa · Ghi | `DELETE /inventory/catalog/variants/bulk` | Có | Khả dụng |
| `inventory.variant.bulk.update` | Cập nhật nhiều SKU | Sửa · Ghi | `PATCH /inventory/catalog/variants/bulk` | Có | Khả dụng |
| `inventory.variant.create.sellable` | Thêm SKU kèm giá bán | Tạo · Ghi | `POST /inventory/catalog/products/:id/variants/with-price` | Có | Khả dụng |

### warehouse — `inventory:warehouse`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `inventory.warehouse.locations.list` | Tra cứu kho | Tra cứu · Đọc | `GET /inventory/warehouses` | — | Khả dụng |

<a id="module-resource"></a>
## Quản lý tài nguyên — `resource`

Tổng 17 action: 7 đọc, 10 ghi; 0 không khả dụng.

### google-drive — `resource:google-drive`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `resource.google-drive.list` | Tra cứu tệp Drive cá nhân | Tra cứu · Đọc | `GET /integrations/google-drive/resources` | — | Khả dụng |
| `resource.google-drive.move` | Di chuyển tệp trong Google Drive cá nhân | Tạo · Ghi | `POST /integrations/google-drive/resources/move` | Có | Khả dụng |
| `resource.google-drive.rename` | Đổi tên tệp hoặc thư mục Drive cá nhân | Tạo · Ghi | `PATCH /integrations/google-drive/resources/:id/rename` | Có | Khả dụng |

### resources — `resource:resources`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.53bdaed9e11523ef` | Xóa tài nguyên Google Drive tệp | Xóa · Ghi | `DELETE /resources/drive/files/:fileId` | Có | Khả dụng |
| `api.delete.771468fb212b7e25` | Xóa tài nguyên | Xóa · Ghi | `DELETE /resources/:id` | Có | Khả dụng |
| `api.get.57750a4ce5759120` | Xem thông tin tệp hoặc thư mục | Tra cứu · Đọc | `GET /resources/:id` | — | Khả dụng |
| `api.get.5a8c34f32c006c0b` | Xem đường dẫn thư mục của tài nguyên | Tra cứu · Đọc | `GET /resources/breadcrumb/:id` | — | Khả dụng |
| `api.get.70715572be0f86f6` | Xem quyền chia sẻ của tài nguyên | Tra cứu · Đọc | `GET /resources/:id/shares` | — | Khả dụng |
| `api.get.8d100f7d89820c43` | Tìm tệp trong Google Drive dùng chung | Tra cứu · Đọc | `GET /resources/drive/files` | — | Khả dụng |
| `api.patch.120dc3a54509fc0c` | Cập nhật tài nguyên đổi tên | Sửa · Ghi | `PATCH /resources/:id/rename` | Có | Khả dụng |
| `api.patch.1cfa9b644fbe938f` | Cập nhật tài nguyên di chuyển | Sửa · Ghi | `PATCH /resources/:id/move` | Có | Khả dụng |
| `api.post.4fac47294c399fc8` | Tạo thư mục tài nguyên | Tạo · Ghi | `POST /resources/folder` | Có | Khả dụng |
| `api.post.515c5d870391cc6f` | Tạo tài nguyên Google Drive | Tạo · Ghi | `POST /resources/drive` | Có | Khả dụng |
| `api.post.f16467714880abd7` | Thêm liên kết tệp vào kho tài nguyên | Tạo · Ghi | `POST /resources/file` | Có | Khả dụng |
| `resource.list` | Tra cứu tài nguyên | Tra cứu · Đọc | `GET /resources` | — | Khả dụng |
| `resource.restore` | Khôi phục tài nguyên | Sửa · Ghi | `POST /resources/:id/restore` | Có | Khả dụng |

### trash — `resource:trash`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `resource.trash.list` | Tra cứu thùng rác tài nguyên | Tra cứu · Đọc | `GET /resources/trash` | — | Khả dụng |

<a id="module-chat"></a>
## Trò chuyện — `chat`

Tổng 32 action: 10 đọc, 22 ghi; 0 không khả dụng.

### account — `chat:account`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `account.assistant-settings.read` | Xem cài đặt trợ lý của tôi | Tra cứu · Đọc | `GET /chatbot/assistant/settings` | — | Khả dụng |
| `account.assistant-settings.update` | Cập nhật cài đặt trợ lý của tôi | Sửa · Ghi | `PATCH /chatbot/assistant/settings` | Có | Khả dụng |
| `account.colleagues.list` | Tra cứu đồng nghiệp trong công ty | Tra cứu · Đọc | `GET /auth/users/colleagues` | — | Khả dụng |
| `account.profile.me` | Xem hồ sơ cá nhân | Tra cứu · Đọc | `GET /auth/me` | — | Khả dụng |
| `account.profile.update` | Cập nhật tên hiển thị của tôi | Sửa · Ghi | `PATCH /auth/profile` | Có | Khả dụng |
| `account.telegram-link.status` | Xem trạng thái liên kết Telegram của tôi | Tra cứu · Đọc | `GET /auth/telegram-link` | — | Khả dụng |

### chat — `chat:chat`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.2cad6a5af287c9ed` | Rời phòng trò chuyện | Xóa · Ghi | `DELETE /chat/rooms/:roomId/leave` | Có | Khả dụng |
| `api.delete.405c62abccc22d73` | Xóa tin nhắn trong phòng chat | Xóa · Ghi | `DELETE /chat/rooms/:roomId/messages/:messageId` | Có | Khả dụng |
| `api.delete.6b7e088799881047` | Xóa phòng trò chuyện | Xóa · Ghi | `DELETE /chat/rooms/:roomId` | Có | Khả dụng |
| `api.get.0a45433dc8df2971` | Tìm tin nhắn theo từ khóa trong phòng chat | Tra cứu · Đọc | `GET /chat/rooms/:roomId/search` | — | Khả dụng |
| `api.get.6646f41687f69fcf` | Xem bản xem trước đường dẫn | Tra cứu · Đọc | `GET /chat/link-preview` | — | Khả dụng |
| `api.patch.9f9de0519c320dba` | Sửa nội dung tin nhắn trong phòng chat | Sửa · Ghi | `PATCH /chat/rooms/:roomId/messages/:messageId` | Có | Khả dụng |
| `api.patch.d4060a45017e2ff2` | Cập nhật thông tin phòng trò chuyện | Sửa · Ghi | `PATCH /chat/rooms/:roomId` | Có | Khả dụng |
| `api.post.0ca30bd0f44e4447` | Tạo phòng trò chuyện | Tạo · Ghi | `POST /chat/rooms` | Có | Khả dụng |
| `api.post.15ba51d677614349` | Thực hiện trò chuyện phòng trò chuyện thành viên | Tạo · Ghi | `POST /chat/rooms/:roomId/members` | Có | Khả dụng |
| `api.post.34721e0ad003aba8` | Gửi tin nhắn trò chuyện phòng trò chuyện | Gửi / liên lạc · Ghi | `POST /chat/rooms/:roomId/messages` | Có | Khả dụng |
| `api.post.37d3c6ae92576f7d` | Thực hiện trò chuyện phòng trò chuyện tin nhắn bày tỏ cảm xúc | Tạo · Ghi | `POST /chat/rooms/:roomId/messages/:messageId/react` | Có | Khả dụng |
| `api.post.383280e18fd7151d` | Ghim hoặc bỏ ghim phòng trò chuyện | Tạo · Ghi | `POST /chat/rooms/:roomId/toggle-pin` | Có | Khả dụng |
| `api.post.42aabe336dd32361` | Ghim trò chuyện phòng trò chuyện | Tạo · Ghi | `POST /chat/rooms/:roomId/pin` | Có | Khả dụng |
| `api.post.98ca589fbd77b8d0` | Bỏ ghim trò chuyện phòng trò chuyện | Tạo · Ghi | `POST /chat/rooms/:roomId/unpin` | Có | Khả dụng |
| `api.post.d63432efae84cbc1` | Thực hiện trò chuyện phòng trò chuyện đã đọc | Tạo · Ghi | `POST /chat/rooms/:roomId/read` | Có | Khả dụng |

### notification — `chat:notification`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `notification.delete` | Xóa một thông báo của tôi | Xóa · Ghi | `DELETE /notifications/:id` | Có | Khả dụng |
| `notification.list` | Xem thông báo của tôi | Tra cứu · Đọc | `GET /notifications` | — | Khả dụng |
| `notification.mark-all-read` | Đánh dấu đã đọc toàn bộ thông báo của tôi | Gửi / liên lạc · Ghi | `PATCH /notifications/read-all` | Có | Khả dụng |
| `notification.mark-read` | Đánh dấu đã đọc một thông báo | Gửi / liên lạc · Ghi | `PATCH /notifications/:id/read` | Có | Khả dụng |

### notifications — `chat:notifications`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.post.7cae6bbc334b2879` | Gửi thông báo | Gửi / liên lạc · Ghi | `POST /notifications` | Có | Khả dụng |

### room — `chat:room`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `chat.room.member.remove` | Xóa thành viên khỏi phòng chat | Xóa · Ghi | `DELETE /chat/rooms/:roomId/members/:userId` | Có | Khả dụng |
| `chat.room.member.role.update` | Cập nhật vai trò thành viên trong phòng chat | Sửa · Ghi | `POST /chat/rooms/:roomId/members/:userId/role` | Có | Khả dụng |
| `chat.room.members.list` | Tra cứu thành viên trong phòng chat | Tra cứu · Đọc | `GET /chat/rooms/:roomId` | — | Khả dụng |
| `chat.room.messages.list` | Xem danh sách tin nhắn trong phòng chat | Tra cứu · Đọc | `GET /chat/rooms/:roomId/messages` | — | Khả dụng |
| `chat.room.transfer-admin` | Chuyển quyền Trưởng nhóm trong phòng chat | Tạo · Ghi | `POST /chat/rooms/:roomId/transfer-admin` | Có | Khả dụng |

### rooms — `chat:rooms`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `chat.rooms.list` | Tra cứu phòng trò chuyện | Tra cứu · Đọc | `GET /chat/rooms` | — | Khả dụng |

<a id="module-student"></a>
## Quản lý học viên — `student`

Tổng 109 action: 42 đọc, 67 ghi; 0 không khả dụng.

### account — `student:account`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `account.business-settings.update` | Cập nhật lĩnh vực đào tạo của tài khoản đang đăng nhập | Sửa · Ghi | `PATCH /auth/business-settings` | Có | Khả dụng |

### ai — `student:ai`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.post.a6cfd8985d17e407` | Phân tích AI | Tra cứu · Ghi | `POST /ai/analyze` | Có | Khả dụng |

### assignment — `student:assignment`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.assignment.create` | Tạo bài tập cho lớp | Tạo · Ghi | `POST /assignments` | Có | Khả dụng |
| `student.assignment.grade` | Chấm điểm bài tập | Tạo · Ghi | `POST /assignments/:id/students/:studentId/grade` | Có | Khả dụng |
| `student.assignment.list` | Tra cứu bài tập trong lớp | Tra cứu · Đọc | `GET /assignments` | — | Khả dụng |
| `student.assignment.submissions.list` | Tra cứu tình trạng nộp bài | Tra cứu · Đọc | `GET /assignments/:id/submissions` | — | Khả dụng |

### assignments — `student:assignments`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.post.ed6d61a8578e4260` | Nộp bài thay cho học viên | Tạo · Ghi | `POST /assignments/:id/students/:studentId/submit` | Có | Khả dụng |

### attendance — `student:attendance`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.e5e08c5df6457528` | Tra cứu các lần xác thực điểm danh | Tra cứu · Đọc | `GET /attendance/attempts` | — | Khả dụng |

### bulk — `student:bulk`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.bulk.create` | Tạo nhiều hồ sơ học viên | Tạo · Ghi | `POST /students/bulk` | Có | Khả dụng |
| `student.bulk.delete` | Xóa nhiều hồ sơ học viên | Xóa · Ghi | `POST /students/bulk-delete` | Có | Khả dụng |
| `student.bulk.delete.preview` | Xem trước ảnh hưởng khi xóa học viên | Tra cứu · Đọc | `POST /students/bulk-delete-preview` | — | Khả dụng |
| `student.bulk.preview` | Kiểm tra danh sách học viên trước khi nhập | Tra cứu · Đọc | `POST /students/bulk-preview` | — | Khả dụng |

### custom-field — `student:custom-field`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.custom-field.archive` | Lưu trữ trường dữ liệu tùy chỉnh | Sửa · Ghi | `POST /student-management/custom-fields/:moduleKey/:id/archive` | Có | Khả dụng |
| `student.custom-field.create` | Tạo trường dữ liệu tùy chỉnh | Tạo · Ghi | `POST /student-management/custom-fields/:moduleKey` | Có | Khả dụng |
| `student.custom-field.delete` | Xóa trường dữ liệu tùy chỉnh | Xóa · Ghi | `POST /student-management/custom-fields/:moduleKey/:id/delete` | Có | Khả dụng |
| `student.custom-field.list` | Tra cứu trường dữ liệu tùy chỉnh | Tra cứu · Đọc | `GET /student-management/custom-fields/:moduleKey` | — | Khả dụng |
| `student.custom-field.restore` | Khôi phục trường dữ liệu tùy chỉnh | Sửa · Ghi | `POST /student-management/custom-fields/:moduleKey/:id/restore` | Có | Khả dụng |
| `student.custom-field.update` | Cập nhật trường dữ liệu tùy chỉnh | Sửa · Ghi | `PATCH /student-management/custom-fields/:moduleKey/:id` | Có | Khả dụng |

### email — `student:email`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.email.send` | Gửi email theo yêu cầu | Gửi / liên lạc · Ghi | `POST /send-email` | Có | Khả dụng |

### exam — `student:exam`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.exam.assign` | Gán học viên đủ điều kiện vào kỳ thi | Xử lý · Ghi | `POST /exams/:id/assign` | Có | Khả dụng |
| `student.exam.assigned-students.list` | Xem học viên đang được gán vào kỳ thi | Tra cứu · Đọc | `GET /exams/:id/assigned-students` | — | Khả dụng |
| `student.exam.create` | Tạo kỳ thi | Tạo · Ghi | `POST /exams` | Có | Khả dụng |
| `student.exam.delete` | Xóa kỳ thi | Xóa · Ghi | `DELETE /exams/:id` | Có | Khả dụng |
| `student.exam.detail` | Xem thông tin kỳ thi | Tra cứu · Đọc | `GET /exams/:id` | — | Khả dụng |
| `student.exam.eligible-students.list` | Chọn học viên đủ điều kiện của lớp trong kỳ thi | Tra cứu · Đọc | `GET /exams/:id/eligible-students` | — | Khả dụng |
| `student.exam.grade-results.update` | Nhập hoặc cập nhật điểm thi | Sửa · Ghi | `PATCH /exams/:id/results` | Có | Khả dụng |
| `student.exam.grade-roster.list` | Chọn thí sinh trong kỳ thi | Tra cứu · Đọc | `GET /exams/:id/grade-roster` | — | Khả dụng |
| `student.exam.list` | Tra cứu kỳ thi | Tra cứu · Đọc | `GET /exams` | — | Khả dụng |
| `student.exam.result.update` | Cập nhật kết quả một thí sinh | Sửa · Ghi | `POST /exams/:id/students/:studentId/result` | Có | Khả dụng |
| `student.exam.unassign` | Gỡ học viên khỏi kỳ thi và xóa mục lịch sử thi | Xóa · Ghi | `POST /exams/:id/unassign` | Có | Khả dụng |
| `student.exam.update` | Cập nhật kỳ thi | Sửa · Ghi | `PATCH /exams/:id` | Có | Khả dụng |

### installment — `student:installment`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.installment.create` | Tạo đợt học phí cho học viên | Tạo · Ghi | `POST /students/:id/installments` | Có | Khả dụng |
| `student.installment.update` | Cập nhật đợt học phí của học viên | Sửa · Ghi | `PATCH /students/:id/installments/:no` | Có | Khả dụng |

### installments — `student:installments`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.installments.list` | Tra cứu các đợt học phí của học viên | Tra cứu · Đọc | `GET /students/:id/installments` | — | Khả dụng |

### Khóa học — `student:course`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `course.category.create` | Tạo phân loại khóa học | Tạo · Ghi | `POST /courses/categories` | Có | Khả dụng |
| `course.category.delete` | Xóa danh mục khóa học | Xóa · Ghi | `DELETE /courses/categories/:id` | Có | Khả dụng |
| `course.category.list` | Tra cứu danh mục khóa học | Tra cứu · Đọc | `GET /courses/categories` | — | Khả dụng |
| `course.create` | Tạo khóa học cho học viên | Tạo · Ghi | `POST /courses` | Có | Khả dụng |
| `course.delete` | Xóa khóa học | Xóa · Ghi | `DELETE /courses/:id` | Có | Khả dụng |
| `course.detail` | Xem chi tiết khóa học | Tra cứu · Đọc | `GET /courses/:id` | — | Khả dụng |
| `course.list` | Tra cứu khóa học | Tra cứu · Đọc | `GET /courses` | — | Khả dụng |
| `course.update` | Cập nhật khóa học | Sửa · Ghi | `PATCH /courses/:id` | Có | Khả dụng |

### learning-history — `student:learning-history`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.learning-history` | Xem tiến độ học tập của học viên | Tra cứu · Đọc | `GET /students/:id/learning-history` | — | Khả dụng |

### learning-roadmap — `student:learning-roadmap`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.learning-roadmap.create` | Tạo lộ trình học | Tạo · Ghi | `POST /learning-roadmaps` | Có | Khả dụng |
| `student.learning-roadmap.delete` | Xóa lộ trình học | Xóa · Ghi | `DELETE /learning-roadmaps/:id` | Có | Khả dụng |
| `student.learning-roadmap.list` | Tra cứu lộ trình học | Tra cứu · Đọc | `GET /learning-roadmaps` | — | Khả dụng |
| `student.learning-roadmap.progression.list` | Xem điều kiện và quyết định lên lớp | Tra cứu · Đọc | `GET /learning-roadmaps/batches/:batchId/progression` | — | Khả dụng |
| `student.learning-roadmap.progression.update` | Cập nhật quyết định học tiếp hoặc bảo lưu | Sửa · Ghi | `PATCH /learning-roadmaps/batches/:batchId/students/:studentId/progression` | Có | Khả dụng |
| `student.learning-roadmap.promote` | Chuyển học viên lên lớp tiếp theo | Tạo · Ghi | `POST /learning-roadmaps/batches/:batchId/promote` | Có | Khả dụng |
| `student.learning-roadmap.steps.list` | Tra cứu chặng của lộ trình | Tra cứu · Đọc | `GET /learning-roadmaps/:id/steps` | — | Khả dụng |
| `student.learning-roadmap.update` | Cập nhật lộ trình học | Sửa · Ghi | `PATCH /learning-roadmaps/:id` | Có | Khả dụng |
| `student.learning-roadmap.waitlist.list` | Tra cứu học viên trong danh sách chờ lộ trình | Tra cứu · Đọc | `GET /learning-roadmaps/waitlist` | — | Khả dụng |
| `student.learning-roadmap.waitlist.place` | Xếp học viên trong danh sách chờ vào lớp | Tra cứu · Ghi | `POST /learning-roadmaps/waitlist/place` | Có | Khả dụng |

### Lớp học — `student:batch`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `batch.attendance.delete` | Xóa điểm danh của lớp trong ngày | Xóa · Ghi | `DELETE /batches/:id/attendance` | Có | Khả dụng |
| `batch.attendance.learners` | Chọn học viên trong lớp để cập nhật điểm danh | Tra cứu · Đọc | `GET /batches/:id/attendance/learners` | — | Khả dụng |
| `batch.attendance.record.update` | Cập nhật điểm danh một học viên | Sửa · Ghi | `PATCH /batches/:id/attendance/learner` | Có | Khả dụng |
| `batch.list` | Tra cứu lớp học | Tra cứu · Đọc | `GET /batches` | — | Khả dụng |
| `student.batch.attendance.summary` | Báo cáo điểm danh lớp học theo ngày | Báo cáo · Đọc | `GET /batches/:id` | — | Khả dụng |
| `student.batch.create` | Tạo lớp học | Tạo · Ghi | `POST /batches` | Có | Khả dụng |
| `student.batch.delete` | Xóa lớp học | Xóa · Ghi | `DELETE /batches/:id` | Có | Khả dụng |
| `student.batch.detail` | Xem thông tin lớp học | Tra cứu · Đọc | `GET /batches/:id` | — | Khả dụng |
| `student.batch.enrollment.update` | Cập nhật trạng thái học viên trong lớp | Sửa · Ghi | `PATCH /batches/:id/learners/:studentId/enrollment-status` | Có | Khả dụng |
| `student.batch.enrollments.list` | Tra cứu học viên và trạng thái ghi danh trong lớp | Tra cứu · Đọc | `GET /batches/:id/enrollments` | — | Khả dụng |
| `student.batch.learner.add` | Thêm học viên vào lớp | Tạo · Ghi | `POST /batches/:id/learners` | Có | Khả dụng |
| `student.batch.learner.remove` | Xóa học viên khỏi lớp | Xóa · Ghi | `DELETE /batches/:id/learners/:studentId` | Có | Khả dụng |
| `student.batch.progress-colors.list` | Xem màu đánh giá tiến độ lớp | Tra cứu · Đọc | `GET /batches/settings/progress-colors` | — | Khả dụng |
| `student.batch.progress-colors.update` | Cập nhật màu đánh giá tiến độ lớp | Sửa · Ghi | `PATCH /batches/settings/progress-colors` | Có | Khả dụng |
| `student.batch.update` | Cập nhật lớp học | Sửa · Ghi | `PATCH /batches/:id` | Có | Khả dụng |

### module-settings — `student:module-settings`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.module-settings.get` | Xem loại hồ sơ đang áp dụng | Tra cứu · Đọc | `GET /student-management/settings` | — | Khả dụng |

### notification — `student:notification`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.notification.create` | Tạo bản ghi thông báo học viên | Tạo · Ghi | `POST /student-notifications` | Có | Khả dụng |
| `student.notification.delete` | Xóa bản ghi thông báo học viên | Xóa · Ghi | `DELETE /student-notifications/:id` | Có | Khả dụng |
| `student.notification.list` | Tra cứu thông báo học viên | Tra cứu · Đọc | `GET /student-notifications` | — | Khả dụng |
| `student.notification.update` | Sửa bản ghi thông báo học viên | Sửa · Ghi | `PATCH /student-notifications/:id` | Có | Khả dụng |

### online-attendance — `student:online-attendance`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.online-attendance.create-sessions` | Gửi mã điểm danh trực tuyến cho lớp | Tạo · Ghi | `POST /attendance/online/sessions` | Có | Khả dụng |

### payment — `student:payment`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.payment.create` | Ghi nhận khoản thu học phí | Tạo · Ghi | `POST /payments` | Có | Khả dụng |
| `student.payment.delete` | Xóa giao dịch học phí | Xóa · Ghi | `DELETE /payments/:id` | Có | Khả dụng |
| `student.payment.list` | Tra cứu giao dịch học phí | Tra cứu · Đọc | `GET /payments` | — | Khả dụng |
| `student.payment.reconcile` | Đối chiếu học phí học viên | Tra cứu · Đọc | `GET /payments/reconciliation/:id` | — | Khả dụng |
| `student.payment.update` | Sửa thông tin giao dịch học phí | Sửa · Ghi | `PATCH /payments/:id` | Có | Khả dụng |

### quality — `student:quality`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.quality.assessment.update` | Cập nhật đánh giá học viên | Sửa · Ghi | `PATCH /student-quality/batches/:batchId/students/:studentId` | Có | Khả dụng |
| `student.quality.assignment.grade` | Chấm hoặc cập nhật điểm bài tập | Sửa · Ghi | `PATCH /student-quality/batches/:batchId/students/:studentId/assignments/:assignmentId` | Có | Khả dụng |
| `student.quality.list` | Tra cứu chất lượng học viên | Tra cứu · Đọc | `GET /student-quality` | — | Khả dụng |
| `student.quality.mini-test.create` | Tạo bài kiểm tra ngắn cho học viên | Tạo · Ghi | `POST /student-quality/batches/:batchId/students/:studentId/mini-tests` | Có | Khả dụng |
| `student.quality.mini-test.delete` | Xóa điểm mini test của học viên | Xóa · Ghi | `DELETE /student-quality/batches/:batchId/students/:studentId/mini-tests/:miniTestId` | Có | Khả dụng |
| `student.quality.mini-test.update` | Cập nhật mini test của học viên | Sửa · Ghi | `PATCH /student-quality/batches/:batchId/students/:studentId/mini-tests/:miniTestId` | Có | Khả dụng |
| `student.quality.mini-tests.list` | Tra cứu bài kiểm tra ngắn của học viên | Tra cứu · Đọc | `GET /student-quality/batches/:batchId/students/:studentId` | — | Khả dụng |
| `student.quality.thresholds.list` | Xem ngưỡng đánh giá chất lượng học viên | Tra cứu · Đọc | `GET /student-quality/settings/thresholds` | — | Khả dụng |
| `student.quality.thresholds.update` | Cập nhật ngưỡng đánh giá chất lượng học viên | Sửa · Ghi | `PATCH /student-quality/settings/thresholds` | Có | Khả dụng |

### resource — `student:resource`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.resource.booking.create` | Đặt lịch phòng học hoặc thiết bị | Tạo · Ghi | `POST /student-resources/:id/bookings` | Có | Khả dụng |
| `student.resource.booking.delete` | Hủy lịch đặt phòng học hoặc thiết bị | Xóa · Ghi | `DELETE /student-resources/:id/bookings/:bookingId` | Có | Khả dụng |
| `student.resource.bookings.list` | Tra cứu lịch đặt phòng học hoặc tài nguyên | Tra cứu · Đọc | `GET /student-resources/:id` | — | Khả dụng |
| `student.resource.category.create` | Thêm loại phòng học, thiết bị hoặc tài nguyên | Tạo · Ghi | `POST /student-resources/categories` | Có | Khả dụng |
| `student.resource.category.delete` | Xóa loại phòng học, thiết bị hoặc tài nguyên | Xóa · Ghi | `DELETE /student-resources/categories/:id` | Có | Khả dụng |
| `student.resource.category.list` | Tra cứu loại phòng học, thiết bị và tài nguyên | Tra cứu · Đọc | `GET /student-resources/categories` | — | Khả dụng |
| `student.resource.create` | Thêm phòng học hoặc thiết bị | Tạo · Ghi | `POST /student-resources` | Có | Khả dụng |
| `student.resource.delete` | Xóa phòng học hoặc thiết bị | Xóa · Ghi | `DELETE /student-resources/:id` | Có | Khả dụng |
| `student.resource.detail` | Xem chi tiết phòng học hoặc thiết bị | Tra cứu · Đọc | `GET /student-resources/:id` | — | Khả dụng |
| `student.resource.list` | Tra cứu phòng học, thiết bị và tài nguyên | Tra cứu · Đọc | `GET /student-resources` | — | Khả dụng |
| `student.resource.update` | Sửa phòng học hoặc thiết bị | Sửa · Ghi | `PATCH /student-resources/:id` | Có | Khả dụng |

### schedule — `student:schedule`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.schedule.list` | Tra cứu lịch lớp, kỳ thi và lịch đặt tài nguyên | Tra cứu · Đọc | `GET /schedule` | — | Khả dụng |

### standard-fields — `student:standard-fields`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.standard-fields.list` | Tra cứu trường tiêu chuẩn | Tra cứu · Đọc | `GET /student-management/standard-fields/:moduleKey` | — | Khả dụng |
| `student.standard-fields.update` | Cập nhật một trường tiêu chuẩn | Sửa · Ghi | `PUT /student-management/standard-fields/:moduleKey` | Có | Khả dụng |

### students — `student:students`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.patch.5bb1b2bfdbad4548` | Đánh dấu đợt học phí đã thu | Sửa · Ghi | `PATCH /students/:id/installment/:no/mark-paid` | Có | Khả dụng |
| `api.patch.6d0c5baf91c41cc1` | Chuyển học viên chưa gán chi nhánh | Sửa · Ghi | `PATCH /students/:id/assign-branch` | Có | Khả dụng |
| `student.create` | Tạo hồ sơ học viên | Tạo · Ghi | `POST /students` | Có | Khả dụng |
| `student.detail` | Xem thông tin học viên | Tra cứu · Đọc | `GET /students/:id` | — | Khả dụng |
| `student.list` | Tra cứu học viên | Tra cứu · Đọc | `GET /students` | — | Khả dụng |
| `student.update` | Cập nhật hồ sơ học viên | Sửa · Ghi | `PATCH /students/:id` | Có | Khả dụng |

### unassigned — `student:unassigned`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `student.unassigned.list` | Tra cứu học viên chưa có chi nhánh | Tra cứu · Đọc | `GET /students/unassigned` | — | Khả dụng |

<a id="module-worker"></a>
## Quản lý lao động — `worker`

Tổng 31 action: 12 đọc, 19 ghi; 0 không khả dụng.

### attendance — `worker:attendance`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.attendance.list` | Tra cứu bảng chấm công dự án | Tra cứu · Đọc | `GET /worker-management/attendance` | — | Khả dụng |
| `worker.attendance.mark` | Ghi nhận chấm công lao động | Tạo · Ghi | `POST /worker-management/attendance/mark` | Có | Khả dụng |
| `worker.attendance.update` | Điều chỉnh giờ chấm công | Sửa · Ghi | `PATCH /worker-management/attendance/:id` | Có | Khả dụng |

### bulk — `worker:bulk`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.bulk.create` | Tạo nhiều hồ sơ lao động | Tạo · Ghi | `POST /worker-management/workers/bulk` | Có | Khả dụng |
| `worker.bulk.delete` | Xóa mềm nhiều hồ sơ lao động | Xóa · Ghi | `POST /worker-management/workers/bulk-delete` | Có | Khả dụng |

### dashboard — `worker:dashboard`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.dashboard` | Xem tổng quan lao động | Tra cứu · Đọc | `GET /worker-management/dashboard` | — | Khả dụng |

### Dự án — `worker:project`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.project.create` | Tạo dự án lao động | Tạo · Ghi | `POST /worker-management/projects` | Có | Khả dụng |
| `worker.project.delete` | Xóa dự án lao động | Xóa · Ghi | `DELETE /worker-management/projects/:id` | Có | Khả dụng |
| `worker.project.detail` | Xem thông tin dự án lao động | Tra cứu · Đọc | `GET /worker-management/projects/:id` | — | Khả dụng |
| `worker.project.list` | Tra cứu dự án lao động | Tra cứu · Đọc | `GET /worker-management/projects` | — | Khả dụng |
| `worker.project.update` | Cập nhật dự án lao động | Sửa · Ghi | `PATCH /worker-management/projects/:id` | Có | Khả dụng |
| `worker.project.worker.add` | Thêm lao động vào dự án | Tạo · Ghi | `POST /worker-management/projects/:id/workers` | Có | Khả dụng |
| `worker.project.worker.remove` | Gỡ lao động khỏi dự án | Xóa · Ghi | `DELETE /worker-management/projects/:id/workers/:workerId` | Có | Khả dụng |
| `worker.project.workers.add` | Thêm nhiều lao động vào dự án | Tạo · Ghi | `POST /worker-management/projects/:id/workers/bulk` | Có | Khả dụng |

### labor — `worker:labor`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.labor.contract.create` | Tạo hợp đồng lao động | Tạo · Ghi | `POST /worker-management/labor-contracts` | Có | Khả dụng |
| `worker.labor.contract.delete` | Xóa hợp đồng lao động | Xóa · Ghi | `DELETE /worker-management/labor-contracts/:id` | Có | Khả dụng |
| `worker.labor.contract.detail` | Xem chi tiết hợp đồng lao động | Tra cứu · Đọc | `GET /worker-management/labor-contracts/:id` | — | Khả dụng |
| `worker.labor.contract.history` | Xem lịch sử gia hạn hợp đồng lao động | Tra cứu · Đọc | `GET /worker-management/labor-contracts/:id/history` | — | Khả dụng |
| `worker.labor.contract.list` | Tra cứu hợp đồng lao động | Tra cứu · Đọc | `GET /worker-management/labor-contracts` | — | Khả dụng |
| `worker.labor.contract.renew` | Gia hạn hợp đồng lao động | Tạo · Ghi | `POST /worker-management/labor-contracts/:id/renew` | Có | Khả dụng |
| `worker.labor.contract.update` | Cập nhật hợp đồng lao động | Sửa · Ghi | `PATCH /worker-management/labor-contracts/:id` | Có | Khả dụng |

### labor contracts — `worker:labor-contracts`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.975d2e3032a3229a` | Tổng hợp hợp đồng sắp hết hạn | Báo cáo · Đọc | `GET /worker-management/labor-contracts/expiring-summary` | — | Khả dụng |

### notification — `worker:notification`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.notification.create` | Gửi thông báo lao động | Tạo · Ghi | `POST /worker-management/notifications` | Có | Khả dụng |
| `worker.notification.list` | Tra cứu thông báo lao động | Tra cứu · Đọc | `GET /worker-management/notifications` | — | Khả dụng |

### reports — `worker:reports`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.report` | Báo cáo chấm công và thiếu lao động theo dự án | Báo cáo · Đọc | `GET /worker-management/reports/assistant` | — | Khả dụng |

### standard-fields — `worker:standard-fields`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.standard-fields.list` | Tra cứu trường hồ sơ lao động | Tra cứu · Đọc | `GET /worker-management/standard-fields` | — | Khả dụng |
| `worker.standard-fields.update` | Cập nhật trường hồ sơ lao động | Sửa · Ghi | `PUT /worker-management/standard-fields` | Có | Khả dụng |

### workers — `worker:workers`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.create` | Tạo hồ sơ lao động | Tạo · Ghi | `POST /worker-management/workers` | Có | Khả dụng |
| `worker.delete` | Xóa hồ sơ lao động | Xóa · Ghi | `DELETE /worker-management/workers/:id` | Có | Khả dụng |
| `worker.list` | Tra cứu người lao động | Tra cứu · Đọc | `GET /worker-management/workers` | — | Khả dụng |
| `worker.update` | Cập nhật hồ sơ lao động | Sửa · Ghi | `PATCH /worker-management/workers/:id` | Có | Khả dụng |

<a id="module-student-partner"></a>
## Đối tác tuyển sinh — `student-partner`

Tổng 14 action: 4 đọc, 10 ghi; 1 không khả dụng.

### Cấu hình hoa hồng đối tác học viên — `student-partner:partner-commission-settings`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.abafb6f27753de55` | Xóa cấp bậc hoa hồng | Xóa · Ghi | `DELETE /partners/commission-levels/:id` | Có | Khả dụng |
| `api.patch.c3613ac62ed49013` | Cập nhật cấu hình hoa hồng | Sửa · Ghi | `PATCH /partners/commission-levels/:id` | Có | Khả dụng |
| `api.post.dda51f40f1cbd125` | Tạo cấu hình hoa hồng | Tạo · Ghi | `POST /partners/commission-levels` | Có | Khả dụng |
| `partner.commission.levels.list` | Tra cứu cấu hình hoa hồng | Tra cứu · Đọc | `GET /partners/commission-levels` | — | Khả dụng |

### Chi trả hoa hồng đối tác học viên — `student-partner:partner-payouts`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.post.5e1017ef3a76d4f1` | Ghi nhận chi trả hoa hồng đối tác | Tạo · Ghi | `POST /partners/:id/payouts` | Có | Khả dụng |

### Hồ sơ đối tác học viên — `student-partner:partner-records`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.9043f4e5cc3aefab` | Xóa đối tác giới thiệu | Xóa · Ghi | `DELETE /partners/:id` | Có | Khả dụng |
| `api.get.74c43c3c00197209` | Xem thông tin đối tác | Tra cứu · Đọc | `GET /partners/:id` | — | Khả dụng |
| `api.patch.fee44cbce47ae377` | Cập nhật thông tin liên hệ đối tác | Sửa · Ghi | `PATCH /partners/:id` | Có | Khả dụng |
| `api.post.682981444c12f0aa` | Tạo cộng tác viên giới thiệu học viên | Tạo · Ghi | `POST /partners` | Có | Khả dụng |
| `partner.bank-details.update` | Cập nhật thông tin chuyển khoản đối tác | Sửa · Ghi | `PATCH /partners/:id` | Có | Khả dụng |
| `partner.commission.update` | Cấu hình hoa hồng cho đối tác | Sửa · Ghi | `PATCH /partners/:id` | Có | Không khả dụng: Hoa hồng đối tác học viên hiện được tính theo cấp bậc và tổng học phí giới thiệu. Lưu mức riêng trên hồ sơ không thay đổi kết quả tính. Mình chưa lưu. Bạn cần chọn cấp bậc hoa hồng muốn điều chỉnh. |
| `partner.list` | Tra cứu đối tác | Tra cứu · Đọc | `GET /partners` | — | Khả dụng |

### Phân tích đối tác học viên — `student-partner:partner-analysis`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `partner.analysis` | Phân tích đối tác học viên | Báo cáo · Đọc | `GET /partners` | — | Khả dụng |

### Quản lý hàng loạt đối tác học viên — `student-partner:partner-bulk-management`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `partner.bulk.create` | Tạo nhiều đối tác | Tạo · Ghi | `POST /partners/bulk` | Có | Khả dụng |

<a id="module-labor-partner"></a>
## Đối tác lao động — `labor-partner`

Tổng 32 action: 12 đọc, 20 ghi; 0 không khả dụng.

### Báo cáo hoa hồng đối tác — `labor-partner:partner-commission-report`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.4ecb05d1dddb3fdc` | Xem báo cáo hoa hồng đối tác lao động | Báo cáo · Đọc | `GET /worker-management/partners/reports/commission` | — | Khả dụng |

### Chi trả hoa hồng đối tác — `labor-partner:partner-payouts`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.partner.payout.reverse` | Đảo khoản chi trả hoa hồng đối tác lao động | Tạo · Ghi | `POST /worker-management/partners/payouts/:payoutId/reverse` | Có | Khả dụng |

### Chính sách đối tác lao động — `labor-partner:partner-policies`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.b01de2c5e1417d90` | Xóa chính sách hoa hồng đối tác lao động | Xóa · Ghi | `DELETE /worker-management/partners/policies/:policyId` | Có | Khả dụng |
| `api.patch.2971d5a8a97f8be8` | Cập nhật chính sách hoa hồng đối tác lao động | Sửa · Ghi | `PATCH /worker-management/partners/policies/:policyId` | Có | Khả dụng |
| `api.post.6346fd99746602d2` | Ngừng áp dụng chính sách hoa hồng đối tác lao động | Tạo · Ghi | `POST /worker-management/partners/policies/:policyId/retire` | Có | Khả dụng |
| `api.post.a58fa4b9dd69941c` | Kích hoạt chính sách hoa hồng đối tác lao động | Sửa · Ghi | `POST /worker-management/partners/policies/:policyId/activate` | Có | Khả dụng |
| `api.post.c7d183398e44331e` | Sao chép chính sách hoa hồng đối tác lao động | Tạo · Ghi | `POST /worker-management/partners/policies/:policyId/clone` | Có | Khả dụng |
| `api.post.e57ae0da3cdf14f8` | Tạo chính sách hoa hồng đối tác lao động | Tạo · Ghi | `POST /worker-management/partners/policies` | Có | Khả dụng |
| `worker.partner.policy.detail` | Xem chính sách hoa hồng đối tác lao động | Tra cứu · Đọc | `GET /worker-management/partners/policies/:policyId` | — | Khả dụng |
| `worker.partner.policy.list` | Tra cứu chính sách hoa hồng đối tác lao động | Tra cứu · Đọc | `GET /worker-management/partners/policies` | — | Khả dụng |

### Đối soát hoa hồng đối tác — `labor-partner:partner-settlements`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.post.0137e041d2b60a80` | Thực hiện lao động quản lý đối tác đối soát điều chỉnh | Sửa · Ghi | `POST /worker-management/partners/settlements/:settlementId/adjustments` | Có | Khả dụng |
| `api.post.4b815164a8bb4143` | Thực hiện lao động quản lý đối tác đối soát hủy hiệu lực | Hủy · Ghi | `POST /worker-management/partners/settlements/:settlementId/void` | Có | Khả dụng |
| `api.post.92a650eadaee6bcd` | Thực hiện lao động quản lý đối tác đối soát chi trả | Tạo · Ghi | `POST /worker-management/partners/settlements/:settlementId/payouts` | Có | Khả dụng |
| `api.post.db51d33ae72d81b2` | Phê duyệt lao động quản lý đối tác đối soát | Duyệt · Ghi | `POST /worker-management/partners/settlements/:settlementId/approve` | Có | Khả dụng |
| `worker.partner.settlement.calculate` | Tính đối soát hoa hồng đối tác lao động | Tạo · Ghi | `POST /worker-management/partners/settlements/calculate` | Có | Khả dụng |
| `worker.partner.settlement.detail` | Xem chi tiết kỳ đối soát hoa hồng đối tác lao động | Tra cứu · Đọc | `GET /worker-management/partners/settlements/:settlementId` | — | Khả dụng |
| `worker.partner.settlement.recalculate` | Tính lại kỳ đối soát hoa hồng đối tác lao động | Tạo · Ghi | `POST /worker-management/partners/settlements/:settlementId/recalculate` | Có | Khả dụng |
| `worker.partner.settlements.list` | Tra cứu kỳ đối soát hoa hồng đối tác lao động | Tra cứu · Đọc | `GET /worker-management/partners/settlements` | — | Khả dụng |

### Hồ sơ đối tác lao động — `labor-partner:partner-records`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.047cfef00a296a0d` | Xóa lao động quản lý đối tác | Xóa · Ghi | `DELETE /worker-management/partners/:partnerId` | Có | Khả dụng |
| `api.get.8ee13f2f02a5abfd` | Xem đối tác cung ứng lao động | Tra cứu · Đọc | `GET /worker-management/partners/:partnerId` | — | Khả dụng |
| `api.patch.4309612e371b6aa2` | Cập nhật đối tác cung ứng lao động | Sửa · Ghi | `PATCH /worker-management/partners/:partnerId` | Có | Khả dụng |
| `api.post.51cd07ea5eae455b` | Tạo cộng tác viên lao động | Tạo · Ghi | `POST /worker-management/partners` | Có | Khả dụng |
| `worker.partner.list` | Tra cứu đối tác cung ứng lao động | Tra cứu · Đọc | `GET /worker-management/partners` | — | Khả dụng |

### Lượt giới thiệu lao động — `labor-partner:partner-referrals`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.post.15425a2f24638e8c` | Thực hiện lao động quản lý đối tác giới thiệu | Tạo · Ghi | `POST /worker-management/partners/:partnerId/referrals` | Có | Khả dụng |
| `api.post.816c2559aba41930` | Thực hiện lao động quản lý đối tác giới thiệu kết thúc | Tạo · Ghi | `POST /worker-management/partners/:partnerId/referrals/:referralId/end` | Có | Khả dụng |
| `worker.partner.referral.confirm` | Xác nhận referral của người lao động | Tạo · Ghi | `POST /worker-management/partners/:partnerId/referrals/:referralId/confirm` | Có | Khả dụng |
| `worker.partner.referrals.list` | Tra cứu người lao động được đối tác giới thiệu | Tra cứu · Đọc | `GET /worker-management/partners/:partnerId/referrals` | — | Khả dụng |
| `worker.partner.worker-referral.list` | Tra cứu đối tác giới thiệu của người lao động | Tra cứu · Đọc | `GET /worker-management/partners/workers/:workerId/referral` | — | Khả dụng |

### Phân tích KPI và lượt giới thiệu lao động — `labor-partner:partner-referral-analysis`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.f7d7b097f3b2fca2` | Phân tích KPI và số lao động giới thiệu của đối tác | Báo cáo · Đọc | `GET /worker-management/partners/kpi` | — | Khả dụng |

### Thiết lập KPI giới thiệu — `labor-partner:partner-kpi-setting`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `worker.partner.kpi.set` | Đặt KPI giới thiệu cho đối tác lao động | Báo cáo · Ghi | `PUT /worker-management/partners/kpi/:partnerId` | Có | Khả dụng |

### Tổng quan đối tác lao động — `labor-partner:partner-dashboard`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.2ed06bd0339e10ae` | Xem tổng quan quyết toán đối tác lao động | Tra cứu · Đọc | `GET /worker-management/partners/dashboard` | — | Khả dụng |
| `api.get.8e68db2c21d01a51` | Xem tổng quan một đối tác lao động | Tra cứu · Đọc | `GET /worker-management/partners/:partnerId/overview` | — | Khả dụng |

<a id="module-customer"></a>
## Khách hàng — `customer`

Tổng 16 action: 9 đọc, 7 ghi; 0 không khả dụng.

### billing — `customer:billing`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `customer.billing.profile.create` | Tạo hồ sơ xuất hóa đơn khách hàng | Tạo · Ghi | `POST /customers/:id/billing-profiles` | Có | Khả dụng |
| `customer.billing.profile.list` | Tra cứu hồ sơ xuất hóa đơn khách hàng | Tra cứu · Đọc | `GET /customers/:id/billing-profiles` | — | Khả dụng |

### customers — `customer:customers`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.0e86266c268fecac` | Xem lịch sử sửa chữa của khách hàng | Tra cứu · Đọc | `GET /customers/:id/repairs` | — | Khả dụng |
| `api.get.51885b828100e376` | Tìm khách hàng | Tra cứu · Đọc | `GET /customers/search` | — | Khả dụng |
| `api.get.c739a754761eb2a2` | Xem lịch sử mua hàng của khách hàng | Tra cứu · Đọc | `GET /customers/:id/purchase-history` | — | Khả dụng |
| `api.get.fe5907605a3c317a` | Xem hồ sơ khách hàng | Tra cứu · Đọc | `GET /customers/:id` | — | Khả dụng |
| `customer.activate` | Kích hoạt khách hàng | Sửa · Ghi | `POST /customers/:id/activate` | Có | Khả dụng |
| `customer.create` | Tạo khách hàng | Tạo · Ghi | `POST /customers` | Có | Khả dụng |
| `customer.deactivate` | Ngừng hoạt động khách hàng | Sửa · Ghi | `POST /customers/:id/deactivate` | Có | Khả dụng |
| `customer.list` | Danh sách khách hàng | Tra cứu · Đọc | `GET /customers` | — | Khả dụng |
| `customer.update` | Cập nhật thông tin khách hàng | Sửa · Ghi | `PATCH /customers/:id` | Có | Khả dụng |

### quick — `customer:quick`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `customer.quick.create` | Tạo nhanh khách hàng tại POS | Tạo · Ghi | `POST /customers/quick` | Có | Khả dụng |

### settings — `customer:settings`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `customer.settings.get` | Xem cài đặt phân hạng khách hàng | Tra cứu · Đọc | `GET /customers/settings` | — | Khả dụng |
| `customer.settings.update` | Cập nhật phân hạng khách hàng | Sửa · Ghi | `PATCH /customers/settings` | Có | Khả dụng |

### transaction — `customer:transaction`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `customer.transaction.detail` | Xem chi tiết giao dịch khách hàng | Tra cứu · Đọc | `GET /customers/:id/transactions/:kind/:sourceId` | — | Khả dụng |

### transactions — `customer:transactions`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `customer.transactions` | Tra cứu lịch sử giao dịch khách hàng | Tra cứu · Đọc | `GET /customers/:id/transactions` | — | Khả dụng |

<a id="module-partner"></a>
## Đối tác cũ — `partner`

Tổng 0 action: 0 đọc, 0 ghi; 0 không khả dụng.

Không có action được đăng ký với module chính này. Đây là mã tương thích cũ; xem riêng Đối tác tuyển sinh và Đối tác lao động.

<a id="module-retail"></a>
## Bán lẻ & POS — `retail`

Tổng 72 action: 43 đọc, 29 ghi; 0 không khả dụng.

### after-sale — `retail:after-sale`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.after-sale.create` | Tạo phiếu đổi trả hoặc thu mua bán lẻ | Tạo · Ghi | `POST /retail/after-sales` | Có | Khả dụng |
| `retail.after-sale.detail` | Xem chứng từ đổi trả hoặc thu mua | Tra cứu · Đọc | `GET /retail/after-sales/:id` | — | Khả dụng |
| `retail.after-sale.list` | Tra cứu chứng từ đổi trả và thu mua | Tra cứu · Đọc | `GET /retail/after-sales` | — | Khả dụng |

### Bán lẻ — `retail:retail`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.1f12700de51c1e66` | Xóa bán lẻ đơn hàng | Xóa · Ghi | `DELETE /retail/orders/:id` | Có | Khả dụng |
| `api.get.070d48d67bb5ed90` | Xem lợi nhuận bán lẻ | Tra cứu · Đọc | `GET /retail/finance/profit` | — | Khả dụng |
| `api.get.1f691abad0a10ee8` | Tra cứu nhóm hàng có thể bán | Tra cứu · Đọc | `GET /retail/orders/categories` | — | Khả dụng |
| `api.get.203a9f8e9a785680` | Xem hoa hồng bán lẻ của tôi | Tra cứu · Đọc | `GET /retail/finance/commission/me` | — | Khả dụng |
| `api.get.33957f831ebdde02` | Tra cứu bảo hành theo mã thiết bị | Tra cứu · Đọc | `GET /retail/warranty/lookup/:code` | — | Khả dụng |
| `api.get.3b0987c2af0ac3e5` | Xem thiết lập in hóa đơn bán lẻ | Tra cứu · Đọc | `GET /retail/settings/print` | — | Khả dụng |
| `api.get.47d83644d10887c0` | Xem điểm thưởng của khách hàng | Tra cứu · Đọc | `GET /retail/points/customers/:id` | — | Khả dụng |
| `api.get.5ac7dee040f9bb15` | Tìm thiết bị sắp hết hạn bảo hành | Tra cứu · Đọc | `GET /retail/warranty/expiring` | — | Khả dụng |
| `api.get.65279c2bb28cac4b` | Tìm thiết bị có nguy cơ thiếu thông tin bảo hành | Tra cứu · Đọc | `GET /retail/warranty/gap-risk` | — | Khả dụng |
| `api.get.717dc1604d98a981` | Tra cứu thiết bị đã bán và thời hạn bảo hành | Tra cứu · Đọc | `GET /retail/warranty/orders` | — | Khả dụng |
| `api.get.78da159ec226e07e` | Phân tích hoa hồng đối tác bán lẻ | Báo cáo · Đọc | `GET /retail/finance/commission/kpi` | — | Khả dụng |
| `api.get.7cae37ab77856122` | Xem chính sách hoa hồng cộng tác viên bán lẻ | Tra cứu · Đọc | `GET /retail/finance/commission/policies` | — | Khả dụng |
| `api.get.905fb162eeadc421` | Xem thiết lập bán lẻ | Tra cứu · Đọc | `GET /retail/settings` | — | Khả dụng |
| `api.get.c15de085b05fbedf` | Kiểm tra tình trạng thanh toán đơn hàng | Tra cứu · Đọc | `GET /retail/orders/:id/payment-status` | — | Khả dụng |
| `api.get.cc59ef5991d28f6a` | Tìm thiết bị theo số sê-ri để bán | Tra cứu · Đọc | `GET /retail/orders/serials` | — | Khả dụng |
| `api.get.fc665b5fde526b87` | Xem chi tiết ca thu ngân | Tra cứu · Đọc | `GET /retail/shifts/:id` | — | Khả dụng |
| `api.post.00a6a513fba7ada4` | Chuyển quầy hoặc két tiền cho ca bán hàng | Tạo · Ghi | `POST /retail/shifts/:id/drawer` | Có | Khả dụng |
| `api.post.12e203d82e400c19` | Đóng ca thu ngân POS | Tạo · Ghi | `POST /retail/shifts/:id/close` | Có | Khả dụng |
| `api.post.65aaf7d2d6ae9faf` | Đánh dấu khoản thu POS đã kiểm tra | Tạo · Ghi | `POST /retail/shifts/settlements/review` | Có | Khả dụng |
| `api.post.6c5a8520aa90cc8e` | Điều chỉnh điểm khách hàng | Sửa · Ghi | `POST /retail/points/customers/:id/adjust` | Có | Khả dụng |
| `api.post.accc645ed354d2b5` | Ghi thu hoặc chi tiền mặt trong ca POS | Tạo · Ghi | `POST /retail/shifts/:id/cash-movements` | Có | Khả dụng |
| `api.post.b0d4095fce422005` | Mở ca thu ngân POS | Tạo · Ghi | `POST /retail/shifts/open` | Có | Khả dụng |
| `api.post.b2e3520270c7234f` | Đối soát ca thu ngân POS | Tạo · Ghi | `POST /retail/shifts/:id/reconcile` | Có | Khả dụng |
| `api.post.c9d60252b9a973dd` | Tạo quầy hoặc két POS | Tạo · Ghi | `POST /retail/shifts/drawers` | Có | Khả dụng |
| `api.put.124a0326bcb934fc` | Cập nhật cài đặt bán lẻ | Sửa · Ghi | `PUT /retail/settings` | Có | Khả dụng |
| `retail.report.summary` | Tổng hợp doanh số bán lẻ | Báo cáo · Đọc | `GET /retail/reports/summary` | — | Khả dụng |

### coupon — `retail:coupon`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.coupon.assistant-options.list` | Tra cứu mã ưu đãi có thể áp dụng | Tra cứu · Đọc | `GET /retail/coupons/assistant-options` | — | Khả dụng |
| `retail.coupon.create` | Tạo mã ưu đãi | Tạo · Ghi | `POST /retail/coupons` | Có | Khả dụng |
| `retail.coupon.tier.list` | Tra cứu hạng khách hàng để áp dụng mã ưu đãi | Tra cứu · Đọc | `GET /retail/coupons/tiers` | — | Khả dụng |

### debt-reminders — `retail:debt-reminders`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.debt-reminders.delivery.retry` | Thử lại email nhắc công nợ lỗi tạm thời | Xử lý · Ghi | `POST /retail/debt-reminders/deliveries/:id/retry` | Có | Khả dụng |
| `retail.debt-reminders.retryable-deliveries.list` | Chọn email nhắc công nợ lỗi tạm thời để thử lại | Tra cứu · Đọc | `GET /retail/debt-reminders/deliveries/retryable` | — | Khả dụng |
| `retail.debt-reminders.run` | Chạy nhắc công nợ bán lẻ | Tạo · Ghi | `POST /retail/debt-reminders/run` | Có | Khả dụng |
| `retail.debt-reminders.runs.detail` | Xem thống kê lượt nhắc công nợ bán lẻ | Báo cáo · Đọc | `GET /retail/debt-reminders/runs/:id` | — | Khả dụng |
| `retail.debt-reminders.runs.list` | Tra cứu lịch sử nhắc công nợ bán lẻ | Tra cứu · Đọc | `GET /retail/debt-reminders/runs` | — | Khả dụng |

### invoice — `retail:invoice`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.invoice.detail` | Xem chi tiết hóa đơn bán lẻ | Tra cứu · Đọc | `GET /retail/invoices/:id` | — | Khả dụng |
| `retail.invoice.list` | Tra cứu hóa đơn bán lẻ | Tra cứu · Đọc | `GET /retail/invoices` | — | Khả dụng |
| `retail.invoice.summary` | Tổng hợp hóa đơn bán lẻ | Báo cáo · Đọc | `GET /retail/invoices/summary` | — | Khả dụng |

### order — `retail:order`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.order.cancel` | Hủy đơn bán lẻ | Hủy · Ghi | `POST /retail/orders/:id/cancel` | Có | Khả dụng |
| `retail.order.checkout` | Tạo và thanh toán đơn bán lẻ | Xử lý · Ghi | `POST /retail/orders/checkout` | Có | Khả dụng |
| `retail.order.collect` | Thu thêm tiền đơn bán lẻ | Tạo · Ghi | `POST /retail/orders/:id/payments` | Có | Khả dụng |
| `retail.order.confirm` | Xác nhận đơn nháp bán lẻ | Tạo · Ghi | `POST /retail/orders/:id/confirm` | Có | Khả dụng |
| `retail.order.detail` | Xem chi tiết đơn bán lẻ | Tra cứu · Đọc | `GET /retail/orders/:id` | — | Khả dụng |
| `retail.order.draft.create` | Tạo đơn nháp bán lẻ | Tạo · Ghi | `POST /retail/orders` | Có | Khả dụng |
| `retail.order.draft.update` | Cập nhật đơn nháp bán lẻ | Sửa · Ghi | `PATCH /retail/orders/:id` | Có | Khả dụng |
| `retail.order.list` | Tra cứu đơn bán lẻ | Tra cứu · Đọc | `GET /retail/orders` | — | Khả dụng |
| `retail.order.products.list` | Tra cứu sản phẩm bán lẻ | Tra cứu · Đọc | `GET /retail/orders/products` | — | Khả dụng |
| `retail.order.quote` | Tính thử đơn bán lẻ | Tra cứu · Đọc | `POST /retail/orders/quote` | — | Khả dụng |

### payment-review — `retail:payment-review`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.payment-review.pending` | Tra cứu giao dịch chuyển khoản chờ rà soát | Tra cứu · Đọc | `GET /retail/payment-review` | — | Khả dụng |
| `retail.payment-review.review` | Ghi nhận rà soát giao dịch chuyển khoản | Tạo · Ghi | `POST /retail/payment-review/:id/review` | Có | Khả dụng |

### points — `retail:points`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.points.customer.search` | Tìm khách hàng để tra cứu điểm thưởng | Tra cứu · Đọc | `GET /retail/points/customers/search` | — | Khả dụng |
| `retail.points.policy.get` | Tra cứu chính sách tích điểm bán lẻ | Tra cứu · Đọc | `GET /retail/points/policy` | — | Khả dụng |
| `retail.points.policy.update` | Cập nhật chính sách tích điểm bán lẻ | Sửa · Ghi | `PUT /retail/points/policy` | Có | Khả dụng |

### receivable — `retail:receivable`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.receivable.customer.history` | Tra cứu lịch sử công nợ bán lẻ của khách hàng | Tra cứu · Đọc | `GET /retail/receivables/customers/:customerId` | — | Khả dụng |
| `retail.receivable.reconciliation.latest` | Xem kết quả đối soát công nợ bán lẻ gần nhất | Tra cứu · Đọc | `GET /retail/receivables/reconciliations/latest` | — | Khả dụng |
| `retail.receivable.reconciliation.run` | Đối soát công nợ bán lẻ | Tạo · Ghi | `POST /retail/receivables/reconciliations` | Có | Khả dụng |

### shift — `retail:shift`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.shift.cashier.list` | Tra cứu nhân viên thu ngân | Tra cứu · Đọc | `GET /retail/shifts/cashiers` | — | Khả dụng |
| `retail.shift.current` | Xem ca POS hiện tại | Tra cứu · Đọc | `GET /retail/shifts/current` | — | Khả dụng |
| `retail.shift.drawer.list` | Tra cứu quầy và két POS | Tra cứu · Đọc | `GET /retail/shifts/drawers` | — | Khả dụng |
| `retail.shift.list` | Tra cứu ca thu ngân POS | Tra cứu · Đọc | `GET /retail/shifts` | — | Khả dụng |
| `retail.shift.pause` | Tạm dừng ca POS của bạn | Tạo · Ghi | `POST /retail/shifts/:id/pause` | Có | Khả dụng |
| `retail.shift.resume` | Tiếp tục ca POS của bạn trên thiết bị hiện tại | Tạo · Ghi | `POST /retail/shifts/:id/resume` | Có | Khả dụng |
| `retail.shift.settlements.list` | Tra cứu khoản thu POS chưa đối soát | Tra cứu · Đọc | `GET /retail/shifts/settlements` | — | Khả dụng |

### Tài chính — `retail:finance`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.finance.cashbook.close` | Chốt kỳ sổ quỹ bán lẻ | Xử lý · Ghi | `POST /retail/finance/cashbook/close` | Có | Khả dụng |
| `retail.finance.cashbook.list` | Tra cứu sổ quỹ bán lẻ | Tra cứu · Đọc | `GET /retail/finance/cashbook` | — | Khả dụng |
| `retail.finance.cashbook.reconcile` | Đối soát sổ quỹ bán lẻ | Tra cứu · Đọc | `GET /retail/finance/cashbook/reconcile` | — | Khả dụng |
| `retail.finance.cashbook.voucher.create` | Tạo phiếu thu chi sổ quỹ bán lẻ | Tạo · Ghi | `POST /retail/finance/cashbook/vouchers` | Có | Khả dụng |
| `retail.finance.commission.policy.update` | Cấu hình hoa hồng SKU cho cộng tác viên | Sửa · Ghi | `PUT /retail/finance/commission/policies` | Có | Khả dụng |

### warranty — `retail:warranty`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `retail.warranty.lookup.phone` | Tra cứu bảo hành theo số điện thoại khách hàng | Tra cứu · Đọc | `GET /retail/warranty/lookup-phone/:phone` | — | Khả dụng |
| `retail.warranty.serial.update` | Cập nhật thời hạn bảo hành cho thiết bị | Sửa · Ghi | `PATCH /retail/warranty/serial/by-code/:code` | Có | Khả dụng |

<a id="module-retail-partner"></a>
## Đối tác bán lẻ — `retail-partner`

Tổng 19 action: 10 đọc, 9 ghi; 0 không khả dụng.

### Bán lẻ — `retail-partner:retail`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.09ba89f080717c4a` | Xem danh sách cộng tác viên bán lẻ | Tra cứu · Đọc | `GET /retail/partners/collaborators` | — | Khả dụng |
| `api.get.7c1d9c9cda4722a9` | Xem bảng kê hoa hồng cộng tác viên bán lẻ | Tra cứu · Đọc | `GET /retail/finance/commission/partners/:id/statement` | — | Khả dụng |
| `api.get.9ca47ce89d0dd0f0` | Xem hồ sơ cộng tác viên bán lẻ của tôi | Tra cứu · Đọc | `GET /retail/partners/me` | — | Khả dụng |
| `api.get.d9daa6226ed98e83` | Tra cứu mức hoa hồng theo sản phẩm | Tra cứu · Đọc | `GET /retail/partners/product-commissions` | — | Khả dụng |
| `api.patch.2776df6160261ce4` | Cập nhật cấu hình hoa hồng bán lẻ | Sửa · Ghi | `PATCH /retail/partners/commission-policies/:id` | Có | Khả dụng |
| `api.post.3c5a416752fe6656` | Chi trả hoa hồng cộng tác viên | Tạo · Ghi | `POST /retail/finance/commission/partners/:id/payouts` | Có | Khả dụng |
| `api.post.78762121730098ad` | Tạo cấu hình hoa hồng bán lẻ | Tạo · Ghi | `POST /retail/partners/commission-policies` | Có | Khả dụng |
| `api.post.9102a0fae468bcab` | Đối soát hoa hồng cộng tác viên | Tạo · Ghi | `POST /retail/finance/commission/partners/:id/reconcile` | Có | Khả dụng |
| `retail.partner.commission.policy.list` | Tra cứu cấu hình hoa hồng bán lẻ | Tra cứu · Đọc | `GET /retail/partners/commission-policies` | — | Khả dụng |
| `retail.partner.create.collaborator` | Tạo cộng tác viên bán lẻ | Tạo · Ghi | `POST /retail/partners` | Có | Khả dụng |
| `retail.partner.create.dealer` | Tạo đại lý bán lẻ | Tạo · Ghi | `POST /retail/partners` | Có | Khả dụng |
| `retail.partner.create.supplier` | Tạo nhà cung cấp bán lẻ | Tạo · Ghi | `POST /retail/partners` | Có | Khả dụng |
| `retail.partner.customer.list` | Tra cứu khách hàng đại lý | Tra cứu · Đọc | `GET /retail/partners/customers` | — | Khả dụng |
| `retail.partner.list` | Tra cứu đối tác bán lẻ | Tra cứu · Đọc | `GET /retail/partners` | — | Khả dụng |
| `retail.partner.product.commission.products` | Tra cứu sản phẩm và SKU để cấu hình hoa hồng | Tra cứu · Đọc | `GET /retail/partners/policy-products` | — | Khả dụng |
| `retail.partner.product.commissions.update` | Cấu hình hoa hồng theo sản phẩm | Sửa · Ghi | `PUT /retail/partners/product-commissions` | Có | Khả dụng |
| `retail.partner.supplier.list` | Tra cứu nhà cung cấp liên kết | Tra cứu · Đọc | `GET /retail/partners/suppliers` | — | Khả dụng |
| `retail.partner.update` | Cập nhật đối tác bán lẻ | Sửa · Ghi | `PATCH /retail/partners/:id` | Có | Khả dụng |
| `retail.partner.user.list` | Tra cứu tài khoản cộng tác viên | Tra cứu · Đọc | `GET /retail/partners/users` | — | Khả dụng |

<a id="module-repair"></a>
## Sửa chữa & bảo hành — `repair`

Tổng 36 action: 19 đọc, 17 ghi; 0 không khả dụng.

### device — `repair:device`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `repair.device.lookup` | Tra cứu thiết bị đã bán theo mã | Tra cứu · Đọc | `POST /repair/tickets/lookup-device` | — | Khả dụng |

### feedback — `repair:feedback`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `repair.feedback.link.create` | Tạo liên kết đánh giá cho phiếu sửa chữa | Tạo · Ghi | `POST /repair/tickets/:id/feedback-qr` | Có | Khả dụng |

### notification — `repair:notification`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `repair.notification.resend` | Gá»­i láº¡i thÃ´ng bÃ¡o phiáº¿u sá»­a chá»¯a | Tạo · Ghi | `POST /repair/tickets/:id/notifications/resend` | Có | Khả dụng |

### parts — `repair:parts`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `repair.parts.list` | Tra cứu linh kiện đã xuất cho phiếu sửa chữa | Tra cứu · Đọc | `GET /repair/tickets/:id/parts` | — | Khả dụng |

### refund — `repair:refund`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `repair.refund.create` | Ghi nhận hoàn tiền sửa chữa | Tạo · Ghi | `POST /repair/tickets/:id/refunds` | Có | Khả dụng |
| `repair.refund.summary` | Tra cứu số dư hoàn tiền sửa chữa | Báo cáo · Đọc | `GET /repair/tickets/:id/refunds` | — | Khả dụng |
| `repair.refund.vouchers` | Tìm phiếu chi đủ điều kiện hoàn tiền sửa chữa | Tra cứu · Đọc | `GET /repair/tickets/:id/refunds/vouchers` | — | Khả dụng |

### Sửa chữa — `repair:repair`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.25ab7ad5caa4684f` | Xem mức sử dụng linh kiện sửa chữa | Tra cứu · Đọc | `GET /repair/reports/part-usage` | — | Khả dụng |
| `api.get.2c71c36e4f1d283e` | Tra cứu đánh giá sau sửa chữa | Tra cứu · Đọc | `GET /repair/feedback` | — | Khả dụng |
| `api.get.3938bd395acae1c5` | Xem doanh thu sửa chữa | Tra cứu · Đọc | `GET /repair/reports/revenue` | — | Khả dụng |
| `api.get.5bc56e7749f48d08` | Tra cứu phiếu sửa chữa theo số sê-ri thiết bị | Tra cứu · Đọc | `GET /repair/tickets/by-serial/:serialNumber` | — | Khả dụng |
| `api.get.68886fa48772aa78` | Xem hiệu suất kỹ thuật viên sửa chữa | Tra cứu · Đọc | `GET /repair/reports/technician-performance` | — | Khả dụng |
| `api.get.7517d0cca9ca76c9` | Tra cứu lịch sử sửa chữa theo khách hoặc thiết bị | Tra cứu · Đọc | `GET /repair/history` | — | Khả dụng |
| `api.get.8cb8202ecb5a1164` | Đối chiếu tiền đã thu trên phiếu sửa chữa | Tra cứu · Đọc | `GET /repair/tickets/:id/payments/reconcile` | — | Khả dụng |
| `api.get.a647fdd78184d877` | Xem chi tiết phiếu sửa chữa | Tra cứu · Đọc | `GET /repair/tickets/:id` | — | Khả dụng |
| `api.get.c5fac63d8679d159` | Xem lịch sử chăm sóc khách hàng sửa chữa | Tra cứu · Đọc | `GET /repair/care/customers/:id` | — | Khả dụng |
| `api.get.cd0981c57831ef5c` | Xem lịch sử chăm sóc của phiếu sửa chữa | Tra cứu · Đọc | `GET /repair/tickets/:id/care` | — | Khả dụng |
| `api.get.d2d1a3ba9b169ce6` | Xem tin nhắn đã gửi về phiếu sửa chữa | Tra cứu · Đọc | `GET /repair/tickets/:id/notifications` | — | Khả dụng |
| `api.get.da5aa81551ee7ce6` | Xem cấu hình thông báo sửa chữa | Tra cứu · Đọc | `GET /repair/settings/notifications` | — | Khả dụng |
| `api.get.e25284fbbeeaf62d` | Tổng hợp đánh giá khách hàng sửa chữa | Báo cáo · Đọc | `GET /repair/reports/feedback-summary` | — | Khả dụng |
| `api.get.e8ac82522784cf77` | Tra cứu một giao dịch thanh toán sửa chữa | Tra cứu · Đọc | `GET /repair/tickets/:id/payments/:key` | — | Khả dụng |
| `api.post.1ee164077121787a` | Duyệt báo giá sửa chữa | Duyệt · Ghi | `POST /repair/tickets/:id/approve-quote` | Có | Khả dụng |
| `api.post.2b44c18916b1a882` | Hoàn linh kiện sửa chữa | Sửa · Ghi | `POST /repair/tickets/:id/parts/:partId/return` | Có | Khả dụng |
| `api.post.30630b0bdc49b30c` | Ghi nhận trao đổi chăm sóc khách hàng | Tạo · Ghi | `POST /repair/tickets/:id/care/messages` | Có | Khả dụng |
| `api.post.572b64fca460dafc` | Giao thiết bị sửa chữa | Sửa · Ghi | `POST /repair/tickets/:id/deliver` | Có | Khả dụng |
| `api.post.5a64bf0894869ec7` | Hủy phiếu sửa chữa | Hủy · Ghi | `POST /repair/tickets/:id/cancel` | Có | Khả dụng |
| `api.post.6fda6d726245dee1` | Cập nhật trạng thái chăm sóc khách hàng | Sửa · Ghi | `POST /repair/tickets/:id/care/status` | Có | Khả dụng |
| `api.post.742b8c7c7d343778` | Ghi nhận đánh giá sửa chữa | Tạo · Ghi | `POST /repair/tickets/:id/feedback` | Có | Khả dụng |
| `api.post.79291125e27b1d36` | Tạo phiếu sửa chữa dịch vụ | Tạo · Ghi | `POST /repair/tickets` | Có | Khả dụng |
| `api.post.8ed57322c93cc536` | Phân công kỹ thuật viên sửa chữa | Sửa · Ghi | `POST /repair/tickets/:id/assign` | Có | Khả dụng |
| `api.post.951d43982cb708bc` | Cập nhật trạng thái phiếu sửa chữa | Sửa · Ghi | `POST /repair/tickets/:id/status` | Có | Khả dụng |
| `api.post.ad54adfbaa37674b` | Ghi nhận thanh toán sửa chữa | Tạo · Ghi | `POST /repair/tickets/:id/payments` | Có | Khả dụng |
| `api.post.aed04d8555cb4291` | Xuất linh kiện cho phiếu sửa chữa | Sửa · Ghi | `POST /repair/tickets/:id/parts` | Có | Khả dụng |
| `api.post.dd4d2216f9ecc537` | Báo giá phiếu sửa chữa | Sửa · Ghi | `POST /repair/tickets/:id/quote` | Có | Khả dụng |
| `api.put.b1eda41fa88b2cc9` | Cáº¥u hÃ¬nh thÃ´ng bÃ¡o phiáº¿u sá»­a chá»¯a | Tạo · Ghi | `PUT /repair/settings/notifications` | Có | Khả dụng |
| `repair.list` | Tra cứu phiếu sửa chữa | Tra cứu · Đọc | `GET /repair/tickets` | — | Khả dụng |

<a id="module-finance"></a>
## Tài chính — `finance`

Tổng 69 action: 30 đọc, 39 ghi; 0 không khả dụng.

### analytics — `finance:analytics`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.9dfafef7e83ee5f0` | Xóa báo cáo vận hành chi phí | Xóa · Ghi | `DELETE /analytics/operating-expenses/:id` | Có | Khả dụng |
| `api.get.03a093fc9349a692` | Xem báo cáo doanh thu | Báo cáo · Đọc | `GET /analytics/revenue` | — | Khả dụng |
| `api.get.4621ea131565f025` | Xem báo cáo lãi lỗ | Báo cáo · Đọc | `GET /analytics/pnl` | — | Khả dụng |
| `api.get.614b2375b202f4b6` | Xem báo cáo chi phí | Báo cáo · Đọc | `GET /analytics/expenses` | — | Khả dụng |
| `api.get.88b9d2165759d798` | Xem chi phí vận hành | Tra cứu · Đọc | `GET /analytics/operating-expenses` | — | Khả dụng |
| `api.get.c611407da8136c5f` | Xem tổng hợp khoản phải thu theo hạn | Báo cáo · Đọc | `GET /analytics/receivables` | — | Khả dụng |
| `api.get.f571d5d6bb5d51ab` | Xem tổng quan tài chính | Tra cứu · Đọc | `GET /analytics/meta` | — | Khả dụng |
| `api.post.c1af6a4524808fc9` | Tạo báo cáo vận hành chi phí | Tạo · Ghi | `POST /analytics/operating-expenses` | Có | Khả dụng |

### asset — `finance:asset`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `finance.asset.depreciations.list` | Tra cứu khấu hao tài sản theo kỳ | Tra cứu · Đọc | `GET /finance/assets/depreciations` | — | Khả dụng |
| `finance.asset.detail` | Xem tài sản cố định | Tra cứu · Đọc | `GET /finance/assets/:id` | — | Khả dụng |
| `finance.asset.inventory.count` | Ghi nhận kết quả kiểm kê tài sản | Báo cáo · Ghi | `POST /finance/asset-inventories/:id/counts` | Có | Khả dụng |
| `finance.asset.inventory.detail` | Xem phiên kiểm kê tài sản | Tra cứu · Đọc | `GET /finance/asset-inventories/:id` | — | Khả dụng |
| `finance.asset.inventory.finalize` | Chốt phiên kiểm kê tài sản | Tạo · Ghi | `POST /finance/asset-inventories/:id/finalize` | Có | Khả dụng |
| `finance.asset.inventory.list` | Tra cứu phiên kiểm kê tài sản | Tra cứu · Đọc | `GET /finance/asset-inventories` | — | Khả dụng |
| `finance.asset.inventory.open` | Mở phiên kiểm kê tài sản tại chi nhánh | Tạo · Ghi | `POST /finance/asset-inventories` | Có | Khả dụng |
| `finance.asset.inventory.variance` | Xem chênh lệch kiểm kê tài sản | Tra cứu · Đọc | `GET /finance/asset-inventories/:id/variance` | — | Khả dụng |
| `finance.asset.list` | Tra cứu tài sản cố định | Tra cứu · Đọc | `GET /finance/assets` | — | Khả dụng |
| `finance.asset.schedule` | Xem lịch khấu hao tài sản | Tra cứu · Đọc | `GET /finance/assets/:id/schedule` | — | Khả dụng |

### debt — `finance:debt`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `finance.debt.list` | Tra cứu công nợ | Tra cứu · Đọc | `GET /finance/reporting/debts` | — | Khả dụng |

### management — `finance:management`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `finance.management.debts.list` | Tra cứu khoản phải thu, phải trả và phiếu nhập chưa ghi công nợ | Tra cứu · Đọc | `GET /finance/management/debts` | — | Khả dụng |

### receivable — `finance:receivable`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `finance.receivable.aging` | Tổng hợp tuổi nợ phải thu | Báo cáo · Đọc | `GET /finance/receivables/aging` | — | Khả dụng |
| `finance.receivable.by-customer` | Tổng hợp khoản phải thu theo khách hàng | Báo cáo · Đọc | `GET /finance/receivables/by-customer` | — | Khả dụng |
| `finance.receivable.detail` | Xem khoản phải thu và các bút toán có thể đảo | Tra cứu · Đọc | `GET /finance/receivables/:id` | — | Khả dụng |
| `finance.receivable.entry.reversal` | Đảo khoản thu hoặc điều chỉnh phải thu | Sửa · Ghi | `POST /finance/receivables/:id/entries/:entryId/reversal` | Có | Khả dụng |
| `finance.receivable.extend` | Gia hạn khoản phải thu | Tạo · Ghi | `POST /finance/receivables/:id/extend` | Có | Khả dụng |
| `finance.receivable.list` | Tra cứu khoản phải thu | Tra cứu · Đọc | `GET /finance/receivables` | — | Khả dụng |
| `finance.receivable.suspend` | Tạm dừng nhắc khoản phải thu | Tạo · Ghi | `POST /finance/receivables/:id/suspend` | Có | Khả dụng |

### reminders — `finance:reminders`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `finance.reminders.delivery.retry-in-app` | Thử lại thông báo công nợ nội bộ | Gửi / liên lạc · Ghi | `POST /finance/reminders/deliveries/:id/retry-in-app` | Có | Khả dụng |
| `finance.reminders.retryable-deliveries.list` | Chọn thông báo nhắc công nợ nội bộ cần thử lại | Tra cứu · Đọc | `GET /finance/reminders/deliveries/retryable` | — | Khả dụng |
| `finance.reminders.run` | Rà soát và xếp hàng nhắc công nợ quá hạn | Tạo · Ghi | `POST /finance/reminders/runs` | Có | Khả dụng |
| `finance.reminders.runs.detail` | Xem chi tiết lượt rà soát nhắc công nợ | Tra cứu · Đọc | `GET /finance/reminders/runs/:id` | — | Khả dụng |
| `finance.reminders.runs.list` | Xem các lượt rà soát công nợ quá hạn | Tra cứu · Đọc | `GET /finance/reminders/runs` | — | Khả dụng |

### reporting — `finance:reporting`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `finance.reporting.breakeven` | Tra cứu điểm hòa vốn và kế hoạch tài chính | Tra cứu · Đọc | `GET /finance/reporting/breakeven` | — | Khả dụng |
| `finance.reporting.plan.update` | Cập nhật kế hoạch tài chính và điểm hòa vốn | Sửa · Ghi | `PUT /finance/reporting/plan` | Có | Khả dụng |

### Tài chính — `finance:finance`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.65204362fe283948` | Xem báo cáo tài chính quản trị | Báo cáo · Đọc | `GET /finance/management/report` | — | Khả dụng |
| `api.get.d8e2ed96478d8a3e` | Xem báo cáo lợi nhuận tài chính | Báo cáo · Đọc | `GET /finance/reporting/profit` | — | Khả dụng |
| `api.patch.147cb912f34dd4d1` | Cập nhật tài sản cố định | Sửa · Ghi | `PATCH /finance/assets/:id` | Có | Khả dụng |
| `api.post.00f98f7f46e21cf0` | Tạo tài chính quản lý theo dõi | Tạo · Ghi | `POST /finance/management/followups` | Có | Khả dụng |
| `api.post.5213d6b07cbffd29` | Thực hiện tài chính quản lý phiếu thu chi đảo giao dịch | Tạo · Ghi | `POST /finance/management/vouchers/:id/reversal` | Có | Khả dụng |
| `api.post.5d88cf81f1042ab2` | Điều chỉnh khoản phải thu | Sửa · Ghi | `POST /finance/receivables/:id/adjustments` | Có | Khả dụng |
| `api.post.748a178f1689567e` | Ghi nhận hóa đơn VAT | Tạo · Ghi | `POST /finance/reporting/vat/invoices` | Có | Khả dụng |
| `api.post.9adaea0274bd3aac` | Chuyển tài sản sang chi nhánh | Tạo · Ghi | `POST /finance/assets/:id/transfer` | Có | Khả dụng |
| `api.post.a5ab5625c92c88b1` | Thanh lý tài sản cố định | Tạo · Ghi | `POST /finance/assets/:id/disposal` | Có | Khả dụng |
| `api.post.ac04b554927d4696` | Ghi nhận chi phí | Tạo · Ghi | `POST /finance/reporting/expenses` | Có | Khả dụng |
| `api.post.b8a7093520fc5d21` | Lập kế hoạch khấu hao tài sản | Tạo · Ghi | `POST /finance/assets/depreciations/run` | Có | Khả dụng |
| `api.post.c77ec95f9e22a52a` | Tạo tài sản cố định | Tạo · Ghi | `POST /finance/assets` | Có | Khả dụng |
| `api.post.c7f205ec27eeab37` | Tạo tài chính quản lý khoản phải trả | Tạo · Ghi | `POST /finance/management/payables` | Có | Khả dụng |
| `api.post.e7edb97470c1d234` | Tạo quỹ tiền mặt hoặc tài khoản ngân hàng | Tạo · Ghi | `POST /finance/reporting/treasury/accounts` | Có | Khả dụng |
| `api.post.ec8517952b42a8d0` | Ghi xóa khoản phải thu | Xóa · Ghi | `POST /finance/receivables/:id/write-off` | Có | Khả dụng |
| `api.post.ed7ac98d2498702f` | Thu tiền khoản phải thu | Tạo · Ghi | `POST /finance/receivables/:id/payments` | Có | Khả dụng |
| `api.post.f050d7804ae747a3` | Ghi nhận công nợ | Tạo · Ghi | `POST /finance/reporting/debts` | Có | Khả dụng |
| `api.post.f178e9522abebc03` | Ghi sổ khấu hao tài sản | Tạo · Ghi | `POST /finance/assets/depreciations/post` | Có | Khả dụng |
| `api.post.fd3f5b4a8cf47782` | Ghi nhận thanh toán công nợ | Tạo · Ghi | `POST /finance/reporting/debts/:id/payments` | Có | Khả dụng |
| `api.put.7e0d95e6f48a16a7` | Cập nhật số dư VAT chuyển kỳ | Sửa · Ghi | `PUT /finance/reporting/vat/period` | Có | Khả dụng |
| `api.put.86ec1b1dded51aa0` | Cập nhật tài chính quản lý cài đặt | Sửa · Ghi | `PUT /finance/management/settings` | Có | Khả dụng |

### tax — `finance:tax`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `finance.tax.create` | Ghi nhận VAT thủ công | Tạo · Ghi | `POST /finance/management/tax` | Có | Khả dụng |
| `finance.tax.from-invoice` | Ghi nhận VAT từ hóa đơn bán lẻ | Tạo · Ghi | `POST /finance/management/tax/from-invoice/:id` | Có | Khả dụng |

### treasury — `finance:treasury`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `finance.treasury.accounts.list` | Tra các quỹ tiền mặt và tài khoản ngân hàng | Tra cứu · Đọc | `GET /finance/reporting/treasury` | — | Khả dụng |
| `finance.treasury.bank-lines.create` | Nhập giao dịch ngân hàng để đối soát | Tạo · Ghi | `POST /finance/reporting/treasury/bank-lines` | Có | Khả dụng |
| `finance.treasury.bank-lines.list` | Tra giao dịch ngân hàng chờ đối soát | Tra cứu · Đọc | `GET /finance/reporting/treasury` | — | Khả dụng |
| `finance.treasury.bank-lines.match` | Ghép giao dịch ngân hàng với phiếu thu chi | Tạo · Ghi | `POST /finance/reporting/treasury/bank-lines/:id/match` | Có | Khả dụng |
| `finance.treasury.period.update` | Chốt hoặc mở lại kỳ tài chính | Sửa · Ghi | `POST /finance/reporting/treasury/periods` | Có | Khả dụng |
| `finance.treasury.periods.list` | Tra cứu kỳ tài chính | Tra cứu · Đọc | `GET /finance/reporting/treasury` | — | Khả dụng |
| `finance.treasury.reconciliation.create` | Ghi nhận đối soát quỹ | Tạo · Ghi | `POST /finance/reporting/treasury/reconciliations` | Có | Khả dụng |
| `finance.treasury.vouchers.create` | Lập phiếu thu, chi hoặc chuyển quỹ | Tạo · Ghi | `POST /finance/reporting/treasury/vouchers` | Có | Khả dụng |
| `finance.treasury.vouchers.decision` | Duyệt hoặc từ chối phiếu thu chi | Duyệt · Ghi | `POST /finance/reporting/treasury/vouchers/:id/decision` | Có | Khả dụng |
| `finance.treasury.vouchers.list` | Tra phiếu thu chi | Tra cứu · Đọc | `GET /finance/reporting/treasury` | — | Khả dụng |

### vat — `finance:vat`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `finance.vat.list` | Tra cứu hóa đơn VAT | Tra cứu · Đọc | `GET /finance/reporting/vat` | — | Khả dụng |

### voucher — `finance:voucher`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `finance.voucher.create` | Tạo phiếu thu hoặc chi tài chính | Tạo · Ghi | `POST /finance/management/vouchers` | Có | Khả dụng |

<a id="module-marketing"></a>
## Marketing tự động — `marketing`

Tổng 8 action: 4 đọc, 4 ghi; 0 không khả dụng.

### holiday-campaign — `marketing:holiday-campaign`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `marketing.holiday-campaign.create-draft` | Tạo bản nháp chiến dịch email | Tạo · Ghi | `POST /marketing/campaigns` | Có | Khả dụng |
| `marketing.holiday-campaign.delete` | Xóa chiến dịch email lễ/tết | Xóa · Ghi | `DELETE /marketing/campaigns/:id` | Có | Khả dụng |
| `marketing.holiday-campaign.enabled.update` | Bật hoặc tắt chiến dịch email lễ/tết | Sửa · Ghi | `PATCH /marketing/campaigns/:id` | Có | Khả dụng |
| `marketing.holiday-campaign.list` | Tra cứu chiến dịch email lễ/tết | Tra cứu · Đọc | `GET /marketing/campaigns` | — | Khả dụng |

### marketing — `marketing:marketing`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.34a8d9d0814701f9` | Tra cứu kết quả gửi nội dung marketing | Tra cứu · Đọc | `GET /marketing/deliveries` | — | Khả dụng |
| `api.get.790586d43d8979d7` | Tra cứu các lượt chạy marketing | Tra cứu · Đọc | `GET /marketing/runs` | — | Khả dụng |
| `api.get.ddf0c072158be296` | Xem trạng thái cấu hình marketing | Tra cứu · Đọc | `GET /marketing/settings` | — | Khả dụng |

### settings — `marketing:settings`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `marketing.settings.update` | Cập nhật cài đặt tiếp thị | Sửa · Ghi | `PUT /marketing/settings` | Có | Khả dụng |

<a id="module-social-marketing"></a>
## Chiến dịch nội dung — `social-marketing`

Tổng 122 action: 45 đọc, 77 ghi; 0 không khả dụng.

### bulk create — `social-marketing:bulk-create`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.0db37a086a255cd2` | Xóa mẫu tạo ảnh hàng loạt | Xóa · Ghi | `DELETE /bulk-create/templates/:id` | Có | Khả dụng |
| `api.delete.e873e19cbd43da2f` | Xóa nội dung tạo ảnh hàng loạt | Xóa · Ghi | `DELETE /bulk-create/assets/:id` | Có | Khả dụng |
| `api.get.3489b2175c9d356c` | Tra cứu mẫu bài đăng dùng nhiều lần | Tra cứu · Đọc | `GET /bulk-create/templates/paged` | — | Khả dụng |
| `api.get.78cd5e06164e908a` | Tra cứu tệp ảnh và video dùng cho bài đăng | Tra cứu · Đọc | `GET /bulk-create/assets` | — | Khả dụng |
| `api.post.7367d21b7163500b` | Thêm ảnh hoặc video vào thư viện tạo nội dung hàng loạt | Tạo · Ghi | `POST /bulk-create/assets` | Có | Khả dụng |
| `api.post.8ee0e1e6992ff475` | Xem trước nội dung ảnh sẽ tạo từ bảng tính | Tạo · Ghi | `POST /bulk-create/workbooks/preview` | Có | Khả dụng |
| `api.post.ef223f5f2995bc38` | Xem trước hàng loạt tạo Google bảng dữ liệu | Tạo · Ghi | `POST /bulk-create/google-sheets/preview` | Có | Khả dụng |

### marketing — `social-marketing:marketing`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `marketing.account.list` | Tra cứu tài khoản mạng xã hội cho chiến dịch | Tra cứu · Đọc | `GET /marketing-campaigns/accounts` | — | Khả dụng |
| `marketing.account.telegram-link.create` | Tạo mã liên kết Telegram cho tài khoản | Tạo · Ghi | `POST /marketing-settings/telegram-link` | Có | Khả dụng |
| `marketing.account.telegram-link.status` | Xem trạng thái liên kết Telegram của tài khoản | Tra cứu · Đọc | `GET /marketing-settings/telegram-link` | — | Khả dụng |
| `marketing.account.telegram-link.unlink` | Hủy liên kết Telegram và tạo mã mới | Hủy · Ghi | `DELETE /marketing-settings/telegram-link` | Có | Khả dụng |
| `marketing.ai-subscription.plans` | Xem các gói AI đang cung cấp | Tra cứu · Đọc | `GET /marketing-subscription/plans` | — | Khả dụng |
| `marketing.ai-subscription.summary` | Xem gói AI và lượt sử dụng | Báo cáo · Đọc | `GET /marketing-subscription` | — | Khả dụng |
| `marketing.ai.campaign-ideas` | Tạo ý tưởng chiến dịch marketing bằng AI | Tạo · Ghi | `POST /gemini/marketing-ideas` | Có | Khả dụng |
| `marketing.ai.content-pillars` | Tạo trụ cột nội dung marketing bằng AI | Tạo · Ghi | `POST /gemini/marketing-pillars` | Có | Khả dụng |
| `marketing.ai.draft-posts` | Phát triển bản nháp bài đăng marketing bằng AI | Tạo · Ghi | `POST /gemini/marketing-develop` | Có | Khả dụng |
| `marketing.ai.image.edit` | Chỉnh sửa ảnh bằng AI | Sửa · Ghi | `POST /gemini/edit-image` | Có | Khả dụng |
| `marketing.ai.image.generate` | Tạo ảnh marketing bằng AI | Tạo · Ghi | `POST /gemini/generate-image` | Có | Khả dụng |
| `marketing.ai.optimize-image-prompt` | Biên tập mô tả hình ảnh bằng AI | Tạo · Ghi | `POST /gemini/optimize-prompt` | Có | Khả dụng |
| `marketing.ai.optimize-script` | Biên tập văn bản cho phát thanh | Tạo · Ghi | `POST /gemini/optimize-script` | Có | Khả dụng |
| `marketing.ai.scheduled-campaign` | Lập kế hoạch chiến dịch marketing bằng AI | Tạo · Ghi | `POST /gemini/scheduled-campaign` | Có | Khả dụng |
| `marketing.ai.topic-suggestions` | Gợi ý chủ đề marketing bằng AI | Tra cứu · Đọc | `GET /gemini/marketing-suggestions` | Có | Khả dụng |
| `marketing.author.integration-status` | Xem trạng thái kết nối kênh của nhân sự | Tra cứu · Đọc | `GET /marketing-settings/authors/:id` | — | Khả dụng |
| `marketing.auto-reply.config.update` | Cập nhật cài đặt trợ lý trả lời tự động | Sửa · Ghi | `PATCH /marketing-settings/auto-reply` | Có | Khả dụng |
| `marketing.bulk-create.jobs.cancel` | Hủy lượt tạo ảnh hàng loạt | Hủy · Ghi | `POST /bulk-create/jobs/:id/cancel` | Có | Khả dụng |
| `marketing.bulk-create.jobs.detail` | Xem trạng thái lượt tạo ảnh hàng loạt | Tra cứu · Đọc | `GET /bulk-create/jobs/:id` | — | Khả dụng |
| `marketing.bulk-create.jobs.list` | Theo dõi lượt tạo ảnh hàng loạt | Tra cứu · Đọc | `GET /bulk-create/jobs` | — | Khả dụng |
| `marketing.bulk-create.jobs.retry` | Thử lại ảnh lỗi trong lượt tạo hàng loạt | Xử lý · Ghi | `POST /bulk-create/jobs/:id/retry` | Có | Khả dụng |
| `marketing.bulk-create.templates.community.list` | Tra cứu mẫu thiết kế cộng đồng | Tra cứu · Đọc | `GET /bulk-create/templates/community` | — | Khả dụng |
| `marketing.bulk-create.templates.community.use` | Sao chép mẫu cộng đồng vào doanh nghiệp | Tạo · Ghi | `POST /bulk-create/templates/:id/use` | Có | Khả dụng |
| `marketing.bulk-create.templates.detail` | Xem trạng thái mẫu thiết kế tạo ảnh hàng loạt | Tra cứu · Đọc | `GET /bulk-create/templates/:id` | — | Khả dụng |
| `marketing.bulk-create.templates.list` | Tra cứu mẫu thiết kế tạo ảnh hàng loạt | Tra cứu · Đọc | `GET /bulk-create/templates` | — | Khả dụng |
| `marketing.bulk-create.templates.publish` | Chia sẻ mẫu thiết kế với cộng đồng | Tạo · Ghi | `POST /bulk-create/templates/:id/publish` | Có | Khả dụng |
| `marketing.bulk-create.templates.rename` | Đổi tên mẫu thiết kế tạo ảnh hàng loạt | Tạo · Ghi | `PATCH /bulk-create/templates/:id` | Có | Khả dụng |
| `marketing.bulk-create.templates.unpublish` | Ngừng chia sẻ mẫu thiết kế | Tạo · Ghi | `POST /bulk-create/templates/:id/unpublish` | Có | Khả dụng |
| `marketing.campaign.analytics.summary` | Xem thống kê chiến dịch marketing | Báo cáo · Đọc | `GET /marketing-campaigns/assistant/analytics` | — | Khả dụng |
| `marketing.campaign.asset-order.ai.apply` | Áp dụng brief AI cho Order sản xuất | Xuất · Ghi | `POST /marketing-campaigns/:id/asset-orders/:orderId/ai/apply` | Có | Khả dụng |
| `marketing.campaign.asset-order.ai.dismiss` | Bỏ đề xuất AI của Order sản xuất | Xuất · Ghi | `POST /marketing-campaigns/:id/asset-orders/:orderId/ai/dismiss` | Có | Khả dụng |
| `marketing.campaign.asset-order.ai.job.cancel` | Hủy lượt AI điền Order | Hủy · Ghi | `POST /marketing-campaigns/:id/asset-orders/ai/jobs/:jobId/cancel` | Có | Khả dụng |
| `marketing.campaign.asset-order.ai.jobs.list` | Tra cứu lượt AI điền Order | Tra cứu · Đọc | `GET /marketing-campaigns/:id/asset-orders/ai/jobs/assistant-summaries` | — | Khả dụng |
| `marketing.campaign.asset-order.ai.preview` | Tạo bản đề xuất brief Order bằng AI | Tạo · Ghi | `POST /marketing-campaigns/:id/asset-orders/:orderId/ai/preview` | Có | Khả dụng |
| `marketing.campaign.asset-order.archive` | Hủy Order sản xuất nội dung | Sửa · Ghi | `DELETE /marketing-campaigns/:id/asset-orders/:orderId` | Có | Khả dụng |
| `marketing.campaign.asset-order.create` | Tạo Order sản xuất nội dung | Tạo · Ghi | `POST /marketing-campaigns/:id/asset-orders` | Có | Khả dụng |
| `marketing.campaign.asset-order.update` | Cập nhật Order sản xuất nội dung | Sửa · Ghi | `PATCH /marketing-campaigns/:id/asset-orders/:orderId` | Có | Khả dụng |
| `marketing.campaign.asset-orders.list` | Tra cứu Order sản xuất trong chiến dịch | Tra cứu · Đọc | `GET /marketing-campaigns/:id/asset-orders/assistant-summaries` | — | Khả dụng |
| `marketing.campaign.bulk-import.jobs.list` | Tra cứu lượt tạo ảnh liên quan đến chiến dịch | Tra cứu · Đọc | `GET /marketing-campaigns/:id/asset-orders/bulk-import/jobs` | — | Khả dụng |
| `marketing.campaign.calendar` | Tra lịch đăng nội dung chiến dịch | Tra cứu · Đọc | `GET /marketing-campaigns/calendar` | — | Khả dụng |
| `marketing.campaign.lifecycle` | Thay đổi trạng thái chiến dịch marketing | Sửa · Ghi | `POST /marketing-campaigns/:id/:action` | Có | Khả dụng |
| `marketing.campaign.list` | Tra cứu chiến dịch marketing | Tra cứu · Đọc | `GET /marketing-campaigns/assistant/summaries` | — | Khả dụng |
| `marketing.campaign.sheet.ai.job.cancel` | Hủy lượt AI Content Sheet | Hủy · Ghi | `POST /marketing-campaigns/:id/sheet/ai/jobs/:jobId/cancel` | Có | Khả dụng |
| `marketing.campaign.sheet.ai.job.retry` | Chạy lại lượt AI Content Sheet | Xử lý · Ghi | `POST /marketing-campaigns/:id/sheet/ai/jobs/:jobId/retry` | Có | Khả dụng |
| `marketing.campaign.sheet.ai.jobs.list` | Tra trạng thái các lượt AI Content Sheet | Tra cứu · Đọc | `GET /marketing-campaigns/:id/sheet/ai/jobs/assistant-summaries` | — | Khả dụng |
| `marketing.campaign.sheet.cells.update` | Cập nhật các ô Content Sheet | Sửa · Ghi | `PATCH /marketing-campaigns/:id/sheet/cells` | Có | Khả dụng |
| `marketing.campaign.sheet.columns.list` | Tra cứu cột Content Sheet theo tên | Tra cứu · Đọc | `GET /marketing-campaigns/:id/sheet/columns/assistant-summaries` | — | Khả dụng |
| `marketing.campaign.sheet.revisions.list` | Tra cứu lịch sử phiên bản Content Sheet | Tra cứu · Đọc | `GET /marketing-campaigns/:id/sheet/revisions` | — | Khả dụng |
| `marketing.campaign.sheet.revisions.revert` | Hoàn tác thay đổi Content Sheet | Sửa · Ghi | `POST /marketing-campaigns/:id/sheet/revisions/:revisionId/revert` | Có | Khả dụng |
| `marketing.campaign.sheet.slots.list` | Chọn dòng Content Sheet theo tên | Tra cứu · Đọc | `GET /marketing-campaigns/:id/sheet/slots` | — | Khả dụng |
| `marketing.campaign.slot.approve` | Duyệt nội dung Facebook trong lịch chiến dịch | Duyệt · Ghi | `POST /marketing-campaigns/:id/slots/:slotId/approve` | Có | Khả dụng |
| `marketing.campaign.slot.content.update` | Cập nhật nội dung slot chiến dịch | Sửa · Ghi | `PATCH /marketing-campaigns/:id/slots/:slotId/content` | Có | Khả dụng |
| `marketing.campaign.slot.publish-now` | Đăng ngay nội dung Facebook trong lịch chiến dịch | Tạo · Ghi | `POST /marketing-campaigns/:id/slots/:slotId/publish-now` | Có | Khả dụng |
| `marketing.campaign.slot.reject` | Từ chối slot nội dung đang chờ duyệt | Duyệt · Ghi | `POST /marketing-campaigns/:id/slots/:slotId/reject` | Có | Khả dụng |
| `marketing.campaign.slot.retry` | Đưa slot nội dung lỗi về hàng đợi thử lại | Xử lý · Ghi | `POST /marketing-campaigns/:id/slots/:slotId/retry` | Có | Khả dụng |
| `marketing.canva.designs.list` | Tra thiết kế Canva của tôi | Tra cứu · Đọc | `GET /canva/designs` | — | Khả dụng |
| `marketing.canva.status` | Xem trạng thái kết nối Canva của tôi | Tra cứu · Đọc | `GET /canva/status` | — | Khả dụng |
| `marketing.chat-flow.activate` | Kích hoạt bản nháp workflow hội thoại | Sửa · Ghi | `POST /marketing-settings/chat-flows/:pageId/:version/activate` | Có | Khả dụng |
| `marketing.chat-flow.draft.create` | Tạo bản nháp quy trình trả lời tự động trên Trang Facebook | Tạo · Ghi | `POST /marketing-settings/chat-flows/:pageId/draft` | Có | Khả dụng |
| `marketing.chat-flow.list` | Xem quy trình trả lời tự động trên Trang Facebook | Tra cứu · Đọc | `GET /marketing-settings/chat-flows/:pageId` | — | Khả dụng |
| `marketing.chat-flow.suggest` | Gợi ý nội dung quy trình trả lời tự động trên Trang Facebook | Tra cứu · Đọc | `POST /marketing-settings/chat-flows/:pageId/suggest` | — | Khả dụng |
| `marketing.content.detail` | Xem nội dung marketing đã lưu | Tra cứu · Đọc | `GET /marketing-contents/:id` | — | Khả dụng |
| `marketing.content.draft.create` | Tạo bản nháp nội dung marketing | Tạo · Ghi | `POST /marketing-contents/assistant/drafts` | Có | Khả dụng |
| `marketing.content.draft.delete` | Xóa bản nháp nội dung marketing | Xóa · Ghi | `DELETE /marketing-contents/assistant/drafts/:id` | Có | Khả dụng |
| `marketing.content.draft.update` | Cập nhật bản nháp nội dung marketing | Sửa · Ghi | `PATCH /marketing-contents/assistant/drafts/:id` | Có | Khả dụng |
| `marketing.content.list` | Tra cứu nội dung marketing đã lưu | Tra cứu · Đọc | `GET /marketing-contents` | — | Khả dụng |
| `marketing.elevenlabs.custom-voice.preview` | Tạo bản nghe thử giọng tự thiết kế | Tạo · Ghi | `POST /elevenlabs/custom-voice-preview` | Có | Khả dụng |
| `marketing.elevenlabs.models.list` | Tra model tạo giọng đọc ElevenLabs | Tra cứu · Đọc | `GET /elevenlabs/models` | — | Khả dụng |
| `marketing.elevenlabs.voice-settings.read` | Xem cài đặt giọng đọc ElevenLabs | Tra cứu · Đọc | `GET /elevenlabs/voices/:voiceId/settings` | — | Khả dụng |
| `marketing.elevenlabs.voice-settings.update` | Cập nhật cài đặt giọng đọc ElevenLabs | Sửa · Ghi | `POST /elevenlabs/voices/:voiceId/settings` | Có | Khả dụng |
| `marketing.elevenlabs.voice.delete` | Xóa giọng đọc ElevenLabs tùy chỉnh | Xóa · Ghi | `DELETE /elevenlabs/voices/:voiceId` | Có | Khả dụng |
| `marketing.elevenlabs.voice.detail` | Xem thông tin giọng đọc ElevenLabs | Tra cứu · Đọc | `GET /elevenlabs/voices/:voiceId` | — | Khả dụng |
| `marketing.elevenlabs.voice.generate` | Tạo tệp giọng đọc AI | Tạo · Ghi | `POST /elevenlabs/generate-voice` | Có | Khả dụng |
| `marketing.elevenlabs.voices.list` | Tra giọng đọc ElevenLabs theo tài khoản | Tra cứu · Đọc | `GET /elevenlabs/voices` | — | Khả dụng |
| `marketing.facebook-app-config.read` | Kiểm tra cấu hình Facebook App | Tra cứu · Đọc | `GET /facebook/config` | — | Khả dụng |
| `marketing.lead-intake-profile.activate` | Áp dụng cấu hình thu thập khách hàng tiềm năng | Sửa · Ghi | `POST /marketing-settings/lead-intake-profiles/:version/activate` | Có | Khả dụng |
| `marketing.lead-intake-profile.archive` | Tắt cấu hình thu thập khách hàng tiềm năng đang áp dụng | Sửa · Ghi | `POST /marketing-settings/lead-intake-profiles/archive-active` | Có | Khả dụng |
| `marketing.lead-intake-profile.draft.create` | Tạo bản nháp thu thập thông tin khách hàng tiềm năng | Tạo · Ghi | `POST /marketing-settings/lead-intake-profiles/draft` | Có | Khả dụng |
| `marketing.lead-intake-profile.list` | Xem cài đặt tiếp nhận khách hàng tiềm năng | Tra cứu · Đọc | `GET /marketing-settings/lead-intake-profiles` | — | Khả dụng |
| `marketing.lead-intake-profile.suggest` | Gợi ý câu hỏi thu thập thông tin khách hàng tiềm năng | Tra cứu · Đọc | `POST /marketing-settings/lead-intake-profiles/suggest` | — | Khả dụng |
| `marketing.media-history.delete` | Xóa mục lịch sử ảnh hoặc giọng đọc | Xóa · Ghi | `DELETE /gemini/media-history/:id` | Có | Khả dụng |
| `marketing.media-history.list` | Xem lịch sử ảnh và giọng đọc AI | Tra cứu · Đọc | `GET /gemini/media-history` | — | Khả dụng |
| `marketing.scheduler.schedule-post` | Lên lịch đăng bài mạng xã hội | Tạo · Ghi | `POST /scheduler/schedule-post` | Có | Khả dụng |
| `marketing.tiktok-business.creator-info` | Tra cứu điều kiện đăng của tài khoản TikTok doanh nghiệp | Tra cứu · Đọc | `POST /tiktok-business/creator-info` | — | Khả dụng |
| `marketing.tiktok.creator-info` | Tra cứu điều kiện đăng của tài khoản TikTok | Tra cứu · Đọc | `POST /tiktok/creator-info` | — | Khả dụng |
| `marketing.video-caption.drive-videos.list` | Tìm video trong thư mục Google Drive để làm phụ đề | Tra cứu · Đọc | `POST /video-caption-projects/resolve-drive-folder` | Có | Khả dụng |
| `marketing.video-caption.project.analyze` | Phân tích video nguồn | Tra cứu · Ghi | `POST /video-caption-projects/:id/analyze` | Có | Khả dụng |
| `marketing.video-caption.project.cancel` | Hủy dự án phụ đề video | Hủy · Ghi | `POST /video-caption-projects/:id/cancel` | Có | Khả dụng |
| `marketing.video-caption.project.create` | Tạo bản nháp dự án phụ đề video | Tạo · Ghi | `POST /video-caption-projects` | Có | Khả dụng |
| `marketing.video-caption.project.detail` | Xem tóm tắt dự án phụ đề video | Tra cứu · Đọc | `GET /video-caption-projects/:id` | — | Khả dụng |
| `marketing.video-caption.project.generate-context` | Tạo caption theo ngữ cảnh video | Tạo · Ghi | `POST /video-caption-projects/:id/generate-context` | Có | Khả dụng |
| `marketing.video-caption.project.list` | Tra cứu dự án phụ đề video | Tra cứu · Đọc | `GET /video-caption-projects` | — | Khả dụng |
| `marketing.video-caption.project.render` | Kết xuất phụ đề video | Xuất · Ghi | `POST /video-caption-projects/:id/render` | Có | Khả dụng |
| `marketing.video-caption.project.retry` | Thử lại dự án phụ đề video | Xử lý · Ghi | `POST /video-caption-projects/:id/retry` | Có | Khả dụng |
| `marketing.video-caption.project.transcribe` | Nhận dạng lời thoại trong video | Tạo · Ghi | `POST /video-caption-projects/:id/transcribe` | Có | Khả dụng |
| `marketing.video-caption.project.update` | Cập nhật dự án phụ đề video | Sửa · Ghi | `PATCH /video-caption-projects/:id` | Có | Khả dụng |

### marketing campaigns — `social-marketing:marketing-campaigns`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.06e367cdefd81e60` | Xóa trường thông tin đơn hàng chiến dịch | Xóa · Ghi | `DELETE /marketing-campaigns/:id/asset-orders/custom-fields/:fieldKey` | Có | Khả dụng |
| `api.delete.821abe66f21dcede` | Lưu trữ cột trong bảng nội dung chiến dịch | Xóa · Ghi | `DELETE /marketing-campaigns/:id/sheet/columns/:columnId` | Có | Khả dụng |
| `api.patch.4da13a2c42665d10` | Cập nhật dòng trong bảng nội dung chiến dịch | Sửa · Ghi | `PATCH /marketing-campaigns/:id/sheet/rows/:slotId` | Có | Khả dụng |
| `api.patch.568b7733e09d2fd4` | Cập nhật cột trong bảng nội dung chiến dịch | Sửa · Ghi | `PATCH /marketing-campaigns/:id/sheet/columns/:columnId` | Có | Khả dụng |
| `api.post.0b24bc4450142162` | Xem trước dữ liệu nhập nhiều đơn hàng chiến dịch | Tra cứu · Ghi | `POST /marketing-campaigns/:id/asset-orders/bulk-import/preview` | Có | Khả dụng |
| `api.post.2e5c57691eaca5f3` | Tạo lượt AI điền nội dung cho bảng chiến dịch | Tạo · Ghi | `POST /marketing-campaigns/:id/sheet/ai/jobs` | Có | Khả dụng |
| `api.post.2ff1ac15e0ff3989` | Tạo ảnh cho đơn hàng chiến dịch | Tạo · Ghi | `POST /marketing-campaigns/:id/asset-orders/:orderId/bulk` | Có | Khả dụng |
| `api.post.44271d4a548fc225` | Thêm dòng vào bảng dữ liệu chiến dịch | Tạo · Ghi | `POST /marketing-campaigns/:id/sheet/rows` | Có | Khả dụng |
| `api.post.6e7eaeb9be19d13b` | Thêm trường thông tin cho đơn hàng chiến dịch | Tạo · Ghi | `POST /marketing-campaigns/:id/asset-orders/custom-fields` | Có | Khả dụng |
| `api.post.8f4e6b6e62376095` | Áp dụng nội dung AI đề xuất vào bảng chiến dịch | Xuất · Ghi | `POST /marketing-campaigns/:id/sheet/ai/jobs/:jobId/apply` | Có | Khả dụng |
| `api.post.94df372cee3d43f4` | Xem trước dữ liệu đơn hàng từ Google Drive | Tra cứu · Ghi | `POST /marketing-campaigns/:id/asset-orders/drive-import/preview` | Có | Khả dụng |
| `api.post.9fe634492244a76b` | Thêm cột vào bảng dữ liệu chiến dịch | Tạo · Ghi | `POST /marketing-campaigns/:id/sheet/columns` | Có | Khả dụng |
| `api.post.bb225803a96e0b2e` | Nhập dữ liệu đơn hàng từ Google Drive | Tạo · Ghi | `POST /marketing-campaigns/:id/asset-orders/drive-import/apply` | Có | Khả dụng |
| `api.post.d88657dd722cb73f` | Xem trước nội dung AI đề xuất cho bảng chiến dịch | Xuất · Ghi | `POST /marketing-campaigns/:id/sheet/ai/preview` | Có | Khả dụng |
| `api.post.f74c1ae26e5c4c3d` | Xem trước ảnh sẽ tạo cho đơn hàng chiến dịch | Tạo · Ghi | `POST /marketing-campaigns/:id/asset-orders/:orderId/bulk/preview` | Có | Khả dụng |
| `api.post.f7c8bd07314d5116` | Bổ sung nội dung còn thiếu cho đơn hàng sản xuất ảnh | Xuất · Ghi | `POST /marketing-campaigns/:id/asset-orders/ai/fill-all` | Có | Khả dụng |

### marketing settings — `social-marketing:marketing-settings`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.0e783589312053eb` | Xem cấu hình đọc hóa đơn và hợp đồng | Tra cứu · Đọc | `GET /marketing-settings/telecom-invoices/:platform/:pageId` | — | Khả dụng |

### video caption projects — `social-marketing:video-caption-projects`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.66991e7cdf8da27d` | Tra cứu nội dung và chiến dịch làm ngữ cảnh phụ đề | Tra cứu · Đọc | `GET /video-caption-projects/context-options` | — | Khả dụng |
| `api.get.c380a8600a6b601f` | Xem tiến độ xử lý phụ đề video | Tra cứu · Đọc | `GET /video-caption-projects/:id/jobs` | — | Khả dụng |

<a id="module-omni-inbox"></a>
## Hộp thư đa kênh — `omni-inbox`

Tổng 42 action: 17 đọc, 25 ghi; 0 không khả dụng.

### account — `omni-inbox:account`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.account.ai-config.update` | Cập nhật cấu hình trợ lý AI cho tài khoản nhắn tin | Sửa · Ghi | `PATCH /omni-inbox/accounts/:id/ai-config` | Có | Khả dụng |
| `omni-inbox.account.list` | Tra cứu tài khoản nhắn tin | Tra cứu · Đọc | `GET /omni-inbox/accounts` | — | Khả dụng |

### ai-reply — `omni-inbox:ai-reply`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.ai-reply.test` | Thử câu trả lời của trợ lý AI | Gửi / liên lạc · Ghi | `POST /gemini/test-reply` | Có | Khả dụng |

### ai-reply-log — `omni-inbox:ai-reply-log`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.ai-reply-log.feedback.update` | Đánh giá chất lượng phản hồi AI | Sửa · Ghi | `PATCH /gemini/ai-reply-logs/:id/feedback` | Có | Khả dụng |

### ai-reply-logs — `omni-inbox:ai-reply-logs`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.ai-reply-logs.list` | Tra phản hồi gần đây của trợ lý hộp thư | Tra cứu · Đọc | `GET /gemini/ai-reply-logs` | — | Khả dụng |

### facebook-conversation — `omni-inbox:facebook-conversation`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.facebook-conversation.mark-read` | Đánh dấu hội thoại Facebook đã đọc | Tạo · Ghi | `POST /facebook/messenger/conversations/:recipientId/mark-read` | Có | Khả dụng |
| `omni-inbox.facebook-conversation.reply` | Gửi phản hồi qua Facebook | Gửi / liên lạc · Ghi | `POST /facebook/messenger/reply` | Có | Khả dụng |
| `omni-inbox.facebook-conversation.resume-ai` | Bật lại trợ lý AI cho hội thoại Facebook | Tạo · Ghi | `POST /facebook/messenger/conversations/:recipientId/resume-ai` | Có | Khả dụng |

### facebook-conversations — `omni-inbox:facebook-conversations`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.facebook-conversations.list` | Tra hội thoại Facebook gần đây | Tra cứu · Đọc | `GET /facebook/messenger/conversations` | — | Khả dụng |

### lead-sheet — `omni-inbox:lead-sheet`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.lead-sheet.retry` | Thử đồng bộ lại khách hàng tiềm năng sang Google Sheets | Xử lý · Ghi | `POST /order-sheets/integrations/:integrationId/leads/retry` | Có | Khả dụng |
| `omni-inbox.lead-sheet.test` | Kiểm tra kết nối nhận khách hàng tiềm năng | Tạo · Ghi | `POST /order-sheets/integrations/:integrationId/leads/test` | Có | Khả dụng |

### leads — `omni-inbox:leads`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.leads.create` | Tạo khách tiềm năng | Tạo · Ghi | `POST /omni-inbox/leads` | Có | Khả dụng |
| `omni-inbox.leads.export-google-sheets` | Gửi các khách tiềm năng đã chọn sang Google Sheets | Tạo · Ghi | `POST /omni-inbox/leads/export-google-sheets` | Có | Khả dụng |
| `omni-inbox.leads.link-patient` | Liên kết khách tiềm năng với bệnh nhân | Tạo · Ghi | `POST /omni-inbox/leads/:id/module-sync` | Có | Khả dụng |
| `omni-inbox.leads.link-student` | Liên kết khách tiềm năng với học viên | Tạo · Ghi | `POST /omni-inbox/leads/:id/module-sync` | Có | Khả dụng |
| `omni-inbox.leads.link-worker` | Liên kết khách tiềm năng với người lao động | Tạo · Ghi | `POST /omni-inbox/leads/:id/module-sync` | Có | Khả dụng |
| `omni-inbox.leads.list` | Tra cứu khách tiềm năng | Tra cứu · Đọc | `GET /omni-inbox/leads` | — | Khả dụng |
| `omni-inbox.leads.update` | Cập nhật khách tiềm năng | Sửa · Ghi | `PATCH /omni-inbox/leads/:id` | Có | Khả dụng |

### marketing — `omni-inbox:marketing`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `marketing.order-sheet.orders.list` | Tra cứu đơn hàng từ tin nhắn | Tra cứu · Đọc | `GET /order-sheets/orders` | — | Khả dụng |
| `marketing.product-catalog.config` | Xem cấu hình thư viện ảnh sản phẩm | Tra cứu · Đọc | `GET /company-cake-catalog` | — | Khả dụng |
| `marketing.product-catalog.config.test` | Kiểm tra thư viện ảnh sản phẩm | Tạo · Ghi | `POST /company-cake-catalog/test` | Có | Khả dụng |
| `marketing.product-catalog.config.update` | Cập nhật cấu hình thư viện ảnh sản phẩm | Sửa · Ghi | `PUT /company-cake-catalog` | Có | Khả dụng |
| `marketing.sepay.config` | Xem trạng thái cấu hình thanh toán SePay | Tra cứu · Đọc | `GET /company-sepay` | — | Khả dụng |
| `marketing.sepay.config.update` | Cập nhật trạng thái thanh toán và tỷ lệ đặt cọc SePay | Sửa · Ghi | `PUT /company-sepay` | Có | Khả dụng |
| `marketing.telegram-order.config-status` | Xem trạng thái thông báo đơn hàng qua Telegram | Tra cứu · Đọc | `GET /company-telegram-order` | — | Khả dụng |
| `marketing.telegram-order.config.update` | Bật hoặc tắt thông báo đơn hàng qua Telegram | Sửa · Ghi | `PUT /company-telegram-order` | Có | Khả dụng |

### omni — `omni-inbox:omni`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni.contract.providers.list` | Tra cứu nhà cung cấp hợp đồng | Tra cứu · Đọc | `GET /omni-inbox/lead-contracts/providers` | — | Khả dụng |

### omni inbox — `omni-inbox:omni-inbox`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.06681c767355ea2d` | Tra cứu khách tiềm năng theo hội thoại | Tra cứu · Đọc | `GET /omni-inbox/leads/by-conversation` | — | Khả dụng |
| `api.get.618343e099d57959` | Tra cứu ảnh hợp đồng của khách tiềm năng | Tra cứu · Đọc | `GET /omni-inbox/leads/:id/contract-photos` | — | Khả dụng |
| `api.get.d3b0949a7f9b099b` | Tra cứu hóa đơn viễn thông của khách tiềm năng | Tra cứu · Đọc | `GET /omni-inbox/leads/:id/telecom-invoices` | — | Khả dụng |
| `api.get.e30354974a18d912` | Xem khách tiềm năng | Tra cứu · Đọc | `GET /omni-inbox/leads/:id` | — | Khả dụng |
| `api.get.ec14b8bc333c1211` | Tra cứu ảnh hợp đồng cần rà soát | Tra cứu · Đọc | `GET /omni-inbox/lead-contracts/review` | — | Khả dụng |

### order sheets — `omni-inbox:order-sheets`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.get.d89b9a22f3011fb5` | Xem khách hàng tiềm năng từ bảng đơn hàng | Tra cứu · Đọc | `GET /order-sheets/integrations/:integrationId/leads` | — | Khả dụng |
| `api.put.fa5a4973ae409caa` | Cập nhật thông tin nhận khách hàng tiềm năng từ bảng đơn hàng | Sửa · Ghi | `PUT /order-sheets/integrations/:integrationId/leads` | Có | Khả dụng |

### tiktok-conversation — `omni-inbox:tiktok-conversation`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.tiktok-conversation.mark-read` | Đánh dấu hội thoại TikTok đã đọc | Tạo · Ghi | `POST /tiktok/messenger/conversations/:conversationId/mark-read` | Có | Khả dụng |
| `omni-inbox.tiktok-conversation.reply` | Gửi phản hồi qua TikTok | Gửi / liên lạc · Ghi | `POST /tiktok/messenger/reply` | Có | Khả dụng |
| `omni-inbox.tiktok-conversation.resume-ai` | Bật lại trợ lý AI cho hội thoại TikTok | Tạo · Ghi | `POST /tiktok/messenger/conversations/:conversationId/resume-ai` | Có | Khả dụng |

### tiktok-conversations — `omni-inbox:tiktok-conversations`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.tiktok-conversations.list` | Tra hội thoại TikTok gần đây | Tra cứu · Đọc | `GET /tiktok/messenger/conversations` | — | Khả dụng |

### zalo-conversation — `omni-inbox:zalo-conversation`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.zalo-conversation.mark-read` | Đánh dấu hội thoại Zalo đã đọc | Tạo · Ghi | `POST /zalo/conversations/:recipientId/mark-read` | Có | Khả dụng |
| `omni-inbox.zalo-conversation.reply` | Gửi phản hồi qua Zalo | Gửi / liên lạc · Ghi | `POST /zalo/reply` | Có | Khả dụng |
| `omni-inbox.zalo-conversation.resume-ai` | Bật lại trợ lý AI cho hội thoại Zalo | Tạo · Ghi | `POST /zalo/conversations/:recipientId/resume-ai` | Có | Khả dụng |

### zalo-conversations — `omni-inbox:zalo-conversations`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `omni-inbox.zalo-conversations.list` | Tra hội thoại Zalo gần đây | Tra cứu · Đọc | `GET /zalo/conversations` | — | Khả dụng |

<a id="module-company-knowledge"></a>
## Kho tri thức — `company-knowledge`

Tổng 15 action: 5 đọc, 10 ghi; 0 không khả dụng.

### account — `company-knowledge:account`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.account.list` | Tra cứu tài khoản mạng xã hội cho kho tri thức | Tra cứu · Đọc | `GET /company-knowledge/accounts` | — | Khả dụng |

### clear-all — `company-knowledge:clear-all`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.clear-all` | Xóa toàn bộ tài liệu và dữ liệu tri thức AI của công ty | Xóa · Ghi | `POST /gemini/clear-knowledge` | Có | Khả dụng |

### conflicts — `company-knowledge:conflicts`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.conflicts.list` | Kiểm tra mâu thuẫn trong kho tri thức | Tra cứu · Đọc | `GET /company-knowledge/conflicts` | — | Khả dụng |

### documents — `company-knowledge:documents`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.documents.delete` | Xóa tài liệu khỏi kho tri thức | Xóa · Ghi | `DELETE /company-knowledge/documents/:id` | Có | Khả dụng |
| `company-knowledge.documents.list` | Tra cứu tài liệu kho tri thức doanh nghiệp | Tra cứu · Đọc | `GET /company-knowledge/documents` | — | Khả dụng |
| `company-knowledge.documents.scopes.update` | Cập nhật phạm vi tài liệu kho tri thức | Sửa · Ghi | `PATCH /company-knowledge/documents/:id/scopes` | Có | Khả dụng |

### faq-candidate — `company-knowledge:faq-candidate`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.faq-candidate.approve` | Duyệt FAQ vào kho tri thức | Duyệt · Ghi | `POST /company-knowledge/faq-candidates/:id/approve` | Có | Khả dụng |
| `company-knowledge.faq-candidate.delete` | Xóa đề xuất FAQ | Xóa · Ghi | `DELETE /company-knowledge/faq-candidates/:id` | Có | Khả dụng |
| `company-knowledge.faq-candidate.reject` | Bỏ qua FAQ được đề xuất | Duyệt · Ghi | `POST /company-knowledge/faq-candidates/:id/reject` | Có | Khả dụng |

### faq-candidates — `company-knowledge:faq-candidates`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.faq-candidates.analyze` | Phân tích hội thoại để đề xuất FAQ | Xuất · Ghi | `POST /company-knowledge/faq-candidates/analyze` | Có | Khả dụng |
| `company-knowledge.faq-candidates.list` | Tra cứu câu hỏi thường gặp AI đề xuất | Tra cứu · Đọc | `GET /company-knowledge/faq-candidates` | — | Khả dụng |

### health — `company-knowledge:health`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.health` | Tra cứu trạng thái kho tri thức AI của công ty | Tra cứu · Đọc | `GET /gemini/knowledge-health` | — | Khả dụng |

### page-chat — `company-knowledge:page-chat`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.page-chat.simulate` | Mô phỏng câu trả lời chatbot Page | Gửi / liên lạc · Ghi | `POST /company-knowledge/simulate-page-chat` | Có | Khả dụng |

### scenario — `company-knowledge:scenario`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.scenario.clear` | Xóa kịch bản chăm sóc khách hàng khỏi kho tri thức | Xóa · Ghi | `DELETE /gemini/customer-service-scenario` | Có | Khả dụng |

### test-search — `company-knowledge:test-search`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `company-knowledge.test-search` | Thử tìm kiếm trong kho tri thức | Tra cứu · Ghi | `POST /company-knowledge/test-search` | Có | Khả dụng |

<a id="module-legal-reference"></a>
## Văn bản pháp luật — `legal-reference`

Tổng 8 action: 5 đọc, 3 ghi; 0 không khả dụng.

### legal — `legal-reference:legal`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `legal.document.answer` | Giải đáp từ kho văn bản pháp lý | Tra cứu · Đọc | `POST /legal-reference/answer` | — | Khả dụng |
| `legal.document.list` | Tra cứu danh mục văn bản pháp lý | Tra cứu · Đọc | `GET /legal-reference/documents` | — | Khả dụng |
| `legal.document.search` | Tìm nội dung trong kho văn bản pháp lý | Tra cứu · Đọc | `POST /legal-reference/search` | — | Khả dụng |
| `legal.repository.status` | Xem tình trạng kho văn bản | Tra cứu · Đọc | `GET /legal-reference/health` | — | Khả dụng |
| `legal.repository.sync` | Đồng bộ kho văn bản pháp lý | Tạo · Ghi | `POST /legal-reference/sync` | Có | Khả dụng |
| `legal.review.content.update` | Sửa nội dung văn bản đang rà soát | Sửa · Ghi | `POST /legal-reference/review-queue/:id/content` | Có | Khả dụng |
| `legal.review.decision` | Duyệt hoặc từ chối văn bản rà soát | Duyệt · Ghi | `POST /legal-reference/review-queue/:id/decision` | Có | Khả dụng |
| `legal.review.list` | Tra cứu văn bản chờ rà soát | Tra cứu · Đọc | `GET /legal-reference/review-queue` | — | Khả dụng |

<a id="module-quotation"></a>
## Báo giá — `quotation`

Tổng 60 action: 25 đọc, 35 ghi; 0 không khả dụng.

### acceptance — `quotation:acceptance`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.acceptance.complete` | Hoàn tất biên bản nghiệm thu | Xử lý · Ghi | `POST /quotation/acceptance-records/:id/complete` | Có | Khả dụng |
| `quotation.acceptance.create` | Lập biên bản nghiệm thu từ hợp đồng đã ký | Tạo · Ghi | `POST /quotation/acceptance-records` | Có | Khả dụng |
| `quotation.acceptance.detail` | Xem chi tiết biên bản nghiệm thu | Tra cứu · Đọc | `GET /quotation/acceptance-records/:id` | — | Khả dụng |
| `quotation.acceptance.export` | Xuất file biên bản nghiệm thu | Tra cứu · Đọc | `GET /quotation/acceptance-records/:id/file` | Có | Khả dụng |
| `quotation.acceptance.list` | Tra cứu biên bản nghiệm thu | Tra cứu · Đọc | `GET /quotation/acceptance-records` | — | Khả dụng |
| `quotation.acceptance.settlement` | Xuất file quyết toán nghiệm thu | Tra cứu · Đọc | `GET /quotation/acceptance-records/:id/settlement/file` | Có | Khả dụng |
| `quotation.acceptance.update` | Cập nhật biên bản nghiệm thu đang nháp | Sửa · Ghi | `PATCH /quotation/acceptance-records/:id` | Có | Khả dụng |

### budget — `quotation:budget`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.budget.answer` | Trả lời câu hỏi của phương án ngân sách | Gửi / liên lạc · Ghi | `PATCH /quotation/budget-plans/:id` | Có | Khả dụng |
| `quotation.budget.assumption` | Xác nhận hoặc sửa giả định của phương án ngân sách | Sửa · Ghi | `PATCH /quotation/budget-plans/:id` | Có | Khả dụng |
| `quotation.budget.create` | Đề xuất phương án dự toán theo ngân sách | Tạo · Ghi | `POST /quotation/budget-plans/suggest` | Có | Khả dụng |
| `quotation.budget.export` | Xuất file phương án ngân sách | Tra cứu · Đọc | `GET /quotation/budget-plans/:id/export` | Có | Khả dụng |
| `quotation.budget.list` | Tra cứu phương án dự toán theo ngân sách | Tra cứu · Đọc | `GET /quotation/budget-plans` | — | Khả dụng |
| `quotation.budget.missing` | Bổ sung hạng mục còn thiếu vào phương án ngân sách | Tạo · Ghi | `PATCH /quotation/budget-plans/:id` | Có | Khả dụng |
| `quotation.budget.quantity` | Xác nhận số lượng sản phẩm trong phương án ngân sách | Tạo · Ghi | `PATCH /quotation/budget-plans/:id` | Có | Khả dụng |
| `quotation.budget.recalculate` | Tính lại phương án dự toán theo ngân sách | Tạo · Ghi | `PATCH /quotation/budget-plans/:id` | Có | Khả dụng |

### catalog — `quotation:catalog`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.catalog.bulk` | Cập nhật hàng loạt sản phẩm trong bảng giá Báo giá | Sửa · Ghi | `POST /quotation/catalog/bulk` | Có | Khả dụng |
| `quotation.catalog.create` | Thêm sản phẩm vào bảng giá Báo giá | Tạo · Ghi | `POST /quotation/catalog` | Có | Khả dụng |
| `quotation.catalog.delete` | Xóa sản phẩm trong bảng giá Báo giá | Xóa · Ghi | `DELETE /quotation/catalog/:id` | Có | Khả dụng |
| `quotation.catalog.duplicate` | Nhân bản sản phẩm trong bảng giá Báo giá | Tạo · Ghi | `POST /quotation/catalog/:id/duplicate` | Có | Khả dụng |
| `quotation.catalog.import` | Nhập bảng giá Excel/CSV đã kiểm tra | Nhập · Ghi | `POST /quotation/catalog/import/confirm` | Có | Khả dụng |
| `quotation.catalog.import-preview` | Kiểm tra bảng giá Excel/CSV trước khi nhập | Tra cứu · Đọc | `POST /quotation/catalog/import/preview` | — | Khả dụng |
| `quotation.catalog.list` | Tra cứu sản phẩm trong bảng giá Báo giá | Tra cứu · Đọc | `GET /quotation/catalog` | — | Khả dụng |
| `quotation.catalog.restore` | Khôi phục sản phẩm đã xóa trong bảng giá Báo giá | Sửa · Ghi | `POST /quotation/catalog/:id/restore` | Có | Khả dụng |
| `quotation.catalog.update` | Cập nhật sản phẩm trong bảng giá Báo giá | Sửa · Ghi | `PATCH /quotation/catalog/:id` | Có | Khả dụng |

### customer-quote — `quotation:customer-quote`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.customer-quote.create` | Lập báo giá khách hàng từ bảng giá | Tạo · Ghi | `POST /quotation/customer-quotes` | Có | Khả dụng |
| `quotation.customer-quote.suggest` | Đề xuất sản phẩm cho báo giá khách hàng | Xuất · Ghi | `POST /quotation/customer-quotes/suggest` | Có | Khả dụng |

### estimate — `quotation:estimate`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.estimate.create` | Lập dự toán từ yêu cầu đã phân tích | Tạo · Ghi | `POST /quotation/quotes` | Có | Khả dụng |
| `quotation.estimate.from-customer` | Lập dự toán từ báo giá khách hàng | Tạo · Ghi | `POST /quotation/quotes/from-customer` | Có | Khả dụng |

### export — `quotation:export`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.export.latest` | Xem tiến độ và file xuất mới nhất của chứng từ | Tra cứu · Đọc | `GET /quotation/generated-export-files/latest` | — | Khả dụng |

### file — `quotation:file`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.file.download` | Tải file đã tạo trong Báo giá | Tra cứu · Đọc | `GET /quotation/files/:id/download` | — | Khả dụng |
| `quotation.file.list` | Tra cứu file đã tạo trong Báo giá | Tra cứu · Đọc | `GET /quotation/files` | — | Khả dụng |

### Hợp đồng — `quotation:contract`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.contract.create` | Tạo hợp đồng từ dự toán đã duyệt | Tạo · Ghi | `POST /quotation/contracts` | Có | Khả dụng |
| `quotation.contract.detail` | Xem chi tiết hợp đồng Báo giá | Tra cứu · Đọc | `GET /quotation/contracts/:id` | — | Khả dụng |
| `quotation.contract.export` | Xuất file hợp đồng | Tra cứu · Đọc | `GET /quotation/contracts/:id/file` | Có | Khả dụng |
| `quotation.contract.list` | Tra cứu hợp đồng trong Báo giá | Tra cứu · Đọc | `GET /quotation/contracts` | — | Khả dụng |
| `quotation.contract.sign` | Xác nhận đã ký hợp đồng Báo giá | Tạo · Ghi | `POST /quotation/contracts/:id/sign` | Có | Khả dụng |
| `quotation.contract.update` | Cập nhật hợp đồng Báo giá đang nháp | Sửa · Ghi | `PATCH /quotation/contracts/:id` | Có | Khả dụng |

### price-list — `quotation:price-list`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.price-list.list` | Tra cứu các tệp bảng giá đã nhập | Tra cứu · Đọc | `GET /quotation/price-list` | — | Khả dụng |

### quotation — `quotation:quotation`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.overview` | Xem tổng quan Báo giá | Báo cáo · Đọc | `GET /quotation/overview` | — | Khả dụng |

### quote — `quotation:quote`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.quote.approve` | Duyệt báo giá hoặc dự toán | Duyệt · Ghi | `POST /quotation/quotes/:id/approve` | Có | Khả dụng |
| `quotation.quote.delete` | Xóa báo giá hoặc dự toán | Xóa · Ghi | `DELETE /quotation/quotes/:id` | Có | Khả dụng |
| `quotation.quote.detail` | Xem chi tiết báo giá hoặc dự toán | Tra cứu · Đọc | `GET /quotation/quotes/:id` | — | Khả dụng |
| `quotation.quote.export` | Xuất file báo giá hoặc dự toán theo mẫu | Tra cứu · Đọc | `GET /quotation/quotes/:id/export` | Có | Khả dụng |
| `quotation.quote.export-retry` | Thử tạo lại file báo giá hoặc dự toán | Tạo · Ghi | `POST /quotation/quotes/:id/export/retry` | Có | Khả dụng |
| `quotation.quote.list` | Tra cứu báo giá và dự toán | Tra cứu · Đọc | `GET /quotation/quotes` | — | Khả dụng |
| `quotation.quote.pdf` | Xuất PDF báo giá đã duyệt | Tra cứu · Đọc | `GET /quotation/quotes/:id/pdf` | Có | Khả dụng |
| `quotation.quote.recalculate` | Tính lại bằng AI báo giá hoặc dự toán | Tạo · Ghi | `POST /quotation/quotes/:id/recalculate` | Có | Khả dụng |
| `quotation.quote.reject` | Trả lại báo giá hoặc dự toán | Duyệt · Ghi | `POST /quotation/quotes/:id/reject` | Có | Khả dụng |
| `quotation.quote.submit-review` | Gửi duyệt báo giá hoặc dự toán | Duyệt · Ghi | `POST /quotation/quotes/:id/submit-review` | Có | Khả dụng |
| `quotation.quote.update` | Cập nhật hoặc bổ sung báo giá, dự toán | Sửa · Ghi | `PATCH /quotation/quotes/:id` | Có | Khả dụng |

### request — `quotation:request`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.request.analyze` | Phân tích yêu cầu lập dự toán bằng AI | Tra cứu · Ghi | `POST /quotation/quote-requests/:id/analyze` | Có | Khả dụng |
| `quotation.request.create` | Tạo yêu cầu lập dự toán | Tạo · Ghi | `POST /quotation/quote-requests` | Có | Khả dụng |
| `quotation.request.list` | Tra cứu yêu cầu lập dự toán | Tra cứu · Đọc | `GET /quotation/quote-requests` | — | Khả dụng |

### settings — `quotation:settings`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.settings.list` | Xem thông tin bên bán trong Báo giá | Tra cứu · Đọc | `GET /quotation/settings` | — | Khả dụng |
| `quotation.settings.update` | Cập nhật thông tin bên bán trong Báo giá | Sửa · Ghi | `PUT /quotation/settings` | Có | Khả dụng |

### template — `quotation:template`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.template.delete` | Xóa mẫu tài liệu Báo giá | Xóa · Ghi | `DELETE /quotation/quote-template/:id` | Có | Khả dụng |
| `quotation.template.download` | Tải mẫu tài liệu Báo giá | Tra cứu · Đọc | `GET /quotation/quote-template/:id/file` | — | Khả dụng |
| `quotation.template.list` | Tra cứu mẫu báo giá, dự toán, hợp đồng, nghiệm thu | Tra cứu · Đọc | `GET /quotation/quote-templates` | — | Khả dụng |
| `quotation.template.update` | Chuyển loại mẫu tài liệu Báo giá | Sửa · Ghi | `PATCH /quotation/quote-template/:id/category` | Có | Khả dụng |

### usage — `quotation:usage`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `quotation.usage` | Xem hạn mức sử dụng Báo giá | Tra cứu · Đọc | `GET /quotation/usage` | — | Khả dụng |

<a id="module-healthcare"></a>
## Quản lý y tế — `healthcare`

Tổng 28 action: 14 đọc, 14 ghi; 0 không khả dụng.

### appointment — `healthcare:appointment`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `healthcare.appointment.create` | Tạo lịch hẹn khám | Tạo · Ghi | `POST /healthcare/appointments` | Có | Khả dụng |
| `healthcare.appointment.list` | Tra cứu lịch hẹn khám | Tra cứu · Đọc | `POST /healthcare/appointments/search` | — | Khả dụng |
| `healthcare.appointment.update` | Cập nhật lịch hẹn khám | Sửa · Ghi | `PATCH /healthcare/appointments/:id` | Có | Khả dụng |

### care — `healthcare:care`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `healthcare.care.create` | Tạo công việc chăm sóc bệnh nhân | Tạo · Ghi | `POST /healthcare/care` | Có | Khả dụng |
| `healthcare.care.list` | Tra cứu công việc chăm sóc bệnh nhân | Tra cứu · Đọc | `POST /healthcare/care/search` | — | Khả dụng |
| `healthcare.care.update` | Cập nhật công việc chăm sóc bệnh nhân | Sửa · Ghi | `PATCH /healthcare/care/:id` | Có | Khả dụng |

### catalog — `healthcare:catalog`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `healthcare.catalog.create` | Tạo danh mục y tế | Tạo · Ghi | `POST /healthcare/catalog` | Có | Khả dụng |
| `healthcare.catalog.list` | Tra cứu danh mục bác sĩ, phòng khám, dịch vụ | Tra cứu · Đọc | `GET /healthcare/catalog` | — | Khả dụng |
| `healthcare.catalog.update` | Cập nhật hoặc ngừng sử dụng danh mục y tế | Sửa · Ghi | `PATCH /healthcare/catalog/:id` | Có | Khả dụng |

### healthcare — `healthcare:healthcare`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `healthcare.import.detail` | Xem tiến độ và kết quả đợt nhập y tế | Tra cứu · Đọc | `GET /healthcare/imports/:id` | — | Khả dụng |
| `healthcare.import.list` | Tra cứu lịch sử nhập Excel y tế | Tra cứu · Đọc | `GET /healthcare/imports` | — | Khả dụng |
| `healthcare.import.retry` | Thử lại đợt nhập Excel y tế bị lỗi | Xử lý · Ghi | `POST /healthcare/imports/:id/retry` | Có | Khả dụng |
| `healthcare.overview` | Xem tổng quan y tế | Báo cáo · Đọc | `GET /healthcare/overview` | — | Khả dụng |

### import — `healthcare:import`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `healthcare.import.commit` | Xác nhận ghi dữ liệu Excel y tế đã kiểm tra | Nhập · Ghi | `POST /healthcare/imports/:id/commit` | Có | Khả dụng |
| `healthcare.import.preview` | Kiểm tra tệp Excel bệnh nhân, lượt khám hoặc báo cáo bệnh viện | Nhập · Ghi | `POST /healthcare/imports/preview/:kind` | Có | Khả dụng |
| `healthcare.import.rows` | Tra cứu từng dòng dữ liệu nhập y tế | Tra cứu · Đọc | `POST /healthcare/imports/:id/rows/search` | — | Khả dụng |
| `healthcare.import.template` | Tải mẫu Excel bệnh nhân hoặc lượt khám | Tra cứu · Đọc | `GET /healthcare/imports/template/:kind` | — | Khả dụng |

### patient — `healthcare:patient`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `healthcare.patient.bulk-delete` | Xóa bệnh nhân và dữ liệu y tế liên quan | Xóa · Ghi | `POST /healthcare/patients/bulk-delete` | Có | Khả dụng |
| `healthcare.patient.bulk-delete-preview` | Xem dữ liệu liên quan trước khi xóa bệnh nhân | Tra cứu · Đọc | `POST /healthcare/patients/bulk-delete-preview` | — | Khả dụng |
| `healthcare.patient.create` | Tạo bệnh nhân | Tạo · Ghi | `POST /healthcare/patients` | Có | Khả dụng |
| `healthcare.patient.detail` | Xem hồ sơ bệnh nhân | Tra cứu · Đọc | `GET /healthcare/patients/:id` | — | Khả dụng |
| `healthcare.patient.list` | Tra cứu bệnh nhân | Tra cứu · Đọc | `POST /healthcare/patients/search` | — | Khả dụng |
| `healthcare.patient.update` | Cập nhật bệnh nhân | Sửa · Ghi | `PATCH /healthcare/patients/:id` | Có | Khả dụng |

### staff — `healthcare:staff`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `healthcare.staff.list` | Tra cứu nhân viên chăm sóc tại chi nhánh | Tra cứu · Đọc | `GET /healthcare/staff` | — | Khả dụng |

### visit — `healthcare:visit`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `healthcare.visit.create` | Tạo lượt khám | Tạo · Ghi | `POST /healthcare/visits` | Có | Khả dụng |
| `healthcare.visit.list` | Tra cứu lượt khám | Tra cứu · Đọc | `POST /healthcare/visits/search` | — | Khả dụng |
| `healthcare.visit.report` | Xem phiếu khám bệnh viện đã nhập | Báo cáo · Đọc | `GET /healthcare/visits/:id/report` | — | Khả dụng |
| `healthcare.visit.update` | Cập nhật lượt khám | Sửa · Ghi | `PATCH /healthcare/visits/:id` | Có | Khả dụng |

<a id="module-architect-assistant"></a>
## Trợ lý kiến trúc — `architect-assistant`

Tổng 8 action: 2 đọc, 6 ghi; 0 không khả dụng.

### architect — `architect-assistant:architect`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `architect.project.create` | Tạo dự án kiến trúc | Tạo · Ghi | `POST /architect-assistant/projects` | Có | Khả dụng |
| `architect.project.delete` | Xóa dự án kiến trúc | Xóa · Ghi | `DELETE /architect-assistant/projects/:projectId` | Có | Khả dụng |
| `architect.project.detail` | Xem dự án kiến trúc | Tra cứu · Đọc | `GET /architect-assistant/projects/:projectId` | — | Khả dụng |
| `architect.project.generate-plan` | Tạo mặt bằng kiến trúc bằng AI | Tạo · Ghi | `POST /architect-assistant/projects/:projectId/generate-plan` | Có | Khả dụng |
| `architect.project.list` | Tra cứu dự án kiến trúc | Tra cứu · Đọc | `GET /architect-assistant/projects` | — | Khả dụng |
| `architect.project.optimize-prompt` | Tối ưu yêu cầu thiết kế bằng AI | Tạo · Ghi | `POST /architect-assistant/projects/:projectId/optimize-prompt` | Có | Khả dụng |
| `architect.project.update` | Cập nhật thông tin dự án kiến trúc | Sửa · Ghi | `PATCH /architect-assistant/projects/:projectId` | Có | Khả dụng |

### architect assistant — `architect-assistant:architect-assistant`

| Action ID | Tên thao tác | Loại | API / route | Xác nhận bắt buộc trong catalog | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `api.delete.b122644286c00552` | Xóa architect trợ lý dự án tài sản | Xóa · Ghi | `DELETE /architect-assistant/projects/:projectId/assets/:assetId` | Có | Khả dụng |

## Đối chiếu nguồn

- Commit nền: `de4665a1df5bb5800c4d3636261181aac43d5d51`. Tài liệu phản ánh working tree, bao gồm các sửa chưa commit.
- File JSON đi kèm chứa quyền, vai trò, trường bắt buộc, adapter, scope phụ và SHA-256 nguồn; không chứa thông tin xác thực hoặc dữ liệu nghiệp vụ.
- Công cụ xuất nội bộ: `tmp/export-assistant-action-reference.mjs`.
