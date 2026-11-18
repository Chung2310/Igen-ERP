import type { AssistantOperation } from "./catalog";
import { SUPPLEMENTAL_GUIDES } from "./manual-guide-supplement";
export type ManualProcedure = {
  id: string; method: string; path: RegExp; steps: string[];
  evidence: Array<{ file: string; contains: string }>;
};
const procedure = (id: string, method: string, path: RegExp, file: string, controls: string[], steps: string[]): ManualProcedure =>
  ({ id, method, path, steps, evidence: controls.map(contains => ({ file, contains })) });
const student = "src/modules/student-management/";
const worker = "src/modules/worker-management/";
const hr = "src/components/hr/";
const inventory = "src/components/inventory/";
const healthcare = "src/modules/healthcare/HealthcarePage.tsx";
export const MANUAL_PROCEDURES: ManualProcedure[] = [
  procedure("student-create", "POST", /^\/students$/, student + "components/Student/AddStudentModal.tsx", ["Lưu hồ sơ"], [
    "Trong Học viên, chọn Thêm để mở hồ sơ mới. Kiểm tra tên, số điện thoại hoặc mã để tránh tạo trùng.",
    "Điền hồ sơ và các trường bắt buộc đang hiển thị; cấu hình trường có thể khác nhau theo doanh nghiệp. Chọn Lưu hồ sơ, rồi tìm lại học viên trong danh sách.",
  ]),
  procedure("student-update", "PATCH", /^\/students\/:id$/, student + "pages/Students/StudentsPage.tsx", ["Sửa thông tin"], [
    "Tìm đúng học viên, chọn Sửa thông tin trên dòng hồ sơ.", "Chỉ sửa các thông tin cần đổi; kiểm tra lại dữ liệu mới nhất rồi lưu hồ sơ. Mở lại hồ sơ để đối chiếu.",
  ]),
  procedure("student-import", "POST", /^\/students\/bulk(?:-preview)?$/, student + "pages/Students/StudentsPage.tsx", ["Nhập Excel"], [
    "Chọn Nhập Excel tại danh sách Học viên; chuẩn bị tệp theo mẫu của chức năng nhập.", "Kiểm tra từng dòng trong phần xem trước, sửa các dòng báo lỗi và kiểm tra hồ sơ trùng. Chỉ xác nhận nhập khi danh sách đúng; sau đó đối chiếu số hồ sơ thành công và thất bại.",
  ]),
  procedure("student-bulk-delete", "POST", /^\/students\/bulk-delete(?:-preview)?$/, student + "pages/Students/StudentsPage.tsx", ["Kiểm tra trước khi xóa", "Xóa hàng loạt"], [
    "Đánh dấu đúng các hồ sơ trong danh sách Học viên rồi chọn Xóa hàng loạt.", "Chọn Kiểm tra trước khi xóa; đọc ảnh hưởng đến dữ liệu liên quan. Nếu chỉ muốn xem trước thì dừng tại đây; chỉ xác nhận xóa khi thực sự muốn xóa toàn bộ hồ sơ đã chọn.",
  ]),
  procedure("payment-create", "POST", /^\/payments$/, student + "pages/Fees/FeesPage.tsx", ["Thu học phí", "Nhật ký & Sửa học phí"], [
    "Trong Học phí, tìm đúng học viên và kiểm tra Nhật ký & Sửa học phí để tránh ghi trùng.",
    "Chọn Thu học phí; nhập Số tiền đóng, Ngày đóng và Phương thức. Kiểm tra khoản còn nợ rồi chọn Xác nhận.",
    "Mở lại nhật ký, đối chiếu số tiền, ngày thu và dư nợ của đúng học viên.",
  ]),
  procedure("payment-edit", "PATCH|DELETE", /^\/payments\/:id$/, student + "pages/Fees/FeesPage.tsx", ["Nhật ký & Sửa học phí"], [
    "Mở Nhật ký & Sửa học phí; xác định đúng giao dịch theo học viên, ngày thu và số tiền.",
    "Chọn thao tác sửa hoặc xóa tương ứng trên giao dịch, đọc nội dung xác nhận và kiểm tra lại dư nợ sau khi lưu. Không tạo khoản thu mới để thay thế việc sửa khoản đã thu.",
  ]),
  procedure("exam-create", "POST", /^\/exams$/, student + "components/Exams/AddExamModal.tsx", ["Tạo đợt thi"], [
    "Trong Lịch thi, chọn Tạo đợt thi. Điền thông tin đợt thi và lịch thi, kiểm tra lớp hoặc khóa học áp dụng.", "Chọn Tạo đợt thi trong biểu mẫu; tìm lại đợt thi theo tên và ngày thi.",
  ]),
  procedure("exam-edit", "PATCH", /^\/exams\/:id$/, student + "components/Exams/ExamCard.tsx", ["Sửa đợt thi"], [
    "Tìm đúng thẻ đợt thi, chọn Sửa đợt thi, cập nhật thông tin cần đổi và lưu. Kiểm tra lại lịch thi và danh sách học viên liên quan.",
  ]),
  procedure("exam-assign", "POST", /^\/exams\/:id\/assign$/, student + "components/Exams/AssignStudentModal.tsx", ["Xác nhận thêm"], [
    "Mở đợt thi và phần thêm học viên; chọn đúng các học viên đủ điều kiện.", "Kiểm tra danh sách được chọn rồi chọn Xác nhận thêm; mở lại danh sách thí sinh của đợt thi để kiểm tra.",
  ]),
  procedure("exam-unassign", "POST", /^\/exams\/:id\/unassign$/, student + "components/Exams/ExamCard.tsx", ["Xóa khỏi đợt thi"], [
    "Mở đợt thi, tìm đúng thí sinh và chọn Xóa khỏi đợt thi. Kiểm tra ảnh hưởng đến lịch sử thi trong phần xác nhận trước khi đồng ý.",
  ]),
  procedure("employee-create", "POST", /^\/auth\/register-user$/, hr + "OrgChartTab.tsx", ["Thêm nhân sự", "Lưu nhân sự"], [
    "Chọn Thêm nhân sự trong Sơ đồ tổ chức. Điền thông tin nhân sự và kiểm tra phòng ban, cấp quản lý.", "Chọn Lưu nhân sự; tìm lại nhân sự vừa tạo trong sơ đồ hoặc danh sách.",
  ]),
  procedure("employee-update", "PATCH", /^\/auth\/users\/:id$/, hr + "OrgChartTab.tsx", ["Lưu thay đổi"], [
    "Mở hồ sơ đúng nhân sự trong Sơ đồ tổ chức, vào phần chỉnh sửa thông tin.", "Cập nhật các trường cần đổi và chọn Lưu thay đổi; kiểm tra lại hồ sơ, chức danh và phòng ban.",
  ]),
  procedure("employee-delete", "DELETE", /^\/auth\/users\/:id$/, hr + "OrgChartTab.tsx", ["Xóa khỏi hệ thống", "Xóa nhân sự"], [
    "Mở đúng nhân sự, chọn Xóa khỏi hệ thống và đọc hộp xác nhận Xóa nhân sự. Kiểm tra cấp dưới và ảnh hưởng trước khi đồng ý; không dùng xóa tài khoản để hủy chức danh.",
  ]),
  procedure("department-create", "POST", /^\/hr\/departments$/, hr + "HrDepartmentManager.tsx", ["Thêm phòng ban"], [
    "Trong Phòng ban, chọn Thêm phòng ban. Nhập thông tin phòng ban và kiểm tra quan hệ quản lý nếu có; lưu rồi kiểm tra phòng ban mới trong danh sách.",
  ]),
  procedure("department-update", "PATCH|PUT", /^\/hr\/departments\/:id$/, hr + "HrDepartmentManager.tsx", ["Sửa phòng ban", "Lưu thay đổi"], [
    "Chọn Sửa phòng ban tại đúng phòng ban, cập nhật thông tin rồi chọn Lưu thay đổi. Đối chiếu lại tên và quan hệ phòng ban.",
  ]),
  procedure("department-delete", "DELETE", /^\/hr\/departments\/:id$/, hr + "HrDepartmentManager.tsx", ["Xóa phòng ban"], [
    "Chọn Xóa phòng ban tại đúng bản ghi; kiểm tra nhân sự và phòng ban con liên quan trong thông báo trước khi xác nhận.",
  ]),
  procedure("training-create", "POST", /^\/crud\/training-courses$/, hr + "TrainingTab.tsx", ["Tạo khóa học", "Thêm bài giảng"], [
    "Trong Đào tạo, chọn Tạo khóa học. Nhập thông tin khóa học, thêm bài giảng và câu trắc nghiệm cần thiết.", "Kiểm tra đối tượng học và nội dung, lưu khóa học rồi mở lại để kiểm tra bài giảng.",
  ]),
  procedure("training-update", "PATCH", /^\/crud\/training-courses\/:id$/, hr + "TrainingTab.tsx", ["Sửa khóa học", "Cập nhật khóa học"], [
    "Chọn Sửa khóa học ở khóa cần đổi, cập nhật thông tin hoặc bài giảng. Chọn Cập nhật khóa học rồi kiểm tra lại nội dung đã lưu.",
  ]),
  procedure("workflow-create", "POST", /^\/crud\/workflows$/, hr + "WorkflowTab.tsx", ["Tạo quy trình mới", "Lưu quy trình", "Thêm giai đoạn"], [
    "Trong Quy trình, chọn Tạo quy trình mới; nhập thông tin và thêm các giai đoạn theo đúng thứ tự.", "Kiểm tra sơ đồ, nội dung và phân loại rồi chọn Lưu quy trình. Mở lại quy trình để đối chiếu các giai đoạn.",
  ]),
  procedure("workflow-update", "PATCH", /^\/crud\/workflows\/:id$/, hr + "WorkflowTab.tsx", ["Sửa quy trình", "Lưu quy trình"], [
    "Mở đúng quy trình, chọn Sửa quy trình. Chỉnh thông tin hoặc các giai đoạn, kiểm tra nhánh con rồi chọn Lưu quy trình.",
  ]),
  procedure("recruitment-job-create", "POST", /^\/recruitment\/jobs$/, hr + "recruitment/RecruitmentJobsView.tsx", ["Tạo tin", "Lưu"], [
    "Mở Tuyển dụng, phần tin tuyển dụng, chọn Tạo tin. Điền vị trí, số lượng và các thông tin tuyển dụng; chọn Lưu rồi kiểm tra tin mới.",
  ]),
  procedure("recruitment-job-update", "PATCH", /^\/recruitment\/jobs\/:id$/, hr + "recruitment/RecruitmentJobsView.tsx", ["Cập nhật tin tuyển dụng", "Lưu"], [
    "Mở đúng tin tuyển dụng để cập nhật, chỉnh thông tin cần thay đổi rồi chọn Lưu. Kiểm tra trạng thái và số lượng tuyển của tin.",
  ]),
  procedure("recruitment-applicant-create", "POST", /^\/recruitment\/applicants$/, hr + "recruitment/RecruitmentApplicantsView.tsx", ["Thêm ứng viên"], [
    "Mở phần ứng viên trong Tuyển dụng, chọn Thêm ứng viên. Điền hồ sơ và chọn đúng tin tuyển dụng, kiểm tra trùng thông tin liên hệ trước khi lưu.",
  ]),
  procedure("recruitment-applicant-update", "PATCH", /^\/recruitment\/applicants\/:id$/, hr + "recruitment/RecruitmentApplicantsView.tsx", ["Sửa ứng viên", "Lưu thay đổi"], [
    "Tìm ứng viên theo tên hoặc thông tin liên hệ, chọn Sửa ứng viên. Cập nhật hồ sơ hoặc trạng thái, chọn Lưu thay đổi và đối chiếu lại.",
  ]),
  procedure("recruitment-interview", "POST|PATCH", /^\/recruitment\/interviews(?:\/:id)?$/, hr + "recruitment/RecruitmentInterviewsWorkspace.tsx", ["Tạo lịch", "Lưu thay đổi"], [
    "Mở lịch phỏng vấn trong Tuyển dụng. Chọn ứng viên, thời gian và người phỏng vấn; nếu sửa thì mở đúng lịch đã có.", "Kiểm tra lịch trùng trước khi chọn Tạo lịch hoặc Lưu thay đổi, rồi đối chiếu lại lịch của ứng viên.",
  ]),
  procedure("worker-project-create", "POST", /^\/worker-management\/projects$/, worker + "pages/WorkerProjectsPage.tsx", ["Thêm dự án", "Tạo dự án"], [
    "Trong Dự án, chọn Thêm dự án; điền thông tin dự án, địa điểm và thời gian. Chọn Tạo dự án và tìm lại dự án vừa tạo.",
  ]),
  procedure("worker-project-update", "PATCH", /^\/worker-management\/projects\/:id$/, worker + "pages/WorkerProjectsPage.tsx", ["Cập nhật dự án"], [
    "Mở phần chỉnh sửa của đúng dự án lao động. Thay đổi thông tin cần thiết, chọn Cập nhật dự án rồi kiểm tra lại danh sách.",
  ]),
  procedure("worker-project-members", "POST", /^\/worker-management\/projects\/:id\/workers(?:\/bulk)?$/, worker + "pages/WorkerProjectsPage.tsx", ["Thêm lao động", "Thêm đã chọn"], [
    "Mở đúng dự án, chọn Thêm lao động. Tìm và đánh dấu các lao động cần gán; kiểm tra danh sách đã có để tránh gán trùng.", "Chọn Thêm đã chọn rồi kiểm tra danh sách lao động của dự án.",
  ]),
  procedure("worker-create", "POST", /^\/worker-management\/workers$/, worker + "pages/WorkersPage.tsx", ["Thêm"], [
    "Trong Lao động, chọn Thêm. Điền hồ sơ lao động và các trường bắt buộc của doanh nghiệp; kiểm tra thông tin liên hệ và giấy tờ trước khi lưu.", "Tìm lại lao động vừa tạo và kiểm tra dự án hoặc đối tác giới thiệu nếu đã chọn.",
  ]),
  procedure("worker-update", "PATCH", /^\/worker-management\/workers\/:id$/, worker + "pages/WorkersPage.tsx", ["Sửa thông tin"], [
    "Tìm đúng lao động, chọn Sửa thông tin. Cập nhật các trường cần đổi rồi lưu; mở lại hồ sơ để kiểm tra.",
  ]),
  procedure("worker-import", "POST", /^\/worker-management\/workers\/bulk$/, worker + "pages/WorkersPage.tsx", ["Nhập Excel"], [
    "Chọn Nhập Excel tại Lao động, dùng mẫu nhập của màn hình. Kiểm tra dữ liệu và các dòng lỗi trước khi xác nhận nhập; đối chiếu số lượng hồ sơ đã tạo sau khi hoàn tất.",
  ]),
  procedure("count-create", "POST", /^\/inventory\/counts$/, inventory + "InventoryCountingSection.tsx", ["+ Tạo phiếu kiểm kê"], [
    "Trong Kho hàng, mở kiểm kê của đúng kho. Chọn + Tạo phiếu kiểm kê; kiểm tra phạm vi kho và danh sách hàng của phiếu mới.",
  ]),
  procedure("count-submit", "POST", /^\/inventory\/counts\/:id\/submit$/, inventory + "InventoryCountingSection.tsx", ["Gửi chờ duyệt cân bằng"], [
    "Mở đúng phiếu kiểm kê, hoàn tất số lượng đếm hoặc quét mã. Kiểm tra các mã ngoài danh sách và chênh lệch.", "Chọn Gửi chờ duyệt cân bằng, kiểm tra phiếu chuyển sang trạng thái chờ duyệt.",
  ]),
  procedure("count-approve", "POST", /^\/inventory\/counts\/:id\/approve$/, inventory + "InventoryCountingSection.tsx", ["Duyệt và cân bằng"], [
    "Mở phiếu kiểm kê đang chờ duyệt, rà chênh lệch và xử lý các mã quét bất thường. Người duyệt cần có quyền cân bằng tồn.", "Đọc xác nhận, nhập lý do theo biểu mẫu rồi chọn Duyệt và cân bằng. Kiểm tra trạng thái phiếu và tồn thực tế sau duyệt.",
  ]),
  procedure("count-recreate", "POST", /^\/inventory\/counts\/:id\/recreate$/, inventory + "InventoryCountingSection.tsx", ["Tạo lại phiếu kiểm kê"], [
    "Mở phiếu kiểm kê bị xung đột và chọn Tạo lại phiếu kiểm kê. Đối chiếu liên kết phiếu cũ và phiếu thay thế; thực hiện đếm trên phiếu mới theo tồn hiện tại.",
  ]),
  procedure("transfer-create", "POST", /^\/inventory\/transfers$/, inventory + "InventoryTransferSection.tsx", ["Tạo phiếu điều chuyển", "Xuất chuyển kho"], [
    "Chọn Tạo phiếu điều chuyển, xác định kho gửi và kho nhận. Thêm SKU, số lượng và serial nếu hàng quản lý theo serial.", "Kiểm tra đủ tồn kho gửi rồi chọn Xuất chuyển kho. Theo dõi trạng thái đang vận chuyển; bên nhận tiếp nhận đúng phiếu khi hàng đến.",
  ]),
  procedure("transfer-cancel", "POST", /^\/inventory\/transfers\/:id\/cancel$/, inventory + "InventoryTransferSection.tsx", ["Hủy chuyển", "Xác nhận hủy"], [
    "Tìm đúng phiếu đang điều chuyển, chọn Hủy chuyển. Nhập lý do, kiểm tra số lượng hoàn về kho gửi rồi chọn Xác nhận hủy; đối chiếu tồn và trạng thái phiếu.",
  ]),
  procedure("customer-create", "POST", /^\/customers(?:\/quick)?$/, "src/modules/customer-management/components/CustomerFormDialog.tsx", ["Thêm khách hàng", "Lưu khách hàng"], [
    "Trong Khách hàng, chọn Thêm khách hàng. Tìm trước theo số điện thoại hoặc thông tin định danh để tránh trùng.", "Điền hồ sơ, chọn Lưu khách hàng rồi mở lại khách hàng đã tạo.",
  ]),
  procedure("customer-update", "PATCH", /^\/customers\/:id$/, "src/modules/customer-management/components/CustomerFormDialog.tsx", ["Sửa hồ sơ khách hàng", "Lưu khách hàng"], [
    "Mở đúng khách hàng và chọn sửa hồ sơ. Đổi các thông tin cần thiết, chọn Lưu khách hàng rồi kiểm tra lại hồ sơ.",
  ]),
  procedure("coupon-create", "POST", /^\/retail\/coupons$/, "src/modules/retail/pages/RetailCouponsPage.tsx", ["Tạo mã ưu đãi", "Lưu mã"], [
    "Trong Ưu đãi và điểm, chọn Tạo mã ưu đãi. Điền mã, mức giảm, thời hạn và điều kiện áp dụng; kiểm tra người nhận nếu là mã cá nhân.", "Chọn Lưu mã; đối chiếu mã, trạng thái và thời hạn trong danh sách.",
  ]),
  procedure("asset-create", "POST", /^\/finance\/assets$/, "src/modules/finance/pages/FixedAssetsPage.tsx", ["Thêm tài sản", "Lưu tài sản"], [
    "Trong Tài sản, chọn Thêm tài sản. Điền thông tin tài sản, nguyên giá, ngày sử dụng và thông tin khấu hao theo biểu mẫu.", "Chọn Lưu tài sản, tìm lại tài sản và kiểm tra nguyên giá cùng chi nhánh quản lý.",
  ]),
  procedure("asset-update", "PATCH", /^\/finance\/assets\/:id$/, "src/modules/finance/pages/FixedAssetsPage.tsx", ["Sửa", "Lưu thay đổi"], [
    "Chọn Sửa trên đúng tài sản, chỉnh thông tin cần thiết rồi chọn Lưu thay đổi. Kiểm tra lại giá trị và lịch sử tài sản.",
  ]),
  procedure("asset-transfer", "POST", /^\/finance\/assets\/:id\/transfer$/, "src/modules/finance/pages/FixedAssetsPage.tsx", ["Xác nhận điều chuyển"], [
    "Mở điều chuyển của đúng tài sản, chọn chi nhánh nhận và thời điểm điều chuyển. Kiểm tra nơi đi/nơi đến rồi chọn Xác nhận điều chuyển; đối chiếu đơn vị đang quản lý tài sản.",
  ]),
  ...[
    ["patient", "patients", "Thêm bệnh nhân", "Sửa hồ sơ bệnh nhân"],
    ["appointment", "appointments", "Đặt lịch hẹn", "Sửa lịch hẹn"],
    ["care", "care", "Tạo việc chăm sóc", "Cập nhật công việc"],
    ["catalog", "catalog", "Thêm danh mục", "Sửa danh mục"],
  ].flatMap(([id, route, create, edit]) => [
    procedure(`healthcare-${id}-create`, "POST", new RegExp(`^/healthcare/${route}$`), healthcare, [create], [
      `Chọn ${create} tại màn hình tương ứng. Điền thông tin theo biểu mẫu và đối chiếu đúng bệnh nhân hoặc danh mục đang xử lý.`, "Kiểm tra thông tin, chọn Lưu rồi tìm lại bản ghi trong danh sách.",
    ]),
    procedure(`healthcare-${id}-update`, "PATCH", new RegExp(`^/healthcare/${route}/:id$`), healthcare, [edit], [
      `Mở đúng bản ghi, chọn ${edit}. Chỉ cập nhật thông tin cần thay đổi và lưu; kiểm tra lại bản ghi sau khi hoàn tất.`,
    ]),
  ]),
  procedure("architect-create", "POST", /^\/architect-assistant\/projects$/, "src/modules/architect-assistant/ArchitectureAssistantPage.tsx", ["Tạo dự án"], [
    "Chọn Tạo dự án trong Trợ lý kiến trúc, nhập thông tin dự án rồi xác nhận tạo. Mở lại dự án trước khi thêm bản vẽ hoặc tạo hình ảnh.",
  ]),
  procedure("architect-update", "PATCH", /^\/architect-assistant\/projects\/:projectId$/, "src/modules/architect-assistant/ArchitectureAssistantPage.tsx", ["Lưu thông tin"], [
    "Mở đúng dự án kiến trúc, chỉnh thông tin dự án rồi chọn Lưu thông tin. Kiểm tra lại dự án và tài sản đang gắn với dự án.",
  ]),
  procedure("architect-delete", "DELETE", /^\/architect-assistant\/projects\/:projectId$/, "src/modules/architect-assistant/ArchitectureAssistantPage.tsx", ["Xóa dự án kiến trúc?", "Xóa dự án"], [
    "Chọn Xóa tại đúng dự án; đọc hộp Xóa dự án kiến trúc? và kiểm tra tài sản liên quan trước khi xác nhận Xóa dự án.",
  ]),
  procedure("architect-plan", "POST", /^\/architect-assistant\/projects\/:projectId\/generate-plan$/, "src/modules/architect-assistant/ArchitectureAssistantPage.tsx", ["Tạo mặt bằng bằng AI", "Lưu mặt bằng"], [
    "Mở dự án, kiểm tra yêu cầu và thông số mặt bằng trước khi chọn Tạo mặt bằng bằng AI. Chức năng này sử dụng hạn mức AI của tài khoản.",
    "Chờ kết quả trong dự án, kiểm tra bản vẽ rồi chọn Lưu mặt bằng; nếu mất kết nối, mở lại dự án kiểm tra kết quả trước khi tạo lại.",
  ]),
  procedure("quotation-product-create", "POST", /^\/quotation\/catalog$/, "src/modules/quotation/CatalogProductDialog.tsx", ["Thêm sản phẩm", "Tạo sản phẩm"], [
    "Trong Bảng giá, chọn Thêm sản phẩm. Điền thông tin sản phẩm, đơn vị, giá và thuộc tính theo biểu mẫu; kiểm tra mã sản phẩm trùng.", "Chọn Tạo sản phẩm rồi tìm lại sản phẩm trong bảng giá.",
  ]),
  procedure("quotation-product-update", "PATCH", /^\/quotation\/catalog\/:id$/, "src/modules/quotation/CatalogProductDialog.tsx", ["Sửa sản phẩm", "Lưu thay đổi"], [
    "Chọn Sửa tại đúng sản phẩm trong Bảng giá, sửa giá hoặc thuộc tính cần đổi rồi chọn Lưu thay đổi. Đối chiếu lại mã, giá và đơn vị tính.",
  ]),
  procedure("quotation-import", "POST", /^\/quotation\/catalog\/import\/(preview|confirm)$/, "src/modules/quotation/PriceListPanel.tsx", ["Nhập Excel/CSV", "Xác nhận và nhập"], [
    "Chọn Nhập Excel/CSV trong Bảng giá, chọn tệp và sheet cần nhập. Chọn dòng tiêu đề và ghép các cột đúng ý nghĩa.", "Kiểm tra dữ liệu xem trước; nếu chỉ muốn kiểm tra thì dừng tại đây. Khi muốn lưu, chọn Xác nhận và nhập, sau đó kiểm tra các sản phẩm đã nhập.",
  ]),
  procedure("quotation-customer-create", "POST", /^\/quotation\/customer-quotes$/, "src/modules/quotation/CustomerQuotes.tsx", ["Tạo báo giá khách", "Tạo báo giá"], [
    "Trong Báo giá khách, chọn Tạo báo giá khách. Chọn khách hàng, thêm sản phẩm từ bảng giá, nhập số lượng và kiểm tra giá.", "Chọn Tạo báo giá, mở lại báo giá để kiểm tra tổng tiền và thông tin khách.",
  ]),
  procedure("quotation-estimate-from-customer", "POST", /^\/quotation\/quotes\/from-customer$/, "src/modules/quotation/App.tsx", ["Tạo từ báo giá khách", "Tạo dự toán"], [
    "Trong Dự toán, chọn Tạo từ báo giá khách. Chọn đúng báo giá nguồn, bổ sung thông tin cần thiết rồi chọn Tạo dự toán.", "Kiểm tra dự toán đã tạo; nếu bước tạo file bị gián đoạn, mở lại chứng từ để kiểm tra trước khi tạo thêm dự toán.",
  ]),
  procedure("quotation-quote-update", "PATCH", /^\/quotation\/quotes\/:id$/, "src/modules/quotation/App.tsx", ["Lưu thay đổi", "Lưu thông tin bổ sung"], [
    "Mở đúng dự toán hoặc báo giá, chỉnh thông tin khách hàng, số lượng hoặc phần bổ sung tương ứng với yêu cầu.", "Lưu thay đổi tại phần đang sửa; đối chiếu tổng tiền, VAT và vận chuyển trước khi tạo hoặc tải lại file.",
  ]),
  procedure("quotation-approve", "POST", /^\/quotation\/quotes\/:id\/approve$/, "src/modules/quotation/App.tsx", ["Duyệt dự toán"], [
    "Mở đúng dự toán chờ duyệt, kiểm tra sản phẩm, số lượng, giá, VAT và điều kiện vận chuyển. Chọn Duyệt dự toán và đọc xác nhận trước khi đồng ý.",
  ]),
  procedure("quotation-reject", "POST", /^\/quotation\/quotes\/:id\/reject$/, "src/modules/quotation/App.tsx", ["Gửi nhận xét trả lại"], [
    "Mở dự toán cần trả lại, điền rõ nhận xét và nội dung cần sửa. Chọn Gửi nhận xét trả lại rồi kiểm tra trạng thái dự toán.",
  ]),
  procedure("quotation-contract-create", "POST", /^\/quotation\/contracts$/, "src/modules/quotation/ContractWorkflow.tsx", ["Tạo hợp đồng từ dự toán"], [
    "Trong Hợp đồng, chọn Tạo hợp đồng từ dự toán. Chọn dự toán đã duyệt, kiểm tra thông tin hai bên, điều khoản và mẫu hợp đồng trước khi lưu.",
  ]),
  procedure("quotation-contract-update", "PATCH", /^\/quotation\/contracts\/:id$/, "src/modules/quotation/ContractWorkflow.tsx", ["Lưu nội dung hợp đồng"], [
    "Mở hợp đồng còn ở trạng thái nháp. Cập nhật nội dung được phép sửa rồi chọn Lưu nội dung hợp đồng; tạo file từ bản đã lưu nếu cần.",
  ]),
  procedure("quotation-contract-sign", "POST", /^\/quotation\/contracts\/:id\/sign$/, "src/modules/quotation/ContractWorkflow.tsx", ["Xác nhận đã ký"], [
    "Mở đúng hợp đồng và kiểm tra hợp đồng thực tế đã ký. Chọn Xác nhận đã ký, đọc hộp xác nhận rồi đồng ý; kiểm tra trạng thái trước khi lập nghiệm thu.",
  ]),
  procedure("quotation-acceptance-create", "POST", /^\/quotation\/acceptance-records$/, "src/modules/quotation/ContractWorkflow.tsx", ["Tạo nghiệm thu", "Lưu biên bản"], [
    "Mở hợp đồng đã ký, chọn Tạo nghiệm thu. Điền khối lượng và nội dung nghiệm thu theo từng dòng hợp đồng, kiểm tra phần còn lại rồi chọn Lưu biên bản.",
  ]),
  procedure("quotation-acceptance-update", "PATCH", /^\/quotation\/acceptance-records\/:id$/, "src/modules/quotation/ContractWorkflow.tsx", ["Lưu biên bản"], [
    "Mở biên bản nghiệm thu còn nháp, sửa đúng dòng khối lượng hoặc nội dung cần thay đổi. Chọn Lưu biên bản và kiểm tra lại số lượng, giá trị nghiệm thu.",
  ]),
  procedure("quotation-acceptance-complete", "POST", /^\/quotation\/acceptance-records\/:id\/complete$/, "src/modules/quotation/ContractWorkflow.tsx", ["Hoàn tất nghiệm thu"], [
    "Mở đúng biên bản, đối chiếu khối lượng đã nghiệm thu và giá trị với hợp đồng. Chọn Hoàn tất nghiệm thu, xác nhận rồi kiểm tra trạng thái chứng từ.",
  ]),
  procedure("quotation-budget-create", "POST", /^\/quotation\/budget-plans\/suggest$/, "src/modules/quotation/BudgetPlanner.tsx", ["Tạo tư vấn ngân sách mới"], [
    "Trong Ngân sách, chọn Tạo tư vấn ngân sách mới. Nhập nhu cầu, ngân sách và dữ liệu dự án, kiểm tra hạn mức AI trước khi tạo phương án.", "Sau khi có kết quả, đọc các giả định và câu hỏi còn thiếu trước khi sử dụng phương án.",
  ]),
  procedure("quotation-budget-update", "PATCH", /^\/quotation\/budget-plans\/:id$/, "src/modules/quotation/BudgetPlanner.tsx", ["Lưu câu trả lời và tính lại bằng AI", "Xác nhận giả định", "Lưu sửa đổi"], [
    "Mở đúng phương án trong Ngân sách. Với số lượng, sửa đúng dòng và lưu sửa đổi; với câu hỏi, nhập câu trả lời tại câu hỏi tương ứng; với giả định, kiểm tra rồi chọn Xác nhận giả định.", "Nếu bổ sung hạng mục, dùng Thêm sản phẩm mới và kiểm tra dòng được thêm. Chỉ dùng thao tác tính lại bằng AI khi muốn tính lại và còn hạn mức; đối chiếu tổng ngân sách sau khi lưu.",
  ]),
  procedure("repair-create", "POST", /^\/repair\/tickets$/, "src/modules/repair/GeneralRepairIntakeDialog.tsx", ["Tạo phiếu tiếp nhận"], [
    "Trong Sửa chữa & bảo hành, chọn Tạo phiếu tiếp nhận. Chọn khách hàng, thiết bị, mô tả lỗi và kiểm tra chứng từ bảo hành nếu áp dụng.", "Kiểm tra thông tin thiết bị và hình thức sửa chữa rồi tạo phiếu; mở lại phiếu theo mã vừa tạo.",
  ]),
  procedure("repair-quote", "POST", /^\/repair\/tickets\/:id\/quote$/, "src/modules/repair/RepairBoardPage.tsx", ["Lưu báo giá"], [
    "Mở đúng phiếu sửa chữa, nhập báo giá và nội dung sửa chữa. Kiểm tra chi phí rồi chọn Lưu báo giá; đối chiếu báo giá trước khi xin duyệt.",
  ]),
  procedure("repair-approve", "POST", /^\/repair\/tickets\/:id\/approve-quote$/, "src/modules/repair/RepairBoardPage.tsx", ["Duyệt báo giá"], [
    "Mở phiếu và kiểm tra báo giá đã được khách hàng đồng ý. Chọn Duyệt báo giá, xác nhận đúng phiếu rồi kiểm tra trạng thái sửa chữa.",
  ]),
  procedure("repair-cancel", "POST", /^\/repair\/tickets\/:id\/cancel$/, "src/modules/repair/RepairBoardPage.tsx", ["Hủy phiếu"], [
    "Mở đúng phiếu, kiểm tra các khoản đã thu và linh kiện đã xuất trước khi chọn Hủy phiếu. Đọc điều kiện hủy và xác nhận; kiểm tra tồn kho và khoản cần hoàn sau đó.",
  ]),
  procedure("repair-assign", "POST", /^\/repair\/tickets\/:id\/assign$/, "src/modules/repair/RepairTicketExtras.tsx", ["Lưu phân công"], [
    "Mở phiếu sửa chữa, chọn kỹ thuật viên phụ trách trong phần phân công. Chọn Lưu phân công rồi kiểm tra tên kỹ thuật viên trên phiếu.",
  ]),
  procedure("repair-parts", "POST", /^\/repair\/tickets\/:id\/parts$/, "src/modules/repair/RepairTicketExtras.tsx", ["Thêm vật tư (không trừ kho)", "Xuất vật tư từ kho"], [
    "Mở phần vật tư của phiếu. Nếu lấy hàng trong kho, chọn Xuất vật tư từ kho và kiểm tra kho, SKU, số lượng; nếu chỉ ghi nhận vật tư ngoài kho, dùng Thêm vật tư (không trừ kho).", "Lưu và đối chiếu danh sách vật tư của phiếu; không dùng vật tư ngoài kho để thay thế xuất kho thực tế.",
  ]),
  procedure("repair-part-return", "POST", /^\/repair\/tickets\/:id\/parts\/:partId\/return$/, "src/modules/repair/RepairTicketExtras.tsx", ["Hoàn"], [
    "Mở danh sách vật tư của đúng phiếu, chọn Hoàn tại dòng vật tư cần trả. Kiểm tra số lượng được phép hoàn, xác nhận rồi đối chiếu kho và dòng vật tư.",
  ]),
  procedure("repair-resend", "POST", /^\/repair\/tickets\/:id\/notifications\/resend$/, "src/modules/repair/RepairTicketExtras.tsx", ["Gửi lại tin tiếp nhận", "Gửi lại tin sửa xong"], [
    "Mở phiếu, kiểm tra thông báo đã gửi và người nhận. Chọn Gửi lại tin tiếp nhận hoặc Gửi lại tin sửa xong đúng mục đích; kiểm tra kết quả gửi trước khi bấm lại.",
  ]),
  procedure("marketing-settings", "PUT", /^\/marketing\/settings$/, "src/modules/marketing/pages/MarketingAutomationSettingsPage.tsx", ["Lưu cài đặt"], [
    "Mở Marketing → Cài đặt tự động. Chỉnh các tùy chọn nội dung và điều kiện gửi cần thay đổi, kiểm tra đối tượng áp dụng rồi chọn Lưu cài đặt.", "Mở lại cấu hình để kiểm tra. Chỉ dùng Gửi thử khi chủ động muốn gửi một thư thử đến địa chỉ đã chọn.",
  ]),
  procedure("partner-create-update", "POST|PATCH", /^\/partners(?:\/:id)?$/, student + "pages/Partners/components/AddPartnerModal.tsx", ["Thêm đối tác mới", "Cập nhật đối tác"], [
    "Trong Đối tác, mở biểu mẫu thêm mới hoặc chọn Sửa của đúng đối tác. Điền thông tin liên hệ, chuyển khoản hoặc hoa hồng đúng nội dung cần xử lý.", "Kiểm tra tên và số tài khoản trước khi lưu, mở lại chi tiết đối tác để đối chiếu.",
  ]),
  procedure("partner-payout", "POST", /^\/partners\/:id\/payouts$/, student + "pages/Partners/components/AddPayoutModal.tsx", ["Xác nhận chi trả"], [
    "Mở đúng đối tác và phần chi trả hoa hồng. Kiểm tra số dư, lịch sử đã chi và người nhận trước khi nhập số tiền.", "Chọn Xác nhận chi trả rồi kiểm tra lịch sử và số dư còn lại; không ghi lại khoản chi đã có.",
  ]),
  procedure("partner-level", "POST|PATCH", /^\/partners\/commission-levels(?:\/:id)?$/, student + "pages/Partners/components/CommissionLevelModal.tsx", ["Thêm Level mới", "Lưu cấp bậc"], [
    "Mở cấu hình cấp bậc hoa hồng. Chọn Thêm Level mới hoặc mở cấp bậc cần cập nhật, điền điều kiện và tỷ lệ hoa hồng rồi chọn Lưu cấp bậc.",
  ]),
  procedure("labor-partner-create", "POST", /^\/worker-management\/partners$/, worker + "partners/components/LaborPartnerManagementPanel.tsx", ["Tạo đối tác", "Lưu"], [
    "Trong Đối tác lao động → Đối tác, chọn Tạo đối tác. Điền thông tin liên hệ, kiểm tra trùng rồi lưu trên biểu mẫu.",
  ]),
  procedure("labor-partner-policy", "POST", /^\/worker-management\/partners\/policies$/, worker + "partners/components/LaborPartnerPoliciesPanel.tsx", ["Tạo chính sách", "Lưu chính sách"], [
    "Chọn Chính sách hoa hồng → Tạo chính sách. Điền cơ chế tính và các bậc áp dụng, kiểm tra thời điểm hiệu lực rồi chọn Lưu chính sách.", "Kiểm tra trạng thái sau khi lưu trước khi gắn chính sách cho nguồn giới thiệu.",
  ]),
  procedure("labor-partner-referral", "POST", /^\/worker-management\/partners\/:partnerId\/referrals$/, worker + "partners/components/LaborPartnerManagementPanel.tsx", ["Lưu nguồn giới thiệu"], [
    "Mở đúng đối tác để gắn lao động được giới thiệu. Chọn lao động, chính sách đang áp dụng, cơ chế hoa hồng, ngày giới thiệu, ngày bắt đầu làm và hiệu lực từ.", "Chọn Lưu nguồn giới thiệu rồi kiểm tra lại đối tác, lao động và chính sách đã gắn.",
  ]),
  procedure("retail-partner-create-update", "POST|PATCH", /^\/retail\/partners(?:\/:id)?$/, "src/modules/retail/pages/RetailPartnersPage.tsx", ["Thêm đối tác mới", "Cập nhật đối tác"], [
    "Trong Đối tác bán lẻ, mở Thêm đối tác mới hoặc chỉnh sửa đúng đối tác. Chọn đúng vai trò cộng tác viên, đại lý hoặc nhà cung cấp và điền thông tin liên kết.", "Kiểm tra kỹ khi đổi vai trò vì liên kết không còn phù hợp có thể bị gỡ; lưu rồi đối chiếu hồ sơ đối tác.",
  ]),
  procedure("retail-order-cancel", "POST", /^\/retail\/orders\/:id\/cancel$/, "src/modules/retail/pages/RetailOrdersPageV2.tsx", ["Hủy đơn", "Xác nhận hủy đơn"], [
    "Tìm đúng đơn theo mã, mở thao tác Hủy đơn. Nhập lý do, kiểm tra trạng thái thanh toán và ảnh hưởng tồn kho rồi chọn Xác nhận hủy đơn.", "Mở lại đơn để kiểm tra trạng thái và các khoản tiền liên quan trước khi thao tác thêm.",
  ]),
  procedure("retail-return-create", "POST", /^\/retail\/after-sales$/, "src/modules/retail/pages/RetailOrdersPageV2.tsx", ["Trả hàng / Hoàn tiền", "Xác nhận"], [
    "Từ Đơn hàng, mở đúng đơn đã hoàn tất và chọn Trả hàng / Hoàn tiền. Chọn loại nghiệp vụ đổi trả hoặc thu mua, dòng hàng, số lượng và lý do.", "Đối chiếu số tiền và tình trạng nhận lại hàng trước khi Xác nhận; kiểm tra phiếu mới tại Đổi trả và dữ liệu của đơn gốc.",
  ]),
  procedure("resource-folder", "POST", /^\/resources\/folder$/, "src/pages/ResourceTab.tsx", ["Thêm mới", "Thêm thư mục"], [
    "Mở đúng thư mục cha trong Tài nguyên, chọn Thêm mới → Thêm thư mục. Nhập tên, kiểm tra nơi tạo rồi xác nhận; mở thư mục vừa tạo để kiểm tra.",
  ]),
  procedure("chat-create", "POST", /^\/chat\/rooms$/, "src/pages/ChatTab.tsx", ["Tạo nhóm trò chuyện", "Tạo nhóm"], [
    "Trong Trò chuyện, chọn tạo nhóm, nhập tên và chọn đúng thành viên. Kiểm tra danh sách rồi chọn Tạo nhóm; mở lại nhóm để kiểm tra thành viên.",
  ]),
  procedure("chat-send", "POST", /^\/chat\/rooms\/:roomId\/messages$/, "src/pages/ChatTab.tsx", ["Nhập tin nhắn", "Gửi tin nhắn"], [
    "Mở đúng phòng trò chuyện, kiểm tra tên phòng và người nhận. Nhập nội dung vào ô Nhập tin nhắn, kiểm tra tệp đính kèm nếu có rồi chọn Gửi tin nhắn.", "Kiểm tra tin đã xuất hiện trong phòng trước khi gửi lại để tránh trùng.",
  ]),
  procedure("chat-edit", "PATCH", /^\/chat\/rooms\/:roomId\/messages\/:messageId$/, "src/pages/ChatTab.tsx", ["Sửa tin nhắn"], [
    "Mở phòng, tìm đúng tin nhắn của mình và chọn Sửa tin nhắn. Chỉnh nội dung, gửi bản sửa rồi kiểm tra lại đúng tin nhắn.",
  ]),
  procedure("knowledge-delete", "DELETE", /^\/company-knowledge\/documents\/:id$/, "src/modules/marketing-suite/knowledge/pages/CompanyKnowledgePage.tsx", ["Xóa tài liệu"], [
    "Tìm đúng tài liệu trong Kho tri thức, kiểm tra tên và phạm vi sử dụng. Chọn Xóa tài liệu, đọc xác nhận rồi đồng ý khi thực sự muốn loại tài liệu khỏi kho.",
  ]),
  procedure("legal-review-content", "POST", /^\/legal-reference\/review-queue\/:id\/content$/, "src/modules/legal-reference/LegalReferencePage.tsx", ["Cập nhật nội dung trích xuất"], [
    "Mở đúng văn bản đang rà soát, tải bản gốc để đối chiếu phần trích xuất. Chỉnh nội dung theo bản gốc rồi chọn Cập nhật nội dung trích xuất.",
  ]),
  ...([
    ["employees", /^\/auth\/users$/, hr + "OrgChartTab.tsx", "OrgChartTab", "nhân sự", "tên nhân sự, phòng ban và cấp quản lý"],
    ["departments", /^\/hr\/departments$/, hr + "HrDepartmentManager.tsx", "HrDepartmentManager", "phòng ban", "tên phòng ban và phòng ban cấp trên"],
    ["training", /^\/crud\/training-courses(?:\/:id)?$/, hr + "TrainingTab.tsx", "TrainingTab", "khóa đào tạo", "tên khóa và bài giảng"],
    ["workflows", /^\/crud\/workflows(?:\/:id)?$/, hr + "WorkflowTab.tsx", "WorkflowTab", "quy trình", "tên quy trình và nhãn phân loại"],
    ["students", /^\/students(?:\/:id)?$/, student + "pages/Students/StudentsPage.tsx", "StudentsPage", "học viên", "tên, mã học viên hoặc số điện thoại"],
    ["courses", /^\/courses(?:\/:id)?$/, student + "pages/Courses/CoursesPage.tsx", "CoursesPage", "khóa học", "tên hoặc mã khóa học"],
    ["batches", /^\/batches(?:\/:id)?$/, student + "pages/Batches/BatchesPage.tsx", "BatchesPage", "lớp học", "tên lớp, khóa học và lịch học"],
    ["exams", /^\/exams(?:\/:id)?$/, student + "pages/Exams/ExamsPage.tsx", "ExamsPage", "đợt thi", "tên đợt thi và ngày thi"],
    ["payments", /^\/payments(?:\/:id)?$/, student + "pages/Fees/FeesPage.tsx", "Nhật ký & Sửa học phí", "giao dịch học phí trong Nhật ký & Sửa học phí", "học viên, thời điểm thu và số tiền"],
    ["resources", /^\/student-resources(?:\/:id)?$/, student + "pages/Resources/ResourcesPage.tsx", "ResourcesPage", "thiết bị hoặc phòng học", "tên tài nguyên và lịch đặt"],
    ["student-notifications", /^\/student-notifications(?:\/:id)?$/, student + "pages/Notifications/NotificationsPage.tsx", "NotificationsPage", "thông báo học viên", "nội dung và thời điểm thông báo"],
    ["partners", /^\/partners(?:\/:id)?$/, student + "pages/Partners/PartnersPage.tsx", "Chi tiết", "đối tác giới thiệu học viên", "tên đối tác hoặc số điện thoại"],
    ["workers", /^\/worker-management\/workers(?:\/:id)?$/, worker + "pages/WorkersPage.tsx", "WorkersPage", "lao động", "tên, mã hoặc số điện thoại lao động"],
    ["worker-projects", /^\/worker-management\/projects(?:\/:id)?$/, worker + "pages/WorkerProjectsPage.tsx", "WorkerProjectsPage", "dự án lao động", "tên dự án, địa điểm và danh sách lao động"],
    ["worker-contracts", /^\/worker-management\/labor-contracts(?:\/:id)?$/, worker + "pages/WorkerContractsPage.tsx", "Tìm hợp đồng", "hợp đồng lao động", "mã hợp đồng, khách hàng hoặc người lao động"],
    ["worker-notifications", /^\/worker-management\/notifications(?:\/:id)?$/, worker + "pages/WorkerNotificationsPage.tsx", "WorkerNotificationsPage", "thông báo lao động", "nội dung và đối tượng thông báo"],
    ["customers", /^\/customers(?:\/:id)?$/, "src/modules/customer-management/CustomerWorkspace.tsx", "CustomerWorkspace", "khách hàng", "tên, số điện thoại và thông tin liên hệ"],
    ["catalog-products", /^\/inventory\/catalog\/products(?:\/:id)?$/, inventory + "ProductCatalogV2Section.tsx", "ProductCatalogV2Section", "hàng hóa hoặc dịch vụ", "tên sản phẩm, SKU và ngành hàng"],
    ["inventory-receipts", /^\/inventory\/receiving\/receipts(?:\/:id)?$/, inventory + "ReceivingSection.tsx", "ReceivingSection", "phiếu nhập hàng", "mã phiếu, nhà cung cấp, kho và trạng thái"],
    ["inventory-transfers", /^\/inventory\/transfers(?:\/:id)?$/, inventory + "InventoryTransferSection.tsx", "InventoryTransferSection", "phiếu điều chuyển", "mã phiếu, kho gửi, kho nhận và trạng thái"],
    ["inventory-counts", /^\/inventory\/counts(?:\/:id)?$/, inventory + "InventoryCountingSection.tsx", "InventoryCountingModal", "phiếu kiểm kê trong Kho hàng", "kho, mã phiếu và trạng thái kiểm kê"],
    ["inventory-serials", /^\/inventory\/serials(?:\/:id(?:\/history)?)?$/, inventory + "SerialRegistrySection.tsx", "SerialRegistrySection", "thiết bị IMEI / SERIAL", "IMEI hoặc số serial và kho đang giữ"],
    ["repair-tickets", /^\/repair\/tickets(?:\/:id)?$/, "src/modules/repair/RepairBoardPage.tsx", "RepairBoardPage", "phiếu sửa chữa", "mã phiếu, khách hàng, thiết bị và trạng thái sửa chữa"],
    ["architect-projects", /^\/architect-assistant\/projects(?:\/:projectId)?$/, "src/modules/architect-assistant/ArchitectureAssistantPage.tsx", "ArchitectureAssistantPage", "dự án kiến trúc", "tên dự án và bản vẽ/tài sản đã lưu"],
    ["finance-assets", /^\/finance\/assets(?:\/:id)?$/, "src/modules/finance/pages/FixedAssetsPage.tsx", "FixedAssetsPage", "tài sản cố định", "mã tài sản, tên, chi nhánh và giá trị"],
    ["finance-depreciations", /^\/finance\/assets\/depreciations$/, "src/modules/finance/pages/AssetDepreciationPage.tsx", "Kỳ khấu hao", "khấu hao", "kỳ khấu hao và trạng thái Kế hoạch hoặc Đã ghi sổ"],
    ["finance-receivables", /^\/finance\/receivables(?:\/:id)?$/, "src/modules/finance/pages/ReceivablesPage.tsx", "ReceivablesPage", "công nợ phải thu", "khách hàng, mã công nợ, hạn trả và dư nợ"],
    ["retail-orders", /^\/retail\/orders(?:\/:id)?$/, "src/modules/retail/pages/RetailOrdersPageV2.tsx", "Tìm đơn hàng", "đơn hàng", "mã đơn, khách hàng hoặc số điện thoại"],
    ["retail-coupons", /^\/retail\/coupons$/, "src/modules/retail/pages/RetailCouponsPage.tsx", "RetailCouponsPage", "mã ưu đãi", "mã, thời hạn và điều kiện sử dụng"],
    ["retail-partners", /^\/retail\/partners$/, "src/modules/retail/pages/RetailPartnersPage.tsx", "Tìm đối tác", "đối tác bán lẻ", "mã, tên, số điện thoại hoặc email"],
    ["quotation-catalog", /^\/quotation\/catalog$/, "src/modules/quotation/PriceListPanel.tsx", "PriceListPanel", "sản phẩm trong Bảng giá", "tên, mã sản phẩm, đơn vị và giá"],
    ["quotation-quotes", /^\/quotation\/quotes(?:\/:id)?$/, "src/modules/quotation/App.tsx", "Tạo dự toán mới", "dự toán hoặc báo giá", "mã, khách hàng và trạng thái duyệt"],
    ["quotation-budgets", /^\/quotation\/budget-plans$/, "src/modules/quotation/BudgetPlanner.tsx", "Tìm theo mô tả dự án", "phương án ngân sách", "mô tả dự án, mã phương án và mức ngân sách"],
    ["quotation-contracts", /^\/quotation\/contracts(?:\/:id)?$/, "src/modules/quotation/ContractWorkflow.tsx", "ContractWorkflow", "hợp đồng trong Báo giá", "mã hợp đồng, dự toán nguồn và trạng thái ký"],
    ["quotation-acceptances", /^\/quotation\/acceptance-records(?:\/:id)?$/, "src/modules/quotation/ContractWorkflow.tsx", "ContractWorkflow", "biên bản tại mục Nghiệm thu", "hợp đồng nguồn, khối lượng và trạng thái nghiệm thu"],
    ["knowledge-documents", /^\/company-knowledge\/documents$/, "src/modules/marketing-suite/knowledge/pages/CompanyKnowledgePage.tsx", "Tìm tài liệu", "tài liệu Kho tri thức", "tên tài liệu và phạm vi được áp dụng"],
    ["legal-documents", /^\/legal-reference\/documents$/, "src/modules/legal-reference/LegalReferencePage.tsx", "Tìm văn bản", "văn bản pháp luật", "tên, số hiệu và thời điểm áp dụng"],
    ["resources-files", /^\/resources(?:\/:id)?$/, "src/pages/ResourceTab.tsx", "ResourceTab", "tệp hoặc thư mục", "tên tài nguyên, thư mục cha và người sở hữu"],
    ["chat-rooms", /^\/chat\/rooms$/, "src/pages/ChatTab.tsx", "Tìm kiếm cuộc trò chuyện", "cuộc trò chuyện", "tên phòng hoặc nhân sự"],
    ["chat-messages", /^\/chat\/rooms\/:roomId\/(messages|search)$/, "src/pages/ChatTab.tsx", "Tìm kiếm trong phòng", "tin nhắn trong đúng phòng trò chuyện", "từ khóa tin nhắn, tên file hoặc liên kết"],
  ] as Array<[string, RegExp, string, string, string, string]>).map(([id, path, file, evidence, entity, criteria]) => procedure(`read-${id}`, "GET", path, file, [evidence], [
    `Mở danh sách ${entity}. Xác định bản ghi theo ${criteria}; dùng ô tìm kiếm hoặc bộ lọc phù hợp đang hiển thị trên màn hình.`,
    "Đối chiếu đúng bản ghi và phạm vi chi nhánh trước khi đọc kết quả. Nếu cần chi tiết, mở bản ghi từ danh sách; không chọn thao tác sửa, xóa hoặc xác nhận ghi dữ liệu.",
  ])),
  ...([
    ["patients", "Tìm mã, tên hoặc số điện thoại bệnh nhân", "mã, tên hoặc số điện thoại"],
    ["visits", "Tìm lượt khám, bệnh nhân, bác sĩ hoặc dịch vụ", "lượt khám, bệnh nhân, bác sĩ hoặc dịch vụ"],
    ["appointments", "Tìm bệnh nhân theo mã, tên hoặc số điện thoại", "bệnh nhân, ngày hẹn và trạng thái lịch hẹn"],
    ["care", "Tìm tên công việc hoặc bệnh nhân", "tên công việc hoặc bệnh nhân"],
  ] as const).map(([route, control, criteria]) => procedure(`healthcare-search-${route}`, "POST", new RegExp(`^/healthcare/${route}/search$`), healthcare, [control], [
    `Tại tab tương ứng, dùng ô tìm kiếm để lọc theo ${criteria}. Kiểm tra các bộ lọc thời gian và trạng thái trước khi đọc danh sách.`,
    "Đối chiếu đúng bệnh nhân và chi nhánh. Mở bản ghi cần xem từ danh sách; không cần tạo hoặc sửa bản ghi để tra cứu.",
  ])),
  procedure("inventory-product-new", "POST", /^\/inventory\/catalog\/products\/(with-price|bulk-create-with-variants)$/, inventory + "catalog/ProductEditorModal.tsx", ["Thêm hàng hóa", "Tạo nhanh phiên bản"], [
    "Trong danh mục Hàng hóa / Dịch vụ, chọn Thêm. Nhập tên, ngành hàng, đơn vị và thuộc tính của sản phẩm; chọn đúng chế độ theo dõi tồn.",
    "Tạo SKU cùng giá bán trong phần phiên bản; nếu nhiều biến thể, dùng phần tạo phiên bản tự động và kiểm tra từng SKU trước khi lưu. Mở lại sản phẩm để đối chiếu các phiên bản và giá.",
  ]),
  procedure("inventory-product-update", "PATCH", /^\/inventory\/catalog\/products\/:id$/, inventory + "catalog/ProductEditorModal.tsx", ["Lưu thay đổi"], [
    "Tìm đúng sản phẩm trong danh mục, chọn Sửa. Cập nhật thông tin sản phẩm và chọn Lưu thay đổi; kiểm tra riêng các SKU để không nhầm thông tin sản phẩm với phiên bản.",
  ]),
  procedure("inventory-product-delete", "DELETE", /^\/inventory\/catalog\/products\/:id$/, inventory + "ProductCatalogV2Section.tsx", ["Xác nhận xóa sản phẩm"], [
    "Chọn Xóa ở đúng sản phẩm. Đọc hộp xác nhận và kiểm tra SKU hoặc dữ liệu đã phát sinh; chỉ xác nhận khi máy chủ cho phép và đúng sản phẩm cần xóa.",
  ]),
  procedure("inventory-variant-create", "POST", /^\/inventory\/catalog\/products\/:id\/variants\/with-price$/, inventory + "catalog/VariantModal.tsx", ["Thêm mã SKU"], [
    "Mở đúng sản phẩm, vào phần phiên bản và thêm SKU. Điền mã SKU, thuộc tính và giá bán; kiểm tra mã không trùng rồi chọn Thêm mã SKU.",
  ]),
  procedure("inventory-variant-update", "PATCH", /^\/inventory\/catalog\/variants\/:id$/, inventory + "catalog/VariantModal.tsx", ["Lưu thay đổi"], [
    "Mở đúng sản phẩm và phiên bản cần sửa. Cập nhật thông tin SKU, kiểm tra thuộc tính phân biệt phiên bản rồi chọn Lưu thay đổi.",
  ]),
  procedure("inventory-variants-bulk-create", "POST", /^\/inventory\/catalog\/products\/:id\/variants\/bulk$/, inventory + "catalog/BulkVariantModal.tsx", ["Tạo các SKU"], [
    "Mở danh sách phiên bản của sản phẩm và thêm nhiều SKU. Kiểm tra từng dòng mã, thuộc tính và giá trước khi chọn Tạo các SKU; đối chiếu danh sách phiên bản sau khi lưu.",
  ]),
  procedure("inventory-workspace", "PATCH", /^\/inventory\/catalog\/workspace$/, inventory + "ProductCatalogV2Section.tsx", ["Lưu chế độ"], [
    "Mở cấu hình chế độ quản lý danh mục. Chọn loại Hàng hóa, Dịch vụ hoặc kết hợp phù hợp với doanh nghiệp, đọc ảnh hưởng đến các tab kho rồi chọn Lưu chế độ.",
  ]),
  procedure("inventory-receipt-create", "POST", /^\/inventory\/receiving\/receipts$/, inventory + "ReceivingSection.tsx", ["Tạo phiếu nhập mới", "Tạo phiếu nháp"], [
    "Trong Nhập hàng, chọn Tạo phiếu nhập mới. Chọn nhà cung cấp, kho nhận và thêm các dòng hàng; nhập số lượng, giá cùng IMEI/serial nếu áp dụng.",
    "Kiểm tra tổng tiền và từng dòng, chọn Tạo phiếu nháp. Phiếu nháp chưa đồng nghĩa hàng đã được nhập vào tồn kho.",
  ]),
  procedure("inventory-receipt-update", "PATCH", /^\/inventory\/receiving\/receipts\/:id$/, inventory + "ReceivingSection.tsx", ["Sửa phiếu nháp", "Lưu thay đổi"], [
    "Mở đúng phiếu còn nháp, chọn Sửa phiếu nháp. Sửa kho, dòng hàng hoặc thông tin được phép đổi rồi chọn Lưu thay đổi; kiểm tra tổng tiền và serial.",
  ]),
  procedure("inventory-receipt-submit", "POST", /^\/inventory\/receiving\/receipts\/:id\/submit$/, inventory + "ReceivingSection.tsx", ["Gửi chờ xác nhận"], [
    "Mở phiếu nhập nháp, kiểm tra nhà cung cấp, kho và các dòng hàng. Chọn Gửi chờ xác nhận rồi kiểm tra trạng thái của phiếu.",
  ]),
  procedure("inventory-receipt-start", "POST", /^\/inventory\/receiving\/receipts\/:id\/start-receiving$/, inventory + "ReceivingSection.tsx", ["Nhập kho"], [
    "Mở đúng phiếu chờ nhập, chọn Nhập kho để bắt đầu tiếp nhận. Đối chiếu số lượng giao thực tế và IMEI/serial trước khi hoàn tất nhập kho.",
  ]),
  procedure("inventory-receipt-confirm", "POST", /^\/inventory\/receiving\/receipts\/:id\/confirm$/, inventory + "ReceivingSection.tsx", ["Hoàn thành nhập kho"], [
    "Mở phiếu đang nhập, kiểm tra đủ thông tin hàng thực nhận và serial bắt buộc. Chọn Hoàn thành nhập kho, sau đó kiểm tra phiếu và tồn kho nhận.",
  ]),
  procedure("inventory-receipt-cancel", "POST", /^\/inventory\/receiving\/receipts\/:id\/cancel$/, inventory + "ReceivingSection.tsx", ["Hủy phiếu"], [
    "Mở đúng phiếu nhập, kiểm tra trạng thái rồi chọn Hủy phiếu. Đọc điều kiện được hủy và nội dung xác nhận; không dùng hủy để thay thế nghiệp vụ trả hàng đã nhập hoàn tất.",
  ]),
  procedure("inventory-count-values", "PATCH", /^\/inventory\/counts\/:id\/items\/:itemId$/, inventory + "InventoryCountingSection.tsx", ["countedQuantity"], [
    "Mở phiếu kiểm kê của đúng kho, tìm đúng dòng SKU và nhập số lượng thực đếm. Kiểm tra trạng thái lưu của dòng; nếu báo chờ đồng bộ, kiểm tra lại trước khi gửi duyệt.",
  ]),
  procedure("inventory-count-scan", "POST", /^\/inventory\/counts\/:id\/scan$/, inventory + "InventoryCountingSection.tsx", ["inventoryCountService.scan"], [
    "Mở phiếu kiểm kê đang đếm, quét hoặc nhập mã thiết bị tại phần quét mã. Kiểm tra kết quả: mã đã đếm, trùng mã hoặc ngoài dự kiến.", "Không cộng lại mã trùng; các mã ngoài dự kiến cần được đối chiếu trước khi gửi duyệt phiếu.",
  ]),
  procedure("inventory-count-cancel", "POST", /^\/inventory\/counts\/:id\/cancel$/, inventory + "InventoryCountingSection.tsx", ["Hủy phiếu kiểm kê?", "Hủy phiếu"], [
    "Mở đúng phiếu kiểm kê, chọn Hủy phiếu. Đọc xác nhận Hủy phiếu kiểm kê? rồi đồng ý nếu muốn ngừng phiếu; kiểm tra trạng thái trước khi lập phiếu khác.",
  ]),
  procedure("inventory-transfer-accept", "POST", /^\/inventory\/transfers\/:id\/accept$/, inventory + "InventoryTransferSection.tsx", ["inventoryTransferService.accept"], [
    "Chọn chi nhánh và kho nhận, mở phiếu điều chuyển đang vận chuyển. Đối chiếu hàng thực nhận, SKU, số lượng và serial.", "Dùng thao tác nhận phiếu tại dòng điều chuyển, kiểm tra xác nhận rồi tiếp nhận; đối chiếu tồn kho nhận và trạng thái phiếu.",
  ]),
  procedure("inventory-stock-reverse", "POST", /^\/inventory\/stock-logs\/:id\/reverse$/, inventory + "outbound/OutboundReversalControl.tsx", ["Xác nhận đảo toàn bộ"], [
    "Mở phiếu xuất nội bộ hoặc hủy hàng cần hoàn nguyên. Đối chiếu chứng từ, giá vốn và đơn vị hàng; nhập lý do đảo phiếu.", "Chỉ tiếp tục khi hàng thực tế đã được trả lại. Chọn Xác nhận đảo toàn bộ; phiếu gốc vẫn được giữ. Kiểm tra phiếu đảo và tồn kho, không xóa phiếu gốc để thay thế nghiệp vụ đảo.",
  ]),
  procedure("finance-depreciation-run", "POST", /^\/finance\/assets\/depreciations\/run$/, "src/modules/finance/pages/AssetDepreciationPage.tsx", ["Lập kế hoạch"], [
    "Trong Khấu hao, chọn đúng kỳ tháng rồi chọn Lập kế hoạch. Đối chiếu từng tài sản, mức khấu hao, lũy kế và giá trị còn lại; bước này chưa ghi sổ.",
  ]),
  procedure("finance-depreciation-post", "POST", /^\/finance\/assets\/depreciations\/post$/, "src/modules/finance/pages/AssetDepreciationPage.tsx", ["Ghi sổ"], [
    "Chọn đúng kỳ khấu hao đã lập kế hoạch, kiểm tra các dòng và tổng tiền. Chọn Ghi sổ rồi xác nhận các dòng chuyển sang Đã ghi sổ; không chạy lại để tạo thêm chi phí.",
  ]),
  procedure("finance-asset-inventory-create", "POST", /^\/finance\/asset-inventories$/, "src/modules/finance/pages/AssetInventoryPage.tsx", ["Mở phiên kiểm kê", "Tạo phiên"], [
    "Trong Kiểm kê tài sản, mở phiên kiểm kê và chọn phạm vi chi nhánh. Kiểm tra phạm vi trước khi chọn Tạo phiên; mở phiên vừa tạo để ghi nhận kiểm kê.",
  ]),
  procedure("finance-asset-inventory-count", "POST", /^\/finance\/asset-inventories\/:id\/counts$/, "src/modules/finance/pages/AssetInventoryPage.tsx", ["Ghi nhận"], [
    "Mở đúng phiên kiểm kê tài sản, chọn tài sản và ghi nhận tình trạng thực tế theo biểu mẫu. Chọn Ghi nhận rồi kiểm tra dòng kết quả trong phiên.",
  ]),
  procedure("finance-asset-inventory-finalize", "POST", /^\/finance\/asset-inventories\/:id\/finalize$/, "src/modules/finance/pages/AssetInventoryPage.tsx", ["Chốt phiên"], [
    "Mở phiên đã kiểm tra đủ tài sản, rà các chênh lệch và tình trạng ghi nhận. Chọn Chốt phiên rồi kiểm tra trạng thái; không lập lại phiên chỉ vì chưa thấy phản hồi.",
  ]),
  procedure("finance-receivable-collect", "POST", /^\/finance\/receivables\/:id\/payments$/, "src/modules/finance/components/ReceivableDetailDrawer.tsx", ["Số tiền thu", "Mã tham chiếu"], [
    "Mở Chi tiết công nợ của đúng khách hàng. Trong Thu tiền, nhập Số tiền thu và Mã tham chiếu nếu có; đối chiếu số tiền với dư nợ và khoản đã thu.", "Xác nhận thu theo biểu mẫu, kiểm tra sổ chi tiết và dư nợ mới. Không tạo thêm phiếu thu bên ngoài để ghi nhận cùng một khoản.",
  ]),
  procedure("finance-receivable-adjust", "POST", /^\/finance\/receivables\/:id\/adjustments$/, "src/modules/finance/components/ReceivableDetailDrawer.tsx", ["Hướng điều chỉnh", "Lý do điều chỉnh"], [
    "Mở Chi tiết công nợ → Điều chỉnh. Nhập số tiền, chọn Tăng nợ hoặc Giảm nợ và ghi rõ lý do.", "Kiểm tra chiều điều chỉnh rồi xác nhận trên biểu mẫu; đối chiếu sổ chi tiết và dư nợ mới.",
  ]),
  procedure("finance-receivable-extend", "POST", /^\/finance\/receivables\/:id\/extend$/, "src/modules/finance/components/ReceivableDetailDrawer.tsx", ["Gia hạn đến ngày", "Lý do gia hạn"], [
    "Mở Chi tiết công nợ → Gia hạn công nợ. Chọn Gia hạn đến ngày, nhập Lý do gia hạn rồi xác nhận; kiểm tra hạn trả mới trên công nợ.",
  ]),
  procedure("finance-receivable-reverse", "POST", /^\/finance\/receivables\/:id\/entries\/:entryId\/reversal$/, "src/modules/finance/components/ReceivableDetailDrawer.tsx", ["Lý do đảo bút toán"], [
    "Trong Chi tiết công nợ, tìm đúng bút toán tại Sổ chi tiết bất biến. Nhập lý do đảo ở dòng cần xử lý và dùng thao tác đảo của dòng.", "Kiểm tra bút toán đảo và dư nợ mới; giữ nguyên bút toán gốc để đối chiếu lịch sử.",
  ]),
  procedure("finance-reminders", "POST", /^\/finance\/reminders\/runs$/, "src/modules/finance/pages/FinanceRemindersPage.tsx", ["Chạy nhắc nợ"], [
    "Trong Nhắc nợ, kiểm tra chi nhánh, công nợ quá hạn và lịch sử nhắc trước đó. Chọn Chạy nhắc nợ khi muốn xếp hàng nhắc, rồi kiểm tra lượt chạy và kết quả gửi.",
  ]),
  procedure("finance-treasury-account", "POST", /^\/finance\/reporting\/treasury\/accounts$/, "src/modules/finance/pages/TreasuryPage.tsx", ["Tạo quỹ / tài khoản", "Tạo quỹ"], [
    "Trong Sổ quỹ & dòng tiền, chọn Tạo quỹ / tài khoản. Nhập loại quỹ hoặc tài khoản, thông tin ngân hàng nếu cần và số dư theo biểu mẫu.", "Kiểm tra phạm vi chi nhánh, chọn Tạo quỹ rồi đối chiếu tài khoản mới trong danh sách.",
  ]),
  procedure("finance-treasury-decision", "POST", /^\/finance\/reporting\/treasury\/vouchers\/:id\/decision$/, "src/modules/finance/pages/TreasuryPage.tsx", ["Duyệt ghi sổ"], [
    "Mở đúng phiếu thu, chi hoặc chuyển quỹ đang chờ duyệt. Kiểm tra tài khoản, đối tượng, số tiền và chứng từ trước khi quyết định duyệt hoặc từ chối.", "Nếu đồng ý, dùng Duyệt ghi sổ; kiểm tra trạng thái phiếu và số dư sau xử lý. Phiếu chờ duyệt chưa ảnh hưởng số dư.",
  ]),
  procedure("finance-treasury-bank-line", "POST", /^\/finance\/reporting\/treasury\/bank-lines$/, "src/modules/finance/pages/TreasuryPage.tsx", ["Thêm dòng sao kê"], [
    "Trong Sổ quỹ & dòng tiền, mở phần sao kê và chọn Thêm dòng sao kê. Nhập đúng tài khoản, ngày, số tiền và tham chiếu ngân hàng; kiểm tra trùng trước khi lưu.",
  ]),
  procedure("finance-treasury-period", "POST", /^\/finance\/reporting\/treasury\/periods$/, "src/modules/finance/pages/TreasuryPage.tsx", ["Chốt sổ quỹ tháng", "Mở lại kỳ"], [
    "Mở Chốt sổ quỹ và chọn đúng tháng. Nếu chốt, đối chiếu số dư và giao dịch còn chờ trước khi chốt tháng; nếu mở lại, chọn Mở lại kỳ ở đúng kỳ cần sửa.", "Kiểm tra trạng thái kỳ sau thao tác; việc mở lại không tự sửa các giao dịch cũ.",
  ]),
  procedure("payroll-publication-schedule", "PUT", /^\/payroll\/reconciliation-schedule$/, hr + "payroll/PayrollPublicationSchedule.tsx", ["Lưu lịch phát hành"], [
    "Trong PAYROLL, mở lịch phát hành đối soát. Đặt thời gian và phạm vi áp dụng, kiểm tra rồi chọn Lưu lịch phát hành; đọc lại lịch đã lưu.",
  ]),
  procedure("payroll-inputs", "PUT", /^\/payroll\/periods\/:periodKey\/inputs(?:\/:employeeId)?$/, hr + "payroll/PayrollPeriodInputsTable.tsx", ["Lưu thay đổi", "Kỳ đã qua bước Nháp"], [
    "Chọn đúng kỳ lương và mở bảng dữ liệu đầu vào. Kỳ cần ở bước Nháp; nếu đã khóa, dùng quy trình mở lại kỳ theo quyền được cấp.", "Sửa đúng dòng nhân viên và khoản cần đổi, nhập lý do đối soát khi được yêu cầu rồi chọn Lưu thay đổi. Kiểm tra lại số liệu trước khi tính lương.",
  ]),
  procedure("payroll-formula", "POST|PATCH", /^\/payroll\/formulas(?:\/:id)?$/, hr + "payroll/PayrollFormulaModal.tsx", ["Tạo cách tính", "Sửa cách tính", "Lưu cách tính"], [
    "Mở phần cách tính trong PAYROLL, chọn Tạo cách tính hoặc Sửa cách tính tại công thức cần đổi. Nhập biểu thức và điều kiện áp dụng, kiểm tra trước khi chọn Lưu cách tính.",
  ]),
  procedure("payroll-policy", "POST|PATCH", /^\/payroll\/policies(?:\/:id)?$/, hr + "payroll/PayrollPolicyFormModal.tsx", ["Tạo cách tính lương", "Lưu công thức"], [
    "Mở quản lý cách tính lương, chọn tạo hoặc sửa chính sách. Kiểm tra các khoản lương, bảo hiểm, thuế và điều kiện áp dụng trong từng bước.", "Chọn Lưu công thức và kiểm tra phạm vi áp dụng; nếu giao diện yêu cầu cập nhật bảng lương, kiểm tra kết quả cập nhật riêng.",
  ]),
  procedure("payroll-reopen", "POST", /^\/payroll\/runs\/:id\/reopen$/, hr + "payroll/PayrollReopenModal.tsx", ["Mở lại kỳ lương", "Mở lại kỳ"], [
    "Chọn đúng kỳ và lượt chạy lương cần mở lại. Mở hộp Mở lại kỳ lương, ghi lý do và đọc ảnh hưởng trước khi chọn Mở lại kỳ.",
  ]),
  ...([
    ["create", /^\/payroll\/runs\/:id\/payments$/, "Tạo đợt thanh toán", "Kiểm tra kỳ lương, danh sách nhân viên và số tiền, chọn Tạo đợt thanh toán. Đợt nháp chưa có nghĩa đã chuyển tiền."],
    ["confirm", /^\/payroll\/payments\/:id\/confirm$/, "Xác nhận thanh toán", "Mở đúng đợt nháp, đối chiếu chứng từ chuyển tiền thực tế rồi chọn Xác nhận thanh toán. Kiểm tra số tiền đã thanh toán của kỳ."],
    ["cancel", /^\/payroll\/payments\/:id\/cancel$/, "Hủy thanh toán", "Mở đúng đợt thanh toán còn nháp, chọn Hủy thanh toán, đọc xác nhận và kiểm tra trạng thái sau hủy."],
    ["reverse", /^\/payroll\/payments\/:id\/reverse$/, "Hoàn tác thanh toán", "Mở đúng đợt thanh toán đã xác nhận cần hoàn tác. Kiểm tra chứng từ, nhập lý do theo yêu cầu rồi chọn Hoàn tác thanh toán; đối chiếu lại số đã trả."],
  ] as Array<[string, RegExp, string, string]>).map(([id, path, label, step]) => procedure(`payroll-payment-${id}`, "POST", path, hr + "payroll/PayrollPaymentsPanel.tsx", [label], [step])),
  procedure("course-create", "POST", /^\/courses$/, student + "pages/Courses/CoursesPage.tsx", ["handleAddCourse", "copy.createModalTitle"], [
    "Trong Khóa học, mở biểu mẫu thêm khóa học. Điền tên, mã, phân loại, học phí và các trường bắt buộc đang hiển thị; tên gọi có thể thay đổi theo loại hình doanh nghiệp.", "Kiểm tra nội dung rồi lưu trên biểu mẫu; tìm lại khóa học theo mã và đối chiếu học phí.",
  ]),
  procedure("course-update", "PATCH", /^\/courses\/:id$/, student + "pages/Courses/CoursesPage.tsx", ["handleEditCourse", "copy.editTitle"], [
    "Tìm đúng khóa học, mở nút chỉnh sửa của khóa đó. Chỉ cập nhật các trường cần thay đổi rồi lưu; kiểm tra lại mã, tên và học phí.",
  ]),
  procedure("course-delete", "DELETE", /^\/courses\/:id$/, student + "pages/Courses/CoursesPage.tsx", ["Xác nhận xóa", "copy.deleteTitle"], [
    "Tìm đúng khóa học, chọn xóa trên dòng hoặc thẻ khóa. Đọc ảnh hưởng đến lớp và dữ liệu liên quan rồi chọn Xác nhận xóa nếu đúng yêu cầu; nếu API từ chối do dữ liệu liên quan, xử lý nguyên nhân trước.",
  ]),
  procedure("course-categories", "GET|POST|DELETE", /^\/courses\/categories(?:\/:id)?$/, student + "pages/Courses/CoursesPage.tsx", ["handleAddCategory", "copy.categoryManagerTitle"], [
    "Mở quản lý phân loại tại Khóa học. Xem danh sách hiện có; để thêm, nhập tên vào biểu mẫu và chọn Thêm; để xóa, chọn xóa ở đúng phân loại và đọc xác nhận.", "Chỉ thực hiện thao tác tương ứng với yêu cầu, kiểm tra lại danh sách phân loại sau khi lưu.",
  ]),
  procedure("batch-create-update", "POST|PATCH", /^\/batches(?:\/:id)?$/, student + "pages/Batches/BatchesPage.tsx", ["copy.createTitle", "Lưu thay đổi", "handleSubmit"], [
    "Trong Lớp học, mở biểu mẫu tạo lớp hoặc chọn chỉnh sửa tại đúng lớp. Chọn khóa học, nhập mã lớp, ngày bắt đầu/kết thúc, lịch học, giáo viên và địa điểm theo biểu mẫu.", "Kiểm tra lịch và các trường bắt buộc, lưu rồi mở lại lớp để đối chiếu. Không tạo lớp mới khi chỉ muốn sửa lớp đã có.",
  ]),
  procedure("batch-delete", "DELETE", /^\/batches\/:id$/, student + "pages/Batches/BatchesPage.tsx", ["Xác nhận xóa"], [
    "Chọn xóa tại đúng lớp, đọc mã lớp và ảnh hưởng đến học viên, điểm danh trong hộp xác nhận. Chọn Xác nhận xóa chỉ khi đúng lớp cần xóa.",
  ]),
  procedure("batch-progress-colors", "GET|PATCH", /^\/batches\/settings\/progress-colors$/, student + "pages/Batches/BatchesPage.tsx", ["Cấu hình màu tiến độ lớp", "Lưu màu"], [
    "Mở Cấu hình màu tiến độ lớp trong Lớp học, xem màu theo từng mức tiến độ. Nếu cần đổi, chọn màu tương ứng rồi chọn Lưu màu; xem lại cách hiển thị trên danh sách lớp.",
  ]),
  procedure("batch-roster", "GET", /^\/batches\/:id\/(enrollments|attendance\/learners)$/, student + "pages/Batches/BatchesPage.tsx", ["setManageLearnersId"], [
    "Tìm đúng lớp rồi mở phần quản lý học viên của lớp. Đối chiếu tên, mã và trạng thái ghi danh của từng học viên; khi xem điểm danh, chọn đúng ngày trong phần Điểm danh thủ công & QR.",
  ]),
  procedure("batch-enrollment", "PATCH", /^\/batches\/:id\/learners\/:studentId\/enrollment-status$/, student + "components/Batches/ManageLearnersModal.tsx", ["Xác nhận bảo lưu học viên"], [
    "Mở quản lý học viên của đúng lớp và chọn đúng học viên. Đổi trạng thái ghi danh theo nội dung yêu cầu; với bảo lưu, nhập lý do và đọc xác nhận bảo lưu.", "Lưu rồi kiểm tra trạng thái trong lớp và lịch sử học viên; không thêm học viên lần nữa để thay đổi trạng thái.",
  ]),
  procedure("batch-attendance-update", "PATCH", /^\/batches\/:id\/attendance\/learner$/, student + "components/Batches/AttendanceModal.tsx", ["Lưu điểm danh"], [
    "Tại đúng lớp, mở Điểm danh thủ công & QR và chọn ngày học. Tìm đúng học viên, chỉnh trạng thái và thông tin điểm danh cần đổi.", "Chọn Lưu điểm danh; mở Lịch sử & Thống kê điểm danh để đối chiếu đúng ngày và học viên.",
  ]),
  procedure("batch-attendance-delete", "DELETE", /^\/batches\/:id\/attendance$/, student + "components/Batches/AttendanceModal.tsx", ["Xóa buổi học khỏi lịch"], [
    "Mở điểm danh của đúng lớp và ngày. Chọn Xóa buổi học khỏi lịch, đọc ảnh hưởng đến dữ liệu điểm danh của buổi trước khi xác nhận; kiểm tra lại lịch sử.",
  ]),
  procedure("assignment-create", "POST", /^\/assignments$/, student + "components/Batches/AssignmentModal.tsx", ["Xác nhận giao bài"], [
    "Tại lớp, mở Giao bài tập. Nhập nội dung, hạn nộp và thông tin bài tập; đối chiếu đúng lớp và đối tượng nhận rồi chọn Xác nhận giao bài.",
  ]),
  procedure("assignment-grade", "POST", /^\/assignments\/:id\/students\/:studentId\/grade$/, student + "components/Batches/AssignmentModal.tsx", ["Lưu kết quả chấm"], [
    "Mở bài tập trong đúng lớp, chọn bài nộp của đúng học viên. Kiểm tra bài nộp, nhập điểm và nhận xét rồi chọn Lưu kết quả chấm.",
  ]),
  procedure("assignment-submit", "POST", /^\/assignments\/:id\/students\/:studentId\/submit$/, student + "components/Batches/AssignmentModal.tsx", ["Lưu bài nộp hộ"], [
    "Mở bài tập và đúng học viên, vào phần nộp hộ. Điền nội dung hoặc tài liệu bài nộp, đối chiếu người nộp rồi chọn Lưu bài nộp hộ; kiểm tra lại bài nộp đã lưu.",
  ]),
  procedure("exam-delete", "DELETE", /^\/exams\/:id$/, student + "pages/Exams/ExamsPage.tsx", ["Xóa đợt thi", "Xác nhận xóa"], [
    "Tìm đúng đợt thi và chọn Xóa đợt thi. Đọc ảnh hưởng đến thí sinh và kết quả rồi chọn Xác nhận xóa khi đúng yêu cầu.",
  ]),
  procedure("exam-roster", "GET", /^\/exams\/:id\/(eligible-students|assigned-students|grade-roster)$/, student + "components/Exams/AssignStudentModal.tsx", ["AssignStudentModal"], [
    "Mở đúng đợt thi để xem thí sinh đã gán. Với danh sách đủ điều kiện, mở phần thêm học viên và chọn đúng lớp; chỉ xem danh sách, không xác nhận thêm khi chưa có yêu cầu.",
  ]),
  procedure("resource-category", "GET|POST|DELETE", /^\/student-resources\/categories(?:\/:id)?$/, student + "pages/Resources/components/ManageCategoriesModal.tsx", ["Thêm phân loại", "Xóa phân loại"], [
    "Trong Thiết bị hoặc Phòng học, mở quản lý phân loại. Xem các loại đã có; nếu thêm, nhập tên rồi chọn Thêm phân loại; nếu xóa, chọn Xóa phân loại tại đúng loại và kiểm tra dữ liệu đang dùng loại đó.",
  ]),
  procedure("student-resource-update", "PATCH", /^\/student-resources\/:id$/, student + "pages/Resources/components/AddResourceModal.tsx", ["Lưu thay đổi tài nguyên"], [
    "Mở phần chỉnh sửa của đúng phòng học hoặc thiết bị. Cập nhật tên, loại và thông tin cần đổi rồi chọn Lưu thay đổi tài nguyên; đối chiếu lại tài nguyên.",
  ]),
  procedure("student-resource-book", "POST", /^\/student-resources\/:id\/bookings$/, student + "pages/Resources/components/BookingModal.tsx", ["Xác nhận đặt lịch"], [
    "Mở lịch đặt của đúng phòng hoặc thiết bị. Chọn thời gian, mục đích và thông tin sử dụng; kiểm tra lịch trùng rồi chọn Xác nhận đặt lịch.",
  ]),
  procedure("student-resource-cancel-booking", "DELETE", /^\/student-resources\/:id\/bookings\/:bookingId$/, student + "pages/Resources/components/ResourceCard.tsx", ["Hủy lịch đặt"], [
    "Mở lịch đặt của tài nguyên, tìm đúng khoảng thời gian và người đặt. Chọn Hủy lịch đặt, xác nhận và kiểm tra lịch đã được giải phóng.",
  ]),
  procedure("student-resource-delete", "DELETE", /^\/student-resources\/:id$/, student + "pages/Resources/components/ResourceCard.tsx", ["Xóa tài nguyên"], [
    "Chọn Xóa tài nguyên tại đúng phòng hoặc thiết bị. Kiểm tra lịch đặt và dữ liệu liên quan trước khi xác nhận; không xóa tài nguyên để hủy riêng một lịch đặt.",
  ]),
  procedure("quality-thresholds", "GET|PATCH", /^\/student-quality\/settings\/thresholds$/, student + "pages/StudentQuality/StudentQualityPage.tsx", ["Lưu ngưỡng"], [
    "Mở phần ngưỡng đánh giá trong Chất lượng học viên. Xem các ngưỡng hiện tại; nếu thay đổi, nhập ngưỡng đúng tiêu chí rồi chọn Lưu ngưỡng, kiểm tra lại cách phân loại học viên.",
  ]),
  procedure("quality-assessment", "PATCH", /^\/student-quality\/batches\/:batchId\/students\/:studentId$/, student + "pages/StudentQuality/StudentQualityPage.tsx", ["Cập nhật đánh giá", "Lưu đánh giá"], [
    "Chọn đúng lớp và học viên tại Chất lượng học viên. Mở Cập nhật đánh giá, nhập tiêu chí và ghi chú thái độ cần đổi rồi chọn Lưu đánh giá.",
  ]),
  procedure("quality-mini-test", "POST|PATCH", /^\/student-quality\/batches\/:batchId\/students\/:studentId\/mini-tests(?:\/:miniTestId)?$/, student + "pages/StudentQuality/StudentQualityPage.tsx", ["Tạo mini test", "Lưu mini test"], [
    "Chọn đúng lớp, học viên và phần mini test. Khi thêm, chọn Tạo mini test; khi sửa, mở đúng điểm kiểm tra đã có. Nhập thông tin và điểm rồi chọn Lưu mini test.",
  ]),
  procedure("quality-mini-test-delete", "DELETE", /^\/student-quality\/batches\/:batchId\/students\/:studentId\/mini-tests\/:miniTestId$/, student + "pages/StudentQuality/StudentQualityPage.tsx", ["Xóa điểm học viên"], [
    "Mở mini test của đúng học viên, chọn Xóa điểm học viên ở điểm cần gỡ. Kiểm tra tên bài và học viên trong xác nhận trước khi đồng ý.",
  ]),
  procedure("roadmap-create-update", "POST|PATCH", /^\/learning-roadmaps(?:\/:id)?$/, student + "pages/LearningRoadmap/LearningRoadmapPage.tsx", ["Tạo lộ trình", "Thêm chặng", "Lưu lộ trình"], [
    "Trong Lộ trình & chờ lớp, chọn Tạo lộ trình hoặc mở lộ trình cần sửa. Thêm các chặng, chọn khóa học và điều kiện chuyển chặng theo thứ tự.", "Kiểm tra toàn bộ chuỗi chặng rồi chọn Lưu lộ trình; mở lại để đối chiếu điều kiện lên lớp.",
  ]),
  procedure("roadmap-progression", "PATCH", /^\/learning-roadmaps\/batches\/:batchId\/students\/:studentId\/progression$/, student + "pages/LearningRoadmap/LearningRoadmapPage.tsx", ["Lưu quyết định"], [
    "Mở điều phối của lớp và chọn đúng học viên. Đối chiếu điều kiện học tiếp, chọn quyết định chuyển chặng hoặc bảo lưu, ghi chú điều phối rồi chọn Lưu quyết định.",
  ]),
  procedure("worker-delete", "DELETE", /^\/worker-management\/workers\/:id$/, worker + "pages/WorkersPage.tsx", ["Xóa Lao động này?"], [
    "Chọn Xóa ở đúng hồ sơ lao động, kiểm tra tên và ảnh hưởng dữ liệu trong hộp xác nhận. Đồng ý khi đúng hồ sơ cần xóa, sau đó kiểm tra danh sách.",
  ]),
  procedure("worker-bulk-delete", "POST", /^\/worker-management\/workers\/bulk-delete$/, worker + "pages/WorkersPage.tsx", ["Xóa hàng loạt lao động"], [
    "Đánh dấu đúng các lao động trong danh sách, chọn Xóa hàng loạt. Kiểm tra số lượng và tên hồ sơ trong hộp xác nhận trước khi đồng ý; đối chiếu các hồ sơ còn lại sau xử lý.",
  ]),
  procedure("worker-project-delete", "DELETE", /^\/worker-management\/projects\/:id$/, worker + "pages/WorkerProjectsPage.tsx", ["Xóa dự án"], [
    "Mở thao tác Xóa dự án tại đúng dự án lao động. Kiểm tra lao động và dữ liệu liên quan được nêu trong xác nhận trước khi đồng ý.",
  ]),
  procedure("worker-contract-save", "POST|PATCH", /^\/worker-management\/labor-contracts(?:\/:id)?$/, worker + "components/WorkerContractFormModal.tsx", ["Thêm hợp đồng", "Lưu hợp đồng"], [
    "Trong Hợp đồng lao động, chọn thêm mới hoặc sửa đúng hợp đồng. Chọn người lao động, nhập mã hợp đồng, thời hạn và các điều khoản; kiểm tra hợp đồng đang tồn tại để tránh trùng.", "Chọn Lưu hợp đồng rồi đối chiếu người lao động, kỳ hiệu lực và trạng thái.",
  ]),
  procedure("worker-contract-renew", "POST", /^\/worker-management\/labor-contracts\/:id\/renew$/, worker + "components/WorkerContractFormModal.tsx", ["Gia hạn hợp đồng", "Tạo kỳ gia hạn"], [
    "Mở đúng hợp đồng, chọn Gia hạn. Kiểm tra ngày kết thúc kỳ trước, nhập kỳ mới và điều khoản thay đổi rồi chọn Tạo kỳ gia hạn; mở lịch sử để đối chiếu hai kỳ.",
  ]),
  procedure("worker-contract-delete", "DELETE", /^\/worker-management\/labor-contracts\/:id$/, worker + "pages/WorkerContractsPage.tsx", ["Xóa hợp đồng lao động", "Xóa hợp đồng"], [
    "Chọn Xóa tại đúng hợp đồng lao động, đọc mã hợp đồng và dữ liệu liên quan trong hộp xác nhận; chọn Xóa hợp đồng nếu đúng yêu cầu.",
  ]),
  procedure("healthcare-patient-detail", "GET", /^\/healthcare\/patients\/:id$/, "src/modules/healthcare/PatientDetailsModal.tsx", ["PatientDetailsModal"], [
    "Trong Bệnh nhân, tìm đúng mã, tên hoặc số điện thoại rồi mở hồ sơ. Đối chiếu thông tin định danh trước khi đọc các lượt khám, lịch hẹn và dữ liệu liên quan.",
  ]),
  procedure("healthcare-visit-update", "PATCH", /^\/healthcare\/visits\/:id$/, healthcare, ["Sửa lượt khám"], [
    "Trong Lượt khám, chọn Sửa lượt khám tại đúng bản ghi. Kiểm tra bệnh nhân và ngày khám, cập nhật nội dung cần đổi rồi lưu; nếu hủy lượt, dùng thao tác hủy và ghi lý do theo biểu mẫu.",
  ]),
  procedure("healthcare-report", "GET", /^\/healthcare\/visits\/:id\/report$/, healthcare, ["Xem phiếu Excel"], [
    "Tìm đúng lượt khám có phiếu bệnh viện đã nhập, chọn Xem phiếu Excel. Đối chiếu tên bệnh nhân và ngày khám trên phiếu; không sửa lượt khám chỉ để xem tài liệu.",
  ]),
  procedure("healthcare-delete-preview", "POST", /^\/healthcare\/patients\/bulk-delete-preview$/, healthcare, ["deleteImpact"], [
    "Trong Bệnh nhân, chọn các hồ sơ cần kiểm tra rồi mở thao tác xóa hàng loạt. Đọc bảng ảnh hưởng gồm hồ sơ, lượt khám, lịch hẹn và việc chăm sóc; dừng trước nút xác nhận nếu chỉ cần xem ảnh hưởng.",
  ]),
  procedure("healthcare-delete", "POST", /^\/healthcare\/patients\/bulk-delete$/, healthcare, ["Xác nhận sẽ xóa vĩnh viễn hồ sơ"], [
    "Trong Bệnh nhân, chọn đúng hồ sơ và mở xóa hàng loạt. Đọc toàn bộ ảnh hưởng đến lượt khám, lịch hẹn và việc chăm sóc trong chi nhánh.", "Chỉ xác nhận xóa vĩnh viễn sau khi đã đối chiếu đủ hồ sơ; kiểm tra kết quả và các mục bị từ chối sau thao tác.",
  ]),
  procedure("healthcare-import-preview", "POST", /^\/healthcare\/imports\/preview\/:kind$/, "src/modules/healthcare/ImportPanel.tsx", ["Tải lên và kiểm tra"], [
    "Tại tab đúng loại dữ liệu y tế, chọn Nhập Excel. Chọn loại nhập và tệp theo mẫu rồi chọn Tải lên và kiểm tra.", "Xem từng dòng và lỗi trong bản xem trước; chưa chọn Xác nhận nhập nếu chỉ muốn kiểm tra hoặc còn sai dữ liệu.",
  ]),
  procedure("healthcare-import-commit", "POST", /^\/healthcare\/imports\/:id\/commit$/, "src/modules/healthcare/ImportJobDetails.tsx", ["Xác nhận nhập Excel"], [
    "Mở đúng đợt nhập đã kiểm tra, đối chiếu chi nhánh, loại dữ liệu và từng dòng hợp lệ. Chọn Xác nhận nhập Excel khi dữ liệu đúng.", "Theo dõi kết quả và số dòng đã lưu; mở hồ sơ từ đợt nhập để đối chiếu, không tải lại cùng tệp để xử lý các dòng đã thành công.",
  ]),
  procedure("healthcare-import-retry", "POST", /^\/healthcare\/imports\/:id\/retry$/, "src/modules/healthcare/ImportJobDetails.tsx", ["Thử lại lượt nhập"], [
    "Mở đợt nhập lỗi trong Lịch sử nhập, đọc nguyên nhân và kết quả từng dòng. Nếu hệ thống cho phép thử lại, chọn Thử lại lượt nhập trên chính đợt đó, rồi theo dõi kết quả.",
  ]),
  procedure("healthcare-import-history", "GET", /^\/healthcare\/imports(?:\/:id)?$/, "src/modules/healthcare/ImportPanel.tsx", ["Lịch sử nhập Excel"], [
    "Mở Nhập Excel → Lịch sử. Chọn đúng đợt theo loại nhập, thời điểm và tên tệp để xem tiến độ, số dòng thành công/lỗi và dữ liệu đã lưu.",
  ]),
  procedure("healthcare-import-rows", "POST", /^\/healthcare\/imports\/:id\/rows\/search$/, "src/modules/healthcare/ImportJobDetails.tsx", ["Chi tiết từng dòng"], [
    "Mở đúng đợt nhập trong Lịch sử, xem Chi tiết từng dòng. Đối chiếu trạng thái và nguyên nhân lỗi của từng dòng; dùng liên kết Mở hồ sơ hoặc Mở phiếu khám để kiểm tra dữ liệu đã lưu.",
  ]),
  procedure("healthcare-import-template", "GET", /^\/healthcare\/imports\/template\/:kind$/, "src/modules/healthcare/ImportPanel.tsx", ["Tải file mẫu"], [
    "Mở Nhập Excel ở tab dữ liệu phù hợp, chọn đúng loại nhập rồi chọn Tải file mẫu. Điền theo các cột mẫu trước khi tải lên và kiểm tra.",
  ]),
  procedure("hr-project-create", "POST", /^\/kanban\/projects$/, hr + "KanbanTab.tsx", ["Tạo dự án & lĩnh vực", "Lưu dự án"], [
    "Trong Giao Việc, chọn Tạo dự án & lĩnh vực. Điền tên dự án, phạm vi và thông tin cần thiết, kiểm tra rồi chọn Lưu dự án.",
  ]),
  procedure("hr-project-update", "PATCH", /^\/kanban\/projects\/:id$/, hr + "KanbanTab.tsx", ["Sửa dự án", "Lưu dự án"], [
    "Chọn Sửa dự án trên đúng dự án công việc. Cập nhật nội dung rồi chọn Lưu dự án; kiểm tra lại dự án và các công việc đang thuộc dự án.",
  ]),
  procedure("hr-project-delete", "DELETE", /^\/kanban\/projects\/:id$/, hr + "KanbanTab.tsx", ["Xóa dự án"], [
    "Chọn Xóa dự án tại đúng dự án trong Giao Việc. Đọc ảnh hưởng đến các công việc liên quan trước khi xác nhận; không nhầm với dự án lao động hoặc kiến trúc.",
  ]),
  procedure("hr-task-create", "POST", /^\/kanban\/tasks$/, hr + "KanbanTab.tsx", ["Tạo công việc mới", "Tạo công việc"], [
    "Trong Giao Việc, mở công việc mới. Chọn dự án, người thực hiện, nhập nội dung và thời hạn; kiểm tra tệp hoặc liên kết đính kèm nếu có.", "Chọn Tạo công việc, tìm lại thẻ công việc trong đúng dự án.",
  ]),
  procedure("hr-task-update", "PATCH", /^\/kanban\/tasks\/:id$/, hr + "KanbanTab.tsx", ["Lưu thay đổi", "Để đánh dấu Hoàn thành, cần điền"], [
    "Mở đúng thẻ công việc và chỉnh thông tin cần đổi. Nếu chuyển Hoàn thành, điền các thông tin kết quả được màn hình yêu cầu trước khi lưu.", "Chọn Lưu thay đổi rồi đối chiếu trạng thái, người thực hiện và thời hạn của công việc.",
  ]),
  procedure("hr-task-delete", "DELETE", /^\/kanban\/tasks\/:id$/, hr + "KanbanTab.tsx", ["Xóa công việc"], [
    "Mở đúng công việc, chọn Xóa công việc, kiểm tra tên công việc và dự án trong xác nhận rồi đồng ý khi đúng yêu cầu.",
  ]),
  procedure("hr-task-read", "GET", /^\/kanban\/(tasks|projects)$/, hr + "KanbanTab.tsx", ["KanbanTab"], [
    "Trong Giao Việc, chọn đúng dự án và xem danh sách hoặc các cột trạng thái. Tìm công việc theo tiêu đề và người phụ trách; mở thẻ để xem thời hạn, nội dung và hoạt động.",
  ]),
  procedure("branch-read", "GET", /^\/auth\/branches$/, "src/components/settings/BranchManagementTab.tsx", ["BranchManagementTab"], [
    "Mở Chi nhánh trong Nhân sự, đối chiếu danh sách chi nhánh thuộc doanh nghiệp. Xem mã, tên, người quản lý và trạng thái thiết lập trước khi chọn chi nhánh cần làm việc.",
  ]),
  procedure("branch-create", "POST", /^\/auth\/branches$/, "src/components/settings/BranchManagementTab.tsx", ["Thêm chi nhánh", "Tạo chi nhánh"], [
    "Chọn Thêm chi nhánh, nhập thông tin và kiểm tra mã chi nhánh. Chọn Tạo chi nhánh, sau đó kiểm tra trạng thái thiết lập; việc tạo chi nhánh chưa thay thế bước thiết lập chủ hoặc quyền truy cập.",
  ]),
  procedure("branch-update", "PATCH", /^\/auth\/branches\/:id$/, "src/components/settings/BranchManagementTab.tsx", ["Sửa chi nhánh", "Lưu cập nhật"], [
    "Chọn Sửa chi nhánh tại đúng chi nhánh, cập nhật thông tin được phép thay đổi rồi chọn Lưu cập nhật. Đối chiếu lại mã và tên chi nhánh.",
  ]),
  procedure("training-delete", "DELETE", /^\/crud\/training-courses\/:id$/, hr + "TrainingTab.tsx", ["Xóa khóa học này?", "Xóa khóa học"], [
    "Trong Đào tạo, chọn xóa tại đúng khóa nội bộ. Đọc xác nhận Xóa khóa học này? và ảnh hưởng đến nội dung, học viên trước khi chọn Xóa khóa học.",
  ]),
  procedure("workflow-delete", "DELETE", /^\/crud\/workflows\/:id$/, hr + "WorkflowTab.tsx", ["Xóa quy trình?", "Xóa quy trình"], [
    "Mở thao tác Xóa quy trình của đúng quy trình, đọc xác nhận và kiểm tra các bước/giai đoạn liên quan trước khi đồng ý.",
  ]),
  procedure("workflow-category", "POST", /^\/crud\/workflow-categories$/, hr + "WorkflowTab.tsx", ["Tạo nhãn phân loại", "Tạo nhãn"], [
    "Trong Quy trình, mở Tạo nhãn phân loại. Nhập tên nhãn, kiểm tra nhãn đã có rồi chọn Tạo nhãn; đối chiếu nhãn mới trong danh sách phân loại.",
  ]),
  procedure("hr-attendance-read", "GET", /^\/timekeeping\/(records|monthly-report)$/, hr + "CalendarTab.tsx", ["CalendarTab", "bảng chấm công"], [
    "Mở Nhân sự → Lịch → Chấm công & Lịch làm việc. Chọn đúng ngày hoặc tháng và phạm vi nhân sự trên bảng chấm công.", "Đối chiếu từng người với trạng thái đi làm, trễ, vắng, nghỉ phép hoặc thiếu chấm công theo yêu cầu. Với báo cáo ngưỡng hoặc xếp hạng, đối chiếu số ngày/công trong bảng; không coi thiếu bản ghi là đã nghỉ phép.",
  ]),
  procedure("hr-attendance-adjust", "PATCH", /^\/timekeeping\/records\/adjust$/, hr + "CalendarTab.tsx", ["Sửa lịch sử chấm công", "Lưu thay đổi"], [
    "Trong bảng chấm công, mở đúng nhân viên và ngày cần điều chỉnh. Chọn Sửa lịch sử chấm công, cập nhật giờ/trạng thái và ghi chú theo biểu mẫu.", "Kiểm tra đúng người, ngày và ca rồi chọn Lưu thay đổi; mở lại lịch sử để đối chiếu.",
  ]),
  procedure("hr-shifts-read", "GET", /^\/timekeeping\/shifts$/, "src/components/settings/WorkShiftsTab.tsx", ["WorkShiftsTab"], [
    "Mở Lịch → Ca làm việc, xem danh sách ca. Đối chiếu mã/tên ca, giờ bắt đầu, giờ kết thúc và thời gian nghỉ trước khi dùng ca để phân công.",
  ]),
  procedure("hr-shifts-save", "POST|PATCH", /^\/timekeeping\/shifts(?:\/:id)?$/, "src/components/settings/WorkShiftsTab.tsx", ["Thêm ca", "Lưu ca"], [
    "Mở Lịch → Ca làm việc. Chọn Thêm ca hoặc mở ca cần sửa, nhập tên ca và giờ làm, kiểm tra ca qua đêm nếu áp dụng rồi chọn Lưu ca.",
  ]),
  procedure("hr-work-hours", "PATCH", /^\/timekeeping\/work-hours\/:uid$/, "src/components/settings/EmployeeWorkHoursTab.tsx", ["Lưu"], [
    "Mở Lịch → Giờ làm việc riêng, chọn đúng nhân sự. Điều chỉnh giờ làm riêng và các ngày áp dụng, kiểm tra rồi chọn Lưu; đối chiếu lại cấu hình của nhân sự.",
  ]),
  procedure("hr-work-calendar-read", "GET", /^\/timekeeping\/work-calendar$/, "src/components/settings/CompanyWorkCalendarTab.tsx", ["CompanyWorkCalendarTab"], [
    "Mở Lịch → Lịch nghỉ lễ. Chọn đúng phạm vi thời gian, xem các ngày nghỉ và ngày làm việc ngoại lệ; đối chiếu tên ngày, thời gian và phạm vi áp dụng.",
  ]),
  procedure("hr-work-calendar-save", "POST|PATCH", /^\/timekeeping\/work-calendar(?:\/:id)?$/, "src/components/settings/CompanyWorkCalendarTab.tsx", ["Thêm ngày", "Lưu thay đổi"], [
    "Trong Lịch nghỉ lễ, chọn Thêm ngày hoặc sửa đúng ngày đã có. Đặt loại ngày, thời gian và phạm vi áp dụng, ghi lý do theo yêu cầu rồi lưu thay đổi.",
  ]),
  procedure("hr-work-calendar-delete", "DELETE", /^\/timekeeping\/work-calendar\/:id$/, "src/components/settings/CompanyWorkCalendarTab.tsx", ["Xóa ngày khỏi lịch công ty?"], [
    "Trong Lịch nghỉ lễ, chọn xóa tại đúng ngày. Đọc xác nhận Xóa ngày khỏi lịch công ty? và kiểm tra ảnh hưởng tới lịch làm việc trước khi đồng ý.",
  ]),
  procedure("hr-contract-read", "GET", /^\/hr-contracts$/, hr + "ContractsTab.tsx", ["ContractsTab"], [
    "Mở Hợp đồng trong Nhân sự, chọn phạm vi nhân sự và lọc trạng thái hoặc thời hạn phù hợp. Đối chiếu tên nhân sự, số hợp đồng, ngày hiệu lực và ngày kết thúc.", "Nếu cần danh sách chưa có hợp đồng hoặc sắp hết hạn, đối chiếu trạng thái và hạn hợp đồng trong màn hình; không tạo hợp đồng mới chỉ để tra cứu.",
  ]),
  procedure("hr-contract-save", "POST|PATCH", /^\/hr-contracts(?:\/:id)?$/, hr + "ContractsTab.tsx", ["Tạo hợp đồng", "Lưu"], [
    "Mở Hợp đồng trong Nhân sự, chọn Tạo hợp đồng hoặc Sửa tại đúng hợp đồng. Chọn nhân sự, nhập số hợp đồng, loại, thời hạn và nội dung cần thiết.", "Đối chiếu hợp đồng hiện có của nhân sự, chọn Lưu rồi kiểm tra lại kỳ hiệu lực và tài liệu đính kèm.",
  ]),
  procedure("hr-contract-extend", "POST", /^\/hr-contracts\/:id\/extensions$/, hr + "ContractsTab.tsx", ["Tạo gia hạn"], [
    "Mở đúng hợp đồng nhân sự, chọn Tạo gia hạn. Điền thời hạn và thông tin gia hạn, kiểm tra liên tục với kỳ trước rồi lưu; mở lịch sử để đối chiếu.",
  ]),
  procedure("recruitment-read-jobs", "GET", /^\/recruitment\/jobs(?:\/:id)?$/, hr + "recruitment/RecruitmentJobsView.tsx", ["Lọc trạng thái tin tuyển dụng"], [
    "Trong Tuyển dụng → Tin tuyển dụng, tìm theo tên/mã tin và lọc trạng thái. Mở đúng tin để đọc vị trí, số lượng và yêu cầu tuyển dụng.",
  ]),
  procedure("recruitment-read-applicants", "GET", /^\/recruitment\/applicants(?:\/:id)?$/, hr + "recruitment/RecruitmentApplicantsView.tsx", ["RecruitmentApplicantsView"], [
    "Mở Tuyển dụng → Ứng viên, chọn đúng tin tuyển dụng và tìm ứng viên theo thông tin liên hệ. Mở hồ sơ để đối chiếu trạng thái và thông tin ứng viên.",
  ]),
  procedure("recruitment-read-interviews", "GET", /^\/recruitment\/interviews(?:\/:id)?$/, hr + "recruitment/RecruitmentInterviewsWorkspace.tsx", ["RecruitmentInterviewsWorkspace"], [
    "Mở Tuyển dụng → Phỏng vấn, chọn thời gian và trạng thái cần xem. Đối chiếu đúng ứng viên, người phỏng vấn và thời điểm trong lịch.",
  ]),
  procedure("recruitment-status", "POST", /^\/recruitment\/jobs\/:id\/status$/, hr + "recruitment/RecruitmentJobsView.tsx", ["changeStatus", "Trạng thái"], [
    "Trong Tin tuyển dụng, tìm đúng tin và đổi bộ chọn Trạng thái trên dòng tin. Nếu mở tuyển, bổ sung các điều kiện bắt buộc được màn hình báo thiếu rồi kiểm tra trạng thái đã lưu.",
  ]),
  procedure("recruitment-delete-job", "POST", /^\/recruitment\/jobs\/:id\/delete$/, hr + "recruitment/RecruitmentJobsView.tsx", ["Xóa tin tuyển dụng?", "Xóa tin"], [
    "Chọn Xóa tại đúng tin tuyển dụng, đọc xác nhận Xóa tin tuyển dụng? rồi chọn Xóa tin khi đúng yêu cầu.",
  ]),
  procedure("recruitment-delete-interview", "POST", /^\/recruitment\/interviews\/:id\/delete$/, hr + "recruitment/RecruitmentInterviewsWorkspace.tsx", ["Xóa lịch phỏng vấn?", "Xóa lịch"], [
    "Chọn xóa tại đúng lịch phỏng vấn, kiểm tra ứng viên và thời gian trong hộp Xóa lịch phỏng vấn? rồi chọn Xóa lịch.",
  ]),
  procedure("payroll-review", "POST", /^\/payroll\/runs\/:id\/review$/, hr + "PayrollTab.tsx", ["payrollService.reviewRun"], [
    "Chọn đúng kỳ lương nháp đã có dữ liệu. Rà công, khoản thu nhập và khấu trừ, sau đó chọn Kiểm tra để chuyển kỳ sang bước kiểm tra.",
  ]),
  procedure("payroll-close", "POST", /^\/payroll\/runs\/:id\/close$/, hr + "PayrollTab.tsx", ["Chốt kỳ"], [
    "Mở kỳ lương ở bước kiểm tra, đối chiếu số liệu đã được xác thực và các điều chỉnh. Chọn Chốt kỳ rồi kiểm tra trạng thái kỳ trước khi phát hành phiếu lương.",
  ]),
  procedure("payroll-mark-paid", "POST", /^\/payroll\/runs\/:id\/mark-paid$/, hr + "PayrollTab.tsx", ["Đánh dấu đã thanh toán"], [
    "Mở đúng kỳ lương đủ điều kiện và đối chiếu việc trả lương thực tế. Chọn Đánh dấu đã thanh toán, đọc xác nhận và đồng ý khi đã kiểm tra chứng từ.", "Thao tác này ghi nhận trạng thái; không phải lệnh chuyển tiền ngân hàng. Kiểm tra lại trạng thái kỳ sau khi lưu.",
  ]),
  procedure("payroll-payslips-publish", "POST", /^\/payroll\/runs\/:id\/payslips\/publish$/, hr + "payroll/PayrollPayslipsPanel.tsx", ["Phát hành phiếu lương"], [
    "Mở đúng kỳ đã chốt hoặc đã thanh toán, kiểm tra các phiếu lương. Trong Phiếu lương, chọn Phát hành phiếu lương hoặc Phát hành lại phiếu lương khi muốn cập nhật bản đã phát hành.", "Kiểm tra số lượng phiếu được công bố; chỉ phát hành lại khi đã đối chiếu số liệu mới.",
  ]),
  procedure("payroll-reset", "DELETE", /^\/payroll\/periods\/:periodKey$/, hr + "PayrollTab.tsx", ["Xóa kỳ lương?", "Xóa kỳ lương"], [
    "Chọn đúng kỳ lương cần đặt lại, chọn Xóa kỳ lương. Đọc toàn bộ ảnh hưởng trong hộp xác nhận, đối chiếu dữ liệu đã chốt hoặc thanh toán trước khi đồng ý.",
  ]),
  procedure("payroll-line-detail", "GET", /^\/payroll\/runs\/:id\/lines\/:employeeId$/, hr + "PayrollTab.tsx", ["Chi tiết công thức lương"], [
    "Chọn đúng kỳ, tìm dòng nhân viên và mở chi tiết công thức lương. Đối chiếu công, thu nhập, các khoản khấu trừ và thực lĩnh; không sửa dữ liệu khi chỉ cần xem cách tính.",
  ]),
  procedure("celebration-read", "GET", /^\/company-email\/celebration(?:\/history)?$/, hr + "CelebrationEmailTab.tsx", ["CelebrationEmailTab", "Đã gửi"], [
    "Mở Email chúc mừng trong Nhân sự để xem cấu hình. Với lịch sử gửi, xem danh sách và trạng thái Đã gửi hoặc lỗi, đối chiếu người nhận và thời điểm trước khi gửi lại.",
  ]),
  procedure("celebration-settings", "PATCH", /^\/company-email\/celebration$/, hr + "CelebrationEmailTab.tsx", ["Lưu cấu hình"], [
    "Trong Email chúc mừng, chỉnh nội dung và điều kiện gửi cần thay đổi. Kiểm tra đối tượng và lịch áp dụng rồi chọn Lưu cấu hình; xem lại cấu hình đã lưu.",
  ]),
  procedure("celebration-preview", "POST", /^\/company-email\/celebration\/preview$/, hr + "CelebrationEmailTab.tsx", ["Xem trước"], [
    "Trong Email chúc mừng, chọn nội dung cần kiểm tra rồi chọn Xem trước. Đối chiếu tiêu đề, nội dung và thông tin thay thế; xem trước không yêu cầu gửi thư thật.",
  ]),
  procedure("labor-partner-read", "GET", /^\/worker-management\/partners(?:\/:partnerId(?:\/overview|\/referrals)?)?$/, worker + "partners/components/LaborPartnerManagementPanel.tsx", ["LaborPartnerManagementPanel"], [
    "Trong Đối tác lao động → Đối tác, tìm đúng đối tác và mở chi tiết. Đối chiếu thông tin liên hệ, nguồn giới thiệu, trạng thái xác nhận và các kỳ hoa hồng; xem đúng khoảng thời gian cần tra cứu.",
  ]),
  procedure("labor-partner-update", "PATCH", /^\/worker-management\/partners\/:partnerId$/, worker + "partners/components/LaborPartnerManagementPanel.tsx", ["Lưu thay đổi"], [
    "Mở chỉnh sửa của đúng đối tác lao động. Cập nhật thông tin cần thay đổi, kiểm tra mã và liên hệ rồi chọn Lưu thay đổi; mở lại hồ sơ để đối chiếu.",
  ]),
  procedure("labor-policy-read", "GET", /^\/worker-management\/partners\/policies(?:\/:policyId)?$/, worker + "partners/components/LaborPartnerPoliciesPanel.tsx", ["Tên chính sách", "Trạng thái"], [
    "Mở Chính sách hoa hồng trong Đối tác lao động, xem tên, hiệu lực, cơ chế chính thức/thời vụ và trạng thái. Mở chính sách cần đọc để đối chiếu các mốc tháng, bậc giờ và cách làm tròn.",
  ]),
  procedure("labor-policy-update", "PATCH", /^\/worker-management\/partners\/policies\/:policyId$/, worker + "partners/components/LaborPartnerPoliciesPanel.tsx", ["Sửa chính sách", "Lưu chính sách"], [
    "Chọn Sửa chính sách tại đúng chính sách hoa hồng. Kiểm tra thời điểm hiệu lực, chu kỳ, mốc tháng hoặc bậc giờ; sửa thông tin rồi chọn Lưu chính sách.",
  ]),
  procedure("labor-policy-activate", "POST", /^\/worker-management\/partners\/policies\/:policyId\/activate$/, worker + "partners/components/LaborPartnerPoliciesPanel.tsx", ["Kích hoạt chính sách", "Kích hoạt lại chính sách"], [
    "Tìm đúng chính sách, kiểm tra hiệu lực và cơ chế tính trước khi chọn Kích hoạt hoặc Dùng lại. Đối chiếu trạng thái Đang dùng trước khi gắn cho nguồn giới thiệu.",
  ]),
  procedure("labor-policy-retire", "POST", /^\/worker-management\/partners\/policies\/:policyId\/retire$/, worker + "partners/components/LaborPartnerPoliciesPanel.tsx", ["Ngừng áp dụng chính sách"], [
    "Chọn Ngừng áp dụng chính sách tại đúng chính sách đang dùng, đọc ảnh hưởng và xác nhận. Kiểm tra trạng thái Đã ngừng; không xóa dữ liệu đối soát lịch sử để ngừng chính sách.",
  ]),
  procedure("labor-policy-delete", "DELETE", /^\/worker-management\/partners\/policies\/:policyId$/, worker + "partners/components/LaborPartnerPoliciesPanel.tsx", ["Xóa chính sách"], [
    "Chọn Xóa chính sách tại đúng bản ghi, kiểm tra các nguồn giới thiệu hoặc kỳ đối soát đang sử dụng. Xác nhận khi hệ thống cho phép và đúng yêu cầu cần xóa.",
  ]),
  procedure("labor-kpi-read", "GET", /^\/worker-management\/partners\/kpi$/, worker + "partners/components/LaborPartnerKpiPanel.tsx", ["LaborPartnerKpiPanel"], [
    "Mở KPI giới thiệu, chọn kỳ và đối tác cần xem. Đối chiếu chỉ tiêu cùng số giới thiệu thực tế; dùng phần Đối soát để kiểm tra số hoa hồng thay vì coi KPI là số đã chi.",
  ]),
  procedure("labor-kpi-save", "PUT", /^\/worker-management\/partners\/kpi\/:partnerId$/, worker + "partners/components/LaborPartnerKpiPanel.tsx", ["Lưu"], [
    "Trong KPI giới thiệu, chọn đúng kỳ và đối tác, nhập chỉ tiêu giới thiệu cần đặt. Chọn Lưu rồi kiểm tra lại chỉ tiêu của kỳ.",
  ]),
  procedure("labor-referral-confirm", "POST", /^\/worker-management\/partners\/:partnerId\/referrals\/:referralId\/confirm$/, worker + "partners/components/LaborPartnerManagementPanel.tsx", ["Chờ xác nhận", "Xác nhận"], [
    "Mở chi tiết đối tác và danh sách nguồn giới thiệu, tìm đúng lao động đang Chờ xác nhận. Sau khi đối tác đã xác nhận nguồn giới thiệu, chọn Xác nhận ở đúng dòng; kiểm tra trạng thái trước khi tính hoa hồng.",
  ]),
  procedure("labor-referral-end", "POST", /^\/worker-management\/partners\/:partnerId\/referrals\/:referralId\/end$/, worker + "partners/components/LaborPartnerManagementPanel.tsx", ["Kết thúc"], [
    "Mở nguồn giới thiệu của đúng đối tác và lao động, chọn Kết thúc. Kiểm tra thời điểm kết thúc theo biểu mẫu và xác nhận; đối chiếu hiệu lực nguồn giới thiệu sau đó.",
  ]),
  procedure("labor-settlement-read", "GET", /^\/worker-management\/partners\/(settlements(?:\/:settlementId)?|dashboard|reports\/commission)$/, worker + "partners/components/LaborPartnerSettlementsPanel.tsx", ["LaborPartnerSettlementsPanel"], [
    "Mở Đối soát, chọn đối tác, kỳ thời gian và trạng thái cần xem. Đọc tổng hợp rồi mở chi tiết kỳ để đối chiếu từng lao động, cơ chế tính, số đã duyệt, đã chi và còn phải chi.",
  ]),
  procedure("labor-settlement-recalculate", "POST", /^\/worker-management\/partners\/settlements\/:settlementId\/recalculate$/, worker + "partners/components/LaborPartnerSettlementsPanel.tsx", ["Tính lại kỳ này từ dữ liệu nguồn hiện tại?"], [
    "Mở đúng kỳ đối soát còn được phép tính lại, kiểm tra nguồn giới thiệu, hợp đồng và công. Chọn Tính lại, đọc cảnh báo các dòng nháp sẽ được thay thế, xác nhận rồi đối chiếu kết quả mới.",
  ]),
  procedure("labor-settlement-approve", "POST", /^\/worker-management\/partners\/settlements\/:settlementId\/approve$/, worker + "partners/components/LaborPartnerSettlementsPanel.tsx", ["Duyệt"], [
    "Mở kỳ đối soát đã tính, rà từng dòng và số tiền hoa hồng cùng dữ liệu nguồn. Chọn Duyệt theo quyền được cấp, kiểm tra kỳ chuyển sang Đã duyệt trước khi chi trả.",
  ]),
  procedure("labor-settlement-payout", "POST", /^\/worker-management\/partners\/settlements\/:settlementId\/payouts$/, worker + "partners/components/LaborPartnerSettlementsPanel.tsx", ["Xác nhận chi trả"], [
    "Mở đúng kỳ đã duyệt, kiểm tra số dư còn phải chi và lịch sử chi trả. Nhập số tiền, phương thức và tham chiếu chứng từ rồi chọn Xác nhận chi trả.", "Đối chiếu số đã chi và còn lại; không bấm lại nếu khoản chi đã xuất hiện trong lịch sử.",
  ]),
  procedure("retail-checkout", "POST", /^\/retail\/orders\/checkout$/, "src/modules/retail/components/pos/PaymentDialog.tsx", ["Xác nhận thanh toán"], [
    "Trong Bán lẻ, chọn Vào quầy POS bằng tài khoản có phiên bán hàng đang mở. Chọn khách hàng, thêm đúng SKU, số lượng và IMEI/serial nếu áp dụng; kiểm tra giá, ưu đãi và điểm dùng.",
    "Chọn Thanh toán, nhập phương thức và số tiền, đối chiếu tổng đơn rồi chọn Xác nhận thanh toán. Với chuyển khoản, theo dõi trạng thái nhận tiền; không coi mã QR là bằng chứng đã thanh toán.",
    "Kiểm tra đơn và hóa đơn đã được lưu trước khi tạo lại giỏ hoặc thanh toán lần nữa.",
  ]),
  procedure("retail-shift-open", "POST", /^\/retail\/shifts\/open$/, "src/modules/retail/pages/RetailShiftWorkspace.tsx", ["Mở phiên cho nhân viên", "Mở phiên"], [
    "Mở Ca POS, chọn nhân viên được mở phiên và nhập tiền đầu ca theo biểu mẫu. Đối chiếu chi nhánh, nhân viên và phiên còn mở rồi chọn Mở phiên.", "Thu ngân đăng nhập bằng chính tài khoản được mở phiên để vào quầy POS; không dùng tài khoản quản lý bán thay phiên người khác.",
  ]),
  procedure("retail-shift-close", "POST", /^\/retail\/shifts\/:id\/close$/, "src/modules/retail/pages/RetailShiftWorkspace.tsx", ["Đóng phiên", "Xác nhận đóng phiên"], [
    "Tìm đúng phiên POS, chọn Đóng phiên. Kiểm đếm tiền thực tế, nhập số tiền và ghi chú chênh lệch, kiểm tra các giao dịch đang chờ trước khi chọn Xác nhận đóng phiên.", "Kiểm tra trạng thái phiên đã đóng và số tiền chênh lệch để thực hiện đối soát.",
  ]),
  procedure("retail-shift-cash", "POST", /^\/retail\/shifts\/:id\/cash-movements$/, "src/modules/retail/pages/RetailShiftWorkspace.tsx", ["Thu / chi quỹ", "Xác nhận bổ sung", "Xác nhận rút tiền"], [
    "Mở đúng phiên, chọn Thu / chi quỹ. Chọn chiều thu hoặc chi, nhập số tiền và lý do; kiểm tra tiền thực tế với phiên đang xử lý.", "Chọn Xác nhận bổ sung hoặc Xác nhận rút tiền đúng chiều giao dịch, rồi kiểm tra dòng thu chi và số dư phiên.",
  ]),
  procedure("retail-shift-reconcile", "POST", /^\/retail\/shifts\/:id\/reconcile$/, "src/modules/retail/pages/RetailShiftDetailDialog.tsx", ["Xác nhận đối soát"], [
    "Mở chi tiết đúng phiên đã đóng, đối chiếu tiền đầu ca, các khoản thu chi, tiền thực đếm và chênh lệch. Điền ghi chú rồi chọn Xác nhận đối soát; kiểm tra trạng thái cuối cùng.",
  ]),
  procedure("retail-shift-read", "GET", /^\/retail\/shifts(?:\/:id)?$/, "src/modules/retail/pages/RetailShiftWorkspace.tsx", ["Chi tiết"], [
    "Mở Ca POS, chọn khoảng ngày, nhân viên và trạng thái cần xem. Mở Chi tiết của đúng phiên để đọc giao dịch, thu chi, tiền thực đếm và kết quả đối soát.",
  ]),
  procedure("retail-invoices-read", "GET", /^\/retail\/invoices(?:\/:id)?$/, "src/modules/retail/pages/RetailInvoicesPageContent.tsx", ["Chi tiết sản phẩm"], [
    "Trong Hóa đơn, tìm đúng mã hóa đơn hoặc đơn hàng và khoảng thời gian. Mở hóa đơn để kiểm tra khách hàng, sản phẩm, thuế và trạng thái thanh toán; không thu tiền lại khi chỉ cần xem.",
  ]),
  procedure("retail-points-policy", "PUT", /^\/retail\/points\/policy$/, "src/modules/retail/components/coupons/RetailPointsPanel.tsx", ["Lưu chính sách"], [
    "Mở Ưu đãi và điểm → phần điểm, xem chính sách hiện tại. Cập nhật tỷ lệ tích hoặc sử dụng điểm và điều kiện áp dụng rồi chọn Lưu chính sách; kiểm tra lại cấu hình.",
  ]),
  procedure("retail-finance-voucher", "POST", /^\/retail\/finance\/cashbook\/vouchers$/, "src/modules/retail/pages/RetailFinancePage.tsx", ["Tạo phiếu"], [
    "Mở Bán lẻ → Tài chính → Sổ quỹ, chọn ngày và phạm vi chi nhánh. Điền tài khoản, chiều thu/chi, số tiền, lý do và mã tham chiếu; kiểm tra giao dịch chưa được ghi từ nguồn khác.", "Chọn Tạo phiếu rồi đối chiếu dòng sổ quỹ và số dư. Không ghi thêm phiếu cho khoản thu đã phát sinh từ đơn hàng hoặc ca POS.",
  ]),
  procedure("retail-finance-close", "POST", /^\/retail\/finance\/cashbook\/close$/, "src/modules/retail/pages/RetailFinancePage.tsx", ["Chốt kỳ quỹ", "Chốt kỳ"], [
    "Trong Tài chính → Sổ quỹ, chọn đúng khoảng kỳ. Đối chiếu các phiên, thu chi và chênh lệch trước khi chọn Chốt kỳ quỹ; đọc xác nhận rồi chọn Chốt kỳ.",
  ]),
  procedure("retail-commission-policy", "POST|PATCH", /^\/retail\/partners\/commission-policies(?:\/:id)?$/, "src/modules/retail/components/RetailCommissionPoliciesPanel.tsx", ["Tạo chính sách hoa hồng", "Lưu phiên bản"], [
    "Mở phần chính sách hoa hồng của Đối tác bán lẻ. Tạo mới hoặc sửa đúng chính sách, chọn phạm vi cộng tác viên, sản phẩm và thời gian áp dụng.", "Kiểm tra tỷ lệ hoặc số tiền hoa hồng rồi chọn Lưu phiên bản; xem lại phiên bản và trạng thái áp dụng.",
  ]),
  procedure("retail-product-commissions", "PUT", /^\/retail\/partners\/product-commissions$/, "src/modules/retail/components/RetailProductCommissionsPanel.tsx", ["Lưu cấu hình"], [
    "Trong Đối tác bán lẻ, mở cấu hình hoa hồng theo sản phẩm. Chọn đúng sản phẩm/SKU, đối tác và mức hoa hồng cần áp dụng rồi chọn Lưu cấu hình; đối chiếu lại các dòng đã đổi.",
  ]),
  procedure("retail-coupon-update", "PUT", /^\/retail\/coupons\/:id$/, "src/modules/retail/pages/RetailCouponsPage.tsx", ["Sửa mã ưu đãi", "Lưu mã"], [
    "Trong Ưu đãi và điểm, chọn Sửa tại đúng mã. Chỉnh thời hạn hoặc điều kiện được phép đổi, kiểm tra số lượt đã dùng rồi chọn Lưu mã.",
  ]),
  procedure("retail-coupon-automation", "POST|PUT", /^\/retail\/coupons\/automations(?:\/:id)?$/, "src/modules/retail/components/coupons/CouponAutomationEditor.tsx", ["Tạo chương trình tặng mã", "Lưu chương trình"], [
    "Trong Ưu đãi và điểm, mở phần chương trình tặng mã. Tạo hoặc sửa chương trình, chọn điều kiện kích hoạt, giá trị ưu đãi, thời hạn và kênh gửi.", "Kiểm tra đối tượng áp dụng trước khi chọn Lưu chương trình; xem lại trạng thái bật/tắt sau khi lưu.",
  ]),
  procedure("finance-treasury-match", "POST", /^\/finance\/reporting\/treasury\/bank-lines\/:id\/match$/, "src/modules/finance/pages/TreasuryPage.tsx", ["Ghép phiếu"], [
    "Trong Sổ quỹ & dòng tiền → Đối soát, tìm đúng dòng sao kê chưa ghép. Chọn Ghép phiếu, đối chiếu tài khoản, số tiền có dấu, ngày và mã tham chiếu với phiếu đã ghi sổ.", "Chọn đúng phiếu rồi xác nhận; kiểm tra dòng sao kê đã khớp và không ghép lại giao dịch khác.",
  ]),
  procedure("finance-treasury-reconcile", "POST", /^\/finance\/reporting\/treasury\/reconciliations$/, "src/modules/finance/pages/TreasuryPage.tsx", ["Số tiền thực tế (VND)", "Căn cứ / ghi chú"], [
    "Trong Sổ quỹ & dòng tiền → Đối soát, chọn kiểm kê đúng quỹ. Nhập số tiền thực tế và căn cứ đối chiếu rồi lưu.", "Xem lại chênh lệch; thao tác này ghi nhận đối soát, không tự điều chỉnh số dư sổ quỹ.",
  ]),
];
// Keep additional procedures explicit: endpoint families do not imply UI support.
MANUAL_PROCEDURES.push(
  procedure("repair-refund-read", "GET", /^\/repair\/tickets\/:id\/refunds$/, "src/modules/repair/RepairRefundPanel.tsx", ["Các khoản đã hoàn", "Còn có thể hoàn"], [
    "Mở đúng phiếu sửa chữa, tìm Hoàn tiền sửa chữa. Đối chiếu Đã thu, Đã hoàn, Thực còn lại và Còn có thể hoàn; đọc Các khoản đã hoàn theo ngày, lý do và phiếu chi. Không ghi khoản hoàn khi chỉ tra cứu.",
  ]),
  procedure("repair-refund-vouchers", "GET", /^\/repair\/tickets\/:id\/refunds\/vouchers$/, "src/modules/repair/RepairRefundPanel.tsx", ["Phiếu chi đã duyệt", "Tải lại phiếu chi"], [
    "Trong Hoàn tiền sửa chữa của đúng phiếu, xem danh sách Phiếu chi đã duyệt; chọn Tải lại phiếu chi nếu cần cập nhật. Đối chiếu mã, số tiền và ngày; không chọn Ghi nhận khoản hoàn khi chỉ xem phiếu đủ điều kiện.",
  ]),
  procedure("repair-refund-create", "POST", /^\/repair\/tickets\/:id\/refunds$/, "src/modules/repair/RepairRefundPanel.tsx", ["Ghi nhận khoản hoàn", "Đối chiếu kết quả"], [
    "Mở đúng phiếu sửa chữa → Hoàn tiền sửa chữa. Kiểm tra Các khoản đã hoàn và số Còn có thể hoàn; chuẩn bị phiếu chi đã được duyệt trong Tài chính.",
    "Chọn Phiếu chi đã duyệt, nhập số tiền hoàn, phần tiền công và lý do. Kiểm tra số tiền không vượt phần còn được hoàn rồi chọn Ghi nhận khoản hoàn.",
    "Đối chiếu Các khoản đã hoàn và số tiền còn lại. Nếu có yêu cầu chờ xác minh, chọn Đối chiếu kết quả trước; không tạo khoản hoàn mới cho cùng giao dịch.",
  ]),
  procedure("repair-reports", "GET", /^\/repair\/reports\/(revenue|technician-performance)$/, "src/modules/repair/RepairReportsPanel.tsx", ["Xem báo cáo", "Nhóm theo"], [
    "Trong Báo cáo sửa chữa, chọn Từ ngày, Đến ngày và cách Nhóm theo rồi chọn Xem báo cáo. Đọc bảng doanh thu hoặc hiệu suất kỹ thuật viên trong cùng kỳ; cột giá vốn/lãi chỉ xuất hiện khi tài khoản có quyền xem.",
  ]),
  procedure("quotation-catalog-bulk", "POST", /^\/quotation\/catalog\/bulk$/, "src/modules/quotation/CatalogBulkDialog.tsx", ["Xem trước thay đổi", "Xác nhận {items.length} sản phẩm"], [
    "Trong Bảng giá, đánh dấu đúng các sản phẩm rồi chọn thao tác muốn áp dụng trên thanh Thao tác sản phẩm đã chọn. Nếu đổi giá, nhập kiểu điều chỉnh và mức tăng/giảm.",
    "Chọn Xem trước thay đổi, đối chiếu từng sản phẩm và giá trị trước/sau rồi xác nhận đúng số sản phẩm. Tải lại danh sách để kiểm tra kết quả; không xác nhận nếu lựa chọn hoặc giá trị chưa đúng.",
  ]),
);
const READ_ONLY_STEPS: Record<string, string[]> = {
  "course-categories": ["Trong Khóa học, mở quản lý phân loại và xem các tên phân loại hiện có. Không dùng Thêm hoặc Xóa khi chỉ cần tra cứu."],
  "batch-progress-colors": ["Trong Lớp học, mở Cấu hình màu tiến độ lớp để xem màu của từng mức tiến độ; đóng biểu mẫu sau khi xem, không cần Lưu màu."],
  "resource-category": ["Trong Thiết bị hoặc Phòng học, mở quản lý phân loại để xem các loại hiện có. Không thêm hoặc xóa phân loại khi chỉ tra cứu."],
  "quality-thresholds": ["Mở phần ngưỡng đánh giá trong Chất lượng học viên, đọc ngưỡng của từng tiêu chí. Không sửa hoặc lưu ngưỡng khi chỉ cần xem cấu hình."],
};
export function manualProcedure(op: Pick<AssistantOperation, "method" | "path"> & { id?: string }) {
  const explicit = SUPPLEMENTAL_GUIDES.find(g => op.id && g.operationIds.includes(op.id) && g.method.split("|").includes(op.method) && g.path.test(op.path));
  if (explicit) return explicit;
  const found = MANUAL_PROCEDURES.find(p => p.method.split("|").includes(op.method) && p.path.test(op.path.replace(/\/$/, "")));
  if (found && found.id === "student-import" && op.path.endsWith("-preview")) return { ...found, steps: ["Trong Học viên, chọn Nhập Excel và tải tệp theo mẫu. Đọc kết quả xem trước, kiểm tra dữ liệu trùng và từng dòng báo lỗi. Dừng ở bước xem trước; chưa xác nhận nhập dữ liệu."] };
  if (found && found.id === "student-bulk-delete" && op.path.endsWith("-preview")) return { ...found, steps: ["Chọn đúng các hồ sơ trong Học viên, mở Xóa hàng loạt rồi chọn Kiểm tra trước khi xóa. Đọc ảnh hưởng đến dữ liệu liên quan và dừng tại phần xem trước; không xác nhận xóa."] };
  if (found && found.id === "quotation-import" && op.path.endsWith("/preview")) return { ...found, steps: ["Trong Bảng giá, chọn Nhập Excel/CSV, chọn tệp và sheet, ghép cột rồi xem dữ liệu kiểm tra. Dừng tại phần xem trước; không chọn Xác nhận và nhập."] };
  const steps = found && op.method === "GET" ? READ_ONLY_STEPS[found.id] : undefined;
  return found && steps ? { ...found, steps } : found;
}
