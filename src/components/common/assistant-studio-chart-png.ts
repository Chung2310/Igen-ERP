import type { AssistantChartResult, AssistantChartRow } from "../../shared/assistant-chart";

const width = 1600;
const height = 1000;
const plot = { left: 150, top: 150, width: 1320, height: 540 };
const seriesColors = ["#00adfc", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#64748b", "#ec4899"];

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function numeric(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function formatNumber(value: number): string {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function text(x: number, y: number, value: unknown, options: { size?: number; fill?: string; anchor?: string; weight?: number; transform?: string } = {}): string {
  const { size = 17, fill = "#475569", anchor = "middle", weight = 400, transform = "" } = options;
  return `<text x="${x}" y="${y}" fill="${escapeXml(fill)}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}"${transform ? ` transform="${transform}"` : ""}>${escapeXml(value)}</text>`;
}

function palette(primary: string): string[] {
  return [primary || seriesColors[0], ...seriesColors.slice(1)];
}

function numericAxis(values: number[], includeZero = true): { min: number; max: number; point(value: number): number } {
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 1;
  const min = includeZero && minValue >= 0 ? 0 : minValue;
  const max = maxValue === min ? min + 1 : maxValue + (maxValue - min) * 0.08;
  return { min, max, point: (value) => plot.top + plot.height - ((value - min) / (max - min)) * plot.height };
}

function horizontalAxis(values: number[], includeZero = true): { min: number; max: number; point(value: number): number } {
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 1;
  const min = includeZero && minValue >= 0 ? 0 : minValue;
  const max = maxValue === min ? min + 1 : maxValue + (maxValue - min) * 0.08;
  return { min, max, point: (value) => plot.left + ((value - min) / (max - min)) * plot.width };
}

function valueGrid(axis: ReturnType<typeof numericAxis>, color: string): string {
  const parts: string[] = [];
  for (let index = 0; index <= 5; index += 1) {
    const value = axis.min + ((axis.max - axis.min) * index) / 5;
    const y = plot.top + plot.height - (plot.height * index) / 5;
    parts.push(`<line x1="${plot.left}" y1="${y}" x2="${plot.left + plot.width}" y2="${y}" stroke="#d8e2f0" stroke-width="1"/>`);
    parts.push(text(plot.left - 14, y + 6, formatNumber(value), { size: 16, fill: color, anchor: "end" }));
  }
  return parts.join("");
}

function horizontalValueGrid(axis: ReturnType<typeof horizontalAxis>, color: string): string {
  const parts: string[] = [];
  for (let index = 0; index <= 5; index += 1) {
    const value = axis.min + ((axis.max - axis.min) * index) / 5;
    const x = plot.left + (plot.width * index) / 5;
    parts.push(`<line x1="${x}" y1="${plot.top}" x2="${x}" y2="${plot.top + plot.height}" stroke="#d8e2f0" stroke-width="1"/>`);
    parts.push(text(x, plot.top + plot.height + 30, formatNumber(value), { size: 16, fill: color }));
  }
  return parts.join("");
}

function legend(names: string[], colors: string[], y: number): string {
  if (!names.length) return "";
  const itemWidths = names.map((name) => Math.min(320, Math.max(140, name.length * 11 + 42)));
  const total = itemWidths.reduce((sum, item) => sum + item, 0) + Math.max(0, names.length - 1) * 22;
  let x = Math.max(40, (width - total) / 2);
  const parts: string[] = [];
  names.forEach((name, index) => {
    parts.push(`<rect x="${x}" y="${y - 17}" width="18" height="18" rx="3" fill="${escapeXml(colors[index % colors.length])}"/>`);
    parts.push(text(x + 28, y - 1, name, { size: 16, fill: "#475569", anchor: "start" }));
    x += itemWidths[index] + 22;
  });
  return parts.join("");
}

function categoryLabels(rows: AssistantChartRow[], color: string, groupWidth: number): string {
  return rows.map((row, index) => {
    const x = plot.left + groupWidth * (index + 0.5);
    const rotate = groupWidth < 82;
    const labelY = plot.top + plot.height + (rotate ? 105 : 31);
    return text(x, labelY, row.label, {
      size: rotate ? 13 : 16,
      fill: color,
      anchor: rotate ? "end" : "middle",
      transform: rotate ? `rotate(-45 ${x} ${labelY})` : "",
    });
  }).join("");
}

function categoryChart(chart: AssistantChartResult, colors: string[], variant: "bar" | "line" | "area" | "horizontal" | "waterfall" | "gantt", labelColor: string): string {
  const rows = chart.rows;
  if (!rows.length) return "";
  if (variant === "gantt") {
    const starts = rows.map((row) => numeric(row.start ?? row.values[0]));
    const ends = rows.map((row) => numeric(row.end ?? row.values[1]));
    const axis = horizontalAxis([...starts, ...ends], false);
    const rowHeight = plot.height / rows.length;
    const parts = [horizontalValueGrid(axis, labelColor), `<g clip-path="url(#chart-plot)">`];
    rows.forEach((row, index) => {
      const start = starts[index];
      const end = Math.max(start, ends[index]);
      const y = plot.top + rowHeight * (index + 0.5);
      const x = axis.point(start);
      parts.push(text(plot.left - 16, y + 6, row.label, { size: Math.min(15, Math.max(10, rowHeight * 0.55)), fill: labelColor, anchor: "end" }));
      parts.push(`<rect x="${x}" y="${y - Math.min(22, rowHeight * 0.34)}" width="${Math.max(2, axis.point(end) - x)}" height="${Math.min(44, rowHeight * 0.68)}" rx="4" fill="${colors[0]}"/>`);
    });
    parts.push(`</g>`);
    const usesDates = starts.some((value) => value > 10_000_000_000);
    if (usesDates) {
      for (let index = 0; index <= 5; index += 1) {
        const value = axis.min + ((axis.max - axis.min) * index) / 5;
        const dateLabel = new Date(value).toLocaleDateString("vi-VN", { month: "2-digit", year: "2-digit" });
        const x = plot.left + (plot.width * index) / 5;
        parts.push(text(x, plot.top + plot.height + 30, dateLabel, { size: 16, fill: labelColor }));
      }
    }
    return parts.join("");
  }

  if (variant === "waterfall") {
    const steps = rows.map((row) => ({
      start: numeric(row.start ?? row.base ?? 0),
      end: numeric(row.end ?? (numeric(row.base) + numeric(row.increase) - numeric(row.decrease))),
      base: numeric(row.base ?? 0),
      increase: numeric(row.increase ?? Math.max(0, row.values[0] ?? 0)),
      decrease: numeric(row.decrease ?? Math.max(0, -(row.values[0] ?? 0))),
    }));
    const axis = numericAxis(steps.flatMap((step) => [step.start, step.end, step.base, step.base + step.increase]));
    const groupWidth = plot.width / rows.length;
    const parts = [valueGrid(axis, labelColor), categoryLabels(rows, labelColor, groupWidth), `<g clip-path="url(#chart-plot)">`];
    const zeroY = axis.point(0);
    steps.forEach((step, index) => {
      const value = step.increase || step.decrease || step.end - step.start;
      const start = step.start;
      const end = step.end;
      const top = Math.min(axis.point(start), axis.point(end));
      const barHeight = Math.max(2, Math.abs(axis.point(end) - axis.point(start)));
      const barWidth = Math.min(56, groupWidth * 0.64);
      const x = plot.left + groupWidth * index + (groupWidth - barWidth) / 2;
      const fill = value < 0 || step.decrease > 0 ? colors[3] : colors[2];
      parts.push(`<line x1="${plot.left + groupWidth * (index + 0.5)}" y1="${zeroY}" x2="${plot.left + groupWidth * (index + 0.5)}" y2="${top}" stroke="#94a3b8" stroke-dasharray="5 5"/>`);
      parts.push(`<rect x="${x}" y="${top}" width="${barWidth}" height="${barHeight}" rx="4" fill="${fill}"/>`);
    });
    parts.push(`</g>`);
    return parts.join("");
  }

  if (variant === "line" || variant === "area") {
    const allValues = rows.flatMap((row) => chart.series.map((_, index) => numeric(row.values[index])));
    const axis = numericAxis(allValues);
    const groupWidth = plot.width / Math.max(1, rows.length - 1);
    const parts = [valueGrid(axis, labelColor), categoryLabels(rows, labelColor, plot.width / rows.length), `<g clip-path="url(#chart-plot)">`];
    chart.series.forEach((name, seriesIndex) => {
      const points = rows.map((row, index) => ({
        x: plot.left + (rows.length === 1 ? plot.width / 2 : groupWidth * index),
        y: axis.point(numeric(row.values[seriesIndex])),
      }));
      const path = points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
      if (variant === "area") {
        const baseline = axis.point(0);
        const area = `${path} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
        parts.push(`<path d="${area}" fill="${colors[seriesIndex % colors.length]}" fill-opacity="0.18" stroke="none"/>`);
      }
      parts.push(`<path d="${path}" fill="none" stroke="${colors[seriesIndex % colors.length]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
      points.forEach((point) => parts.push(`<circle cx="${point.x}" cy="${point.y}" r="5" fill="${colors[seriesIndex % colors.length]}"/>`));
      if (chart.series.length > 1 && name) parts.push("");
    });
    parts.push(`</g>`);
    return parts.join("");
  }

  if (variant === "horizontal") {
    const values = rows.flatMap((row) => chart.series.map((_, index) => numeric(row.values[index])));
    const axis = horizontalAxis(values);
    const rowHeight = plot.height / rows.length;
    const barHeight = Math.min(30, rowHeight * (chart.series.length > 1 ? 0.68 / chart.series.length : 0.64));
    const parts = [horizontalValueGrid(axis, labelColor), `<g clip-path="url(#chart-plot)">`];
    rows.forEach((row, rowIndex) => {
      const centerY = plot.top + rowHeight * (rowIndex + 0.5);
      parts.push(text(plot.left - 18, centerY + 6, row.label, { size: Math.min(16, Math.max(10, rowHeight * 0.55)), fill: labelColor, anchor: "end" }));
      chart.series.forEach((_, seriesIndex) => {
        const value = numeric(row.values[seriesIndex]);
        const y = centerY + (seriesIndex - (chart.series.length - 1) / 2) * (barHeight + 3) - barHeight / 2;
        const startX = axis.point(Math.min(0, value));
        const endX = axis.point(Math.max(0, value));
        const fill = chart.highlightLabels.includes(row.label) ? colors[0] : colors[seriesIndex % colors.length];
        parts.push(`<rect x="${startX}" y="${y}" width="${Math.max(2, endX - startX)}" height="${barHeight}" rx="4" fill="${fill}"/>`);
      });
    });
    parts.push(`</g>`);
    return parts.join("");
  }

  const values = rows.flatMap((row) => chart.series.map((_, index) => numeric(row.values[index])));
  const stacked = chart.chartType === "Biểu đồ xếp chồng";
  const axisValues = stacked ? rows.map((row) => chart.series.reduce((sum, _, index) => sum + numeric(row.values[index]), 0)) : values;
  const axis = numericAxis(axisValues);
  const groupWidth = plot.width / rows.length;
  const seriesCount = Math.max(1, chart.series.length);
  const barWidth = Math.min(56, (groupWidth * 0.76) / (stacked ? 1 : seriesCount));
  const parts = [valueGrid(axis, labelColor), categoryLabels(rows, labelColor, groupWidth), `<g clip-path="url(#chart-plot)">`];
  rows.forEach((row, rowIndex) => {
    let cumulative = 0;
    chart.series.forEach((_, seriesIndex) => {
      const value = numeric(row.values[seriesIndex]);
      const base = stacked ? cumulative : 0;
      const end = base + value;
      const top = Math.min(axis.point(base), axis.point(end));
      const barHeight = Math.max(2, Math.abs(axis.point(end) - axis.point(base)));
      const x = plot.left + groupWidth * rowIndex + (stacked ? (groupWidth - barWidth) / 2 : (groupWidth - barWidth * seriesCount) / 2 + barWidth * seriesIndex);
      const fill = chart.highlightLabels.includes(row.label) ? colors[0] : colors[seriesIndex % colors.length];
      parts.push(`<rect x="${x}" y="${top}" width="${barWidth}" height="${barHeight}" rx="4" fill="${fill}"/>`);
      if (stacked) cumulative = end;
    });
  });
  parts.push(`</g>`);
  return parts.join("");
}

function scatterChart(chart: AssistantChartResult, color: string, labelColor: string): string {
  const xs = chart.rows.map((row) => numeric(row.x ?? row.values[0]));
  const ys = chart.rows.map((row) => numeric(row.y ?? row.values[1]));
  const xAxis = horizontalAxis(xs, false);
  const yAxis = numericAxis(ys, false);
  const parts = [valueGrid(yAxis, labelColor), horizontalValueGrid(xAxis, labelColor), `<g clip-path="url(#chart-plot)">`];
  chart.rows.forEach((row, index) => {
    const x = xAxis.point(xs[index]);
    const y = yAxis.point(ys[index]);
    parts.push(`<circle cx="${x}" cy="${y}" r="7" fill="${color}" fill-opacity="0.76" stroke="#ffffff" stroke-width="2"/>`);
  });
  parts.push(`</g>`);
  parts.push(text(plot.left + plot.width / 2, plot.top + plot.height + 76, chart.xAxisLabel, { size: 18, fill: labelColor }));
  parts.push(text(46, plot.top + plot.height / 2, chart.yAxisLabel, { size: 18, fill: labelColor, transform: `rotate(-90 46 ${plot.top + plot.height / 2})` }));
  return parts.join("");
}

function pieChart(chart: AssistantChartResult, colors: string[], labelColor: string, background: string): string {
  const rows = chart.rows;
  const values = rows.map((row) => Math.max(0, numeric(row.values[0])));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return text(width / 2, height / 2, "Không có giá trị dương để vẽ", { size: 24, fill: labelColor });
  const cx = 625;
  const cy = 480;
  const radius = 300;
  const innerRadius = chart.chartType === "Biểu đồ vòng" ? 150 : 0;
  let angle = -Math.PI / 2;
  const parts: string[] = [];
  rows.forEach((row, index) => {
    const sweep = (values[index] / total) * Math.PI * 2;
    if (sweep <= 0) return;
    const next = angle + sweep;
    const startX = cx + radius * Math.cos(angle);
    const startY = cy + radius * Math.sin(angle);
    const endX = cx + radius * Math.cos(next);
    const endY = cy + radius * Math.sin(next);
    const large = sweep > Math.PI ? 1 : 0;
    const highlighted = chart.highlightLabels.includes(row.label);
    const fill = highlighted ? colors[0] : colors[index % colors.length];
    if (sweep >= Math.PI * 2 - 0.0001) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}"/>`);
      if (innerRadius) parts.push(`<circle cx="${cx}" cy="${cy}" r="${innerRadius}" fill="${escapeXml(background)}"/>`);
    } else if (innerRadius) {
      const innerEndX = cx + innerRadius * Math.cos(next);
      const innerEndY = cy + innerRadius * Math.sin(next);
      const innerStartX = cx + innerRadius * Math.cos(angle);
      const innerStartY = cy + innerRadius * Math.sin(angle);
      parts.push(`<path d="M ${startX} ${startY} A ${radius} ${radius} 0 ${large} 1 ${endX} ${endY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 ${large} 0 ${innerStartX} ${innerStartY} Z" fill="${fill}" stroke="#ffffff" stroke-width="3"/>`);
    } else {
      parts.push(`<path d="M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${large} 1 ${endX} ${endY} Z" fill="${fill}" stroke="#ffffff" stroke-width="3"/>`);
    }
    const mid = angle + sweep / 2;
    const labelRadius = radius + 38;
    const x = cx + labelRadius * Math.cos(mid);
    const y = cy + labelRadius * Math.sin(mid);
    parts.push(text(x, y, `${((values[index] / total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`, { size: 16, fill: labelColor, weight: 600 }));
    angle = next;
  });
  if (innerRadius) parts.push(text(cx, cy + 8, formatNumber(total), { size: 24, fill: labelColor, weight: 600 }));
  parts.push(legend(rows.map((row) => row.label), rows.map((_, index) => colors[index % colors.length]), 900));
  return parts.join("");
}

function isLightColor(value: string): boolean {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (match) {
    const [red, green, blue] = match.slice(1).map(Number);
    return (red * 0.2126 + green * 0.7152 + blue * 0.0722) > 150;
  }
  return /^(#f|#e|white)/i.test(value.trim());
}

export function createAssistantChartSvg(chart: AssistantChartResult, options: { background?: string; primary?: string } = {}): string {
  const background = options.background || "#ffffff";
  const primary = options.primary || seriesColors[0];
  const colors = palette(primary);
  const lightBackground = isLightColor(background);
  const labelColor = lightBackground ? "#475569" : "#94a3b8";
  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${escapeXml(background)}"/>`,
    `<defs><clipPath id="chart-plot"><rect x="${plot.left}" y="${plot.top}" width="${plot.width}" height="${plot.height}"/></clipPath></defs>`,
    `<g font-family="Inter, 'Be Vietnam Pro', Arial, sans-serif">`,
    text(width / 2, 66, chart.title, { size: 32, fill: lightBackground ? "#071629" : "#f1f5f9", weight: 600 }),
    text(width / 2, 108, `${chart.yAxisLabel}${chart.unit ? ` · ${chart.unit}` : ""}`, { size: 18, fill: labelColor }),
  ];

  if (chart.layout === "scatter") {
    parts.push(scatterChart(chart, colors[0], labelColor));
  } else if (chart.layout === "gantt") {
    parts.push(categoryChart(chart, colors, "gantt", labelColor));
  } else if (chart.layout === "waterfall") {
    parts.push(categoryChart(chart, [colors[0], colors[2], colors[3]], "waterfall", labelColor));
    parts.push(legend(["Tăng", "Giảm"], [colors[2], colors[3]], 945));
  } else if (chart.chartType === "Biểu đồ tròn" || chart.chartType === "Biểu đồ vòng") {
    parts.push(pieChart(chart, colors, labelColor, background));
  } else if (chart.chartType === "Biểu đồ đường") {
    parts.push(categoryChart(chart, colors, "line", labelColor));
    if (chart.series.length > 1) parts.push(legend(chart.series, colors, 945));
  } else if (chart.chartType === "Biểu đồ vùng") {
    parts.push(categoryChart(chart, colors, "area", labelColor));
    if (chart.series.length > 1) parts.push(legend(chart.series, colors, 945));
  } else if (chart.chartType === "Biểu đồ thanh") {
    parts.push(categoryChart(chart, colors, "horizontal", labelColor));
    if (chart.series.length > 1) parts.push(legend(chart.series, colors, 945));
  } else {
    parts.push(categoryChart(chart, colors, "bar", labelColor));
    if (chart.series.length > 1) parts.push(legend(chart.series, colors, 945));
  }

  if (chart.layout !== "scatter" && chart.layout !== "gantt" && chart.layout !== "waterfall" && chart.chartType !== "Biểu đồ tròn" && chart.chartType !== "Biểu đồ vòng") {
    parts.push(text(width / 2, 885, chart.xAxisLabel, { size: 18, fill: labelColor }));
    parts.push(text(45, plot.top + plot.height / 2, chart.yAxisLabel, { size: 18, fill: labelColor, transform: `rotate(-90 45 ${plot.top + plot.height / 2})` }));
  }
  parts.push(`</g></svg>`);
  return parts.join("");
}
