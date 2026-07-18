export const superAdminSwagger = {
  paths: {
    "/api/v1/super-admin/dashboard/summary": {
      get: {
        summary: "Lấy dữ liệu dashboard tổng quan của Super Admin",
        tags: ["Super Admin"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "startDate",
            in: "query",
            required: false,
            schema: { type: "string", format: "date-time" },
            description: "Ngày bắt đầu lọc dữ liệu tài chính (ISO format)",
          },
          {
            name: "endDate",
            in: "query",
            required: false,
            schema: { type: "string", format: "date-time" },
            description: "Ngày kết thúc lọc dữ liệu tài chính (ISO format)",
          },
        ],
        responses: {
          200: {
            description: "Lấy dữ liệu thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: {
                      type: "object",
                      properties: {
                        counts: {
                          type: "object",
                          properties: {
                            tenants: {
                              type: "object",
                              properties: {
                                total: { type: "number", example: 5 },
                                active: { type: "number", example: 4 },
                                suspended: { type: "number", example: 1 },
                              },
                            },
                            users: { type: "number", example: 42 },
                            activeSessions: { type: "number", example: 2 },
                            lockedAccounts: { type: "number", example: 0 },
                          },
                        },
                        finance: {
                          type: "object",
                          properties: {
                            totalWalletBalance: { type: "number", example: 150000.5 },
                            totalRevenue: { type: "number", example: 50000 },
                            totalUsage: { type: "number", example: 25000 },
                            revenueByTenant: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  companyCode: { type: "string", example: "SYSTEM" },
                                  companyName: { type: "string", example: "Công ty Mẹ" },
                                  revenue: { type: "number", example: 50000 },
                                  usage: { type: "number", example: 20000 },
                                  balance: { type: "number", example: 30000 },
                                },
                              },
                            },
                          },
                        },
                        health: {
                          type: "object",
                          properties: {
                            api: { type: "string", example: "healthy" },
                            database: { type: "string", example: "healthy" },
                            redis: { type: "string", example: "healthy" },
                            queues: { type: "string", example: "healthy" },
                            storage: { type: "string", example: "healthy" },
                            socketIo: { type: "string", example: "healthy" },
                          },
                        },
                        securityAlerts: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string", example: "alert-123" },
                              type: { type: "string", example: "security.login.totp.failure" },
                              message: { type: "string", example: "Đăng nhập thất bại từ IP: 127.0.0.1" },
                              occurredAt: { type: "string", format: "date-time" },
                            },
                          },
                        },
                        recentActivity: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string", example: "activity-123" },
                              actionType: { type: "string", example: "security.login.totp.success" },
                              actorEmail: { type: "string", example: "super@igen.vn" },
                              result: { type: "string", example: "success" },
                              occurredAt: { type: "string", format: "date-time" },
                              sourceIp: { type: "string", example: "127.0.0.1" },
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
          401: { description: "Chưa xác thực hoặc phiên đăng nhập hết hạn" },
          403: { description: "Không có quyền truy cập (Yêu cầu Super Admin)" },
          500: { description: "Lỗi hệ thống" },
        },
      },
    },
    "/api/v1/super-admin/audit/events": {
      get: {
        summary: "Lấy danh sách nhật ký kiểm toán có phân trang và bộ lọc",
        tags: ["Super Admin"],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "companyCode", in: "query", schema: { type: "string" } },
          { name: "environment", in: "query", schema: { type: "string", enum: ["staging", "production"] } },
          { name: "riskClass", in: "query", schema: { type: "string", enum: ["read_only", "standard", "sensitive", "dangerous"] } },
          { name: "result", in: "query", schema: { type: "string", enum: ["success", "partial", "failure"] } },
          { name: "actionType", in: "query", schema: { type: "string" } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
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
                    data: {
                      type: "object",
                      properties: {
                        events: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              eventId: { type: "string" },
                              actionType: { type: "string" },
                              riskClass: { type: "string" },
                              result: { type: "string" },
                              actorSuperAdminId: { type: "string" },
                              actorEmail: { type: "string" },
                              actorDisplayName: { type: "string" },
                              companyCode: { type: "string" },
                              environment: { type: "string" },
                              occurredAt: { type: "string", format: "date-time" },
                              sourceIp: { type: "string" },
                              userAgent: { type: "string" },
                            },
                          },
                        },
                        total: { type: "integer", example: 100 },
                        page: { type: "integer", example: 1 },
                        limit: { type: "integer", example: 20 },
                        pages: { type: "integer", example: 5 },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Chưa xác thực" },
          500: { description: "Lỗi máy chủ" },
        },
      },
    },
    "/api/v1/super-admin/auth/sessions": {
      get: {
        summary: "Lấy danh sách các phiên đăng nhập Super Admin của tài khoản hiện tại",
        tags: ["Super Admin"],
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sessions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          sessionId: { type: "string" },
                          createdAt: { type: "string", format: "date-time" },
                          lastSeenAt: { type: "string", format: "date-time" },
                          expiresAt: { type: "string", format: "date-time" },
                          revokedAt: { type: "string", format: "date-time" },
                          revokeReason: { type: "string" },
                          deviceId: { type: "string", format: "uuid" },
                          loginIp: { type: "string" },
                          lastIp: { type: "string" },
                          userAgent: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Chưa xác thực" },
        },
      },
    },
    "/api/v1/super-admin/auth/sessions/{sessionId}": {
      delete: {
        summary: "Thu hồi (revoke) một phiên đăng nhập của Super Admin",
        tags: ["Super Admin"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID của phiên làm việc cần thu hồi",
          },
        ],
        responses: {
          200: {
            description: "Thu hồi thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    revoked: { type: "boolean", example: true },
                  },
                },
              },
            },
          },
          401: { description: "Chưa xác thực" },
        },
      },
    },
  },
};
