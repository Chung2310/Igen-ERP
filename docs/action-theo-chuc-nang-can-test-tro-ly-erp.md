# Action theo các chức năng chính cần kiểm thử trợ lý ERP

Cập nhật: 23/11/2026. Giữ đúng 20 module, 127 đầu mục và thứ tự trong [danh sách chức năng cần test](./ke-hoach-kiem-thu-uu-tien-theo-luong-tro-ly-erp.md). Mỗi dòng bên dưới gắn thao tác đã chọn với action tương ứng; không lấy toàn bộ action của nhóm.

Action đang tắt và thao tác chưa có action được ghi riêng. Có action chưa đồng nghĩa đã test đạt. Mã `api.*` là mã thật trong catalog; tên thao tác được đặt cạnh mã để tra cứu.

Tạm bỏ qua Gym/3S và Trợ lý kiến trúc. Chưa chạy thêm test nghiệp vụ, gọi AI hoặc ghi dữ liệu.

## 1. Nhân sự

<a id="hr-1"></a>
### Hồ sơ nhân sự

Tìm, xem, thêm, sửa, xóa hồ sơ; thống kê nhân sự.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm/xem | `employee.list`<br>`employee.detail` |
| Thêm | `employee.create` |
| Sửa | `employee.update` |
| Xóa | `employee.delete` |
| Thống kê số nhân sự | `employee.count` |

<a id="hr-2"></a>
### Phòng ban

Tạo/sửa phòng ban; xem nhân sự thuộc phòng.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo phòng ban | `department.create` |
| Sửa phòng ban | `department.update` |
| Xem nhân sự thuộc phòng | `department.employees.list` |

<a id="hr-3"></a>
### Chi nhánh

Tra cứu, tạo và cập nhật chi nhánh.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra cứu | `branch.list` |
| Tạo | `branch.create` |
| Cập nhật | `branch.update` |

<a id="hr-4"></a>
### Hợp đồng

Lập, sửa, gia hạn và theo dõi hợp đồng nhân sự.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập hợp đồng | `hr.contract.create` |
| Sửa hợp đồng | `api.patch.7d7b8c0cbce4fe1c` — Cập nhật hợp đồng nhân sự |
| Gia hạn | `hr.contract.extend` |
| Theo dõi hợp đồng | `hr.contract.list`<br>`hr.contract.expiring.list` |

<a id="hr-5"></a>
### Chấm công và lịch làm việc

Tra/sửa chấm công; quản lý ca và lịch làm việc.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra chấm công | `timekeeping.records.list` |
| Sửa chấm công | `timekeeping.record.update` |
| Tra/tạo/sửa/xóa ca | `api.get.d632a938b9c72492` — Tra cứu ca làm việc<br>`api.post.4e68581113f1ef79` — Tạo ca làm việc<br>`api.patch.08411917f1ed9b75` — Cập nhật ca làm việc<br>`api.delete.39330ed93a819149` — Xóa ca làm việc |
| Tra và phân ca | `api.get.efd26957a4dbe889` — Tra cứu phân ca nhân viên<br>`api.post.5511b45cf3a736d1` — Phân ca cho nhân viên |
| Tra/thêm/sửa lịch làm việc | `timekeeping.work-calendar.list`<br>`timekeeping.work-calendar.create`<br>`timekeeping.work-calendar.update` |

<a id="hr-6"></a>
### Nghỉ phép

Tạo/tra đơn, xử lý đơn theo quyền; xem phép năm và người nghỉ hôm nay.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra đơn | `hr.leave.applications.list` |
| Tạo và xử lý/duyệt đơn | **Chưa có action tương ứng**<br>Chưa có action ghi tương ứng trong catalog đang đối chiếu. |
| Xem phép năm | `leave.balance.me`<br>`leave.balances.list` |
| Người nghỉ hôm nay | `timekeeping.records.leave`<br>`hr.leave.applications.list`<br>Nguồn chấm công và nguồn đơn nghỉ là hai nguồn khác nhau, cần đối chiếu trạng thái/ngày. |

<a id="hr-7"></a>
### Lương

Tạo kỳ lương; kiểm tra đầu vào, tính lương, điều chỉnh và xử lý kỳ lương.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo kỳ/lượt lương nháp | `payroll.run.create` |
| Kiểm tra/cập nhật đầu vào | `api.get.79f4d36088c00b86` — Tra cứu dữ liệu đầu vào kỳ lương<br>`payroll.period.input.update` |
| Khóa công và tính lương | `payroll.run.lock-attendance`<br>`payroll.run.calculate` |
| Tra kết quả lương | `payroll.run.list`<br>`payroll.run.line.detail` |
| Điều chỉnh và tính lại | `payroll.adjustment.list`<br>`payroll.adjustment.create`<br>`payroll.adjustment.approve`<br>`payroll.adjustment.reject`<br>`payroll.run.recalculate` |
| Gửi duyệt/chốt kỳ | `payroll.run.review`<br>`payroll.run.close` |

<a id="hr-8"></a>
### Tuyển dụng

Quản lý nhu cầu tuyển, hồ sơ ứng viên và trạng thái tuyển dụng.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Nhu cầu/vị trí tuyển | `recruitment.job.list`<br>`recruitment.job.detail`<br>`recruitment.job.create`<br>`recruitment.job.update`<br>`recruitment.job.status` |
| Hồ sơ ứng viên | `recruitment.applicant.list`<br>`recruitment.applicant.detail`<br>`recruitment.applicant.create`<br>`recruitment.applicant.update` |
| Trạng thái/bước tuyển dụng | `recruitment.pipeline.get`<br>`recruitment.applicant.transition` |

<a id="hr-9"></a>
### Dự án nội bộ

Tạo, xem, sửa, xóa dự án Nhân sự; phân biệt với dự án Lao động.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo | `project.create` |
| Xem | `project.list` |
| Sửa | `project.update` |
| Xóa | `project.delete` |

<a id="hr-10"></a>
### Công việc

Tạo việc, giao người phụ trách, sửa hạn/trạng thái và xem tiến độ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo việc | `task.create` |
| Giao người, sửa hạn và trạng thái | `task.update` |
| Xem tiến độ | `task.list` |

<a id="hr-11"></a>
### Đào tạo nội bộ

Quản lý khóa đào tạo và theo dõi tiến độ học của nhân sự.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra/tạo/sửa/xóa khóa đào tạo | `training.list`<br>`training.create`<br>`training.update`<br>`training.delete` |
| Tiến độ học của nhân sự | `hr.training.progress` |

<a id="hr-12"></a>
### Phân quyền

