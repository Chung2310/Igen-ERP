import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit2,
  Filter,
  Gift,
  Percent,
  Plus,
  Power,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  Users,
  X,
} from "lucide-react";
import {
  retailCouponsApi,
  type RetailCoupon,
  type RetailCouponInput,
  type RetailCouponAutomation,
  type RetailCouponAutomationInput,
} from "../api/retailCoupons.api";
import { useRetailScope } from "../hooks/useRetailScope";
import CustomerPicker from "../components/pos/CustomerPicker";
import CouponAutomationEditor from "../components/coupons/CouponAutomationEditor";
import { toast } from "../../../pages/Toast";

const money = (value: number) => `${value.toLocaleString("vi-VN")} ₫`;
const localDate = (value: string) => {
  const date = new Date(value);
  return new Date(+date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const empty = (): RetailCouponInput => ({
  code: "",
  name: "",
  discountType: "percent",
  value: 10,
  minSubtotal: 0,
  maxDiscount: null,
  usageLimit: null,
  customerTierCodes: [],
  customerId: null,
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  active: true,
});

const newAutomationProgram = (): RetailCouponAutomationInput => ({
  name: "",
  trigger: "birthday",
  orderMinTotal: null,
  enabled: true,
  discountType: "percent",
  value: 10,
  minSubtotal: 0,
  maxDiscount: null,
  validityDays: 7,
  version: 0,
});

type CouponStatus = "Đang áp dụng" | "Chưa bắt đầu" | "Tạm dừng" | "Hết lượt" | "Hết hạn";

function getStatus(item: RetailCoupon): CouponStatus {
  if (!item.active) return "Tạm dừng";
  if (Date.now() >= +new Date(item.endsAt)) return "Hết hạn";
  if (Date.now() < +new Date(item.startsAt)) return "Chưa bắt đầu";
  if (item.usageLimit != null && item.usedCount >= item.usageLimit) return "Hết lượt";
  return "Đang áp dụng";
}

function StatusBadge({ status }: { status: CouponStatus }) {
  switch (status) {
    case "Đang áp dụng":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Đang áp dụng
        </span>
      );
    case "Chưa bắt đầu":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
          Chưa bắt đầu
        </span>
      );
    case "Tạm dừng":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          Tạm dừng
        </span>
      );
    case "Hết lượt":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          <AlertCircle className="h-3 w-3" />
          Hết lượt
        </span>
      );
    case "Hết hạn":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
          Hết hạn
        </span>
      );
  }
}

