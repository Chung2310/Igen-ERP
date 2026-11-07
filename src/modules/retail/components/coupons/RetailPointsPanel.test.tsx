// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RetailPointsPanel from "./RetailPointsPanel";
import { apiFetch } from "../../../shared/lib/apiFetch";

vi.mock("../../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ERP", branchId: "MAIN" } }) }));
vi.mock("../../../shared/lib/apiFetch", () => ({ apiFetch: vi.fn(async (path: string) => {
  if (path === "/retail/points/policy") return { data: { enabled: false, earnVndPerPoint: 10000, redeemVndPerPoint: 1000, maxRedeemPercent: 50, version: 1 } };
  throw new Error(`Unexpected request: ${path}`);
}) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("loads loyalty policy and keeps the customer ledger on the merged offers screen", async () => {
  render(<RetailPointsPanel />);
  expect(await screen.findByRole("heading", { name: "Chính sách điểm thưởng" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Sổ điểm khách hàng" })).toBeTruthy();
  expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm khách hàng theo tên, số điện thoại hoặc mã" }), { target: { value: "a" } });
  expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
});

it("saves the loyalty policy through the existing points endpoint", async () => {
  render(<RetailPointsPanel />);
  await screen.findByRole("button", { name: "Lưu chính sách" });
  fireEvent.click(screen.getByRole("button", { name: "Lưu chính sách" }));
  await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalledWith("/retail/points/policy", expect.objectContaining({ method: "PUT" })));
  expect(await screen.findByRole("status")).toHaveProperty("textContent", "Đã lưu chính sách điểm thưởng.");
});