Xem vai trò/quyền; cập nhật quyền theo vai trò.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem vai trò và quyền | `access.permission-catalog.list`<br>`access.role-permissions.list`<br>`access.role-permissions.detail` |
| Cập nhật quyền theo vai trò | `access.role-permissions.save` |

## 2. Quản lý học viên

<a id="student-1"></a>
### Hồ sơ học viên

Tìm, xem, thêm, sửa và xóa học viên.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm/xem | `student.list`<br>`student.detail` |
| Thêm | `student.create` |
| Sửa | `student.update` |
| Xóa một học viên | `student.bulk.delete.preview`<br>`student.bulk.delete`<br>Action xóa nhận danh sách ID, chọn đúng một học viên và xem ảnh hưởng trước xóa; không mở phạm vi xóa hàng loạt. |

<a id="student-2"></a>
### Khóa học

Tạo, xem và chỉnh sửa thông tin khóa học.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo | `course.create` |
| Xem | `course.list`<br>`course.detail` |
| Chỉnh sửa | `course.update` |

<a id="student-3"></a>
### Lớp và ghi danh

Tạo/sửa lớp; thêm hoặc loại học viên khỏi lớp.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo lớp | `student.batch.create` |
| Sửa lớp | `student.batch.update` |
| Thêm học viên | `student.batch.learner.add` |
| Loại học viên | `student.batch.learner.remove` |

<a id="student-4"></a>
### Lịch học

Tra lịch theo lớp, khóa học và thời gian.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra lịch theo lớp/khóa/thời gian | `student.schedule.list` |
| Xem thông tin giờ/ngày của lớp | `student.batch.detail` |

<a id="student-5"></a>
### Điểm danh

Ghi nhận/sửa điểm danh; tổng hợp có mặt, vắng và đi muộn.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Chọn học viên và ghi nhận/sửa điểm danh | `batch.attendance.learners`<br>`batch.attendance.record.update` |
| Tổng hợp có mặt/vắng/đi muộn | `student.batch.attendance.summary` |

<a id="student-6"></a>
### Học phí và công nợ

Ghi nhận thu; xem lịch sử đóng; đối chiếu học viên còn nợ và số tiền nợ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Ghi nhận thu | `student.payment.create` |
| Lịch sử đóng | `student.payment.list` |
| Đối chiếu số tiền của học viên | `student.payment.reconcile` |
| Danh sách học viên còn nợ và dư nợ | `student.list`<br>`student.payment.list`<br>Phép đối chiếu server students-with-tuition-debt, không phải action riêng. |

<a id="student-7"></a>
### Bài tập và chất lượng

Giao bài, xem bài nộp, chấm điểm và tra đánh giá/tiến độ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Giao bài | `student.assignment.create` |
| Xem bài nộp | `student.assignment.submissions.list` |
| Chấm điểm | `student.assignment.grade` |
| Tra đánh giá/tiến độ | `student.quality.list`<br>`student.learning-history` |

<a id="student-8"></a>
### Kỳ thi

Tạo kỳ thi; chọn học viên; xem/cập nhật kết quả.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo kỳ thi | `student.exam.create` |
| Chọn và gán học viên | `student.exam.eligible-students.list`<br>`student.exam.assign` |
| Xem kết quả | `student.exam.grade-roster.list` |
| Cập nhật kết quả | `student.exam.grade-results.update` |

<a id="student-9"></a>
### Lộ trình học

Xem và cập nhật các bước trong lộ trình học viên.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem các bước học | `student.learning-roadmap.list`<br>`student.learning-roadmap.steps.list` |
| Cập nhật lộ trình | `student.learning-roadmap.update` |

<a id="student-10"></a>
### Phòng học và thiết bị

Tra tài nguyên và lịch sử dụng phục vụ lớp học.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra phòng/thiết bị | `student.resource.list`<br>`student.resource.detail` |
| Tra lịch sử dụng | `student.resource.bookings.list` |

## 3. Quản lý lao động

<a id="worker-1"></a>
### Hồ sơ lao động

Tìm, xem, thêm, sửa và xóa hồ sơ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm/xem | `worker.list` |
| Thêm | `worker.create` |
| Sửa | `worker.update` |
| Xóa | `worker.delete` |

<a id="worker-2"></a>
### Dự án lao động

Tạo, xem, sửa, xóa dự án; cập nhật địa điểm và ngày làm.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo | `worker.project.create` |
| Xem | `worker.project.list`<br>`worker.project.detail` |
| Sửa địa điểm/ngày làm và thông tin dự án | `worker.project.update` |
| Xóa | `worker.project.delete` |

<a id="worker-3"></a>
### Phân bổ lao động

Thêm hoặc loại lao động khỏi đúng dự án.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Thêm lao động | `worker.project.worker.add`<br>`worker.project.workers.add` |
| Loại lao động | `worker.project.worker.remove` |

<a id="worker-4"></a>
### Chấm công

Tra, ghi nhận và điều chỉnh công theo lao động/dự án.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra công | `worker.attendance.list` |
| Ghi nhận | `worker.attendance.mark` |
| Điều chỉnh | `worker.attendance.update` |

<a id="worker-5"></a>
### Hợp đồng

Lập/sửa hợp đồng; tra người chưa có hợp đồng và hợp đồng sắp hết hạn.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập hợp đồng | `worker.labor.contract.create` |
| Sửa hợp đồng | `worker.labor.contract.update` |
| Lao động chưa có hợp đồng | `worker.list`<br>`worker.labor.contract.list`<br>Phép đối chiếu server workers-without-contracts, không phải action riêng. |
| Hợp đồng sắp hết hạn | `api.get.975d2e3032a3229a` — Tổng hợp hợp đồng sắp hết hạn |

<a id="worker-6"></a>
### Báo cáo

Tổng hợp công, đi muộn, vắng mặt và thiếu người theo dự án/thời gian.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tổng hợp công/đi muộn/vắng/thiếu người | `worker.report`<br>Lọc theo dự án và thời gian yêu cầu. |

## 4. Đối tác lao động

<a id="labor-partner-1"></a>
### Hồ sơ đối tác

Tìm, tạo, sửa và xóa đối tác lao động.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm | `worker.partner.list` |
| Tạo | `api.post.51cd07ea5eae455b` — Tạo cộng tác viên lao động |
| Sửa | `api.patch.4309612e371b6aa2` — Cập nhật đối tác cung ứng lao động |
| Xóa | `api.delete.047cfef00a296a0d` — Xóa lao động quản lý đối tác |

<a id="labor-partner-2"></a>
### Lượt giới thiệu

