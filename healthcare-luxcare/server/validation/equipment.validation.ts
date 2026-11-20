import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listEquipmentSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1).messages({
      "number.base": "Tham số 'page' phải là một số nguyên.",
      "number.min": "Tham số 'page' phải lớn hơn hoặc bằng 1.",
    }),
    limit: Joi.number().integer().min(1).max(1000).optional().default(20).messages({
      "number.base": "Tham số 'limit' phải là một số nguyên.",
      "number.min": "Tham số 'limit' phải lớn hơn hoặc bằng 1.",
      "number.max": "Tham số 'limit' không được vượt quá 1000.",
    }),
    search: Joi.string().trim().allow("").optional(),
    status: Joi.string()
      .valid("available", "requested", "in-use", "maintenance", "retired")
      .allow("")
      .optional()
      .messages({
        "any.only": "Trạng thái thiết bị không hợp lệ.",
      }),
    category: Joi.string().trim().allow("").optional(),
    departmentId: Joi.string().regex(objectIdRegex).allow("").optional(),
    branchId: Joi.string().regex(objectIdRegex).allow("").optional().messages({
      "string.pattern.base": "Mã chi nhánh 'branchId' không đúng định dạng MongoDB ObjectId.",
    }),
    riskClassification: Joi.string().valid("A", "B", "C", "D").allow("").optional().messages({
      "any.only": "Phân loại rủi ro thiết bị y tế chỉ được chọn: 'A', 'B', 'C', 'D'.",
    }),
    inspectionStatus: Joi.string().valid("all", "overdue", "due_soon", "valid", "none").allow("").optional().messages({
      "any.only": "Trạng thái kiểm định không hợp lệ.",
    }),
  }),
};

export const getEquipmentSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã thiết bị 'id' là bắt buộc.",
      "string.pattern.base": "Mã thiết bị 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};

