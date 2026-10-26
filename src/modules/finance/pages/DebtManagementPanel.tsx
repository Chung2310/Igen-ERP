import PayableNoteForm from "../components/PayableNoteForm";
import { useEffect, useState } from "react";
import { Banknote, ClipboardList, Eye } from "lucide-react";
import { useBranchOptional } from "../../../context/BranchContext";
import { financeManagement } from "../api/financeManagement.api";
import { Stats, DataTable, EntryForm, money, inputClass, buttonClass, type Field } from "../components/ManagementUI";
const actionButtonClass = "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
const bands = [["not_due", "Chưa quá hạn"], ["1-7", "1–7 ngày"], ["8-15", "8–15 ngày"], ["16-30", "16–30 ngày"], ["31-60", "31–60 ngày"], ["over60", "Trên 60 ngày"]];
const statuses: [
    string,
    string
][] = [["new", "Chưa xử lý"], ["contacted", "Đã liên hệ"], ["promised", "Hẹn thanh toán"], ["partial", "Thanh toán một phần"], ["done", "Đã xử lý"]];
export default function DebtManagementPanel({ mode, permissions, onOpen }: {
    mode: "debt" | "aging" | "reminders";
    permissions: readonly string[];
    onOpen: (id: string) => void;
}) {
    const branch = useBranchOptional();
    const [data, setData] = useState<any>();
    const [error, setError] = useState("");
    const [revision, setRevision] = useState(0);
    const [kind, setKind] = useState("receivable");
    const [search, setSearch] = useState("");
    const [bucket, setBucket] = useState("all");
    const [selected, setSelected] = useState<any>();
    const [form, setForm] = useState<"payable" | "payment" | "followup">();
    const [key, setKey] = useState("");
    const manager = permissions.includes("*") || permissions.includes("finance-wallet:manage");
    const canFollow = manager || permissions.includes("finance-receivable:manage");
    useEffect(() => { const c = new AbortController(); setData(undefined); setError(""); financeManagement("/debts", undefined, undefined, c.signal).then(setData).catch(e => { if (!c.signal.aborted)
        setError(e.message); }); return () => c.abort(); }, [revision, branch?.activeBranchId]);
    const raw = data ? kind === "receivable" ? data.receivables : data.payables : [];
    const list = raw.filter((r: any) => (mode === "debt" || r.balance > 0) && `${r.customerName || r.supplierName} ${r.sourceCode || r.receiptCode} ${r.payableCode || ""}`.toLowerCase().includes(search.toLowerCase()) && (bucket === "all" || bucket === "overdue" && r.daysUntil < 0 || bucket === "today" && r.daysUntil === 0 || ["3", "5", "7"].includes(bucket) && r.daysUntil >= 0 && r.daysUntil <= Number(bucket)));
    const total = (items: any[]) => items.reduce((s, r) => s + r.balance, 0);
    const fields: Field[] = form === "payment" ? [{ key: "date", label: "Ngày trả", type: "date", initial: new Date().toLocaleDateString("en-CA") }, { key: "amount", label: "Số tiền (VND)", type: "number", initial: selected?.balance }, { key: "method", label: "Phương thức", options: [["cash", "Tiền mặt"], ["transfer", "Chuyển khoản"], ["card", "Thẻ"], ["other", "Khác"]] }, { key: "note", label: "Ghi chú", required: false }] : [{ key: "status", label: "Trạng thái xử lý", options: statuses, initial: selected?.followup?.status || "new" }, { key: "promiseDate", label: "Ngày hẹn trả", type: "date", required: false, initial: selected?.followup?.promiseDate }, { key: "promiseAmount", label: "Tiền hẹn trả (VND)", type: "number", required: false, initial: selected?.followup?.promiseAmount || 0 }, { key: "assignee", label: "Người phụ trách", required: false, initial: selected?.followup?.assignee }, { key: "note", label: "Ghi chú", required: false, initial: selected?.followup?.note }];
    const customers = new Map<string, any>();
    for (const r of list) {
        const id = r.customerId || r.supplierId;
        const row = customers.get(id) || { name: r.customerName || r.supplierName, total: 0, original: 0, paid: 0, invoices: [], bands: Object.fromEntries(bands.map(([key]) => [key, 0])) };
        row.total += r.balance;
        row.original += r.originalAmount;
        row.paid += r.paidAmount;
        row.bands[r.aging] += r.balance;
        row.invoices.push(r);
        customers.set(id, row);
    }
    return <section className="mb-6 space-y-4"><div className="flex flex-wrap items-center gap-3"><button className={kind === "receivable" ? buttonClass : "px-3 py-2 text-sm text-on-surface-variant"} onClick={() => setKind("receivable")}>Phải thu khách hàng</button><button className={kind === "payable" ? buttonClass : "px-3 py-2 text-sm text-on-surface-variant"} onClick={() => setKind("payable")}>Phải trả nhà cung cấp</button><input className={`${inputClass} !w-auto`} placeholder="Tên, mã chứng từ…" value={search} onChange={e => setSearch(e.target.value)}/><select className={`${inputClass} !w-auto`} value={bucket} onChange={e => setBucket(e.target.value)}>{[["all", "Tất cả hạn"], ["overdue", "Quá hạn"], ["today", "Đến hạn hôm nay"], ["3", "Trong 3 ngày"], ["5", "Trong 5 ngày"], ["7", "Trong 7 ngày"]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>{kind === "payable" && manager && <button disabled={!data?.unregisteredReceipts.length} className={buttonClass} onClick={() => setForm("payable")}>Ghi nợ</button>}</div>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}{!data && !error && <p className="text-sm text-on-surface-variant">Đang tải công nợ…</p>}
    {data && <><p className="text-xs text-on-surface-variant">Số dư công nợ hiện tại. Khoản đã trả hết được giữ tại tab Công nợ, không hiển thị trong nhắc nợ và tuổi nợ.</p><Stats values={[["Còn nợ", money(total(list))], ["Quá hạn", money(total(list.filter((r: any) => r.daysUntil < 0)))], ["Đến hạn trong 5 ngày", money(total(list.filter((r: any) => r.daysUntil >= 0 && r.daysUntil <= 5)))], ["Đối tượng", customers.size]]}/>
      {kind === "payable" && data.unregisteredReceipts.length > 0 && <p className="rounded-xl border border-tertiary bg-tertiary-container p-3 text-sm text-on-tertiary-container">Có {data.unregisteredReceipts.length} phiếu nhập chưa có phiếu ghi nợ. Bấm Ghi nợ để chọn phiếu nhập, nhập hạn trả và số đã thanh toán. Số đã trả đầu kỳ chỉ để đối chiếu, không tạo phiếu chi mới.</p>}
      {mode === "aging" ? <DataTable headers={["Đối tượng", ...bands.map(b => b[1]), "Tổng"]} rows={[...customers.values()].map(r => [r.name, ...bands.map(([b]) => money(r.bands[b])), money(r.total)])}/> : mode === "debt" && kind === "receivable" ? <DataTable headers={["Khách hàng", "Giá trị chứng từ còn mở", "Đã trả", "Còn nợ", "Chi tiết hóa đơn"]} rows={[...customers.values()].map(r => [r.name, money(r.original), money(r.paid), money(r.total), <details><summary className="cursor-pointer text-on-primary-container">{r.invoices.length} chứng từ</summary>{r.invoices.map((i: any) => <button key={i._id} className="block py-1 text-left text-xs text-on-primary-container" onClick={() => onOpen(i._id)}>{i.sourceCode || i.receivableCode} · {money(i.balance)} · {i.dueDate}</button>)}</details>])}/> : <DataTable headers={["Đối tượng / chứng từ", "Hạn", "Giá trị / đã trả", "Còn nợ", "Theo dõi", "Thao tác"]} rows={list.map((r: any) => [<>{r.customerName || r.supplierName}<div className="text-xs text-on-surface-variant">{r.payableCode && <span className="block font-semibold text-on-surface">{r.payableCode}</span>}{r.sourceCode || r.receiptCode}</div></>, <span className={r.daysUntil < 0 ? "text-error" : r.daysUntil <= 7 ? "text-on-tertiary-container" : "text-on-surface-variant"}>{r.dueDate}{r.daysUntil < 0 && <div className="text-xs">Quá hạn {-r.daysUntil} ngày</div>}</span>, <>{money(r.originalAmount)}<div className="text-xs text-on-surface-variant">Đã trả {money(r.paidAmount)}</div></>, money(r.balance), <>{statuses.find(([v]) => v === r.followup?.status)?.[1] || "Chưa xử lý"}<div className="text-xs text-on-surface-variant">{r.followup?.promiseDate} {r.followup?.assignee}<br />{r.followup?.note}</div></>, <div className="flex flex-wrap items-center gap-2.5">
        {kind === "receivable" && <button type="button" title="Chi tiết và thu nợ" className={actionButtonClass + " border-primary bg-primary-container text-on-primary-container hover:bg-primary-container focus-visible:ring-primary"} onClick={() => onOpen(r._id)}><Eye size={14} aria-hidden="true"/>Chi tiết</button>}
        {kind === "payable" && manager && r.balance > 0 && <button type="button" title="Trả tiền nhà cung cấp" className={actionButtonClass + " border-secondary bg-secondary-container text-on-secondary-container hover:bg-secondary-container focus-visible:ring-secondary"} onClick={() => { setSelected(r); setKey(crypto.randomUUID()); setForm("payment"); }}><Banknote size={14} aria-hidden="true"/>Trả nợ</button>}
        {canFollow && <button type="button" title="Ghi nhận xử lý công nợ" className={actionButtonClass + " border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container-low focus-visible:ring-outline"} onClick={() => { setSelected(r); setForm("followup"); }}><ClipboardList size={14} aria-hidden="true"/>Theo dõi</button>}
      </div>])}/>}
    </>}
    {form === "payable" && <PayableNoteForm key={branch?.activeBranchId} receipts={data?.unregisteredReceipts || []} onSaved={() => setRevision(v => v + 1)} onClose={() => setForm(undefined)} />}
    {form && form !== "payable" && <EntryForm title={form === "payment" ? `Trả tiền ${selected?.supplierName}` : "Theo dõi nội bộ"} fields={fields} onClose={() => setForm(undefined)} onSave={async (values) => { if (form === "payment") {
        if (values.amount > selected.balance) throw new Error(`Số tiền thanh toán không được lớn hơn khoản nợ còn lại (${money(selected.balance)}).`);
        await financeManagement("/vouchers", { ...values, kind: "payment", category: "supplier", expenseClass: "none", payableId: selected._id, counterparty: selected.supplierName, idempotencyKey: key }); } if (form === "followup") {
        if (!values.promiseDate)
            delete values.promiseDate;
        await financeManagement("/followups", { ...values, targetType: kind, targetId: selected._id });
    } setRevision(v => v + 1); }}/>}
  </section>;
}