Thêm, xác nhận, kết thúc và tra lao động được giới thiệu.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Thêm lượt giới thiệu | `api.post.15425a2f24638e8c` — Thực hiện lao động quản lý đối tác giới thiệu |
| Xác nhận | `worker.partner.referral.confirm` |
| Kết thúc | `api.post.816c2559aba41930` — Thực hiện lao động quản lý đối tác giới thiệu kết thúc |
| Tra lao động giới thiệu | `worker.partner.referrals.list` |

<a id="labor-partner-3"></a>
### KPI

Thiết lập chỉ tiêu; tra đối tác đạt/chưa đạt và xếp hạng giới thiệu.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Đặt chỉ tiêu | `worker.partner.kpi.set` |
| Đạt/chưa đạt và xếp hạng | `api.get.f7d7b097f3b2fca2` — Phân tích KPI và số lao động giới thiệu của đối tác |

<a id="labor-partner-4"></a>
### Chính sách hoa hồng

Tạo, sửa mốc/mức hưởng, kích hoạt hoặc ngừng chính sách.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo | `api.post.e57ae0da3cdf14f8` — Tạo chính sách hoa hồng đối tác lao động |
| Sửa mốc/mức hưởng | `api.patch.2971d5a8a97f8be8` — Cập nhật chính sách hoa hồng đối tác lao động |
| Kích hoạt | `api.post.a58fa4b9dd69941c` — Kích hoạt chính sách hoa hồng đối tác lao động |
| Ngừng | `api.post.6346fd99746602d2` — Ngừng áp dụng chính sách hoa hồng đối tác lao động |

<a id="labor-partner-5"></a>
### Đối soát

Tính, kiểm tra, điều chỉnh và duyệt kỳ hoa hồng.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tính kỳ hoa hồng | `worker.partner.settlement.calculate` |
| Kiểm tra kỳ | `worker.partner.settlements.list`<br>`worker.partner.settlement.detail` |
| Điều chỉnh | `api.post.0137e041d2b60a80` — Thực hiện lao động quản lý đối tác đối soát điều chỉnh |
| Duyệt | `api.post.db51d33ae72d81b2` — Phê duyệt lao động quản lý đối tác đối soát |

<a id="labor-partner-6"></a>
### Chi trả

Ghi nhận/đảo khoản chi và tra lịch sử chi trả.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Ghi nhận chi | `api.post.92a650eadaee6bcd` — Thực hiện lao động quản lý đối tác đối soát chi trả |
| Đảo khoản chi | `worker.partner.payout.reverse` |
| Tra lịch sử chi trả | `api.get.8e68db2c21d01a51` — Xem tổng quan một đối tác lao động<br>Đọc mảng payouts của đối tác, không thay bằng số tổng hoa hồng. |

## 5. Đối tác tuyển sinh

<a id="student-partner-1"></a>
### Hồ sơ đối tác

Tìm, tạo, sửa và xóa đối tác tuyển sinh.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm | `partner.list` |
| Tạo | `api.post.682981444c12f0aa` — Tạo cộng tác viên giới thiệu học viên |
| Sửa | `api.patch.fee44cbce47ae377` — Cập nhật thông tin liên hệ đối tác |
| Xóa | `api.delete.9043f4e5cc3aefab` — Xóa đối tác giới thiệu |

<a id="student-partner-2"></a>
### Kết quả giới thiệu

Tra hiệu quả giới thiệu học viên của đối tác.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra hiệu quả giới thiệu | `partner.analysis` |

<a id="student-partner-3"></a>
### Hoa hồng

Xem/cập nhật cấp bậc và cấu hình tính hoa hồng.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem cấp bậc/cấu hình | `partner.commission.levels.list` |
| Cập nhật cấu hình cấp bậc | `api.patch.c3613ac62ed49013` — Cập nhật cấu hình hoa hồng |
| Cấu hình hoa hồng theo đối tác | `partner.commission.update` **[Đang tắt]**<br>Action đang tắt, không tính là đã hỗ trợ. |

<a id="student-partner-4"></a>
### Chi trả

Cập nhật tài khoản nhận tiền; kiểm tra khả năng ghi nhận chi trả hiện có.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Cập nhật tài khoản nhận tiền | `partner.bank-details.update` |
| Ghi nhận chi trả | `api.post.5e1017ef3a76d4f1` — Ghi nhận chi trả hoa hồng đối tác |

## 6. Khách hàng

<a id="customer-1"></a>
### Hồ sơ

Tìm, tạo, sửa thông tin và thay đổi trạng thái khách hàng.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm | `api.get.51885b828100e376` — Tìm khách hàng |
| Tạo | `customer.create` |
| Sửa | `customer.update` |
| Đổi trạng thái | `customer.activate`<br>`customer.deactivate` |

<a id="customer-2"></a>
### Giao dịch

Xem lịch sử và chi tiết giao dịch đúng khách.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem lịch sử | `customer.transactions` |
| Xem chi tiết giao dịch | `customer.transaction.detail` |

<a id="customer-3"></a>
### Phân hạng

Xem và cập nhật cấu hình phân hạng.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem cấu hình phân hạng | `customer.settings.get` |
| Cập nhật | `customer.settings.update` |

<a id="customer-4"></a>
### Thông tin hóa đơn

Tra hoặc tạo hồ sơ xuất hóa đơn của khách.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra hồ sơ hóa đơn | `customer.billing.profile.list` |
| Tạo hồ sơ hóa đơn | `customer.billing.profile.create` |

## 7. Kho & Sản phẩm

<a id="inventory-1"></a>
### Sản phẩm và SKU

Tìm, tạo, sửa sản phẩm/biến thể; kiểm tra giá bán và giá vốn.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm/xem sản phẩm và SKU | `product.list`<br>`inventory.product.detail` |
| Tạo sản phẩm kèm SKU | `inventory.product.create.sellable` |
| Thêm SKU | `inventory.variant.create.sellable` |
| Sửa sản phẩm | `api.patch.ec4179bd45d62cbf` — Cập nhật thông tin sản phẩm |
| Sửa SKU | `api.patch.78eb0c3b82d1f735` — Cập nhật thông tin SKU |
| Kiểm tra giá bán/giá vốn | `inventory.prices.list` |

<a id="inventory-2"></a>
### Danh mục

Quản lý loại hàng, thương hiệu, đơn vị và thuộc tính.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra loại hàng/thương hiệu/đơn vị/thuộc tính | `inventory.catalog.resource.list` |
| Tạo dữ liệu danh mục | `api.post.c29d50d7a2ebd989` — Tạo thể loại / thư mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm |
| Sửa | `api.patch.ad1b26d154f5621c` — Cập nhật dữ liệu dùng chung cho sản phẩm |
| Xóa | `api.delete.9301905784a3a33e` — Xóa dữ liệu danh mục sản phẩm |

