import { Download, Pencil } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import type { ChartType } from "./AssistantStudioChartTypes";

const demoRows = [
  { name: "Tham quan cảnh quan, sinh thái", value: 3200, color: "#2563eb" },
  { name: "Du lịch văn hóa, tâm linh", value: 2400, color: "#f59e0b" },
  { name: "Nghỉ dưỡng, trải nghiệm địa phương", value: 1200, color: "#10b981" },
  { name: "Học tập, ngoại khóa", value: 800, color: "#8b5cf6" },
  { name: "Hội họp, công tác kết hợp du lịch", value: 400, color: "#ef4444" },
];
const total = demoRows.reduce((sum, row) => sum + row.value, 0);
const formatNumber = (value: number) => value.toLocaleString("vi-VN");
const formatPercent = (value: number) => `${(value / total * 100).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";

function ChartPreview({ type }: { type: ChartType }) {
  const resolved = type === "Tự động" ? "Biểu đồ tròn" : type;
  const polar = (angle: number, radius = 170) => ({ x: 400 + radius * Math.cos((angle - 90) * Math.PI / 180), y: 180 + radius * Math.sin((angle - 90) * Math.PI / 180) });
  const values = demoRows.map(row => row.value);
  const points = values.map((value, index) => ({ x: 110 + index * 145, y: 305 - value / 3200 * 245 }));
  const grid = <>{[60, 120, 180, 240, 305].map(y => <line key={y} x1="65" y1={y} x2="745" y2={y} stroke="var(--color-outline-variant)" strokeDasharray="4 5" />)}</>;

  if (resolved === "Biểu đồ tròn" || resolved === "Biểu đồ vòng") {
    return <svg viewBox="200 0 400 360" className="size-full" aria-hidden="true">{demoRows.map((row, index) => {
      const start = demoRows.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total * 360;
      const end = start + row.value / total * 360;
      const first = polar(start);
      const last = polar(end);
      return <path key={row.name} d={`M 400 180 L ${first.x} ${first.y} A 170 170 0 ${end - start > 180 ? 1 : 0} 1 ${last.x} ${last.y} Z`} fill={row.color} stroke="var(--color-surface-container-lowest)" strokeWidth="2" />;
    })}{resolved === "Biểu đồ vòng" && <circle cx="400" cy="180" r="85" fill="var(--color-surface-container-lowest)" />}</svg>;
  }

  if (resolved === "Biểu đồ đường" || resolved === "Biểu đồ vùng") {
    const line = points.map(point => `${point.x},${point.y}`).join(" ");
    return <svg viewBox="0 0 800 360" className="size-full" aria-hidden="true">{grid}{resolved === "Biểu đồ vùng" && <polygon points={`110,305 ${line} 690,305`} fill="var(--color-primary-container)" />}<polyline points={line} fill="none" stroke="var(--color-primary)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />{points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="6" fill={demoRows[index].color} stroke="var(--color-surface-container-lowest)" strokeWidth="2" />)}</svg>;
  }

  if (resolved === "Biểu đồ phân tán") return <svg viewBox="0 0 800 360" className="size-full" aria-hidden="true">{grid}{points.map((point, index) => <g key={index} fill={demoRows[index].color}>{[0, 1, 2].map(offset => <circle key={offset} cx={point.x + offset * 14 - 14} cy={point.y + (offset % 2 ? -25 : 20)} r={7 + offset} opacity=".85" />)}</g>)}</svg>;

  if (resolved === "Biểu đồ thanh" || resolved === "Biểu đồ Gantt") return <svg viewBox="0 0 800 360" className="size-full" aria-hidden="true">{grid}{demoRows.map((row, index) => {
    const x = resolved === "Biểu đồ Gantt" ? 105 + index * 90 : 105;
    const width = resolved === "Biểu đồ Gantt" ? 210 : row.value / 3200 * 580;
    return <rect key={row.name} x={x} y={35 + index * 62} width={width} height="36" rx="5" fill={row.color} />;
  })}</svg>;

  if (resolved === "Biểu đồ thác nước") {
    return <svg viewBox="0 0 800 360" className="size-full" aria-hidden="true">{grid}{demoRows.map((row, index) => {
      const step = row.value / total * 260;
      const previous = demoRows.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total * 260;
      const y = 305 - previous - step;
      return <rect key={row.name} x={105 + index * 135} y={y} width="90" height={step} rx="3" fill={row.color} />;
    })}</svg>;
  }

  const histogram = resolved === "Biểu đồ tần suất";
  const stacked = resolved === "Biểu đồ xếp chồng";
  return <svg viewBox="0 0 800 360" className="size-full" aria-hidden="true">{grid}{demoRows.map((row, index) => {
    const height = row.value / 3200 * 245;
    const x = histogram ? 115 + index * 110 : 110 + index * 140;
    const width = histogram ? 110 : 95;
    return <g key={row.name}><rect x={x} y={305 - height} width={width} height={height} rx={histogram ? 0 : 3} fill={stacked ? "var(--color-primary)" : row.color} />{stacked && <rect x={x} y={305 - height} width={width} height={height * .35} rx="3" fill={row.color} />}</g>;
  })}</svg>;
}

export function AssistantStudioChartResult({ type, title, fileName, editRequest, onEdit, onDownload }: { type: ChartType; title: string; fileName: string; editRequest: string; onEdit: () => void; onDownload: () => void }) {
  const resolved = type === "Tự động" ? "Biểu đồ tròn" : type;
  return <section aria-labelledby="studio-chart-result-title" className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium text-primary">Bản xem trước minh họa · {resolved}</p><h1 id="studio-chart-result-title" className="mt-1 text-balance text-lg font-semibold">{title}</h1></div><button type="button" onClick={onEdit} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm font-medium hover:bg-surface-container-low", focusClass)}><Pencil className="size-4" aria-hidden="true" />Chỉnh sửa bằng AI</button></div>
    <p className="mb-4 text-pretty text-xs text-on-surface-variant">Dữ liệu bên dưới chỉ để xem giao diện; chưa được trích xuất từ {fileName}.</p>
    {editRequest && <p role="status" className="mb-4 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-pretty text-xs text-on-surface-variant">Đã ghi nhận yêu cầu chỉnh sửa: “{editRequest}”. Phần nội dung này sẽ được AI xử lý sau khi kết nối dịch vụ.</p>}
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-xs sm:p-6">
      <div className="text-center"><h2 className="text-balance text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-on-surface-variant">Dữ liệu ví dụ · Đơn vị: lượt</p></div>
      <div role="img" aria-label={`${resolved} minh họa năm nhóm mục đích du lịch`} className="mx-auto mt-5 h-64 w-full max-w-3xl sm:h-80"><ChartPreview type={type} /></div>
      <ul className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-x-4 gap-y-2 text-xs">{demoRows.map(row => <li key={row.name} className="inline-flex items-center gap-1.5"><span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} aria-hidden="true" />{row.name} ({formatPercent(row.value)})</li>)}</ul>
      <div className="mt-8 overflow-x-auto"><h3 className="mb-3 text-balance text-sm font-semibold">Đánh giá tổng quan</h3><table className="w-full min-w-[480px] border-collapse text-left text-xs"><thead className="bg-surface-container-low"><tr><th scope="col" className="border border-outline-variant p-2 font-semibold">Mục đích chính</th><th scope="col" className="border border-outline-variant p-2 text-right font-semibold">Lượng khách (lượt)</th><th scope="col" className="border border-outline-variant p-2 text-right font-semibold">Tỷ trọng</th></tr></thead><tbody>{demoRows.map(row => <tr key={row.name}><th scope="row" className="border border-outline-variant p-2 font-normal">{row.name}</th><td className="border border-outline-variant p-2 text-right tabular-nums">{formatNumber(row.value)}</td><td className="border border-outline-variant p-2 text-right tabular-nums">{formatPercent(row.value)}</td></tr>)}</tbody><tfoot><tr className="font-semibold"><th scope="row" className="border border-outline-variant p-2">Tổng cộng</th><td className="border border-outline-variant p-2 text-right tabular-nums">{formatNumber(total)}</td><td className="border border-outline-variant p-2 text-right tabular-nums">100,00%</td></tr></tfoot></table></div>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-pretty text-xs leading-5 text-on-surface-variant"><li>Nhóm chiếm tỷ trọng lớn nhất là tham quan cảnh quan, sinh thái với 3.200 lượt (40%).</li><li>Hai nhóm đầu chiếm 70% tổng lượng khách trong dữ liệu ví dụ.</li><li>Nhóm hội họp, công tác kết hợp du lịch có tỷ trọng thấp nhất (5%).</li></ul>
    </div>
    <div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" onClick={onEdit} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm font-medium hover:bg-surface-container-low", focusClass)}><Pencil className="size-4" aria-hidden="true" />Chỉnh sửa bằng AI</button><button type="button" onClick={onDownload} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm font-medium hover:bg-surface-container-low", focusClass)}><Download className="size-4" aria-hidden="true" />Tải dữ liệu CSV</button></div>
  </section>;
}
