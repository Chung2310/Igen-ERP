import React from "react";
import { StyledSelect } from "../../common/StyledSelect";
import { Plus, X } from "lucide-react";
import { ProductItem, StockLogPurpose } from "../../../types";
import { InventoryBalance, Warehouse } from "../../../services/inventoryReceivingService";
import { InventorySerialUnit } from "../../../services/inventorySerialService";
import { Dropdown, DropdownOption } from "../../common/Dropdown";
import { StockOutCustomerPicker } from "../StockOutCustomerPicker";
import { StockOperatorPicker } from "../StockOperatorPicker";
import { DraftLine, formatNumber, TransactionStatus } from "./stockLogUtils";

interface StockLogCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLogId: string | null;
  outboundOnly?: boolean;
  selectableProducts: ProductItem[];
  warehouseProductGroups: Array<{ productId: string; name: string; variants: InventoryBalance[] }>;
  warehouses: Warehouse[];
  sourceWarehouseId: string;
  setSourceWarehouseId: (id: string) => void;
  warehouseProductsLoading: boolean;
  draftType: "nhập" | "xuất";
  setDraftType: (type: "nhập" | "xuất") => void;
  draftPurpose: StockLogPurpose;
  setDraftPurpose: (purpose: StockLogPurpose) => void;
  draftCustomerId: string | undefined;
  setDraftCustomerId: (id: string | undefined) => void;
  draftCustomerName: string;
  setDraftCustomerName: (name: string) => void;
  draftTitle: string;
  setDraftTitle: (title: string) => void;
  draftOperator: string;
  setDraftOperator: (operator: string) => void;
  draftNotes: string;
  setDraftNotes: (notes: string) => void;
  draftStatus: TransactionStatus;
  setDraftStatus: (status: TransactionStatus) => void;
  draftLines: DraftLine[];
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onNavigateToCreateProduct: () => void;
  onAddDraftLine: () => void;
  onUpdateDraftLine: (index: number, line: DraftLine) => void;
  onRemoveDraftLine: (index: number) => void;
  onOpenUnitPicker: (index: number) => void;
  unitPickerIndex: number | null;
  setUnitPickerIndex: (index: number | null) => void;
  unitPickerQuery: string;
  setUnitPickerQuery: (query: string) => void;
  unitPickerLoading: boolean;
  unitPickerItems: InventorySerialUnit[];
  filteredPickerItems: InventorySerialUnit[];
  selectedUnitsForPicker: string[];
  requiredUnitCount: number;
}

const statusOptions: DropdownOption<TransactionStatus>[] = [
  { value: "Đang chờ", label: "Đang chờ", sublabel: "Phiếu mới tạo, chưa trừ tồn" },
  { value: "Đang xử lý", label: "Đang xử lý", sublabel: "Đang kiểm hàng hoặc chuẩn bị xuất" },
  { value: "Hoàn thành", label: "Hoàn thành", sublabel: "Đã giao nhận và cập nhật tồn kho" },
];

const purposeOptions: DropdownOption<StockLogPurpose>[] = [
  { value: "bán", label: "Bán hàng (POS / Khách hàng)", sublabel: "Xuất bán cho khách hoặc đơn POS" },
  { value: "chuyển kho", label: "Điều chuyển kho / chi nhánh", sublabel: "Chuyển sang chi nhánh hoặc kho khác" },
  { value: "nội bộ", label: "Sử dụng nội bộ", sublabel: "Cấp phát máy trải nghiệm hoặc văn phòng" },
  { value: "hủy", label: "Hủy / hàng hỏng", sublabel: "Xuất loại bỏ hoặc trả bảo hành" },
];

