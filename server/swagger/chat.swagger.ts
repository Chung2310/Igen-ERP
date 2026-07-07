export const chatSwagger = {
  paths: {
    "/api/v1/chat/rooms": {
      get: {
        summary: "Lấy danh sách các phòng trò chuyện của người dùng đăng nhập",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
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
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Tạo phòng chat mới (1-1 hoặc Nhóm)",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  isGroup: { type: "boolean", example: true },
                  memberIds: {
                    type: "array",
                    items: { type: "string" },
                    example: ["642b1234567890abcdef1234"],
                  },
                  name: { type: "string", example: "Nhóm Phát triển Dự án" },
                  avatarURL: { type: "string", example: "https://example.com/avatar.png" },
                },
                required: ["isGroup", "memberIds"],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Đã tạo thành công",
          },
        },
      },
    },
    "/api/v1/chat/rooms/{roomId}": {
      get: {
        summary: "Lấy thông tin chi tiết một phòng trò chuyện",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Thành công" },
        },
      },
      patch: {
        summary: "Cập nhật thông tin phòng chat nhóm",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Nhóm Mới" },
                  avatarURL: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Cập nhật thành công" },
        },
      },
      delete: {
        summary: "Giải tán phòng chat nhóm (Chỉ Admin/Người tạo)",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Giải tán thành công" },
        },
      },
    },
    "/api/v1/chat/rooms/{roomId}/leave": {
      delete: {
        summary: "Rời khỏi phòng chat nhóm",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Rời nhóm thành công" },
        },
      },
    },
    "/api/v1/chat/rooms/{roomId}/members": {
      post: {
        summary: "Thêm thành viên mới vào phòng chat nhóm (Chỉ Admin)",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  memberIds: {
                    type: "array",
                    items: { type: "string" },
                    example: ["642b1234567890abcdef1234"],
                  },
                },
                required: ["memberIds"],
              },
            },
          },
        },
        responses: {
          200: { description: "Thêm thành viên thành công" },
        },
      },
    },
    "/api/v1/chat/rooms/{roomId}/members/{userId}": {
      delete: {
        summary: "Xóa thành viên khỏi phòng chat nhóm (Chỉ Admin)",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Xóa thành viên thành công" },
        },
      },
    },
    "/api/v1/chat/rooms/{roomId}/messages": {
      get: {
        summary: "Lấy lịch sử tin nhắn của một phòng trò chuyện (Phân trang)",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50 },
          },
          {
            name: "beforeDate",
            in: "query",
            schema: { type: "string", format: "date-time" },
            description: "Chỉ lấy tin nhắn gửi trước thời điểm này",
          },
        ],
        responses: {
          200: { description: "Thành công" },
        },
      },
      post: {
        summary: "Gửi tin nhắn mới vào phòng chat",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  content: { type: "string", example: "Chào mọi người!" },
                  attachments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        url: { type: "string", example: "https://cloudinary.com/xyz.pdf" },
                        name: { type: "string", example: "bao-cao.pdf" },
                        type: { type: "string", example: "application/pdf" },
                        size: { type: "number", example: 102456 },
                      },
                      required: ["url", "name", "type"],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Gửi thành công" },
        },
      },
    },
    "/api/v1/chat/rooms/{roomId}/read": {
      post: {
        summary: "Đánh dấu tất cả tin nhắn trong phòng đã được người dùng đọc",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Thành công" },
        },
      },
    },
    "/api/v1/chat/rooms/{roomId}/search": {
      get: {
        summary: "Tìm kiếm tin nhắn, liên kết, tệp tin hoặc hình ảnh/video trong cuộc hội thoại",
        tags: ["Chat"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "query",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Từ khóa tìm kiếm",
          },
          {
            name: "type",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["text", "link", "file", "media", "all"],
              default: "all",
            },
            description: "Phân loại tìm kiếm: text (tin nhắn), link (liên kết), file (tệp tin), media (hình ảnh/video), all (tất cả)",
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
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
