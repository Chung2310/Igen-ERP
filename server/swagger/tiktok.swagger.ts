export const tiktokSwagger = {
  paths: {
    "/api/v1/tiktok/publish": {
      post: {
        summary: "Đăng video lên TikTok (MOCK)",
        tags: ["TikTok"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  cardId: {
                    type: "string",
                    description: "ID của bài đăng/card trong hệ thống",
                    example: "mod-tiktok-1",
                  },
                  caption: {
                    type: "string",
                    description: "Nội dung caption cho video TikTok",
                    example: "Video hướng dẫn sử dụng iGen ERP thông minh #igen #erp",
                  },
                  videoUrl: {
                    type: "string",
                    description: "Đường dẫn URL chứa video cần đăng",
                    example: "https://example.com/videos/tutorial.mp4",
                  },
                  privacyLevel: {
                    type: "string",
                    description: "Quyền riêng tư của video",
                    enum: ["PUBLIC", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_ACTIVE_USER", "SELF_ONLY"],
                    example: "SELF_ONLY",
                  },
                },
                required: ["cardId", "videoUrl"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Gửi yêu cầu đăng video thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: {
                      type: "string",
                      example: "Đăng video lên TikTok thành công (MOCK)",
                    },
                    data: {
                      type: "object",
                      properties: {
                        postId: { type: "string", example: "tiktok_mock_1717834928" },
                        shareUrl: { type: "string", example: "https://www.tiktok.com/@demo/video/tiktok_mock_1717834928" },
                        success: { type: "boolean", example: true },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Dữ liệu đầu vào không hợp lệ",
          },
          500: {
            description: "Lỗi hệ thống hoặc kết nối",
          },
        },
      },
    },
    "/api/v1/tiktok/validate-token": {
      post: {
        summary: "Xác thực token liên kết TikTok qua n8n",
        tags: ["TikTok"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string", description: "Username TikTok", example: "igen_tech" },
                  accessToken: { type: "string", description: "Access Token TikTok", example: "tt_act_12345" },
                },
                required: ["username", "accessToken"],
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
                    message: { type: "string", example: "Xác thực token kết nối TikTok qua n8n thành công" },
                    valid: { type: "boolean", example: true },
                    displayName: { type: "string", example: "iGen Tech" },
                    avatarUrl: { type: "string", example: "https://example.com/avatar.png" },
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
