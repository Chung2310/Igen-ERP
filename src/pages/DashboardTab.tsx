/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-empty */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Bot,
  CheckCircle,
  Clock,
  DollarSign,
  FolderOpen,
  GraduationCap,
  KanbanSquare,
  PackageCheck,
  Sparkles,
  Users,
  Wallet,
  X,
  UserCheck,
  Clock3,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isModuleEnabled } from "../config/modules";
import { authService } from "../services/authService";
import { inventoryProductService } from "../services/inventoryProductService";
import { inventoryStockLogService } from "../services/inventoryStockLogService";
import { dashboardService } from "../services/dashboardService";
import { toast } from "../pages/Toast";
import { UserProfile } from "../types";
import { DashboardSummary } from "../types/dashboard";
import LowStockModal from "../components/inventory/LowStockModal";

type DashboardView = "overview" | "revenue";
type Tone = "blue" | "amber" | "slate" | "indigo" | "emerald";

const tabs: Array<{ id: DashboardView; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "revenue", label: "Phân tích doanh thu" },
];

const toneClass: Record<Tone, { soft: string; text: string; fill: string; strong: string }> = {
  blue: { soft: "bg-blue-50", text: "text-blue-600", fill: "bg-blue-500", strong: "text-blue-700" },
  amber: { soft: "bg-amber-50", text: "text-amber-600", fill: "bg-amber-500", strong: "text-amber-700" },
  slate: { soft: "bg-slate-100", text: "text-slate-600", fill: "bg-slate-600", strong: "text-slate-700" },
  indigo: { soft: "bg-indigo-50", text: "text-indigo-650", fill: "bg-indigo-600", strong: "text-indigo-750" },
  emerald: { soft: "bg-emerald-50/60", text: "text-emerald-600", fill: "bg-emerald-500", strong: "text-emerald-700" },
};

const getDescendantEmployees = (rootId: string, users: UserProfile[]): UserProfile[] => {
  const childrenByParent = new Map<string, string[]>();
  users.forEach((user) => {
    if (user.parentId) {
      const existing = childrenByParent.get(user.parentId) || [];
      existing.push(user.uid);
      childrenByParent.set(user.parentId, existing);
    }
  });

  const descendantIds = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenByParent.get(current) || [];
    children.forEach(cid => descendantIds.add(cid));
    stack.push(...children);
  }

  return users.filter(u => descendantIds.has(u.uid));
};

const buildPctSegments = (
  parts: Array<{ label: string; value: number; color: string }>,
  unit: string
): Array<{ label: string; value: number; color: string; display: string }> => {
  const total = parts.reduce((acc, p) => acc + Math.max(0, p.value), 0);
  let used = 0;
  return parts.map((p, i) => {
    const count = Math.max(0, p.value);
    let pct = 0;
    if (total > 0) {
      pct = i === parts.length - 1 ? Math.max(0, 100 - used) : Math.round((count / total) * 100);
      used += pct;
    }
    return { ...p, value: pct, display: `${count.toLocaleString("vi-VN")} ${unit} (${pct}%)` };
  });
};

const formatDashboardCurrency = (val: number, decimalDigits: number = 1, useK: boolean = true): string => {
  if (val === 0) return "₫0";
  if (!isFinite(val) || isNaN(val)) return "₫0";
  
  const absVal = Math.abs(val);
  const sign = val < 0 ? "-" : "";

  if (absVal >= 1e15) {
    return `${sign}₫${absVal.toExponential(2)}`;
  }
  if (absVal >= 1e12) {
    return `${sign}₫${(absVal / 1e12).toFixed(decimalDigits)}T`;
  }
  if (absVal >= 1e9) {
    return `${sign}₫${(absVal / 1e9).toFixed(decimalDigits)}B`;
  }
  if (absVal >= 1e6) {
    return `${sign}₫${(absVal / 1e6).toFixed(decimalDigits)}M`;
  }
  if (useK && absVal >= 1e3) {
    return `${sign}₫${(absVal / 1e3).toFixed(0)}K`;
  }
  return `${sign}₫${Math.round(absVal).toLocaleString("vi-VN")}`;
};

