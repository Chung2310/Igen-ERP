import React from "react";
import {
  Users,
  Building,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Server,
  Activity,
  Calendar,
  RefreshCw,
  Clock,
} from "lucide-react";
import { superAdminDashboardService } from "../../services/superAdminDashboardService";

interface TenantFinance {
  companyCode: string;
  companyName: string;
  revenue: number;
  usage: number;
  balance: number;
}

interface HealthStatus {
  api: string;
  database: string;
  redis: string;
  queues: string;
  storage: string;
  socketIo: string;
}

interface SecurityAlert {
  id: string;
  type: string;
  message: string;
  occurredAt: string;
}

interface RecentActivity {
  id: string;
  actionType: string;
  actorEmail: string;
  result: string;
  occurredAt: string;
  sourceIp: string;
}

interface DashboardData {
  counts: {
    tenants: { total: number; active: number; suspended: number };
    users: number;
    activeSessions: number;
    lockedAccounts: number;
  };
  finance: {
    totalWalletBalance: number;
    totalRevenue: number;
    totalUsage: number;
    revenueByTenant: TenantFinance[];
  };
  health: HealthStatus;
  securityAlerts: SecurityAlert[];
  recentActivity: RecentActivity[];
}

export function DashboardTab() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  const fetchSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const summary = await superAdminDashboardService.getSummary(
        startDate || undefined,
        endDate || undefined
      );
      setData(summary);
    } catch (e: any) {
      setError(e.message || "Lỗi khi lấy dữ liệu tổng hợp.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  React.useEffect(() => {
    fetchSummary();
  }, [startDate, endDate]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
        <span>Đang tổng hợp dữ liệu hệ thống...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-300">
        <p className="font-bold">Lỗi tải dữ liệu</p>
        <p className="mt-2 text-sm">{error}</p>
        <button
          onClick={fetchSummary}
          className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700 active:bg-slate-900 border border-white/10"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const counts = data?.counts;
  const finance = data?.finance;
  const health = data?.health;
  const alerts = data?.securityAlerts || [];
  const activities = data?.recentActivity || [];

  const getHealthBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 text-xs font-bold text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Hoạt động
          </span>
        );
      case "unhealthy":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Lỗi kết nối
          </span>
        );
      case "unknown":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 border border-slate-500/20 px-2.5 py-0.5 text-xs font-bold text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Không rõ
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header and Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Server className="h-6 w-6 text-cyan-400" />
            Tổng quan hệ thống
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Theo dõi trạng thái sức khỏe, số liệu tài chính và hoạt động vận hành hệ thống.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-white/10 px-3 py-1.5">
            <Calendar className="h-4 w-4 text-slate-500" />
            <input
              type="date"
              className="bg-transparent text-xs text-white focus:outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-slate-500 text-xs">đến</span>
            <input
              type="date"
              className="bg-transparent text-xs text-white focus:outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={handleClearFilter}
              className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Xóa lọc
            </button>
          )}
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Counts Grid */}
      {counts && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-xl flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Doanh nghiệp</p>
              <h4 className="text-3xl font-black text-white">{counts.tenants.total}</h4>
              <div className="flex items-center gap-2 text-[10px] font-semibold mt-2">
                <span className="text-green-400">{counts.tenants.active} hoạt động</span>
                <span className="text-slate-500">•</span>
                <span className="text-red-400">{counts.tenants.suspended} tạm khóa</span>
              </div>
            </div>
            <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-3.5 text-blue-400">
              <Building className="h-6 w-6" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-xl flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Thành viên</p>
              <h4 className="text-3xl font-black text-white">{counts.users}</h4>
              <p className="text-[10px] text-slate-500 mt-2">Toàn bộ doanh nghiệp</p>
            </div>
            <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3.5 text-indigo-400">
              <Users className="h-6 w-6" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-xl flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Phiên quản trị viên</p>
              <h4 className="text-3xl font-black text-white">{counts.activeSessions}</h4>
              <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Đang trực tuyến
              </p>
            </div>
            <div className="rounded-2xl bg-cyan-500/10 border border-cyan-500/20 p-3.5 text-cyan-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-xl flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tài khoản bị khóa</p>
              <h4 className={`text-3xl font-black ${counts.lockedAccounts > 0 ? "text-red-400" : "text-white"}`}>
                {counts.lockedAccounts}
              </h4>
              <p className="text-[10px] text-slate-500 mt-2">Yêu cầu mở khóa bảo mật</p>
            </div>
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3.5 text-red-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </div>
        </div>
      )}

      {/* Finance & System Health */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Financial Cards */}
        {finance && (
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-400" />
              Tổng quan Tài chính & Tín dụng
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Số dư ví khả dụng</p>
                <p className="text-xl font-black text-white mt-1">
                  {finance.totalWalletBalance.toLocaleString("vi-VN")}
                  <span className="text-xs text-slate-400 ml-1">USD</span>
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  Doanh thu nạp
                  <ArrowUpRight className="h-3 w-3 text-green-400" />
                </p>
                <p className="text-xl font-black text-green-400 mt-1">
                  +{finance.totalRevenue.toLocaleString("vi-VN")}
                  <span className="text-xs ml-1 text-green-500">USD</span>
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  Chi tiêu sử dụng
                  <ArrowDownLeft className="h-3 w-3 text-cyan-400" />
                </p>
                <p className="text-xl font-black text-cyan-400 mt-1">
                  -{finance.totalUsage.toLocaleString("vi-VN")}
                  <span className="text-xs ml-1 text-cyan-500">tín dụng</span>
                </p>
              </div>
            </div>

            {/* Tenant finance breakdown table */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/30 overflow-hidden">
              <div className="p-4 border-b border-white/10 bg-slate-950/20">
                <h5 className="text-sm font-bold text-white">Thống kê theo Doanh nghiệp</h5>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/60 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/5">
                    <tr>
                      <th className="p-3">Doanh nghiệp</th>
                      <th className="p-3 text-right">Tổng nạp (USD)</th>
                      <th className="p-3 text-right">Tổng chi (tín dụng)</th>
                      <th className="p-3 text-right">Số dư ví (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {finance.revenueByTenant.map((tenant) => (
                      <tr key={tenant.companyCode} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-semibold text-slate-200">
                          {tenant.companyName}
                          <span className="block font-mono text-[10px] font-normal text-slate-500">
                            Mã doanh nghiệp: {tenant.companyCode}
                          </span>
                        </td>
                        <td className="p-3 text-right text-green-400 font-medium">
                          +{tenant.revenue.toLocaleString("vi-VN")}
                        </td>
                        <td className="p-3 text-right text-cyan-400 font-medium">
                          -{tenant.usage.toLocaleString("vi-VN")}
                        </td>
                        <td className="p-3 text-right text-slate-200 font-bold">
                          {tenant.balance.toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                    {finance.revenueByTenant.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">
                          Không có dữ liệu giao dịch.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Health status checks */}
        {health && (
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-400" />
              Sức khỏe Hệ thống
            </h4>
            <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-5 space-y-4">
              {[
                { name: "Cổng kết nối hệ thống", status: health.api },
                { name: "Cơ sở dữ liệu chính", status: health.database },
                { name: "Bộ nhớ đệm hệ thống", status: health.redis },
                { name: "Hàng đợi xử lý tác vụ", status: health.queues },
                { name: "Kho lưu trữ tệp tin", status: health.storage },
                { name: "Kênh truyền thông trực tuyến", status: health.socketIo },
              ].map((s) => (
                <div key={s.name} className="flex items-center justify-between border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
                  <span className="text-sm text-slate-300 font-medium">{s.name}</span>
                  {getHealthBadge(s.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Security Alerts and Activity Logs */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Alerts card */}
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            Cảnh báo Bảo mật (24h)
          </h4>
          <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 max-h-[350px] overflow-y-auto space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-red-500/10 bg-red-500/5 p-3 flex gap-3">
                <ShieldAlert className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-red-300">{alert.message}</p>
                  <p className="text-[10px] text-red-500/80 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(alert.occurredAt).toLocaleTimeString("vi-VN")} - {new Date(alert.occurredAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-sm">
                Chưa phát hiện hành vi bất thường. Hệ thống an toàn.
              </div>
            )}
          </div>
        </div>

        {/* Activity logs card */}
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-400" />
            Nhật ký Hoạt động Gần đây
          </h4>
          <div className="rounded-2xl border border-white/10 bg-slate-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/60 text-xs font-bold text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="p-3">Hành động</th>
                    <th className="p-3">Người thực hiện</th>
                    <th className="p-3 text-center">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activities.map((act) => (
                    <tr key={act.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <span className="font-mono text-xs font-bold text-slate-200">{act.actionType}</span>
                        <span className="block font-mono text-[9px] text-slate-500 mt-0.5">
                          IP: {act.sourceIp} - {new Date(act.occurredAt).toLocaleTimeString("vi-VN")}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 truncate max-w-[150px]" title={act.actorEmail}>
                        {act.actorEmail}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            act.result === "success"
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : act.result === "partial"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {act.result === "success" ? "Thành công" : act.result === "partial" ? "Một phần" : "Thất bại"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {activities.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500">
                        Chưa có hoạt động nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
