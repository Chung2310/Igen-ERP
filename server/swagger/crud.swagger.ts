export const crudSwagger = {
  paths: {
    "/api/v1/crud/{modelName}": {
      get: {
        summary: "Lấy danh sách tài nguyên (Hỗ trợ phân trang, sắp xếp, tìm kiếm và lọc động)",
        tags: ["Generic CRUD"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "modelName",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: [
                "products",
                "categories",
                "stock-logs",
                "crm-tickets",
                "marketing-contents",
                "projects",
                "kanban-tasks",
                "training-courses",
                "training-enrollments"
              ]
            },
            description: "Tên Model/Resource cần truy vấn"
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1 },
            description: "Số trang"
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1000 },
            description: "Số lượng bản ghi tối đa"
          },
          {
            name: "sort",
            in: "query",
            required: false,
            schema: { type: "string", default: "-createdAt" },
            description: "Trường sắp xếp (ví dụ: 'name' hoặc '-createdAt')"
          },
          {
            name: "search",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Từ khóa tìm kiếm tương đối"
          }
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
                    total: { type: "integer", example: 10 },
                    page: { type: "integer", example: 1 },
                    limit: { type: "integer", example: 1000 }
                  }
                }
              }
            }
          },
          401: { description: "Chưa xác thực" },
          500: { description: "Lỗi máy chủ" }
        }
      },
      post: {
        summary: "Tạo mới một tài nguyên",
        tags: ["Generic CRUD"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "modelName",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Tên Model/Resource cần tạo"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" }
            }
          }
        },
        responses: {
          201: {
            description: "Tạo mới thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: { type: "object" }
                  }
                }
              }
            }
          },
          401: { description: "Chưa xác thực" },
          500: { description: "Lỗi máy chủ" }
        }
      }
    },
    "/api/v1/crud/{modelName}/{id}": {
      get: {
        summary: "Lấy chi tiết một tài nguyên theo ID",
        tags: ["Generic CRUD"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "modelName",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Tên Model/Resource"
          },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID của bản ghi (MongoDB ObjectId)"
          }
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
                    data: { type: "object" }
                  }
                }
              }
            }
          },
          401: { description: "Chưa xác thực" },
          404: { description: "Không tìm thấy" },
          500: { description: "Lỗi máy chủ" }
        }
      },
      patch: {
        summary: "Cập nhật một tài nguyên theo ID",
        tags: ["Generic CRUD"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "modelName",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Tên Model/Resource"
          },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID của bản ghi (MongoDB ObjectId)"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" }
            }
          }
        },
        responses: {
          200: {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: { type: "object" }
                  }
                }
              }
            }
          },
          401: { description: "Chưa xác thực" },
          404: { description: "Không tìm thấy hoặc không có quyền sửa" },
          500: { description: "Lỗi máy chủ" }
        }
      },
      delete: {
        summary: "Xóa một tài nguyên theo ID",
        tags: ["Generic CRUD"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "modelName",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Tên Model/Resource"
          },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID của bản ghi (MongoDB ObjectId)"
          }
        ],
        responses: {
          200: {
            description: "Xóa thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: { type: "string", example: "Xóa tài nguyên thành công" },
                    data: { type: "object" }
                  }
                }
              }
            }
          },
          401: { description: "Chưa xác thực" },
          404: { description: "Không tìm thấy hoặc không có quyền xóa" },
          500: { description: "Lỗi máy chủ" }
        }
      }
    }
  }
};
