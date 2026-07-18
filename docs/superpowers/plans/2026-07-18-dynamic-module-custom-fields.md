# Dynamic Module Custom Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép Super Admin, Admin và Leader tạo, cấu hình và nhập trường dữ liệu động ngay trong form Thêm của mọi module quản lý học viên, đồng thời áp dụng trường đó cho toàn công ty và cho mọi bản ghi cũ.

**Architecture:** Lưu định nghĩa trường theo `tenantId + moduleKey` trong collection riêng và lưu giá trị trên từng bản ghi dưới `customFields`. Server dựng validation từ định nghĩa trường ở thời điểm ghi; frontend dùng một renderer và editor dùng chung rồi tích hợp lần lượt vào các form module hiện tại.

**Tech Stack:** TypeScript 5.8, Express 4, Mongoose 9, Joi 18, React 19, Vitest 4, Testing Library, existing Cloudinary upload API.

## Global Constraints

- Chỉ `superadmin`, `admin` và `manager` được tạo hoặc sửa định nghĩa trường; vai trò `manager` là Leader trong giao diện hiện tại.
- Tenant được suy ra từ phiên đăng nhập (`companyCode`, fallback `centerId`), không nhận tenant tùy ý từ client.
- Trường động áp dụng cho toàn bộ bản ghi trong cùng tenant và module; không cập nhật hàng loạt document cũ.
- Bản ghi cũ chỉ bị yêu cầu bổ sung trường bắt buộc mới khi người dùng bấm Lưu form Sửa.
- Trường ẩn hoặc lưu trữ không được kiểm tra bắt buộc.
- Không xóa cứng định nghĩa hoặc giá trị trường đã sử dụng.
- Không xây dựng màn hình quản lý trường động trong trang Cài đặt.
- Không chuyển các trường cố định hiện tại sang `customFields`.

---

## File map

**Backend nền tảng mới**

- `server/modules/student-management/interfaces/custom-field.interface.ts`: kiểu module, kiểu trường, định nghĩa và giá trị động.
- `server/modules/student-management/models/custom-field-definition.model.ts`: collection định nghĩa và unique index theo tenant/module/key.
- `server/modules/student-management/services/custom-field.service.ts`: CRUD mềm, chuẩn hóa khóa, kiểm tra tương thích và validation runtime.
- `server/modules/student-management/controllers/custom-field.controller.ts`: HTTP boundary.
- `server/modules/student-management/routes/custom-field.routes.ts`: API có auth và role guard.
- `server/modules/student-management/validations/custom-field.validation.ts`: Joi cho payload cấu hình.
- `server/modules/student-management/utils/custom-field.util.ts`: tenant resolver và sanitizer dùng chung.

**Frontend nền tảng mới**

- `src/modules/student-management/custom-fields/types.ts`: contract frontend.
- `src/modules/student-management/custom-fields/api.ts`: API definitions.
- `src/modules/student-management/custom-fields/useCustomFields.ts`: tải, refresh và mutation state.
- `src/modules/student-management/custom-fields/CustomFieldEditorModal.tsx`: hộp tạo/chỉnh sửa trường.
- `src/modules/student-management/custom-fields/CustomFieldRenderer.tsx`: dựng control theo type.
- `src/modules/student-management/custom-fields/CustomFieldsSection.tsx`: section dùng chung gồm renderer và nút Thêm trường có phân quyền.
- `src/modules/student-management/custom-fields/CustomFieldDetails.tsx`: hiển thị giá trị ở trang chi tiết.

**Model/module hiện tại cần mở rộng**

- Interfaces và models: `student`, `course`, `batch`, `exam`, `payment`, `notification`, `resource`, `partner`.
- Validation và service create/update tương ứng của tám module trên.
- Form Thêm/Sửa/Chi tiết tương ứng trên frontend.

---

### Task 1: Contract, schema và tenant boundary cho định nghĩa trường

**Files:**
- Create: `server/modules/student-management/interfaces/custom-field.interface.ts`
- Create: `server/modules/student-management/models/custom-field-definition.model.ts`
- Create: `server/modules/student-management/utils/custom-field.util.ts`
- Test: `server/modules/student-management/models/custom-field-definition.model.test.ts`
- Test: `server/modules/student-management/utils/custom-field.util.test.ts`

