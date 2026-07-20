// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import type { Student } from "../../types";
import { useCustomFields } from "../../custom-fields/useCustomFields";
import { AddStudentModal } from "./AddStudentModal";
import { EditStudentModal } from "./EditStudentModal";
import { ProfileTab } from "./DetailTabs/ProfileTab";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: new Proxy({}, { get: (_target, tag) => tag }),
}));
vi.mock("../../../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../hooks/useBatches", () => ({ useBatches: () => ({ batches: [] }) }));
vi.mock("../../hooks/useAdminCenters", () => ({ useAdminCenters: () => ({ centers: [] }) }));
vi.mock("../../../../pages/Toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("../../custom-fields/useCustomFields", () => ({ useCustomFields: vi.fn() }));

const mockedAuth = vi.mocked(useAuth);
const mockedApiFetch = vi.mocked(apiFetch);
const mockedCustomFields = vi.mocked(useCustomFields);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots = new Set<{ root: Root; container: HTMLDivElement }>();

function matches(value: string, matcher: string | RegExp) { return typeof matcher === "string" ? value === matcher : matcher.test(value); }
function accessibleName(element: Element) {
  const explicit = element.getAttribute("aria-label");
  if (explicit) return explicit;
  const label = element.closest("label") ?? (element.id ? document.querySelector(`label[for="${element.id}"]`) : null);
  return label?.textContent?.trim() ?? element.textContent?.trim() ?? "";
}
function candidates(selector = "*") { return Array.from(document.body.querySelectorAll(selector)); }
function getByText(matcher: string | RegExp) {
  const found = candidates().find((item) => matches(item.textContent?.trim() ?? "", matcher) && !Array.from(item.children).some((child) => matches(child.textContent?.trim() ?? "", matcher)));
  if (!found) throw new Error(`Text not found: ${String(matcher)}`);
  return found as HTMLElement;
}
function getByRole(role: string, options?: { name?: string | RegExp }) {
  const selector = role === "button" ? "button,[role=button]" : role === "textbox" ? "input:not([type]),input[type=text],input[type=email],input[type=tel],input[type=url],textarea" : `[role=${role}]`;
  const found = candidates(selector).find((item) => !options?.name || matches(accessibleName(item), options.name));
  if (!found) throw new Error(`Role not found: ${role} ${String(options?.name ?? "")}`);
  return found as HTMLElement;
}
function getByDisplayValue(value: string) {
  const found = candidates("input,textarea,select").find((item) => (item as HTMLInputElement).value === value);
  if (!found) throw new Error(`Value not found: ${value}`);
  return found as HTMLInputElement;
}
function getByName(name: string) {
  const found = document.body.querySelector(`[name="${name}"]`);
  if (!found) throw new Error(`Name not found: ${name}`);
  return found as HTMLInputElement;
}
async function waitFor<T>(assertion: () => T): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { return assertion(); } catch (error) { last = error; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
  }
  throw last;
}
const screen = {
  getByRole,
  queryByRole: (role: string, options?: { name?: string | RegExp }) => { try { return getByRole(role, options); } catch { return null; } },
  getByDisplayValue,
  getByName,
  findByDisplayValue: (value: string) => waitFor(() => getByDisplayValue(value)),
  getByText,
  findByText: (matcher: string | RegExp) => waitFor(() => getByText(matcher)),
};
function render(node: ReactNode) {
  const container = document.createElement("div"); document.body.appendChild(container);
  const root = createRoot(container); const entry = { root, container }; roots.add(entry);
  act(() => { root.render(node); });
  return {
    rerender(next: ReactNode) { act(() => { root.render(next); }); },
  };
}
const fireEvent = {
  click(element: Element) { act(() => { (element as HTMLElement).click(); }); },
  change(element: Element, init: { target: Record<string, unknown> }) {
    act(() => {
      Object.entries(init.target).forEach(([key, value]) => {
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, key)?.set?.call(element, value);
      });
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  },
};

const favoriteField = {
  id: "field-1",
  tenantId: "tenant-1",
  moduleKey: "students" as const,
  key: "favoriteColor",
  label: "Màu yêu thích",
  type: "text" as const,
  isVisible: true,
  isRequired: false,
  isArchived: false,
  order: 1,
  createdBy: "admin",
  updatedBy: "admin",
};

function customFieldsResult(fields = [favoriteField]) {
  return {
    fields,
    archivedFields: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createField: vi.fn(),
    updateField: vi.fn(),
    archiveField: vi.fn(),
    restoreField: vi.fn(),
    deleteField: vi.fn(),
  };
}

const student = {
  id: "student-1",
  fullName: "Nguyễn An",
  phone: "0900000000",
  birthday: "",
  idCard: "",
  registrationDate: "18/07/2026",
  fee: "",
  address: "HCM",
  status: ["Đang học"],
  ownerId: "tenant-1",
  customFields: { favoriteColor: "Xanh" },
} as Student;

beforeEach(() => {
  localStorage.clear();
  mockedAuth.mockReturnValue({ userProfile: { role: "manager" } } as ReturnType<typeof useAuth>);
  mockedCustomFields.mockReturnValue(customFieldsResult() as ReturnType<typeof useCustomFields>);
  mockedApiFetch.mockImplementation(async (endpoint: string) => endpoint.startsWith("/partners")
    ? { success: true, partners: [] }
    : { success: true, data: { _id: "created-1" } });
});

afterEach(() => {
  roots.forEach(({ root, container }) => { act(() => root.unmount()); container.remove(); });
  roots.clear();
  vi.clearAllMocks();
});

describe("student custom-field integration", () => {
  it("uses shared role logic for the definition button", () => {
    const props = { isOpen: true, onClose: vi.fn(), onSuccess: vi.fn(), students: [] };
    const { rerender } = render(<AddStudentModal {...props} />);
    expect(screen.getByRole("button", { name: /thêm trường/i })).toBeTruthy();

    mockedAuth.mockReturnValue({ userProfile: { role: "user" } } as ReturnType<typeof useAuth>);
    rerender(<AddStudentModal {...props} />);
    expect(screen.queryByRole("button", { name: /thêm trường/i })).toBeNull();
  });

  it("sends add values and preserves fixed and dynamic input when definitions refresh", async () => {
    const props = { isOpen: true, onClose: vi.fn(), onSuccess: vi.fn(), students: [] };
    const { rerender } = render(<AddStudentModal {...props} />);
    fireEvent.change(screen.getByName("fullName"), { target: { value: "Nguyễn Bình" } });
    fireEvent.change(screen.getByName("phone"), { target: { value: "0911111111" } });
    fireEvent.change(screen.getByRole("textbox", { name: /màu yêu thích/i }), { target: { value: "Đỏ" } });

    mockedCustomFields.mockReturnValue(customFieldsResult([
      favoriteField,
      { ...favoriteField, id: "field-2", key: "nickname", label: "Biệt danh", order: 2 },
    ]) as ReturnType<typeof useCustomFields>);
    rerender(<AddStudentModal {...props} />);
    expect(screen.getByDisplayValue("Nguyễn Bình")).toBeTruthy();
    expect(screen.getByDisplayValue("Đỏ")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /lưu hồ sơ/i }));
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledWith("/students", expect.objectContaining({ method: "POST" })));
    const request = mockedApiFetch.mock.calls.find(([endpoint]) => endpoint === "/students")?.[1];
    expect(JSON.parse(String(request?.body))).toEqual(expect.objectContaining({ customFields: { favoriteColor: "Đỏ" } }));
  });

  it("hydrates and patches edit values while keeping server errors and form data visible", async () => {
    const onClose = vi.fn();
    render(<EditStudentModal student={student} isOpen onClose={onClose} onSuccess={vi.fn()} students={[student]} />);
    expect(await screen.findByDisplayValue("Xanh")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: /màu yêu thích/i }), { target: { value: "Tím" } });
    mockedApiFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith("/partners")) return { success: true, partners: [] };
      throw new Error("Trường Màu yêu thích là bắt buộc");
    });

    fireEvent.click(screen.getByRole("button", { name: /lưu học viên/i }));
    expect(await screen.findByText("Trường Màu yêu thích là bắt buộc")).toBeTruthy();
    expect(screen.getByDisplayValue("Tím")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    const request = mockedApiFetch.mock.calls.find(([endpoint]) => endpoint === "/students/student-1")?.[1];
    expect(JSON.parse(String(request?.body))).toEqual(expect.objectContaining({ customFields: { favoriteColor: "Tím" } }));
  });

  it("renders student custom-field details on the profile", () => {
    render(<ProfileTab student={student} />);
    expect(screen.getByText("Màu yêu thích")).toBeTruthy();
    expect(screen.getByText("Xanh")).toBeTruthy();
  });
});
