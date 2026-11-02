import React from "react";
import { ChartColumn, Download, RefreshCw, Store } from "lucide-react";
import { retailReportsApi } from "../api/retailReports.api";
import RetailKpiGrid from "../components/reports/RetailKpiGrid";
import RetailReportFilters from "../components/reports/RetailReportFilters";
import RetailReportTables from "../components/reports/RetailReportTables";
import RetailSalesCharts from "../components/reports/RetailSalesCharts";
import { validateRetailReportRange } from "../components/reports/retailReportRange";
import { useRetailScope } from "../hooks/useRetailScope";
import { useBranchOptional } from "../../../context/BranchContext";
import type { RetailReport, RetailReportFilters as RetailReportFilterValue } from "../types";

const REPORT_PRESET_PARAM = "reportPreset";
const REPORT_FROM_PARAM = "reportFrom";
const REPORT_TO_PARAM = "reportTo";
const DIMENSION_PARAMS = {
  salespersonId: "reportSalesperson",
  productId: "reportProduct",
  sku: "reportSku",
  category: "reportCategory",
  brand: "reportBrand",
} as const;

function readFiltersFromUrl(): RetailReportFilterValue {
  const params = new URLSearchParams(window.location.search);
  const preset = params.get(REPORT_PRESET_PARAM);
  const from = params.get(REPORT_FROM_PARAM);
  const to = params.get(REPORT_TO_PARAM);
  let filters: RetailReportFilterValue = {};

  if ((preset === "7d" || preset === "30d") && !from && !to) {
    filters = { preset };
  } else if (!preset && from && to && !validateRetailReportRange(from, to)) {
    filters = { from, to };
  }

  for (const [key, param] of Object.entries(DIMENSION_PARAMS) as Array<[keyof typeof DIMENSION_PARAMS, string]>) {
    const value = params.get(param)?.trim();
    if (value) (filters as any)[key] = value;
  }
  return filters;
}

function writeFiltersToUrl(filters: RetailReportFilterValue) {
  const url = new URL(window.location.href);
  url.searchParams.delete(REPORT_PRESET_PARAM);
  url.searchParams.delete(REPORT_FROM_PARAM);
  url.searchParams.delete(REPORT_TO_PARAM);
  for (const param of Object.values(DIMENSION_PARAMS)) url.searchParams.delete(param);

  if (filters.preset === "7d" || filters.preset === "30d") {
    url.searchParams.set(REPORT_PRESET_PARAM, filters.preset);
  } else if ("from" in filters && typeof filters.from === "string" && typeof filters.to === "string") {
    url.searchParams.set(REPORT_FROM_PARAM, filters.from);
    url.searchParams.set(REPORT_TO_PARAM, filters.to);
  }
  for (const [key, param] of Object.entries(DIMENSION_PARAMS) as Array<[keyof typeof DIMENSION_PARAMS, string]>) {
    const value = filters[key]?.trim();
    if (value) url.searchParams.set(param, value);
  }

  window.history.replaceState(window.history.state, "", url.toString());
}

function vietnamToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function filterKey(filters: RetailReportFilterValue): string {
  return JSON.stringify(filters);
}