**Interfaces:**
- Produces: `MODULE_KEYS`, `ModuleKey`, `DYNAMIC_FIELD_TYPES`, `DynamicFieldType`, `CustomFieldValue`, `IFieldDefinition`, `resolveCustomFieldTenant(user)`, `canManageCustomFields(role)`.

- [ ] **Step 1: Viết test thất bại cho enum, unique index và quyền**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { CustomFieldDefinition } from "./custom-field-definition.model";
import { canManageCustomFields, resolveCustomFieldTenant } from "../utils/custom-field.util";

test("field definition isolates keys by tenant and module", () => {
  const index = CustomFieldDefinition.schema.indexes().find(([keys]) =>
    keys.tenantId === 1 && keys.moduleKey === 1 && keys.key === 1
  );
  assert.deepEqual(index?.[1], { unique: true });
});

test("only superadmin, admin and manager manage custom fields", () => {
  assert.equal(canManageCustomFields("superadmin"), true);
  assert.equal(canManageCustomFields("admin"), true);
  assert.equal(canManageCustomFields("manager"), true);
  assert.equal(canManageCustomFields("user"), false);
});

test("tenant comes from authenticated company", () => {
  assert.equal(resolveCustomFieldTenant({ companyCode: "IGEN", centerId: "C1" }), "IGEN");
  assert.equal(resolveCustomFieldTenant({ centerId: "C1" }), "C1");
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx tsx --test server/modules/student-management/models/custom-field-definition.model.test.ts server/modules/student-management/utils/custom-field.util.test.ts`

Expected: FAIL vì các file/module chưa tồn tại.

- [ ] **Step 3: Tạo contract và schema tối thiểu**

```ts
export const MODULE_KEYS = ["students", "courses", "batches", "exams", "payments", "notifications", "resources", "partners"] as const;
export type ModuleKey = typeof MODULE_KEYS[number];

export const DYNAMIC_FIELD_TYPES = [
  "shortText", "longText", "email", "phone", "url", "number", "percent",
  "currency", "date", "time", "dateTime", "singleSelect", "multiSelect",
  "checkbox", "switch", "file", "image", "multiImage",
] as const;
export type DynamicFieldType = typeof DYNAMIC_FIELD_TYPES[number];
export type CustomFieldValue = string | number | boolean | string[] | { url: string; fileName: string; mimeType?: string; size?: number } | Array<{ url: string; fileName: string; mimeType?: string; size?: number }> | null;
export type CustomFieldValues = Record<string, CustomFieldValue>;
```

Schema phải có `tenantId`, `moduleKey`, `key`, `label`, `type`, `placeholder`, `defaultValue`, `options`, `validation`, `isVisible`, `isRequired`, `isArchived`, `order`, `createdBy`, `updatedBy`, timestamps và:

```ts
customFieldDefinitionSchema.index(
  { tenantId: 1, moduleKey: 1, key: 1 },
  { unique: true }
);
customFieldDefinitionSchema.index(
  { tenantId: 1, moduleKey: 1, isArchived: 1, order: 1 }
);
```

- [ ] **Step 4: Chạy lại test**

Run: lệnh ở Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/modules/student-management/interfaces/custom-field.interface.ts server/modules/student-management/models/custom-field-definition.model.ts server/modules/student-management/utils/custom-field.util.ts server/modules/student-management/models/custom-field-definition.model.test.ts server/modules/student-management/utils/custom-field.util.test.ts
git commit -m "feat: add custom field definition schema"
```

### Task 2: Service cấu hình trường và quy tắc bảo toàn dữ liệu

**Files:**
- Create: `server/modules/student-management/services/custom-field.service.ts`
- Test: `server/modules/student-management/services/custom-field.service.test.ts`

**Interfaces:**
- Consumes: `ModuleKey`, `DynamicFieldType`, `IFieldDefinition` từ Task 1.
- Produces: `CustomFieldService.list(tenantId, moduleKey, includeArchived?)`, `.create(context, input)`, `.update(context, id, input)`, `.archive(context, id)`, `.restore(context, id)`, `.hasStoredValues(tenantId, moduleKey, key)`.

- [ ] **Step 1: Viết test service thất bại**

Test bằng cách stub model, bao phủ:

```ts
await service.create(ctx, { moduleKey: "students", label: "Ảnh học viên", type: "image" });
assert.equal(created.key, "anhHocVien");
assert.equal(created.tenantId, "IGEN");

await assert.rejects(
  service.update(ctx, existingId, { type: "number" }),
  /không thể đổi loại dữ liệu/i
);

const archived = await service.archive(ctx, existingId);
assert.equal(archived.isArchived, true);
assert.equal(archived.isVisible, false);
assert.equal(archived.isRequired, false);

const restored = await service.restore(ctx, existingId);
assert.equal(restored.isArchived, false);
assert.equal(restored.isVisible, true);
```

- [ ] **Step 2: Chạy test**

Run: `npx tsx --test server/modules/student-management/services/custom-field.service.test.ts`

Expected: FAIL vì service chưa tồn tại.

- [ ] **Step 3: Cài đặt service**

Chuẩn hóa `key` từ nhãn bằng slug camelCase, từ chối key rỗng/reserved (`_id`, `ownerId`, `tenantId`, `customFields`, `createdAt`, `updatedAt`), đặt `order` sau trường cuối. Khi update:

```ts
if (input.isVisible === false) update.isRequired = false;
if (input.isArchived === true) {
  update.isVisible = false;
  update.isRequired = false;
}
if (input.type && input.type !== current.type && await hasStoredValues(...)) {
  throw new Error("Không thể đổi loại dữ liệu vì trường đã có dữ liệu.");
}
```

`hasStoredValues` dùng registry model theo `moduleKey` và truy vấn `{ ownerId: { $in: companyUserIds }, [\`customFields.${key}\`]: { $exists: true, $nin: [null, "", []] } }`; không dùng collection name nhận trực tiếp từ client.

- [ ] **Step 4: Chạy lại test**

Run: lệnh Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/modules/student-management/services/custom-field.service.ts server/modules/student-management/services/custom-field.service.test.ts
git commit -m "feat: add custom field configuration service"
```

### Task 3: API cấu hình với role guard

**Files:**
- Create: `server/modules/student-management/validations/custom-field.validation.ts`
- Create: `server/modules/student-management/controllers/custom-field.controller.ts`
- Create: `server/modules/student-management/routes/custom-field.routes.ts`
- Modify: `server/modules/student-management/router.ts`
- Test: `server/modules/student-management/routes/custom-field.routes.test.ts`

**Interfaces:**
- Produces: `GET /api/v1/student-management/custom-fields/:moduleKey`, `POST /.../:moduleKey`, `PATCH /.../:moduleKey/:id`, `POST /.../:moduleKey/:id/archive`, `POST /.../:moduleKey/:id/restore`.

- [ ] **Step 1: Viết test route thất bại**

Test handler/middleware chain cho các case: `user` nhận 403 khi POST/PATCH/archive/restore; `manager`, `admin`, `superadmin` đi qua; mọi role đã đăng nhập được GET; module ngoài `MODULE_KEYS` nhận 400; payload `singleSelect` không có options nhận 400.

- [ ] **Step 2: Chạy test**

Run: `npx tsx --test server/modules/student-management/routes/custom-field.routes.test.ts`

Expected: FAIL vì route chưa tồn tại.

- [ ] **Step 3: Tạo validation và route**

```ts
router.use(authMiddleware);
router.get("/:moduleKey", validate(moduleParamSchema, "params"), CustomFieldController.list);
router.post("/:moduleKey", requireRoles("superadmin", "admin", "manager"), validate(moduleParamSchema, "params"), validate(createFieldSchema), CustomFieldController.create);
router.patch("/:moduleKey/:id", requireRoles("superadmin", "admin", "manager"), validate(fieldParamsSchema, "params"), validate(updateFieldSchema), CustomFieldController.update);
router.post("/:moduleKey/:id/archive", requireRoles("superadmin", "admin", "manager"), validate(fieldParamsSchema, "params"), CustomFieldController.archive);
router.post("/:moduleKey/:id/restore", requireRoles("superadmin", "admin", "manager"), validate(fieldParamsSchema, "params"), CustomFieldController.restore);
```

Controller luôn gọi `resolveCustomFieldTenant(req.user!)` và ghi `createdBy/updatedBy = req.user!.uid`.

- [ ] **Step 4: Mount route và chạy lại test**

```ts
studentManagementRouter.use("/custom-fields", customFieldRoutes);
```

Run: lệnh Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/modules/student-management/validations/custom-field.validation.ts server/modules/student-management/controllers/custom-field.controller.ts server/modules/student-management/routes/custom-field.routes.ts server/modules/student-management/routes/custom-field.routes.test.ts server/modules/student-management/router.ts
git commit -m "feat: expose tenant custom field API"
```

### Task 4: Runtime validation và `customFields` trên tám model

**Files:**
- Create: `server/modules/student-management/services/custom-field-value.service.ts`
- Test: `server/modules/student-management/services/custom-field-value.service.test.ts`
- Modify: `server/modules/student-management/interfaces/{student,course,batch,exam,payment,notification,resource,partner}.interface.ts`
- Modify: `server/modules/student-management/models/{student,course,batch,exam,payment,notification,resource,partner}.model.ts`
- Modify: `server/modules/student-management/validations/{student,course,batch,exam,payment,notification,resource,partner}.validation.ts`

**Interfaces:**
- Produces: `validateCustomFieldValues({ tenantId, moduleKey, values, mode }): Promise<CustomFieldValues>` với `mode: "create" | "update"`.

- [ ] **Step 1: Viết test validation thất bại**

Bao phủ ít nhất:

```ts
await assert.rejects(
  validateCustomFieldValues({ tenantId: "IGEN", moduleKey: "students", values: {}, mode: "create" }),
  /Ảnh học viên.*bắt buộc/i
);

assert.deepEqual(
  await validateCustomFieldValues({ tenantId: "IGEN", moduleKey: "students", values: { hiddenRequired: null }, mode: "update" }),
  {}
);

await assert.rejects(
  validateCustomFieldValues({ tenantId: "IGEN", moduleKey: "students", values: { unknownKey: "x" }, mode: "create" }),
  /không được định nghĩa/i
);
```

Thêm cases cho number, date, select options, multiSelect, boolean, file/image metadata, max file size và mime type.

- [ ] **Step 2: Chạy test**

Run: `npx tsx --test server/modules/student-management/services/custom-field-value.service.test.ts`

Expected: FAIL.

- [ ] **Step 3: Cài đặt validator runtime**

Chỉ đọc định nghĩa `isArchived: false`; chỉ bắt buộc khi `isVisible && isRequired`; bỏ khóa ẩn/lưu trữ khỏi payload; từ chối khóa lạ. Trả về object đã normalize, không mutate input.

- [ ] **Step 4: Mở rộng interfaces, schemas và Joi envelope**

Trong mỗi interface:

```ts
customFields?: CustomFieldValues;
```

Trong mỗi Mongoose schema:

```ts
customFields: { type: Schema.Types.Mixed, default: {} },
```

Trong create/update Joi schema:

```ts
customFields: Joi.object().unknown(true).optional(),
```

Joi chỉ nhận envelope; service runtime là nơi xác thực key/type theo tenant.

- [ ] **Step 5: Chạy test và typecheck**

Run: `npx tsx --test server/modules/student-management/services/custom-field-value.service.test.ts`

Run: `npm run typecheck`

Expected: PASS và exit code 0.

- [ ] **Step 6: Commit**

```bash
git add server/modules/student-management/services/custom-field-value.service.ts server/modules/student-management/services/custom-field-value.service.test.ts server/modules/student-management/interfaces server/modules/student-management/models server/modules/student-management/validations
git commit -m "feat: validate custom values across student modules"
```

### Task 5: Gắn validation vào create/update services

**Files:**
- Modify: `server/modules/student-management/controllers/{student,course,batch,exam,payment,notification,resource,partner}.controller.ts`
- Modify: `server/modules/student-management/services/{student,course,batch,exam,payment,notification,resource,partner}.service.ts`
- Test: `server/modules/student-management/services/custom-field-write-integration.test.ts`

**Interfaces:**
- Consumes: `validateCustomFieldValues` từ Task 4.
- Produces: mọi create/update của tám entity lưu payload đã sanitize.

- [ ] **Step 1: Viết test tích hợp service thất bại**

Test tạo học viên với field bắt buộc; sửa học viên cũ thiếu field phải thất bại; đọc bản ghi cũ không bị lỗi; tạo course không nhận field của students; field tenant A không áp dụng tenant B.

- [ ] **Step 2: Chạy test**

Run: `npx tsx --test server/modules/student-management/services/custom-field-write-integration.test.ts`

Expected: FAIL vì write path chưa gọi validator.

- [ ] **Step 3: Truyền tenant context từ controller tới service**

Chuẩn hóa signature theo mẫu:

```ts
type CustomFieldWriteContext = { tenantId: string; moduleKey: ModuleKey };

const customFields = await validateCustomFieldValues({
  tenantId: context.tenantId,
  moduleKey: context.moduleKey,
  values: data.customFields ?? {},
  mode: "create",
});
const entity = new Model({ ...data, customFields, ownerId });
```

Update luôn validate toàn bộ trạng thái sau khi merge giá trị cũ và payload mới để bảo đảm bản ghi cũ phải bổ sung field bắt buộc khi bấm Lưu:

```ts
const merged = { ...(existing.customFields ?? {}), ...(data.customFields ?? {}) };
const customFields = await validateCustomFieldValues({ ...context, values: merged, mode: "update" });
```

- [ ] **Step 4: Chạy test, typecheck và build**

Run: test Step 2, `npm run typecheck`, `npm run build`.

Expected: tất cả PASS/exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/modules/student-management/controllers server/modules/student-management/services server/modules/student-management/services/custom-field-write-integration.test.ts
git commit -m "feat: enforce custom fields on entity writes"
```

### Task 6: Frontend API, state và role capability

**Files:**
- Create: `src/modules/student-management/custom-fields/types.ts`
- Create: `src/modules/student-management/custom-fields/api.ts`
- Create: `src/modules/student-management/custom-fields/useCustomFields.ts`
- Create: `src/modules/student-management/custom-fields/permissions.ts`
- Test: `src/modules/student-management/custom-fields/useCustomFields.test.tsx`
- Test: `src/modules/student-management/custom-fields/permissions.test.ts`

**Interfaces:**
- Produces: `useCustomFields(moduleKey)`, `canManageCustomFields(role)`, `FieldDefinition`, `CustomFieldValues`.

- [ ] **Step 1: Viết test hook và quyền thất bại**

```ts
expect(canManageCustomFields("manager")).toBe(true);
expect(canManageCustomFields("user")).toBe(false);

const { result } = renderHook(() => useCustomFields("students"));
await waitFor(() => expect(result.current.fields).toHaveLength(1));
await act(() => result.current.createField({ label: "Ảnh", type: "image" }));
expect(result.current.fields[0].label).toBe("Ảnh");
```

- [ ] **Step 2: Chạy test**

Run: `npx vitest run src/modules/student-management/custom-fields/permissions.test.ts src/modules/student-management/custom-fields/useCustomFields.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Cài đặt API và hook**

`api.ts` gọi endpoints Task 3 bằng `apiFetch`. Hook trả:

```ts
type UseCustomFieldsResult = {
  fields: FieldDefinition[];
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  createField(input: CreateFieldInput): Promise<FieldDefinition>;
  updateField(id: string, input: UpdateFieldInput): Promise<FieldDefinition>;
  archiveField(id: string): Promise<void>;
  restoreField(id: string): Promise<FieldDefinition>;
};
```

Sau mutation, cập nhật state theo response và dispatch `CustomEvent("custom-fields:changed", { detail: { moduleKey } })`; các hook cùng module lắng nghe event để refresh.

- [ ] **Step 4: Chạy lại test**

Run: lệnh Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/student-management/custom-fields
git commit -m "feat: add custom field client state"
```

### Task 7: Bộ dựng trường và editor dùng chung

**Files:**
- Create: `src/modules/student-management/custom-fields/CustomFieldEditorModal.tsx`
- Create: `src/modules/student-management/custom-fields/CustomFieldRenderer.tsx`
- Create: `src/modules/student-management/custom-fields/CustomFieldsSection.tsx`
- Create: `src/modules/student-management/custom-fields/CustomFieldDetails.tsx`
- Test: `src/modules/student-management/custom-fields/CustomFieldsSection.test.tsx`
- Test: `src/modules/student-management/custom-fields/CustomFieldRenderer.test.tsx`

**Interfaces:**
- Produces: `<CustomFieldsSection moduleKey values onChange errors mode />` và `<CustomFieldDetails moduleKey values />`.

- [ ] **Step 1: Viết component tests thất bại**

Bao phủ: user không thấy nút; manager thấy `+ Thêm trường`; tạo field giữ nguyên values đang nhập; render input theo tất cả type; field required có dấu `*`; field hidden/archived không render; upload lỗi giữ form; nút sửa chỉ hiện với role có quyền.

- [ ] **Step 2: Chạy test**

Run: `npx vitest run src/modules/student-management/custom-fields/CustomFieldRenderer.test.tsx src/modules/student-management/custom-fields/CustomFieldsSection.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Cài đặt renderer**

Renderer là controlled component:

```ts
type CustomFieldRendererProps = {
  field: FieldDefinition;
  value: CustomFieldValue;
  onChange(value: CustomFieldValue): void;
  error?: string;
  disabled?: boolean;
};
```

Map type sang input HTML hiện có; file/image gọi `/student-management/upload` bằng `FormData`, kiểm tra client-side `accept`, `maxSizeMb`, `maxFiles` trước upload và chỉ lưu metadata response.

- [ ] **Step 4: Cài đặt editor và section**

Editor reset lỗi khi type/config đổi, bắt buộc options không rỗng với select, tự tắt `isRequired` khi `isVisible=false`. Section dùng `useAuth()` và `canManageCustomFields(userProfile?.role)` để quyết định nút/editor; không reset prop `values` sau khi tạo field.

- [ ] **Step 5: Chạy test và typecheck**

Run: lệnh Step 2 và `npm run typecheck`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/student-management/custom-fields
git commit -m "feat: add reusable custom field form controls"
```

### Task 8: Tích hợp Học viên end-to-end

**Files:**
- Modify: `src/modules/student-management/types.ts`
- Modify: `src/modules/student-management/components/Student/AddStudentModal.tsx`
- Modify: `src/modules/student-management/components/Student/EditStudentModal.tsx`
- Modify: `src/modules/student-management/components/Student/DetailTabs/ProfileTab.tsx`
- Test: `src/modules/student-management/components/Student/StudentCustomFields.test.tsx`

**Interfaces:**
- Consumes: components Task 7 và API backend Task 5.

- [ ] **Step 1: Viết test UI thất bại**

Test form Thêm gửi `customFields`, form Sửa hydrate giá trị cũ và chặn lưu khi field bắt buộc trống, Profile hiển thị label/value, tạo field mới ngay trong modal không xóa `fullName`, `phone` và các giá trị đang nhập.

- [ ] **Step 2: Chạy test**

Run: `npx vitest run src/modules/student-management/components/Student/StudentCustomFields.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Tích hợp state và section**

Thêm vào state khởi tạo:

```ts
customFields: {} as CustomFieldValues
```

Trong form:

```tsx
<CustomFieldsSection
  moduleKey="students"
  values={formData.customFields ?? {}}
  onChange={(customFields) => setFormData((prev) => ({ ...prev, customFields }))}
  mode={student ? "edit" : "create"}
/>
```

Profile dùng `<CustomFieldDetails moduleKey="students" values={student.customFields ?? {}} />`.

- [ ] **Step 4: Chạy test, typecheck và build**

Run: test Step 2, `npm run typecheck`, `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/student-management/types.ts src/modules/student-management/components/Student
git commit -m "feat: add custom fields to students"
```

### Task 9: Tích hợp Khóa học, Lớp học và Lịch thi

**Files:**
- Modify: `src/modules/student-management/pages/Courses/CoursesPage.tsx`
- Modify: `src/modules/student-management/pages/Batches/BatchesPage.tsx`
- Modify: `src/modules/student-management/components/Exams/AddExamModal.tsx`
- Modify: `src/modules/student-management/pages/Exams/ExamsPage.tsx`
- Modify: matching entity types in `src/modules/student-management/types.ts`
- Test: `src/modules/student-management/custom-fields/AcademicModuleCustomFields.test.tsx`

- [ ] **Step 1: Viết test thất bại cho ba module**

Mỗi module phải có case form Thêm hiển thị section đúng `moduleKey`, payload create chứa `customFields`, edit hydrate dữ liệu, detail hiển thị dữ liệu và tạo definition không xóa input cố định.

- [ ] **Step 2: Chạy test**

Run: `npx vitest run src/modules/student-management/custom-fields/AcademicModuleCustomFields.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Tích hợp theo module key**

Courses dùng `courses`, Batches dùng `batches`, Exams dùng `exams`. Nếu form đang nằm trong page lớn, chỉ thêm `customFields` và component dùng chung; không refactor page ngoài phạm vi.

- [ ] **Step 4: Chạy test, typecheck, build**

Run: test Step 2, `npm run typecheck`, `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/student-management/pages/Courses src/modules/student-management/pages/Batches src/modules/student-management/pages/Exams src/modules/student-management/components/Exams src/modules/student-management/types.ts
git commit -m "feat: add custom fields to academic modules"
```

### Task 10: Tích hợp Học phí, Thông báo, Tài nguyên và Đối tác

**Files:**
- Modify: `src/modules/student-management/components/Fees/AddPaymentModal.tsx`
- Modify: `src/modules/student-management/pages/Fees/FeesPage.tsx`
- Modify: `src/modules/student-management/pages/Notifications/NotificationsPage.tsx`
- Modify: `src/modules/student-management/pages/Resources/components/AddResourceModal.tsx`
- Modify: `src/modules/student-management/pages/Resources/ResourcesPage.tsx`
- Modify: `src/modules/student-management/pages/Partners/components/AddPartnerModal.tsx`
- Modify: `src/modules/student-management/pages/Partners/components/PartnerDetailModal.tsx`
- Modify: matching entity types in `src/modules/student-management/types.ts`
- Test: `src/modules/student-management/custom-fields/OperationsModuleCustomFields.test.tsx`

- [ ] **Step 1: Viết test thất bại cho bốn module**

Mỗi module kiểm tra form Thêm gửi đúng `customFields`, detail hiển thị giá trị, role guard của nút editor và giá trị form cố định được giữ khi cấu hình field thay đổi.

- [ ] **Step 2: Chạy test**

Run: `npx vitest run src/modules/student-management/custom-fields/OperationsModuleCustomFields.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Tích hợp theo module key**

Payments dùng `payments`, Notifications dùng `notifications`, Resources dùng `resources`, Partners dùng `partners`. Không áp dụng field definition của entity cha cho modal hành động phụ như thanh toán hoa hồng hay gán học viên; các action này không tạo bản ghi top-level của module.

- [ ] **Step 4: Chạy test, typecheck, build**

Run: test Step 2, `npm run typecheck`, `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/student-management/components/Fees src/modules/student-management/pages/Fees src/modules/student-management/pages/Notifications src/modules/student-management/pages/Resources src/modules/student-management/pages/Partners src/modules/student-management/types.ts
git commit -m "feat: add custom fields to operations modules"
```

### Task 11: Hồi quy, audit và nghiệm thu toàn hệ thống

**Files:**
- Create: `server/modules/student-management/custom-fields.acceptance.test.ts`
- Create: `src/modules/student-management/custom-fields/CustomFieldsAcceptance.test.tsx`
- Modify only if tests expose a defect: files owned by Tasks 1-10.

- [ ] **Step 1: Viết acceptance matrix**

Backend test matrix: 4 roles × 8 module keys; tenant A/B isolation; create/update/read old record; hidden/archived/required; duplicate key; unknown key; incompatible type change; all 18 field types; upload metadata boundaries.

Frontend test matrix: role visibility, create/edit/detail on 8 module keys, preserving dirty form state, editor errors, upload retry, archive restore values.

- [ ] **Step 2: Chạy toàn bộ test liên quan**

Run:

```bash
npx tsx --test server/modules/student-management/**/*.test.ts
npx vitest run src/modules/student-management
npm run typecheck
npm run build
```

Expected: tất cả test PASS; typecheck/build exit code 0.

- [ ] **Step 3: Kiểm tra thủ công**

Đăng nhập lần lượt bằng Super Admin, Admin, Leader và user thường. Tại mỗi tab Học viên, Khóa học, Lớp học, Lịch thi, Học phí, Thông báo, Tài nguyên, Đối tác: mở form Thêm; tạo một field phù hợp; lưu bản ghi; mở Sửa và Chi tiết; xác nhận user thường không thấy editor. Tạo field bắt buộc sau khi đã có bản ghi cũ và xác nhận chỉ thao tác Lưu form Sửa bị chặn.

- [ ] **Step 4: Rà soát an toàn dữ liệu**

Xác nhận không có API xóa cứng, không có tenant trong request body được tin cậy, không có collection/model name tùy ý từ client, upload chỉ lưu metadata và giá trị bị ẩn/lưu trữ vẫn còn trong database.

- [ ] **Step 5: Commit nghiệm thu**

```bash
git add server/modules/student-management/custom-fields.acceptance.test.ts src/modules/student-management/custom-fields/CustomFieldsAcceptance.test.tsx
git commit -m "test: cover dynamic custom fields acceptance"
```
