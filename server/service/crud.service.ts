import { ProductModel } from "../model/product.model";
import { ProductCatalogModel } from "../model/product-catalog.model";
import { CategoryModel } from "../model/category.model";
import { StockLogModel } from "../model/stock-log.model";
import { ProjectModel } from "../model/project.model";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { TrainingCourseModel } from "../model/training-course.model";
import { TrainingEnrollmentModel } from "../model/training-enrollment.model";
import { UserModel } from "../model/user.model";
import { WorkflowModel } from "../model/workflow.model";
import { HRCalendarEventModel } from "../model/hr-calendar-event.model";
import { HRLeaveTemplateModel } from "../model/hr-leave-template.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { SupportedModelName, ICRUDQueryOptions } from "../interface/crud.interface";
import mongoose from "mongoose";
import { notificationService } from "./notification.service";
import { assertNoLegacyInventoryMutation } from "./crud-inventory-guard";
import { writeStockMovement } from "../integrations/shared/stock-movement.service";
import { ProductVariantModel } from "../model/product-variant.model";
import { SerialUnitModel } from "../modules/inventory/serials/serial-unit.model";
import { SerialEventModel } from "../modules/inventory/serials/serial-event.model";
import { runInventoryTransaction } from "../integrations/shared/inventory-transaction";

type InventoryTransaction = { session?: mongoose.ClientSession };
const completedStockLog = (status: unknown) => status === "Hoàn thành" || status === "Thành công";
const stockLogLocked = () => Object.assign(new Error("Phiếu kho đã hoàn thành không được sửa hoặc xóa. Hãy tạo chứng từ điều chỉnh."), { statusCode: 409 });

async function updateStockLogSerials(companyCode: string, branchId: string, warehouseId: string, log: any, session?: mongoose.ClientSession) {
  const usedUnits = new Set<string>();
  for (const item of log.items || []) {
    const variant = item.variantId ? await ProductVariantModel.findOne({ _id: item.variantId, companyCode }).session(session || null).lean() : null;
    const identifiers = item.unitIdentifiers?.length ? item.unitIdentifiers : item.serialNumbers || [];
    const tracked = variant?.trackingMode === "serial" || variant?.trackingMode === "unit_barcode";
    if (!tracked && !identifiers.length) continue;
    const normalized = identifiers.map((value: unknown) => String(value).trim().toUpperCase());
    if (!Number.isSafeInteger(item.quantity) || normalized.length !== item.quantity || new Set(normalized).size !== normalized.length) {
      throw Object.assign(new Error(`SKU ${item.sku} phải chọn đúng số IMEI/mã đơn vị.`), { statusCode: 400 });
    }
    const units = await SerialUnitModel.find({ companyCode, branchId, warehouseId, productId: item.productId,
      ...(item.variantId ? { variantId: item.variantId } : { sku: item.sku }),
      $or: [{ normalizedSerialNumber: { $in: normalized } }, { normalizedInternalBarcode: { $in: normalized } }],
    }).session(session || null);
    if (units.length !== item.quantity) throw Object.assign(new Error(`IMEI của ${item.sku} không thuộc SKU/kho đã chọn.`), { statusCode: 409 });
    for (const unit of units) {
      const fromStatus = unit.status;
      if (usedUnits.has(String(unit._id)) || (log.type === "xuất" ? fromStatus !== "in_stock" : !["returned", "lost"].includes(fromStatus))) {
        throw Object.assign(new Error(`IMEI ${unit.serialNumber} đã thay đổi trạng thái hoặc bị chọn trùng.`), { statusCode: 409 });
      }
      usedUnits.add(String(unit._id));
      unit.status = log.type === "xuất" ? (log.purpose === "hủy" ? "scrapped" : "sold") : "in_stock";
      unit.updatedBy = log.operatorName;
      unit.currentDocumentType = "manual-stock-log";
      unit.currentDocumentId = String(log._id);
      await unit.save({ session });
      await SerialEventModel.create([{ companyCode, branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber,
        eventType: log.type === "xuất" ? "issued" : "received", fromStatus, toStatus: unit.status,
        documentType: "manual-stock-log", documentId: String(log._id), actorId: "SYSTEM", actorName: log.operatorName,
      }], { session });
    }
  }
}