export const createEquipmentSchema = {
  body: Joi.object({
    name: Joi.string().trim().required().messages({
      "any.required": "Tên thiết bị là bắt buộc.",
      "string.empty": "Tên thiết bị không được để trống.",
    }),
    code: Joi.string().trim().required().messages({
      "any.required": "Mã thiết bị là bắt buộc.",
      "string.empty": "Mã thiết bị không được để trống.",
    }),
    imageUrl: Joi.string().trim().allow(null, "").optional(),
    category: Joi.string().trim().required().messages({
      "any.required": "Danh mục thiết bị là bắt buộc.",
      "string.empty": "Danh mục thiết bị không được để trống.",
    }),
    status: Joi.string().valid("available", "maintenance", "retired").optional().default("available").messages({
      "any.only": "Trạng thái chỉ được chọn: 'available', 'maintenance', 'retired'.",
    }),
    branchId: Joi.string().regex(objectIdRegex).allow("").optional().messages({
      "string.pattern.base": "Mã chi nhánh 'branchId' không đúng định dạng MongoDB ObjectId.",
    }),
    roomId: Joi.string().regex(objectIdRegex).allow(null, "").optional().messages({
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng MongoDB ObjectId.",
    }),
    departmentId: Joi.string().regex(objectIdRegex).allow(null, "").optional(),
    location: Joi.string().trim().allow("").optional(),
    purchaseDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày mua không hợp lệ (phải đúng định dạng ISO 8601).",
    }),
    notes: Joi.string().trim().allow("").optional(),

    // Thiết bị y tế & Hồ sơ
    riskClassification: Joi.string().valid("A", "B", "C", "D").allow(null, "").optional().messages({
      "any.only": "Phân loại rủi ro chỉ gồm nhóm A, B, C hoặc D.",
    }),
    manufacturer: Joi.string().trim().allow(null, "").optional(),
    originCountry: Joi.string().trim().allow(null, "").optional(),
    modelNumber: Joi.string().trim().allow(null, "").optional(),
    serialNumber: Joi.string().trim().allow(null, "").optional(),
    usageStartDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày bắt đầu sử dụng không hợp lệ.",
    }),

    // Hồ sơ pháp lý & Giấy tờ
    legalDocuments: Joi.array().items(
      Joi.object({
        _id: Joi.alternatives().try(Joi.string().regex(objectIdRegex), Joi.string()).optional(),
        title: Joi.string().trim().required().messages({
          "any.required": "Tên tài liệu là bắt buộc.",
          "string.empty": "Tên tài liệu không được để trống.",
        }),
        type: Joi.string()
          .valid("invoice", "co_cq", "import_license", "circulation_license", "calibration_cert", "manual", "other")
          .required()
          .messages({
            "any.required": "Loại tài liệu là bắt buộc.",
            "any.only": "Loại tài liệu pháp lý không hợp lệ.",
          }),
        documentNumber: Joi.string().trim().allow(null, "").optional(),
        fileUrl: Joi.string().trim().required().messages({
          "any.required": "Đường dẫn file tài liệu là bắt buộc.",
        }),
        fileName: Joi.string().trim().allow(null, "").optional(),
        fileSize: Joi.number().min(0).allow(null).optional(),
        uploadToken: Joi.string().trim().allow("").optional(),
        issuedDate: Joi.date().iso().allow(null, "").optional().messages({
          "date.format": "Ngày phát hành không hợp lệ.",
        }),
        expiryDate: Joi.date().iso().allow(null, "").optional().messages({
          "date.format": "Ngày hết hạn không hợp lệ.",
        }),
        issuingAuthority: Joi.string().trim().allow(null, "").optional(),
        notes: Joi.string().trim().allow(null, "").optional(),
        uploadedAt: Joi.date().optional(),
        uploadedBy: Joi.string().optional(),
      })
    ).optional(),

    // Kiểm định, Hiệu chuẩn & Bảo trì
    inspectionCycleMonths: Joi.number().integer().min(1).max(120).allow(null).optional().messages({
      "number.min": "Chu kỳ kiểm định phải từ 1 tháng trở lên.",
      "number.max": "Chu kỳ kiểm định tối đa 120 tháng.",
    }),
    lastInspectionDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày kiểm định/bảo trì gần nhất không hợp lệ.",
    }),
    nextInspectionDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày đến hạn kiểm định tiếp theo không hợp lệ.",
    }),
    lastInspectionResult: Joi.string().valid("pass", "fail", "conditional").allow(null, "").optional().messages({
      "any.only": "Kết quả kiểm định chỉ gồm: pass, fail, conditional.",
    }),
    lastInspectionProvider: Joi.string().trim().allow(null, "").optional(),
    lastInspectionReportUrl: Joi.string().trim().allow(null, "").optional(),
    lastInspectionReportFileName: Joi.string().trim().allow(null, "").optional(),
  }),
};

