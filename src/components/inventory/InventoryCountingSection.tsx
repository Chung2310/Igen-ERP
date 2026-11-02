import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  inventoryCountService,
  type InventoryCount,
  type CountQueueScope,
  type CountItem,
} from "../../services/inventoryCountService";
import { toast } from "../../pages/Toast";
import { Dropdown } from "../common/Dropdown";
import { printInventoryCountVoucher } from "./printInventoryCountVoucher";
import { useAuth } from "../../context/AuthContext";
import { useBranchOptional } from "../../context/BranchContext";

import { InventoryCountPendingPanel } from "./InventoryCountPendingPanel";
import { useConfirmation } from "../../context/ConfirmationContext";

const BarcodeScannerDialog = React.lazy(() => import("./InventoryBarcodeScannerDialog"));

const number = (value: number) => Number(value || 0).toLocaleString("vi-VN");

const statusMap: Record<
  InventoryCount["status"],
  { label: string; className: string }
> = {
  draft: { label: "Bản nháp", className: "bg-slate-100 text-slate-700 border-slate-200" },
  counting: { label: "Đang kiểm đếm", className: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  pending_approval: { label: "Chờ duyệt cân bằng", className: "bg-amber-50 text-amber-800 border-amber-200" },
  completed: { label: "Đã cân bằng kho", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  cancelled: { label: "Đã hủy phiếu", className: "bg-rose-50 text-rose-700 border-rose-200" },
  conflict: { label: "Xung đột tồn kho", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

type CountingProps = { warehouseId: string; warehouseName?: string; onClose: () => void; onApplied?: () => void };
export function InventoryCountingModal(props: CountingProps) {
  const { user, userProfile } = useAuth();
  const branch = useBranchOptional();
  const companyCode = userProfile?.companyCode?.trim().toUpperCase() || "";
  const branchId = branch?.activeBranchId || userProfile?.branchId || "";
  const userId = String((user as any)?.id || (user as any)?._id || user?.uid || "");
  const identity = JSON.stringify([companyCode, branchId, userId, props.warehouseId]);
  const current = useRef(identity);
  current.current = identity;
  const scope = useMemo(() => {
    const sessionToken = localStorage.getItem("accessToken");
    return { companyCode, branchId, userId, isCurrent: () => current.current === identity && localStorage.getItem("accessToken") === sessionToken };
  }, [identity]);
  return <InventoryCountingContent key={identity} {...props} queueScope={scope} />;
}

function InventoryCountingContent({
  warehouseId,
  warehouseName,
  onClose,
  onApplied,
  queueScope,
}: {
  queueScope: CountQueueScope;
  warehouseId: string;
  warehouseName?: string;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const { user, hasPermission } = useAuth();
  const requestConfirmation = useConfirmation();
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const isCurrent = () => alive.current && queueScope.isCurrent?.() !== false;
  const scopedQueue = { ...queueScope, isCurrent };
  const actorId = String((user as any)?.id || (user as any)?._id || user?.uid || "");
  const [count, setCount] = useState<InventoryCount | null>(null);
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [camera, setCamera] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [discrepancyConfirmed, setDiscrepancyConfirmed] = useState(false);
  const [scanResolutions, setScanResolutions] = useState<Record<string, string>>({});
  useEffect(() => { setApprovalReason(""); setDiscrepancyConfirmed(false); setScanResolutions({}); }, [count?._id, count?.version]);
  const missingMachines = (count?.items || []).flatMap((item) => (item.expectedUnits || []).filter((unit) => !(item.scannedUnitIds || []).includes(unit.serialUnitId)));
  const discrepancyItems = (count?.items || []).filter((item) => item.quantityDelta !== 0);
  const needsConfirmation = missingMachines.length > 0 || discrepancyItems.length > 0;
  const reviewReady = (!needsConfirmation || (discrepancyConfirmed && Boolean(approvalReason.trim()))) && (count?.unexpectedScans || []).every((scan) => Boolean(scanResolutions[scan.code]?.trim()));
  const canApprove = Boolean(actorId && count?.createdById && (!count.submittedBy || count.submittedById) && actorId !== count.createdById && actorId !== count.submittedById && hasPermission("inventory-count-approval:manage"));

  const listRequest = useRef(0);
  // Load existing counts for this warehouse
  const loadCounts = async () => {
    if (!warehouseId) return;
    const request = ++listRequest.current;
    try {
      const list = await inventoryCountService.list(warehouseId);
      if (!isCurrent() || request !== listRequest.current) return;
      setCounts(current => list.map(item => { const existing = current.find(c => c._id === item._id); return existing && existing.version > item.version ? existing : item; }));
      setCount(current => {
        if (!current) return list.find(c => c.status === "counting" || c.status === "draft") || list[0] || null;
        const latest = list.find(c => c._id === current._id);
        return latest && latest.version > current.version ? latest : current;
      });
    } catch {
      // Ignore initial list error
    }
  };

  useEffect(() => {
    void loadCounts();
  }, [warehouseId]);

  useEffect(() => {
    const sync = () => void inventoryCountService.syncPending(scopedQueue).then(({ remaining, legacy }) => {
      if (!isCurrent()) return;
      void loadCounts();
      if (legacy) toast.error("Có dữ liệu kiểm kê cũ chưa rõ tài khoản/chi nhánh. Dữ liệu được giữ nguyên, cần đối chiếu riêng.");
      if (remaining) toast.error("Có số lượng kiểm kê chưa đồng bộ. Hãy mở phiếu, tải lại và đối chiếu trước khi lưu.");
    }).catch((error) => { if (isCurrent()) toast.error(error?.message || "Không thể đồng bộ số lượng kiểm kê."); });
    const reconciled = () => { if (isCurrent()) void loadCounts(); };
    window.addEventListener("inventory-count-reconciled", reconciled);
    window.addEventListener("online", sync);
    sync();
    return () => { window.removeEventListener("online", sync); window.removeEventListener("inventory-count-reconciled", reconciled); };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Create new count
  const handleCreate = async () => {
    try {
      setProcessingAction("create");
      const next = await inventoryCountService.create(warehouseId);
      if (!isCurrent()) return;
      setCount(next);
      setCounts((current) => [next, ...current]);
      toast.success(`Đã tạo phiếu kiểm kê mới: ${next.countCode}`);
    } catch (error: any) {
      if (!isCurrent()) return;
      toast.error(error?.message || "Không thể tạo phiếu kiểm kê.");
    } finally {
      setProcessingAction(null);
    }
  };

  // Scan single barcode or IMEI
  const handleScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || !count) return;
    setScanning(true);
    try {
      const result = await inventoryCountService.scan(count._id, trimmed);
      if (!isCurrent()) return;
      setCount(result.count);
      setCounts((curr) => curr.map((c) => (c._id === result.count._id ? result.count : c)));

      if (result.outcome === "counted") {
        toast.success(`Đã đếm: ${result.productName || trimmed}`);
      } else if (result.outcome === "duplicate") {
        toast.info(`Mã ${trimmed} đã được đếm trước đó.`);
      } else if (result.outcome === "unexpected") {
        const reasonText =
          result.reason === "other_warehouse"
            ? "thuộc kho khác"
            : result.reason === "sold"
            ? "máy đã bán"
            : result.reason === "wrong_status"
            ? "trạng thái không hợp lệ"
            : "không có trong tồn sổ sách";
        toast.error(`Mã ${trimmed} cảnh báo ngoài dự kiến: ${reasonText}!`);
      }
      setBarcodeInput("");
    } catch (error: any) {
      if (!isCurrent()) return;
      toast.error(error?.message || "Không thể quét mã kiểm kê.");
    } finally {
      setScanning(false);
    }
  };

  // Scan all remaining IMEIs for a SKU (Quality of Life feature)
  const handleScanAllRemainingForSku = async (item: CountItem) => {
    if (!count) return;
    const scannedSet = new Set(item.scannedUnitIds || []);
    const remainingUnits = (item.expectedUnits || []).filter(
      (u) => !scannedSet.has(u.serialUnitId)
    );

    if (remainingUnits.length === 0) {
      toast.info("Tất cả máy của SKU này đã được đếm đủ.");
      return;
    }

    setProcessingAction(`sku-all-${item._id}`);
    try {
      let latestCount = count;
      let countSuccess = 0;

      for (const unit of remainingUnits) {
        const codeToScan = unit.serialNumber || unit.internalBarcode;
        if (codeToScan) {
          const result = await inventoryCountService.scan(count._id, codeToScan);
          if (!isCurrent()) return;
          latestCount = result.count;
          countSuccess++;
        }
      }

      setCount(latestCount);
      setCounts((curr) => curr.map((c) => (c._id === latestCount._id ? latestCount : c)));
      toast.success(`Đã tự động đếm đủ ${countSuccess} máy cho SKU ${item.sku}!`);
    } catch (error: any) {
      if (!isCurrent()) return;
      toast.error(error?.message || "Lỗi khi đếm hàng loạt.");
    } finally {
      setProcessingAction(null);
    }
  };

  // State transitions: start -> submit -> approve -> cancel
  const handleTransition = async (action: "start" | "submit" | "approve" | "cancel") => {
    if (!count) return;

    if (action === "approve") {
      if (!canApprove) { toast.error("Cần người duyệt độc lập có quyền duyệt kiểm kê."); return; }
      if (!reviewReady) { toast.error("Hãy xác nhận chênh lệch và đối chiếu đủ các mã ngoài dự kiến."); return; }
      const confirmApprove = await requestConfirmation({
        title: "Xác nhận cân bằng tồn kho?",
        description: `Phiếu ${count.countCode} sẽ được duyệt. Tồn kho thực tế sẽ được tự động điều chỉnh theo số lượng đã đếm. Các máy IMEI không tìm thấy sẽ được ghi nhận thất lạc.`,
        confirmLabel: "Duyệt và cân bằng",
        tone: "danger",
      });
      if (!confirmApprove) return;
    } else if (action === "cancel") {
      const confirmCancel = await requestConfirmation({ title: "Hủy phiếu kiểm kê?", description: `Bạn có chắc chắn muốn hủy phiếu kiểm kê ${count.countCode}?`, confirmLabel: "Hủy phiếu", tone: "danger" });
      if (!confirmCancel) return;
    }

    setProcessingAction(action);
    try {
      const next = action === "approve"
        ? await inventoryCountService.approve(count._id, { expectedVersion: count.version, discrepancyConfirmed, reason: approvalReason.trim(), unexpectedScanResolutions: (count.unexpectedScans || []).map((scan) => ({ code: scan.code, reason: scanResolutions[scan.code]?.trim() || "" })) })
        : await inventoryCountService[action](count._id);
      if (!isCurrent()) return;
      setCount(next);
      setCounts((current) => current.map((c) => (c._id === next._id ? next : c)));

      const labels = {
        start: "Đã bắt đầu kiểm đếm phiếu",
        submit: "Đã gửi phiếu chờ duyệt cân bằng",
        approve: "Đã duyệt và cân bằng tồn kho thực tế thành công",
        cancel: "Đã hủy phiếu kiểm kê",
      };
      toast.success(`${labels[action]}: ${next.countCode}`);

      if (action === "approve") {
        onApplied?.();
      }
    } catch (error: any) {
      if (!isCurrent()) return;
      toast.error(error?.message || "Không thể thực hiện thao tác kiểm kê.");
      if (action === "approve" && (error?.status === 409 || error?.statusCode === 409)) {
        try {
          const latest = await inventoryCountService.get(count._id);
          if (!isCurrent()) return;
          setCount(latest);
          setCounts((current) => current.map((item) => item._id === latest._id ? latest : item));
        } catch { /* Keep the existing document visible if refresh fails. */ }
      }
    } finally {
      setProcessingAction(null);
    }
  };

  // Update quantity for non-unit-tracked items
  const openCountReference = async (id: string) => {
    setProcessingAction("open-reference");
    try { const latest = await inventoryCountService.get(id); if (isCurrent()) setCount(latest); }
    catch (error: any) { if (!isCurrent()) return; toast.error(error?.message || "Không thể mở phiếu liên quan."); }
    finally { setProcessingAction(null); }
  };

  const handleRecreate = async () => {
    if (!count || count.status !== "conflict" || !hasPermission("inventory:manage")) return;
    if (!await requestConfirmation({ title: "Tạo phiếu kiểm kê thay thế?", description: "Phiếu mới dùng tồn hiện tại. Bạn cần nhập lại số đếm và quét lại từng máy; phiếu cũ được giữ nguyên để đối chiếu.", confirmLabel: "Tạo phiếu mới", tone: "warning" })) return;
    setProcessingAction("recreate");
    try {
      const next = await inventoryCountService.recreate(count._id);
      if (!isCurrent()) return;
      setCounts((current) => [next, ...current.filter((item) => item._id !== next._id).map((item) => item._id === count._id ? { ...item, replacementCountId: next._id } : item)]);
      setCount(next);
      toast.success("Đã mở phiếu thay thế. Hãy kiểm đếm lại theo tồn hiện tại.");
    } catch (error: any) { if (!isCurrent()) return; toast.error(error?.message || "Không thể tạo lại phiếu kiểm kê."); }
    finally { setProcessingAction(null); }
  };

  // Update quantity for non-unit-tracked items
  const handleUpdateQuantityItem = async (itemId: string, newQuantity: number) => {
    if (!count) return;
    const safeQty = Math.max(0, newQuantity);
    try {
      const next = await inventoryCountService.updateItem(count._id, itemId, safeQty, count.version, scopedQueue);
      if (!isCurrent()) return;
      setCount(next);
      setCounts((curr) => curr.map((c) => (c._id === next._id ? next : c)));
    } catch (error: any) {
      if (!isCurrent()) return;
      toast.error(error?.message || "Không thể lưu số lượng.");
    }
  };

  const handleReload = async () => {
    if (!count || !await requestConfirmation({ title: "Tải lại phiếu kiểm kê?", description: "Các số lượng chưa lưu và bản chờ đồng bộ của phiếu này sẽ bị bỏ. Bạn đã ghi lại số cần đối chiếu chưa?", confirmLabel: "Tải lại phiếu", tone: "warning" })) return;
    setProcessingAction("reload");
    try {
      const latest = await inventoryCountService.reload(count._id, scopedQueue);
      if (!isCurrent()) return;
      setCount(latest);
      setCounts((current) => current.map((item) => item._id === latest._id ? latest : item));
    } catch (error: any) { if (!isCurrent()) return; toast.error(error?.message || "Không thể tải lại phiếu kiểm kê."); }
    finally { setProcessingAction(null); }
  };

  // Copy helper
  const copyText = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép ${label}!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Print voucher
  const handlePrint = () => {
    if (!count) return;
    printInventoryCountVoucher({
      count,
      warehouseName,
    });
  };

  // Toggle drawer for SKU items
  const toggleItemDrawer = (id: string) => {
    setExpandedItems((curr) => ({ ...curr, [id]: !curr[id] }));
  };

  // Discrepancy calculations
  const totalSystemQty = count?.items.reduce((s, i) => s + i.systemQuantity, 0) || 0;
  const totalCountedQty = count?.items.reduce((s, i) => s + i.countedQuantity, 0) || 0;
  const discrepancy = count?.items.reduce((total, item) => total + item.quantityDelta, 0) || 0;
  const matched = count?.items.filter((item) => item.quantityDelta === 0).length || 0;
  const shortages = count?.items.filter((item) => item.quantityDelta < 0).length || 0;
  const surpluses = count?.items.filter((item) => item.quantityDelta > 0).length || 0;

  const statusInfo = count ? statusMap[count.status] || { label: count.status, className: "bg-slate-100 text-slate-700" } : null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-count-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 1. Modal Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 id="inventory-count-title" className="text-base font-bold text-slate-900 tracking-tight">
                Kiểm kê kho hàng
              </h3>
              {warehouseName && (
                <span className="font-semibold text-xs text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                  {warehouseName}
                </span>
              )}
              {statusInfo && (
                <span className={`font-semibold text-xs px-2.5 py-0.5 rounded-full border ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-slate-500 font-medium">
              Đối soát tồn kho sổ sách với số lượng máy và IMEI thực tế tại kho.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {count && <button type="button" disabled={Boolean(processingAction) || scanning} onClick={() => void handleReload()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">Tải lại phiếu</button>}
            {count && (
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs whitespace-nowrap"
              >
                In biên bản kiểm kê
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-sm font-bold leading-none ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 2. Top Document Select Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!warehouseId || processingAction === "create"}
              onClick={() => void handleCreate()}
              className="rounded-lg bg-cyan-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-cyan-800 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {processingAction === "create" ? "Đang tạo..." : "+ Tạo phiếu kiểm kê"}
            </button>

            {counts.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                  Phiếu:
                </span>
                <Dropdown<string>
                  aria-label="Chọn phiếu kiểm kê đã tạo"
                  value={count?._id || ""}
                  onChange={(val) => {
                    const selected = counts.find((item) => item._id === val);
                    setCount(selected || null);
                  }}
                  options={counts.map((item) => ({
                    value: item._id,
                    label: item.countCode,
                    sublabel: statusMap[item.status]?.label || item.status,
                  }))}
                  placeholder="Chọn phiếu..."
                  variant="default"
                  size="sm"
                  triggerClassName="min-w-[170px] max-w-[240px] justify-between font-bold text-slate-800 border-slate-200 shadow-2xs rounded-lg py-1"
                />
              </div>
            )}
          </div>

          {count && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Mã phiếu:</span>
              <button
                type="button"
                onClick={() => copyText(count.countCode, "code", "Mã phiếu")}
                className="font-mono text-xs font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 hover:bg-cyan-100 transition-colors"
                title="Bấm để sao chép mã phiếu"
              >
                {copiedKey === "code" ? "Đã chép" : count.countCode}
              </button>
            </div>
          )}
        </div>

        {/* 3. Modal Body Container */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <InventoryCountPendingPanel scope={scopedQueue} />
          {!count ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 bg-slate-50/50">
              <p className="font-semibold text-slate-800 text-sm">Chưa có phiếu kiểm kê nào được chọn</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Bấm vào nút <strong>"+ Tạo phiếu kiểm kê"</strong> ở trên để tạo một đợt kiểm kho mới, hoặc chọn phiếu đã tạo từ danh sách.
              </p>
            </div>
          ) : (
            <>
              {/* Stepper Workflow Strip */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold select-none">
                <div className={`p-2 rounded-lg border ${
                  count.status === "draft"
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}>
                  <span className="block text-[10px] text-slate-400">Bước 1</span>
                  1. Lập phiếu nháp
                </div>

                <div className={`p-2 rounded-lg border ${
                  count.status === "counting"
                    ? "bg-cyan-700 text-white border-cyan-700 shadow-2xs"
                    : count.status === "draft"
                    ? "bg-slate-50 text-slate-400 border-slate-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}>
                  <span className="block text-[10px] text-cyan-200">Bước 2</span>
                  2. Quét kiểm đếm
                </div>

                <div className={`p-2 rounded-lg border ${
                  count.status === "pending_approval"
                    ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                    : count.status === "completed"
                    ? "bg-slate-100 text-slate-600 border-slate-200"
                    : "bg-slate-50 text-slate-400 border-slate-200"
                }`}>
                  <span className="block text-[10px] text-amber-200">Bước 3</span>
                  3. Gửi chờ duyệt
                </div>

                <div className={`p-2 rounded-lg border ${
                  count.status === "completed"
                    ? "bg-emerald-700 text-white border-emerald-700 shadow-2xs"
                    : "bg-slate-50 text-slate-400 border-slate-200"
                }`}>
                  <span className="block text-[10px] text-emerald-200">Bước 4</span>
                  4. Cân bằng kho
                </div>
              </div>

              {/* 4 Balanced KPI Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Quy mô kiểm kê
                  </span>
                  <p className="mt-1 text-xl font-extrabold text-slate-900 tabular-nums">
                    {count.items.length} <span className="text-xs font-semibold text-slate-500">mặt hàng</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sổ sách: <b>{number(totalSystemQty)}</b> · Đã đếm: <b>{number(totalCountedQty)}</b>
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                    Khớp số lượng
                  </span>
                  <p className="mt-1 text-xl font-extrabold text-emerald-700 tabular-nums">
                    {matched} <span className="text-xs font-semibold text-emerald-600">SKU</span>
                  </p>
                  <p className="text-[11px] text-emerald-700/80 mt-0.5">
                    Số lượng thực tế khớp 100%
                  </p>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">
                    Thiếu hàng
                  </span>
                  <p className="mt-1 text-xl font-extrabold text-rose-700 tabular-nums">
                    {shortages} <span className="text-xs font-semibold text-rose-600">SKU</span>
                  </p>
                  <p className="text-[11px] text-rose-700/80 mt-0.5">
                    Thực tế ít hơn sổ sách
                  </p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                    Thừa hàng
                  </span>
                  <p className="mt-1 text-xl font-extrabold text-amber-700 tabular-nums">
                    {surpluses} <span className="text-xs font-semibold text-amber-600">SKU</span>
                  </p>
                  <p className="text-[11px] text-amber-700/80 mt-0.5">
                    Thực tế nhiều hơn sổ sách
                  </p>
                </div>
              </div>

              {/* Barcode & IMEI Scanner Toolbar */}
              {(count.status === "draft" || count.status === "counting") && (
                <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      autoFocus
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleScan(barcodeInput);
                        }
                      }}
                      placeholder="Quét mã vạch, số IMEI hoặc mã nội bộ rồi bấm Enter..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                    />
                    {barcodeInput && (
                      <button
                        type="button"
                        onClick={() => setBarcodeInput("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={scanning || !barcodeInput.trim()}
                      onClick={() => void handleScan(barcodeInput)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-2xs disabled:opacity-50 whitespace-nowrap"
                    >
                      {scanning ? "Đang xử lý..." : "Quét mã"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setCamera(true)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs whitespace-nowrap"
                    >
                      Quét Camera
                    </button>
                  </div>
                </div>
              )}

              {/* Unexpected Scans Banner (if any) */}
              {count.unexpectedScans && count.unexpectedScans.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-900 uppercase tracking-wide">
                      Cảnh báo: Phát hiện {count.unexpectedScans.length} mã quét ngoài dự kiến
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1">
                    Các mã máy này không thuộc danh sách tồn sổ sách của kho hiện tại:
                  </p>

                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {count.unexpectedScans.map((scan, sIdx) => {
                      const reasonText =
                        scan.reason === "other_warehouse"
                          ? "Kho khác"
                          : scan.reason === "sold"
                          ? "Đã bán"
                          : scan.reason === "wrong_status"
                          ? "Sai trạng thái"
                          : "Không xác định";
                      return (
                        <div
                          key={sIdx}
                          className="rounded border border-amber-200 bg-white p-2 font-mono text-[11px] text-slate-800"
                        >
                          <div className="font-bold">{scan.code}</div>
                          <div className="text-[10px] text-rose-700 font-sans font-semibold mt-0.5">
                            Lý do: {reasonText}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Items Counting Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[840px] text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="w-10 px-3 py-3 text-center">#</th>
                        <th className="w-[32%] px-4 py-3">Sản phẩm & Biến thể SKU</th>
                        <th className="w-[14%] px-4 py-3 text-center">Hình thức</th>
                        <th className="w-[12%] px-4 py-3 text-right">Sổ sách</th>
                        <th className="w-[16%] px-4 py-3 text-right">Đã đếm</th>
                        <th className="w-[12%] px-4 py-3 text-right">Chênh lệch</th>
                        <th className="w-[14%] px-4 py-3 text-center">Thao tác</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {count.items.map((item, index) => {
                        const isUnitTracked = item.trackingMode === "serial" || item.trackingMode === "unit_barcode";
                        const isExpanded = Boolean(expandedItems[item._id]);
                        const isMatched = item.quantityDelta === 0;
                        const isShortage = item.quantityDelta < 0;
                        const scannedIds = new Set(item.scannedUnitIds || []);
                        const expectedList = item.expectedUnits || [];

                        return (
                          <React.Fragment key={item._id}>
                            <tr className="hover:bg-slate-50/80 transition-colors">
                              {/* STT */}
                              <td className="px-3 py-3 text-center font-medium text-slate-400">
                                {index + 1}
                              </td>

                              {/* Product & SKU */}
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-900 text-xs">
                                  {item.productName}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[11px] font-semibold text-slate-600">
                                    {item.sku}
                                  </span>
                                  {item.barcode && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      · {item.barcode}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Tracking Mode */}
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border ${
                                  isUnitTracked
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}>
                                  {item.trackingMode === "serial"
                                    ? "IMEI / Serial"
                                    : item.trackingMode === "unit_barcode"
                                    ? "Mã vạch đơn vị"
                                    : "Số lượng"}
                                </span>
                              </td>

                              {/* System Quantity */}
                              <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                                {number(item.systemQuantity)} máy
                              </td>

                              {/* Counted Quantity */}
                              <td className="px-4 py-3 text-right">
                                {isUnitTracked ? (
                                  <div className="font-bold text-xs tabular-nums text-slate-900">
                                    {number(item.countedQuantity)} / {item.systemQuantity} máy
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      disabled={count.status !== "draft" && count.status !== "counting"}
                                      value={item.countedQuantity}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setCount((curr) =>
                                          curr
                                            ? {
                                                ...curr,
                                                items: curr.items.map((line) =>
                                                  line._id === item._id
                                                    ? {
                                                        ...line,
                                                        countedQuantity: val,
                                                        quantityDelta: val - line.systemQuantity,
                                                      }
                                                    : line
                                                ),
                                              }
                                            : curr
                                        );
                                      }}
                                      onBlur={() => {
                                        void handleUpdateQuantityItem(item._id, item.countedQuantity);
                                      }}
                                      className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs font-bold text-slate-900 outline-none focus:border-cyan-600 disabled:bg-slate-100"
                                    />
                                    <span className="text-[11px] text-slate-500">máy</span>
                                  </div>
                                )}
                              </td>

                              {/* Delta */}
                              <td className="px-4 py-3 text-right font-bold tabular-nums">
                                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                  isMatched
                                    ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                                    : isShortage
                                    ? "text-rose-700 bg-rose-50 border border-rose-200"
                                    : "text-amber-800 bg-amber-50 border border-amber-200"
                                }`}>
                                  {item.quantityDelta > 0 ? `+${item.quantityDelta}` : item.quantityDelta}
                                </span>
                              </td>

                              {/* Action */}
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {isUnitTracked ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => toggleItemDrawer(item._id)}
                                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs whitespace-nowrap"
                                      >
                                        {isExpanded ? "Đóng IMEI" : `Xem IMEI (${item.countedQuantity}/${item.systemQuantity})`}
                                      </button>

                                      {(count.status === "draft" || count.status === "counting") && item.countedQuantity < item.systemQuantity && (
                                        <button
                                          type="button"
                                          disabled={processingAction === `sku-all-${item._id}`}
                                          onClick={() => void handleScanAllRemainingForSku(item)}
                                          className="rounded border border-cyan-700 bg-cyan-50 px-2 py-1 text-[10px] font-bold text-cyan-800 hover:bg-cyan-100 transition-colors shadow-2xs whitespace-nowrap"
                                          title="Đánh dấu tất cả máy của SKU này là đã đếm đủ"
                                        >
                                          {processingAction === `sku-all-${item._id}` ? "Đang xử lý..." : "Đếm đủ"}
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    (count.status === "draft" || count.status === "counting") && (
                                      <button
                                        type="button"
                                        onClick={() => void handleUpdateQuantityItem(item._id, item.systemQuantity)}
                                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                                        title="Gán số lượng thực tế bằng sổ sách"
                                      >
                                        Khớp tồn
                                      </button>
                                    )
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expandable IMEI Audit Drawer for Serial-tracked item */}
                            {isUnitTracked && isExpanded && (
                              <tr className="bg-slate-50/90 border-t border-slate-200">
                                <td colSpan={7} className="p-4 pl-12">
                                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-800">
                                        Đối soát chi tiết {expectedList.length} mã IMEI của SKU {item.sku}:
                                      </span>
                                      <span className="text-xs text-slate-500 font-medium">
                                        Đã tìm thấy: <b className="text-emerald-700">{scannedIds.size}</b> / <b>{expectedList.length} máy</b>
                                      </span>
                                    </div>

                                    {expectedList.length === 0 ? (
                                      <p className="text-xs text-slate-400 italic">
                                        Chưa có danh sách IMEI lưu trong hệ thống cho dòng này.
                                      </p>
                                    ) : (
                                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 pt-1">
                                        {expectedList.map((unit, uIdx) => {
                                          const isScanned = scannedIds.has(unit.serialUnitId);
                                          const codeVal = unit.serialNumber || unit.internalBarcode || "—";

                                          return (
                                            <div
                                              key={unit.serialUnitId || uIdx}
                                              onClick={() => {
                                                if (!isScanned && (count.status === "draft" || count.status === "counting")) {
                                                  void handleScan(codeVal);
                                                }
                                              }}
                                              className={`flex items-center justify-between rounded p-2 border font-mono text-[11px] transition-colors select-none ${
                                                isScanned
                                                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                                                  : "bg-slate-50 border-slate-200 text-slate-700 hover:border-cyan-500 hover:bg-cyan-50 cursor-pointer"
                                              }`}
                                              title={
                                                isScanned
                                                  ? "Đã quét tìm thấy mã này"
                                                  : "Chưa quét - Bấm vào để đánh dấu đã thấy"
                                              }
                                            >
                                              <span className="truncate">
                                                <span className="text-slate-400 font-sans mr-1">#{uIdx + 1}</span>
                                                <b>{codeVal}</b>
                                              </span>

                                              <span className={`text-[10px] font-sans font-bold px-1.5 py-0.2 rounded ml-1 ${
                                                isScanned
                                                  ? "bg-emerald-200 text-emerald-900"
                                                  : "bg-slate-200 text-slate-600"
                                              }`}>
                                                {isScanned ? "Đã thấy" : "Chưa"}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 4. Modal Footer & Workflow Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="text-xs text-slate-600 font-medium">
            {count && (
              <>
                Tổng chênh lệch kiểm đếm:{" "}
                <strong className={`font-bold tabular-nums text-sm ${
                  discrepancy === 0
                    ? "text-emerald-700"
                    : discrepancy < 0
                    ? "text-rose-700"
                    : "text-amber-700"
                }`}>
                  {discrepancy > 0 ? `+${discrepancy}` : discrepancy} máy
                </strong>{" "}
                ({matched} khớp, {shortages} thiếu, {surpluses} thừa)
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Step 1 Actions */}
            {count?.status === "draft" && (
              <>
                <button
                  type="button"
                  disabled={processingAction === "start"}
                  onClick={() => void handleTransition("start")}
                  className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-cyan-800 transition-colors disabled:opacity-50"
                >
                  {processingAction === "start" ? "Đang xử lý..." : "Bắt đầu đếm hàng"}
                </button>

                <button
                  type="button"
                  disabled={processingAction === "cancel"}
                  onClick={() => void handleTransition("cancel")}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
                >
                  Hủy phiếu
                </button>
              </>
            )}

            {/* Step 2 Actions */}
            {count?.status === "counting" && (
              <>
                <button
                  type="button"
                  disabled={processingAction === "submit"}
                  onClick={() => void handleTransition("submit")}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {processingAction === "submit" ? "Đang gửi..." : "Gửi chờ duyệt cân bằng"}
                </button>

                <button
                  type="button"
                  disabled={processingAction === "cancel"}
                  onClick={() => void handleTransition("cancel")}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
                >
                  Hủy phiếu
                </button>
              </>
            )}

            {/* Step 3 Actions */}
            {count?.approvalReview && <div className="w-full rounded border p-3 text-xs">
              <p className="font-semibold">Kết quả đối chiếu đã lưu khi duyệt</p>
              {count.approvalReview.reason && <p>{count.approvalReview.reason}</p>}
              {count.approvalReview.unexpectedScanResolutions.map((entry) => <p key={entry.code}>{entry.code}: {entry.reason}</p>)}
            </div>}
            {count?.status === "pending_approval" && <div className="w-full space-y-2 rounded border border-amber-300 p-3 text-xs">
              <p className="font-semibold">Đối chiếu trước khi duyệt: {discrepancyItems.length} dòng chênh lệch; {missingMachines.length} máy chưa quét.</p>
              {discrepancyItems.map((item) => <p key={item._id}>{item.sku}: sổ sách {number(item.systemQuantity)}, đã đếm {number(item.countedQuantity)}, chênh lệch {number(item.quantityDelta)}.</p>)}
              {missingMachines.length > 0 && <p>Máy sẽ ghi nhận thất lạc: {missingMachines.map((unit) => unit.serialNumber || unit.internalBarcode || unit.serialUnitId).join(", ")}.</p>}
              {needsConfirmation && <>
                <label className="block">Lý do chênh lệch<textarea maxLength={2000} disabled={Boolean(processingAction)} value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} className="block w-full rounded border p-2" /></label>
                <label className="block"><input type="checkbox" checked={discrepancyConfirmed} disabled={Boolean(processingAction)} onChange={(event) => setDiscrepancyConfirmed(event.target.checked)} /> Tôi đã đối chiếu số lượng và danh sách máy chưa quét, đồng ý điều chỉnh như trên.</label>
              </>}
              {(count.unexpectedScans || []).map((scan) => <label className="block" key={scan.code}>Kết quả đối chiếu mã ngoài dự kiến {scan.code}
                <textarea maxLength={2000} disabled={Boolean(processingAction)} value={scanResolutions[scan.code] || ""} onChange={(event) => setScanResolutions((current) => ({ ...current, [scan.code]: event.target.value }))} className="block w-full rounded border p-2" />
              </label>)}
              {(count.unexpectedScans || []).length > 0 && <p>Các mã ngoài dự kiến không được cộng vào tồn qua phiếu này. Ghi rõ kết quả đối chiếu và chứng từ xử lý liên quan trước khi duyệt.</p>}
            </div>}
            {count?.recreatedFromId && <button type="button" disabled={Boolean(processingAction)} onClick={() => void openCountReference(count.recreatedFromId!)} className="rounded border px-3 py-2 text-xs">Xem phiếu xung đột gốc</button>}
            {count?.status === "conflict" && <div className="space-y-2 text-xs text-rose-800">
              <p>Tồn kho đã thay đổi so với lúc chốt phiếu. Cần tạo phiếu mới và kiểm đếm lại; phiếu này được giữ để đối chiếu.</p>
              {count.replacementCountId
                ? <button type="button" disabled={Boolean(processingAction)} onClick={() => void openCountReference(count.replacementCountId!)} className="rounded border px-3 py-2">Mở phiếu đã tạo lại</button>
                : <button type="button" disabled={Boolean(processingAction) || !hasPermission("inventory:manage")} onClick={() => void handleRecreate()} className="rounded border px-3 py-2 disabled:opacity-50">Tạo lại phiếu kiểm kê</button>}
            </div>}
            {count?.status === "pending_approval" && (
              <button
                type="button"
                disabled={processingAction === "approve" || !canApprove || !reviewReady}
                title={!canApprove ? "Cần người duyệt độc lập có quyền duyệt kiểm kê; phiếu phải có định danh người lập/gửi." : undefined}
                onClick={() => void handleTransition("approve")}
                className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {processingAction === "approve" ? "Đang cân bằng kho..." : "Duyệt & Cân bằng tồn kho thực tế"}
              </button>
            )}

            {count?.status === "completed" && (
              <span className="font-bold text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                ✓ Đã hoàn thành cân bằng kho
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* Optional Camera Scanner */}
      {camera && (
        <React.Suspense fallback={<p className="rounded-xl bg-slate-50 p-3 text-sm">Đang tải bộ quét camera...</p>}>
          <BarcodeScannerDialog
            onScan={(value) => {
              setCamera(false);
              void handleScan(value);
            }}
            onClose={() => setCamera(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
}
