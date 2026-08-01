# Business Type Module Split Design

## Goal

Tach cac nghiep vu theo loai hinh doanh nghiep thanh cac module rieng, khong con dung `student-management` nhu mot module doi ten theo preset. Tenant loai hinh nao chi thay module nghiep vu cua loai hinh do; rieng module Lao dong bat dau voi du lieu trong, khong migrate du lieu worker cu tu module Hoc vien.

## Current State

He thong hien co `MODULE_KEYS = ["hr", "inventory", "resource", "chat", "student"]` o ca frontend va backend. Sidebar, router, auth profile va SuperAdmin tenant dialog deu dua vao `enabledModules` de an hien module.

`student-management` hien dang phuc vu nhieu nghiep vu bang `entityPreset`: `student`, `candidate`, `customer`, `worker`. Preset nay nam trong student module settings, anh huong den nhan hien thi, sub-tab, copy, mot so hanh vi an hien. Vi vay "Lao dong" hien tai chua phai module doc lap; no la mot che do cua module `student`.

## Approved Scope

1. Tach hoan toan cac loai hinh thanh module rieng.
2. Tenant loai hinh Lao dong chi thay module Lao dong; module Hoc vien bi an hoan toan.
3. Module Lao dong moi bat dau trong, khong migration du lieu worker cu.
4. Thiet ke lai toan bo loai hinh hien co, khong chi tach `student` va `worker`.

## Business Types

Them khai niem `businessType` lam nguon quyet dinh loai hinh tenant. Cac gia tri muc tieu:

- `education`: nghiep vu Hoc vien.
- `labor`: nghiep vu Lao dong.
- `service`: nghiep vu Khach hang.
- `recruitment`: nghiep vu Ung vien.
- `general`: khong co module nghiep vu chuyen nganh, chi dung cac module ERP chung.

`businessType` phai thuoc cau hinh tenant/corporate-level, khong nam trong `student-management` settings. SuperAdmin la nguoi duoc doi loai hinh.

## Module Model

Mo rong module keys:

- `student`: Quan ly hoc vien.
- `worker`: Quan ly lao dong.
- `customer`: Quan ly khach hang.
- `candidate`: Quan ly ung vien.
- Cac module chung giu nguyen: `hr`, `inventory`, `resource`, `chat`.

Moi business type co mot module nghiep vu bat buoc:

- `education` -> `student`.
- `labor` -> `worker`.
- `service` -> `customer`.
- `recruitment` -> `candidate`.
- `general` -> khong co module nghiep vu bat buoc.

Khi hien thi va dieu huong, he thong tinh danh sach module kha dung bang giao cua:

- Module duoc bat trong `enabledModules`.
- Module duoc phep boi `businessType`.
- Cac module chung duoc phep cho moi business type.

Neu `enabledModules` cu co `student` nhung tenant la `labor`, frontend va backend phai loc bo `student` khoi danh sach expose cho user.

## Frontend Architecture

Tach route cap cao:

- `src/modules/student-management` chi phuc vu Hoc vien.
- Tao `src/modules/worker-management` cho Lao dong.
- Tao shell rieng cho `customer-management` va `candidate-management` voi trang tong quan, danh sach trong, empty state va guard permission. CRUD day du cua hai module nay khong nam trong lan dau.

Sidebar khong con goi `useEntityLabel` de doi ten module Hoc vien. Tieu de module lay tu `MODULE_LABELS` theo key doc lap. Route app them tab rieng cho Lao dong, Khach hang, Ung vien neu module kha dung.

`student-management` se go bo logic preset worker/customer/candidate khoi cac diem dieu huong chinh. Trong qua trinh chuyen doi, cac helper copy cu co the ton tai tam thoi cho den khi man hinh moi thay the xong, nhung khong duoc dung de quyet dinh module top-level.

## Backend Architecture

