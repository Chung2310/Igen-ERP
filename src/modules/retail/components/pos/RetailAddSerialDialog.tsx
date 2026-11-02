import React from "react";
import { cn } from "../../../student-management/lib/utils";
import { inventorySerialService, type InventorySerialUnit } from "../../../../services/inventorySerialService";
import type { RetailProduct } from "../../types";

type Props = {
  product: RetailProduct;
  unavailable: string[];
  onClose: () => void;
  onConfirm: (value: string) => void;
};

export default function RetailAddSerialDialog({ product, unavailable, onClose, onConfirm }: Props) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [items, setItems] = React.useState<InventorySerialUnit[]>([]);
  const [selected, setSelected] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const mode = product.trackingMode === "serial" ? "serial" : "unit_barcode";
  const isSerial = mode === "serial";

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void inventorySerialService.list({
      productId: product.productId || product._id,
      variantId: product.variantId,
      forSale: true,
      status: "in_stock",
      limit: 100,
    }).then((result) => {
      if (active) setItems(result.items);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được mã hàng trong kho.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [product._id, product.productId, product.variantId]);

  const available = items.filter((item) => {
    const value = isSerial ? item.normalizedSerialNumber : item.normalizedInternalBarcode;
    const label = isSerial ? item.serialNumber : item.internalBarcode;
    return Boolean(value) && !unavailable.includes(value) && `${label || ""} ${value}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="retail-add-unit-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-on-surface/50"
    >
      <div className="border-b border-outline-variant p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="retail-add-unit-title" className="text-balance text-lg font-bold">Chọn {isSerial ? "IMEI / Serial" : "mã vạch nội bộ"} để thêm vào giỏ</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{product.name} · {product.sku}</p>
          </div>
          <button type="button" aria-label="Đóng chọn mã hàng" onClick={onClose} className="min-h-10 rounded-lg px-3 text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">Đóng</button>
        </div>
        <label className="mt-4 block text-sm font-medium">
          Tìm mã hàng
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-on-surface focus-visible:outline-2 focus-visible:outline-primary" placeholder="Nhập hoặc quét mã" />
        </label>
      </div>

      <div className="max-h-[50dvh] overflow-y-auto p-5" aria-busy={loading}>
        {loading && <p role="status" className="py-6 text-center text-sm text-on-surface-variant">Đang tải mã hàng còn trong kho…</p>}
        {error && <p role="alert" className="rounded-lg border border-error/40 bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
        {!loading && !error && available.length === 0 && <p className="rounded-lg border border-dashed border-outline-variant p-5 text-center text-sm text-on-surface-variant">Không có mã hàng khả dụng phù hợp.</p>}
        {!loading && !error && available.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Chọn một mã</legend>
            {available.map((item) => {
              const value = isSerial ? item.normalizedSerialNumber : item.normalizedInternalBarcode;
              const label = isSerial ? item.serialNumber : item.internalBarcode;
              return (
                <label key={item._id} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2", selected === value ? "border-primary bg-primary-container/30" : "border-outline-variant hover:bg-surface")}>
                  <input type="radio" name="retail-unit" value={value} checked={selected === value} onChange={() => setSelected(value)} />
                  <span className="font-mono text-sm">{label || value}</span>
                </label>
              );
            })}
          </fieldset>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-outline-variant p-4">
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-outline px-4 font-semibold text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">Hủy</button>
        <button type="button" disabled={!selected || loading || Boolean(error)} onClick={() => onConfirm(selected)} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">Thêm vào giỏ</button>
      </div>
    </dialog>
  );
}
