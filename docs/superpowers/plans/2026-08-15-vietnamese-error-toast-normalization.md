# Vietnamese Error Toast Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bảo đảm mọi popup phát qua `toast.error` hiển thị nội dung tiếng Việt thân thiện.

**Architecture:** Tách chuẩn hóa nội dung lỗi thành một hàm thuần trong utility riêng, sau đó áp dụng tại điểm phát `toast.error` duy nhất. Cách này bao phủ cả literal phía client và `error.message` động từ API mà không thay đổi backend hay các loại toast khác.

**Tech Stack:** TypeScript, React, Vitest, CustomEvent

## Global Constraints

- Chỉ chuẩn hóa popup lỗi phát qua `toast.error`.
- Giữ nguyên thông báo đã có nội dung tiếng Việt.
- Không thay đổi log kỹ thuật, hợp đồng API, hoặc `toast.success`, `toast.warning`, `toast.info`.
- Không gọi dịch vụ dịch thuật bên ngoài lúc runtime.

---

### Task 1: Hàm chuẩn hóa nội dung lỗi

**Files:**
- Create: `src/utils/vietnameseErrorMessage.ts`
- Create: `src/utils/vietnameseErrorMessage.test.ts`

**Interfaces:**
- Consumes: Chuỗi lỗi bất kỳ từ UI hoặc API.
- Produces: `toVietnameseErrorMessage(message: unknown): string`.

- [ ] **Step 1: Viết test thất bại cho quy tắc chuẩn hóa**

```ts
import { describe, expect, it } from "vitest";
import { toVietnameseErrorMessage } from "./vietnameseErrorMessage";

describe("toVietnameseErrorMessage", () => {
  it("giữ nguyên thông báo tiếng Việt", () => {
    expect(toVietnameseErrorMessage("Không thể tải dữ liệu.")).toBe("Không thể tải dữ liệu.");
  });

  it.each([
    ["Failed to fetch", "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng."],
    ["Network request failed", "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng."],
    ["Unauthorized", "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại."],
    ["Forbidden", "Bạn không có quyền thực hiện thao tác này."],
    ["Upload failed", "Tải tệp lên thất bại. Vui lòng thử lại."],
    ["Request timeout", "Yêu cầu đã hết thời gian chờ. Vui lòng thử lại."],
  ])("dịch %s", (input, expected) => {
    expect(toVietnameseErrorMessage(input)).toBe(expected);
  });

  it("che lỗi tiếng Anh chưa nhận diện", () => {
    expect(toVietnameseErrorMessage("Something unusual happened in widget parser"))
      .toBe("Đã xảy ra lỗi. Vui lòng thử lại.");
  });
});
```

- [ ] **Step 2: Chạy test và xác nhận đỏ**

Run: `npx vitest run src/utils/vietnameseErrorMessage.test.ts`

Expected: FAIL vì module `vietnameseErrorMessage` chưa tồn tại.

- [ ] **Step 3: Cài đặt hàm tối thiểu**

```ts
const FALLBACK = "Đã xảy ra lỗi. Vui lòng thử lại.";
const VIETNAMESE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

const RULES = [
  { pattern: /failed to fetch|network(?: request)? (?:error|failed)|load failed/i, message: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng." },
  { pattern: /unauthorized|invalid token|jwt|session.*(?:expired|invalid)/i, message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." },
  { pattern: /forbidden|permission denied|not allowed|access denied/i, message: "Bạn không có quyền thực hiện thao tác này." },
  { pattern: /upload.*failed|failed.*upload/i, message: "Tải tệp lên thất bại. Vui lòng thử lại." },
  { pattern: /download.*failed|failed.*download/i, message: "Tải tệp xuống thất bại. Vui lòng thử lại." },
  { pattern: /timeout|timed out/i, message: "Yêu cầu đã hết thời gian chờ. Vui lòng thử lại." },
  { pattern: /not found/i, message: "Không tìm thấy dữ liệu yêu cầu." },
  { pattern: /validation|invalid|required/i, message: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại." },
  { pattern: /internal server error|server error/i, message: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau." },
] as const;

export function toVietnameseErrorMessage(message: unknown): string {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return FALLBACK;
  if (VIETNAMESE.test(text)) return text;
  return RULES.find(({ pattern }) => pattern.test(text))?.message || FALLBACK;
}
```