export default function RetailCouponsPage() {
  const { scope } = useRetailScope();
  const [activeSubTab, setActiveSubTab] = useState<"coupons" | "automations">("coupons");
  const [tiers, setTiers] = useState<Array<{ code: string; name: string }>>([]);
  const [tierError, setTierError] = useState("");
  const [isTierDropdownOpen, setIsTierDropdownOpen] = useState(false);
  const tierDropdownRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<RetailCoupon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<RetailCoupon | null>(null);
  const [form, setForm] = useState<RetailCouponInput | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Automations state
  const [automations, setAutomations] = useState<RetailCouponAutomation[]>([]);
  const [loadingAutomations, setLoadingAutomations] = useState(false);
  const [automationsError, setAutomationsError] = useState("");
  const [automationsRevision, setAutomationsRevision] = useState(0);
  const [editingAutomation, setEditingAutomation] = useState<
    (RetailCouponAutomationInput & Partial<Pick<RetailCouponAutomation, "_id" | "legacy">>) | null
  >(null);
  const [busyAutomationId, setBusyAutomationId] = useState<string | null>(null);

  const isDateInvalid = Boolean(
    form?.startsAt &&
    form?.endsAt &&
    !isNaN(new Date(form.startsAt).getTime()) &&
    !isNaN(new Date(form.endsAt).getTime()) &&
    new Date(form.endsAt) <= new Date(form.startsAt)
  );

  useEffect(() => {
    setForm(null);
    setEditing(null);
    setPage(1);
    setItems([]);
  }, [scope?.companyCode, scope?.branchId]);

  useEffect(() => {
    if (!scope) return;
    let current = true;
    setLoading(true);
    setError("");
    retailCouponsApi
      .list(scope, page)
      .then((data) => {
        if (current) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch((cause) => {
        if (current) setError(cause.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [scope?.companyCode, scope?.branchId, page, revision]);

  useEffect(() => {
    if (!scope) return;
    let current = true;
    setTiers([]); setTierError("");
    retailCouponsApi.tiers(scope).then((data) => { if (current) setTiers(data); })
      .catch(() => { if (current) setTierError("Không tải được hạng khách hàng. Vui lòng tải lại danh sách."); });
    return () => { current = false; };
  }, [scope?.companyCode, scope?.branchId, revision]);

  useEffect(() => {
    if (!scope || activeSubTab !== "automations" || typeof retailCouponsApi.automations !== "function") return;
    let current = true;
    setLoadingAutomations(true);
    setAutomationsError("");
    retailCouponsApi
      .automations(scope)
      .then((data) => {
        if (current) setAutomations(data || []);
      })
      .catch((cause) => {
        if (current) setAutomationsError(cause instanceof Error ? cause.message : "Không tải được danh sách tự động");
      })
      .finally(() => {
        if (current) setLoadingAutomations(false);
      });
    return () => {
      current = false;
    };
  }, [scope?.companyCode, scope?.branchId, activeSubTab, automationsRevision]);

  const handleToggleAutomation = async (program: RetailCouponAutomation) => {
    if (!scope || typeof retailCouponsApi.saveAutomation !== "function") return;
    setBusyAutomationId(program._id);
    setAutomationsError("");
    try {
      await retailCouponsApi.saveAutomation(
        scope,
        { ...program, enabled: !program.enabled },
        program._id
      );
      setAutomationsRevision((v) => v + 1);
      toast.success(program.enabled ? "Đã tắt chương trình." : "Đã bật chương trình.");
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Không cập nhật được chương trình.";
      setAutomationsError(msg);
      toast.error(msg);
    } finally {
      setBusyAutomationId(null);
    }
  };

  useEffect(() => {
    setIsTierDropdownOpen(false);
  }, [editing, form === null]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tierDropdownRef.current && !tierDropdownRef.current.contains(event.target as Node)) {
        setIsTierDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        !searchQuery ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const itemStatus = getStatus(item);
      const matchStatus = filterStatus === "ALL" || itemStatus === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [items, searchQuery, filterStatus]);

  const stats = useMemo(() => {
    let activeCount = 0;
    let totalUsed = 0;
    let expiredCount = 0;
    items.forEach((item) => {
      const s = getStatus(item);
      if (s === "Đang áp dụng") activeCount++;
      if (s === "Hết hạn" || s === "Tạm dừng") expiredCount++;
      totalUsed += item.usedCount || 0;
    });
    return {
      total: total || items.length,
      active: activeCount,
      used: totalUsed,
      inactive: expiredCount,
    };
  }, [items, total]);

  if (!scope) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
        <Ticket className="mb-3 h-10 w-10 text-slate-300" />
        <p className="font-medium">Vui lòng chọn chi nhánh để quản lý mã ưu đãi.</p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-100 disabled:text-slate-500";

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Mã ưu đãi & Tự động tặng mã</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === "coupons" ? (
            <>
              <button
                type="button"
                onClick={() => setRevision((v) => v + 1)}
                disabled={loading}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                title="Tải lại danh sách"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-600" : ""}`} />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-600/25 transition hover:from-cyan-500 hover:to-blue-500 active:scale-[0.98]"
                onClick={() => {
                  setEditing(null);
                  setForm(empty());
                  setIsTierDropdownOpen(false);
                  setError("");
                }}
              >
                <Plus className="h-4 w-4" />
                Tạo mã ưu đãi
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAutomationsRevision((v) => v + 1)}
                disabled={loadingAutomations}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                title="Tải lại danh sách tự động"
              >
                <RefreshCw className={`h-4 w-4 ${loadingAutomations ? "animate-spin text-cyan-600" : ""}`} />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-600/25 transition hover:from-cyan-500 hover:to-blue-500 active:scale-[0.98]"
                onClick={() => setEditingAutomation(newAutomationProgram())}
              >
                <Plus className="h-4 w-4" />
                Thêm chương trình
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2-Tab Navigation Bar */}
      <div className="flex border-b border-slate-200/90 gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("coupons")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-all cursor-pointer ${activeSubTab === "coupons"
              ? "border-cyan-600 text-cyan-600"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
        >
          <Ticket className="h-4 w-4" />
          <span>Mã ưu đãi</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeSubTab === "coupons" ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-600"
              }`}
          >
            {total || items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("automations")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-all cursor-pointer ${activeSubTab === "automations"
              ? "border-cyan-600 text-cyan-600"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Tự động tặng mã</span>
          {automations.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeSubTab === "automations" ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-600"
                }`}
            >
              {automations.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === "coupons" && (
        <div className="space-y-6">
          {/* Metrics Summary Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
                <div className="text-xs font-medium text-slate-500">Tổng số mã</div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{stats.active}</div>
                <div className="text-xs font-medium text-slate-500">Đang áp dụng</div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{stats.used}</div>
                <div className="text-xs font-medium text-slate-500">Lượt đã dùng</div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{stats.inactive}</div>
                <div className="text-xs font-medium text-slate-500">Hết hạn / Tạm dừng</div>
              </div>
            </div>
          </div>

          {/* Error alert if outside form */}
          {error && !form && (
            <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Filter and Search Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo mã hoặc tên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Filter className="mr-1 h-3.5 w-3.5 text-slate-400" />
              {[
                { id: "ALL", label: "Tất cả" },
                { id: "Đang áp dụng", label: "Đang chạy" },
                { id: "Tạm dừng", label: "Tạm dừng" },
                { id: "Hết lượt", label: "Hết lượt" },
                { id: "Hết hạn", label: "Hết hạn" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 font-medium transition ${filterStatus === tab.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Table Card */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3.5 pl-6 pr-3">Mã / Chương trình</th>
                    <th className="px-3 py-3.5">Mức ưu đãi</th>
                    <th className="px-3 py-3.5">Thời hạn áp dụng</th>
                    <th className="px-3 py-3.5">Lượt sử dụng</th>
                    <th className="px-3 py-3.5">Trạng thái</th>
                    <th className="py-3.5 pl-3 pr-6 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const itemStatus = getStatus(item);
                    const percentUsed =
                      item.usageLimit != null && item.usageLimit > 0
                        ? Math.min(100, Math.round((item.usedCount / item.usageLimit) * 100))
                        : null;

                    return (
                      <tr key={item._id} className="group transition hover:bg-cyan-50/25">
                        <td className="py-4 pl-6 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50/80 px-2.5 py-1 font-mono text-xs font-bold text-cyan-800 shadow-xs">
                              {item.code}
                              <button
                                type="button"
                                onClick={() => handleCopy(item.code)}
                                className="text-cyan-600 transition hover:text-cyan-900"
                                title="Sao chép mã"
                              >
                                {copiedCode === item.code ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs font-semibold text-slate-800">{item.name}</div>
                          {item.emailDelivery?.status && <div className="mt-1 text-xs text-slate-500" title={item.emailDelivery.reason}>Email: {{ pending: "Chờ gửi", sending: "Đang gửi / chờ xác nhận", sent: "Đã gửi", failed: "Gửi thất bại", skipped: "Không gửi" }[item.emailDelivery.status]}{item.emailDelivery.reason ? " · " + item.emailDelivery.reason : ""}</div>}
                          <div className="mt-1 text-xs text-slate-500">{item.customerId ? `Riêng: ${item.customerName || item.customerId} · ${item.customerCode || ""}${item.source === "birthday" ? " · Sinh nhật" : item.source === "purchase" ? " · Quà mua hàng" : ""}` : item.customerTierCodes?.length ? "Hạng: " + item.customerTierCodes.map((code) => tiers.find((tier) => tier.code === code)?.name || code).join(", ") : "Tất cả khách hàng"}</div>
                        </td>

                        <td className="px-3 py-4">
                          <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                            {item.discountType === "percent" ? (
                              <>
                                <Percent className="h-3 w-3" />
                                Giảm {item.value}%
                              </>
                            ) : (
                              <>Giảm {money(item.value)}</>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            Đơn từ <strong className="text-slate-700">{money(item.minSubtotal)}</strong>
                            {item.maxDiscount != null && (
                              <span>
                                {" "}· Tối đa <strong className="text-slate-700">{money(item.maxDiscount)}</strong>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-700">
                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{new Date(item.startsAt).toLocaleDateString("vi-VN")}</span>
                            <span className="text-slate-300">→</span>
                            <span>{new Date(item.endsAt).toLocaleDateString("vi-VN")}</span>
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            Hết hạn: {new Date(item.endsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <div className="text-xs font-semibold text-slate-700">
                            {item.usedCount} <span className="font-normal text-slate-400">/ {item.usageLimit ?? "Không giới hạn"}</span>
                          </div>
                          {percentUsed !== null && (
                            <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all ${percentUsed >= 100
                                  ? "bg-amber-500"
                                  : percentUsed > 75
                                    ? "bg-cyan-500"
                                    : "bg-emerald-500"
                                  }`}
                                style={{ width: `${percentUsed}%` }}
                              />
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-4">
                          <StatusBadge status={itemStatus} />
                        </td>

                        <td className="py-4 pl-3 pr-6 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setEditing(item);
                              setForm(item);
                              setIsTierDropdownOpen(false);
                              setError("");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-cyan-300 hover:bg-cyan-50/60 hover:text-cyan-700 disabled:opacity-50"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-slate-400 group-hover:text-cyan-600" />
                            Sửa
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {!filteredItems.length && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <Ticket className="h-6 w-6" />
                        </div>
                        <div className="mt-3 text-sm font-semibold text-slate-700">
                          {loading ? "Đang tải dữ liệu..." : searchQuery ? "Không tìm thấy mã ưu đãi phù hợp" : "Chưa có mã ưu đãi nào"}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {searchQuery
                            ? "Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc."
                            : "Tạo các mã khuyến mãi, voucher để tăng tỷ lệ chốt đơn tại quầy."}
                        </p>
                        {!searchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(null);
                              setForm(empty());
                              setError("");
                            }}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-500"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Tạo mã ưu đãi ngay
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/50 px-6 py-3.5 text-xs text-slate-600">
              <div>
                Hiển thị <strong>{filteredItems.length}</strong> / <strong>{total}</strong> mã ưu đãi · Trang{" "}
                <strong>{page}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(page - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <button
                  type="button"
                  disabled={page * 20 >= total || loading}
                  onClick={() => setPage(page + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "automations" && (
        <div className="space-y-6">
          {/* Automations Metrics Summary Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{automations.length}</div>
                <div className="text-xs font-medium text-slate-500">Tổng chương trình</div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  {automations.filter((a) => a.enabled).length}
                </div>
                <div className="text-xs font-medium text-slate-500">Đang kích hoạt</div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-600">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  {automations.filter((a) => a.trigger === "birthday").length}
                </div>
                <div className="text-xs font-medium text-slate-500">Quà sinh nhật</div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  {automations.filter((a) => a.trigger === "order_total").length}
                </div>
                <div className="text-xs font-medium text-slate-500">Theo giá trị đơn</div>
              </div>
            </div>
          </div>

          {/* Automations Error Notice */}
          {automationsError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                <span>{automationsError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAutomationsRevision((v) => v + 1)}
                className="font-semibold underline hover:no-underline cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Programs List / Grid */}
          {loadingAutomations ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-400 shadow-sm">
              <RefreshCw className="h-6 w-6 animate-spin text-cyan-600 mb-2" />
              <p className="text-sm font-medium">Đang tải danh sách chương trình tự động...</p>
            </div>
          ) : automations.length === 0 && !automationsError ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-12 px-6 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 mb-3">
                <Gift className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Chưa có chương trình tự động tặng mã</h3>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Tự động gửi mã ưu đãi đến khách hàng khi đến ngày sinh nhật hoặc khi đơn hàng thanh toán đạt mức tiền chỉ định.
              </p>
              <button
                type="button"
                onClick={() => setEditingAutomation(newAutomationProgram())}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:from-cyan-500 hover:to-blue-500 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Thêm chương trình đầu tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {automations.map((program) => {
                const isBirthday = program.trigger === "birthday";
                const isBusy = busyAutomationId === program._id;
                return (
                  <div
                    key={program._id}
                    className="relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-cyan-200 hover:shadow-md"
                  >
                    <div className="space-y-3.5">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isBirthday ? "bg-fuchsia-50 text-fuchsia-600" : "bg-amber-50 text-amber-600"
                              }`}
                          >
                            {isBirthday ? <Gift className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900">{program.name}</h3>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {isBirthday
                                ? "Sinh nhật · Một mã/khách/năm"
                                : `Đơn đã thanh toán từ ${(program.orderMinTotal || 0).toLocaleString("vi-VN")} ₫ · Một mã/đơn`}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${program.enabled
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${program.enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                              }`}
                          />
                          {program.enabled ? "Đang bật" : "Đang tắt"}
                        </span>
                      </div>

                      {/* Card Specs */}
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Ưu đãi tặng:</span>
                          <span className="font-bold text-cyan-700">
                            {program.discountType === "percent"
                              ? `Giảm ${program.value}%`
                              : `Giảm ${money(program.value)}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Đơn tối thiểu áp dụng mã:</span>
                          <span className="font-semibold text-slate-700">
                            {program.minSubtotal ? money(program.minSubtotal) : "Không giới hạn"}
                          </span>
                        </div>
                        {program.discountType === "percent" && program.maxDiscount != null && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Mức giảm tối đa:</span>
                            <span className="font-semibold text-slate-700">{money(program.maxDiscount)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Thời hạn sử dụng mã:</span>
                          <span className="font-semibold text-slate-700">{program.validityDays} ngày</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setEditingAutomation(program)}
                        aria-label={`Sửa chương trình ${program.name}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Sửa
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleAutomation(program)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition disabled:opacity-50 cursor-pointer ${program.enabled
                            ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                      >
                        {isBusy ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                        {isBusy ? "Đang lưu…" : program.enabled ? "Tắt chương trình" : "Bật chương trình"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create or Edit Coupon Form */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-100 bg-white shadow-2xl animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{editing ? "Sửa mã ưu đãi" : "Tạo mã ưu đãi"}</h2>
                  <p className="text-xs text-slate-500">Cấu hình điều kiện và giá trị áp dụng cho khách hàng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error in modal */}
            {error && (
              <div role="alert" className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form Content */}
            <form
              noValidate
              className="space-y-5 p-6"
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy) return;
                if (
                  form.startsAt &&
                  form.endsAt &&
                  new Date(form.endsAt) <= new Date(form.startsAt)
                ) {
                  setError("Ngày kết thúc phải sau ngày bắt đầu.");
                  toast.error("Ngày kết thúc phải sau ngày bắt đầu.");
                  return;
                }
                if (form.customerId === "") {
                  setError("Vui lòng chọn khách hàng nhận mã.");
                  return;
                }
                setBusy(true);
                setError("");
                try {
                  await retailCouponsApi.save(
                    scope,
                    { ...form, ...(editing ? { version: editing.version } : {}) },
                    editing?._id,
                  );
                  setForm(null);
                  setEditing(null);
                  setRevision((value) => value + 1);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Không lưu được mã ưu đãi.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {/* Live Ticket Card Preview */}
              <div className="relative overflow-hidden rounded-2xl border border-dashed border-cyan-300 bg-gradient-to-r from-cyan-50/70 via-sky-50/60 to-blue-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-black tracking-widest text-cyan-800">
                      {form.code || "MÃ-ƯU-ĐÃI"}
                    </span>
                    <div className="mt-0.5 text-sm font-bold text-slate-800">{form.name || "Tên chương trình khuyến mãi"}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-lg bg-cyan-600 px-3 py-1 text-sm font-black text-white shadow-xs">
                      {form.discountType === "percent" ? `-${form.value || 0}%` : `-${money(form.value || 0)}`}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                  <span>Áp dụng đơn từ: <strong className="text-slate-700">{money(form.minSubtotal || 0)}</strong></span>
                  {form.maxDiscount != null && (
                    <span>· Giảm tối đa: <strong className="text-slate-700">{money(form.maxDiscount)}</strong></span>
                  )}
                </div>
              </div>

              <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-3 rounded-xl border border-cyan-100 bg-cyan-50/40 p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" disabled={Boolean(editing)} checked={form.customerId != null} onChange={event => setForm({ ...form, customerId: event.target.checked ? "" : null, customerName: undefined, customerCode: undefined, usageLimit: event.target.checked ? 1 : null })} />
                    Dành riêng cho một khách hàng
                  </label>
                  {form.customerId != null && <>
                    {editing ? <p className="text-sm">Người nhận: {form.customerName || form.customerId} · {form.customerCode}</p> : <CustomerPicker scope={scope}
                      value={form.customerId ? { _id: form.customerId, name: form.customerName || "", customerCode: form.customerCode || "", companyCode: scope.companyCode, type: "regular" } : null}
                      onChange={customer => setForm({ ...form, customerId: customer?._id || "", customerName: customer?.name, customerCode: customer?.customerCode, usageLimit: 1 })} />}
                    <p className="text-xs text-slate-600">Chỉ người nhận được dùng mã, tối đa một lần. Hủy đơn không hoàn lượt dùng. Không đổi người nhận sau khi tạo.</p>
                  </>}
                </div>
                {/* Mã ưu đãi */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Mã ưu đãi
                    <input
                      className={`${inputClass} font-mono uppercase font-bold tracking-wider`}
                      required
                      minLength={3}
                      maxLength={32}
                      pattern="[A-Za-z0-9_-]{3,32}"
                      placeholder="VD: HELLO2026"
                      disabled={!!editing}
                      value={form.code}
                      onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                    />
                  </label>
                  <p className="mt-1 text-[11px] text-slate-400">Từ 3-32 ký tự, không dấu (chữ cái, số, gạch ngang).</p>
                </div>

                {/* Tên chương trình */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tên chương trình
                    <input
                      className={inputClass}
                      required
                      maxLength={120}
                      placeholder="VD: Tri ân khách hàng tháng 9"
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                    />
                  </label>
                  <p className="mt-1 text-[11px] text-slate-400">Tên hiển thị để nhân viên nhận diện dễ dàng.</p>
                </div>

                {/* Loại giảm */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Loại giảm
                    <select
                      className={inputClass}
                      value={form.discountType}
                      onChange={(event) =>
                        setForm({ ...form, discountType: event.target.value as "amount" | "percent" })
                      }
                    >
                      <option value="percent">Phần trăm (%)</option>
                      <option value="amount">Số tiền cố định (₫)</option>
                    </select>
                  </label>
                </div>

                {/* Giá trị giảm */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Giá trị giảm
                    <input
                      className={inputClass}
                      type="number"
                      required
                      min={form.discountType === "percent" ? 0.01 : 1}
                      max={form.discountType === "percent" ? 100 : undefined}
                      step={form.discountType === "percent" ? 0.01 : 1}
                      value={form.value}
                      onChange={(event) => setForm({ ...form, value: Number(event.target.value) })}
                    />
                  </label>
                </div>

                {/* Đơn tối thiểu */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Giá trị đơn tối thiểu (₫)
                    <input
                      className={inputClass}
                      type="number"
                      required
                      min={0}
                      step={1}
                      value={form.minSubtotal}
                      onChange={(event) => setForm({ ...form, minSubtotal: Number(event.target.value) })}
                    />
                  </label>
                </div>

                {/* Giảm tối đa */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Giảm tối đa (₫)
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Không giới hạn"
                      value={form.maxDiscount ?? ""}
                      onChange={(event) =>
                        setForm({ ...form, maxDiscount: event.target.value ? Number(event.target.value) : null })
                      }
                    />
                  </label>
                </div>

                {/* Lượt dùng */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Giới hạn lượt dùng
                    <input
                      className={inputClass}
                      type="number"
                      min={Math.max(1, editing?.usedCount || 0)}
                      step={1}
                      placeholder="Không giới hạn"
                      disabled={form.customerId != null}
                      value={form.usageLimit ?? ""}
                      onChange={(event) =>
                        setForm({ ...form, usageLimit: event.target.value ? Number(event.target.value) : null })
                      }
                    />
                  </label>
                  {editing && editing.usedCount > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">Đã sử dụng: {editing.usedCount} lượt.</p>
                  )}
                </div>

                {/* Hạng khách hàng áp dụng */}
                <div className="space-y-2 sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Hạng khách hàng áp dụng
                    </label>
                    {(form.customerTierCodes || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, customerTierCodes: [] })}
                        className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 cursor-pointer"
                      >
                        Đặt lại về tất cả khách hàng
                      </button>
                    )}
                  </div>

                  {tierError && <p className="text-xs text-rose-700">{tierError}</p>}

                  {/* Dropdown container */}
                  <div className="relative" ref={tierDropdownRef}>
                    <button
                      type="button"
                      aria-label="Hạng khách hàng áp dụng"
                      aria-expanded={isTierDropdownOpen}
                      onClick={() => setIsTierDropdownOpen((prev) => !prev)}
                      className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-left text-xs shadow-xs transition hover:border-slate-300 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 flex-1 pr-2">
                        {(form.customerTierCodes || []).length === 0 ? (
                          <span className="text-slate-800 font-semibold flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-slate-400" />
                            Tất cả khách hàng (Không giới hạn)
                          </span>
                        ) : (
                          (form.customerTierCodes || []).map((code) => {
                            const matched = tiers.find((t) => t.code === code);
                            const displayName = matched ? matched.name : `${code} (không tồn tại)`;
                            return (
                              <span
                                key={code}
                                className="inline-flex items-center gap-1 rounded-md bg-cyan-50 border border-cyan-200/80 px-2 py-0.5 text-[11px] font-bold text-cyan-800"
                              >
                                {displayName}
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setForm({
                                      ...form,
                                      customerTierCodes: (form.customerTierCodes || []).filter(
                                        (c) => c !== code
                                      ),
                                    });
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.stopPropagation();
                                      setForm({
                                        ...form,
                                        customerTierCodes: (form.customerTierCodes || []).filter(
                                          (c) => c !== code
                                        ),
                                      });
                                    }
                                  }}
                                  className="rounded-full p-0.5 hover:bg-cyan-200/80 cursor-pointer text-cyan-600 hover:text-cyan-900"
                                  title={`Xóa ${displayName}`}
                                >
                                  <X className="h-3 w-3" />
                                </span>
                              </span>
                            );
                          })
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                        {(form.customerTierCodes || []).length > 0 && (
                          <span className="text-[11px] font-semibold text-slate-500">
                            {(form.customerTierCodes || []).length} đã chọn
                          </span>
                        )}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${isTierDropdownOpen ? "rotate-180" : ""
                            }`}
                        />
                      </div>
                    </button>

                    {/* Dropdown Options List */}
                    {isTierDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl space-y-1">
                        {/* Option: Tất cả khách hàng */}
                        <button
                          type="button"
                          onClick={() => {
                            setForm({ ...form, customerTierCodes: [] });
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer transition select-none ${(form.customerTierCodes || []).length === 0
                            ? "bg-cyan-50 text-cyan-900 font-bold"
                            : "hover:bg-slate-50 text-slate-700"
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-4 w-4 items-center justify-center rounded-full border ${(form.customerTierCodes || []).length === 0
                                ? "border-cyan-600 bg-cyan-600 text-white"
                                : "border-slate-300 bg-white"
                                }`}
                            >
                              {(form.customerTierCodes || []).length === 0 && (
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              )}
                            </div>
                            <span>Tất cả khách hàng (Không giới hạn)</span>
                          </div>
                          <span className="text-[10px] font-normal text-slate-400">Mặc định</span>
                        </button>

                        <div className="my-1 border-t border-slate-100" />

                        <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-600">
                            Chọn theo từng hạng:
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setForm({
                                  ...form,
                                  customerTierCodes: [
                                    ...tiers.map((t) => t.code),
                                    ...(form.customerTierCodes || []).filter(
                                      (code) => !tiers.some((t) => t.code === code)
                                    ),
                                  ],
                                })
                              }
                              className="font-semibold text-cyan-600 hover:text-cyan-700 cursor-pointer"
                            >
                              Chọn tất cả
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, customerTierCodes: [] })}
                              className="font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                            >
                              Bỏ chọn
                            </button>
                          </div>
                        </div>

                        {/* Customer tiers list */}
                        {[
                          ...tiers,
                          ...(form.customerTierCodes || [])
                            .filter((code) => !tiers.some((tier) => tier.code === code))
                            .map((code) => ({
                              code,
                              name: `${code} (không còn trong danh sách hạng)`,
                            })),
                        ].map((tier) => {
                          const checked = (form.customerTierCodes || []).includes(tier.code);
                          return (
                            <div
                              key={tier.code}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition select-none ${checked
                                ? "bg-cyan-50/80 text-cyan-900"
                                : "hover:bg-slate-50 text-slate-700"
                                }`}
                            >
                              <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  aria-label={tier.name}
                                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                  checked={checked}
                                  onChange={(event) =>
                                    setForm({
                                      ...form,
                                      customerTierCodes: event.target.checked
                                        ? [...(form.customerTierCodes || []), tier.code]
                                        : (form.customerTierCodes || []).filter(
                                          (code) => code !== tier.code
                                        ),
                                    })
                                  }
                                />
                                <span>{tier.name}</span>
                              </label>
                              <span className="font-mono text-[10px] uppercase text-slate-400 ml-2">
                                {tier.code}
                              </span>
                            </div>
                          );
                        })}
                        {!tiers.length && !tierError && (
                          <div className="py-3 text-center text-xs text-slate-400">
                            Đang tải hạng khách hàng…
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500">
                    {(form.customerTierCodes || []).length === 0
                      ? "Mã ưu đãi áp dụng cho tất cả khách hàng. Chọn các hạng cụ thể nếu muốn giới hạn đối tượng."
                      : `Mã ưu đãi chỉ áp dụng cho ${(form.customerTierCodes || []).length} hạng đã chọn. Hệ thống sẽ kiểm tra hạng trên hồ sơ khách khi áp mã ở giỏ hàng POS.`}
                  </p>
                </div>

                {/* Kích hoạt */}
                <div className="flex items-center pt-5">
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded-md border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      checked={form.active}
                      onChange={(event) => setForm({ ...form, active: event.target.checked })}
                    />
                    Cho phép sử dụng
                  </label>
                </div>

                {/* Bắt đầu */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Bắt đầu
                    <input
                      className={`${inputClass} ${isDateInvalid
                        ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20"
                        : ""
                        }`}
                      type="datetime-local"
                      required
                      value={form.startsAt ? localDate(form.startsAt) : ""}
                      onChange={(event) => {
                        const newStartsAt = event.target.value
                          ? new Date(event.target.value).toISOString()
                          : "";
                        setForm({ ...form, startsAt: newStartsAt });
                        if (
                          newStartsAt &&
                          form.endsAt &&
                          !isNaN(new Date(newStartsAt).getTime()) &&
                          !isNaN(new Date(form.endsAt).getTime()) &&
                          new Date(form.endsAt) <= new Date(newStartsAt)
                        ) {
                          setError("Ngày kết thúc phải sau ngày bắt đầu.");
                          toast.error("Ngày kết thúc phải sau ngày bắt đầu.");
                        } else if (error === "Ngày kết thúc phải sau ngày bắt đầu.") {
                          setError("");
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Kết thúc */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Kết thúc
                    <input
                      className={`${inputClass} ${isDateInvalid
                        ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20"
                        : ""
                        }`}
                      type="datetime-local"
                      required
                      value={form.endsAt ? localDate(form.endsAt) : ""}
                      onChange={(event) => {
                        const newEndsAt = event.target.value
                          ? new Date(event.target.value).toISOString()
                          : "";
                        setForm({ ...form, endsAt: newEndsAt });
                        if (
                          form.startsAt &&
                          newEndsAt &&
                          !isNaN(new Date(form.startsAt).getTime()) &&
                          !isNaN(new Date(newEndsAt).getTime()) &&
                          new Date(newEndsAt) <= new Date(form.startsAt)
                        ) {
                          setError("Ngày kết thúc phải sau ngày bắt đầu.");
                          toast.error("Ngày kết thúc phải sau ngày bắt đầu.");
                        } else if (error === "Ngày kết thúc phải sau ngày bắt đầu.") {
                          setError("");
                        }
                      }}
                    />
                  </label>
                </div>

                {isDateInvalid && (
                  <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 flex items-center gap-2.5 animate-in fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <div>
                      <span className="font-bold">Ngày kết thúc phải sau ngày bắt đầu.</span> Vui lòng điều chỉnh lại thời gian để mã ưu đãi hợp lệ.
                    </div>
                  </div>
                )}
              </fieldset>

              {/* Modal Actions */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span className="font-semibold">{error}</span>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => setForm(null)}
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-600/20 transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
                  >
                    {busy ? "Đang lưu…" : "Lưu mã"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Automation Program */}
      {editingAutomation && (
        <CouponAutomationEditor
          scope={scope}
          initial={editingAutomation}
          onClose={() => {
            setEditingAutomation(null);
            setAutomationsRevision((v) => v + 1);
          }}
          onSaved={() => {
            setEditingAutomation(null);
            setAutomationsRevision((v) => v + 1);
            toast.success("Đã lưu chương trình tặng mã.");
          }}
        />
      )}
    </div>
  );
}
