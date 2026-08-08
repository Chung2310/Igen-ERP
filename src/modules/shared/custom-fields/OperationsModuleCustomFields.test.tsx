// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../student-management/lib/api";
import type { Partner, ResourceItem } from "../../student-management/types";
import { AddResourceModal } from "../../student-management/pages/Resources/components/AddResourceModal";
import { ResourceCard } from "../../student-management/pages/Resources/components/ResourceCard";
import { AddPartnerModal } from "../../student-management/pages/Partners/components/AddPartnerModal";
import { PartnerDetailModal } from "../../student-management/pages/Partners/components/PartnerDetailModal";

vi.mock("../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: "admin" } }) }));
vi.mock("../hooks/useAdminCenters", () => ({ useAdminCenters: () => ({ centers: [] }) }));
vi.mock("../../../../pages/Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../pages/Partners/components/AddPayoutModal", () => ({ AddPayoutModal: () => null }));
vi.mock("../custom-fields/CustomFieldsSection", () => ({
  CustomFieldsSection: ({ moduleKey, values, onChange }: { moduleKey: string; values: Record<string, unknown>; onChange(values: Record<string, unknown>): void }) => (
    <input aria-label={`custom-${moduleKey}`} value={String(values.extra ?? "")} onChange={(event) => onChange({ ...values, extra: event.target.value })} />
  ),
}));
vi.mock("../custom-fields/CustomFieldDetails", () => ({
  CustomFieldDetails: ({ moduleKey, values }: { moduleKey: string; values: Record<string, unknown> }) => <span>{`details-${moduleKey}-${String(values.extra ?? "")}`}</span>,
}));

const mockedApiFetch = vi.mocked(apiFetch);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots = new Set<{ root: Root; container: HTMLDivElement }>();

function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.add({ root, container });
  act(() => root.render(node));
  return { container, rerender(next: ReactNode) { act(() => root.render(next)); } };
}

function change(element: HTMLInputElement, value: string) {
  if (!element) throw new Error(`Missing input. Body: ${document.body.textContent}`);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

const resource = {
  id: "resource-1", name: "Room 1", type: "Room", identifier: "R01", capacity: "20", status: "AVAILABLE",
  bookings: [], ownerId: "owner", customFields: { extra: "resource-existing" },
} as ResourceItem;

const partner = {
  _id: "partner-1", name: "Partner One", phone: "0900000000", commissionType: "fixed", commissionValue: 0,
  isActive: true, ownerId: "owner", referredStudentsCount: 0, totalCommission: 0, totalPaid: 0, unpaidBalance: 0,
  referredStudents: [], payoutHistory: [], customFields: { extra: "partner-existing" },
} as Partner;

beforeEach(() => mockedApiFetch.mockResolvedValue({ success: true, data: { _id: "created" } }));

afterEach(() => {
  roots.forEach(({ root, container }) => { act(() => root.unmount()); container.remove(); });
  roots.clear();
  vi.clearAllMocks();
});

describe("resource and partner custom-field integration", () => {
  it("keeps resource values through errors, sends create/update payloads, hydrates edit, and renders card details", async () => {
    const onClose = vi.fn();
    const props = { isOpen: true, onClose, onSuccess: vi.fn(), categories: [{ id: "room", name: "Room" }] };
    const view = render(<AddResourceModal {...props} />);
    const form = view.container.querySelector("form")!;
    const inputs = form.querySelectorAll<HTMLInputElement>('input[type="text"]');
    change(inputs[0], "New room"); change(inputs[1], "r02"); change(inputs[2], "30");
    change(form.querySelector('[aria-label="custom-resources"]')!, "resource-dirty");

    mockedApiFetch.mockRejectedValueOnce(new Error("server validation"));
    await submit(form);
    expect((view.container.querySelector('[aria-label="custom-resources"]') as HTMLInputElement).value).toBe("resource-dirty");
    expect(onClose).not.toHaveBeenCalled();
    expect(JSON.parse(String(mockedApiFetch.mock.calls[0][1]?.body)).customFields).toEqual({ extra: "resource-dirty" });

    view.rerender(<AddResourceModal {...props} resource={resource} />);
    await flush();
    expect((view.container.querySelector('[aria-label="custom-resources"]') as HTMLInputElement).value).toBe("resource-existing");
    mockedApiFetch.mockResolvedValueOnce({ success: true });
    await submit(view.container.querySelector("form")!);
    const update = mockedApiFetch.mock.calls.find(([path]) => path === "/student-resources/resource-1");
    expect(update?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(update?.[1]?.body)).customFields).toEqual({ extra: "resource-existing" });

    const card = render(<ResourceCard resource={resource} onBook={vi.fn()} onEdit={vi.fn()} onToggleMaintenance={vi.fn()} onDelete={vi.fn()} onCancelBooking={vi.fn()} />);
    expect(card.container.textContent).toContain("details-resources-resource-existing");
  });

  it("keeps partner values through errors, sends create/update payloads, hydrates edit, and renders modal details", async () => {
    const onClose = vi.fn();
    const props = { isOpen: true, onClose, onSuccess: vi.fn() };
    const view = render(<AddPartnerModal {...props} />);
    await flush();
    const form = view.container.querySelector("form")!;
    change(form.querySelector('[name="name"]')!, "New partner");
    change(form.querySelector('[name="phone"]')!, "0911111111");
    change(form.querySelector('[aria-label="custom-partners"]')!, "partner-dirty");

    mockedApiFetch.mockRejectedValueOnce(new Error("server validation"));
    await submit(form);
    expect((view.container.querySelector('[aria-label="custom-partners"]') as HTMLInputElement).value).toBe("partner-dirty");
    expect(onClose).not.toHaveBeenCalled();
    const create = mockedApiFetch.mock.calls.find(([path]) => path === "/partners");
    expect(JSON.parse(String(create?.[1]?.body)).customFields).toEqual({ extra: "partner-dirty" });

    view.rerender(<AddPartnerModal {...props} partner={partner} />);
    await flush();
    expect((view.container.querySelector('[aria-label="custom-partners"]') as HTMLInputElement).value).toBe("partner-existing");
    mockedApiFetch.mockResolvedValueOnce({ success: true });
    await submit(view.container.querySelector("form")!);
    const update = mockedApiFetch.mock.calls.find(([path]) => path === "/partners/partner-1");
    expect(update?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(update?.[1]?.body)).customFields).toEqual({ extra: "partner-existing" });

    mockedApiFetch.mockResolvedValueOnce({ success: true, data: partner });
    const detail = render(<PartnerDetailModal isOpen onClose={vi.fn()} partnerId={partner._id} />);
    await flush();
    expect(detail.container.textContent).toContain("details-partners-partner-existing");
  });
});
