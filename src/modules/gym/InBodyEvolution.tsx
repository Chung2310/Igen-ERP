import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { GymRecord } from "../../../shared/gym/types";
import { dateLabel } from "./ui";

type Metric = "ALL" | "WEIGHT" | "MUSCLE" | "FAT" | "SCORE";
type RangeLimit = "12" | "30" | "ALL";

const metrics = [
  { id: "WEIGHT" as const, field: "weight", label: "Cân nặng", unit: "kg", color: "var(--color-primary)" },
  { id: "MUSCLE" as const, field: "muscleMass", label: "Khối lượng cơ", unit: "kg", color: "var(--color-change-up)" },
  { id: "FAT" as const, field: "bodyFatPercentage", label: "% Mỡ", unit: "%", color: "var(--color-error)" },
  { id: "SCORE" as const, field: "inbodyScore", label: "Điểm InBody", unit: "", color: "var(--color-tertiary)" },
];

const numberOf = (value: unknown) =>
  value === null || value === undefined || value === ""
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : null;

export default function InBodyEvolution({ records }: { records: GymRecord[] }) {
  const [active, setActive] = useState<Metric>("ALL");
  const [range, setRange] = useState<RangeLimit>("ALL");

  const allSorted = useMemo(
    () =>
      [...records]
        .filter((row) => Number(row.weight) > 0)
        .sort((a, b) => String(a.measurementDate).localeCompare(String(b.measurementDate))),
    [records],
  );

  const sorted = useMemo(() => {
    if (range === "12" && allSorted.length > 12) return allSorted.slice(-12);
    if (range === "30" && allSorted.length > 30) return allSorted.slice(-30);
    return allSorted;
  }, [allSorted, range]);

  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  if (!latest) return null;

  const width = 740;
  const height = 220;
  const left = 44;
  const right = 24;
  const top = 24;
  const bottom = 40;
  const x = (index: number) =>
    left + (index * (width - left - right)) / Math.max(1, sorted.length - 1);

  const labelStep = Math.max(1, Math.ceil(sorted.length / 8));
  const showPointDots = sorted.length <= 40;

  const seriesData = metrics
    .filter((metric) => active === "ALL" || active === metric.id)
    .map((metric) => {
      const values = sorted
        .map((row) => numberOf(row[metric.field]))
        .filter((value): value is number => value !== null);
      if (values.length < 2) return { metric, points: "", dots: [] as Array<{ cx: number; cy: number; label: string }> };
      const min = Math.min(...values);
      const max = Math.max(...values);
      const margin = Math.max(1, (max - min) * 0.18);
      const y = (value: number) =>
        top + ((max + margin - value) * (height - top - bottom)) / (max - min + 2 * margin);
      const dots: Array<{ cx: number; cy: number; label: string }> = [];
      const coords: string[] = [];
      sorted.forEach((row, index) => {
        const value = numberOf(row[metric.field]);
        if (value === null) return;
        const cx = x(index);
        const cy = y(value);
        coords.push(`${cx},${cy}`);
        dots.push({
          cx,
          cy,
          label: `${dateLabel(row.measurementDate)}: ${metric.label} ${value}${metric.unit ? ` ${metric.unit}` : ""}`,
        });
      });
      return { metric, points: coords.join(" "), dots };
    });

  return (
    <section className="space-y-3" aria-label="Tiến độ InBody của học viên">
      {previous && (
        <div className="rounded-md border border-outline-variant bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
            <TrendingUp className="size-4 text-primary" aria-hidden="true" />
            Tiến độ so với ngày {dateLabel(previous.measurementDate)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {metrics.slice(0, 3).map((metric) => {
              const before = numberOf(previous[metric.field]);
              const after = numberOf(latest[metric.field]);
              const delta =
                before !== null && after !== null
                  ? Number((after - before).toFixed(1))
                  : null;
              return (
                <span
                  key={metric.id}
                  className="rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs tabular-nums text-on-surface"
                >
                  {metric.label}: {before !== null ? before : "—"} → {after !== null ? after : "—"} {metric.unit}{" "}
                  <strong className="text-primary">
                    ({delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}${metric.unit}`})
                  </strong>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-on-surface">
            Biểu đồ tiến hóa thể chất ({sorted.length}/{allSorted.length} lần đo)
          </h3>
          <span className="text-xs tabular-nums text-on-surface-variant">
            {dateLabel(first.measurementDate)} – {dateLabel(latest.measurementDate)}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Chỉ số biểu đồ">
            {(
              [
                { id: "ALL", label: "Tổng hợp" },
                ...metrics.map((metric) => ({ id: metric.id, label: metric.label })),
              ] as { id: Metric; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active === tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={`cursor-pointer rounded-md border px-2 py-1 text-xs ${
                  active === tab.id
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-outline-variant text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {allSorted.length > 12 && (
            <div className="inline-flex rounded-md border border-outline-variant bg-surface-container-low p-0.5 text-xs">
              {(
                [
                  ["12", "12 lần"],
                  ["30", "30 lần"],
                  ["ALL", "Tất cả"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={range === key}
                  onClick={() => setRange(key)}
                  className={`cursor-pointer rounded px-2 py-0.5 ${
                    range === key
                      ? "bg-surface-container-lowest font-semibold text-primary shadow-2xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {sorted.length < 2 ? (
          <p className="py-8 text-center text-xs text-on-surface-variant">
            Cần tối thiểu hai lần đo để vẽ biểu đồ tiến độ.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <svg
              className="mt-3 w-full min-w-[500px]"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`Biến động chỉ số InBody qua ${sorted.length} lần đo`}
            >
              <line
                x1={left}
                y1={height - bottom}
                x2={width - right}
                y2={height - bottom}
                stroke="var(--color-outline-variant)"
              />
              {seriesData.map(({ metric, points, dots }) => (
                <g key={metric.id}>
                  {points && (
                    <polyline
                      points={points}
                      fill="none"
                      stroke={metric.color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {showPointDots &&
                    dots.map((dot, idx) => (
                      <circle key={idx} cx={dot.cx} cy={dot.cy} r="3.5" fill={metric.color}>
                        <title>{dot.label}</title>
                      </circle>
                    ))}
                </g>
              ))}
              {sorted.map((row, index) => {
                const isEdge = index === 0 || index === sorted.length - 1;
                if (!isEdge && index % labelStep !== 0) return null;
                return (
                  <text
                    key={row._id || index}
                    x={x(index)}
                    y={height - 13}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--color-on-surface-variant)"
                  >
                    {dateLabel(row.measurementDate)}
                  </text>
                );
              })}
            </svg>
            <div className="flex flex-wrap gap-3 text-xs">
              {metrics
                .filter((metric) => active === "ALL" || active === metric.id)
                .map((metric) => (
                  <span key={metric.id} className="flex items-center gap-1">
                    <i className="size-2 rounded-full" style={{ background: metric.color }} />
                    {metric.label}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
