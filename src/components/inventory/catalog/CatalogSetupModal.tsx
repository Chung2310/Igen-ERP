import React, { useMemo, useState } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Smartphone,
  Package,
  QrCode,
  Ban,
  Check,
  Layers,
  FileText,
  Sparkles,
  Copy,
  Search,
  CheckCircle2,
  Wand2,
  Palette,
  HardDrive,
  Globe,
  Zap,
  Plug,
} from "lucide-react";
import { toast } from "../../../pages/Toast";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import {
  type ProductResource,
  type ProductResourceKind,
  type ProductTemplate,
  type ProductTrackingMode,
  productCatalogService,
} from "../../../services/productCatalogService";
import {
  buildCategoryTree3,
  inputClassName,
  trackingLabels,
  DEFAULT_PHONE_ATTRIBUTE_PRESETS,
} from "./catalogConstants";
import { Field, Modal, ModalActions } from "./catalogUi";
import { Dropdown, type DropdownOption } from "../../common/Dropdown";
import { AttributeChipInput } from "./AttributeChipInput";
import { useConfirmation } from "../../../context/ConfirmationContext";

interface CatalogSetupModalProps {
  kind: ProductResourceKind | "templates";
  items: Array<ProductResource | ProductTemplate>;
  categories: ProductResource[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function CatalogSetupModal({
  kind,
  items,
  categories,
  onClose,
  onSaved,
}: CatalogSetupModalProps) {
  const requestConfirmation = useConfirmation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentCode, setParentCode] = useState("");
  const [defaultTrackingMode, setDefaultTrackingMode] = useState<ProductTrackingMode>("serial");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [attributeType, setAttributeType] = useState<"select" | "multi-select" | "text" | "number">("select");
  const [attributeOptions, setAttributeOptions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const title =
    kind === "categories"
      ? "Cây Thư Mục & Thể Loại (Tối đa 3 Cấp)"
      : kind === "brands"
        ? "Quản lý Thương hiệu / Hãng"
        : kind === "attributes"
          ? "Quản lý Thuộc tính Sản phẩm"
          : "Quản lý dữ liệu dùng chung";

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setCode("");
    setParentCode("");
    setDefaultTrackingMode("serial");
    setDescription("");
    setStatus("active");
    setAttributeType("select");
    setAttributeOptions([]);
  };

  const startEdit = (item: any) => {
    setEditingId(item._id);
    setName(item.name);
    setCode(item.code || "");
    setStatus(item.status);
    setDescription(item.description || "");
    if (kind === "categories") {
      setParentCode(item.parentCode || "");
      setDefaultTrackingMode(item.defaultTrackingMode || "serial");
    } else if (kind === "attributes") {
      setAttributeType(item.type || "select");
      setAttributeOptions(Array.isArray(item.options) ? [...item.options] : []);
    }
  };

  const duplicateAttribute = (item: any) => {
    setEditingId(null);
    setName(`${item.name} (Bản sao)`);
    setCode(`${item.code || "ATTR"}_COPY`);
    setStatus("active");
    setAttributeType(item.type || "select");
    setAttributeOptions(Array.isArray(item.options) ? [...item.options] : []);
    toast.info(`Đã nhân bản "${item.name}". Bạn có thể chỉnh sửa và bấm Lưu.`);
  };

  // Smart attribute presets
  const applyAttributePreset = (presetKey: string) => {
    const preset = DEFAULT_PHONE_ATTRIBUTE_PRESETS[presetKey];
    if (!preset) return;
    setName(preset.name);
    setCode(preset.code);
    setAttributeType("select");
    setAttributeOptions([...preset.options]);
    toast.success(`Đã áp dụng mẫu "${preset.name}" với ${preset.options.length} giá trị.`);
  };

  // Auto-code generator for attributes
  const generateAttributeCode = (inputName: string) => {
    const trimmed = inputName.trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    if (lower.includes("màu")) return "COLOR";
    if (lower.includes("dung lượng") || lower.includes("bộ nhớ")) return "STORAGE";
    if (lower.includes("tình trạng")) return "CONDITION";
    if (lower.includes("thị trường") || lower.includes("xuất xứ")) return "ORIGIN";
    if (lower.includes("ram")) return "RAM";
    if (lower.includes("công suất")) return "WATTAGE";
    const slug = trimmed
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toUpperCase();
    return slug.startsWith("ATTR_") ? slug : `ATTR_${slug}`;
  };

  // Contextual suggestions based on attribute name/code
  const attributeSuggestions = useMemo(() => {
    if (kind !== "attributes") return [];
    const upperCode = code.toUpperCase();
    const lowerName = name.toLowerCase();
    if (upperCode === "COLOR" || lowerName.includes("màu")) {
      return DEFAULT_PHONE_ATTRIBUTE_PRESETS.COLOR.options;
    }
    if (upperCode === "STORAGE" || lowerName.includes("dung lượng") || lowerName.includes("bộ nhớ")) {
      return DEFAULT_PHONE_ATTRIBUTE_PRESETS.STORAGE.options;
    }
    if (upperCode === "CONDITION" || lowerName.includes("tình trạng")) {
      return DEFAULT_PHONE_ATTRIBUTE_PRESETS.CONDITION.options;
    }
    if (upperCode === "ORIGIN" || lowerName.includes("thị trường") || lowerName.includes("xuất xứ")) {
      return DEFAULT_PHONE_ATTRIBUTE_PRESETS.ORIGIN.options;
    }
    if (upperCode === "RAM" || lowerName.includes("ram")) {
      return DEFAULT_PHONE_ATTRIBUTE_PRESETS.RAM?.options || [];
    }
    if (upperCode === "WATTAGE" || lowerName.includes("công suất")) {
      return DEFAULT_PHONE_ATTRIBUTE_PRESETS.WATTAGE?.options || [];
    }
    return [];
  }, [kind, code, name]);

  // Bulk Seed standard phone retail attributes
  const seedPhoneAttributes = async () => {
    setSubmitting(true);
    try {
      const presets = Object.values(DEFAULT_PHONE_ATTRIBUTE_PRESETS);
      let addedCount = 0;
      for (const preset of presets) {
        const existing = items.find((it: any) => it.code === preset.code);
        if (!existing) {
          await productCatalogService.createResource("attributes", {
            name: preset.name,
            code: preset.code,
            type: "select",
            options: preset.options,
            status: "active",
          });
          addedCount++;
        }
      }
      toast.success(`Đã khởi tạo thành công ${addedCount} thuộc tính chuẩn ngành hàng điện thoại!`);
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể khởi tạo thuộc tính mẫu."));
    } finally {
      setSubmitting(false);
    }
  };

  // Filter items in list
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((it: any) => {
      if (it.name?.toLowerCase().includes(q)) return true;
      if (it.code?.toLowerCase().includes(q)) return true;
      if (Array.isArray(it.options) && it.options.some((opt: string) => opt.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [items, searchQuery]);

  const deleteItem = async (item: any) => {
    if (!await requestConfirmation({ title: "Xóa thuộc tính?", description: `Xóa “${item.name}”?`, confirmLabel: "Xóa", tone: "danger" })) return;
    setSubmitting(true);
    try {
      await productCatalogService.deleteResource(kind as any, item._id);
      if (editingId === item._id) resetForm();
      toast.success("Đã xóa.");
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa."));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (kind === "categories") {
        const input: Record<string, any> = {
          name,
          status,
          parentCode: parentCode || undefined,
          defaultTrackingMode,
          description,
        };
        if (code) input.code = code;
        if (editingId) await productCatalogService.updateResource("categories", editingId, input);
        else await productCatalogService.createResource("categories", input);
      } else if (kind === "attributes") {
        const input: Record<string, any> = {
          name,
          status,
          type: attributeType,
          options: attributeOptions,
        };
        if (code) input.code = code;
        if (editingId) await productCatalogService.updateResource("attributes", editingId, input);
        else await productCatalogService.createResource("attributes", input);
      } else if (kind === "brands") {
        const input: Record<string, any> = { name, status, description };
        if (code) input.code = code;
        if (editingId) await productCatalogService.updateResource("brands", editingId, input);
        else await productCatalogService.createResource("brands", input);
      }
      toast.success(editingId ? "Đã cập nhật." : "Đã tạo mới thành công.");
      resetForm();
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu."));
    } finally {
      setSubmitting(false);
    }
  };

  // Build 3-level tree
  const categoryResources = (kind === "categories" ? items : categories) as ProductResource[];
  const { tree, levelMap } = useMemo(() => buildCategoryTree3(categoryResources), [categoryResources]);

  // Determine current form target level
  const targetLevel = useMemo(() => {
    if (!parentCode) return 1;
    const parentLvl = levelMap.get(parentCode) || 1;
    return Math.min(3, parentLvl + 1) as 1 | 2 | 3;
  }, [parentCode, levelMap]);

  const selectedParentCategory = categoryResources.find((c) => c.code === parentCode);

  // Eligible parents (Only Level 1 & Level 2 can be parents, Level 3 is leaf!)
  const eligibleParents = useMemo(() => {
    const list: Array<{ code: string; name: string; level: 1 | 2 }> = [];
    for (const root of tree) {
      if (root.category._id === editingId) continue;
      list.push({ code: root.category.code, name: root.category.name, level: 1 });
      for (const l2 of root.children) {
        if (l2.category._id === editingId) continue;
        list.push({ code: l2.category.code, name: `${root.category.name} > ${l2.category.name}`, level: 2 });
      }
    }
    return list;
  }, [tree, editingId]);

  const parentDropdownOptions = useMemo<DropdownOption<string>[]>(() => [
    {
      value: "",
      label: "-- Là thư mục gốc (Cấp 1: Ngành hàng) --",
      icon: <Folder className="h-4 w-4 text-amber-500" />,
      className: "font-semibold text-slate-800",
    },
    ...eligibleParents.map((p) => ({
      value: p.code,
      label: p.level === 1 ? `[Cấp 1] ${p.name}` : `[Cấp 2] ${p.name}`,
      icon: (
        <span className={`inline-flex items-center ${p.level === 2 ? "ml-3" : ""}`}>
          {p.level === 1 ? (
            <Folder className="h-4 w-4 text-amber-500" />
          ) : (
            <FolderTree className="h-3.5 w-3.5 text-cyan-600" />
          )}
        </span>
      ),
      className: p.level === 1 ? "font-semibold text-slate-800 bg-slate-50/50" : "pl-6 text-slate-700 font-medium",
    })),
  ], [eligibleParents]);

  const trackingOptions = useMemo<DropdownOption<ProductTrackingMode>[]>(() => [
    {
      value: "serial",
      label: "Theo số sê-ri / IMEI (Điện thoại, iPad)",
      sublabel: "Bắt buộc nhập IMEI từng chiếc khi nhập/xuất kho",
      icon: <Smartphone className="h-4 w-4 text-cyan-600" />,
    },
    {
      value: "quantity",
      label: "Theo số lượng (Phụ kiện, Cường lực, Ốp lưng)",
      sublabel: "Quản lý tồn kho theo số đếm tổng",
      icon: <Package className="h-4 w-4 text-emerald-600" />,
    },
    {
      value: "unit_barcode",
      label: "Theo mã vạch từng đơn vị (Tai nghe, Loa)",
      sublabel: "Mỗi sản phẩm có 1 barcode định danh riêng",
      icon: <QrCode className="h-4 w-4 text-violet-600" />,
    },
    {
      value: "none",
      label: "Không theo dõi (Dịch vụ, Sửa chữa)",
      sublabel: "Không lưu tồn kho",
      icon: <Ban className="h-4 w-4 text-slate-400" />,
    },
  ], []);

  const statusDropdownOptions = useMemo<DropdownOption<"active" | "inactive">[]>(() => [
    {
      value: "active",
      label: "Đang dùng",
      icon: <span className="h-2 w-2 rounded-full bg-emerald-500" />,
    },
    {
      value: "inactive",
      label: "Ngừng dùng",
      icon: <span className="h-2 w-2 rounded-full bg-slate-400" />,
    },
  ], []);

  const attributeTypeOptions = useMemo<DropdownOption<string>[]>(() => [
    {
      value: "select",
      label: "Chọn một (Select) - Dùng tạo các phiên bản SKU",
      sublabel: "Màu sắc, Dung lượng, Tình trạng máy...",
      icon: <Check className="h-4 w-4 text-cyan-600" />,
    },
    {
      value: "multi-select",
      label: "Chọn nhiều (Multi-select)",
      sublabel: "Đặc tính bổ trợ có nhiều lựa chọn cùng lúc",
      icon: <Layers className="h-4 w-4 text-violet-600" />,
    },
    {
      value: "text",
      label: "Văn bản tự do (Text)",
      sublabel: "Chuỗi thông số nhập tay",
      icon: <FileText className="h-4 w-4 text-slate-500" />,
    },
  ], []);

  return (
    <Modal title={title} onClose={onClose} wide>
      {kind === "categories" ? (
        /* CATEGORY TREE 3-LEVEL 2-COLUMN VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Visual Tree Explorer (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <FolderTree className="h-4 w-4 text-cyan-700" />
                  Cây Thư Mục 3 Cấp
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cấp 1 (Ngành hàng) ➔ Cấp 2 (Dòng / Hãng) ➔ Cấp 3 (Đời máy / Chi tiết)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setParentCode("");
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold bg-white border border-slate-200 hover:border-cyan-400 hover:text-cyan-700 px-3 py-1.5 rounded-lg shadow-2xs transition-colors"
                title="Tạo thể loại hoặc ngành hàng gốc (Cấp 1)"
              >
                <FolderPlus className="h-3.5 w-3.5 text-cyan-600" />
                Thêm Cấp 1
              </button>
            </div>

            {/* Tree Items List */}
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {tree.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50/50">
                  <Folder className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Chưa có thể loại nào</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Tạo ngành hàng Cấp 1 đầu tiên (ví dụ: Điện thoại, iPad, Củ cáp sạc, Phụ kiện, Linh kiện...).
                  </p>
                </div>
              ) : (
                tree.map((root) => {
                  const isRootSelected = editingId === root.category._id;
                  const isRootParentActive = parentCode === root.category.code && !editingId;

                  return (
                    <div
                      key={root.category._id}
                      className={`rounded-xl border transition-all ${
                        isRootSelected
                          ? "border-cyan-500 bg-cyan-50/40 ring-1 ring-cyan-500"
                          : isRootParentActive
                          ? "border-cyan-300 bg-cyan-50/20"
                          : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      {/* LEVEL 1: Ngành hàng gốc */}
                      <div className="p-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600">
                            <Folder className="h-4 w-4 fill-amber-500/20" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm truncate">{root.category.name}</span>
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {root.category.code}
                              </span>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                Cấp 1
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {root.children.length} mục Cấp 2
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  root.category.defaultTrackingMode === "serial"
                                    ? "bg-cyan-50 text-cyan-700 border border-cyan-200/80"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                                }`}
                              >
                                {trackingLabels[root.category.defaultTrackingMode || "serial"]}
                              </span>
                            </div>
                            {root.category.description && (
                              <p className="text-xs text-slate-500 truncate mt-0.5">{root.category.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Actions for Level 1 */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              resetForm();
                              setParentCode(root.category.code);
                              setDefaultTrackingMode(root.category.defaultTrackingMode || "serial");
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-cyan-50 hover:bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800 transition-colors border border-cyan-200"
                            title={`Tạo thể loại Cấp 2 thuộc "${root.category.name}"`}
                          >
                            <Plus className="h-3 w-3" />
                            Thêm Cấp 2
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(root.category)}
                            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-cyan-700 transition-colors"
                            title="Sửa ngành hàng"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(root.category)}
                            className="p-1.5 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Xóa ngành hàng"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* LEVEL 2: Dòng sản phẩm / Hãng */}
                      {root.children.length > 0 && (
                        <div className="border-t border-slate-100 bg-slate-50/50 p-2.5 space-y-2 pl-5">
                          {root.children.map((l2) => {
                            const isL2Selected = editingId === l2.category._id;
                            const isL2ParentActive = parentCode === l2.category.code && !editingId;

                            return (
                              <div
                                key={l2.category._id}
                                className={`rounded-lg border transition-all ${
                                  isL2Selected
                                    ? "bg-cyan-100/70 border-cyan-400 font-medium"
                                    : isL2ParentActive
                                    ? "bg-cyan-50/40 border-cyan-300"
                                    : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                                }`}
                              >
                                <div className="p-2.5 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FolderOpen className="h-4 w-4 text-cyan-700 shrink-0" />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-bold text-slate-900 truncate">
                                          {l2.category.name}
                                        </span>
                                        <span className="font-mono text-[10px] text-slate-400">
                                          ({l2.category.code})
                                        </span>
                                        <span className="rounded-full bg-cyan-100 px-1.5 py-0.2 text-[9px] font-bold text-cyan-800">
                                          Cấp 2
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          • {l2.children.length} mục Cấp 3
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Actions for Level 2 */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        resetForm();
                                        setParentCode(l2.category.code);
                                        setDefaultTrackingMode(l2.category.defaultTrackingMode || "serial");
                                      }}
                                      className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-purple-50 hover:text-purple-700 px-2 py-0.5 text-[11px] font-semibold text-slate-700 transition-colors border border-slate-200"
                                      title={`Tạo chi tiết Cấp 3 thuộc "${l2.category.name}"`}
                                    >
                                      <Plus className="h-3 w-3" />
                                      Thêm Cấp 3
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEdit(l2.category)}
                                      className="p-1 rounded text-slate-400 hover:text-cyan-700 hover:bg-slate-100 transition-colors"
                                      title="Sửa mục Cấp 2"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteItem(l2.category)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                      title="Xóa mục Cấp 2"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* LEVEL 3: Đời máy / Phân loại chi tiết (Lá - Tối đa) */}
                                {l2.children.length > 0 && (
                                  <div className="border-t border-slate-100 bg-slate-50/80 p-2 space-y-1 pl-6">
                                    {l2.children.map((l3, idx3) => {
                                      const isL3Selected = editingId === l3.category._id;
                                      const isLast = idx3 === l2.children.length - 1;

                                      return (
                                        <div
                                          key={l3.category._id}
                                          className={`flex items-center justify-between gap-2 p-1.5 rounded transition-all text-xs ${
                                            isL3Selected
                                              ? "bg-purple-100/80 border border-purple-400 font-medium"
                                              : "bg-white border border-slate-200/60 hover:border-slate-300"
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-slate-400 font-mono text-[11px] select-none shrink-0">
                                              {isLast ? "└──" : "├──"}
                                            </span>
                                            <Tag className="h-3 w-3 text-purple-600 shrink-0" />
                                            <span className="font-medium text-slate-800 truncate">
                                              {l3.category.name}
                                            </span>
                                            <span className="font-mono text-[10px] text-slate-400">
                                              ({l3.category.code})
                                            </span>
                                            <span className="rounded bg-purple-50 px-1.5 py-0.2 text-[9px] font-semibold text-purple-700 border border-purple-200">
                                              Cấp 3 (Lá)
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => startEdit(l3.category)}
                                              className="p-1 rounded text-slate-400 hover:text-cyan-700 hover:bg-slate-100"
                                              title="Sửa mục Cấp 3"
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => deleteItem(l3.category)}
                                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                              title="Xóa mục Cấp 3"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Form Panel (5 cols) */}
          <div className="lg:col-span-5">
            <form
              onSubmit={submit}
              className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3.5 sticky top-2 shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  {editingId ? (
                    <>
                      <Pencil className="h-4 w-4 text-cyan-700" />
                      Chỉnh sửa thể loại
                    </>
                  ) : targetLevel === 1 ? (
                    <>
                      <FolderPlus className="h-4 w-4 text-amber-600" />
                      Tạo Ngành hàng (Cấp 1)
                    </>
                  ) : targetLevel === 2 ? (
                    <>
                      <FolderOpen className="h-4 w-4 text-cyan-700" />
                      Tạo Dòng / Hãng (Cấp 2)
                    </>
                  ) : (
                    <>
                      <Tag className="h-4 w-4 text-purple-600" />
                      Tạo Đời máy / Chi tiết (Cấp 3)
                    </>
                  )}
                </h4>
                {(editingId || parentCode) && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-cyan-700 hover:underline font-medium"
                  >
                    + Tạo Cấp 1 mới
                  </button>
                )}
              </div>

              {/* Informative indicator when adding child category */}
              {parentCode && !editingId && (
                <div
                  className={`rounded-lg p-2.5 text-xs border flex items-center justify-between gap-2 ${
                    targetLevel === 2
                      ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                      : "bg-purple-50 text-purple-800 border-purple-200"
                  }`}
                >
                  <div>
                    <span>
                      Đang tạo <strong>Cấp {targetLevel}</strong> thuộc:{" "}
                      <strong>{selectedParentCategory?.name || parentCode}</strong>
                    </span>
                    {targetLevel === 3 && (
                      <p className="text-[10px] text-purple-600 mt-0.5">
                        ⭐ Đây là cấp chi tiết tối đa trong cây phân cấp 3 tầng.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setParentCode("")}
                    className="text-slate-500 hover:text-slate-900 underline text-[11px] shrink-0"
                    title="Đổi thành ngành hàng gốc"
                  >
                    Hủy gán cha
                  </button>
                </div>
              )}

              <Field label="Tên thể loại / thư mục *">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClassName("bg-white")}
                  placeholder={
                    targetLevel === 1
                      ? "VD: Điện thoại, Phụ kiện, Máy tính bảng..."
                      : targetLevel === 2
                      ? "VD: Apple (iPhone), Samsung Galaxy, Củ cáp sạc..."
                      : "VD: iPhone 16 Series, Cáp Type-C, Tai nghe AirPods..."
                  }
                  autoFocus
                />
              </Field>

              <Field label="Mã định danh (tự sinh nếu để trống)">
                <input
                  disabled={Boolean(editingId)}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={inputClassName("font-mono disabled:bg-slate-100 bg-white")}
                  placeholder={
                    targetLevel === 1
                      ? "VD: CAT-DIEN-THOAI"
                      : targetLevel === 2
                      ? "VD: CAT-IPHONE"
                      : "VD: CAT-IPHONE-16"
                  }
                />
              </Field>

              <Field label="Thuộc thư mục cha (Chỉ chọn Cấp 1 hoặc Cấp 2)">
                <Dropdown<string>
                  value={parentCode}
                  onChange={setParentCode}
                  options={parentDropdownOptions}
                  variant="form"
                  size="md"
                  className="w-full"
                  triggerClassName="w-full text-xs font-medium"
                  searchable={eligibleParents.length > 8}
                  searchPlaceholder="Tìm thư mục cha..."
                />
              </Field>

              <Field label="Quản lý kho mặc định">
                <Dropdown<ProductTrackingMode>
                  value={defaultTrackingMode}
                  onChange={setDefaultTrackingMode}
                  options={trackingOptions}
                  variant="form"
                  size="md"
                  maxHeight="max-h-40"
                  className="w-full"
                  triggerClassName="w-full text-xs font-medium"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Trạng thái">
                  <Dropdown<"active" | "inactive">
                    value={status}
                    onChange={setStatus}
                    options={statusDropdownOptions}
                    variant="form"
                    size="md"
                    className="w-full"
                    triggerClassName="w-full text-xs font-medium"
                  />
                </Field>

                <Field label="Mô tả">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputClassName("bg-white")}
                    placeholder="Ghi chú thêm..."
                  />
                </Field>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white transition-colors"
                >
                  Làm mới
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-cyan-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-60 transition-colors shadow-xs"
                >
                  {submitting
                    ? "Đang lưu..."
                    : editingId
                    ? "Lưu thay đổi"
                    : `Tạo Cấp ${targetLevel}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* BRANDS & ATTRIBUTES VIEW */
        <div className="space-y-6">
          <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900">{editingId ? "Chỉnh sửa thuộc tính" : "Tạo mới thuộc tính"}</h4>
                {editingId && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    Đang sửa
                  </span>
                )}
              </div>
              {editingId && (
                <button type="button" onClick={resetForm} className="text-xs text-cyan-700 hover:underline">
                  + Tạo mục mới
                </button>
              )}
            </div>

            {/* One-Click Presets for phone/accessories retail attributes */}
            {kind === "attributes" && !editingId && (
              <div className="rounded-lg bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 border border-cyan-100 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-900 mb-2">
                  <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Chọn mẫu thuộc tính chuẩn (Gợi ý cho shop điện thoại & phụ kiện):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyAttributePreset("COLOR")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-cyan-600 hover:text-cyan-700 shadow-2xs transition-all"
                  >
                    <Palette className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                    <span>Màu sắc (10 màu)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAttributePreset("STORAGE")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-cyan-600 hover:text-cyan-700 shadow-2xs transition-all"
                  >
                    <HardDrive className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span>Dung lượng (5 mức)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAttributePreset("CONDITION")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-cyan-600 hover:text-cyan-700 shadow-2xs transition-all"
                  >
                    <Smartphone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Tình trạng máy (4 cấp)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAttributePreset("ORIGIN")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-cyan-600 hover:text-cyan-700 shadow-2xs transition-all"
                  >
                    <Globe className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span>Thị trường (VN/A, LL/A...)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAttributePreset("RAM")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-cyan-600 hover:text-cyan-700 shadow-2xs transition-all"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>RAM (4GB - 24GB)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAttributePreset("WATTAGE")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-cyan-600 hover:text-cyan-700 shadow-2xs transition-all"
                  >
                    <Plug className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    <span>Công suất sạc</span>
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tên gọi *">
                <input
                  required
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setName(val);
                    if (!editingId && (!code || code.startsWith("ATTR_"))) {
                      setCode(generateAttributeCode(val));
                    }
                  }}
                  className={inputClassName("bg-white")}
                  placeholder={kind === "brands" ? "VD: Apple, Samsung, Anker..." : "VD: Màu sắc, Dung lượng, Tình trạng máy..."}
                  autoFocus
                />
              </Field>

              <Field label="Mã định danh (tự sinh nếu để trống)">
                <input
                  disabled={Boolean(editingId)}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className={inputClassName("font-mono disabled:bg-slate-100 bg-white uppercase")}
                  placeholder={kind === "brands" ? "VD: BRAND-APPLE, BRAND-SAMSUNG..." : "VD: COLOR, STORAGE, CONDITION, RAM..."}
                />
              </Field>

              {kind === "attributes" && (
                <>
                  <div className="md:col-span-2">
                    <Field label="Kiểu chọn lựa">
                      <Dropdown<any>
                        value={attributeType}
                        onChange={setAttributeType}
                        options={attributeTypeOptions}
                        variant="form"
                        size="md"
                        className="w-full"
                        triggerClassName="w-full text-xs font-medium"
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <AttributeChipInput
                      values={attributeOptions}
                      onChange={setAttributeOptions}
                      suggestions={attributeSuggestions}
                      disabled={submitting}
                    />
                  </div>
                </>
              )}

              <Field label="Trạng thái">
                <Dropdown<"active" | "inactive">
                  value={status}
                  onChange={setStatus}
                  options={statusDropdownOptions}
                  variant="form"
                  size="md"
                  className="w-full"
                  triggerClassName="w-full text-xs font-medium"
                />
              </Field>

              {kind !== "attributes" && (
                <Field label="Mô tả">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputClassName("bg-white")}
                    placeholder="Ghi chú thêm..."
                  />
                </Field>
              )}
            </div>

            <ModalActions onClose={onClose} submitting={submitting} label={editingId ? "Lưu thay đổi" : "Tạo mới"} />
          </form>

          {/* List items */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 font-semibold text-sm text-slate-800">
              <div className="flex items-center gap-2">
                <span>Danh sách đã khai báo ({filteredItems.length}{filteredItems.length !== items.length ? `/${items.length}` : ""})</span>
                {kind === "attributes" && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={seedPhoneAttributes}
                    className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50 transition-colors ml-2"
                    title="Thêm các thuộc tính chuẩn ngành hàng điện thoại còn thiếu"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Nạp mẫu chuẩn còn thiếu</span>
                  </button>
                )}
              </div>

              {items.length > 2 && (
                <div className="relative w-48 sm:w-60">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm thuộc tính, mã, giá trị..."
                    className="w-full rounded-md border border-slate-200 bg-white py-1 pl-8 pr-2 text-xs placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {items.length === 0 ? (
              kind === "attributes" ? (
                <div className="p-8 text-center bg-slate-50/40">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 mb-3 ring-8 ring-cyan-50">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h5 className="font-semibold text-slate-800 text-sm mb-1">
                    Chưa có thuộc tính sản phẩm nào
                  </h5>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                    Tạo thuộc tính (Màu sắc, Dung lượng, Kích cỡ...) giúp phân loại và tự động tạo nhanh các phiên bản sản phẩm.
                  </p>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={seedPhoneAttributes}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-800 shadow-md shadow-cyan-900/10 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Khởi tạo nhanh bộ thuộc tính mẫu (Màu sắc, Dung lượng, Tình trạng, Thị trường)</span>
                  </button>
                </div>
              ) : (
                <p className="p-6 text-center text-sm text-slate-500">Chưa có dữ liệu nào được khai báo.</p>
              )
            ) : filteredItems.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">Không tìm thấy thuộc tính khớp với từ khóa "{searchQuery}".</p>
            ) : kind === "attributes" ? (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {(filteredItems as any[]).map((attr) => (
                  <div key={attr._id} className="p-4 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{attr.name}</span>
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          {attr.code}
                        </span>
                        <span className="rounded-full bg-cyan-50 border border-cyan-200/80 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                          {attr.type === "select"
                            ? "Chọn 1 (Tạo biến thể SKU)"
                            : attr.type === "multi-select"
                            ? "Chọn nhiều"
                            : "Văn bản"}
                        </span>
                        {attr.status === "active" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Đang dùng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Ngừng dùng
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-medium">
                          • {attr.options?.length || 0} giá trị
                        </span>
                      </div>

                      {attr.options && attr.options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {attr.options.map((optVal: string) => (
                            <span
                              key={optVal}
                              className="rounded-md bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                            >
                              {optVal}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => startEdit(attr)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-cyan-600 hover:text-cyan-700 shadow-2xs transition-colors"
                        title="Chỉnh sửa thuộc tính"
                      >
                        <Pencil className="h-3.5 w-3.5 text-cyan-700" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateAttribute(attr)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-cyan-600 hover:text-cyan-700 shadow-2xs transition-colors"
                        title="Nhân bản thuộc tính này"
                      >
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(attr)}
                        className="rounded-lg border border-slate-200 bg-white p-1 text-slate-400 hover:border-rose-300 hover:text-rose-600 shadow-2xs transition-colors ml-1"
                        title="Xóa thuộc tính"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Mã</th>
                      <th className="px-4 py-2.5 font-medium">Tên thương hiệu</th>
                      <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                      <th className="px-4 py-2.5 text-right font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(filteredItems as any[]).map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{item.code}</td>
                        <td className="px-4 py-2.5 text-slate-800 font-semibold">{item.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {item.status === "active" ? (
                            <span className="text-emerald-700 font-medium">Đang dùng</span>
                          ) : (
                            <span className="text-slate-400">Ngừng dùng</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-cyan-700"
                            title="Sửa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 ml-1"
                            title="Xóa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