function sanitizeInventoryPayload(modelName: string, payload: any) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (modelName === "products") {
    return {
      ...payload,
      sku: typeof payload.sku === "string" ? payload.sku.trim().toUpperCase() : payload.sku,
      name: typeof payload.name === "string" ? payload.name.trim() : payload.name,
      category: typeof payload.category === "string" ? payload.category.trim() : payload.category,
      brand: typeof payload.brand === "string" ? payload.brand.trim() : (payload.brand ?? ""),
      unit: typeof payload.unit === "string" ? payload.unit.trim() : payload.unit,
      description: typeof payload.description === "string" ? payload.description.trim() : (payload.description ?? ""),
      imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : (payload.imageUrl ?? ""),
    };
  }

  if (modelName === "categories") {
    return {
      ...payload,
      name: typeof payload.name === "string" ? payload.name.trim() : payload.name,
      code: typeof payload.code === "string" ? payload.code.trim().toUpperCase() : payload.code,
      description: typeof payload.description === "string" ? payload.description.trim() : payload.description,
    };
  }

  if (modelName === "stock-logs") {
    const normalizedCreatedAt =
      payload.createdAt instanceof Date
        ? payload.createdAt
        : typeof payload.createdAt === "string" || typeof payload.createdAt === "number"
          ? new Date(payload.createdAt)
          : undefined;

    const hasValidCreatedAt = normalizedCreatedAt instanceof Date && !Number.isNaN(normalizedCreatedAt.getTime());

    return {
      ...payload,
      createdAt: hasValidCreatedAt ? normalizedCreatedAt : undefined,
    };
  }

  return payload;
}

const STOCK_LOG_PURPOSES = new Set(["bán", "nội bộ", "hủy", "chuyển kho"]);

