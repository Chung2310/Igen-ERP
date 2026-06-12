import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle, Cpu, Download, FolderTree, Pencil, Plus, Search, Tags, Trash2, Upload } from "lucide-react";
import { InventoryForecastSummary, InventorySubTabType, ProductCategory, ProductItem, StockLog } from "../types";
import { toast } from "./Toast";
import { AiForecastPanel } from "../components/inventory/AiForecastPanel";
import { CategoryModal } from "../components/inventory/CategoryModal";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { inventoryTabs } from "../components/inventory/data";
import { ProductCard } from "../components/inventory/ProductCard";
import { Pagination } from "../components/common/Pagination";
import { ProductModal } from "../components/inventory/ProductModal";
import { StockLogPanel } from "../components/inventory/StockLogPanel";
import { SummaryCard } from "../components/inventory/SummaryCard";
import { useAuth } from "../context/AuthContext";
import { inventoryCategoryService } from "../services/inventoryCategoryService";
import { inventoryProductService } from "../services/inventoryProductService";
import { inventoryStockLogService } from "../services/inventoryStockLogService";
import {
  exportProductsToExcel,
  exportStockLogsToExcel,
  importProductsFromExcel,
  importStockLogsFromExcel,
} from "../utils/inventoryExcel";
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
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<InventorySubTabType>("DANH MỤC");
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
  const [newProdSKU, setNewProdSKU] = useState("");
  const [newProdImageFile, setNewProdImageFile] = useState<File | null>(null);
  const [newProdImagePreview, setNewProdImagePreview] = useState("");

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryCode, setNewCategoryCode] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const productImportInputRef = useRef<HTMLInputElement | null>(null);
  const stockLogImportInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let unsubscribeCategories = () => {};
    let unsubscribeProducts = () => {};
    let unsubscribeStockLogs = () => {};

    if (!user) {
      setCategoryLoading(false);
      setProductLoading(false);
      setStockLogLoading(false);
      return;
    }

    setCategoryLoading(true);
    setProductLoading(true);
    setStockLogLoading(true);

    unsubscribeCategories = inventoryCategoryService.subscribe(
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
  }, [user]);

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
    setNewProdSKU("");
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
    setNewProdSKU(product.sku);
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
    if (!newProdName.trim() || !newProdSKU.trim() || !newProdCategory) return;

    const sku = newProdSKU.trim().toUpperCase();
    const name = newProdName.trim();
    const stock = parseInt(newProdStock, 10) || 0;
    const price = parseInt(newProdPrice, 10) || 0;

    setProductSubmitting(true);

    try {
      const isSkuAvailable = await inventoryProductService.ensureSkuAvailable(sku, editingProductId || undefined);
      if (!isSkuAvailable) {
        toast.error("SKU này đã tồn tại trong kho.");
        setProductSubmitting(false);
        return;
      }

      if (editingProductId) {
        const currentProduct = products.find((product) => product.id === editingProductId);
        const result = await inventoryProductService.updateProduct(editingProductId, {
          sku,
          name,
          category: newProdCategory,
          stock,
          price,
          imageFile: newProdImageFile,
          imageUrl: currentProduct?.imageUrl || "",
        });

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
          category: newProdCategory,
          stock,
          price,
          imageFile: newProdImageFile,
        });

        setStockLogs((currentLogs) => [
          {
            id: `NK-${Date.now()}`,
            type: "nhập",
            sku,
            productName: name,
            quantity: stock,
            operatorName: "iGen Admin System",
            createdAt: "Hôm nay",
            notes: "Khởi tạo sản phẩm mới trong danh mục",
            status: "Thành công",
          },
          ...currentLogs,
        ]);
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
    await inventoryProductService.deleteProduct(productId);
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
        });

        if (currentCategory && currentCategory.name !== cleanName) {
          await inventoryProductService.updateProductsCategoryName(currentCategory.name, cleanName);
          if (selectedCategoryFilter === currentCategory.name) setSelectedCategoryFilter(cleanName);
        }

        toast.success("Đã cập nhật phân loại sản phẩm.");
      } else {
        await inventoryCategoryService.createCategory({
          name: cleanName,
          code: cleanCode,
          description: newCategoryDescription.trim() || "Chưa có mô tả. Có thể bổ sung sau.",
        });
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
      await inventoryProductService.moveProductsToUncategorized(category.name);
    }

    await inventoryCategoryService.deleteCategory(categoryId);
    if (selectedCategoryFilter === category.name) setSelectedCategoryFilter("Tất cả");
    toast.success("Đã xóa phân loại sản phẩm.");
  };

  const handleExportProductsExcel = () => {
    exportProductsToExcel(filteredProducts);
    toast.success("Da xuat danh muc san pham ra Excel.");
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
      const importedRows = await importProductsFromExcel(file);

      if (importedRows.length === 0) {
        toast.error("File Excel khong co dong san pham hop le.");
        return;
      }

      const existingSkus = new Set(products.map((product) => product.sku.toUpperCase()));
      const importedSkus = new Set<string>();
      let createdCount = 0;
      let skippedCount = 0;

      for (const row of importedRows) {
        if (existingSkus.has(row.sku) || importedSkus.has(row.sku)) {
          skippedCount += 1;
          continue;
        }

        await inventoryProductService.createProduct({
          sku: row.sku,
          name: row.name,
          category: row.category,
          stock: row.stock,
          price: row.price,
          imageUrl: row.imageUrl || "",
        });

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
        toast.error("Khong co san pham moi nao duoc import. Kiem tra SKU bi trung.");
        return;
      }

      if (skippedCount > 0) {
        toast.success(`Da import ${createdCount} san pham, bo qua ${skippedCount} dong SKU trung.`);
      } else {
        toast.success(`Da import ${createdCount} san pham tu Excel.`);
      }
    } catch (error) {
      toast.error(getInventoryErrorMessage(error, "Khong the import san pham tu Excel."));
    } finally {
      setProductExcelImporting(false);
    }
  };

  const handleExportStockLogsExcel = () => {
    exportStockLogsToExcel(stockLogs);
    toast.success("Da xuat phieu nhap xuat kho ra Excel.");
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
      const importedLogs = await importStockLogsFromExcel(file);

      if (importedLogs.length === 0) {
        toast.error("File Excel khong co phieu nhap xuat hop le.");
        return;
      }

      const existingIds = new Set(stockLogs.map((log) => log.id));
      const nextLogs = importedLogs.filter((log) => !existingIds.has(log.id));
      let addedCount = 0;

      if (nextLogs.length === 0) {
        toast.error("Khong co phieu hop le nao duoc import.");
        return;
      }

      const runningStocks = new Map(products.map((product) => [product.id, product.stock]));

      for (const log of nextLogs) {
        const logItems = getStockLogItems(log);
        const resolvedItems = logItems.map((item) => {
          const product = products.find((entry) => entry.sku === item.sku);
          if (!product) {
            throw new Error(JSON.stringify({ error: `Khong tim thay san pham SKU ${item.sku} trong danh muc kho.` }));
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
                JSON.stringify({ error: `So luong ton kho cua ${item.product.name} khong du de import phieu xuat hoan thanh.` })
              );
            }
          }

          await Promise.all(
            resolvedItems.map((item) => {
              const currentStock = runningStocks.get(item.product.id) ?? item.product.stock;
              const nextStock = log.type === "nhập" ? currentStock + item.quantity : currentStock - item.quantity;
              runningStocks.set(item.product.id, nextStock);
              return inventoryProductService.updateProductStock(item.product.id, nextStock);
            })
          );
        }

        await inventoryStockLogService.saveImportedLog(log.id, {
          type: log.type as "nhập" | "xuất",
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
        });

        addedCount += 1;
      }

      toast.success(`Da import ${addedCount} phieu nhap/xuat kho tu Excel.`);
    } catch (error) {
      toast.error("Khong the import phieu nhap/xuat kho tu Excel.");
    } finally {
      setStockLogExcelImporting(false);
    }
  };

  const handleCreateTransaction = async (payload: {
    type: "nhập" | "xuất";
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
            payload.type === "nhập" ? item.product.stock + item.quantity : item.product.stock - item.quantity
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
      title: payload.title,
      items: logItems,
      sku: resolvedItems[0].product.sku,
      productName: resolvedItems[0].product.name,
      quantity: resolvedItems.reduce((sum, item) => sum + item.quantity, 0),
      operatorName: payload.operatorName,
      notes: payload.notes || (payload.type === "nhập" ? "Phiếu nhập kho mới" : "Phiếu xuất kho mới"),
      status: payload.status,
    });

    toast.success(payload.type === "nhập" ? "Đã tạo phiếu nhập kho." : "Đã tạo phiếu xuất kho.");
  };

  const handleUpdateTransaction = async (payload: {
    id?: string;
    type: "nhập" | "xuất";
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
          await inventoryProductService.updateProductStock(productId, product.stock + delta);
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
      title: payload.title,
      items: logItems,
      sku: normalizedNewItems[0].product.sku,
      productName: normalizedNewItems[0].product.name,
      quantity: normalizedNewItems.reduce((sum, item) => sum + item.quantity, 0),
      operatorName: payload.operatorName,
      notes: payload.notes,
      status: payload.status,
    });

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
    await inventoryStockLogService.deleteLog(logId);
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
      <div className="flex shrink-0 justify-between border-b border-gray-200 bg-gray-50/50 p-2 text-xs" id="inventory_tabs_switch">
        <div className="flex flex-wrap gap-2">
          {inventoryTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`rounded-lg border px-4 py-2 font-bold uppercase tracking-wide transition-all ${
                subTab === tab ? "border-slate-800 bg-slate-800 text-white shadow-xs" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-indigo-150 bg-indigo-50 px-3 py-1 font-mono text-[10px] font-bold text-indigo-700 md:flex">
          <Cpu className="h-3.5 w-3.5 text-indigo-500" />
          <span>Thuật toán dự đoán iGen-Forecast active</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6" id="inventory_tab_content">
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative w-full sm:w-72">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm theo tên sản phẩm, mã SKU..."
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
                <p className="mt-1 text-xs text-gray-500">Thử đổi bộ lọc hoặc tạo sản phẩm mới để bắt đầu quản lý kho.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" id="products_grid">
                  {paginatedProducts.map((product) => (
                    <div key={product.id}>
                      <ProductCard product={product} onDelete={handleDeleteProduct} onEdit={openEditProductModal} />
                    </div>
                  ))}
                </div>
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
                newProdSKU={newProdSKU}
                newProdStock={newProdStock}
                onClose={resetProductForm}
                onCreateCategory={() => {
                  setShowProductModal(false);
                  openCreateCategoryModal();
                  setSubTab("PHÂN LOẠI SẢN PHẨM");
                }}
                onImageChange={handleProductImageChange}
                onSubmit={handleSaveProduct}
                setNewProdCategory={setNewProdCategory}
                setNewProdName={setNewProdName}
                setNewProdPrice={setNewProdPrice}
                setNewProdSKU={setNewProdSKU}
                setNewProdStock={setNewProdStock}
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
                <p className="mt-1 text-xs leading-snug text-gray-500">Mỗi phân loại sẽ xuất hiện trong form khai báo sản phẩm mới.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:w-72">
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
                <button onClick={openCreateCategoryModal} className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  Thêm phân loại
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {filteredCategories.map((category) => (
                <div key={category.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="font-bold leading-snug text-slate-800">{category.name}</h5>
                      <p className="mt-1 font-mono text-[10px] font-bold text-gray-400">Mã: {category.code}</p>
                    </div>
                    <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[9px] font-bold text-blue-700">{category.status}</span>
                  </div>
                  <p className="mt-4 min-h-10 text-xs leading-5 text-gray-500">{category.description}</p>
                  <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                    <button type="button" onClick={() => openEditCategoryModal(category)} className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-100">
                      <Pencil className="h-3.5 w-3.5" />
                      Sửa
                    </button>
                    <button type="button" onClick={() => handleDeleteCategory(category)} className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100">
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!categoryLoading && filteredCategories.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="font-bold text-gray-700">Không tìm thấy phân loại phù hợp</p>
                <p className="mt-1 text-xs text-gray-500">Thử đổi từ khóa tìm kiếm hoặc thêm phân loại mới.</p>
              </div>
            )}

            {categoryLoading && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="font-bold text-gray-700">Đang tải phân loại sản phẩm...</p>
                <p className="mt-1 text-xs text-gray-500">Dữ liệu đang được đồng bộ từ Firebase.</p>
              </div>
            )}

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
          </div>
        )}

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
      </div>
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
