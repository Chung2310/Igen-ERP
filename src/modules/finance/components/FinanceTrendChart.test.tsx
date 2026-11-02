// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import FinanceTrendChart from "./FinanceTrendChart";
afterEach(cleanup);
it("shows dates and exact revenue/profit details on hover and touch", () => {
 render(<FinanceTrendChart data={[{date:"2026-09-04",revenue:21000000,cost:10000000,expense:1000000},{date:"2026-09-22",revenue:17000000,cost:15000000,expense:0}]}/>);
 expect(screen.getByText("04/09/2026")).toBeTruthy();
 fireEvent.pointerEnter(screen.getByRole("button",{name:"Xem ngày 04/09/2026"}));
 const tooltip=within(screen.getByRole("status"));
 expect(tooltip.getByText(/21\.000\.000/)).toBeTruthy();
 expect(tooltip.getByText(/11\.000\.000/)).toBeTruthy();
 fireEvent.pointerDown(screen.getByRole("button",{name:"Xem ngày 22/09/2026"}));
 expect(within(screen.getByRole("status")).getByText(/17\.000\.000/)).toBeTruthy();
});
it("keeps unknown costs unknown and allows keyboard inspection for a single day", () => {
 render(<FinanceTrendChart data={[{date:"2026-09-22",revenue:100,cost:null,expense:0}]}/>);
 fireEvent.focus(screen.getByRole("button",{name:"Xem ngày 22/09/2026"}));
 expect(within(screen.getByRole("status")).getAllByText("Chưa có dữ liệu")).toHaveLength(3);
 fireEvent.keyDown(screen.getByRole("group"),{key:"Escape"});
 expect(screen.queryByRole("status")).toBeNull();
});
