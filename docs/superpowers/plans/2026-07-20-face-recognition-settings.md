# Face Recognition Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authorized Settings tab where an administrator can find an employee, inspect face-enrollment status, capture one live camera image, enroll or replace the face, and delete an enrollment.

**Architecture:** A typed service isolates the face-management HTTP contract. A camera-session helper owns browser media and JPEG capture, a modal owns the capture UX, and a Settings tab owns employee/status orchestration. `SettingsTab` only handles permission-aware navigation and lazy loading.

**Tech Stack:** React 19, TypeScript 5.8, Vitest 4, Testing Library, browser MediaDevices/Canvas APIs, Tailwind CSS, existing Express face-management API.

## Global Constraints

- Enrollment accepts only one live camera JPEG; no file upload and no multi-angle enrollment.
- Send `multipart/form-data` with the exact field name `file`.
- Only `superadmin`, `admin`, wildcard `*`, or `face:manage` may see the tab; backend authorization remains authoritative.
- Stop all media tracks and revoke all preview URLs on capture, retake, close, employee switch, and unmount.
- Do not persist captured images in localStorage or other frontend storage.
- Do not modify or stage the unrelated student-management and assignment-upload working-tree changes.

---

### Task 1: Permission helper and typed face-management service

**Files:**
- Create: `src/services/faceManagementService.ts`
- Create: `src/services/faceManagementService.test.ts`
- Modify: `src/types/common.ts`

**Interfaces:**
- Consumes: `UserProfile`, bearer token from `localStorage.getItem("accessToken")`, `/api/v1/face-management/users/:userId`.
- Produces: `canManageFaces(profile): boolean`, `getFaceEnrollmentStatus(userId): Promise<FaceEnrollmentStatus>`, `enrollFace(userId, image): Promise<FaceEnrollmentMutation>`, and `deleteFaceEnrollment(userId): Promise<void>`.

- [ ] **Step 1: Write failing service tests**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canManageFaces,
  deleteFaceEnrollment,
  enrollFace,
  getFaceEnrollmentStatus,
} from "./faceManagementService";

describe("faceManagementService", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [{ role: "superadmin" }, true],
    [{ role: "admin" }, true],
    [{ role: "manager", permissions: ["face:manage"] }, true],
    [{ role: "user", permissions: ["*"] }, true],
    [{ role: "manager", permissions: [] }, false],
  ])("calculates face-management access", (profile, expected) => {
    expect(canManageFaces(profile as never)).toBe(expected);
  });

  it("loads typed enrollment status with bearer auth", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { registered: true } }), { status: 200 }));
    await expect(getFaceEnrollmentStatus("u 1")).resolves.toEqual({ registered: true });
    expect(fetch).toHaveBeenCalledWith("/api/v1/face-management/users/u%201", expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("posts a JPEG using multipart field file", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { registered: true, operation: "register" } }), { status: 200 }));
    const image = new Blob(["jpeg"], { type: "image/jpeg" });
    await enrollFace("u1", image);
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("deletes an enrollment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await expect(deleteFaceEnrollment("u1")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/services/faceManagementService.test.ts`

Expected: FAIL because `faceManagementService.ts` does not exist.

- [ ] **Step 3: Implement the minimal typed service and permission field**

Add `permissions?: string[]` to `UserProfile`. Implement a shared request parser that reads `message` or `error`, throws `FaceManagementError` with HTTP status, encodes user IDs, sets bearer authorization, and never manually sets multipart `Content-Type`.

```ts
export interface FaceEnrollmentStatus { registered: boolean }
export interface FaceEnrollmentMutation { registered: true; operation: "register" | "replace" }

export function canManageFaces(profile?: Pick<UserProfile, "role" | "permissions"> | null): boolean {
  return Boolean(profile && (profile.role === "superadmin" || profile.role === "admin" || profile.permissions?.includes("*") || profile.permissions?.includes("face:manage")));
}
```

- [ ] **Step 4: Run GREEN verification**

Run: `npx vitest run src/services/faceManagementService.test.ts`

Expected: 1 test file passes.

- [ ] **Step 5: Commit the slice**

```bash
git add src/types/common.ts src/services/faceManagementService.ts src/services/faceManagementService.test.ts
git commit -m "feat: add face management client"
```

### Task 2: Testable browser-camera session

**Files:**
- Create: `src/components/settings/faceCamera.ts`
- Create: `src/components/settings/faceCamera.test.ts`

**Interfaces:**
- Consumes: `MediaDevices.getUserMedia`, `HTMLVideoElement`, canvas factory, `URL.createObjectURL` and `URL.revokeObjectURL`.
- Produces: `startFaceCamera(mediaDevices): Promise<MediaStream>`, `captureFaceJpeg(video, createCanvas): Promise<Blob>`, `stopMediaStream(stream): void`, and `cameraErrorMessage(error): string`.

- [ ] **Step 1: Write failing camera lifecycle tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { cameraErrorMessage, captureFaceJpeg, startFaceCamera, stopMediaStream } from "./faceCamera";

it("requests the preferred front camera", async () => {
  const stream = {} as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  await expect(startFaceCamera({ getUserMedia } as never)).resolves.toBe(stream);
  expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: { facingMode: { ideal: "user" } } });
});

