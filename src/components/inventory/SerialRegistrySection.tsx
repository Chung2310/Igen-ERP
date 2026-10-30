import React, { useEffect, useMemo, useState } from "react";
import {
  inventorySerialService,
  type InventorySerialEvent,
  type InventorySerialUnit,
  type SerialUnitStatus,
} from "../../services/inventorySerialService";
import {
  inventoryReceivingService,
  type Warehouse,
} from "../../services/inventoryReceivingService";
import { toast } from "../../pages/Toast";
import { Dropdown, type DropdownOption } from "../common/Dropdown";
import { MetricBar } from "../common/MetricBar";

const statuses: Array<"" | SerialUnitStatus> = [
  "",
  "in_stock",
  "in_transit",
  "internal_use",
  "sold",
  "returned",
  "defective",
  "repairing",
  "scrapped",
  "lost",
];

const serialStatusLabels: Record<SerialUnitStatus, string> = {
  internal_use: "Đang sử dụng nội bộ",
  in_stock: "Trong kho",
  in_transit: "Đang chuyển kho",
  sold: "Đã bán",
  returned: "Đã trả hàng",
  defective: "Lỗi",
  repairing: "Đang sửa chữa",
  scrapped: "Đã thanh lý",
  lost: "Thất lạc",
};

const statusBadgeStyles: Record<SerialUnitStatus, string> = {
  internal_use: "bg-violet-50 text-violet-800 border-violet-200",
  in_stock: "bg-emerald-50 text-emerald-800 border-emerald-200",
  in_transit: "bg-amber-50 text-amber-800 border-amber-200",
  sold: "bg-blue-50 text-blue-800 border-blue-200",
  returned: "bg-purple-50 text-purple-800 border-purple-200",
  defective: "bg-rose-50 text-rose-800 border-rose-200",
  repairing: "bg-orange-50 text-orange-800 border-orange-200",
  scrapped: "bg-slate-100 text-slate-600 border-slate-200",
  lost: "bg-rose-100 text-rose-900 border-rose-300",
};

const serialEventLabels: Record<string, string> = {
  internal_use: "Cấp phát sử dụng nội bộ",
  received: "Nhập kho",
  sold: "Bán hàng",
  sale_cancelled: "Hủy bán hàng",
  stock_log_reversed: "Đảo phiếu xuất, hoàn kho",
  transferred: "Điều chuyển kho",
  transfer_requested: "Yêu cầu chuyển kho",
  transfer_received: "Đã nhận chuyển kho",
  transfer_cancelled: "Hủy chuyển kho",
  repair_received: "Nhận sửa chữa",
  repair_delivered: "Hoàn tất sửa chữa",
  warranty_adjusted: "Điều chỉnh bảo hành",
  count_lost: "Kiểm kê ghi nhận thất lạc",
};

function serialStatusLabel(status?: SerialUnitStatus) {
  return status ? serialStatusLabels[status] : "Chưa có trạng thái";
}

function InternalUseDetails({ unit }: { unit: InventorySerialUnit }) {
  if (unit.status !== "internal_use" || !unit.internalUse) return null;
  return <div className="mt-1 text-[11px] text-violet-800">
    <div>Người nhận: {unit.internalUse.recipientName}</div>
    <div>Giá vốn cấp phát: {unit.internalUse.unitCost.toLocaleString("vi-VN")} ₫</div>
    <div>Phiếu: <span className="font-mono">{unit.internalUse.stockLogId}</span></div>
  </div>;
}

function serialEventLabel(eventType: string) {
  return serialEventLabels[eventType] || "Thao tác khác";
}

export interface MachineGroup {
  key: string;
  productId: string;
  productName: string;
  skus: string[];
  items: InventorySerialUnit[];
  total: number;
  inStock: number;
  sold: number;
  inTransit: number;
  defectiveOrRepair: number;
}

