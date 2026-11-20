import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const documentItemSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "Tên tài liệu là bắt buộc.",
    "string.empty": "Tên tài liệu không được để trống.",
  }),
  fileUrl: Joi.string().trim().uri({ allowRelative: true }).required().messages({
    "any.required": "Đường dẫn tệp tin (fileUrl) là bắt buộc.",
    "string.empty": "Đường dẫn tệp tin không được để trống.",
  }),
  fileType: Joi.string().trim().allow("").optional(),
  fileSize: Joi.number().min(0).optional(),
  uploadedAt: Joi.date().optional(),
});

export const listSupplySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(1000).optional().default(20),
    search: Joi.string().trim().allow("").optional(),
    category: Joi.string().trim().allow("").optional(),
    archived: Joi.boolean().optional().default(false),
    status: Joi.string().valid("in-stock", "low-stock", "out-of-stock", "expired", "quarantined").allow("").optional(),
    expiryStatus: Joi.string()
      .valid("all", "expired", "expiring_soon_30", "expiring_soon_60", "valid")
      .allow("")
      .optional(),
    branchId: Joi.string().regex(objectIdRegex).allow("").optional(),
    supplier: Joi.string().trim().allow("").optional(),
    supplierId: Joi.string().regex(objectIdRegex).allow("", null).optional(),
    warehouseId: Joi.string().regex(objectIdRegex).allow("", null).optional(),
    warehouse: Joi.string().trim().allow("").optional(),
  }).unknown(false),
};

export const getSupplySchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã vật tư 'id' là bắt buộc.",
      "string.pattern.base": "Mã vật tư 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }).unknown(false),
};

export const createSupplySchema = {
  body: Joi.object({
    name: Joi.string().trim().required().messages({
      "any.required": "Tên vật tư là bắt buộc.",
      "string.empty": "Tên vật tư không được để trống.",
    }),
    code: Joi.string().trim().required().messages({
      "any.required": "Mã vật tư là bắt buộc.",
      "string.empty": "Mã vật tư không được để trống.",
    }),
    category: Joi.string().trim().required().messages({
      "any.required": "Danh mục vật tư là bắt buộc.",
      "string.empty": "Danh mục vật tư không được để trống.",
    }),
    unit: Joi.string().trim().required().messages({
      "any.required": "Đơn vị tính là bắt buộc.",
      "string.empty": "Đơn vị tính không được để trống.",
    }),
    quantity: Joi.number().integer().min(0).optional().default(0).messages({
      "number.min": "Số lượng tồn kho không được âm.",
    }),
    minQuantity: Joi.number().integer().min(0).optional().default(10).messages({
      "number.min": "Mức tồn kho tối thiểu không được âm.",
    }),
    requiresExpiry: Joi.boolean().optional().default(true),
    expiryDate: Joi.date().iso().allow(null, "").optional(),
    manufactureDate: Joi.date().iso().allow(null, "").optional(),
    batchNumber: Joi.string().trim().allow("").optional(),
    warehouseLocation: Joi.string().trim().allow("").optional(),
    warehouseId: Joi.string().regex(objectIdRegex).allow("", null).optional(),
    roomId: Joi.string().regex(objectIdRegex).allow("", null).optional(),
    supplier: Joi.string().trim().allow("").optional(),
    supplierId: Joi.string().regex(objectIdRegex).allow("", null).optional(),
    inspectionDate: Joi.date().iso().allow(null, "").optional(),
    nextInspectionDate: Joi.date().iso().allow(null, "").optional(),
    inspectionCertificateNumber: Joi.string().trim().allow("").optional(),
    imageUrl: Joi.string().trim().allow("").optional(),
    images: Joi.array().items(Joi.string().trim()).optional(),
    documents: Joi.array().items(documentItemSchema).optional(),
    unitPrice: Joi.number().min(0).allow(null).optional(),
    notes: Joi.string().trim().allow("").optional(),
    branchId: Joi.string().regex(objectIdRegex).allow("").optional(),
  }).unknown(false),
};

