import React from "react";
import {
  FileText,
  Search,
  Filter,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  X,
} from "lucide-react";
import { superAdminAuditService, AuditFilters } from "../../services/superAdminAuditService";

interface AuditEvent {
  eventId: string;
  actionId?: string;
  actionType: string;
  riskClass: "read_only" | "standard" | "sensitive" | "dangerous";
  result: "success" | "partial" | "failure";
  actorSuperAdminId: string;
  actorEmail: string;
  actorDisplayName: string;
  effectiveUserId?: string;
  impersonationSessionId?: string;
  companyCode?: string;
  tenantId?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  taskId?: string;
  workflowId?: string;
  environment: "staging" | "production";
  reason?: string;
  sourceIp?: string;
  userAgent?: string;
  correlationId: string;
  before?: any;
  after?: any;
  backgroundJobId?: string;
  itemSummary?: { total: number; succeeded: number; failed: number };
  metadata?: any;
  occurredAt: string;
}

const translateRiskClass = (risk: string) => {
  switch (risk) {
    case "read_only":
      return "Chỉ đọc";
    case "standard":
      return "Thông thường";
    case "sensitive":
      return "Nhạy cảm";
    case "dangerous":
      return "Nguy hiểm";
    default:
      return risk;
  }
};

const translateResult = (res: string) => {
  switch (res) {
    case "success":
      return "Thành công";
    case "partial":
      return "Một phần";
    case "failure":
      return "Thất bại";
    default:
      return res;
  }
};

const translateEnvironment = (env: string) => {
  switch (env) {
    case "staging":
      return "Thử nghiệm (Staging)";
    case "production":
      return "Thực tế (Production)";
    default:
      return env;
  }
};

