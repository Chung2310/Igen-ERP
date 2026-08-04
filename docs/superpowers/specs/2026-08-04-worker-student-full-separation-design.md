# Thiết kế tách hoàn toàn Quản lý lao động khỏi Quản lý học viên

## Mục tiêu

Tách `worker-management` thành một module nghiệp vụ độc lập hoàn toàn với `student-management`, trong khi giữ nguyên giao diện, tên tab, thao tác, phân quyền, API contract và luồng xử lý mà người dùng đang thấy.

Module lao động dùng model và collection riêng. Dữ liệu lao động cũ đang nằm trong collection học viên không được migrate vì hệ thống chưa vận hành thực tế. Collection lao động mới bắt đầu trống và không fallback về dữ liệu preset worker cũ.

## Nguyên tắc bất biến

- Không thay đổi UI, thứ tự tab, thao tác hoặc luồng điều hướng hiện tại.
- Được đổi các URL nội bộ còn mang tên học viên sang namespace worker thuần (`workers`, `projects`, `attendance`, `qr-attendance`, `dashboard`, `notifications`) vì hệ thống chưa vận hành thực tế; method, payload, HTTP status, response shape và hành vi vẫn phải giữ nguyên.
- Không thay đổi hành vi loading, empty state, toast, validation và error handling.
- Giữ nguyên hai quyền `worker:read` và `worker:manage`; không mở rộng permission trong đợt tách này.
- Không thay đổi logic học viên ngoài việc xóa các nhánh worker đã không còn được sử dụng sau cutover cuối cùng.
- Không migrate dữ liệu worker cũ và không đọc fallback từ model học viên.
- Mỗi bước chuyển đổi phải có baseline contract test, regression test và rollback point riêng.

## Hiện trạng

Repo đã có `server/modules/worker-management` với model, service, controller và router riêng cho worker, project, attendance và QR. Frontend cũng đã có `src/modules/worker-management` cùng các API client worker.

Tuy nhiên luồng chính vẫn phụ thuộc gián tiếp vào học viên:

- `WorkerWorkspace` dùng hook, type và API scope được export từ `shared-management`.
- Các page và modal trong `shared-management` export trực tiếp implementation từ `student-management`.
- Backend `shared-management` export nguyên `studentManagementRouter` và mount dưới worker.
- `setBusinessApiScope("worker")` remap URL học viên sang URL worker bằng state toàn cục.
- Các API client worker riêng đã tồn tại nhưng chưa phải consumer chính của workspace.
- `StudentManagementTab` vẫn còn logic `entityLabel.preset === "worker"`.
- Isolation tests hiện chỉ chặn import trực tiếp, chưa chặn phụ thuộc gián tiếp qua adapter.

## Kiến trúc đích

### Biên module

- `student-management` chỉ sở hữu nghiệp vụ học viên.
- `worker-management` sở hữu hồ sơ lao động, dự án, chấm công, QR, dashboard và thông báo lao động.
- `shared-management` chỉ chứa UI primitive hoặc utility trình bày thuần, không mang type `Student`/`Worker`, không gọi API và không export router nghiệp vụ.
- Worker frontend gọi trực tiếp `/api/v1/worker-management/*` qua API client riêng.
- Worker backend chỉ dùng model, validation, service, controller và router trong `server/modules/worker-management`.

### Dữ liệu

- `WorkerModel` là nguồn duy nhất cho hồ sơ lao động.
- `WorkerProjectModel.workerIds` tham chiếu `Worker`, không tham chiếu `User` hoặc `Student`.
- `WorkerAttendanceLogModel.workerId` tham chiếu `Worker`.
- `WorkerAttendanceLogModel.projectId` tham chiếu `WorkerProject`.
- QR session lao động dùng namespace/model riêng và chỉ liên kết Worker/WorkerProject.
- Mọi read/write bắt buộc scope theo `companyCode`; tài khoản có phạm vi chi nhánh phải scope thêm `branchId`.
- Soft delete, status, search, pagination và sort giữ đúng contract baseline.
- Dữ liệu preset worker cũ nằm nguyên trong collection học viên nhưng không xuất hiện trong module lao động mới.