export const updateSupplySchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã vật tư 'id' là bắt buộc.",
      "string.pattern.base": "Mã vật tư 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }).unknown(false),
  body: Joi.object({
    name: Joi.string().trim().optional(),
    code: Joi.string().trim().optional(),
    category: Joi.string().trim().optional(),
    unit: Joi.string().trim().optional(),
    quantity: Joi.forbidden().messages({ "any.unknown": "Không được sửa trực tiếp số tồn. Hãy dùng chứng từ kho." }),
    minQuantity: Joi.number().integer().min(0).optional(),
    requiresExpiry: Joi.boolean().optional(),
    expiryDate: Joi.date().iso().allow(null, "").optional(),
    manufactureDate: Joi.date().iso().allow(null, "").optional(),
    batchNumber: Joi.string().trim().allow("").optional(),
    warehouseLocation: Joi.string().trim().optional(),
    warehouseId: Joi.string().regex(objectIdRegex).allow("", null).optional(),
    roomId: Joi.string().regex(objectIdRegex).allow("", null).optional(),
    supplier: Joi.string().trim().optional(),
    supplierId: Joi.string().regex(objectIdRegex).allow("", null).optional(),
    inspectionDate: Joi.date().iso().optional(),
    nextInspectionDate: Joi.date().iso().allow(null, "").optional(),
    inspectionCertificateNumber: Joi.string().trim().allow("").optional(),
    imageUrl: Joi.string().trim().allow("").optional(),
    images: Joi.array().items(Joi.string().trim()).optional(),
    documents: Joi.array().items(documentItemSchema).optional(),
    unitPrice: Joi.number().min(0).allow(null).optional(),
    notes: Joi.string().trim().allow("").optional(),
    branchId: Joi.string().regex(objectIdRegex).allow("").optional(),
  }).unknown(false),
};

export const deleteSupplySchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required(),
  }).unknown(false),
};

export const stockInSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required(),
  }).unknown(false),
  body: Joi.object({
    quantity: Joi.number().integer().min(1).required().messages({
      "any.required": "Số lượng nhập kho là bắt buộc.",
      "number.min": "Số lượng nhập kho phải lớn hơn 0.",
    }),
    batchNumber: Joi.string().trim().allow("").optional(),
    expiryDate: Joi.date().iso().allow(null, "").optional(),
    reason: Joi.string().trim().allow("").optional(),
  }).unknown(false),
};

export const stockOutSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required(),
  }).unknown(false),
  body: Joi.object({
    quantity: Joi.number().integer().min(1).required().messages({
      "any.required": "Số lượng xuất kho là bắt buộc.",
      "number.min": "Số lượng xuất kho phải lớn hơn 0.",
    }),
    recipientDepartment: Joi.string().trim().required().messages({
      "any.required": "Khoa/Phòng nhận vật tư là bắt buộc.",
      "string.empty": "Khoa/Phòng nhận vật tư không được để trống.",
    }),
    reason: Joi.string().trim().required().messages({
      "any.required": "Lý do/Mục đích xuất dùng là bắt buộc.",
      "string.empty": "Lý do/Mục đích xuất dùng không được để trống.",
    }),
  }).unknown(false),
};

export const batchStockSchema = {
  body: Joi.object({
    type: Joi.string().valid("in", "out").required().messages({
      "any.required": "Loại phiếu (nhập/xuất) là bắt buộc.",
      "any.only": "Loại phiếu phải là 'in' hoặc 'out'.",
    }),
    batchCode: Joi.string().trim().allow("").optional(),
    supplier: Joi.string().trim().allow("").optional(),
    warehouseLocation: Joi.string().trim().allow("").optional(),
    recipientDepartment: Joi.when("type", {
      is: "out",
      then: Joi.string().trim().required().messages({
        "any.required": "Khoa/Phòng nhận vật tư là bắt buộc khi xuất kho.",
        "string.empty": "Khoa/Phòng nhận vật tư không được để trống khi xuất kho.",
      }),
      otherwise: Joi.string().trim().allow("").optional(),
    }),
    reason: Joi.string().trim().required().messages({
      "any.required": "Lý do xuất/nhập kho là bắt buộc.",
      "string.empty": "Lý do xuất/nhập kho không được để trống.",
    }),
    branchId: Joi.string().regex(objectIdRegex).allow("").optional(),
    items: Joi.array()
      .min(1)
      .max(200)
      .items(
        Joi.object({
          supplyId: Joi.string().regex(objectIdRegex).required().messages({
            "any.required": "Mã vật tư (supplyId) là bắt buộc.",
            "string.pattern.base": "Mã vật tư không đúng định dạng MongoDB ObjectId.",
          }),
          quantity: Joi.number().integer().min(1).required().messages({
            "any.required": "Số lượng là bắt buộc.",
            "number.min": "Số lượng phải lớn hơn 0.",
          }),
          batchNumber: Joi.string().trim().allow("").optional(),
          expiryDate: Joi.date().iso().allow(null, "").optional(),
          unitPrice: Joi.number().min(0).optional(),
          notes: Joi.string().trim().allow("").optional(),
        }),
      )
      .required()
      .messages({
        "any.required": "Danh sách vật tư trong lô là bắt buộc.",
        "array.min": "Phiếu phải có ít nhất 1 mặt hàng.",
      }),
  }).unknown(false),
};