<a id="inventory-3"></a>
### Nhà cung cấp

Tra cứu, cập nhật và xóa nhà cung cấp.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra | `inventory.supplier.list` |
| Cập nhật | `api.patch.d638d3bb0a56b64b` — Cập nhật nhà cung cấp |
| Xóa | `inventory.supplier.delete` |

<a id="inventory-4"></a>
### Kho và tồn

Tra kho, tồn thực tế theo kho/SKU và vị trí hàng; tồn theo kho còn thiếu action tương đương.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra kho | `inventory.warehouse.locations.list` |
| Tồn thực tế theo kho/SKU | **Chưa có action tương ứng**<br>Chưa có action tương đương GET /inventory/warehouses/balances. |
| Vị trí hàng theo IMEI/serial | `inventory.serial.list`<br>`inventory.serial.detail`<br>Không dùng kết quả này thay tồn số lượng theo kho/SKU. |

<a id="inventory-5"></a>
### Nhập kho

Lập/sửa phiếu; gửi, nhận, xác nhận hoặc hủy nhập.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập phiếu | `inventory.receipt.create` |
| Sửa | `inventory.receipt.update` |
| Gửi | `inventory.receipt.submit` |
| Bắt đầu nhận | `inventory.receipt.start` |
| Xác nhận nhập | `inventory.receipt.confirm` |
| Hủy | `inventory.receipt.cancel` |

<a id="inventory-6"></a>
### Xuất kho

Tra lịch sử và đảo phiếu đã có; tạo/sửa/xóa phiếu thủ công còn thiếu action tương đương.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra lịch sử | `inventory.stock-log.list` |
| Đảo phiếu đã có | `inventory.stock-log.reverse` |
| Tạo/sửa/xóa phiếu thủ công | **Chưa có action tương ứng**<br>Chưa có action tương đương POST/PATCH/DELETE /crud/stock-logs. |

<a id="inventory-7"></a>
### Điều chuyển

Tạo, tra, nhận và hủy điều chuyển giữa kho/chi nhánh.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo điều chuyển | `inventory.transfer.create` |
| Tra | `inventory.transfer.list`<br>`inventory.transfer.detail` |
| Nhận | `inventory.transfer.accept` |
| Hủy | `inventory.transfer.cancel` |

<a id="inventory-8"></a>
### Kiểm kê

Mở đợt, ghi nhận, duyệt và đối soát chênh lệch.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Mở đợt kiểm kê | `api.post.feaf71a366c8880e` — Tạo phiếu kiểm kê kho<br>`api.post.f03e901c8ee14a8f` — Bắt đầu kiểm kê kho |
| Ghi nhận số kiểm kê | `api.post.5e0381daf5057103` — Quét mã vào phiếu kiểm kê<br>`inventory.count.item.update` |
| Duyệt | `inventory.count.approve` |
| Đối soát chênh lệch | `inventory.count.detail`<br>`inventory.reconciliation.run` |

<a id="inventory-9"></a>
### IMEI/serial

Đăng ký, tìm, xem lịch sử và cập nhật trạng thái/vị trí thiết bị.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Đăng ký | `inventory.serial.create` |
| Tìm/xem | `inventory.serial.list`<br>`inventory.serial.detail` |
| Lịch sử | `inventory.serial.history` |
| Cập nhật trạng thái | `inventory.serial.transition` |
| Cập nhật vị trí trong kho/chi nhánh | `inventory.serial.transfer.local`<br>`inventory.serial.transfer.request`<br>`inventory.serial.transfer.accept`<br>Việc cập nhật vị trí đi qua điều chuyển, không phải sửa tên kho trực tiếp. |

## 8. Bán lẻ & POS

<a id="retail-1"></a>
### Tra hàng

Tìm sản phẩm, SKU/serial và hàng có thể đưa vào đơn.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm sản phẩm/SKU bán được | `retail.order.products.list` |
| Tìm serial để bán | `api.get.cc59ef5991d28f6a` — Tìm thiết bị theo số sê-ri để bán |

<a id="retail-2"></a>
### Đơn hàng

Tạo nháp, tính tiền, sửa, xác nhận và hủy đơn.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo nháp | `retail.order.draft.create` |
| Tính tiền | `retail.order.quote` |
| Sửa | `retail.order.draft.update` |
| Xác nhận | `retail.order.confirm` |
| Hủy | `retail.order.cancel` |

<a id="retail-3"></a>
### Thanh toán

Checkout, thu thêm và kiểm tra chuyển khoản.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Checkout | `retail.order.checkout` |
| Thu thêm | `retail.order.collect` |
| Kiểm tra chuyển khoản | `retail.payment-review.pending`<br>`retail.payment-review.review` |

<a id="retail-4"></a>
### Ca thu ngân

Mở/đóng ca và xem thông tin ca.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Mở ca | `api.post.b0d4095fce422005` — Mở ca thu ngân POS |
| Đóng ca | `api.post.12e203d82e400c19` — Đóng ca thu ngân POS |
| Xem thông tin ca | `retail.shift.current`<br>`retail.shift.list`<br>`api.get.fc665b5fde526b87` — Xem chi tiết ca thu ngân |

<a id="retail-5"></a>
### Hóa đơn

Tra danh sách, chi tiết và tổng hợp hóa đơn.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Danh sách | `retail.invoice.list` |
| Chi tiết | `retail.invoice.detail` |
| Tổng hợp | `retail.invoice.summary` |

<a id="retail-6"></a>
### Đổi trả và thu mua

Lập và tra chứng từ sau bán hàng.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập chứng từ đổi trả/thu mua | `retail.after-sale.create` |
| Tra chứng từ | `retail.after-sale.list`<br>`retail.after-sale.detail` |

<a id="retail-7"></a>
### Công nợ

Tra nợ khách, đối soát và nhắc nợ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra nợ khách | `retail.receivable.customer.history` |
| Đối soát | `retail.receivable.reconciliation.run`<br>`retail.receivable.reconciliation.latest` |
| Nhắc nợ | `retail.debt-reminders.run` |

<a id="retail-8"></a>
### Ưu đãi và tích điểm

Quản lý mã ưu đãi và chính sách điểm thưởng.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra/tạo mã ưu đãi | `retail.coupon.assistant-options.list`<br>`retail.coupon.create` |
| Xem/sửa chính sách điểm thưởng | `retail.points.policy.get`<br>`retail.points.policy.update` |