export function AuditTab() {
  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Filters state
  const [filters, setFilters] = React.useState<AuditFilters>({
    companyCode: "",
    environment: "",
    riskClass: "",
    result: "",
    actionType: "",
    correlationId: "",
    tenantId: "",
    entityType: "",
    entityId: "",
    projectId: "",
    taskId: "",
    workflowId: "",
    startDate: "",
    endDate: "",
  });

  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalItems, setTotalItems] = React.useState(0);

  // Selected event for detail modal
  const [selectedEvent, setSelectedEvent] = React.useState<AuditEvent | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);

  const fetchEvents = async (pageNumber = 1) => {
    setLoading(true);
    setError("");
    try {
      const result = await superAdminAuditService.queryEvents(filters, pageNumber, limit);
      setEvents(result.events || []);
      setTotalPages(result.pages || 1);
      setTotalItems(result.total || 0);
      setPage(pageNumber);
    } catch (e: any) {
      setError(e.message || "Lỗi khi tải nhật ký kiểm toán.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      companyCode: "",
      environment: "",
      riskClass: "",
      result: "",
      actionType: "",
      correlationId: "",
      tenantId: "",
      entityType: "",
      entityId: "",
      projectId: "",
      taskId: "",
      workflowId: "",
      startDate: "",
      endDate: "",
    });
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents(1);
  };

  React.useEffect(() => {
    fetchEvents(1);
  }, []);

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "dangerous":
        return "bg-red-500/10 text-red-400 border border-red-500/20";
      case "sensitive":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "standard":
        return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
      case "read_only":
      default:
        return "bg-green-500/10 text-green-400 border border-green-500/20";
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case "success":
        return "bg-green-500/10 text-green-400 border border-green-500/20";
      case "partial":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "failure":
      default:
        return "bg-red-500/10 text-red-400 border border-red-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-cyan-400" />
            Nhật ký kiểm toán (Audit Logs)
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Tra cứu và giám sát toàn bộ các hành động thay đổi dữ liệu của Super Admin.
          </p>
        </div>
      </div>

      {/* Filters Form */}
      <form onSubmit={handleSearchSubmit} className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Filter className="h-4 w-4 text-cyan-400" />
            <span>Bộ lọc tìm kiếm</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-all"
          >
            <Filter className="h-3.5 w-3.5" />
            {showAdvancedFilters ? "Ẩn bộ lọc" : "Bộ lọc nâng cao"}
          </button>
        </div>
        {/* Primary filters - always visible */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Loại hành động</label>
            <input
              type="text"
              name="actionType"
              placeholder="VD: security.login"
              className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              value={filters.actionType}
              onChange={handleFilterChange}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Mã doanh nghiệp</label>
            <input
              type="text"
              name="companyCode"
              placeholder="VD: SYSTEM"
              className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              value={filters.companyCode}
              onChange={handleFilterChange}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Mức độ rủi ro</label>
            <select
              name="riskClass"
              className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              value={filters.riskClass}
              onChange={handleFilterChange}
            >
              <option value="">Tất cả</option>
              <option value="read_only">Chỉ đọc</option>
              <option value="standard">Thông thường</option>
              <option value="sensitive">Nhạy cảm</option>
              <option value="dangerous">Nguy hiểm</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Kết quả</label>
            <select
              name="result"
              className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              value={filters.result}
              onChange={handleFilterChange}
            >
              <option value="">Tất cả</option>
              <option value="success">Thành công</option>
              <option value="partial">Thành công một phần</option>
              <option value="failure">Thất bại</option>
            </select>
          </div>
        </div>

        {/* Advanced filters - collapsible */}
        {showAdvancedFilters && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 pt-2 border-t border-white/10">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Mã tham chiếu</label>
              <input type="text" name="correlationId" value={filters.correlationId} onChange={handleFilterChange} placeholder="VD: corr-123" className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Loại thực thể</label>
              <input type="text" name="entityType" value={filters.entityType} onChange={handleFilterChange} placeholder="VD: task" className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Mã thực thể</label>
              <input type="text" name="entityId" value={filters.entityId} onChange={handleFilterChange} placeholder="VD: task-123" className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Mã dự án</label>
              <input type="text" name="projectId" value={filters.projectId} onChange={handleFilterChange} placeholder="VD: project-123" className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Mã công việc</label>
              <input type="text" name="taskId" value={filters.taskId} onChange={handleFilterChange} placeholder="VD: task-123" className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Mã quy trình</label>
              <input type="text" name="workflowId" value={filters.workflowId} onChange={handleFilterChange} placeholder="VD: workflow-123" className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Môi trường</label>
              <select
                name="environment"
                className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                value={filters.environment}
                onChange={handleFilterChange}
              >
                <option value="">Tất cả</option>
                <option value="staging">Thử nghiệm</option>
                <option value="production">Thực tế</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Từ ngày</label>
              <input
                type="date"
                name="startDate"
                className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Đến ngày</label>
              <input
                type="date"
                name="endDate"
                className="w-full rounded-xl bg-slate-850 border border-white/10 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleClearFilters}
            className="flex-1 rounded-xl border border-white/10 bg-slate-800 hover:bg-slate-700 p-2.5 text-sm font-semibold text-slate-300 transition-all"
          >
            Xóa lọc
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 p-2.5 text-sm font-bold text-slate-950 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Tìm kiếm
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Results Table */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm sm:min-w-[720px]">
            <thead className="bg-slate-950/40 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
              <tr>
                <th className="p-4">Thời gian</th>
                <th className="p-4">Hành động</th>
                <th className="p-4">Super Admin</th>
                <th className="p-4">Tenant</th>
                <th className="p-4">Rủi ro</th>
                <th className="p-4 text-center">Kết quả</th>
                <th className="p-4 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((event) => (
                <tr key={event.eventId} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-semibold text-slate-300 whitespace-nowrap">
                    <span className="block text-xs font-bold">
                      {new Date(event.occurredAt).toLocaleDateString("vi-VN")}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(event.occurredAt).toLocaleTimeString("vi-VN")}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-xs font-bold text-white block">{event.actionType}</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                      IP: {event.sourceIp || "N/A"}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-200 block truncate max-w-[150px]" title={event.actorEmail}>
                      {event.actorDisplayName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                      {event.actorEmail}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-400 font-mono">
                    {event.companyCode || "N/A"}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${getRiskBadge(event.riskClass)}`}>
                      {translateRiskClass(event.riskClass)}
                    </span>
                  </td>
                  <td className="p-4 text-center whitespace-nowrap">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${getResultBadge(event.result)}`}>
                      {translateResult(event.result)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => setSelectedEvent(event)}
                      className="rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-white/10 p-2 text-cyan-400 transition-all"
                      title="Xem chi tiết"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    Không tìm thấy bản ghi nhật ký kiểm toán nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 bg-slate-950/20">
            <div className="text-xs text-slate-400">
              Hiển thị <span className="font-semibold text-white">{(page - 1) * limit + 1}</span> đến{" "}
              <span className="font-semibold text-white">
                {Math.min(page * limit, totalItems)}
              </span>{" "}
              trong tổng số <span className="font-semibold text-white">{totalItems}</span> bản ghi
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchEvents(page - 1)}
                disabled={page === 1 || loading}
                className="rounded-lg border border-white/10 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 p-2 text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-400">
                Trang <span className="font-semibold text-white">{page}</span> / {totalPages}
              </span>
              <button
                onClick={() => fetchEvents(page + 1)}
                disabled={page === totalPages || loading}
                className="rounded-lg border border-white/10 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 p-2 text-slate-300"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-3xl rounded-t-3xl sm:rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 rounded-xl border border-white/10 bg-slate-800 hover:bg-slate-700 p-2 text-slate-400 hover:text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-4">
              <Shield className="h-5 w-5 text-cyan-400" />
              <h4 className="text-lg font-black text-white">Chi tiết sự kiện kiểm toán</h4>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {/* Event basic details grid */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 text-xs bg-slate-950/30 p-4 rounded-2xl border border-white/5">
                <div>
                  <span className="text-slate-500 block">Mã sự kiện (Event ID)</span>
                  <span className="font-mono text-slate-300">{selectedEvent.eventId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Loại hành động</span>
                  <span className="font-mono text-slate-300 font-bold">{selectedEvent.actionType}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Thời gian xảy ra</span>
                  <span className="text-slate-300 font-semibold">
                    {new Date(selectedEvent.occurredAt).toLocaleString("vi-VN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Super Admin</span>
                  <span className="text-slate-300 font-semibold">{selectedEvent.actorDisplayName}</span>
                  <span className="text-[10px] text-slate-500 font-mono block">{selectedEvent.actorEmail}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Mã Doanh nghiệp</span>
                  <span className="text-slate-300 font-bold">{selectedEvent.companyCode || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Môi trường</span>
                  <span className="text-slate-300 font-semibold">{translateEnvironment(selectedEvent.environment)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Mức rủi ro / Kết quả</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${getRiskBadge(selectedEvent.riskClass)}`}>
                      {translateRiskClass(selectedEvent.riskClass)}
                    </span>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${getResultBadge(selectedEvent.result)}`}>
                      {translateResult(selectedEvent.result)}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block">IP người thực hiện</span>
                  <span className="text-slate-300 font-mono">{selectedEvent.sourceIp || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Mã liên kết (Correlation ID)</span>
                  <span className="font-mono text-slate-400">{selectedEvent.correlationId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Dự án / Công việc / Quy trình</span>
                  <span className="font-mono text-slate-400">{selectedEvent.projectId || "N/A"} / {selectedEvent.taskId || "N/A"} / {selectedEvent.workflowId || "N/A"}</span>
                </div>
              </div>

              {selectedEvent.reason && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">Lý do thực hiện</span>
                  <div className="bg-slate-950/20 border border-white/5 rounded-xl p-3 text-xs italic text-slate-300">
                    "{selectedEvent.reason}"
                  </div>
                </div>
              )}

              {/* Data snapshots */}
              {selectedEvent.before && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">Dữ liệu TRƯỚC thay đổi (Before)</span>
                  <pre className="bg-slate-950 p-4 rounded-2xl text-[10px] font-mono text-emerald-400 overflow-x-auto border border-white/5 max-h-[150px]">
                    {JSON.stringify(selectedEvent.before, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEvent.after && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">Dữ liệu SAU thay đổi (After)</span>
                  <pre className="bg-slate-950 p-4 rounded-2xl text-[10px] font-mono text-cyan-400 overflow-x-auto border border-white/5 max-h-[150px]">
                    {JSON.stringify(selectedEvent.after, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">Dữ liệu bổ sung (Metadata)</span>
                  <pre className="bg-slate-950 p-4 rounded-2xl text-[10px] font-mono text-slate-400 overflow-x-auto border border-white/5 max-h-[150px]">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4 text-right">
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-white/10 px-6 py-2.5 text-xs font-bold text-white transition-all"
              >
                Đóng hộp thoại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
