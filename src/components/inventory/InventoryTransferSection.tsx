import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { StyledSelect } from "../common/StyledSelect";
import {
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  Truck,
  Warehouse,
  X,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  inventoryTransferService,
  type InventoryTransfer,
  type TransferDestination,
} from "../../services/inventoryTransferService";
import {
  inventorySerialService,
  type InventorySerialUnit,
} from "../../services/inventorySerialService";
import { OutboundImeiPickerModal } from "./outbound/OutboundImeiPickerModal";
import { apiFetch } from "../../modules/shared/lib/apiFetch";
import type { InventoryBalance } from "../../services/inventoryReceivingService";
import { toast } from "../../pages/Toast";

type DraftLine = { key: string; variantId: string; quantity: string; codes: string };
const newLine = (): DraftLine => ({ key: crypto.randomUUID(), variantId: "", quantity: "1", codes: "" });

const statusLabels: Record<string, string> = {
  in_transit: "Đang vận chuyển",
  received: "Đã nhận",
  cancelled: "Đã hủy",
  reversed: "Đã đảo",
};

const currency = (value: number) =>
  value.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

const getUnitCode = (unit: InventorySerialUnit) =>
  unit.serialNumber || unit.internalBarcode || unit.normalizedInternalBarcode || unit._id;

const isUnitSelected = (unit: InventorySerialUnit, selectedCodes: string[]) => {
  const code = getUnitCode(unit);
  return (
    selectedCodes.includes(code) ||
    Boolean(unit.serialNumber && selectedCodes.includes(unit.serialNumber)) ||
    Boolean(unit.internalBarcode && selectedCodes.includes(unit.internalBarcode))
  );
};

