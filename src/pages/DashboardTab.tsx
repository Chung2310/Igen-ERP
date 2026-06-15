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
import { toast } from "../pages/Toast";
import { UserProfile, ContentApprovalCard } from "../types";
import LowStockModal from "../components/inventory/LowStockModal";

type DashboardView = "overview" | "revenue" | "ai";
type Tone = "blue" | "amber" | "slate" | "indigo";

const tabs: Array<{ id: DashboardView; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "revenue", label: "Phân tích doanh thu" },
  { id: "ai", label: "Hiệu suất AI" },
];

const toneClass: Record<Tone, { soft: string; text: string; fill: string; strong: string }> = {
  blue: { soft: "bg-blue-50", text: "text-blue-600", fill: "bg-blue-500", strong: "text-blue-700" },
  amber: { soft: "bg-amber-50", text: "text-amber-600", fill: "bg-amber-500", strong: "text-amber-700" },
  slate: { soft: "bg-slate-100", text: "text-slate-600", fill: "bg-slate-600", strong: "text-slate-700" },
  indigo: { soft: "bg-indigo-50", text: "text-indigo-600", fill: "bg-indigo-500", strong: "text-indigo-700" },
};

const getDescendantEmployeeCount = (rootId: string, users: UserProfile[]) => {
  const childrenByParent = new Map<string, string[]>();
  users.forEach((user) => {
    if (user.parentId) {
      const existing = childrenByParent.get(user.parentId) || [];
      existing.push(user.uid);
      childrenByParent.set(user.parentId, existing);
    }
  });

  let count = 0;
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenByParent.get(current) || [];
    count += children.length;
    stack.push(...children);
  }

  return count;
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

