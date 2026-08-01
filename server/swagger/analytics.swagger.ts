export const analyticsSwagger = {
  paths: {
    "/api/v1/analytics/revenue": { get: { tags: ["Analytics"], summary: "Doanh thu học phí và bán hàng", security: [{ BearerAuth: [] }], parameters: ["from", "to", "granularity", "branchId", "courseId"].map((name) => ({ name, in: "query", required: name === "from" || name === "to", schema: { type: "string" } })), responses: { 200: { description: "Báo cáo doanh thu" } } } },
    "/api/v1/analytics/receivables": { get: { tags: ["Analytics"], summary: "Tuổi nợ theo ngày đến hạn", security: [{ BearerAuth: [] }], parameters: [{ name: "asOf", in: "query", required: true, schema: { type: "string", format: "date" } }], responses: { 200: { description: "Báo cáo công nợ" } } } },
    "/api/v1/analytics/expenses": { get: { tags: ["Analytics"], summary: "Chi phí lương, hoa hồng và vận hành", security: [{ BearerAuth: [] }], responses: { 200: { description: "Báo cáo chi phí" } } } },
    "/api/v1/analytics/pnl": { get: { tags: ["Analytics"], summary: "Kết quả vận hành P&L", security: [{ BearerAuth: [] }], responses: { 200: { description: "Báo cáo P&L" } } } },
    "/api/v1/analytics/operating-expenses": {
      get: { tags: ["Analytics"], summary: "Danh sách chi phí vận hành", security: [{ BearerAuth: [] }], responses: { 200: { description: "Danh sách khoản chi" } } },
      post: { tags: ["Analytics"], summary: "Ghi nhận chi phí vận hành", security: [{ BearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["category", "description", "amount", "incurredOn"], properties: { category: { type: "string" }, description: { type: "string" }, amount: { type: "number" }, incurredOn: { type: "string", format: "date" }, branchId: { type: "string" } } } } } }, responses: { 201: { description: "Đã ghi nhận" } } },
    },
    "/api/v1/analytics/export": { get: { tags: ["Analytics"], summary: "Xuất báo cáo Excel hoặc CSV", security: [{ BearerAuth: [] }], responses: { 200: { description: "Tệp báo cáo" } } } },
  },
};
