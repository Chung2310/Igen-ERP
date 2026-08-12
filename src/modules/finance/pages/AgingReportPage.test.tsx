// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { financeReceivablesApi } from "../api/financeReceivables.api";
import AgingReportPage from "./AgingReportPage";
vi.mock("../api/financeReceivables.api", () => ({ financeReceivablesApi: { aging: vi.fn() } }));
afterEach(cleanup);

describe("AgingReportPage", () => {
  it("renders four exact buckets and drills into the selected bucket", async () => {
    vi.mocked(financeReceivablesApi.aging).mockResolvedValue({ "0-30": { count: 1, balance: 10 }, "31-60": { count: 2, balance: 20 }, "61-90": { count: 3, balance: 30 }, over90: { count: 4, balance: 40 } });
    const drillDown = vi.fn();
    render(<AgingReportPage onDrillDown={drillDown} />);
    for (const label of ["0–30 ngày", "31–60 ngày", "61–90 ngày", "Trên 90 ngày"]) expect(await screen.findByText(label)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /31–60 ngày/i }));
    expect(drillDown).toHaveBeenCalledWith("31-60");
  });
});
