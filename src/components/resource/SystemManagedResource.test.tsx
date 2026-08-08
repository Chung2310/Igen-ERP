// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ResourceItem } from "../../types";
import {
  SystemManagedResourceBadge,
  canMutateResourceItem,
} from "./SystemManagedResource";

function item(overrides: Partial<ResourceItem> = {}): ResourceItem {
  return {
    _id: "resource-1",
    companyCode: "ACME",
    section: "local",
    type: "file",
    name: "hop-dong.pdf",
    parentId: "folder-1",
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("system-managed resource UI", () => {
  it("shows the system badge and approved source route", () => {
    render(<SystemManagedResourceBadge item={item({
      managedType: "system",
      sourceModule: "hr",
      sourceEntityLabel: "NV001 - Nguyễn Văn A",
      sourceRoute: "/?tab=NHAN_SU&sub=hop-dong&sourceId=employee-1",
    })} showSourceLink />);

    expect(screen.getByText("Tạo bởi hệ thống")).toBeTruthy();
    expect(screen.getByText("NV001 - Nguyễn Văn A")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mở nguồn" }).getAttribute("href"))
      .toBe("/?tab=NHAN_SU&sub=hop-dong&sourceId=employee-1");
  });

  it("does not render a badge for a user-managed resource", () => {
    const { container } = render(<SystemManagedResourceBadge item={item({ managedType: "user" })} />);
    expect(container.childElementCount).toBe(0);
  });

  it("allows mutations only for non-fixed user-managed resources", () => {
    expect(canMutateResourceItem(item({ managedType: "system" }))).toBe(false);
    expect(canMutateResourceItem(item({ managedType: "user", isFixed: true }))).toBe(false);
    expect(canMutateResourceItem(item({ managedType: "user", isFixed: false }))).toBe(true);
  });
});