export function StockLogCreateModal({
  isOpen,
  onClose,
  editingLogId,
  outboundOnly = false,
  selectableProducts,
  warehouseProductGroups,
  warehouses,
  sourceWarehouseId,
  setSourceWarehouseId,
  warehouseProductsLoading,
  draftType,
  setDraftType,
  draftPurpose,
  setDraftPurpose,
  draftCustomerId,
  setDraftCustomerId,
  draftCustomerName,
  setDraftCustomerName,
  draftTitle,
  setDraftTitle,
  draftOperator,
  setDraftOperator,
  draftNotes,
  setDraftNotes,
  draftStatus,
  setDraftStatus,
  draftLines,
  submitting,
  onSubmit,
  onNavigateToCreateProduct,
  onAddDraftLine,
  onUpdateDraftLine,
  onRemoveDraftLine,
  onOpenUnitPicker,
  unitPickerIndex,
  setUnitPickerIndex,
  unitPickerQuery,
  setUnitPickerQuery,
  unitPickerLoading,
  unitPickerItems,
  filteredPickerItems,
  selectedUnitsForPicker,
  requiredUnitCount,
}: StockLogCreateModalProps) {
  if (!isOpen) return null;

  const warehouseOptions: DropdownOption<string>[] = [
    { value: "", label: "Chọn kho xuất..." },
    ...warehouses.map((w) => ({
      value: w._id,
      label: `${w.name}${w.isDefault ? " (mặc định)" : ""}`,
      sublabel: `Mã: ${w.code}`,
    })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 bg-white">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {editingLogId
                ? "Chỉnh sửa phiếu xuất kho"
                : outboundOnly
                ? "Tạo phiếu xuất kho"
                : "Tạo phiếu nhập xuất kho"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {outboundOnly
                ? "Khai báo thông tin và danh sách hàng cần xuất."
                : "Chọn loại phiếu, trạng thái xử lý và danh sách sản phẩm."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-1 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form noValidate className="space-y-5 p-6" onSubmit={onSubmit}>
          {/* Header Row: Type & Status */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {!outboundOnly && (
              <button
                type="button"
                onClick={() => setDraftType("nhập")}
                className={`rounded-2xl border p-3.5 text-left transition-all ${
                  draftType === "nhập"
                    ? "border-emerald-300 bg-emerald-50/80 shadow-2xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-bold text-slate-800">Phiếu nhập hàng</div>
                <div className="mt-1 text-[11px] text-slate-500">Cộng tồn kho cho sản phẩm được chọn.</div>
              </button>
            )}

            {outboundOnly ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 shadow-2xs">
                <div className="text-sm font-bold text-rose-800">Phiếu xuất hàng</div>
                <div className="mt-1 text-[11px] text-rose-700">Tồn kho được trừ khi phiếu hoàn thành.</div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDraftType("xuất")}
                className={`rounded-2xl border p-3.5 text-left transition-all ${
                  draftType === "xuất"
                    ? "border-rose-300 bg-rose-50/80 shadow-2xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-bold text-slate-800">Phiếu xuất hàng</div>
                <div className="mt-1 text-[11px] text-slate-500">Trừ tồn kho theo từng sản phẩm trong phiếu.</div>
              </button>
            )}

            <div className={`space-y-1.5 ${outboundOnly ? "md:col-span-3" : "md:col-span-2"}`}>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Trạng thái phiếu
              </label>
              <Dropdown
                value={draftStatus}
                onChange={(val) => setDraftStatus(val as TransactionStatus)}
                options={statusOptions}
                variant="form"
                className="w-full"
              />
            </div>
          </div>

          {/* Section: Thông tin phiếu */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-teal-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Thông tin phiếu
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {outboundOnly && (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Xuất từ kho <span className="text-rose-500">*</span>
                  </label>
                  <Dropdown
                    value={sourceWarehouseId}
                    onChange={(val) => setSourceWarehouseId(val)}
                    options={warehouseOptions}
                    placeholder="Chọn kho xuất..."
                    variant="form"
                    className="w-full"
                  />
                  <span className="block text-[11px] text-slate-400">
                    Chỉ hiển thị SKU còn tồn khả dụng tại kho đã chọn.
                  </span>
                </div>
              )}

              {draftType === "xuất" && (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Mục đích xuất kho
                  </label>
                  <Dropdown
                    value={draftPurpose}
                    onChange={(val) => {
                      setDraftPurpose(val as StockLogPurpose);
                      setDraftCustomerId(undefined);
                      setDraftCustomerName("");
                    }}
                    options={purposeOptions}
                    variant="form"
                    className="w-full"
                  />
                </div>
              )}

              {draftType === "xuất" && (draftPurpose === "bán" || draftPurpose === "chuyển kho") && (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {draftPurpose === "chuyển kho" ? "Kho / chi nhánh nhận" : "Khách hàng"}
                  </label>
                  {draftPurpose === "bán" ? (
                    <StockOutCustomerPicker
                      customerId={draftCustomerId}
                      customerName={draftCustomerName}
                      onChange={(next) => {
                        setDraftCustomerId(next.customerId);
                        setDraftCustomerName(next.customerName);
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={draftCustomerName}
                      onChange={(event) => setDraftCustomerName(event.target.value)}
                      placeholder="Ví dụ: Kho trung tâm hoặc Chi nhánh Quận 1"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                  )}
                </div>
              )}

              <label className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Tên phiếu <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder={
                    draftType === "nhập"
                      ? "Ví dụ: Nhập hàng từ nhà cung cấp A"
                      : "Ví dụ: Xuất kho cho đại lý Hà Nội"
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Người phụ trách <span className="text-rose-500">*</span>
                </label>
                <StockOperatorPicker value={draftOperator} onChange={setDraftOperator} />
              </div>
            </div>

            <label className="mt-4 block space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Ghi chú
              </span>
              <textarea
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
                placeholder="Mô tả ngắn nội dung phiếu hoặc lưu ý vận hành"
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </section>

          {/* Section: Danh sách sản phẩm */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Danh sách sản phẩm trong phiếu
              </h4>
              <button
                type="button"
                onClick={onAddDraftLine}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm dòng</span>
              </button>
            </div>

            {draftType === "nhập" && (
              <div className="mb-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900">
                Chưa có sản phẩm cần nhập?
                <button
                  type="button"
                  onClick={onNavigateToCreateProduct}
                  className="ml-2 font-bold underline underline-offset-2"
                >
                  Chuyển sang Danh mục để khai báo sản phẩm
                </button>
              </div>
            )}

            <div className="space-y-3">
              {draftLines.map((line, index) => (
                <div
                  key={`${index}-${line.productId}-${line.sku || ""}`}
                  className={`grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 ${
                    outboundOnly
                      ? "md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_140px_44px]"
                      : "md:grid-cols-[1fr_140px_44px]"
                  }`}
                >
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Sản phẩm
                    </span>
<StyledSelect appearance="erp" ariaLabel={`Sản phẩm dòng ${index + 1}`} value={line.productId} onChange={(productId) => {
                        const firstVariant = outboundOnly ? warehouseProductGroups.find((group) => group.productId === productId)?.variants[0] : undefined;
                        const firstSku = outboundOnly ? firstVariant?.sku || "" : undefined;
                        const matchedProduct = selectableProducts.find((p) => p.id === productId);
                        onUpdateDraftLine(index, { ...line, productId, sku: firstSku || matchedProduct?.sku || "", productName: matchedProduct?.name || firstSku || "", variantId: firstVariant?.variantId });
                      }} options={[
                        { value: "", label: "Chọn sản phẩm" },
                        ...(outboundOnly && line.productId && !warehouseProductGroups.some((group) => group.productId === line.productId) ? [{ value: line.productId, label: `${line.productName || line.sku || "Sản phẩm đã lưu"} (hết tồn)` }] : []),
                        ...(outboundOnly ? warehouseProductGroups.map((product) => ({ value: product.productId, label: product.name })) : selectableProducts.map((product) => ({ value: product.id, label: `${product.name} - ${product.sku} (${formatNumber(product.stock)})` }))),
                      ]} />
                  </label>

                  {outboundOnly && (
                    <label className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        SKU / Biến thể
                      </span>
<StyledSelect appearance="erp" ariaLabel={`SKU dòng ${index + 1}`} value={line.sku || ""} disabled={!line.productId} onChange={(sku) => {
                          const variantId = (warehouseProductGroups.find((group) => group.productId === line.productId)?.variants || []).find((variant) => variant.sku === sku)?.variantId;
                          onUpdateDraftLine(index, { ...line, sku, variantId });
                        }} options={[
                          { value: "", label: "Chọn SKU / biến thể" },
                          ...(line.sku && !(warehouseProductGroups.find((group) => group.productId === line.productId)?.variants || []).some((variant) => variant.sku === line.sku) ? [{ value: line.sku, label: `${line.sku} (hết tồn)` }] : []),
                          ...(warehouseProductGroups.find((group) => group.productId === line.productId)?.variants || []).map((variant) => ({ value: variant.sku, label: `${variant.sku}${variant.variantName ? ` - ${variant.variantName}` : ""} (tồn ${formatNumber(variant.quantity - variant.reservedQuantity)})` })),
                        ]} />
                    </label>
                  )}

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Số lượng
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) =>
                        onUpdateDraftLine(index, { ...line, quantity: event.target.value })
                      }
                      placeholder={warehouseProductsLoading && outboundOnly ? "Đang tải..." : "0"}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-teal-600"
                    />
                    {outboundOnly && line.sku && (
                      <button
                        type="button"
                        onClick={() => onOpenUnitPicker(index)}
                        className="mt-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                      >
                        {line.unitIdentifiers?.length
                          ? `Đã chọn ${line.unitIdentifiers.length} đơn vị`
                          : "Chọn IMEI / mã vạch"}
                      </button>
                    )}
                  </label>

                  <button
                    type="button"
                    onClick={() => onRemoveDraftLine(index)}
                    className="mt-6 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-rose-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {unitPickerIndex !== null && (
              <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-cyan-900">
                    Chọn IMEI / mã vạch xuất kho
                  </h5>
                  <button
                    type="button"
                    onClick={() => setUnitPickerIndex(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Đóng
                  </button>
                </div>
                {unitPickerLoading ? (
                  <p className="text-xs text-slate-500">Đang tải đơn vị tồn kho...</p>
                ) : (
                  <select
                    multiple
                    value={draftLines[unitPickerIndex]?.unitIdentifiers || []}
                    onChange={(event) =>
                      onUpdateDraftLine(unitPickerIndex, {
                        ...draftLines[unitPickerIndex],
                        unitIdentifiers: Array.from(event.target.selectedOptions)
                          .map((option) => option.value)
                          .slice(0, Number(draftLines[unitPickerIndex]?.quantity) || 0),
                      })
                    }
                    className="min-h-28 w-full rounded-xl border border-cyan-200 bg-white p-2 text-xs"
                  >
                    {unitPickerItems.map((item) => (
                      <option key={item._id} value={item.normalizedInternalBarcode}>
                        {item.internalBarcode}
                        {item.serialNumber ? ` · ${item.serialNumber}` : ""}
                      </option>
                    ))}
                    {selectedUnitsForPicker
                      .filter(
                        (identifier) =>
                          !unitPickerItems.some((item) => item.normalizedInternalBarcode === identifier)
                      )
                      .map((identifier) => (
                        <option key={identifier} value={identifier}>
                          {identifier} · không còn trong kho
                        </option>
                      ))}
                  </select>
                )}
                {selectedUnitsForPicker.length > 0 && (
                  <p className="mt-2 text-xs font-semibold text-cyan-900">
                    Đã chọn ({selectedUnitsForPicker.length}/{requiredUnitCount}):{" "}
                    {selectedUnitsForPicker
                      .map(
                        (identifier) =>
                          unitPickerItems.find((item) => item.normalizedInternalBarcode === identifier)
                            ?.serialNumber || identifier
                      )
                      .join(", ")}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-cyan-800">
                  Phải chọn đủ số lượng đơn vị trước khi lưu phiếu xuất.
                </p>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-teal-800 disabled:opacity-60 transition-colors"
            >
              {submitting
                ? editingLogId
                  ? "Đang cập nhật phiếu..."
                  : "Đang tạo phiếu..."
                : editingLogId
                ? "Cập nhật phiếu"
                : "Lưu phiếu"}
            </button>
          </div>
        </form>
      </div>

      {/* Unit Picker Modal */}
      {unitPickerIndex !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Chọn IMEI / mã vạch</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Đã chọn {selectedUnitsForPicker.length} / {requiredUnitCount} đơn vị
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUnitPickerIndex(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-5">
              <input
                value={unitPickerQuery}
                onChange={(event) => setUnitPickerQuery(event.target.value)}
                placeholder="Tìm IMEI hoặc mã vạch..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-600 focus:bg-white"
              />
              {unitPickerLoading ? (
                <p className="py-8 text-center text-xs text-slate-500">Đang tải đơn vị tồn kho...</p>
              ) : filteredPickerItems.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  Không tìm thấy IMEI / mã vạch phù hợp.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredPickerItems.map((item) => {
                    const value = item.normalizedInternalBarcode;
                    const checked = selectedUnitsForPicker.includes(value);
                    const disabled = !checked && selectedUnitsForPicker.length >= requiredUnitCount;
                    return (
                      <label
                        key={item._id}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                          checked
                            ? "border-cyan-300 bg-cyan-50/70"
                            : "border-slate-200 bg-white"
                        } ${
                          disabled
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer hover:border-cyan-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => {
                            const line = draftLines[unitPickerIndex];
                            if (!line) return;
                            const nextUnits = checked
                              ? selectedUnitsForPicker.filter((u) => u !== value)
                              : [...selectedUnitsForPicker, value];
                            onUpdateDraftLine(unitPickerIndex, {
                              ...line,
                              unitIdentifiers: nextUnits,
                            });
                          }}
                          className="h-4 w-4 accent-cyan-700"
                        />
                        <span className="text-xs font-medium text-slate-800">
                          {item.internalBarcode}
                          {item.serialNumber ? ` · ${item.serialNumber}` : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setUnitPickerIndex(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={selectedUnitsForPicker.length !== requiredUnitCount}
                onClick={() => setUnitPickerIndex(null)}
                className="rounded-xl bg-cyan-700 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Xác nhận lựa chọn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
