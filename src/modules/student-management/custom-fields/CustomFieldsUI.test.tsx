// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { CustomFieldDetails } from "./CustomFieldDetails";
import { CustomFieldEditorModal } from "./CustomFieldEditorModal";
import { CustomFieldRenderer } from "./CustomFieldRenderer";
import { CustomFieldsSection } from "./CustomFieldsSection";
import type { FieldDefinition } from "./types";
import { useCustomFields } from "./useCustomFields";

vi.mock("../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("./useCustomFields", () => ({ useCustomFields: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCustomFields = vi.mocked(useCustomFields);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots = new Set<{ root: Root; container: HTMLDivElement }>();

function matches(value: string, matcher: string | RegExp) { return typeof matcher === "string" ? value === matcher : matcher.test(value); }
function accessibleName(element: Element) { return element.getAttribute("aria-label") ?? element.textContent?.trim() ?? ""; }
function candidates(selector = "*") { return Array.from(document.body.querySelectorAll(selector)); }
function getByText(matcher: string | RegExp) {
  const found = candidates().find((item) => matches(item.textContent?.trim() ?? "", matcher) && !Array.from(item.children).some((child) => matches(child.textContent?.trim() ?? "", matcher)));
  if (!found) throw new Error(`Text not found: ${String(matcher)}`);
  return found as HTMLElement;
}
function getByRole(role: string, options?: { name?: string | RegExp }) {
  const selector = role === "button" ? "button,[role=button]" : `[role=${role}]`;
  const found = candidates(selector).find((item) => !options?.name || matches(accessibleName(item), options.name));
  if (!found) throw new Error(`Role not found: ${role} ${String(options?.name ?? "")}`);
  return found as HTMLElement;
}
function getByLabelText(matcher: string | RegExp, _options?: { exact?: boolean }) {
  const label = candidates("label").find((item) => matches(item.textContent?.trim() ?? "", matcher));
  if (!label) throw new Error(`Label not found: ${String(matcher)}`);
  const forId = label.getAttribute("for");
  const control = forId ? document.getElementById(forId) : label.querySelector("input,textarea,select");
  if (!control) throw new Error(`Control not found: ${String(matcher)}`);
  return control as HTMLInputElement;
}
const screen = {
  getByText,
  queryByText: (matcher: string | RegExp) => { try { return getByText(matcher); } catch { return null; } },
  findByText: (matcher: string | RegExp) => waitFor(() => getByText(matcher)),
  getByRole,
  queryByRole: (role: string, options?: { name?: string | RegExp }) => { try { return getByRole(role, options); } catch { return null; } },
  findByRole: (role: string, options?: { name?: string | RegExp }) => waitFor(() => getByRole(role, options)),
  getByLabelText,
  getByDisplayValue: (value: string) => {
    const found = candidates("input,textarea,select").find((item) => (item as HTMLInputElement).value === value);
    if (!found) throw new Error(`Value not found: ${value}`);
    return found as HTMLInputElement;
  },
};
async function waitFor<T>(assertion: () => T): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { return assertion(); } catch (error) { last = error; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
  }
  throw last;
}
function render(node: ReactNode) {
  const container = document.createElement("div"); document.body.appendChild(container);
  const root = createRoot(container); const entry = { root, container }; roots.add(entry);
  act(() => { root.render(node); });
  return {
    rerender(next: ReactNode) { act(() => { root.render(next); }); },
    unmount() { act(() => root.unmount()); container.remove(); roots.delete(entry); },
  };
}
const fireEvent = {
  click(element: Element) { act(() => { (element as HTMLElement).click(); }); },
  change(element: Element, init: { target: Record<string, unknown> }) {
    act(() => {
      Object.entries(init.target).forEach(([key, value]) => {
        if (key === "files") Object.defineProperty(element, "files", { configurable: true, value });
        else if (key === "checked") (element as HTMLInputElement).checked = Boolean(value);
        else {
          const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, key)?.set?.call(element, value);
        }
      });
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  },
};

const field = (overrides: Partial<FieldDefinition> = {}): FieldDefinition => ({
  id: "field-1", tenantId: "IGEN", moduleKey: "students", key: "favoriteColor",
  label: "Màu yêu thích", type: "text", isVisible: true, isRequired: false,
  isArchived: false, order: 1, createdBy: "admin", updatedBy: "admin", ...overrides,
});

const hookResult = (fields: FieldDefinition[] = [field()], archivedFields: FieldDefinition[] = []) => ({
  fields, archivedFields, loading: false, error: null as string | null, refresh: vi.fn(), createField: vi.fn(),
  updateField: vi.fn(), archiveField: vi.fn(), restoreField: vi.fn(), deleteField: vi.fn(),
});

beforeEach(() => {
  mockedApiFetch.mockReset();
  mockedUseAuth.mockReturnValue({ userProfile: { role: "user" } } as ReturnType<typeof useAuth>);
  mockedUseCustomFields.mockReturnValue(hookResult());
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  roots.forEach(({ root, container }) => { act(() => root.unmount()); container.remove(); });
  roots.clear();
  vi.unstubAllGlobals();
});

describe("CustomFieldRenderer", () => {
  it("maps every field type to an accessible controlled input", () => {
    const types: FieldDefinition["type"][] = [
      "text", "email", "phone", "url", "percent", "currency",
      "dateTime", "checkbox",
      "file", "image",
    ];
    for (const type of types) {
      const { unmount } = render(<CustomFieldRenderer field={field({ id: type, key: type, label: type, type })} value={null} onChange={vi.fn()} />);
      expect(screen.getByLabelText(type, { exact: false })).toBeTruthy();
      unmount();
    }
  });

  it("reports controlled changes and connects errors with aria attributes", () => {
    const onChange = vi.fn();
    render(<CustomFieldRenderer field={field({ isRequired: true })} value="old" onChange={onChange} error="Bắt buộc" />);
    const input = screen.getByLabelText(/Màu yêu thích/);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.change(input, { target: { value: "new" } });
    expect(onChange).toHaveBeenCalledWith("new");
  });

  it("prechecks upload and supports success, failure and retry without clearing current value", async () => {
    const onChange = vi.fn();
    const uploadField = field({ type: "image", validation: { maxSizeMb: 1 as never, allowedMimeTypes: ["image/png"] } });
    const { rerender } = render(<CustomFieldRenderer field={uploadField} value={{ url: "https://old.test/a.png", fileName: "old.png" }} onChange={onChange} />);
    const input = screen.getByLabelText(/Màu yêu thích/);
    fireEvent.change(input, { target: { files: [new File(["x"], "bad.txt", { type: "text/plain" })] } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/loại tệp/i);
    expect(mockedApiFetch).not.toHaveBeenCalled();

    mockedApiFetch.mockRejectedValueOnce(new Error("Mất mạng")).mockResolvedValueOnce({ success: true, data: { url: "https://cdn.test/new.png", fileName: "new.png", mimeType: "image/png", size: 2, reference: "custom-fields/students/new" } });
    fireEvent.change(input, { target: { files: [new File(["ok"], "new.png", { type: "image/png" })] } });
    expect(await screen.findByText("Mất mạng")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /thử lại/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fileName: "new.png", url: "https://cdn.test/new.png" })));
    expect(mockedApiFetch).toHaveBeenLastCalledWith("/student-management/custom-fields/students/field-1/upload", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
    rerender(<CustomFieldRenderer field={uploadField} value={{ url: "https://old.test/a.png", fileName: "old.png" }} onChange={onChange} />);
  });
});

