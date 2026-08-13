import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle, Cpu, Download, FolderTree, Pencil, Plus, Search, Tags, Trash2, Upload, ArrowDownRight, ArrowUpRight, Package, ArrowLeftRight, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { InventoryForecastSummary, InventorySubTabType, ProductCategory, ProductItem, StockLog } from "../types";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import { INVENTORY_SUB_TAB_ROUTES } from "../router/subTabRoutes";
import { toast } from "./Toast";
import { getApiErrorMessage } from "../utils/errorMessage";
import { CategoryModal } from "../components/inventory/CategoryModal";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { inventoryTabs } from "../components/inventory/data";
import { Pagination } from "../components/common/Pagination";
import { CategoryManagementSection } from "../components/inventory/CategoryManagementSection";
import { InventoryTabHeader } from "../components/inventory/InventoryTabHeader";
import { SummaryCard } from "../components/inventory/SummaryCard";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { inventoryCategoryService } from "../services/inventoryCategoryService";
import { inventoryProductService } from "../services/inventoryProductService";
import { inventoryStockLogService } from "../services/inventoryStockLogService";
import { authService } from "../services/authService";
import { ViewToggle } from "../components/inventory/ViewToggle";
import { ProductCatalogV2Section } from "../components/inventory/ProductCatalogV2Section";
import { WarehouseSection } from "../components/inventory/WarehouseSection";
import { ReceivingSection } from "../components/inventory/ReceivingSection";

// Lazy-loaded subcomponents
const AiForecastPanel = lazy(() =>
  import("../components/inventory/AiForecastPanel").then((module) => ({
    default: module.AiForecastPanel,
  }))
);
const StockLogPanel = lazy(() =>
  import("../components/inventory/StockLogPanel").then((module) => ({
    default: module.StockLogPanel,
  }))
);
import { buildInventoryForecast } from "../utils/inventoryForecast";
import { parseFirebaseError } from "../utils/firebaseErrorParser";

function getInventoryErrorMessage(error: unknown, fallbackMessage: string) {
  return parseFirebaseError(error, fallbackMessage);
}

type TransactionStatus = "Đang chờ" | "Đang xử lý" | "Hoàn thành";

type DeleteTarget =
  | { type: "category"; id: string; title: string; description: string; confirmLabel: string; tone: "danger" | "warning" }
  | { type: "log"; id: string; title: string; description: string; confirmLabel: string; tone: "danger" | "warning" };

function isCompletedTransactionStatus(status: TransactionStatus | string) {
  return String(status).trim().toLowerCase() === "hoàn thành";
}

function getStockLogItems(log: StockLog) {
  const typedLog = log as StockLog & {
    title?: string;
    items?: Array<{ productId?: string; sku: string; productName: string; quantity: number }>;
  };

  if (typedLog.items?.length) {
    return typedLog.items;
  }

  return [{ sku: log.sku, productName: log.productName, quantity: log.quantity }];
}

