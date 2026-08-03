# Student Worker Full Separation Design

## Goal

Tach han nghiep vu Hoc vien va Lao dong thanh hai module doc lap ve du lieu, API backend va workspace frontend. He thong chi con hai loai hinh tenant van hanh: `education` cho Hoc vien va `labor` cho Lao dong.

## Decisions

- Chi con hai business type duoc chon trong UI va luu moi: `education`, `labor`.
- `customer`, `candidate`, `service`, `recruitment`, `general` khong con hien trong cau hinh/UX. Code cu co the giu tam de tranh pha import va test khong lien quan.
- Khong migrate du lieu worker cu trong `student-management`. Du lieu cu o lai collection cu va khong hien trong module Lao dong moi.
- Module Lao dong moi dung collection, service, controller va router rieng trong `worker-management`.
- Toan bo flow Lao dong hien dang muon `student-management` se chuyen sang `worker-management`. UI co the tai su dung component cap thap hoac copy component tam thoi, nhung API/hook/type cua Lao dong nam trong `worker-management`.

## Current State

Frontend va backend da co module key `worker`, nhung nhieu flow Lao dong van la preset `worker` trong `student-management`: profile, project/batch, QR attendance, assignment, copy va custom fields. Backend da co `server/modules/worker-management` voi CRUD worker toi thieu, trong khi project va attendance worker moi vua duoc them van nam duoi `server/modules/student-management`.

Business type hien co van gom `education`, `labor`, `service`, `recruitment`, `general`. Cac helper compatibility dang suy luan tu `entityPreset` cu.

## Target Architecture

### Business Type And Module Filtering

`education` bat buoc module `student`; `labor` bat buoc module `worker`. Cac module chung nhu `hr`, `inventory`, `resource`, `chat` van co the bat/tat cho ca hai loai hinh.

Customer/candidate module keys co the ton tai trong code trong giai do chuyen tiep, nhung:

- Khong nam trong danh sach business type selectable.
- Khong duoc auto expose trong auth profile cho tenant moi.
- Khong hien trong SuperAdmin tenant module dialog.
- Khong hien trong sidebar/router neu business type la `education` hoac `labor`.

Legacy fallback chi doc du lieu cu de khong crash. Neu tenant cu co `entityPreset = customer/candidate` hoac `businessType = service/recruitment/general`, he thong nen fallback ve `education` khi can mot gia tri hop le thay vi expose customer/candidate.

### Backend Separation

`server/modules/student-management` chi phuc vu Hoc vien. Sau khi tach, no khong duoc cung cap endpoint worker-specific nua.

`server/modules/worker-management` so huu cac endpoint va collection Lao dong:

- Worker profile: list/create/update/delete lao dong.
- Worker project: list/create/update/delete du an lao dong.
- Worker project members: them/bo lao dong vao/ra du an.
- Worker attendance: cham gio vao/gio ve, sua tay, xem ngay, xem khoang ngay.
- Worker QR attendance: tao phien QR dung chung, checkin public, polling, dong phien.

Khong dung `Student`, `Batch`, `Course` collection cho du lieu Lao dong moi. Neu can giu tu duy project, tao model rieng nhu `WorkerProject`. Neu can thanh vien du an, luu worker IDs cua `Worker` collection moi.

### Frontend Separation

`src/modules/student-management` chi la workspace Hoc vien.

`src/modules/worker-management` la workspace Lao dong doc lap. No co API client, hooks va types rieng, vi du:

- `api/workers.api.ts`
- `api/workerProjects.api.ts`
- `api/workerAttendance.api.ts`
- `types.ts`
- `WorkerWorkspace.tsx`
- pages/components cho profile, project, attendance

Frontend worker khong duoc dua vao `setBusinessApiScope("worker")` de remap endpoint student sang worker. Cac flow worker goi endpoint `/api/v1/worker-management/...` truc tiep qua wrapper cua worker module.

UI component cap thap co the reuse neu chung khong import business logic tu `student-management`. Neu component cu qua gan voi preset, copy sang `worker-management` va doi import/API ro rang.

### Permissions And Routing

Hoc vien dung `student:read`, `student:manage`. Lao dong dung `worker:read`, `worker:manage`. Khong dung `student:*` de mo worker endpoint.

Backend route guard cho `/api/v1/student-management/*` yeu cau module `student`; `/api/v1/worker-management/*` yeu cau module `worker`. Worker endpoints khong goi middleware/permission map cua student areas.

### Data And Rollout

Khong migration du lieu cu. Sau rollout, tenant `labor` thay module Lao dong moi voi data trong neu chua tao du lieu worker moi.

Cac endpoint worker cu trong `student-management` neu con can ton tai trong code thi phai bi go khoi router chinh hoac khong the truy cap tu worker workspace moi. Khong xoa helper copy/preset customer/candidate trong PR dau neu xoa lam tang rui ro compile.

## Testing Strategy

- Config tests: chi `education` va `labor` selectable; module filtering chi expose `student` cho education va `worker` cho labor.
- Backend isolation tests: worker service/controller/router khong import `student-management` models/services cho profile/project/attendance.
- Worker API tests: CRUD profile, CRUD project, project membership, attendance mark/list/adjust, permission va company/branch scope.
- QR worker tests: shared QR session khong xoay token, checkin ghi worker attendance, close session khong tao attendance session kieu lop hoc.
- Frontend tests: labor tenant render worker workspace va khong render student workspace; worker hooks goi `/worker-management` endpoint truc tiep.
- Typecheck toan repo sau tung nhom thay doi lon.

## Out Of Scope

- Migration du lieu worker cu tu `student-management` sang `worker-management`.
- Xoa vat ly toan bo code customer/candidate cu.
- Hoan thien nghiep vu customer/candidate.
- Doi moi toan bo UI design; muc tieu la tach ownership va API truoc.