### API contract

Thay toàn bộ endpoint còn mang tên học viên bằng endpoint worker thuần dưới `/api/v1/worker-management/*`; không giữ alias tương thích cũ. Trước khi thay implementation, test phải khóa hành vi:

- Method, URL, query parameters và request body.
- HTTP status và response body.
- Validation message và error shape.
- Permission `worker:read`/`worker:manage`.
- Company/branch isolation.
- Soft delete và not-found behavior.
- Quan hệ worker-project-attendance.
- QR expiry, close session, duplicate check-in và cross-tenant rejection.

Không endpoint worker nào được mount qua `studentManagementRouter`. Không endpoint worker nào được phép truy cập `StudentModel`, `BatchModel` hoặc service học viên.

## Thiết kế frontend

`WorkerWorkspace` giữ nguyên layout và bốn tab hiện tại: Tổng quan, Dự án, Lao động và Thông báo.

Mỗi luồng có implementation riêng trong `src/modules/worker-management`:

- `pages/WorkersPage.tsx`
- `pages/WorkerProjectsPage.tsx`
- `pages/WorkerDashboardPage.tsx`
- `pages/WorkerNotificationsPage.tsx`
- `components/AddWorkerModal.tsx`
- `components/WorkerDetailModal.tsx`
- Hook riêng như `useWorkers`, `useWorkerProjects`, `useWorkerNotifications`.
- Type riêng trong `src/modules/worker-management/types.ts`.
- API client riêng gọi trực tiếp worker endpoints.

Markup hiện tại có thể được sao chép lúc đầu để bảo toàn giao diện. Việc trích UI primitive dùng chung chỉ thực hiện sau khi worker flow đã có contract tests và không được kéo business logic sang `shared-management`.

Không worker component nào được dùng:

- `useStudents`, `useBatches` hoặc type `Student`.
- `setEntityPreset("worker")`.
- `setBusinessApiScope("worker")` hoặc endpoint remapping toàn cục.
- Page/modal được export từ `student-management`.

## Chuyển đổi tuần tự

### Giai đoạn 1: Khóa baseline

Ghi contract tests cho luồng hiện tại trước khi thay implementation. Baseline bao gồm frontend request contract, backend response contract, permission, tenant/branch scope và trạng thái UI.

### Giai đoạn 2: Hồ sơ lao động

Chuyển tab Lao động, modal thêm/sửa/xem và hook danh sách sang `WorkerModel` cùng API worker riêng. Không đổi field hiển thị hoặc thao tác.

### Giai đoạn 3: Dự án lao động

Chuyển tab Dự án sang `WorkerProjectModel`. Sửa quan hệ `workerIds` tham chiếu Worker và khóa quy tắc cùng tenant/branch.

### Giai đoạn 4: Chấm công và QR

Chuyển attendance/QR sang Worker và WorkerProject. Bảo toàn check-in/check-out, geolocation, session lifecycle, duplicate prevention và manual adjustment.

### Giai đoạn 5: Dashboard và thông báo

Tạo query/dashboard/notification worker riêng nhưng giữ nguyên card, số liệu, trạng thái tải và thao tác hiện tại.

### Giai đoạn 6: Custom fields và thành phần phụ

Nếu workspace hiện đang hiển thị custom fields hoặc các detail sub-flow, tạo storage/API worker riêng hoặc adapter domain-neutral có contract rõ ràng. Không dùng module settings của student làm nguồn dữ liệu worker.

### Giai đoạn 7: Cutover và cleanup

Sau khi tất cả luồng mới đạt acceptance gates:

