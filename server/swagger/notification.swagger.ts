export const notificationSwagger = {
  paths: {
    "/api/v1/notifications": {
      get: {
        summary: "Lấy danh sách thông báo phân trang của người dùng đăng nhập",
        tags: ["Notification"],
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
            name: "read",
            in: "query",
            required: false,
            schema: { type: "boolean" },
            description: "Lọc theo trạng thái đã đọc (true) hoặc chưa đọc (false)",
          },
          {
            name: "type",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["kho", "task", "training", "he-thong"],
            },
            description: "Lọc theo phân loại thông báo",
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
                    unreadCount: { type: "integer", example: 5 },
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
        summary: "Tạo thông báo mới (Test / System)",
        tags: ["Notification"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", example: "⚠️ Cảnh báo tồn kho: Xi măng" },
                  body: { type: "string", example: "Sản phẩm Xi măng hiện chỉ còn 10 tấn trong kho." },
                  type: { type: "string", enum: ["kho", "task", "training", "he-thong"], example: "kho" },
                  recipientUid: { type: "string", example: "642b1234567890abcdef1234" },
                  action: {
                    type: "object",
                    properties: {
                      tab: { type: "string", example: "KHO & SẢN PHẨM" },
                      subTab: { type: "string", example: "DỰ BÁO AI" },
                    },
                  },
                },
                required: ["title", "body", "type", "recipientUid"],
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
    "/api/v1/notifications/read-all": {
      patch: {
        summary: "Đánh dấu tất cả thông báo của người dùng là đã đọc",
        tags: ["Notification"],
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Đánh dấu đọc tất cả thành công",
          },
        },
      },
    },
    "/api/v1/notifications/{id}/read": {
      patch: {
        summary: "Đánh dấu một thông báo là đã đọc",
        tags: ["Notification"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Mã thông báo (ObjectId)",
          },
        ],
        responses: {
          200: {
            description: "Thành công",
          },
        },
      },
    },
    "/api/v1/notifications/{id}": {
      delete: {
        summary: "Xóa một thông báo",
        tags: ["Notification"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Mã thông báo (ObjectId)",
          },
        ],
        responses: {
          200: {
            description: "Xóa thành công",
          },
        },
      },
    },
  },
};
