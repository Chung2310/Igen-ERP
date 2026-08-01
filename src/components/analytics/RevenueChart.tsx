import { useState } from "react";
import type { RevenueBucket, RevenueGranularity } from "../../services/analyticsService";

/**
 * Biểu đồ cột doanh thu theo thời gian — một chuỗi dữ liệu duy nhất (học phí),
 * nên không cần legend: tiêu đề đã nói rõ đang xem gì.
 *
 * Màu lấy từ slot categorical 1 của bảng màu đã qua validator (đạt cả nền sáng
 * lẫn nền tối). Khi thêm nguồn doanh thu thứ hai (bán hàng từ kho) thì chuyển
 * thành cột chồng và bổ sung legend.
 */
const TUITION_COLOR = "#2a78d6";
const GOODS_COLOR = "#d97706";

const CHART_HEIGHT = 220;
const BAR_GAP = 2; // khe 2px giữa các cột để không dính vào nhau
const AXIS_LABEL_COUNT = 6;

function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

function formatBucketLabel(bucket: string, granularity: RevenueGranularity): string {
  if (granularity === "month") {
    const [year, month] = bucket.split("-");
    return `${month}/${year}`;
  }
  if (granularity === "week") return bucket.replace("-W", " tuần ");
  const [, month, day] = bucket.split("-");
  return `${day}/${month}`;
}

export function RevenueChart({
  series,
  granularity,
}: {
  series: RevenueBucket[];
  granularity: RevenueGranularity;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (series.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm font-semibold text-slate-400">
        Không có giao dịch nào trong khoảng thời gian này.
      </div>
    );
  }

  const maxAmount = Math.max(...series.map((row) => row.amount));
  const peakIndex = series.findIndex((row) => row.amount === maxAmount);
  const barWidth = 100 / series.length;

  // Chỉ gắn nhãn thưa trên trục để không chồng chữ khi khoảng thời gian dài.
  const labelStep = Math.max(1, Math.ceil(series.length / AXIS_LABEL_COUNT));

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap gap-4 text-xs font-semibold text-slate-600" aria-label="Chú giải biểu đồ">
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#2a78d6]" />Học phí</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-amber-700 bg-[#d97706]" />Bán hàng</span>
      </div>
      <div className="flex">
        {/* Trục giá trị — chữ nhạt để lùi ra sau dữ liệu */}
        <div
          className="flex w-20 shrink-0 flex-col justify-between pr-2 text-right text-[11px] text-slate-400"
          style={{ height: CHART_HEIGHT }}
        >
          <span>{formatVnd(maxAmount)}</span>
          <span>{formatVnd(maxAmount / 2)}</span>
          <span>0</span>
        </div>

        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 100 ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            style={{ height: CHART_HEIGHT }}
            className="w-full overflow-visible"
            role="img"
            aria-label="Biểu đồ cột chồng doanh thu học phí và bán hàng theo thời gian"
          >
            {/* Lưới nhạt, nằm dưới dữ liệu */}
            {[0, 0.5, 1].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                x2="100"
                y1={CHART_HEIGHT * ratio}
                y2={CHART_HEIGHT * ratio}
                stroke="#e2e8f0"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {series.map((row, index) => {
              const tuitionHeight = maxAmount > 0 ? (row.tuitionAmount / maxAmount) * CHART_HEIGHT : 0;
              const goodsHeight = maxAmount > 0 ? (row.goodsAmount / maxAmount) * CHART_HEIGHT : 0;
              const x = index * barWidth;
              const isActive = hovered === index;

              return (
                <g key={row.bucket}>
                  {/* Vùng bắt hover rộng hơn cột để dễ trỏ trúng */}
                  <rect
                    x={x}
                    y={0}
                    width={barWidth}
                    height={CHART_HEIGHT}
                    fill="transparent"
                    onMouseEnter={() => setHovered(index)}
                    onMouseLeave={() => setHovered(null)}
                  />
                  <rect
                    x={x}
                    y={CHART_HEIGHT - goodsHeight}
                    width={Math.max(barWidth - BAR_GAP, 0.5)}
                    height={goodsHeight}
                    rx="1"
                    fill={GOODS_COLOR}
                    stroke="#92400e"
                    strokeWidth="0.35"
                    opacity={hovered === null || isActive ? 1 : 0.45}
                    pointerEvents="none"
                  />
                  <rect
                    x={x}
                    y={CHART_HEIGHT - goodsHeight - tuitionHeight}
                    width={Math.max(barWidth - BAR_GAP, 0.5)}
                    height={tuitionHeight}
                    rx="1"
                    fill={TUITION_COLOR}
                    opacity={hovered === null || isActive ? 1 : 0.45}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </svg>

          {/* Nhãn trục thời gian */}
          <div className="relative mt-2 h-4">
            {series.map((row, index) =>
              index % labelStep === 0 ? (
                <span
                  key={row.bucket}
                  className="absolute -translate-x-1/2 text-[11px] text-slate-400"
                  style={{ left: `${(index + 0.5) * barWidth}%` }}
                >
                  {formatBucketLabel(row.bucket, granularity)}
                </span>
              ) : null
            )}
          </div>
        </div>
      </div>

      {/* Nhãn trực tiếp cho đỉnh — không gắn số lên mọi cột */}
      {hovered === null && maxAmount > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Cao nhất:{" "}
          <span className="font-semibold text-slate-700">
            {formatBucketLabel(series[peakIndex].bucket, granularity)} —{" "}
            {formatVnd(maxAmount)} ₫
          </span>
        </p>
      )}

      {hovered !== null && (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">
            {formatBucketLabel(series[hovered].bucket, granularity)}
          </span>
          {" — "}
          {formatVnd(series[hovered].amount)} ₫
          <span className="text-slate-400">
            {" · Học phí "}{formatVnd(series[hovered].tuitionAmount)} ₫
            {" · Bán hàng "}{formatVnd(series[hovered].goodsAmount)} ₫
            {" · "}{series[hovered].count} giao dịch
          </span>
        </p>
      )}
    </div>
  );
}
