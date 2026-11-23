import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Camera,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Flame,
  HeartPulse,
  History,
  Mail,
  MessageSquare,
  Package,
  Pencil,
  Phone,
  Plus,
  Ruler,
  Salad,
  Scale,
  Target,
  User,
  Utensils,
} from "lucide-react";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import { ErpModal } from "../../components/common/ErpModal";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import {
  CustomerPicker,
  dateLabel,
  Feedback,
  FormDialog,
  GymAvatar,
  GymEmptyState,
  primary,
  secondary,
  useGymQuery,
} from "./ui";
import CustomerForm from "./CustomerForm";
import Consultations from "./Consultations";
import CustomerPackages from "./CustomerPackages";
import CustomerPhotoManager from "./CustomerPhotoManager";
import { CustomerTodayNutritionModal } from "./CustomerTodayNutritionModal";
import InBodyDetailModal from "./InBodyDetailModal";
import RecordEditor from "./RecordEditor";
import SessionDetail from "./SessionDetail";
import WorkoutStudio from "./WorkoutStudio";

export function AssignPlan({
  api,
  template,
  onClose,
  customerId,
}: {
  api: GymApi;
  template?: GymRecord;
  customerId?: string;
  onClose: () => void;
}) {
  const [customer, setCustomer] = useState(customerId || "");
  const [templateId, setTemplate] = useState(template?._id || "");
  const templates = useGymQuery<GymList>(api, "/workout-templates?limit=100");
  const templateOptions = (template ? [template] : templates.data?.data || []).filter(
    (item) => item.status !== "ARCHIVED",
  );
  return (
    <FormDialog
      title="Giao giáo án"
      submitLabel="Giao giáo án"
      maxWidth="max-w-lg"
      onClose={onClose}
      onSubmit={async () => {
        if (!customer || !templateId)
          throw new Error("Vui lòng chọn học viên và giáo án.");
        await api.request("/assign-plan", "POST", {
          customerId: customer,
          templateId,
        });
        onClose();
      }}
    >
      {!customerId && (
        <CustomerPicker api={api} value={customer} onChange={setCustomer} />
      )}
      <div className="space-y-2">
        <p className="text-sm font-medium text-on-surface">Chọn giáo án mẫu</p>
        <p className="text-xs text-on-surface-variant">
          Một bản sao của giáo án sẽ được giao cho khách hàng.
        </p>
        <Feedback loading={templates.loading} error={templates.error} />
        {!templates.loading && !templates.error && templateOptions.length === 0 && (
          <div className="rounded-md border border-dashed border-outline-variant">
            <GymEmptyState kind="training" title="Chưa có giáo án mẫu." />
          </div>
        )}
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {templateOptions.map((item) => (
            <button
              key={item._id}
              type="button"
              aria-pressed={templateId === item._id}
              disabled={Boolean(template)}
              onClick={() => setTemplate(item._id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                templateId === item._id
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant hover:border-primary/50",
              )}
            >
              <span className="min-w-0">
                <strong className="block truncate font-semibold text-on-surface">
                  {item.title}
                </strong>
                <span className="text-xs text-on-surface-variant">
                  {item.goal || item.description || "Giáo án mẫu"}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-primary">
                {item.durationWeeks} tuần
              </span>
            </button>
          ))}
        </div>
      </div>
    </FormDialog>
  );
}

const customerStatusMeta: Record<
  string,
  { label: string; tone: "success" | "warning" | "neutral" }
> = {
  ACTIVE: { label: "Đang hoạt động", tone: "success" },
  LEAD: { label: "Tiềm năng", tone: "warning" },
  INACTIVE: { label: "Ngừng hoạt động", tone: "neutral" },
};

const attendanceMeta: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  PRESENT: { label: "Có mặt", tone: "success" },
  LATE: { label: "Đi muộn", tone: "warning" },
  ABSENT: { label: "Vắng mặt", tone: "danger" },
};

