# Face Recognition Settings Design

## Goal

Add a dedicated Face Recognition tab to ERP Settings so authorized administrators can enroll, replace, inspect, and delete an employee's face registration using a live camera capture.

## Scope

- Add a dedicated `Nhận diện khuôn mặt` sub-tab in ERP Settings.
- Limit the UI and all management operations to superadmins, admins, or users with `face:manage`.
- List employees within the current user's company and hierarchy scope.
- Show each employee's enrollment status.
- Support one live JPEG capture for enrollment or replacement.
- Support deletion with explicit confirmation.
- Reuse the existing `/api/v1/face-management/users/:userId` backend endpoints.

The feature does not add an attendance enable/disable switch, upload-from-disk enrollment, multi-angle enrollment, or employee self-enrollment.

## Architecture

`SettingsTab` owns navigation and permission-based visibility. A focused `FaceRecognitionSettingsTab` owns employee discovery, enrollment-status loading, filtering, and mutations. A reusable camera modal owns browser-media access, preview, capture, retake, cleanup, and submission confirmation. A small service module owns the typed HTTP contract with the existing face-management API.

The backend remains the final authorization boundary. Frontend visibility is only a usability control; every status, register, replace, and delete request continues through `requirePermission("face:manage")`, company access, and hierarchy access.

## Authorization

The Settings sub-tab is visible when the current profile satisfies at least one condition:

- role is `superadmin`;
- role is `admin`;
- permissions contain `*`;
- permissions contain `face:manage`.

Unauthorized users cannot navigate to or render the tab. Direct API requests remain protected by the existing backend middleware.

## Employee List

The tab loads employees through the existing user service conventions:

- superadmins may load all users and use the existing company context/filter;
- company admins load users in their company;
- delegated managers load only users returned by the permitted hierarchy-aware source.

Each row shows employee name, email, company/department where available, and one enrollment state:

- loading;
- enrolled;
- not enrolled;
- unavailable/error.

The page supports text search. Status requests must not block rendering the list and must have bounded concurrency to avoid sending an unbounded burst of requests.

## Camera Enrollment Flow

1. The operator chooses `Khởi tạo nhận diện` or `Cập nhật nhận diện` for an employee.
2. A modal explains that the camera image is used for face enrollment.
3. The operator explicitly starts the camera.
4. The browser requests `getUserMedia` with video only and `facingMode: "user"` preference.
5. The modal displays the live video with a face-position guide.
6. The operator captures one frame into an off-screen canvas.
7. The canvas produces a JPEG blob. The media tracks stop immediately after capture.
8. The operator may retake or confirm.
9. Confirm sends `multipart/form-data` with the exact field name `file` to `POST /api/v1/face-management/users/:userId`.
10. Success closes the modal and updates the employee row to enrolled without a page reload.

Closing the modal, switching employee, capture completion, component unmount, or any error must stop every active media track. Preview object URLs must be revoked. Images must not be written to localStorage or another frontend persistence mechanism.

## Delete Flow

Deletion is available only for an enrolled employee. The operator must confirm the employee identity and destructive action. The client then calls `DELETE /api/v1/face-management/users/:userId`. Success updates the row to not enrolled without reloading the page.

## Error Handling

- Missing `navigator.mediaDevices.getUserMedia`: explain that the device or browser does not support camera access.
- `NotAllowedError`: explain that camera permission was denied and must be re-enabled in browser settings.
- `NotFoundError`: explain that no camera was found.
- `NotReadableError`: explain that the camera may be in use by another application and offer retry.
- Capture failure: keep the modal open and allow retry.
- InsightFace business rejection such as no face, multiple faces, poor quality, or failed liveness: show the server message and retain the captured/retake flow.
- InsightFace unavailable or network failure: show a service error and do not change the current row state.
- Status lookup failure: mark only the affected row unavailable and allow retry.

## Components and Interfaces

- `src/pages/SettingsTab.tsx`: adds the navigation item and permission guard.
- `src/components/settings/FaceRecognitionSettingsTab.tsx`: employee list, filtering, status orchestration, enrollment and deletion state.
- `src/components/settings/FaceEnrollmentCameraModal.tsx`: camera lifecycle and capture UI.
- `src/services/faceManagementService.ts`: typed status, enroll/replace, and delete HTTP calls.
- Focused test files beside the new service/components or under the repository's established test convention.

The service exposes stable result types that distinguish enrolled status, business rejection, authorization failure, and service unavailability without leaking raw `Response` objects into UI components.

## Testing

Tests cover:

- permission calculation and Settings-tab visibility;
- successful camera permission and preferred front-camera constraints;
- unsupported camera, denied permission, missing device, and busy device;
- JPEG capture and media-track cleanup after capture, close, and unmount;
- retake behavior;
- multipart enrollment using field `file`;
- list state updates after enroll/replace/delete;
- business and service error presentation without corrupting enrollment state;
- focused frontend tests, existing face-management backend tests, TypeScript typecheck, and production build.

## Acceptance Criteria

- An authorized operator can find an employee in Settings and see enrollment state.
- The operator can grant camera access, capture one live image, retake it, and enroll or replace the employee's registration.
- The operator can delete an existing registration after confirmation.
- Unauthorized users cannot see the tab and backend authorization remains enforced.
- Camera resources and preview URLs are always released.
- The frontend sends the request contract expected by the existing InsightFace integration.
