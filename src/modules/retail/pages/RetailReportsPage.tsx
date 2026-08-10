import React from "react";
import { BellRing, Download, RefreshCw } from "lucide-react";
import { retailReportsApi } from "../api/retailReports.api";
import RetailKpiGrid from "../components/reports/RetailKpiGrid";
import RetailReportFilters from "../components/reports/RetailReportFilters";
import RetailReportTables from "../components/reports/RetailReportTables";
import RetailSalesCharts from "../components/reports/RetailSalesCharts";
import { validateRetailReportRange } from "../components/reports/retailReportRange";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailReport, RetailReportFilters as RetailReportFilterValue } from "../types";

const REPORT_PRESET_PARAM = "reportPreset";
const REPORT_FROM_PARAM = "reportFrom";
const REPORT_TO_PARAM = "reportTo";

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

  return filters;
}

function writeFiltersToUrl(filters: RetailReportFilterValue) {
  const url = new URL(window.location.href);
  url.searchParams.delete(REPORT_PRESET_PARAM);
  url.searchParams.delete(REPORT_FROM_PARAM);
  url.searchParams.delete(REPORT_TO_PARAM);

  if (filters.preset === "7d" || filters.preset === "30d") {
    url.searchParams.set(REPORT_PRESET_PARAM, filters.preset);
  } else if ("from" in filters && typeof filters.from === "string" && typeof filters.to === "string") {
    url.searchParams.set(REPORT_FROM_PARAM, filters.from);
    url.searchParams.set(REPORT_TO_PARAM, filters.to);
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
  if (filters.preset === "7d" || filters.preset === "30d") return filters.preset;
  if ("from" in filters && filters.from && filters.to) return `${filters.from}:${filters.to}`;
  return "today";
}

function RetailReportsSkeleton() {
  return (
    <div role="status" aria-label="Đang tải báo cáo" className="space-y-4" aria-live="polite">
      <span className="sr-only">Đang tải báo cáo...</span>
      <div className="grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 rounded-2xl border border-slate-200 bg-white"><div className="m-4 h-4 w-24 rounded bg-slate-100" /><div className="mx-4 mt-8 h-7 w-32 rounded bg-slate-100" /></div>)}
      </div>
      <div className="grid animate-pulse gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="h-80 rounded-2xl border border-slate-200 bg-white p-5"><div className="h-full rounded-xl bg-slate-100" /></div>
        <div className="h-80 rounded-2xl border border-slate-200 bg-white p-5"><div className="h-full rounded-xl bg-slate-100" /></div>
      </div>
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-56 rounded-2xl border border-slate-200 bg-white p-5"><div className="h-5 w-40 rounded bg-slate-100" /><div className="mt-6 h-32 rounded-xl bg-slate-100" /></div>)}
      </div>
    </div>
  );
}

