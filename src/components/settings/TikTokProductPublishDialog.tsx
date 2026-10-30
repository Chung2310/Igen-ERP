import React from "react";
import { Check, ChevronDown, Loader2, PackagePlus, Search, X } from "lucide-react";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import {
  tiktokShopApi,
  type TikTokCatalogProduct,
  type TikTokListingAttribute,
  type TikTokShopConnection,
} from "../../services/tiktokShopService";

type TikTokProductPublishDialogProps = {
  connections: TikTokShopConnection[];
  onClose: () => void;
  onPublished: () => Promise<void> | void;
};

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 disabled:bg-slate-100";
const labelClass = "block text-xs font-semibold text-slate-700";

export default function TikTokProductPublishDialog({ connections, onClose, onPublished }: TikTokProductPublishDialogProps) {
  const shopChoices = React.useMemo(() => connections.flatMap((connection) => connection.shops.map((shop) => ({
    key: `${connection.id}:${shop.cipher}`,
    connectionId: connection.id,
    shop,
  }))), [connections]);
  const [selectedShopKey, setSelectedShopKey] = React.useState(shopChoices[0]?.key || "");
  const selectedShop = shopChoices.find((choice) => choice.key === selectedShopKey);
  const [catalog, setCatalog] = React.useState<TikTokCatalogProduct[]>([]);
  const [categories, setCategories] = React.useState<Array<{ id: string; name: string; parentId: string }>>([]);
  const [warehouses, setWarehouses] = React.useState<Array<{ id: string; name: string; type?: string }>>([]);
  const [attributes, setAttributes] = React.useState<TikTokListingAttribute[]>([]);
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [categorySearch, setCategorySearch] = React.useState("");
  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [activeCategoryIndex, setActiveCategoryIndex] = React.useState(0);
  const categoryPickerRef = React.useRef<HTMLDivElement>(null);
  const [attributeValues, setAttributeValues] = React.useState<Record<string, { valueId?: string; valueName?: string }>>({});
  const [prices, setPrices] = React.useState<Record<string, string>>({});
  const [salesNames, setSalesNames] = React.useState<Record<string, string>>({});
  const [brandId, setBrandId] = React.useState("");
  const [packageWeightGrams, setPackageWeightGrams] = React.useState("");
  const [packageLengthCm, setPackageLengthCm] = React.useState("");
  const [packageWidthCm, setPackageWidthCm] = React.useState("");
  const [packageHeightCm, setPackageHeightCm] = React.useState("");
  const [catalogLoading, setCatalogLoading] = React.useState(true);
  const [categoriesLoading, setCategoriesLoading] = React.useState(false);
  const [warehousesLoading, setWarehousesLoading] = React.useState(false);
  const [warehouseLoadError, setWarehouseLoadError] = React.useState(false);
  const [warehouseRetry, setWarehouseRetry] = React.useState(0);
  const [attributesLoading, setAttributesLoading] = React.useState(false);
  const [attributesLoadError, setAttributesLoadError] = React.useState(false);
  const [attributesRetry, setAttributesRetry] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const selectedProduct = catalog.find((product) => product._id === selectedProductId);
  const selectedCategory = categories.find((category) => category.id === categoryId);

  React.useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    void tiktokShopApi.catalogProducts().then((result) => {
      if (!active) return;
      setCatalog(result.items);
      setSelectedProductId(result.items[0]?._id || "");
    }).catch((error) => {
      if (active) toast.error(getApiErrorMessage(error, "Không thể tải sản phẩm trong kho nội bộ."));
    }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    if (!selectedShop) {
      setCategories([]);
      setCategoryId("");
      setAttributes([]);
      setAttributeValues({});
      setCategoriesLoading(false);
      return;
    }
    let active = true;
    setCategoriesLoading(true);
    setCategories([]);
    setCategoryId("");
    setAttributes([]);
    setAttributeValues({});
    void tiktokShopApi.listingCategories(selectedShop.connectionId, selectedShop.shop.cipher).then((result) => {
      if (active) setCategories(result.categories);
    }).catch((error) => {
      if (active) toast.error(getApiErrorMessage(error, "Không thể tải danh mục TikTok."));
    }).finally(() => { if (active) setCategoriesLoading(false); });
    return () => { active = false; };
  }, [selectedShopKey, selectedShop?.connectionId, selectedShop?.shop.cipher]);

  React.useEffect(() => {
    if (!selectedShop) {
      setWarehouses([]);
      setWarehouseId("");
      setWarehouseLoadError(false);
      setWarehousesLoading(false);
      return;
    }
    let active = true;
    setWarehousesLoading(true);
    setWarehouseLoadError(false);
    setWarehouses([]);
    setWarehouseId("");
    void tiktokShopApi.listingWarehouses(selectedShop.connectionId, selectedShop.shop.cipher).then((result) => {
      if (!active) return;
      setWarehouses(result.warehouses);
      setWarehouseId(result.warehouses[0]?.id || "");
    }).catch((error) => {
      if (!active) return;
      setWarehouseLoadError(true);
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách kho TikTok."));
    }).finally(() => { if (active) setWarehousesLoading(false); });
    return () => { active = false; };
  }, [selectedShopKey, selectedShop?.connectionId, selectedShop?.shop.cipher, warehouseRetry]);

  React.useEffect(() => {
    if (!selectedProduct) return;
    setTitle(selectedProduct.name);
    setDescription(selectedProduct.description || "");
    setPrices(Object.fromEntries(selectedProduct.variants.map((variant) => [variant._id, variant.sellingPrice > 0 ? String(variant.sellingPrice) : ""])));
    setPackageWeightGrams(String(Math.max(...selectedProduct.variants.map((variant) => variant.weightGrams || 0)) || ""));
    setPackageLengthCm(String(Math.max(...selectedProduct.variants.map((variant) => variant.lengthMm || 0)) / 10 || ""));
    setPackageWidthCm(String(Math.max(...selectedProduct.variants.map((variant) => variant.widthMm || 0)) / 10 || ""));
    setPackageHeightCm(String(Math.max(...selectedProduct.variants.map((variant) => variant.heightMm || 0)) / 10 || ""));
    setBrandId("");
    const codes = [...new Set(selectedProduct.variants.flatMap((variant) => variant.optionValues.map((option) => option.code)))];
    setSalesNames(Object.fromEntries(codes.map((code) => [code.toUpperCase(), code.slice(0, 20)])));
  }, [selectedProductId]);

  React.useEffect(() => {
    if (!selectedShop || !categoryId) {
      setAttributes([]);
      setAttributeValues({});
      setAttributesLoading(false);
      setAttributesLoadError(false);
      return;
    }
    let active = true;
    setAttributesLoading(true);
    setAttributesLoadError(false);
    setAttributeValues({});
    void tiktokShopApi.listingAttributes(selectedShop.connectionId, selectedShop.shop.cipher, categoryId).then((result) => {
      if (active) setAttributes(result.attributes);
    }).catch((error) => {
      if (active) {
        setAttributesLoadError(true);
        toast.error(getApiErrorMessage(error, "Không thể tải thuộc tính của danh mục TikTok."));
      }
    }).finally(() => { if (active) setAttributesLoading(false); });
    return () => { active = false; };
  }, [selectedShopKey, categoryId, attributesRetry]);

  React.useEffect(() => {
    if (!categoryOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!categoryPickerRef.current?.contains(event.target as Node)) {
        setCategoryOpen(false);
        setCategorySearch("");
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [categoryOpen]);

  const salesCodes = selectedProduct
    ? [...new Set(selectedProduct.variants.flatMap((variant) => variant.optionValues.map((option) => option.code.trim().toUpperCase()).filter(Boolean)))].slice(0, 3)
    : [];
  const productAttributes = attributes.filter((attribute) => !attribute.isSales);
  const requiredAttributes = productAttributes.filter((attribute) => attribute.required);
  const matchingCategories = categories.filter((category) => category.name.toLocaleLowerCase("vi-VN").includes(categorySearch.trim().toLocaleLowerCase("vi-VN")));
  const filteredCategories = matchingCategories.slice(0, 300);
  const region = String(selectedShop?.shop.region || "").toUpperCase();
  const minTitleLength = ["DE", "ES", "FR", "IE", "IT", "JP", "UK", "GB", "US", "MX"].includes(region) ? 1 : 25;
  const maxTitleLength = region === "MX" ? 300 : 255;

  const missingRequiredFields: string[] = [];
  if (!selectedShop) missingRequiredFields.push("chọn shop TikTok");
  if (!selectedProduct) missingRequiredFields.push("chọn sản phẩm trong kho");
  if (!title.trim() || title.trim().length < minTitleLength || title.trim().length > maxTitleLength) {
    missingRequiredFields.push(`tên sản phẩm từ ${minTitleLength} đến ${maxTitleLength} ký tự`);
  }
  if (!description.trim()) missingRequiredFields.push("mô tả sản phẩm");
  if (selectedProduct && !selectedProduct.mediaIds.length) missingRequiredFields.push("ít nhất 1 ảnh sản phẩm");
  if (!categoryId) missingRequiredFields.push("danh mục TikTok");
  if (!warehouseId) missingRequiredFields.push("kho TikTok");
  if (categoryId && attributesLoadError) missingRequiredFields.push("tải được thuộc tính của danh mục TikTok (hãy chọn lại danh mục)");
  if (categoryId && !attributesLoading && !attributesLoadError) {
    for (const attribute of requiredAttributes) {
      const value = attributeValues[attribute.id];
      const hasAllowedValues = attribute.values.some((option) => option.id);
      const isValid = hasAllowedValues
        ? Boolean(value?.valueId && attribute.values.some((option) => option.id === value.valueId))
        : Boolean(value?.valueName?.trim());
      if (!isValid) missingRequiredFields.push(`thuộc tính “${attribute.name}”`);
    }
  }
  for (const code of salesCodes) {
    if (!salesNames[code]?.trim()) missingRequiredFields.push(`tên phân loại SKU ${code}`);
  }
  for (const variant of selectedProduct?.variants || []) {
    const price = Number(prices[variant._id]);
    if (!Number.isFinite(price) || price <= 0) missingRequiredFields.push(`giá bán hợp lệ cho SKU ${variant.sku}`);
  }
  if (!Number.isFinite(Number(packageWeightGrams)) || Number(packageWeightGrams) <= 0) missingRequiredFields.push("trọng lượng gói lớn hơn 0 gram");
  const dimensionValues = [packageLengthCm, packageWidthCm, packageHeightCm];
  if (dimensionValues.some((value) => value.trim()) && dimensionValues.some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0)) {
    missingRequiredFields.push("điền đủ dài, rộng và cao của gói hàng nếu khai báo kích thước");
  }

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (missingRequiredFields.length) {
      toast.error(`Vui lòng hoàn tất: ${missingRequiredFields.join("; ")}.`);
      return;
    }
    if (!selectedProduct || !selectedShop) return;
    setSubmitting(true);
    try {
      const productAttributes = attributes.flatMap((attribute) => {
        const selected = attributeValues[attribute.id];
        if (!selected?.valueId && !selected?.valueName?.trim()) return [];
        return [{ id: attribute.id, name: attribute.name, valueId: selected.valueId, valueName: selected.valueName?.trim() }];
      });
      const result = await tiktokShopApi.publishProduct({
        productId: selectedProduct._id,
        title: title.trim(),
        description: description.trim(),
        connectionId: selectedShop.connectionId,
        shopCipher: selectedShop.shop.cipher,
        categoryId,
        categoryName: categories.find((category) => category.id === categoryId)?.name || "",
        warehouseId,
        brandId: brandId.trim(),
        packageWeightGrams: Number(packageWeightGrams),
        packageDimensions: {
          lengthCm: Number(packageLengthCm) || 0,
          widthCm: Number(packageWidthCm) || 0,
          heightCm: Number(packageHeightCm) || 0,
        },
        productAttributes,
        salesAttributes: salesCodes.map((code) => ({ code, name: salesNames[code] || code })),
        prices: selectedProduct.variants.map((variant) => ({ variantId: variant._id, amount: Number(prices[variant._id]) })),
      });
      const currentStatus = String(result.status || "PENDING").toUpperCase();
      const awaitingReview = ["PENDING", "PENDING_REVIEW", "PENDING_APPROVAL", "WAITING_FOR_REVIEW", "UNDER_REVIEW", "IN_REVIEW"].includes(currentStatus);
      toast.success(result.linked
        ? `Đã gửi sản phẩm lên TikTok Shop và ghép ${result.skus || selectedProduct.variants.length} SKU. Trạng thái: ${awaitingReview ? "đang chờ TikTok Shop duyệt" : result.status}. ${awaitingReview ? "Sản phẩm chưa được mở bán trên TikTok Shop trong thời gian chờ duyệt." : ""}`
        : `TikTok Shop đã nhận sản phẩm. Trạng thái: ${awaitingReview ? "đang chờ duyệt" : result.status || "đang chờ duyệt"}. ${awaitingReview ? "Sản phẩm chưa được mở bán trên TikTok Shop trong thời gian chờ duyệt. " : ""}Hãy đồng bộ danh sách TikTok để hoàn tất liên kết SKU.`);
      await Promise.resolve(onPublished()).catch((error) => toast.error(getApiErrorMessage(error, "Đã gửi sản phẩm nhưng chưa tải lại được danh sách TikTok.")));
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể đăng sản phẩm lên TikTok Shop."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="tiktok-product-publish-title" className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div><h2 id="tiktok-product-publish-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><PackagePlus className="h-5 w-5 text-pink-600" />Đăng sản phẩm mới lên TikTok Shop</h2><p className="mt-1 text-xs text-slate-500">Chọn sản phẩm chưa liên kết, hoàn tất thông tin theo danh mục và kho của shop.</p></div>
          <button type="button" disabled={submitting} onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </header>

        <form noValidate onSubmit={publish} className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Shop TikTok
              <select className={fieldClass} value={selectedShopKey} onChange={(event) => setSelectedShopKey(event.target.value)} required>
                {shopChoices.map((choice) => <option key={choice.key} value={choice.key}>{choice.shop.name}{choice.shop.region ? ` · ${choice.shop.region}` : ""}</option>)}
              </select>
            </label>
            <label className={labelClass}>Sản phẩm trong kho nội bộ
              <select className={fieldClass} value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} disabled={catalogLoading || !catalog.length} required>
                {catalogLoading ? <option value="">Đang tải sản phẩm…</option> : !catalog.length ? <option value="">Không có sản phẩm mới đủ điều kiện</option> : catalog.map((product) => <option key={product._id} value={product._id}>{product.name} · {product.variants.length} SKU</option>)}
              </select>
            </label>
          </div>

          {selectedProduct && <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><strong>{selectedProduct.name}</strong><span className="mx-2">·</span>{selectedProduct.description ? "Đã có mô tả" : "Thiếu mô tả"}<span className="mx-2">·</span>{selectedProduct.mediaIds.length ? `${selectedProduct.mediaIds.length} ảnh` : "Thiếu ảnh"}</div>}

          {selectedProduct && <div className="grid gap-4">
            <label className={labelClass}>Tên sản phẩm hiển thị trên TikTok
              <input className={fieldClass} required minLength={minTitleLength} maxLength={maxTitleLength} value={title} onChange={(event) => setTitle(event.target.value)} />
              <span className="mt-1 block font-normal text-slate-500">Tên cần từ {minTitleLength} đến {maxTitleLength} ký tự theo khu vực shop.</span>
            </label>
            <label className={labelClass}>Mô tả sản phẩm<textarea className={`${fieldClass} min-h-32`} required maxLength={10_000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Nhập mô tả sản phẩm bằng ngôn ngữ phù hợp với shop TikTok." /></label>
          </div>}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="tiktok-category-search">Danh mục lá có thể đăng</label>
                <div className="relative mt-1" ref={categoryPickerRef}>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="tiktok-category-search"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={categoryOpen}
                    aria-controls="tiktok-category-options"
                    aria-activedescendant={categoryOpen && filteredCategories[activeCategoryIndex] ? `tiktok-category-option-${activeCategoryIndex}` : undefined}
                    aria-required="true"
                    aria-invalid={!categoryId}
                    className={`${fieldClass} pl-9 pr-9`}
                    value={categoryOpen ? categorySearch : selectedCategory?.name || ""}
                    onFocus={() => { setCategoryOpen(true); setActiveCategoryIndex(0); }}
                    onChange={(event) => { setCategoryId(""); setCategorySearch(event.target.value); setCategoryOpen(true); setActiveCategoryIndex(0); }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setCategoryOpen(true);
                        setActiveCategoryIndex((current) => Math.min(categoryOpen ? current + 1 : 0, Math.max(filteredCategories.length - 1, 0)));
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setCategoryOpen(true);
                        setActiveCategoryIndex((current) => Math.max(categoryOpen ? current - 1 : 0, 0));
                      } else if (event.key === "Enter" && categoryOpen && filteredCategories.length) {
                        event.preventDefault();
                        const category = filteredCategories[activeCategoryIndex] || filteredCategories[0];
                        setCategoryId(category.id);
                        setCategorySearch("");
                        setCategoryOpen(false);
                      } else if (event.key === "Escape") {
                        setCategoryOpen(false);
                        setCategorySearch("");
                      }
                    }}
                    placeholder={categoriesLoading ? "Đang tải danh mục…" : "Tìm hoặc chọn danh mục TikTok"}
                    disabled={categoriesLoading || !categories.length}
                  />
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  {categoryOpen && <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    {filteredCategories.length ? <div id="tiktok-category-options" role="listbox" aria-label="Danh mục TikTok">
                      {filteredCategories.map((category, index) => <div
                        id={`tiktok-category-option-${index}`}
                        key={category.id}
                        role="option"
                        aria-selected={category.id === categoryId}
                        onMouseEnter={() => setActiveCategoryIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => { setCategoryId(category.id); setCategorySearch(""); setCategoryOpen(false); }}
                        className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm ${activeCategoryIndex === index ? "bg-pink-50 text-pink-800" : "text-slate-700 hover:bg-slate-50"}`}
                      >{category.name}{category.id === categoryId && <Check className="ml-2 h-4 w-4 shrink-0 text-pink-600" />}</div>)}
                    </div> : <p className="px-3 py-2 text-xs text-slate-500">Không tìm thấy danh mục phù hợp.</p>}
                  </div>}
                </div>
              {matchingCategories.length > filteredCategories.length && <p className="mt-1 text-[11px] text-slate-500">Đang hiện tối đa 300 kết quả phù hợp; nhập thêm từ khóa để lọc.</p>}
            </div>
            <label className={labelClass}>Kho TikTok nhận tồn
              <select className={fieldClass} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required disabled={warehousesLoading || !warehouses.length}>
                <option value="">{warehousesLoading ? "Đang tải kho…" : "Chọn kho TikTok"}</option>
                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.type ? ` · ${warehouse.type}` : ""}</option>)}
              </select>
              {!warehousesLoading && !warehouses.length && (warehouseLoadError
                ? <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-rose-700">Không tải được danh sách kho từ TikTok. <button type="button" onClick={() => setWarehouseRetry((current) => current + 1)} className="font-bold underline">Thử tải lại</button></p>
                : <p className="mt-1 text-[11px] text-amber-700">Shop chưa có kho khả dụng. Hãy tạo kho trong Seller Center trước.</p>)}
            </label>
          </div>

          {categoryId && <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div><h3 className="text-sm font-bold text-slate-800">Thuộc tính danh mục</h3><p className="mt-1 text-[11px] text-slate-500">Các thuộc tính do TikTok cung cấp cho danh mục đã chọn. Trường có dấu * là bắt buộc.</p></div>
            {attributesLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : attributesLoadError ? <p className="flex flex-wrap items-center gap-2 text-xs text-rose-700">Không tải được thuộc tính danh mục. <button type="button" onClick={() => setAttributesRetry((current) => current + 1)} className="font-bold underline">Thử tải lại</button></p> : productAttributes.length ? <div className="grid gap-3 sm:grid-cols-2">{productAttributes.map((attribute) => <label key={attribute.id} className={labelClass}>{attribute.name}{attribute.required && <span className="text-rose-600"> *</span>}
              {attribute.values.some((value) => value.id) ? <select className={fieldClass} required={attribute.required} value={attributeValues[attribute.id]?.valueId || ""} onChange={(event) => {
                const option = attribute.values.find((value) => value.id === event.target.value);
                setAttributeValues((current) => ({ ...current, [attribute.id]: { valueId: event.target.value, valueName: option?.name || "" } }));
              }}><option value="">{`Chọn ${attribute.name.toLowerCase()}${attribute.required ? " *" : " (nếu có)"}`}</option>{attribute.values.filter((value) => value.id).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select>
                : <input className={fieldClass} required={attribute.required} maxLength={50} value={attributeValues[attribute.id]?.valueName || ""} onChange={(event) => setAttributeValues((current) => ({ ...current, [attribute.id]: { valueName: event.target.value } }))} placeholder={attribute.required ? `Nhập ${attribute.name.toLowerCase()}` : `Nhập ${attribute.name.toLowerCase()} (nếu có)`} />}
            </label>)}</div> : <p className="text-xs text-slate-500">TikTok không trả về thuộc tính cho danh mục này.</p>}
          </section>}

          {!!salesCodes.length && <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div><h3 className="text-sm font-bold text-slate-800">Phân loại SKU</h3><p className="mt-1 text-[11px] text-slate-500">Giá trị lấy từ các biến thể nội bộ; đặt tên thuộc tính theo TikTok Shop.</p></div>
            <div className="grid gap-3 sm:grid-cols-3">{salesCodes.map((code) => <label key={code} className={labelClass}>Tên thuộc tính · {code}
              <input className={fieldClass} maxLength={50} required value={salesNames[code] || ""} onChange={(event) => setSalesNames((current) => ({ ...current, [code]: event.target.value }))} />
            </label>)}</div>
          </section>}

          {selectedProduct && <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div><h3 className="text-sm font-bold text-slate-800">Giá bán và tồn kho ban đầu</h3><p className="mt-1 text-[11px] text-slate-500">Tồn được lấy từ kho nội bộ; kiểm tra giá trước khi gửi.</p></div>
            <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2 pr-3">SKU</th><th className="pb-2 pr-3">Biến thể</th><th className="pb-2 pr-3">Tồn kho</th><th className="pb-2">Giá bán</th></tr></thead><tbody>{selectedProduct.variants.map((variant) => <tr key={variant._id} className="border-t border-slate-100"><td className="py-2 pr-3 font-semibold text-slate-800">{variant.sku}</td><td className="py-2 pr-3 text-slate-600">{variant.displayName || "—"}</td><td className="py-2 pr-3 text-slate-600">{variant.stock}</td><td className="py-2"><input className="w-36 rounded-md border border-slate-300 px-2 py-1.5" type="number" min="0.01" step="any" required value={prices[variant._id] || ""} onChange={(event) => setPrices((current) => ({ ...current, [variant._id]: event.target.value }))} aria-label={`Giá bán SKU ${variant.sku}`} /></td></tr>)}</tbody></table></div>
          </section>}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className={labelClass}>Trọng lượng gói (gram)<input className={fieldClass} type="number" min="1" step="1" required value={packageWeightGrams} onChange={(event) => setPackageWeightGrams(event.target.value)} /></label>
            <label className={labelClass}>Dài (cm, nếu có)<input className={fieldClass} type="number" min="0" step="0.1" value={packageLengthCm} onChange={(event) => setPackageLengthCm(event.target.value)} /></label>
            <label className={labelClass}>Rộng (cm, nếu có)<input className={fieldClass} type="number" min="0" step="0.1" value={packageWidthCm} onChange={(event) => setPackageWidthCm(event.target.value)} /></label>
            <label className={labelClass}>Cao (cm, nếu có)<input className={fieldClass} type="number" min="0" step="0.1" value={packageHeightCm} onChange={(event) => setPackageHeightCm(event.target.value)} /></label>
          </div>
          <label className={`${labelClass} block`}>ID thương hiệu TikTok (nếu có)<input className={fieldClass} value={brandId} onChange={(event) => setBrandId(event.target.value)} placeholder="Để trống nếu không dùng thương hiệu đã đăng ký" /></label>

          <section className={`rounded-lg border p-3 text-xs ${missingRequiredFields.length ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} aria-live="polite">
            <p className="font-bold">Thông tin cần có trước khi gửi</p>
            <p className="mt-1">Shop, sản phẩm, tên và mô tả, ít nhất 1 ảnh, danh mục, kho, thuộc tính bắt buộc, giá từng SKU và trọng lượng gói. Kích thước gói có thể để trống; nếu nhập thì cần đủ dài, rộng, cao.</p>
            {missingRequiredFields.length > 0
              ? <p className="mt-1"><strong>Cần bổ sung:</strong> {missingRequiredFields.join("; ")}.</p>
              : <p className="mt-1 font-semibold">Đã điền đủ các thông tin bắt buộc.</p>}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="max-w-xl text-[11px] text-slate-500">TikTok sẽ xét duyệt thông tin sản phẩm sau khi nhận. Ảnh cần là ảnh đã tải lên Cloudinary của hệ thống.</p>
            <div className="flex gap-2"><button type="button" disabled={submitting} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button><button type="submit" disabled={submitting || catalogLoading || categoriesLoading || warehousesLoading || attributesLoading} className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-bold text-white hover:bg-pink-700 disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}Gửi lên TikTok</button></div>
          </div>
        </form>
      </section>
    </div>
  );
}