describe("CustomFieldEditorModal", () => {
  it("validates label, unique select options, safe patterns and maxSizeMb bounds while preserving input after failed submit", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Trùng tên"));
    render(<CustomFieldEditorModal open moduleKey="students" onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /^lưu$/i }));
    expect(await screen.findByText(/nhập nhãn/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/nhãn trường/i), { target: { value: "Tài liệu" } });
    fireEvent.change(screen.getByLabelText(/loại trường/i), { target: { value: "file" } });
    fireEvent.change(screen.getByLabelText(/kích thước tối đa/i), { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: /^lưu$/i }));
    expect(await screen.findByText(/1.*100/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/kích thước tối đa/i), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^lưu$/i }));
    expect(await screen.findByText("Trùng tên")).toBeTruthy();
    expect(screen.getByLabelText(/nhãn trường/i).value).toBe("Tài liệu");
  });

  it("forces required off when hidden", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CustomFieldEditorModal open moduleKey="students" initialField={field({ isRequired: true })} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText(/hiển thị/i));
    fireEvent.click(screen.getByRole("button", { name: /^lưu$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ isVisible: false, isRequired: false })));
  });

  it("submits type-aware checkbox defaults", async () => {
    const submitBoolean = vi.fn().mockResolvedValue(undefined);
    render(<CustomFieldEditorModal open moduleKey="students" initialField={field({ type: "checkbox", defaultValue: false })} onClose={vi.fn()} onSubmit={submitBoolean} />);
    fireEvent.click(screen.getByRole("button", { name: /^lưu$/i }));
    await waitFor(() => expect(submitBoolean).toHaveBeenCalledWith(expect.objectContaining({ defaultValue: false })));
  });

  it("closes on Escape and initially focuses the label input", () => {
    const onClose = vi.fn();
    render(<CustomFieldEditorModal open moduleKey="students" onClose={onClose} onSubmit={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByLabelText(/nhãn trường/i));
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("CustomFieldsSection", () => {
  it("shows management controls only to managers and preserves parent values after create", async () => {
    const customHook = hookResult();
    customHook.createField.mockResolvedValue(field({ id: "new", key: "newField" }));
    mockedUseCustomFields.mockReturnValue(customHook);
    const onChange = vi.fn();
    const { rerender } = render(<CustomFieldsSection moduleKey="students" values={{ favoriteColor: "X", fixed: "keep" }} onChange={onChange} mode="create" />);
    expect(screen.queryByRole("button", { name: /thêm trường/i })).toBeNull();
    mockedUseAuth.mockReturnValue({ userProfile: { role: "manager" } } as ReturnType<typeof useAuth>);
    rerender(<CustomFieldsSection moduleKey="students" values={{ favoriteColor: "X", fixed: "keep" }} onChange={onChange} mode="create" />);
    fireEvent.click(screen.getByRole("button", { name: /thêm trường/i }));
    fireEvent.change(screen.getByLabelText(/nhãn trường/i), { target: { value: "Mới" } });
    fireEvent.click(screen.getByRole("button", { name: /^lưu$/i }));
    await waitFor(() => expect(customHook.createField).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /lưu trữ/i }));
    await waitFor(() => expect(customHook.archiveField).toHaveBeenCalledWith("field-1"));
  });

  it("keeps visible fields beside load error/retry and restores archived definitions", () => {
    const customHook = hookResult([field()], [field({ id: "old", key: "old", label: "Cũ", isArchived: true })]);
    customHook.error = "Không tải được";
    mockedUseCustomFields.mockReturnValue(customHook);
    mockedUseAuth.mockReturnValue({ userProfile: { role: "admin" } } as ReturnType<typeof useAuth>);
    render(<CustomFieldsSection moduleKey="students" values={{ favoriteColor: "X" }} onChange={vi.fn()} mode="edit" />);
    expect(screen.getByDisplayValue("X")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /thử lại/i }));
    expect(customHook.refresh).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /khôi phục/i }));
    expect(customHook.restoreField).toHaveBeenCalledWith("old");
  });
});

