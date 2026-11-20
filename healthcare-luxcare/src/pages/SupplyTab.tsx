import { SupplyInventoryWorkspace } from "../components/supply/SupplyInventoryWorkspace";
import { supplyInventoryService, type InventoryMode } from "../services/supplyInventoryService";
import { canIssueSupply } from "../../shared/supply-stock";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useBranch } from "../context/BranchContext";
import { useAuth } from "../context/AuthContext";
import { supplyService } from "../services/supplyService";
import { supplierService } from "../services/supplierService";
import { warehouseService } from "../services/warehouseService";
import { categoryService } from "../services/categoryService";
import { departmentService, type DepartmentRecord } from "../services/departmentService";
import type {
  SupplyItem,
  SupplyStats,
  SupplyTransaction,
  SupplyTransactionDocument,
  SupplyDocument,
} from "../types/supply";
import type { SupplierRecord } from "../types/supplier";
import type { WarehouseRecord } from "../types/warehouse";
import type { CategoryRecord } from "../types/category";
import {
  Package,
  Plus,
  FileSpreadsheet,
  Building2,
  Warehouse as WarehouseIcon,
  Tag,
  ArrowLeftRight,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "./Toast";
import {
  SupplyStatsCards,
  SupplyFiltersBar,
  SupplyTable,
  SupplyAddEditModal,
  SupplyBatchStockModal,
  SupplyHistoryModal,
  SupplyDocumentsModal,
  SupplyLightboxModal,
  SupplierManagementView,
  WarehouseManagementView,
  CategoryManagementView,
  SupplyTransactionsView,
  SupplyDetailModal,
} from "../components/supply";

type SupplySection = "supplies" | "transactions" | "suppliers" | "warehouses" | "categories";

function LegacySupplyTab({ section, inventoryMode, archived, page, setPage }: {
  section: SupplySection;
  inventoryMode: InventoryMode;
  archived: boolean;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { activeBranchId } = useBranch();
  const { userProfile, hasPermission } = useAuth();
  const canManage =
    userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("supply:manage");
  // Nhập/xuất remains the operational entry point in V2. Only migration preparation blocks writes.
  const legacyStockEnabled = inventoryMode !== "preparing";

  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);

  const createKey = useRef(crypto.randomUUID());
  const stockKey = useRef(crypto.randomUUID());
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [expiryStatus, setExpiryStatus] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [warehouse, setWarehouse] = useState("");

  // Suppliers, Warehouses & Categories lists for dropdown filter
  const [suppliersList, setSuppliersList] = useState<SupplierRecord[]>([]);
  const [warehousesList, setWarehousesList] = useState<WarehouseRecord[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryRecord[]>([]);
  const [departmentsList, setDepartmentsList] = useState<DepartmentRecord[]>([]);

  // Stats
  const [stats, setStats] = useState<SupplyStats>({
    totalValue: 0,
    totalItems: 0,
    totalQuantity: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    expiredCount: 0,
    expiringSoonCount: 0,
  });

  // Modal Control
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplyItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; restore: boolean } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingDraft, setEditingDraft] = useState<SupplyTransactionDocument | null>(null);
  const [draftSupplies, setDraftSupplies] = useState<SupplyItem[]>([]);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    category: string;
    unit: string;
    quantity: number;
    minQuantity: number;
    expiryDate: string;
    requiresExpiry: boolean;
    manufactureDate: string;
    batchNumber: string;
    warehouseLocation: string;
    warehouseId?: string;
    roomId: string;
    supplier: string;
    supplierId?: string;
    inspectionDate: string;
    nextInspectionDate: string;
    inspectionCertificateNumber: string;
    imageUrl: string;
    documents: SupplyDocument[];
    unitPrice: number;
    notes: string;
  }>({
    name: "",
    code: "",
    category: "",
    unit: "Hộp",
    quantity: 0,
    minQuantity: 10,
    expiryDate: "",
    requiresExpiry: true,
    manufactureDate: "",
    batchNumber: "",
    warehouseLocation: "",
    warehouseId: undefined,
    roomId: "",
    supplier: "",
    supplierId: undefined,
    inspectionDate: new Date().toISOString().slice(0, 10),
    nextInspectionDate: "",
    inspectionCertificateNumber: "",
    imageUrl: "",
    documents: [],
    unitPrice: 0,
    notes: "",
  });

  // Stock In / Stock Out Modal
  const [stockModalType, setStockModalType] = useState<"in" | "out" | null>(null);
  const [selectedSupply, setSelectedSupply] = useState<SupplyItem | null>(null);
  const [stockQuantity, setStockQuantity] = useState(1);
  const [stockReason, setStockReason] = useState("");
  const [stockRecipient, setStockRecipient] = useState("");
  const [stockBatch, setStockBatch] = useState("");
  const [stockExpiry, setStockExpiry] = useState("");

  // Transactions History Modal
  const [historyItem, setHistoryItem] = useState<SupplyItem | null>(null);
  const [transactions, setTransactions] = useState<SupplyTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Documents Viewer Modal
  const [viewDocsItem, setViewDocsItem] = useState<SupplyItem | null>(null);

  // Material Detail Modal
  const [detailItem, setDetailItem] = useState<SupplyItem | null>(null);

  // Lightbox Image
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Load suppliers, warehouses and categories for filter dropdown
  const loadFilterOptions = useCallback(async () => {
    try {
      const [supList, whList, catList, departmentList] = await Promise.all([
        supplierService.list({ activeOnly: true }),
        warehouseService.list({ branchId: activeBranchId, activeOnly: true }),
        categoryService.list({ activeOnly: true }),
        departmentService.list({ activeOnly: true }),
      ]);
      setSuppliersList(supList);
      setWarehousesList(whList);
      setCategoriesList(catList);
      setDepartmentsList(departmentList);
    } catch (e) {
      console.error("Error loading filter options:", e);
    }
  }, [activeBranchId]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions, section]);

  // Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        supplyService.list(
          {
            archived,
            page,
            limit,
            search,
            category,
            status,
            expiryStatus,
            supplier,
            warehouse,
          },
          activeBranchId,
        ),
        supplyService.getStats(activeBranchId),
      ]);

      setItems(listRes.data || []);
      setTotal(listRes.total || 0);
      setStats(statsRes);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi tải dữ liệu vật tư.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, category, status, expiryStatus, supplier, warehouse, activeBranchId, archived]);

  useEffect(() => {
    if (section === "supplies" || section === "transactions") {
      fetchData();
    }
  }, [fetchData, section]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleFilterChange = () => {
    setPage(1);
  };

  const handleOpenAdd = () => {
    createKey.current = crypto.randomUUID();
    setEditingItem(null);
    setFormData({
      name: "",
      code: "",
      category: "",
      unit: "Hộp",
      quantity: 0,
      minQuantity: 10,
      expiryDate: "",
      requiresExpiry: true,
      manufactureDate: "",
      batchNumber: "",
      warehouseLocation: "",
      warehouseId: undefined,
      roomId: "",
      supplier: "",
      supplierId: undefined,
      inspectionDate: new Date().toISOString().slice(0, 10),
      nextInspectionDate: "",
      inspectionCertificateNumber: "",
      imageUrl: "",
      documents: [],
      unitPrice: 0,
      notes: "",
    });
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (item: SupplyItem) => {
    setEditingItem(item);
    setFormData({
      requiresExpiry: item.requiresExpiry !== false,
      name: item.name || "",
      code: item.code || "",
      category: item.category || "",
      unit: item.unit || "Hộp",
      quantity: item.quantity || 0,
      minQuantity: item.minQuantity ?? 10,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : "",
      manufactureDate: item.manufactureDate ? new Date(item.manufactureDate).toISOString().slice(0, 10) : "",
      batchNumber: item.batchNumber || "",
      warehouseLocation: item.warehouseLocation || "",
      warehouseId: item.warehouseId,
      roomId: item.roomId || "",
      supplier: item.supplier || "",
      supplierId: item.supplierId,
      inspectionDate: item.inspectionDate ? new Date(item.inspectionDate).toISOString().slice(0, 10) : "",
      nextInspectionDate: item.nextInspectionDate ? new Date(item.nextInspectionDate).toISOString().slice(0, 10) : "",
      inspectionCertificateNumber: item.inspectionCertificateNumber || "",
      imageUrl: item.imageUrl || "",
      documents: item.documents || [],
      unitPrice: item.unitPrice || 0,
      notes: item.notes || "",
    });
    setShowAddEditModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Vui lòng nhập Tên vật tư.");
      return;
    }
    if (!formData.code.trim()) {
      toast.error("Vui lòng nhập Mã vật tư.");
      return;
    }
    if (!formData.category.trim()) {
      toast.error("Vui lòng chọn Phân loại sản phẩm.");
      return;
    }
    if (!formData.unit.trim()) {
      toast.error("Vui lòng nhập Đơn vị tính.");
      return;
    }

    setActionLoading(true);
    try {
      if (editingItem) {
        const { quantity, ...patch } = formData;
        await supplyService.update(editingItem._id, patch, activeBranchId);
        toast.success("Cập nhật vật tư thành công!");
      } else {
        await supplyService.create({ ...formData, quantity: 0 }, activeBranchId, createKey.current);
        toast.success("Thêm mới vật tư thành công!");
      }
      setShowAddEditModal(false);
      fetchData();
      loadFilterOptions();
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu vật tư.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name, restore: archived });
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteLoading) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.restore) await supplyService.restore(deleteTarget.id, activeBranchId);
      else await supplyService.delete(deleteTarget.id, activeBranchId);
      toast.success(deleteTarget.restore ? "Đã khôi phục vật tư." : "Đã ngừng sử dụng vật tư.");
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(
        err.message || (deleteTarget.restore ? "Không thể khôi phục vật tư." : "Không thể ngừng sử dụng vật tư."),
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  // Stock In / Stock Out Handlers
  const handleOpenStock = (item: SupplyItem | null, type: "in" | "out") => {
    setEditingDraft(null);
    setDraftSupplies([]);
    stockKey.current = crypto.randomUUID();
    const target = item || (items.length > 0 ? items[0] : null);
    setSelectedSupply(target);
    setStockModalType(type);
    setStockQuantity(1);
    setStockReason(type === "in" ? "Nhập thêm vào kho" : "Cấp phát sử dụng");
    setStockRecipient("");
    setStockBatch(target?.batchNumber || "");
    setStockExpiry(target?.expiryDate ? new Date(target.expiryDate).toISOString().slice(0, 10) : "");
  };

  const handleEditDraft = async (draft: SupplyTransactionDocument) => {
    if (draft.status !== "draft" || !draft.voucherId) return;
    try {
      const supplies = await Promise.all(draft.items.map((item) => supplyService.get(item.supplyId, activeBranchId)));
      setDraftSupplies(supplies);
      setEditingDraft(draft);
      setSelectedSupply(supplies[0] || null);
      setStockModalType(draft.type);
    } catch (err: any) {
      toast.error(err.message || "Không thể mở phiếu nháp để chỉnh sửa.");
    }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupply || !stockModalType) return;
    setActionLoading(true);
    try {
      if (stockModalType === "in") {
        await supplyService.stockIn(
          selectedSupply._id,
          {
            quantity: stockQuantity,
            batchNumber: stockBatch,
            expiryDate: stockExpiry,
            reason: stockReason,
          },
          activeBranchId,
        );
        toast.success(`Đã nhập thêm ${stockQuantity} ${selectedSupply.unit} vào kho.`);
      } else {
        if (!stockRecipient.trim()) {
          toast.error("Vui lòng nhập Khoa/Phòng nhận vật tư.");
          setActionLoading(false);
          return;
        }
        await supplyService.stockOut(
          selectedSupply._id,
          {
            quantity: stockQuantity,
            recipientDepartment: stockRecipient,
            reason: stockReason,
          },
          activeBranchId,
        );
        toast.success(`Đã xuất ${stockQuantity} ${selectedSupply.unit} cho ${stockRecipient}.`);
      }
      setStockModalType(null);
      setSelectedSupply(null);
      fetchData();
      setTransactionRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err.message || "Thao tác xuất nhập kho thất bại.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenHistory = async (item: SupplyItem) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    try {
      const list = await supplyService.getTransactions(item._id, activeBranchId);
      setTransactions(list);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải lịch sử giao dịch.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExport = async () => {
    try {
      await supplyService.exportExcel(
        { search, category, status, expiryStatus, supplier, warehouse, archived },
        activeBranchId,
      );
      toast.success("Đã tải xuống file Excel danh mục vật tư.");
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi xuất file Excel.");
    }
  };

  return (
    <main className="space-y-3 p-3 text-left text-on-surface sm:p-4">
      {/* View: Nhập & Xuất kho */}
      {section === "transactions" && (
        <SupplyTransactionsView
          key={transactionRefreshKey}
          canManage={canManage && legacyStockEnabled}
          activeBranchId={activeBranchId}
          onOpenStockModal={handleOpenStock}
          onEditDraft={handleEditDraft}
        />
      )}

      {/* View 1: Nhà cung cấp */}
      {section === "suppliers" && <SupplierManagementView canManage={canManage} />}

      {/* View 2: Kho lưu trữ */}
      {section === "warehouses" && <WarehouseManagementView canManage={canManage} activeBranchId={activeBranchId} />}

      {/* View 3: Phân loại sản phẩm */}
      {section === "categories" && <CategoryManagementView canManage={canManage} />}

      {/* View 3: Danh mục vật tư */}
      {section === "supplies" && (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 [&>button]:min-h-10 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline-1 focus-visible:outline-primary"
              >
                <FileSpreadsheet className="size-4 text-primary" />
                Xuất Excel
              </button>
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenStock(null, "in")}
                    disabled={!legacyStockEnabled}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                    title="Lập phiếu nhập kho theo lô (nhiều sản phẩm)"
                  >
                    <ArrowDownRight className="w-4 h-4" />+ Nhập kho theo lô
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenStock(null, "out")}
                    disabled={!legacyStockEnabled}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-on-surface hover:bg-primary/5 focus-visible:outline-1 focus-visible:outline-primary disabled:opacity-50"
                    title="Lập phiếu xuất kho theo lô cho các khoa/phòng"
                  >
                    <ArrowUpRight className="w-4 h-4" />- Xuất kho theo lô
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3.5 py-2 text-xs font-semibold text-on-surface hover:bg-primary/5 focus-visible:outline-1 focus-visible:outline-primary"
                    title="Khai báo thêm mặt hàng vào danh mục vật tư"
                  >
                    <Plus className="size-4 text-primary" />+ Khai báo danh mục mới
                  </button>
                </>
              )}
            </div>
          </div>

          {/* KPI Stats Section */}
          <SupplyStatsCards stats={stats} />

          {/* Filter and Table Card */}
          <div className="rounded-md border border-outline-variant bg-surface-container-lowest shadow-xs">
            <SupplyFiltersBar
              search={search}
              setSearch={setSearch}
              status={status}
              setStatus={setStatus}
              expiryStatus={expiryStatus}
              setExpiryStatus={setExpiryStatus}
              category={category}
              setCategory={setCategory}
              supplier={supplier}
              setSupplier={setSupplier}
              warehouse={warehouse}
              setWarehouse={setWarehouse}
              suppliers={suppliersList}
              warehouses={warehousesList}
              categories={categoriesList}
              onSubmit={handleSearchSubmit}
              onFilterChange={handleFilterChange}
            />

            <SupplyTable
              items={items}
              loading={loading}
              canManage={canManage}
              page={page}
              limit={limit}
              total={total}
              setPage={setPage}
              onOpenStock={handleOpenStock}
              onOpenHistory={handleOpenHistory}
              onOpenEdit={handleOpenEdit}
              onDelete={handleDelete}
              onViewDocs={(item) => setViewDocsItem(item)}
              onViewDetail={(item) => setDetailItem(item)}
              onLightboxImage={(url) => setLightboxImage(url)}
            />
          </div>
        </>
      )}

      {/* Modals */}
      <SupplyAddEditModal
        isOpen={showAddEditModal}
        editingItem={editingItem}
        formData={formData}
        setFormData={setFormData}
        actionLoading={actionLoading}
        activeBranchId={activeBranchId}
        onClose={() => setShowAddEditModal(false)}
        onSubmit={handleSubmit}
      />

      <SupplyBatchStockModal
        isOpen={Boolean(stockModalType)}
        type={stockModalType}
        initialSupply={selectedSupply}
        initialDraft={editingDraft}
        suppliesList={
          archived ? [] : Array.from(new Map([...items, ...draftSupplies].map((item) => [item._id, item])).values())
        }
        suppliersList={suppliersList}
        warehousesList={warehousesList}
        departmentsList={departmentsList}
        actionLoading={actionLoading}
        onClose={() => {
          setStockModalType(null);
          setSelectedSupply(null);
          setEditingDraft(null);
          setDraftSupplies([]);
        }}
        onSubmit={async (payload) => {
          setActionLoading(true);
          try {
            let res;
            if (editingDraft?.voucherId) {
              await supplyService.updateVoucherDraft(editingDraft.voucherId, payload, activeBranchId);
              res = await supplyService.completeVoucherDraft(editingDraft.voucherId, activeBranchId);
            } else {
              res = await supplyService.batchStock(payload, activeBranchId, stockKey.current);
            }
            toast.success(
              payload.type === "in"
                ? `Nhập kho theo lô (${res.batchCode}) thành công (${res.totalItems} mặt hàng)!`
                : `Xuất kho theo lô (${res.batchCode}) thành công (${res.totalItems} mặt hàng)!`,
            );
            setStockModalType(null);
            setSelectedSupply(null);
            setEditingDraft(null);
            setDraftSupplies([]);
            fetchData();
            setTransactionRefreshKey((k) => k + 1);
          } catch (err: any) {
            toast.error(err.message || "Lỗi khi thực hiện giao dịch theo lô.");
          } finally {
            setActionLoading(false);
          }
        }}
        onSaveDraft={async (payload) => {
          setActionLoading(true);
          try {
            if (editingDraft?.voucherId) {
              await supplyService.updateVoucherDraft(editingDraft.voucherId, payload, activeBranchId);
              toast.success("Đã cập nhật phiếu nháp.");
            } else {
              await supplyService.createVoucherDraft(payload, activeBranchId);
              toast.success("Đã lưu phiếu nháp. Tồn kho chưa thay đổi.");
            }
            setStockModalType(null);
            setSelectedSupply(null);
            setEditingDraft(null);
            setDraftSupplies([]);
            setTransactionRefreshKey((key) => key + 1);
          } catch (err: any) {
            toast.error(err.message || "Không thể lưu phiếu nháp.");
          } finally {
            setActionLoading(false);
          }
        }}
      />

      <SupplyHistoryModal
        isOpen={Boolean(historyItem)}
        supply={historyItem}
        transactions={transactions}
        loading={loadingHistory}
        onClose={() => setHistoryItem(null)}
      />

      <SupplyDocumentsModal
        isOpen={Boolean(viewDocsItem)}
        supply={viewDocsItem}
        onClose={() => setViewDocsItem(null)}
      />

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleteLoading) setDeleteTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="supply-delete-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-xl p-2.5 ${
                    deleteTarget.restore ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="supply-delete-title" className="text-lg font-bold text-slate-900">
                    {deleteTarget.restore ? "Khôi phục vật tư?" : "Ngừng sử dụng vật tư?"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {deleteTarget.restore
                      ? "Vật tư sẽ xuất hiện lại trong danh sách đang sử dụng."
                      : "Vật tư sẽ được ẩn khỏi danh sách sử dụng nhưng không bị xóa vĩnh viễn."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                disabled={deleteLoading}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vật tư</p>
                <p className="mt-1 font-semibold text-slate-900">{deleteTarget.name}</p>
              </div>
              {!deleteTarget.restore && (
                <p className="text-sm leading-relaxed text-slate-600">
                  Chỉ có thể ngừng sử dụng khi số lượng tồn bằng 0. Toàn bộ lịch sử nhập/xuất vẫn được giữ lại.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => void confirmDelete()}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
                    deleteTarget.restore ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {deleteTarget.restore ? "Khôi phục" : "Ngừng sử dụng"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SupplyLightboxModal imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />

      <SupplyDetailModal
        isOpen={Boolean(detailItem)}
        supply={detailItem}
        activeBranchId={activeBranchId}
        canManage={canManage}
        onClose={() => setDetailItem(null)}
        onEdit={(item) => handleOpenEdit(item)}
        onStockAction={legacyStockEnabled ? (item, type) => handleOpenStock(item, type) : undefined}
        onViewDocuments={(item) => setViewDocsItem(item)}
        onLightboxImage={(url) => setLightboxImage(url)}
      />
    </main>
  );
}

export default function SupplyTab() {
  const { activeBranchId } = useBranch();
  const { userProfile } = useAuth();
  const branch = activeBranchId || userProfile?.branchId || "";
  return <SupplyInventoryEntry key={String(userProfile?.companyCode) + ":" + branch} branch={branch} />;
}
function SupplyInventoryEntry({ branch }: { branch: string }) {
  const { hasPermission, userProfile } = useAuth();
  const [mode, setMode] = useState<InventoryMode | null>(null);
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("section") || "supplies";
    return requested === "documents" ? "transactions" : requested;
  });
  const [navigationLocked, setNavigationLocked] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") !== "documents") return;
    url.searchParams.set("section", "transactions");
    window.history.replaceState({}, "", url);
  }, []);
  useEffect(() => {
    if (!branch) return;
    let alive = true;
    setMode(null);
    setError("");
    supplyInventoryService
      .state(branch)
      .then((r) => {
        if (alive) {
          setMode(r.mode);
        }
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Không tải được trạng thái kho.");
      });
    return () => {
      alive = false;
    };
  }, [branch, retry]);
  const can = (p: string) => userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission(p);
  if (!branch) return <div className="p-4">Chọn chi nhánh để xem và thao tác kho vật tư.</div>;
  if (error)
    return (
      <div className="p-4 space-y-3">
        <p role="alert">{error}</p>
        <button className="rounded border px-3 py-2" onClick={() => setRetry((v) => v + 1)}>
          Thử lại
        </button>
      </div>
    );
  if (!mode) return <div className="p-4">Đang kiểm tra trạng thái kho…</div>;
  const legacyTabs = [
    { id: "supplies", label: "Vật tư", icon: Package },
    { id: "transactions", label: "Nhập / Xuất kho", icon: ArrowLeftRight },
    { id: "suppliers", label: "Nhà cung cấp", icon: Building2 },
    { id: "warehouses", label: "Kho lưu trữ", icon: WarehouseIcon },
    { id: "categories", label: "Phân loại", icon: Tag },
  ];
  const inventoryTabs = [
    { id: "balances", label: "Tồn theo lô", icon: Package },
    { id: "catalog", label: "Đơn vị quy đổi", icon: ArrowLeftRight },
  ];
  // V2 changes the writer, not the availability of catalog/admin/history pages.
  const tabs = [...legacyTabs, ...inventoryTabs];
  const active = tabs.some((t) => t.id === selection) ? selection : tabs[0].id;
  const isInventory = inventoryTabs.some((t) => t.id === active);
  return (
    <div className="h-full min-h-0 w-full overflow-y-auto">
      <div className="flex items-center gap-2 px-3 pt-2 sm:px-4">
        <nav
          aria-label="Điều hướng quản lý vật tư"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto border-b border-outline-variant bg-surface-container-lowest p-1"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={active === id}
              disabled={navigationLocked && active !== id}
              className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 ${active === id ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:bg-primary/5 hover:text-primary"}`}
              onClick={() => {
                if (navigationLocked) return;
                setSelection(id);
                const url = new URL(window.location.href);
                if (id === "supplies") url.searchParams.delete("section");
                else url.searchParams.set("section", id);
                window.history.replaceState({}, "", url);
              }}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        {active === "supplies" && (
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface">
            <input
              type="checkbox"
              className="size-4 rounded border-outline-variant accent-primary focus-visible:outline-2 focus-visible:outline-primary"
              checked={archived}
              onChange={(event) => {
                setArchived(event.target.checked);
                setPage(1);
              }}
            />
            Xem vật tư đã ngừng sử dụng
          </label>
        )}
      </div>
      {isInventory ? (
        <div className="p-3 sm:p-4">
          <SupplyInventoryWorkspace
            key={active}
            branch={branch}
            mode={mode}
            can={can}
            initialTab={active}
            hideNavigation
            onNavigationLockChange={setNavigationLocked}
          />
        </div>
      ) : (
        <LegacySupplyTab section={active as SupplySection} inventoryMode={mode} archived={archived} page={page} setPage={setPage} />
      )}
    </div>
  );
}
