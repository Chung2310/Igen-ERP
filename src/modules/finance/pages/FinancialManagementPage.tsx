import {
  CashFlowOverviewChart,
  ProfitTopGroupsChart,
  VatStructureChart,
  BreakevenGaugeChart,
} from "../components/FinanceOverviewCharts";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  LockKeyhole,
  RefreshCw,
  Calendar,
  Building2,
  Receipt,
  ShieldAlert,
  Target,
  Plus,
  Download,
  Search,
  SlidersHorizontal,
  FileSpreadsheet,
} from "lucide-react";
import { useBranchOptional } from "../../../context/BranchContext";
import { StyledSelect } from "../../../components/common/StyledSelect";
import { useOverviewPeriod } from "../../../components/dashboard/OverviewPeriodContext";
import { AdminDatePicker } from "../../../components/user-admin/AdminDatePicker";
import { financeManagement } from "../api/financeManagement.api";
import { DataTable, Stats, EntryForm, money, inputClass, buttonClass, exportCsv, type Field } from "../components/ManagementUI";
import type { OverviewPeriod } from "../components/financeOverviewPeriods";
const today = () => new Date().toLocaleDateString("en-CA");
const FinanceOverviewDashboard = lazy(() => import("../components/FinanceOverviewDashboard"));
const categories: [
    string,
    string
][] = [["rent", "Thuê mặt bằng"], ["salary", "Lương"], ["marketing", "Marketing"], ["utilities", "Điện nước"], ["repair", "Sửa chữa"], ["other_expense", "Chi khác"], ["capital", "Vốn / không tính vào lãi lỗ"], ["other_receipt", "Thu khác"]];
const labelCategory = (v: string) => categories.find(c => c[0] === v)?.[1] || ({ depreciation: "Khấu hao tài sản", supplier: "Trả NCC", retail: "Bán hàng", refund: "Hoàn tiền", inventory: "Mua lại máy", debt: "Thu nợ" } as any)[v] || v;
export default function FinancialManagementPage({ view }: {
    view: "overview" | "cash" | "profit" | "vat" | "breakeven";
}) {
    const branch = useBranchOptional();
    const overviewPeriod = useOverviewPeriod();
    const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
    const [to, setTo] = useState(() => view === "breakeven" ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString("en-CA") : today());
    const [period, setPeriod] = useState<OverviewPeriod>("month");
    const reportFrom = view === "overview" && overviewPeriod ? overviewPeriod.from : from;
    const reportTo = view === "overview" && overviewPeriod ? overviewPeriod.to : to;
    const reportPeriod: OverviewPeriod = view === "overview" && overviewPeriod ? overviewPeriod.selection === "day" ? "7" : overviewPeriod.selection : period;
    const [data, setData] = useState<any>();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [revision, setRevision] = useState(0);
    const [form, setForm] = useState<"voucher" | "tax" | "settings" | "invoice">();
    const [idempotencyKey, setIdempotencyKey] = useState("");
    const [group, setGroup] = useState("productName");
    const [search, setSearch] = useState("");
    const [cashKind, setCashKind] = useState("");
    const [reversing, setReversing] = useState<any>();
    useEffect(() => { const controller = new AbortController(); setLoading(true); setData(undefined); setError(""); financeManagement(`/report?${new URLSearchParams({ from: reportFrom, to: reportTo })}`, undefined, undefined, controller.signal).then(setData).catch(e => { if (!controller.signal.aborted)
        setError(e.message); }).finally(() => { if (!controller.signal.aborted)
        setLoading(false); }); return () => controller.abort(); }, [reportFrom, reportTo, revision, branch?.activeBranchId]);
    const preset = (value: string) => { const now = new Date(); const start = new Date(now); if (value === "7" || value === "30")
        start.setDate(start.getDate() - Number(value) + 1); if (value === "month")
        start.setDate(1); if (value === "quarter") {
        start.setDate(1);
        start.setMonth(Math.floor(now.getMonth() / 3) * 3);
    } if (value === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7); if (value === "year") {
        start.setDate(1);
        start.setMonth(0);
    } setPeriod(value as OverviewPeriod); setFrom(start.toLocaleDateString("en-CA")); setTo(today()); };
    const s = data?.summary;
    const filtered = (data?.lines || []).filter((l: any) => `${l.productName} ${l.sku} ${l.brand || ""} ${l.category || ""} ${l.salespersonName} ${(l.serialNumbers || []).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
    const groups = new Map<string, any>();
    for (const l of filtered) {
        const key = group === "loss" ? `${l.orderCode} · ${l.productName}` : group === "serialNumbers" ? (l.serialNumbers || []).join(", ") || "Không có IMEI" : l[group] || "Chưa phân loại";
        if (group === "loss" && (l.grossProfit == null || l.grossProfit >= 0 || l.quantity < 0))
            continue;
        const r = groups.get(key) || { key, quantity: 0, revenue: 0, cost: 0, grossProfit: 0, costSources: new Set<string>() };
        for (const f of ["quantity", "revenue", "cost", "grossProfit"])
            r[f] = r[f] == null || l[f] == null ? null : r[f] + l[f];
        const sourceLabel = ({ historical_average: "Bình quân tại lúc xuất kho", buyback_identifier: "Phiếu thu mua theo IMEI/mã", order_snapshot: "Đơn bán", stock_issue: "Phiếu xuất", receipt_identifier: "Phiếu nhập theo IMEI/mã", return_snapshot: "Phiếu hoàn" } as Record<string, string>)[l.costBasis] || "Chưa xác định";
        r.costSources.add(l.cost == null ? "Chưa xác định" : `${sourceLabel}: ${l.costReference || l.orderCode || ""}`);
        groups.set(key, r);
    }
    const profitRows = [...groups.values()];
    const cashRows = (data?.cash || []).filter((c: any) => (!cashKind || c.kind === cashKind) && `${c.code} ${c.counterparty || ""} ${labelCategory(c.category)}`.toLowerCase().includes(search.toLowerCase()));
    const fields: Field[] = form === "voucher" ? [
        { key: "kind", label: "Loại phiếu", options: [["payment", "Phiếu chi"], ["receipt", "Phiếu thu"]] }, { key: "date", label: "Ngày ghi nhận", type: "date", initial: today() }, { key: "category", label: "Danh mục", options: categories }, { key: "expenseClass", label: "Tính vào lãi lỗ", options: [["fixed", "Chi phí cố định"], ["variable", "Chi phí biến đổi"], ["none", "Không (vốn / dòng tiền)"]] }, { key: "amount", label: "Số tiền (VND)", type: "number" }, { key: "method", label: "Phương thức", options: [["cash", "Tiền mặt"], ["transfer", "Chuyển khoản"], ["card", "Thẻ"], ["other", "Khác"]] }, { key: "counterparty", label: "Đối tượng", required: false }, { key: "attachment", label: "Đường dẫn chứng từ HTTPS", type: "url", required: false }, { key: "note", label: "Ghi chú", required: false },
    ] : form === "invoice" ? [{ key: "id", label: "Hóa đơn đã phát hành", options: (data?.invoiceCandidates || []).map((r: any) => [r.id, `${r.invoiceNo} · ${r.counterparty} · VAT ${money(r.vat)}`]) }] : form === "tax" ? [{ key: "direction", label: "Loại VAT", options: [["input", "Đầu vào"], ["output", "Đầu ra"]] }, { key: "date", label: "Ngày hóa đơn", type: "date", initial: today() }, { key: "invoiceNumber", label: "Số hóa đơn" }, { key: "taxId", label: "Mã số thuế" }, { key: "counterparty", label: "Đối tác", required: false }, { key: "base", label: "Tiền trước thuế (VND)", type: "number" }, { key: "rate", label: "Thuế suất (%)", type: "number" }, { key: "vat", label: "Tiền VAT (VND)", type: "number" }, { key: "deductible", label: "Đủ điều kiện khấu trừ", options: [["false", "Chưa xác nhận"], ["true", "Đã xác nhận"]] }, { key: "note", label: "Ghi chú", required: false }] : [{ key: "period", label: "Kỳ cấu hình", type: "month", initial: from.slice(0, 7) }, { key: "fixedCostBudget", label: "Ngân sách chi phí cố định (VND)", type: "number", initial: data?.settings?.fixedCostBudget ?? data?.breakeven?.fixedCosts ?? 0 }, { key: "vatCarryforward", label: "VAT chuyển kỳ trước (VND)", type: "number", initial: data?.settings?.vatCarryforward ?? 0 }, { key: "note", label: "Ghi chú", required: false }];
    const title = { overview: "Tổng quan tài chính", cash: "Thu - Chi", profit: "Lãi lỗ", vat: "Thuế VAT", breakeven: "Hòa vốn" }[view];
    const embeddedOverview = view === "overview" && Boolean(overviewPeriod);
    return <section className="finance-page-content">
      {view === "overview" && !embeddedOverview && <h1 className="finance-page-title">{title}</h1>}
      {/* Top Filter and Scope Toolbar */}
      {!embeddedOverview && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <StyledSelect
              ariaLabel="Kỳ nhanh"
              className="h-9 min-h-9 w-40 rounded-md"
              menuClassName="finance-select-menu"
              value={period}
              onChange={preset}
              options={[
                { value: "week", label: "Tuần này" },
                { value: "7", label: "7 ngày qua" },
                { value: "30", label: "30 ngày qua" },
                { value: "month", label: "Tháng này" },
                { value: "quarter", label: "Quý này" },
                { value: "year", label: "Năm nay" },
                ...(period === "custom" ? [{ value: "custom", label: "Tùy chỉnh", disabled: true }] : []),
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminDatePicker inline label="Từ ngày" value={from} max={to} onChange={value => { setPeriod("custom"); setFrom(value); }} />
            <AdminDatePicker inline label="Đến ngày" value={to} min={from} onChange={value => { setPeriod("custom"); setTo(value); }} />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface">
            <Building2 className="h-3.5 w-3.5 text-on-surface-variant shrink-0" />
            <span>{branch?.activeBranch?.name || "Chi nhánh đang chọn"}</span>
          </div>
          <button type="button" aria-label="Tải lại" onClick={() => setRevision(v => v + 1)} className="flex size-9 items-center justify-center rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:text-primary focus-visible:outline-2 focus-visible:outline-primary cursor-pointer">
            <RefreshCw size={15}/>
          </button>
        </div>
      </div>}
      {loading && <p className="text-sm font-medium text-on-surface-variant">Đang tải dữ liệu tài chính…</p>}
      {error && <div role="alert" className="flex items-center gap-2 rounded-md border border-error bg-error-container p-4 text-sm font-medium text-on-error-container"><LockKeyhole size={18}/>{error}</div>}
      {data && <>
        {s.missingCostCount > 0 && <p role="alert" className="rounded-md border border-tertiary bg-tertiary-container p-3.5 text-sm text-on-tertiary-container font-medium">Có {s.missingCostCount} dòng chưa xác định được giá vốn. Chưa đủ dữ liệu để tính tổng giá vốn, lợi nhuận và hòa vốn; cần đối chiếu chứng từ nhập/xuất liên kết.</p>}
        {view === "overview" && <Suspense fallback={<p role="status" className="text-sm text-on-surface-variant">Đang tải biểu đồ tài chính…</p>}><FinanceOverviewDashboard report={data} period={reportPeriod} from={reportFrom} to={reportTo} comparisonShownInToolbar={embeddedOverview} /></Suspense>}
        {view === "profit" && (
          <div className="space-y-2.5">
            <Stats values={[["Doanh thu hàng hóa", money(s.revenue)], ["Giá vốn", money(s.cost)], ["Lãi gộp", money(s.grossProfit)], ["Lãi ròng quản trị", money(s.netProfit)]]}/>
          </div>
        )}
        {view === "cash" && <>
          <Stats values={[["Tổng thu thực tế", money(s.cashIn)], ["Tổng chi thực tế", money(s.cashOut)], ["Dòng tiền ròng", money(s.cashIn - s.cashOut)], ["Chi phí đã ghi nhận", money(s.expense)]]}/>
          <CashFlowOverviewChart cashIn={s.cashIn} cashOut={s.cashOut} cashRows={cashRows} />
          <div className="flex flex-wrap items-center gap-3">
            <button className={`${buttonClass} inline-flex items-center gap-1.5 cursor-pointer`} onClick={() => { setIdempotencyKey(crypto.randomUUID()); setForm("voucher"); }}>
              <Plus className="h-4 w-4" />
              Tạo phiếu thu / chi
            </button>
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
              <input aria-label="Tìm chứng từ, đối tượng" className={`${inputClass} !w-auto pl-8 py-2 text-xs`} placeholder="Tìm chứng từ, đối tượng…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <StyledSelect ariaLabel="Lọc loại thu chi" className="h-9 w-36 rounded-md" menuClassName="finance-select-menu" value={cashKind} onChange={setCashKind} options={[
              { value: "", label: "Thu và chi" }, { value: "receipt", label: "Thu" }, { value: "payment", label: "Chi" },
            ]} />
            <button className="inline-flex items-center gap-1 text-xs font-bold text-on-primary-container hover:text-on-primary-container transition cursor-pointer" onClick={() => exportCsv("thu-chi", ["Mã", "Ngày", "Loại", "Danh mục", "Số tiền"], cashRows.map((r: any) => [r.code, r.date, r.kind, labelCategory(r.category), r.amount]))}>
              <Download className="h-3.5 w-3.5" />
              Xuất CSV
            </button>
          </div>
          <p className="text-xs text-on-surface-variant">Thu nợ tại Công nợ; trả nhà cung cấp tại Phải trả để tránh ghi nhận trùng.</p>
          <DataTable headers={["Ngày / mã", "Thu / chi", "Danh mục", "Đối tượng", "Số tiền", "Phương thức", "Người tạo", "Điều chỉnh"]} rows={cashRows.map((r: any) => [<>{r.date}<div className="max-w-52 break-all text-xs text-on-surface-variant">{r.code}</div></>, r.kind === "receipt" ? "Thu" : "Chi", labelCategory(r.category), r.counterparty || "—", money(r.amount), r.method, r.createdByName || "—", r.source === "finance" ? r.reversalOf ? <span title={r.reversalReason}>Phiếu đảo: {r.reversalReason}</span> : r.reversedBy ? "Đã đảo" : <button className="font-semibold text-error hover:text-on-error-container cursor-pointer" onClick={() => { setReversing(r); setIdempotencyKey(crypto.randomUUID()); }}>Đảo phiếu</button> : "—"])}/>
        </>}
        {view === "profit" && <>
          <ProfitTopGroupsChart rows={profitRows} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-on-surface-variant" />
              <StyledSelect ariaLabel="Nhóm dữ liệu lãi lỗ" className="h-9 w-44 rounded-md" menuClassName="finance-select-menu" value={group} onChange={setGroup} options={[["productName", "Theo sản phẩm"], ["serialNumbers", "Theo IMEI"], ["salespersonName", "Theo nhân viên"], ["branchId", "Theo chi nhánh"], ["category", "Theo nhóm hàng"], ["brand", "Theo thương hiệu"], ["loss", "Bán dưới giá vốn"]].map(([value, label]) => ({ value, label }))} />
            </div>
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
              <input aria-label="Lọc sản phẩm, IMEI, nhân viên" className={`${inputClass} !w-auto pl-8 py-2 text-xs`} placeholder="Lọc sản phẩm, IMEI, nhân viên…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <button className="inline-flex items-center gap-1 text-xs font-bold text-on-primary-container hover:text-on-primary-container transition cursor-pointer" onClick={() => exportCsv("lai-lo", ["Nhóm", "Số lượng", "Doanh thu", "Giá vốn", "Lãi gộp"], profitRows.map(r => [r.key, r.quantity, r.revenue, r.cost ?? "Chưa đủ dữ liệu", r.grossProfit ?? "Chưa đủ dữ liệu"]))}>
              <Download className="h-3.5 w-3.5" />
              Xuất CSV
            </button>
          </div>
          <DataTable headers={["Nhóm / sản phẩm", "SL", "Doanh thu", "Giá vốn", "Lãi gộp", "Nguồn giá vốn"]} rows={profitRows.map(r => [r.key, r.quantity, money(r.revenue), money(r.cost), <span className={r.grossProfit == null ? "text-on-tertiary-container font-semibold" : r.grossProfit < 0 ? "text-error font-bold" : "text-on-secondary-container font-bold"}>{money(r.grossProfit)}</span>, <span className="text-xs text-on-surface-variant">{[...r.costSources].join("; ")}</span>])}/>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-container text-primary">
              <Receipt className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-on-surface">Chi phí hoạt động</h2>
          </div>
          <DataTable headers={["Ngày", "Danh mục", "Nội dung", "Chi phí"]} rows={data.expenses.map((r: any) => [r.date, labelCategory(r.category), r.note || "—", money(r.amount)])}/>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-error-container text-error">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Tuổi tồn kho IMEI và nguy cơ trượt giá</h2>
              <p className="text-xs text-on-surface-variant">Chênh lệch giá chào bán và giá nhập là rủi ro chưa thực hiện, không trừ vào lợi nhuận đã bán.</p>
            </div>
          </div>
          <DataTable headers={["Sản phẩm / IMEI", "Ngày tồn", "Nhóm tuổi", "Giá nhập", "Giá chào bán", "Rủi ro"]} rows={data.inventory.map((r: any) => [<>{r.productName}<div className="text-xs text-on-surface-variant">{r.serialNumber}</div></>, r.days, r.band, money(r.cost), money(r.price), money(r.risk)])}/>
        </>}
        {view === "vat" && <>
          <Stats values={[["VAT đầu vào đủ điều kiện", money(data.vat.input)], ["VAT đầu ra", money(data.vat.output)], ["VAT phải nộp dự tính", money(data.vat.payable)], ["Còn chuyển kỳ sau", money(data.vat.nextCarryforward)]]}/>
          <p className="text-xs text-on-surface-variant">Đối chiếu thuế trên đơn bán lẻ: {money(data.vat.retailTaxReference)}. Sổ này phục vụ quản trị nội bộ; chỉ nhập chứng từ đã kiểm tra, không ghi trùng.</p>
          <VatStructureChart vat={data.vat} />
          <div className="flex flex-wrap items-center gap-3">
            <button className={`${buttonClass} inline-flex items-center gap-1.5 cursor-pointer`} onClick={() => setForm("tax")}>
              <Plus className="h-4 w-4" />
              Ghi nhận hóa đơn VAT
            </button>
            <button className={`${buttonClass} inline-flex items-center gap-1.5 cursor-pointer`} disabled={!data.invoiceCandidates?.length} onClick={() => setForm("invoice")}>
              <FileSpreadsheet className="h-4 w-4" />
              Đối chiếu từ bán lẻ ({data.invoiceCandidates?.length || 0})
            </button>
            <button className="inline-flex items-center gap-1 text-xs font-bold text-on-primary-container hover:text-on-primary-container transition cursor-pointer" onClick={() => setForm("settings")}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              VAT chuyển kỳ / cấu hình
            </button>
          </div>
          <DataTable headers={["Ngày", "Hóa đơn", "Loại", "Đối tác / MST", "Trước thuế", "Thuế suất", "VAT", "Khấu trừ"]} rows={data.taxes.map((r: any) => [r.date, r.invoiceNumber, r.direction === "input" ? "Đầu vào" : "Đầu ra", `${r.counterparty || ""} / ${r.taxId}`, money(r.base), `${r.rate}%`, money(r.vat), r.deductible ? "Đã xác nhận" : "Chưa xác nhận"])}/>
        </>}
        {view === "breakeven" && <>
          <Stats values={[["Chi phí cố định", money(data.breakeven.fixedCosts)], ["Tỷ lệ đóng góp", data.breakeven.contribution == null ? "Chưa đủ dữ liệu" : `${(data.breakeven.contribution * 100).toFixed(1)}%`], ["Doanh thu hòa vốn", money(data.breakeven.requiredRevenue)], ["Doanh thu còn thiếu", money(data.breakeven.remaining)]]}/>
          <BreakevenGaugeChart
            breakeven={data.breakeven}
            period={from.slice(0, 7)}
            onConfigure={() => setForm("settings")}
          />
        </>}
        <details className="text-xs text-on-surface-variant"><summary className="cursor-pointer font-medium hover:text-on-surface">Nguồn dữ liệu và giới hạn báo cáo</summary><ul className="mt-2 list-disc space-y-1 pl-5">{data.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul></details>
      </>}
    {reversing && <EntryForm title={"Đảo phiếu " + reversing.code} fields={[{ key: "date", label: "Ngày điều chỉnh", type: "date", initial: today() }, { key: "reason", label: "Lý do đảo phiếu" }]} onClose={() => setReversing(undefined)} onSave={async values => { await financeManagement("/vouchers/" + encodeURIComponent(reversing._id) + "/reversal", { ...values, idempotencyKey }); setReversing(undefined); setRevision(v => v + 1); }} />}
    {form && <EntryForm title={form === "voucher" ? "Phiếu thu / chi" : form === "tax" ? "Hóa đơn VAT" : form === "invoice" ? "Xác nhận hóa đơn bán lẻ vào sổ VAT nội bộ" : "Cấu hình tài chính theo kỳ"} fields={fields} onClose={() => setForm(undefined)} onSave={async (values) => { if (form === "voucher")
        await financeManagement("/vouchers", { ...values, idempotencyKey });
    else if (form === "tax")
        await financeManagement("/tax", { ...values, deductible: values.deductible === "true" });
    else if (form === "invoice")
        await financeManagement("/tax/from-invoice/" + encodeURIComponent(values.id), {});
    else
        await financeManagement("/settings", values, "PUT"); setRevision(v => v + 1); }}/>}
  </section>;
}
