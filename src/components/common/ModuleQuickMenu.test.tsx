// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ModuleQuickMenu } from "./ModuleQuickMenu";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { role: "admin" }, hasPermission: () => true }),
}));
vi.mock("../../pages/Sidebar", () => ({
  getAvailableMenuItems: () => [{ label: "TỔNG QUAN", title: "Tổng quan", group: "main", locked: false }],
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  };
});

afterEach(cleanup);

it("keeps the menu open after Strict Mode replays the dialog effect", async () => {
  const onClose = vi.fn();
  render(<StrictMode><ModuleQuickMenu currentTab="TỔNG QUAN" onClose={onClose} /></StrictMode>);

  await waitFor(() => expect(screen.getByRole("dialog", { name: "Danh sách phân hệ và tính năng" })).toHaveProperty("open", true));
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getAllByRole("link", { name: "Tổng quan" })).toHaveLength(2);

  await userEvent.setup().click(screen.getByRole("button", { name: "Đóng danh sách phân hệ" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