export default function DashboardTab() {
  const { userProfile } = useAuth();
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [employeeCount, setEmployeeCount] = useState<string>("...");
  const [employeeLabel, setEmployeeLabel] = useState<string>("Tổng nhân sự");
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
        if (userProfile.role === "superadmin") {
          count = users.filter((user) => user.role !== "superadmin").length;
          label = "Tổng nhân sự";
        } else if (userProfile.role === "admin" || userProfile.role === "manager") {
          count = getDescendantEmployeeCount(userProfile.uid, users);
          label = "Tổng nhân sự";
        } else {
          count = users.length;
          label = "Nhân sự";
        }

        setEmployeeCount(String(count));
        setEmployeeLabel(label);
      } catch (error) {
        console.error("Lỗi lấy nhân sự Dashboard:", error);
        setEmployeeCount("0");
        setEmployeeLabel("Nhân sự");
      }
    };

    loadEmployeeData();
  }, [userProfile?.uid, userProfile?.role, userProfile?.companyCode]);

  // Subscribe to inventory products to compute total products
  useEffect(() => {
    let unsubProducts: any = null;
    try {
      unsubProducts = inventoryProductService.subscribe((products) => {
        // total number of product SKUs
        setTotalProducts(String(products.length));
        const lowItems = products.filter((p: any) => typeof p.stock === "number" && typeof p.minStockAlert === "number" ? p.stock <= p.minStockAlert : false);
        const overstock = products.filter((p: any) => typeof p.stock === "number" && typeof p.minStockAlert === "number" ? p.stock >= p.minStockAlert * 3 : false);
        setLowStockCount(String(lowItems.length));
        setLowStockItems(lowItems);
        setOverstockItems(overstock);
      });
    } catch (err) {
      console.error("Lỗi lấy tổng sản phẩm:", err);
      setTotalProducts("0");
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
        const pending = logs.filter((l) => l.type === "xuất" && (l.status === "Đang chờ" || l.status === "Đang xử lý")).length;
        setPendingShipments(String(pending));
      });
    } catch (err) {
      console.error("Lỗi lấy đơn chờ xuất:", err);
      setPendingShipments("0");
    }

    return () => {
      if (unsubLogs && typeof unsubLogs === "function") unsubLogs();
    };
  }, []);

  // Subscribe to marketing contents to compute pending approvals and approval rate
  useEffect(() => {
    let unsubMarketing: (() => void) | null = null;
    if (!userProfile) {
      setMarketingPendingCount("0");
      setMarketingApprovalRate("0");
      return;
    }

    try {
      unsubMarketing = marketingService.subscribeToContents(
        (cards) => {
          const pendingCards = cards
            .filter((card) => card.status === "pending")
            .sort((a, b) => {
              const dateA = new Date(a.generatedAt).getTime();
              const dateB = new Date(b.generatedAt).getTime();
              if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
              return b.generatedAt.localeCompare(a.generatedAt);
            });
          const total = cards.length;
          const approved = cards.filter((card) => 
            card.status === "approved" || 
            card.status === "scheduled" || 
            card.status === "published" || 
            card.status === "failed"
          ).length;
          const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

          setMarketingPendingCount(String(pendingCards.length));
          setMarketingApprovalRate(`${approvalRate}`);
          setMarketingPendingItems(pendingCards);
          setMarketingCards(cards);
        },
        (error) => {
          console.error("Lỗi lấy dữ liệu marketing Dashboard:", error);
          setMarketingPendingCount("0");
          setMarketingApprovalRate("0");
        },
        userProfile.uid,
        userProfile.role
      );
    } catch (err) {
      console.error("Lỗi đăng ký marketing Dashboard:", err);
      setMarketingPendingCount("0");
      setMarketingApprovalRate("0");
    }

    return () => {
      if (unsubMarketing) unsubMarketing();
    };
  }, [userProfile?.uid, userProfile?.role]);

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
          <div className="flex w-fit items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span>Hệ thống hoạt động bình thường</span>
          </div>
        </div>

        <div className="flex gap-6 border-b border-gray-200">
          {tabs.filter((tab) => tab.id !== "ai").map((tab) => {
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`border-b-2 px-0 pb-2 text-sm font-semibold transition-colors ${isActive ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
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
        />
      )}
      {activeView === "revenue" && <RevenuePanel marketingCards={marketingCards} />}
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
          <ModuleCard icon={Users} tone="amber" title="Nhân sự" value={employeeCount} label={employeeLabel} footer="Độ hài lòng" footerValue="92%" progress={92} onClick={() => goToTab("NHÂN SỰ")} />
          <ModuleCard icon={PackageCheck} tone="blue" title="Kho & Sản phẩm" value={totalProducts} label="Tổng sản phẩm" footer="Đơn chờ xuất" footerValue={`${pendingShipments} Đơn`} progress={78} alert lowCount={lowStockCount} onClick={() => goToTab("KHO & SẢN PHẨM")} />
          <ModuleCard icon={Megaphone} tone="slate" title="Marketing" value={marketingPendingCount} label="Bài chờ duyệt" footer="Tỉ lệ duyệt" footerValue={`${marketingApprovalRate}%`} progress={Number(marketingApprovalRate) || 0} onClick={() => goToTab("MARKETING")} />
          <SalesCard />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LineChartCard />
          <DonutCard cards={marketingCards} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Canh báo tồn kho</h3>
              <button onClick={() => goToTab("KHO & SẢN PHẨM")} className="text-xs font-semibold text-blue-700">Xem tất cả</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-2xl">📦</div>
              <div className="flex-1">
                {lowStockItems.slice(0, 3).map((p: any) => (
                  <div key={p.id} className="mb-1">
                    <p className="text-sm font-bold text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-500">SKU: {p.sku} · Tồn: {p.stock}</p>
                  </div>
                ))}
              </div>
              {showLowStockModal && <LowStockModal products={lowStockItems} onClose={() => setShowLowStockModal(false)} />}
              <div className="font-mono text-2xl font-bold text-red-600">{lowStockCount}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Nội dung cho duyệt</h3>
              <button onClick={openPendingModal} className="text-xs font-semibold text-blue-700">Xem tất cả</button>
            </div>

            {previewPendingItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                Hiện không có nội dung chờ duyệt.
              </div>
            ) : (
              <div className="space-y-3">
                {previewPendingItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.channel} · {item.contentType}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">Chờ duyệt</span>
                    </div>
                    <p className="mt-3 text-sm text-gray-600 line-clamp-3">{item.bodyText}</p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-[11px] text-gray-400">{formatCardDate(item.generatedAt)}</p>
                      <button
                        onClick={() => onApprovePendingCard(item.id)}
                        disabled={isApprovalDisabled}
                        className={`rounded-full px-3 py-1 text-xs font-semibold text-white transition ${isApprovalDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        Duyệt
                      </button>
                    </div>
                  </div>
                ))}
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

      <aside className="rounded-3xl border border-blue-100 bg-blue-50/70 p-6 shadow-xs">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-700 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">AI Đề Xuất</h3>
            <p className="text-sm text-gray-500">Nơi AI chủ động cảnh báo rủi ro, gợi ý hành động và đồng bộ cung-cầu ngay tại Dashboard.</p>
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
              icon: Rocket,
              title: overstockItems.length > 0 ? `${overstockItems[0].name} tồn nhiều, cần kích cầu` : "Cung-cầu đang cân bằng",
              body: overstockItems.length > 0
                ? `AI phát hiện ${overstockItems[0].name} đang tồn cao so với nhu cầu, gợi ý chạy chương trình ưu đãi ngay.`
                : "AI chưa tìm thấy cơ hội khuyến mãi đồng bộ cung-cầu mới.",
              action: overstockItems.length > 0 ? "Tạo chiến dịch ưu đãi" : "Khám phá cơ hội",
              color: "amber",
              onAction: () => (overstockItems.length > 0 ? onCreatePromotion(overstockItems[0]?.name) : onRecommendAgent()),
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

function RevenuePanel({ marketingCards }: { marketingCards: ContentApprovalCard[] }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={DollarSign} label="Tong doanh thu" value="d2.4B" delta="+12.5%" />
        <MetricCard icon={Rocket} label="Toc do tang truong" value="18.4%" delta="+5.2%" tone="amber" />
        <MetricCard icon={PackageCheck} label="Gia tri DH trung binh" value="d450K" delta="-1.2%" negative />
        <MetricCard icon={Filter} label="Ti le chuyen doi" value="3.8%" delta="+2.1%" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-800">Xu huong doanh thu</h3>
              <p className="mt-2 text-sm text-gray-500">So sanh voi cung ky nam truoc</p>
            </div>
            <MoreVertical className="h-5 w-5 text-gray-500" />
          </div>
          <BarChart />
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
          <div className="mb-8 flex items-start justify-between">
            <h3 className="text-2xl font-bold text-gray-800">Co cau nguon</h3>
            <MoreVertical className="h-5 w-5 text-gray-500" />
          </div>
          <DonutCard compact cards={marketingCards} />
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
      className={`rounded-3xl border border-gray-100 bg-white p-6 shadow-xs ${onClick ? "cursor-pointer transition-all hover:scale-[1.01] hover:shadow-xs active:scale-[0.99]" : ""}`}
    >
      <div className="mb-6 flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color.soft} ${color.text}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={alert ? "rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white" : "text-sm text-gray-500"}>
          {title}{showCount ? ` (${lowCount})` : ""}
        </span>
      </div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <span className="text-sm leading-6 text-gray-700">{label}</span>
        <span className="font-mono text-lg font-semibold text-gray-800">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-blue-100">
        <div className={`h-1.5 rounded-full ${color.fill}`} style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-gray-500">{footer}</span>
        <span className={`font-semibold ${color.strong}`}>{footerValue}</span>
      </div>
    </div>
  );
}