export function InventoryTransferSection({
  branchId,
  canManage,
}: {
  branchId: string;
  canManage: boolean;
}) {
  const [destinations, setDestinations] = useState<TransferDestination[]>([]);
  const [documents, setDocuments] = useState<InventoryTransfer[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Popup Modal State
  const [open, setOpen] = useState(false);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  // Serial Units per SKU cache for source warehouse
  const [serialCache, setSerialCache] = useState<
    Record<string, { loading: boolean; items: InventorySerialUnit[] }>
  >({});
  const loadedSerialKeys = useRef<Set<string>>(new Set());

  // Search filter per line for available IMEIs
  const [unitSearchQuery, setUnitSearchQuery] = useState<Record<string, string>>({});

  // Full IMEI picker modal target line index
  const [pickerLineIndex, setPickerLineIndex] = useState<number | null>(null);

  // Cancel action state
  const [cancelId, setCancelId] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const request = useRef<{ content: string; key: string } | null>(null);

  // Fetch warehouse destinations
  useEffect(() => {
    const controller = new AbortController();
    inventoryTransferService
      .destinations(branchId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setDestinations(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) toast.error(error.message);
      });
    return () => controller.abort();
  }, [branchId, open, revision]);

  // Fetch transfer documents
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    inventoryTransferService
      .list(branchId, page, status, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setDocuments(data.items);
          setTotal(data.total);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDocuments([]);
          toast.error(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [branchId, page, status, revision]);

  // Fetch available balances from chosen warehouse
  useEffect(() => {
    const controller = new AbortController();
    setBalances([]);
    loadedSerialKeys.current.clear();
    setSerialCache({});
    if (!fromWarehouseId || !open) {
      setBalancesLoading(false);
      return () => controller.abort();
    }
    setBalancesLoading(true);
    apiFetch<{ data: InventoryBalance[] }>("/inventory/warehouses/balances", {
      params: { warehouseId: fromWarehouseId },
      headers: { "x-branch-id": branchId },
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setBalances(
            data.data.filter(
              (item) => item.variantId && item.quantity > item.reservedQuantity && item.trackingMode !== "lot"
            )
          );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) toast.error(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBalancesLoading(false);
      });
    return () => controller.abort();
  }, [branchId, fromWarehouseId, open]);

  // Fetch available serial units for selected tracked SKUs in fromWarehouseId
  useEffect(() => {
    if (!fromWarehouseId || !open) return;
    lines.forEach((line) => {
      const balance = balances.find((b) => b.variantId === line.variantId);
      if (!balance || !["serial", "unit_barcode"].includes(balance.trackingMode || "")) return;
      const cacheKey = `${fromWarehouseId}_${balance.sku}`;
      if (loadedSerialKeys.current.has(cacheKey)) return;
      loadedSerialKeys.current.add(cacheKey);

      setSerialCache((prev) => ({ ...prev, [cacheKey]: { loading: true, items: [] } }));
      inventorySerialService
        .list({ warehouseId: fromWarehouseId, sku: balance.sku, status: "in_stock", limit: 200 })
        .then((res: any) => {
          const items: InventorySerialUnit[] = Array.isArray(res)
            ? res
            : Array.isArray(res?.items)
              ? res.items
              : [];
          setSerialCache((prev) => ({ ...prev, [cacheKey]: { loading: false, items } }));
        })
        .catch(() => {
          setSerialCache((prev) => ({ ...prev, [cacheKey]: { loading: false, items: [] } }));
        });
    });
  }, [fromWarehouseId, open, lines, balances]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !busy && pickerLineIndex === null) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, pickerLineIndex]);

  const run = async (work: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      toast.success(message);
      setRevision((value) => value + 1);
      setCancelId("");
    } catch (error: any) {
      toast.error(error.message || "Không thể xử lý điều chuyển.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenCreateModal = () => {
    setLines([newLine()]);
    setReason("");
    setFromWarehouseId("");
    setToWarehouseId("");
    request.current = null;
    setOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const target = destinations.find((item) => item._id === toWarehouseId);
    if (!target) return;
    const items = lines.map((line) => {
      const balance = balances.find((item) => item.variantId === line.variantId);
      return {
        productId: balance?.productId || "",
        variantId: line.variantId,
        sku: balance?.sku || "",
        quantity: Number(line.quantity),
        unitIdentifiers: line.codes
          .split(/[\s,;]+/)
          .map((code) => code.trim())
          .filter(Boolean),
      };
    });
    const input = {
      fromWarehouseId,
      toBranchId: target.branchId,
      toWarehouseId,
      reason: reason.trim(),
      items,
    };
    const content = JSON.stringify(input);
    if (request.current?.content !== content) {
      request.current = { content, key: crypto.randomUUID() };
    }
    void run(async () => {
      await inventoryTransferService.create(branchId, {
        ...input,
        idempotencyKey: request.current!.key,
      });
      setOpen(false);
      request.current = null;
    }, "Đã xuất hàng sang trạng thái đang vận chuyển.");
  };

  // Toggle unit selection for a draft line
  const handleToggleUnit = (
    line: DraftLine,
    unit: InventorySerialUnit,
    selectedCodes: string[]
  ) => {
    const code = getUnitCode(unit);
    const isSelected = isUnitSelected(unit, selectedCodes);
    let newCodes: string[];
    if (isSelected) {
      newCodes = selectedCodes.filter(
        (c) =>
          c !== code &&
          (!unit.serialNumber || c !== unit.serialNumber) &&
          (!unit.internalBarcode || c !== unit.internalBarcode)
      );
    } else {
      newCodes = [...selectedCodes, code];
    }
    const nextQty = newCodes.length > 0 ? String(newCodes.length) : line.quantity;
    setLines((items) =>
      items.map((item) =>
        item.key === line.key ? { ...item, codes: newCodes.join("\n"), quantity: nextQty } : item
      )
    );
  };

  // Quick select needed units
  const handleSelectQuick = (
    line: DraftLine,
    availableUnits: InventorySerialUnit[],
    selectedCodes: string[]
  ) => {
    const currentCount = selectedCodes.length;
    const targetCount = Number(line.quantity) || 1;
    const needed = Math.max(1, targetCount - currentCount);

    const unselectedUnits = availableUnits.filter((u) => !isUnitSelected(u, selectedCodes));
    const toAdd = unselectedUnits.slice(0, needed).map(getUnitCode);
    if (toAdd.length === 0) {
      toast.info("Không còn máy nào chưa chọn trong kho cho SKU này.");
      return;
    }
    const newCodes = [...selectedCodes, ...toAdd];
    setLines((items) =>
      items.map((item) =>
        item.key === line.key
          ? { ...item, codes: newCodes.join("\n"), quantity: String(newCodes.length) }
          : item
      )
    );
    toast.success(`Đã chọn thêm ${toAdd.length} máy.`);
  };

  // Clear all selected units for line
  const handleClearCodes = (line: DraftLine) => {
    setLines((items) =>
      items.map((item) => (item.key === line.key ? { ...item, codes: "" } : item))
    );
  };

  // Remove single selected unit
  const handleRemoveCode = (line: DraftLine, codeToRemove: string, selectedCodes: string[]) => {
    const newCodes = selectedCodes.filter((c) => c !== codeToRemove);
    const nextQty = newCodes.length > 0 ? String(newCodes.length) : line.quantity;
    setLines((items) =>
      items.map((item) =>
        item.key === line.key ? { ...item, codes: newCodes.join("\n"), quantity: nextQty } : item
      )
    );
  };

  // Stats calculation
  const stats = useMemo(() => {
    const inTransit = documents.filter((d) => d.status === "in_transit").length;
    const received = documents.filter((d) => d.status === "received").length;
    const cancelled = documents.filter((d) => d.status === "cancelled").length;
    return { inTransit, received, cancelled, total };
  }, [documents, total]);

  // Client search filtering
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase().trim();
    return documents.filter(
      (d) =>
        d.transferCode.toLowerCase().includes(q) ||
        d.fromWarehouseName?.toLowerCase().includes(q) ||
        d.toWarehouseName?.toLowerCase().includes(q) ||
        d.reason?.toLowerCase().includes(q) ||
        d.createdByName?.toLowerCase().includes(q)
    );
  }, [documents, searchQuery]);

  return (
    <section className="space-y-6" aria-label="Điều chuyển kho">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/50 to-cyan-50/30 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20">
              <ArrowLeftRight className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Điều chuyển kho
                </h2>
                <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-800">
                  {total} phiếu
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98 transition disabled:opacity-50"
              onClick={() => setRevision((v) => v + 1)}
              title="Làm mới danh sách"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-600" : ""}`} />
              <span>Làm mới</span>
            </button>

            {canManage && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-600/20 hover:from-cyan-500 hover:to-teal-500 active:scale-98 transition"
                onClick={handleOpenCreateModal}
              >
                <Plus className="h-4 w-4" />
                <span>Tạo phiếu điều chuyển</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI stats strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white/80 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Tổng phiếu</p>
              <p className="text-base font-bold text-slate-800">{total}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/40 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-amber-700">Đang chuyển</p>
              <p className="text-base font-bold text-amber-800">{stats.inTransit}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-700">Đã nhận hàng</p>
              <p className="text-base font-bold text-emerald-800">{stats.received}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50/60 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 text-slate-600">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Đã hủy</p>
              <p className="text-base font-bold text-slate-700">{stats.cancelled}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-2xs transition focus:border-cyan-500 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20"
            placeholder="Tìm theo mã phiếu, kho gửi/nhận, lý do, người tạo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Quick Select */}
          <div className="relative">
<StyledSelect appearance="erp" ariaLabel="Lọc trạng thái điều chuyển" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[{ value: "", label: "Tất cả trạng thái" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
          </div>
        </div>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-14 text-center shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
          <p role="status" className="mt-3 text-sm font-medium text-slate-600">
            Đang tải phiếu điều chuyển…
          </p>
        </div>
      ) : !filteredDocuments.length ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Boxes className="h-7 w-7" />
          </div>
          <p className="mt-3 text-base font-semibold text-slate-800">
            Chưa có phiếu điều chuyển phù hợp.
          </p>
          <p className="mt-1 text-sm text-slate-500 max-w-md">
            {searchQuery || status
              ? "Hãy thử thay đổi điều kiện tìm kiếm hoặc trạng thái lọc."
              : "Bấm 'Tạo phiếu điều chuyển' để bắt đầu chuyển hàng giữa các kho."}
          </p>
          {canManage && !searchQuery && !status && (
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-cyan-500 transition"
              onClick={handleOpenCreateModal}
            >
              <Plus className="h-4 w-4" />
              <span>Tạo phiếu điều chuyển mới</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => {
            const isSender = doc.fromBranchId === branchId;
            const isReceiver = doc.toBranchId === branchId;
            const isInTransit = doc.status === "in_transit";

            const statusBadgeConfig = {
              in_transit: {
                bg: "bg-amber-50 text-amber-700 border-amber-200",
                dot: "bg-amber-500",
                icon: <Truck className="h-3.5 w-3.5" />,
              },
              received: {
                bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
                dot: "bg-emerald-500",
                icon: <CheckCircle2 className="h-3.5 w-3.5" />,
              },
              cancelled: {
                bg: "bg-rose-50 text-rose-700 border-rose-200",
                dot: "bg-rose-500",
                icon: <XCircle className="h-3.5 w-3.5" />,
              },
            }[doc.status] || {
              bg: "bg-slate-100 text-slate-700 border-slate-200",
              dot: "bg-slate-400",
              icon: null,
            };

            return (
              <details
                key={doc._id}
                className="group rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-all hover:border-slate-300 open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 select-none">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm font-bold text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200">
                      {doc.transferCode}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeConfig.bg}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusBadgeConfig.dot}`} />
                      {statusLabels[doc.status] || doc.status}
                    </span>

                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <span className="font-semibold text-slate-900">{doc.fromWarehouseName}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-slate-900">{doc.toWarehouseName}</span>
                    </div>

                    <span className="text-xs text-slate-400 hidden sm:inline">
                      ({doc.items.length} mặt hàng)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {new Date(doc.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                  </div>
                </summary>

                <div className="border-t border-slate-100 p-4 pt-3 space-y-4">
                  {/* Meta Details */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50/80 p-3 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <span className="font-medium text-slate-500">Lý do: </span>
                        <span className="font-semibold text-slate-800">{doc.reason}</span>
                      </div>
                      <span className="text-slate-300">·</span>
                      <div>
                        <span className="font-medium text-slate-500">Người tạo: </span>
                        <span className="font-semibold text-slate-800">{doc.createdByName}</span>
                      </div>
                    </div>
                    <div className="text-slate-500">
                      {new Date(doc.createdAt).toLocaleString("vi-VN")}
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/90 text-xs font-semibold text-slate-600">
                        <tr>
                          <th className="px-3.5 py-2.5">SKU / sản phẩm</th>
                          <th className="px-3.5 py-2.5 text-right">Số lượng</th>
                          <th className="px-3.5 py-2.5 text-right">Giá vốn chuyển</th>
                          <th className="px-3.5 py-2.5">Mã máy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {doc.items.map((item) => (
                          <tr key={item.variantId} className="hover:bg-slate-50/50">
                            <td className="px-3.5 py-2.5">
                              <span className="font-mono font-semibold text-cyan-900">
                                {item.sku}
                              </span>
                              <span className="text-slate-600"> — {item.productName}</span>
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-semibold text-slate-800">
                              {item.quantity}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-medium text-slate-600">
                              {currency(item.unitCost)}
                            </td>
                            <td className="px-3.5 py-2.5 max-w-80 break-words text-xs text-slate-600 font-mono">
                              {item.unitIdentifiers && item.unitIdentifiers.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {item.unitIdentifiers.map((code, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 border border-slate-200"
                                    >
                                      {code}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Receipt & Cancellation Notes */}
                  {doc.receivedByName && (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>
                        Người nhận: <strong>{doc.receivedByName}</strong>
                        {doc.receivedAt && ` (${new Date(doc.receivedAt).toLocaleString("vi-VN")})`}
                      </span>
                    </div>
                  )}

                  {doc.cancelReason && (
                    <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-800 border border-rose-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>
                        Hủy bởi <strong>{doc.cancelledByName}</strong>: {doc.cancelReason}
                      </span>
                    </div>
                  )}

                  {/* Actions for in_transit status */}
                  {canManage && isInTransit && (
                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                      {isReceiver && (
                        <button
                          type="button"
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-500 active:scale-98 transition disabled:opacity-50"
                          onClick={() =>
                            void run(
                              () => inventoryTransferService.accept(branchId, doc._id),
                              "Đã nhận đủ hàng vào kho đích."
                            )
                          }
                        >
                          <Check className="h-4 w-4" />
                          <span>Nhận đủ nguyên phiếu</span>
                        </button>
                      )}

                      {isSender && (
                        <button
                          type="button"
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 active:scale-98 transition disabled:opacity-50"
                          onClick={() => {
                            setCancelId(doc._id);
                            setCancelReason("");
                          }}
                        >
                          <X className="h-4 w-4" />
                          <span>Hủy chuyển</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Cancel Form */}
                  {cancelId === doc._id && (
                    <form
                      className="mt-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3 space-y-2.5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(
                          () => inventoryTransferService.cancel(branchId, doc._id, cancelReason),
                          "Đã hoàn hàng về kho gửi."
                        );
                      }}
                    >
                      <p className="text-xs font-semibold text-rose-800">
                        Xác nhận hủy phiếu điều chuyển và hoàn trả số lượng về kho gửi:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <input
                          required
                          aria-label="Lý do hủy chuyển"
                          className="flex-1 min-w-[200px] rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
                          value={cancelReason}
                          onChange={(event) => setCancelReason(event.target.value)}
                          placeholder="Nhập lý do hủy chuyển..."
                        />
                        <button
                          type="submit"
                          disabled={busy}
                          className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-2xs hover:bg-rose-500 active:scale-98 transition disabled:opacity-50"
                        >
                          Xác nhận hủy
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                          onClick={() => setCancelId("")}
                        >
                          Đóng
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4 text-sm text-slate-600">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98 transition disabled:opacity-40"
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => value - 1)}
        >
          Trang trước
        </button>

        <span className="font-medium text-slate-700">
          Trang <span className="font-bold text-slate-900">{page}</span> /{" "}
          <span className="font-bold text-slate-900">{Math.max(1, Math.ceil(total / 20))}</span> ·{" "}
          <span className="font-bold text-cyan-800">{total}</span> phiếu
        </span>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98 transition disabled:opacity-40"
          disabled={page * 20 >= total || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Trang sau
        </button>
      </div>

      {/* ========================================================================= */}
      {/* POPUP MODAL: TẠO PHIẾU ĐIỀU CHUYỂN KHO                                   */}
      {/* ========================================================================= */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-modal-title"
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-cyan-50/40 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm shadow-cyan-600/20">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="transfer-modal-title" className="text-lg font-bold text-slate-900">
                    Tạo phiếu điều chuyển kho
                  </h3>
                  <p className="text-xs text-slate-500">
                    Xuất hàng từ kho gửi sang trạng thái đang vận chuyển
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                onClick={() => !busy && setOpen(false)}
                title="Đóng popup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body & Form */}
            <form
              aria-label="Tạo phiếu điều chuyển"
              onSubmit={submit}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <fieldset disabled={busy} className="space-y-5">
                  {/* Warehouse Selection */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Tuyến điều chuyển
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                      <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                        <span>Kho gửi</span>
<StyledSelect appearance="erp" required ariaLabel="Kho gửi" value={fromWarehouseId} onChange={(value) => { setFromWarehouseId(value); setLines([newLine()]); }} options={[{ value: "", label: "Chọn kho gửi" }, ...destinations.filter((item) => item.branchId === branchId).map((item) => ({ value: item._id, label: item.name }))]} />
                      </label>

                      <div className="hidden sm:flex items-center justify-center pt-5 text-slate-400">
                        <ArrowRight className="h-5 w-5" />
                      </div>

                      <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                        <span>Kho nhận</span>
<StyledSelect appearance="erp" required ariaLabel="Kho nhận" value={toWarehouseId} onChange={setToWarehouseId} options={[{ value: "", label: "Chọn kho nhận" }, ...destinations.filter((item) => item._id !== fromWarehouseId).map((item) => ({ value: item._id, label: item.branchName + " / " + item.name }))]} />
                      </label>
                    </div>
                  </div>

                  {/* Balances loading indicator */}
                  {balancesLoading && (
                    <div className="flex items-center gap-2 rounded-xl bg-cyan-50 p-3 text-xs font-medium text-cyan-800 border border-cyan-200">
                      <RefreshCw className="h-4 w-4 animate-spin text-cyan-600" />
                      <p role="status">Đang tải tồn kho gửi…</p>
                    </div>
                  )}

                  {/* Transfer Items Line List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Danh sách sản phẩm điều chuyển ({lines.length})
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-cyan-700 shadow-2xs hover:bg-slate-50 transition disabled:opacity-50"
                        disabled={lines.length >= 100 || !fromWarehouseId}
                        onClick={() => setLines((items) => [...items, newLine()])}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Thêm SKU</span>
                      </button>
                    </div>

                    {lines.map((line, index) => {
                      const balance = balances.find((item) => item.variantId === line.variantId);
                      const tracked = ["serial", "unit_barcode"].includes(
                        balance?.trackingMode || ""
                      );
                      const availableQty = balance
                        ? balance.quantity - balance.reservedQuantity
                        : 0;

                      const change = (patch: Partial<DraftLine>) =>
                        setLines((items) =>
                          items.map((item) =>
                            item.key === line.key ? { ...item, ...patch } : item
                          )
                        );

                      const selectedCodes = line.codes
                        .split(/[\s,;]+/)
                        .map((c) => c.trim())
                        .filter(Boolean);

                      // Serial cache for this line's SKU in fromWarehouseId
                      const cacheKey = balance ? `${fromWarehouseId}_${balance.sku}` : "";
                      const cacheEntry = cacheKey ? serialCache[cacheKey] : undefined;
                      const availableUnits = cacheEntry?.items || [];

                      const q = (unitSearchQuery[line.key] || "").toLowerCase().trim();
                      const filteredUnits = q
                        ? availableUnits.filter((u) => {
                          const sn = (u.serialNumber || "").toLowerCase();
                          const bc = (u.internalBarcode || "").toLowerCase();
                          return sn.includes(q) || bc.includes(q);
                        })
                        : availableUnits;

                      return (
                        <div
                          key={line.key}
                          className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 transition hover:border-slate-300"
                        >
                          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] items-start">
                            {/* SKU selector */}
                            <label className="block space-y-1 text-xs font-semibold text-slate-700">
                              <span>SKU {index + 1}</span>
<StyledSelect appearance="erp" required ariaLabel={`SKU ${index + 1}`} value={line.variantId} onChange={(value) => change({ variantId: value, codes: "" })} options={[{ value: "", label: "Chọn hàng" }, ...balances.filter((item) => !lines.some((other) => other.key !== line.key && other.variantId === item.variantId)).map((item) => ({ value: item.variantId || "", label: `${item.sku} — ${item.productName} (còn ${item.quantity - item.reservedQuantity})` }))]} />
                            </label>

                            {/* Quantity */}
                            <label className="block space-y-1 text-xs font-semibold text-slate-700">
                              <span className="flex items-center justify-between">
                                <span>Số lượng</span>
                                {balance && (
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    Tối đa: {availableQty}
                                  </span>
                                )}
                              </span>
                              <input
                                required
                                type="number"
                                min={tracked ? 1 : 0.000001}
                                step={tracked ? 1 : "any"}
                                max={balance ? availableQty : undefined}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-2xs transition focus:border-cyan-500 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20"
                                aria-label={`Số lượng ${index + 1}`}
                                value={line.quantity}
                                onChange={(event) => change({ quantity: event.target.value })}
                              />
                            </label>

                            {/* Delete Button */}
                            <div className="pt-5 flex items-center">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-2xs hover:bg-rose-50 active:scale-95 transition disabled:opacity-30"
                                aria-label={`Xóa dòng ${index + 1}`}
                                disabled={lines.length === 1}
                                onClick={() =>
                                  setLines((items) => items.filter((item) => item.key !== line.key))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Xóa</span>
                              </button>
                            </div>
                          </div>

                          {/* Serial / IMEI Selection per SKU */}
                          {tracked && (
                            <div className="mt-3 rounded-xl border border-cyan-200/80 bg-cyan-50/30 p-3.5 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Smartphone className="h-4 w-4 text-cyan-700" />
                                  <span className="text-xs font-bold text-slate-800">
                                    Chọn IMEI / Mã máy theo SKU từ kho
                                  </span>
                                  {balance && (
                                    <span className="rounded-md bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 font-mono">
                                      {balance.sku}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${selectedCodes.length === Number(line.quantity) &&
                                        selectedCodes.length > 0
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        : selectedCodes.length > Number(line.quantity)
                                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                                          : "bg-amber-100 text-amber-800 border border-amber-200"
                                      }`}
                                  >
                                    Đã chọn: {selectedCodes.length} / {line.quantity || 0} máy
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => setPickerLineIndex(index)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 bg-white px-2 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 transition shadow-2xs"
                                    title="Mở cửa sổ chọn chi tiết có tìm kiếm & quét mã"
                                  >
                                    <Search className="h-3 w-3" />
                                    <span>Cửa sổ chọn</span>
                                  </button>
                                </div>
                              </div>

                              {/* Search & Quick Pick Toolbar */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-cyan-100 text-xs">
                                <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
                                  <input
                                    type="text"
                                    placeholder="Lọc số IMEI khả dụng trong kho..."
                                    value={unitSearchQuery[line.key] || ""}
                                    onChange={(e) =>
                                      setUnitSearchQuery((prev) => ({
                                        ...prev,
                                        [line.key]: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-hidden"
                                  />
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={availableUnits.length === 0}
                                    onClick={() =>
                                      handleSelectQuick(line, availableUnits, selectedCodes)
                                    }
                                    className="rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 transition disabled:opacity-40"
                                  >
                                    Chọn nhanh {Math.max(1, Number(line.quantity) - selectedCodes.length)} máy
                                  </button>

                                  {selectedCodes.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleClearCodes(line)}
                                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                                    >
                                      Bỏ chọn
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Clickable Unit Chips Grid */}
                              <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2.5">
                                {cacheEntry?.loading ? (
                                  <div className="flex items-center justify-center gap-2 py-5 text-xs text-slate-500">
                                    <RefreshCw className="h-4 w-4 animate-spin text-cyan-600" />
                                    <span>Đang tải danh sách IMEI từ kho...</span>
                                  </div>
                                ) : availableUnits.length === 0 ? (
                                  <div className="py-3 text-center text-xs text-slate-500">
                                    Kho này hiện không có máy nào sẵn sàng để xuất cho SKU này.
                                  </div>
                                ) : filteredUnits.length === 0 ? (
                                  <div className="py-3 text-center text-xs text-slate-500">
                                    Không tìm thấy IMEI khớp với từ khóa tìm kiếm.
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {filteredUnits.map((unit) => {
                                      const code = getUnitCode(unit);
                                      const isSelected = isUnitSelected(unit, selectedCodes);
                                      return (
                                        <button
                                          key={unit._id || code}
                                          type="button"
                                          onClick={() =>
                                            handleToggleUnit(line, unit, selectedCodes)
                                          }
                                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition select-none cursor-pointer ${isSelected
                                              ? "border-cyan-600 bg-cyan-600 text-white font-bold shadow-2xs"
                                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/50"
                                            }`}
                                        >
                                          <span
                                            className={`h-2 w-2 rounded-full ${isSelected ? "bg-white" : "bg-slate-300"
                                              }`}
                                          />
                                          <span>{unit.serialNumber || code}</span>
                                          {unit.internalBarcode &&
                                            unit.internalBarcode !== unit.serialNumber && (
                                              <span
                                                className={`text-[10px] ${isSelected ? "text-cyan-100" : "text-slate-400"
                                                  }`}
                                              >
                                                ({unit.internalBarcode})
                                              </span>
                                            )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Selected Badges with Remove Button */}
                              {selectedCodes.length > 0 && (
                                <div className="space-y-1 pt-0.5">
                                  <div className="text-[11px] font-semibold text-slate-600">
                                    Máy đã chọn ({selectedCodes.length}):
                                  </div>
                                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                    {selectedCodes.map((code) => (
                                      <span
                                        key={code}
                                        className="inline-flex items-center gap-1 rounded-md bg-white border border-cyan-300 px-2 py-0.5 text-xs font-mono text-cyan-900 shadow-2xs"
                                      >
                                        <span>{code}</span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveCode(line, code, selectedCodes)
                                          }
                                          className="text-slate-400 hover:text-rose-600 transition"
                                          title="Bỏ máy này"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Manual input textarea for barcode scanner & typing */}
                              <div className="pt-1 border-t border-cyan-100">
                                <label className="block space-y-1 text-xs font-semibold text-slate-700">
                                  <div className="flex items-center justify-between text-slate-500 font-normal">
                                    <span>Mã máy {index + 1} (dán mã hoặc quét barcode):</span>
                                    <span className="text-[10px] italic">Tự động đồng bộ với danh sách chọn ở trên</span>
                                  </div>
                                  <textarea
                                    required
                                    rows={2}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-800 shadow-2xs transition placeholder:font-sans placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20"
                                    aria-label={`Mã máy ${index + 1}`}
                                    placeholder="Dán hoặc quét mã máy tại đây (mỗi mã 1 dòng hoặc cách nhau bởi dấu phẩy)"
                                    value={line.codes}
                                    onChange={(event) => change({ codes: event.target.value })}
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Transfer Reason */}
                  <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                    <span>Lý do điều chuyển</span>
                    <textarea
                      required
                      rows={2}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-2xs transition placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Ví dụ: Bổ sung hàng bán theo đơn khách, cân đối tồn kho chi nhánh..."
                    />
                  </label>
                </fieldset>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98 transition"
                  onClick={() => setOpen(false)}
                >
                  Đóng
                </button>

                <button
                  type="submit"
                  disabled={balancesLoading || busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-600/20 hover:from-cyan-500 hover:to-teal-500 active:scale-98 transition disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Đang gửi…</span>
                    </>
                  ) : (
                    <>
                      <Truck className="h-4 w-4" />
                      <span>Xuất chuyển kho</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OUTBOUND IMEI PICKER MODAL (Cửa sổ chọn chi tiết)                       */}
      {/* ========================================================================= */}
      {pickerLineIndex !== null && lines[pickerLineIndex] && (
        <OutboundImeiPickerModal
          isOpen={pickerLineIndex !== null}
          onClose={() => setPickerLineIndex(null)}
          warehouseId={fromWarehouseId}
          warehouseName={destinations.find((d) => d._id === fromWarehouseId)?.name}
          sku={balances.find((b) => b.variantId === lines[pickerLineIndex].variantId)?.sku || ""}
          productName={
            balances.find((b) => b.variantId === lines[pickerLineIndex].variantId)?.productName || ""
          }
          requiredCount={Number(lines[pickerLineIndex].quantity) || 1}
          initialSelectedIdentifiers={lines[pickerLineIndex].codes
            .split(/[\s,;]+/)
            .map((c) => c.trim())
            .filter(Boolean)}
          onConfirm={(selectedIdentifiers, selectedSerialNumbers) => {
            const codesToSet =
              selectedSerialNumbers.length > 0 ? selectedSerialNumbers : selectedIdentifiers;
            const targetLine = lines[pickerLineIndex];
            setLines((items) =>
              items.map((item) =>
                item.key === targetLine.key
                  ? {
                    ...item,
                    codes: codesToSet.join("\n"),
                    quantity: String(codesToSet.length || item.quantity),
                  }
                  : item
              )
            );
            setPickerLineIndex(null);
          }}
        />
      )}
    </section>
  );
}
