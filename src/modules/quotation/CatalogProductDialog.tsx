import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, hasQuotationCapability } from "./api";
import MoneyInput from "./MoneyInput";
import VietnameseDatePicker from "./VietnameseDatePicker";
import type { CatalogItem } from "./types";
import type { Notify } from "./Feedback";

export default function CatalogProductDialog({ item, mode, onClose, onSaved, onToast }: { item: CatalogItem; mode: "create" | "edit" | "duplicate"; onClose: () => void; onSaved: (item: CatalogItem) => void; onToast: Notify }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sku, setSku] = useState(item.sku);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [unit, setUnit] = useState(item.unit);
  const [price, setPrice] = useState(String(item.price));
  const [currency, setCurrency] = useState(item.currency);
  const [active, setActive] = useState(item.active);
  const [effectiveFrom, setEffectiveFrom] = useState(item.effectiveFrom ?? "");
  const [effectiveTo, setEffectiveTo] = useState(item.effectiveTo ?? "");
  const [attributes, setAttributes] = useState<Array<{ key: string; value: string }>>(() => Object.entries(item.attributes ?? {}).map(([key, value]) => ({ key, value })));
  const [busy, setBusy] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const report = (message: string) => { setError(message); onToast(message, "error"); };

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (price.trim() === "" || !Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 1e12) {
      report("Đơn giá phải từ 0 đến 1.000.000.000.000 ₫.");
      return;
    }
    const filledAttributes = attributes.filter((attribute) => attribute.key.trim() || attribute.value.trim());
    if (filledAttributes.some((attribute) => !attribute.key.trim() || !attribute.value.trim())) {
      report("Hãy nhập đủ tên trường và giá trị cho từng thuộc tính riêng.");
      return;
    }
    const attributeKeys = filledAttributes.map((attribute) => attribute.key.trim().toLocaleLowerCase("vi"));
    if (new Set(attributeKeys).size !== attributeKeys.length) {
      report("Tên thuộc tính riêng không được trùng nhau.");
      return;
    }
    if (filledAttributes.length > 50) {
      report("Mỗi sản phẩm lưu tối đa 50 thuộc tính riêng.");
      return;
    }
    const customAttributes = Object.fromEntries(filledAttributes.map((attribute) => [attribute.key.trim(), attribute.value.trim()]));
    setBusy(true); setError("");
    try {
      const result = await api<{ item: CatalogItem }>(mode === "create" ? "/api/catalog" : `/api/catalog/${encodeURIComponent(item._id)}${mode === "duplicate" ? "/duplicate" : ""}`, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Idempotency-Key": requestKey, ...(mode === "edit" && item.updatedAt ? { "If-Unmodified-Since": item.updatedAt } : {}) },
        body: JSON.stringify({ ...(mode === "duplicate" ? { sourceUpdatedAt: item.updatedAt } : {}), sku, name, description, unit, price: Number(price), currency, active, effectiveFrom, effectiveTo, attributes: customAttributes }),
      });
      onSaved(result.item);
    } catch (cause) {
      report(cause instanceof Error ? cause.message : "Không thể lưu sản phẩm.");
    } finally { setBusy(false); }
  };

  return <dialog ref={dialog} className="template-dialog price-list-edit-dialog" aria-labelledby="edit-product-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="settings-card-heading"><div><h2 id="edit-product-title">{mode === "create" ? "Thêm sản phẩm" : mode === "duplicate" ? "Nhân bản sản phẩm" : "Sửa sản phẩm"}</h2><p className="settings-hint">Thay đổi sẽ được dùng cho các báo giá mới.</p></div><button type="button" className="icon-button" aria-label="Đóng cửa sổ sửa sản phẩm" disabled={busy} onClick={onClose}>×</button></div>
    {error && <p className="form-error" id="catalog-product-error" role="alert">{error}</p>}
    <form aria-describedby={error ? "catalog-product-error" : undefined} className="email-settings-form price-list-edit-form" onSubmit={(event) => void save(event)} aria-busy={busy}>
      <label>Mã hàng<input autoFocus required maxLength={100} value={sku} disabled={busy} onChange={(event) => setSku(event.target.value)} /></label>
      <label>Tên sản phẩm<input required maxLength={250} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} /></label>
      <label>Quy cách / thông số<textarea maxLength={2000} rows={3} value={description} disabled={busy} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="price-list-edit-grid">
        <label>Đơn vị<input required maxLength={50} value={unit} disabled={busy} onChange={(event) => setUnit(event.target.value)} /></label>
        <label>Đơn giá<MoneyInput required value={price} currency={currency} disabled={busy} onChange={setPrice} /></label>
        <label>Tiền tệ<input required maxLength={3} minLength={3} value={currency} disabled={busy} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
        <div className="price-list-date-field"><label htmlFor="product-effective-from">Hiệu lực từ</label><VietnameseDatePicker id="product-effective-from" label="Hiệu lực từ" value={effectiveFrom} disabled={busy} onChange={setEffectiveFrom} /></div>
        <div className="price-list-date-field"><label htmlFor="product-effective-to">Hiệu lực đến</label><VietnameseDatePicker id="product-effective-to" label="Hiệu lực đến" value={effectiveTo} disabled={busy} onChange={setEffectiveTo} /></div>
      </div>
      <section className="price-list-edit-attributes">
        <div className="price-list-custom-heading"><strong>Thuộc tính riêng</strong><button type="button" className="text-button" disabled={busy || attributes.length >= 50} onClick={() => setAttributes((current) => [...current, { key: "", value: "" }])}>+ Thêm trường</button></div>
        {attributes.map((attribute, index) => <div className="price-list-custom-field" key={index}>
          <input aria-label={`Tên thuộc tính ${index + 1}`} maxLength={100} placeholder="Tên trường" value={attribute.key} disabled={busy} onChange={(event) => setAttributes((current) => current.map((entry, row) => row === index ? { ...entry, key: event.target.value } : entry))} />
          <input aria-label={`Giá trị thuộc tính ${index + 1}`} maxLength={500} placeholder="Giá trị" value={attribute.value} disabled={busy} onChange={(event) => setAttributes((current) => current.map((entry, row) => row === index ? { ...entry, value: event.target.value } : entry))} />
          <button type="button" className="icon-button" aria-label={`Xóa thuộc tính ${index + 1}`} disabled={busy} onClick={() => setAttributes((current) => current.filter((_, row) => row !== index))}>×</button>
        </div>)}
      </section>
      <label className="price-list-active-toggle"><input type="checkbox" checked={active} disabled={busy} onChange={(event) => setActive(event.target.checked)} /><span>Sản phẩm đang áp dụng báo giá</span></label>
      <div className="preview-actions"><button type="button" className="button button-soft" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="button button-primary" disabled={!hasQuotationCapability("quotation-price-book:manage") || (busy)}>{busy ? "Đang lưu…" : mode === "edit" ? "Lưu thay đổi" : "Tạo sản phẩm"}</button></div>
    </form>
  </dialog>;
}
