export const customerSettingsSwagger = {
  paths: {
    "/api/v1/customers/settings": {
      get: {
        summary: "Lấy cấu hình phân hạng khách hàng của công ty",
        tags: ["CustomerSettings"],
        parameters: [
          {
            name: "companyCode",
            in: "query",
            description: "Mã công ty (bắt buộc đối với superadmin)",
            required: false,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Lấy cấu hình thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        companyCode: { type: "string", example: "IGEN" },
                        customerTiers: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              code: { type: "string", example: "standard" },
                              name: { type: "string", example: "Thành viên" },
                              minSpend: { type: "number", example: 0 },
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
        },
      },
      patch: {
        summary: "Cập nhật cấu hình phân hạng khách hàng",
        tags: ["CustomerSettings"],
        parameters: [
          {
            name: "companyCode",
            in: "query",
            description: "Mã công ty (bắt buộc đối với superadmin)",
            required: false,
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
                  customerTiers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        code: { type: "string", example: "standard" },
                        name: { type: "string", example: "Thành viên" },
                        minSpend: { type: "number", example: 0 },
                      },
                      required: ["code", "name", "minSpend"],
                    },
                  },
                },
                required: ["customerTiers"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật cấu hình thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        companyCode: { type: "string", example: "IGEN" },
                        customerTiers: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              code: { type: "string", example: "standard" },
                              name: { type: "string", example: "Thành viên" },
                              minSpend: { type: "number", example: 0 },
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
          400: {
            description: "Dữ liệu yêu cầu không hợp lệ",
          },
        },
      },
    },
  },
};