<a id="retail-9"></a>
### Bảo hành

Tra theo khách/thiết bị và cập nhật thời hạn.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra theo khách | `retail.warranty.lookup.phone` |
| Tra theo mã thiết bị | `api.get.33957f831ebdde02` — Tra cứu bảo hành theo mã thiết bị |
| Cập nhật thời hạn | `retail.warranty.serial.update` |

<a id="retail-10"></a>
### Sổ quỹ

Tra sổ, lập thu/chi, đối soát và chốt kỳ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra sổ | `retail.finance.cashbook.list` |
| Lập thu/chi | `retail.finance.cashbook.voucher.create` |
| Đối soát | `retail.finance.cashbook.reconcile` |
| Chốt kỳ | `retail.finance.cashbook.close` |

<a id="retail-11"></a>
### Báo cáo

Tra doanh số, lợi nhuận và hoa hồng theo kỳ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Doanh số | `retail.report.summary` |
| Lợi nhuận | `api.get.070d48d67bb5ed90` — Xem lợi nhuận bán lẻ |
| Hoa hồng | `api.get.203a9f8e9a785680` — Xem hoa hồng bán lẻ của tôi<br>`api.get.78da159ec226e07e` — Phân tích hoa hồng đối tác bán lẻ |

## 9. Đối tác bán lẻ

<a id="retail-partner-1"></a>
### Hồ sơ đối tác

Tạo và sửa hồ sơ đại lý/cộng tác viên.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo đại lý/cộng tác viên | `retail.partner.create.dealer`<br>`retail.partner.create.collaborator` |
| Sửa hồ sơ | `retail.partner.update` |

<a id="retail-partner-2"></a>
### Hoa hồng

Xem/sửa chính sách chung và mức riêng theo sản phẩm.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem chính sách chung | `retail.partner.commission.policy.list` |
| Sửa chính sách chung | `api.patch.2776df6160261ce4` — Cập nhật cấu hình hoa hồng bán lẻ |
| Xem mức riêng theo sản phẩm | `api.get.d9daa6226ed98e83` — Tra cứu mức hoa hồng theo sản phẩm |
| Sửa mức theo sản phẩm | `retail.partner.product.commissions.update` |

<a id="retail-partner-3"></a>
### Đối soát và chi trả

Quản lý chứng từ hoa hồng và khoản chi.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem bảng kê | `api.get.7c1d9c9cda4722a9` — Xem bảng kê hoa hồng cộng tác viên bán lẻ |
| Đối soát | `api.post.9102a0fae468bcab` — Đối soát hoa hồng cộng tác viên |
| Chi trả | `api.post.3c5a416752fe6656` — Chi trả hoa hồng cộng tác viên |

<a id="retail-partner-4"></a>
### Tài khoản cộng tác viên

Tra tài khoản và hồ sơ liên quan.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra tài khoản | `retail.partner.user.list` |
| Tra hồ sơ cộng tác viên | `api.get.09ba89f080717c4a` — Xem danh sách cộng tác viên bán lẻ<br>`api.get.9ca47ce89d0dd0f0` — Xem hồ sơ cộng tác viên bán lẻ của tôi |

## 10. Sửa chữa & bảo hành

<a id="repair-1"></a>
### Phiếu sửa

Tiếp nhận, tìm, xem và hủy phiếu.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tiếp nhận phiếu | `api.post.79291125e27b1d36` — Tạo phiếu sửa chữa dịch vụ |
| Tìm | `repair.list` |
| Xem | `api.get.a647fdd78184d877` — Xem chi tiết phiếu sửa chữa |
| Hủy | `api.post.5a64bf0894869ec7` — Hủy phiếu sửa chữa |

<a id="repair-2"></a>
### Phân công

Giao kỹ thuật viên cho đúng phiếu.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Giao kỹ thuật viên | `api.post.8ed57322c93cc536` — Phân công kỹ thuật viên sửa chữa |

<a id="repair-3"></a>
### Báo giá

Lập và duyệt báo giá sửa chữa.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập báo giá | `api.post.dd4d2216f9ecc537` — Báo giá phiếu sửa chữa |
| Duyệt | `api.post.1ee164077121787a` — Duyệt báo giá sửa chữa |

<a id="repair-4"></a>
### Linh kiện

Tra, xuất và hoàn linh kiện của phiếu.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra linh kiện của phiếu | `repair.parts.list` |
| Xuất | `api.post.aed04d8555cb4291` — Xuất linh kiện cho phiếu sửa chữa |
| Hoàn | `api.post.2b44c18916b1a882` — Hoàn linh kiện sửa chữa |

<a id="repair-5"></a>
### Tiến trình và bàn giao

Cập nhật trạng thái; ghi nhận giao thiết bị.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Cập nhật trạng thái | `api.post.951d43982cb708bc` — Cập nhật trạng thái phiếu sửa chữa |
| Giao thiết bị | `api.post.572b64fca460dafc` — Giao thiết bị sửa chữa |

<a id="repair-6"></a>
### Thanh toán

Ghi nhận tiền thu, đối chiếu và hoàn tiền.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Ghi nhận thu | `api.post.ad54adfbaa37674b` — Ghi nhận thanh toán sửa chữa |
| Đối chiếu tiền thu | `api.get.8cb8202ecb5a1164` — Đối chiếu tiền đã thu trên phiếu sửa chữa |
| Chọn khoản hoàn hợp lệ | `repair.refund.summary`<br>`repair.refund.vouchers` |
| Hoàn tiền | `repair.refund.create` |

<a id="repair-7"></a>
### Lịch sử và báo cáo

Tra theo khách/thiết bị; xem doanh thu và hiệu suất kỹ thuật viên.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lịch sử theo khách/thiết bị | `api.get.7517d0cca9ca76c9` — Tra cứu lịch sử sửa chữa theo khách hoặc thiết bị |
| Doanh thu | `api.get.3938bd395acae1c5` — Xem doanh thu sửa chữa |
| Hiệu suất kỹ thuật viên | `api.get.68886fa48772aa78` — Xem hiệu suất kỹ thuật viên sửa chữa |

## 11. Tài chính

<a id="finance-1"></a>
### Thu/chi và chuyển quỹ

Lập, duyệt hoặc đảo chứng từ theo quyền.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập phiếu thu/chi | `finance.voucher.create` |
| Lập chuyển quỹ | `finance.treasury.vouchers.create` |
| Duyệt/từ chối | `finance.treasury.vouchers.decision` |
| Đảo chứng từ | `api.post.5213d6b07cbffd29` — Thực hiện tài chính quản lý phiếu thu chi đảo giao dịch |

