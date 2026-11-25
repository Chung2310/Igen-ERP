import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  Info,
  Layers,
  MessageSquare,
  Pencil,
  Phone,
  Salad,
  Scale,
  Target,
  TrendingUp,
} from "lucide-react";
import { ErpModal } from "../../components/common/ErpModal";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import { analyzeInBody } from "./inbodyAnalytics";
import InBodyEvolution from "./InBodyEvolution";
import { dateLabel, Feedback, messageOf, primary, secondary } from "./ui";

export default function InBodyDetailModal({
  api,
  record,
  customer,
  historyRecords,
  canWrite,
  onClose,
  onEdit,
  onStatusChanged,
}: {
  api: GymApi;
  record: GymRecord;
  customer?: GymRecord;
  historyRecords?: GymRecord[];
  canWrite: boolean;
  onClose: () => void;
  onEdit?: (rec: GymRecord) => void;
  onStatusChanged?: (updated: GymRecord) => void;
}) {
  const [liveRecord, setLiveRecord] = useState<GymRecord>(record);
  const [customerGoal, setCustomerGoal] = useState<GymRecord | null>(null);
  const [loadedHistory, setLoadedHistory] = useState<GymRecord[]>(historyRecords || []);
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLiveRecord(record);
  }, [record]);

  useEffect(() => {
    if (historyRecords) setLoadedHistory(historyRecords);
  }, [historyRecords]);

  useEffect(() => {
    const cid = record.customerId;
    if (!cid) return;
    let active = true;
    api
      .request<GymList>(`/goals?customerId=${cid}&limit=5`, "GET")
      .then((res) => {
        if (active) setCustomerGoal(res.data?.[0] || null);
      })
      .catch(() => {
        if (active) setCustomerGoal(null);
      });

    if (!historyRecords) {
      api
        .request<GymList>(`/measurements?customerId=${cid}&limit=500`, "GET")
        .then((res) => {
          if (active) setLoadedHistory(res.data || []);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [api, record.customerId, historyRecords]);

  const sortedHistory = useMemo(
    () =>
      [...loadedHistory].sort((a, b) =>
        String(a.measurementDate || "").localeCompare(String(b.measurementDate || "")),
      ),
    [loadedHistory],
  );

  const previousRecord = useMemo(() => {
    const idx = sortedHistory.findIndex((r) => r._id === liveRecord._id);
    return idx > 0 ? sortedHistory[idx - 1] : null;
  }, [sortedHistory, liveRecord._id]);

  const customerMeta = useMemo(
    () => ({
      fullName: customer?.fullName,
      gender: customer?.gender,
      height: customer?.height,
      phone: customer?.phone,
    }),
    [customer],
  );

  const analysis = useMemo(
    () => analyzeInBody(liveRecord, previousRecord, customerMeta, customerGoal),
    [liveRecord, previousRecord, customerMeta, customerGoal],
  );

  const isPublished = liveRecord.status === "PUBLISHED";
  const sm = liveRecord.segmentalMuscle;
  const sf = liveRecord.segmentalFat;
  const hasSegmental = Boolean(
    sm?.rightArm ||
      sm?.leftArm ||
      sm?.trunk ||
      sm?.rightLeg ||
      sm?.leftLeg ||
      sf?.rightArm ||
      sf?.leftArm ||
      sf?.trunk ||
      sf?.rightLeg ||
      sf?.leftLeg,
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(analysis.quickMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Không thể sao chép tự động vào clipboard.");
    }
  };

  const handleTogglePublish = async () => {
    setToggling(true);
    setError("");
    const action = isPublished ? "unpublish" : "publish";
    try {
      const updated = await api.request<GymRecord>(
        `/measurements/${liveRecord._id}/${action}`,
        "PATCH",
        { revision: liveRecord.revision },
      );
      setLiveRecord(updated);
      onStatusChanged?.(updated);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setToggling(false);
    }
  };

  return (
    <ErpModal
      native
      title={`${customer?.fullName || "Học viên"} · Phân tích InBody & Tư vấn PT`}
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      <div className="max-h-[76dvh] space-y-4 overflow-y-auto pr-1">
        {/* Meta & Quick Copy */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
          <div className="flex flex-wrap items-center gap-2">
            <HrStatusBadge dot tone={isPublished ? "success" : "warning"}>
              {isPublished ? "Đã công bố" : "Bản nháp"}
            </HrStatusBadge>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Calendar className="size-3.5" aria-hidden="true" />
              Ngày đo: <strong className="text-on-surface">{dateLabel(liveRecord.measurementDate)}</strong>
            </span>
            {customer?.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" aria-hidden="true" />
                {customer.phone}
              </span>
            )}
          </div>
          <button type="button" className={secondary} onClick={() => void handleCopy()}>
            {copied ? (
              <Check className="size-3.5 text-change-up" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            {copied ? "Đã chép kịch bản" : "Sao chép tư vấn"}
          </button>
        </div>

        <Feedback error={error} />

        {/* Section 1: Score + Comparison */}
        <div className={cn("grid gap-3", liveRecord.inbodyScore != null ? "md:grid-cols-[200px_1fr]" : "grid-cols-1")}>
          {liveRecord.inbodyScore != null && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-change-up/30 bg-change-up/10 p-4 text-center">
              <span className="text-xs font-semibold uppercase text-change-up">
                Điểm InBody Score
              </span>
              <span className="mt-1 rounded-full bg-change-up px-2.5 py-0.5 text-[11px] font-semibold text-on-primary">
                {analysis.classifications.inbodyScore?.label || "Đạt chuẩn"}
              </span>
              <p className="mt-2 text-4xl font-bold tabular-nums text-change-up">
                {liveRecord.inbodyScore}
                <span className="text-sm font-medium text-on-surface-variant">/100</span>
              </p>
            </div>
          )}

          <div
            className={cn(
              "flex flex-col justify-center rounded-lg border p-4",
              analysis.comparison
                ? analysis.comparison.trendType === "EXCELLENT"
                  ? "border-change-up/30 bg-change-up/8"
                  : analysis.comparison.trendType === "NEEDS_ADJUSTMENT"
                    ? "border-error/30 bg-error-container/25"
                    : "border-primary/30 bg-primary/5"
                : "border-outline-variant bg-surface-container-low/50",
            )}
          >
            {analysis.comparison ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                  <TrendingUp className="size-4 text-primary" aria-hidden="true" />
                  <span>
                    So với lần đo ngày {dateLabel(previousRecord?.measurementDate)} (cách{" "}
                    {analysis.comparison.daysBetween} ngày)
                  </span>
                </div>
                <p className="text-xs font-semibold text-on-surface">{analysis.comparison.trendSummary}</p>
                <div className="flex flex-wrap gap-2 text-xs tabular-nums">
                  <span className="rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1">
                    Cân nặng: <strong>{previousRecord?.weight ?? "—"} → {liveRecord.weight} kg</strong>{" "}
                    <span className={analysis.comparison.deltaWeight <= 0 ? "font-semibold text-change-up" : "font-semibold text-tertiary"}>
                      ({analysis.comparison.deltaWeight > 0 ? `+${analysis.comparison.deltaWeight}` : analysis.comparison.deltaWeight} kg)
                    </span>
                  </span>
                  <span className="rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1">
                    % Mỡ: <strong>{previousRecord?.bodyFatPercentage ?? "—"}% → {liveRecord.bodyFatPercentage ?? "—"}%</strong>{" "}
                    <span className={analysis.comparison.deltaFatPercentage <= 0 ? "font-semibold text-change-up" : "font-semibold text-error"}>
                      ({analysis.comparison.deltaFatPercentage > 0 ? `+${analysis.comparison.deltaFatPercentage}` : analysis.comparison.deltaFatPercentage}%)
                    </span>
                  </span>
                  <span className="rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1">
                    Cơ xương: <strong>{previousRecord?.muscleMass ?? "—"} → {liveRecord.muscleMass ?? "—"} kg</strong>{" "}
                    <span className={analysis.comparison.deltaMuscleMass >= 0 ? "font-semibold text-change-up" : "font-semibold text-tertiary"}>
                      ({analysis.comparison.deltaMuscleMass > 0 ? `+${analysis.comparison.deltaMuscleMass}` : analysis.comparison.deltaMuscleMass} kg)
                    </span>
                  </span>
                  {previousRecord?.visceralFatLevel != null && liveRecord.visceralFatLevel != null && (
                    <span className="rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1">
                      Mỡ nội tạng: <strong>Lv {previousRecord.visceralFatLevel} → Lv {liveRecord.visceralFatLevel}</strong>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 text-xs">
                <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <strong className="block text-sm text-on-surface">Phiếu InBody khởi điểm (Baseline)</strong>
                  <p className="mt-0.5 text-on-surface-variant">
                    Đây là kết quả đo đầu tiên hoặc chưa có dữ liệu đối chiếu. Các lần đo tiếp theo sẽ tự động so sánh mức độ tiến bộ.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 1.5: Goal Alignment */}
        {analysis.goalAlignment && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3.5">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary">
                <Target className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-on-surface">
                    Mục tiêu đang theo đuổi: {analysis.goalAlignment.goal.title}
                  </strong>
                  <HrStatusBadge tone="info" className="normal-case">
                    {analysis.goalAlignment.goalTypeLabel}
                  </HrStatusBadge>
                </div>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {analysis.goalAlignment.statusSummary}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs tabular-nums">
              {analysis.goalAlignment.goal.deadline && (
                <div className="rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5">
                  <span className="block text-[10px] uppercase text-on-surface-variant">Hạn chót</span>
                  <strong className="text-on-surface">{dateLabel(analysis.goalAlignment.goal.deadline)}</strong>
                </div>
              )}
              {analysis.goalAlignment.goal.sessionsPerWeek && (
                <div className="rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5">
                  <span className="block text-[10px] uppercase text-on-surface-variant">Lịch tập</span>
                  <strong className="text-on-surface">{analysis.goalAlignment.goal.sessionsPerWeek} buổi/tuần</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 2: Body Composition Grid */}
        <section className="space-y-2">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface">
            <Scale className="size-4 text-primary" aria-hidden="true" />
            Phân tích thành phần cơ thể (Body Composition)
          </h3>
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
              <dt className="text-xs text-on-surface-variant">Cân nặng</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-primary">
                {liveRecord.weight} <span className="text-xs font-medium text-on-surface-variant">kg</span>
              </dd>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">
                {analysis.classifications.bmi
                  ? `BMI: ${liveRecord.bmi ?? "—"} (${analysis.classifications.bmi.label})`
                  : liveRecord.bmi != null
                    ? `BMI: ${liveRecord.bmi}`
                    : ""}
                {(liveRecord.height || customer?.height) ? ` · Cao ${liveRecord.height || customer?.height} cm` : ""}
              </p>
            </div>

            <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
              <dt className="text-xs text-on-surface-variant">Tỷ lệ mỡ (Body Fat %)</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-on-surface">
                {liveRecord.bodyFatPercentage ?? "—"}
                {liveRecord.bodyFatPercentage != null && <span className="text-xs font-medium text-on-surface-variant"> %</span>}
              </dd>
              {analysis.classifications.bodyFat && (
                <div className="mt-1">
                  <HrStatusBadge tone={analysis.classifications.bodyFat.tone} className="normal-case">
                    {analysis.classifications.bodyFat.label}
                  </HrStatusBadge>
                </div>
              )}
            </div>

            <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
              <dt className="text-xs text-on-surface-variant">Khối lượng cơ (SMM)</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-change-up">
                {liveRecord.muscleMass ?? "—"}{" "}
                {liveRecord.muscleMass != null && <span className="text-xs font-medium text-on-surface-variant">kg</span>}
              </dd>
              <p className="mt-0.5 text-[11px] text-on-surface-variant tabular-nums">
                {liveRecord.weight && liveRecord.muscleMass
                  ? `~${((liveRecord.muscleMass / liveRecord.weight) * 100).toFixed(1)}% cơ thể`
                  : "Cơ xương"}
              </p>
            </div>

            <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
              <dt className="text-xs text-on-surface-variant">Khối lượng mỡ (Fat Mass)</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-tertiary">
                {liveRecord.bodyFatMass != null
                  ? liveRecord.bodyFatMass
                  : liveRecord.weight && liveRecord.bodyFatPercentage
                    ? ((liveRecord.weight * liveRecord.bodyFatPercentage) / 100).toFixed(1)
                    : "—"}{" "}
                <span className="text-xs font-medium text-on-surface-variant">kg</span>
              </dd>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">Tổng lượng mỡ</p>
            </div>

            <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
              <dt className="text-xs text-on-surface-variant">Mỡ nội tạng (Visceral Fat)</dt>
              <dd className={cn("mt-1 text-xl font-bold tabular-nums", liveRecord.visceralFatLevel >= 10 ? "text-error" : "text-on-surface")}>
                Level {liveRecord.visceralFatLevel ?? "—"}
              </dd>
              {analysis.classifications.visceralFat && (
                <div className="mt-1">
                  <HrStatusBadge tone={analysis.classifications.visceralFat.tone} className="normal-case">
                    {analysis.classifications.visceralFat.label}
                  </HrStatusBadge>
                </div>
              )}
            </div>

            <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
              <dt className="text-xs text-on-surface-variant">Trao đổi chất (BMR)</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-primary">
                {liveRecord.bmr ?? "—"} <span className="text-xs font-medium text-on-surface-variant">kcal</span>
              </dd>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">Đốt thụ động / ngày</p>
            </div>

            {liveRecord.bodyWater != null && (
              <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
                <dt className="text-xs text-on-surface-variant">Tổng lượng nước (TBW)</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums text-primary">
                  {liveRecord.bodyWater} <span className="text-xs font-medium text-on-surface-variant">L</span>
                </dd>
                <p className="mt-0.5 text-[11px] text-on-surface-variant">Độ hydrat hóa</p>
              </div>
            )}

            {liveRecord.boneMineral != null && (
              <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
                <dt className="text-xs text-on-surface-variant">Khoáng chất xương (BMC)</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums text-change-up">
                  {liveRecord.boneMineral} <span className="text-xs font-medium text-on-surface-variant">kg</span>
                </dd>
                <p className="mt-0.5 text-[11px] text-on-surface-variant">Mật độ khoáng xương</p>
              </div>
            )}

            {liveRecord.waistHipRatio != null && (
              <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
                <dt className="text-xs text-on-surface-variant">Tỷ lệ eo / hông (WHR)</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums text-on-surface">{liveRecord.waistHipRatio}</dd>
                <p className="mt-0.5 text-[11px] text-on-surface-variant">Phân bố mỡ bụng</p>
              </div>
            )}
          </dl>
        </section>

        {/* Section 3: Segmental Muscle & Fat */}
        {hasSegmental && (
          <section className="space-y-2.5 rounded-lg border border-outline-variant bg-surface-container-low/40 p-3.5">
            <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface">
              <Layers className="size-4 text-primary" aria-hidden="true" />
              Phân tích cơ &amp; mỡ từng phần (Segmental Lean &amp; Fat)
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Tay phải", m: sm?.rightArm, f: sf?.rightArm },
                { label: "Tay trái", m: sm?.leftArm, f: sf?.leftArm },
                { label: "Thân mình", m: sm?.trunk, f: sf?.trunk },
                { label: "Chân phải", m: sm?.rightLeg, f: sf?.rightLeg },
                { label: "Chân trái", m: sm?.leftLeg, f: sf?.leftLeg },
              ].map((part) => (
                <div
                  key={part.label}
                  className="rounded-md border border-outline-variant bg-surface-container-lowest p-2.5 text-xs tabular-nums"
                >
                  <span className="block font-semibold text-on-surface-variant">{part.label}</span>
                  <span className="mt-1 block font-semibold text-change-up">
                    Cơ: {part.m != null ? `${part.m} kg` : "—"}
                  </span>
                  <span className="block font-medium text-tertiary">
                    Mỡ: {part.f != null ? `${part.f} kg` : "—"}
                  </span>
                </div>
              ))}
            </div>
            {(analysis.segmentalAnalysis.muscleImbalanceArm.hasImbalance ||
              analysis.segmentalAnalysis.muscleImbalanceLeg.hasImbalance) && (
              <div className="rounded-md border border-tertiary/40 bg-tertiary-container/30 p-2.5 text-xs text-on-surface">
                <strong>Lưu ý mất cân đối cơ:</strong>
                {analysis.segmentalAnalysis.muscleImbalanceArm.hasImbalance && (
                  <p>• {analysis.segmentalAnalysis.muscleImbalanceArm.note}</p>
                )}
                {analysis.segmentalAnalysis.muscleImbalanceLeg.hasImbalance && (
                  <p>• {analysis.segmentalAnalysis.muscleImbalanceLeg.note}</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Section 4: Strengths & Priorities */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-change-up/30 bg-change-up/8 p-3.5">
            <h4 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-change-up">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Điểm mạnh của học viên
            </h4>
            {analysis.strengths.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4 text-xs text-on-surface">
                {analysis.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-on-surface-variant">
                Thể trạng ở mức khởi đầu, sẵn sàng cho lộ trình rèn luyện mới.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-tertiary/30 bg-tertiary-container/25 p-3.5">
            <h4 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-tertiary">
              <Flame className="size-4" aria-hidden="true" />
              Điểm cần cải thiện &amp; ưu tiên
            </h4>
            {analysis.priorities.length > 0 && (
              <div className="mb-2 rounded-md border-l-4 border-l-tertiary bg-surface-container-lowest p-2.5 text-xs">
                <strong className="block text-[11px] uppercase text-tertiary">
                  Mục tiêu ưu tiên số 1:
                </strong>
                <p className="mt-0.5 font-semibold text-on-surface">{analysis.priorities[0]}</p>
              </div>
            )}
            {analysis.improvements.length > 0 && (
              <ul className="list-disc space-y-1 pl-4 text-xs text-on-surface">
                {analysis.improvements.map((imp, idx) => (
                  <li key={idx}>{imp}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Consultation notes */}
        {(liveRecord.consultationNotes || liveRecord.notes) && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 text-xs">
            <h4 className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <MessageSquare className="size-4" aria-hidden="true" />
              Tư vấn &amp; lời khuyên từ Huấn luyện viên
            </h4>
            <p className="whitespace-pre-line text-on-surface">
              {liveRecord.consultationNotes || liveRecord.notes}
            </p>
          </div>
        )}

        {/* Section 5: Health Alerts */}
        {analysis.alerts.length > 0 && (
          <section className="space-y-2">
            <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-error">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Cảnh báo chỉ số sức khỏe cần theo dõi sát
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "rounded-md border p-3 text-xs",
                    alert.level === "danger"
                      ? "border-error/40 bg-error-container/25 text-on-surface"
                      : "border-tertiary/40 bg-tertiary-container/30 text-on-surface",
                  )}
                >
                  <strong className="block font-semibold">{alert.title}</strong>
                  <p className="mt-0.5 text-on-surface-variant">{alert.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 6: Evolution Chart */}
        {sortedHistory.length >= 2 && <InBodyEvolution records={sortedHistory} />}

        {/* Section 7: PT Consultation Guide */}
        <section className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-low/40 p-3.5">
          <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface">
            <MessageSquare className="size-4 text-primary" aria-hidden="true" />
            Kịch bản &amp; hướng dẫn tư vấn chuyên sâu cho PT
          </h4>
          <ol className="space-y-1.5 rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
            {analysis.consultationGuide.talkingPoints.map((tp, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {idx + 1}
                </span>
                <span>{tp}</span>
              </li>
            ))}
          </ol>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-xs">
              <strong className="inline-flex items-center gap-1 text-change-up">
                <Salad className="size-3.5" aria-hidden="true" /> Định hướng dinh dưỡng
              </strong>
              <p className="mt-1 text-on-surface-variant">
                {analysis.consultationGuide.nutritionAdvice}
              </p>
            </div>
            <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-xs">
              <strong className="inline-flex items-center gap-1 text-primary">
                <Dumbbell className="size-3.5" aria-hidden="true" /> Định hướng tập luyện
              </strong>
              <p className="mt-1 text-on-surface-variant">
                {analysis.consultationGuide.workoutAdvice}
              </p>
              <p className="mt-1.5 rounded bg-primary/8 px-2 py-1 text-[11px] font-medium text-on-surface tabular-nums">
                Calo đề xuất: Giảm mỡ {analysis.consultationGuide.targetCaloriesRecommendation.fatLoss} kcal · Tăng cơ{" "}
                {analysis.consultationGuide.targetCaloriesRecommendation.muscleGain} kcal/ngày
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && onEdit && (
            <button
              type="button"
              className={secondary}
              onClick={() => {
                onClose();
                onEdit(liveRecord);
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Sửa chỉ số
            </button>
          )}
          {canWrite && (
            <button
              type="button"
              disabled={toggling}
              className={isPublished ? secondary : cn(primary, "min-h-9")}
              onClick={() => void handleTogglePublish()}
            >
              {isPublished ? (
                <EyeOff className="size-3.5" aria-hidden="true" />
              ) : (
                <Eye className="size-3.5" aria-hidden="true" />
              )}
              {toggling
                ? "Đang cập nhật..."
                : isPublished
                  ? "Thu hồi về bản nháp"
                  : "Công bố cho học viên"}
            </button>
          )}
        </div>
        <button type="button" className={secondary} onClick={onClose}>
          Đóng
        </button>
      </div>
    </ErpModal>
  );
}
