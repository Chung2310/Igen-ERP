import * as XLSX from "xlsx";
import PizZip from "pizzip";
import type { AssistantChartResult } from "../../shared/assistant-chart";

const chartNamespace = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const drawingNamespace = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const spreadsheetDrawingRelation = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const chartRelation = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
const relationshipsNamespace = "http://schemas.openxmlformats.org/package/2006/relationships";

type ExportSeries = {
  name: string;
  column: number;
  values: number[];
  transparent?: boolean;
};

type ExportData = {
  headers: string[];
  rows: Array<Array<string | number>>;
  series: ExportSeries[];
  categoryColumn?: number;
  xColumn?: number;
  yColumn?: number;
  kind: "bar" | "line" | "area" | "pie" | "doughnut" | "scatter";
  horizontal?: boolean;
  stacked?: boolean;
  dateAxis?: boolean;
  dateColumns?: number[];
};

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let current = index + 1;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function excelDateSerial(value: number): number {
  return value > 10_000_000_000 ? value / 86_400_000 + 25_569 : value;
}

function buildExportData(chart: AssistantChartResult): ExportData {
  if (chart.layout === "scatter") {
    return {
      headers: [chart.xAxisLabel || "X", chart.series[0] || chart.yAxisLabel || "Y", "Nhãn"],
      rows: chart.rows.map((row) => [row.x ?? row.values[0] ?? 0, row.y ?? row.values[1] ?? 0, row.label]),
      series: [{ name: chart.series[0] || chart.yAxisLabel || "Y", column: 1, values: chart.rows.map((row) => row.y ?? row.values[1] ?? 0) }],
      xColumn: 0,
      yColumn: 1,
      kind: "scatter",
    };
  }

  if (chart.layout === "gantt") {
    const starts = chart.rows.map((row) => excelDateSerial(row.start ?? row.values[0] ?? 0));
    const ends = chart.rows.map((row) => excelDateSerial(row.end ?? row.values[1] ?? 0));
    const durations = chart.rows.map((_, index) => Math.max(0, ends[index] - starts[index]));
    const hasDateValues = chart.rows.some((row) => (row.start ?? row.values[0] ?? 0) > 10_000_000_000);
    return {
      headers: ["Công việc", "Bắt đầu", "Thời lượng", "Kết thúc"],
      rows: chart.rows.map((row, index) => [row.label, starts[index], durations[index], ends[index]]),
      series: [
        { name: "Bắt đầu", column: 1, values: starts, transparent: true },
        { name: "Thời lượng", column: 2, values: durations },
      ],
      categoryColumn: 0,
      kind: "bar",
      horizontal: true,
      stacked: true,
      dateAxis: hasDateValues,
      dateColumns: hasDateValues ? [1, 3] : [],
    };
  }

  if (chart.layout === "waterfall") {
    const waterfallRows = chart.rows.map((row) => {
      const base = row.base ?? Math.min(row.start || 0, row.end || 0);
      const increase = row.increase ?? Math.max(0, row.values[0] || 0);
      const decrease = row.decrease ?? Math.max(0, -(row.values[0] || 0));
      return { base, increase, decrease };
    });
    return {
      headers: ["Hạng mục", "Cơ sở", "Tăng", "Giảm"],
      rows: chart.rows.map((row, index) => [row.label, waterfallRows[index].base, waterfallRows[index].increase, waterfallRows[index].decrease]),
      series: [
        { name: "Cơ sở", column: 1, values: waterfallRows.map((row) => row.base), transparent: true },
        { name: "Tăng", column: 2, values: waterfallRows.map((row) => row.increase) },
        { name: "Giảm", column: 3, values: waterfallRows.map((row) => row.decrease) },
      ],
      categoryColumn: 0,
      kind: "bar",
      stacked: true,
    };
  }

  const rows = chart.rows.map((row) => [row.label, ...chart.series.map((_, index) => row.values[index] ?? 0)]);
  const series = chart.series.map((name, index) => ({
    name,
    column: index + 1,
    values: chart.rows.map((row) => row.values[index] ?? 0),
  }));
  const isPie = chart.chartType === "Biểu đồ tròn" || chart.chartType === "Biểu đồ vòng";
  const kind = isPie ? (chart.chartType === "Biểu đồ vòng" ? "doughnut" : "pie")
    : chart.chartType === "Biểu đồ đường" ? "line"
      : chart.chartType === "Biểu đồ vùng" ? "area" : "bar";

  return {
    headers: ["Nhãn", ...chart.series],
    rows,
    series: isPie ? series.slice(0, 1) : series,
    categoryColumn: 0,
    kind,
    horizontal: chart.chartType === "Biểu đồ thanh",
    stacked: chart.chartType === "Biểu đồ xếp chồng",
  };
}

