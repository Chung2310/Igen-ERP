import React, { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Folder, FolderTree, Pencil, Plus, Search, Sparkles, Tag, X } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import {
  type CatalogProductDetail,
  type ProductCatalogStatus,
  type ProductCatalogType,
  type ProductResource,
  type ProductTrackingMode,
  type ProductVariant,
  type VariantInput,
  productCatalogService,
} from "../../../services/productCatalogService";
import { generateEAN13, type Option, type GeneratedVariant, cleanOptionSlug } from "../../../hooks/useVariantMatrix";
import { buildMatrixVariantInput } from "../productVariantPayload";
import { shouldCreateInitialPrice } from "../productCatalogCreation";
import { ConfirmDialog } from "../InventoryConfirmDialog";
import { Dropdown, type DropdownOption } from "../../common/Dropdown";
import {
  type ProductForm,
  type Resources,
  type VariantModalMode,
  DEFAULT_PHONE_ATTRIBUTE_PRESETS,
  buildCategoryTree3,
  emptyProductForm,
  emptyVariant,
  inputClassName,
  statusLabels,
  trackingLabels,
  typeLabels,
} from "./catalogConstants";
import { Field, ImageUploadBox, Modal, NumberInput } from "./catalogUi";
import { VariantMatrixBuilder } from "./VariantMatrixBuilder";

interface ProductEditorModalProps {
  product: CatalogProductDetail | null;
  resources: Resources;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDataChanged: () => Promise<void>;
  onVariantAction: (product: CatalogProductDetail, mode: VariantModalMode, ids?: string[], variant?: ProductVariant) => void;
}

