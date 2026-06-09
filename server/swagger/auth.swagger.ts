export const authSwagger = {
  paths: {
    "/api/v1/auth/register": {
      post: {
        summary: "Đăng ký tài khoản người dùng mới",
        tags: ["Xác thực (Auth)"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", example: "test@igen.com" },
                  password: { type: "string", example: "123456" },
                  displayName: { type: "string", example: "Nguyễn Văn A" },
                  photoURL: { type: "string", example: "https://example.com/avatar.jpg" },
                  role: { type: "string", enum: ["user", "manager", "admin", "superadmin"], example: "user" },
                  companyCode: { type: "string", example: "COMPA" },
                  companyName: { type: "string", example: "Công ty A" },
                  jobTitle: { type: "string", example: "Nhân viên" },
                  department: { type: "string", example: "Nhân sự" },
                  phone: { type: "string", example: "0987654321" },
                },
                required: ["email", "password", "displayName"],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Đăng ký thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: { type: "string", example: "Đăng ký tài khoản thành công" },
                    data: { type: "object" },
                  },
                },
              },
            },
          },
          400: {
            description: "Dữ liệu yêu cầu không hợp lệ hoặc email đã được sử dụng",
          },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        summary: "Đăng nhập hệ thống",
        tags: ["Xác thực (Auth)"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", example: "test@igen.com" },
                  password: { type: "string", example: "123456" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Đăng nhập thành công. Trả về Access Token ở body và lưu Refresh Token vào HTTPOnly Cookie",
            headers: {
              "Set-Cookie": {
                schema: {
                  type: "string",
                  example: "refreshToken=abc...; Path=/; HttpOnly; Max-Age=604800",
                },
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                    user: { type: "object" },
                  },
                },
              },
            },
          },
          401: {
            description: "Email hoặc mật khẩu không chính xác",
          },
        },
      },
    },
    "/api/v1/auth/refresh-token": {
      post: {
        summary: "Làm mới JWT Access Token",
        tags: ["Xác thực (Auth)"],
        responses: {
          200: {
            description: "Làm mới Access Token thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                  },
                },
              },
            },
          },
          400: {
            description: "Thiếu Refresh Token",
          },
          401: {
            description: "Mã làm mới không hợp lệ hoặc đã hết hạn",
          },
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        summary: "Đăng xuất tài khoản (Xóa Refresh Token Cookie)",
        tags: ["Xác thực (Auth)"],
        responses: {
          200: {
            description: "Đăng xuất thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: { type: "string", example: "Đăng xuất tài khoản thành công" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        summary: "Lấy thông tin tài khoản đang đăng nhập",
        tags: ["Xác thực (Auth)"],
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          200: {
            description: "Lấy thông tin tài khoản thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    user: { type: "object" },
                  },
                },
              },
            },
          },
          401: {
            description: "Mã xác thực không hợp lệ hoặc đã hết hạn",
          },
        },
      },
    },
  },
};