function dataFormula(column: number, rowCount: number): string {
  const columnRef = columnName(column);
  return `'Dữ liệu'!$${columnRef}$2:$${columnRef}$${rowCount + 1}`;
}

function headerFormula(column: number): string {
  const columnRef = columnName(column);
  return `'Dữ liệu'!$${columnRef}$1`;
}

function stringCache(values: string[]): string {
  return `<c:strCache><c:ptCount val="${values.length}"/>${values.map((value, index) => `<c:pt idx="${index}"><c:v>${xmlEscape(value)}</c:v></c:pt>`).join("")}</c:strCache>`;
}

function numberCache(values: number[]): string {
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values.map((value, index) => `<c:pt idx="${index}"><c:v>${Number.isFinite(value) ? value : 0}</c:v></c:pt>`).join("")}</c:numCache>`;
}

function titleXml(title: string, size = 1400): string {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="1"/></a:pPr><a:r><a:rPr lang="vi-VN" sz="${size}" b="1"/><a:t>${xmlEscape(title)}</a:t></a:r><a:endParaRPr lang="vi-VN"/></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
}

function seriesXml(series: ExportSeries, index: number, data: ExportData, rowCount: number, isScatter = false): string {
  const name = `<c:tx><c:strRef><c:f>${xmlEscape(headerFormula(series.column))}</c:f>${stringCache([series.name])}</c:strRef></c:tx>`;
  const color = `accent${(index % 6) + 1}`;
  const shape = series.transparent
    ? `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>`
    : `<c:spPr><a:solidFill><a:schemeClr val="${color}"/></a:solidFill><a:ln><a:solidFill><a:schemeClr val="${color}"/></a:solidFill></a:ln></c:spPr>`;
  const marker = data.kind === "line" || isScatter ? `<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>` : "";

  if (isScatter) {
    const xValues = data.rows.map((row) => Number(row[data.xColumn!]));
    const yValues = data.rows.map((row) => Number(row[data.yColumn!]));
    return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${name}${shape}${marker}<c:xVal><c:numRef><c:f>${xmlEscape(dataFormula(data.xColumn!, rowCount))}</c:f>${numberCache(xValues)}</c:numRef></c:xVal><c:yVal><c:numRef><c:f>${xmlEscape(dataFormula(data.yColumn!, rowCount))}</c:f>${numberCache(yValues)}</c:numRef></c:yVal><c:smooth val="0"/></c:ser>`;
  }

  const categories = data.rows.map((row) => String(row[data.categoryColumn!] ?? ""));
  return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${name}${shape}${marker}<c:cat><c:strRef><c:f>${xmlEscape(dataFormula(data.categoryColumn!, rowCount))}</c:f>${stringCache(categories)}</c:strRef></c:cat><c:val><c:numRef><c:f>${xmlEscape(dataFormula(series.column, rowCount))}</c:f>${numberCache(series.values)}</c:numRef></c:val>${data.kind === "line" ? `<c:smooth val="0"/>` : ""}</c:ser>`;
}

function axisTitleXml(title: string): string {
  return `<c:title><c:tx><c:rich><a:bodyPr rot="-5400000"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1000"/></a:pPr><a:r><a:rPr lang="vi-VN" sz="1000"/><a:t>${xmlEscape(title)}</a:t></a:r><a:endParaRPr lang="vi-VN"/></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
}

function categoryAxis(id: number, crossId: number, position: "b" | "l", title: string): string {
  return `<c:catAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${position}"/>${title ? axisTitleXml(title) : ""}<c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${crossId}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>`;
}