async function prepareStockLogPayload(
  data: any,
  companyCode: string,
  branchId: string,
  existingItems: any[] = [],
) {
  if (Object.keys(data || {}).some((key) => key.startsWith("$") || key.includes("."))) {
    throw Object.assign(new Error("Dữ liệu phiếu kho không hợp lệ."), { statusCode: 400 });
  }
  const type = data?.type;
  if (type === "xuất" && data?.purpose === "chuyển kho" && completedStockLog(data?.status ?? "Thành công")) {
    throw Object.assign(new Error("Vui lòng tạo phiếu điều chuyển ở mục Chuyển kho để kho nhận xác nhận."), { statusCode: 409 });
  }
  if (type === "xuất" && !STOCK_LOG_PURPOSES.has(data?.purpose)) {
    const error: Error & { statusCode?: number } = new Error("Phiếu xuất kho phải chọn mục đích xuất.");
    error.statusCode = 400;
    throw error;
  }

  const rawItems = Array.isArray(data?.items) ? data.items : [];
  if (rawItems.length === 0) return { ...data, purpose: type === "xuất" ? data.purpose : undefined };

  const productIds = rawItems.map((item: any) => item?.productId).filter(Boolean);
  if (productIds.length !== rawItems.length || productIds.some((id: unknown) => !mongoose.isObjectIdOrHexString(id))) {
    throw Object.assign(new Error("Sản phẩm trong phiếu không hợp lệ."), { statusCode: 400 });
  }
  const products = await ProductModel.find({
    _id: { $in: productIds },
    companyCode,
    branchId,
  }).select("sku name price costPrice category").lean();
  const productsById = new Map(products.map((product: any) => [String(product._id), product]));
  const legacyProductIds = new Set(products.map((product: any) => String(product._id)));

  // SKU biến thể là thứ duy nhất định danh đúng dòng tồn kho. Nếu client không gửi
  // variantId thì tự resolve từ SKU (ProductVariant có unique index companyCode+sku),
  // nếu không writeStockMovement sẽ tra nhầm dòng InventoryBalance của biến thể khác.
  const variantSkus = rawItems
    .map((item: any) => String(item?.sku || "").trim().toUpperCase())
    .filter(Boolean);
  const variantIdBySku = new Map<string, string>();
  const variantsById = new Map<string, any>();
  const explicitVariantIds = rawItems.map((item: any) => item.variantId).filter(Boolean);
  if (explicitVariantIds.some((id: unknown) => !mongoose.isObjectIdOrHexString(id))) {
    throw Object.assign(new Error("SKU trong phiếu không hợp lệ."), { statusCode: 400 });
  }
  if (variantSkus.length > 0 || explicitVariantIds.length > 0) {
    const variants = await ProductVariantModel.find({ companyCode, $or: [{ sku: { $in: [...new Set<string>(variantSkus)] } }, { _id: { $in: explicitVariantIds } }] }).select("sku productId").lean();
    for (const variant of variants) {
      variantIdBySku.set(String(variant.sku).toUpperCase(), String(variant._id));
      variantsById.set(String(variant._id), variant);
    }
  }

  const missingProductIds = productIds.filter(id => !productsById.has(String(id)));
  if (missingProductIds.length > 0) {
    const catalogProducts = await ProductCatalogModel.find({
      _id: { $in: missingProductIds },
      companyCode,
    }).select("productCode name categoryCode").lean();
    for (const catalogProduct of catalogProducts) {
      productsById.set(String(catalogProduct._id), {
        _id: catalogProduct._id,
        sku: catalogProduct.productCode || "",
        name: catalogProduct.name,
        price: 0,
        costPrice: 0,
        category: catalogProduct.categoryCode || "Chưa phân loại",
      });
    }
  }

  const items = rawItems.map((item: any) => {
    const product = productsById.get(String(item?.productId));
    if (!product) {
      const error: Error & { statusCode?: number } = new Error("Sản phẩm trong phiếu không thuộc chi nhánh hiện tại.");
      error.statusCode = 400;
      throw error;
    }
    const resolvedVariantId = String(item.variantId || variantIdBySku.get(String(item.sku || "").trim().toUpperCase()) || "");
    const variant = variantsById.get(resolvedVariantId);
    if ((!legacyProductIds.has(String(product._id)) && !variant)
      || (resolvedVariantId && (!variant || String(variant.productId) !== String(product._id)))
      || (variant && item.sku && variant.sku !== String(item.sku).trim().toUpperCase())
      || (!variant && item.sku && String(product.sku).trim().toUpperCase() !== String(item.sku).trim().toUpperCase())) {
      throw Object.assign(new Error("SKU không thuộc sản phẩm/công ty trong phiếu."), { statusCode: 400 });
    }
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      const error: Error & { statusCode?: number } = new Error("Số lượng sản phẩm phải lớn hơn 0.");
      error.statusCode = 400;
      throw error;
    }

    const previous = existingItems.find((entry: any) =>
      String(entry?.productId) === String(item.productId) && Number(entry?.quantity) === quantity
    );
    const unitPrice = Number.isFinite(previous?.unitPrice) ? previous.unitPrice : Number(product.price || item.unitPrice || 0);
    const unitCost = Number.isFinite(previous?.unitCost)
      ? previous.unitCost
      : Number.isFinite(product.costPrice) ? Number(product.costPrice) : (Number.isFinite(item.unitCost) ? Number(item.unitCost) : undefined);

    return {
      productId: String(product._id),
      ...(legacyProductIds.has(String(product._id)) ? { legacyProductId: String(product._id) } : {}),
      ...(() => {
        const explicit = typeof item.variantId === "string" && item.variantId.trim() ? item.variantId.trim() : "";
        const resolved = explicit || variantIdBySku.get(String(item?.sku || "").trim().toUpperCase()) || "";
        return resolved ? { variantId: resolved } : {};
      })(),
      // SKU biến thể do người dùng chọn mới là nguồn đúng; product.sku chỉ là mã sản phẩm cha dùng chung cho mọi biến thể.
      sku: (typeof item.sku === "string" && item.sku.trim()) || product.sku,
      productName: product.name || item.productName,
      category: product.category || item.category || "Chưa phân loại",
      quantity,
      ...(Array.isArray(item.unitIdentifiers) && item.unitIdentifiers.length > 0
        ? { unitIdentifiers: [...new Set(item.unitIdentifiers.map((value: unknown) => String(value).trim()).filter(Boolean))] }
        : {}),
      ...(Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0
        ? { serialNumbers: [...new Set(item.serialNumbers.map((value: unknown) => String(value).trim()).filter(Boolean))] }
        : {}),
      unitPrice,
      lineTotal: unitPrice * quantity,
      ...(unitCost === undefined ? {} : { unitCost }),
    };
  });

  return { ...data, purpose: type === "xuất" ? data.purpose : undefined, items };
}