export function ProductEditorModal({
  product,
  resources,
  onClose,
  onSaved,
  onDataChanged,
  onVariantAction,
}: ProductEditorModalProps) {
  const [currentProduct, setCurrentProduct] = useState<CatalogProductDetail | null>(product);
  const isEditing = Boolean(currentProduct);
  const [variantTab, setVariantTab] = useState<"list" | "matrix">("list");

  useEffect(() => {
    setCurrentProduct(product);
    if (product) {
      setForm({
        productCode: product.productCode,
        name: product.name,
        productType: product.productType,
        categoryCode: product.categoryCode,
        brandCode: product.brandCode || "",
        baseUnitCode: product.baseUnitCode,
        shortDescription: product.shortDescription || "",
        description: product.description || "",
        manufacturer: product.manufacturer || "",
        countryOfOrigin: product.countryOfOrigin || "",
        taxCategory: product.taxCategory || "",
        warrantyMonths: product.warrantyMonths || 0,
        status: product.status,
        mediaIds: product.mediaIds || [],
      });
      setVariant((curr) => ({
        ...curr,
        trackingMode: product.variants?.[0]?.trackingMode || curr.trackingMode || (product.productType === "service" ? "none" : "serial"),
      }));
      setVariantImages(Object.fromEntries((product.variants || []).map((item) => [item._id, item.mediaIds?.[0]])));
    }
  }, [product]);

  const [form, setForm] = useState<ProductForm>(() =>
    product
      ? {
          productCode: product.productCode,
          name: product.name,
          productType: product.productType,
          categoryCode: product.categoryCode,
          brandCode: product.brandCode || "",
          baseUnitCode: product.baseUnitCode,
          shortDescription: product.shortDescription || "",
          description: product.description || "",
          manufacturer: product.manufacturer || "",
          countryOfOrigin: product.countryOfOrigin || "",
          taxCategory: product.taxCategory || "",
          warrantyMonths: product.warrantyMonths || 0,
          status: product.status,
          mediaIds: product.mediaIds || [],
        }
      : emptyProductForm()
  );

  const [variant, setVariant] = useState<VariantInput>(() => {
    const base = product ? emptyVariant(product.baseUnitCode, product.productType) : emptyVariant();
    if (product?.variants?.[0]?.trackingMode) {
      base.trackingMode = product.variants[0].trackingMode;
    } else if (product?.productType !== "service") {
      base.trackingMode = "serial";
    }
    return base;
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [deleteVariantIds, setDeleteVariantIds] = useState<string[] | null>(null);
  const [deletingVariants, setDeletingVariants] = useState(false);
  const [variantImages, setVariantImages] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries((product?.variants || []).map((item) => [item._id, item.mediaIds?.[0]]))
  );
  const [variantQuery, setVariantQuery] = useState("");
  const [pricesByVariant, setPricesByVariant] = useState<Record<string, { sellingPrice: number; costPrice: number }>>({});

  // Local brands state for instant update upon creation
  const [localBrands, setLocalBrands] = useState<ProductResource[]>(() => resources.brands || []);
  useEffect(() => {
    setLocalBrands(resources.brands || []);
  }, [resources.brands]);

  // Luôn làm mới danh sách thương hiệu trực tiếp từ máy chủ khi mở modal
  useEffect(() => {
    void productCatalogService
      .listResources("brands")
      .then((freshBrands) => {
        if (Array.isArray(freshBrands)) {
          setLocalBrands(freshBrands);
        }
      })
      .catch(() => {});
  }, []);

  // Quick create brand state
  const [isQuickCreatingBrand, setIsQuickCreatingBrand] = useState(false);
  const [quickBrandName, setQuickBrandName] = useState("");
  const [quickBrandCode, setQuickBrandCode] = useState("");
  const [quickCreating, setQuickCreating] = useState(false);

  const handleQuickCreateBrand = async () => {
    if (quickCreating) return;
    const trimmedName = quickBrandName.trim();
    if (!trimmedName) {
      toast.error("Vui lòng nhập tên nhà cung cấp / hãng.");
      return;
    }
    setQuickCreating(true);
    try {
      const code = quickBrandCode.trim() || undefined;
      const created = await productCatalogService.createResource("brands", {
        name: trimmedName,
        code,
        status: "active",
        createSupplierPartner: true,
      });

      setLocalBrands((prev) => {
        if (prev.some((b) => b.code === created.code)) return prev;
        return [...prev, created];
      });

      setField("brandCode", created.code);
      toast.success(`Đã tạo "${created.name}" và thêm vào Quản lý đối tác.`);
      setIsQuickCreatingBrand(false);
      setQuickBrandName("");
      setQuickBrandCode("");
      void onDataChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tạo nhà cung cấp / hãng."));
    } finally {
      setQuickCreating(false);
    }
  };

  useEffect(() => {
    if (!currentProduct) return;
    void productCatalogService
      .listPrices()
      .then((prices) => {
        const map: Record<string, { sellingPrice: number; costPrice: number }> = {};
        for (const p of prices) {
          map[p.variantId] = {
            sellingPrice: Number(p.sellingPrice || 0),
            costPrice: Number(p.costPrice || 0),
          };
        }
        setPricesByVariant(map);
      })
      .catch(() => {});
  }, [currentProduct?._id, currentProduct?.variants]);

  // Handle category change: auto-set tracking mode based on category defaults
  const handleCategoryChange = (categoryCode: string) => {
    setField("categoryCode", categoryCode);
    const cat = resources.categories.find((c) => c.code === categoryCode);
    if (cat?.defaultTrackingMode && form.productType !== "service") {
      setVariant((curr) => ({ ...curr, trackingMode: cat.defaultTrackingMode! }));
    }
  };

  // Matrix generation state
  const [options, setOptions] = useState<Option[]>([]);
  const [variantsMatrix, setVariantsMatrix] = useState<GeneratedVariant[]>([]);

  // Tự động nhận diện các nhóm thuộc tính đã có từ các biến thể cũ của sản phẩm
  useEffect(() => {
    if (!currentProduct?.variants?.length) return;
    const optMap = new Map<string, { code: string; name: string; values: Set<string> }>();

    // 1. Nhận diện từ formal optionValues
    for (const v of currentProduct.variants) {
      if (Array.isArray(v.optionValues) && v.optionValues.length > 0) {
        for (const ov of v.optionValues) {
          if (!ov.code || !ov.value) continue;
          if (!optMap.has(ov.code)) {
            const attr = resources.attributes.find((a) => a.code === ov.code);
            optMap.set(ov.code, {
              code: ov.code,
              name: attr?.name || ov.code,
              values: new Set<string>(),
            });
          }
          optMap.get(ov.code)!.values.add(ov.value);
        }
      }
    }

    // 2. Nếu biến thể cũ chưa có optionValues chính thức (dữ liệu nhập tay/cũ), đối soát qua tên & SKU với các bộ thuộc tính mẫu
    if (optMap.size === 0) {
      const presetKeys = Object.keys(DEFAULT_PHONE_ATTRIBUTE_PRESETS) as Array<keyof typeof DEFAULT_PHONE_ATTRIBUTE_PRESETS>;
      for (const pKey of presetKeys) {
        const preset = DEFAULT_PHONE_ATTRIBUTE_PRESETS[pKey];
        for (const v of currentProduct.variants) {
          const text = `${v.displayName || ""} ${v.sku || ""}`.toLowerCase();
          for (const optVal of preset.options) {
            const cleanVal = optVal.toLowerCase().replace(/[^a-z0-9]/g, "");
            const cleanText = text.replace(/[^a-z0-9]/g, "");
            if ((cleanVal.length >= 3 && cleanText.includes(cleanVal)) || text.includes(optVal.toLowerCase())) {
              if (!optMap.has(preset.code)) {
                optMap.set(preset.code, {
                  code: preset.code,
                  name: preset.name,
                  values: new Set<string>(),
                });
              }
              optMap.get(preset.code)!.values.add(optVal);
            }
          }
        }
      }
    }

    if (optMap.size > 0) {
      setOptions(
        Array.from(optMap.values()).map((o) => ({
          code: o.code,
          name: o.name,
          values: Array.from(o.values),
        }))
      );
    }
  }, [currentProduct?._id, resources.attributes]);

  // Tự động nạp các biến thể cũ và đồng bộ giá vào variantsMatrix khi ở chế độ chỉnh sửa
  useEffect(() => {
    if (!currentProduct?.variants?.length) return;
    setVariantsMatrix((prev) => {
      const currentList = currentProduct.variants.map((v) => {
        const pInfo = pricesByVariant[v._id] || { sellingPrice: 0, costPrice: 0 };
        return {
          sku: v.sku,
          barcode: v.barcode && v.barcode.trim() ? v.barcode.trim() : generateEAN13(v.sku),
          price: pInfo.sellingPrice,
          costPrice: pInfo.costPrice,
          weightGrams: v.weightGrams,
          mediaIds: v.mediaIds,
          optionValues: v.optionValues || [],
        };
      });

      if (prev.length === 0) return currentList;

      // Nếu đã có ma trận đang được sinh/chỉnh sửa, cập nhật giá cho các dòng đã khớp SKU hoặc barcode
      return prev.map((row) => {
        const matched = currentList.find(
          (c) =>
            (c.sku && row.sku && c.sku.trim().toLowerCase() === row.sku.trim().toLowerCase()) ||
            (c.barcode && row.barcode && c.barcode.trim() === row.barcode.trim())
        );
        if (matched) {
          return {
            ...row,
            price: matched.price > 0 ? matched.price : row.price,
            costPrice: matched.costPrice > 0 ? matched.costPrice : row.costPrice,
            barcode: (row.barcode && row.barcode.trim()) || matched.barcode,
            sku: row.sku || matched.sku,
          };
        }
        return row;
      });
    });
  }, [currentProduct?._id, currentProduct?.variants, pricesByVariant]);

  // Bộ lọc SKU đã có để tránh sinh trùng
  const existingSkuSet = useMemo(() => {
    return new Set((currentProduct?.variants || []).map((v) => (v.sku || "").trim().toLowerCase()));
  }, [currentProduct?.variants]);

  const newMatrixVariants = useMemo(() => {
    return variantsMatrix.filter((v) => !existingSkuSet.has((v.sku || "").trim().toLowerCase()));
  }, [variantsMatrix, existingSkuSet]);

  const duplicateMatrixVariantsCount = variantsMatrix.length - newMatrixVariants.length;

  const visibleVariants = useMemo(() => {
    const keyword = variantQuery.trim().toLowerCase();
    if (!currentProduct || !keyword) return currentProduct?.variants || [];
    return currentProduct.variants.filter((item) =>
      [item.sku, item.displayName, item.barcode].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [currentProduct, variantQuery]);

  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const confirmDeleteVariants = async () => {
    if (!deleteVariantIds?.length) return;
    setDeletingVariants(true);
    try {
      await productCatalogService.deleteVariants(deleteVariantIds);
      toast.success("Đã xóa các SKU chưa phát sinh giao dịch.");
      setDeleteVariantIds(null);
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa SKU đã chọn."));
    } finally {
      setDeletingVariants(false);
    }
  };

  // Lưu riêng các biến thể mới được sinh ra từ Ma trận ngay trong chế độ Chỉnh sửa
  const handleSaveNewMatrixVariants = async () => {
    if (!currentProduct) return;
    if (newMatrixVariants.length === 0) {
      toast.warning("Không có biến thể mới nào để thêm (tất cả các mã đều đã tồn tại).");
      return;
    }

    setSubmitting(true);
    try {
      const payloads = newMatrixVariants.map((v) => {
        let sku = (v.sku || "").trim();
        if (!sku) {
          const skuSuffix = v.optionValues.map((opt) => cleanOptionSlug(opt.value)).join("-");
          const baseSku = form.productCode || cleanOptionSlug(form.name, 40);
          sku = baseSku ? `${baseSku}-${skuSuffix}` : `SKU-${skuSuffix}-${generateEAN13().slice(9)}`;
        }
        return buildMatrixVariantInput({
          row: { ...v, sku },
          shared: variant,
          productCode: form.productCode || currentProduct.productCode || "",
          baseUnitCode: form.baseUnitCode,
          productType: form.productType,
          fallbackSku: sku,
        });
      });

      const created = await productCatalogService.createVariants(currentProduct._id, payloads);

      if (created && created.length > 0) {
        await Promise.all(
          created.map((item, idx) => {
            const matrixRow = newMatrixVariants[idx];
            const sellingPrice = matrixRow ? Number(matrixRow.price || 0) : 0;
            const costPrice = matrixRow ? Number(matrixRow.costPrice || 0) : 0;
            return productCatalogService.upsertPrice(item._id, sellingPrice, costPrice);
          })
        );
      }

      toast.success(`Đã thêm thành công ${created?.length || payloads.length} biến thể mới kèm giá bán!`);

      // Tải lại chi tiết sản phẩm mới nhất
      const updated = await productCatalogService.getProduct(currentProduct._id);
      setCurrentProduct(updated);

      // Cập nhật lại giá
      const prices = await productCatalogService.listPrices();
      const priceMap: Record<string, { sellingPrice: number; costPrice: number }> = {};
      for (const p of prices) {
        priceMap[p.variantId] = {
          sellingPrice: Number(p.sellingPrice || 0),
          costPrice: Number(p.costPrice || 0),
        };
      }
      setPricesByVariant(priceMap);

      if (onDataChanged) {
        await onDataChanged();
      }

      // Chuyển lại tab danh sách SKU
      setVariantTab("list");
      setVariantsMatrix([]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể thêm biến thể từ ma trận."));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Tên sản phẩm không được để trống.");
      return;
    }
    if (!form.categoryCode) {
      toast.error("Vui lòng chọn danh mục.");
      return;
    }

    setSubmitting(true);
    const payload = {
      productCode: form.productCode || undefined,
      name: form.name.trim(),
      productType: form.productType,
      categoryCode: form.categoryCode,
      brandCode: form.brandCode || undefined,
      baseUnitCode: form.baseUnitCode,
      shortDescription: form.shortDescription || undefined,
      description: form.description || undefined,
      manufacturer: form.manufacturer || undefined,
      countryOfOrigin: form.countryOfOrigin || undefined,
      taxCategory: form.taxCategory || undefined,
      warrantyMonths: form.warrantyMonths,
      status: form.status,
      mediaIds: form.mediaIds,
    };

    try {
      if (currentProduct) {
        const { productCode: _productCode, productType: _productType, ...update } = payload;
        await productCatalogService.updateProduct(currentProduct._id, { ...update, brandCode: form.brandCode || null });

        // Nếu người dùng có chọn sinh biến thể mới từ ma trận trong khi chỉnh sửa
        if (newMatrixVariants.length > 0) {
          const payloads = newMatrixVariants.map((v) => {
            let sku = (v.sku || "").trim();
            if (!sku) {
              const skuSuffix = v.optionValues.map((opt) => cleanOptionSlug(opt.value)).join("-");
              const baseSku = payload.productCode || form.productCode || cleanOptionSlug(form.name, 40);
              sku = baseSku ? `${baseSku}-${skuSuffix}` : `SKU-${skuSuffix}-${generateEAN13().slice(9)}`;
            }
            return buildMatrixVariantInput({
              row: { ...v, sku },
              shared: variant,
              productCode: payload.productCode || currentProduct.productCode || "",
              baseUnitCode: form.baseUnitCode,
              productType: form.productType,
              fallbackSku: sku,
            });
          });

          const created = await productCatalogService.createVariants(currentProduct._id, payloads);
          if (created && created.length > 0) {
            await Promise.all(
              created.map((item, idx) => {
                const matrixRow = newMatrixVariants[idx];
                const sellingPrice = matrixRow ? Number(matrixRow.price || 0) : 0;
                const costPrice = matrixRow ? Number(matrixRow.costPrice || 0) : 0;
                return productCatalogService.upsertPrice(item._id, sellingPrice, costPrice);
              })
            );
          }
          toast.success(`Đã cập nhật sản phẩm và tạo thêm ${payloads.length} SKU mới từ ma trận!`);
        } else {
          toast.success("Đã cập nhật thông tin sản phẩm.");
        }
      } else {
        if (options.some((o) => o.values.length > 0)) {
          // Bulk create via Matrix
          if (variantsMatrix.length === 0) {
            throw new Error("Không có SKU nào được sinh ra từ ma trận thuộc tính.");
          }

          const matrixPayloads = variantsMatrix.map((v) => {
            let sku = (v.sku || "").trim();
            if (!sku) {
              const skuSuffix = v.optionValues.map((opt) => cleanOptionSlug(opt.value)).join("-");
              const baseSku = payload.productCode || form.productCode || cleanOptionSlug(form.name, 40);
              sku = baseSku ? `${baseSku}-${skuSuffix}` : `SKU-${skuSuffix}-${generateEAN13().slice(9)}`;
            }
            return buildMatrixVariantInput({
              row: { ...v, sku },
              shared: variant,
              productCode: payload.productCode || "",
              baseUnitCode: form.baseUnitCode,
              productType: form.productType,
              fallbackSku: sku,
            });
          });

          const createdProduct = await productCatalogService.bulkCreateWithVariants({
            ...payload,
            variants: matrixPayloads,
          });

          // Atomically upsert prices for every generated variant
          if (createdProduct.variants && createdProduct.variants.length > 0) {
            await Promise.all(
              createdProduct.variants.map((v, idx) => {
                const matrixRow = variantsMatrix[idx];
                const sellingPrice = matrixRow ? Number(matrixRow.price || 0) : 0;
                const costPrice = matrixRow ? Number(matrixRow.costPrice || 0) : 0;
                return productCatalogService.upsertPrice(v._id, sellingPrice, costPrice);
              })
            );
          }

          toast.success(`Đã tạo thành công sản phẩm cùng ${createdProduct.variants?.length || matrixPayloads.length} biến thể kèm giá bán!`);
        } else {
          // Single create flow
          let sku = (variant.sku || "").trim();
          if (!sku) {
            sku = payload.productCode || cleanOptionSlug(form.name, 40) || `SKU-${generateEAN13().slice(6)}`;
          }
          const created = await productCatalogService.createProduct({
            ...payload,
            variant: {
              ...variant,
              sku,
              unitCode: variant.unitCode || form.baseUnitCode,
              trackingMode: form.productType === "service" ? "none" : variant.trackingMode,
            },
          });
          const createdVariant = created.variants?.[0];
          if (createdVariant && shouldCreateInitialPrice(form.status)) {
            await productCatalogService.upsertPrice(String(createdVariant._id), Number(variant.sellingPrice || 0), Number(variant.costPrice || 0));
          }
          toast.success("Đã tạo sản phẩm và SKU đầu tiên.");
        }
      }
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu sản phẩm."));
    } finally {
      setSubmitting(false);
    }
  };

  // 3-Level Category Tree for product dropdown
  const { tree: categoryTree } = useMemo(() => buildCategoryTree3(resources.categories), [resources.categories]);

  const typeOptions = useMemo<DropdownOption<ProductCatalogType>[]>(() => [
    { value: "physical", label: "Hàng hóa vật lý (quản lý kho, IMEI/SL)" },
    { value: "service", label: "Dịch vụ (sửa chữa, thay pin, không theo dõi kho)" },
  ], []);

  const categoryDropdownOptions = useMemo<DropdownOption<string>[]>(() => {
    const list: DropdownOption<string>[] = [];
    for (const root of categoryTree) {
      list.push({
        value: root.category.code,
        label: `[Cấp 1] ${root.category.name}`,
        icon: <Folder className="h-4 w-4 text-amber-500" />,
        className: "font-bold text-slate-900 bg-slate-50/80",
      });
      for (const l2 of root.children) {
        list.push({
          value: l2.category.code,
          label: `[Cấp 2] ${l2.category.name}`,
          icon: <FolderTree className="h-3.5 w-3.5 text-cyan-600 ml-3" />,
          className: "pl-5 font-semibold text-slate-800",
        });
        for (const l3 of l2.children) {
          list.push({
            value: l3.category.code,
            label: `[Cấp 3] ${l3.category.name}`,
            icon: <Tag className="h-3 w-3 text-slate-400 ml-6" />,
            className: "pl-9 text-slate-600 font-normal",
          });
        }
      }
    }
    return list;
  }, [categoryTree]);

  const brandDropdownOptions = useMemo<DropdownOption<string>[]>(() => [
    { value: "", label: "Không chọn thương hiệu" },
    ...localBrands.map((item) => ({
      value: item.code,
      label: item.name,
    })),
  ], [localBrands]);

  const statusDropdownOptions = useMemo<DropdownOption<ProductCatalogStatus>[]>(() => [
    { value: "draft", label: "Bản nháp", icon: <span className="h-2 w-2 rounded-full bg-amber-400" /> },
    { value: "active", label: "Đang kinh doanh", icon: <span className="h-2 w-2 rounded-full bg-emerald-500" /> },
    { value: "inactive", label: "Tạm ngừng kinh doanh", icon: <span className="h-2 w-2 rounded-full bg-slate-400" /> },
    { value: "archived", label: "Lưu trữ", icon: <span className="h-2 w-2 rounded-full bg-rose-400" /> },
  ], []);

  const selectedCategoryObj = resources.categories.find((c) => c.code === form.categoryCode);

  return (
    <>
      <Modal title={isEditing ? `Sản phẩm: ${product!.name}` : "Tạo sản phẩm & Các phiên bản"} onClose={onClose} wide>
        <form noValidate onSubmit={submit} className="bg-slate-50/50 -m-5 p-5 space-y-5">
          {/* Khối 1: Thông tin cơ bản */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">1</span>
              Thông tin Đời máy / Sản phẩm
            </h4>
            <div className="grid gap-6 md:grid-cols-[140px_1fr]">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-700">Ảnh đại diện</label>
                <ImageUploadBox value={form.mediaIds[0]} onChange={(url) => setField("mediaIds", [url])} className="w-full aspect-square" />
              </div>
              <div className="grid gap-4 md:grid-cols-2 h-fit">
                {isEditing && (
                  <Field label="Mã sản phẩm">
                    <input readOnly value={form.productCode} className={inputClassName("bg-slate-50 text-slate-500 font-mono")} />
                  </Field>
                )}
                <Field label="Tên sản phẩm / Đời máy *">
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    className={inputClassName()}
                    placeholder="VD: iPhone 16 Pro Max, Củ sạc 65W GaN..."
                  />
                </Field>
                <Field label="Loại sản phẩm">
                  <Dropdown<ProductCatalogType>
                    disabled={isEditing}
                    value={form.productType}
                    onChange={(productType) => {
                      setField("productType", productType);
                      setVariant((current) => ({
                        ...current,
                        trackingMode: productType === "service" ? "none" : current.trackingMode === "none" ? "quantity" : current.trackingMode,
                      }));
                    }}
                    options={typeOptions}
                    variant="form"
                    size="md"
                    className="w-full"
                    triggerClassName="w-full text-xs font-medium"
                  />
                </Field>
                <Field label="Danh mục sản phẩm *">
                  <div className="space-y-1">
                    <Dropdown<string>
                      value={form.categoryCode}
                      onChange={handleCategoryChange}
                      options={categoryDropdownOptions}
                      placeholder="-- Chọn thể loại / danh mục --"
                      searchable={true}
                      searchPlaceholder="Tìm kiếm danh mục..."
                      variant="form"
                      size="md"
                      className="w-full"
                      triggerClassName="w-full text-xs font-medium"
                    />
                    {selectedCategoryObj?.defaultTrackingMode && (
                      <p className="text-[11px] text-cyan-700 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Hình thức quản lý kho mặc định:{" "}
                        <strong>{trackingLabels[selectedCategoryObj.defaultTrackingMode]}</strong>
                      </p>
                    )}
                  </div>
                </Field>
                <Field label="Thương hiệu / Hãng">
                  <Dropdown<string>
                    value={form.brandCode}
                    onChange={(val) => setField("brandCode", val)}
                    options={brandDropdownOptions}
                    searchable={localBrands.length > 8}
                    searchPlaceholder="Tìm hãng..."
                    placeholder="Không chọn thương hiệu"
                    variant="form"
                    size="md"
                    className="w-full"
                    triggerClassName="w-full text-xs font-medium"
                    actionButton={{
                      label: "Tạo nhanh nhà cung cấp / hãng",
                      icon: <Plus className="h-3.5 w-3.5 text-cyan-600" />,
                      onClick: () => setIsQuickCreatingBrand(true),
                    }}
                  />
                </Field>
                <Field label="Trạng thái">
                  <Dropdown<ProductCatalogStatus>
                    value={form.status}
                    onChange={(status) => setField("status", status)}
                    options={statusDropdownOptions}
                    variant="form"
                    size="md"
                    className="w-full"
                    triggerClassName="w-full text-xs font-medium"
                  />
                </Field>
                <Field label="Bảo hành khách hàng (tháng)">
                  <NumberInput value={form.warrantyMonths} onChange={(value) => setField("warrantyMonths", value)} className={inputClassName()} placeholder="0" />
                </Field>
              </div>
            </div>
          </div>

          {/* Khối 2: Bộ sinh Ma trận Biến thể (Khi tạo mới sản phẩm) */}
          {!isEditing && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">2</span>
                <span className="text-sm font-semibold text-slate-900">Thiết lập thuộc tính sản phẩm</span>
              </div>
              <VariantMatrixBuilder
                options={options}
                setOptions={setOptions}
                variantsMatrix={variantsMatrix}
                setVariantsMatrix={setVariantsMatrix}
                productType={form.productType}
                trackingMode={variant.trackingMode}
                onTrackingModeChange={(mode) => setVariant((c) => ({ ...c, trackingMode: mode }))}
                baseSku={form.productCode || form.name}
              />
            </div>
          )}

          {/* Khối 2: Quản lý Biến thể & Ma trận SKU khi đang Edit sản phẩm */}
          {isEditing && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">2</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {variantTab === "matrix" ? "Tạo phiên bản hàng loạt" : `Danh sách phiên bản SKU (${currentProduct!.variants.length})`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {variantTab === "list" ? (
                    <>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={variantQuery}
                          onChange={(e) => setVariantQuery(e.target.value)}
                          placeholder="Tìm SKU, tên biến thể..."
                          className="w-36 sm:w-48 rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setVariantTab("matrix")}
                        className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-cyan-800 transition-colors whitespace-nowrap"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Tạo nhanh phiên bản
                        {newMatrixVariants.length > 0 && (
                          <span className="rounded-full bg-cyan-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                            +{newMatrixVariants.length}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onVariantAction(currentProduct!, "single")}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Thêm một SKU
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setVariantTab("list")}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      &larr; Quay lại danh sách SKU ({currentProduct!.variants.length})
                    </button>
                  )}
                </div>
              </div>

              {variantTab === "list" ? (
                <>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                        <tr>
                          <th className="px-3 py-2.5 w-[50px]">Ảnh</th>
                          <th className="px-3 py-2.5">Mã SKU</th>
                          <th className="px-3 py-2.5">Tên biến thể</th>
                          <th className="px-3 py-2.5">Giá bán</th>
                          <th className="px-3 py-2.5">Theo dõi kho</th>
                          <th className="px-3 py-2.5">Trạng thái</th>
                          <th className="px-3 py-2.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {visibleVariants.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                              {variantQuery ? "Không tìm thấy SKU nào khớp với tìm kiếm." : "Sản phẩm chưa có biến thể nào."}
                            </td>
                          </tr>
                        ) : (
                          visibleVariants.map((item) => (
                            <tr key={item._id} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2.5">
                                <ImageUploadBox
                                  value={variantImages[item._id] ?? item.mediaIds?.[0]}
                                  onChange={(url) => {
                                    setVariantImages((curr) => ({ ...curr, [item._id]: url }));
                                    void productCatalogService.updateVariant(item._id, { mediaIds: [url] });
                                  }}
                                  className="h-10 w-10 !rounded-md"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="font-mono text-xs font-semibold text-slate-700">{item.sku}</div>
                                <div className="mt-0.5 font-sans text-[11px] text-slate-400">{item.barcode || "Chưa có mã vạch"}</div>
                              </td>
                              <td className="px-3 py-2.5 font-medium text-slate-700">
                                {item.displayName || <span className="text-slate-400 italic">Mặc định</span>}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="font-semibold text-cyan-700">
                                  {pricesByVariant[item._id]?.sellingPrice !== undefined ? (
                                    `${pricesByVariant[item._id].sellingPrice.toLocaleString("vi-VN")} ₫`
                                  ) : (
                                    <span className="text-rose-500 font-normal">Chưa có giá</span>
                                  )}
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-400">
                                  Vốn: {pricesByVariant[item._id]?.costPrice ? `${pricesByVariant[item._id].costPrice.toLocaleString("vi-VN")} ₫` : "0 ₫"}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-500">
                                <span className="bg-slate-100 px-2 py-0.5 rounded">{trackingLabels[item.trackingMode]}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                  {item.status === "active" ? "Đang dùng" : "Ngừng dùng"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pInfo = pricesByVariant[item._id] || { sellingPrice: 0, costPrice: 0 };
                                    onVariantAction(currentProduct!, "edit", undefined, {
                                      ...item,
                                      sellingPrice: pInfo.sellingPrice,
                                      costPrice: pInfo.costPrice,
                                    } as any);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-cyan-700"
                                  title="Sửa SKU"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200/80">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-cyan-600" />
                      Cần bổ sung thêm Màu sắc, Dung lượng hoặc Phiên bản mới?
                    </span>
                    <button
                      type="button"
                      onClick={() => setVariantTab("matrix")}
                      className="font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                    >
                      Tạo thêm phiên bản tự động &rarr;
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-cyan-50/80 border border-cyan-200/80 p-3 text-xs text-cyan-800">
                    Chọn các nhóm thuộc tính bên dưới (Màu sắc, Dung lượng, Tình trạng...). Hệ thống sẽ tự động ghép với mã gốc <strong>{form.productCode || currentProduct!.productCode}</strong> để sinh các biến thể mới.
                  </div>

                  <VariantMatrixBuilder
                    options={options}
                    setOptions={setOptions}
                    variantsMatrix={variantsMatrix}
                    setVariantsMatrix={setVariantsMatrix}
                    productType={form.productType}
                    trackingMode={variant.trackingMode}
                    onTrackingModeChange={(mode) => setVariant((c) => ({ ...c, trackingMode: mode }))}
                    baseSku={form.productCode || currentProduct!.productCode}
                  />

                  {/* Thanh điều khiển xác nhận lưu biến thể mới từ ma trận */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50/70 p-4">
                    <div>
                      <div className="text-xs sm:text-sm font-semibold text-cyan-900 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-cyan-600 shrink-0" />
                        {newMatrixVariants.length > 0 ? (
                          <span>
                            Sẵn sàng thêm <strong className="text-cyan-700">{newMatrixVariants.length}</strong> biến thể mới vào sản phẩm
                          </span>
                        ) : variantsMatrix.length > 0 ? (
                          <span className="text-amber-800">Tất cả {variantsMatrix.length} biến thể trong ma trận đã tồn tại trong sản phẩm.</span>
                        ) : (
                          <span className="text-slate-600">Hãy tích chọn ít nhất 1 giá trị thuộc tính để sinh ma trận.</span>
                        )}
                      </div>
                      {duplicateMatrixVariantsCount > 0 && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          ({duplicateMatrixVariantsCount} biến thể đã có sẵn trong danh sách sẽ được bỏ qua, tránh tạo trùng)
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setVariantTab("list")}
                        className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Quay lại danh sách
                      </button>
                      <button
                        type="button"
                        disabled={submitting || newMatrixVariants.length === 0}
                        onClick={handleSaveNewMatrixVariants}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-cyan-800 disabled:opacity-50 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        {submitting ? "Đang lưu..." : `Lưu & Thêm ${newMatrixVariants.length} SKU mới`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Khối 3: Thông tin mở rộng */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">3</span>
              Thông tin mở rộng &amp; Mô tả
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mô tả ngắn">
                <input value={form.shortDescription} onChange={(event) => setField("shortDescription", event.target.value)} className={inputClassName()} placeholder="Tóm tắt tính năng chính" />
              </Field>
              <Field label="Nhà sản xuất">
                <input value={form.manufacturer} onChange={(event) => setField("manufacturer", event.target.value)} className={inputClassName()} />
              </Field>
              <Field label="Xuất xứ">
                <input value={form.countryOfOrigin} onChange={(event) => setField("countryOfOrigin", event.target.value)} className={inputClassName()} />
              </Field>
              <Field label="Nhóm thuế">
                <input value={form.taxCategory} onChange={(event) => setField("taxCategory", event.target.value)} className={inputClassName()} />
              </Field>
            </div>
            <Field label="Mô tả chi tiết">
              <textarea rows={3} value={form.description} onChange={(event) => setField("description", event.target.value)} className={inputClassName("resize-y font-sans")} placeholder="Chi tiết sản phẩm..." />
            </Field>
          </div>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 -mx-5 -mb-5 mt-8 flex justify-end gap-3 rounded-b-lg border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 shadow-sm transition-colors disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : `Tạo sản phẩm ${variantsMatrix.length > 0 ? `(${variantsMatrix.length} SKU)` : ""}`}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(deleteVariantIds)}
        title="Xóa SKU đã chọn?"
        description={`Chỉ xóa được ${deleteVariantIds?.length || 0} SKU chưa có tồn kho hoặc lịch sử giao dịch. Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa SKU"
        tone="danger"
        isSubmitting={deletingVariants}
        onClose={() => !deletingVariants && setDeleteVariantIds(null)}
        onConfirm={confirmDeleteVariants}
      />

      {isQuickCreatingBrand && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Tạo mới nhà cung cấp / Hãng</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickCreatingBrand(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-500">Nhà cung cấp sẽ được thêm vào Quản lý đối tác và có thể chọn khi nhập hàng.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên nhà cung cấp / Hãng <span className="text-rose-500">*</span>
                </label>
                <input
                  autoFocus
                  aria-label="Tên nhà cung cấp / Hãng"
                  type="text"
                  value={quickBrandName}
                  onChange={(e) => setQuickBrandName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleQuickCreateBrand();
                    }
                  }}
                  placeholder="VD: Apple, Samsung, Xiaomi, Viettel..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Mã viết tắt (tùy chọn)
                </label>
                <input
                  type="text"
                  value={quickBrandCode}
                  aria-label="Mã nhà cung cấp / Hãng"
                  onChange={(e) => setQuickBrandCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleQuickCreateBrand();
                    }
                  }}
                  placeholder="Tự động sinh (VD: APPLE, SAMSUNG...)"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono uppercase text-slate-700 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsQuickCreatingBrand(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={quickCreating || !quickBrandName.trim()}
                onClick={() => void handleQuickCreateBrand()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:opacity-50 transition"
              >
                {quickCreating ? "Đang tạo..." : "Tạo ngay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