function RetailReportsSkeleton() {
  return (
    <div role="status" aria-label="Đang tải báo cáo" className="space-y-5" aria-live="polite">
      <span className="sr-only">Đang tải báo cáo...</span>
      <div className="grid animate-pulse gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-32 rounded-3xl border border-slate-200/80 bg-white p-4">
            <div className="h-9 w-9 rounded-2xl bg-slate-100 mb-3" />
            <div className="h-3 w-20 rounded bg-slate-100 mb-2" />
            <div className="h-6 w-28 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid animate-pulse gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="h-80 rounded-3xl border border-slate-200/80 bg-white p-6">
          <div className="h-6 w-44 rounded-lg bg-slate-100 mb-4" />
          <div className="h-56 rounded-2xl bg-slate-100" />
        </div>
        <div className="h-80 rounded-3xl border border-slate-200/80 bg-white p-6">
          <div className="h-6 w-36 rounded-lg bg-slate-100 mb-4" />
          <div className="h-56 rounded-2xl bg-slate-100" />
        </div>
      </div>
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-56 rounded-3xl border border-slate-200/80 bg-white p-6">
            <div className="h-5 w-40 rounded-lg bg-slate-100 mb-4" />
            <div className="h-32 rounded-2xl bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RetailReportsPage() {
  const { scope: workingScope, userProfile, branchName: scopeBranchName, activeBranch: scopeBranch } = useRetailScope() as any;
  const branchContext = useBranchOptional();
  const canSelectBranches = userProfile?.role === "admin" || userProfile?.role === "superadmin";
  const [reportBranch, setReportBranch] = React.useState<{ workingKey: string; id: string } | null>(null);
  const workingKey = workingScope ? workingScope.companyCode + ":" + workingScope.branchId : "";
  const selectedBranch = canSelectBranches && reportBranch?.workingKey === workingKey ? reportBranch.id : workingScope?.branchId;
  const scope = workingScope ? { ...workingScope, branchId: selectedBranch } : null;
  const branchOptions = branchContext?.branches?.length ? branchContext.branches : workingScope ? [{ _id: workingScope.branchId, name: scopeBranchName || workingScope.branchId }] : [];
  const activeBranch =
    scopeBranch ||
    branchContext?.activeBranch ||
    branchContext?.branches?.find((b) => b._id === scope?.branchId);
  const rawBranchName = branchOptions.find(branch => branch._id === selectedBranch)?.name || activeBranch?.name || scopeBranchName;
  const branchDisplayName = selectedBranch === "all" ? "Tất cả chi nhánh" : rawBranchName
    ? (rawBranchName.toLowerCase().startsWith("chi nhánh") ? rawBranchName : `Chi nhánh: ${rawBranchName}`)
    : (scope ? (/^[0-9a-fA-F]{24}$/.test(scope.branchId) ? "Chi nhánh hiện tại" : `Chi nhánh: ${scope.branchId}`) : "");
  const [filters, setFilters] = React.useState<RetailReportFilterValue>(readFiltersFromUrl);
  const [report, setReport] = React.useState<RetailReport | null>(null);
  const [reportScopeKey, setReportScopeKey] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<{ scopeKey: string; message: string } | null>(null);
  const [exportError, setExportError] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);
  const requestSequence = React.useRef(0);
  const summaryLoadingRef = React.useRef(false);
  const exportSequence = React.useRef(0);
  const exportController = React.useRef<AbortController | null>(null);
  const scopeKey = scope ? `${scope.companyCode}:${scope.branchId}` : "";
  const exportContextKey = `${scopeKey}|${filterKey(filters)}`;
  const exportContextKeyRef = React.useRef("");
  const visibleReport = scopeKey && reportScopeKey === scopeKey ? report : null;
  const visibleLoadError = loadError?.scopeKey === scopeKey ? loadError.message : "";

  React.useLayoutEffect(() => {
    writeFiltersToUrl(filters);
  }, [filters]);

  React.useLayoutEffect(() => {
    exportSequence.current += 1;
    exportController.current?.abort();
    exportController.current = null;
    exportContextKeyRef.current = exportContextKey;
    setExporting(false);
    setExportError("");

    return () => {
      exportSequence.current += 1;
      exportController.current?.abort();
      exportController.current = null;
    };
  }, [exportContextKey]);

  React.useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible" || !scopeKey || summaryLoadingRef.current) return;
      setReloadToken((value) => value + 1);
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [scopeKey]);

  React.useEffect(() => {
    const requestId = ++requestSequence.current;
    if (!scope) {
      summaryLoadingRef.current = false;
      setLoading(false);
      setLoadError(null);
      return undefined;
    }

    const requestedScopeKey = `${scope.companyCode}:${scope.branchId}`;
    summaryLoadingRef.current = true;
    setLoading(true);
    setLoadError(null);
    void retailReportsApi
      .summary(scope, filters)
      .then((nextReport) => {
        if (requestSequence.current !== requestId) return;
        setReport(nextReport);
        setReportScopeKey(requestedScopeKey);
      })
      .catch((cause) => {
        if (requestSequence.current !== requestId) return;
        setLoadError({
          scopeKey: requestedScopeKey,
          message: errorMessage(cause, "Không tải được báo cáo bán hàng."),
        });
      })
      .finally(() => {
        if (requestSequence.current === requestId) {
          summaryLoadingRef.current = false;
          setLoading(false);
        }
      });

    return () => {
      if (requestSequence.current === requestId) requestSequence.current += 1;
    };
  }, [scope?.companyCode, scope?.branchId, filters, reloadToken]);

  const changeFilters = (nextFilters: RetailReportFilterValue) => {
    setFilters(nextFilters);
  };

  const exportReport = async () => {
    if (!scope || exporting) return;
    exportController.current?.abort();
    const controller = new AbortController();
    exportController.current = controller;
    const requestId = ++exportSequence.current;
    const requestedContextKey = exportContextKeyRef.current;
    setExporting(true);
    setExportError("");
    try {
      await retailReportsApi.export(scope, filters, controller.signal);
    } catch (cause) {
      if (
        exportSequence.current !== requestId ||
        exportContextKeyRef.current !== requestedContextKey ||
        controller.signal.aborted
      )
        return;
      setExportError(errorMessage(cause, "Không xuất được báo cáo Excel."));
    } finally {
      if (exportSequence.current === requestId && exportContextKeyRef.current === requestedContextKey) {
        if (exportController.current === controller) exportController.current = null;
        setExporting(false);
      }
    }
  };

  if (!scope) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-amber-200 bg-amber-50/70 p-12 text-center text-amber-800">
        <Store className="mb-3 h-10 w-10 text-amber-500" />
        <p className="font-bold text-sm">Vui lòng chọn chi nhánh để xem báo cáo.</p>
      </div>
    );
  }

  return (
    <section className="space-y-3.5" aria-busy={loading}>
      {/* Top Header Card with integrated Branch Selector */}
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-xs">
            <ChartColumn className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900">Báo cáo bán hàng</h1>
              {branchDisplayName && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50/80 px-2 py-0.5 text-xs font-semibold text-cyan-800">
                  <Store className="h-3 w-3" />
                  {branchDisplayName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Branch selector inline */}
            <select
              id="report-branch"
              aria-label="Chi nhánh báo cáo"
              value={selectedBranch || ""}
              disabled={!canSelectBranches || branchContext?.loading}
              onChange={event => setReportBranch({ workingKey, id: event.target.value })}
              className="text-xs font-medium text-slate-800 outline-none cursor-pointer disabled:opacity-50"
            >
              {canSelectBranches && <option value="all">Tất cả chi nhánh</option>}
              {branchOptions.map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
            </select>

          <button
            type="button"
            aria-label="Tải lại báo cáo"
            disabled={loading}
            onClick={() => setReloadToken((value) => value + 1)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-600" : ""}`}
            />
            <span>Tải lại</span>
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportReport()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            <span>{exporting ? "Đang xuất..." : "Xuất Excel"}</span>
          </button>
        </div>
      </header>

      {/* Date & Dimension Filter Bar */}
      <RetailReportFilters
        filters={filters}
        currentRange={visibleReport?.range}
        today={vietnamToday()}
        onChange={changeFilters}
      />

      {/* Load Error Alert */}
      {visibleLoadError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="font-semibold">{visibleLoadError}</span>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="shrink-0 rounded-xl bg-white px-3.5 py-1.5 font-bold text-red-700 shadow-xs border border-red-200 hover:bg-red-50 cursor-pointer"
          >
            Thử tải lại
          </button>
        </div>
      )}

      {/* Export Error Alert */}
      {exportError && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800"
        >
          {exportError}
        </div>
      )}

      {/* Skeleton Loading State */}
      {!visibleReport && !visibleLoadError && <RetailReportsSkeleton />}

      {/* Empty / Error State */}
      {!visibleReport && visibleLoadError && (
        <div className="rounded-3xl border border-slate-200/80 bg-white px-5 py-16 text-center text-xs text-slate-500">
          Chưa thể hiển thị dữ liệu báo cáo. Hãy thử tải lại.
        </div>
      )}

      {/* Main Report Dashboard Content */}
      {visibleReport && (
        <div className="space-y-5">
          {loading && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-600 animate-ping" />
              <p role="status" className="text-xs font-bold text-cyan-700">
                Đang cập nhật dữ liệu...
              </p>
            </div>
          )}
          <RetailKpiGrid report={visibleReport} />
          <RetailSalesCharts report={visibleReport} />
          <RetailReportTables report={visibleReport} />
        </div>
      )}
    </section>
  );
}
