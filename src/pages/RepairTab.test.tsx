// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("../components/inventory/WarrantyLookupSection", () => ({ default: () => <div>Tra cứu bảo hành</div> }));
vi.mock("../modules/repair/RepairBoardPage", () => ({ default: () => <div>Phiếu sửa chữa</div> }));
vi.mock("../modules/repair/RepairReportsPanel", () => ({ default: () => <div>Báo cáo</div> }));

import RepairTab from "./RepairTab";

test("does not show the redundant IMEI history tab", () => {
  render(<RepairTab />);
  expect(screen.queryByRole("button", { name: "Lịch sử IMEI/SĐT" })).toBeNull();
});