export default function RetailReportsPage() {
  const { scope, userProfile } = useRetailScope();
  const [filters, setFilters] = React.useState<RetailReportFilterValue>(readFiltersFromUrl);
  const [report, setReport] = React.useState<RetailReport | null>(null);
  const [reportScopeKey, setReportScopeKey] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<{ scopeKey: string; message: string } | null>(null);
  const [exportError, setExportError] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [reminding, setReminding] = React.useState(false);
  const [reminderMessage, setReminderMessage] = React.useState("");
  const [reloadToken, setReloadToken] = React.useState(0);
  const requestSequence = React.useRef(0);
  const exportSequence = React.useRef(0);
  const exportController = React.useRef<AbortController | null>(null);
  const scopeKey = scope ? `${scope.companyCode}:${scope.branchId}` : "";
  const exportContextKey = `${scopeKey}|${filterKey(filters)}`;
  const exportContextKeyRef = React.useRef("");
  const visibleReport = scopeKey && reportScopeKey === scopeKey ? report : null;
  const visibleLoadError = loadError?.scopeKey === scopeKey ? loadError.message : "";
  const manager = userProfile?.role === "admin" || userProfile?.role === "superadmin" || userProfile?.permissions?.some((permission) => permission === "*" || permission === "retail:manager");

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
    const requestId = ++requestSequence.current;
    if (!scope) {
      setLoading(false);
      setLoadError(null);
      return undefined;
    }

    const requestedScopeKey = `${scope.companyCode}:${scope.branchId}`;
    setLoading(true);
    setLoadError(null);
    void retailReportsApi.summary(scope, filters)
      .then((nextReport) => {
        if (requestSequence.current !== requestId) return;
        setReport(nextReport);
        setReportScopeKey(requestedScopeKey);
      })
      .catch((cause) => {
        if (requestSequence.current !== requestId) return;
        setLoadError({ scopeKey: requestedScopeKey, message: errorMessage(cause, "Không tải được báo cáo bán lẻ.") });
      })
      .finally(() => {
        if (requestSequence.current === requestId) setLoading(false);
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
      if (exportSequence.current !== requestId || exportContextKeyRef.current !== requestedContextKey || controller.signal.aborted) return;
      setExportError(errorMessage(cause, "Không xuất được báo cáo Excel."));
    } finally {
      if (exportSequence.current === requestId && exportContextKeyRef.current === requestedContextKey) {
        if (exportController.current === controller) exportController.current = null;
        setExporting(false);
      }
    }
  };

  const remindOverdueDebt = async () => {
    if (!scope || reminding) return;
    setReminding(true);
    setReminderMessage("");
    try {
      const result = await retailReportsApi.remindOverdueDebt(scope);
      setReminderMessage(result.created > 0
        ? `Đã tạo ${result.created} thông báo cho ${result.overdueOrders} đơn quá hạn.`
        : `Không có thông báo mới; ${result.duplicates} lượt đã được nhắc hôm nay.`);
    } catch (cause) {
      setReminderMessage(errorMessage(cause, "Không thể tạo thông báo công nợ."));
    } finally {
      setReminding(false);
    }
  };

  if (!scope) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">Vui lòng chọn chi nhánh để xem báo cáo.</div>;
  }

  return (
    <section className="space-y-4" aria-busy={loading}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Báo cáo bán lẻ</h1>
          <p className="text-sm text-slate-500">Doanh thu, thanh toán, ca bán hàng và công nợ của chi nhánh hiện tại.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {manager && <button
            type="button"
            disabled={reminding}
            onClick={() => void remindOverdueDebt()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-bold text-amber-800 shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BellRing aria-hidden="true" className="h-4 w-4" />
            {reminding ? "Đang nhắc..." : "Nhắc công nợ"}
          </button>}
          <button
            type="button"
            aria-label="Tải lại báo cáo"
            disabled={loading}
            onClick={() => setReloadToken((value) => value + 1)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Tải lại
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportReport()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
        </div>
      </header>

      <RetailReportFilters filters={filters} currentRange={visibleReport?.range} today={vietnamToday()} onChange={changeFilters} />

      {visibleLoadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{visibleLoadError}</span>
          <button type="button" onClick={() => setReloadToken((value) => value + 1)} className="shrink-0 rounded-lg bg-white px-3 py-1.5 font-bold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100">
            Thử tải lại
          </button>
        </div>
      )}

      {exportError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{exportError}</div>}
      {reminderMessage && <div role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800">{reminderMessage}</div>}

      {!visibleReport && !visibleLoadError && <RetailReportsSkeleton />}

      {!visibleReport && visibleLoadError && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
          Chưa thể hiển thị dữ liệu báo cáo. Hãy thử tải lại.
        </div>
      )}

      {visibleReport && (
        <>
          {loading && <p role="status" className="text-xs font-semibold text-cyan-700">Đang cập nhật dữ liệu...</p>}
          <RetailKpiGrid report={visibleReport} />
          <RetailSalesCharts report={visibleReport} />
          <RetailReportTables report={visibleReport} />
        </>
      )}
    </section>
  );
}