<a id="finance-2"></a>
### Quỹ và ngân hàng

Tra/tạo tài khoản quỹ; xem sổ và kỳ tài chính.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra tài khoản quỹ/ngân hàng | `finance.treasury.accounts.list` |
| Tạo tài khoản | `api.post.e7edb97470c1d234` — Tạo quỹ tiền mặt hoặc tài khoản ngân hàng |
| Xem sổ quỹ | `finance.treasury.vouchers.list` |
| Xem kỳ tài chính | `finance.treasury.periods.list` |

<a id="finance-3"></a>
### Phải thu

Tra tuổi nợ; thu tiền, điều chỉnh và gia hạn nợ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra tuổi nợ | `finance.receivable.aging` |
| Thu tiền | `api.post.ed7ac98d2498702f` — Thu tiền khoản phải thu |
| Điều chỉnh | `api.post.5d88cf81f1042ab2` — Điều chỉnh khoản phải thu |
| Gia hạn | `finance.receivable.extend` |

<a id="finance-4"></a>
### Phải trả

Tra công nợ, ghi nhận khoản phải trả và thanh toán.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra công nợ | `finance.debt.list`<br>`finance.management.debts.list` |
| Ghi khoản phải trả | `api.post.c7f205ec27eeab37` — Tạo tài chính quản lý khoản phải trả |
| Thanh toán | `api.post.fd3f5b4a8cf47782` — Ghi nhận thanh toán công nợ |

<a id="finance-5"></a>
### Đối soát

Nhập giao dịch, ghép chứng từ và ghi nhận đối soát.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Nhập giao dịch | `finance.treasury.bank-lines.create` |
| Ghép chứng từ | `finance.treasury.bank-lines.match` |
| Ghi nhận đối soát | `finance.treasury.reconciliation.create` |

<a id="finance-6"></a>
### Chi phí

Ghi nhận và tra chi phí tài chính.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Ghi nhận chi phí | `api.post.ac04b554927d4696` — Ghi nhận chi phí |
| Tra chi phí | `api.get.614b2375b202f4b6` — Xem báo cáo chi phí<br>Nguồn báo cáo chi phí, không tự coi là API chi tiết từng chứng từ. |

<a id="finance-7"></a>
### VAT và hóa đơn thuế

Ghi nhận VAT từ hóa đơn/thủ công; tra số dư kỳ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Ghi VAT từ hóa đơn | `finance.tax.from-invoice` |
| Ghi VAT thủ công | `finance.tax.create` |
| Tra số dư kỳ | `finance.vat.list`<br>Nguồn API có totals/settings theo kỳ; cần kiểm tra trình bày số dư, không suy từ danh sách hóa đơn rỗng. |

<a id="finance-8"></a>
### Báo cáo

Tra doanh thu, chi phí, lãi lỗ và lợi nhuận.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Doanh thu | `api.get.03a093fc9349a692` — Xem báo cáo doanh thu |
| Chi phí | `api.get.614b2375b202f4b6` — Xem báo cáo chi phí |
| Lãi lỗ | `api.get.4621ea131565f025` — Xem báo cáo lãi lỗ |
| Lợi nhuận | `api.get.d8e2ed96478d8a3e` — Xem báo cáo lợi nhuận tài chính |

## 12. Báo giá

<a id="quotation-1"></a>
### Bảng giá

Quản lý sản phẩm, giá và tệp bảng giá.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra/thêm/sửa/xóa sản phẩm và giá | `quotation.catalog.list`<br>`quotation.catalog.create`<br>`quotation.catalog.update`<br>`quotation.catalog.delete` |
| Tra tệp bảng giá | `quotation.price-list.list` |

<a id="quotation-2"></a>
### Báo giá khách hàng

Lập, tra và sửa báo giá.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập báo giá | `quotation.customer-quote.create` |
| Tra | `quotation.quote.list`<br>`quotation.quote.detail` |
| Sửa | `quotation.quote.update` |

<a id="quotation-3"></a>
### Dự toán

Lập phương án theo yêu cầu/ngân sách.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập theo yêu cầu | `quotation.request.create`<br>`quotation.request.analyze`<br>`quotation.estimate.create` |
| Lập theo ngân sách | `quotation.budget.create` |

<a id="quotation-4"></a>
### Phê duyệt

Duyệt đúng phiên bản báo giá/dự toán.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Duyệt báo giá/dự toán | `quotation.quote.approve` |

<a id="quotation-5"></a>
### Hợp đồng

Lập từ dự toán đã duyệt; theo dõi trạng thái hợp đồng.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập từ dự toán đã duyệt | `quotation.contract.create` |
| Theo dõi trạng thái | `quotation.contract.list`<br>`quotation.contract.detail` |

<a id="quotation-6"></a>
### Nghiệm thu

Lập, sửa và hoàn tất biên bản.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập biên bản | `quotation.acceptance.create` |
| Sửa | `quotation.acceptance.update` |
| Hoàn tất | `quotation.acceptance.complete` |

<a id="quotation-7"></a>
### Xuất tài liệu

Xuất và tải báo giá, hợp đồng, nghiệm thu.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xuất báo giá | `quotation.quote.export` |
| Xuất hợp đồng | `quotation.contract.export` |
| Xuất nghiệm thu | `quotation.acceptance.export` |
| Theo dõi/tải file | `quotation.export.latest`<br>`quotation.file.download` |

## 13. Quản lý tài nguyên

<a id="resource-1"></a>
### Tra cứu

Tìm tài liệu nội bộ và tài nguyên Drive có quyền.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm tài liệu nội bộ | `resource.list` |
| Tìm tài nguyên Drive | `resource.google-drive.list`<br>`api.get.8d100f7d89820c43` — Tìm tệp trong Google Drive dùng chung |

<a id="resource-2"></a>
### Tạo tài nguyên

Tạo thư mục hoặc thêm liên kết tệp.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo thư mục | `api.post.4fac47294c399fc8` — Tạo thư mục tài nguyên |
| Thêm liên kết tệp | `api.post.f16467714880abd7` — Thêm liên kết tệp vào kho tài nguyên |

<a id="resource-3"></a>
### Sắp xếp

Đổi tên và di chuyển tệp/thư mục.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Đổi tên | `resource.google-drive.rename`<br>`api.patch.120dc3a54509fc0c` — Cập nhật tài nguyên đổi tên |
| Di chuyển | `resource.google-drive.move`<br>`api.patch.1cfa9b644fbe938f` — Cập nhật tài nguyên di chuyển |

