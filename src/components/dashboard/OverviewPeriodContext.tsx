import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { StyledSelect } from "../common/StyledSelect";
import { VietnameseDatePicker } from "../../modules/student-management/components/Batches/VietnameseDatePicker";
import { displayComparisonDate, previousComparisonRange } from "./overviewComparison";

export type OverviewSelection = "day" | "week" | "month" | "year" | "custom";
type OverviewPeriodValue = { selection: OverviewSelection; from: string; to: string; previousFrom: string; previousTo: string };
const Context = createContext<OverviewPeriodValue | null>(null);
const ActionsHostContext = createContext<{ host: HTMLDivElement | null } | null>(null);

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const todayKey = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

function currentRange(selection: Exclude<OverviewSelection, "custom">, today: string) {
  const date = new Date(`${today}T12:00:00`);
  if (selection === "day") return { from: today, to: today };
  if (selection === "week") date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  if (selection === "month") date.setDate(1);
  if (selection === "year") { date.setMonth(0); date.setDate(1); }
  return { from: dateKey(date), to: today };
}

export function useOverviewPeriod() {
  return useContext(Context);
}

export function OverviewPeriodActions({ children }: { children: ReactNode }) {
  const context = useContext(ActionsHostContext);
  if (!context) return <div className="flex justify-end">{children}</div>;
  return context.host ? createPortal(children, context.host) : null;
}

export function OverviewPeriodProvider({ children }: { children: ReactNode }) {
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<OverviewSelection>("month");
  const [custom, setCustom] = useState(() => currentRange("month", todayKey()));
  const today = todayKey();
  const range = selection === "custom" ? custom : currentRange(selection, today);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to) && range.from <= range.to;
  const previous = valid ? previousComparisonRange(range.from, range.to, selection) : null;
  const value = useMemo(() => ({ selection, from: range.from, to: range.to, previousFrom: previous?.from || "", previousTo: previous?.to || "" }), [selection, range.from, range.to, previous?.from, previous?.to]);

  return <Context.Provider value={value}><ActionsHostContext.Provider value={{ host: actionsHost }}>
    <section aria-label="Kỳ thống kê Tổng quan" className="mb-3 space-y-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-xs text-on-surface">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-36 flex-1">
          <StyledSelect ariaLabel="Kỳ thống kê" value={selection} options={[{ value: "day", label: "Hôm nay" }, { value: "week", label: "Tuần này" }, { value: "month", label: "Tháng này" }, { value: "year", label: "Năm nay" }, { value: "custom", label: "Khoảng ngày" }]} onChange={next => { if (next === "custom" && selection !== "custom") setCustom(range); setSelection(next as OverviewSelection); }} />
        </div>
        <div ref={setActionsHost} className="flex flex-wrap items-center justify-end gap-2" />
      </div>
      {selection === "custom" && <div className="flex flex-wrap items-center gap-2">
        <VietnameseDatePicker ariaLabel="Từ ngày Tổng quan" value={custom.from} onChange={from => setCustom(current => ({ ...current, from }))} variant="filter" />
        <span>–</span>
        <VietnameseDatePicker ariaLabel="Đến ngày Tổng quan" value={custom.to} onChange={to => setCustom(current => ({ ...current, to }))} variant="filter" />
      </div>}
      <p role={valid ? undefined : "alert"} className="text-pretty text-on-surface-variant">{valid && previous ? `${displayComparisonDate(range.from)} – ${displayComparisonDate(range.to)} · so với ${displayComparisonDate(previous.from)} – ${displayComparisonDate(previous.to)}` : "Chọn khoảng ngày hợp lệ để xem thống kê."}</p>
    </section>
    {valid && children}
  </ActionsHostContext.Provider></Context.Provider>;
}
