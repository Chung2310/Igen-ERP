// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import RetailReportFilters from "./RetailReportFilters";
afterEach(cleanup);

it("applies product dimensions without dropping the selected range", async () => {
  const onChange = vi.fn();
  render(<RetailReportFilters filters={{ from: "2026-08-01", to: "2026-08-10" }} today="2026-08-10" onChange={onChange} />);
  await userEvent.type(screen.getByLabelText("Nhân viên bán hàng"), "u1");
  await userEvent.type(screen.getByLabelText("SKU"), "S-1");
  await userEvent.type(screen.getByLabelText("Danh mục"), "Drinks");
  await userEvent.type(screen.getByLabelText("Thương hiệu"), "North");
  await userEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ from: "2026-08-01", to: "2026-08-10", salespersonId: "u1", sku: "S-1", category: "Drinks", brand: "North" }));
});

it("removes a cleared dimension from the applied filters", async () => {
  const onChange = vi.fn();
  render(<RetailReportFilters filters={{ preset: "7d", sku: "OLD" }} today="2026-08-10" onChange={onChange} />);
  await userEvent.clear(screen.getByLabelText("SKU"));
  await userEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.not.objectContaining({ sku: expect.any(String) }));
});