<a id="resource-4"></a>
### Xóa/khôi phục

Xóa, xem thùng rác và khôi phục.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xóa | `api.delete.771468fb212b7e25` — Xóa tài nguyên<br>`api.delete.53bdaed9e11523ef` — Xóa tài nguyên Google Drive tệp |
| Xem thùng rác | `resource.trash.list` |
| Khôi phục | `resource.restore` |

<a id="resource-5"></a>
### Quyền truy cập

Xem vị trí và quyền chia sẻ hiện có.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem vị trí | `api.get.5a8c34f32c006c0b` — Xem đường dẫn thư mục của tài nguyên |
| Xem quyền chia sẻ | `api.get.70715572be0f86f6` — Xem quyền chia sẻ của tài nguyên |

## 14. Trò chuyện

<a id="chat-1"></a>
### Phòng chat

Tìm/tạo phòng; ghim hoặc rời nhóm.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm phòng | `chat.rooms.list` |
| Tạo phòng | `api.post.0ca30bd0f44e4447` — Tạo phòng trò chuyện |
| Ghim/bỏ ghim | `api.post.383280e18fd7151d` — Ghim hoặc bỏ ghim phòng trò chuyện |
| Rời nhóm | `api.delete.2cad6a5af287c9ed` — Rời phòng trò chuyện |

<a id="chat-2"></a>
### Tin nhắn

Xem lịch sử, gửi và xóa tin nhắn theo quyền.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem lịch sử | `chat.room.messages.list` |
| Gửi | `api.post.34721e0ad003aba8` — Gửi tin nhắn trò chuyện phòng trò chuyện |
| Xóa | `api.delete.405c62abccc22d73` — Xóa tin nhắn trong phòng chat |

<a id="chat-3"></a>
### Thành viên

Tra thành viên, đổi vai trò, chuyển trưởng nhóm và loại thành viên.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra thành viên | `chat.room.members.list` |
| Đổi vai trò | `chat.room.member.role.update` |
| Chuyển trưởng nhóm | `chat.room.transfer-admin` |
| Loại thành viên | `chat.room.member.remove` |

<a id="chat-4"></a>
### Thông báo

Tra, đánh dấu đã đọc, gửi hoặc xóa thông báo.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra thông báo | `notification.list` |
| Đánh dấu đã đọc | `notification.mark-read`<br>`notification.mark-all-read` |
| Gửi | `api.post.7cae6bbc334b2879` — Gửi thông báo |
| Xóa | `notification.delete` |

## 15. Hộp thư đa kênh

<a id="omni-inbox-1"></a>
### Hội thoại

Tìm và đọc tin nhắn Facebook, TikTok, Zalo.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm/đọc hội thoại Facebook | `omni-inbox.facebook-conversations.list` |
| Tìm/đọc hội thoại TikTok | `omni-inbox.tiktok-conversations.list` |
| Tìm/đọc hội thoại Zalo | `omni-inbox.zalo-conversations.list` |

<a id="omni-inbox-2"></a>
### Trả lời khách

Gửi phản hồi đúng kênh và cập nhật trạng thái đọc.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Trả lời Facebook/TikTok/Zalo | `omni-inbox.facebook-conversation.reply`<br>`omni-inbox.tiktok-conversation.reply`<br>`omni-inbox.zalo-conversation.reply` |
| Đánh dấu đọc theo kênh | `omni-inbox.facebook-conversation.mark-read`<br>`omni-inbox.tiktok-conversation.mark-read`<br>`omni-inbox.zalo-conversation.mark-read` |

<a id="omni-inbox-3"></a>
### Khách tiềm năng

Tạo, tìm và cập nhật lead.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo lead | `omni-inbox.leads.create` |
| Tìm lead | `omni-inbox.leads.list` |
| Cập nhật | `omni-inbox.leads.update` |

<a id="omni-inbox-4"></a>
### Liên kết hồ sơ

Chuyển/liên kết lead đúng loại học viên, lao động hoặc bệnh nhân.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Liên kết học viên | `omni-inbox.leads.link-student` |
| Liên kết lao động | `omni-inbox.leads.link-worker` |
| Liên kết bệnh nhân | `omni-inbox.leads.link-patient` |

<a id="omni-inbox-5"></a>
### AI trả lời

Xem/sửa cấu hình; bật lại AI và tra log.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem cấu hình AI | **Chưa có action tương ứng**<br>Chưa thấy action đọc cấu hình AI riêng trong catalog; không dùng danh sách tài khoản thay bằng chứng đọc cấu hình. |
| Sửa cấu hình | `omni-inbox.account.ai-config.update` |
| Bật lại AI theo kênh | `omni-inbox.facebook-conversation.resume-ai`<br>`omni-inbox.tiktok-conversation.resume-ai`<br>`omni-inbox.zalo-conversation.resume-ai` |
| Tra log | `omni-inbox.ai-reply-logs.list` |

<a id="omni-inbox-6"></a>
### Kênh nhắn tin

Tra tài khoản/kênh liên quan hội thoại.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra tài khoản/kênh | `omni-inbox.account.list` |

## 16. Marketing tự động

<a id="marketing-1"></a>
### Chiến dịch email

Tạo nháp, tra, bật/tắt và xóa chiến dịch.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo nháp | `marketing.holiday-campaign.create-draft` |
| Tra chiến dịch | `marketing.holiday-campaign.list` |
| Bật/tắt | `marketing.holiday-campaign.enabled.update` |
| Xóa | `marketing.holiday-campaign.delete` |

<a id="marketing-2"></a>
### Cấu hình gửi

Xem và cập nhật cài đặt gửi.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem cấu hình | `api.get.ddf0c072158be296` — Xem trạng thái cấu hình marketing |
| Cập nhật | `marketing.settings.update` |

<a id="marketing-3"></a>
### Kết quả gửi

Tra lượt chạy và trạng thái gửi nội dung.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra lượt chạy | `api.get.790586d43d8979d7` — Tra cứu các lượt chạy marketing |
| Trạng thái gửi | `api.get.34a8d9d0814701f9` — Tra cứu kết quả gửi nội dung marketing |

## 17. Chiến dịch nội dung

<a id="social-marketing-1"></a>
### Chiến dịch

Lập ý tưởng/kế hoạch; tra và đổi trạng thái.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Lập ý tưởng | `marketing.ai.campaign-ideas` |
| Lập kế hoạch | `marketing.ai.scheduled-campaign` |
| Tra chiến dịch | `marketing.campaign.list` |
| Đổi trạng thái | `marketing.campaign.lifecycle` |

<a id="social-marketing-2"></a>
### Nội dung