export default function DashboardTab() {
  const { userProfile } = useAuth();
  const canSeeHr = isModuleEnabled(userProfile?.enabledModules, "hr");
  const canSeeInventory = isModuleEnabled(userProfile?.enabledModules, "inventory");
  const canSeeResource = isModuleEnabled(userProfile?.enabledModules, "resource");
  const canSeeChat = isModuleEnabled(userProfile?.enabledModules, "chat");
  const canSeeStudent = isModuleEnabled(userProfile?.enabledModules, "student");
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [employeeCount, setEmployeeCount] = useState<string>("...");
  const [employeeLabel, setEmployeeLabel] = useState<string>("Tổng nhân sự");
  const [newHiresCount, setNewHiresCount] = useState<number>(0);
  const [rawEmployees, setRawEmployees] = useState<UserProfile[]>([]);
  const [totalProducts, setTotalProducts] = useState<string>("...");
  const [pendingShipments, setPendingShipments] = useState<string>("...");
  const [overstockItems, setOverstockItems] = useState<any[]>([]);
  const [lowStockCount, setLowStockCount] = useState<string>("...");
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [rawStockLogs, setRawStockLogs] = useState<any[]>([]);
  const [totalInventoryValue, setTotalInventoryValue] = useState<string>("0");
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number[]>(Array(12).fill(0));
  const [totalProductsSold, setTotalProductsSold] = useState<number>(0);

  const [filteredTotalRevenue, setFilteredTotalRevenue] = useState<number>(0);
  const [growthRate, setGrowthRate] = useState<number>(0);
  const [prevRevenueShort, setPrevRevenueShort] = useState<string>("₫0");
  const [avgOrderValue, setAvgOrderValue] = useState<number>(0);
  const [filteredOrderCount, setFilteredOrderCount] = useState<number>(0);
  const [revenueTrendData, setRevenueTrendData] = useState<Array<{ label: string; value: number }>>([]);
  const [productSegments, setProductSegments] = useState<Array<{ label: string; value: number; color: string }>>([]);
  const [todayTimekeeping, setTodayTimekeeping] = useState<any>(null);
  const [isTimekeepingLoading, setIsTimekeepingLoading] = useState<boolean>(false);

  type DateFilterType = "day" | "month" | "year" | "custom";
  const [dateFilter, setDateFilter] = useState<DateFilterType>("day");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  useEffect(() => {
    const loadEmployeeData = async () => {
      if (!canSeeHr) {
        setEmployeeCount("0");
        setNewHiresCount(0);
        setRawEmployees([]);
        return;
      }
      if (!userProfile) {
        setEmployeeCount("0");
        setEmployeeLabel("Nhân sự");
        setNewHiresCount(0);
        setRawEmployees([]);
        return;
      }

      try {
        let users: UserProfile[] = [];
        if (userProfile.role === "superadmin") {
          users = await authService.getAllUsers();
        } else if (userProfile.companyCode) {
          users = await authService.getUsersByCompany(userProfile.companyCode);
        }

        let count = 0;
        let label = "Nhân sự";
        let targetUsers: UserProfile[] = [];

        if (userProfile.role === "superadmin") {
          targetUsers = users.filter((user) => user.role !== "superadmin");
          count = targetUsers.length;
          label = "Tổng nhân sự";
        } else if (userProfile.role === "admin" || userProfile.role === "manager") {
          targetUsers = getDescendantEmployees(userProfile.uid, users);
          count = targetUsers.length;
          label = "Tổng nhân sự";
        } else {
          targetUsers = users;
          count = users.length;
          label = "Nhân sự";
        }

        setEmployeeCount(String(count));
        setEmployeeLabel(label);
        setRawEmployees(targetUsers);
      } catch (error) {
        console.error("Lỗi lấy nhân sự Dashboard:", error);
        setEmployeeCount("0");
        setEmployeeLabel("Nhân sự");
        setNewHiresCount(0);
        setRawEmployees([]);
      }
    };

    loadEmployeeData();
  }, [userProfile?.uid, userProfile?.role, userProfile?.companyCode, canSeeHr]);

  // Subscribe to inventory products to compute total products
  useEffect(() => {
    if (!canSeeInventory) {
      setRawProducts([]);
      setTotalProducts("0");
      setLowStockCount("0");
      setLowStockItems([]);
      setOverstockItems([]);
      setTotalInventoryValue("0");
      return;
    }
    let unsubProducts: any = null;
    try {
      unsubProducts = inventoryProductService.subscribe((products) => {
        setRawProducts(products);
        setTotalProducts(String(products.length));
        const lowItems = products.filter((p: any) => typeof p.stock === "number" && typeof p.minStockAlert === "number" ? p.stock <= p.minStockAlert : false);
        const overstock = products.filter((p: any) => typeof p.stock === "number" && typeof p.minStockAlert === "number" ? p.stock >= p.minStockAlert * 3 : false);
        setLowStockCount(String(lowItems.length));
        setLowStockItems(lowItems);
        setOverstockItems(overstock);

        const val = products.reduce((acc, p: any) => {
          const s = typeof p.stock === "number" ? p.stock : 0;
          const pr = typeof p.price === "number" ? p.price : 0;
          return acc + (s * pr);
        }, 0);

        let formattedValue = "0";
        if (val > 0) {
          formattedValue = formatDashboardCurrency(val, 1, false);
        }
        setTotalInventoryValue(formattedValue);
      });
    } catch (err) {
      console.error("Lỗi lấy tổng sản phẩm:", err);
      setTotalProducts("0");
      setTotalInventoryValue("0");
      setRawProducts([]);
    }

    return () => {
      if (unsubProducts && typeof unsubProducts === "function") unsubProducts();
    };
  }, [canSeeInventory]);

  // Subscribe to stock logs to compute pending outbound shipments
  useEffect(() => {
    if (!canSeeInventory) {
      setRawStockLogs([]);
      return;
    }
    let unsubLogs: any = null;
    try {
      unsubLogs = inventoryStockLogService.subscribe((logs) => {
        setRawStockLogs(logs);
      });
    } catch (err) {
      console.error("Lỗi lấy đơn chờ xuất:", err);
      setRawStockLogs([]);
    }

    return () => {
      if (unsubLogs && typeof unsubLogs === "function") unsubLogs();
    };
  }, [canSeeInventory]);

  const getAccessToken = () => localStorage.getItem("accessToken") || "";

  const fetchTodayTimekeeping = async () => {
    if (!canSeeHr) return;
    setIsTimekeepingLoading(true);
    try {
      const token = getAccessToken();
      if (!token) return;
      const res = await fetch("/api/v1/timekeeping/today", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const result = await res.json();
        setTodayTimekeeping(result.data);
      }
    } catch (err) {
      console.error("Lỗi khi tải trạng thái chấm công:", err);
    } finally {
      setIsTimekeepingLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile && canSeeHr) {
      fetchTodayTimekeeping();
    }
  }, [userProfile, canSeeHr]);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    let cancelled = false;

    const loadSummary = () => {
      dashboardService
        .getSummary({ filter: dateFilter as any, startDate: customStartDate, endDate: customEndDate })
        .then((data) => {
          if (!cancelled) setSummary(data);
        })
        .catch((err) => {
          console.error("Lỗi tải dữ liệu tổng quan module:", err);
        });
    };

    loadSummary();
    const intervalId = setInterval(loadSummary, 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [userProfile?.uid, dateFilter, customStartDate, customEndDate]);

  // Master calculation useEffect to filter data dynamically by date range
  useEffect(() => {
    const parseSafeDate = (dateStr: any): Date | null => {
      if (!dateStr) return null;
      if (typeof dateStr === "number") return new Date(dateStr);
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed;
        const str = String(dateStr);
        const parts = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (parts) {
          const day = parseInt(parts[1], 10);
          const month = parseInt(parts[2], 10) - 1;
          const year = parseInt(parts[3], 10);
          const timeParts = str.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/);
          if (timeParts) {
            const hour = parseInt(timeParts[1], 10);
            const min = parseInt(timeParts[2], 10);
            const sec = parseInt(timeParts[3], 10);
            return new Date(year, month, day, hour, min, sec);
          }
          return new Date(year, month, day);
        }
      } catch (e) { }
      return null;
    };

    const isDateInFilter = (dateStr: any) => {
      const date = parseSafeDate(dateStr);
      if (!date) return false;

      const now = new Date();
      if (dateFilter === "day") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return date >= startOfToday;
      } else if (dateFilter === "month") {
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return date >= startOfThisMonth;
      } else if (dateFilter === "year") {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return date >= startOfYear;
      } else if (dateFilter === "custom") {
        if (!customStartDate || !customEndDate) return true;
        const start = new Date(customStartDate + "T00:00:00");
        const end = new Date(customEndDate + "T23:59:59");
        return date >= start && date <= end;
      }
      return true;
    };

    // 1. Filter stock logs
    const filteredLogs = rawStockLogs.filter((log) => isDateInFilter(log.createdAt));
    const pendingShipmentsCount = filteredLogs.filter(
      (l) => l.type === "xuất" && (l.status === "Đang chờ" || l.status === "Đang xử lý")
    ).length;
    setPendingShipments(String(pendingShipmentsCount));

    // 2. Filter target employees (New Hires)
    const filteredEmployees = rawEmployees.filter((user) => {
      if (!user.createdAt) return false;
      return isDateInFilter(user.createdAt);
    });
    setNewHiresCount(filteredEmployees.length);

  }, [rawStockLogs, rawEmployees, dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    const parseSafeDate = (dateStr: any): Date | null => {
      if (!dateStr) return null;
      if (typeof dateStr === "number") return new Date(dateStr);
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed;
        const str = String(dateStr);
        const parts = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (parts) {
          const day = parseInt(parts[1], 10);
          const month = parseInt(parts[2], 10) - 1;
          const year = parseInt(parts[3], 10);
          const timeParts = str.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/);
          if (timeParts) {
            const hour = parseInt(timeParts[1], 10);
            const min = parseInt(timeParts[2], 10);
            const sec = parseInt(timeParts[3], 10);
            return new Date(year, month, day, hour, min, sec);
          }
          return new Date(year, month, day);
        }
      } catch (e) { }
      return null;
    };

    const currentYear = new Date().getFullYear();
    const revs = Array(12).fill(0);

    const productPriceMap = new Map<string, number>();
    const productIdPriceMap = new Map<string, number>();
    rawProducts.forEach((p) => {
      const price = typeof p.price === "number" ? p.price : 0;
      if (p.sku) productPriceMap.set(p.sku.toUpperCase(), price);
      if (p.id) productIdPriceMap.set(p.id, price);
    });

    const getLogRevenue = (log: any) => {
      let logRevenue = 0;
      if (log.items && log.items.length > 0) {
        log.items.forEach((item: any) => {
          const qty = typeof item.quantity === "number" ? item.quantity : 0;
          let price = 0;
          if (item.productId && productIdPriceMap.has(item.productId)) {
            price = productIdPriceMap.get(item.productId)!;
          } else if (item.sku && productPriceMap.has(item.sku.toUpperCase())) {
            price = productPriceMap.get(item.sku.toUpperCase())!;
          }
          logRevenue += qty * price;
        });
      } else {
        const qty = typeof log.quantity === "number" ? log.quantity : 0;
        let price = 0;
        if (log.sku && productPriceMap.has(log.sku.toUpperCase())) {
          price = productPriceMap.get(log.sku.toUpperCase())!;
        }
        logRevenue += qty * price;
      }
      return logRevenue;
    };

    rawStockLogs.forEach((log) => {
      const isOutbound = log.type === "xuất";
      const isCompleted = log.status === "Hoàn thành" || log.status === "Thành công";
      if (!isOutbound || !isCompleted) return;

      const logDate = parseSafeDate(log.createdAt);
      if (!logDate || logDate.getFullYear() !== currentYear) return;

      const monthIndex = logDate.getMonth();
      revs[monthIndex] += getLogRevenue(log);
    });

    setMonthlyRevenue(revs);

    // Dynamic Period Calculation
    const now = new Date();
    let start: Date;
    let end: Date = now;
    let prevStart: Date;
    let prevEnd: Date;

    if (dateFilter === "day") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 1);
    } else if (dateFilter === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (dateFilter === "year") {
      start = new Date(now.getFullYear(), 0, 1);
      
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    } else { // custom
      const s = new Date(customStartDate + "T00:00:00");
      const e = new Date(customEndDate + "T23:59:59");
      start = s;
      end = e;
      
      const diffTime = Math.abs(e.getTime() - s.getTime());
      prevStart = new Date(s.getTime() - diffTime);
      prevEnd = new Date(s.getTime() - 1);
    }

    let currentPeriodRevenue = 0;
    let previousPeriodRevenue = 0;
    let currentPeriodOrders = 0;

    rawStockLogs.forEach((log) => {
      const isOutbound = log.type === "xuất";
      const isCompleted = log.status === "Hoàn thành" || log.status === "Thành công";
      if (!isOutbound || !isCompleted) return;

      const logDate = parseSafeDate(log.createdAt);
      if (!logDate) return;

      const rev = getLogRevenue(log);
      if (logDate >= start && logDate <= end) {
        currentPeriodRevenue += rev;
        currentPeriodOrders++;
      } else if (logDate >= prevStart && logDate <= prevEnd) {
        previousPeriodRevenue += rev;
      }
    });

    setFilteredTotalRevenue(currentPeriodRevenue);
    setFilteredOrderCount(currentPeriodOrders);

    let rate = 0;
    if (previousPeriodRevenue > 0) {
      rate = ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100;
    } else if (currentPeriodRevenue > 0) {
      rate = 100;
    }
    setGrowthRate(rate);

    const formatCurrencyShort = (val: number) => {
      return formatDashboardCurrency(val, 1, true);
    };
    setPrevRevenueShort(formatCurrencyShort(previousPeriodRevenue));

    const avg = currentPeriodOrders > 0 ? (currentPeriodRevenue / currentPeriodOrders) : 0;
    setAvgOrderValue(avg);

    // Build trend data for BarChart
    let trendData: Array<{ label: string; value: number }> = [];

    if (dateFilter === "day") {
      const intervals = ["0-4h", "4-8h", "8-12h", "12-16h", "16-20h", "20-24h"];
      const values = Array(6).fill(0);
      rawStockLogs.forEach((log) => {
        const isOutbound = log.type === "xuất";
        const isCompleted = log.status === "Hoàn thành" || log.status === "Thành công";
        if (!isOutbound || !isCompleted) return;

        const logDate = parseSafeDate(log.createdAt);
        if (logDate && logDate >= start && logDate <= end) {
          const hour = logDate.getHours();
          const idx = Math.min(5, Math.floor(hour / 4));
          values[idx] += getLogRevenue(log);
        }
      });
      trendData = intervals.map((label, idx) => ({ label, value: values[idx] }));
    } else if (dateFilter === "month") {
      const values = Array(4).fill(0);
      rawStockLogs.forEach((log) => {
        const isOutbound = log.type === "xuất";
        const isCompleted = log.status === "Hoàn thành" || log.status === "Thành công";
        if (!isOutbound || !isCompleted) return;

        const logDate = parseSafeDate(log.createdAt);
        if (logDate && logDate >= start && logDate <= end) {
          const dateNum = logDate.getDate();
          let idx = 0;
          if (dateNum <= 7) idx = 0;
          else if (dateNum <= 14) idx = 1;
          else if (dateNum <= 21) idx = 2;
          else idx = 3;
          values[idx] += getLogRevenue(log);
        }
      });
      trendData = [
        { label: "Tuần 1", value: values[0] },
        { label: "Tuần 2", value: values[1] },
        { label: "Tuần 3", value: values[2] },
        { label: "Tuần 4", value: values[3] },
      ];
    } else if (dateFilter === "year") {
      const months = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
      const values = Array(12).fill(0);
      rawStockLogs.forEach((log) => {
        const isOutbound = log.type === "xuất";
        const isCompleted = log.status === "Hoàn thành" || log.status === "Thành công";
        if (!isOutbound || !isCompleted) return;

        const logDate = parseSafeDate(log.createdAt);
        if (logDate && logDate >= start && logDate <= end) {
          const m = logDate.getMonth();
          values[m] += getLogRevenue(log);
        }
      });
      trendData = months.map((m, idx) => ({ label: m, value: values[idx] }));
    } else { // custom
      const diffMs = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 8) {
        const datesList: Date[] = [];
        for (let i = 0; i < diffDays; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          d.setHours(0, 0, 0, 0);
          datesList.push(d);
        }
        const values = Array(diffDays).fill(0);
        rawStockLogs.forEach((log) => {
          const isOutbound = log.type === "xuất";
          const isCompleted = log.status === "Hoàn thành" || log.status === "Thành công";
          if (!isOutbound || !isCompleted) return;

          const logDate = parseSafeDate(log.createdAt);
          if (logDate && logDate >= start && logDate <= end) {
            const logDayStart = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate()).getTime();
            const idx = datesList.findIndex(d => d.getTime() === logDayStart);
            if (idx !== -1) {
              values[idx] += getLogRevenue(log);
            }
          }
        });
        trendData = datesList.map((d, idx) => ({
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          value: values[idx]
        }));
      } else {
        const values = Array(6).fill(0);
        const intervalMs = diffMs / 6;
        rawStockLogs.forEach((log) => {
          const isOutbound = log.type === "xuất";
          const isCompleted = log.status === "Hoàn thành" || log.status === "Thành công";
          if (!isOutbound || !isCompleted) return;

          const logDate = parseSafeDate(log.createdAt);
          if (logDate && logDate >= start && logDate <= end) {
            const diff = logDate.getTime() - start.getTime();
            const idx = Math.min(5, Math.floor(diff / intervalMs));
            values[idx] += getLogRevenue(log);
          }
        });
        trendData = Array(6).fill(0).map((_, idx) => {
          const dStart = new Date(start.getTime() + idx * intervalMs);
          const dEnd = new Date(start.getTime() + (idx + 1) * intervalMs);
          return {
            label: `${dStart.getDate()}/${dStart.getMonth() + 1}-${dEnd.getDate()}/${dEnd.getMonth() + 1}`,
            value: values[idx]
          };
        });
      }
    }
    setRevenueTrendData(trendData);

    // Calculate product sales segments for "Cơ cấu nguồn"
    const productNameMap = new Map<string, string>();
    const productIdNameMap = new Map<string, string>();
    rawProducts.forEach((p) => {
      const name = p.name || p.sku || "Sản phẩm không tên";
      if (p.sku) productNameMap.set(p.sku.toUpperCase(), name);
      if (p.id) productIdNameMap.set(p.id, name);
    });

    const productQuantities = new Map<string, number>();
    rawStockLogs.forEach((log) => {
      const isOutbound = log.type === "xuất";
      const isCompleted = log.status === "Hoàn thành" || log.status === "Thành công";
      if (!isOutbound || !isCompleted) return;

      const logDate = parseSafeDate(log.createdAt);
      if (logDate && logDate >= start && logDate <= end) {
        if (log.items && log.items.length > 0) {
          log.items.forEach((item: any) => {
            const qty = typeof item.quantity === "number" ? item.quantity : 0;
            let name = "Sản phẩm khác";
            if (item.productId && productIdNameMap.has(item.productId)) {
              name = productIdNameMap.get(item.productId)!;
            } else if (item.sku && productNameMap.has(item.sku.toUpperCase())) {
              name = productNameMap.get(item.sku.toUpperCase())!;
            } else if (item.name) {
              name = item.name;
            }
            productQuantities.set(name, (productQuantities.get(name) || 0) + qty);
          });
        } else {
          const qty = typeof log.quantity === "number" ? log.quantity : 0;
          let name = "Sản phẩm khác";
          if (log.sku && productNameMap.has(log.sku.toUpperCase())) {
            name = productNameMap.get(log.sku.toUpperCase())!;
          } else if (log.name) {
            name = log.name;
          }
          productQuantities.set(name, (productQuantities.get(name) || 0) + qty);
        }
      }
    });

    const sortedProducts = Array.from(productQuantities.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);

    const totalQty = sortedProducts.reduce((acc, p) => acc + p.qty, 0);
    const calculatedSegments: Array<{ label: string; value: number; color: string }> = [];
    const segmentColors = ["#06b6c7", "#60a5fa", "#e99a2c", "#a855f7", "#64748b"];

    if (totalQty === 0) {
      calculatedSegments.push({ label: "Chưa có dữ liệu", value: 100, color: "#cbd5e1" });
    } else {
      if (sortedProducts.length <= 3) {
        let sumPcts = 0;
        sortedProducts.forEach((p, idx) => {
          let pct = Math.round((p.qty / totalQty) * 100);
          if (idx === sortedProducts.length - 1) {
            pct = 100 - sumPcts;
          }
          sumPcts += pct;
          calculatedSegments.push({ label: p.name, value: pct, color: segmentColors[idx % segmentColors.length] });
        });
      } else {
        const top1Pct = Math.round((sortedProducts[0].qty / totalQty) * 100);
        const top2Pct = Math.round((sortedProducts[1].qty / totalQty) * 100);
        const othersPct = 100 - top1Pct - top2Pct;

        calculatedSegments.push({ label: sortedProducts[0].name, value: top1Pct, color: segmentColors[0] });
        calculatedSegments.push({ label: sortedProducts[1].name, value: top2Pct, color: segmentColors[1] });
        calculatedSegments.push({ label: "Sản phẩm khác", value: othersPct, color: segmentColors[2] });
      }
    }
    setProductSegments(calculatedSegments);
    setTotalProductsSold(totalQty);

  }, [rawStockLogs, rawProducts, dateFilter, customStartDate, customEndDate]);

  const handleCreateReorder = (productName?: string) => {
    const name = productName || lowStockItems[0]?.name || "sản phẩm";
    toast.success(`AI đã tạo đề xuất đơn nhập kho cho ${name}. Vui lòng kiểm tra lại trong KHO & SẢN PHẨM.`);
  };

  const handleCreatePromotion = (productName?: string) => {
    const name = productName || overstockItems[0]?.name || "sản phẩm";
    toast.success(`Đề xuất chiến dịch ưu đãi đã được tạo cho ${name}. Hãy xem chi tiết.`);
  };

  const handleRecommendAgent = () => {
    toast.info("AI đã gợi ý tạo Agent trả lời tự động để xử lý mẫu yêu cầu khách hàng tương tự.");
  };

  const todayLabel = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-h-[85vh] max-w-7xl overflow-y-auto pr-2 text-left" id="dashboard_tab_view">
      <div className="mb-8 flex flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-sans text-3xl font-bold tracking-tight text-gray-800">
              {activeView === "revenue" ? "Phân tích doanh thu" : "Tổng quan Doanh nghiệp"}
            </h1>
            <p className="mt-2 text-sm text-gray-655">Hôm nay, {todayLabel}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-slate-100 pb-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-xl bg-slate-100/80 p-1 w-fit">
            {tabs.filter((tab) => tab.id !== "revenue" || canSeeInventory).map((tab) => {
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`rounded-lg px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${isActive
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-gray-500 hover:bg-white/50 hover:text-gray-800"
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl bg-slate-100/80 p-1">
              {[
                { id: "day", label: "Ngày" },
                { id: "month", label: "Tháng" },
                { id: "year", label: "Năm" },
                { id: "custom", label: "Tùy chọn" },
              ].map((f) => {
                const isActive = dateFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setDateFilter(f.id as DateFilterType)}
                    className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-200 ${isActive
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                      }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {dateFilter === "custom" && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-150 bg-white p-1.5 shadow-xs animate-fade-in">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="rounded-md border-0 bg-transparent p-0 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-0 cursor-pointer"
                />
                <span className="text-[10px] font-bold text-gray-400">đến</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="rounded-md border-0 bg-transparent p-0 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-0 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {activeView === "overview" && (
        <OverviewPanel
          employeeCount={employeeCount}
          employeeLabel={employeeLabel}
          totalProducts={totalProducts}
          pendingShipments={pendingShipments}
          overstockItems={overstockItems}
          onCreateReorder={handleCreateReorder}
          onCreatePromotion={handleCreatePromotion}
          onRecommendAgent={handleRecommendAgent}
          lowStockCount={lowStockCount}
          lowStockItems={lowStockItems}
          totalRevenue={filteredTotalRevenue}
          trendData={revenueTrendData}
          newHiresCount={newHiresCount}
          todayTimekeeping={todayTimekeeping}
          isTimekeepingLoading={isTimekeepingLoading}
          onRefreshTimekeeping={fetchTodayTimekeeping}
          summary={summary}
          canSeeHr={canSeeHr}
          canSeeInventory={canSeeInventory}
          canSeeResource={canSeeResource}
          canSeeChat={canSeeChat}
          canSeeStudent={canSeeStudent}
        />
      )}
      {activeView === "revenue" && canSeeInventory && (
        <RevenuePanel
          totalRevenue={filteredTotalRevenue}
          growthRate={growthRate}
          prevRevenueShort={prevRevenueShort}
          avgOrderValue={avgOrderValue}
          orderCount={filteredOrderCount}
          trendData={revenueTrendData}
          productSegments={productSegments}
          totalProductsSold={totalProductsSold}
        />
      )}
    </div>
  );
}

function OverviewPanel({
  employeeCount,
  employeeLabel,
  totalProducts,
  pendingShipments,
  overstockItems,
  onCreateReorder,
  onCreatePromotion,
  onRecommendAgent,
  lowStockCount,
  lowStockItems,
  totalRevenue,
  trendData,
  newHiresCount,
  todayTimekeeping,
  isTimekeepingLoading,
  onRefreshTimekeeping,
  summary,
  canSeeHr,
  canSeeInventory,
  canSeeResource,
  canSeeChat,
  canSeeStudent,
}: {
  employeeCount: string;
  employeeLabel: string;
  totalProducts: string;
  pendingShipments: string;
  overstockItems: any[];
  onCreateReorder: (productName?: string) => void;
  onCreatePromotion: (productName?: string) => void;
  onRecommendAgent: () => void;
  lowStockCount: string;
  lowStockItems: any[];
  totalRevenue: number;
  trendData: Array<{ label: string; value: number }>;
  newHiresCount: number;
  todayTimekeeping: any;
  isTimekeepingLoading: boolean;
  onRefreshTimekeeping: () => void;
  summary: DashboardSummary | null;
  canSeeHr: boolean;
  canSeeInventory: boolean;
  canSeeResource: boolean;
  canSeeChat: boolean;
  canSeeStudent: boolean;
}) {
  const [showLowStockModal, setShowLowStockModal] = useState<boolean>(false);

  const goToTab = (tab: string, subTab?: string) => {
    const pathMap: Record<string, string> = {
      "TỔNG QUAN": "/tong-quan",
      "NHÂN SỰ": "/nhan-su",
      "KHO & SẢN PHẨM": "/kho-san-pham",
      "QUẢN TRỊ USER": "/quan-tri-user",
      "CÀI ĐẶT": "/cai-dat",
      "VÍ & NẠP TIỀN": "/vi-nap-tien",
      "QUẢN LÝ HỌC VIÊN": "/quan-ly-hoc-vien",
      "TRÒ CHUYỆN": "/tro-chuyen",
      "QUẢN LÝ TÀI NGUYÊN": "/quan-ly-tai-nguyen",
    };
    let path = pathMap[tab];
    if (path) {
      if (subTab) {
        path += `?sub=${subTab}`;
      }
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        {canSeeHr && <TimekeepingWidget
          todayTimekeeping={todayTimekeeping}
          isLoading={isTimekeepingLoading}
          onRefresh={onRefreshTimekeeping}
        />}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {canSeeHr && <ModuleCard
            icon={Users}
            tone="amber"
            title="Nhân sự"
            value={employeeCount}
            label={employeeLabel}
            footer="Nhân sự mới"
            footerValue={`+${newHiresCount}`}
            progress={Math.min(100, (parseInt(employeeCount) || 0) > 0 ? Math.round((newHiresCount / (parseInt(employeeCount) || 1)) * 100) : 0)}
            onClick={() => goToTab("NHÂN SỰ")}
          />}
          {canSeeInventory && <ModuleCard icon={PackageCheck} tone="blue" title="Kho & Sản phẩm" value={totalProducts} label="Tổng sản phẩm" footer="Đơn chờ xuất" footerValue={`${pendingShipments} Đơn`} progress={78} alert lowCount={lowStockCount} onClick={() => goToTab("KHO & SẢN PHẨM")} />}
        </div>

        {/* Số liệu các module còn lại — dữ liệu tổng hợp từ /api/v1/dashboard/summary */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {canSeeHr && <ModuleCard
            icon={KanbanSquare}
            tone="indigo"
            title="Dự án & Công việc"
            value={summary ? String(summary.projects.tasks.doing) : "..."}
            label="Task đang làm"
            footer="Dự án hoạt động"
            footerValue={summary ? String(summary.projects.activeProjects) : "..."}
            progress={
              summary && summary.projects.tasks.total > 0
                ? Math.round((summary.projects.tasks.done / summary.projects.tasks.total) * 100)
                : 0
            }
            alert
            lowCount={summary ? String(summary.projects.overdueTasks) : "..."}
            onClick={() => goToTab("NHÂN SỰ", "kanban")}
          />}
          {canSeeStudent && <ModuleCard
            icon={GraduationCap}
            tone="emerald"
            title="Học viên"
            value={summary ? String(summary.students.totalStudents) : "..."}
            label="Tổng học viên"
            footer="Học viên mới trong kỳ"
            footerValue={summary ? `+${summary.students.newStudents}` : "..."}
            progress={
              summary && summary.students.totalStudents > 0
                ? Math.min(100, Math.round((summary.students.newStudents / summary.students.totalStudents) * 100))
                : 0
            }
            onClick={() => goToTab("QUẢN LÝ HỌC VIÊN", "hoc-vien")}
          />}
          {canSeeStudent && <ModuleCard
            icon={Wallet}
            tone="amber"
            title="Học phí & Công nợ"
            value={summary ? formatDashboardCurrency(summary.students.tuitionRevenue, 1, false) : "..."}
            label="Học phí đã thu"
            footer="Công nợ còn lại"
            footerValue={summary ? formatDashboardCurrency(summary.students.outstandingDebt, 1, false) : "..."}
            progress={
              summary && summary.students.tuitionRevenue + summary.students.outstandingDebt > 0
                ? Math.round(
                  (summary.students.tuitionRevenue /
                    (summary.students.tuitionRevenue + summary.students.outstandingDebt)) *
                  100
                )
                : 0
            }
            onClick={() => goToTab("QUẢN LÝ HỌC VIÊN", "hoc-phi")}
          />}
          {canSeeHr && <ModuleCard
            icon={UserCheck}
            tone="blue"
            title="Chấm công hôm nay"
            value={summary ? `${summary.timekeeping.checkedInToday}/${summary.timekeeping.totalEmployees}` : "..."}
            label="Đã điểm danh"
            footer="Đi muộn"
            footerValue={summary ? String(summary.timekeeping.lateToday) : "..."}
            progress={
              summary && summary.timekeeping.totalEmployees > 0
                ? Math.round((summary.timekeeping.checkedInToday / summary.timekeeping.totalEmployees) * 100)
                : 0
            }
            onClick={() => goToTab("NHÂN SỰ", "lich")}
          />}
          {canSeeChat && <ModuleCard
            icon={MessageSquare}
            tone="slate"
            title="Trò chuyện"
            value={summary ? String(summary.chat.unreadMessages) : "..."}
            label="Tin chưa đọc"
            footer="Phòng chat tham gia"
            footerValue={summary ? String(summary.chat.roomCount) : "..."}
            progress={summary && summary.chat.unreadMessages > 0 ? 100 : 0}
            onClick={() => goToTab("TRÒ CHUYỆN")}
          />}
          {canSeeResource && <ModuleCard
            icon={FolderOpen}
            tone="indigo"
            title="Tài nguyên"
            value={summary ? String(summary.resources.fileCount) : "..."}
            label="Tổng số file"
            footer="Tải lên trong kỳ"
            footerValue={summary ? `+${summary.resources.recentUploads}` : "..."}
            progress={
              summary && summary.resources.fileCount > 0
                ? Math.min(100, Math.round((summary.resources.recentUploads / summary.resources.fileCount) * 100))
                : 0
            }
            onClick={() => goToTab("QUẢN LÝ TÀI NGUYÊN")}
          />}
          {canSeeHr && <ModuleCard
            icon={BookOpen}
            tone="emerald"
            title="Đào tạo"
            value={summary ? String(summary.training.ongoingCourses) : "..."}
            label="Khóa đang diễn ra"
            footer="Lượt ghi danh"
            footerValue={summary ? String(summary.training.enrollments.total) : "..."}
            progress={
              summary && summary.training.enrollments.total > 0
                ? Math.round((summary.training.enrollments.completed / summary.training.enrollments.total) * 100)
                : 0
            }
            onClick={() => goToTab("NHÂN SỰ", "dao-tao")}
          />}
        </div>

        {/* Biểu đồ tổng quát các module */}
        {summary && canSeeHr && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <DonutCard
              title="Trạng thái công việc"
              centerLabel="Tổng việc"
              centerValue={summary.projects.tasks.total.toLocaleString("vi-VN")}
              segments={buildPctSegments(
                [
                  { label: "Chưa làm", value: summary.projects.tasks.todo, color: "#f59e0b" },
                  { label: "Đang làm", value: summary.projects.tasks.doing, color: "#2563eb" },
                  { label: "Hoàn thành", value: summary.projects.tasks.done, color: "#059669" },
                ],
                "việc"
              )}
            />
            <DonutCard
              title="Tiến độ đào tạo"
              centerLabel="Lượt ghi danh"
              centerValue={summary.training.enrollments.total.toLocaleString("vi-VN")}
              segments={buildPctSegments(
                [
                  { label: "Chưa bắt đầu", value: summary.training.enrollments.notStarted, color: "#f59e0b" },
                  { label: "Đang học", value: summary.training.enrollments.inProgress, color: "#2563eb" },
                  { label: "Hoàn thành", value: summary.training.enrollments.completed, color: "#059669" },
                ],
                "lượt"
              )}
            />
            <DonutCard
              title="Chấm công hôm nay"
              centerLabel="Nhân sự"
              centerValue={summary.timekeeping.totalEmployees.toLocaleString("vi-VN")}
              segments={buildPctSegments(
                [
                  { label: "Đúng giờ", value: Math.max(0, summary.timekeeping.checkedInToday - summary.timekeeping.lateToday), color: "#059669" },
                  { label: "Đi muộn", value: summary.timekeeping.lateToday, color: "#f59e0b" },
                  { label: "Chưa điểm danh", value: Math.max(0, summary.timekeeping.totalEmployees - summary.timekeeping.checkedInToday), color: "#e2e8f0" },
                ],
                "người"
              )}
            />
          </div>
        )}

        {canSeeInventory && <div className="grid grid-cols-1 gap-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">Doanh thu xuất kho</h3>
              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-600">Đơn vị: VNĐ</span>
            </div>
            <BarChart data={trendData} />
          </div>
        </div>}

        {canSeeInventory && <div className="grid grid-cols-1 gap-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Cảnh báo tồn kho</h3>
                </div>
                <button onClick={() => goToTab("KHO & SẢN PHẨM")} className="text-xs font-semibold text-blue-655 hover:text-blue-700 transition-colors">Xem tất cả</button>
              </div>

              {lowStockItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-gray-500">
                  <PackageCheck className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  Tồn kho hiện tại đang ở mức an toàn.
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStockItems.slice(0, 3).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="truncate text-sm font-bold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-500">SKU: {p.sku} · Định mức: {p.minStockAlert}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-500/10">
                          Tồn: {p.stock}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {lowStockItems.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Tổng số sản phẩm yếu:</span>
                <span className="font-mono text-base font-extrabold text-rose-600">{lowStockCount} SKU</span>
              </div>
            )}
            {showLowStockModal && <LowStockModal products={lowStockItems} onClose={() => setShowLowStockModal(false)} />}
          </div>
        </div>}
      </div>

      <aside className="rounded-3xl border border-blue-100 bg-blue-50/60 p-6 shadow-sm flex flex-col justify-start">
        <div className="mb-6 flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/10 ring-2 ring-white">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-850">AI Đề Xuất</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-550">Chủ động cảnh báo rủi ro, tối ưu hóa quy trình vận hành tức thì.</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            {
              icon: AlertTriangle,
              moduleKey: "inventory",
              title: lowStockItems.length > 0 ? `${lowStockItems[0].name} có nguy cơ cạn kho` : "Kho hiện ổn định",
              body: lowStockItems.length > 0
                ? `AI dự báo sản phẩm ${lowStockItems[0].name} có tồn ${lowStockItems[0].stock}, thấp hơn ngưỡng cảnh báo ${lowStockItems[0].minStockAlert}.`
                : "AI chưa phát hiện rủi ro tồn kho đáng báo động trong 3 ngày tới.",
              action: lowStockItems.length > 0 ? "Tạo đơn nhập kho ngay" : "Xem báo cáo kho",
              color: "red",
              onAction: () => {
                if (lowStockItems.length > 0) {
                  onCreateReorder(lowStockItems[0]?.name);
                } else {
                  onCreateReorder();
                }
                goToTab("KHO & SẢN PHẨM");
              },
            },
            {
              icon: Bot,
              moduleKey: undefined,
              title: "Tự động hóa CSKH bằng AI",
              body: "AI phát hiện có cơ hội thiết lập thêm Agent trả lời tự động để chăm sóc khách hàng 24/7 và cải thiện chuyển đổi.",
              action: "Trải nghiệm AI Agent",
              color: "indigo",
              onAction: () => {
                onRecommendAgent();
              },
            },
          ].filter((item) => !item.moduleKey || canSeeInventory).map((item) => (
            <AiInsightCard key={item.title} {...item} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function RevenuePanel({
  totalRevenue,
  growthRate,
  prevRevenueShort,
  avgOrderValue,
  orderCount,
  trendData,
  productSegments,
  totalProductsSold,
}: {
  totalRevenue: number;
  growthRate: number;
  prevRevenueShort: string;
  avgOrderValue: number;
  orderCount: number;
  trendData: Array<{ label: string; value: number }>;
  productSegments: Array<{ label: string; value: number; color: string }>;
  totalProductsSold: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={DollarSign}
          label="Tổng doanh thu"
          value={formatDashboardCurrency(totalRevenue, 1, false)}
          delta={`${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`}
          tone="emerald"
        />
        <MetricCard
          icon={CheckCircle}
          label="Đơn hàng hoàn thành"
          value={orderCount.toLocaleString("vi-VN")}
          delta={`Kỳ trước: ${prevRevenueShort}`}
          tone="blue"
        />
        <MetricCard
          icon={Wallet}
          label="Giá trị đơn trung bình"
          value={formatDashboardCurrency(avgOrderValue, 1, false)}
          delta="Đơn hoàn thành"
          tone="amber"
        />
        <MetricCard
          icon={PackageCheck}
          label="Sản phẩm đã bán"
          value={totalProductsSold.toLocaleString("vi-VN")}
          delta="Tổng số lượng"
          tone="indigo"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">Doanh thu xuất kho</h3>
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-600">Đơn vị: VNĐ</span>
          </div>
          <BarChart data={trendData} />
        </div>

        <DonutCard
          title="Cơ cấu nguồn"
          centerLabel="Sản phẩm đã bán"
          centerValue={totalProductsSold.toLocaleString("vi-VN")}
          segments={productSegments}
        />
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="mb-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">Tần suất làm việc trong tuần</h3>
        </div>
        <WorkloadChart />
      </div>
    </div>
  );
}

function ModuleCard({
  icon: Icon,
  tone,
  title,
  value,
  label,
  footer,
  footerValue,
  progress,
  alert,
  lowCount,
  onClick,
}: {
  icon: React.ElementType;
  tone: Tone;
  title: string;
  value: string;
  label: string;
  footer: string;
  footerValue: string;
  progress: number;
  alert?: boolean;
  lowCount?: string;
  onClick?: () => void;
}) {
  const color = toneClass[tone];
  const isAlertActive = alert && lowCount && lowCount !== "0" && lowCount !== "...";
  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md cursor-pointer hover:border-slate-200"
    >
      <div>
        <div className="mb-6 flex items-start justify-between">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${color.soft} ${color.text} group-hover:scale-105 transition-transform`}>
            <Icon className="h-5.5 w-5.5" />
          </div>
          {isAlertActive && (
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-500/10 animate-pulse">
              Cảnh báo: {lowCount}
            </span>
          )}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
        <p className="mt-2 font-sans text-3xl font-extrabold tracking-tight text-gray-800 truncate" title={value}>
          {value}
        </p>
        <p className="mt-1.5 text-xs text-gray-500">{label}</p>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-gray-400 truncate pr-2">{footer}</span>
          <span className={`font-bold shrink-0 ${color.strong}`}>{footerValue}</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, delta, tone = "blue", negative = false }: any) {
  const color = toneClass[(tone as Tone) || "blue"];
  const badgeColor = negative ? "bg-rose-50 text-rose-600 ring-rose-500/10" : "bg-emerald-50 text-emerald-600 ring-emerald-500/10";
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="mb-6 flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color.soft} ${color.text}`}>
          <Icon className="h-5.5 w-5.5" />
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${badgeColor}`}>
          {delta}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-3 font-sans text-3xl font-extrabold tracking-tight text-gray-800 truncate" title={value}>{value}</p>
    </div>
  );
}

function DonutCard({
  compact = false,
  segments,
  title = "",
  centerLabel = "Tổng số",
  centerValue,
}: {
  compact?: boolean;
  segments?: Array<{ label: string; value: number; color: string; display?: string }>;
  title?: string;
  centerLabel?: string;
  centerValue?: string;
}) {
  const radius = 66;
  const circumference = 2 * Math.PI * radius;

  let localSegments = segments || [];
  let localCenterValue = centerValue || "";

  if (localSegments.length === 0) {
    localSegments = [
      { label: "Chưa có dữ liệu", value: 100, color: "#cbd5e1", display: "0 bài" }
    ];
    localCenterValue = "0";
  }

  let offset = 0;

  return (
    <div className={compact ? "" : "rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300"}>
      {!compact && title && <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-gray-800">{title}</h3>}
      
      <div className="flex flex-col items-center gap-5 w-full">
        <div className="relative h-40 w-40 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 180 180" aria-label={title}>
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#f8fafc" strokeWidth="24" />
            {localSegments.map((segment) => {
              const dash = (segment.value / 100) * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="24"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                >
                  <title>{`${segment.label}: ${segment.display || `${segment.value}%`}`}</title>
                </circle>
              );
              offset += dash;
              return circle;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{centerLabel}</span>
            <strong className="font-sans text-xl font-extrabold text-gray-800">{localCenterValue}</strong>
          </div>
        </div>
        <div className="w-full space-y-2.5 text-xs border-t border-slate-100/85 pt-4">
          {localSegments.map((segment) => (
            <Legend key={segment.label} color={segment.color} label={segment.label} value={segment.display || `${segment.value}%`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChart({ data = [] }: { data?: Array<{ label: string; value: number }> }) {
  const rawMax = Math.max(...data.map(d => d.value), 0);
  const hasData = rawMax > 0;
  const maxVal = hasData ? rawMax : 1; // only used for bar heights when hasData

  const formatCurrencyShort = (val: number) => {
    if (!hasData) return "₫0";
    return formatDashboardCurrency(val, 1, true);
  };

  return (
    <div className="relative h-[320px]">
      <div className="absolute inset-x-0 bottom-10 top-0 flex flex-col justify-between text-xs font-semibold text-gray-400">
        {[
          formatCurrencyShort(rawMax),
          formatCurrencyShort(rawMax * 2 / 3),
          formatCurrencyShort(rawMax / 3),
          "₫0"
        ].map((y, idx) => (
          <div key={idx} className="flex items-center gap-3 h-0">
            <span className="w-12 shrink-0 text-left">{y}</span>
            <span className="h-px flex-1 border-t border-dashed border-slate-100" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-16 right-4 top-6 flex items-end justify-between gap-4">
        {data.map((item, i) => {
          const h = (item.value / maxVal) * 80; // keep max at 80% to fit neatly
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-2 h-full justify-end">
              <div
                title={`${item.label}: ${item.value.toLocaleString("vi-VN")} ₫`}
                className={`w-full max-w-16 rounded-t-lg transition-all duration-500 ${
                  i === data.length - 1
                    ? "bg-gradient-to-t from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20"
                    : "bg-gradient-to-t from-slate-200 to-slate-100 hover:from-blue-300 hover:to-blue-200"
                }`}
                style={{ height: `${h}%` }}
              />
              <span
                className={`text-[10px] font-bold mt-1 ${i === data.length - 1 ? "text-blue-600" : "text-gray-450"} truncate max-w-full`}
                title={item.label}
                style={{ visibility: data.length >= 8 && i % 2 !== 0 && i !== data.length - 1 ? "hidden" : "visible" }}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkloadChart() {
  const ai = [56, 66, 78, 70, 82, 39, 31];
  const human = [39, 35, 44, 31, 48, 22, 18];
  return (
    <div className="relative h-[360px] border-t border-gray-100 pt-8">
      <div className="absolute left-0 top-12 flex h-64 flex-col justify-between text-xs text-gray-400">
        <span>10k</span><span>7.5k</span><span>5k</span><span>2.5k</span><span>0</span>
      </div>
      <div className="ml-12 flex h-72 items-end justify-between gap-5">
        {ai.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-3">
            <div className="flex h-64 items-end gap-3">
              <div className="w-7 rounded-t bg-blue-100 ring-1 ring-blue-200" style={{ height: `${human[i]}%` }} />
              <div className="w-7 rounded-t bg-blue-500" style={{ height: `${v}%` }} />
            </div>
            <span className="text-sm text-gray-600">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiInsightCard({ icon: Icon, title, body, action, color, onAction }: any) {
  const border = color === "red" ? "border-l-red-500" : color === "amber" ? "border-l-amber-500" : "border-l-blue-500";
  const text = color === "red" ? "text-red-600" : color === "amber" ? "text-amber-600" : "text-blue-600";
  const bg = color === "red" ? "bg-red-50" : color === "amber" ? "bg-amber-50" : "bg-blue-50";
  return (
    <div className={`rounded-2xl border border-slate-100 border-l-4 ${border} bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow duration-200`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
          <Icon className={`h-4.5 w-4.5 ${text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-gray-850 truncate">{title}</h4>
          <p className="mt-2 text-xs leading-relaxed text-gray-655">{body}</p>
        </div>
      </div>
      {action && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onAction}
            className="inline-flex rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-2xs hover:shadow-xs cursor-pointer"
          >
            {action}
          </button>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, value }: any) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 text-xs">
      <span className="flex min-w-0 items-center gap-2 text-gray-655">
        <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate font-semibold text-left">{label}</span>
      </span>
      <strong className="font-mono text-gray-800 font-bold shrink-0">{value}</strong>
    </div>
  );
}