function sanitizeInventoryResult(modelName: string, item: any) {
  if (!item) {
    return item;
  }

  const plainItem = typeof item.toObject === "function" ? item.toObject() : item;

  if (modelName === "products") {
    return {
      ...plainItem,
      sku: typeof plainItem.sku === "string" ? plainItem.sku.trim().toUpperCase() : plainItem.sku,
      name: typeof plainItem.name === "string" ? plainItem.name.trim() : plainItem.name,
      category: typeof plainItem.category === "string" ? plainItem.category.trim() : plainItem.category,
      brand: typeof plainItem.brand === "string" ? plainItem.brand.trim() : "",
      unit: typeof plainItem.unit === "string" ? plainItem.unit.trim() : plainItem.unit,
      description: typeof plainItem.description === "string" ? plainItem.description.trim() : "",
      imageUrl: typeof plainItem.imageUrl === "string" ? plainItem.imageUrl.trim() : "",
    };
  }

  if (modelName === "categories") {
    return {
      ...plainItem,
      name: typeof plainItem.name === "string" ? plainItem.name.trim() : plainItem.name,
      code: typeof plainItem.code === "string" ? plainItem.code.trim().toUpperCase() : plainItem.code,
      description: typeof plainItem.description === "string" ? plainItem.description.trim() : "",
      colorClass: typeof plainItem.colorClass === "string" ? plainItem.colorClass.trim() : "bg-blue-50 text-blue-700 border-blue-100",
      status: typeof plainItem.status === "string" ? plainItem.status.trim() : "Đang dùng",
    };
  }

  if (modelName === "stock-logs") {
    const normalizedCreatedAt =
      plainItem.createdAt instanceof Date
        ? plainItem.createdAt
        : typeof plainItem.createdAt === "string" || typeof plainItem.createdAt === "number"
          ? new Date(plainItem.createdAt)
          : null;

    return {
      ...plainItem,
      title: typeof plainItem.title === "string" ? plainItem.title.trim() : "",
      items: Array.isArray(plainItem.items)
        ? plainItem.items.map((entry: any) => ({
            productId: typeof entry?.productId === "string" ? entry.productId : "",
            variantId: typeof entry?.variantId === "string" ? entry.variantId : undefined,
            sku: typeof entry?.sku === "string" ? entry.sku.trim().toUpperCase() : "",
            productName: typeof entry?.productName === "string" ? entry.productName.trim() : "",
            quantity: typeof entry?.quantity === "number" ? entry.quantity : Number(entry?.quantity || 0),
            unitPrice: typeof entry?.unitPrice === "number" ? entry.unitPrice : undefined,
            lineTotal: typeof entry?.lineTotal === "number" ? entry.lineTotal : undefined,
            unitCost: typeof entry?.unitCost === "number" ? entry.unitCost : undefined,
            unitIdentifiers: Array.isArray(entry?.unitIdentifiers) ? entry.unitIdentifiers.map((value: any) => String(value)) : [],
            serialNumbers: Array.isArray(entry?.serialNumbers) ? entry.serialNumbers.map((value: any) => String(value)) : [],
          }))
        : [],
      operatorName: typeof plainItem.operatorName === "string" ? plainItem.operatorName.trim() : "",
      notes: typeof plainItem.notes === "string" ? plainItem.notes.trim() : "",
      sku: typeof plainItem.sku === "string" ? plainItem.sku.trim().toUpperCase() : plainItem.sku,
      productName: typeof plainItem.productName === "string" ? plainItem.productName.trim() : plainItem.productName,
      createdAt:
        normalizedCreatedAt instanceof Date && !Number.isNaN(normalizedCreatedAt.getTime())
          ? normalizedCreatedAt.toISOString()
          : new Date().toISOString(),
    };
  }

  return plainItem;
}

/**`r`n * Model chỉ được đọc qua router CRUD chung; mọi thao tác ghi (tạo/sửa/xóa)
 * phải đi qua router chuyên biệt có kiểm tra phân quyền & phân cấp đầy đủ.
 * Chặn ở đây để tránh leo thang đặc quyền (vd tự set role/permissions qua /crud/users).
 */