Them config chung cho business type va module compatibility o backend. `sanitizeModuleKeys` chi validate key hop le; mot ham moi se loc module theo business type truoc khi tra ve profile va truoc khi luu cap nhat module tenant.

Tao module backend rieng:

- `server/modules/worker-management`
- `server/modules/customer-management`
- `server/modules/candidate-management`

Module Lao dong phai co model, router, service, validation va permission rieng. Du lieu bat dau trong. Khong clone du lieu tu `server/modules/student-management/models/student.model.ts`.

Trong giai do dau, worker API phai implement tap toi thieu: list/create/update/delete lao dong, branch/company scope, va permission guards. Cac nghiep vu nang cao nhu phan bo du an, phi, thong bao khong nam trong lan dau.

## Data

Khong migration worker cu. Du lieu da tao bang preset `worker` trong `student-management` van o lai bang cu va khong hien trong module Lao dong moi.

Neu tenant chuyen tu `student-management` preset worker cu sang `businessType = labor`, module Hoc vien bi an. Data cu khong mat, nhung khong co UI truy cap trong lan dau.

## Permissions

Them permission umbrella rieng:

- `worker:read`, `worker:manage`
- `customer:read`, `customer:manage`
- `candidate:read`, `candidate:manage`

Giu `student:read`, `student:manage` cho Hoc vien. Khong dung `student:*` de mo module Lao dong.

Permission catalog, role editor, module read permission map va backend middleware phai dong bo voi module keys moi. User co quyen `student:*` nhung tenant `labor` van khong thay Hoc vien vi business type loc module truoc.

## SuperAdmin UX

Tenant module dialog doi tu "Loai hinh doanh nghiep / Nhan thuc the" thanh "Loai hinh doanh nghiep". Khi SuperAdmin chon loai hinh:

- Danh sach module nghiep vu khong phu hop bi an.
- Module bat buoc cua loai hinh duoc auto chon va khong cho bo chon.
- Module chung van co the bat/tat binh thuong.

Khi luu, backend luu `businessType` va `enabledModules` da duoc loc hop le. Khong luu `entityPreset` moi vao student module settings nua.

## Routing And Fallbacks

Neu user truy cap URL cua module khong phu hop voi business type, router dua ve `TONG QUAN`.

Neu tenant thieu `businessType`, he thong suy luan tu cau hinh cu:

- `entityPreset = student` -> `education`.
- `entityPreset = worker` -> `labor`.
- `entityPreset = customer` -> `service`.
- `entityPreset = candidate` -> `recruitment`.

Suy luan nay chi dung de compatibility khi doc profile/settings cu. Lan dau khong ghi nguoc vao DB neu SuperAdmin chua luu thay doi tenant.

## Testing

Can test cac lop sau:

- Unit test config module/business type: loc module theo loai hinh, sanitize key, fallback du lieu cu.
- Backend auth profile test: tenant `labor` khong expose `student`, tenant `education` khong expose `worker`.
- SuperAdmin tenant module dialog test: chon loai hinh auto chon module bat buoc va an module khong phu hop.
- Router/sidebar test: chi hien module theo business type va redirect khi vao module bi chan.
- Worker backend API test: company/branch isolation, permission read/manage, CRUD toi thieu.

## Rollout

1. Them config business type va module keys moi, chua go bo preset cu.
2. Doi auth/module filtering de business type la nguon an hien.
3. Doi SuperAdmin tenant dialog sang business type moi.
4. Tao module Lao dong moi voi data trong va API rieng.
5. Tao shell cho Customer/Candidate hoac module toi thieu neu chua co nghiep vu day du.
6. Go bo phu thuoc top-level vao `entityPreset`; giu compatibility reader cho tenant cu.

## Out Of Scope

- Migration worker cu sang module Lao dong moi.
- Xay day du tat ca nghiep vu Customer/Candidate neu chua co yeu cau man hinh cu the.
- Xoa ngay cac helper copy preset cu neu chung van can cho compatibility trong giai do chuyen tiep.