export const updateEquipmentSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã thiết bị 'id' là bắt buộc.",
      "string.pattern.base": "Mã thiết bị 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
  body: Joi.object({
    name: Joi.string().trim().optional().messages({
      "string.empty": "Tên thiết bị không được để trống.",
    }),
    code: Joi.string().trim().optional().messages({
      "string.empty": "Mã thiết bị không được để trống.",
    }),
    imageUrl: Joi.string().trim().allow(null, "").optional(),
    category: Joi.string().trim().optional().messages({
      "string.empty": "Danh mục thiết bị không được để trống.",
    }),
    status: Joi.string().valid("available", "maintenance", "retired").allow("").optional().messages({
      "any.only": "Thiết bị đang được sử dụng hoặc có yêu cầu mượn không thể cập nhật trực tiếp. Vui lòng hoàn tất trả thiết bị trước khi chỉnh sửa.",
    }),
    branchId: Joi.string().regex(objectIdRegex).allow("").optional().messages({
      "string.pattern.base": "Mã chi nhánh 'branchId' không đúng định dạng MongoDB ObjectId.",
    }),
    roomId: Joi.string().regex(objectIdRegex).allow(null, "").optional().messages({
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng MongoDB ObjectId.",
    }),
    departmentId: Joi.string().regex(objectIdRegex).allow(null, "").optional(),
    location: Joi.string().trim().allow("").optional(),
    purchaseDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày mua không hợp lệ (phải đúng định dạng ISO 8601).",
    }),
    notes: Joi.string().trim().allow("").optional(),

    // Thiết bị y tế & Hồ sơ
    riskClassification: Joi.string().valid("A", "B", "C", "D").allow(null, "").optional().messages({
      "any.only": "Phân loại rủi ro chỉ gồm nhóm A, B, C hoặc D.",
    }),
    manufacturer: Joi.string().trim().allow(null, "").optional(),
    originCountry: Joi.string().trim().allow(null, "").optional(),
    modelNumber: Joi.string().trim().allow(null, "").optional(),
    serialNumber: Joi.string().trim().allow(null, "").optional(),
    usageStartDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày bắt đầu sử dụng không hợp lệ.",
    }),

    // Hồ sơ pháp lý & Giấy tờ
    legalDocuments: Joi.array().items(
      Joi.object({
        _id: Joi.alternatives().try(Joi.string().regex(objectIdRegex), Joi.string()).optional(),
        title: Joi.string().trim().required().messages({
          "any.required": "Tên tài liệu là bắt buộc.",
          "string.empty": "Tên tài liệu không được để trống.",
        }),
        type: Joi.string()
          .valid("invoice", "co_cq", "import_license", "circulation_license", "calibration_cert", "manual", "other")
          .required()
          .messages({
            "any.required": "Loại tài liệu là bắt buộc.",
            "any.only": "Loại tài liệu pháp lý không hợp lệ.",
          }),
        documentNumber: Joi.string().trim().allow(null, "").optional(),
        fileUrl: Joi.string().trim().required().messages({
          "any.required": "Đường dẫn file tài liệu là bắt buộc.",
        }),
        fileName: Joi.string().trim().allow(null, "").optional(),
        fileSize: Joi.number().min(0).allow(null).optional(),
        uploadToken: Joi.string().trim().allow("").optional(),
        issuedDate: Joi.date().iso().allow(null, "").optional().messages({
          "date.format": "Ngày phát hành không hợp lệ.",
        }),
        expiryDate: Joi.date().iso().allow(null, "").optional().messages({
          "date.format": "Ngày hết hạn không hợp lệ.",
        }),
        issuingAuthority: Joi.string().trim().allow(null, "").optional(),
        notes: Joi.string().trim().allow(null, "").optional(),
        uploadedAt: Joi.date().optional(),
        uploadedBy: Joi.string().optional(),
      })
    ).optional(),

    // Kiểm định, Hiệu chuẩn & Bảo trì
    inspectionCycleMonths: Joi.number().integer().min(1).max(120).allow(null).optional().messages({
      "number.min": "Chu kỳ kiểm định phải từ 1 tháng trở lên.",
      "number.max": "Chu kỳ kiểm định tối đa 120 tháng.",
    }),
    lastInspectionDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày kiểm định/bảo trì gần nhất không hợp lệ.",
    }),
    nextInspectionDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày đến hạn kiểm định tiếp theo không hợp lệ.",
    }),
    lastInspectionResult: Joi.string().valid("pass", "fail", "conditional").allow(null, "").optional().messages({
      "any.only": "Kết quả kiểm định chỉ gồm: pass, fail, conditional.",
    }),
    lastInspectionProvider: Joi.string().trim().allow(null, "").optional(),
    lastInspectionReportUrl: Joi.string().trim().allow(null, "").optional(),
    lastInspectionReportFileName: Joi.string().trim().allow(null, "").optional(),
  }),
};

export const deleteEquipmentSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã thiết bị 'id' là bắt buộc.",
      "string.pattern.base": "Mã thiết bị 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};

