import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Droplets,
  Dumbbell,
  Eye,
  Filter,
  Flame,
  HeartPulse,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Scale,
  Search,
  Sparkles,
  Target,
  Trash2,
  User,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "./GymDropdown";
import { ErpModal } from "../../components/common/ErpModal";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import { TablePagination } from "../../components/common/TablePagination";
import { HrPageTitle } from "../../components/hr/HrPageTitle";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import {
  evaluateGoalFeasibility,
  type FeasibilityAssessment,
  type RoadmapGoalType,
} from "./goalFeasibility";
import {
  generateSmartRoadmap,
  type RoadmapCustomerMeta,
  type RoadmapEvaluationCheckpoint,
  type RoadmapInBodySnapshot,
  type RoadmapNutritionStrategy,
  type RoadmapPhaseProposal,
  type RoadmapStrategyProposal,
} from "./roadmapGenerator";
import {
  dateLabel,
  Feedback,
  Field,
  GymEmptyState,
  messageOf,
  primary,
  secondary,
  useGymQuery,
} from "./ui";

const newPhase = (order: number): RoadmapPhaseProposal => ({
  order,
  name: "",
  durationWeeks: 1,
  goals: [],
  weeks: [],
});

export default function RoadmapPage({
  api,
  canWrite,
  customerId: fixedCustomerId,
}: {
  api: GymApi;
  canWrite: boolean;
  customerId?: string;
  embedded?: boolean;
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(fixedCustomerId || "");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  // Inline 3S RoadmapForm toggle & editing state
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<GymRecord | null>(null);

  const [detail, setDetail] = useState<GymRecord>();
  const [publishing, setPublishing] = useState<GymRecord>();
  const [deleting, setDeleting] = useState<GymRecord>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => setRevision((v) => v + 1);
  const customersQuery = useGymQuery<GymList>(api, "/customers?limit=200", 0);
  const customers = customersQuery.data?.data || [];
  const customerMap = useMemo(() => {
    const map = new Map<string, GymRecord>();
    for (const c of customers) map.set(c._id, c);
    return map;
  }, [customers]);

  const query = new URLSearchParams({
    page: String(page),
    limit: "6",
    ...(appliedSearch ? { search: appliedSearch } : {}),
    ...(status ? { status } : {}),
    ...(fixedCustomerId || selectedCustomerId
      ? { customerId: fixedCustomerId || selectedCustomerId }
      : {}),
  });
  const result = useGymQuery<GymList>(api, `/roadmaps?${query}`, revision);
  const rows = result.data?.data || [];
  const totalCount = result.data?.meta.total ?? rows.length;
  const hasActiveFilters = Boolean(
    appliedSearch.trim() || status || (!fixedCustomerId && selectedCustomerId),
  );

  const handleResetFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setStatus("");
    if (!fixedCustomerId) setSelectedCustomerId("");
    setPage(1);
  };

  return (
    <section className="flex min-h-full flex-1 flex-col gap-4" aria-label="Quản lý Lộ trình">
      {/* Header matching 3S RoadmapPage */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Sparkles className="size-5" />
          </span>
          <HrPageTitle>Quản lý Lộ trình</HrPageTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ErpRefreshButton loading={result.loading} onClick={refresh} />
          {canWrite && (
            <button
              type="button"
              className={cn(primaryCreateButtonClass, "min-h-9")}
              onClick={() => {
                setEditingItem(null);
                setShowForm((prev) => !prev);
              }}
            >
              <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
              Tạo roadmap
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Card matching 3S "Bộ lọc & Tìm kiếm lộ trình" */}
      <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <Filter className="size-4 text-primary" aria-hidden="true" />
            <span>Bộ lọc &amp; Tìm kiếm lộ trình</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="tabular-nums">
              Hiển thị <strong className="text-on-surface">{rows.length}</strong> /{" "}
              <strong className="text-on-surface">{totalCount}</strong> lộ trình
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex cursor-pointer items-center gap-1 rounded border border-outline-variant bg-surface-container-low px-2 py-0.5 text-xs text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              >
                <X className="size-3" aria-hidden="true" />
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
          {!fixedCustomerId && (
            <div className="space-y-1">
              <span className="block text-xs font-medium text-on-surface-variant">
                Lọc theo khách hàng
              </span>
              <Dropdown
                aria-label="Lọc theo khách hàng"
                variant="filter"
                searchable
                searchPlaceholder="Tìm tên hoặc SĐT..."
                className="w-full"
                triggerClassName="w-full justify-between"
                value={selectedCustomerId}
                onChange={(value) => {
                  setSelectedCustomerId(value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "Tất cả học viên..." },
                  ...customers.map((c) => ({
                    value: c._id,
                    label: `${c.fullName}${c.phone ? ` · ${c.phone}` : ""}`,
                  })),
                ]}
              />
            </div>
          )}

          <div className="space-y-1">
            <span className="block text-xs font-medium text-on-surface-variant">
              Trạng thái
            </span>
            <Dropdown
              aria-label="Lọc theo trạng thái"
              variant="filter"
              className="w-full"
              triggerClassName="w-full justify-between"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "DRAFT", label: "Bản nháp (DRAFT)" },
                { value: "PUBLISHED", label: "Đã công bố (PUBLISHED)" },
              ]}
            />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedSearch(searchInput);
              setPage(1);
            }}
            className="flex gap-1.5"
          >
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/70"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Tìm tiêu đề lộ trình"
                placeholder="Tìm tiêu đề lộ trình..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-8 pr-3 text-xs text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <button type="submit" className={secondary}>
              Tìm
            </button>
          </form>
        </div>
      </div>

      {/* Inline 3S RoadmapForm panel ("Đề xuất Lộ trình & Mục tiêu Toàn diện") */}
      {(showForm || editingItem) && canWrite && (
        <RoadmapInlineForm
          key={editingItem?._id || "new"}
          api={api}
          customers={customers}
          fixedCustomerId={fixedCustomerId}
          initialData={editingItem}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingItem(null);
            refresh();
          }}
        />
      )}

      <Feedback error={result.error || error} loading={result.loading} />

      {/* Roadmap Cards Grid */}
      {!result.loading && !result.error && !rows.length && (
        <div className="rounded-md border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center">
          <GymEmptyState
            kind="workflow"
            filtered={hasActiveFilters}
            title={
              hasActiveFilters
                ? "Không tìm thấy lộ trình phù hợp với bộ lọc hiện tại."
                : "Chưa có lộ trình nào được tạo."
            }
          />
          {hasActiveFilters ? (
            <button type="button" className={cn(secondary, "mt-3")} onClick={handleResetFilters}>
              Xóa bộ lọc &amp; Xem tất cả
            </button>
          ) : (
            canWrite && (
              <button
                type="button"
                className={cn(primaryCreateButtonClass, "mt-3 min-h-9")}
                onClick={() => {
                  setEditingItem(null);
                  setShowForm(true);
                }}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Tạo roadmap ngay
              </button>
            )
          )}
        </div>
      )}

      {!result.loading && !result.error && rows.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const customer = customerMap.get(row.customerId);
            const isPublished = row.status === "PUBLISHED";
            return (
              <article
                key={row._id}
                className="flex flex-col justify-between rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs transition-colors hover:border-primary/40"
              >
                <div className="space-y-3">
                  {/* Card Top Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-2.5">
                    <HrStatusBadge dot tone={isPublished ? "success" : "warning"}>
                      {isPublished ? "Đã công bố" : "Bản nháp"}
                    </HrStatusBadge>
                    <span
                      className="inline-flex max-w-[180px] items-center gap-1 rounded-full border border-change-up/30 bg-change-up/10 px-2.5 py-0.5 text-xs font-semibold text-change-up"
                      title={customer?.fullName || "Học viên"}
                    >
                      <User className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{customer?.fullName || "Học viên"}</span>
                    </span>
                  </div>

                  {/* Card Title */}
                  <h2 className="text-balance text-base font-semibold text-on-surface">
                    {row.title}
                  </h2>

                  {/* 3S Compact Timeline Accordion */}
                  <RoadmapTimeline roadmap={row} />
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/70 pt-3">
                  {canWrite ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPublishing(row)}
                      className={cn(
                        "inline-flex min-h-8 cursor-pointer items-center rounded-md px-2.5 text-xs font-semibold transition-colors",
                        isPublished
                          ? "border border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary/40"
                          : "bg-primary text-on-primary hover:bg-primary/90",
                      )}
                    >
                      {isPublished ? "Gỡ công bố" : "Công bố roadmap"}
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDetail(row)}
                      title="Xem chi tiết toàn bộ lộ trình"
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 text-xs font-semibold text-primary hover:bg-primary/15"
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                      Xem
                    </button>
                    {canWrite && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(row);
                            setShowForm(false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          title="Chỉnh sửa roadmap"
                          className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface hover:bg-surface-container"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Sửa
                        </button>
                        {!isPublished && (
                          <button
                            type="button"
                            aria-label={`Xóa ${row.title}`}
                            title="Xóa roadmap"
                            onClick={() => {
                              setError("");
                              setDeleting(row);
                            }}
                            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-error/30 bg-surface-container-lowest text-error hover:bg-error-container/30"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {result.data && (
        <TablePagination
          appearance="erp"
          currentPage={page}
          totalPages={result.data.meta.totalPages}
          pageSize={6}
          totalItems={result.data.meta.total}
          pageSizeOptions={[6]}
          onPageChange={setPage}
          onPageSizeChange={() => {}}
        />
      )}

      {detail && (
        <RoadmapDetailDialog
          roadmap={detail}
          customerName={customerMap.get(detail.customerId)?.fullName}
          onClose={() => setDetail(undefined)}
          onEdit={
            canWrite
              ? (item) => {
                  setDetail(undefined);
                  setEditingItem(item);
                  setShowForm(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              : undefined
          }
          onTogglePublish={
            canWrite
              ? (item) => {
                  setDetail(undefined);
                  setPublishing(item);
                }
              : undefined
          }
        />
      )}

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={Boolean(publishing)}
        title={publishing?.status === "PUBLISHED" ? "Gỡ công bố roadmap?" : "Công bố roadmap?"}
        description="Chỉ nội dung đã công bố mới được phép hiển thị cho học viên."
        confirmLabel={publishing?.status === "PUBLISHED" ? "Gỡ công bố" : "Công bố"}
        isSubmitting={busy}
        error={error}
        onClose={() => {
          if (!busy) setPublishing(undefined);
        }}
        onConfirm={async () => {
          if (!publishing) return;
          setBusy(true);
          setError("");
          try {
            const act = publishing.status === "PUBLISHED" ? "unpublish" : "publish";
            await api.request(`/roadmaps/${publishing._id}/${act}`, "PATCH", {
              revision: publishing.revision,
            });
            setPublishing(undefined);
            refresh();
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={Boolean(deleting)}
        title="Xác nhận xóa roadmap?"
        description={`Bạn có chắc chắn muốn xóa "${deleting?.title || "lộ trình"}"? Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa vĩnh viễn"
        isSubmitting={busy}
        error={error}
        onClose={() => {
          if (!busy) setDeleting(undefined);
        }}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await api.remove("roadmaps", deleting);
            setDeleting(undefined);
            refresh();
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}

/**
 * Port of 3S `RoadmapTimeline.tsx`: strategy summary box + collapsible phase rows
 */
function RoadmapTimeline({ roadmap }: { roadmap: GymRecord }) {
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});
  const strategy = roadmap.strategy;
  const phases: any[] = Array.isArray(roadmap.phases) ? roadmap.phases : [];

  const togglePhase = (order: number) => {
    setExpandedPhases((prev) => ({ ...prev, [order]: !prev[order] }));
  };

  const targetCal =
    strategy?.nutrition?.targetCalories ?? strategy?.dailyCalories ?? null;
  const proteinGrams =
    strategy?.nutrition?.proteinGrams ?? strategy?.dailyProtein ?? null;
  const cardioText =
    strategy?.cardioProtocol || strategy?.cardioRecommendation || "";

  return (
    <div className="space-y-2">
      {strategy && (
        <div className="space-y-1.5 rounded-md border border-outline-variant bg-surface-container-low/50 p-2.5 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <Zap className="size-3.5 shrink-0 text-tertiary" aria-hidden="true" />
              <span>
                {strategy.trainingSplit || `${strategy.sessionsPerWeek || 3} buổi/tuần`}
              </span>
            </span>

            {targetCal != null && (
              <span className="inline-flex items-center gap-1 rounded border border-change-up/30 bg-change-up/10 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-change-up">
                <Utensils className="size-3" aria-hidden="true" />
                <span>
                  {targetCal} kcal{proteinGrams ? ` (P: ${proteinGrams}g)` : ""}
                </span>
              </span>
            )}
          </div>

          {cardioText && (
            <div className="flex items-start gap-1.5 text-[11px] text-on-surface-variant">
              <HeartPulse className="mt-0.5 size-3 shrink-0 text-error" aria-hidden="true" />
              <span className="line-clamp-2">{cardioText}</span>
            </div>
          )}

          {Array.isArray(strategy.checkpoints) && strategy.checkpoints.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {strategy.checkpoints.map((cp: any, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                >
                  <CheckCircle2 className="size-2.5 shrink-0" aria-hidden="true" />
                  <span>
                    T{cp.week || (idx + 1) * 4}:{" "}
                    {String(cp.title || cp.target || cp).split(":")[0]}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {phases.length > 0 && (
        <ol aria-label={`Timeline ${roadmap.title}`} className="space-y-1.5">
          {[...phases]
            .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
            .map((phase, idx) => {
              const order = Number(phase.order ?? idx + 1);
              const isExpanded = Boolean(expandedPhases[order]);
              const rawName = String(phase.name || phase.title || `Giai đoạn ${order}`);
              const cleanPhaseName = rawName.replace(
                new RegExp(`^Phase\\s*${order}\\s*[:\\-]\\s*`, "i"),
                "",
              );

              return (
                <li
                  key={order}
                  className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest"
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => togglePhase(order)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-2 text-left text-xs transition-colors",
                      isExpanded
                        ? "bg-surface-container"
                        : "bg-surface-container-low/40 hover:bg-surface-container-low",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-on-primary">
                        P{order}
                      </span>
                      <strong className="truncate font-semibold text-on-surface">
                        {cleanPhaseName}
                      </strong>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-on-surface-variant">
                      <span className="rounded-full border border-outline-variant bg-surface-container-lowest px-2 py-0.5 font-medium tabular-nums">
                        {phase.durationWeeks || (phase.weeks || []).length || 1} tuần
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="size-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                      )}
                    </div>
                  </button>

                  {isExpanded && Array.isArray(phase.weeks) && phase.weeks.length > 0 && (
                    <div className="space-y-1.5 border-t border-outline-variant bg-surface-container-low/30 p-2">
                      {phase.weeks.map((w: any, wIdx: number) => (
                        <div
                          key={wIdx}
                          className="rounded border border-outline-variant/80 bg-surface-container-lowest p-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-primary">Tuần {w.week}:</strong>
                            <span className="tabular-nums text-[11px] text-on-surface-variant">
                              {w.sessionTargets || 3} buổi
                            </span>
                          </div>
                          <p className="mt-0.5 text-pretty text-on-surface">{w.focus}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
        </ol>
      )}
    </div>
  );
}

/**
 * Full port of 3S `components/roadmap/RoadmapForm.tsx` + `InfeasibleGoalModal`:
 * Inline expandable panel on RoadmapPage.
 */
function RoadmapInlineForm({
  api,
  customers,
  fixedCustomerId,
  initialData,
  onCancel,
  onSaved,
}: {
  api: GymApi;
  customers: GymRecord[];
  fixedCustomerId?: string;
  initialData?: GymRecord | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState(
    fixedCustomerId || initialData?.customerId || "",
  );
  const [title, setTitle] = useState(initialData?.title || "");
  const [phases, setPhases] = useState<RoadmapPhaseProposal[]>(() => {
    const raw = Array.isArray(initialData?.phases) ? initialData!.phases : [];
    if (!raw.length) return [newPhase(1)];
    return raw.map((p: any, idx: number) => ({
      order: Number(p.order ?? idx + 1),
      name: String(p.name || p.title || ""),
      durationWeeks: Number(p.durationWeeks || p.weeks?.length || 1),
      goals: Array.isArray(p.goals)
        ? p.goals.map(String)
        : p.goals
          ? String(p.goals)
              .split(/[;\n]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      weeks: Array.isArray(p.weeks)
        ? p.weeks.map((w: any, wi: number) => ({
            week: Number(w.week ?? wi + 1),
            focus: String(w.focus || ""),
            sessionTargets: Number(w.sessionTargets || 3),
            sessions: Array.isArray(w.sessions) ? w.sessions : [],
          }))
        : [],
    }));
  });
  const [strategy, setStrategy] = useState<RoadmapStrategyProposal | null>(
    (initialData?.strategy as RoadmapStrategyProposal) || null,
  );
  const [baseline, setBaseline] = useState<Record<string, number>>(
    (initialData?.baseline as Record<string, number>) || {},
  );
  const [phaseError, setPhaseError] = useState("");
  const [saving, setSaving] = useState(false);

  // Customer Context & Latest InBody
  const [customerMeta, setCustomerMeta] = useState<RoadmapCustomerMeta | null>(null);
  const [latestInbody, setLatestInbody] = useState<RoadmapInBodySnapshot | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // Smart Proposal Generator Controls
  const [goalType, setGoalType] = useState<RoadmapGoalType>("FAT_LOSS");
  const [targetValue, setTargetValue] = useState<number>(5);
  const [targetUnit, setTargetUnit] = useState<string>("kg");
  const [durationWeeks, setDurationWeeks] = useState<number>(12);
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number>(3);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(60);
  const [customNotes, setCustomNotes] = useState<string>("");

  const [showInfeasibleModal, setShowInfeasibleModal] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({ 0: true });
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiElapsedSeconds, setAiElapsedSeconds] = useState(0);
  const [aiStep, setAiStep] = useState(1);
  const [aiProgress, setAiProgress] = useState(15);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!loadingAi) {
      setAiElapsedSeconds(0);
      setAiStep(1);
      setAiProgress(15);
      return;
    }
    const timer = window.setInterval(() => {
      setAiElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next <= 5) {
          setAiStep(1);
          setAiProgress(15 + next * 2);
        } else if (next <= 45) {
          setAiStep(2);
          setAiProgress(25 + Math.floor(((next - 5) / 40) * 35));
        } else if (next <= 90) {
          setAiStep(3);
          setAiProgress(60 + Math.floor(((next - 45) / 45) * 25));
        } else {
          setAiStep(4);
          setAiProgress(Math.min(96, 85 + Math.floor(((next - 90) / 45) * 11)));
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loadingAi]);

  // Load customer profile + latest InBody + latest goal when customerId changes
  useEffect(() => {
    if (!customerId) {
      setCustomerMeta(null);
      setLatestInbody(null);
      return;
    }
    let active = true;
    setLoadingContext(true);
    Promise.all([
      api.request<GymRecord>(`/customers/${customerId}`, "GET").catch(() => null),
      api.request<GymList>(`/measurements?customerId=${customerId}&limit=1`, "GET").catch(() => null),
      api.request<GymList>(`/goals?customerId=${customerId}&limit=1`, "GET").catch(() => null),
    ])
      .then(([cust, inbodyList, goalList]) => {
        if (!active) return;
        const foundCust = cust || customers.find((c) => c._id === customerId) || null;
        setCustomerMeta(foundCust);
        setLatestInbody(inbodyList?.data?.[0] || null);
        if (foundCust?.medicalNotes && !customNotes) {
          setCustomNotes(String(foundCust.medicalNotes));
        }
        const g = goalList?.data?.[0];
        if (g?.type) setGoalType(g.type as RoadmapGoalType);
        if (g?.targetValue != null) setTargetValue(Number(g.targetValue));
        if (g?.targetUnit) setTargetUnit(String(g.targetUnit));
        if (g?.sessionsPerWeek) setSessionsPerWeek(Number(g.sessionsPerWeek));
      })
      .finally(() => {
        if (active) setLoadingContext(false);
      });
    return () => {
      active = false;
    };
  }, [api, customerId, customers]);

  const feasibility = useMemo(
    () =>
      evaluateGoalFeasibility({
        goalType,
        targetValue,
        targetUnit,
        durationWeeks,
        sessionsPerWeek,
        currentWeight: latestInbody?.weight ?? customerMeta?.initialWeight,
        gender: customerMeta?.gender,
      }),
    [goalType, targetValue, targetUnit, durationWeeks, sessionsPerWeek, latestInbody, customerMeta],
  );

  const changeCustomer = (id: string) => {
    if (id === customerId) return;
    setCustomerId(id);
    if (!initialData) {
      setTitle("");
      setStrategy(null);
      setBaseline({});
      setPhases([newPhase(1)]);
    }
    setPhaseError("");
    setNotice("");
  };

  const applyInstantSportsScienceRoadmap = () => {
    if (!customerId) {
      setPhaseError("Vui lòng chọn học viên trước khi tạo lộ trình.");
      return;
    }
    if (feasibility.status === "INFEASIBLE") {
      setShowInfeasibleModal(true);
      return;
    }
    const fallbackProposal = generateSmartRoadmap(
      customerMeta || { _id: customerId, fullName: "Học viên" },
      latestInbody,
      {
        type: goalType,
        targetValue,
        targetUnit,
        durationWeeks,
        sessionsPerWeek,
        customNotes,
        sessionDurationMinutes,
      },
    );
    setTitle(fallbackProposal.title);
    setStrategy(fallbackProposal.strategy);
    setPhases(fallbackProposal.phases);
    setBaseline(fallbackProposal.baseline);
    setExpandedPhases(Object.fromEntries(fallbackProposal.phases.map((_, i) => [i, true])));
    setLoadingAi(false);
    setNotice("Đã sinh lộ trình chuẩn Khoa học Thể thao. PT vui lòng kiểm tra trước khi lưu.");
  };

  const handleGenerateSmartProposal = async () => {
    setPhaseError("");
    setNotice("");
    if (
      !Number.isInteger(sessionDurationMinutes) ||
      sessionDurationMinutes < 20 ||
      sessionDurationMinutes > 180
    ) {
      setPhaseError("Thời lượng mỗi buổi phải từ 20 đến 180 phút.");
      return;
    }
    if (!customerId) {
      setPhaseError("Vui lòng chọn học viên trước khi tạo lộ trình với AI.");
      return;
    }
    if (feasibility.status === "INFEASIBLE") {
      setShowInfeasibleModal(true);
      return;
    }

    setLoadingAi(true);
    try {
      const startDate = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
      });
      const res = await api.request<Record<string, any>>("/roadmaps/generate", "POST", {
        customerId,
        goalType,
        targetValue,
        targetUnit,
        durationWeeks,
        sessionsPerWeek,
        sessionDurationMinutes,
        prompt: customNotes.trim(),
        startDate,
      });

      if (res && Array.isArray(res.phases) && res.phases.length > 0) {
        const fallback = generateSmartRoadmap(
          customerMeta || { _id: customerId, fullName: "Học viên" },
          latestInbody,
          {
            type: goalType,
            targetValue,
            targetUnit,
            durationWeeks,
            sessionsPerWeek,
            customNotes,
            sessionDurationMinutes,
          },
        );
        const mappedPhases: RoadmapPhaseProposal[] = res.phases.map(
          (p: any, idx: number) => ({
            order: Number(p.order ?? idx + 1),
            name: String(p.name || p.title || `Phase ${idx + 1}`),
            durationWeeks: Number(p.durationWeeks || p.weeks?.length || 1),
            goals: Array.isArray(p.goals)
              ? p.goals.map(String)
              : p.goals
                ? String(p.goals)
                    .split(/[;\n]/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
            weeks: Array.isArray(p.weeks)
              ? p.weeks.map((w: any, wi: number) => ({
                  week: Number(w.week ?? wi + 1),
                  focus: String(w.focus || ""),
                  sessionTargets: Number(w.sessionTargets || sessionsPerWeek),
                  sessions: Array.isArray(w.sessions) ? w.sessions : [],
                }))
              : [],
          }),
        );
        setTitle(String(res.title || fallback.title));
        const rawStrat = res.strategy || {};
        setStrategy({
          ...fallback.strategy,
          ...rawStrat,
          generationSource: "AI",
          nutrition: {
            ...fallback.strategy.nutrition,
            ...(rawStrat.nutrition || {}),
            ...(rawStrat.dailyCalories ? { targetCalories: Number(rawStrat.dailyCalories) } : {}),
            ...(rawStrat.dailyProtein ? { proteinGrams: Number(rawStrat.dailyProtein) } : {}),
          },
          cardioProtocol:
            rawStrat.cardioProtocol ||
            rawStrat.cardioRecommendation ||
            fallback.strategy.cardioProtocol,
          checkpoints:
            Array.isArray(rawStrat.checkpoints) && rawStrat.checkpoints.length > 0
              ? rawStrat.checkpoints.map((cp: any, idx: number) => ({
                  week: Number(cp.week || (idx + 1) * 4),
                  title: String(cp.title || cp.target || `Mốc ${idx + 1}`),
                  description: String(cp.description || cp.notes || ""),
                }))
              : fallback.strategy.checkpoints,
        });
        setPhases(mappedPhases);
        setBaseline(res.baseline || fallback.baseline);
        setExpandedPhases(Object.fromEntries(mappedPhases.map((_, i) => [i, true])));
        setNotice("AI đã tạo bản nháp lộ trình. PT cần kiểm tra trước khi lưu.");
      } else {
        applyInstantSportsScienceRoadmap();
      }
    } catch {
      applyInstantSportsScienceRoadmap();
    } finally {
      setLoadingAi(false);
    }
  };

  // Phase & Week manipulation helpers matching 3S RoadmapForm
  const togglePhaseExpand = (index: number) => {
    setExpandedPhases((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const updatePhase = (index: number, change: Partial<RoadmapPhaseProposal>) => {
    setPhases((current) =>
      current.map((phase, pIdx) => (pIdx === index ? { ...phase, ...change } : phase)),
    );
  };

  const applyPhaseStructure = (next: RoadmapPhaseProposal[]) => {
    let week = 1;
    const updated = next.map((phase, i) => ({
      ...phase,
      order: i + 1,
      durationWeeks: phase.weeks.length || phase.durationWeeks || 1,
      weeks: phase.weeks.map((item) => ({ ...item, week: week++ })),
    }));
    setPhases(updated);
    setStrategy((prev) =>
      prev
        ? {
            ...prev,
            estimatedWeeks: updated.reduce((sum, phase) => sum + phase.durationWeeks, 0),
          }
        : null,
    );
  };

  const removePhase = (index: number) => {
    if (phases.length <= 1) {
      setPhaseError("Lộ trình phải có ít nhất 1 giai đoạn (Phase).");
      return;
    }
    applyPhaseStructure(phases.filter((_, i) => i !== index));
  };

  const addPhase = () => {
    applyPhaseStructure([
      ...phases,
      {
        ...newPhase(phases.length + 1),
        weeks: [{ week: 1, focus: "", sessionTargets: sessionsPerWeek, sessions: [] }],
      },
    ]);
    setExpandedPhases((prev) => ({ ...prev, [phases.length]: true }));
  };

  const addWeek = (phaseIndex: number) => {
    applyPhaseStructure(
      phases.map((phase, i) =>
        i === phaseIndex
          ? {
              ...phase,
              weeks: [
                ...phase.weeks,
                { week: 1, focus: "", sessionTargets: sessionsPerWeek, sessions: [] },
              ],
            }
          : phase,
      ),
    );
  };

  const updateWeekFocus = (phaseIndex: number, weekIndex: number, focus: string) => {
    setPhases((current) =>
      current.map((phase, pIdx) => {
        if (pIdx !== phaseIndex) return phase;
        return {
          ...phase,
          weeks: phase.weeks.map((w, wIdx) => (wIdx === weekIndex ? { ...w, focus } : w)),
        };
      }),
    );
  };

  const updateWeekSessionTargets = (
    phaseIndex: number,
    weekIndex: number,
    sessionTargets: number,
  ) => {
    setPhases((current) =>
      current.map((phase, pIdx) => {
        if (pIdx !== phaseIndex) return phase;
        return {
          ...phase,
          weeks: phase.weeks.map((w, wIdx) =>
            wIdx === weekIndex ? { ...w, sessionTargets } : w,
          ),
        };
      }),
    );
  };

  const removeWeek = (phaseIndex: number, weekIndex: number) => {
    applyPhaseStructure(
      phases.map((phase, i) =>
        i === phaseIndex
          ? { ...phase, weeks: phase.weeks.filter((_, w) => w !== weekIndex) }
          : phase,
      ),
    );
  };

  const addPhaseGoal = (phaseIndex: number) => {
    setPhases((current) =>
      current.map((phase, pIdx) =>
        pIdx === phaseIndex ? { ...phase, goals: [...(phase.goals || []), ""] } : phase,
      ),
    );
  };

  const updatePhaseGoal = (phaseIndex: number, goalIndex: number, text: string) => {
    setPhases((current) =>
      current.map((phase, pIdx) => {
        if (pIdx !== phaseIndex) return phase;
        const nextGoals = [...(phase.goals || [])];
        nextGoals[goalIndex] = text;
        return { ...phase, goals: nextGoals };
      }),
    );
  };

  const removePhaseGoal = (phaseIndex: number, goalIndex: number) => {
    setPhases((current) =>
      current.map((phase, pIdx) =>
        pIdx === phaseIndex
          ? { ...phase, goals: (phase.goals || []).filter((_, gIdx) => gIdx !== goalIndex) }
          : phase,
      ),
    );
  };

  const updateStrategy = (change: Partial<RoadmapStrategyProposal>) => {
    setStrategy((prev) => (prev ? { ...prev, ...change } : null));
  };

  const updateNutrition = (change: Partial<RoadmapNutritionStrategy>) => {
    setStrategy((prev) =>
      prev ? { ...prev, nutrition: { ...prev.nutrition, ...change } } : null,
    );
  };

  const updateCheckpoint = (
    index: number,
    change: Partial<RoadmapEvaluationCheckpoint>,
  ) => {
    setStrategy((prev) => {
      if (!prev) return null;
      const cps = [...(prev.checkpoints || [])];
      if (cps[index]) cps[index] = { ...cps[index], ...change };
      return { ...prev, checkpoints: cps };
    });
  };

  const addCheckpoint = () => {
    setStrategy((prev) => {
      if (!prev) return null;
      const cps = prev.checkpoints || [];
      return {
        ...prev,
        checkpoints: [
          ...cps,
          {
            week: (cps.length + 1) * 4,
            title: `Mốc ${cps.length + 1}: Đánh giá & InBody`,
            description: "Kiểm tra tỷ lệ cơ/mỡ và tinh chỉnh lộ trình",
          },
        ],
      };
    });
  };

  const removeCheckpoint = (index: number) => {
    setStrategy((prev) =>
      prev
        ? {
            ...prev,
            checkpoints: (prev.checkpoints || []).filter((_, idx) => idx !== index),
          }
        : null,
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || loadingAi) return;
    setPhaseError("");
    if (!customerId) {
      setPhaseError("Vui lòng chọn học viên / khách hàng.");
      return;
    }
    if (!title.trim()) {
      setPhaseError("Vui lòng nhập tên lộ trình.");
      return;
    }
    if (feasibility.status === "INFEASIBLE") {
      setShowInfeasibleModal(true);
      return;
    }
    if (new Set(phases.map((p) => p.order)).size !== phases.length) {
      setPhaseError("Thứ tự phase không được trùng.");
      return;
    }

    setSaving(true);
    try {
      const sanitizedPhases = phases.map((phase, idx) => ({
        order: Number(phase.order || idx + 1),
        name: phase.name.trim() || `Giai đoạn ${idx + 1}`,
        durationWeeks: Math.max(1, Number(phase.durationWeeks || phase.weeks.length || 1)),
        goals: (phase.goals || []).map((g) => g.trim()).filter(Boolean),
        weeks: (phase.weeks || []).map((week, wIdx) => ({
          week: Number(week.week || wIdx + 1),
          focus: week.focus.trim() || `Tuần ${week.week || wIdx + 1}`,
          sessionTargets: Number(week.sessionTargets || sessionsPerWeek),
          sessions: [],
        })),
      }));

      await api.save(
        "roadmaps",
        {
          customerId,
          title: title.trim(),
          baseline: baseline || {},
          strategy: strategy || {},
          phases: sanitizedPhases,
          status: initialData?.status || "DRAFT",
        },
        initialData || undefined,
      );
      onSaved();
    } catch (err) {
      setPhaseError(messageOf(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-md border border-outline-variant bg-surface-container-lowest p-4 sm:p-5 shadow-2xs"
      >
        {/* Header Banner */}
        <div className="border-b border-outline-variant pb-3">
          <h2 className="flex items-center gap-2 text-balance text-base font-bold text-on-surface sm:text-lg">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            <span>
              {initialData
                ? "Chỉnh sửa Lộ trình Roadmap"
                : "Đề xuất Lộ trình & Mục tiêu Toàn diện"}
            </span>
          </h2>
        </div>

        {notice && (
          <div
            role="status"
            className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs font-medium text-primary"
          >
            {notice}
          </div>
        )}

        {/* 1. Customer Selector & Quick Baseline Card */}
        <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-low/40 p-3.5 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="block text-sm font-medium text-on-surface">
                Học viên / Khách hàng <span className="text-error">*</span>
              </span>
              <Dropdown
                aria-label="Học viên / Khách hàng"
                variant="filter"
                searchable
                searchPlaceholder="Chọn hoặc tìm học viên..."
                disabled={loadingAi || saving || Boolean(initialData || fixedCustomerId)}
                className="w-full"
                triggerClassName="w-full justify-between"
                value={customerId}
                onChange={changeCustomer}
                options={[
                  { value: "", label: "Chọn hoặc tìm học viên..." },
                  ...customers.map((c) => ({
                    value: c._id,
                    label: `${c.fullName}${c.phone ? ` · ${c.phone}` : ""}`,
                  })),
                ]}
              />
            </div>

            <Field
              label="Tên Lộ trình"
              required
              placeholder="Ví dụ: Lộ trình Giảm mỡ & Tái cấu trúc 12 tuần..."
              value={title}
              onChange={setTitle}
            />
          </div>

          {customerId && (
            <div className="space-y-2.5 rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-on-surface">
                  <Scale className="size-4 text-primary" aria-hidden="true" />
                  Hồ sơ Thể trạng &amp; Dữ liệu InBody gần nhất:
                </span>
                {loadingContext && (
                  <span className="text-primary">Đang tải dữ liệu...</span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 tabular-nums">
                <div className="rounded bg-surface-container-low p-2.5">
                  <dt className="text-[11px] text-on-surface-variant">Cân nặng</dt>
                  <dd className="mt-0.5 text-sm font-bold text-on-surface">
                    {latestInbody?.weight || customerMeta?.initialWeight || "Chưa đo"} kg
                  </dd>
                </div>
                <div className="rounded bg-surface-container-low p-2.5">
                  <dt className="text-[11px] text-on-surface-variant">% Mỡ cơ thể</dt>
                  <dd
                    className={cn(
                      "mt-0.5 text-sm font-bold",
                      latestInbody?.bodyFatPercentage && latestInbody.bodyFatPercentage > 25
                        ? "text-error"
                        : "text-change-up",
                    )}
                  >
                    {latestInbody?.bodyFatPercentage
                      ? `${latestInbody.bodyFatPercentage}%`
                      : "Chưa có"}
                  </dd>
                </div>
                <div className="rounded bg-surface-container-low p-2.5">
                  <dt className="text-[11px] text-on-surface-variant">Khối lượng Cơ (SMM)</dt>
                  <dd className="mt-0.5 text-sm font-bold text-primary">
                    {latestInbody?.muscleMass ? `${latestInbody.muscleMass} kg` : "Chưa có"}
                  </dd>
                </div>
                <div className="rounded bg-surface-container-low p-2.5">
                  <dt className="text-[11px] text-on-surface-variant">Mỡ nội tạng / Điểm</dt>
                  <dd className="mt-0.5 text-sm font-bold text-tertiary">
                    Level {latestInbody?.visceralFatLevel || "--"} •{" "}
                    {latestInbody?.inbodyScore || "--"}đ
                  </dd>
                </div>
                <div className="rounded bg-surface-container-low p-2.5">
                  <dt className="text-[11px] text-on-surface-variant">BMR / TDEE cơ bản</dt>
                  <dd className="mt-0.5 text-sm font-bold text-on-surface">
                    {latestInbody?.bmr || 1600} kcal
                  </dd>
                </div>
              </dl>

              {customerMeta?.medicalNotes && (
                <div className="flex items-center gap-1.5 rounded border border-tertiary/30 bg-tertiary-container/30 px-2.5 py-1.5 text-xs text-on-surface">
                  <AlertCircle className="size-3.5 shrink-0 text-tertiary" aria-hidden="true" />
                  <span>
                    <strong>Lưu ý bệnh lý / Chấn thương:</strong> {customerMeta.medicalNotes}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Thiết lập Thông số Mục tiêu */}
        <div className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-3.5 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
            <Target className="size-4" aria-hidden="true" />
            <span>Thiết lập Thông số Mục tiêu</span>
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Mục tiêu chính"
              value={goalType}
              options={[
                ["FAT_LOSS", "Giảm mỡ & Giữ cơ (Fat Loss)"],
                ["WEIGHT_LOSS", "Giảm cân toàn thân (Weight Loss)"],
                ["MUSCLE_GAIN", "Tăng cơ nạc (Muscle Gain / Bulking)"],
                ["RECOMPOSITION", "Tái cấu trúc vóc dáng (Recomposition)"],
                ["FITNESS", "Cải thiện Thể lực & Sức bền (Fitness)"],
                ["STRENGTH", "Tăng Sức mạnh nền tảng (Strength)"],
              ]}
              onChange={(val) => setGoalType(val as RoadmapGoalType)}
            />

            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
              <Field
                label="Chỉ số mục tiêu"
                type="number"
                min={0.5}
                max={50}
                value={targetValue}
                onChange={(val) => setTargetValue(Number(val) || 0)}
                required
              />
              <Field
                label="Đơn vị"
                value={targetUnit}
                options={[
                  ["kg", "kg"],
                  ["% mỡ", "% mỡ"],
                  ["cm eo", "cm eo"],
                ]}
                onChange={setTargetUnit}
              />
            </div>

            <Field
              label="Thời gian dự kiến (Tuần)"
              value={String(durationWeeks)}
              options={[
                ["4", "4 tuần (1 tháng - Cấp tốc)"],
                ["8", "8 tuần (2 tháng - Cơ bản)"],
                ["12", "12 tuần (3 tháng - Chuẩn khuyến nghị)"],
                ["16", "16 tuần (4 tháng - Chuyên sâu)"],
                ["24", "24 tuần (6 tháng - Chuyển hóa toàn diện)"],
              ]}
              onChange={(val) => setDurationWeeks(Number(val) || 12)}
            />

            <Field
              label="Tần suất tập luyện"
              value={String(sessionsPerWeek)}
              options={[
                ["3", "3 buổi / tuần (Full Body Split)"],
                ["4", "4 buổi / tuần (Upper / Lower)"],
                ["5", "5 buổi / tuần (Push / Pull / Legs)"],
                ["6", "6 buổi / tuần (Vận động viên)"],
              ]}
              onChange={(val) => setSessionsPerWeek(Number(val) || 3)}
            />
          </div>

          {/* Realtime AI Feasibility Advisory Card */}
          <div
            data-testid="feasibility-card"
            className={cn(
              "space-y-2 rounded-md border p-3.5 text-xs",
              feasibility.status === "INFEASIBLE"
                ? "border-error/50 bg-error-container/25"
                : feasibility.status === "CHALLENGING"
                  ? "border-tertiary/50 bg-tertiary-container/30"
                  : "border-change-up/40 bg-surface-container-lowest",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {feasibility.status === "INFEASIBLE" ? (
                  <AlertTriangle className="size-4 text-error" aria-hidden="true" />
                ) : feasibility.status === "CHALLENGING" ? (
                  <AlertCircle className="size-4 text-tertiary" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4 text-change-up" aria-hidden="true" />
                )}
                <strong
                  className={cn(
                    "text-xs font-bold uppercase",
                    feasibility.status === "INFEASIBLE"
                      ? "text-error"
                      : feasibility.status === "CHALLENGING"
                        ? "text-tertiary"
                        : "text-change-up",
                  )}
                >
                  {feasibility.status === "INFEASIBLE"
                    ? "AI CẢNH BÁO: MỤC TIÊU BẤT KHẢ THI"
                    : feasibility.status === "CHALLENGING"
                      ? "AI TƯ VẤN: MỤC TIÊU KHÁ THÁCH THỨC"
                      : "AI TƯ VẤN: MỤC TIÊU HOÀN TOÀN KHẢ THI"}
                </strong>
              </div>
              <HrStatusBadge
                tone={
                  feasibility.status === "INFEASIBLE"
                    ? "danger"
                    : feasibility.status === "CHALLENGING"
                      ? "warning"
                      : "success"
                }
              >
                {feasibility.status === "FEASIBLE"
                  ? "HOÀN TOÀN KHẢ THI"
                  : feasibility.badgeLabel.toUpperCase()}
              </HrStatusBadge>
            </div>

            <p className="font-semibold text-on-surface">{feasibility.headline}</p>

            <ul className="list-disc space-y-1 pl-4 text-on-surface-variant">
              {feasibility.reasons.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>

            {feasibility.status === "INFEASIBLE" ? (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowInfeasibleModal(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-error/40 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-error hover:bg-error-container/20"
                >
                  <AlertCircle className="size-3.5" aria-hidden="true" />
                  Xem chi tiết cảnh báo &amp; gợi ý khắc phục →
                </button>
              </div>
            ) : (
              (feasibility.recommendedWeeks || feasibility.recommendedTarget) && (
                <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/60 pt-2">
                  <span className="font-semibold text-on-surface-variant">
                    Gợi ý điều chỉnh 1-chạm từ AI:
                  </span>
                  {feasibility.recommendedWeeks && (
                    <button
                      type="button"
                      onClick={() => setDurationWeeks(feasibility.recommendedWeeks!)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded border border-primary/40 bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      <Clock className="size-3" aria-hidden="true" />
                      Giãn thời gian: {feasibility.recommendedWeeks} tuần
                    </button>
                  )}
                  {feasibility.recommendedTarget && (
                    <button
                      type="button"
                      onClick={() => setTargetValue(feasibility.recommendedTarget!)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded border border-change-up/40 bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-change-up hover:bg-change-up/10"
                    >
                      <Target className="size-3" aria-hidden="true" />
                      Đặt mục tiêu khả thi: {feasibility.recommendedTarget} {targetUnit}
                    </button>
                  )}
                </div>
              )
            )}
          </div>

          <Field
            label="Thời lượng tối đa mỗi buổi (phút)"
            type="number"
            min={20}
            max={180}
            required
            value={sessionDurationMinutes}
            disabled={loadingAi}
            onChange={(val) => setSessionDurationMinutes(Number(val) || 60)}
          />

          <Field
            label="Ghi chú cá nhân hóa"
            placeholder="Ví dụ: Dân văn phòng ngồi nhiều đau lưng dưới, ưu tiên siết mỡ đùi và eo, tập sáng..."
            value={customNotes}
            onChange={setCustomNotes}
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={applyInstantSportsScienceRoadmap}
              disabled={loadingAi || saving || !customerId}
              className={secondary}
              title="Sinh ngay lộ trình chuẩn Khoa học Thể thao (0.01s)"
            >
              <Zap className="size-3.5 text-tertiary" aria-hidden="true" />
              Tạo nhanh chuẩn Khoa học Thể thao
            </button>
            <button
              type="button"
              onClick={() => void handleGenerateSmartProposal()}
              disabled={loadingAi || saving || !customerId}
              className={cn(
                primaryCreateButtonClass,
                "min-h-10 px-4",
                feasibility.status === "INFEASIBLE" && "bg-error hover:bg-error/90",
              )}
            >
              {feasibility.status === "INFEASIBLE" ? (
                <AlertTriangle className="size-4" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              {loadingAi
                ? "AI đang suy nghĩ, phân tích..."
                : feasibility.status === "INFEASIBLE"
                  ? "Xem cảnh báo mục tiêu bất khả thi"
                  : "Tạo Lộ trình với AI"}
            </button>
          </div>

          {loadingAi && (
            <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
                  <div>
                    <strong className="block text-xs font-semibold text-on-surface">
                      Đang xử lý &amp; phân kỳ lộ trình bằng AI ({aiElapsedSeconds}s)
                    </strong>
                    <span className="text-[11px] text-on-surface-variant">
                      Kết hợp hồ sơ {customerMeta?.fullName || "học viên"}, dữ liệu InBody và mục tiêu PT
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={applyInstantSportsScienceRoadmap}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-tertiary px-3 py-1.5 text-xs font-bold text-on-tertiary"
                >
                  <Zap className="size-3.5" aria-hidden="true" />
                  Lấy ngay (0.01s)
                </button>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${aiProgress}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {[
                  "1. Đọc InBody & Hồ sơ",
                  "2. Gửi LLM & Suy luận",
                  "3. Tính Calo & Cardio",
                  "4. Dựng Phase & Tuần",
                ].map((stepLabel, idx) => (
                  <span
                    key={stepLabel}
                    className={cn(
                      "font-medium",
                      aiStep >= idx + 1 ? "text-primary" : "text-on-surface-variant",
                    )}
                  >
                    {stepLabel}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Chiến lược Huấn luyện & Dinh dưỡng (Editable Strategy Overview) */}
        {strategy && (
          <div className="space-y-4 rounded-md border border-outline-variant bg-surface-container-lowest p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-on-surface">
                <Zap className="size-4 text-tertiary" aria-hidden="true" />
                <span>Chiến lược Huấn luyện &amp; Dinh dưỡng</span>
              </h3>
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-outline-variant bg-surface-container-low/50 px-3 py-1.5 text-xs tabular-nums">
                <label className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary" aria-hidden="true" />
                  <span>Thời lượng:</span>
                  <input
                    aria-label="Số tuần ước tính"
                    type="number"
                    min={1}
                    max={52}
                    value={strategy.estimatedWeeks || durationWeeks}
                    onChange={(e) =>
                      updateStrategy({ estimatedWeeks: Number(e.target.value) || durationWeeks })
                    }
                    className="w-12 rounded border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 text-center font-bold text-on-surface"
                  />
                  <span>Tuần</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <Dumbbell className="size-3.5 text-primary" aria-hidden="true" />
                  <span>Tần suất:</span>
                  <input
                    aria-label="Số buổi mỗi tuần"
                    type="number"
                    min={1}
                    max={7}
                    value={strategy.sessionsPerWeek || sessionsPerWeek}
                    onChange={(e) =>
                      updateStrategy({ sessionsPerWeek: Number(e.target.value) || sessionsPerWeek })
                    }
                    className="w-10 rounded border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 text-center font-bold text-on-surface"
                  />
                  <span>Buổi / Tuần</span>
                </label>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Cột 1: Huấn luyện & Cardio */}
              <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-low/40 p-3.5">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase text-primary">
                  <Dumbbell className="size-4" aria-hidden="true" />
                  Phương pháp tập &amp; Lịch phân chia
                </h4>
                <Field
                  label="Phương pháp tập luyện (Training Method)"
                  multiline
                  value={strategy.trainingMethod || ""}
                  onChange={(val) => updateStrategy({ trainingMethod: val })}
                  placeholder="Ví dụ: Progressive Overload kết hợp Hypertrophy..."
                />
                <Field
                  label="Lịch tập phân chia (Split)"
                  value={strategy.trainingSplit || ""}
                  onChange={(val) => updateStrategy({ trainingSplit: val })}
                  placeholder="Ví dụ: Upper / Lower / Full Body luân phiên..."
                />
                <Field
                  label="Chiến lược Cardio & Tim mạch (Cardio Protocol)"
                  multiline
                  value={strategy.cardioProtocol || ""}
                  onChange={(val) => updateStrategy({ cardioProtocol: val })}
                  placeholder="Ví dụ: Kết hợp Cardio Zone 2 (30-45 phút, 3-4 buổi/tuần)..."
                />
              </div>

              {/* Cột 2: Dinh dưỡng & Macros */}
              <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-low/40 p-3.5">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase text-change-up">
                  <Utensils className="size-4" aria-hidden="true" />
                  Mục tiêu Dinh dưỡng &amp; Calo hàng ngày
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field
                    label="Calo mục tiêu (kcal/ngày)"
                    type="number"
                    min={800}
                    value={strategy.nutrition?.targetCalories || 0}
                    onChange={(val) => updateNutrition({ targetCalories: Number(val) || 0 })}
                  />
                  <Field
                    label="Thâm hụt / Thặng dư (kcal)"
                    type="number"
                    value={strategy.nutrition?.calorieDeficitOrSurplus || 0}
                    onChange={(val) =>
                      updateNutrition({ calorieDeficitOrSurplus: Number(val) || 0 })
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field
                    label="Đạm (Protein g)"
                    type="number"
                    min={0}
                    value={strategy.nutrition?.proteinGrams || 0}
                    onChange={(val) => updateNutrition({ proteinGrams: Number(val) || 0 })}
                  />
                  <Field
                    label="Tinh bột (Carb g)"
                    type="number"
                    min={0}
                    value={strategy.nutrition?.carbsGrams || 0}
                    onChange={(val) => updateNutrition({ carbsGrams: Number(val) || 0 })}
                  />
                  <Field
                    label="Chất béo (Fat g)"
                    type="number"
                    min={0}
                    value={strategy.nutrition?.fatGrams || 0}
                    onChange={(val) => updateNutrition({ fatGrams: Number(val) || 0 })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                    <Droplets className="size-3.5" aria-hidden="true" />
                    Lượng nước tối thiểu (Lít / ngày)
                  </span>
                  <input
                    aria-label="Lượng nước"
                    type="number"
                    step="0.1"
                    min={1}
                    value={strategy.nutrition?.waterLiters || 2.5}
                    onChange={(e) => updateNutrition({ waterLiters: Number(e.target.value) || 2.5 })}
                    className="w-16 rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 text-center font-bold tabular-nums text-on-surface"
                  />
                </div>
                <Field
                  label="Lời khuyên & Định hướng Dinh dưỡng"
                  multiline
                  value={strategy.nutrition?.advice || ""}
                  onChange={(val) => updateNutrition({ advice: val })}
                />
              </div>
            </div>

            {/* Các mốc Đánh giá & Checkpoints */}
            <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-low/40 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                  Các mốc Đánh giá &amp; Đo lường Thể chất
                </h4>
                <button type="button" onClick={addCheckpoint} className={secondary}>
                  <Plus className="size-3.5" aria-hidden="true" />
                  Thêm mốc kiểm tra
                </button>
              </div>

              <div className="grid gap-2.5 lg:grid-cols-2">
                {(strategy.checkpoints || []).map((cp, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <label className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-2 py-1 font-semibold text-primary">
                        <span>Tuần</span>
                        <input
                          aria-label={`Tuần mốc ${idx + 1}`}
                          type="number"
                          min={1}
                          max={52}
                          value={cp.week}
                          onChange={(e) =>
                            updateCheckpoint(idx, { week: Number(e.target.value) || 1 })
                          }
                          className="w-10 rounded border border-outline-variant bg-surface-container-lowest px-1 py-0.5 text-center font-bold tabular-nums text-on-surface"
                        />
                      </label>
                      <input
                        aria-label={`Tiêu đề mốc ${idx + 1}`}
                        value={cp.title}
                        onChange={(e) => updateCheckpoint(idx, { title: e.target.value })}
                        placeholder="Ví dụ: Mốc 1: Đánh giá thích nghi..."
                        className="h-8 min-w-0 flex-1 rounded border border-outline-variant bg-surface-container-lowest px-2.5 font-semibold text-on-surface"
                      />
                      <button
                        type="button"
                        aria-label={`Xóa mốc ${idx + 1}`}
                        onClick={() => removeCheckpoint(idx)}
                        className="cursor-pointer rounded p-1 text-error hover:bg-error-container/30"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <textarea
                      aria-label={`Mô tả mốc ${idx + 1}`}
                      rows={2}
                      value={cp.description}
                      onChange={(e) => updateCheckpoint(idx, { description: e.target.value })}
                      placeholder="Mô tả chi tiết nội dung kiểm tra, đo lường InBody..."
                      className="w-full rounded border border-outline-variant bg-surface-container-lowest p-2 text-xs text-on-surface"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. Lộ trình Phân kỳ (Phases -> Goals & Weeks) matching 3S Screenshots 2 & 3 */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-on-surface">
              <Layers className="size-4 text-primary" aria-hidden="true" />
              <span className="tabular-nums">
                Lộ trình Phân kỳ ({phases.length} Phase •{" "}
                {phases.reduce((acc, p) => acc + (p.durationWeeks || 0), 0)} Tuần)
              </span>
            </h3>
            <button type="button" onClick={addPhase} className={secondary}>
              <Plus className="size-3.5" aria-hidden="true" />
              Thêm Phase
            </button>
          </div>

          {phases.map((phase, phaseIndex) => {
            const isExpanded = Boolean(expandedPhases[phaseIndex]);
            const cleanPhaseName = (phase.name || `Giai đoạn ${phase.order}`).replace(
              new RegExp(`^Phase\\s*${phase.order}\\s*[:\\-]\\s*`, "i"),
              "",
            );

            return (
              <div
                key={phaseIndex}
                className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest"
              >
                {/* Phase Card Header */}
                <div
                  className={cn(
                    "flex cursor-pointer select-none flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 transition-colors",
                    isExpanded
                      ? "border-b border-outline-variant bg-surface-container"
                      : "bg-surface-container-low/50 hover:bg-surface-container-low",
                  )}
                  onClick={() => togglePhaseExpand(phaseIndex)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="shrink-0 rounded bg-primary px-2.5 py-1 text-xs font-bold text-on-primary">
                      Phase {phase.order}
                    </span>
                    <strong className="truncate text-sm font-semibold text-on-surface">
                      {cleanPhaseName}
                    </strong>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border border-outline-variant bg-surface-container-lowest px-2.5 py-0.5 text-xs font-medium tabular-nums text-on-surface-variant">
                      {phase.durationWeeks} tuần • {phase.weeks?.length || 0} tuần chi tiết
                    </span>
                    <button
                      type="button"
                      aria-label={`Xóa Phase ${phase.order}`}
                      title="Xóa Phase này"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhase(phaseIndex);
                      }}
                      className="cursor-pointer rounded p-1 text-error hover:bg-error-container/30"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="size-4 text-on-surface-variant" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-4 text-on-surface-variant" aria-hidden="true" />
                    )}
                  </div>
                </div>

                {/* Phase Card Body */}
                {isExpanded && (
                  <div className="space-y-4 bg-surface-container-low/20 p-3.5 sm:p-4">
                    <div className="grid gap-3 sm:grid-cols-[90px_minmax(0,1fr)_140px]">
                      <Field
                        label="Thứ tự"
                        type="number"
                        min={1}
                        required
                        value={phase.order}
                        onChange={(val) =>
                          updatePhase(phaseIndex, { order: Number(val) || phaseIndex + 1 })
                        }
                      />
                      <Field
                        label="Tên giai đoạn (Phase Name)"
                        required
                        placeholder="Ví dụ: Giai đoạn 1: Thích nghi & Chuẩn hóa Kỹ thuật..."
                        value={phase.name}
                        onChange={(val) => updatePhase(phaseIndex, { name: val })}
                      />
                      <Field
                        label="Thời lượng (Tuần)"
                        type="number"
                        min={1}
                        required
                        value={phase.durationWeeks}
                        onChange={(val) =>
                          updatePhase(phaseIndex, { durationWeeks: Number(val) || 1 })
                        }
                      />
                    </div>

                    {/* Mục tiêu giai đoạn Phase X */}
                    <div className="space-y-2.5 rounded-md border border-outline-variant bg-surface-container-lowest p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                          <Target className="size-3.5" aria-hidden="true" />
                          <span>Mục tiêu giai đoạn Phase {phase.order}:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => addPhaseGoal(phaseIndex)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                        >
                          <Plus className="size-3" aria-hidden="true" />
                          Thêm mục tiêu
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(phase.goals || []).map((goal, gIdx) => (
                          <div key={gIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              aria-label={`Mục tiêu ${gIdx + 1} phase ${phase.order}`}
                              value={goal}
                              onChange={(e) =>
                                updatePhaseGoal(phaseIndex, gIdx, e.target.value)
                              }
                              placeholder="Ví dụ: Chuẩn hóa kỹ thuật Squat & Deadlift..."
                              className="h-8 min-w-0 flex-1 rounded border border-outline-variant bg-surface-container-lowest px-2.5 text-xs text-on-surface focus:border-primary focus:outline-none"
                            />
                            <button
                              type="button"
                              aria-label={`Xóa mục tiêu ${gIdx + 1}`}
                              onClick={() => removePhaseGoal(phaseIndex, gIdx)}
                              className="cursor-pointer rounded p-1 text-error hover:bg-error-container/30"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                        {(!phase.goals || phase.goals.length === 0) && (
                          <p className="text-xs italic text-on-surface-variant">
                            Chưa có mục tiêu cho giai đoạn này. Bấm &quot;Thêm mục tiêu&quot; để thiết lập.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Chi tiết các tuần huấn luyện trong Phase X */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-on-surface">
                          Chi tiết các tuần huấn luyện trong Phase {phase.order}:
                        </span>
                        <button
                          type="button"
                          onClick={() => addWeek(phaseIndex)}
                          className={secondary}
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                          Thêm tuần vào phase {phaseIndex + 1}
                        </button>
                      </div>

                      {phase.weeks.map((week, weekIndex) => (
                        <div
                          key={weekIndex}
                          className="flex flex-col gap-2 rounded-md border border-outline-variant bg-surface-container-lowest p-2.5 sm:flex-row sm:items-center"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="shrink-0 rounded bg-primary/15 px-2.5 py-1 text-xs font-bold tabular-nums text-primary">
                              Tuần {week.week}
                            </span>
                            <input
                              type="text"
                              aria-label={`Trọng tâm tuần ${week.week} phase ${phaseIndex + 1}`}
                              placeholder={`Trọng tâm & mục tiêu huấn luyện tuần ${week.week}...`}
                              value={week.focus}
                              onChange={(e) =>
                                updateWeekFocus(phaseIndex, weekIndex, e.target.value)
                              }
                              className="h-8 min-w-0 flex-1 rounded border border-outline-variant bg-surface-container-lowest px-2.5 text-xs text-on-surface focus:border-primary focus:outline-none"
                            />
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                            <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                              <span>Tần suất:</span>
                              <select
                                aria-label={`Tần suất tuần ${week.week}`}
                                value={week.sessionTargets || sessionsPerWeek}
                                onChange={(e) =>
                                  updateWeekSessionTargets(
                                    phaseIndex,
                                    weekIndex,
                                    Number(e.target.value) || 3,
                                  )
                                }
                                className="h-8 rounded border border-outline-variant bg-surface-container-lowest px-2 text-xs font-medium text-on-surface"
                              >
                                <option value={2}>2 buổi/tuần</option>
                                <option value={3}>3 buổi/tuần</option>
                                <option value={4}>4 buổi/tuần</option>
                                <option value={5}>5 buổi/tuần</option>
                                <option value={6}>6 buổi/tuần</option>
                              </select>
                            </label>
                            <button
                              type="button"
                              aria-label={`Xóa tuần ${week.week}`}
                              onClick={() => removeWeek(phaseIndex, weekIndex)}
                              className="cursor-pointer rounded p-1 text-error hover:bg-error-container/30"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Feedback error={phaseError} />

        {/* Action Footer matching 3S Screenshot 3: Hủy | Thêm phase | Lưu roadmap */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant pt-4">
          <button type="button" className={secondary} onClick={onCancel}>
            Hủy
          </button>
          <button type="button" className={secondary} onClick={addPhase}>
            Thêm phase
          </button>
          <button
            type="submit"
            disabled={saving || loadingAi}
            className={cn(primaryCreateButtonClass, "min-h-9 px-5")}
          >
            {saving
              ? "Đang lưu..."
              : initialData
                ? "Cập nhật Roadmap"
                : "Lưu roadmap"}
          </button>
        </div>
      </form>

      {showInfeasibleModal && (
        <InfeasibleGoalDialog
          feasibility={feasibility}
          targetUnit={targetUnit}
          currentWeeks={durationWeeks}
          currentTarget={targetValue}
          onClose={() => setShowInfeasibleModal(false)}
          onApplyRecommendedWeeks={(weeks) => {
            setDurationWeeks(weeks);
            setShowInfeasibleModal(false);
          }}
          onApplyRecommendedTarget={(target) => {
            setTargetValue(target);
            setShowInfeasibleModal(false);
          }}
        />
      )}
    </>
  );
}

function InfeasibleGoalDialog({
  feasibility,
  targetUnit,
  currentWeeks,
  currentTarget,
  onClose,
  onApplyRecommendedWeeks,
  onApplyRecommendedTarget,
}: {
  feasibility: FeasibilityAssessment;
  targetUnit: string;
  currentWeeks: number;
  currentTarget: number;
  onClose: () => void;
  onApplyRecommendedWeeks: (weeks: number) => void;
  onApplyRecommendedTarget: (target: number) => void;
}) {
  return (
    <ErpModal
      native
      title="AI Cảnh Báo: Mục tiêu vượt ngưỡng an toàn sinh học"
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-xs">
        <div className="rounded-md border border-error/40 bg-error-container/25 p-3">
          <p className="font-bold text-error">{feasibility.headline}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-on-surface">
            {feasibility.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 rounded-md border border-outline-variant bg-surface-container-low/50 p-3">
          <p className="font-semibold text-on-surface">
            Giải pháp điều chỉnh an toàn được AI khuyến nghị:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {feasibility.recommendedWeeks && (
              <button
                type="button"
                onClick={() => onApplyRecommendedWeeks(feasibility.recommendedWeeks!)}
                className="flex cursor-pointer flex-col items-start gap-1 rounded-md border border-primary/40 bg-surface-container-lowest p-3 text-left transition-colors hover:bg-primary/10"
              >
                <span className="font-bold text-primary">
                  Phương án 1: Giãn thời gian
                </span>
                <span className="text-on-surface-variant">
                  Đổi từ {currentWeeks} tuần →{" "}
                  <strong className="text-on-surface">
                    {feasibility.recommendedWeeks} tuần
                  </strong>
                </span>
              </button>
            )}
            {feasibility.recommendedTarget && (
              <button
                type="button"
                onClick={() => onApplyRecommendedTarget(feasibility.recommendedTarget!)}
                className="flex cursor-pointer flex-col items-start gap-1 rounded-md border border-change-up/40 bg-surface-container-lowest p-3 text-left transition-colors hover:bg-change-up/10"
              >
                <span className="font-bold text-change-up">
                  Phương án 2: Giảm chỉ tiêu
                </span>
                <span className="text-on-surface-variant">
                  Đổi từ {currentTarget} {targetUnit} →{" "}
                  <strong className="text-on-surface">
                    {feasibility.recommendedTarget} {targetUnit}
                  </strong>
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-outline-variant pt-3">
          <button type="button" className={secondary} onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </ErpModal>
  );
}

function RoadmapDetailDialog({
  roadmap,
  customerName,
  onClose,
  onEdit,
  onTogglePublish,
}: {
  roadmap: GymRecord;
  customerName?: string;
  onClose: () => void;
  onEdit?: (item: GymRecord) => void;
  onTogglePublish?: (item: GymRecord) => void;
}) {
  const phases: any[] = Array.isArray(roadmap.phases) ? roadmap.phases : [];
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() =>
    phases.length > 0 ? { [phases[0].order ?? 1]: true } : {},
  );
  const strategy = roadmap.strategy;
  const baseline = roadmap.baseline;

  const expandAll = () => {
    const next: Record<number, boolean> = {};
    phases.forEach((p, i) => {
      next[p.order ?? i + 1] = true;
    });
    setExpanded(next);
  };

  return (
    <ErpModal
      native
      title={roadmap.title || "Chi tiết lộ trình"}
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      <div className="max-h-[76dvh] space-y-4 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <HrStatusBadge dot tone={roadmap.status === "PUBLISHED" ? "success" : "warning"}>
              {roadmap.status === "PUBLISHED" ? "Đã công bố" : "Bản nháp"}
            </HrStatusBadge>
            {customerName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-0.5 font-medium text-on-surface">
                <User className="size-3" aria-hidden="true" />
                {customerName}
              </span>
            )}
            <span className="tabular-nums text-on-surface-variant">
              {roadmap.startDate && roadmap.endDate
                ? `${dateLabel(roadmap.startDate)} → ${dateLabel(roadmap.endDate)}`
                : `${phases.reduce((sum, phase) => sum + Number(phase.durationWeeks || 0), 0)} tuần`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                className={secondary}
                onClick={() => onEdit(roadmap)}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Chỉnh sửa
              </button>
            )}
            {onTogglePublish && (
              <button
                type="button"
                className={primary}
                onClick={() => onTogglePublish(roadmap)}
              >
                {roadmap.status === "PUBLISHED" ? "Gỡ công bố" : "Công bố roadmap"}
              </button>
            )}
          </div>
        </div>

        {roadmap.notes && (
          <p className="whitespace-pre-wrap text-pretty text-sm text-on-surface">
            {roadmap.notes}
          </p>
        )}

        {strategy?.sessionBudget && (
          <p className="rounded-md border border-outline-variant bg-surface-container-low/50 p-3 text-xs text-on-surface">
            Phân bổ mỗi buổi: khởi động{" "}
            <strong>{strategy.sessionBudget.warmupMinutes} phút</strong> · kháng lực{" "}
            <strong>{strategy.sessionBudget.strengthMinutes} phút</strong> · cardio{" "}
            <strong>{strategy.sessionBudget.cardioMinutes} phút</strong> · thả lỏng{" "}
            <strong>{strategy.sessionBudget.cooldownMinutes} phút</strong>.
          </p>
        )}

        {strategy && (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
              <span className="block text-[11px] text-on-surface-variant">
                Thời lượng kế hoạch
              </span>
              <strong className="mt-0.5 block text-sm font-semibold tabular-nums text-primary">
                {strategy.estimatedWeeks ||
                  phases.reduce((s, p) => s + Number(p.durationWeeks || 0), 0)}{" "}
                tuần · {strategy.sessionsPerWeek || 3} buổi/tuần
              </strong>
            </div>
            {strategy.nutrition && (
              <div className="rounded-md border border-change-up/30 bg-change-up/8 p-3">
                <span className="block text-[11px] text-change-up">Calo mục tiêu</span>
                <strong className="mt-0.5 block text-sm font-semibold tabular-nums text-change-up">
                  {strategy.nutrition.targetCalories ?? "—"} kcal/ngày
                </strong>
                <span className="text-[11px] tabular-nums text-on-surface-variant">
                  P {strategy.nutrition.proteinGrams ?? 0}g · C{" "}
                  {strategy.nutrition.carbsGrams ?? 0}g · F{" "}
                  {strategy.nutrition.fatGrams ?? 0}g
                </span>
              </div>
            )}
            {baseline && (
              <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
                <span className="block text-[11px] text-on-surface-variant">
                  Chỉ số ban đầu
                </span>
                <strong className="mt-0.5 block text-sm font-semibold tabular-nums text-on-surface">
                  {baseline.initialWeight ? `${baseline.initialWeight} kg` : "—"}
                </strong>
                <span className="text-[11px] tabular-nums text-on-surface-variant">
                  Mỡ: {baseline.initialBodyFat ? `${baseline.initialBodyFat}%` : "—"} ·
                  Cơ: {baseline.initialMuscleMass ? `${baseline.initialMuscleMass}kg` : "—"}
                </span>
              </div>
            )}
            {strategy.nutrition?.waterLiters && (
              <div className="rounded-md border border-primary/30 bg-primary/8 p-3">
                <span className="block text-[11px] text-primary">
                  Nước uống mỗi ngày
                </span>
                <strong className="mt-0.5 block text-sm font-semibold tabular-nums text-primary">
                  {strategy.nutrition.waterLiters} Lít / ngày
                </strong>
              </div>
            )}
          </div>
        )}

        {strategy && (
          <section className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface">
              <Target className="size-4 text-primary" aria-hidden="true" />
              Định hướng Phương pháp &amp; Dinh dưỡng
            </h3>
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              {(strategy.trainingMethod || strategy.trainingSplit) && (
                <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
                  <strong className="inline-flex items-center gap-1 text-primary">
                    <Zap className="size-3.5" aria-hidden="true" /> Phương pháp &amp; Lịch tập
                  </strong>
                  {strategy.trainingMethod && (
                    <p className="mt-1 text-on-surface">{strategy.trainingMethod}</p>
                  )}
                  {strategy.trainingSplit && (
                    <p className="mt-1 text-on-surface-variant">
                      <strong className="text-on-surface">Lịch:</strong>{" "}
                      {strategy.trainingSplit}
                    </p>
                  )}
                </div>
              )}
              {(strategy.cardioProtocol || strategy.cardioRecommendation) && (
                <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
                  <strong className="inline-flex items-center gap-1 text-error">
                    <HeartPulse className="size-3.5" aria-hidden="true" /> Chiến lược Cardio
                  </strong>
                  <p className="mt-1 text-on-surface">
                    {strategy.cardioProtocol || strategy.cardioRecommendation}
                  </p>
                </div>
              )}
            </div>
            {(strategy.nutrition?.advice || strategy.nutritionStrategy) && (
              <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-3 text-xs">
                <strong className="inline-flex items-center gap-1 text-change-up">
                  <Utensils className="size-3.5" aria-hidden="true" /> Lời khuyên dinh dưỡng
                </strong>
                <p className="mt-1 text-on-surface">
                  {strategy.nutrition?.advice || strategy.nutritionStrategy}
                </p>
              </div>
            )}
            {Array.isArray(strategy.checkpoints) && strategy.checkpoints.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-on-surface-variant">
                  Các mốc đánh giá &amp; Đo InBody (Checkpoints):
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {strategy.checkpoints.map((cp: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-md border border-primary/25 bg-primary/5 p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-primary">
                        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          Tuần {cp.week}: {cp.title}
                        </span>
                      </div>
                      {cp.description && (
                        <p className="mt-1 text-on-surface-variant">{cp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {phases.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                <Calendar className="size-4 text-primary" aria-hidden="true" />
                Chi tiết các Phase &amp; Mục tiêu từng tuần ({phases.length} Phase)
              </h3>
              <div className="flex gap-1.5">
                <button type="button" className={secondary} onClick={expandAll}>
                  Mở rộng tất cả
                </button>
                <button
                  type="button"
                  className={secondary}
                  onClick={() => setExpanded({})}
                >
                  Thu gọn
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {[...phases]
                .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
                .map((phase, idx) => {
                  const key = phase.order ?? idx + 1;
                  const open = Boolean(expanded[key]);
                  const goalsList = Array.isArray(phase.goals)
                    ? phase.goals
                    : phase.goals
                      ? [String(phase.goals)]
                      : [];
                  return (
                    <div
                      key={key}
                      className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest"
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                        className="flex w-full cursor-pointer items-center justify-between gap-2 bg-surface-container-low/60 px-3.5 py-2.5 text-left hover:bg-surface-container"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                            Phase {key}
                          </span>
                          <strong className="truncate text-sm font-semibold text-on-surface">
                            {phase.name || phase.title || `Giai đoạn ${key}`}
                          </strong>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs text-on-surface-variant">
                          <span className="tabular-nums">
                            {phase.durationWeeks
                              ? `${phase.durationWeeks} tuần`
                              : `${dateLabel(phase.startDate)} — ${dateLabel(phase.endDate)}`}
                          </span>
                          {open ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </div>
                      </button>
                      {open && (
                        <div className="space-y-2.5 border-t border-outline-variant p-3.5 text-xs">
                          {goalsList.length > 0 && (
                            <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-2.5">
                              <strong className="block text-primary">
                                Mục tiêu giai đoạn:
                              </strong>
                              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-on-surface">
                                {goalsList.map((g: string, gi: number) => (
                                  <li key={gi}>{g}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(phase.weeks) && phase.weeks.length > 0 && (
                            <div className="space-y-1.5">
                              {phase.weeks.map((w: any, wi: number) => (
                                <div
                                  key={wi}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant p-2.5"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                                      Tuần {w.week}
                                    </span>
                                    <span className="font-medium text-on-surface">
                                      {w.focus}
                                    </span>
                                  </div>
                                  <span className="rounded-full border border-outline-variant px-2 py-0.5 tabular-nums text-on-surface-variant">
                                    {w.sessionTargets ?? 3} buổi/tuần
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {phase.notes && (
                            <p className="text-on-surface-variant">{phase.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        )}
      </div>
    </ErpModal>
  );
}