function SalesCard() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <DollarSign className="h-5 w-5" />
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">+14%</span>
      </div>
      <p className="font-mono text-xl font-bold text-gray-800">d12.4B</p>
      <div className="mt-6 flex justify-between border-t border-gray-100 pt-4 text-sm">
        <span className="text-gray-500">Leads moi</span>
        <span className="font-semibold text-blue-600">342</span>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, delta, tone = "blue", negative = false }: any) {
  const color = toneClass[(tone as Tone) || "blue"];
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-xs">
      <div className="mb-7 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${color.soft} ${color.text}`}>
          <Icon className="h-6 w-6" />
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${negative ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
          {delta}
        </span>
      </div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-3 font-mono text-4xl font-bold tracking-tight text-gray-800">{value}</p>
    </div>
  );
}

function LineChartCard() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs">
      <h3 className="mb-8 text-sm font-semibold uppercase tracking-widest text-gray-800">Doanh thu</h3>
      <svg viewBox="0 0 420 260" className="h-72 w-full">
        <defs>
          <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[40, 80, 120, 160, 200, 240].map((y) => <line key={y} x1="36" x2="400" y1={y} y2={y} stroke="#eaf0f8" />)}
        <path d="M48 220 L48 200 C82 150 88 150 118 180 C148 210 154 88 188 98 C230 102 220 38 260 56 C300 75 312 96 338 72 C374 40 376 12 394 10 L394 240 L48 240 Z" fill="url(#lineFill)" />
        <path d="M48 200 C82 150 88 150 118 180 C148 210 154 88 188 98 C230 102 220 38 260 56 C300 75 312 96 338 72 C374 40 376 12 394 10" fill="none" stroke="#06b6d4" strokeWidth="4" />
        {["T1", "T2", "T3", "T4", "T5", "T6", "T7"].map((m, i) => <text key={m} x={48 + i * 58} y="255" textAnchor="middle" fontSize="12" fill="#64748b">{m}</text>)}
      </svg>
    </div>
  );
}

