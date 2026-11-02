import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import {
  type CatalogProductDetail,
  type ProductTrackingMode,
  type ProductVariant,
  type VariantInput,
  productCatalogService,
} from "../../../services/productCatalogService";
import { generateEAN13, type Option, type GeneratedVariant, cleanOptionSlug } from "../../../hooks/useVariantMatrix";
import { emptyVariant, inputClassName, type Resources } from "./catalogConstants";
import { Field, ImageUploadBox, Modal, ModalActions, NumberInput } from "./catalogUi";
import { VariantMatrixBuilder } from "./VariantMatrixBuilder";
import { Dropdown, type DropdownOption } from "../../common/Dropdown";

interface BulkVariantModalProps {
  product: CatalogProductDetail;
  mode: "bulk-create" | "bulk-edit";
  ids: string[];
  resources: Resources;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function BulkVariantModal({
  product,
  mode,
  ids,
  resources,
  onClose,
  onSaved,
}: BulkVariantModalProps) {
  const isCreate = mode === "bulk-create";
  const [tab, setTab] = useState<"manual" | "matrix">("manual");

  // Manual list state
  const [variants, setVariants] = useState<VariantInput[]>(() =>
    isCreate ? [emptyVariant(product.baseUnitCode, product.productType)] : []
  );
  const [status, setStatus] = useState<VariantInput["status"] | "">("");
  const [trackingMode, setTrackingMode] = useState<ProductTrackingMode | "">("");
  const [submitting, setSubmitting] = useState(false);

  // Matrix generation state
  const [options, setOptions] = useState<Option[]>([]);
  const [variantsMatrix, setVariantsMatrix] = useState<GeneratedVariant[]>([]);

  const updateVariant = (index: number, patch: Partial<VariantInput>) =>
    setVariants((current) => current.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)));

  const removeVariant = (index: number) =>
    setVariants((current) => (current.length > 1 ? current.filter((_, variantIndex) => variantIndex !== index) : current));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (isCreate) {
        if (tab === "matrix") {
          if (variantsMatrix.length === 0) throw new Error("Chưa có biến thể nào được sinh ra từ ma trận.");
          const defaultTracking =
            product.variants?.[0]?.trackingMode ||
            resources.categories.find((c) => c.code === product.categoryCode)?.defaultTrackingMode ||
            "serial";

          const payloads = variantsMatrix.map((v) => {
            const skuSuffix = v.optionValues.map((opt) => cleanOptionSlug(opt.value)).join("-");
            const sku = v.sku?.trim() || `${product.productCode}-${skuSuffix}`;
            return {
              sku,
              barcode: v.barcode || generateEAN13(),
              displayName: v.optionValues.map((opt) => opt.value).join(" - "),
              optionValues: v.optionValues,
              unitCode: product.baseUnitCode,
              trackingMode: product.productType === "service" ? "none" : defaultTracking,
              weightGrams: v.weightGrams || 0,
              mediaIds: v.mediaIds || [],
              sellingPrice: Number(v.price || 0),
              costPrice: Number(v.costPrice || 0),
              status: "active",
            } as VariantInput;
          });

          const created = await productCatalogService.createVariants(product._id, payloads);
          await Promise.all(
            created.map((variantItem, idx) =>
              productCatalogService.upsertPrice(variantItem._id, Number(payloads[idx].sellingPrice || 0), Number(payloads[idx].costPrice || 0))
            )
          );
          toast.success(`Đã tạo thành công ${payloads.length} SKU mới kèm giá bán!`);
        } else {
          const payloads = variants.map((v) => ({
            ...v,
            sku: v.sku.trim() || `${product.productCode || "SKU"}-${generateEAN13().slice(6)}`,
            unitCode: product.baseUnitCode,
            trackingMode: product.productType === "service" ? "none" : v.trackingMode,
          }));
          const skuSet = new Set<string>();
          if (payloads.some((v) => skuSet.has(v.sku.toUpperCase()) || !skuSet.add(v.sku.toUpperCase()))) {
            throw new Error("SKU không được trùng trong danh sách.");
          }
          const created = await productCatalogService.createVariants(product._id, payloads);
          await Promise.all(
            created.map((variantItem, index) =>
              productCatalogService.upsertPrice(variantItem._id, Number(payloads[index].sellingPrice || 0), Number(payloads[index].costPrice || 0))
            )
          );
          toast.success(`Đã tạo ${payloads.length} SKU.`);
        }
      } else {
        const changes: Partial<Pick<ProductVariant, "status" | "trackingMode">> = {};
        if (status) changes.status = status;
        if (product.productType !== "service" && trackingMode) changes.trackingMode = trackingMode;
        if (!Object.keys(changes).length) throw new Error("Chưa chọn nội dung cần cập nhật.");
        await productCatalogService.updateVariants(ids, changes);
        toast.success(`Đã cập nhật ${ids.length} SKU.`);
      }
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, isCreate ? "Không thể tạo nhanh SKU." : "Không thể sửa hàng loạt SKU."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={isCreate ? `Tạo nhanh nhiều SKU cho ${product.name}` : `Sửa hàng loạt ${ids.length} SKU`} onClose={onClose} wide stacked>
      <form onSubmit={submit} className="space-y-5">
        {isCreate ? (
          <>
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setTab("manual")}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                  tab === "manual" ? "border-cyan-700 text-cyan-700" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Nhập danh sách SKU
              </button>
              <button
                type="button"
                onClick={() => setTab("matrix")}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                  tab === "matrix" ? "border-cyan-700 text-cyan-700" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                ✨ Sinh theo Ma trận (Màu × Dung lượng...)
              </button>
            </div>

            {tab === "matrix" ? (
              <VariantMatrixBuilder
                options={options}
                setOptions={setOptions}
                variantsMatrix={variantsMatrix}
                setVariantsMatrix={setVariantsMatrix}
                productType={product.productType}
                trackingMode={
                  product.variants?.[0]?.trackingMode ||
                  resources.categories.find((c) => c.code === product.categoryCode)?.defaultTrackingMode ||
                  "serial"
                }
                baseSku={product.productCode}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <p className="text-sm text-slate-600">Mỗi SKU có thông tin riêng, giống form thêm một SKU.</p>
                  <button
                    type="button"
                    onClick={() =>
                      setVariants((current) =>
                        current.length < 500 ? [...current, emptyVariant(product.baseUnitCode, product.productType)] : current
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm SKU
                  </button>
                </div>
                <div className="space-y-4">
                  {variants.map((v, index) => (
                    <section key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="font-semibold text-slate-800">SKU {index + 1}</h4>
                        <button
                          type="button"
                          disabled={variants.length === 1}
                          onClick={() => removeVariant(index)}
                          className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                          title="Xóa SKU"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-24 shrink-0">
                          <label className="mb-1 block text-xs font-semibold text-slate-700">Ảnh</label>
                          <ImageUploadBox
                            value={v.mediaIds?.[0]}
                            onChange={(url) => updateVariant(index, { mediaIds: [url] })}
                            className="aspect-square w-full"
                          />
                        </div>
                        <div className="grid flex-1 gap-4 sm:grid-cols-2">
                          <Field label="Mã SKU">
                            <input
                              value={v.sku}
                              onChange={(e) => updateVariant(index, { sku: e.target.value })}
                              className={inputClassName()}
                              placeholder="Tự sinh nếu để trống"
                            />
                          </Field>
                          <Field label="Mã vạch">
                            <input
                              value={v.barcode || ""}
                              onChange={(e) => updateVariant(index, { barcode: e.target.value })}
                              className={inputClassName()}
                            />
                          </Field>
                          <Field label="Tên biến thể">
                            <input
                              value={v.displayName || ""}
                              onChange={(e) => updateVariant(index, { displayName: e.target.value })}
                              className={inputClassName()}
                            />
                          </Field>
                          <Field label="Giá bán">
                            <NumberInput
                              value={v.sellingPrice || 0}
                              onChange={(val) => updateVariant(index, { sellingPrice: val })}
                              className={inputClassName()}
                              placeholder="Nhập giá bán"
                            />
                          </Field>
                          <Field label="Theo dõi kho">
                            <Dropdown<ProductTrackingMode>
                              disabled={product.productType === "service"}
                              value={product.productType === "service" ? "none" : v.trackingMode}
                              onChange={(val) => updateVariant(index, { trackingMode: val })}
                              options={[
                                { value: "none", label: "Không theo dõi" },
                                { value: "quantity", label: "Số lượng" },
                                { value: "lot", label: "Theo lô" },
                                { value: "serial", label: "Theo số sê-ri/IMEI" },
                              ]}
                              variant="form"
                              size="md"
                              className="w-full"
                              triggerClassName="w-full text-xs font-medium"
                            />
                          </Field>
                          <Field label="Trạng thái">
                            <Dropdown<VariantInput["status"]>
                              value={v.status}
                              onChange={(val) => updateVariant(index, { status: val })}
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
                              value={v.supplierWarrantyMonths || 0}
                              onChange={(val) => updateVariant(index, { supplierWarrantyMonths: val })}
                              className={inputClassName()}
                              placeholder="0"
                            />
                          </Field>
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Các SKU đã chọn: <strong>{ids.length}</strong>. Chọn thông tin chung muốn áp dụng.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Trạng thái">
                <Dropdown<string>
                  value={status}
                  onChange={(val) => setStatus(val as VariantInput["status"])}
                  options={[
                    { value: "", label: "Giữ nguyên" },
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
              <Field label="Theo dõi kho">
                <Dropdown<string>
                  disabled={product.productType === "service"}
                  value={product.productType === "service" ? "none" : trackingMode || ""}
                  onChange={(val) => setTrackingMode(val as ProductTrackingMode)}
                  options={[
                    { value: "", label: "Giữ nguyên" },
                    { value: "none", label: "Không theo dõi" },
                    { value: "quantity", label: "Số lượng" },
                    { value: "lot", label: "Theo lô" },
                    { value: "serial", label: "Theo số sê-ri/IMEI" },
                  ]}
                  variant="form"
                  size="md"
                  className="w-full"
                  triggerClassName="w-full text-xs font-medium"
                />
              </Field>
            </div>
          </>
        )}
        <ModalActions onClose={onClose} submitting={submitting} label={isCreate ? "Tạo các SKU" : "Lưu thay đổi"} />
      </form>
    </Modal>
  );
}