const WRITE_PROTECTED_MODELS = new Set<string>(["users", "kanban-tasks", "projects"]);
const INVENTORY_MODELS = new Set<SupportedModelName>(["products", "categories", "stock-logs"]);

export function requireInventoryBranch(modelName: SupportedModelName, branchId?: string): string | undefined {
  if (!INVENTORY_MODELS.has(modelName)) return undefined;
  if (!branchId) {
    const error: Error & { statusCode?: number } = new Error("Vui lòng chọn chi nhánh trước khi thao tác.");
    error.statusCode = 400;
    throw error;
  }
  return branchId;
}

/** Loại bỏ trường nhạy cảm khỏi kết quả trả về của model users */
function sanitizeUserResult(modelName: string, item: any) {
  if (modelName !== "users" || !item || typeof item !== "object") {
    return item;
  }
  const plainItem = typeof item.toObject === "function" ? item.toObject() : { ...item };
  delete plainItem.password;
  delete plainItem.refreshToken;
  return plainItem;
}

function assertWritable(modelName: string) {
  if (WRITE_PROTECTED_MODELS.has(modelName)) {
    const err: any = new Error(
      "Không thể thao tác trực tiếp trên tài nguyên này qua API chung. Vui lòng dùng chức năng Quản lý người dùng."
    );
    err.statusCode = 403;
    throw err;
  }
}


function sanitizeCrudResult(modelName: string, item: any) {
  const inventoryItem = sanitizeInventoryResult(modelName, item);
  return sanitizeUserResult(modelName, inventoryItem);
}

const MODEL_MAPPING: Record<SupportedModelName, mongoose.Model<any>> = {
  "products": ProductModel,
  "categories": CategoryModel,
  "stock-logs": StockLogModel,
  "projects": ProjectModel,
  "kanban-tasks": KanbanTaskModel,
  "training-courses": TrainingCourseModel,
  "training-enrollments": TrainingEnrollmentModel,
  "workflows": WorkflowModel,
  "users": UserModel,
  "hr-calendar-events": HRCalendarEventModel,
  "hr-leave-templates": HRLeaveTemplateModel,
  "hr-leave-applications": HRLeaveApplicationModel,
  "timekeeping-logs": TimekeepingLogModel,
};

/**
 * Các model được cô lập theo chi nhánh: bản ghi luôn được đóng dấu branchId khi tạo
 * và mọi truy cập theo _id đều bị giới hạn trong chi nhánh của người dùng.
 */
const BRANCH_SCOPED_MODELS = new Set<string>([
  "projects",
  "hr-calendar-events",
  "hr-leave-templates",
  "hr-leave-applications",
]);