function DonutCard({ compact = false, cards = [] }: { compact?: boolean; cards?: ContentApprovalCard[] }) {
  const radius = 66;
  const circumference = 2 * Math.PI * radius;

  // Chỉ tính toán phân bổ phần trăm cho những bài viết ĐÃ ĐƯỢC DUYỆT (hoặc đã lên lịch/đăng)
  const approvedCards = cards.filter(c => 
    c.status === "approved" || 
    c.status === "scheduled" || 
    c.status === "published" || 
    c.status === "failed"
  );
  const total = approvedCards.length;
  let facebookPct = 50;
  let tiktokPct = 25;
  let linkedinPct = 25;
  let instagramPct = 0;

  if (total > 0) {
    const facebookCount = approvedCards.filter(c => c.channel === "Facebook").length;
    const tiktokCount = approvedCards.filter(c => c.channel === "TikTok").length;
    const linkedinCount = approvedCards.filter(c => c.channel === "LinkedIn").length;
    const instagramCount = approvedCards.filter(c => c.channel === "Instagram").length;

    const validTotal = facebookCount + tiktokCount + linkedinCount + instagramCount;
    if (validTotal > 0) {
      facebookPct = Math.round((facebookCount / validTotal) * 100);
      tiktokPct = Math.round((tiktokCount / validTotal) * 100);
      linkedinPct = Math.round((linkedinCount / validTotal) * 100);
      instagramPct = Math.max(0, 100 - facebookPct - tiktokPct - linkedinPct);
    }
  }

  const segments = [
    { label: "Facebook", value: facebookPct, color: "#06b6c7", className: "bg-blue-500" },
    { label: "TikTok", value: tiktokPct, color: "#e99a2c", className: "bg-amber-400" },
    { label: "LinkedIn", value: linkedinPct, color: "#9a5a00", className: "bg-amber-700" },
    { label: "Instagram", value: instagramPct, color: "#dbeafe", className: "bg-blue-100" },
  ];
  let offset = 0;

  return (
    <div className={compact ? "" : "rounded-3xl border border-gray-100 bg-white p-6 shadow-xs"}>
      {!compact && <h3 className="mb-8 text-sm font-semibold uppercase tracking-widest text-gray-800">Hiệu suất kênh Marketing</h3>}
      <div className="grid items-center gap-7 md:grid-cols-[minmax(160px,224px)_minmax(0,1fr)]">
        <div className="relative mx-auto h-48 w-48 shrink-0 sm:h-56 sm:w-56">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 180 180" aria-label="Marketing channel performance">
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#eef4ff" strokeWidth="28" />
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
            <span className="text-sm text-gray-500">Tổng số</span>
            <strong className="font-mono text-3xl font-bold text-gray-800">100%</strong>
          </div>
        </div>
        <div className="min-w-0 space-y-4 text-sm">
          {segments.map((segment) => (
            <Legend key={segment.label} color={segment.className} label={segment.label} value={`${segment.value}%`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChart() {
  const bars = [34, 58, 42, 72, 63, 83];
  return (
    <div className="relative h-[420px]">
      <div className="absolute inset-x-0 bottom-12 top-0 flex flex-col justify-between text-xs text-gray-500">
        {["d3B", "d2B", "d1B", "d0"].map((y) => (
          <div key={y} className="flex items-center gap-3">
            <span className="w-8">{y}</span>
            <span className="h-px flex-1 border-t border-dashed border-blue-100" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-12 right-4 top-10 flex items-end justify-between gap-3">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-4">
            <div className={`w-full max-w-24 rounded-t-md ${i === 1 ? "bg-blue-500" : "bg-blue-100"}`} style={{ height: `${h}%` }} />
            <span className={`text-sm ${i === 1 ? "font-bold text-gray-800" : "text-gray-500"}`}>T{i + 1}</span>
          </div>
        ))}
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
  const border = color === "red" ? "border-l-red-600" : color === "amber" ? "border-l-amber-600" : "border-l-blue-500";
  const text = color === "red" ? "text-red-600" : color === "amber" ? "text-amber-700" : "text-blue-600";
  return (
    <div className={`rounded-2xl border border-gray-100 border-l-4 ${border} bg-white p-5`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 ${text}`} />
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800">{title}</h4>
          <p className="mt-2 text-sm leading-6 text-gray-700">{body}</p>
        </div>
      </div>
      {action ? (
        <button
          onClick={onAction}
          className="mt-5 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {action}
        </button>
      ) : null}
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
        <i className={`h-3.5 w-3.5 shrink-0 rounded-full ${color}`} />
        <span className="truncate">{label}</span>
      </span>
      <strong className="font-mono text-gray-800">{value}</strong>
    </div>
  );
}