function valueAxis(id: number, crossId: number, position: "l" | "b", title: string, dateAxis = false): string {
  return `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${position}"/><c:majorGridlines/>${title ? axisTitleXml(title) : ""}${dateAxis ? `<c:numFmt formatCode="dd/mm/yyyy" sourceLinked="0"/>` : `<c:numFmt formatCode="#,##0.##" sourceLinked="1"/>`}<c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${crossId}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
}

function chartXml(chart: AssistantChartResult, data: ExportData): string {
  const rowCount = data.rows.length;
  const isScatter = data.kind === "scatter";
  let plot: string;

  if (data.kind === "pie" || data.kind === "doughnut") {
    const series = data.series[0];
    const categories = data.rows.map((row) => String(row[data.categoryColumn!] ?? ""));
    const pieSeries = `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>${xmlEscape(headerFormula(series.column))}</c:f>${stringCache([series.name])}</c:strRef></c:tx><c:cat><c:strRef><c:f>${xmlEscape(dataFormula(data.categoryColumn!, rowCount))}</c:f>${stringCache(categories)}</c:strRef></c:cat><c:val><c:numRef><c:f>${xmlEscape(dataFormula(series.column, rowCount))}</c:f>${numberCache(series.values)}</c:numRef></c:val></c:ser>`;
    const chartTag = data.kind === "doughnut" ? "doughnutChart" : "pieChart";
    const holeSize = data.kind === "doughnut" ? `<c:holeSize val="55"/>` : "";
    plot = `<c:${chartTag}><c:varyColors val="1"/>${pieSeries}<c:dLbls><c:showLegendKey val="0"/><c:showPercent val="1"/><c:showLeaderLines val="1"/></c:dLbls>${holeSize}<c:firstSliceAng val="0"/></c:${chartTag}>`;
    plot += `<c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend>`;
  } else if (isScatter) {
    plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${data.series.map((item, index) => seriesXml(item, index, data, rowCount, true)).join("")}<c:axId val="10"/><c:axId val="20"/></c:scatterChart>${valueAxis(10, 20, "b", chart.xAxisLabel)}${valueAxis(20, 10, "l", chart.yAxisLabel)}`;
  } else {
    const series = data.series.map((item, index) => seriesXml(item, index, data, rowCount)).join("");
    if (data.kind === "line") {
      plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:smooth val="0"/><c:axId val="10"/><c:axId val="20"/></c:lineChart>`;
    } else if (data.kind === "area") {
      plot = `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:axId val="10"/><c:axId val="20"/></c:areaChart>`;
    } else {
      plot = `<c:barChart><c:barDir val="${data.horizontal ? "bar" : "col"}"/><c:grouping val="${data.stacked ? "stacked" : "clustered"}"/><c:varyColors val="0"/>${series}${data.stacked ? `<c:overlap val="100"/>` : ""}<c:gapWidth val="70"/><c:axId val="10"/><c:axId val="20"/></c:barChart>`;
    }
    plot += data.horizontal
      ? `${categoryAxis(10, 20, "l", chart.xAxisLabel)}${valueAxis(20, 10, "b", chart.yAxisLabel, data.dateAxis)}`
      : `${categoryAxis(10, 20, "b", chart.xAxisLabel)}${valueAxis(20, 10, "l", chart.yAxisLabel)}`;
    if (data.series.length > 1) plot += `<c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="${chartNamespace}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:date1904 val="0"/><c:lang val="vi-VN"/><c:roundedCorners val="0"/><c:chart>${titleXml(chart.title)}<c:plotArea><c:layout/>${plot}</c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" h="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function drawingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${drawingNamespace}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>14</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>28</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Biểu đồ 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${chartNamespace}"><c:chart xmlns:c="${chartNamespace}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;
}

function installNativeChart(zip: PizZip, chart: AssistantChartResult, data: ExportData): void {
  const sheet = zip.file("xl/worksheets/sheet1.xml");
  const contentTypes = zip.file("[Content_Types].xml");
  if (!sheet || !contentTypes) throw new Error("Excel workbook is missing required parts.");

  let sheetXml = sheet.asText();
  if (!sheetXml.includes("xmlns:r=")) {
    sheetXml = sheetXml.replace("<worksheet ", `<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" `);
  }
  sheetXml = sheetXml.replace("</worksheet>", `<drawing r:id="rId1"/></worksheet>`);
  zip.file("xl/worksheets/sheet1.xml", sheetXml);
  zip.file("xl/worksheets/_rels/sheet1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${relationshipsNamespace}"><Relationship Id="rId1" Type="${spreadsheetDrawingRelation}" Target="../drawings/drawing1.xml"/></Relationships>`);
  zip.file("xl/drawings/drawing1.xml", drawingXml());
  zip.file("xl/drawings/_rels/drawing1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${relationshipsNamespace}"><Relationship Id="rId1" Type="${chartRelation}" Target="../charts/chart1.xml"/></Relationships>`);
  zip.file("xl/charts/chart1.xml", chartXml(chart, data));

  const newOverrides = `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
  zip.file("[Content_Types].xml", contentTypes.asText().replace("</Types>", `${newOverrides}</Types>`));
}

export function createAssistantChartWorkbook(chart: AssistantChartResult): Blob {
  const data = buildExportData(chart);
  const workbook = XLSX.utils.book_new();
  const chartSheet = XLSX.utils.aoa_to_sheet([
    [chart.title],
    ["Biểu đồ Excel có thể chỉnh sửa. Dữ liệu nguồn nằm trong sheet Dữ liệu."],
  ]);
  const dataSheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
  for (const rowIndex of data.dateColumns ?? []) {
    for (let row = 2; row <= data.rows.length + 1; row += 1) {
      const cell = dataSheet[`${columnName(rowIndex)}${row}`];
      if (cell) cell.z = "dd/mm/yyyy";
    }
  }
  XLSX.utils.book_append_sheet(workbook, chartSheet, "Biểu đồ");
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Dữ liệu");

  const zip = new PizZip();
  zip.load(XLSX.write(workbook, { bookType: "xlsx", type: "base64", cellStyles: true }), { base64: true });
  installNativeChart(zip, chart, data);
  return zip.generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression: "DEFLATE" });
}
