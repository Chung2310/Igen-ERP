import {
  InventoryForecastItem,
  InventoryForecastRecommendation,
  InventoryForecastSeriesPoint,
  InventoryForecastSummary,
  ProductItem,
  StockLog,
} from "../types";

const HISTORY_DAYS = 30;
const FORECAST_DAYS = 30;

type StockLogWithTimestamp = StockLog & {
  createdAtTimestamp?: { toDate?: () => Date; seconds?: number };
};

function normalizeStatus(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized;
}

function isCompletedExportLog(log: StockLog) {
  const status = normalizeStatus(log.status);
  return String(log.type).trim().toLowerCase() === "xuất" && (status === "hoàn thành" || status === "thành công");
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseVietnameseDate(value: string, now: Date) {
  const input = value.trim();

  if (!input) return null;

  if (input.toLowerCase().startsWith("hôm nay")) {
    const matchedTime = input.match(/(\d{1,2}):(\d{2})/);
    const date = new Date(now);
    if (matchedTime) {
      date.setHours(Number(matchedTime[1]), Number(matchedTime[2]), 0, 0);
    } else {
      date.setHours(12, 0, 0, 0);
    }
    return date;
  }

  const parts = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (parts) {
    const [, day, month, year, hour = "12", minute = "00"] = parts;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseLogDate(log: StockLog, now: Date) {
  const typedLog = log as StockLogWithTimestamp;

  if (typedLog.createdAtTimestamp?.toDate) {
    return typedLog.createdAtTimestamp.toDate();
  }

  if (typeof typedLog.createdAtTimestamp?.seconds === "number") {
    return new Date(typedLog.createdAtTimestamp.seconds * 1000);
  }

  return parseVietnameseDate(log.createdAt, now);
}

function roundDemand(value: number) {
  return Math.round(value * 10) / 10;
}

function buildSeries(
  actualKeys: string[],
  actualByDay: Map<string, number>,
  forecastDailyDemand: number,
  today: Date
) {
  const historySeries: InventoryForecastSeriesPoint[] = actualKeys.map((key) => ({
    isoDate: key,
    label: key.slice(5),
    actual: actualByDay.get(key) || 0,
    forecast: 0,
    period: "history",
  }));

  const forecastSeries: InventoryForecastSeriesPoint[] = Array.from({ length: FORECAST_DAYS }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index + 1);
    const key = formatKey(date);
    return {
      isoDate: key,
      label: key.slice(5),
      actual: 0,
      forecast: roundDemand(forecastDailyDemand),
      period: "forecast",
    };
  });

  return [...historySeries, ...forecastSeries];
}

export function buildInventoryForecast(products: ProductItem[], stockLogs: StockLog[]): InventoryForecastSummary {
  const now = new Date();
  const today = startOfDay(now);
  const historyStart = new Date(today);
  historyStart.setDate(today.getDate() - (HISTORY_DAYS - 1));

  const historyKeys = Array.from({ length: HISTORY_DAYS }, (_, index) => {
    const current = new Date(historyStart);
    current.setDate(historyStart.getDate() + index);
    return formatKey(current);
  });

  const productLookup = new Map(products.map((product) => [product.id, product]));
  const productBySku = new Map(products.map((product) => [product.sku, product]));
  const demandByProduct = new Map<string, Map<string, number>>();

  products.forEach((product) => {
    demandByProduct.set(product.id, new Map(historyKeys.map((key) => [key, 0])));
  });

  stockLogs.forEach((log) => {
    if (!isCompletedExportLog(log)) return;

    const parsedDate = parseLogDate(log, now);
    if (!parsedDate) return;

    const dayKey = formatKey(startOfDay(parsedDate));
    if (!historyKeys.includes(dayKey)) return;

    const items = (log.items?.length ? log.items : [{
      productId: "",
      sku: log.sku,
      productName: log.productName,
      quantity: log.quantity,
    }]);

    items.forEach((item) => {
      const matchedProduct = (item.productId && productLookup.get(item.productId)) || productBySku.get(item.sku);
      if (!matchedProduct) return;

      const productDemand = demandByProduct.get(matchedProduct.id);
      if (!productDemand) return;

      productDemand.set(dayKey, (productDemand.get(dayKey) || 0) + item.quantity);
    });
  });

  const items: InventoryForecastItem[] = products.map((product) => {
    const dailyDemand = demandByProduct.get(product.id) || new Map<string, number>();
    const demandValues = historyKeys.map((key) => dailyDemand.get(key) || 0);
    const last30DaysDemand = demandValues.reduce((sum, value) => sum + value, 0);
    const last7DaysDemand = demandValues.slice(-7).reduce((sum, value) => sum + value, 0);
    const weightedAverageDailyDemand = (last7DaysDemand / 7) * 0.65 + (last30DaysDemand / 30) * 0.35;
    const averageDailyDemand = roundDemand(weightedAverageDailyDemand);
    const forecast30Days = Math.max(0, Math.round(weightedAverageDailyDemand * FORECAST_DAYS));
    const daysOfCover = averageDailyDemand > 0 ? roundDemand(product.stock / averageDailyDemand) : null;
    const safetyStock = Math.max(product.minStockAlert, Math.ceil(last7DaysDemand));
    const suggestedReorderQty = Math.max(0, Math.ceil(forecast30Days + safetyStock - product.stock));
    const overstockDays = averageDailyDemand > 0 ? roundDemand((product.stock - forecast30Days) / averageDailyDemand) : null;

    let riskLevel: InventoryForecastItem["riskLevel"] = "low";
    if (product.stock <= product.minStockAlert || (daysOfCover !== null && daysOfCover <= 7)) {
      riskLevel = "high";
    } else if (daysOfCover !== null && daysOfCover <= 14) {
      riskLevel = "medium";
    }

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      currentStock: product.stock,
      minStockAlert: product.minStockAlert,
      averageDailyDemand,
      last7DaysDemand,
      last30DaysDemand,
      forecast30Days,
      daysOfCover,
      suggestedReorderQty,
      overstockDays,
      riskLevel,
      series: buildSeries(historyKeys, dailyDemand, weightedAverageDailyDemand, today),
    };
  });

  const warningItems = items
    .filter((item) => item.currentStock <= item.minStockAlert || (item.daysOfCover !== null && item.daysOfCover <= 14))
    .sort((left, right) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      const riskGap = riskOrder[left.riskLevel] - riskOrder[right.riskLevel];
      if (riskGap !== 0) return riskGap;
      const leftCover = left.daysOfCover ?? Number.POSITIVE_INFINITY;
      const rightCover = right.daysOfCover ?? Number.POSITIVE_INFINITY;
      return leftCover - rightCover;
    });

  const recommendations: InventoryForecastRecommendation[] = items
    .flatMap((item) => {
      const nextRecommendations: InventoryForecastRecommendation[] = [];

      if (item.suggestedReorderQty > 0 && item.riskLevel !== "low") {
        nextRecommendations.push({
          id: `${item.productId}-reorder`,
          sku: item.sku,
          productName: item.name,
          tone: item.riskLevel === "high" ? "danger" : "warning",
          title: `Nên nhập thêm ${item.suggestedReorderQty} ${item.sku}`,
          body: `Tồn hiện tại ${item.currentStock}, nhu cầu 30 ngày dự kiến ${item.forecast30Days}, mức phủ hàng còn ${item.daysOfCover ?? 0} ngày.`,
        });
      }

      const hasLowDemand = item.forecast30Days === 0 && item.currentStock > item.minStockAlert * 2;
      const hasMeaningfulOverstock =
        item.forecast30Days > 0 &&
        item.currentStock > item.forecast30Days * 1.5 &&
        item.overstockDays !== null &&
        item.overstockDays > 15;

      if (hasLowDemand || hasMeaningfulOverstock) {
        nextRecommendations.push({
          id: `${item.productId}-overstock`,
          sku: item.sku,
          productName: item.name,
          tone: "info",
          title: `Tạm giảm nhập ${item.sku}`,
          body:
            item.forecast30Days === 0
              ? `30 ngày gần đây chưa có nhu cầu xuất đáng kể, tồn hiện tại ${item.currentStock} đang cao hơn mức cảnh báo ${item.minStockAlert}.`
              : `Tồn hiện tại ${item.currentStock} cao hơn nhu cầu dự báo 30 ngày (${item.forecast30Days}). Kho đủ dùng khoảng ${item.daysOfCover ?? 0} ngày.`,
        });
      }

      return nextRecommendations;
    })
    .sort((left, right) => {
      const toneOrder = { danger: 0, warning: 1, info: 2 };
      return toneOrder[left.tone] - toneOrder[right.tone];
    })
    .slice(0, 6);

  const hasHistoricalDemand = items.some((item) => item.last30DaysDemand > 0);

  return {
    items: items.sort((left, right) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      const riskGap = riskOrder[left.riskLevel] - riskOrder[right.riskLevel];
      if (riskGap !== 0) return riskGap;
      return right.forecast30Days - left.forecast30Days;
    }),
    recommendations,
    warningItems,
    hasHistoricalDemand,
  };
}
