export interface RetailDateRange {
  from: string;
  to: string;
}

export interface RetailBusinessOverviewRows {
  zeroSoldPhoneStock: Array<Record<string, unknown>>;
  previousMonthIssues: Array<Record<string, unknown>>;
  recentRedmiRecipients: Array<Record<string, unknown>>;
}

function normalized(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").toLocaleLowerCase("vi").replace(/[^a-z0-9]+/g, " ").trim();
}

function vietnamDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.valueOf())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-${parts.find(part => part.type === "day")?.value}`;
}

function inRange(value: unknown, range: RetailDateRange) {
  const day = vietnamDate(value);
  return Boolean(day && day >= range.from && day <= range.to);
}

function productLine(value: unknown) {
  const name = String(value ?? "").trim();
  if (!name) return "";
  return name.split(/\s+-\s+/, 1)[0].trim();
}

function isCompleted(row: Record<string, unknown>) {
  const status = normalized(row.status);
  if (!status) return true;
  if (/\b(?:huy|cancel|reverse|void|that bai|failed|pending|cho duyet)\b/.test(status)) return false;
  return /\b(?:thanh cong|completed|success|posted|hoan tat|hoan thanh|da xuat|da ghi so)\b/.test(status);
}

function isOutgoing(row: Record<string, unknown>) {
  const type = normalized(row.type);
  return !type || /\b(?:xuat|out|issue)\b/.test(type);
}

function isInternalIssue(row: Record<string, unknown>) {
  const context = normalized([row.purpose, row.title, row.notes].join(" "));
  return /\b(?:noi bo|internal)\b/.test(context);
}

function isSaleIssue(row: Record<string, unknown>) {
  const context = normalized([row.purpose, row.title].join(" "));
  return /\b(?:ban|sale)\b/.test(context) && !isInternalIssue(row);
}

function recipientFrom(row: Record<string, unknown>) {
  const customer = typeof row.customerName === "string" ? row.customerName.trim() : "";
  if (customer) return customer.slice(0, 160);
  const notes = typeof row.notes === "string" ? row.notes : "";
  const department = notes.match(/bộ phận\s+(.+?)(?:\s+(?:sử dụng|dùng)|[,.;]|$)/iu);
  if (department?.[1]) return `Bộ phận ${department[1].trim()}`.slice(0, 160);
  const title = typeof row.title === "string" ? row.title : "";
  const personOrDepartment = title.match(/\bcho\s+(.+?)(?:[,.;]|$)/iu);
  return personOrDepartment?.[1]?.trim().slice(0, 160) || "Chưa ghi trên phiếu";
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

export function deriveZeroSoldPhoneStockRows(
  salesReportRows: Array<Record<string, unknown>>,
  inventoryRows: Array<Record<string, unknown>>,
  inventoryComplete: boolean,
) {
  if (!inventoryComplete) return [{ finding: "Chưa thể kết luận vì danh sách tồn kho chưa được đọc đầy đủ." }];

  const soldLines = new Set<string>();
  for (const row of salesReportRows) {
    if (!Array.isArray(row.products)) continue;
    for (const product of row.products) {
      if (product && typeof product === "object") {
        const key = normalized((product as Record<string, unknown>).productName);
        if (key) soldLines.add(key);
      }
    }
  }

  const stockByLine = new Map<string, { productName: string; stock: number; variants: number }>();
  for (const row of inventoryRows) {
    if (!/\b(?:dien thoai|phone|smartphone)\b/.test(normalized(row.category))) continue;
    const name = productLine(row.name);
    const stock = finiteNumber(row.stock);
    const key = normalized(name);
    if (!key || stock === undefined || stock <= 0) continue;
    const aggregate = stockByLine.get(key) || { productName: name, stock: 0, variants: 0 };
    aggregate.stock += stock;
    aggregate.variants += 1;
    stockByLine.set(key, aggregate);
  }

  const matches = [...stockByLine.entries()]
    .filter(([key]) => !soldLines.has(key))
    .map(([, row]) => ({ productName: row.productName, unitsSoldInPeriod: 0, availableStock: row.stock, variantsInStock: row.variants }))
    .sort((a, b) => b.availableStock - a.availableStock || a.productName.localeCompare(b.productName, "vi"));
  return matches.length ? matches : [{ finding: "Không có dòng điện thoại nào vừa không bán trong kỳ vừa còn tồn khả dụng." }];
}

export function derivePreviousMonthIssueRows(
  stockLogRows: Array<Record<string, unknown>>,
  stockLogComplete: boolean,
  range: RetailDateRange,
) {
  if (!stockLogComplete) return [{
    finding: "Chưa thể đếm chính xác vì danh sách phiếu xuất chưa được đọc đầy đủ.",
    from: range.from,
    to: range.to,
  }];

  const previousMonthLogs = stockLogRows.filter(row => isCompleted(row) && isOutgoing(row) && inRange(row.createdAt, range));
  return [
    { documentType: "Phiếu xuất bán hàng", count: previousMonthLogs.filter(isSaleIssue).length, from: range.from, to: range.to },
    { documentType: "Phiếu xuất dùng nội bộ", count: previousMonthLogs.filter(isInternalIssue).length, from: range.from, to: range.to },
  ];
}

export function deriveRetailBusinessOverviewRows(input: {
  salesReportRows: Array<Record<string, unknown>>;
  inventoryRows: Array<Record<string, unknown>>;
  inventoryComplete: boolean;
  stockLogRows: Array<Record<string, unknown>>;
  stockLogComplete: boolean;
  previousMonth: RetailDateRange;
  last30Days: RetailDateRange;
}): RetailBusinessOverviewRows {
  const logs = input.stockLogRows.filter(row => isCompleted(row) && isOutgoing(row));
  const previousMonthIssues = derivePreviousMonthIssueRows(input.stockLogRows, input.stockLogComplete, input.previousMonth);

  const recentRedmiRecipients = input.stockLogComplete
    ? logs.filter(row => inRange(row.createdAt, input.last30Days)).flatMap(row => {
      const items = Array.isArray(row.items) ? row.items.filter(item => item && typeof item === "object") as Array<Record<string, unknown>> : [];
      const matchingItems = items.filter(item => normalized(item.productName).includes("redmi note 14"));
      const matches = matchingItems.length ? matchingItems : normalized(row.productName).includes("redmi note 14") ? [row] : [];
      return matches.map(item => ({
        productName: "Redmi Note 14",
        recipient: recipientFrom(row),
        quantity: finiteNumber(item.quantity ?? row.quantity) ?? "Chưa ghi số lượng",
        createdAt: row.createdAt ?? "",
        issueType: isInternalIssue(row) ? "Xuất dùng nội bộ" : isSaleIssue(row) ? "Xuất bán hàng" : String(row.purpose || row.type || "Xuất kho"),
      }));
    })
    : [{ finding: "Chưa thể xác định vì danh sách phiếu xuất chưa được đọc đầy đủ." }];

  return {
    zeroSoldPhoneStock: deriveZeroSoldPhoneStockRows(input.salesReportRows, input.inventoryRows, input.inventoryComplete),
    previousMonthIssues,
    recentRedmiRecipients: recentRedmiRecipients.length ? recentRedmiRecipients : input.stockLogComplete
      ? [{ finding: "Không có phiếu xuất Redmi Note 14 trong khoảng thời gian này.", from: input.last30Days.from, to: input.last30Days.to }]
      : recentRedmiRecipients,
  };
}
