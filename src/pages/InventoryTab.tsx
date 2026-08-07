import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle, Cpu, Download, FolderTree, Pencil, Plus, Search, Tags, Trash2, Upload, ArrowDownRight, ArrowUpRight, Package, ArrowLeftRight, Sparkles } from "lucide-react";
import { InventoryForecastSummary, InventorySubTabType, ProductCategory, ProductItem, StockLog } from "../types";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import { INVENTORY_SUB_TAB_ROUTES } from "../router/subTabRoutes";
import { toast } from "./Toast";
import { getApiErrorMessage } from "../utils/errorMessage";
import { CategoryModal } from "../components/inventory/CategoryModal";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { inventoryTabs } from "../components/inventory/data";
import { ProductCard, formatCurrencyCompact } from "../components/inventory/ProductCard";
import { Pagination } from "../components/common/Pagination";
import { ProductModal } from "../components/inventory/ProductModal";
import { CategoryManagementSection } from "../components/inventory/CategoryManagementSection";
import { InventoryTabHeader } from "../components/inventory/InventoryTabHeader";
import { ProductCatalogSection } from "../components/inventory/ProductCatalogSection";
import { SummaryCard } from "../components/inventory/SummaryCard";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { inventoryCategoryService } from "../services/inventoryCategoryService";
import { inventoryProductService } from "../services/inventoryProductService";
import { inventoryStockLogService } from "../services/inventoryStockLogService";
import { ViewToggle } from "../components/inventory/ViewToggle";

// Lazy-loaded subcomponents
const AiForecastPanel = lazy(() =>
  import("../components/inventory/AiForecastPanel").then((module) => ({
    default: module.AiForecastPanel,
  }))
);
const StockLogPanel = lazy(() =>
  import("../components/inventory/StockLogPanel").then((module) => ({
    default: module.StockLogPanel,
  }))
);
import { buildInventoryForecast } from "../utils/inventoryForecast";
import { parseFirebaseError } from "../utils/firebaseErrorParser";

function getInventoryErrorMessage(error: unknown, fallbackMessage: string) {
  return parseFirebaseError(error, fallbackMessage);
}

type TransactionStatus = "Đang chờ" | "Đang xử lý" | "Hoàn thành";

type DeleteTarget =
  | { type: "product"; id: string; title: string; description: string; confirmLabel: string; tone: "danger" | "warning" }
  | { type: "category"; id: string; title: string; description: string; confirmLabel: string; tone: "danger" | "warning" }
  | { type: "log"; id: string; title: string; description: string; confirmLabel: string; tone: "danger" | "warning" };

function isCompletedTransactionStatus(status: TransactionStatus | string) {
  return String(status).trim().toLowerCase() === "hoàn thành";
}

function getStockLogItems(log: StockLog) {
  const typedLog = log as StockLog & {
    title?: string;
    items?: Array<{ productId?: string; sku: string; productName: string; quantity: number }>;
  };

  if (typedLog.items?.length) {
    return typedLog.items;
  }

  return [{ sku: log.sku, productName: log.productName, quantity: log.quantity }];
}

