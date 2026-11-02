// @vitest-environment jsdom
import React from "react";
import {it,expect,vi,afterEach} from "vitest";
import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import DebtManagementPanel from "./DebtManagementPanel";
import {financeManagement} from "../api/financeManagement.api";
vi.mock("../api/financeManagement.api",()=>({financeManagement:vi.fn()}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each(["aging","reminders","debt"] as const)("settled supplier debt stays only in history (%s)",async mode=>{
 vi.mocked(financeManagement).mockResolvedValue({receivables:[],unregisteredReceipts:[],payables:[{_id:"paid",supplierId:"S",supplierName:"Supplier paid",balance:0,originalAmount:100,paidAmount:100,daysUntil:-5,aging:"1-7",dueDate:"2026-09-01"}]});
 render(<DebtManagementPanel mode={mode} permissions={["*"]} onOpen={()=>{}}/>);
 await screen.findByText(/Số dư công nợ hiện tại/);
 fireEvent.click(screen.getByText("Phải trả nhà cung cấp"));
 expect(Boolean(screen.queryByText("Supplier paid"))).toBe(mode==="debt");
});

it("warns on overpayment without sending a voucher and allows correcting to the exact balance", async () => {
 vi.mocked(financeManagement).mockResolvedValue({receivables:[],unregisteredReceipts:[],payables:[{_id:"debt",supplierId:"S",supplierName:"Supplier",balance:40000000,originalAmount:50000000,paidAmount:10000000,daysUntil:-4,aging:"1-7",dueDate:"2026-09-24"}]});
 render(<DebtManagementPanel mode="debt" permissions={["*"]} onOpen={()=>{}}/>);
 await screen.findByText(/Số dư công nợ hiện tại/);
 fireEvent.click(screen.getByText("Phải trả nhà cung cấp"));
 fireEvent.click(screen.getByRole("button", { name: "Trả nợ" }));
 const amount = screen.getByLabelText("Số tiền (VND)");
 fireEvent.change(amount, {target:{value:"40000001"}});
 fireEvent.change(screen.getByLabelText("Ngày trả"), {target:{value:"2026-09-28"}});
 fireEvent.click(screen.getByText("Lưu"));
 expect((await screen.findByRole("alert")).textContent).toBe("Số tiền thanh toán không được lớn hơn khoản nợ còn lại (40.000.000 đ).");
 expect(vi.mocked(financeManagement).mock.calls.some(c=>c[0]==="/vouchers")).toBe(false);
 fireEvent.change(amount, {target:{value:"40000000"}});
 fireEvent.click(screen.getByText("Lưu"));
 await vi.waitFor(()=>expect(vi.mocked(financeManagement).mock.calls.some(c=>c[0]==="/vouchers" && (c[1] as any).amount===40000000)).toBe(true));
 await vi.waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
});
