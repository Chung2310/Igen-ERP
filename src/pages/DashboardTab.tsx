import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CheckCircle,
  Clock,
  DollarSign,
  Filter,
  Lightbulb,
  Megaphone,
  MoreVertical,
  PackageCheck,
  Rocket,
  Sparkles,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { inventoryProductService } from "../services/inventoryProductService";
import { inventoryStockLogService } from "../services/inventoryStockLogService";
import { marketingService } from "../services/marketingService";
import { crmService } from "../services/crmService";
import { toast } from "../pages/Toast";
import { UserProfile, ContentApprovalCard } from "../types";
import LowStockModal from "../components/inventory/LowStockModal";

type DashboardView = "overview" | "revenue" | "ai";
type Tone = "blue" | "amber" | "slate" | "indigo" | "emerald";

const tabs: Array<{ id: DashboardView; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "revenue", label: "Phân tích doanh thu" },
  { id: "ai", label: "Hiệu suất AI" },
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

const getDescendantEmployeeCount = (rootId: string, users: UserProfile[]) => {
  return getDescendantEmployees(rootId, users).length;
};

const formatCardDate = (dateStr: any): string => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  } catch (e) {
    return String(dateStr);
  }
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
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [employeeCount, setEmployeeCount] = useState<string>("...");
  const [employeeLabel, setEmployeeLabel] = useState<string>("Tổng nhân sự");
  const [newHiresCount, setNewHiresCount] = useState<number>(0);
  const [totalProducts, setTotalProducts] = useState<string>("...");
  const [pendingShipments, setPendingShipments] = useState<string>("...");
  const [marketingPendingCount, setMarketingPendingCount] = useState<string>("...");
  const [marketingApprovalRate, setMarketingApprovalRate] = useState<string>("...");
  const [marketingPendingItems, setMarketingPendingItems] = useState<ContentApprovalCard[]>([]);
  const [overstockItems, setOverstockItems] = useState<any[]>([]);
  const [pendingReviewPage, setPendingReviewPage] = useState<number>(1);
  const [lowStockCount, setLowStockCount] = useState<string>("...");
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [marketingCards, setMarketingCards] = useState<ContentApprovalCard[]>([]);
  const [rawMarketingCards, setRawMarketingCards] = useState<ContentApprovalCard[]>([]);
  const [rawStockLogs, setRawStockLogs] = useState<any[]>([]);
  const [rawLeads, setRawLeads] = useState<any[]>([]);
  const [leadsCount, setLeadsCount] = useState<string>("...");
  const [totalInventoryValue, setTotalInventoryValue] = useState<string>("0");
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number[]>(Array(12).fill(0));

  const [filteredTotalRevenue, setFilteredTotalRevenue] = useState<number>(0);
  const [growthRate, setGrowthRate] = useState<number>(0);
  const [prevRevenueShort, setPrevRevenueShort] = useState<string>("₫0");
  const [avgOrderValue, setAvgOrderValue] = useState<number>(0);
  const [filteredOrderCount, setFilteredOrderCount] = useState<number>(0);
  const [conversionRate, setConversionRate] = useState<number>(0);
  const [filteredLeadsCount, setFilteredLeadsCount] = useState<number>(0);
  const [revenueTrendData, setRevenueTrendData] = useState<Array<{ label: string; value: number }>>([]);
  const [productSegments, setProductSegments] = useState<Array<{ label: string; value: number; color: string }>>([]);

  type DateFilterType = "day" | "week" | "year" | "custom";
  const [dateFilter, setDateFilter] = useState<DateFilterType>("day");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const isPendingApprovalDisabled = userProfile?.role === "user" || userProfile?.role === "manager";

  const handleApprovePendingCard = async (id: string) => {
    try {
      await marketingService.updateCardStatus(id, "approved");
    } catch (error) {
      console.error("Lỗi duyệt bài marketing:", error);
    }
  };

  useEffect(() => {
    const loadEmployeeData = async () => {
      if (!userProfile) {
        setEmployeeCount("0");
        setEmployeeLabel("Nhân sự");
        setNewHiresCount(0);
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

        // Calculate new hires in current month
        const isCreatedInCurrentMonth = (createdAt: any): boolean => {
          if (!createdAt) return false;
          try {
            let date: Date;
            if (createdAt && typeof createdAt.toDate === "function") {
              date = createdAt.toDate();
            } else if (createdAt instanceof Date) {
              date = createdAt;
            } else {
              date = new Date(createdAt);
            }
            if (isNaN(date.getTime())) return false;
            const now = new Date();
            return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
          } catch (e) {
            return false;
          }
        };

        const newHires = targetUsers.filter(u => isCreatedInCurrentMonth(u.createdAt)).length;
        setNewHiresCount(newHires);
      } catch (error) {
        console.error("Lỗi lấy nhân sự Dashboard:", error);
        setEmployeeCount("0");
        setEmployeeLabel("Nhân sự");
        setNewHiresCount(0);
      }
    };

    loadEmployeeData();
  }, [userProfile?.uid, userProfile?.role, userProfile?.companyCode]);

  // Subscribe to inventory products to compute total products
  useEffect(() => {
    let unsubProducts: any = null;
    try {
      unsubProducts = inventoryProductService.subscribe((products) => {
        setRawProducts(products);
        // total number of product SKUs
        setTotalProducts(String(products.length));
        const lowItems = products.filter((p: any) => typeof p.stock === "number" && typeof p.minStockAlert === "number" ? p.stock <= p.minStockAlert : false);
        const overstock = products.filter((p: any) => typeof p.stock === "number" && typeof p.minStockAlert === "number" ? p.stock >= p.minStockAlert * 3 : false);
        setLowStockCount(String(lowItems.length));
        setLowStockItems(lowItems);
        setOverstockItems(overstock);

        // Calculate total inventory value when sold out
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
  }, []);

  // Subscribe to stock logs to compute pending outbound shipments
  useEffect(() => {
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
  }, []);

  // Subscribe to marketing contents to compute pending approvals and approval rate
  useEffect(() => {
    let unsubMarketing: (() => void) | null = null;
    if (!userProfile) {
      setRawMarketingCards([]);
      return;
    }

    try {
      unsubMarketing = marketingService.subscribeToContents(
        (cards) => {
          setRawMarketingCards(cards);
        },
        (error) => {
          console.error("Lỗi lấy dữ liệu marketing Dashboard:", error);
          setRawMarketingCards([]);
        },
        userProfile.uid,
        userProfile.role
      );
    } catch (err) {
      console.error("Lỗi đăng ký marketing Dashboard:", err);
      setRawMarketingCards([]);
    }

    return () => {
      if (unsubMarketing) unsubMarketing();
    };
  }, [userProfile?.uid, userProfile?.role]);

  // Subscribe to CRM leads to compute reached users
  useEffect(() => {
    let unsubLeads: any = null;
    try {
      unsubLeads = crmService.subscribeLeads((leads) => {
        setRawLeads(leads);
      });
    } catch (err) {
      console.error("Lỗi lấy danh sách lead Dashboard:", err);
      setRawLeads([]);
    }

    return () => {
      if (unsubLeads && typeof unsubLeads === "function") unsubLeads();
    };
  }, []);

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
      } else if (dateFilter === "week") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return date >= sevenDaysAgo;
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

    // 1. Filter marketing cards
    const filteredMarketing = rawMarketingCards.filter((card) => isDateInFilter(card.generatedAt));
    const pendingCards = filteredMarketing
      .filter((card) => card.status === "pending")
      .sort((a, b) => {
        const dateA = parseSafeDate(a.generatedAt)?.getTime() || 0;
        const dateB = parseSafeDate(b.generatedAt)?.getTime() || 0;
        return dateB - dateA;
      });

    const total = filteredMarketing.length;
    const approved = filteredMarketing.filter((card) =>
      card.status === "approved" ||
      card.status === "scheduled" ||
      card.status === "published" ||
      card.status === "failed"
    ).length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    setMarketingPendingCount(String(pendingCards.length));
    setMarketingApprovalRate(`${approvalRate}`);
    setMarketingPendingItems(pendingCards);
    setMarketingCards(filteredMarketing);

    // 2. Filter stock logs
    const filteredLogs = rawStockLogs.filter((log) => isDateInFilter(log.createdAt));
    const pendingShipmentsCount = filteredLogs.filter(
      (l) => l.type === "xuất" && (l.status === "Đang chờ" || l.status === "Đang xử lý")
    ).length;
    setPendingShipments(String(pendingShipmentsCount));

    // 3. Filter CRM leads
    const filteredLeads = rawLeads.filter((lead) => {
      if (!lead.createdAt) return false;
      return isDateInFilter(lead.createdAt);
    });
    setLeadsCount(String(filteredLeads.length));

  }, [rawMarketingCards, rawStockLogs, rawLeads, dateFilter, customStartDate, customEndDate]);

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
    } else if (dateFilter === "week") {
      start = new Date();
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
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

    const filteredLeads = rawLeads.filter((lead) => {
      if (!lead.createdAt) return false;
      const d = parseSafeDate(lead.createdAt);
      return d && d >= start && d <= end;
    });
    setFilteredLeadsCount(filteredLeads.length);

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

    const conv = filteredLeads.length > 0 ? (currentPeriodOrders / filteredLeads.length) * 100 : 0;
    setConversionRate(conv);

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
    } else if (dateFilter === "week") {
      const datesList: Date[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);
        datesList.push(d);
      }
      const values = Array(7).fill(0);
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

  }, [rawStockLogs, rawProducts, rawLeads, dateFilter, customStartDate, customEndDate]);

  const handleCreateReorder = (productName?: string) => {
    const name = productName || lowStockItems[0]?.name || "sản phẩm";
    toast.success(`AI đã tạo đề xuất đơn nhập kho cho ${name}. Vui lòng kiểm tra lại trong KHO & SẢN PHẨM.`);
  };

  const handleCreatePromotion = (productName?: string) => {
    const name = productName || overstockItems[0]?.name || "sản phẩm";
    toast.success(`Đề xuất chiến dịch ưu đãi đã được tạo cho ${name}. Hãy xem chi tiết trong MARKETING.`);
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
              {activeView === "ai" ? "Hiệu suất AI" : activeView === "revenue" ? "Phân tích doanh thu" : "Tổng quan Doanh nghiệp"}
            </h1>
            <p className="mt-2 text-sm text-gray-600">Hôm nay, {todayLabel}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-slate-100 pb-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-xl bg-slate-100/80 p-1 w-fit">
            {tabs.filter((tab) => tab.id !== "ai").map((tab) => {
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
                { id: "week", label: "Tuần" },
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
          marketingPendingCount={marketingPendingCount}
          marketingApprovalRate={marketingApprovalRate}
          marketingPendingItems={marketingPendingItems}
          overstockItems={overstockItems}
          onApprovePendingCard={handleApprovePendingCard}
          onCreateReorder={handleCreateReorder}
          onCreatePromotion={handleCreatePromotion}
          onRecommendAgent={handleRecommendAgent}
          isApprovalDisabled={isPendingApprovalDisabled}
          pendingReviewPage={pendingReviewPage}
          onPageChange={setPendingReviewPage}
          lowStockCount={lowStockCount}
          lowStockItems={lowStockItems}
          marketingCards={marketingCards}
          leadsCount={leadsCount}
          totalInventoryValue={totalInventoryValue}
          trendData={revenueTrendData}
          newHiresCount={newHiresCount}
        />
      )}
      {activeView === "revenue" && (
        <RevenuePanel
          marketingCards={marketingCards}
          totalRevenue={filteredTotalRevenue}
          growthRate={growthRate}
          prevRevenueShort={prevRevenueShort}
          avgOrderValue={avgOrderValue}
          orderCount={filteredOrderCount}
          trendData={revenueTrendData}
          productSegments={productSegments}
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
  marketingPendingCount,
  marketingApprovalRate,
  marketingPendingItems,
  overstockItems,
  onApprovePendingCard,
  onCreateReorder,
  onCreatePromotion,
  onRecommendAgent,
  isApprovalDisabled,
  pendingReviewPage,
  onPageChange,
  lowStockCount,
  lowStockItems,
  marketingCards,
  leadsCount,
  totalInventoryValue,
  trendData,
  newHiresCount,
}: {
  employeeCount: string;
  employeeLabel: string;
  totalProducts: string;
  pendingShipments: string;
  marketingPendingCount: string;
  marketingApprovalRate: string;
  marketingPendingItems: ContentApprovalCard[];
  overstockItems: any[];
  onApprovePendingCard: (id: string) => Promise<void>;
  onCreateReorder: (productName?: string) => void;
  onCreatePromotion: (productName?: string) => void;
  onRecommendAgent: () => void;
  isApprovalDisabled: boolean;
  pendingReviewPage: number;
  onPageChange: (page: number) => void;
  lowStockCount: string;
  lowStockItems: any[];
  marketingCards: ContentApprovalCard[];
  leadsCount: string;
  totalInventoryValue: string;
  trendData: Array<{ label: string; value: number }>;
  newHiresCount: number;
}) {
  const [showLowStockModal, setShowLowStockModal] = useState<boolean>(false);
  const [showPendingReviewModal, setShowPendingReviewModal] = useState<boolean>(false);

  const goToTab = (tab: string) => {
    const pathMap: Record<string, string> = {
      "TỔNG QUAN": "/tong-quan",
      "NHÂN SỰ": "/nhan-su",
      "KHO & SẢN PHẨM": "/kho-san-pham",
      "MARKETING": "/marketing",
      "SALES CRM": "/sales-crm",
      "HIỆU SUẤT AI": "/hieu-suat-ai",
      "QUẢN TRỊ USER": "/quan-tri-user",
      "CÀI ĐẶT": "/cai-dat",
      "VÍ & NẠP TIỀN": "/vi-nap-tien",
    };
    const path = pathMap[tab];
    if (path) {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const previewPendingItems = marketingPendingItems.slice(0, 3);
  const itemsPerPage = 5;
  const totalPendingPages = Math.max(1, Math.ceil(marketingPendingItems.length / itemsPerPage));

  const openPendingModal = () => {
    onPageChange(1);
    setShowPendingReviewModal(true);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard
            icon={Users}
            tone="amber"
            title="Nhân sự"
            value={employeeCount}
            label={employeeLabel}
            footer="Nhân sự mới"
            footerValue={`+${newHiresCount}`}
            progress={Math.min(100, (parseInt(employeeCount) || 0) > 0 ? Math.round((newHiresCount / (parseInt(employeeCount) || 1)) * 100) : 0)}
            onClick={() => goToTab("NHÂN SỰ")}
          />
          <ModuleCard icon={PackageCheck} tone="blue" title="Kho & Sản phẩm" value={totalProducts} label="Tổng sản phẩm" footer="Đơn chờ xuất" footerValue={`${pendingShipments} Đơn`} progress={78} alert lowCount={lowStockCount} onClick={() => goToTab("KHO & SẢN PHẨM")} />
          <ModuleCard icon={Megaphone} tone="slate" title="Marketing" value={marketingPendingCount} label="Bài chờ duyệt" footer="Tỉ lệ duyệt" footerValue={`${marketingApprovalRate}%`} progress={Number(marketingApprovalRate) || 0} onClick={() => goToTab("MARKETING")} />
          <SalesCard value={totalInventoryValue} leadsCount={leadsCount} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">Doanh thu</h3>
              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-600">Đơn vị: VNĐ</span>
            </div>
            <BarChart data={trendData} />
          </div>
          <DonutCard cards={marketingCards} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Nội dung chờ duyệt</h3>
                </div>
                <button onClick={openPendingModal} className="text-xs font-semibold text-blue-655 hover:text-blue-700 transition-colors">Xem tất cả</button>
              </div>

              {previewPendingItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-gray-500">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  Hiện không có nội dung chờ duyệt.
                </div>
              ) : (
                <div className="space-y-3">
                  {previewPendingItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-150 p-4 bg-slate-50/30 hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-850">{item.title}</p>
                          <p className="text-[11px] text-gray-500">{item.channel} · {item.contentType}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100">Chờ duyệt</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-650 line-clamp-2 leading-relaxed">{item.bodyText}</p>
                      <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-dashed border-slate-100">
                        <p className="text-[10px] text-gray-450">{formatCardDate(item.generatedAt)}</p>
                        <button
                          onClick={() => onApprovePendingCard(item.id)}
                          disabled={isApprovalDisabled}
                          className={`rounded-full px-3 py-1 text-xs font-bold text-white transition ${isApprovalDisabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                          Duyệt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {marketingPendingItems.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Tổng bài chờ duyệt:</span>
                <span className="font-mono text-base font-extrabold text-amber-600">{marketingPendingCount} bài</span>
              </div>
            )}

            {showPendingReviewModal && (
              <PendingReviewModal
                items={marketingPendingItems}
                currentPage={pendingReviewPage}
                pageSize={itemsPerPage}
                totalPages={totalPendingPages}
                onClose={() => setShowPendingReviewModal(false)}
                onPageChange={onPageChange}
                onApprove={onApprovePendingCard}
                isApprovalDisabled={isApprovalDisabled}
              />
            )}
          </div>
        </div>
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
              icon: Megaphone,
              title: marketingPendingItems.length > 0 ? `${marketingPendingItems.length} bài marketing chờ duyệt` : "Marketing đang ổn định",
              body: marketingPendingItems.length > 0
                ? `AI đề xuất xử lý ${marketingPendingItems.length} bài viết chờ duyệt để không trì hoãn chiến dịch.`
                : "Không có nội dung AI marketing đang chờ duyệt ở thời điểm này.",
              action: marketingPendingItems.length > 0 ? "Mở danh sách duyệt" : "Kiểm tra Marketing",
              color: "blue",
              onAction: () => openPendingModal(),
            },
            {
              icon: Bot,
              title: "Tự động hóa CSKH bằng AI",
              body: "AI phát hiện có cơ hội thiết lập thêm Agent trả lời tự động để chăm sóc khách hàng 24/7 và cải thiện chuyển đổi.",
              action: "Trải nghiệm AI Agent",
              color: "indigo",
              onAction: () => {
                onRecommendAgent();
                goToTab("SALES CRM");
              },
            },
          ].map((item) => (
            <AiInsightCard key={item.title} {...item} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function PendingReviewModal({
  items,
  currentPage,
  pageSize,
  totalPages,
  onClose,
  onPageChange,
  onApprove,
  isApprovalDisabled,
}: {
  items: ContentApprovalCard[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onClose: () => void;
  onPageChange: (page: number) => void;
  onApprove: (id: string) => Promise<void>;
  isApprovalDisabled: boolean;
}) {
  const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Danh sách bài chờ duyệt</h3>
            <p className="text-sm text-gray-500">Hiển thị {items.length} bài chờ duyệt. Duyệt trực tiếp trong modal.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {pageItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">Không có bài chờ duyệt.</div>
          ) : (
            <div className="space-y-4">
              {pageItems.map((item) => (
                <div key={item.id} className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="mt-1 text-xs text-gray-500">{item.channel} · {item.contentType}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">Chờ duyệt</span>
                  </div>
                  <p className="mt-3 text-sm text-gray-600 line-clamp-4">{item.bodyText}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">{formatCardDate(item.generatedAt)}</p>
                    <button
                      disabled={isApprovalDisabled}
                      onClick={() => onApprove(item.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold text-white transition ${isApprovalDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      Duyệt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <span className="text-sm text-gray-500">Trang {currentPage} / {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Trước
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenuePanel({
  marketingCards,
  totalRevenue,
  growthRate,
  prevRevenueShort,
  avgOrderValue,
  orderCount,
  trendData,
  productSegments,
}: {
  marketingCards: ContentApprovalCard[];
  totalRevenue: number;
  growthRate: number;
  prevRevenueShort: string;
  avgOrderValue: number;
  orderCount: number;
  trendData: Array<{ label: string; value: number }>;
  productSegments: Array<{ label: string; value: number; color: string }>;
}) {
  const formatCurrency = (val: number) => {
    return formatDashboardCurrency(val, 2, false);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <MetricCard icon={DollarSign} label="Tổng doanh thu" value={formatCurrency(totalRevenue)} delta={`${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`} negative={growthRate < 0} />
        <MetricCard icon={Rocket} label="Tốc độ tăng trưởng" value={`${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`} delta={prevRevenueShort} tone="amber" negative={growthRate < 0} />
        <MetricCard icon={PackageCheck} label="Giá trị đơn hàng trung bình" value={formatCurrency(avgOrderValue)} delta={`${orderCount} đơn`} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-800">Xu hướng doanh thu</h3>
            </div>
            <MoreVertical className="h-5 w-5 text-gray-500" />
          </div>
          <BarChart data={trendData} />
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
          <div className="mb-8 flex items-start justify-between">
            <h3 className="text-2xl font-bold text-gray-800">Cơ cấu nguồn</h3>
            <MoreVertical className="h-5 w-5 text-gray-500" />
          </div>
          <DonutCard compact segments={productSegments} />
        </div>
      </div>
    </div>
  );
}

function AiPanel() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Bot} label="Tac vu xu ly" value="12,450" delta="+15%" />
        <MetricCard icon={Clock} label="Thoi gian tiet kiem" value="840h" delta="+8%" tone="amber" />
        <MetricCard icon={BrainCircuit} label="Do chinh xac" value="98.2%" delta="Trung binh" />
        <MetricCard icon={ThumbsUp} label="Hai long KH" value="4.9/5" delta="+0.2" tone="indigo" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
          <h3 className="mb-6 text-2xl font-bold text-gray-800">Trang thai Agent AI</h3>
          <div className="space-y-4 border-t border-gray-100 pt-6">
            <AgentStatus icon={Bot} name="Sales Bot" status="Active" score="95" />
            <AgentStatus icon={Megaphone} name="Marketing Writer" status="Learning" score="88" tone="amber" />
            <AgentStatus icon={PackageCheck} name="Inventory Predictor" status="Idle" score="--" tone="indigo" />
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
          <div className="mb-6 flex items-start justify-between gap-4">
            <h3 className="max-w-sm text-2xl font-bold text-gray-800">Khoi luong cong viec: AI vs Human</h3>
            <div className="flex gap-5 text-xs text-gray-600">
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-blue-500" />AI Output</span>
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-blue-100 ring-1 ring-blue-200" />Human Output</span>
            </div>
          </div>
          <WorkloadChart />
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
        <h3 className="mb-6 flex items-center gap-3 text-2xl font-bold text-gray-800">
          <Lightbulb className="h-6 w-6 text-blue-500" />
          Goi y toi uu tu AI
        </h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Recommendation title="Tac nghen Sales CRM" body="Sales Bot dang gap kho khan khi phan loai lead tu chien dich Mua He. Can cap nhat bo du lieu huan luyen." action="Cap nhat du lieu" danger />
          <Recommendation title="Co hoi tu dong hoa" body="Phat hien 120 email phan hoi khach hang co mau tuong tu. Co the thiet lap Auto-Reply Agent moi." action="Tao Agent Moi" />
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ icon: Icon, tone, title, value, label, footer, footerValue, progress, alert, lowCount, onClick }: any) {
  const color = toneClass[(tone as Tone) || "blue"];
  const showCount = alert && lowCount && lowCount !== "0" && lowCount !== "...";
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${onClick ? "cursor-pointer active:scale-[0.99]" : ""}`}
    >
      <div className="mb-6 flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color.soft} ${color.text}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={alert && showCount ? "rounded-full bg-rose-600 px-3 py-0.5 text-xs font-bold text-white shadow-xs animate-pulse" : "text-xs font-bold uppercase tracking-wider text-gray-400"}>
          {title}{showCount ? ` (${lowCount})` : ""}
        </span>
      </div>
      <div className="mb-4 flex items-end justify-between gap-3 min-w-0">
        <span className="text-sm font-medium text-gray-500 shrink-0">{label}</span>
        <span className="font-sans text-xl font-extrabold text-gray-800 truncate" title={value}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${color.fill} transition-all duration-500`} style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 flex justify-between text-xs font-medium min-w-0">
        <span className="text-gray-400 truncate pr-2">{footer}</span>
        <span className={`font-bold shrink-0 ${color.strong}`}>{footerValue}</span>
      </div>
    </div>
  );
}

function SalesCard({ value, leadsCount }: { value: string; leadsCount: string }) {
  const goToTab = (tab: string) => {
    const pathMap: Record<string, string> = {
      "SALES CRM": "/sales-crm",
      "KHO & SẢN PHẨM": "/kho-san-pham"
    };
    const path = pathMap[tab];
    if (path) {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };
  return (
    <ModuleCard
      icon={DollarSign}
      tone="emerald"
      title="Doanh thu"
      value={value}
      label="Tổng tiền  "
      footer="Khách hàng tiềm năng mới"
      footerValue={`${leadsCount} `}
      progress={100}
      onClick={() => goToTab("KHO & SẢN PHẨM")}
    />
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

function LineChartCard({ monthlyRevenue }: { monthlyRevenue: number[] }) {
  const maxVal = Math.max(...monthlyRevenue);
  const points = monthlyRevenue.map((val, i) => {
    const x = 32 + i * 33;
    const y = maxVal === 0 ? 240 : 240 - (val / maxVal) * 210;

    let formatted = "0";
    if (val > 0) {
      formatted = formatDashboardCurrency(val, 1, false);
    }
    return { x, y, val: formatted };
  });

  const buildPaths = () => {
    let curve = "";
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const dx = p1.x - p0.x;
      const cp1x = p0.x + dx / 3;
      const cp1y = p0.y;
      const cp2x = p0.x + (2 * dx) / 3;
      const cp2y = p1.y;
      curve += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x} ${p1.y}`;
    }
    const stroke = `M ${points[0].x} ${points[0].y}${curve}`;
    const fill = `M ${points[0].x} 240 L ${points[0].x} ${points[0].y}${curve} L ${points[points.length - 1].x} 240 Z`;
    return { stroke, fill };
  };

  const { stroke, fill } = buildPaths();

  let unitLabel = "Đơn vị: VNĐ";
  if (maxVal >= 1e9) {
    unitLabel = "Đơn vị: Tỷ VNĐ";
  } else if (maxVal >= 1e6) {
    unitLabel = "Đơn vị: Triệu VNĐ";
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">Doanh thu</h3>
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-600">{unitLabel}</span>
      </div>
      <svg viewBox="0 0 440 260" className="h-72 w-full">
        <defs>
          <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.00" />
          </linearGradient>
          <linearGradient id="strokeGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
        </defs>
        {[40, 80, 120, 160, 200, 240].map((y) => (
          <line key={y} x1="36" x2="420" y1={y} y2={y} stroke="#f1f5f9" strokeDasharray="4 4" />
        ))}
        {/* Fill under line */}
        <path d={fill} fill="url(#lineFill)" />
        {/* Stroke line */}
        <path d={stroke} fill="none" stroke="url(#strokeGrad)" strokeWidth="4" strokeLinecap="round" />
        {/* Glow dots on peak points */}
        {points.map((p, i) => (
          <g key={i} className="group cursor-pointer">
            <title>{`Tháng ${i + 1}: ${p.val}`}</title>
            <circle cx={p.x} cy={p.y} r="8" className="fill-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <circle cx={p.x} cy={p.y} r="4.5" className="fill-white stroke-cyan-500 stroke-2" />
          </g>
        ))}
        {["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"].map((m, i) => (
          <text key={m} x={points[i].x} y="255" textAnchor="middle" fontSize="10" fontWeight="600" fill="#94a3b8">{m}</text>
        ))}
      </svg>
    </div>
  );
}

function DonutCard({
  compact = false,
  cards = [],
  segments: propSegments,
  title = "Hiệu suất kênh Marketing",
}: {
  compact?: boolean;
  cards?: ContentApprovalCard[];
  segments?: Array<{ label: string; value: number; color: string }>;
  title?: string;
}) {
  const radius = 66;
  const circumference = 2 * Math.PI * radius;

  let segments = propSegments;
  if (!segments) {
    // Chỉ tính toán phân bổ phần trăm cho những bài viết ĐÃ ĐƯỢC DUYỆT (hoặc đã lên lịch/đăng)
    const approvedCards = cards.filter(c =>
      c.status === "approved" ||
      c.status === "scheduled" ||
      c.status === "published" ||
      c.status === "failed"
    );
    const total = approvedCards.length;
    let facebookPct = 50;
    let zaloPct = 30;
    let tiktokPct = 20;

    if (total > 0) {
      const facebookCount = approvedCards.filter(c => c.channel === "Facebook").length;
      const zaloCount = approvedCards.filter(c => c.channel === "Zalo").length;
      const tiktokCount = approvedCards.filter(c => c.channel === "TikTok").length;

      const validTotal = facebookCount + zaloCount + tiktokCount;
      if (validTotal > 0) {
        facebookPct = Math.round((facebookCount / validTotal) * 100);
        zaloPct = Math.round((zaloCount / validTotal) * 100);
        tiktokPct = Math.max(0, 100 - facebookPct - zaloPct);
      }
    }

    segments = [
      { label: "Facebook", value: facebookPct, color: "#06b6c7" },
      { label: "Zalo", value: zaloPct, color: "#60a5fa" },
      { label: "TikTok", value: tiktokPct, color: "#e99a2c" },
    ];
  }
  let offset = 0;

  return (
    <div className={compact ? "" : "rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300"}>
      {!compact && <h3 className="mb-8 text-sm font-bold uppercase tracking-wider text-gray-800">Hiệu suất kênh Marketing</h3>}
      <div className="grid items-center gap-7 md:grid-cols-[minmax(160px,224px)_minmax(0,1fr)]">
        <div className="relative mx-auto h-48 w-48 shrink-0 sm:h-56 sm:w-56">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 180 180" aria-label="Marketing channel performance">
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#f8fafc" strokeWidth="28" />
            {segments.map((segment) => {
              const dash = (segment.value / 100) * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="28"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return circle;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Tổng số</span>
            <strong className="font-sans text-2xl font-extrabold text-gray-800">100%</strong>
          </div>
        </div>
        <div className="min-w-0 space-y-4 text-sm">
          {segments.map((segment) => (
            <Legend key={segment.label} color={segment.color} label={segment.label} value={`${segment.value}%`} />
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
          <p className="mt-2 text-xs leading-relaxed text-gray-650">{body}</p>
        </div>
      </div>
      {action && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onAction}
            className="inline-flex rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-2xs hover:shadow-xs"
          >
            {action}
          </button>
        </div>
      )}
    </div>
  );
}

function AgentStatus({ icon: Icon, name, status, score, tone = "blue" }: any) {
  const color = toneClass[(tone as Tone) || "blue"];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 p-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${color.soft} ${color.text}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-gray-800">{name}</p>
        <p className="text-sm text-gray-600"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${color.fill}`} />{status}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-2xl font-bold text-gray-800">{score}</p>
        <p className="text-xs text-gray-500">Diem hieu suat</p>
      </div>
    </div>
  );
}

function Recommendation({ title, body, action, danger = false }: any) {
  return (
    <div className="flex min-h-40 items-start gap-5 rounded-2xl border border-gray-200 bg-gray-50/40 p-6">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${danger ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
        {danger ? <AlertTriangle className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
      </div>
      <div className="flex flex-1 flex-col gap-5">
        <div>
          <h4 className="font-bold text-gray-800">{title}</h4>
          <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
        </div>
        <button className={`self-end rounded-full px-6 py-2 text-sm font-semibold ${danger ? "bg-blue-500 text-white" : "border border-gray-300 text-gray-700"}`}>{action}</button>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: any) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <span className="flex min-w-0 items-center gap-3 text-gray-800">
        <i className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
      </span>
      <strong className="font-mono text-gray-800">{value}</strong>
    </div>
  );
}
