import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { toast } from "../../../pages/Toast";
import { Dropdown, type DropdownOption } from "../../common/Dropdown";
import {
  inventoryReceivingService,
  type InventoryBalance,
  type Warehouse,
} from "../../../services/inventoryReceivingService";
import { StockOperatorPicker } from "../StockOperatorPicker";
import { OutboundImeiPickerModal } from "./OutboundImeiPickerModal";
import type { OutboundTicket } from "./printOutboundVoucher";
import type { ProductItem, StockLogPurpose } from "../../../types";

export interface OutboundDraftLine {
  key: string;
  productId: string;
  variantId?: string;
  sku: string;
  productName: string;
  displayName?: string;
  quantity: string;
  unitPrice?: number;
  availableStock: number;
  isUnitTracked: boolean;
  unitIdentifiers: string[];
  serialNumbers: string[];
}

export interface OutboundCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTicket?: OutboundTicket | null;
  warehouses: Warehouse[];
  catalogProducts?: ProductItem[];
  onSave: (payload: {
    idempotencyKey?: string;
    id?: string;
    type: "xuất";
    purpose: StockLogPurpose;
    customerId?: string;
    customerName?: string;
    title: string;
    operatorName: string;
    notes: string;
    status: "Đang chờ" | "Đang xử lý" | "Hoàn thành";
    warehouseId: string;
    items: Array<{
      productId: string;
      variantId?: string;
      sku: string;
      productName: string;
      quantity: number;
      unitPrice?: number;
      unitIdentifiers?: string[];
      serialNumbers?: string[];
    }>;
  }) => Promise<void>;
}

const isUnitTrackingMode = (balance?: any): boolean => {
  if (!balance) return true;
  if (balance.trackingMode === "none" || balance.trackingMode === "quantity") return false;
  return true;
};