export function SerialRegistrySection({ onTransfers }: { onTransfers?: () => void } = {}) {
  const [items, setItems] = useState<InventorySerialUnit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [serialQuery, setSerialQuery] = useState("");
  const [status, setStatus] = useState<"" | SerialUnitStatus>("");
  const [loading, setLoading] = useState(false);

  // View mode: "by_machine" (default per user request) vs "flat"
  const [viewMode, setViewMode] = useState<"by_machine" | "flat">("by_machine");
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  // Modals
  const [history, setHistory] = useState<{
    item: InventorySerialUnit;
    events: InventorySerialEvent[];
  } | null>(null);


  // Pagination & Copying
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Load warehouses once
  useEffect(() => {
    inventoryReceivingService
      .listWarehouses()
      .then((res) => setWarehouses(res || []))
      .catch(() => undefined);
  }, []);

  // Load serial list
  async function load() {
    setLoading(true);
    try {
      const res = await inventorySerialService.list({
        serial: serialQuery.trim() || undefined,
        status: status || undefined,
        warehouseId: selectedWarehouseId || undefined,
        limit: 300,
      });
      setItems(res.items || []);
    } catch (problem) {
      toast.error(
        problem instanceof Error
          ? problem.message
          : "Không thể tải danh sách IMEI/serial."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status, selectedWarehouseId]);

  // Handle manual submit search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load();
  };

  // Filter items in memory if user typed search query
  const filteredItems = useMemo(() => {
    if (!serialQuery.trim()) return items;
    const q = serialQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.serialNumber.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q) ||
        (item.internalBarcode && item.internalBarcode.toLowerCase().includes(q))
    );
  }, [items, serialQuery]);

  // Overall KPI stats computed over loaded items
  const stats = useMemo(() => {
    const inStock = items.filter((i) => i.status === "in_stock").length;
    const sold = items.filter((i) => i.status === "sold").length;
    const inTransit = items.filter((i) => i.status === "in_transit").length;
    const defectiveOrRepair = items.filter(
      (i) => i.status === "defective" || i.status === "repairing" || i.status === "lost"
    ).length;
    return {
      total: items.length,
      inStock,
      sold,
      inTransit,
      defectiveOrRepair,
    };
  }, [items]);

  // Group items by machine (Product / Model)
  const machineGroups = useMemo(() => {
    const map: Record<string, MachineGroup> = {};

    filteredItems.forEach((item) => {
      // Group by productId or productName
      const key = item.productId || item.productName || "unclassified";
      if (!map[key]) {
        map[key] = {
          key,
          productId: item.productId || "",
          productName: item.productName || "Thiết bị chưa phân loại",
          skus: [],
          items: [],
          total: 0,
          inStock: 0,
          sold: 0,
          inTransit: 0,
          defectiveOrRepair: 0,
        };
      }

      map[key].items.push(item);
      map[key].total += 1;
      if (item.sku && !map[key].skus.includes(item.sku)) {
        map[key].skus.push(item.sku);
      }
      if (item.status === "in_stock") map[key].inStock += 1;
      else if (item.status === "sold") map[key].sold += 1;
      else if (item.status === "in_transit") map[key].inTransit += 1;
      else map[key].defectiveOrRepair += 1;
    });

    return Object.values(map);
  }, [filteredItems]);

  // Auto-expand all machine groups whenever items update or search occurs
  useEffect(() => {
    const keys = Array.from(
      new Set(items.map((i) => i.productId || i.productName || "unclassified"))
    );
    setExpandedKeys(keys);
  }, [items]);

  const toggleGroup = (key: string) => {
    setExpandedKeys((curr) =>
      curr.includes(key) ? curr.filter((k) => k !== key) : [...curr, key]
    );
  };

  const expandAll = () => {
    setExpandedKeys(machineGroups.map((g) => g.key));
  };

  const collapseAll = () => {
    setExpandedKeys([]);
  };

  // Copy helper for single IMEI
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSerial(code);
    toast.success(`Đã sao chép mã: ${code}`);
    setTimeout(() => setCopiedSerial(null), 1800);
  };

  // Bulk copy all IMEIs in a machine group
  const handleCopyAllForMachine = (group: MachineGroup) => {
    const list = group.items.map((i) => i.serialNumber).join("\n");
    navigator.clipboard.writeText(list);
    toast.success(`Đã sao chép toàn bộ ${group.items.length} mã IMEI của ${group.productName}.`);
  };

  // Flat pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Dropdown options
  const statusOptions: DropdownOption<string>[] = useMemo(() => {
    return statuses.map((st) => ({
      value: st,
      label: st ? serialStatusLabels[st] : "Tất cả trạng thái",
    }));
  }, []);

  const warehouseOptions: DropdownOption<string>[] = useMemo(() => {
    return [
      { value: "", label: "Tất cả kho hàng" },
      ...warehouses.map((w) => ({
        value: w._id,
        label: w.name,
        sublabel: `Mã kho: ${w.code}`,
      })),
    ];
  }, [warehouses]);

  const getWarehouseName = (id?: string) => {
    if (!id) return "Kho chính";
    const found = warehouses.find((w) => w._id === id);
    return found ? found.name : id;
  };

  return (
    <section className="space-y-4" aria-label="Quản lý IMEI và Serial">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Quản lý IMEI / Serial
            </h2>
            <span className="font-mono text-[11px] font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
              {stats.total} máy
            </span>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
            title="Tải lại danh sách"
          >
            Làm mới
          </button>
        </div>
      </div>

      {/* 2. Compact Sleek Metric Bar (4 segments) */}
      <MetricBar
        items={[
          {
            label: "Quy mô thiết bị",
            value: stats.total,
            unit: "máy",
            subtext: (
              <>
                Phân chia trên <b>{machineGroups.length} dòng máy</b>
              </>
            ),
            isActive: status === "",
            tone: "default",
            onClick: () => {
              setStatus("");
              setPage(1);
            },
          },
          {
            label: "Trong kho khả dụng",
            value: stats.inStock,
            unit: "máy",
            subtext: (
              <span className="text-emerald-600 font-medium">
                Sẵn sàng xuất bán hoặc điều phối
              </span>
            ),
            isActive: status === "in_stock",
            tone: "emerald",
            onClick: () => {
              setStatus("in_stock");
              setPage(1);
            },
          },
          {
            label: "Đã xuất bán",
            value: stats.sold,
            unit: "máy",
            subtext: (
              <span className="text-blue-600 font-medium">
                Đã bàn giao cho khách hàng
              </span>
            ),
            isActive: status === "sold",
            tone: "blue",
            onClick: () => {
              setStatus("sold");
              setPage(1);
            },
          },
          {
            label: "Cần xử lý / Chuyển kho",
            value: stats.defectiveOrRepair + stats.inTransit,
            unit: "máy",
            subtext: (
              <span className="text-slate-500 font-medium">
                Chuyển: {stats.inTransit} · Lỗi/Sửa: {stats.defectiveOrRepair}
              </span>
            ),
            isActive: status === "defective",
            tone: "amber",
            valueClassName:
              stats.defectiveOrRepair + stats.inTransit > 0
                ? "text-amber-700"
                : "text-slate-600",
            onClick: () => {
              setStatus((curr) => (curr === "defective" ? "" : "defective"));
              setPage(1);
            },
          },
        ]}
      />

      {/* 3. Search Bar, Dropdown Filters, View Mode Toggle & Expand/Collapse */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <input
            type="text"
            value={serialQuery}
            onChange={(e) => {
              setSerialQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo mã IMEI / Serial, barcode, mã SKU, tên dòng máy..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-cyan-600 focus:bg-white focus:ring-1 focus:ring-cyan-600 transition-all font-medium"
          />
          {serialQuery && (
            <button
              type="button"
              onClick={() => {
                setSerialQuery("");
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </form>

        {/* Filters, Dropdowns & View Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse Dropdown */}
          <div className="w-40">
            <Dropdown<string>
              aria-label="Lọc theo kho"
              value={selectedWarehouseId}
              onChange={(val) => {
                setSelectedWarehouseId(val);
                setPage(1);
              }}
              options={warehouseOptions}
              variant="filter"
              size="sm"
              triggerClassName="w-full justify-between text-xs font-medium border-slate-200 py-1.5"
            />
          </div>

          {/* Status Dropdown */}
          <div className="w-38">
            <Dropdown<string>
              aria-label="Lọc theo trạng thái"
              value={status}
              onChange={(val) => {
                setStatus(val as any);
                setPage(1);
              }}
              options={statusOptions}
              variant="filter"
              size="sm"
              triggerClassName="w-full justify-between text-xs font-medium border-slate-200 py-1.5"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("by_machine")}
              className={`rounded-md px-2.5 py-1 font-bold transition-all ${viewMode === "by_machine"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Theo dòng máy
            </button>
            <button
              type="button"
              onClick={() => setViewMode("flat")}
              className={`rounded-md px-2.5 py-1 font-bold transition-all ${viewMode === "flat"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Tất cả IMEI
            </button>
          </div>

          {/* Expand / Collapse All when in by_machine view */}
          {viewMode === "by_machine" && (
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
              <button
                type="button"
                onClick={expandAll}
                className="rounded px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                title="Mở rộng tất cả dòng máy"
              >
                [+] Mở tất cả
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                title="Thu gọn danh sách"
              >
                [-] Thu gọn
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Display Content: Grouped by Machine (Default) vs Flat List */}
      {viewMode === "by_machine" ? (
        /* HIERARCHICAL ACCORDION BY MACHINE */
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
              Đang tải dữ liệu IMEI theo máy...
            </div>
          ) : machineGroups.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
              Không tìm thấy dòng máy nào phù hợp với bộ lọc.
            </div>
          ) : (
            machineGroups.map((group) => {
              const isExpanded = expandedKeys.includes(group.key);

              return (
                <div
                  key={group.key}
                  className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all"
                >
                  {/* Machine Header Row (Clickable) */}
                  <div
                    onClick={() => toggleGroup(group.key)}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none bg-white hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Left: Expand chevron & Machine Title */}
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-xs font-bold text-slate-400 select-none">
                        {isExpanded ? "▼" : "▶"}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                            {group.productName}
                          </h3>
                          <span className="font-mono text-xs font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                            {group.total} máy
                          </span>
                        </div>
                        {/* SKUs */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {group.skus.map((sku) => (
                            <span
                              key={sku}
                              className="font-mono text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200/80"
                            >
                              {sku}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Stats & Actions */}
                    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
                      {/* Metric pills */}
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1">
                          Trong kho: {group.inStock}
                        </span>
                        {group.sold > 0 && (
                          <span className="rounded-md bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1">
                            Đã bán: {group.sold}
                          </span>
                        )}
                        {group.inTransit > 0 && (
                          <span className="rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1">
                            Chuyển: {group.inTransit}
                          </span>
                        )}
                        {group.defectiveOrRepair > 0 && (
                          <span className="rounded-md bg-rose-50 text-rose-800 border border-rose-200 px-2 py-1">
                            Lỗi/Sửa: {group.defectiveOrRepair}
                          </span>
                        )}
                      </div>

                      {/* Action button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroup(group.key);
                        }}
                        className="rounded-lg border border-slate-200 hover:bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap"
                      >
                        {isExpanded ? "Thu gọn [-]" : `Xem ${group.total} IMEI [+]`}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Nested IMEI Table */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/40 p-3 space-y-2.5">
                      {/* Nested toolbar */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600 text-[11px] uppercase tracking-wide">
                          Danh sách {group.total} mã thiết bị của <b>{group.productName}</b>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyAllForMachine(group)}
                          className="rounded border border-slate-200 bg-white hover:bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs transition-colors"
                        >
                          Sao chép toàn bộ {group.total} IMEI
                        </button>
                      </div>

                      {/* Sub-table */}
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
                        <table className="w-full min-w-[820px] text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="w-[5%] px-3 py-2.5 text-center">#</th>
                              <th className="w-[25%] px-3 py-2.5">Mã IMEI / Serial</th>
                              <th className="w-[18%] px-3 py-2.5">Mã vạch nội bộ</th>
                              <th className="w-[18%] px-3 py-2.5">Kho lưu trữ</th>
                              <th className="w-[14%] px-3 py-2.5">Trạng thái</th>
                              <th className="w-[10%] px-3 py-2.5">Cập nhật</th>
                              <th className="w-[10%] px-3 py-2.5 text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {group.items.map((item, idx) => {
                              const isCopied = copiedSerial === item.serialNumber;
                              const statusBadgeClass =
                                statusBadgeStyles[item.status] ||
                                "bg-slate-100 text-slate-700 border-slate-200";

                              return (
                                <tr
                                  key={item._id}
                                  className="hover:bg-slate-50/80 transition-colors"
                                >
                                  {/* Index */}
                                  <td className="px-3 py-2 text-center text-slate-400 font-mono">
                                    {idx + 1}
                                  </td>

                                  {/* IMEI / Serial */}
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-xs font-black text-slate-900 select-all tracking-wide">
                                        {item.serialNumber}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(item.serialNumber)}
                                        className="text-[10px] text-slate-400 hover:text-cyan-700 px-1 py-0.5 rounded hover:bg-slate-100 transition-colors"
                                        title="Sao chép IMEI"
                                      >
                                        {isCopied ? "Đã chép" : "Chép"}
                                      </button>
                                    </div>
                                  </td>

                                  {/* Barcode */}
                                  <td className="px-3 py-2">
                                    {item.internalBarcode ? (
                                      <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                                        {item.internalBarcode}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 text-xs">—</span>
                                    )}
                                  </td>

                                  {/* Warehouse */}
                                  <td className="px-3 py-2">
                                    <span className="text-slate-700 font-semibold text-xs">
                                      {getWarehouseName(item.warehouseId)}
                                    </span>
                                  </td>

                                  {/* Status */}
                                  <td className="px-3 py-2">
                                    <span
                                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border whitespace-nowrap ${statusBadgeClass}`}
                                    >
                                      {serialStatusLabel(item.status)}
                                    </span>
                                    <InternalUseDetails unit={item} />
                                  </td>

                                  {/* Updated */}
                                  <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">
                                    {new Date(item.updatedAt).toLocaleString("vi-VN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      day: "numeric",
                                      month: "numeric",
                                    })}
                                  </td>

                                  {/* Actions */}
                                  <td className="px-3 py-2 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            setHistory({
                                              item,
                                              events: await inventorySerialService.history(
                                                item._id
                                              ),
                                            });
                                          } catch (problem) {
                                            toast.error(
                                              problem instanceof Error
                                                ? problem.message
                                                : "Không thể tải lịch sử."
                                            );
                                          }
                                        }}
                                        className="rounded-md border border-slate-200 bg-white hover:bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-cyan-800 shadow-2xs transition-colors cursor-pointer"
                                      >
                                        Lịch sử
                                      </button>

                                      {onTransfers && item.status === "in_stock" && (
                                        <button
                                          type="button"
                                          onClick={onTransfers}
                                          className="rounded-md border border-slate-200 hover:bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                                          title="Yêu cầu điều chuyển kho"
                                        >
                                          Chuyển
                                        </button>
                                      )}

                                      {onTransfers && item.status === "in_transit" && <button type="button" onClick={onTransfers} className="text-xs text-cyan-800 underline">Xem phiếu điều chuyển</button>}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* FLAT LIST VIEW (TẤT CẢ IMEI) */
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="w-[4%] px-3 py-3 text-center">#</th>
                  <th className="w-[22%] px-3 py-3">Mã IMEI / Serial</th>
                  <th className="w-[16%] px-3 py-3">Mã vạch nội bộ</th>
                  <th className="w-[26%] px-3 py-3">Sản phẩm & Biến thể SKU</th>
                  <th className="w-[12%] px-3 py-3">Trạng thái</th>
                  <th className="w-[10%] px-3 py-3">Cập nhật</th>
                  <th className="w-[10%] px-3 py-3 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-400">
                      Đang tải danh sách IMEI / Serial...
                    </td>
                  </tr>
                ) : pagedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-400">
                      Không tìm thấy mã IMEI nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  pagedItems.map((item, index) => {
                    const globalIdx = (currentPage - 1) * pageSize + index + 1;
                    const isCopied = copiedSerial === item.serialNumber;
                    const statusBadgeClass =
                      statusBadgeStyles[item.status] ||
                      "bg-slate-100 text-slate-700 border-slate-200";

                    return (
                      <tr
                        key={item._id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-3 py-2.5 text-center text-xs text-slate-400 font-mono">
                          {globalIdx}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-black text-slate-900 select-all tracking-wide">
                              {item.serialNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.serialNumber)}
                              className="text-[10px] text-slate-400 hover:text-cyan-700 px-1 py-0.5 rounded hover:bg-slate-100 transition-colors"
                              title="Sao chép IMEI"
                            >
                              {isCopied ? "Đã chép" : "Chép"}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {item.internalBarcode ? (
                            <span className="font-mono text-xs text-slate-600 bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/60">
                              {item.internalBarcode}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 line-clamp-1">
                              {item.productName || "Thiết bị chưa phân loại"}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {item.sku}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border whitespace-nowrap ${statusBadgeClass}`}
                          >
                            {serialStatusLabel(item.status)}
                          </span>
                          <InternalUseDetails unit={item} />
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(item.updatedAt).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "numeric",
                            month: "numeric",
                          })}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  setHistory({
                                    item,
                                    events: await inventorySerialService.history(item._id),
                                  });
                                } catch (problem) {
                                  toast.error(
                                    problem instanceof Error
                                      ? problem.message
                                      : "Không thể tải lịch sử."
                                  );
                                }
                              }}
                              className="rounded-md border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1 text-xs font-bold text-cyan-800 shadow-2xs transition-colors cursor-pointer"
                            >
                              Lịch sử
                            </button>
                            {onTransfers && item.status === "in_stock" && (
                              <button
                                type="button"
                                onClick={onTransfers}
                                className="rounded-md border border-slate-200 hover:bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                              >
                                Chuyển
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar for flat view */}
          {filteredItems.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-600">
              <span>
                Hiển thị <b>{(currentPage - 1) * pageSize + 1}</b> -{" "}
                <b>{Math.min(currentPage * pageSize, filteredItems.length)}</b> trong tổng số{" "}
                <b>{filteredItems.length}</b> máy
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
                >
                  Trước
                </button>
                <span className="font-bold text-slate-800">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. History Modal Dialog */}
      {history && (
        <div
          data-testid="serial-history-backdrop"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setHistory(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Lịch sử IMEI / Serial"
            className="w-full max-w-xl rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden max-h-[85vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
            onClick={(event) => event.stopPropagation()}
          >
            {/* History Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900 text-base">
                    Lịch sử {history.item.serialNumber}
                  </h3>
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold border ${statusBadgeStyles[history.item.status] || "bg-slate-100 text-slate-700"
                      }`}
                  >
                    {serialStatusLabel(history.item.status)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {history.item.productName} · <span className="font-mono">{history.item.sku}</span>
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng lịch sử"
                onClick={() => setHistory(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* History Events Timeline */}
            <div className="overflow-y-auto p-5 space-y-3 bg-slate-50/50 flex-1">
              {history.events.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">
                  Chưa có lịch sử biến động nào cho thiết bị này.
                </p>
              ) : (
                history.events.map((event) => (
                  <div
                    key={event._id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <strong className="text-xs font-bold text-slate-900">
                        {serialEventLabel(event.eventType)}
                      </strong>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(event.occurredAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 font-medium">
                      {serialStatusLabel(event.fromStatus)} → {serialStatusLabel(event.toStatus)} · {event.actorName}
                    </p>
                    {event.reason && (
                      <p className="mt-1 text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded">
                        Lý do: {event.reason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* History Footer */}
            <div className="flex justify-end border-t border-slate-200 px-5 py-3 bg-white">
              <button
                type="button"
                onClick={() => setHistory(null)}
                className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-1.5 text-xs font-bold text-white transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
