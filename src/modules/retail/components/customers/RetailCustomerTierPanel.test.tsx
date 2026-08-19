// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { retailCustomerTiersApi } from "../../api/retailCustomerTiers.api";
import RetailCustomerTierPanel from "./RetailCustomerTierPanel";
vi.mock("../../api/retailCustomerTiers.api", () => ({ retailCustomerTiersApi: { tierHistory: vi.fn().mockResolvedValue([{ _id: "h1", toTierName: "VIP", source: "automatic", changedAt: "2026-08-12" }]), overrideTier: vi.fn().mockResolvedValue({}) } }));
afterEach(cleanup);
it("shows tier timeline and lets managers create a dated override", async () => {
  render(<RetailCustomerTierPanel scope={{ companyCode: "ACME", branchId: "B1" }} customerId="c1" canManage />);
  expect(await screen.findByText("VIP")).toBeTruthy();
  await userEvent.selectOptions(screen.getByRole("combobox"), "vip");
  await userEvent.type(screen.getByLabelText("Lý do override"), "Chăm sóc đặc biệt");
  await userEvent.type(screen.getByLabelText("Hiệu lực từ"), "2026-08-12");
  await userEvent.type(screen.getByLabelText("Hiệu lực đến"), "2026-09-12");
  await userEvent.click(screen.getByRole("button", { name: "Áp dụng hạng" }));
  await waitFor(() => expect(retailCustomerTiersApi.overrideTier).toHaveBeenCalledWith("c1", expect.objectContaining({ tierCode: "vip", reason: "Chăm sóc đặc biệt" }), { companyCode: "ACME", branchId: "B1" }));
}, 10_000);