export function OutboundCreateModal({
  isOpen,
  onClose,
  initialTicket,
  warehouses,
  catalogProducts = [],
  onSave,
}: OutboundCreateModalProps) {
  // Warehouse & Balances state
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>("");
  const [warehouseBalances, setWarehouseBalances] = useState<InventoryBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Form Fields
  const [purpose, setPurpose] = useState<StockLogPurpose>("nội bộ");
  const [customerName, setCustomerName] = useState<string>("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [operatorName, setOperatorName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<"Đang chờ" | "Đang xử lý" | "Hoàn thành">("Đang chờ");

  // Product Lines
  const [lines, setLines] = useState<OutboundDraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const createRequest = useRef<{ content: string; key: string } | null>(null);
  useEffect(() => { if (!isOpen) createRequest.current = null; }, [isOpen]);

  // IMEI Picker Submodal state
  const [activeImeiLineKey, setActiveImeiLineKey] = useState<string | null>(null);

  // Khởi tạo kho xuất
  useEffect(() => {
    if (!isOpen) return;

    if (initialTicket?.warehouseId) {
      setSourceWarehouseId(initialTicket.warehouseId);
    } else if (warehouses.length > 0 && !sourceWarehouseId) {
      const defaultWh = warehouses.find((w) => w.isDefault) || warehouses[0];
      setSourceWarehouseId(defaultWh?._id || "");
    }
  }, [isOpen, initialTicket, warehouses]);

  // Tải danh sách tồn kho khả dụng khi đổi Kho xuất
  useEffect(() => {
    if (!isOpen || !sourceWarehouseId) {
      setWarehouseBalances([]);
      return;
    }

    let active = true;
    const fetchBalances = async () => {
      setLoadingBalances(true);
      try {
        const balances = await inventoryReceivingService.listBalances(sourceWarehouseId);
        if (active) {
          setWarehouseBalances(balances);
        }
      } catch (err: any) {
        if (active) {
          toast.error("Không thể tải số dư tồn kho của kho này.");
          setWarehouseBalances([]);
        }
      } finally {
        if (active) setLoadingBalances(false);
      }
    };

    void fetchBalances();
    return () => {
      active = false;
    };
  }, [isOpen, sourceWarehouseId]);

  // Gom các biến thể khả dụng theo Product để phục vụ dropdown
  const availableProductGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        productId: string;
        productName: string;
        totalAvailable: number;
        variants: InventoryBalance[];
      }
    >();

    warehouseBalances
      .filter((b) => b.quantity - b.reservedQuantity > 0)
      .forEach((b) => {
        const available = Math.max(0, b.quantity - b.reservedQuantity);
        const current = groups.get(b.productId) || {
          productId: b.productId,
          productName: b.productName || b.sku,
          totalAvailable: 0,
          variants: [],
        };
        current.totalAvailable += available;
        current.variants.push(b);
        groups.set(b.productId, current);
      });

    return Array.from(groups.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName, "vi")
    );
  }, [warehouseBalances]);

  // Khởi tạo dữ liệu form khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    if (initialTicket) {
      setTitle(initialTicket.title || `Xuất kho: ${initialTicket.id}`);
      setPurpose((initialTicket.purpose as StockLogPurpose) || "chuyển kho");
      setCustomerName(initialTicket.customerName || "");
      setOperatorName(initialTicket.operatorName || "");
      setNotes(initialTicket.notes || "");
      setStatus(
        initialTicket.status === "Hoàn thành"
          ? "Hoàn thành"
          : initialTicket.status === "Đang xử lý"
          ? "Đang xử lý"
          : "Đang chờ"
      );

      // Nạp các dòng sản phẩm
      setLines(
        initialTicket.items.map((item, idx) => ({
          key: `line-${idx}-${Date.now()}`,
          productId: item.productId || "",
          variantId: item.variantId,
          sku: item.sku,
          productName: item.productName,
          displayName: item.displayName,
          quantity: String(item.quantity),
          unitPrice: item.unitPrice,
          availableStock: 999, // Sẽ được cập nhật khi balances nạp
          isUnitTracked: Boolean(
            (item.serialNumbers && item.serialNumbers.length > 0) ||
            (item.unitIdentifiers && item.unitIdentifiers.length > 0)
          ),
          unitIdentifiers: item.unitIdentifiers || [],
          serialNumbers: item.serialNumbers || [],
        }))
      );
    } else {
      // Phiếu mới hoàn toàn
      setTitle("Phiếu xuất nội bộ");
      setPurpose("nội bộ");
      setCustomerName("");
      setDestinationWarehouseId("");
      setOperatorName("");
      setNotes("");
      setStatus("Đang chờ");

      setLines([
        {
          key: `line-0-${Date.now()}`,
          productId: "",
          sku: "",
          productName: "",
          quantity: "1",
          availableStock: 0,
          isUnitTracked: true,
          unitIdentifiers: [],
          serialNumbers: [],
        },
      ]);
    }
  }, [isOpen, initialTicket]);

  // Cập nhật thông tin tồn kho khả dụng cho các dòng khi balances load xong
  useEffect(() => {
    if (warehouseBalances.length === 0) return;

    setLines((curr) =>
      curr.map((line) => {
        if (!line.sku) return line;
        const matchedBalance = warehouseBalances.find((b) => b.sku === line.sku);
        if (!matchedBalance) return line;

        const available = Math.max(0, matchedBalance.quantity - matchedBalance.reservedQuantity);
        return {
          ...line,
          productId: matchedBalance.productId || line.productId,
          variantId: matchedBalance.variantId || line.variantId,
          productName: matchedBalance.productName || line.productName,
          displayName: matchedBalance.variantName || line.displayName,
          availableStock: available,
          isUnitTracked: isUnitTrackingMode(matchedBalance),
        };
      })
    );
  }, [warehouseBalances]);

  // Thay đổi mục đích xuất kho và tự động đồng bộ tên phiếu nếu chưa chỉnh sửa
  const handlePurposeChange = (nextPurpose: StockLogPurpose) => {
    setPurpose(nextPurpose);
    setCustomerName("");
    setDestinationWarehouseId("");

    if (
      !title ||
      title === "Phiếu điều chuyển kho" ||
      title === "Phiếu xuất kho nội bộ" ||
      title === "Phiếu xuất hủy / bảo hành"
    ) {
      if (nextPurpose === "chuyển kho") setTitle("Phiếu điều chuyển kho");
      else if (nextPurpose === "nội bộ") setTitle("Phiếu xuất kho nội bộ");
      else if (nextPurpose === "hủy") setTitle("Phiếu xuất hủy / bảo hành");
    }
  };

  // Thêm dòng hàng mới
  const addLine = () => {
    setLines((curr) => [
      ...curr,
      {
        key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: "",
        sku: "",
        productName: "",
        quantity: "1",
        availableStock: 0,
        isUnitTracked: true,
        unitIdentifiers: [],
        serialNumbers: [],
      },
    ]);
  };

  // Xóa hoặc reset một dòng hàng
  const removeLine = (key: string) => {
    setLines((curr) => {
      if (curr.length <= 1) {
        return [
          {
            key: `line-${Date.now()}`,
            productId: "",
            sku: "",
            productName: "",
            quantity: "1",
            availableStock: 0,
            isUnitTracked: true,
            unitIdentifiers: [],
            serialNumbers: [],
          },
        ];
      }
      return curr.filter((l) => l.key !== key);
    });
  };

  // Khi người dùng chọn Sản phẩm ở một dòng
  const handleSelectProduct = (lineKey: string, productId: string) => {
    const group = availableProductGroups.find((g) => g.productId === productId);
    const firstVariant = group?.variants[0];

    setLines((curr) =>
      curr.map((l) => {
        if (l.key !== lineKey) return l;
        if (!firstVariant) {
          return {
            ...l,
            productId,
            sku: "",
            productName: group?.productName || "",
            availableStock: 0,
            unitIdentifiers: [],
            serialNumbers: [],
          };
        }

        const available = Math.max(0, firstVariant.quantity - firstVariant.reservedQuantity);
        return {
          ...l,
          productId,
          variantId: firstVariant.variantId,
          sku: firstVariant.sku,
          productName: group.productName,
          displayName: firstVariant.variantName || firstVariant.sku,
          availableStock: available,
          quantity: "1",
          isUnitTracked: isUnitTrackingMode(firstVariant),
          unitIdentifiers: [],
          serialNumbers: [],
        };
      })
    );
  };

  // Khi người dùng chọn SKU / Biến thể ở một dòng
  const handleSelectVariant = (lineKey: string, sku: string) => {
    const matched = warehouseBalances.find((b) => b.sku === sku);
    if (!matched) return;

    const available = Math.max(0, matched.quantity - matched.reservedQuantity);

    setLines((curr) =>
      curr.map((l) => {
        if (l.key !== lineKey) return l;
        return {
          ...l,
          productId: matched.productId,
          variantId: matched.variantId,
          sku: matched.sku,
          productName: matched.productName || l.productName,
          displayName: matched.variantName || matched.sku,
          availableStock: available,
          quantity: "1",
          isUnitTracked: isUnitTrackingMode(matched),
          unitIdentifiers: [],
          serialNumbers: [],
        };
      })
    );
  };

  // Cập nhật số lượng xuất của một dòng
  const handleQuantityChange = (lineKey: string, rawVal: string) => {
    const cleaned = rawVal.replace(/\D/g, "");
    setLines((curr) =>
      curr.map((l) => {
        if (l.key !== lineKey) return l;
        const num = Number(cleaned) || 0;
        if (l.availableStock > 0 && num > l.availableStock) {
          toast.error(`Số lượng xuất không được vượt quá tồn khả dụng (${l.availableStock} máy).`);
          return {
            ...l,
            quantity: String(l.availableStock),
            unitIdentifiers: l.unitIdentifiers.slice(0, l.availableStock),
            serialNumbers: l.serialNumbers.slice(0, l.availableStock),
          };
        }
        return {
          ...l,
          quantity: cleaned,
          unitIdentifiers: l.unitIdentifiers.slice(0, Math.max(0, num)),
          serialNumbers: l.serialNumbers.slice(0, Math.max(0, num)),
        };
      })
    );
  };

  // Xóa 1 IMEI trực tiếp từ tray chip
  const handleRemoveImeiFromLine = (lineKey: string, identifierToRemove: string) => {
    setLines((curr) =>
      curr.map((l) => {
        if (l.key !== lineKey) return l;
        const idx = l.unitIdentifiers.indexOf(identifierToRemove);
        if (idx === -1) return l;
        const nextIds = [...l.unitIdentifiers];
        nextIds.splice(idx, 1);
        const nextSns = [...l.serialNumbers];
        nextSns.splice(idx, 1);
        return {
          ...l,
          unitIdentifiers: nextIds,
          serialNumbers: nextSns,
        };
      })
    );
  };

  // Mở IMEI picker cho dòng tương ứng
  const openImeiPicker = (lineKey: string) => {
    const line = lines.find((l) => l.key === lineKey);
    if (!line?.sku) {
      toast.error("Vui lòng chọn sản phẩm và SKU trước khi chọn IMEI.");
      return;
    }
    setActiveImeiLineKey(lineKey);
  };

  // Lưu IMEI được chọn từ submodal vào dòng
  const handleConfirmImeis = (
    selectedIdentifiers: string[],
    selectedSerialNumbers: string[]
  ) => {
    if (!activeImeiLineKey) return;
    setLines((curr) =>
      curr.map((l) => {
        if (l.key !== activeImeiLineKey) return l;
        return {
          ...l,
          unitIdentifiers: selectedIdentifiers,
          serialNumbers: selectedSerialNumbers,
        };
      })
    );
    setActiveImeiLineKey(null);
  };

  // Submit toàn bộ phiếu xuất
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purpose === "chuyển kho") {
      toast.error("Hãy tạo phiếu tại tab Điều chuyển để theo dõi kho gửi, hàng đang vận chuyển và kho nhận.");
      return;
    }
    if (purpose === "nội bộ" && status === "Hoàn thành" && (!customerName.trim() || !notes.trim())) {
      toast.error("Vui lòng nhập người/phòng ban nhận và lý do cấp phát trong ghi chú.");
      return;
    }

    if (!sourceWarehouseId) {
      toast.error("Vui lòng chọn Kho xuất hàng.");
      return;
    }

    if (!title.trim()) {
      toast.error("Vui lòng nhập Tên phiếu xuất kho.");
      return;
    }

    if (!operatorName.trim()) {
      toast.error("Vui lòng chọn Người phụ trách xuất kho.");
      return;
    }

    // Kiểm tra tính hợp lệ của từng dòng hàng
    const validItems: Array<{
      productId: string;
      variantId?: string;
      sku: string;
      productName: string;
      quantity: number;
      unitPrice?: number;
      unitIdentifiers?: string[];
      serialNumbers?: string[];
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.productId || !line.sku) {
        toast.error(`Dòng #${i + 1}: Vui lòng chọn đầy đủ Sản phẩm và Biến thể SKU.`);
        return;
      }

      const qty = Number(line.quantity);
      if (!qty || qty <= 0) {
        toast.error(`Dòng #${i + 1}: Số lượng xuất phải lớn hơn 0.`);
        return;
      }

      if (line.availableStock > 0 && qty > line.availableStock) {
        toast.error(
          `Dòng #${i + 1} (${line.sku}): Số lượng xuất (${qty}) vượt quá tồn khả dụng (${line.availableStock}).`
        );
        return;
      }

      // Nếu quản lý theo IMEI và trạng thái là "Hoàn thành" hoặc "Đang xử lý": cần gán đủ IMEI
      if (line.isUnitTracked && status !== "Đang chờ") {
        if (line.unitIdentifiers.length !== qty) {
          toast.error(
            `Dòng #${i + 1} (${line.sku}): Đã chọn ${line.unitIdentifiers.length}/${qty} máy. Vui lòng chọn đủ IMEI trước khi lưu phiếu ở trạng thái "${status}".`
          );
          return;
        }
      }

      validItems.push({
        productId: line.productId,
        variantId: line.variantId,
        sku: line.sku,
        productName: line.productName,
        quantity: qty,
        unitPrice: line.unitPrice,
        unitIdentifiers: line.unitIdentifiers,
        serialNumbers: line.serialNumbers,
      });
    }

    if (validItems.length === 0) {
      toast.error("Phiếu xuất phải có ít nhất một mặt hàng hợp lệ.");
      return;
    }

    // Tên người nhận tùy theo mục đích
    const resolvedCustomerName = customerName;

    setSaving(true);
    try {
      const draft = {
        id: initialTicket?.id,
        type: "xuất" as const,
        purpose,
        customerName: resolvedCustomerName.trim() || undefined,
        title: title.trim(),
        operatorName: operatorName.trim(),
        notes: notes.trim(),
        status,
        warehouseId: sourceWarehouseId,
        items: validItems,
      };
      const content = JSON.stringify(draft);
      if (!createRequest.current || createRequest.current.content !== content) {
        createRequest.current = { content, key: crypto.randomUUID() };
      }
      await onSave({ ...draft, idempotencyKey: createRequest.current.key });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Không thể lưu phiếu xuất kho.");
    } finally {
      setSaving(false);
    }
  };

  // Dropdown options
  const warehouseOptions: DropdownOption[] = warehouses.map((w) => ({
    value: w._id,
    label: `${w.name}${w.isDefault ? " (mặc định)" : ""}`,
    sublabel: `Mã kho: ${w.code}`,
  }));

  const destinationWarehouseOptions: DropdownOption[] = warehouses
    .filter((w) => w._id !== sourceWarehouseId)
    .map((w) => ({
      value: w._id,
      label: w.name,
      sublabel: `Mã: ${w.code}`,
    }));

  const purposeOptions: DropdownOption<StockLogPurpose>[] = [
    {
      value: "chuyển kho",
      label: "Điều chuyển kho sang cơ sở khác",
      sublabel: "Tạo phiếu tại tab Điều chuyển; phiếu xuất cũ không dùng để chuyển kho",
    },
    {
      value: "nội bộ",
      label: "Xuất nhân viên nội bộ sử dụng",
      sublabel: "Cấp phát cho nhân viên, phòng ban, máy trải nghiệm/test",
    },
    {
      value: "hủy",
      label: "Xuất hủy, lỗi, bảo hành",
      sublabel: "Xuất trả bảo hành về hãng hoặc thanh lý máy lỗi",
    },
  ];

  const statusOptions: DropdownOption<"Đang chờ" | "Đang xử lý" | "Hoàn thành">[] = [
    { value: "Đang chờ", label: "Đang chờ (Bản nháp / Chưa xuất)" },
    { value: "Đang xử lý", label: "Đang xử lý (Đang xuất kho)" },
    { value: "Hoàn thành", label: "Hoàn thành (Đã trừ tồn kho thực tế)" },
  ];

  // Active line for IMEI submodal
  const activeImeiLine = lines.find((l) => l.key === activeImeiLineKey);
  const activeWarehouse = warehouses.find((w) => w._id === sourceWarehouseId);

  // Statistics
  const totalQuantity = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0),
    [lines]
  );

  const totalRequiredImeis = useMemo(
    () =>
      lines
        .filter((l) => l.isUnitTracked && l.sku)
        .reduce((sum, l) => sum + (Number(l.quantity) || 0), 0),
    [lines]
  );

  const totalSelectedImeis = useMemo(
    () =>
      lines
        .filter((l) => l.isUnitTracked && l.sku)
        .reduce((sum, l) => sum + l.unitIdentifiers.length, 0),
    [lines]
  );

  const isAllImeisFulfilled =
    totalRequiredImeis > 0 && totalSelectedImeis === totalRequiredImeis;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">

        {/* Sticky Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-800 uppercase tracking-wide">
                {initialTicket ? "Chỉnh sửa" : "Tạo mới"}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {initialTicket ? "Chỉnh sửa phiếu xuất kho" : "Tạo phiếu xuất kho mới"}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Chỉ định kho xuất, kiểm soát tồn khả dụng và chọn IMEI thực tế từng máy.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body - scrollable area + sticky footer */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">

            {/* Section 1: Kho xuất & Mục đích */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                <WarehouseIcon className="h-4 w-4 text-cyan-700" />
                <span>1. Thông tin xuất kho & Nơi nhận</span>
              </div>

              {/* Row 1: Kho xuất - Mục đích - Trạng thái */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Xuất từ kho <span className="text-rose-600">*</span>
                  </label>
                  <Dropdown
                    value={sourceWarehouseId}
                    onChange={(val) => setSourceWarehouseId(val)}
                    options={warehouseOptions}
                    placeholder="Chọn kho xuất..."
                    variant="form"
                    searchable
                    className="w-full"
                  />
                  <span className="block mt-1 text-[11px] text-slate-500 truncate">
                    {loadingBalances
                      ? "Đang nạp tồn kho..."
                      : `Có ${warehouseBalances.length} SKU đang lưu trong kho này.`}
                  </span>
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mục đích xuất kho <span className="text-rose-600">*</span>
                  </label>
                  <Dropdown
                    value={purpose}
                    onChange={(val) => handlePurposeChange(val as StockLogPurpose)}
                    options={purposeOptions}
                    variant="form"
                    className="w-full"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Trạng thái phiếu
                  </label>
                  <Dropdown
                    value={status}
                    onChange={(val) => setStatus(val)}
                    options={statusOptions}
                    variant="form"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Row 2: Nơi nhận theo ngữ cảnh & Người phụ trách */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200/80">
                <div className="min-w-0">
                  {purpose === "chuyển kho" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Kho / Chi nhánh nhận hàng <span className="text-rose-600">*</span>
                      </label>
                      <Dropdown
                        value={destinationWarehouseId}
                        onChange={(val) => {
                          setDestinationWarehouseId(val);
                          const matched = warehouses.find((w) => w._id === val);
                          setCustomerName(matched?.name || "");
                        }}
                        options={destinationWarehouseOptions}
                        placeholder="Chọn kho đích nhận hàng..."
                        variant="form"
                        searchable
                        className="w-full"
                      />
                    </div>
                  )}

                  {purpose === "nội bộ" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Phòng ban / Nhân viên nhận máy <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ví dụ: Phòng Kỹ thuật - Nguyễn Văn A"
                        required={status === "Hoàn thành"}
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none shadow-2xs"
                      />
                      <p className="mt-1 text-xs text-violet-700">Máy chuyển sang sử dụng nội bộ và không còn khả dụng để bán. Nhập lý do cấp phát vào ghi chú; thu hồi tại chi tiết phiếu.</p>
                    </div>
                  )}

                  {purpose === "hủy" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Lý do xuất hủy / lỗi / bảo hành <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ví dụ: Máy lỗi mainboard gửi hãng bảo hành"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none shadow-2xs"
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Người phụ trách xuất <span className="text-rose-600">*</span>
                  </label>
                  <StockOperatorPicker
                    value={operatorName}
                    onChange={(name) => setOperatorName(name)}
                  />
                </div>
              </div>

              {/* Row 3: Tên phiếu & Ghi chú */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200/80">
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tên phiếu xuất <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      purpose === "chuyển kho"
                        ? "Ví dụ: Điều chuyển kho sang cơ sở Quận 1"
                        : purpose === "nội bộ"
                        ? "Ví dụ: Xuất máy test cho Phòng Kỹ thuật"
                        : "Ví dụ: Xuất bảo hành máy lỗi main"
                    }
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none shadow-2xs"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ghi chú phiếu
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ghi chú thêm về điều kiện giao hàng, chứng từ kèm theo..."
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Danh sách sản phẩm xuất kho */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      2. Danh sách sản phẩm & Chọn IMEI xuất
                    </span>
                    <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      {lines.length} dòng
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Chỉ cho phép chọn các SKU có tồn khả dụng &gt; 0 tại kho xuất.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-600" />
                  <span>Thêm dòng hàng</span>
                </button>
              </div>

              {!sourceWarehouseId ? (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-xs text-amber-800">
                  Vui lòng chọn <strong>Kho xuất hàng</strong> ở phía trên để nạp danh sách sản phẩm còn tồn.
                </div>
              ) : availableProductGroups.length === 0 && !loadingBalances ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  Kho này hiện chưa có sản phẩm nào có tồn kho khả dụng &gt; 0 để xuất.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {lines.map((line, idx) => {
                    const productOptions: DropdownOption[] = availableProductGroups.map((g) => ({
                      value: g.productId,
                      label: g.productName,
                      sublabel: `Tồn kho: ${g.totalAvailable} máy`,
                    }));

                    const currentGroup = availableProductGroups.find((g) => g.productId === line.productId);
                    const variantOptions: DropdownOption[] = (currentGroup?.variants || []).map((v) => {
                      const avail = Math.max(0, v.quantity - v.reservedQuantity);
                      return {
                        value: v.sku,
                        label: `${v.sku}${v.variantName ? ` - ${v.variantName}` : ""}`,
                        sublabel: `Khả dụng: ${avail} máy`,
                        disabled: avail <= 0,
                      };
                    });

                    const selectedImeiCount = line.unitIdentifiers.length;
                    const reqQty = Number(line.quantity) || 0;
                    const isImeiFulfilled = selectedImeiCount === reqQty && reqQty > 0;

                    return (
                      <div
                        key={line.key}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 shadow-2xs transition-all hover:border-slate-300"
                      >
                        {/* Top bar of line item */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {line.productName || "Chọn mặt hàng xuất"}
                            </span>
                            {line.availableStock > 0 && (
                              <span className="shrink-0 rounded-md bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                                Tồn kho: {line.availableStock} máy
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {line.isUnitTracked ? (
                              isImeiFulfilled ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  Đủ IMEI ({selectedImeiCount}/${reqQty})
                                </span>
                              ) : selectedImeiCount > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                  <AlertCircle className="h-3 w-3 text-amber-600" />
                                  Thiếu {reqQty - selectedImeiCount} IMEI ({selectedImeiCount}/{reqQty})
                                </span>
                              ) : (
                                <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                  Chưa chọn IMEI (0/{reqQty})
                                </span>
                              )
                            ) : (
                              <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                Không quản lý IMEI
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => removeLine(line.key)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                              title={lines.length > 1 ? "Xóa dòng hàng này" : "Đặt lại dòng hàng này"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Controls Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          {/* Sản phẩm */}
                          <div className="md:col-span-4 min-w-0">
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Sản phẩm <span className="text-rose-600">*</span>
                            </label>
                            <Dropdown
                              value={line.productId}
                              onChange={(val) => handleSelectProduct(line.key, val)}
                              options={productOptions}
                              placeholder="Chọn sản phẩm..."
                              variant="form"
                              searchable
                              className="w-full"
                            />
                          </div>

                          {/* SKU / Biến thể */}
                          <div className="md:col-span-5 min-w-0">
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              SKU / Biến thể <span className="text-rose-600">*</span>
                            </label>
                            <Dropdown
                              value={line.sku}
                              onChange={(val) => handleSelectVariant(line.key, val)}
                              options={variantOptions}
                              placeholder={line.productId ? "Chọn SKU..." : "Chọn sản phẩm trước"}
                              disabled={!line.productId}
                              variant="form"
                              searchable
                              className="w-full"
                            />
                          </div>

                          {/* Số lượng & IMEI */}
                          <div className="md:col-span-3 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-bold text-slate-600">
                                Số lượng
                              </label>
                              {line.availableStock > 0 && (
                                <span className="text-[10px] font-bold text-cyan-800">
                                  Max: {line.availableStock}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={line.quantity}
                                onChange={(e) => handleQuantityChange(line.key, e.target.value)}
                                placeholder="1"
                                className="h-10 w-16 shrink-0 rounded-xl border border-slate-300 bg-white px-2 text-center text-sm font-bold text-slate-800 focus:border-cyan-600 focus:outline-none shadow-2xs"
                              />

                              {line.isUnitTracked ? (
                                <button
                                  type="button"
                                  onClick={() => openImeiPicker(line.key)}
                                  disabled={!line.sku}
                                  className={`h-10 flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition-all shadow-2xs select-none cursor-pointer ${
                                    isImeiFulfilled
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
                                      : selectedImeiCount > 0
                                      ? "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100"
                                      : "bg-cyan-50 text-cyan-900 border border-cyan-300 hover:bg-cyan-100"
                                  } disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400`}
                                >
                                  <QrCode className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">
                                    {selectedImeiCount > 0
                                      ? `IMEI (${selectedImeiCount}/${reqQty})`
                                      : "Chọn IMEI"}
                                  </span>
                                </button>
                              ) : (
                                <div className="h-10 flex-1 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 px-2 text-[11px] text-slate-500 font-medium">
                                  Không dùng IMEI
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Display selected IMEIs chips if any */}
                        {line.unitIdentifiers.length > 0 && (
                          <div className="rounded-xl bg-white border border-slate-200 p-3 text-xs space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                              <span className="uppercase tracking-wider">
                                IMEI đã chọn xuất ({line.unitIdentifiers.length} máy):
                              </span>
                              <button
                                type="button"
                                onClick={() => openImeiPicker(line.key)}
                                className="text-cyan-700 hover:text-cyan-900 font-semibold underline text-[11px] cursor-pointer"
                              >
                                Đổi / Chọn lại IMEI
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 font-mono text-xs text-slate-700">
                              {line.unitIdentifiers.map((id, sIdx) => {
                                const sn = line.serialNumbers[sIdx] || id;
                                return (
                                  <span
                                    key={sIdx}
                                    className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 border border-slate-200 text-slate-800"
                                  >
                                    <span>{sn}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveImeiFromLine(line.key, id)}
                                      className="text-slate-400 hover:text-rose-600 ml-0.5 rounded-full p-0.5 cursor-pointer"
                                      title="Bỏ IMEI này"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer Submit Bar (Fixed outside the scrollable body) */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/95 shrink-0">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-600">
              <div>
                Dòng hàng: <strong className="text-slate-900 font-bold">{lines.length}</strong>
              </div>
              <span className="text-slate-300">|</span>
              <div>
                Tổng số lượng: <strong className="text-slate-900 font-bold">{totalQuantity} máy</strong>
              </div>
              {totalRequiredImeis > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <span>IMEI đã chọn:</span>
                    <strong
                      className={`font-bold ${
                        isAllImeisFulfilled
                          ? "text-emerald-700"
                          : totalSelectedImeis > 0
                          ? "text-amber-700"
                          : "text-slate-700"
                      }`}
                    >
                      {totalSelectedImeis}/{totalRequiredImeis} máy
                    </strong>
                    {isAllImeisFulfilled && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-cyan-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-cyan-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {saving
                  ? "Đang lưu phiếu..."
                  : initialTicket
                  ? "Cập nhật phiếu xuất"
                  : "Lưu phiếu xuất kho"}
              </button>
            </div>
          </div>
        </form>

      </div>

      {/* Submodal Chọn IMEI */}
      {activeImeiLine && (
        <OutboundImeiPickerModal
          isOpen={Boolean(activeImeiLineKey)}
          onClose={() => setActiveImeiLineKey(null)}
          warehouseId={sourceWarehouseId}
          warehouseName={activeWarehouse?.name}
          productId={activeImeiLine.productId}
          sku={activeImeiLine.sku}
          productName={activeImeiLine.productName}
          requiredCount={Math.max(1, Number(activeImeiLine.quantity) || 1)}
          initialSelectedIdentifiers={activeImeiLine.unitIdentifiers}
          onConfirm={handleConfirmImeis}
        />
      )}
    </div>
  );
}
