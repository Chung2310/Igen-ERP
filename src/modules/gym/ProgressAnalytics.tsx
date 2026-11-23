import { useMemo } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Dumbbell,
  HeartPulse,
  Minus,
  Repeat2,
  TimerReset,
} from "lucide-react";
import type { GymRecord } from "../../../shared/gym/types";
import { dateLabel } from "./ui";

const fmtNum = (val: number) =>
  val.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const fmtNullable = (val: number | null, unit: string) =>
  val === null ? "—" : `${fmtNum(val)} ${unit}`;

const fmtPace = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} /km`;
};

export function TrackingAnalyticsPanel({ sessions }: { sessions: GymRecord[] }) {
  const analytics = useMemo(() => {
    let totalVolumeKg = 0;
    let maxWeightKg: number | null = null;
    let maxStrengthReps: number | null = null;
    let estimated1RmKg: number | null = null;

    let bwTotalReps = 0;
    let bwMaxReps: number | null = null;
    let bwMaxAddedWeight: number | null = null;

    let cardioDuration = 0;
    let cardioDistance = 0;
    let bestPace: number | null = null;
    const heartRates: number[] = [];

    let intervalRounds = 0;
    let intervalWork = 0;
    let intervalRest = 0;

    let mobilityDuration = 0;
    let mobilityReps = 0;
    const discomforts: number[] = [];

    for (const session of sessions) {
      for (const ex of session.exerciseLogs || []) {
        const type = String(ex.trackingType || "STRENGTH").toUpperCase();
        const res = ex.result || {};
        const sets = Array.isArray(res.sets) ? res.sets : [];

        if (type === "STRENGTH") {
          for (const set of sets) {
            if (!set.completed) continue;
            const w = Number(set.weight || 0);
            const r = Number(set.reps || 0);
            if (w > 0 && r > 0) {
              totalVolumeKg += w * r;
              const est = Math.round(w * (1 + r / 30) * 10) / 10;
              estimated1RmKg =
                estimated1RmKg === null ? est : Math.max(estimated1RmKg, est);
            }
            if (w > 0)
              maxWeightKg = maxWeightKg === null ? w : Math.max(maxWeightKg, w);
            if (r > 0)
              maxStrengthReps =
                maxStrengthReps === null ? r : Math.max(maxStrengthReps, r);
          }
        } else if (type === "BODYWEIGHT") {
          for (const set of sets) {
            if (!set.completed) continue;
            const r = Number(set.reps || 0);
            const aw = Number(set.addedWeight || 0);
            if (r > 0) {
              bwTotalReps += r;
              bwMaxReps = bwMaxReps === null ? r : Math.max(bwMaxReps, r);
            }
            if (aw > 0)
              bwMaxAddedWeight =
                bwMaxAddedWeight === null ? aw : Math.max(bwMaxAddedWeight, aw);
          }
        } else if (type === "CARDIO") {
          const dur = Number(res.durationMinutes || 0);
          const dist = Number(res.distanceKm || 0);
          const hr = Number(res.averageHeartRate || 0);
          if (dur > 0) cardioDuration += dur;
          if (dist > 0) cardioDistance += dist;
          if (dur > 0 && dist > 0) {
            const pace = (dur * 60) / dist;
            bestPace = bestPace === null ? pace : Math.min(bestPace, pace);
          }
          if (hr > 0) heartRates.push(hr);
        } else if (type === "INTERVAL") {
          intervalRounds += Number(res.rounds || 0);
          intervalWork += Number(res.workSeconds || 0);
          intervalRest += Number(res.restSeconds || 0);
        } else if (type === "MOBILITY") {
          mobilityDuration += Number(res.durationMinutes || 0);
          mobilityReps += Number(res.completedReps || res.reps || 0);
          if (typeof res.discomfort === "number") discomforts.push(res.discomfort);
        }
      }
    }

    const avgHr = heartRates.length
      ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length)
      : null;
    const avgDiscomfort = discomforts.length
      ? Math.round(
          (discomforts.reduce((a, b) => a + b, 0) / discomforts.length) * 10,
        ) / 10
      : null;

    return [
      {
        key: "strength",
        title: "Sức mạnh",
        description: "Tạ và hiệu suất theo set",
        icon: Dumbbell,
        visible:
          totalVolumeKg > 0 ||
          maxWeightKg !== null ||
          maxStrengthReps !== null ||
          estimated1RmKg !== null,
        metrics: [
          { label: "Tổng volume", value: `${fmtNum(Math.round(totalVolumeKg))} kg` },
          { label: "Tạ cao nhất", value: fmtNullable(maxWeightKg, "kg") },
          { label: "Reps cao nhất", value: fmtNullable(maxStrengthReps, "reps") },
          { label: "Estimated 1RM", value: fmtNullable(estimated1RmKg, "kg") },
        ],
      },
      {
        key: "bodyweight",
        title: "Trọng lượng cơ thể",
        description: "Reps và mức tạ bổ sung",
        icon: Activity,
        visible:
          bwTotalReps > 0 || bwMaxReps !== null || bwMaxAddedWeight !== null,
        metrics: [
          { label: "Tổng reps", value: `${fmtNum(bwTotalReps)} reps` },
          { label: "Reps cao nhất", value: fmtNullable(bwMaxReps, "reps") },
          {
            label: "Tạ thêm cao nhất",
            value: fmtNullable(bwMaxAddedWeight, "kg"),
          },
        ],
      },
      {
        key: "cardio",
        title: "Cardio",
        description: "Thời lượng, quãng đường và nhịp tim",
        icon: HeartPulse,
        visible:
          cardioDuration > 0 ||
          cardioDistance > 0 ||
          bestPace !== null ||
          avgHr !== null,
        metrics: [
          { label: "Tổng thời lượng", value: `${fmtNum(cardioDuration)} phút` },
          { label: "Tổng quãng đường", value: `${fmtNum(cardioDistance)} km` },
          { label: "Pace tốt nhất", value: fmtPace(bestPace) },
          { label: "Nhịp tim trung bình", value: fmtNullable(avgHr, "bpm") },
        ],
      },
      {
        key: "interval",
        title: "Interval",
        description: "Vòng tập và thời gian làm/nghỉ",
        icon: TimerReset,
        visible: intervalRounds > 0 || intervalWork > 0 || intervalRest > 0,
        metrics: [
          { label: "Tổng số vòng", value: `${fmtNum(intervalRounds)} vòng` },
          { label: "Tổng thời gian làm", value: `${fmtNum(intervalWork)} giây` },
          { label: "Tổng thời gian nghỉ", value: `${fmtNum(intervalRest)} giây` },
        ],
      },
      {
        key: "mobility",
        title: "Mobility",
        description: "Thời lượng, số lần và mức khó chịu",
        icon: Repeat2,
        visible:
          mobilityDuration > 0 || mobilityReps > 0 || avgDiscomfort !== null,
        metrics: [
          { label: "Tổng thời lượng", value: `${fmtNum(mobilityDuration)} phút` },
          { label: "Tổng số lần", value: `${fmtNum(mobilityReps)} reps` },
          {
            label: "Khó chịu trung bình",
            value: avgDiscomfort === null ? "—" : `${fmtNum(avgDiscomfort)}/10`,
          },
        ],
      },
    ].filter((s) => s.visible);
  }, [sessions]);

  if (analytics.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Phân tích hiệu suất tập luyện">
      <div>
        <h3 className="text-sm font-semibold text-on-surface">
          Phân tích hiệu suất theo loại bài tập
        </h3>
        <p className="text-xs text-on-surface-variant">
          Mỗi nhóm bài chỉ hiển thị các chỉ số phù hợp, không trộn lẫn đơn vị.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {analytics.map(({ key, title, description, icon: Icon, metrics }) => (
          <article
            key={key}
            className="rounded-md border border-outline-variant bg-surface-container-lowest p-4"
          >
            <div className="flex items-start gap-2.5">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h4 className="text-sm font-semibold text-on-surface">{title}</h4>
                <p className="text-xs text-on-surface-variant">{description}</p>
              </div>
            </div>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-md border border-outline-variant/60 bg-surface-container-low/50 px-3 py-2"
                >
                  <dt className="text-[11px] text-on-surface-variant">
                    {metric.label}
                  </dt>
                  <dd className="mt-0.5 text-base font-bold tabular-nums text-on-surface">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

const CHART_CONFIGS = [
  { key: "weight", label: "Cân nặng", unit: "kg" },
  { key: "bodyFatPercentage", label: "Tỷ lệ mỡ", unit: "%" },
  { key: "muscleMass", label: "Khối lượng cơ", unit: "kg" },
  { key: "chest", label: "Vòng ngực", unit: "cm" },
  { key: "waist", label: "Vòng eo", unit: "cm" },
  { key: "hip", label: "Vòng hông", unit: "cm" },
  { key: "arm", label: "Vòng tay", unit: "cm" },
  { key: "thigh", label: "Vòng đùi", unit: "cm" },
  { key: "calf", label: "Bắp chân", unit: "cm" },
] as const;

export function ProgressBodyCharts({
  measurements,
  sessions,
}: {
  measurements: GymRecord[];
  sessions: GymRecord[];
}) {
  const combined = useMemo(() => {
    const rows: Array<{ id: string; date: string; data: Record<string, number | undefined> }> = [];
    for (const m of measurements) {
      rows.push({
        id: `m-${m._id}`,
        date: String(m.measurementDate || m.createdAt || ""),
        data: {
          weight: typeof m.weight === "number" ? m.weight : undefined,
          bodyFatPercentage:
            typeof m.bodyFatPercentage === "number" ? m.bodyFatPercentage : undefined,
          muscleMass: typeof m.muscleMass === "number" ? m.muscleMass : undefined,
          chest: typeof m.chest === "number" ? m.chest : undefined,
          waist: typeof m.waist === "number" ? m.waist : undefined,
          hip: typeof m.hip === "number" ? m.hip : undefined,
        },
      });
    }
    for (const s of sessions) {
      const bm = s.bodyMeasurement;
      if (!bm) continue;
      rows.push({
        id: `s-${s._id}`,
        date: String(s.performedAt || s.createdAt || ""),
        data: {
          weight: typeof bm.weight === "number" ? bm.weight : undefined,
          bodyFatPercentage:
            typeof bm.bodyFatPercentage === "number" ? bm.bodyFatPercentage : undefined,
          muscleMass: typeof bm.muscleMass === "number" ? bm.muscleMass : undefined,
          chest: typeof bm.chest === "number" ? bm.chest : undefined,
          waist: typeof bm.waist === "number" ? bm.waist : undefined,
          hip: typeof bm.hips === "number" ? bm.hips : typeof bm.hip === "number" ? bm.hip : undefined,
          arm: typeof bm.arm === "number" ? bm.arm : undefined,
          thigh: typeof bm.thigh === "number" ? bm.thigh : undefined,
          calf: typeof bm.calf === "number" ? bm.calf : undefined,
        },
      });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [measurements, sessions]);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {CHART_CONFIGS.map((cfg) => {
        const values = combined
          .map((row) => ({ id: row.id, date: row.date, value: row.data[cfg.key] }))
          .filter((item): item is { id: string; date: string; value: number } => typeof item.value === "number");

        if (values.length === 0) {
          return (
            <article
              key={cfg.key}
              className="rounded-md border border-outline-variant bg-surface-container-lowest p-3"
            >
              <h4 className="text-xs font-semibold text-on-surface">{cfg.label}</h4>
              <p className="py-5 text-center text-xs text-on-surface-variant">Chưa có dữ liệu</p>
            </article>
          );
        }

        if (values.length === 1) {
          return (
            <article
              key={cfg.key}
              className="rounded-md border border-outline-variant bg-surface-container-lowest p-3"
            >
              <h4 className="text-xs font-semibold text-on-surface">{cfg.label}</h4>
              <div className="py-4 text-center">
                <p className="text-xl font-bold tabular-nums text-primary">
                  {fmtNum(values[0].value)} {cfg.unit}
                </p>
                <p className="mt-0.5 text-[11px] text-on-surface-variant">
                  Mốc ngày {dateLabel(values[0].date)}
                </p>
              </div>
            </article>
          );
        }

        const nums = values.map((v) => v.value);
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const span = max - min || 1;
        const coords = values.map((item, idx) => ({
          ...item,
          x: 20 + idx * (260 / (values.length - 1)),
          y: 105 - ((item.value - min) / span) * 75,
        }));
        const delta = Math.round((nums[nums.length - 1] - nums[0]) * 10) / 10;

        return (
          <article
            key={cfg.key}
            className="rounded-md border border-outline-variant bg-surface-container-lowest p-3"
          >
            <div className="flex items-center justify-between text-xs">
              <h4 className="font-semibold text-on-surface">{cfg.label}</h4>
              <span className="font-semibold tabular-nums text-primary">
                {fmtNum(nums[nums.length - 1])} {cfg.unit}{" "}
                <span className="text-[11px] text-on-surface-variant">
                  ({delta > 0 ? `+${delta}` : delta})
                </span>
              </span>
            </div>
            <svg
              className="mt-2 h-32 w-full text-primary"
              role="img"
              aria-label={`Biểu đồ ${cfg.label}`}
              viewBox="0 0 300 125"
            >
              <polyline
                points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {coords.map((c) => (
                <circle key={c.id} cx={c.x} cy={c.y} r="4" fill="currentColor">
                  <title>
                    {dateLabel(c.date)}: {c.value} {cfg.unit}
                  </title>
                </circle>
              ))}
            </svg>
          </article>
        );
      })}
    </div>
  );
}

export function WorkoutSessionComparison({ sessions }: { sessions: GymRecord[] }) {
  const comparison = useMemo(() => {
    if (sessions.length < 2) return null;
    const sorted = [...sessions].sort((a, b) =>
      String(b.performedAt || "").localeCompare(String(a.performedAt || "")),
    );
    const latest = sorted[0];
    const previous = sorted[1];

    const extractStats = (ex: GymRecord) => {
      const sets = Array.isArray(ex.result?.sets) ? ex.result.sets : [];
      const completed = sets.filter((s: any) => s.completed);
      const maxWeight = completed.reduce(
        (m: number, s: any) => Math.max(m, Number(s.weight || 0)),
        0,
      );
      const volume = completed.reduce(
        (sum: number, s: any) =>
          sum + Number(s.weight || s.addedWeight || 0) * Number(s.reps || 0),
        0,
      );
      const totalReps = completed.reduce(
        (sum: number, s: any) => sum + Number(s.reps || 0),
        0,
      );
      return { maxWeight, volume, totalReps };
    };

    const prevMap = new Map<string, { name: string; stats: ReturnType<typeof extractStats> }>();
    for (const ex of previous.exerciseLogs || []) {
      const k = String(ex.exerciseId || ex.name || "").toLowerCase();
      if (k) prevMap.set(k, { name: ex.name, stats: extractStats(ex) });
    }

    const matched: Array<{
      name: string;
      metrics: Array<{ label: string; prev: number; curr: number; unit: string; delta: number }>;
    }> = [];

    for (const ex of latest.exerciseLogs || []) {
      const k = String(ex.exerciseId || ex.name || "").toLowerCase();
      const prevEntry = prevMap.get(k);
      if (!prevEntry) continue;
      const currStats = extractStats(ex);
      const metrics: Array<{ label: string; prev: number; curr: number; unit: string; delta: number }> = [];
      if (prevEntry.stats.maxWeight > 0 || currStats.maxWeight > 0) {
        metrics.push({
          label: "Tạ cao nhất",
          prev: prevEntry.stats.maxWeight,
          curr: currStats.maxWeight,
          unit: "kg",
          delta: Math.round((currStats.maxWeight - prevEntry.stats.maxWeight) * 10) / 10,
        });
      }
      if (prevEntry.stats.volume > 0 || currStats.volume > 0) {
        metrics.push({
          label: "Tổng volume",
          prev: Math.round(prevEntry.stats.volume),
          curr: Math.round(currStats.volume),
          unit: "kg",
          delta: Math.round(currStats.volume - prevEntry.stats.volume),
        });
      }
      if (metrics.length === 0 && (prevEntry.stats.totalReps > 0 || currStats.totalReps > 0)) {
        metrics.push({
          label: "Tổng reps",
          prev: prevEntry.stats.totalReps,
          curr: currStats.totalReps,
          unit: "reps",
          delta: currStats.totalReps - prevEntry.stats.totalReps,
        });
      }
      if (metrics.length > 0) matched.push({ name: ex.name, metrics });
    }

    return {
      latestDate: latest.performedAt,
      previousDate: previous.performedAt,
      matched,
    };
  }, [sessions]);

  if (!comparison) return null;

  return (
    <section
      aria-label="So sánh với buổi tập trước"
      className="space-y-2.5 rounded-md border border-primary/30 bg-primary/5 p-3.5"
    >
      <div>
        <h4 className="text-sm font-semibold text-on-surface">
          So sánh buổi gần nhất ({dateLabel(comparison.latestDate)}) với buổi trước ({dateLabel(comparison.previousDate)})
        </h4>
        <p className="text-xs text-on-surface-variant">
          Chỉ đối chiếu các bài tập trùng nhau giữa hai buổi tập.
        </p>
      </div>
      {comparison.matched.length === 0 ? (
        <p className="rounded-md bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
          Chưa có bài tập trùng nhau giữa hai buổi gần nhất để so sánh.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {comparison.matched.map((item) => (
            <article
              key={item.name}
              className="rounded-md border border-outline-variant bg-surface-container-lowest p-3"
            >
              <h5 className="text-xs font-semibold text-on-surface">{item.name}</h5>
              <div className="mt-2 space-y-1.5 text-xs tabular-nums">
                {item.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="flex flex-wrap items-center justify-between gap-2 rounded bg-surface-container-low/60 px-2.5 py-1.5"
                  >
                    <span className="text-on-surface-variant">
                      {m.label}: <strong className="text-on-surface">{fmtNum(m.prev)} → {fmtNum(m.curr)} {m.unit}</strong>
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        m.delta > 0 ? "text-change-up" : m.delta < 0 ? "text-error" : "text-on-surface-variant"
                      }`}
                    >
                      {m.delta > 0 ? (
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      ) : m.delta < 0 ? (
                        <ArrowDownRight className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Minus className="size-3.5" aria-hidden="true" />
                      )}
                      {m.delta > 0 ? `+${fmtNum(m.delta)}` : fmtNum(m.delta)} {m.unit}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
