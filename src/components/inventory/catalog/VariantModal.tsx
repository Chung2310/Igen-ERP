import React, { useState, useMemo, useEffect } from "react";
import { toast } from "../../../pages/Toast";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import {
  type CatalogProductDetail,
  type ProductTrackingMode,
  type ProductVariant,
  type VariantInput,
  productCatalogService,
} from "../../../services/productCatalogService";
import { generateEAN13 } from "../../../hooks/useVariantMatrix";
import { emptyVariant, inputClassName } from "./catalogConstants";
import { Field, ImageUploadBox, Modal, ModalActions, NumberInput } from "./catalogUi";
import { Dropdown, type DropdownOption } from "../../common/Dropdown";

interface VariantModalProps {
  product: CatalogProductDetail;
  variant?: ProductVariant;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function VariantModal({ product, variant: initialVariant, onClose, onSaved }: VariantModalProps) {
  const [variant, setVariant] = useState<VariantInput>(() =>
    initialVariant
      ? {
          ...initialVariant,
          barcode: initialVariant.barcode || "",
          displayName: initialVariant.displayName || "",
          mediaIds: initialVariant.mediaIds || [],
          sellingPrice: (initialVariant as any).sellingPrice !== undefined ? Number((initialVariant as any).sellingPrice) : 0,
          costPrice: (initialVariant as any).costPrice !== undefined ? Number((initialVariant as any).costPrice) : 0,
        }
      : emptyVariant(product.baseUnitCode, product.productType)
  );
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(initialVariant);

  useEffect(() => {
    if (initialVariant) {
      setVariant({
        ...initialVariant,
        barcode: initialVariant.barcode || "",
        displayName: initialVariant.displayName || "",
        mediaIds: initialVariant.mediaIds || [],
        sellingPrice: (initialVariant as any).sellingPrice !== undefined ? Number((initialVariant as any).sellingPrice) : 0,
        costPrice: (initialVariant as any).costPrice !== undefined ? Number((initialVariant as any).costPrice) : 0,
      });
    }
  }, [initialVariant?._id]);

  useEffect(() => {
    if (!initialVariant?._id) return;
    void productCatalogService
      .listPrices()
      .then((prices) => {
        const found = prices.find((p) => p.variantId === initialVariant._id);
        if (found) {
          setVariant((curr) => ({
            ...curr,
            sellingPrice: Number(found.sellingPrice ?? curr.sellingPrice ?? 0),
            costPrice: Number(found.costPrice ?? curr.costPrice ?? 0),
          }));
        }
      })
      .catch(() => {});
  }, [initialVariant?._id]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const generatedSku = variant.sku.trim() || `${product.productCode || "SKU"}-${generateEAN13().slice(6)}`;
      const payload = {
        ...variant,
        sku: generatedSku,
        trackingMode: product.productType === "service" ? "none" : variant.trackingMode,
      };

      if (initialVariant) {
        const {
          sellingPrice: _sellingPrice,
          costPrice: _costPrice,
          _id: _id,
          productId: _productId,
          companyCode: _companyCode,
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          createdBy: _createdBy,
          updatedBy: _updatedBy,
          ...update
        } = payload as any;
        await productCatalogService.updateVariant(initialVariant._id, update);
        if (product.status === "active") {
          if (variant.costPrice) {
            await productCatalogService.upsertPrice(initialVariant._id, Number(variant.sellingPrice || 0), Number(variant.costPrice));
          } else {
            await productCatalogService.upsertPrice(initialVariant._id, Number(variant.sellingPrice || 0));
          }
        }
        toast.success("Đã cập nhật SKU.");
      } else {
        const created = await productCatalogService.createVariant(product._id, payload);
        if (variant.costPrice) {
          await productCatalogService.upsertPrice(created._id, Number(variant.sellingPrice || 0), Number(variant.costPrice));
        } else {
          await productCatalogService.upsertPrice(created._id, Number(variant.sellingPrice || 0));
        }
        toast.success("Đã thêm mã SKU.");
      }
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, isEditing ? "Không thể cập nhật SKU." : "Không thể thêm mã SKU."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={isEditing ? `Chỉnh sửa SKU: ${initialVariant?.sku || variant.sku || product.name}` : `Thêm một SKU cho ${product.name}`} onClose={onClose} stacked>
      <form onSubmit={submit} className="space-y-4">
        {!isEditing && (
          <div className="rounded-lg bg-cyan-50/80 border border-cyan-200/80 p-2.5 text-xs text-cyan-800">
            💡 <strong>Mẹo:</strong> Để tạo tự động nhiều biến thể theo Màu sắc, Dung lượng, bạn có thể đóng cửa sổ này và dùng tab <strong>"Tạo thêm biến thể bằng Ma trận"</strong> trong form sản phẩm.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Giá bán (₫) *">
            <NumberInput
              value={variant.sellingPrice || 0}
              onChange={(value) => setVariant((current) => ({ ...current, sellingPrice: value }))}
              className={inputClassName("font-semibold text-cyan-700")}
              placeholder="Nhập giá bán"
            />
          </Field>
          <Field label="Giá vốn (₫)">
            <NumberInput
              value={variant.costPrice || 0}
              onChange={(value) => setVariant((current) => ({ ...current, costPrice: value }))}
              className={inputClassName()}
              placeholder="0 ₫"
            />
          </Field>
        </div>
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-24">
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Ảnh</label>
            <ImageUploadBox
              value={variant.mediaIds?.[0]}
              onChange={(url) => setVariant((current) => ({ ...current, mediaIds: [url] }))}
              className="w-full aspect-square"
            />
          </div>
          <div className="flex-grow space-y-4">
            <Field label="Mã SKU">
              <input
                value={variant.sku}
                onChange={(event) => setVariant((current) => ({ ...current, sku: event.target.value }))}
                className={inputClassName("font-mono font-medium")}
                placeholder="Tự sinh nếu để trống"
              />
            </Field>
            <Field label="Mã vạch">
              <input
                value={variant.barcode || ""}
                onChange={(event) => setVariant((current) => ({ ...current, barcode: event.target.value }))}
                className={inputClassName("font-mono")}
              />
            </Field>
          </div>
        </div>
        <Field label="Tên biến thể">
          <input
            value={variant.displayName || ""}
            onChange={(event) => setVariant((current) => ({ ...current, displayName: event.target.value }))}
            className={inputClassName()}
            placeholder="VD: Titan Sa Mạc / 256GB / Mới 100%"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Theo dõi kho">
            <Dropdown<ProductTrackingMode>
              disabled={product.productType === "service"}
              value={product.productType === "service" ? "none" : variant.trackingMode}
              onChange={(val) => setVariant((current) => ({ ...current, trackingMode: val }))}
              options={[
                { value: "serial", label: "Theo số sê-ri / IMEI" },
                { value: "quantity", label: "Theo số lượng" },
                { value: "unit_barcode", label: "Theo mã vạch đơn vị" },
                { value: "lot", label: "Theo lô" },
                { value: "none", label: "Không theo dõi" },
              ]}
              variant="form"
              size="md"
              className="w-full"
              triggerClassName="w-full text-xs font-medium"
            />
          </Field>
          <Field label="Trạng thái">
            <Dropdown<VariantInput["status"]>
              value={variant.status}
              onChange={(val) => setVariant((current) => ({ ...current, status: val }))}
              options={[
                { value: "active", label: "Đang dùng", icon: <span className="h-2 w-2 rounded-full bg-emerald-500" /> },
                { value: "inactive", label: "Ngừng dùng", icon: <span className="h-2 w-2 rounded-full bg-slate-400" /> },
                { value: "discontinued", label: "Ngừng bán", icon: <span className="h-2 w-2 rounded-full bg-rose-400" /> },
              ]}
              variant="form"
              size="md"
              className="w-full"
              triggerClassName="w-full text-xs font-medium"
            />
          </Field>
          <Field label="Bảo hành nhà cung cấp (tháng)">
            <NumberInput
              value={variant.supplierWarrantyMonths || 0}
              onChange={(value) => setVariant((current) => ({ ...current, supplierWarrantyMonths: value }))}
              className={inputClassName()}
              placeholder="0"
            />
          </Field>
        </div>
        <ModalActions onClose={onClose} submitting={submitting} label={isEditing ? "Lưu thay đổi" : "Thêm mã SKU"} />
      </form>
    </Modal>
  );
}