export const crudService = {
  /**
   * Lấy danh sách tài nguyên kèm phân trang, lọc và cô lập companyCode
   */
  async getList(
    modelName: SupportedModelName,
    companyCode: string,
    options: ICRUDQueryOptions,
    userRole: string
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    const query: any = {};
    const inventoryBranch = requireInventoryBranch(
      modelName,
      typeof options.filters?.branchId === "string" ? options.filters.branchId : undefined,
    );

    // Áp dụng các bộ lọc động truyền từ client (loại bỏ key nguy hiểm trước khi merge)
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (key === "companyCode" || key === "_id" || key.startsWith("$")) continue;
        query[key] = value;
      }
    }

    // Cô lập dữ liệu theo companyCode (áp dụng sau cùng, không cho client ghi đè)
    if (userRole !== "superadmin" || (companyCode && companyCode !== "SYSTEM")) {
      query.companyCode = companyCode;
    }

    // Áp dụng tìm kiếm tương đối (Search)
    if (inventoryBranch) query.branchId = inventoryBranch;

    if (options.search) {
      const searchRegex = new RegExp(options.search, "i");
      query.$or = [
        { name: searchRegex },
        { title: searchRegex },
        { customerName: searchRegex },
        { sku: searchRegex }
      ];
    }

    const page = options.page || 1;
    const limit = options.limit || 1000;
    const skip = (page - 1) * limit;
    const sort = options.sort || (modelName === "projects" ? "-createdAt" : "-_id");

    const items = await model.find(query).sort(sort).skip(skip).limit(limit).lean();
    const total = await model.countDocuments(query);

    return {
      items: items.map((item) => sanitizeCrudResult(modelName, item)),
      total,
      page,
      limit,
    };
  },

  /**
   * Lấy chi tiết tài nguyên theo ID
   */
  async getById(
    modelName: SupportedModelName,
    id: string,
    companyCode: string,
    userRole: string,
    branchId?: string,
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    const query: any = { _id: id };
    if (userRole !== "superadmin" || (companyCode && companyCode !== "SYSTEM")) {
      query.companyCode = companyCode;
    }
    const inventoryBranch = requireInventoryBranch(modelName, branchId);
    if (inventoryBranch) query.branchId = inventoryBranch;
    if (BRANCH_SCOPED_MODELS.has(modelName) && branchId) query.branchId = branchId;

    const item = await model.findOne(query).lean();
    if (!item) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền truy cập.");
    }
    return sanitizeCrudResult(modelName, item);
  },

  /**
   * Tạo mới tài nguyên
   */
  async create(
    modelName: SupportedModelName,
    data: any,
    companyCode: string,
    branchId?: string,
    transaction?: InventoryTransaction,
  ) {
    if (modelName === "stock-logs" && !transaction) {
      return runInventoryTransaction((session) => crudService.create(modelName, data, companyCode, branchId, { session }));
    }
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }
    assertWritable(modelName);
    assertNoLegacyInventoryMutation(modelName, data);

    // Ép buộc gán companyCode để bảo mật dữ liệu doanh nghiệp
    const inventoryBranch = requireInventoryBranch(modelName, branchId);
    const preparedData = modelName === "stock-logs"
      ? await prepareStockLogPayload(data, companyCode, inventoryBranch!)
      : data;

    if (modelName === "stock-logs") {
      const isCompleted = completedStockLog(preparedData.status ?? "Thành công");
      if (isCompleted) {
        const sourceId = new mongoose.Types.ObjectId().toString();
        preparedData._id = sourceId;
        preparedData.idempotencyKey = preparedData.idempotencyKey || new mongoose.Types.ObjectId().toString();

        const movement = await writeStockMovement({
          companyCode,
          branchId: inventoryBranch!,
          direction: preparedData.type === "nhập" ? "in" : "out",
          purpose: preparedData.type === "xuất"
            ? (preparedData.purpose === "bán" ? "sale" : preparedData.purpose === "hủy" ? "cancel" : preparedData.purpose === "chuyển kho" ? "transfer" : "other")
            : "other",
          sourceType: "manual-stock-log",
          sourceId,
          sourceCode: preparedData.title,
          idempotencyKey: preparedData.idempotencyKey,
          operatorName: preparedData.operatorName,
          items: preparedData.items.map((item: any) => ({
            productId: item.productId,
            variantId: item.variantId,
            legacyProductId: item.legacyProductId,
            sku: item.sku,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            unitCost: item.unitCost,
            category: item.category,
          })),
          warehouseId: preparedData.warehouseId || data.warehouseId,
          reason: preparedData.notes,
          writeLegacyStockLog: false,
          session: transaction?.session,
        });
        preparedData.warehouseId = movement.warehouseId;
        preparedData.items.forEach((item: any, index: number) => { item.unitCost = movement.entries[index].unitCost; });

        await updateStockLogSerials(companyCode, inventoryBranch!, movement.warehouseId, preparedData, transaction?.session);
      }
    }

    const payload = {
      ...sanitizeInventoryPayload(modelName, preparedData),
      companyCode,
      ...(inventoryBranch ? { branchId: inventoryBranch } : {}),
      ...(preparedData._id ? { _id: preparedData._id } : {}),
    };

    if (BRANCH_SCOPED_MODELS.has(modelName) && (branchId || data.branchId)) {
      payload.branchId = branchId || data.branchId;
    }

    const newItem = new model(payload);
    await newItem.save({ session: transaction?.session });

    if (modelName === "products" && newItem) {
      const stock = Number(newItem.stock || 0);
      const minStockAlert = Number(newItem.minStockAlert || 15);
      if (stock <= minStockAlert) {
        notificationService.notifyLowStock(newItem).catch((err) => {
          console.error("[crudService.create] Error sending low stock web notification:", err);
        });
      }
    }

    if (modelName === "kanban-tasks" && newItem) {
      notificationService.notifyTaskAssigned(newItem).catch((err) => {
        console.error("[crudService.create] Error sending task assigned web notification:", err);
      });
    }

    if (modelName === "training-enrollments" && newItem) {
      void (async () => {
        try {
          const course = await TrainingCourseModel.findById(newItem.courseId).select("title").lean();
          if (course) {
            await notificationService.notifyCourseAssigned(newItem, course.title);
          }
        } catch (err) {
          console.error("[crudService.create] Error sending course assigned web notification:", err);
        }
      })();
    }

    return sanitizeCrudResult(modelName, newItem);
  },

  /**
   * Cập nhật tài nguyên theo ID
   */
  async update(
    modelName: SupportedModelName,
    id: string,
    data: any,
    companyCode: string,
    userRole: string,
    branchId?: string,
    transaction?: InventoryTransaction,
  ) {
    if (modelName === "stock-logs" && !transaction) {
      return runInventoryTransaction((session) => crudService.update(modelName, id, data, companyCode, userRole, branchId, { session }));
    }
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    assertWritable(modelName);
    assertNoLegacyInventoryMutation(modelName, data);

    const query: any = { _id: id };
    if (userRole !== "superadmin" || (companyCode && companyCode !== "SYSTEM")) {
      query.companyCode = companyCode;
    }
    const inventoryBranch = requireInventoryBranch(modelName, branchId);
    if (inventoryBranch) query.branchId = inventoryBranch;
    if (BRANCH_SCOPED_MODELS.has(modelName) && branchId) query.branchId = branchId;

    // Loại bỏ các trường nhạy cảm không cho phép đè trực tiếp
    const { companyCode: _cCode, branchId: _branchId, ownerId: _ownerId, _id: _itemId, id: _plainId, ...rawUpdatePayload } = data;
    let preparedUpdatePayload = rawUpdatePayload;
    if (modelName === "stock-logs") {
      const existingLog = await StockLogModel.findOne(query).session(transaction?.session || null).lean();
      if (!existingLog) throw Object.assign(new Error("Không tìm thấy phiếu kho trong chi nhánh."), { statusCode: 404 });
      if (completedStockLog(existingLog.status)) {
        if (Object.keys(rawUpdatePayload).some((key) => key !== "notes")) throw stockLogLocked();
        const updated = await StockLogModel.findOneAndUpdate({ ...query, status: existingLog.status }, { $set: { notes: rawUpdatePayload.notes } }, { returnDocument: "after", session: transaction?.session, runValidators: true });
        if (!updated) throw stockLogLocked();
        return sanitizeCrudResult(modelName, updated);
      }
      preparedUpdatePayload = await prepareStockLogPayload(
        { items: existingLog.items, status: existingLog.status, warehouseId: existingLog.warehouseId, title: existingLog.title, operatorName: existingLog.operatorName, notes: existingLog.notes, ...rawUpdatePayload, idempotencyKey: existingLog.idempotencyKey, type: rawUpdatePayload.type ?? existingLog.type, purpose: rawUpdatePayload.purpose ?? existingLog.purpose },
        companyCode,
        inventoryBranch!,
        existingLog?.items || [],
      );

      const isCompleted = preparedUpdatePayload.status === "Hoàn thành" || preparedUpdatePayload.status === "Thành công";
      if (isCompleted) {
        preparedUpdatePayload.idempotencyKey = existingLog.idempotencyKey || new mongoose.Types.ObjectId().toString();

        const movement = await writeStockMovement({
          companyCode,
          branchId: inventoryBranch!,
          direction: (preparedUpdatePayload.type || existingLog.type) === "nhập" ? "in" : "out",
          purpose: (preparedUpdatePayload.type || existingLog.type) === "xuất"
            ? ((preparedUpdatePayload.purpose || existingLog.purpose) === "bán" ? "sale" : (preparedUpdatePayload.purpose || existingLog.purpose) === "hủy" ? "cancel" : (preparedUpdatePayload.purpose || existingLog.purpose) === "chuyển kho" ? "transfer" : "other")
            : "other",
          sourceType: "manual-stock-log",
          sourceId: existingLog._id.toString(),
          sourceCode: preparedUpdatePayload.title || existingLog.title,
          idempotencyKey: preparedUpdatePayload.idempotencyKey,
          operatorName: preparedUpdatePayload.operatorName || existingLog.operatorName,
          items: (preparedUpdatePayload.items || existingLog.items || []).map((item: any) => ({
            productId: item.productId,
            variantId: item.variantId,
            legacyProductId: item.legacyProductId,
            sku: item.sku,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            unitCost: item.unitCost,
            category: item.category,
          })),
          warehouseId: preparedUpdatePayload.warehouseId || data.warehouseId,
          reason: preparedUpdatePayload.notes || existingLog.notes,
          writeLegacyStockLog: false,
          session: transaction?.session,
        });
        preparedUpdatePayload.warehouseId = movement.warehouseId;
        preparedUpdatePayload.items.forEach((item: any, index: number) => { item.unitCost = movement.entries[index].unitCost; });

        await updateStockLogSerials(companyCode, inventoryBranch!, movement.warehouseId, { ...existingLog, ...preparedUpdatePayload }, transaction?.session);
      }
    }
    const updatePayload = sanitizeInventoryPayload(modelName, preparedUpdatePayload);
    if ((modelName === "timekeeping-logs" || BRANCH_SCOPED_MODELS.has(modelName)) && data.branchId) {
      updatePayload.branchId = data.branchId;
    }

    // Enforce the planned start time for every task update entry point, not only
    // the dedicated Kanban router.
    if (modelName === "kanban-tasks" && ["Done", "done"].includes(updatePayload.status)) {
      const existingTask = await KanbanTaskModel.findOne(query).select("startTime").lean();
      const plannedStartAt = new Date(updatePayload.startTime ?? existingTask?.startTime).getTime();
      if (Number.isFinite(plannedStartAt) && plannedStartAt > Date.now()) {
        const err: any = new Error("Chưa đến thời gian bắt đầu đã chọn nên không thể hoàn thành công việc.");
        err.statusCode = 400;
        throw err;
      }
    }

    const updatedItem = await model.findOneAndUpdate(query, updatePayload, { returnDocument: 'after', session: transaction?.session, runValidators: true });
    if (!updatedItem) {
      throw new Error("Khong tim thay tai nguyen hoac ban khong co quyen chinh sua.");
    }

    if (modelName === "products" && updatedItem) {
      const stock = Number(updatedItem.stock || 0);
      const minStockAlert = Number(updatedItem.minStockAlert || 15);
      if (stock <= minStockAlert) {
        notificationService.notifyLowStock(updatedItem).catch((err) => {
          console.error("[crudService.update] Error sending low stock web notification:", err);
        });
      }
    }

    return sanitizeCrudResult(modelName, updatedItem);
  },

  /**
   * Xóa tài nguyên theo ID
   */
  async delete(
    modelName: SupportedModelName,
    id: string,
    companyCode: string,
    userRole: string,
    branchId?: string,
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }
    assertWritable(modelName);

    const query: any = { _id: id };
    if (userRole !== "superadmin" || (companyCode && companyCode !== "SYSTEM")) {
      query.companyCode = companyCode;
    }
    const inventoryBranch = requireInventoryBranch(modelName, branchId);
    if (inventoryBranch) query.branchId = inventoryBranch;
    if (BRANCH_SCOPED_MODELS.has(modelName) && branchId) query.branchId = branchId;

    if (modelName === "stock-logs") {
      const log = await StockLogModel.findOne(query).lean();
      if (log && completedStockLog(log.status)) throw stockLogLocked();
      query.status = { $nin: ["Hoàn thành", "Thành công"] };
    }
    const deletedItem = await model.findOneAndDelete(query);
    if (!deletedItem) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền xóa.");
    }

    // Xóa dự án → gỡ projectId khỏi các task Kanban để chúng hiện về nhóm "Chưa phân loại"
    // (await để frontend refetch ngay sau khi xóa không thấy task mồ côi bị ẩn khỏi bảng)
    if (modelName === "projects") {
      await KanbanTaskModel.updateMany(
        { companyCode: deletedItem.companyCode || companyCode, projectId: id },
        { $set: { projectId: "" } }
      );
    }

    return deletedItem;
  },
};
