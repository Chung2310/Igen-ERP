import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Area, AreaChart } from "recharts";
import { ChevronDown, Download, LoaderCircle, Sparkles, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import type { AssistantChartResult } from "../../shared/assistant-chart";
import { AssistantFileTypeIcon } from "./AssistantFileTypeIcon";
import { chartTypes, type ChartType } from "./AssistantStudioChartTypes";
import { StyledSelect } from "./StyledSelect";
import { createAssistantChartWorkbook } from "./assistant-studio-chart-excel";
import { createAssistantChartSvg } from "./assistant-studio-chart-png";

const chartColors = ["var(--color-primary)", "var(--color-tertiary)", "var(--color-change-up)", "var(--color-error)", "var(--color-secondary)", "var(--color-inverse-primary)", "var(--color-on-primary-fixed-variant)", "var(--color-on-tertiary-fixed-variant)"];
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";
const number = (value: unknown) => typeof value === "number" ? value.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : String(value ?? "");

function dataRows(chart: AssistantChartResult) {
  return chart.rows.map((row) => ({ label: row.label, ...Object.fromEntries(chart.series.map((series, index) => [`value${index}`, row.values[index] ?? 0])) }));
}

function tooltipContentStyle() {
  return { backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)", borderRadius: 6, color: "var(--color-on-surface)", boxShadow: "0 2px 8px rgb(15 23 42 / 10%)" };
}

function FilledGradientSparkles({ gradientId }: { gradientId: string }) {
  return <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true" focusable="false">
    <defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="4" y1="10" x2="20" y2="10"><stop offset="0%" stopColor="#00adfc" /><stop offset="55%" stopColor="#199bff" /><stop offset="100%" stopColor="#7567ff" /></linearGradient></defs>
    <path d="M12 2.5c.44 4.5 2.5 6.56 7 7-4.5.44-6.56 2.5-7 7-.44-4.5-2.5-6.56-7-7 4.5-.44 6.56-2.5 7-7Z" fill={`url(#${gradientId})`} />
    <path d="M19 14c.18 1.82 1.18 2.82 3 3-1.82.18-2.82 1.18-3 3-.18-1.82-1.18-2.82-3-3 1.82-.18 2.82-1.18 3-3Z" fill={`url(#${gradientId})`} />
    <path d="M5 16c.12 1.2.8 1.88 2 2-1.2.12-1.88.8-2 2-.12-1.2-.8-1.88-2-2 1.2-.12 1.88-.8 2-2Z" fill={`url(#${gradientId})`} />
  </svg>;
}

function ExportFormatIcon({ format }: { format: "csv" | "png" | "excel" }) {
  const color = format === "excel" ? "#16a34a" : format === "png" ? "#2563eb" : "#0d9488";
  return <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden="true" focusable="false">
    <path d="M5.5 2.5h7.75L19 8.25v11.5A2.25 2.25 0 0 1 16.75 22h-11A2.25 2.25 0 0 1 3.5 19.75v-15A2.25 2.25 0 0 1 5.5 2.5Z" fill={color} />
    <path d="M13 2.8v5.5h5.45" fill="white" fillOpacity=".9" />
    <rect x="5.25" y="11" width="12.5" height="7.25" rx="1.1" fill="white" />
    {format === "png" ? <>
      <circle cx="14.5" cy="13.1" r=".9" fill={color} />
      <path d="m6.4 17.25 3.3-3.25 2.05 1.8 1.35-1.1 3.55 2.55Z" fill={color} />
    </> : <path d="M9.4 11v7.25m4.2-7.25v7.25M5.25 14.6h12.5" fill="none" stroke={color} strokeWidth="1.2" />}
  </svg>;
}

function ChartVisualization({ chart }: { chart: AssistantChartResult }) {
  const data = dataRows(chart);
  const numericAxis = (value: number) => number(value);
  const commonAxes = <>
    <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 4" vertical={false} />
    <XAxis dataKey="label" tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--color-outline-variant)" }} interval="preserveStartEnd" />
    <YAxis tickFormatter={numericAxis} tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
    <Tooltip contentStyle={tooltipContentStyle()} formatter={(value) => [number(value), chart.unit || chart.yAxisLabel]} />
    {chart.series.length > 1 && <Legend />}
  </>;

  if (chart.layout === "scatter") {
    return <ScatterChart margin={{ top: 12, right: 16, bottom: 12, left: 4 }}>
      <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 4" />
      <XAxis type="number" dataKey="x" name={chart.xAxisLabel} tickFormatter={numericAxis} tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} label={{ value: chart.xAxisLabel, position: "insideBottom", offset: -4, fill: "var(--color-on-surface-variant)" }} />
      <YAxis type="number" dataKey="y" name={chart.yAxisLabel} tickFormatter={numericAxis} tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} width={76} />
      <ZAxis range={[48, 48]} />
      <Tooltip contentStyle={tooltipContentStyle()} formatter={(value) => number(value)} />
      <Scatter name={chart.series[0] || chart.yAxisLabel} data={chart.rows} fill={chartColors[0]} />
    </ScatterChart>;
  }

  if (chart.layout === "gantt") {
    const ganttData = chart.rows.map((row) => ({ label: row.label, base: row.start ?? row.values[0] ?? 0, duration: Math.max(0, (row.end ?? row.values[1] ?? 0) - (row.start ?? row.values[0] ?? 0)) }));
    const usesDates = ganttData.some((row) => row.base > 10_000_000_000);
    const formatDateTick = (value: number) => usesDates ? new Date(value).toLocaleDateString("vi-VN", { month: "short", year: "2-digit" }) : number(value);
    return <BarChart data={ganttData} layout="vertical" margin={{ top: 10, right: 16, bottom: 10, left: 12 }}>
      <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 4" horizontal={false} />
      <XAxis type="number" domain={["dataMin", "dataMax"]} tickFormatter={formatDateTick} tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} />
      <YAxis type="category" dataKey="label" width={130} tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} />
      <Tooltip contentStyle={tooltipContentStyle()} formatter={(value) => number(value)} />
      <Bar dataKey="base" stackId="gantt" fill="transparent" isAnimationActive={false} />
      <Bar dataKey="duration" stackId="gantt" name="Thời lượng" fill={chartColors[0]} isAnimationActive={false} />
    </BarChart>;
  }

  if (chart.layout === "waterfall") {
    const waterfallData = chart.rows.map((row) => ({ label: row.label, base: row.base ?? Math.min(row.start || 0, row.end || 0), increase: row.increase ?? Math.max(0, row.values[0] || 0), decrease: row.decrease ?? Math.max(0, -(row.values[0] || 0)) }));
    return <BarChart data={waterfallData} margin={{ top: 10, right: 16, left: 4, bottom: 34 }}>
      {commonAxes}
      <ReferenceLine y={0} stroke="var(--color-outline)" />
      <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
      <Bar dataKey="increase" stackId="waterfall" name="Tăng" fill={chartColors[2]} isAnimationActive={false} />
      <Bar dataKey="decrease" stackId="waterfall" name="Giảm" fill={chartColors[3]} isAnimationActive={false} />
    </BarChart>;
  }

  if (chart.chartType === "Biểu đồ tròn" || chart.chartType === "Biểu đồ vòng") {
    const pieData = chart.rows.map((row) => ({ label: row.label, value: row.values[0] || 0 }));
    return <PieChart>
      <Tooltip contentStyle={tooltipContentStyle()} formatter={(value) => [`${number(value)}${chart.unit ? ` ${chart.unit}` : ""}`, "Giá trị"]} />
      <Legend />
      <Pie data={pieData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={chart.chartType === "Biểu đồ vòng" ? "42%" : 0} outerRadius="76%" paddingAngle={2} label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`} labelLine={false} isAnimationActive={false}>
        {pieData.map((item, index) => <Cell key={item.label} fill={chart.highlightLabels.includes(item.label) ? "var(--color-primary)" : chartColors[index % chartColors.length]} />)}
      </Pie>
    </PieChart>;
  }

  if (chart.chartType === "Biểu đồ đường") {
    return <LineChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 34 }}>
      {commonAxes}
      {chart.series.map((series, index) => <Line key={series} type="monotone" dataKey={`value${index}`} name={series} stroke={chartColors[index % chartColors.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />)}
    </LineChart>;
  }

  if (chart.chartType === "Biểu đồ vùng") {
    return <AreaChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 34 }}>
      {commonAxes}
      {chart.series.map((series, index) => <Area key={series} type="monotone" dataKey={`value${index}`} name={series} stroke={chartColors[index % chartColors.length]} fill={chartColors[index % chartColors.length]} fillOpacity={0.18} isAnimationActive={false} />)}
    </AreaChart>;
  }

  const horizontal = chart.chartType === "Biểu đồ thanh";
  return <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 10, right: 16, left: 4, bottom: 34 }}>
    <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 4" horizontal={!horizontal} vertical={horizontal} />
    {horizontal
      ? <><XAxis type="number" tickFormatter={numericAxis} tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} /><YAxis type="category" dataKey="label" width={140} tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} /></>
      : <>{commonAxes}</>}
    <Tooltip contentStyle={tooltipContentStyle()} formatter={(value) => [number(value), chart.unit || chart.yAxisLabel]} />
    {chart.series.length > 1 && <Legend />}
    {chart.series.map((series, index) => <Bar key={series} dataKey={`value${index}`} name={series} fill={chartColors[index % chartColors.length]} stackId={chart.chartType === "Biểu đồ xếp chồng" ? "stacked" : undefined} radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} isAnimationActive={false}>
      {chart.rows.map((row) => <Cell key={`${series}-${row.label}`} fill={chart.highlightLabels.includes(row.label) ? "var(--color-primary)" : chartColors[index % chartColors.length]} />)}
    </Bar>)}
  </BarChart>;
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsForCsv(chart: AssistantChartResult): string[][] {
  if (chart.layout === "scatter") return [[chart.xAxisLabel || "X", chart.yAxisLabel || "Y", "Nhãn"], ...chart.rows.map((row) => [String(row.x ?? row.values[0] ?? ""), String(row.y ?? row.values[1] ?? ""), row.label])];
  if (chart.layout === "gantt") return [["Công việc", "Bắt đầu", "Kết thúc"], ...chart.rows.map((row) => [row.label, row.start ? new Date(row.start).toISOString() : row.values[0], row.end ? new Date(row.end).toISOString() : row.values[1]].map(String))];
  return [["Nhãn", ...chart.series], ...chart.rows.map((row) => [row.label, ...chart.series.map((_, index) => String(row.values[index] ?? 0))])];
}

function downloadName(title: string, extension: string): string {
  return `${title.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 80) || "bieu_do"}.${extension}`;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function AssistantStudioChartResult({ chart, onEdit }: { chart: AssistantChartResult; onEdit: (request: string, type: ChartType, title: string) => Promise<void> }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const editPromptRef = useRef<HTMLTextAreaElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDetailsElement>(null);
  const editHeadingId = useId();
  const exportMenuId = useId();
  const sparkleGradientId = useId().replace(/:/g, "");
  const editWasOpen = useRef(false);
  const [exportStatus, setExportStatus] = useState("");
  const [pngExportBusy, setPngExportBusy] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editType, setEditType] = useState<ChartType>(chart.chartType);
  const [editTitle, setEditTitle] = useState(chart.title);
  const [editTitleChanged, setEditTitleChanged] = useState(false);
  const [editRequest, setEditRequest] = useState("");
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const csvRows = rowsForCsv(chart);

  useLayoutEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;
    if (editOpen) {
      if (!dialog.open) dialog.show();
      editWasOpen.current = true;
      window.requestAnimationFrame(() => editPromptRef.current?.focus());
    } else {
      if (dialog.open) dialog.close();
      if (editWasOpen.current) {
        editWasOpen.current = false;
        editTriggerRef.current?.focus();
      }
    }
  }, [editOpen]);

  function openEdit() {
    setEditType(chart.chartType);
    setEditTitle(chart.title);
    setEditTitleChanged(false);
    setEditRequest("");
    setEditError("");
    setEditOpen(true);
  }

  async function applyEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editRequest.trim() && editType === chart.chartType && !editTitleChanged) {
      setEditError("Nhập yêu cầu hoặc chọn loại biểu đồ muốn đổi.");
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      await onEdit(editRequest.trim(), editType, editTitleChanged ? editTitle.trim() : "");
      setEditOpen(false);
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : "Không thể chỉnh sửa biểu đồ lúc này.");
    } finally {
      setEditBusy(false);
    }
  }

  function downloadCsv() {
    const csv = `\uFEFF${csvRows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
    saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), downloadName(chart.title, "csv"));
  }

  function downloadExcel() {
    try {
      saveBlob(createAssistantChartWorkbook(chart), downloadName(chart.title, "xlsx"));
      setExportStatus("Đã tải file Excel có biểu đồ chỉnh sửa được và sheet dữ liệu.");
    } catch {
      setExportStatus("Không thể tạo file Excel. Hãy thử tải CSV.");
    }
  }

  function downloadPng() {
    if (pngExportBusy) return;
    setPngExportBusy(true);
    setExportStatus("Đang dựng ảnh biểu đồ…");
    try {
      const computed = chartRef.current ? getComputedStyle(chartRef.current) : null;
      const background = computed?.getPropertyValue("--color-surface-container-lowest").trim() || "#ffffff";
      const primary = computed?.getPropertyValue("--color-primary").trim() || "#00adfc";
      const svgMarkup = createAssistantChartSvg(chart, { background, primary });
      const image = new Image();
      const svgUrl = URL.createObjectURL(new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" }));
      image.onload = () => {
        URL.revokeObjectURL(svgUrl);
        const canvas = document.createElement("canvas");
        canvas.width = 3200;
        canvas.height = 2000;
        const context = canvas.getContext("2d");
        if (!context) {
          setExportStatus("Trình duyệt không thể xuất ảnh biểu đồ.");
          setPngExportBusy(false);
          return;
        }
        context.scale(2, 2);
        context.fillStyle = background;
        context.fillRect(0, 0, 1600, 1000);
        context.drawImage(image, 0, 0, 1600, 1000);
        canvas.toBlob((blob) => {
          if (!blob) {
            setExportStatus("Không thể xuất ảnh biểu đồ.");
            setPngExportBusy(false);
            return;
          }
          saveBlob(blob, downloadName(chart.title, "png"));
          setExportStatus("Đã tải ảnh biểu đồ.");
          setPngExportBusy(false);
        }, "image/png");
      };
      image.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        setExportStatus("Không thể dựng ảnh biểu đồ. Hãy thử tải Excel hoặc CSV.");
        setPngExportBusy(false);
      };
      image.src = svgUrl;
    } catch {
      setExportStatus("Không thể dựng ảnh biểu đồ. Hãy thử tải Excel hoặc CSV.");
      setPngExportBusy(false);
    }
  }

  function closeExportMenu() {
    if (exportMenuRef.current) exportMenuRef.current.open = false;
    setExportMenuOpen(false);
  }

  return <section aria-labelledby="studio-chart-result-title" className="mx-auto w-full max-w-6xl px-4 py-5 pb-24 sm:px-6">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-xs font-medium text-primary">{chart.chartType} · {chart.sourceSheet}</p><h1 id="studio-chart-result-title" data-typography="page-title" className="mt-1 text-balance text-lg font-semibold">{chart.title}</h1><p className="mt-1 text-pretty text-sm text-on-surface-variant">{chart.summary}</p></div>
    </div>
    <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant"><span className="inline-flex items-center gap-1.5"><AssistantFileTypeIcon fileName={chart.fileName} className="size-5 shrink-0" />{chart.fileName}</span><span>{chart.sourceRowCount.toLocaleString("vi-VN")} dòng đã phân tích</span></div>
    {chart.warnings.length > 0 && <ul className="mb-4 space-y-1 rounded-lg border border-tertiary bg-tertiary-container p-3 text-sm text-on-tertiary-container">{chart.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>}
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-xs sm:p-6">
      <div className="text-center"><h2 className="text-balance text-lg font-semibold">{chart.title}</h2><p className="mt-1 text-xs text-on-surface-variant">{chart.yAxisLabel}{chart.unit ? ` · ${chart.unit}` : ""}</p></div>
      <div ref={chartRef} role="img" aria-label={`${chart.chartType}: ${chart.title}. Dữ liệu chi tiết nằm trong bảng bên dưới.`} className="mx-auto mt-5 h-72 w-full max-w-5xl sm:h-96">
        <ResponsiveContainer width="100%" height="100%"><ChartVisualization chart={chart} /></ResponsiveContainer>
      </div>
      {chart.insights.length > 0 && <section aria-labelledby="studio-chart-insights" className="mt-5 rounded-lg bg-surface-container-low p-4"><h3 id="studio-chart-insights" className="text-balance text-sm font-semibold">Nhận xét từ dữ liệu</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-pretty text-sm text-on-surface-variant">{chart.insights.map((insight, index) => <li key={`${insight}-${index}`}>{insight}</li>)}</ul></section>}
      <div className="mt-6 overflow-x-auto"><h3 className="mb-2 text-balance text-sm font-semibold">Dữ liệu biểu đồ</h3><table className="w-full min-w-[480px] border-collapse text-left text-xs"><thead className="bg-surface-container-low"><tr>{csvRows[0].map((header, index) => <th key={`${header}-${index}`} scope="col" className={cn("border border-outline-variant p-2 font-semibold", index > 0 && "text-right")}>{header}</th>)}</tr></thead><tbody>{csvRows.slice(1).map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`}><th scope="row" className="border border-outline-variant p-2 font-normal">{row[0]}</th>{row.slice(1).map((value, index) => <td key={`${rowIndex}-${index}`} className="border border-outline-variant p-2 text-right tabular-nums">{number(Number.isFinite(Number(value)) ? Number(value) : value)}</td>)}</tr>)}</tbody></table></div>
      {exportStatus && <p role="status" className="mt-2 text-right text-xs text-on-surface-variant">{exportStatus}</p>}
    </div>
    <div className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg">
        <button ref={editTriggerRef} type="button" onClick={openEdit} className={cn("inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium hover:bg-surface-container-low", focusClass)}><FilledGradientSparkles gradientId={sparkleGradientId} /><span className="bg-[linear-gradient(90deg,#00adfc_0%,#199bff_55%,#7567ff_100%)] bg-clip-text text-transparent">Chỉnh sửa bằng AI</span></button>
        <details
          ref={exportMenuRef}
          className="group relative"
          onToggle={(event) => setExportMenuOpen(event.currentTarget.open)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && exportMenuOpen) {
              event.preventDefault();
              closeExportMenu();
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="Tải dữ liệu biểu đồ xuống" aria-controls={exportMenuId} aria-expanded={exportMenuOpen} title="Tải dữ liệu biểu đồ xuống" className={cn("inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", focusClass)}>
            <Download className="size-4 text-primary" aria-hidden="true" /><span className="hidden sm:inline">Tải xuống</span><ChevronDown className={cn("size-4 text-on-surface-variant", exportMenuOpen && "rotate-180")} aria-hidden="true" />
          </summary>
          <div id={exportMenuId} className="absolute bottom-full right-0 z-50 mb-2 grid min-w-52 gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg">
            <button type="button" onClick={() => { closeExportMenu(); downloadCsv(); }} className={cn("inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-on-surface hover:bg-surface-container-low", focusClass)}><ExportFormatIcon format="csv" />Tải dữ liệu CSV</button>
            <button type="button" onClick={() => { closeExportMenu(); downloadPng(); }} disabled={pngExportBusy} aria-busy={pngExportBusy} className={cn("inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>{pngExportBusy ? <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" /> : <ExportFormatIcon format="png" />}{pngExportBusy ? "Đang dựng PNG…" : "Tải ảnh PNG"}</button>
            <button type="button" onClick={() => { closeExportMenu(); downloadExcel(); }} className={cn("inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-on-surface hover:bg-surface-container-low", focusClass)}><ExportFormatIcon format="excel" />Tải biểu đồ Excel</button>
          </div>
        </details>
      </div>
    </div>
    <dialog
      ref={editDialogRef}
      aria-labelledby={editHeadingId}
      onCancel={(event) => { event.preventDefault(); if (!editBusy) setEditOpen(false); }}
      onKeyDown={(event) => { if (event.key === "Escape" && !editBusy) { event.preventDefault(); setEditOpen(false); } }}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] left-1/2 z-50 m-0 max-h-[calc(100dvh-6rem)] w-[min(32rem,calc(100vw-1.5rem))] max-w-none -translate-x-1/2 border-0 bg-transparent p-0 text-left text-on-surface backdrop:bg-transparent open:block"
    >
      <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-xl sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3 border-b border-outline-variant pb-2">
          <h2 id={editHeadingId} className="text-balance text-sm font-semibold">Chỉnh sửa biểu đồ bằng AI</h2>
          <button type="button" aria-label="Đóng" title="Đóng" disabled={editBusy} onClick={() => setEditOpen(false)} className={cn("inline-flex size-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50", focusClass)}><X className="size-4" aria-hidden="true" /></button>
        </div>
        <form onSubmit={applyEdit} aria-busy={editBusy} className="space-y-3">
          <label htmlFor="studio-chart-edit-prompt" className="sr-only">Yêu cầu chỉnh sửa</label>
          <textarea
            ref={editPromptRef}
            id="studio-chart-edit-prompt"
            rows={3}
            maxLength={2000}
            value={editRequest}
            onChange={(event) => { setEditRequest(event.target.value); setEditError(""); }}
            placeholder="Mô tả điểm muốn thay đổi, ví dụ: đổi tiêu đề, làm nổi bật nhóm cao nhất, sắp xếp dữ liệu giảm dần…"
            className="min-h-20 w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
            aria-describedby={editError ? "studio-chart-edit-error studio-chart-edit-count" : "studio-chart-edit-count"}
          />
          <label htmlFor="studio-chart-edit-title" className="sr-only">Tiêu đề biểu đồ</label>
          <input
            id="studio-chart-edit-title"
            maxLength={120}
            value={editTitle}
            onChange={(event) => { setEditTitle(event.target.value); setEditTitleChanged(event.target.value !== chart.title); setEditError(""); }}
            placeholder="Tiêu đề biểu đồ"
            className="min-h-9 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-full min-w-0 sm:w-56">
              <StyledSelect appearance="erp" ariaLabel="Loại biểu đồ sau chỉnh sửa" value={editType} onChange={(value) => setEditType(value as ChartType)} options={chartTypes.map((type) => ({ value: type, label: type }))} className="h-9 rounded-lg" />
            </div>
            <span id="studio-chart-edit-count" className="text-xs tabular-nums text-on-surface-variant">{editRequest.length.toLocaleString('vi-VN')} / 2.000</span>
          </div>
          {editError && <p id="studio-chart-edit-error" role="alert" className="text-pretty text-sm text-error">{editError}</p>}
          {editBusy && <p role="status" className="inline-flex items-center gap-2 text-sm text-on-surface-variant"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Đang áp dụng yêu cầu…</p>}
          <button type="submit" disabled={editBusy} className={cn("inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>{editBusy ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Đang chỉnh sửa…</> : <>Áp dụng chỉnh sửa <Sparkles className="size-4" aria-hidden="true" /></>}</button>
        </form>
      </div>
    </dialog>
  </section>;
}