- [ ] **Step 4: Chạy test và xác nhận xanh**

Run: `npx vitest run src/utils/vietnameseErrorMessage.test.ts`

Expected: PASS toàn bộ test.

- [ ] **Step 5: Commit utility**

```bash
git add src/utils/vietnameseErrorMessage.ts src/utils/vietnameseErrorMessage.test.ts
git commit -m "feat(ui): normalize error messages to Vietnamese"
```

### Task 2: Áp dụng tại điểm phát popup lỗi

**Files:**
- Modify: `src/pages/Toast.tsx`
- Create: `src/pages/Toast.error-normalization.test.ts`

**Interfaces:**
- Consumes: `toVietnameseErrorMessage(message: unknown): string` từ Task 1.
- Produces: `toast.error(message, duration)` phát `CustomEvent` với `detail.message` đã chuẩn hóa.

- [ ] **Step 1: Viết test wiring thất bại**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("toast.error Vietnamese normalization wiring", () => {
  it("normalizes only error toast messages", () => {
    const source = readFileSync(new URL("./Toast.tsx", import.meta.url), "utf8");
    expect(source).toContain('import { toVietnameseErrorMessage } from "../utils/vietnameseErrorMessage";');
    expect(source).toContain("detail: { message: toVietnameseErrorMessage(message), type: 'error', duration }");
    expect(source).toContain("detail: { message, type: 'success', duration }");
  });
});
```

- [ ] **Step 2: Chạy test và xác nhận đỏ**

Run: `npx vitest run src/pages/Toast.error-normalization.test.ts`

Expected: FAIL vì `Toast.tsx` chưa import hoặc gọi hàm chuẩn hóa.

- [ ] **Step 3: Tích hợp hàm chuẩn hóa**

Thêm import:

```ts
import { toVietnameseErrorMessage } from "../utils/vietnameseErrorMessage";
```

Đổi riêng phương thức lỗi thành:

```ts
error: (message: string, duration = 5000) => {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, {
    detail: { message: toVietnameseErrorMessage(message), type: "error", duration },
  }));
},
```

- [ ] **Step 4: Chạy test liên quan và typecheck**

Run: `npx vitest run src/utils/vietnameseErrorMessage.test.ts src/pages/Toast.error-normalization.test.ts`

Expected: 2 test files PASS.

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 5: Commit tích hợp**

```bash
git add src/pages/Toast.tsx src/pages/Toast.error-normalization.test.ts
git commit -m "fix(ui): display error popups in Vietnamese"
```

### Task 3: Xác minh hồi quy và cập nhật nhánh

**Files:**
- Verify only; no production files expected.

**Interfaces:**
- Consumes: Hai task đã hoàn thành.
- Produces: Nhánh sạch, kiểm thử đạt và sẵn sàng push.

- [ ] **Step 1: Chạy bộ regression liên quan**

Run: `npx vitest run src/utils/vietnameseErrorMessage.test.ts src/pages/Toast.error-normalization.test.ts server/service/cloudinary.service.test.ts server/router/media-upload-permission.test.ts server/controller/media.controller.test.ts src/components/hr/kanbanAttachmentWiring.test.ts`

Expected: tất cả test files PASS, 0 failures.

- [ ] **Step 2: Chạy kiểm tra tĩnh**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `git diff --check`

Expected: exit code 0.

- [ ] **Step 3: Kiểm tra lịch sử và trạng thái**

Run: `git status --short --branch && git log -5 --oneline`

Expected: nhánh `fix/kanban-media-upload-permission`, không còn thay đổi chưa commit ngoài tài liệu kế hoạch.
