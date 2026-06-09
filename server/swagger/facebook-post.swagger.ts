export const facebookPostSwagger = {
  paths: {
    "/api/v1/facebook/publish": {
      post: {
        summary: "Đăng bài viết lên Facebook Page thông qua n8n workflow",
        tags: ["Facebook"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "Nội dung bài viết đăng lên Facebook Page",
                    example: "Chào mừng các bạn đến với hệ thống ERP thế hệ mới iGen!",
                  },
                  imageUrl: {
                    type: "string",
                    description: "Đường dẫn URL hình ảnh đi kèm bài đăng (tùy chọn)",
                    example: "https://picsum.photos/800/600",
                  },
                  videoUrl: {
                    type: "string",
                    description: "Đường dẫn URL video đi kèm bài đăng (tùy chọn)",
                    example: "https://example.com/video.mp4",
                  },
                  pageId: {
                    type: "string",
                    description: "ID của trang Facebook mục tiêu",
                    example: "123456789012345",
                  },
                  accessToken: {
                    type: "string",
                    description: "Token quyền hạn (Page Access Token) dùng để đăng bài",
                    example: "EAAGmx...",
                  },
                },
                required: ["content", "pageId", "accessToken"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Gửi yêu cầu đăng bài thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: {
                      type: "string",
                      example: "Gửi yêu cầu đăng bài lên Facebook qua n8n thành công",
                    },
                    data: { type: "object" },
                  },
                },
              },
            },
          },
          400: {
            description: "Dữ liệu đầu vào không hợp lệ",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "error" },
                    message: {
                      type: "string",
                      example: "Dữ liệu yêu cầu không hợp lệ",
                    },
                    errors: { type: "object" },
                  },
                },
              },
            },
          },
          500: {
            description: "Lỗi kết nối máy chủ hoặc n8n",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "error" },
                    message: {
                      type: "string",
                      example: "Lỗi kết nối hoặc xử lý đăng bài lên Facebook qua n8n",
                    },
                    details: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/facebook/validate-token": {
      post: {
        summary: "Xác thực token liên kết Facebook Page qua n8n",
        tags: ["Facebook"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  pageId: {
                    type: "string",
                    description: "ID của trang Facebook",
                    example: "123456789012345",
                  },
                  accessToken: {
                    type: "string",
                    description: "Token quyền hạn (Page Access Token) cần kiểm tra",
                    example: "EAAGmx...",
                  },
                },
                required: ["pageId", "accessToken"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Xác thực thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: {
                      type: "string",
                      example: "Xác thực token kết nối Facebook Page qua n8n thành công",
                    },
                    valid: { type: "boolean", example: true },
                    pageName: { type: "string", example: "My Facebook Page" },
                  },
                },
              },
            },
          },
          400: {
            description: "Dữ liệu đầu vào không hợp lệ",
          },
          500: {
            description: "Lỗi hệ thống hoặc token không hợp lệ",
          },
        },
      },
    },
  },
};