export default function InventoryTab() {
  const subTabsRef = useRef<HTMLDivElement>(null);
  const scrollSubTabs = (direction: "left" | "right") => subTabsRef.current?.scrollBy({ left: direction === "left" ? -280 : 280, behavior: "smooth" });
  const { user } = useAuth();
  const { activeBranchId, loading: branchLoading } = useBranch();
  const [subTab, setSubTab] = useSubTabRouter<InventorySubTabType>(INVENTORY_SUB_TAB_ROUTES, "SẢN PHẨM");
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [stockLogLoading, setStockLogLoading] = useState(true);
  const [searchCategory, setSearchCategory] = useState("");
  const [searchLog, setSearchLog] = useState("");
  const [stockLogExcelImporting, setStockLogExcelImporting] = useState(false);
  const [outboundPrefill, setOutboundPrefill] = useState<{ warehouseId: string; sku: string; nonce: number } | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryCode, setNewCategoryCode] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [categoryViewMode, setCategoryViewMode] = useState<"grid" | "list">("grid");
  const stockLogImportInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let unsubscribeCategories = () => { };
    let unsubscribeProducts = () => { };
    let unsubscribeStockLogs = () => { };

    if (!user) {
      setCategoryLoading(false);
      setStockLogLoading(false);
      return;
    }

    if (branchLoading || !activeBranchId) {
      if (!branchLoading) {
        setCategoryLoading(false);
        setStockLogLoading(false);
      }
      return;
    }

    setCategoryLoading(true);
    setStockLogLoading(true);

    unsubscribeCategories = inventoryCategoryService.subscribe(
      activeBranchId,
      (nextCategories) => {
        setCategories(nextCategories);
        setCategoryLoading(false);
      },
      () => {
        setCategoryLoading(false);
        toast.error("Không thể tải phân loại sản phẩm.");
      }
    );

    unsubscribeProducts = inventoryProductService.subscribe(
      activeBranchId,
      (nextProducts) => {
        setProducts(nextProducts);
      },
      () => {
        toast.error("Không thể tải danh mục sản phẩm.");
      }
    );

    unsubscribeStockLogs = inventoryStockLogService.subscribe(
      activeBranchId,
      (nextLogs) => {
        setStockLogs(nextLogs);
        setStockLogLoading(false);
      },
      () => {
        setStockLogLoading(false);
        toast.error("Không thể tải phiếu nhập xuất kho.");
      }
    );

    return () => {
      unsubscribeCategories();
      unsubscribeProducts();
      unsubscribeStockLogs();
    };
  }, [user, activeBranchId, branchLoading]);

  const forecastSummary = useMemo<InventoryForecastSummary>(
    () => buildInventoryForecast(products, stockLogs),
    [products, stockLogs]
  );

  const activeCategoryCount = categories.filter((category) => category.status === "Đang dùng").length;
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchCategory.toLowerCase()) ||
    category.code.toLowerCase().includes(searchCategory.toLowerCase())
  );

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setShowCategoryModal(false);
    setNewCategoryName("");
    setNewCategoryCode("");
    setNewCategoryDescription("");
  };

  const openCreateCategoryModal = () => {
    resetCategoryForm();
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (category: ProductCategory) => {
    setEditingCategoryId(category.id);
    setNewCategoryName(category.name);
    setNewCategoryCode(category.code);
    setNewCategoryDescription(category.description);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCategoryName.trim() || !newCategoryCode.trim()) return;

    const cleanName = newCategoryName.trim();
    const cleanCode = newCategoryCode.trim().toUpperCase();
    const currentCategory = editingCategoryId ? categories.find((category) => category.id === editingCategoryId) : null;
    const existed = categories.some(
      (category) => category.id !== editingCategoryId && category.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existed) {
      toast.error("Phân loại này đã có trong danh mục kho.");
      return;
    }

    try {
      if (editingCategoryId) {
        await inventoryCategoryService.updateCategory(editingCategoryId, {
          name: cleanName,
          code: cleanCode,
          description: newCategoryDescription.trim() || "Chưa có mô tả. Có thể bổ sung sau.",
        }, activeBranchId);

        if (currentCategory && currentCategory.name !== cleanName) {
          await inventoryProductService.updateProductsCategoryName(currentCategory.name, cleanName, activeBranchId);
        }

        toast.success("Đã cập nhật phân loại sản phẩm.");
      } else {
        await inventoryCategoryService.createCategory({
          name: cleanName,
          code: cleanCode,
          description: newCategoryDescription.trim() || "Chưa có mô tả. Có thể bổ sung sau.",
        }, activeBranchId);
        toast.success("Đã tạo phân loại sản phẩm.");
      }

      resetCategoryForm();
    } catch (error) {
      toast.error(getInventoryErrorMessage(error, "Không thể lưu phân loại sản phẩm. Vui lòng thử lại."));
    }
  };

  const handleDeleteCategory = async (category: ProductCategory) => {
    const linkedProductCount = products.filter((product) => product.category === category.name).length;
    setDeleteTarget({
      type: "category",
      id: category.id,
      title: "Xóa phân loại",
      description:
        linkedProductCount > 0
          ? `Phân loại "${category.name}" đang được dùng bởi ${linkedProductCount} sản phẩm. Khi xóa, các sản phẩm đó sẽ được chuyển về "Chưa phân loại".`
          : `Bạn có chắc muốn xóa phân loại "${category.name}" không?`,
      confirmLabel: "Xóa phân loại",
      tone: linkedProductCount > 0 ? "warning" : "danger",
    });
  };

  const deleteCategoryById = async (categoryId: string) => {
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category) {
      throw new Error(JSON.stringify({ error: "Không tìm thấy phân loại cần xóa." }));
    }

    const linkedProductCount = products.filter((product) => product.category === category.name).length;
    if (linkedProductCount > 0) {
      await inventoryProductService.moveProductsToUncategorized(category.name, activeBranchId);
    }

    await inventoryCategoryService.deleteCategory(categoryId, activeBranchId);
    toast.success("Đã xóa phân loại sản phẩm.");
  };

  const handleExportStockLogsExcel = async () => {
    const { exportStockLogsToExcel } = await import("../utils/inventoryExcel");
    exportStockLogsToExcel(stockLogs);
    toast.success("Đã xuất phiếu nhập xuất kho ra Excel.");
  };

  const handleOpenStockLogImport = () => {
    stockLogImportInputRef.current?.click();
  };

  const handleImportStockLogsExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setStockLogExcelImporting(true);

    try {
      const { importStockLogsFromExcel } = await import("../utils/inventoryExcel");
      const importedLogs = await importStockLogsFromExcel(file);

      if (importedLogs.length === 0) {
        toast.error("File Excel không có phiếu nhập xuất hợp lệ.");
        return;
      }
      const importUpload = await authService.uploadManagedFile(file, "import.inventory-stock");

      const existingIds = new Set(stockLogs.map((log) => log.id));
      const nextLogs = importedLogs.filter((log) => !existingIds.has(log.id));
      let addedCount = 0;

      if (nextLogs.length === 0) {
        toast.error("Không có phiếu hợp lệ nào được nhập.");
        return;
      }

      const runningStocks = new Map(products.map((product) => [product.id, product.stock]));

      for (const log of nextLogs) {
        const logItems = getStockLogItems(log);
        const resolvedItems = logItems.map((item) => {
          const product = products.find((entry) => entry.sku === item.sku);
          if (!product) {
            throw new Error(JSON.stringify({ error: `Không tìm thấy sản phẩm có mã ${item.sku} trong danh mục kho.` }));
          }
          return { product, quantity: item.quantity };
        });

        const normalizedStatus: TransactionStatus =
          log.status === "Hoàn thành" || log.status === "Thành công"
            ? "Hoàn thành"
            : log.status === "Đang xử lý"
              ? "Đang xử lý"
              : "Đang chờ";

        if (isCompletedTransactionStatus(normalizedStatus)) {
          for (const item of resolvedItems) {
            const currentStock = runningStocks.get(item.product.id) ?? item.product.stock;
            if (log.type === "xuất" && currentStock < item.quantity) {
              throw new Error(
                JSON.stringify({ error: `Số lượng tồn kho của ${item.product.name} không đủ để import phiếu xuất hoàn thành.` })
              );
            }
          }

          await Promise.all(
            resolvedItems.map((item) => {
              const currentStock = runningStocks.get(item.product.id) ?? item.product.stock;
              const nextStock = log.type === "nhập" ? currentStock + item.quantity : currentStock - item.quantity;
              runningStocks.set(item.product.id, nextStock);
              return inventoryProductService.updateProductStock(item.product.id, nextStock, activeBranchId);
            })
          );
        }

        await inventoryStockLogService.saveImportedLog(log.id, {
          type: log.type as "nhập" | "xuất",
          purpose: log.purpose,
          title: (log as StockLog & { title?: string }).title || `${log.type === "nhập" ? "Phiếu nhập" : "Phiếu xuất"} import`,
          items: resolvedItems.map((item) => ({
            productId: item.product.id,
            sku: item.product.sku,
            productName: item.product.name,
            quantity: item.quantity,
          })),
          sku: resolvedItems[0].product.sku,
          productName: resolvedItems[0].product.name,
          quantity: resolvedItems.reduce((sum, item) => sum + item.quantity, 0),
          operatorName: log.operatorName || "Excel Import",
          notes: log.notes || "",
          status: normalizedStatus,
          createdAt: log.createdAt,
        }, activeBranchId);

        addedCount += 1;
      }

      await authService.completeManagedImport({
        sourceType: "import.inventory-stock",
        uploadToken: importUpload.uploadToken,
        fileName: file.name,
        importedCount: addedCount,
        skippedCount: importedLogs.length - addedCount,
      });

      toast.success(`Đã nhập ${addedCount} phiếu nhập/xuất kho từ Excel.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể nhập phiếu nhập/xuất kho từ Excel."));
    } finally {
      setStockLogExcelImporting(false);
    }
  };

  const handleCreateTransaction = async (payload: {
    type: "nhập" | "xuất";
    purpose?: import("../types").StockLogPurpose;
    customerName?: string;
    title: string;
    operatorName: string;
    notes: string;
    status: TransactionStatus;
    items: Array<{ productId: string; quantity: number }>;
  }) => {
    const resolvedItems = payload.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) {
        throw new Error(JSON.stringify({ error: "Không tìm thấy sản phẩm trong kho." }));
      }
      return { product, quantity: item.quantity };
    });

    if (isCompletedTransactionStatus(payload.status)) {
      for (const item of resolvedItems) {
        if (payload.type === "xuất" && item.product.stock < item.quantity) {
          throw new Error(JSON.stringify({ error: `Số lượng tồn kho của ${item.product.name} không đủ để xuất.` }));
        }
      }

      await Promise.all(
        resolvedItems.map((item) =>
          inventoryProductService.updateProductStock(
            item.product.id,
            payload.type === "nhập" ? item.product.stock + item.quantity : item.product.stock - item.quantity,
            activeBranchId
          )
        )
      );
    }

    const logItems = resolvedItems.map((item) => ({
      productId: item.product.id,
      sku: item.product.sku,
      productName: item.product.name,
      quantity: item.quantity,
    }));

    // Lưu phiếu vào Firebase
    await inventoryStockLogService.createLog({
      type: payload.type,
      purpose: payload.purpose,
      customerName: payload.customerName,
      title: payload.title,
      items: logItems,
      sku: resolvedItems[0].product.sku,
      productName: resolvedItems[0].product.name,
      quantity: resolvedItems.reduce((sum, item) => sum + item.quantity, 0),
      operatorName: payload.operatorName,
      notes: payload.notes || (payload.type === "nhập" ? "Phiếu nhập kho mới" : "Phiếu xuất kho mới"),
      status: payload.status,
    }, activeBranchId);

    toast.success(payload.type === "nhập" ? "Đã tạo phiếu nhập kho." : "Đã tạo phiếu xuất kho.");
  };

  const handleUpdateTransaction = async (payload: {
    id?: string;
    type: "nhập" | "xuất";
    purpose?: import("../types").StockLogPurpose;
    customerName?: string;
    title: string;
    operatorName: string;
    notes: string;
    status: TransactionStatus;
    items: Array<{ productId: string; quantity: number }>;
  }) => {
    if (!payload.id) return;

    const existingLog = stockLogs.find((log) => log.id === payload.id);
    if (!existingLog) {
      throw new Error(JSON.stringify({ error: "Không tìm thấy phiếu cần chỉnh sửa." }));
    }

    const oldType = existingLog.type as "nhập" | "xuất";
    const oldStatus = existingLog.status;
    const oldItems = getStockLogItems(existingLog);

    const normalizedOldItems = oldItems.map((item) => {
      const product = products.find((entry) => entry.sku === item.sku);
      if (!product) {
        throw new Error(JSON.stringify({ error: `Không tìm thấy sản phẩm cũ ${item.productName} trong kho.` }));
      }
      return { product, quantity: item.quantity, type: oldType };
    });

    const normalizedNewItems = payload.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) {
        throw new Error(JSON.stringify({ error: "Không tìm thấy sản phẩm mới trong kho." }));
      }
      return { product, quantity: item.quantity, type: payload.type };
    });

    const shouldReverseOldStock = isCompletedTransactionStatus(oldStatus);
    const shouldApplyNewStock = isCompletedTransactionStatus(payload.status);

    const adjustments = new Map<string, number>();
    if (shouldReverseOldStock) {
      for (const item of normalizedOldItems) {
        const restoreAmount = item.type === "nhập" ? -item.quantity : item.quantity;
        adjustments.set(item.product.id, (adjustments.get(item.product.id) || 0) + restoreAmount);
      }
    }
    if (shouldApplyNewStock) {
      for (const item of normalizedNewItems) {
        const applyAmount = item.type === "nhập" ? item.quantity : -item.quantity;
        adjustments.set(item.product.id, (adjustments.get(item.product.id) || 0) + applyAmount);
      }
    }

    for (const [productId, delta] of adjustments.entries()) {
      const product = products.find((entry) => entry.id === productId);
      if (!product) continue;
      if (product.stock + delta < 0) {
        throw new Error(JSON.stringify({ error: `Số lượng tồn kho của ${product.name} không đủ sau khi cập nhật phiếu.` }));
      }
    }

    if (adjustments.size > 0) {
      await Promise.all(
        Array.from(adjustments.entries()).map(async ([productId, delta]) => {
          const product = products.find((entry) => entry.id === productId);
          if (!product) return;
          await inventoryProductService.updateProductStock(productId, product.stock + delta, activeBranchId);
        })
      );
    }

    const logItems = normalizedNewItems.map((item) => ({
      productId: item.product.id,
      sku: item.product.sku,
      productName: item.product.name,
      quantity: item.quantity,
    }));

    // Cập nhật phiếu trong Firebase
    await inventoryStockLogService.updateLog(payload.id, {
      type: payload.type,
      purpose: payload.purpose,
      customerName: payload.customerName,
      title: payload.title,
      items: logItems,
      sku: normalizedNewItems[0].product.sku,
      productName: normalizedNewItems[0].product.name,
      quantity: normalizedNewItems.reduce((sum, item) => sum + item.quantity, 0),
      operatorName: payload.operatorName,
      notes: payload.notes,
      status: payload.status,
    }, activeBranchId);

    toast.success("Đã cập nhật phiếu nhập xuất kho.");
  };

  const handleQuickUpdateTransactionStatus = async (logId: string, status: TransactionStatus) => {
    const existingLog = stockLogs.find((log) => log.id === logId);
    if (!existingLog) {
      throw new Error(JSON.stringify({ error: "Không tìm thấy phiếu cần cập nhật trạng thái." }));
    }

    const items = getStockLogItems(existingLog).map((item) => {
      const product = products.find((entry) => entry.sku === item.sku);
      if (!product) {
        throw new Error(JSON.stringify({ error: `Không tìm thấy sản phẩm ${item.productName} trong kho.` }));
      }
      return { productId: product.id, quantity: item.quantity };
    });

    await handleUpdateTransaction({
      id: existingLog.id,
      type: existingLog.type as "nhập" | "xuất",
      purpose: existingLog.purpose,
      title: (existingLog as StockLog & { title?: string }).title || `${existingLog.type === "nhập" ? "Phiếu nhập" : "Phiếu xuất"}: ${existingLog.productName}`,
      operatorName: existingLog.operatorName,
      notes: existingLog.notes,
      status,
      items,
    });
  };

  const handleDeleteTransaction = async (logId: string) => {
    setDeleteTarget({
      type: "log",
      id: logId,
      title: "Xóa phiếu nhập xuất",
      description: "Phiếu sẽ bị xóa khỏi hệ thống và thao tác này không thể hoàn tác. Dữ liệu tồn kho hiện tại sẽ không tự hoàn trả.",
      confirmLabel: "Xóa phiếu",
      tone: "danger",
    });
  };

  const deleteLogById = async (logId: string) => {
    await inventoryStockLogService.deleteLog(logId, activeBranchId);
    toast.success("Đã xóa phiếu.");
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleteSubmitting(true);

    try {
      if (deleteTarget.type === "category") {
        await deleteCategoryById(deleteTarget.id);
      } else {
        await deleteLogById(deleteTarget.id);
      }

      setDeleteTarget(null);
    } catch (error) {
      const fallbackMessage =
        deleteTarget.type === "category"
          ? "Không thể xóa phân loại sản phẩm. Vui lòng thử lại."
          : "Không thể xóa phiếu. Vui lòng thử lại.";

      toast.error(getInventoryErrorMessage(error, fallbackMessage));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleNavigateToCreateProduct = () => {
    setSubTab("SẢN PHẨM");
  };

  return (
    <div className="flex h-full max-h-[85vh] flex-col overflow-hidden bg-white" id="inventory_tab_wrapper">
      <h1 className="sr-only">Quản lý Kho & Sản phẩm - {subTab}</h1>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-3 pt-2 pb-0 text-xs sm:px-5" id="inventory_tabs_switch">
        <div className="flex min-w-0 flex-1 items-center gap-1 select-none">
          <button type="button" aria-label="Cuộn tab kho sang trái" onClick={() => scrollSubTabs("left")} className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 sm:hidden"><ChevronLeft className="h-4 w-4" /></button>
          <div ref={subTabsRef} className="flex min-w-0 flex-1 gap-1 overflow-x-auto select-none">
            {[
              { id: "SẢN PHẨM", label: "Sản phẩm", icon: Package },
              { id: "KHO HÀNG", label: "Kho hàng", icon: FolderTree },
              { id: "NHẬP HÀNG", label: "Nhập hàng", icon: ArrowDownRight },
              { id: "XUẤT HÀNG", label: "Xuất hàng", icon: ArrowUpRight },
              { id: "GIAO DỊCH KHO", label: "Giao dịch kho", icon: ArrowLeftRight },
              { id: "DỰ BÁO", label: "Dự báo", icon: Sparkles },
            ].map((tab) => {
              const isActive = subTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id as InventorySubTabType)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 font-semibold text-xs transition-all cursor-pointer shrink-0 rounded-xl ${
                    isActive
                      ? "bg-cyan-600 text-white font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" aria-label="Cuộn tab kho sang phải" onClick={() => scrollSubTabs("right")} className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 sm:hidden"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6" id="inventory_tab_content">
        {subTab === "SẢN PHẨM" && (
          <div className="space-y-6" id="product_catalog_menu">
            <ProductCatalogV2Section />
          </div>
        )}

        {subTab === "KHO HÀNG" && <WarehouseSection onCreateOutbound={(warehouseId, sku) => {
          setOutboundPrefill({ warehouseId, sku, nonce: Date.now() });
          setSubTab("XUẤT HÀNG");
        }} />}
        {subTab === "NHẬP HÀNG" && <ReceivingSection />}

        {subTab === "PHÂN LOẠI SẢN PHẨM" && (
          <div className="space-y-6" id="product_classification_tab">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SummaryCard icon={FolderTree} label="Tổng phân loại" value={categories.length} tone="blue" />
              <SummaryCard icon={CheckCircle} label="Đang sử dụng" value={activeCategoryCount} tone="green" />
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-gray-150 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-800">
                  <Tags className="h-4.5 w-4.5 text-blue-500" />
                  Phân loại sản phẩm trong kho
                </h4>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm loại hoặc mã phân loại..."
                    className="w-full rounded-lg border border-gray-200 bg-slate-50 py-2 pl-9 pr-4 text-xs"
                    value={searchCategory}
                    onChange={(event) => setSearchCategory(event.target.value)}
                  />
                </div>
                <ViewToggle mode={categoryViewMode} onChange={setCategoryViewMode} />
                <button onClick={openCreateCategoryModal} className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 w-full sm:w-auto shrink-0">
                  <Plus className="h-4 w-4" />
                  Thêm phân loại
                </button>
              </div>
            </div>

            {categoryViewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {filteredCategories.map((category) => (
                  <div key={category.id} className="flex flex-col justify-between rounded-xl border border-gray-150 bg-white p-4 shadow-2xs transition-all hover:border-blue-200 hover:shadow-xs">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="truncate font-bold text-slate-800 text-sm" title={category.name}>
                          {category.name}
                        </h5>
                        <span className="shrink-0 rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500">
                          {category.code}
                        </span>
                      </div>
                      <p className={`mt-2 line-clamp-2 text-xs leading-relaxed ${category.description && category.description !== "Chưa có mô tả. Có thể bổ sung sau." ? "text-slate-500" : "italic text-slate-400"}`}>
                        {category.description || "Chưa có mô tả"}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/60 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                        <span className="h-1 w-1 rounded-full bg-blue-500"></span>
                        {category.status}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditCategoryModal(category)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-600"
                        >
                          <Pencil className="h-3 w-3" />
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-150 bg-white shadow-2xs">
                <table className="w-full border-collapse text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b border-gray-150">
                    <tr>
                      <th className="px-4 py-3">Tên phân loại</th>
                      <th className="px-4 py-3">Mã</th>
                      <th className="px-4 py-3">Mô tả</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCategories.map((category) => (
                      <tr key={category.id} className="hover:bg-slate-50/55 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">{category.name}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-500">{category.code}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={category.description}>
                          {category.description || <span className="italic text-slate-400">Chưa có mô tả</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/60 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                            <span className="h-1 w-1 rounded-full bg-blue-500"></span>
                            {category.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditCategoryModal(category)}
                              className="inline-flex items-center gap-1 rounded-md p-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                              title="Sửa"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(category)}
                              className="inline-flex items-center gap-1 rounded-md p-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!categoryLoading && filteredCategories.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="font-bold text-gray-700">Không tìm thấy phân loại phù hợp</p>
              </div>
            )}

            {categoryLoading && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="font-bold text-gray-700">Đang tải phân loại sản phẩm...</p>
                <p className="mt-1 text-xs text-gray-500">Dữ liệu đang được đồng bộ từ Firebase.</p>
              </div>
            )}

          </div>
        )}

        <Suspense fallback={<TabLoader label="Đang tải dữ liệu kho..." />}>
          {subTab === "GIAO DỊCH KHO" && (
            <>
              <input
                ref={stockLogImportInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportStockLogsExcel}
              />
              <StockLogPanel
                products={products}
                searchLog={searchLog}
                setSearchLog={setSearchLog}
                stockLogs={stockLogs}
                isLoading={stockLogLoading}
                onExportExcel={handleExportStockLogsExcel}
                onImportExcel={handleOpenStockLogImport}
                isImporting={stockLogExcelImporting}
                onNavigateToCreateProduct={handleNavigateToCreateProduct}
                onCreateTransaction={handleCreateTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onUpdateStatus={handleQuickUpdateTransactionStatus}
                onDeleteTransaction={handleDeleteTransaction}
                readOnly
              />
            </>
          )}
          {subTab === "XUẤT HÀNG" && (
            <StockLogPanel
              products={products}
              searchLog={searchLog}
              setSearchLog={setSearchLog}
              stockLogs={stockLogs}
              isLoading={stockLogLoading}
              onExportExcel={handleExportStockLogsExcel}
              onImportExcel={handleOpenStockLogImport}
              isImporting={stockLogExcelImporting}
              onNavigateToCreateProduct={handleNavigateToCreateProduct}
              onCreateTransaction={handleCreateTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onUpdateStatus={handleQuickUpdateTransactionStatus}
              onDeleteTransaction={handleDeleteTransaction}
              outboundOnly
              hideExcelActions
              initialWarehouseId={outboundPrefill?.warehouseId}
              initialSku={outboundPrefill?.sku}
              openOnMountKey={outboundPrefill?.nonce}
            />
          )}
          {subTab === "DỰ BÁO" && <AiForecastPanel forecast={forecastSummary} stockLogs={stockLogs} />}
        </Suspense>
      </div>

      {showCategoryModal && (
        <CategoryModal
          editingCategoryId={editingCategoryId}
          newCategoryCode={newCategoryCode}
          newCategoryDescription={newCategoryDescription}
          newCategoryName={newCategoryName}
          onClose={resetCategoryForm}
          onSubmit={handleSaveCategory}
          setNewCategoryCode={setNewCategoryCode}
          setNewCategoryDescription={setNewCategoryDescription}
          setNewCategoryName={setNewCategoryName}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={deleteTarget?.title || ""}
        description={deleteTarget?.description || ""}
        confirmLabel={deleteTarget?.confirmLabel || "Xác nhận"}
        tone={deleteTarget?.tone || "danger"}
        isSubmitting={deleteSubmitting}
        onClose={() => {
          if (deleteSubmitting) return;
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

function TabLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[250px] flex-col items-center justify-center gap-3 rounded-2xl bg-white border border-gray-150 p-6 text-center">
      <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-gray-500 font-semibold">{label}</span>
    </div>
  );
}
