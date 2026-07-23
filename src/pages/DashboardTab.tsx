/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-empty */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Bot,
  CheckCircle2,
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isModuleEnabled } from "../config/modules";
import { authService } from "../services/authService";
import { inventoryProductService } from "../services/inventoryProductService";
import { inventoryStockLogService } from "../services/inventoryStockLogService";
import { dashboardService } from "../services/dashboardService";
import { toast } from "../pages/Toast";
import { UserProfile } from "../types";
import { DashboardSummary, DashboardActionItems } from "../types/dashboard";
import { formatDashboardCurrency } from "../components/dashboard/dashboardUtils";
import { OverviewPanel } from "../components/dashboard/OverviewPanel";
import { RevenuePanel } from "../components/dashboard/RevenuePanel";

type DashboardView = "overview" | "revenue";

const tabs: Array<{ id: DashboardView; label: string; icon: any }> = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "revenue", label: "Phân tích doanh thu", icon: TrendingUp },
];

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
  const [todayWorkCalendar, setTodayWorkCalendar] = useState<{ date: string; isWorkingDay: boolean; label?: string } | null>(null);
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
        setTodayTimekeeping(result.data?.log ?? null);
        setTodayWorkCalendar(result.data?.workCalendar ?? null);
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

  const [actionItems, setActionItems] = useState<DashboardActionItems | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    let cancelled = false;

    const loadActionItems = () => {
      dashboardService
        .getActionItems()
        .then((data) => {
          if (!cancelled) setActionItems(data);
        })
        .catch((err) => {
          console.error("Lỗi tải việc cần xử lý hôm nay:", err);
        });
    };

    loadActionItems();
    const intervalId = setInterval(loadActionItems, 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [userProfile?.uid]);

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
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-sans text-xl font-bold tracking-tight text-slate-900">
              {activeView === "revenue" ? "Phân tích doanh thu" : "Tổng quan Doanh nghiệp"}
            </h1>
            <p className="text-xs text-slate-500 font-medium">Hôm nay, {todayLabel}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-0 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1 overflow-x-auto select-none">
            {tabs.filter((tab) => tab.id !== "revenue" || canSeeInventory).map((tab) => {
              const isActive = activeView === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs transition-all cursor-pointer shrink-0 border-b-2 -mb-px rounded-t-xl ${
                    isActive
                      ? "border-sky-600 text-sky-700 font-bold bg-sky-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-sky-600" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
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
          todayWorkCalendar={todayWorkCalendar}
          isTimekeepingLoading={isTimekeepingLoading}
          onRefreshTimekeeping={fetchTodayTimekeeping}
          summary={summary}
          canSeeHr={canSeeHr}
          canSeeInventory={canSeeInventory}
          canSeeResource={canSeeResource}
          canSeeChat={canSeeChat}
          canSeeStudent={canSeeStudent}
          role={userProfile?.role}
          actionItems={actionItems}
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

export { getTimekeepingStatusDisplay } from "../components/dashboard/TimekeepingWidget";