describe("CustomFieldDetails", () => {
  it("hides hidden/archived fields, formats values, maps option labels and blocks unsafe links", () => {
    const fields = [
      field({ id: "n", key: "n", label: "Số", type: "number" as any }),
      field({ id: "s", key: "s", label: "Chọn", type: "multiSelect" as any, options: [{ value: "a", label: "Phương án A" }] }),
      field({ id: "u", key: "u", label: "Link", type: "url" }),
      field({ id: "e", key: "e", label: "Trống" }),
      field({ id: "h", key: "h", label: "Ẩn", isVisible: false }),
      field({ id: "a", key: "a", label: "Lưu", isArchived: true }),
    ];
    mockedUseCustomFields.mockReturnValue(hookResult(fields));
    render(<CustomFieldDetails moduleKey="students" values={{ n: 1234, s: ["a"], u: "javascript:alert(1)" }} />);
    expect(screen.getByText(/1[.,]234/)).toBeTruthy();
    expect(screen.getByText("Phương án A")).toBeTruthy();
    expect(screen.getByText("javascript:alert(1)").closest("a")).toBeNull();
    expect(screen.getByText("Chưa cập nhật")).toBeTruthy();
    expect(screen.queryByText("Ẩn")).toBeNull();
    expect(screen.queryByText("Lưu")).toBeNull();
  });
});
