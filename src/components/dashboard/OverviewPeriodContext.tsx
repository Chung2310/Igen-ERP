import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { StyledSelect } from "../common/StyledSelect";
import { VietnameseDatePicker } from "../../modules/student-management/components/Batches/VietnameseDatePicker";
import { displayComparisonDate, previousComparisonRange } from "./overviewComparison";

export type OverviewSelection = "day" | "week" | "month" | "year" | "custom";
type OverviewPeriodValue = { selection: OverviewSelection; from: string; to: string; previousFrom: string; previousTo: string };
const Context = createContext<OverviewPeriodValue | null>(null);
const ActionsHostContext = createContext<{ host: HTMLDivElement | null } | null>(null);
type PeriodControls = {
  selection: OverviewSelection;
  setSelection: (selection: OverviewSelection) => void;
  custom: { from: string; to: string };
  setCustom: (update: (current: { from: string; to: string }) => { from: string; to: string }) => void;
  range: { from: string; to: string };
  previous: { from: string; to: string } | null;
  valid: boolean;
  setActionsHost: (host: HTMLDivElement | null) => void;
};
const ControlsContext = createContext<PeriodControls | null>(null);
const periodOptions = [{ value: "day", label: "Hôm nay" }, { value: "week", label: "Tuần này" }, { value: "month", label: "Tháng này" }, { value: "year", label: "Năm nay" }, { value: "custom", label: "Khoảng ngày" }];

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

function PeriodSelect({ controls, className }: { controls: PeriodControls; className?: string }) {
  return <StyledSelect ariaLabel="Kỳ thống kê" describedBy={controls.selection === "custom" ? undefined : "overview-period-comparison"} className={className} value={controls.selection} options={periodOptions} onChange={next => {
    if (next === "custom" && controls.selection !== "custom") controls.setCustom(() => controls.range);
    controls.setSelection(next as OverviewSelection);
  }} />;
}

function comparisonText(controls: PeriodControls) {
  return controls.valid && controls.previous
    ? `${displayComparisonDate(controls.range.from)} – ${displayComparisonDate(controls.range.to)} · so với ${displayComparisonDate(controls.previous.from)} – ${displayComparisonDate(controls.previous.to)}`
    : "Chọn khoảng ngày hợp lệ để xem thống kê.";
}

function shortComparisonText(controls: PeriodControls) {
  if (!controls.valid || !controls.previous) return "Chọn khoảng ngày hợp lệ.";
  if (controls.selection === "day") return "So với hôm qua";
  if (controls.selection === "week") return "So với tuần trước";
  if (controls.selection === "month") {
    const [year, month] = controls.previous.from.split("-");
    return `So với T${Number(month)}/${year}`;
  }
  if (controls.selection === "year") return `So với năm ${controls.previous.from.slice(0, 4)}`;
  return `So với ${displayComparisonDate(controls.previous.from)} – ${displayComparisonDate(controls.previous.to)}`;
}

export function OverviewPeriodToolbar() {
  const controls = useContext(ControlsContext);
  if (!controls) return null;
  const comparison = comparisonText(controls);
  const shortComparison = shortComparisonText(controls);
  return <section aria-label="Kỳ thống kê Tổng quan" className="flex min-w-0 flex-wrap items-start justify-end gap-2 py-1.5 text-xs text-on-surface">
    <div ref={controls.setActionsHost} className="flex flex-wrap items-center justify-end gap-2" />
    <div className="w-40 shrink-0 sm:w-48">
      <PeriodSelect controls={controls} className="h-9" />
      {controls.selection !== "custom" && <p id="overview-period-comparison" title={comparison} className="mt-1 truncate text-xs leading-4 tabular-nums text-on-surface-variant">{shortComparison}</p>}
    </div>
  </section>;
}

export function OverviewPeriodCustomRange() {
  const controls = useContext(ControlsContext);
  if (!controls || controls.selection !== "custom") return null;
  return <section aria-label="Khoảng ngày tùy chọn" className="mb-2 flex flex-wrap items-center justify-end gap-2 text-xs text-on-surface">
    <div className="w-36 sm:w-40"><VietnameseDatePicker ariaLabel="Từ ngày Tổng quan" value={controls.custom.from} onChange={from => controls.setCustom(current => ({ ...current, from }))} variant="filter" /></div>
    <span aria-hidden="true">–</span>
    <div className="w-36 sm:w-40"><VietnameseDatePicker ariaLabel="Đến ngày Tổng quan" value={controls.custom.to} onChange={to => controls.setCustom(current => ({ ...current, to }))} variant="filter" /></div>
    {!controls.valid && <p role="alert" className="w-full text-error">Chọn khoảng ngày hợp lệ để xem thống kê.</p>}
  </section>;
}

export function OverviewPeriodContent({ children }: { children: ReactNode }) {
  const controls = useContext(ControlsContext);
  return controls?.valid ? children : null;
}

export function OverviewPeriodProvider({ children, inlineNavigation = false }: { children: ReactNode; inlineNavigation?: boolean }) {
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<OverviewSelection>("month");
  const [custom, setCustom] = useState(() => currentRange("month", todayKey()));
  const today = todayKey();
  const range = selection === "custom" ? custom : currentRange(selection, today);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to) && range.from <= range.to;
  const previous = valid ? previousComparisonRange(range.from, range.to, selection) : null;
  const value = useMemo(() => ({ selection, from: range.from, to: range.to, previousFrom: previous?.from || "", previousTo: previous?.to || "" }), [selection, range.from, range.to, previous?.from, previous?.to]);
  const controls: PeriodControls = { selection, setSelection, custom, setCustom, range, previous, valid, setActionsHost };

  return <Context.Provider value={value}><ActionsHostContext.Provider value={{ host: actionsHost }}><ControlsContext.Provider value={controls}>
    {inlineNavigation ? children : <>
    <section aria-label="Kỳ thống kê Tổng quan" className="mb-3 space-y-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-xs text-on-surface">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-36 flex-1">
          <PeriodSelect controls={controls} />
        </div>
        <div ref={setActionsHost} className="flex flex-wrap items-center justify-end gap-2" />
      </div>
      {selection === "custom" && <div className="flex flex-wrap items-center gap-2">
        <VietnameseDatePicker ariaLabel="Từ ngày Tổng quan" value={custom.from} onChange={from => setCustom(current => ({ ...current, from }))} variant="filter" />
        <span>–</span>
        <VietnameseDatePicker ariaLabel="Đến ngày Tổng quan" value={custom.to} onChange={to => setCustom(current => ({ ...current, to }))} variant="filter" />
      </div>}
      <p id="overview-period-comparison" role={valid ? undefined : "alert"} className="text-pretty text-on-surface-variant">{comparisonText(controls)}</p>
    </section>
    {valid && children}</>}
  </ControlsContext.Provider></ActionsHostContext.Provider></Context.Provider>;
}