type DetailTab =
  | "profile"
  | "packages"
  | "consultations"
  | "photos"
  | "workout-plans"
  | "nutrition-plans"
  | "sessions"
  | "measurements";

export default function CustomerDetail({
  api,
  record,
  onClose,
  canWrite,
  onNavigateNutrition,
}: {
  api: GymApi;
  record: GymRecord;
  onClose: () => void;
  canWrite: boolean;
  onNavigateNutrition?: (customerId: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("profile");
  const [assign, setAssign] = useState(false);
  const [editing, setEditing] = useState(false);
  const [studioPlan, setStudioPlan] = useState<{ plan: GymRecord; readOnly?: boolean }>();
  const [showPhotoManager, setShowPhotoManager] = useState(false);
  const [todayNutritionPlan, setTodayNutritionPlan] = useState<GymRecord | null>(null);
  const [selectedInbody, setSelectedInbody] = useState<GymRecord | null>(null);
  const [editingInbody, setEditingInbody] = useState<GymRecord | "new" | null>(null);
  const [viewingSession, setViewingSession] = useState<GymRecord | null>(null);
  const [refresh, setRefresh] = useState(0);

  const liveCustomerQuery = useGymQuery<GymRecord>(
    api,
    `/customers/${record._id}`,
    refresh,
  );
  const currentRecord = liveCustomerQuery.data || record;
  const statusInfo = customerStatusMeta[currentRecord.status] || {
    label: currentRecord.status || "—",
    tone: "neutral" as const,
  };

  const packagesQuery = useGymQuery<GymList>(
    api,
    `/packages?customerId=${record._id}&limit=50`,
    refresh,
  );
  const photosQuery = useGymQuery<GymList>(
    api,
    `/progress-photos?customerId=${record._id}&limit=100`,
    refresh,
  );
  const sessionsQuery = useGymQuery<GymList>(
    api,
    `/sessions?customerId=${record._id}&limit=50`,
    refresh,
  );
  const workoutPlansQuery = useGymQuery<GymList>(
    api,
    `/workout-plans?customerId=${record._id}&limit=100`,
    refresh,
  );
  const plansQuery = useGymQuery<GymList>(
    api,
    `/nutrition-plans?customerId=${record._id}&limit=50`,
    refresh,
  );
  const inbodyQuery = useGymQuery<GymList>(
    api,
    `/measurements?customerId=${record._id}&limit=100`,
    refresh,
  );

  const activePackage = (packagesQuery.data?.data || []).find(
    (p) => p.status === "ACTIVE",
  );
  const sessionList = sessionsQuery.data?.data || [];
  const lastSession = sessionList[0]?.performedAt;
  const consultationCount = Array.isArray(currentRecord.consultations)
    ? currentRecord.consultations.length
    : 0;
  const photoList = photosQuery.data?.data || [];
  const allNutritionPlans = plansQuery.data?.data || [];
  const publishedNutritionPlans = useMemo(
    () => allNutritionPlans.filter((p) => p.status === "PUBLISHED"),
    [allNutritionPlans],
  );
  const inbodyList = inbodyQuery.data?.data || [];

  const genderLabel =
    currentRecord.gender === "MALE"
      ? "Nam"
      : currentRecord.gender === "FEMALE"
        ? "Nữ"
        : currentRecord.gender === "OTHER"
          ? "Khác"
          : "";

  const detailTabs = [
    { key: "profile", label: "Tổng quan & Hồ sơ", icon: User, count: null },
    {
      key: "packages",
      label: "Gói tập PT",
      icon: Package,
      count: packagesQuery.data?.meta.total ?? null,
    },
    {
      key: "consultations",
      label: "Lịch sử tư vấn",
      icon: MessageSquare,
      count: consultationCount || null,
    },
    {
      key: "photos",
      label: "Ảnh Before / After",
      icon: Camera,
      count: photosQuery.data?.meta.total ?? null,
    },
    {
      key: "workout-plans",
      label: "Giáo án",
      icon: ClipboardList,
      count: null,
    },
    {
      key: "nutrition-plans",
      label: "Thực đơn Dinh dưỡng",
      icon: Salad,
      count: allNutritionPlans.length || null,
    },
    {
      key: "sessions",
      label: "Lịch sử tập luyện",
      icon: Dumbbell,
      count: sessionsQuery.data?.meta.total ?? null,
    },
    {
      key: "measurements",
      label: "InBody & Số đo",
      icon: Ruler,
      count: inbodyQuery.data?.meta.total ?? null,
    },
  ] as const;

  if (studioPlan) {
    return (
      <WorkoutStudio
        api={api}
        record={studioPlan.plan}
        customerId={record._id}
        readOnly={studioPlan.readOnly}
        onBack={() => setStudioPlan(undefined)}
        onSaved={() => {
          setStudioPlan(undefined);
          setRefresh((value) => value + 1);
        }}
      />
    );
  }

  return (
    <section className="space-y-3">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3.5 shadow-2xs">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className={secondary} onClick={onClose}>
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Quay lại
          </button>
          <GymAvatar name={currentRecord.fullName} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                data-typography="page-title"
                className="truncate text-lg font-semibold text-on-surface"
              >
                {currentRecord.fullName}
              </h2>
              <HrStatusBadge dot tone={statusInfo.tone}>
                {statusInfo.label}
              </HrStatusBadge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
              {currentRecord.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" aria-hidden="true" />
                  {currentRecord.phone}
                </span>
              )}
              {currentRecord.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3" aria-hidden="true" />
                  {currentRecord.email}
                </span>
              )}
              {genderLabel && (
                <span className="font-medium text-primary">{genderLabel}</span>
              )}
              {currentRecord.height != null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Ruler className="size-3" aria-hidden="true" />
                  {currentRecord.height} cm
                </span>
              )}
              {currentRecord.initialWeight != null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Scale className="size-3" aria-hidden="true" />
                  {currentRecord.initialWeight} kg
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <button
              type="button"
              className={secondary}
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Sửa thông tin
            </button>
          )}
        </div>
      </div>

      {/* 8 Sub-tabs matching 3S CustomerDetailModal */}
      <nav
        aria-label="Hồ sơ học viên"
        className="flex gap-1 overflow-x-auto border-b border-outline-variant"
      >
        {detailTabs.map(({ key, label, icon: Icon, count }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                active
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent font-medium text-on-surface-variant hover:border-outline-variant hover:text-on-surface",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span>{label}</span>
              {count != null && count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[11px] font-semibold tabular-nums",
                    active
                      ? "bg-primary/15 text-primary"
                      : "bg-surface-container text-on-surface-variant",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* TAB 1: OVERVIEW */}
      {tab === "profile" && (
        <div className="space-y-3">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
              <dt className="text-xs text-on-surface-variant">Gói tập hiện tại</dt>
              <dd className="mt-1 truncate text-base font-semibold text-on-surface">
                {activePackage ? activePackage.name : "Chưa có gói hoạt động"}
              </dd>
              <p className="mt-0.5 text-xs tabular-nums text-change-up">
                {activePackage
                  ? `Còn ${Math.max(0, (activePackage.totalSessions || 0) - (activePackage.usedSessions || 0))}/${activePackage.totalSessions || 0} buổi`
                  : "Chưa gán gói PT"}
              </p>
            </div>
            <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
              <dt className="text-xs text-on-surface-variant">
                Chiều cao &amp; Cân nặng
              </dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-on-surface">
                {currentRecord.height != null ? `${currentRecord.height} cm` : "—"} ·{" "}
                {currentRecord.initialWeight != null
                  ? `${currentRecord.initialWeight} kg`
                  : "—"}
              </dd>
              <p className="mt-0.5 text-xs tabular-nums text-on-surface-variant">
                BMI ban đầu:{" "}
                {currentRecord.height && currentRecord.initialWeight
                  ? (
                      currentRecord.initialWeight /
                      Math.pow(currentRecord.height / 100, 2)
                    ).toFixed(1)
                  : "—"}
              </p>
            </div>
            <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
              <dt className="text-xs text-on-surface-variant">Tổng buổi đã tập</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-on-surface">
                {sessionsQuery.data?.meta.total ?? sessionList.length} buổi tập
              </dd>
              <p className="mt-0.5 text-xs tabular-nums text-primary">
                Lần gần nhất: {lastSession ? dateLabel(lastSession) : "—"}
              </p>
            </div>
          </dl>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
              <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                <Target className="size-4 text-primary" aria-hidden="true" />
                Mục tiêu tập luyện
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-pretty text-sm text-on-surface-variant">
                {currentRecord.initialGoal || "Chưa thiết lập mục tiêu ban đầu."}
              </p>
            </div>
            <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
              <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                <HeartPulse className="size-4 text-error" aria-hidden="true" />
                Lưu ý sức khỏe &amp; Bệnh lý
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-pretty text-sm text-on-surface-variant">
                {currentRecord.medicalNotes ||
                  "Không có tiền sử bệnh lý hoặc chấn thương đặc biệt."}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-tertiary/30 bg-tertiary-container/35 p-4">
            <h3 className="text-sm font-semibold text-on-tertiary-container">
              Ghi chú nội bộ của PT
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-pretty text-sm text-on-surface">
              {currentRecord.internalNotes || "Chưa có ghi chú nội bộ."}
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: PACKAGES */}
      {tab === "packages" && (
        <CustomerPackages
          api={api}
          customerId={record._id}
          canWrite={canWrite}
          onChanged={() => setRefresh((value) => value + 1)}
        />
      )}

      {/* TAB 3: CONSULTATIONS */}
      {tab === "consultations" && (
        <Consultations
          api={api}
          customerId={record._id}
          canWrite={canWrite}
        />
      )}

      {/* TAB 4: PHOTOS BEFORE / AFTER */}
      {tab === "photos" && (
        <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-on-surface">
              Ảnh Before / After ({photoList.length})
            </h3>
            <button
              type="button"
              className={cn(primary, "min-h-9")}
              onClick={() => setShowPhotoManager(true)}
            >
              <Camera className="size-4" aria-hidden="true" />
              Quản lý &amp; So sánh Before/After
            </button>
          </div>

          <Feedback loading={photosQuery.loading} error={photosQuery.error} />

          {!photosQuery.loading && photoList.length === 0 ? (
            <div className="rounded-md border border-dashed border-outline-variant py-8 text-center">
              <Camera
                className="mx-auto mb-2 size-9 text-on-surface-variant/60"
                aria-hidden="true"
              />
              <p className="text-sm text-on-surface-variant">
                Chưa có ảnh tiến độ Before / After.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {photoList.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => setShowPhotoManager(true)}
                  className="cursor-pointer overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest text-left transition-colors hover:border-primary/50"
                >
                  <div className="relative h-44 bg-surface-container">
                    <img
                      src={item.photoUrl}
                      alt={item.stage}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                    <span className="absolute left-2 top-2">
                      <HrStatusBadge
                        tone={
                          item.stage === "BEFORE"
                            ? "info"
                            : item.stage === "AFTER"
                              ? "success"
                              : "violet"
                        }
                      >
                        {item.stage}
                      </HrStatusBadge>
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs tabular-nums text-on-surface-variant">
                    <span>{dateLabel(item.takenDate)}</span>
                    {item.weight != null && (
                      <strong className="text-on-surface">{item.weight} kg</strong>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: WORKOUT PLANS */}
      {tab === "workout-plans" && (
        <div className="space-y-3">
          <Feedback
            loading={workoutPlansQuery.loading}
            error={workoutPlansQuery.error}
          />
          {!workoutPlansQuery.loading &&
            !workoutPlansQuery.error &&
            (() => {
              const plans = [...(workoutPlansQuery.data?.data || [])].sort(
                (a, b) =>
                  String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
              );
              const currentPlan =
                plans.find((plan) => plan.status === "ACTIVE") || plans[0];
              const otherPlans = plans.filter(
                (plan) => plan._id !== currentPlan?._id,
              );
              return currentPlan ? (
                <>
                  <section className="rounded-md border border-primary/30 bg-surface-container-lowest p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-primary">
                          Giáo án đang áp dụng
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-on-surface">
                          {currentPlan.title}
                        </h3>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {currentPlan.level || "Cơ bản"} ·{" "}
                          {currentPlan.durationDays ||
                            (currentPlan.durationWeeks || 4) * 7}{" "}
                          ngày · Gán cho {currentRecord.fullName}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canWrite && (
                          <button
                            type="button"
                            className={secondary}
                            onClick={() => setAssign(true)}
                          >
                            Thay giáo án
                          </button>
                        )}
                        <button
                          type="button"
                          className={cn(primary, "min-h-9")}
                          onClick={() =>
                            setStudioPlan({ plan: currentPlan, readOnly: !canWrite })
                          }
                        >
                          Mở Studio
                        </button>
                      </div>
                    </div>
                  </section>
                  {otherPlans.length > 0 && (
                    <section className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-surface">
                        <History className="size-4 text-primary" aria-hidden="true" />
                        Lịch sử giáo án
                      </h3>
                      <div className="space-y-2">
                        {otherPlans.map((plan) => (
                          <div
                            key={plan._id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-container-low p-3"
                          >
                            <div>
                              <strong className="block text-sm font-medium text-on-surface">
                                {plan.title}
                              </strong>
                              <span className="text-xs text-on-surface-variant">
                                {plan.durationDays || (plan.durationWeeks || 4) * 7}{" "}
                                ngày · Đã lưu trữ · {dateLabel(plan.createdAt)}
                              </span>
                            </div>
                            <button
                              type="button"
                              className={secondary}
                              onClick={() =>
                                setStudioPlan({ plan, readOnly: true })
                              }
                            >
                              Xem
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <section className="flex flex-col items-center rounded-md border border-dashed border-outline-variant bg-surface-container-lowest px-4 py-10 text-center">
                  <Dumbbell
                    className="size-9 text-on-surface-variant/60"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 text-sm font-semibold text-on-surface">
                    Khách hàng chưa có giáo án
                  </h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Gán một giáo án mẫu để bắt đầu cá nhân hóa.
                  </p>
                  {canWrite && (
                    <button
                      type="button"
                      className={cn(primary, "mt-4 min-h-9")}
                      onClick={() => setAssign(true)}
                    >
                      Gán giáo án
                    </button>
                  )}
                </section>
              );
            })()}
        </div>
      )}

      {/* TAB 6: NUTRITION PLANS — EXACT 3S PARITY */}
      {tab === "nutrition-plans" && (
        <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-on-surface">
              Kế hoạch Thực đơn Dinh dưỡng ({publishedNutritionPlans.length})
            </h3>
            {publishedNutritionPlans.length > 0 && (
              <button
                type="button"
                className={cn(primary, "min-h-9")}
                onClick={() => setTodayNutritionPlan(publishedNutritionPlans[0])}
              >
                <Utensils className="size-4" aria-hidden="true" />
                Xem Hôm Nay Ăn Gì
              </button>
            )}
          </div>

          <Feedback loading={plansQuery.loading} error={plansQuery.error} />

          {!plansQuery.loading && publishedNutritionPlans.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low/30 px-4 py-10 text-center">
              <Salad
                className="mb-3 size-10 text-on-surface-variant/60"
                aria-hidden="true"
              />
              <p className="mb-4 text-sm text-on-surface-variant">
                Học viên chưa có thực đơn dinh dưỡng nào được công bố áp dụng.
              </p>
              {canWrite && (
                <button
                  type="button"
                  className={cn(primary, "min-h-9 px-4")}
                  onClick={() => {
                    if (onNavigateNutrition) {
                      onNavigateNutrition(record._id);
                    } else {
                      onClose();
                    }
                  }}
                >
                  Thiết kế thực đơn ngay
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {publishedNutritionPlans.map((plan) => (
                <article
                  key={plan._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 transition-colors hover:border-primary/50"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-semibold text-on-surface">
                        {plan.title || "Thực đơn Dinh dưỡng"}
                      </strong>
                      <HrStatusBadge tone="success" className="normal-case">
                        Đã công bố
                      </HrStatusBadge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 text-xs tabular-nums">
                      {plan.targetCalories != null && (
                        <span className="inline-flex items-center gap-1 font-semibold text-error">
                          <Flame className="size-3.5" aria-hidden="true" />
                          {Number(plan.targetCalories).toLocaleString("vi-VN")} kcal/ngày
                        </span>
                      )}
                      {plan.macros && (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                            Protein: {plan.macros.protein ?? 0}g
                          </span>
                          <span className="rounded bg-tertiary-container/60 px-2 py-0.5 font-semibold text-on-tertiary-container">
                            Carbs: {plan.macros.carbs ?? 0}g
                          </span>
                          <span className="rounded bg-error-container/50 px-2 py-0.5 font-semibold text-error">
                            Fat: {plan.macros.fat ?? 0}g
                          </span>
                        </span>
                      )}
                      <span className="text-on-surface-variant">
                        Tạo: {dateLabel(plan.createdAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={cn(primary, "min-h-9")}
                    onClick={() => setTodayNutritionPlan(plan)}
                  >
                    <Utensils className="size-3.5" aria-hidden="true" />
                    Xem Hôm Nay Ăn Gì
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: WORKOUT SESSIONS HISTORY */}
      {tab === "sessions" && (
        <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4">
          <h3 className="text-base font-semibold text-on-surface">
            Lịch sử tập luyện ({sessionList.length} buổi)
          </h3>
          <Feedback loading={sessionsQuery.loading} error={sessionsQuery.error} />
          {!sessionsQuery.loading && sessionList.length === 0 ? (
            <div className="rounded-md border border-dashed border-outline-variant py-8 text-center">
              <Dumbbell
                className="mx-auto mb-2 size-9 text-on-surface-variant/60"
                aria-hidden="true"
              />
              <p className="text-sm text-on-surface-variant">
                Chưa có buổi tập nào được check-in.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessionList.map((s, idx) => {
                const att =
                  attendanceMeta[s.attendance] || {
                    label: s.attendance || "Hoàn thành",
                    tone: "success" as const,
                  };
                return (
                  <button
                    key={s._id || idx}
                    type="button"
                    onClick={() => setViewingSession(s)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3.5 text-left transition-colors hover:border-primary/50"
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-semibold text-on-surface">
                        {s.planSnapshot?.title ||
                          `Buổi tập #${(s.sessionIndex ?? idx) + 1}`}
                      </strong>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        Ngày tập: {dateLabel(s.performedAt)}
                        {s.notes ? ` · Ghi chú: ${s.notes}` : ""}
                      </p>
                    </div>
                    <HrStatusBadge tone={att.tone} className="normal-case">
                      {att.label}
                    </HrStatusBadge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: INBODY & MEASUREMENTS */}
      {tab === "measurements" && (
        <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-on-surface">
              Lịch sử đo InBody &amp; Chỉ số ({inbodyList.length})
            </h3>
            {canWrite && (
              <button
                type="button"
                className={cn(primary, "min-h-9")}
                onClick={() => setEditingInbody("new")}
              >
                <Plus className="size-4" aria-hidden="true" />
                Thêm kết quả InBody
              </button>
            )}
          </div>

          <Feedback loading={inbodyQuery.loading} error={inbodyQuery.error} />

          {!inbodyQuery.loading && inbodyList.length === 0 ? (
            <div className="rounded-md border border-dashed border-outline-variant py-8 text-center">
              <Ruler
                className="mx-auto mb-2 size-9 text-on-surface-variant/60"
                aria-hidden="true"
              />
              <p className="text-sm text-on-surface-variant">
                Chưa có bản ghi InBody nào.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inbodyList.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => setSelectedInbody(item)}
                  className="flex cursor-pointer flex-col justify-between rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-left transition-colors hover:border-primary/50"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm font-semibold tabular-nums text-on-surface">
                        {dateLabel(item.measurementDate)}
                      </strong>
                      <HrStatusBadge
                        tone={item.status === "PUBLISHED" ? "success" : "warning"}
                        className="normal-case"
                      >
                        {item.status === "PUBLISHED" ? "Đã công bố" : "Bản nháp"}
                      </HrStatusBadge>
                    </div>
                    <div className="space-y-1 text-xs tabular-nums text-on-surface-variant">
                      <p>
                        Cân nặng: <strong className="text-on-surface">{item.weight} kg</strong>
                      </p>
                      <p>
                        % Mỡ (BodyFat):{" "}
                        <strong className="text-on-surface">
                          {item.bodyFatPercentage != null
                            ? `${item.bodyFatPercentage}%`
                            : "—"}
                        </strong>
                      </p>
                      <p>
                        Khối lượng cơ:{" "}
                        <strong className="text-on-surface">
                          {item.muscleMass != null ? `${item.muscleMass} kg` : "—"}
                        </strong>
                      </p>
                      {item.visceralFatLevel != null && (
                        <p>
                          Mỡ nội tạng:{" "}
                          <strong className="text-on-surface">
                            Level {item.visceralFatLevel}
                          </strong>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-outline-variant/60 pt-2 text-xs font-semibold text-primary">
                    <span>Bấm xem phân tích chi tiết</span>
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-modals */}
      {assign && (
        <AssignPlan
          api={api}
          customerId={record._id}
          onClose={() => {
            setAssign(false);
            setRefresh((r) => r + 1);
          }}
        />
      )}

      {showPhotoManager && (
        <CustomerPhotoManager
          api={api}
          customer={currentRecord}
          canWrite={canWrite}
          onClose={() => setShowPhotoManager(false)}
          onChanged={() => setRefresh((r) => r + 1)}
        />
      )}

      {todayNutritionPlan && (
        <CustomerTodayNutritionModal
          plan={todayNutritionPlan}
          customerName={currentRecord.fullName}
          onClose={() => setTodayNutritionPlan(null)}
        />
      )}

      {selectedInbody && (
        <InBodyDetailModal
          api={api}
          record={selectedInbody}
          customer={currentRecord}
          historyRecords={inbodyList}
          canWrite={canWrite}
          onClose={() => setSelectedInbody(null)}
          onEdit={(rec) => {
            setSelectedInbody(null);
            setEditingInbody(rec);
          }}
          onStatusChanged={() => setRefresh((r) => r + 1)}
        />
      )}

      {editingInbody && (
        <RecordEditor
          api={api}
          entity="measurements"
          record={editingInbody === "new" ? undefined : editingInbody}
          customerId={record._id}
          onClose={() => setEditingInbody(null)}
          onSaved={() => {
            setEditingInbody(null);
            setRefresh((r) => r + 1);
          }}
        />
      )}

      {viewingSession && (
        <ErpModal
          native
          title={`Buổi tập ${dateLabel(viewingSession.performedAt)}`}
          onClose={() => setViewingSession(null)}
          maxWidth="max-w-3xl"
        >
          <SessionDetail session={viewingSession} />
        </ErpModal>
      )}

      {editing && (
        <CustomerForm
          api={api}
          record={currentRecord}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setRefresh((r) => r + 1);
          }}
        />
      )}
    </section>
  );
}
