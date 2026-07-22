// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserManagementPanel } from "./UserManagementPanel";

vi.mock("./UserSearchPage", () => ({
  UserSearchPage: ({ onSelect }: any) => <button onClick={() => onSelect({ _id: "user-1" })}>Chọn Mai</button>,
}));

vi.mock("./UserDetailDialog", () => ({
  UserDetailDialog: ({ userId, onClose }: any) => <div role="dialog">Người dùng {userId}<button onClick={onClose}>Đóng</button></div>,
}));

afterEach(cleanup);

describe("UserManagementPanel", () => {
  it("opens and closes the selected user dialog", () => {
    render(<UserManagementPanel tenantId="SYSTEM" />);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Chọn Mai" }));
    expect(screen.getByText("Người dùng user-1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
