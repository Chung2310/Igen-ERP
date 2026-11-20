export const equipmentSwagger = {
  paths: {
    "/api/v1/equipment": {
      get: {
        summary: "Lấy danh sách thiết bị phân trang và lọc",
        tags: ["Equipment"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1 },
            description: "Số trang hiển thị",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 20 },
            description: "Số bản ghi tối đa mỗi trang",
          },
          {
            name: "search",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Tìm kiếm theo tên hoặc mã thiết bị",
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["available", "in-use", "maintenance", "retired"] },
            description: "Lọc theo trạng thái thiết bị",
          },
          {
            name: "category",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Lọc theo danh mục thiết bị",
          },
          {
            name: "branchId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Lọc theo chi nhánh (MongoDB ObjectId)",
          },
        ],
        responses: {
          200: {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: { type: "array", items: { type: "object" } },
                    total: { type: "integer", example: 100 },
                    page: { type: "integer", example: 1 },
                    limit: { type: "integer", example: 20 },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Tạo mới thiết bị",
        tags: ["Equipment"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Máy in Canon LBP2900" },
                  code: { type: "string", example: "CANON-2900" },
                  category: { type: "string", example: "Thiết bị văn phòng" },
                  status: {
                    type: "string",
                    enum: ["available", "in-use", "maintenance", "retired"],
                    default: "available",
                  },
                  location: { type: "string", example: "Phòng Hành chính" },
                  assignedTo: { type: "string", example: "Nguyễn Văn A" },
                  purchaseDate: { type: "string", format: "date", example: "2026-08-01" },
                  notes: { type: "string", example: "Máy in hoạt động tốt" },
                  branchId: { type: "string", example: "642b1234567890abcdef1234" },
                },
                required: ["name", "code", "category"],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Tạo thành công",
          },
        },
      },
    },
    "/api/v1/equipment/export": {
      get: {
        summary: "Xuất danh sách thiết bị ra Excel hoặc tải file Excel mẫu import",
        tags: ["Equipment"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "template",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["true", "false"] },
            description: "Đặt là 'true' để tải file mẫu import, 'false' để xuất danh sách thiết bị thực tế",
          },
          {
            name: "search",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Bộ lọc tìm kiếm (chỉ áp dụng khi xuất danh sách thực tế)",
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Bộ lọc trạng thái",
          },
          {
            name: "category",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Bộ lọc danh mục",
          },
          {
            name: "branchId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Bộ lọc chi nhánh",
          },
        ],
        responses: {
          200: {
            description: "Trả về file Excel dưới dạng binary (.xlsx)",
            content: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
        },
      },
    },
    "/api/v1/equipment/import": {
      post: {
        summary: "Import danh sách thiết bị từ file Excel",
        tags: ["Equipment"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                },
                required: ["file"],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Import thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: { type: "string", example: "Đã nhập thành công 5 thiết bị." },
                    data: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          400: {
            description: "Lỗi dữ liệu đầu vào hoặc trùng mã thiết bị",
          },
        },
      },
    },
    "/api/v1/equipment/{id}": {
      get: {
        summary: "Xem chi tiết thiết bị",
        tags: ["Equipment"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Mã thiết bị (MongoDB ObjectId)",
          },
        ],
        responses: {
          200: {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: { type: "object" },
                  },
                },
              },
            },
          },
          404: {
            description: "Không tìm thấy thiết bị",
          },
        },
      },
      patch: {
        summary: "Cập nhật thông tin thiết bị",
        tags: ["Equipment"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Mã thiết bị (MongoDB ObjectId)",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  code: { type: "string" },
                  category: { type: "string" },
                  status: { type: "string", enum: ["available", "in-use", "maintenance", "retired"] },
                  location: { type: "string" },
                  assignedTo: { type: "string" },
                  purchaseDate: { type: "string", format: "date" },
                  notes: { type: "string" },
                  branchId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật thành công",
          },
          404: {
            description: "Không tìm thấy thiết bị",
          },
        },
      },
      delete: {
        summary: "Xóa thiết bị",
        tags: ["Equipment"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Mã thiết bị (MongoDB ObjectId)",
          },
        ],
        responses: {
          200: {
            description: "Xóa thành công",
          },
          404: {
            description: "Không tìm thấy thiết bị",
          },
        },
      },
    },
  },
};
