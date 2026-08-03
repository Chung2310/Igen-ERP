export const workerProjectSwagger = {
  paths: {
    "/api/v1/worker-management/projects": {
      get: {
        tags: ["Worker Projects"],
        summary: "Lấy danh sách dự án lao động",
        description: "Trả về toàn bộ danh sách các dự án lao động thuộc công ty của tài khoản hiện tại.",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          _id: { type: "string" },
                          code: { type: "string" },
                          name: { type: "string" },
                          quota: { type: "number" },
                          status: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Worker Projects"],
        summary: "Tạo dự án lao động mới",
        description: "Tạo một dự án lao động mới với mã dự án duy nhất cho doanh nghiệp.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["code", "name"],
                properties: {
                  code: { type: "string", example: "DA-001" },
                  name: { type: "string", example: "Dự án xây dựng cầu vượt" },
                  quota: { type: "number", example: 50 },
                  startTime: { type: "string", example: "08:00" },
                  endTime: { type: "string", example: "17:00" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Đã tạo thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { type: "object" },
                  },
                },
              },
            },
          },
          400: {
            description: "Yêu cầu không hợp lệ hoặc trùng mã dự án",
          },
        },
      },
    },
    "/api/v1/worker-management/projects/{id}": {
      get: {
        tags: ["Worker Projects"],
        summary: "Lấy chi tiết dự án lao động",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Thành công",
          },
          404: {
            description: "Không tìm thấy dự án",
          },
        },
      },
      patch: {
        tags: ["Worker Projects"],
        summary: "Cập nhật thông tin dự án lao động",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
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
                  name: { type: "string" },
                  quota: { type: "number" },
                  status: { type: "string", enum: ["planned", "active", "completed"] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật thành công",
          },
        },
      },
      delete: {
        tags: ["Worker Projects"],
        summary: "Xóa mềm dự án lao động",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Xóa thành công",
          },
        },
      },
    },
    "/api/v1/worker-management/projects/{id}/workers": {
      post: {
        tags: ["Worker Projects"],
        summary: "Gán nhân công vào dự án",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
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
                required: ["workerId"],
                properties: {
                  workerId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Thành công",
          },
        },
      },
    },
    "/api/v1/worker-management/projects/{id}/workers/{workerId}": {
      delete: {
        tags: ["Worker Projects"],
        summary: "Loại bỏ nhân công khỏi dự án",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "workerId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Thành công",
          },
        },
      },
    },
  },
};