it("stops every track", () => {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  stopMediaStream({ getTracks: () => tracks } as never);
  tracks.forEach(track => expect(track.stop).toHaveBeenCalledOnce());
});

it("captures an image/jpeg blob", async () => {
  const blob = new Blob(["jpeg"], { type: "image/jpeg" });
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toBlob: (cb: BlobCallback) => cb(blob) };
  await expect(captureFaceJpeg({ videoWidth: 640, videoHeight: 480 } as never, () => canvas as never)).resolves.toBe(blob);
});

it.each([
  ["NotAllowedError", "quyền camera"],
  ["NotFoundError", "không tìm thấy camera"],
  ["NotReadableError", "đang được ứng dụng khác sử dụng"],
])("maps %s to actionable Vietnamese copy", (name, copy) => {
  expect(cameraErrorMessage(Object.assign(new Error(), { name }))).toContain(copy);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/components/settings/faceCamera.test.ts`

Expected: FAIL because `faceCamera.ts` does not exist.

- [ ] **Step 3: Implement the camera helpers**

Implement exact constraints, zero-dimension rejection, missing 2D context rejection, null-blob rejection, deterministic track cleanup, and Vietnamese error mapping. Keep React and UI state out of this module.

- [ ] **Step 4: Run GREEN verification**

Run: `npx vitest run src/components/settings/faceCamera.test.ts`

Expected: all camera-helper tests pass.

- [ ] **Step 5: Commit the slice**

```bash
git add src/components/settings/faceCamera.ts src/components/settings/faceCamera.test.ts
git commit -m "feat: add face camera lifecycle"
```

### Task 3: Camera enrollment modal

**Files:**
- Create: `src/components/settings/FaceEnrollmentCameraModal.tsx`
- Create: `src/components/settings/FaceEnrollmentCameraModal.test.tsx`

**Interfaces:**
- Consumes: `employee: Pick<UserProfile, "uid" | "displayName" | "email">`, `onSubmit(image: Blob): Promise<void>`, `onClose(): void`, and Task 2 helpers.
- Produces: a modal with `Bật camera`, `Chụp ảnh`, `Chụp lại`, and `Xác nhận` states.

- [ ] **Step 1: Write failing modal behavior tests**

Use `// @vitest-environment jsdom`, Testing Library, a fake `MediaStream`, mocked canvas `toBlob`, and mocked object URL functions. Assert that camera start calls `getUserMedia`, capture stops tracks, retake restarts the camera, confirm calls `onSubmit` with an `image/jpeg` blob, rejected submit leaves the modal open, and close/unmount stops tracks and revokes the preview URL.

```tsx
render(<FaceEnrollmentCameraModal employee={employee} onSubmit={onSubmit} onClose={onClose} />);
await user.click(screen.getByRole("button", { name: "Bật camera" }));
await user.click(screen.getByRole("button", { name: "Chụp ảnh" }));
expect(track.stop).toHaveBeenCalled();
await user.click(screen.getByRole("button", { name: "Xác nhận" }));
expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: "image/jpeg" }));
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/components/settings/FaceEnrollmentCameraModal.test.tsx`

Expected: FAIL because the modal component does not exist.

- [ ] **Step 3: Implement the modal**

Use refs for video and active stream; attach `video.srcObject`, call `video.play()`, capture through Task 2, stop before preview, use a face-position oval overlay, disable actions while submitting, show the passed rejection message, and centralize cleanup in one idempotent callback used by capture, close, and effect cleanup.

- [ ] **Step 4: Run GREEN verification**

Run: `npx vitest run src/components/settings/faceCamera.test.ts src/components/settings/FaceEnrollmentCameraModal.test.tsx`

Expected: both files pass with no unhandled errors.

- [ ] **Step 5: Commit the slice**

```bash
git add src/components/settings/FaceEnrollmentCameraModal.tsx src/components/settings/FaceEnrollmentCameraModal.test.tsx
git commit -m "feat: add face enrollment camera modal"
```

### Task 4: Face-recognition Settings tab and navigation

**Files:**
- Create: `src/components/settings/FaceRecognitionSettingsTab.tsx`
- Create: `src/components/settings/FaceRecognitionSettingsTab.test.tsx`
- Create: `src/pages/settings-face-recognition.test.tsx`
- Modify: `src/pages/SettingsTab.tsx`
- Modify: `src/router/subTabRoutes.ts`

**Interfaces:**
- Consumes: `authService.getAllUsers/getUsersByCompany/getColleagues`, Task 1 service, Task 3 modal, `useAuth().userProfile`.
- Produces: Settings route value `face-recognition`, permission-aware tab navigation, employee search/status list, enroll/replace/delete orchestration.

- [ ] **Step 1: Write failing list and navigation tests**

Use jsdom and Testing Library. Mock `useAuth`, `authService`, and the Task 1 service. Assert authorized profiles see the navigation button, unauthorized profiles do not, inaccessible `?sub=nhan-dien-khuon-mat` falls back to profile, employee rows render before status requests finish, search filters name/email, enroll success changes the row to `Đã khởi tạo`, delete requires confirmation and changes it to `Chưa khởi tạo`, and one failed status marks only that employee unavailable.

```tsx
expect(await screen.findByText("Nguyễn Văn A")).toBeInTheDocument();
expect(screen.getByText("Chưa khởi tạo")).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: /Khởi tạo nhận diện/ }));
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run src/components/settings/FaceRecognitionSettingsTab.test.tsx src/pages/settings-face-recognition.test.tsx`

Expected: FAIL because the tab, route, and navigation do not exist.

- [ ] **Step 3: Implement status orchestration and UI**

Load employees by role/company, exclude superadmin system accounts from enrollment rows, render the list immediately, and resolve statuses with a fixed concurrency of four. Store per-user status in a keyed record. Keep mutation state per selected user, map service errors to the modal/toast, and update only the successful row. Use the existing `ConfirmDialog` for deletion.

- [ ] **Step 4: Wire Settings navigation safely**

Add `"face-recognition"` and slug `"nhan-dien-khuon-mat"`. Lazy-load the new tab. Render its button and content only when `canManageFaces(userProfile)` is true. Add an effect that resets an unauthorized active face sub-tab to `profile`.

- [ ] **Step 5: Run GREEN verification**

Run: `npx vitest run src/services/faceManagementService.test.ts src/components/settings/faceCamera.test.ts src/components/settings/FaceEnrollmentCameraModal.test.tsx src/components/settings/FaceRecognitionSettingsTab.test.tsx src/pages/settings-face-recognition.test.tsx`

Expected: all five focused frontend test files pass.

- [ ] **Step 6: Run integration verification**

Run: `npx vitest run server/service/insightface.service.test.ts server/service/cloudinary.service.test.ts server/middleware/face-permission.test.ts server/model/face-enrollment-audit.model.test.ts server/controller/face-management.controller.test.ts server/service/attendance-face-gate.service.test.ts server/router/timekeeping.multipart.test.ts src/services/faceManagementService.test.ts src/components/settings/faceCamera.test.ts src/components/settings/FaceEnrollmentCameraModal.test.tsx src/components/settings/FaceRecognitionSettingsTab.test.tsx src/pages/settings-face-recognition.test.tsx`

Run: `npm run typecheck`

Run: `npm run build`

Expected: focused backend/frontend tests, typecheck, and production build all exit 0.

- [ ] **Step 7: Commit the completed UI**

```bash
git add src/components/settings/FaceRecognitionSettingsTab.tsx src/components/settings/FaceRecognitionSettingsTab.test.tsx src/pages/settings-face-recognition.test.tsx src/pages/SettingsTab.tsx src/router/subTabRoutes.ts
git commit -m "feat: manage employee face enrollment in settings"
```

### Task 5: Final branch audit

**Files:**
- Verify only; no production files are introduced by this task.

**Interfaces:**
- Consumes: all previous task outputs and Git index state.
- Produces: evidence that only face-recognition files are committed and unrelated working-tree edits remain untouched.

- [ ] **Step 1: Audit commit scope**

Run: `git diff origin/develop...HEAD --check`

Run: `git status --short`

Expected: no whitespace errors; unrelated assignment/student-management files remain unstaged and unchanged.

- [ ] **Step 2: Repeat final verification**

Run the focused test command from Task 4 Step 6, then `npm run typecheck`, then `npm run build`.

Expected: every command exits 0 before reporting completion or pushing.