export const addLegalDocumentSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã thiết bị 'id' là bắt buộc.",
      "string.pattern.base": "Mã thiết bị 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
  body: Joi.object({
    title: Joi.string().trim().required().messages({
      "any.required": "Tên tài liệu là bắt buộc.",
      "string.empty": "Tên tài liệu không được để trống.",
    }),
    type: Joi.string()
      .valid("invoice", "co_cq", "import_license", "circulation_license", "calibration_cert", "manual", "other")
      .required()
      .messages({
        "any.required": "Loại tài liệu là bắt buộc.",
        "any.only": "Loại tài liệu pháp lý không hợp lệ.",
      }),
    documentNumber: Joi.string().trim().allow(null, "").optional(),
    fileUrl: Joi.string().trim().uri().required().messages({
      "any.required": "Đường dẫn file tài liệu là bắt buộc.",
      "string.uri": "Đường dẫn file tài liệu phải là một URL hợp lệ.",
    }),
    fileName: Joi.string().trim().allow(null, "").optional(),
    fileSize: Joi.number().min(0).allow(null).optional(),
    uploadToken: Joi.string().trim().allow("").optional(),
    issuedDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày phát hành không hợp lệ.",
    }),
    expiryDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày hết hạn không hợp lệ.",
    }),
    issuingAuthority: Joi.string().trim().allow(null, "").optional(),
    notes: Joi.string().trim().allow(null, "").optional(),
  }),
};

export const deleteLegalDocumentSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã thiết bị 'id' là bắt buộc.",
      "string.pattern.base": "Mã thiết bị 'id' không đúng định dạng MongoDB ObjectId.",
    }),
    docId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã tài liệu 'docId' là bắt buộc.",
      "string.pattern.base": "Mã tài liệu 'docId' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};

export const recordInspectionSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã thiết bị 'id' là bắt buộc.",
      "string.pattern.base": "Mã thiết bị 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
  body: Joi.object({
    type: Joi.string().valid("inspection", "calibration", "maintenance").required().messages({
      "any.required": "Loại quy trình kiểm tra là bắt buộc.",
      "any.only": "Loại quy trình chỉ gồm: inspection (kiểm định), calibration (hiệu chuẩn), maintenance (bảo trì).",
    }),
    performedDate: Joi.date().iso().required().messages({
      "any.required": "Ngày thực hiện là bắt buộc.",
      "date.format": "Ngày thực hiện không hợp lệ.",
    }),
    nextDueDate: Joi.date().iso().allow(null, "").optional().messages({
      "date.format": "Ngày đến hạn tiếp theo không hợp lệ.",
    }),
    serviceProvider: Joi.string().trim().required().messages({
      "any.required": "Đơn vị thực hiện là bắt buộc.",
      "string.empty": "Đơn vị thực hiện không được để trống.",
    }),
    inspectorName: Joi.string().trim().allow(null, "").optional(),
    result: Joi.string().valid("pass", "fail", "conditional").default("pass").messages({
      "any.only": "Kết quả chỉ được chọn: 'pass' (Đạt), 'fail' (Không đạt), 'conditional' (Có điều kiện).",
    }),
    certificateNumber: Joi.string().trim().allow(null, "").optional(),
    reportFileUrl: Joi.string().trim().uri().allow(null, "").optional().messages({
      "string.uri": "File biên bản phải là một URL hợp lệ.",
    }),
    reportFileName: Joi.string().trim().allow(null, "").optional(),
    uploadToken: Joi.string().trim().allow("").optional(),
    cost: Joi.number().min(0).allow(null).optional(),
    notes: Joi.string().trim().allow(null, "").optional(),
  }),
};

export const listInspectionsSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã thiết bị 'id' là bắt buộc.",
      "string.pattern.base": "Mã thiết bị 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};

export const deleteInspectionRecordSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã thiết bị 'id' là bắt buộc.",
      "string.pattern.base": "Mã thiết bị 'id' không đúng định dạng MongoDB ObjectId.",
    }),
    recordId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã bản ghi 'recordId' là bắt buộc.",
      "string.pattern.base": "Mã bản ghi 'recordId' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};