export default function InventoryTab() {
  const { user, userProfile } = useAuth();
  const { activeBranchId, loading: branchLoading } = useBranch();
  const [subTab, setSubTab] = useSubTabRouter<InventorySubTabType>(INVENTORY_SUB_TAB_ROUTES, "DANH MỤC");
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(true);
  const [stockLogLoading, setStockLogLoading] = useState(true);
  const [productSubmitting, setProductSubmitting] = useState(false);

  const [searchProduct, setSearchProduct] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("Tất cả");
  const [searchCategory, setSearchCategory] = useState("");
  const [searchLog, setSearchLog] = useState("");
  const [productExcelImporting, setProductExcelImporting] = useState(false);
  const [stockLogExcelImporting, setStockLogExcelImporting] = useState(false);
  const [productPage, setProductPage] = useState(1);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("");
  const [newProdStock, setNewProdStock] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdCostPrice, setNewProdCostPrice] = useState("");
  const [newProdSKU, setNewProdSKU] = useState("");
  const [newProdBrand, setNewProdBrand] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("Cái");
  const [newProdDescription, setNewProdDescription] = useState("");
  const [newProdStatus, setNewProdStatus] = useState("Active");
  const [newProdImageFile, setNewProdImageFile] = useState<File | null>(null);
  const [newProdImagePreview, setNewProdImagePreview] = useState("");

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryCode, setNewCategoryCode] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [productViewMode, setProductViewMode] = useState<"grid" | "list">("grid");
  const [categoryViewMode, setCategoryViewMode] = useState<"grid" | "list">("grid");
  const productImportInputRef = useRef<HTMLInputElement | null>(null);
  const stockLogImportInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let unsubscribeCategories = () => { };
    let unsubscribeProducts = () => { };
    let unsubscribeStockLogs = () => { };

    if (!user) {
      setCategoryLoading(false);
      setProductLoading(false);
      setStockLogLoading(false);
      return;
    }

    if (branchLoading || !activeBranchId) {
      if (!branchLoading) {
        setCategoryLoading(false);
        setProductLoading(false);
        setStockLogLoading(false);
      }
      return;
    }

    setCategoryLoading(true);
    setProductLoading(true);
    setStockLogLoading(true);

    unsubscribeCategories = inventoryCategoryService.subscribe(
      activeBranchId,
      (nextCategories) => {
        setCategories(nextCategories);
        setCategoryLoading(false);
      },
      () => {
        setCategoryLoading(false);
        toast.error("Không thể tải phân loại sản phẩm.");
      }
    );

    unsubscribeProducts = inventoryProductService.subscribe(
      activeBranchId,
      (nextProducts) => {
        setProducts(nextProducts);
        setProductLoading(false);
      },
      () => {
        setProductLoading(false);
        toast.error("Không thể tải danh mục sản phẩm.");
      }
    );

    unsubscribeStockLogs = inventoryStockLogService.subscribe(
      activeBranchId,
      (nextLogs) => {
        setStockLogs(nextLogs);
        setStockLogLoading(false);
      },
      () => {
        setStockLogLoading(false);
        toast.error("Không thể tải phiếu nhập xuất kho.");
      }
    );

    return () => {
      unsubscribeCategories();
      unsubscribeProducts();
      unsubscribeStockLogs();
    };
  }, [user, activeBranchId, branchLoading]);

  useEffect(() => {
    if (!categories.length || newProdCategory) return;
    const activeCategory = categories.find((category) => category.status === "Đang dùng");
    setNewProdCategory(activeCategory?.name || categories[0].name);
  }, [categories, newProdCategory]);

  useEffect(() => {
    setProductPage(1);
  }, [searchProduct, selectedCategoryFilter]);

  const forecastSummary = useMemo<InventoryForecastSummary>(
    () => buildInventoryForecast(products, stockLogs),
    [products, stockLogs]
  );

  const activeCategoryCount = categories.filter((category) => category.status === "Đang dùng").length;
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchCategory.toLowerCase()) ||
    category.code.toLowerCase().includes(searchCategory.toLowerCase())
  );

  const filteredProducts = products.filter((product) => {
    const query = searchProduct.toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query);
    const matchesCategory = selectedCategoryFilter === "Tất cả" || product.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });
  const productsPerPage = 8;
  const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
  const paginatedProducts = filteredProducts.slice((productPage - 1) * productsPerPage, productPage * productsPerPage);

  useEffect(() => {
    if (productPage > totalProductPages) {
      setProductPage(totalProductPages);
    }
  }, [productPage, totalProductPages]);

  const resetProductForm = () => {
    setEditingProductId(null);
    setShowProductModal(false);
    setNewProdName("");
    setNewProdStock("");
    setNewProdPrice("");
    setNewProdCostPrice("");
    setNewProdSKU("");
    setNewProdBrand("");
    setNewProdUnit("Cái");
    setNewProdDescription("");
    setNewProdStatus("Active");
    setNewProdImageFile(null);
    setNewProdImagePreview("");
    const activeCategory = categories.find((category) => category.status === "Đang dùng");
    setNewProdCategory(activeCategory?.name || categories[0]?.name || "");
  };

  const openCreateProductModal = () => {
    resetProductForm();
    setShowProductModal(true);
  };

  const openEditProductModal = (product: ProductItem) => {
    setEditingProductId(product.id);
    setNewProdName(product.name);
    setNewProdCategory(product.category);
    setNewProdStock(String(product.stock));
    setNewProdPrice(String(product.price));
    setNewProdCostPrice(product.costPrice === undefined ? "" : String(product.costPrice));
    setNewProdSKU(product.sku);
    setNewProdBrand(product.brand || "");
    setNewProdUnit(product.unit || "Cái");
    setNewProdDescription(product.description || "");
    setNewProdStatus(product.status || "Active");
    setNewProdImageFile(null);
    setNewProdImagePreview(product.imageUrl);
    setShowProductModal(true);
  };

  const handleProductImageChange = (file: File | null) => {
    setNewProdImageFile(file);
    if (!file) {
      if (!editingProductId) setNewProdImagePreview("");
      return;
    }

    const nextPreview = URL.createObjectURL(file);
    setNewProdImagePreview(nextPreview);
  };

  const handleSaveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newProdName.trim() || !newProdSKU.trim()) return;

    const sku = newProdSKU.trim().toUpperCase();
    const name = newProdName.trim();
    const stock = parseInt(newProdStock, 10) || 0;
    const price = parseInt(newProdPrice, 10) || 0;
    const costPrice = newProdCostPrice === "" ? undefined : Math.max(0, Number(newProdCostPrice));
    const category = newProdCategory || "Chưa phân loại";
    const brand = newProdBrand.trim();
    const unit = newProdUnit.trim() || "Cái";
    const description = newProdDescription.trim();
    const status = (newProdStatus || "Active") as "Active" | "Inactive";

    setProductSubmitting(true);

    try {
      const isSkuAvailable = await inventoryProductService.ensureSkuAvailable(sku, editingProductId || undefined, activeBranchId);
      if (!isSkuAvailable) {
        toast.error("Mã sản phẩm này đã tồn tại trong kho.");
        setProductSubmitting(false);
        return;
      }

      if (editingProductId) {
        const currentProduct = products.find((product) => product.id === editingProductId);
        const result = await inventoryProductService.updateProduct(editingProductId, {
          sku,
          name,
          category,
          brand,
          unit,
          stock,
          price,
          costPrice,
          description,
          status,
          imageFile: newProdImageFile,
          imageUrl: currentProduct?.imageUrl || "",
        }, activeBranchId);

        if (result?.imageUploadFailed) {
          const uploadErrMsg = parseFirebaseError(result.imageUploadError, "Lỗi kết nối bộ lưu trữ.");
          toast.success(`Đã cập nhật sản phẩm, nhưng không thể tải lên hình ảnh (${uploadErrMsg})`);
        } else {
          toast.success("Đã cập nhật sản phẩm.");
        }
      } else {
        const result = await inventoryProductService.createProduct({
          sku,
          name,
          category,
          brand,
          unit,
          stock,
          price,
          costPrice,
          description,
          status,
          imageFile: newProdImageFile,
        }, activeBranchId);

        try {
          await inventoryStockLogService.createLog({
            type: "nhập",
            title: `Nhập hàng khởi tạo: ${name}`,
            sku,
            productName: name,
            quantity: stock,
            operatorName: userProfile?.displayName || "iGen Admin System",
            notes: "Khởi tạo sản phẩm mới trong danh mục",
            status: "Hoàn thành",
            items: [{ productId: result.productId || "", sku, productName: name, quantity: stock }],
          }, activeBranchId);
        } catch (logErr) {
          console.error("Lỗi tạo phiếu nhập kho khởi tạo:", logErr);
        }

        if (result?.imageUploadFailed) {
          const uploadErrMsg = parseFirebaseError(result.imageUploadError, "Lỗi kết nối bộ lưu trữ.");
          toast.success(`Đã tạo sản phẩm mới, nhưng không thể tải lên hình ảnh (${uploadErrMsg})`);
        } else {
          toast.success("Đã tạo sản phẩm mới.");
        }
      }

      resetProductForm();
    } catch (error) {
      toast.error(getInventoryErrorMessage(error, "Không thể lưu sản phẩm. Vui lòng thử lại."));
    } finally {
      setProductSubmitting(false);
    }
  };

  const handleDeleteProduct = async (product: ProductItem) => {
    setDeleteTarget({
      type: "product",
      id: product.id,
      title: "Xóa sản phẩm",
      description: `Bạn có chắc muốn xóa sản phẩm "${product.name}" khỏi danh mục kho không?`,
      confirmLabel: "Xóa sản phẩm",
      tone: "danger",
    });
  };

  const deleteProductById = async (productId: string) => {
    await inventoryProductService.deleteProduct(productId, activeBranchId);
    toast.success("Đã xóa sản phẩm.");
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setShowCategoryModal(false);
    setNewCategoryName("");
    setNewCategoryCode("");
    setNewCategoryDescription("");
  };

  const openCreateCategoryModal = () => {
    resetCategoryForm();
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (category: ProductCategory) => {
    setEditingCategoryId(category.id);
    setNewCategoryName(category.name);
    setNewCategoryCode(category.code);
    setNewCategoryDescription(category.description);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCategoryName.trim() || !newCategoryCode.trim()) return;

    const cleanName = newCategoryName.trim();
    const cleanCode = newCategoryCode.trim().toUpperCase();
    const currentCategory = editingCategoryId ? categories.find((category) => category.id === editingCategoryId) : null;
    const existed = categories.some(
      (category) => category.id !== editingCategoryId && category.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existed) {
      toast.error("Phân loại này đã có trong danh mục kho.");
      return;
    }

    try {
      if (editingCategoryId) {
        await inventoryCategoryService.updateCategory(editingCategoryId, {
          name: cleanName,
          code: cleanCode,
          description: newCategoryDescription.trim() || "Chưa có mô tả. Có thể bổ sung sau.",
        }, activeBranchId);

        if (currentCategory && currentCategory.name !== cleanName) {
          await inventoryProductService.updateProductsCategoryName(currentCategory.name, cleanName, activeBranchId);
          if (selectedCategoryFilter === currentCategory.name) setSelectedCategoryFilter(cleanName);
        }

        toast.success("Đã cập nhật phân loại sản phẩm.");
      } else {
        await inventoryCategoryService.createCategory({
          name: cleanName,
          code: cleanCode,
          description: newCategoryDescription.trim() || "Chưa có mô tả. Có thể bổ sung sau.",
        }, activeBranchId);
        setNewProdCategory(cleanName);
        toast.success("Đã tạo phân loại sản phẩm.");
      }

      resetCategoryForm();
    } catch (error) {
      toast.error(getInventoryErrorMessage(error, "Không thể lưu phân loại sản phẩm. Vui lòng thử lại."));
    }
  };

  const handleDeleteCategory = async (category: ProductCategory) => {
    const linkedProductCount = products.filter((product) => product.category === category.name).length;
    setDeleteTarget({
      type: "category",
      id: category.id,
      title: "Xóa phân loại",
      description:
        linkedProductCount > 0
          ? `Phân loại "${category.name}" đang được dùng bởi ${linkedProductCount} sản phẩm. Khi xóa, các sản phẩm đó sẽ được chuyển về "Chưa phân loại".`
          : `Bạn có chắc muốn xóa phân loại "${category.name}" không?`,
      confirmLabel: "Xóa phân loại",
      tone: linkedProductCount > 0 ? "warning" : "danger",
    });
  };

  const deleteCategoryById = async (categoryId: string) => {
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category) {
      throw new Error(JSON.stringify({ error: "Không tìm thấy phân loại cần xóa." }));
    }

    const linkedProductCount = products.filter((product) => product.category === category.name).length;
    if (linkedProductCount > 0) {
      await inventoryProductService.moveProductsToUncategorized(category.name, activeBranchId);
    }

    await inventoryCategoryService.deleteCategory(categoryId, activeBranchId);
    if (selectedCategoryFilter === category.name) setSelectedCategoryFilter("Tất cả");
    toast.success("Đã xóa phân loại sản phẩm.");
  };

  const handleExportProductsExcel = async () => {
    const { exportProductsToExcel } = await import("../utils/inventoryExcel");
    exportProductsToExcel(filteredProducts);
    toast.success("Đã xuất danh mục sản phẩm ra Excel.");
  };

  const handleOpenProductImport = () => {
    productImportInputRef.current?.click();
  };

  const handleImportProductsExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setProductExcelImporting(true);

    try {
      const { importProductsFromExcel } = await import("../utils/inventoryExcel");
      const importedRows = await importProductsFromExcel(file);

      if (importedRows.length === 0) {
        toast.error("File Excel không có dòng sản phẩm hợp lệ.");
        return;
      }

      const existingSkus = new Set(products.map((product) => product.sku.toUpperCase()));
      const importedSkus = new Set<string>();
      const existingCategoryNames = new Set(categories.map((c) => c.name.trim().toLowerCase()));
      const existingCodes = new Set(categories.map((c) => c.code.toUpperCase()));
      const createdCategoryNames = new Set<string>();
      let createdCount = 0;
      let skippedCount = 0;

      for (const row of importedRows) {
        if (existingSkus.has(row.sku) || importedSkus.has(row.sku)) {
          skippedCount += 1;
          continue;
        }

        // Auto-create category if it does not exist
        const catName = (row.category || "Chưa phân loại").trim();
        const catNameLower = catName.toLowerCase();
        if (catNameLower !== "chưa phân loại" && !existingCategoryNames.has(catNameLower) && !createdCategoryNames.has(catNameLower)) {
          let codeBase = catName
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[đĐ]/g, "d")
            .split(/\s+/)
            .map((word) => word[0])
            .join("")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
          if (!codeBase) {
            codeBase = "CAT";
          }
          let code = codeBase;
          let counter = 1;
          while (existingCodes.has(code)) {
            code = `${codeBase}${counter}`;
            counter++;
          }

          try {
            await inventoryCategoryService.createCategory({
              name: catName,
              code: code,
              description: `Danh mục được tạo tự động khi nhập sản phẩm từ Excel.`,
            }, activeBranchId);
            createdCategoryNames.add(catNameLower);
            existingCodes.add(code);
          } catch (err) {
            console.error("Lỗi khi tạo danh mục tự động:", err);
          }
        }

        await inventoryProductService.createProduct({
          sku: row.sku,
          name: row.name,
          category: row.category,
          brand: row.brand || "",
          unit: row.unit || "Cái",
          stock: row.stock,
          price: row.price,
          description: row.description || "",
          status: row.status || "Active",
          imageUrl: row.imageUrl || "",
        }, activeBranchId);

        importedSkus.add(row.sku);
        createdCount += 1;
      }

      if (createdCount > 0) {
        setStockLogs((currentLogs) => [
          ...importedRows
            .filter((row) => importedSkus.has(row.sku))
            .map((row, index) => ({
              id: `NK-IMPORT-${Date.now()}-${index}`,
              type: "nhập" as const,
              sku: row.sku,
              productName: row.name,
              quantity: row.stock,
              operatorName: "Excel Import",
              createdAt: "Import tu Excel",
              notes: "Tao san pham tu file Excel",
              status: "Thành công" as const,
            })),
          ...currentLogs,
        ]);
      }

      if (createdCount === 0) {
        toast.error("Không có sản phẩm mới nào được nhập. Kiểm tra mã sản phẩm bị trùng.");
        return;
      }

      if (skippedCount > 0) {
        toast.success(`Đã nhập ${createdCount} sản phẩm, bỏ qua ${skippedCount} dòng có mã sản phẩm trùng.`);
      } else {
        toast.success(`Đã nhập ${createdCount} sản phẩm từ Excel.`);
      }
    } catch (error) {
      toast.error(getInventoryErrorMessage(error, "Không thể nhập sản phẩm từ Excel."));
    } finally {
      setProductExcelImporting(false);
    }
  };

  const handleExportStockLogsExcel = async () => {
    const { exportStockLogsToExcel } = await import("../utils/inventoryExcel");
    exportStockLogsToExcel(stockLogs);
    toast.success("Đã xuất phiếu nhập xuất kho ra Excel.");
  };

  const handleOpenStockLogImport = () => {
    stockLogImportInputRef.current?.click();
  };

  const handleImportStockLogsExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setStockLogExcelImporting(true);

    try {
      const { importStockLogsFromExcel } = await import("../utils/inventoryExcel");
      const importedLogs = await importStockLogsFromExcel(file);

      if (importedLogs.length === 0) {
        toast.error("File Excel không có phiếu nhập xuất hợp lệ.");
        return;
      }

      const existingIds = new Set(stockLogs.map((log) => log.id));
      const nextLogs = importedLogs.filter((log) => !existingIds.has(log.id));
      let addedCount = 0;

      if (nextLogs.length === 0) {
        toast.error("Không có phiếu hợp lệ nào được nhập.");
        return;
      }

      const runningStocks = new Map(products.map((product) => [product.id, product.stock]));

      for (const log of nextLogs) {
        const logItems = getStockLogItems(log);
        const resolvedItems = logItems.map((item) => {
          const product = products.find((entry) => entry.sku === item.sku);
          if (!product) {
            throw new Error(JSON.stringify({ error: `Không tìm thấy sản phẩm có mã ${item.sku} trong danh mục kho.` }));
          }
          return { product, quantity: item.quantity };
        });

        const normalizedStatus: TransactionStatus =
          log.status === "Hoàn thành" || log.status === "Thành công"
            ? "Hoàn thành"
            : log.status === "Đang xử lý"
              ? "Đang xử lý"
              : "Đang chờ";

        if (isCompletedTransactionStatus(normalizedStatus)) {
          for (const item of resolvedItems) {
            const currentStock = runningStocks.get(item.product.id) ?? item.product.stock;
            if (log.type === "xuất" && currentStock < item.quantity) {
              throw new Error(
                JSON.stringify({ error: `Số lượng tồn kho của ${item.product.name} không đủ để import phiếu xuất hoàn thành.` })
              );
            }
          }

          await Promise.all(
            resolvedItems.map((item) => {
              const currentStock = runningStocks.get(item.product.id) ?? item.product.stock;
              const nextStock = log.type === "nhập" ? currentStock + item.quantity : currentStock - item.quantity;
              runningStocks.set(item.product.id, nextStock);
              return inventoryProductService.updateProductStock(item.product.id, nextStock, activeBranchId);
            })
          );
        }

        await inventoryStockLogService.saveImportedLog(log.id, {
          type: log.type as "nhập" | "xuất",
          purpose: log.purpose,
          title: (log as StockLog & { title?: string }).title || `${log.type === "nhập" ? "Phiếu nhập" : "Phiếu xuất"} import`,
          items: resolvedItems.map((item) => ({
            productId: item.product.id,
            sku: item.product.sku,
            productName: item.product.name,
            quantity: item.quantity,
          })),
          sku: resolvedItems[0].product.sku,
          productName: resolvedItems[0].product.name,
          quantity: resolvedItems.reduce((sum, item) => sum + item.quantity, 0),
          operatorName: log.operatorName || "Excel Import",
          notes: log.notes || "",
          status: normalizedStatus,
          createdAt: log.createdAt,
        }, activeBranchId);

        addedCount += 1;
      }

      toast.success(`Đã nhập ${addedCount} phiếu nhập/xuất kho từ Excel.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể nhập phiếu nhập/xuất kho từ Excel."));
    } finally {
      setStockLogExcelImporting(false);
    }
  };

  const handleCreateTransaction = async (payload: {
    type: "nhập" | "xuất";
    purpose?: import("../types").StockLogPurpose;
    customerName?: string;
    title: string;
    operatorName: string;
    notes: string;
    status: TransactionStatus;
    items: Array<{ productId: string; quantity: number }>;
  }) => {
    const resolvedItems = payload.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) {
        throw new Error(JSON.stringify({ error: "Không tìm thấy sản phẩm trong kho." }));
      }
      return { product, quantity: item.quantity };
    });

    if (isCompletedTransactionStatus(payload.status)) {
      for (const item of resolvedItems) {
        if (payload.type === "xuất" && item.product.stock < item.quantity) {
          throw new Error(JSON.stringify({ error: `Số lượng tồn kho của ${item.product.name} không đủ để xuất.` }));
        }
      }

      await Promise.all(
        resolvedItems.map((item) =>
          inventoryProductService.updateProductStock(
            item.product.id,
            payload.type === "nhập" ? item.product.stock + item.quantity : item.product.stock - item.quantity,
            activeBranchId
          )
        )
      );
    }

    const logItems = resolvedItems.map((item) => ({
      productId: item.product.id,
      sku: item.product.sku,
      productName: item.product.name,
      quantity: item.quantity,
    }));

    // Lưu phiếu vào Firebase
    await inventoryStockLogService.createLog({
      type: payload.type,
      purpose: payload.purpose,
      customerName: payload.customerName,
      title: payload.title,
      items: logItems,
      sku: resolvedItems[0].product.sku,
      productName: resolvedItems[0].product.name,
      quantity: resolvedItems.reduce((sum, item) => sum + item.quantity, 0),
      operatorName: payload.operatorName,
      notes: payload.notes || (payload.type === "nhập" ? "Phiếu nhập kho mới" : "Phiếu xuất kho mới"),
      status: payload.status,
    }, activeBranchId);

    toast.success(payload.type === "nhập" ? "Đã tạo phiếu nhập kho." : "Đã tạo phiếu xuất kho.");
  };

  const handleUpdateTransaction = async (payload: {
    id?: string;
    type: "nhập" | "xuất";
    purpose?: import("../types").StockLogPurpose;
    customerName?: string;
    title: string;
    operatorName: string;
    notes: string;
    status: TransactionStatus;
    items: Array<{ productId: string; quantity: number }>;
  }) => {
    if (!payload.id) return;

    const existingLog = stockLogs.find((log) => log.id === payload.id);
    if (!existingLog) {
      throw new Error(JSON.stringify({ error: "Không tìm thấy phiếu cần chỉnh sửa." }));
    }

    const oldType = existingLog.type as "nhập" | "xuất";
    const oldStatus = existingLog.status;
    const oldItems = getStockLogItems(existingLog);

    const normalizedOldItems = oldItems.map((item) => {
      const product = products.find((entry) => entry.sku === item.sku);
      if (!product) {
        throw new Error(JSON.stringify({ error: `Không tìm thấy sản phẩm cũ ${item.productName} trong kho.` }));
      }
      return { product, quantity: item.quantity, type: oldType };
    });

    const normalizedNewItems = payload.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) {
        throw new Error(JSON.stringify({ error: "Không tìm thấy sản phẩm mới trong kho." }));
      }
      return { product, quantity: item.quantity, type: payload.type };
    });

    const shouldReverseOldStock = isCompletedTransactionStatus(oldStatus);
    const shouldApplyNewStock = isCompletedTransactionStatus(payload.status);

    const adjustments = new Map<string, number>();
    if (shouldReverseOldStock) {
      for (const item of normalizedOldItems) {
        const restoreAmount = item.type === "nhập" ? -item.quantity : item.quantity;
        adjustments.set(item.product.id, (adjustments.get(item.product.id) || 0) + restoreAmount);
      }
    }
    if (shouldApplyNewStock) {
      for (const item of normalizedNewItems) {
        const applyAmount = item.type === "nhập" ? item.quantity : -item.quantity;
        adjustments.set(item.product.id, (adjustments.get(item.product.id) || 0) + applyAmount);
      }
    }

    for (const [productId, delta] of adjustments.entries()) {
      const product = products.find((entry) => entry.id === productId);
      if (!product) continue;
      if (product.stock + delta < 0) {
        throw new Error(JSON.stringify({ error: `Số lượng tồn kho của ${product.name} không đủ sau khi cập nhật phiếu.` }));
      }
    }

    if (adjustments.size > 0) {
      await Promise.all(
        Array.from(adjustments.entries()).map(async ([productId, delta]) => {
          const product = products.find((entry) => entry.id === productId);
          if (!product) return;
          await inventoryProductService.updateProductStock(productId, product.stock + delta, activeBranchId);
        })
      );
    }

    const logItems = normalizedNewItems.map((item) => ({
      productId: item.product.id,
      sku: item.product.sku,
      productName: item.product.name,
      quantity: item.quantity,
    }));

    // Cập nhật phiếu trong Firebase
    await inventoryStockLogService.updateLog(payload.id, {
      type: payload.type,
      purpose: payload.purpose,
      customerName: payload.customerName,
      title: payload.title,
      items: logItems,
      sku: normalizedNewItems[0].product.sku,
      productName: normalizedNewItems[0].product.name,
      quantity: normalizedNewItems.reduce((sum, item) => sum + item.quantity, 0),
      operatorName: payload.operatorName,
      notes: payload.notes,
      status: payload.status,
    }, activeBranchId);

    toast.success("Đã cập nhật phiếu nhập xuất kho.");
  };

  const handleQuickUpdateTransactionStatus = async (logId: string, status: TransactionStatus) => {
    const existingLog = stockLogs.find((log) => log.id === logId);
    if (!existingLog) {
      throw new Error(JSON.stringify({ error: "Không tìm thấy phiếu cần cập nhật trạng thái." }));
    }

    const items = getStockLogItems(existingLog).map((item) => {
      const product = products.find((entry) => entry.sku === item.sku);
      if (!product) {
        throw new Error(JSON.stringify({ error: `Không tìm thấy sản phẩm ${item.productName} trong kho.` }));
      }
      return { productId: product.id, quantity: item.quantity };
    });

    await handleUpdateTransaction({
      id: existingLog.id,
      type: existingLog.type as "nhập" | "xuất",
      purpose: existingLog.purpose,
      title: (existingLog as StockLog & { title?: string }).title || `${existingLog.type === "nhập" ? "Phiếu nhập" : "Phiếu xuất"}: ${existingLog.productName}`,
      operatorName: existingLog.operatorName,
      notes: existingLog.notes,
      status,
      items,
    });
  };

  const handleDeleteTransaction = async (logId: string) => {
    setDeleteTarget({
      type: "log",
      id: logId,
      title: "Xóa phiếu nhập xuất",
      description: "Phiếu sẽ bị xóa khỏi hệ thống và thao tác này không thể hoàn tác. Dữ liệu tồn kho hiện tại sẽ không tự hoàn trả.",
      confirmLabel: "Xóa phiếu",
      tone: "danger",
    });
  };

  const deleteLogById = async (logId: string) => {
    await inventoryStockLogService.deleteLog(logId, activeBranchId);
    toast.success("Đã xóa phiếu.");
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleteSubmitting(true);

    try {
      if (deleteTarget.type === "product") {
        await deleteProductById(deleteTarget.id);
      } else if (deleteTarget.type === "category") {
        await deleteCategoryById(deleteTarget.id);
      } else {
        await deleteLogById(deleteTarget.id);
      }

      setDeleteTarget(null);
    } catch (error) {
      const fallbackMessage =
        deleteTarget.type === "product"
          ? "Không thể xóa sản phẩm. Vui lòng thử lại."
          : deleteTarget.type === "category"
            ? "Không thể xóa phân loại sản phẩm. Vui lòng thử lại."
            : "Không thể xóa phiếu. Vui lòng thử lại.";

      toast.error(getInventoryErrorMessage(error, fallbackMessage));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleNavigateToCreateProduct = () => {
    setSubTab("DANH MỤC");
    openCreateProductModal();
  };

  return (
    <div className="flex h-full max-h-[85vh] flex-col overflow-hidden bg-white" id="inventory_tab_wrapper">
      <h1 className="sr-only">Quản lý Kho & Sản phẩm - {subTab}</h1>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-3 pt-2 pb-0 text-xs sm:px-5" id="inventory_tabs_switch">
        <div className="flex gap-1 overflow-x-auto select-none">
          {[
            { id: "DANH MỤC", label: "Danh mục sản phẩm", icon: Package },
            { id: "PHÂN LOẠI SẢN PHẨM", label: "Phân loại kho", icon: Tags },
            { id: "NHẬP / XUẤT KHO", label: "Nhập / Xuất kho", icon: ArrowLeftRight },
            { id: "DỰ BÁO AI", label: "Dự báo AI", icon: Sparkles },
          ].map((tab) => {
            const isActive = subTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as InventorySubTabType)}
                className={`flex items-center gap-2 px-3.5 py-2.5 font-semibold text-xs transition-all cursor-pointer shrink-0 rounded-xl ${
                  isActive
                    ? "bg-cyan-600 text-white font-bold shadow-xs"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6" id="inventory_tab_content">
        {subTab === "DANH MỤC" && (
          <div className="space-y-6" id="product_catalog_menu">
            <input
              ref={productImportInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportProductsExcel}
            />
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center" id="catalog_filters">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc mã sản phẩm..."
                    className="w-full rounded-lg border border-gray-200 bg-slate-50/50 py-2 pl-9 pr-4 text-xs"
                    value={searchProduct}
                    onChange={(event) => setSearchProduct(event.target.value)}
                    id="product_search_filter"
                  />
                </div>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-slate-50/50 px-3 py-2 text-xs sm:w-52"
                  value={selectedCategoryFilter}
                  onChange={(event) => setSelectedCategoryFilter(event.target.value)}
                >
                  <option value="Tất cả">Tất cả phân loại</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <ViewToggle mode={productViewMode} onChange={setProductViewMode} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleOpenProductImport}
                  disabled={productExcelImporting}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {productExcelImporting ? "Đang nhập Excel..." : "Nhập Excel"}
                </button>
                <button
                  type="button"
                  onClick={handleExportProductsExcel}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100"
                >
                  <Download className="h-4 w-4" />
                  Xuất Excel
                </button>
                <button
                  onClick={openCreateProductModal}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700"
                  id="open_add_product_modal"
                >
                  <Plus className="h-4 w-4" />
                  Khai báo sản phẩm mới
                </button>
              </div>
            </div>

            {productLoading ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="font-bold text-gray-700">Đang tải danh mục sản phẩm...</p>
                <p className="mt-1 text-xs text-gray-500">Dữ liệu đang được đồng bộ từ Firebase.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="font-bold text-gray-700">Chưa có sản phẩm phù hợp</p>
              </div>
            ) : (
              <div className="space-y-4">
                {productViewMode === "grid" ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" id="products_grid">
                    {paginatedProducts.map((product) => (
                      <div key={product.id}>
                        <ProductCard product={product} onDelete={handleDeleteProduct} onEdit={openEditProductModal} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-150 bg-white shadow-2xs">
                    <table className="w-full border-collapse text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b border-gray-150">
                        <tr>
                          <th className="px-4 py-3">Ảnh</th>
                          <th className="px-4 py-3">Mã sản phẩm</th>
                          <th className="px-4 py-3">Tên sản phẩm</th>
                          <th className="px-4 py-3">Phân loại</th>
                          <th className="px-4 py-3">Đơn giá</th>
                          <th className="px-4 py-3">Tồn kho</th>
                          <th className="px-4 py-3">Dự báo AI</th>
                          <th className="px-4 py-3">Trạng thái</th>
                          <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedProducts.map((product) => {
                          const alertState = product.stock <= product.minStockAlert;
                          const formattedPrice = product.price.toLocaleString("vi-VN");
                          const compactPrice = formatCurrencyCompact(product.price);
                          const formattedStock = product.stock.toLocaleString("vi-VN");
                          return (
                            <tr key={product.id} className={`hover:bg-slate-50/55 transition-colors ${product.status === "Inactive" ? "opacity-60" : ""}`}>
                              <td className="px-4 py-2.5">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="h-8 w-8 rounded-md object-cover border border-slate-150" />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-[9px] font-semibold text-slate-400 border border-slate-150">
                                    No img
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[10px] tracking-wide text-gray-400">{product.sku}</td>
                              <td className="px-4 py-2.5">
                                <div>
                                  <div className="font-bold text-slate-800" title={product.name}>{product.name}</div>
                                  {product.brand && (
                                    <div className="text-[10px] text-gray-450 font-medium">Hiệu: {product.brand}</div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex rounded-md bg-blue-50 border border-blue-100/50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                                  {product.category}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono font-semibold text-indigo-600 whitespace-nowrap" title={`${formattedPrice} đ`}>
                                {compactPrice} đ
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`font-mono font-semibold ${alertState && product.status !== "Inactive" ? "text-red-500" : "text-slate-700"}`}>
                                  {formattedStock} {product.unit || "chiếc"}
                                </span>
                                {alertState && product.status !== "Inactive" && (
                                  <span className="ml-1.5 rounded-full bg-red-50 px-1 py-0.5 text-[8px] font-bold text-red-500 border border-red-100">
                                    Thiếu
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={`inline-flex items-center gap-1 font-semibold text-[10px] ${
                                    product.demandForecast === "Tăng mạnh"
                                      ? "text-red-500"
                                      : product.demandForecast === "Ổn định"
                                        ? "text-green-600"
                                        : "text-amber-600"
                                  }`}
                                >
                                  {product.demandForecast === "Giảm nhẹ" ? (
                                    <ArrowDownRight className="h-3 w-3" />
                                  ) : product.demandForecast === "Ổn định" ? (
                                    <CheckCircle className="h-3 w-3" />
                                  ) : (
                                    <ArrowUpRight className="h-3 w-3" />
                                  )}
                                  {product.demandForecast}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                {product.status === "Inactive" ? (
                                  <span className="rounded-full border border-gray-250 bg-gray-50 px-2 py-0.5 text-[9px] font-bold text-gray-500">
                                    Ngừng bán
                                  </span>
                                ) : (
                                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                                    Đang bán
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditProductModal(product)}
                                    className="inline-flex items-center gap-1 rounded-md p-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                                    title="Sửa"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(product)}
                                    className="inline-flex items-center gap-1 rounded-md p-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                                    title="Xóa"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination currentPage={productPage} totalPages={totalProductPages} onPageChange={setProductPage} />
              </div>
            )}

            {showProductModal && (
              <ProductModal
                categories={categories}
                imagePreview={newProdImagePreview}
                isEditing={Boolean(editingProductId)}
                isSubmitting={productSubmitting}
                newProdCategory={newProdCategory}
                newProdName={newProdName}
                newProdPrice={newProdPrice}
                newProdCostPrice={newProdCostPrice}
                newProdSKU={newProdSKU}
                newProdStock={newProdStock}
                newProdBrand={newProdBrand}
                newProdUnit={newProdUnit}
                newProdDescription={newProdDescription}
                newProdStatus={newProdStatus}
                onClose={resetProductForm}
                onCreateCategory={openCreateCategoryModal}
                onImageChange={handleProductImageChange}
                onSubmit={handleSaveProduct}
                setNewProdCategory={setNewProdCategory}
                setNewProdName={setNewProdName}
                setNewProdPrice={setNewProdPrice}
                setNewProdCostPrice={setNewProdCostPrice}
                setNewProdSKU={setNewProdSKU}
                setNewProdStock={setNewProdStock}
                setNewProdBrand={setNewProdBrand}
                setNewProdUnit={setNewProdUnit}
                setNewProdDescription={setNewProdDescription}
                setNewProdStatus={setNewProdStatus}
              />
            )}
          </div>
        )}

        {subTab === "PHÂN LOẠI SẢN PHẨM" && (
          <div className="space-y-6" id="product_classification_tab">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SummaryCard icon={FolderTree} label="Tổng phân loại" value={categories.length} tone="blue" />
              <SummaryCard icon={CheckCircle} label="Đang sử dụng" value={activeCategoryCount} tone="green" />
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-gray-150 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-800">
                  <Tags className="h-4.5 w-4.5 text-blue-500" />
                  Phân loại sản phẩm trong kho
                </h4>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm loại hoặc mã phân loại..."
                    className="w-full rounded-lg border border-gray-200 bg-slate-50 py-2 pl-9 pr-4 text-xs"
                    value={searchCategory}
                    onChange={(event) => setSearchCategory(event.target.value)}
                  />
                </div>
                <ViewToggle mode={categoryViewMode} onChange={setCategoryViewMode} />
                <button onClick={openCreateCategoryModal} className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 w-full sm:w-auto shrink-0">
                  <Plus className="h-4 w-4" />
                  Thêm phân loại
                </button>
              </div>
            </div>

            {categoryViewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {filteredCategories.map((category) => (
                  <div key={category.id} className="flex flex-col justify-between rounded-xl border border-gray-150 bg-white p-4 shadow-2xs transition-all hover:border-blue-200 hover:shadow-xs">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="truncate font-bold text-slate-800 text-sm" title={category.name}>
                          {category.name}
                        </h5>
                        <span className="shrink-0 rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500">
                          {category.code}
                        </span>
                      </div>
                      <p className={`mt-2 line-clamp-2 text-xs leading-relaxed ${category.description && category.description !== "Chưa có mô tả. Có thể bổ sung sau." ? "text-slate-500" : "italic text-slate-400"}`}>
                        {category.description || "Chưa có mô tả"}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/60 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                        <span className="h-1 w-1 rounded-full bg-blue-500"></span>
                        {category.status}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditCategoryModal(category)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-600"
                        >
                          <Pencil className="h-3 w-3" />
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-150 bg-white shadow-2xs">
                <table className="w-full border-collapse text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b border-gray-150">
                    <tr>
                      <th className="px-4 py-3">Tên phân loại</th>
                      <th className="px-4 py-3">Mã</th>
                      <th className="px-4 py-3">Mô tả</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCategories.map((category) => (
                      <tr key={category.id} className="hover:bg-slate-50/55 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">{category.name}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-500">{category.code}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={category.description}>
                          {category.description || <span className="italic text-slate-400">Chưa có mô tả</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/60 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                            <span className="h-1 w-1 rounded-full bg-blue-500"></span>
                            {category.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditCategoryModal(category)}
                              className="inline-flex items-center gap-1 rounded-md p-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                              title="Sửa"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(category)}
                              className="inline-flex items-center gap-1 rounded-md p-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!categoryLoading && filteredCategories.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="font-bold text-gray-700">Không tìm thấy phân loại phù hợp</p>
              </div>
            )}

            {categoryLoading && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="font-bold text-gray-700">Đang tải phân loại sản phẩm...</p>
                <p className="mt-1 text-xs text-gray-500">Dữ liệu đang được đồng bộ từ Firebase.</p>
              </div>
            )}

          </div>
        )}

        <Suspense fallback={<TabLoader label="Đang tải dữ liệu kho..." />}>
          {subTab === "NHẬP / XUẤT KHO" && (
            <>
              <input
                ref={stockLogImportInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportStockLogsExcel}
              />
              <StockLogPanel
                products={products}
                searchLog={searchLog}
                setSearchLog={setSearchLog}
                stockLogs={stockLogs}
                isLoading={stockLogLoading}
                onExportExcel={handleExportStockLogsExcel}
                onImportExcel={handleOpenStockLogImport}
                isImporting={stockLogExcelImporting}
                onNavigateToCreateProduct={handleNavigateToCreateProduct}
                onCreateTransaction={handleCreateTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onUpdateStatus={handleQuickUpdateTransactionStatus}
                onDeleteTransaction={handleDeleteTransaction}
              />
            </>
          )}
          {subTab === "DỰ BÁO AI" && <AiForecastPanel forecast={forecastSummary} />}
        </Suspense>
      </div>

      {showCategoryModal && (
        <CategoryModal
          editingCategoryId={editingCategoryId}
          newCategoryCode={newCategoryCode}
          newCategoryDescription={newCategoryDescription}
          newCategoryName={newCategoryName}
          onClose={resetCategoryForm}
          onSubmit={handleSaveCategory}
          setNewCategoryCode={setNewCategoryCode}
          setNewCategoryDescription={setNewCategoryDescription}
          setNewCategoryName={setNewCategoryName}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={deleteTarget?.title || ""}
        description={deleteTarget?.description || ""}
        confirmLabel={deleteTarget?.confirmLabel || "Xác nhận"}
        tone={deleteTarget?.tone || "danger"}
        isSubmitting={deleteSubmitting}
        onClose={() => {
          if (deleteSubmitting) return;
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

function TabLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[250px] flex-col items-center justify-center gap-3 rounded-2xl bg-white border border-gray-150 p-6 text-center">
      <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-gray-500 font-semibold">{label}</span>
    </div>
  );
}