- Xóa `setBusinessApiScope("worker")` và worker URL remapping.
- Xóa các export nghiệp vụ student khỏi `shared-management`.
- Xóa mount `sharedManagementRouter` khỏi worker router.
- Xóa nhánh `entityLabel.preset === "worker"` khỏi điều hướng học viên.
- Xóa API/hook/adapter cũ không còn consumer.
- Giữ dữ liệu cũ nguyên trạng, không chạy migration hoặc delete.

## Chiến lược rollout và rollback

- Mỗi tab được chuyển độc lập.
- Trong giai đoạn chuyển đổi, tab đã chuyển chỉ dùng worker implementation; tab chưa chuyển tiếp tục dùng adapter cũ.
- Dùng feature switch nội bộ theo tab để rollback nhanh trong quá trình kiểm thử.
- Mỗi giai đoạn là một commit/review gate độc lập.
- Feature switches bị xóa ở cutover cuối cùng, không trở thành cấu hình dài hạn.
- Không triển khai giai đoạn kế tiếp nếu regression hoặc contract test của giai đoạn hiện tại chưa đạt.

## Error handling

- Giữ nguyên error shape và thông báo mà UI hiện đang xử lý.
- Validation xảy ra tại worker validation layer trước service.
- Service từ chối cross-tenant, cross-branch và quan hệ worker-project không hợp lệ.
- Not-found không được tiết lộ record thuộc tenant khác.
- Lỗi QR/session giữ nguyên status và message baseline.
- Frontend giữ nguyên toast, retry/refresh-token và trạng thái form sau lỗi.

## Kiểm thử

### Contract và integration

- Backend integration tests chạy qua router thật với auth, permission và database test.
- Frontend API tests khóa URL, method, query, payload và response unwrap.
- Component tests khóa loading, empty, error, modal lifecycle và post-mutation refresh.
- Golden-master tests chỉ khóa contract có ý nghĩa; không snapshot dữ liệu ngẫu nhiên hoặc markup toàn trang.

### Isolation

Tests phải thất bại nếu:

- Worker frontend/backend import trực tiếp hoặc gián tiếp implementation student.
- `shared-management` export hook, type, API, router, page hoặc modal nghiệp vụ student.
- Worker router mount `studentManagementRouter`.
- Worker UI gọi `/students`, `/batches` hoặc dùng API scope toàn cục.
- Worker service dùng Student/Batch model.
- Student navigation còn xử lý preset worker sau cutover.

### Data invariants

- Worker chỉ được đọc/ghi trong đúng company và branch scope.
- Project chỉ nhận worker cùng company/branch.
- Attendance chỉ nhận worker đang thuộc project.
- QR từ chối session hết hạn/đã đóng, check-in trùng, sai tenant hoặc sai project.
- Soft-deleted worker/project không xuất hiện trong read flow.

### Verification gate

Mỗi giai đoạn phải chạy:

- Worker tests chuyên biệt của giai đoạn.
- Isolation tests.
- Student regression tests liên quan.
- `npm run typecheck`.
- `npm run build`.
- Smoke test thủ công theo checklist UI baseline.

## Tiêu chí hoàn tất

Việc tách chỉ hoàn tất khi đồng thời thỏa mãn:

- Không còn import/adapter nghiệp vụ giữa worker và student.
- Worker UI chỉ dùng API, hook và type riêng.
- Worker backend chỉ dùng model, service, controller, validation và router riêng.
- Không còn global `setBusinessApiScope` cho worker.
- Không còn preset worker trong điều hướng/nghiệp vụ học viên.
- Dữ liệu worker mới chỉ ghi vào worker collections.
- Contract, worker, isolation và student regression tests đạt.
- Typecheck và production build đạt.
- UI, permission, API response và luồng thao tác không thay đổi so với baseline.

## Ngoài phạm vi

- Migration dữ liệu worker cũ.
- Xóa dữ liệu preset worker cũ.
- Thiết kế lại giao diện.
- Đổi API contract công khai.
- Mở rộng permission chi tiết.
- Refactor nghiệp vụ học viên không phục vụ trực tiếp cho việc tách worker.