Tạo/sửa bản nháp và quản lý yêu cầu sản xuất.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo nháp | `marketing.content.draft.create` |
| Sửa nháp | `marketing.content.draft.update` |
| Quản lý yêu cầu sản xuất | `marketing.campaign.asset-orders.list`<br>`marketing.campaign.asset-order.create`<br>`marketing.campaign.asset-order.update`<br>`marketing.campaign.asset-order.archive` |

<a id="social-marketing-3"></a>
### Bảng nội dung

Quản lý cột/dòng và cập nhật nội dung.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra cột/dòng | `marketing.campaign.sheet.columns.list`<br>`marketing.campaign.sheet.slots.list` |
| Thêm/sửa/lưu trữ cột | `api.post.9fe634492244a76b` — Thêm cột vào bảng dữ liệu chiến dịch<br>`api.patch.568b7733e09d2fd4` — Cập nhật cột trong bảng nội dung chiến dịch<br>`api.delete.821abe66f21dcede` — Lưu trữ cột trong bảng nội dung chiến dịch |
| Thêm/sửa dòng | `api.post.44271d4a548fc225` — Thêm dòng vào bảng dữ liệu chiến dịch<br>`api.patch.4da13a2c42665d10` — Cập nhật dòng trong bảng nội dung chiến dịch |
| Cập nhật nội dung ô | `marketing.campaign.sheet.cells.update` |

<a id="social-marketing-4"></a>
### Phê duyệt

Duyệt hoặc từ chối nội dung.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Duyệt nội dung | `marketing.campaign.slot.approve` |
| Từ chối | `marketing.campaign.slot.reject` |

<a id="social-marketing-5"></a>
### Lên lịch và đăng bài

Đăng/đặt lịch đúng tài khoản và kênh.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Đăng ngay | `marketing.campaign.slot.publish-now` |
| Đặt lịch | `marketing.scheduler.schedule-post` |

<a id="social-marketing-6"></a>
### Kết nối kênh

Tra tài khoản và kết nối mạng xã hội.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra tài khoản | `marketing.account.list` |
| Kiểm tra kết nối kênh | `marketing.author.integration-status` |

<a id="social-marketing-7"></a>
### Thống kê

Xem kết quả hoạt động chiến dịch.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Kết quả chiến dịch | `marketing.campaign.analytics.summary` |

## 18. Kho tri thức

<a id="company-knowledge-1"></a>
### Tài liệu

Tra và xóa tài liệu trong kho doanh nghiệp.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra tài liệu | `company-knowledge.documents.list` |
| Xóa tài liệu | `company-knowledge.documents.delete` |

<a id="company-knowledge-2"></a>
### Phạm vi sử dụng

Cập nhật phạm vi tài liệu theo kênh/tài khoản.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Cập nhật phạm vi theo kênh/tài khoản | `company-knowledge.documents.scopes.update` |

<a id="company-knowledge-3"></a>
### Truy xuất

Tìm nội dung liên quan và mô phỏng câu trả lời dùng tri thức.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm nội dung liên quan | `company-knowledge.test-search` |
| Mô phỏng câu trả lời | `company-knowledge.page-chat.simulate` |

<a id="company-knowledge-4"></a>
### FAQ

Xem đề xuất, duyệt hoặc từ chối FAQ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem đề xuất | `company-knowledge.faq-candidates.list` |
| Duyệt | `company-knowledge.faq-candidate.approve` |
| Từ chối | `company-knowledge.faq-candidate.reject` |

<a id="company-knowledge-5"></a>
### Chất lượng dữ liệu

Xem trạng thái và mâu thuẫn của kho tri thức.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem trạng thái | `company-knowledge.health` |
| Xem mâu thuẫn | `company-knowledge.conflicts.list` |

## 19. Văn bản pháp luật

<a id="legal-reference-1"></a>
### Tra cứu

Tìm theo danh mục và nội dung văn bản.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tìm theo danh mục | `legal.document.list` |
| Tìm theo nội dung | `legal.document.search` |

<a id="legal-reference-2"></a>
### Hỏi đáp

Trả lời dựa trên văn bản và phạm vi đã chọn.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Hỏi đáp từ văn bản | `legal.document.answer` |

<a id="legal-reference-3"></a>
### Đồng bộ

Xem trạng thái kho và khởi động đồng bộ theo quyền.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Xem trạng thái kho | `legal.repository.status` |
| Đồng bộ | `legal.repository.sync` |

<a id="legal-reference-4"></a>
### Rà soát

Tra mục chờ, sửa và duyệt/từ chối văn bản.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra mục chờ | `legal.review.list` |
| Sửa nội dung | `legal.review.content.update` |
| Duyệt/từ chối | `legal.review.decision` |

## 20. Quản lý y tế

<a id="healthcare-1"></a>
### Bệnh nhân

Tạo, tìm, sửa và xóa hồ sơ; xem ảnh hưởng trước xóa.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo bệnh nhân | `healthcare.patient.create` |
| Tìm/xem | `healthcare.patient.list`<br>`healthcare.patient.detail` |
| Sửa | `healthcare.patient.update` |
| Xem ảnh hưởng và xóa một hồ sơ | `healthcare.patient.bulk-delete-preview`<br>`healthcare.patient.bulk-delete`<br>Chọn đúng một bệnh nhân; không mở phạm vi thành xóa hàng loạt. |

<a id="healthcare-2"></a>
### Lịch hẹn

Tạo, tìm và cập nhật lịch khám.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo lịch | `healthcare.appointment.create` |
| Tìm | `healthcare.appointment.list` |
| Cập nhật | `healthcare.appointment.update` |

<a id="healthcare-3"></a>
### Lượt khám

Ghi nhận, tra và cập nhật lượt khám.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Ghi nhận lượt khám | `healthcare.visit.create` |
| Tra | `healthcare.visit.list` |
| Cập nhật | `healthcare.visit.update` |

<a id="healthcare-4"></a>
### Chăm sóc

Tạo, tra và cập nhật việc chăm sóc bệnh nhân.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tạo việc chăm sóc | `healthcare.care.create` |
| Tra | `healthcare.care.list` |
| Cập nhật | `healthcare.care.update` |

<a id="healthcare-5"></a>
### Danh mục

Quản lý bác sĩ, phòng khám và dịch vụ.

| Thao tác cần test | Action tương ứng |
| --- | --- |
| Tra bác sĩ/phòng khám/dịch vụ | `healthcare.catalog.list` |
| Tạo danh mục | `healthcare.catalog.create` |
| Cập nhật/ngừng sử dụng | `healthcare.catalog.update` |