function TimekeepingWidget({
  todayTimekeeping,
  isLoading,
  onRefresh,
}: {
  todayTimekeeping: any;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [checking, setChecking] = useState<"in" | "out" | null>(null);
  const [gpsPermission, setGpsPermission] = useState<"granted" | "denied" | "prompt" | "unsupported">("prompt");

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then((status) => {
        setGpsPermission(status.state as any);
        status.onchange = () => {
          setGpsPermission(status.state as any);
        };
      }).catch(() => {
        setGpsPermission("prompt");
      });
    } else {
      setGpsPermission("unsupported");
    }
  }, []);

  const handleAction = async (type: "in" | "out") => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      return;
    }

    setChecking(type);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const url = type === "in" ? "/api/v1/timekeeping/check-in" : "/api/v1/timekeeping/check-out";
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
            body: JSON.stringify({
              latitude,
              longitude,
              deviceInfo: navigator.userAgent,
            }),
          });
          const result = await res.json();
          if (res.ok) {
            toast.success(result.message || `Check-${type} thành công!`);
            onRefresh();
          } else {
            toast.error(result.message || `Không thể Check-${type}.`);
          }
        } catch (err) {
          toast.error("Lỗi kết nối khi gửi dữ liệu chấm công.");
        } finally {
          setChecking(null);
        }
      },
      (error) => {
        setChecking(null);
        console.error("Lỗi định vị:", error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Vui lòng cho phép truy cập vị trí trên trình duyệt để chấm công.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Không thể xác định vị trí hiện tại.");
            break;
          case error.TIMEOUT:
            toast.error("Thời gian định vị GPS hết hạn.");
            break;
          default:
            toast.error("Lỗi định vị không xác định.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const hasCheckIn = !!todayTimekeeping?.checkIn;
  const hasCheckOut = !!todayTimekeeping?.checkOut;

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "--:--";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  let statusText = "Chưa chấm công";
  let statusColor = "bg-rose-500";
  let statusBadge = "bg-rose-50 text-rose-700 ring-rose-500/10";
  if (hasCheckIn) {
    if (hasCheckOut) {
      statusText = "Đã hoàn thành chấm công";
      statusColor = "bg-blue-500";
      statusBadge = "bg-blue-50 text-blue-700 ring-blue-500/10";
    } else {
      statusText = todayTimekeeping.status === "Late" ? "Đã check-in (Muộn)" : "Đã check-in (Đúng giờ)";
      statusColor = todayTimekeeping.status === "Late" ? "bg-amber-500" : "bg-emerald-500";
      statusBadge = todayTimekeeping.status === "Late" ? "bg-amber-50 text-amber-700 ring-amber-500/10" : "bg-emerald-50 text-emerald-700 ring-emerald-500/10";
    }
  }

  return (
    <div className="w-full bg-white/70 backdrop-blur-md border border-slate-150 rounded-3xl p-6 shadow-xs relative overflow-hidden transition-all hover:shadow-md duration-300 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4 text-left w-full md:w-auto">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-650 ring-4 ring-indigo-500/10">
              <Clock className="h-7 w-7" />
            </div>
            <span className={`absolute -top-1 -right-1 flex h-4.5 w-4.5 rounded-full ${statusColor} border-2 border-white items-center justify-center shadow-xs`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusColor} opacity-75`} />
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-bold text-gray-800">Chấm công GPS hàng ngày</h4>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${statusBadge}`}>
                {statusText}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {hasCheckIn ? (
                <>
                  Vào: <span className="font-bold text-gray-700">{formatTime(todayTimekeeping.checkIn.time)}</span>
                  {todayTimekeeping.checkIn.distance > 0 && ` (${Math.round(todayTimekeeping.checkIn.distance)}m)`}
                  {hasCheckOut && (
                    <>
                      {" · "}Ra: <span className="font-bold text-gray-700">{formatTime(todayTimekeeping.checkOut.time)}</span>
                      {todayTimekeeping.checkOut.distance > 0 && ` (${Math.round(todayTimekeeping.checkOut.distance)}m)`}
                    </>
                  )}
                </>
              ) : (
                "Vui lòng bật định vị và thực hiện Check-in đúng giờ quy định."
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={() => handleAction("in")}
            disabled={hasCheckIn || checking !== null || isLoading}
            className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all duration-200 cursor-pointer ${
              hasCheckIn
                ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed border border-slate-300/40"
                : checking === "in"
                ? "bg-indigo-400 cursor-wait animate-pulse"
                : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-indigo-600/10"
            }`}
          >
            {checking === "in" ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Check-In"
            )}
          </button>

          <button
            onClick={() => handleAction("out")}
            disabled={!hasCheckIn || hasCheckOut || checking !== null || isLoading}
            className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all duration-200 cursor-pointer ${
              !hasCheckIn || hasCheckOut
                ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed border border-slate-300/40"
                : checking === "out"
                ? "bg-emerald-400 cursor-wait animate-pulse"
                : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] shadow-emerald-600/10"
            }`}
          >
            {checking === "out" ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Check-Out"
            )}
          </button>
        </div>
      </div>

      {gpsPermission === "prompt" && (
        <div className="w-full p-3 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-2xl flex items-center gap-2 animate-pulse">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-indigo-600" />
          <span className="text-[11px] font-semibold text-left">iGen ERP cần quyền vị trí của bạn để chấm công. Vui lòng chọn "Cho phép" (Allow) khi trình duyệt yêu cầu.</span>
        </div>
      )}

      {gpsPermission === "denied" && (
        <div className="w-full p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-600" />
          <span className="text-[11px] font-semibold text-left">Bạn đã chặn quyền truy cập vị trí. Vui lòng mở cài đặt trình duyệt, cho phép quyền truy cập vị trí và tải lại trang để chấm công.</span>
        </div>
      )}
    </div>
  );
}
