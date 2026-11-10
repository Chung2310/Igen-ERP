import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { collectValues, validateField, validateWorkflow } from "./policy";
import { redactAssistantResult } from "./structured-data";
import inventory from "./api-inventory.json";
import coverage from "./coverage.generated.json";
import manualRouteCoverage from "./manual-route-coverage.json";

describe("expanded operation contracts", () => {
  it("declares every list-search input as a real API query field", () => {
    const listOperations = ASSISTANT_OPERATIONS.filter(operation => operation.method === "GET" && /list|danh sách|tra cứu|liệt kê/i.test(`${operation.id} ${operation.title}`));
    const unmappedSearch = listOperations.flatMap(operation => operation.fields
      .filter(field => (field.key === "search" || /từ khóa tìm kiếm/i.test(field.label)) && field.source !== "query")
      .map(field => `${operation.id}.${field.key}`));
    const unmappedQueries = listOperations.flatMap(operation => operation.fields
      .filter(field => field.source === "query" && !field.apiKey)
      .map(field => `${operation.id}.${field.key}`));
    expect(unmappedSearch).toEqual([]);
    expect(unmappedQueries).toEqual([]);
  });

  it("sends search and list filters to the API for roster, branch, projects, tasks and repair tickets", () => {
    const employeeList = ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.list")!;
    const employeeDetail = ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.detail")!;
    const branchList = ASSISTANT_OPERATIONS.find(operation => operation.id === "branch.list")!;
    const projectList = ASSISTANT_OPERATIONS.find(operation => operation.id === "project.list")!;
    const taskList = ASSISTANT_OPERATIONS.find(operation => operation.id === "task.list")!;
    const repairList = ASSISTANT_OPERATIONS.find(operation => operation.id === "repair.list")!;
    const categoryList = ASSISTANT_OPERATIONS.find(operation => operation.id === "category.list")!;
    const trainingList = ASSISTANT_OPERATIONS.find(operation => operation.id === "training.list")!;
    const productList = ASSISTANT_OPERATIONS.find(operation => operation.id === "product.list")!;

    for (const operation of [employeeList, employeeDetail, branchList, categoryList, trainingList, productList, projectList, taskList, repairList]) {
      const search = operation.fields.find(field => field.key === "search");
      if (search) expect(search.source).toBe("query");
    }
    expect(employeeList.fields.find(field => field.apiKey === "branchId")).toMatchObject({ source: "query", reference: "branch.list" });
    expect(projectList.fields.map(field => field.apiKey)).toEqual(["search", "status", "priority", "startFrom", "startTo", "dueFrom", "dueTo"]);
    expect(taskList.fields.map(field => field.apiKey)).toEqual(["branchId", "search", "status", "priority", "assigneeUid", "projectId", "dueFrom", "dueTo"]);
    expect(taskList.fields.find(field => field.apiKey === "assigneeUid")).toMatchObject({ reference: "employee.list", source: "query" });
    expect(taskList.fields.find(field => field.apiKey === "projectId")).toMatchObject({ reference: "project.list", source: "query" });
    expect(repairList.fields.map(field => field.apiKey)).toEqual(["q", "branchId", "status", "paymentStatus", "customerId", "technicianId", "from", "to", "page", "limit"]);
    expect(repairList.fields.find(field => field.apiKey === "customerId")).toMatchObject({ reference: "customer.list", source: "query" });
    expect(repairList.fields.find(field => field.apiKey === "technicianId")).toMatchObject({ reference: "employee.list", source: "query" });
    expect(productList.fields.find(field => field.key === "search")).toMatchObject({ source: "query", apiKey: "q" });
    expect(defaultWorkflow(taskList).instructions).toContain("điền mọi trường lọc tương ứng");
  });

  it("uses customer names and status-aware choices for customer writes", () => {
    const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "customer.list")!;
    const update = ASSISTANT_OPERATIONS.find(operation => operation.id === "customer.update")!;
    const activate = ASSISTANT_OPERATIONS.find(operation => operation.id === "customer.activate")!;
    const deactivate = ASSISTANT_OPERATIONS.find(operation => operation.id === "customer.deactivate")!;
    expect(list.fields.find(field => field.apiKey === "status")).toMatchObject({ source: "query", required: true, defaultValue: "all" });
    expect(list.resultFields).toEqual(["customerCode", "name", "phone", "status"]);
    expect(update).toMatchObject({ method: "PATCH", path: "/customers/:id", permissions: ["customer:manage"], confirmation: true, systemBodyFields: ["version"] });
    expect(update.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "customer.list", label: "Tên hoặc số điện thoại khách hàng" });
    expect(update.fields.some(field => field.apiKey === "version")).toBe(false);
    expect(activate.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "customer.list", referenceContext: { query_status: "inactive" } });
    expect(deactivate.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "customer.list", referenceContext: { query_status: "active" } });
    for (const operation of [update, activate, deactivate]) expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
  });

  it("limits access administration workflows to company-scoped reads and confirmed role permission updates", () => {
    const permissionList = ASSISTANT_OPERATIONS.find(operation => operation.id === "access.permission-catalog.list")!;
    const permissionDetail = ASSISTANT_OPERATIONS.find(operation => operation.id === "access.permission-catalog.detail")!;
    const roleList = ASSISTANT_OPERATIONS.find(operation => operation.id === "access.role-permissions.list")!;
    const roleDetail = ASSISTANT_OPERATIONS.find(operation => operation.id === "access.role-permissions.detail")!;
    const roleSave = ASSISTANT_OPERATIONS.find(operation => operation.id === "access.role-permissions.save")!;

    expect(permissionList).toMatchObject({ method: "GET", path: "/permissions", permissions: ["access:read"], resultFields: ["code", "name", "module", "group", "action", "description"] });
    expect(permissionDetail.fields.find(field => field.apiKey === "code")).toMatchObject({ reference: permissionList.id, source: "path" });
    expect(roleList).toMatchObject({ method: "GET", path: "/role-permissions", permissions: ["access:read"], resultFields: ["role", "displayName", "permissions", "level", "updatedAt"] });
    expect(roleList.fields.some(field => field.apiKey === "companyCode" || field.key === "companyCode")).toBe(false);
    expect(roleDetail.fields.find(field => field.apiKey === "role")).toMatchObject({ reference: roleList.id, referenceValueKey: "role", source: "path" });
    expect(roleSave).toMatchObject({ method: "POST", path: "/role-permissions", permissionGroups: [["access:manage"]], confirmation: true });
    expect(roleSave.fields.find(field => field.apiKey === "role")).toMatchObject({ reference: roleList.id, referenceValueKey: "role" });
    expect(roleSave.fields.find(field => field.apiKey === "permissions")?.structure?.items).toMatchObject({ reference: permissionList.id, referenceValueKey: "code" });
    expect(roleSave.fields.find(field => field.apiKey === "level")).toMatchObject({ min: 1, integer: true, required: true });
    expect(roleSave.description).toContain("mọi tài khoản mang vai trò đó");
    expect(defaultWorkflow(roleSave).confirmationLocked).toBe(true);

    for (const [method, path] of [
      ["POST", "/permissions"],
      ["PATCH", "/permissions/:code"],
      ["DELETE", "/permissions/:code"],
      ["DELETE", "/role-permissions/:role"],
    ]) {
      expect(coverage.entries.find(entry => entry.method === method && entry.path === path)).toMatchObject({ status: "unsupported" });
      expect(coverage.entries.find(entry => entry.method === method && entry.path === path)?.reason).toMatch(/superadmin|danh mục quyền|cấu hình quyền/i);
    }
  });

  it("keeps department workflows aligned with the HR API and displays usable summaries", () => {
    const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "department.list")!;
    const create = ASSISTANT_OPERATIONS.find(operation => operation.id === "department.create")!;
    const update = ASSISTANT_OPERATIONS.find(operation => operation.id === "department.update")!;
    const remove = ASSISTANT_OPERATIONS.find(operation => operation.id === "department.delete")!;
    expect(list).toMatchObject({ method: "GET", path: "/hr/departments", resultFields: ["name", "code", "description", "managerName", "sortOrder", "isActive", "employeeCount"] });
    expect(list.fields).toEqual([]);
    expect(list.permissionGroups).toEqual([["hr:read", "access:read", "hr:manage", "access:manage"]]);
    expect(create.fields.find(field => field.key === "managerUid")).toMatchObject({ reference: "employee.list", required: false });
    expect(create.fields.find(field => field.key === "isActive")).toMatchObject({ type: "boolean", defaultValue: true });
    expect(update).toMatchObject({ method: "PATCH", path: "/hr/departments/:id", confirmation: true });
    expect(update.fields.find(field => field.key === "id")?.reference).toBe("department.list");
    expect(update.fields.find(field => field.key === "name")?.required).toBe(false);
    expect(remove).toMatchObject({ method: "DELETE", path: "/hr/departments/:id", confirmation: true, resultFields: ["deleted"] });
    expect(remove.description).toContain("bỏ gán phòng ban");
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(defaultWorkflow(remove).confirmationLocked).toBe(true);
  });

  it("models employee department and product category as name-selectable relationships", () => {
    const employeeCreate = ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.create")!;
    const employeeUpdate = ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.update")!;
    const productCreate = ASSISTANT_OPERATIONS.find(operation => operation.method === "POST" && operation.path === "/inventory/catalog/products")!;
    const productUpdate = ASSISTANT_OPERATIONS.find(operation => operation.method === "PATCH" && operation.path === "/inventory/catalog/products/:id")!;
    const courseCreate = ASSISTANT_OPERATIONS.find(operation => operation.method === "POST" && operation.path === "/courses")!;
    const courseUpdate = ASSISTANT_OPERATIONS.find(operation => operation.method === "PATCH" && operation.path === "/courses/:id")!;
    const courseCategories = ASSISTANT_OPERATIONS.find(operation => operation.id === "course.category.list")!;
    const courseCategoryCreate = ASSISTANT_OPERATIONS.find(operation => operation.id === "course.category.create")!;
    const repairPart = ASSISTANT_OPERATIONS.find(operation => operation.method === "POST" && operation.path === "/repair/tickets/:id/parts")!;
    expect(employeeCreate.fields.find(field => field.key === "department")).toMatchObject({ type: "reference", reference: "department.list", referenceValueKey: "name", required: false });
    expect(employeeUpdate.fields.find(field => field.key === "department")).toMatchObject({ type: "reference", reference: "department.list", referenceValueKey: "name", required: false });
    expect(productCreate.fields.find(field => field.key === "categoryCode")).toMatchObject({ reference: "inventory.catalog.resource.list", referenceContext: { path_kind: "categories" }, referenceValueKey: "code", required: true });
    expect(productUpdate.fields.find(field => field.key === "categoryCode")).toMatchObject({ reference: "inventory.catalog.resource.list", referenceContext: { path_kind: "categories" }, referenceValueKey: "code", required: false });
    expect(courseCategories).toMatchObject({ method: "GET", path: "/courses/categories", resultFields: ["name"] });
    expect(courseCategoryCreate).toMatchObject({
      method: "POST",
      path: "/courses/categories",
      title: "Tạo phân loại khóa học",
      module: "student",
      permissions: ["people:manage"],
      permissionGroups: [["people:manage"]],
      confirmation: true,
      resultFields: ["name"],
    });
    expect(courseCategoryCreate.fields.find(field => field.apiKey === "name")).toMatchObject({ label: "Tên phân loại khóa học", required: true, source: "body" });
    expect(courseCreate.fields.find(field => field.apiKey === "category")).toMatchObject({ reference: "course.category.list", referenceValueKey: "name", required: true });
    expect(courseUpdate.fields.find(field => field.apiKey === "category")).toMatchObject({ reference: "course.category.list", referenceValueKey: "name", required: false });
    expect(repairPart.fields.find(field => field.apiKey === "productId")).toMatchObject({ reference: "product.list", referenceValueKey: "id" });
    expect(repairPart.fields.find(field => field.apiKey === "sku")).toMatchObject({ reference: "inventory.product.detail", referenceParentKey: "productId", referenceValueKey: "sku" });
    expect(productCreate.fields.find(field => field.key === "mediaIds")?.structure?.items).toMatchObject({ reference: "resource.list", referenceValueKey: "id" });
    expect(productCreate.fields.find(field => field.key === "documentIds")?.structure?.items).toMatchObject({ reference: "resource.list", referenceValueKey: "id" });
    for (const operation of [
      ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/finance/assets")!,
      ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/finance/assets/:id")!,
    ]) {
      expect(operation.fields.find(field => field.apiKey === "department")).toMatchObject({ reference: "department.list", referenceValueKey: "name" });
      expect(operation.fields.find(field => field.apiKey === "custodianName")).toMatchObject({ reference: "employee.list", referenceValueKey: "displayName" });
      expect(operation.fields.find(field => field.apiKey === "supplierName")).toMatchObject({ reference: "inventory.supplier.list", referenceValueKey: "name" });
    }
  });

  it("requires readable selectable references for every body field that links another record", () => {
    // Tax IDs are user-entered legal identifiers. POS session/device IDs are
    // derived from the actor's active shift and device by the executor.
    const systemDerivedOrNonRelationship = new Set([
      "customer.billing.profile.create.taxId",
      "finance.tax.create.taxId",
      "api.post.748a178f1689567e.taxId",
      "retail.order.checkout.posSessionId",
      "retail.order.checkout.terminalId",
      "retail.order.confirm.posSessionId",
      "retail.order.confirm.terminalId",
      "retail.order.collect.cashSessionId",
      "retail.order.collect.terminalId",
      "retail.order.cancel.cashSessionId",
      "retail.order.cancel.terminalId",
    ]);
    const missingReferences: string[] = [];
    const unusableReferenceLists: string[] = [];
    const visit = (operation: (typeof ASSISTANT_OPERATIONS)[number], key: string, shape: any, path: string) => {
      const fieldPath = `${operation.id}.${path}`;
      if (shape?.type === "object") {
        for (const [childKey, childShape] of Object.entries(shape.keys || {})) {
          visit(operation, childKey, childShape, `${path}.${childKey}`);
        }
        return;
      }
      if (shape?.type === "array") {
        if (/(?:Ids|Uids)$/.test(key) && !shape.items?.reference && !systemDerivedOrNonRelationship.has(fieldPath)) {
          missingReferences.push(fieldPath);
        }
        if (shape.items?.type === "object") {
          for (const [childKey, childShape] of Object.entries(shape.items.keys || {})) {
            visit(operation, childKey, childShape, `${path}[].${childKey}`);
          }
        }
        if (shape.items?.reference) {
          const target = ASSISTANT_OPERATIONS.find(candidate => candidate.id === shape.items.reference);
          if (!target || (target.method !== "GET" && !target.readOnly) || target.resultFields.length === 0) {
            unusableReferenceLists.push(`${fieldPath} -> ${shape.items.reference}`);
          }
        }
        return;
      }
      if (/(?:Id|Uid)$/.test(key) && !shape?.reference && !systemDerivedOrNonRelationship.has(fieldPath)) {
        missingReferences.push(fieldPath);
      }
      if (shape?.reference) {
        const target = ASSISTANT_OPERATIONS.find(candidate => candidate.id === shape.reference);
        if (!target || (target.method !== "GET" && !target.readOnly) || target.resultFields.length === 0) {
          unusableReferenceLists.push(`${fieldPath} -> ${shape.reference}`);
        }
      }
    };

    for (const operation of ASSISTANT_OPERATIONS) {
      for (const field of operation.fields) {
        if (field.source === "body") visit(operation, field.apiKey || field.key, field.structure || field, field.key);
      }
    }

    expect(missingReferences).toEqual([]);
    expect(unusableReferenceLists).toEqual([]);
  });

  it("keeps every path and query relationship backed by a readable named-choice workflow", () => {
    const invalidReferences = ASSISTANT_OPERATIONS.flatMap(operation => operation.fields
      .filter(field => Boolean(field.reference))
      .flatMap(field => {
        const target = ASSISTANT_OPERATIONS.find(candidate => candidate.id === field.reference);
        return !target || (target.method !== "GET" && !target.readOnly) || target.resultFields.length === 0
          ? [`${operation.id}.${field.key} -> ${field.reference}`]
          : [];
      }));
    expect(invalidReferences).toEqual([]);
  });

  it("documents marketing campaign detail and bulk actions that still lack a safe preview", () => {
    const unsupported = [
      ["GET", "/marketing-campaigns/:id", /statistics.*tr\u1EA1ng th\u00E1i/i],
      ["POST", "/marketing-campaigns/:id/activate", /publish ra Facebook\/TikTok/i],
      ["POST", "/marketing-campaigns/:id/batch-prepare", /100 job/i],
      ["POST", "/marketing-campaigns/:id/retry-all", /t\u1EEBng slot/i],
    ] as const;
    for (const [method, path, reasonPattern] of unsupported) {
      const entry = coverage.entries.find(candidate => candidate.method === method && candidate.path === path)!;
      expect(entry.status).toBe("unsupported");
      expect(entry.reason).toMatch(reasonPattern);
    }
  });

  it("tracks TikTok batch approval as intentionally unsupported while single-slot approval stays selectable", () => {
    const batch = coverage.entries.find(entry => entry.method === "POST" && entry.path === "/marketing-campaigns/:id/tiktok/batch-approve")!;
    expect(batch.status).toBe("unsupported");
    expect(batch.reason).toMatch(/videoDurations.*ID n\u1ED9i b\u1ED9/i);
    expect(ASSISTANT_OPERATIONS.some(operation => operation.method === "POST" && operation.path === batch.path)).toBe(false);
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.slot.approve")).toBeDefined();
  });

  it("models retail coupons as selectable, customer-scoped relationships", () => {
    const options = ASSISTANT_OPERATIONS.find(operation => operation.id === "retail.coupon.assistant-options.list")!;
    const tiers = ASSISTANT_OPERATIONS.find(operation => operation.id === "retail.coupon.tier.list")!;
    const createCoupon = ASSISTANT_OPERATIONS.find(operation => operation.id === "retail.coupon.create")!;
    const getCoupon = (operation: (typeof ASSISTANT_OPERATIONS)[number]) => operation.fields.find(field => field.key === "input")?.structure?.keys?.couponCode
      || operation.fields.find(field => field.key === "couponCode");
    const checkout = ASSISTANT_OPERATIONS.find(operation => operation.id === "retail.order.checkout")!;
    const quote = ASSISTANT_OPERATIONS.find(operation => operation.id === "retail.order.quote")!;
    const createDraft = ASSISTANT_OPERATIONS.find(operation => operation.method === "POST" && operation.path === "/retail/orders")!;
    const updateDraft = ASSISTANT_OPERATIONS.find(operation => operation.method === "PATCH" && operation.path === "/retail/orders/:id")!;

    expect(options).toMatchObject({
      method: "GET",
      path: "/retail/coupons/assistant-options",
      permissionGroups: [["pos:manage", "retail:manage"]],
      confirmation: false,
      resultFields: ["code", "name", "discountType", "value", "minSubtotal", "maxDiscount"],
    });
    expect(options.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    expect(options.fields.find(field => field.apiKey === "customerId")).toMatchObject({ reference: "customer.list", referenceValueKey: "id" });
    expect(tiers).toMatchObject({ method: "GET", path: "/retail/coupons/tiers", resultFields: ["code", "name"] });
    expect(createCoupon).toMatchObject({
      method: "POST",
      path: "/retail/coupons",
      assistantOnlyFields: ["targetType"],
      permissionGroups: [["retail:manage"]],
      confirmation: true,
      resultFields: ["code", "name", "customerName", "customerTierCodes", "discountType", "value", "minSubtotal", "maxDiscount", "startsAt", "endsAt", "usageLimit", "active"],
    });
    expect(createCoupon.fields.find(field => field.key === "targetBranch")).toMatchObject({ reference: "branch.list", required: false, apiKey: "branchId" });
    const targetType = createCoupon.fields.find(field => field.key === "targetType");
    expect(targetType).toMatchObject({ required: true, systemRequired: true, options: ["all_customers", "specific_customer"] });
    expect(targetType?.source).toBeUndefined();
    expect(createCoupon.fields.find(field => field.apiKey === "customerId")).toMatchObject({
      reference: "customer.list",
      referenceValueKey: "id",
      requiredWhen: { field: "targetType", equals: "specific_customer" },
    });
    expect(createCoupon.fields.find(field => field.apiKey === "customerId")).toMatchObject({ reference: "customer.list", referenceValueKey: "id" });
    expect(createCoupon.fields.find(field => field.apiKey === "customerTierCodes")?.structure?.items).toMatchObject({
      reference: tiers.id,
      referenceParentKey: "targetBranch",
      referenceValueKey: "code",
    });
    expect(createCoupon.fields.find(field => field.apiKey === "startsAt")).toMatchObject({ type: "datetime", required: true });
    expect(createCoupon.fields.find(field => field.apiKey === "endsAt")).toMatchObject({ type: "datetime", required: true });
    for (const operation of [checkout, quote, createDraft, updateDraft]) {
      expect(getCoupon(operation)).toMatchObject({
        reference: options.id,
        referenceParentKey: "customerId",
        referenceValueKey: "code",
      });
    }
    expect(checkout.fields.find(field => field.key === "input")?.structure?.keys?.couponCode?.referenceParentOptional).toBe(true);
    expect(quote.fields.find(field => field.key === "input")?.structure?.keys?.couponCode?.referenceParentOptional).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === options.path)).toMatchObject({ status: "contract", id: options.id });
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === createCoupon.path)).toMatchObject({ status: "manual", id: createCoupon.id });
  });

  it("cancels only a selectable video-caption project with confirmation and a minimal result", () => {
    const cancel = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.video-caption.project.cancel")!;
    expect(cancel).toMatchObject({
      method: "POST",
      path: "/video-caption-projects/:id/cancel",
      confirmation: true,
      permissions: ["marketing:post"],
      resultFields: ["projectName", "status", "cancelled"],
    });
    expect(cancel.fields.find(field => field.apiKey === "id")).toMatchObject({
      reference: "marketing.video-caption.project.list",
      source: "path",
    });
    expect(cancel.fields.filter(field => field.source === "body")).toEqual([]);
    expect(defaultWorkflow(cancel).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === cancel.path && entry.method === cancel.method)).toMatchObject({ status: "contract", id: cancel.id });
  });

  it("retries only failed or cancelled video-caption projects through a confirmation-gated workflow", () => {
    const retry = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.video-caption.project.retry")!;
    expect(retry).toMatchObject({
      method: "POST",
      path: "/video-caption-projects/:id/retry",
      confirmation: true,
      permissions: ["marketing:post"],
      resultFields: ["operationLabel", "status", "queued"],
    });
    expect(retry.fields.find(field => field.apiKey === "id")).toMatchObject({
      reference: "marketing.video-caption.project.list",
      source: "path",
    });
    expect(retry.fields.filter(field => field.source === "body")).toEqual([]);
    expect(retry.description).toContain("có thể dùng dịch vụ AI tính phí");
    expect(defaultWorkflow(retry).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === retry.path && entry.method === retry.method)).toMatchObject({ status: "contract", id: retry.id });
  });

  it("offers confirmed analysis, transcription, context, and render jobs by project name", () => {
    const operations = [
      ["marketing.video-caption.project.analyze", "/video-caption-projects/:id/analyze"],
      ["marketing.video-caption.project.transcribe", "/video-caption-projects/:id/transcribe"],
      ["marketing.video-caption.project.generate-context", "/video-caption-projects/:id/generate-context"],
      ["marketing.video-caption.project.render", "/video-caption-projects/:id/render"],
    ] as const;

    for (const [id, path] of operations) {
      const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === id)!;
      expect(operation).toMatchObject({ method: "POST", path, permissionGroups: [["marketing:post"]], confirmation: true, resultFields: ["status"] });
      expect(operation.fields.find(field => field.apiKey === "id")).toMatchObject({
        reference: "marketing.video-caption.project.list",
        source: "path",
      });
      expect(operation.resultFields).not.toContain("id");
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
      expect(coverage.entries.find(entry => entry.path === path && entry.method === "POST")).toMatchObject({ status: "contract", id });
    }

    const render = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "marketing.video-caption.project.render")!;
    expect(render.fields.find(field => field.apiKey === "preview")).toMatchObject({ type: "boolean", required: true });
    expect(render.description).toContain("preview = true");
    expect(render.description).toContain("preview = false");
    expect(ASSISTANT_OPERATIONS.find(candidate => candidate.id === "marketing.video-caption.project.transcribe")?.description).toContain("tính phí");
  });

  it("supports safe community template discovery, publishing, and private copying by name", () => {
    const communityList = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.bulk-create.templates.community.list")!;
    const privateList = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.bulk-create.templates.list")!;
    expect(communityList).toMatchObject({ method: "GET", path: "/bulk-create/templates/community", resultFields: ["name", "version", "useCount", "publishedAt"] });
    for (const [id, path, reference, resultFields] of [
      ["marketing.bulk-create.templates.publish", "/bulk-create/templates/:id/publish", "marketing.bulk-create.templates.list", ["name", "visibility", "publishedAt"]],
      ["marketing.bulk-create.templates.unpublish", "/bulk-create/templates/:id/unpublish", "marketing.bulk-create.templates.list", ["name", "visibility", "publishedAt"]],
      ["marketing.bulk-create.templates.community.use", "/bulk-create/templates/:id/use", communityList.id, ["name", "visibility", "version"]],
    ] as const) {
      const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === id)!;
      expect(operation).toMatchObject({ method: "POST", path, confirmation: true, permissions: ["marketing:post"], resultFields });
      expect(operation.fields.find(field => field.apiKey === "id")).toMatchObject({ reference, source: "path" });
      expect(operation.fields.filter(field => field.source === "body")).toEqual([]);
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
      expect(coverage.entries.find(entry => entry.path === path && entry.method === "POST")).toMatchObject({ status: "contract", id });
    }
    const rename = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.bulk-create.templates.rename")!;
    expect(rename).toMatchObject({ method: "PATCH", path: "/bulk-create/templates/:id", confirmation: true, permissions: ["marketing:post"], resultFields: ["name", "visibility", "version", "updatedAt"] });
    expect(rename.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: privateList.id, source: "path", label: "Tên hoặc mã mẫu thiết kế cần đổi tên" });
    expect(rename.fields.filter(field => field.source === "body").map(field => field.apiKey)).toEqual(["name"]);
    expect(rename.description).toContain("canvas, lớp, ảnh nền và thiết kế giữ nguyên");
    expect(defaultWorkflow(rename).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === rename.path && entry.method === "PATCH")).toMatchObject({ status: "contract", id: rename.id });
    expect(coverage.entries.find(entry => entry.path === communityList.path && entry.method === "GET")).toMatchObject({ status: "contract", id: communityList.id });
  });

  it("offers named linked records for payments, assignments, quality, and learning roadmaps", () => {
    const route = (method: string, path: string) => ASSISTANT_OPERATIONS.find(operation => operation.method === method && operation.path === path)!;
    const payment = route("POST", "/payments");
    expect(payment.fields.find(field => field.apiKey === "studentId")).toMatchObject({ type: "reference", reference: "student.list", referenceValueKey: "id" });
    const notification = route("POST", "/student-notifications");
    expect(notification.fields.find(field => field.apiKey === "studentIds")?.structure?.items).toMatchObject({ reference: "student.list", referenceValueKey: "id" });
    expect(route("POST", "/assignments").fields.find(field => field.apiKey === "batchId")).toMatchObject({ reference: "batch.list", referenceValueKey: "id" });
    expect(route("GET", "/assignments")).toMatchObject({ id: "student.assignment.list", resultFields: expect.arrayContaining(["title"]) });
    expect(route("GET", "/assignments").fields.find(field => field.apiKey === "batchId")).toMatchObject({ reference: "batch.list", required: true });
    expect(route("GET", "/assignments/:id/submissions").fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "student.assignment.list", referenceParentKey: "query_batchId" });
    const qualityList = route("GET", "/student-quality");
    expect(qualityList.fields.find(field => field.apiKey === "batchId")).toMatchObject({ reference: "batch.list" });
    expect(qualityList.fields.find(field => field.apiKey === "courseId")).toMatchObject({ reference: "course.list" });
    expect(qualityList.fields.find(field => field.apiKey === "instructorId")).toMatchObject({ reference: "employee.list" });
    const miniTest = route("POST", "/student-quality/batches/:batchId/students/:studentId/mini-tests");
    expect(miniTest.fields.find(field => field.apiKey === "studentId")).toMatchObject({ reference: "batch.attendance.learners", referenceParentKey: "path_batchId", referenceValueKey: "id" });
    const roadmapProgression = route("PATCH", "/learning-roadmaps/batches/:batchId/students/:studentId/progression");
    expect(roadmapProgression.fields.find(field => field.apiKey === "batchId")).toMatchObject({ reference: "batch.list" });
    expect(roadmapProgression.fields.find(field => field.apiKey === "studentId")).toMatchObject({ reference: "batch.attendance.learners", referenceParentKey: "path_batchId" });
    expect(roadmapProgression.fields.find(field => field.apiKey === "roadmapId")).toMatchObject({ reference: "student.learning-roadmap.list", referenceValueKey: "id" });
    expect(route("GET", "/learning-roadmaps/batches/:batchId/progression").fields.find(field => field.apiKey === "roadmapId")).toMatchObject({ reference: "student.learning-roadmap.list" });
    const waitlist = route("GET", "/learning-roadmaps/waitlist");
    expect(waitlist.fields.find(field => field.apiKey === "targetStepId")).toMatchObject({ reference: "student.learning-roadmap.steps.list", referenceParentKey: "query_roadmapId", referenceValueKey: "stepId" });
    expect(waitlist).toMatchObject({ id: "student.learning-roadmap.waitlist.list", resultFields: expect.arrayContaining(["studentName", "roadmapName", "sourceBatchCode"]) });
    const waitlistPlace = route("POST", "/learning-roadmaps/waitlist/place");
    expect(waitlistPlace.fields.find(field => field.apiKey === "batchId")).toMatchObject({ reference: "batch.list", referenceValueKey: "id" });
    expect(waitlistPlace.fields.find(field => field.apiKey === "entryIds")?.structure?.items).toMatchObject({ reference: waitlist.id, referenceValueKey: "id" });
  });

  it("resolves resource folders, project members and financial links through selectable records", () => {
    const operation = (id: string) => ASSISTANT_OPERATIONS.find(item => item.id === id)!;
    const route = (method: string, path: string) => ASSISTANT_OPERATIONS.find(item => item.method === method && item.path === path)!;
    expect(route("POST", "/resources/folder").fields.find(field => field.key === "parentId")).toMatchObject({ reference: "resource.list", referenceValueKey: "id" });
    expect(route("POST", "/resources/file").fields.find(field => field.key === "parentId")).toMatchObject({ reference: "resource.list", referenceValueKey: "id" });
    expect(route("POST", "/worker-management/workers").fields.find(field => field.key === "projectId")).toMatchObject({ reference: "worker.project.list", referenceValueKey: "id" });
    expect(operation("worker.project.create").fields.find(field => field.key === "workerIds")?.structure?.items).toMatchObject({ reference: "worker.list", referenceValueKey: "id" });
    expect(operation("worker.project.update").fields.find(field => field.key === "workerIds")?.structure?.items).toMatchObject({ reference: "worker.list", referenceValueKey: "id" });
    expect(route("POST", "/worker-management/attendance/mark").fields.find(field => field.apiKey === "projectId")).toMatchObject({ reference: "worker.project.list", referenceValueKey: "id" });
    expect(route("POST", "/worker-management/attendance/mark").fields.find(field => field.apiKey === "workerId")).toMatchObject({ reference: "worker.list", referenceValueKey: "id" });
    expect(route("GET", "/worker-management/attendance").fields.find(field => field.apiKey === "projectId")).toMatchObject({ reference: "worker.project.list", referenceValueKey: "id" });
    expect(route("PATCH", "/worker-management/attendance/:id").fields.find(field => field.apiKey === "projectId")).toMatchObject({ reference: "worker.project.list", referenceValueKey: "id" });
    expect(route("PATCH", "/resources/:id/move").fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "resource.list", referenceValueKey: "id" });
    expect(route("PATCH", "/resources/:id/move").fields.find(field => field.apiKey === "parentId")).toMatchObject({ reference: "resource.list", referenceValueKey: "id" });
    expect(route("POST", "/recruitment/jobs").fields.find(field => field.apiKey === "department")).toMatchObject({ reference: "department.list", referenceValueKey: "name" });
    expect(route("PATCH", "/recruitment/jobs/:id").fields.find(field => field.apiKey === "department")).toMatchObject({ reference: "department.list", referenceValueKey: "name" });
    expect(route("POST", "/finance/assets").fields.find(field => field.apiKey === "department")).toMatchObject({ reference: "department.list", referenceValueKey: "name" });
    expect(route("PATCH", "/finance/assets/:id").fields.find(field => field.apiKey === "department")).toMatchObject({ reference: "department.list", referenceValueKey: "name" });
    expect(route("GET", "/finance/management/debts")).toMatchObject({ id: "finance.management.debts.list", resultFields: expect.arrayContaining(["targetType", "code", "name"]) });
    expect(route("POST", "/finance/management/payables").fields.find(field => field.apiKey === "receiptId")).toMatchObject({ reference: "finance.management.debts.list", referenceParentKey: "targetBranch", referenceValueKey: "id" });
    expect(route("POST", "/finance/management/followups").fields.find(field => field.apiKey === "targetId")).toMatchObject({ reference: "finance.management.debts.list", referenceParentKey: "targetBranch", referenceValueKey: "id" });
    expect(route("POST", "/finance/management/followups").fields.find(field => field.apiKey === "assignee")).toMatchObject({ type: "reference", label: "Nh\u00E2n s\u1EF1 ph\u1EE5 tr\u00E1ch", reference: "employee.list", referenceValueKey: "displayName" });
    const referral = route("POST", "/worker-management/partners/:partnerId/referrals");
    expect(referral.fields.find(field => field.apiKey === "workerId")).toMatchObject({ reference: "worker.list", referenceValueKey: "id" });
    expect(referral.fields.find(field => field.apiKey === "policyId")).toMatchObject({ reference: "worker.partner.policy.list", referenceValueKey: "id" });
    expect(route("POST", "/worker-management/partners/:partnerId/referrals/:referralId/end").fields.find(field => field.apiKey === "referralId")).toMatchObject({ reference: "worker.partner.referrals.list", referenceParentKey: "path_partnerId", referenceValueKey: "id" });
    const chatRoomList = route("GET", "/chat/rooms");
    expect(chatRoomList).toMatchObject({ id: "chat.rooms.list", resultFields: expect.arrayContaining(["name"]) });
    expect(route("POST", "/chat/rooms").fields.find(field => field.apiKey === "memberIds")?.structure?.items).toMatchObject({ reference: "account.colleagues.list", referenceValueKey: "id" });
    expect(route("POST", "/chat/rooms/:roomId/members").fields.find(field => field.apiKey === "memberIds")?.structure?.items).toMatchObject({ reference: "account.colleagues.list", referenceValueKey: "id" });
    expect(route("POST", "/notifications").fields.find(field => field.apiKey === "recipientUid")).toMatchObject({ reference: "account.colleagues.list", referenceValueKey: "id" });
    expect(route("POST", "/chat/rooms/:roomId/pin").fields.find(field => field.apiKey === "roomId")).toMatchObject({ reference: chatRoomList.id });
    expect(route("POST", "/chat/rooms/:roomId/pin").fields.find(field => field.apiKey === "messageId")).toMatchObject({ reference: "chat.room.messages.list", referenceParentKey: "path_roomId", referenceValueKey: "id" });
    const roomMembers = route("GET", "/chat/rooms/:roomId");
    expect(roomMembers).toMatchObject({ id: "chat.room.members.list", resultFields: ["displayName", "roleLabel"] });
    const transferAdmin = route("POST", "/chat/rooms/:roomId/transfer-admin");
    expect(transferAdmin).toMatchObject({ id: "chat.room.transfer-admin", confirmation: true, resultFields: ["roomName", "newAdminName", "transferred"] });
    expect(transferAdmin.fields.find(field => field.apiKey === "newAdminId")).toMatchObject({ reference: "chat.room.members.list", referenceParentKey: "path_roomId", referenceValueKey: "id" });
    const changeMemberRole = route("POST", "/chat/rooms/:roomId/members/:userId/role");
    expect(changeMemberRole).toMatchObject({ id: "chat.room.member.role.update", confirmation: true, resultFields: ["roomName", "memberName", "roleLabel", "updated"] });
    expect(changeMemberRole.fields.find(field => field.apiKey === "userId")).toMatchObject({ reference: "chat.room.members.list", referenceParentKey: "path_roomId", referenceValueKey: "id" });
    expect(changeMemberRole.fields.find(field => field.apiKey === "role")?.options).toEqual(["admin", "deputy", "member"]);
    const removeMember = route("DELETE", "/chat/rooms/:roomId/members/:userId");
    expect(removeMember).toMatchObject({ id: "chat.room.member.remove", confirmation: true, resultFields: ["roomName", "removed"] });
    expect(removeMember.fields.find(field => field.apiKey === "userId")).toMatchObject({ reference: "chat.room.members.list", referenceParentKey: "path_roomId", referenceValueKey: "id" });
    expect(route("GET", "/chat/rooms/:roomId/messages")).toMatchObject({ id: "chat.room.messages.list", resultFields: expect.arrayContaining(["senderName", "content", "createdAt"]) });
    expect(operation("finance.voucher.create").fields.find(field => field.key === "payableId")).toMatchObject({ reference: "finance.debt.list", requiredWhen: { field: "category", equals: "supplier" } });
    expect(operation("finance.tax.create").fields.find(field => field.key === "sourceOrderId")).toMatchObject({ reference: "retail.order.list", referenceValueKey: "id" });
    const settlement = operation("worker.partner.settlement.calculate");
    expect(settlement.fields.find(field => field.key === "partnerId")).toMatchObject({ reference: "worker.partner.list", referenceValueKey: "id" });
    expect(settlement.fields.find(field => field.key === "manualEntries")?.structure?.items?.keys?.referralId).toMatchObject({ reference: "worker.partner.referrals.list", referenceValueKey: "id", referenceParentKey: "partnerId" });
    const sheetUpdate = operation("marketing.campaign.sheet.cells.update");
    expect(sheetUpdate.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "marketing.campaign.list" });
    expect(sheetUpdate.fields.find(field => field.key === "rows")?.structure?.items?.keys?.slotId).toMatchObject({ reference: "marketing.campaign.sheet.slots.list", referenceValueKey: "id", referenceParentKey: "path_id" });
    expect(operation("marketing.campaign.sheet.slots.list").resultFields).toEqual(expect.arrayContaining(["name", "scheduledAt", "platform", "status"]));
  });

  it("offers name-selectable class, roadmap and exam relationships, including scoped exam grading", () => {
    const byId = (id: string) => ASSISTANT_OPERATIONS.find(operation => operation.id === id)!;
    const batchCreate = byId("student.batch.create");
    const batchUpdate = byId("student.batch.update");
    const batchDetail = byId("student.batch.detail");
    const roadmapSteps = byId("student.learning-roadmap.steps.list");
    const roadmapCreate = byId("student.learning-roadmap.create");
    const examCreate = byId("student.exam.create");
    const examUpdate = byId("student.exam.update");
    const gradeRoster = byId("student.exam.grade-roster.list");
    const assignedStudents = byId("student.exam.assigned-students.list");
    const eligibleStudents = byId("student.exam.eligible-students.list");
    const assignStudents = byId("student.exam.assign");
    const gradeResults = byId("student.exam.grade-results.update");
    const studentResult = byId("student.exam.result.update");
    const unassignStudent = byId("student.exam.unassign");
    expect(batchCreate.fields.find(field => field.key === "courseId")).toMatchObject({ reference: "course.list", referenceValueKey: "id", required: true });
    expect(batchCreate.fields.find(field => field.key === "instructorId")).toMatchObject({ reference: "employee.list", referenceValueKey: "id", required: false });
    expect(batchCreate.fields.find(field => field.key === "roadmapId")).toMatchObject({ reference: "student.learning-roadmap.list", referenceValueKey: "id" });
    expect(batchCreate.fields.find(field => field.key === "roadmapStepId")).toMatchObject({ reference: roadmapSteps.id, referenceParentKey: "roadmapId", referenceValueKey: "stepId" });
    expect(batchUpdate.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "batch.list" });
    expect(batchUpdate.description).toContain("Tên và mã lớp không thể đổi sau khi tạo");
    expect(batchDetail).toMatchObject({ method: "GET", path: "/batches/:id", title: "Xem thông tin lớp học" });
    expect(batchDetail.fields.find(field => field.key === "path_id")).toMatchObject({ label: "Tên hoặc mã lớp", reference: "batch.list", referenceValueKey: "id" });
    expect(batchUpdate.fields.find(field => field.key === "courseId")).toMatchObject({ reference: "course.list", referenceValueKey: "id" });
    expect(roadmapSteps).toMatchObject({ method: "GET", path: "/learning-roadmaps/:id/steps", resultFields: expect.arrayContaining(["name", "courseTitle", "order"]) });
    expect(roadmapCreate.fields.find(field => field.key === "steps")?.structure?.items?.keys?.courseId).toMatchObject({ reference: "course.list", referenceValueKey: "id" });
    expect(examCreate.fields.find(field => field.key === "batchId")).toMatchObject({ reference: "batch.list", referenceValueKey: "id", required: true });
    expect(examUpdate.fields.find(field => field.key === "batchId")).toMatchObject({ reference: "batch.list", referenceValueKey: "id" });
    expect(gradeRoster).toMatchObject({ method: "GET", path: "/exams/:id/grade-roster", permissionGroups: [["people:read"]], resultFields: ["name", "phone", "score", "outcome"] });
    expect(gradeRoster.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "student.exam.list" });
    expect(assignedStudents).toMatchObject({ method: "GET", path: "/exams/:id/assigned-students", permissionGroups: [["people:read"]], resultFields: ["name", "phone"] });
    expect(assignedStudents.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "student.exam.list" });
    expect(eligibleStudents).toMatchObject({ method: "GET", path: "/exams/:id/eligible-students", permissionGroups: [["people:read"]], resultFields: ["name", "phone"] });
    expect(eligibleStudents.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "student.exam.list" });
    expect(assignStudents).toMatchObject({ method: "POST", path: "/exams/:id/assign", confirmation: true, permissionGroups: [["people:manage"]], resultFields: ["examName", "assignedCount"] });
    expect(assignStudents.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "student.exam.list" });
    expect(assignStudents.fields.find(field => field.key === "studentIds")?.structure?.items).toMatchObject({
      reference: eligibleStudents.id, referenceParentKey: "path_id", referenceValueKey: "id",
    });
    expect(unassignStudent).toMatchObject({ method: "POST", path: "/exams/:id/unassign", confirmation: true, permissionGroups: [["people:manage"]] });
    expect(unassignStudent.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "student.exam.list" });
    expect(unassignStudent.fields.find(field => field.key === "studentId")).toMatchObject({
      reference: assignedStudents.id, referenceParentKey: "path_id", referenceValueKey: "id",
    });
    expect(gradeResults).toMatchObject({ method: "PATCH", path: "/exams/:id/results", confirmation: true, permissionGroups: [["people:manage"]] });
    expect(gradeResults.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "student.exam.list" });
    expect(gradeResults.fields.find(field => field.key === "results")?.structure?.items?.keys?.studentId).toMatchObject({
      reference: gradeRoster.id, referenceParentKey: "path_id", referenceValueKey: "id",
    });
    expect(gradeResults.fields.find(field => field.key === "results")?.structure).toMatchObject({ minItems: 1, maxItems: 100 });
    expect(studentResult).toMatchObject({ method: "POST", path: "/exams/:id/students/:studentId/result", confirmation: true, permissionGroups: [["people:manage"]] });
    expect(studentResult.fields.find(field => field.key === "path_studentId")).toMatchObject({
      reference: gradeRoster.id, referenceParentKey: "path_id", referenceValueKey: "id",
    });
    expect(coverage.entries.find(entry => `${entry.method} ${entry.path}` === "POST /exams/:id/assign")?.status).toBe("contract");
    expect(coverage.entries.find(entry => `${entry.method} ${entry.path}` === "POST /exams/:id/import-results")).toMatchObject({
      status: "unsupported",
      reason: expect.stringContaining("có thể tự gán người chưa thuộc roster kỳ thi"),
    });
    expect(ASSISTANT_OPERATIONS.some(operation => operation.method === "POST" && operation.path === "/exams/:id/import-results")).toBe(false);
  });

  it("keeps every declared create and update relationship selectable by name and without defaults", () => {
    const operationsById = new Map(ASSISTANT_OPERATIONS.map(operation => [operation.id, operation]));
    const checkShape = (operation: typeof ASSISTANT_OPERATIONS[number], key: string, shape: any) => {
      if (shape.reference) {
        const referenceOperation = operationsById.get(shape.reference);
        expect(referenceOperation, `${operation.id}.${key} must reference an available operation`).toBeDefined();
        expect(referenceOperation?.method === "GET" || referenceOperation?.readOnly === true, `${operation.id}.${key} must offer a readable selection list`).toBe(true);
        expect(referenceOperation?.resultFields.length, `${operation.id}.${key} must expose approved choice labels`).toBeGreaterThan(0);
        expect(shape.defaultValue, `${operation.id}.${key} must never choose a relationship implicitly`).toBeUndefined();
      }
      for (const [nestedKey, nestedShape] of Object.entries(shape.structure?.keys || {})) {
        checkShape(operation, `${key}.${nestedKey}`, nestedShape);
      }
      if (shape.structure?.items) checkShape(operation, `${key}[]`, shape.structure.items);
    };

    for (const operation of ASSISTANT_OPERATIONS.filter(item => ["POST", "PATCH", "PUT"].includes(item.method))) {
      const workflow = defaultWorkflow(operation);
      for (const field of operation.fields) {
        checkShape(operation, field.key, field);
        if (field.reference) {
          expect(workflow.fields.find(candidate => candidate.key === field.key)?.defaultValue, `${operation.id}.${field.key} workflow default`).toBeUndefined();
        }
      }
    }
  });

  it("requires user supplied body relationship IDs to use selectable references", () => {
    // These are tax identifiers or POS session/device context that the executor
    // resolves from the active device; none represents a user-chosen record link.
    const nonRelationshipIdentifiers = new Set([
      "POST /customers/:id/billing-profiles.taxId",
      "POST /finance/management/tax.taxId",
      "POST /finance/reporting/vat/invoices.taxId",
      "POST /retail/orders/checkout.posSessionId",
      "POST /retail/orders/checkout.terminalId",
      "POST /retail/orders/:id/confirm.posSessionId",
      "POST /retail/orders/:id/confirm.terminalId",
      "POST /retail/orders/:id/payments.cashSessionId",
      "POST /retail/orders/:id/payments.terminalId",
      "POST /retail/orders/:id/cancel.cashSessionId",
      "POST /retail/orders/:id/cancel.terminalId",
    ]);
    const foundExceptions = new Set<string>();
    const visit = (operation: typeof ASSISTANT_OPERATIONS[number], shape: any, key: string, source: string) => {
      const apiKey = String(shape.apiKey || key);
      if (source === "body" && /(?:Id|Uid)$/.test(apiKey) && !shape.reference) {
        const exception = `${operation.method} ${operation.path}.${apiKey}`;
        expect(nonRelationshipIdentifiers.has(exception), `${operation.id}.${key} must offer a name-selectable relation`).toBe(true);
        foundExceptions.add(exception);
      }
      for (const [childKey, childShape] of Object.entries(shape.structure?.keys || {})) {
        visit(operation, childShape, childKey, source);
      }
      if (shape.structure?.items) visit(operation, shape.structure.items, `${key}[]`, source);
    };

    for (const operation of ASSISTANT_OPERATIONS.filter(item => ["POST", "PATCH", "PUT"].includes(item.method))) {
      for (const field of operation.fields) visit(operation, field, field.apiKey || field.key, field.source);
    }
    expect(foundExceptions).toEqual(nonRelationshipIdentifiers);
  });

  it("requires confirmation for every create operation produced by the shared CRUD catalog", () => {
    for (const id of ["employee.create", "department.create", "project.create", "task.create", "customer.create", "category.create", "training.create"]) {
      const operation = ASSISTANT_OPERATIONS.find(item => item.id === id)!;
      expect(operation.method).toBe("POST");
      expect(operation.confirmation).toBe(true);
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
    }
  });

  it("keeps generated coverage aligned with manually curated route adapters", () => {
    const reportedManual = coverage.entries.filter(entry => entry.status === "manual");
    expect(coverage.connectedManualRoutes).toBe(manualRouteCoverage.length);
    expect(coverage.connectedRoutes).toBe(coverage.entries.filter(entry => entry.status === "contract" || entry.status === "manual").length);
    expect(reportedManual).toHaveLength(manualRouteCoverage.length);
    for (const route of manualRouteCoverage) {
      const operation = ASSISTANT_OPERATIONS.find(item => item.id === route.operationId);
      expect(operation).toMatchObject({ method: route.method, path: route.path });
      expect(reportedManual).toContainEqual(expect.objectContaining({ method: route.method, path: route.path, id: route.operationId }));
    }
  });

  it("expands loop-generated routes and keeps privileged or financial mutations unavailable", () => {
    expect(inventory.unresolved).toEqual([]);
    const routeKeys = new Set(inventory.endpoints.map(route => route.method + " " + route.path));
    for (const key of [
      "GET /marketing-contents",
      "POST /social-integrations",
      "DELETE /omni-inbox/leads/:id",
      "POST /super-admin/users/:userId/lock",
      "POST /super-admin/users/:userId/impersonation/stop",
      "POST /repair/tickets/:id/refunds",
      "POST /repair/tickets/:id/refunds/reconcile",
      "POST /repair/tickets/:id/refunds/revoke",
    ]) expect(routeKeys.has(key), key).toBe(true);

    const refund = inventory.endpoints.find(route => route.method === "POST" && route.path === "/repair/tickets/:id/refunds")!;
    expect(refund.permissions).toEqual([["repair:manage"], ["finance-wallet:manage"]]);
    for (const key of [
      "POST /social-integrations",
      "DELETE /omni-inbox/leads/:id",
      "POST /super-admin/users/:userId/lock",
      "POST /repair/tickets/:id/refunds/reconcile",
      "POST /repair/tickets/:id/refunds/revoke",
    ]) {
      const [method, path] = key.split(" ", 2);
      expect(coverage.entries.find(route => route.method === method && route.path === path)?.status, key).toBe("unsupported");
      expect(ASSISTANT_OPERATIONS.some(operation => operation.method === method && operation.path === path), key).toBe(false);
    }
    expect(coverage.entries.find(route => route.method === "POST" && route.path === "/repair/tickets/:id/refunds"))
      .toMatchObject({ status: "manual", id: "repair.refund.create" });
    expect(ASSISTANT_OPERATIONS.some(operation => operation.id === "repair.refund.create")).toBe(true);
  });

  it("supports safe CRM lead lookup and confirmed create/update by visible name", () => {
    const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "omni-inbox.leads.list")!;
    const detail = ASSISTANT_OPERATIONS.find(operation => operation.id === "omni-inbox.leads.detail")!;
    const create = ASSISTANT_OPERATIONS.find(operation => operation.id === "omni-inbox.leads.create")!;
    const update = ASSISTANT_OPERATIONS.find(operation => operation.id === "omni-inbox.leads.update")!;
    expect(list).toMatchObject({
      method: "GET", path: "/omni-inbox/leads", module: "omni-inbox",
      permissionGroups: [["omni-inbox:read"]], confirmation: false,
    });
    expect(list.fields.map(field => field.apiKey)).toEqual(["search", "status", "page", "limit"]);
    expect(list.fields.find(field => field.apiKey === "limit")).toMatchObject({ defaultValue: 50, min: 1, max: 100 });
    expect(list.resultFields).toEqual(["customerName", "company", "phone", "email", "value", "productOfChoice", "status", "lastInteraction"]);
    expect(detail).toMatchObject({ method: "GET", path: "/omni-inbox/leads/:id", permissionGroups: [["omni-inbox:read"]], confirmation: false });
    expect(detail.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id, label: "Tên hoặc số điện thoại khách tiềm năng" });
    expect(detail.resultFields).toEqual(list.resultFields);
    expect(detail.description).toMatch(/không hiển thị ảnh đại diện, sản phẩm chi tiết/i);
    expect(create).toMatchObject({ method: "POST", path: "/omni-inbox/leads", permissionGroups: [["omni-inbox:manage"]], confirmation: true });
    expect(create.fields.find(field => field.key === "customerName")).toMatchObject({ required: true });
    expect(create.fields.find(field => field.key === "value")).toMatchObject({ defaultValue: 0 });
    expect(create.fields.find(field => field.key === "status")).toMatchObject({ defaultValue: "cold", options: ["cold", "warm", "hot", "won", "upsell"] });
    expect(update).toMatchObject({ method: "PATCH", path: "/omni-inbox/leads/:id", permissionGroups: [["omni-inbox:manage"]], confirmation: true });
    expect(update.fields.find(field => field.key === "id")).toMatchObject({ reference: list.id });
    expect(update.fields.filter(field => field.source === "body").every(field => !field.required)).toBe(true);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    for (const route of [
      { method: "GET", path: list.path, id: list.id },
      { method: "GET", path: detail.path, id: detail.id },
      { method: "POST", path: create.path, id: create.id },
      { method: "PATCH", path: update.path, id: update.id },
    ]) expect(coverage.entries.find(entry => entry.method === route.method && entry.path === route.path)).toMatchObject({ status: route.id === detail.id ? "contract" : "manual", id: route.id });
      expect(coverage.entries.find(entry => entry.method === "DELETE" && entry.path === "/omni-inbox/leads/:id"))
      .toMatchObject({ status: "unsupported", reason: expect.stringContaining("xóa cứng") });
  });

  it("keeps payroll reads with implicit writes and full salary lines unavailable to chat", () => {
    const route = coverage.entries.find(entry => entry.method === "GET" && entry.path === "/payroll/periods/:periodKey/run");
    expect(ASSISTANT_OPERATIONS.some(operation => operation.method === "GET" && operation.path === "/payroll/periods/:periodKey/run")).toBe(false);
    expect(route).toMatchObject({
      status: "unsupported",
      reason: "API đọc này có thể tự sửa snapshot bảng lương khi phát hiện lệch checksum và trả cả dòng lương chi tiết; chưa an toàn để gọi từ chat.",
    });
  });

  it("allows bounded company-knowledge simulations and keeps persistent turns unavailable", () => {
    const search = ASSISTANT_OPERATIONS.find(operation => operation.id === "company-knowledge.test-search")!;
    expect(search).toMatchObject({
      method: "POST", path: "/company-knowledge/test-search", module: "company-knowledge",
      permissions: ["company-knowledge:read"], confirmation: true,
    });
    expect(search.fields.find(field => field.apiKey === "query")).toMatchObject({ required: true, max: 500 });
    expect(search.fields.find(field => field.apiKey === "channel")?.options).toEqual(["facebook", "zalo", "tiktok"]);
    expect(search.resultFields).toEqual(["simulatedAnswer", "matches", "bestScore", "items"]);
    expect(defaultWorkflow(search).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === search.path && entry.method === search.method)).toMatchObject({ status: "contract", id: search.id });

    const simulation = ASSISTANT_OPERATIONS.find(operation => operation.id === "company-knowledge.page-chat.simulate")!;
    expect(simulation).toMatchObject({
      method: "POST", path: "/company-knowledge/simulate-page-chat", module: "company-knowledge",
      permissions: ["company-knowledge:manage"], confirmation: true, fixedBodyValues: { history: [] },
    });
    expect(simulation.fields.map(field => field.apiKey)).toEqual(["message"]);
    expect(defaultWorkflow(simulation).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === simulation.path && entry.method === simulation.method)).toMatchObject({ status: "contract", id: simulation.id });

    expect(coverage.entries.find(entry => entry.path === "/company-knowledge/simulate-page-chat-real" && entry.method === "POST"))
      .toMatchObject({ status: "unsupported", reason: expect.stringContaining("phiên mô phỏng bền vững") });

    const clearAll = ASSISTANT_OPERATIONS.find(operation => operation.id === "company-knowledge.clear-all")!;
    expect(clearAll).toMatchObject({
      method: "POST", path: "/gemini/clear-knowledge", permissions: ["company-knowledge:manage"], confirmation: true,
    });
    expect(clearAll.description).toContain("đề xuất FAQ");
    expect(defaultWorkflow(clearAll).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === clearAll.path && entry.method === clearAll.method)).toMatchObject({ status: "contract", id: clearAll.id });
    expect(coverage.entries.find(entry => entry.path === "/company-knowledge/clear-all" && entry.method === "POST"))
      .toMatchObject({ status: "unsupported", reason: expect.stringContaining("POST /gemini/clear-knowledge") });
    expect(coverage.entries.find(entry => entry.path === "/company-knowledge/health" && entry.method === "GET"))
      .toMatchObject({ status: "unsupported", reason: expect.stringContaining("GET /gemini/knowledge-health") });
  });

  it("creates bounded AI campaign plans and keeps dynamic or generic chat routes unavailable", () => {
    const campaign = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.ai.scheduled-campaign")!;
    expect(campaign).toMatchObject({
      method: "POST", path: "/gemini/scheduled-campaign", module: "social-marketing", permissions: ["marketing:manage"], confirmation: true,
    });
    expect(campaign.fields.find(field => field.apiKey === "prompt")).toMatchObject({ required: true, max: 2000 });
    expect(campaign.fields.find(field => field.apiKey === "postsPerDay")).toMatchObject({ min: 1, max: 3, integer: true });
    expect(campaign.fields.find(field => field.apiKey === "postingTimes")?.structure).toMatchObject({ minItems: 1, maxItems: 3 });
    expect(campaign.fields.find(field => field.apiKey === "channels")?.structure?.items?.options).toEqual(["Facebook", "TikTok"]);
    expect(campaign.description).toContain("30 ngày");
    expect(campaign.description).toContain("không lưu");
    expect(defaultWorkflow(campaign).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === campaign.path && entry.method === campaign.method)).toMatchObject({ status: "contract", id: campaign.id });
    expect(coverage.entries.find(entry => entry.path === "/gemini/marketing-pillars/swap" && entry.method === "POST"))
      .toMatchObject({ status: "unsupported", reason: expect.stringContaining("cấu trúc động") });
    expect(coverage.entries.find(entry => entry.path === "/gemini/chat" && entry.method === "POST"))
      .toMatchObject({ status: "unsupported", reason: expect.stringContaining("payload chat tổng quát") });

    const facebookConfig = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.facebook-app-config.read")!;
    expect(facebookConfig).toMatchObject({
      method: "GET", path: "/facebook/config", module: "social-marketing", modules: ["social-marketing", "omni-inbox"],
      permissions: ["social-integration:read"], confirmation: false, resultFields: ["appId", "source"],
    });
    expect(facebookConfig.description).toContain("App Secret/token");
    expect(coverage.entries.find(entry => entry.path === facebookConfig.path && entry.method === facebookConfig.method)).toMatchObject({ status: "contract", id: facebookConfig.id });
  });

  it("lists company-scoped AI reply feedback safely and requires confirmation to update it", () => {
    const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "omni-inbox.ai-reply-logs.list")!;
    const update = ASSISTANT_OPERATIONS.find(operation => operation.id === "omni-inbox.ai-reply-log.feedback.update")!;
    expect(list).toMatchObject({ method: "GET", path: "/gemini/ai-reply-logs", module: "omni-inbox", permissions: ["omni-inbox:read"], confirmation: false });
    expect(list.resultFields).toEqual(["channel", "status", "feedback", "createdAt"]);
    expect(list.description).toContain("không được đưa vào chat");
    expect(update).toMatchObject({ method: "PATCH", path: "/gemini/ai-reply-logs/:id/feedback", module: "omni-inbox", permissions: ["omni-inbox:manage"], confirmation: true });
    expect(update.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id });
    expect(update.fields.find(field => field.apiKey === "feedback")?.options).toEqual(["good", "bad", "needs_fix"]);
    expect(update.fields.find(field => field.apiKey === "note")).toMatchObject({ max: 2000 });
    expect(update.resultFields).toEqual(["feedback", "channel", "status", "createdAt"]);
    expect(JSON.stringify([...list.resultFields, ...update.resultFields])).not.toMatch(/message|context|note|customer/i);
    expect(coverage.entries.filter(entry => entry.path.includes("/gemini/ai-reply-logs"))).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "GET", status: "contract", id: list.id }),
      expect.objectContaining({ method: "PATCH", status: "contract", id: update.id }),
    ]));
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);

    const testReply = ASSISTANT_OPERATIONS.find(operation => operation.id === "omni-inbox.ai-reply.test")!;
    expect(testReply).toMatchObject({
      method: "POST", path: "/gemini/test-reply", module: "omni-inbox", permissions: ["omni-inbox:manage"], confirmation: true,
    });
    expect(testReply.fields.map(field => field.apiKey)).toEqual(["message", "channel"]);
    expect(testReply.fields.find(field => field.apiKey === "message")).toMatchObject({ required: true, max: 3000 });
    expect(testReply.fields.find(field => field.apiKey === "channel")?.options).toEqual(["facebook", "zalo", "tiktok"]);
    expect(testReply.resultFields).toEqual(["text", "mode", "contextMatches", "dryRun"]);
    expect(testReply.description).toContain("trừ phí AI từ ví");
    expect(testReply.description).toContain("lưu một log xem trước");
    expect(defaultWorkflow(testReply).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === testReply.path && entry.method === testReply.method)).toMatchObject({ status: "contract", id: testReply.id });
    expect(coverage.entries.find(entry => entry.method === "PATCH" && entry.path === "/omni-inbox/ai-reply-logs/:id"))
      .toMatchObject({ status: "unsupported", reason: expect.stringContaining("/gemini/ai-reply-logs/:id/feedback") });
  });

  it("lists only safe Facebook inbox conversation metadata under inbox read permission", () => {
    const conversations = ASSISTANT_OPERATIONS.find(operation => operation.id === "omni-inbox.facebook-conversations.list")!;
    expect(conversations).toMatchObject({ method: "GET", path: "/facebook/messenger/conversations", module: "omni-inbox", permissions: ["omni-inbox:read"], confirmation: false });
    expect(conversations.fields.find(field => field.apiKey === "limit")).toMatchObject({ defaultValue: 20, min: 1, max: 100 });
    expect(conversations.resultFields).toEqual(["channel", "senderName", "lastMessageAt", "unreadCount", "status", "isVip"]);
    expect(conversations.description).toContain("nội dung tin nhắn");
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === conversations.path)).toMatchObject({ status: "contract", id: conversations.id });
    for (const [id, path] of [["omni-inbox.zalo-conversations.list", "/zalo/conversations"], ["omni-inbox.tiktok-conversations.list", "/tiktok/messenger/conversations"]]) {
      const operation = ASSISTANT_OPERATIONS.find(item => item.id === id)!;
      expect(operation).toMatchObject({ method: "GET", path, module: "omni-inbox", permissions: ["omni-inbox:read"], resultFields: conversations.resultFields });
      expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === path)).toMatchObject({ status: "contract", id });
    }
  });

  it("supports named inbox read-state, AI-resume, and reply workflows with manage permission and confirmation", () => {
    const cases = [
      { mark: "omni-inbox.facebook-conversation.mark-read", resume: "omni-inbox.facebook-conversation.resume-ai", reply: "omni-inbox.facebook-conversation.reply", path: "/facebook/messenger/conversations/:recipientId/mark-read", replyPath: "/facebook/messenger/reply", detailsPath: "/facebook/messenger/conversations/:recipientId/messages", list: "omni-inbox.facebook-conversations.list", accountApiKey: "pageId", accountPlatform: "Facebook" },
      { mark: "omni-inbox.zalo-conversation.mark-read", resume: "omni-inbox.zalo-conversation.resume-ai", reply: "omni-inbox.zalo-conversation.reply", path: "/zalo/conversations/:recipientId/mark-read", replyPath: "/zalo/reply", detailsPath: "/zalo/conversations/:recipientId/messages", list: "omni-inbox.zalo-conversations.list", accountApiKey: "accountId", accountPlatform: "Zalo" },
      { mark: "omni-inbox.tiktok-conversation.mark-read", resume: "omni-inbox.tiktok-conversation.resume-ai", reply: "omni-inbox.tiktok-conversation.reply", path: "/tiktok/messenger/conversations/:conversationId/mark-read", replyPath: "/tiktok/messenger/reply", detailsPath: "/tiktok/messenger/conversations/:conversationId/messages", list: "omni-inbox.tiktok-conversations.list", accountApiKey: "accountId", accountPlatform: "TikTok" },
    ];
    for (const item of cases) {
      const list = ASSISTANT_OPERATIONS.find(operation => operation.id === item.list)!;
      expect(list.fields.find(field => field.apiKey === item.accountApiKey)).toMatchObject({ reference: "omni-inbox.account.list", referenceValueKey: "pageId" });
      for (const id of [item.mark, item.resume, item.reply]) {
        const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === id)!;
        expect(operation).toMatchObject({ module: "omni-inbox", permissions: ["omni-inbox:manage"], confirmation: true, resultFields: ["message"] });
        expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
        expect(coverage.entries.find(entry => entry.method === operation.method && entry.path === operation.path)).toMatchObject({ status: "contract", id });
      }
      const mark = ASSISTANT_OPERATIONS.find(operation => operation.id === item.mark)!;
      const conversationField = mark.fields.find(field => field.source === "path")!;
      const accountField = mark.fields.find(field => field.source === "query" && field.apiKey === item.accountApiKey)!;
      expect(conversationField).toMatchObject({ reference: item.list, referenceParentKey: accountField.key });
      expect(accountField.referenceContext).toEqual({ platform: item.accountPlatform });
      const reply = ASSISTANT_OPERATIONS.find(operation => operation.id === item.reply)!;
      expect(reply.fields.find(field => field.apiKey === "text")).toMatchObject({ required: true, max: 5000 });
      expect(reply.description).toContain("xác nhận");
      expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === item.detailsPath)).toMatchObject({ status: "unsupported", reason: expect.stringContaining("số tin chưa đọc về 0") });
    }
  });

  it("reads only personal image and voice history, excluding side-effectful video history", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.media-history.list")!;
    const deletion = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.media-history.delete")!;
    expect(operation).toMatchObject({ method: "GET", path: "/gemini/media-history", module: "social-marketing", permissions: ["marketing:read"], confirmation: false });
    expect(operation.fields.find(field => field.apiKey === "type")?.options).toEqual(["image", "voice"]);
    expect(operation.resultFields).toEqual(["mediaType", "title", "voiceName", "duration", "createdAt", "url"]);
    expect(operation.description).toContain("Không tra video");
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === operation.path)).toMatchObject({ status: "contract", id: operation.id });
    expect(deletion).toMatchObject({ method: "DELETE", path: "/gemini/media-history/:id", permissions: ["marketing:manage"], confirmation: true, resultFields: ["deleted"] });
    expect(deletion.fields.find(field => field.key === "path_id")?.reference).toBe(operation.id);
    expect(deletion.fields.find(field => field.apiKey === "type")?.options).toEqual(["image", "voice"]);
    expect(deletion.description).toContain("không xóa tệp gốc");
    expect(coverage.entries.find(entry => entry.method === "DELETE" && entry.path === deletion.path)).toMatchObject({ status: "contract", id: deletion.id });
    expect(defaultWorkflow(deletion).confirmationLocked).toBe(true);
  });

  it("lists voices by readable names and requires confirmation for paid speech generation", () => {
    const voices = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voices.list")!;
    const models = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.models.list")!;
    const voiceDetail = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice.detail")!;
    const voiceSettings = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice-settings.read")!;
    const updateVoiceSettings = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice-settings.update")!;
    const deleteVoice = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice.delete")!;
    const generate = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.voice.generate")!;
    const customVoicePreview = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.elevenlabs.custom-voice.preview")!;
    expect(voices).toMatchObject({ method: "GET", path: "/elevenlabs/voices", module: "social-marketing", permissions: ["marketing:read"], confirmation: false, resultFields: ["name", "category"] });
    expect(models).toMatchObject({ method: "GET", path: "/elevenlabs/models", module: "social-marketing", permissions: ["marketing:read"], confirmation: false, resultFields: ["name", "description"] });
    expect(voiceDetail).toMatchObject({ method: "GET", path: "/elevenlabs/voices/:voiceId", permissions: ["marketing:read"], confirmation: false, resultFields: ["name", "category", "description"] });
    expect(voiceDetail.fields.find(field => field.key === "path_voiceId")).toMatchObject({ reference: voices.id, label: expect.stringContaining("Giọng đọc theo tên") });
    expect(voiceSettings).toMatchObject({ method: "GET", path: "/elevenlabs/voices/:voiceId/settings", permissions: ["marketing:read"], confirmation: false, resultFields: ["stability", "similarity_boost", "style", "use_speaker_boost"] });
    expect(voiceSettings.fields.find(field => field.key === "path_voiceId")).toMatchObject({ reference: voices.id, label: expect.stringContaining("Giọng đọc theo tên") });
    expect(updateVoiceSettings).toMatchObject({ method: "POST", path: "/elevenlabs/voices/:voiceId/settings", permissions: ["marketing:manage"], confirmation: true, resultFields: ["stability", "similarity_boost", "style", "use_speaker_boost"] });
    expect(updateVoiceSettings.fields.find(field => field.key === "path_voiceId")).toMatchObject({ reference: voices.id, label: expect.stringContaining("Giọng đọc cần cập nhật theo tên") });
    expect(updateVoiceSettings.fields.find(field => field.apiKey === "stability")).toMatchObject({ min: 0, max: 1, required: false });
    expect(updateVoiceSettings.fields.find(field => field.apiKey === "use_speaker_boost")).toMatchObject({ type: "boolean", required: false });
    expect(deleteVoice).toMatchObject({ method: "DELETE", path: "/elevenlabs/voices/:voiceId", permissions: ["marketing:manage", "marketing:read"], permissionGroups: [["marketing:manage", "marketing:read"]], confirmation: true, resultFields: ["deleted"] });
    expect(deleteVoice.fields.find(field => field.key === "path_voiceId")).toMatchObject({ reference: voices.id, referenceValueKey: "voiceId" });
    expect(deleteVoice.description).toContain("không thể khôi phục");
    expect(generate).toMatchObject({ method: "POST", path: "/elevenlabs/generate-voice", module: "social-marketing", permissions: ["marketing:manage"], confirmation: true });
    expect(generate.fields.find(field => field.apiKey === "textToSpeak")).toMatchObject({ required: true, max: 5000 });
    expect(generate.fields.find(field => field.apiKey === "voiceName")).toMatchObject({ required: true, reference: voices.id, referenceValueKey: "voiceId" });
    expect(generate.fields.find(field => field.apiKey === "modelName")).toMatchObject({ required: false, reference: models.id, referenceValueKey: "modelId" });
    expect(generate.resultFields).toEqual(["characters", "duration", "url"]);
    expect(generate.description).toContain("số dư AI");
    expect(customVoicePreview).toMatchObject({ method: "POST", path: "/elevenlabs/custom-voice-preview", permissions: ["marketing:manage"], confirmation: true, resultFields: ["url"] });
    expect(customVoicePreview.fields.find(field => field.apiKey === "gender")).toMatchObject({ defaultValue: "female", options: ["female", "male"] });
    expect(customVoicePreview.fields.find(field => field.apiKey === "accentStrength")).toMatchObject({ min: 0.3, max: 2, defaultValue: 1 });
    expect(customVoicePreview.description).toContain("không lưu giọng");
    expect(coverage.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "GET", path: voices.path, status: "contract", id: voices.id }),
      expect.objectContaining({ method: "GET", path: models.path, status: "contract", id: models.id }),
      expect.objectContaining({ method: "GET", path: voiceDetail.path, status: "contract", id: voiceDetail.id }),
      expect.objectContaining({ method: "GET", path: voiceSettings.path, status: "contract", id: voiceSettings.id }),
      expect.objectContaining({ method: "POST", path: updateVoiceSettings.path, status: "contract", id: updateVoiceSettings.id }),
      expect.objectContaining({ method: "DELETE", path: deleteVoice.path, status: "contract", id: deleteVoice.id }),
      expect.objectContaining({ method: "POST", path: generate.path, status: "contract", id: generate.id }),
      expect.objectContaining({ method: "POST", path: customVoicePreview.path, status: "contract", id: customVoicePreview.id }),
    ]));
    expect(defaultWorkflow(generate).confirmationLocked).toBe(true);
    expect(defaultWorkflow(deleteVoice).confirmationLocked).toBe(true);
    expect(defaultWorkflow(customVoicePreview).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/elevenlabs/history")).toMatchObject({ status: "unsupported", reason: expect.stringContaining("trùng chức năng") });
    expect(coverage.entries.find(entry => entry.method === "DELETE" && entry.path === "/elevenlabs/history/:id")).toMatchObject({ status: "unsupported", reason: expect.stringContaining("trùng chức năng") });
  });

  it("exposes standard field overrides and only updates one selected field while preserving the rest", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.standard-fields.list")!;
    expect(operation).toMatchObject({
      method: "GET",
      path: "/student-management/standard-fields/:moduleKey",
      permissions: ["people:read", "settings:read"],
      permissionGroups: [["people:read", "settings:read"]],
      confirmation: false,
      resultFields: ["key", "label", "placeholder", "isRequired", "isVisible", "isArchived"],
    });
    expect(operation.fields.find(field => field.key === "path_moduleKey")).toMatchObject({
      label: "Phân hệ hồ sơ",
      options: ["students", "courses", "batches", "exams", "resources", "partners"],
    });
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === operation.path)).toMatchObject({ status: "contract", id: operation.id });
    const update = ASSISTANT_OPERATIONS.find(item => item.id === "student.standard-fields.update")!;
    expect(update).toMatchObject({ method: "PUT", path: "/student-management/standard-fields/:moduleKey", permissions: ["settings:manage"], permissionGroups: [["settings:manage"], ["settings:read"]], confirmation: true });
    expect(update.fields.find(field => field.apiKey === "moduleKey")?.options).toEqual(operation.fields.find(field => field.apiKey === "moduleKey")?.options);
    expect(update.fields.find(field => field.apiKey === "selectedField")).toMatchObject({ source: "body", reference: operation.id, referenceParentKey: "path_moduleKey", referenceValueKey: "key" });
    expect(update.resultFields).toEqual(["label", "placeholder", "isRequired", "isVisible", "isArchived"]);
    expect(update.description).toContain("giữ nguyên mọi trường khác");
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "PUT" && entry.path === operation.path)).toMatchObject({ status: "contract", id: update.id });
  });

  it("exposes safe read and named update workflows for worker profile fields", () => {
    const list = ASSISTANT_OPERATIONS.find(item => item.id === "worker.standard-fields.list")!;
    expect(list).toMatchObject({
      method: "GET", path: "/worker-management/standard-fields", module: "worker",
      permissions: ["people:read"], confirmation: false,
      resultFields: ["label", "isRequired", "isVisible", "isArchived"],
    });
    expect(list.fields.find(field => field.apiKey === "moduleKey")).toMatchObject({ required: true, defaultValue: "students", options: ["students"] });

    const update = ASSISTANT_OPERATIONS.find(item => item.id === "worker.standard-fields.update")!;
    expect(update).toMatchObject({
      method: "PUT", path: "/worker-management/standard-fields", module: "worker",
      permissions: ["people:manage"], permissionGroups: [["people:manage"], ["people:read"]],
      fixedBodyValues: { moduleKey: "students" }, confirmation: true,
      resultFields: ["label", "isRequired", "isVisible", "isArchived"],
    });
    expect(update.fields.find(field => field.apiKey === "selectedField")).toMatchObject({ source: "body", reference: list.id, referenceValueKey: "key" });
    expect(update.description).toContain("giữ nguyên mọi trường/cấu hình khác");
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(coverage.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "GET", path: list.path, status: "contract", id: list.id }),
      expect.objectContaining({ method: "PUT", path: update.path, status: "contract", id: update.id }),
    ]));
  });

  it("reverses a worker partner payout only through its parent settlement and confirmation", () => {
    const detail = ASSISTANT_OPERATIONS.find(item => item.id === "worker.partner.settlement.detail")!;
    const reverse = ASSISTANT_OPERATIONS.find(item => item.id === "worker.partner.payout.reverse")!;
    expect(reverse).toMatchObject({
      method: "POST", path: "/worker-management/partners/payouts/:payoutId/reverse",
      permissions: ["labor-partner-payout:manage"],
      permissionGroups: [["labor-partner-payout:manage"], ["labor-partner:read"]],
      confirmation: true,
      resultFields: ["amount", "paidAt", "method", "settlementStatus", "balanceAmount"],
    });
    expect(reverse.fields.find(field => field.key === "selectedSettlement")).toMatchObject({
      source: "body", apiKey: "settlementId", reference: "worker.partner.settlements.list", referenceValueKey: "id",
    });
    expect(reverse.fields.find(field => field.key === "path_payoutId")).toMatchObject({
      reference: detail.id, referenceParentKey: "selectedSettlement", referenceValueKey: "payoutId",
    });
    expect(reverse.description).toContain("không chuyển tiền");
    expect(defaultWorkflow(reverse).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === reverse.path)).toMatchObject({ status: "contract", id: reverse.id });
  });

  it("exposes the current tenant's saved student-management entity preset as a read-only workflow", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.module-settings.get")!;
    expect(operation).toMatchObject({
      method: "GET",
      path: "/student-management/settings",
      permissions: ["people:read"],
      permissionGroups: [["people:read"], ["settings:read"]],
      confirmation: false,
      fields: [],
      resultFields: ["entityPreset"],
    });
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === operation.path)).toMatchObject({ status: "contract", id: operation.id });
  });

  it("exposes a company-scoped colleague directory only through chat read permission", () => {
    const colleagues = ASSISTANT_OPERATIONS.find(op => op.id === "account.colleagues.list")!;
    expect(colleagues).toMatchObject({ method: "GET", path: "/auth/users/colleagues", module: "chat", permissions: ["chat:read"], confirmation: false });
    expect(colleagues.resultFields).toEqual(["displayName", "email", "department", "jobTitle", "qualification", "branchName", "isActive"]);
    expect(colleagues.fields).toEqual([]);
  });

  it("creates disabled email campaign drafts without accepting audience or activation overrides", () => {
    const campaign = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.holiday-campaign.create-draft")!;
    expect(campaign).toMatchObject({ method: "POST", path: "/marketing/campaigns", permissions: ["marketing:manage"], confirmation: true, fixedBodyValues: { enabled: false, channels: ["email"], targetTierCodes: [] } });
    expect(campaign.fields.map(field => field.apiKey)).toEqual(["name", "runDate", "subject", "html"]);
    expect(campaign.resultFields).toEqual(["name", "runDate", "enabled", "channels", "subject"]);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/marketing/campaigns")).toMatchObject({ status: "contract", id: campaign.id });
    expect(defaultWorkflow(campaign).confirmationLocked).toBe(true);
  });

  it("exposes text-only AI marketing generation with explicit credit-use confirmation", () => {
    const pillars = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.ai.content-pillars")!;
    const ideas = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.ai.campaign-ideas")!;
    const draftPosts = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.ai.draft-posts")!;
    const topicSuggestions = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.ai.topic-suggestions")!;
    const optimizeScript = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.ai.optimize-script")!;
    const optimizeImagePrompt = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.ai.optimize-image-prompt")!;
    const generateImage = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.ai.image.generate")!;
    expect(pillars).toMatchObject({ method: "POST", path: "/gemini/marketing-pillars", permissions: ["marketing:manage"], confirmation: true });
    expect(pillars.fields.find(field => field.apiKey === "campaignTopic")).toMatchObject({ systemRequired: true, max: 2000 });
    expect(pillars.description).toContain("số dư AI");
    expect(ideas).toMatchObject({ method: "POST", path: "/gemini/marketing-ideas", permissions: ["marketing:manage"], confirmation: true });
    expect(ideas.fields.find(field => field.apiKey === "selectedPillars")?.structure).toMatchObject({ type: "array", minItems: 1, maxItems: 8 });
    expect(ideas.resultFields).toEqual(["campaignTopic", "concepts", "count", "generatedByAi"]);
    expect(ideas.description).toContain("không tự lưu hoặc đăng bài");
    expect(draftPosts).toMatchObject({ method: "POST", path: "/gemini/marketing-develop", permissions: ["marketing:manage"], confirmation: true, fixedBodyValues: { mediaType: "none" } });
    expect(draftPosts.fields.map(field => field.apiKey)).toEqual(["title", "summary", "suggestedContent", "channels"]);
    expect(draftPosts.description).toContain("không lưu và không đăng bài");
    expect(topicSuggestions).toMatchObject({ method: "GET", path: "/gemini/marketing-suggestions", permissions: ["marketing:manage"], confirmation: true, fields: [], resultFields: ["suggestions", "count"] });
    expect(topicSuggestions.description).toContain("kể cả khi trả về gợi ý dự phòng");
    expect(optimizeScript).toMatchObject({ method: "POST", path: "/gemini/optimize-script", permissions: ["marketing:manage"], confirmation: true, resultFields: ["optimizedText"] });
    expect(optimizeScript.fields.map(field => field.apiKey)).toEqual(["text", "readingStyle"]);
    expect(optimizeImagePrompt).toMatchObject({ method: "POST", path: "/gemini/optimize-prompt", permissions: ["marketing:manage"], confirmation: true });
    expect(optimizeImagePrompt.fields.map(field => field.apiKey)).toEqual(["description"]);
    expect(optimizeImagePrompt.resultFields).toEqual(["subject", "optimizedPrompt", "negativePrompt", "generatedByAi"]);
    expect(generateImage).toMatchObject({ method: "POST", path: "/gemini/generate-image", permissions: ["marketing:manage"], confirmation: true, resultFields: ["url", "aspectRatio", "resolution", "modelName"] });
    expect(generateImage.fields.map(field => field.apiKey)).toEqual(["prompt", "aspectRatio", "modelName", "resolution", "negativePrompt"]);
    expect(generateImage.fields.find(field => field.apiKey === "aspectRatio")).toMatchObject({ defaultValue: "3:4", options: ["1:1", "16:9", "9:16", "4:3", "3:4"] });
    expect(generateImage.fields.find(field => field.apiKey === "modelName")).toMatchObject({ defaultValue: "gemini-banana-flash", options: ["gemini-banana-flash", "gemini-banana-pro"] });
    expect(generateImage.fields.find(field => field.apiKey === "resolution")).toMatchObject({ defaultValue: "1K", options: ["1K"] });
    expect(generateImage.description).toContain("trừ đúng 1 lượt AI");
    expect(generateImage.description).toContain("Không nhận ảnh tham chiếu");
    for (const operation of [pillars, ideas, draftPosts, topicSuggestions, optimizeScript, optimizeImagePrompt, generateImage]) {
      expect(coverage.entries.find(entry => entry.method === operation.method && entry.path === operation.path)).toMatchObject({ status: "contract", id: operation.id });
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
    }
  });

  it("limits campaign calendar lookup to a week and omits internal campaign and slot identifiers", () => {
    const calendar = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.calendar")!;
    expect(calendar).toMatchObject({ method: "GET", path: "/marketing-campaigns/calendar", permissions: ["marketing:post"], confirmation: false });
    expect(calendar.fields.map(field => field.apiKey)).toEqual(["startDate", "endDate"]);
    expect(calendar.resultFields).toEqual(["campaignTitle", "campaignType", "scheduledAt", "platform", "status", "mediaType", "topicBrief"]);
    expect(calendar.description).toContain("tối đa 7 ngày");
    expect(calendar.resultFields.some(field => /(^id$|campaignId|slotId|token)/i.test(field))).toBe(false);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === calendar.path)).toMatchObject({ status: "contract", id: calendar.id });
    expect(defaultWorkflow(calendar).confirmationLocked).toBe(false);
  });

  it("exposes campaign analytics only for a named campaign and a bounded date range", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.list")!;
    const analytics = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.analytics.summary")!;
    expect(analytics).toMatchObject({
      method: "GET", path: "/marketing-campaigns/assistant/analytics", permissions: ["marketing:post"], confirmation: false,
      resultFields: ["campaignTitle", "startDate", "endDate", "platform", "overview", "platformMetrics", "byPlatform", "byDate", "qualityScores"],
    });
    expect(analytics.fields.find(field => field.apiKey === "campaignId")).toMatchObject({ reference: list.id, referenceValueKey: "id", required: true });
    expect(analytics.fields.find(field => field.apiKey === "startDate")).toMatchObject({ type: "date", required: true });
    expect(analytics.fields.find(field => field.apiKey === "endDate")).toMatchObject({ type: "date", required: true });
    expect(analytics.description).toContain("tối đa 31 ngày");
    expect(analytics.resultFields.some(field => /posts|error|url|^id$|campaigns/i.test(field))).toBe(false);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === analytics.path)).toMatchObject({ status: "contract", id: analytics.id });
    const legacy = coverage.entries.find(entry => entry.method === "GET" && entry.path === "/marketing-campaigns/analytics");
    expect(legacy).toMatchObject({ status: "unsupported", reason: expect.stringContaining(analytics.path) });
  });

  it("selects campaigns by visible title and limits lifecycle actions to confirmed transitions", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.list")!;
    const revisions = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.sheet.revisions.list")!;
    const revert = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.sheet.revisions.revert")!;
    const lifecycle = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.lifecycle")!;
    expect(list).toMatchObject({
      method: "GET", path: "/marketing-campaigns/assistant/summaries", module: "social-marketing",
      permissionGroups: [["marketing:post"]], confirmation: false,
    });
    expect(list.fields.map(field => field.apiKey)).toEqual(["search", "page", "limit"]);
    expect(list.fields.find(field => field.apiKey === "limit")).toMatchObject({ defaultValue: 10, min: 1, max: 100 });
    expect(list.resultFields).toEqual(["title", "campaignType", "status", "startDate", "endDate", "postsPerDay", "createdAt"]);
    expect(revisions).toMatchObject({
      method: "GET", path: "/marketing-campaigns/:id/sheet/revisions",
      permissionGroups: [["marketing:post"]], confirmation: false,
    });
    expect(revisions.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: list.id });
    expect(revisions.resultFields).toEqual(["actorType", "baseRevision", "createdAt"]);
    expect(revisions.resultFields).not.toEqual(expect.arrayContaining(["changes", "revisionId", "operation"]));
    expect(revert).toMatchObject({
      method: "POST", path: "/marketing-campaigns/:id/sheet/revisions/:revisionId/revert",
      permissionGroups: [["marketing:post"]], confirmation: true, resultFields: ["revertedRows", "conflictCount"],
    });
    expect(revert.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id });
    expect(revert.fields.find(field => field.key === "path_revisionId")).toMatchObject({
      reference: revisions.id, referenceParentKey: "path_id", label: expect.stringContaining("Số phiên bản nền hoặc thời điểm thay đổi cần hoàn tác"),
    });
    expect(revert.description).toContain("Chỉ chọn phiên bản có thay đổi");
    expect(defaultWorkflow(revert).confirmationLocked).toBe(true);
    expect(lifecycle).toMatchObject({
      method: "POST", path: "/marketing-campaigns/:id/:action",
      permissionGroups: [["marketing:post"]], confirmation: true,
    });
    expect(lifecycle.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: list.id });
    expect(lifecycle.fields.find(field => field.apiKey === "action")?.options).toEqual(["pause", "resume", "cancel"]);
    expect(lifecycle.description).toContain("không có thao tác hoàn tác");
    expect(defaultWorkflow(lifecycle).confirmationLocked).toBe(true);
    for (const operation of [list, revisions, revert, lifecycle]) {
      expect(coverage.entries.find(entry => entry.method === operation.method && entry.path === operation.path))
        .toMatchObject({ status: "contract", id: operation.id });
    }
    for (const [method, path] of [
      ["GET", "/marketing-campaigns/:id"],
      ["GET", "/marketing-campaigns/:id/sheet"],
      ["GET", "/marketing-campaigns/:id/asset-orders"],
      ["GET", "/marketing-campaigns/:id/sheet/ai/jobs/:jobId"],
      ["GET", "/marketing-campaigns"],
      ["POST", "/marketing-campaigns/estimate-ai"],
      ["POST", "/marketing-campaigns"],
      ["GET", "/marketing-campaigns/analytics"],
    ]) {
      expect(coverage.entries.find(entry => entry.method === method && entry.path === path)).toMatchObject({ status: "unsupported" });
      expect(ASSISTANT_OPERATIONS.some(operation => operation.method === method && operation.path === path)).toBe(false);
    }
  });

  it("connects campaign asset-order work through safe summaries, names, revisions, and confirmation", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.asset-orders.list")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.asset-order.create")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.asset-order.update")!;
    const archive = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.asset-order.archive")!;
    const preview = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.asset-order.ai.preview")!;
    const apply = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.asset-order.ai.apply")!;

    expect(list).toMatchObject({ method: "GET", path: "/marketing-campaigns/:id/asset-orders/assistant-summaries", permissionGroups: [["marketing:post"]], confirmation: false });
    expect(list.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.list" });
    expect(list.resultFields).toEqual(["title", "contentGroup", "headline", "status", "format", "quantitySuggestion", "revision", "updatedAt"]);
    expect(list.resultFields).not.toEqual(expect.arrayContaining(["assets", "customFields", "outputUrls", "aiProposal"]));
    expect(create).toMatchObject({ confirmation: true, resultFields: expect.arrayContaining(["title", "status"]) });
    expect(create.fields.find(field => field.apiKey === "title")).toMatchObject({ required: true });
    expect(update).toMatchObject({ confirmation: true, systemBodyFields: ["expectedRevision"] });
    expect(update.fields.find(field => field.key === "path_orderId")).toMatchObject({ reference: list.id, referenceParentKey: "path_id" });
    expect(update.fields.some(field => field.apiKey === "expectedRevision")).toBe(false);
    expect(archive).toMatchObject({ method: "DELETE", confirmation: true });
    expect(preview).toMatchObject({ confirmation: true, contextBody: ["idempotencyKey"] });
    expect(preview.fields.find(field => field.key === "path_orderId")).toMatchObject({ reference: list.id, referenceParentKey: "path_id" });
    expect(preview.resultFields).not.toContain("references");
    expect(apply).toMatchObject({ confirmation: true, systemBodyFields: ["expectedRevision"] });
    expect(apply.fields.find(field => field.apiKey === "fieldKeys")?.structure?.items?.options).toContain("headline");
    for (const operation of [list, create, update, archive, preview, apply]) {
      expect(coverage.entries).toContainEqual(expect.objectContaining({ method: operation.method, path: operation.path, status: "contract", id: operation.id }));
    }
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/marketing-campaigns/:id/asset-orders")).toMatchObject({ status: "unsupported" });
  });

  it("offers linked records by name for Content Sheet, assignments, prices, and campaign production", () => {
    const columns = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.sheet.columns.list")!;
    expect(columns).toMatchObject({ method: "GET", path: "/marketing-campaigns/:id/sheet/columns/assistant-summaries", confirmation: false });
    expect(columns.resultFields).toEqual(["name", "label", "key", "kind", "dataType", "required", "fieldPolicy"]);
    expect(columns.resultFields).not.toEqual(expect.arrayContaining(["ai", "defaultValue", "options", "companyCode"]));

    const columnUpdate = ASSISTANT_OPERATIONS.find(op => op.method === "PATCH" && op.path === "/marketing-campaigns/:id/sheet/columns/:columnId")!;
    const columnDelete = ASSISTANT_OPERATIONS.find(op => op.method === "DELETE" && op.path === "/marketing-campaigns/:id/sheet/columns/:columnId")!;
    for (const operation of [columnUpdate, columnDelete]) {
      expect(operation.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.list" });
      expect(operation.fields.find(field => field.apiKey === "columnId")).toMatchObject({ reference: columns.id, referenceParentKey: "path_id" });
    }

    const rowUpdate = ASSISTANT_OPERATIONS.find(op => op.method === "PATCH" && op.path === "/marketing-campaigns/:id/sheet/rows/:slotId")!;
    expect(rowUpdate.fields.find(field => field.apiKey === "slotId")).toMatchObject({ reference: "marketing.campaign.sheet.slots.list", referenceParentKey: "path_id" });
    const sheetPreview = ASSISTANT_OPERATIONS.find(op => op.path === "/marketing-campaigns/:id/sheet/ai/preview")!;
    const targetKeys = sheetPreview.fields.find(field => field.apiKey === "targetFieldKeys")!;
    expect(targetKeys.structure?.items).toMatchObject({ reference: columns.id, referenceParentKey: "path_id", referenceValueKey: "key" });
    expect(sheetPreview.contextBody).toContain("idempotencyKey");

    const assignmentGrade = ASSISTANT_OPERATIONS.find(op => op.path === "/assignments/:id/students/:studentId/grade")!;
    expect(assignmentGrade.fields.find(field => field.apiKey === "batchId")).toMatchObject({ reference: "batch.list" });
    expect(assignmentGrade.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "student.assignment.list", referenceParentKey: "query_batchId" });
    expect(assignmentGrade.fields.find(field => field.apiKey === "studentId")).toMatchObject({ reference: "batch.attendance.learners", referenceParentKey: "query_batchId" });

    const priceUpdate = ASSISTANT_OPERATIONS.find(op => op.path === "/inventory/catalog/prices/:variantId")!;
    expect(priceUpdate.fields.find(field => field.apiKey === "variantId")).toMatchObject({ reference: "inventory.product.detail", referenceParentKey: "query_productId", referenceValueKey: "id" });
    expect(priceUpdate.fields.find(field => field.apiKey === "productId")).toMatchObject({ reference: "product.list", required: true });
    const fillOrders = ASSISTANT_OPERATIONS.find(op => op.path === "/marketing-campaigns/:id/asset-orders/ai/fill-all")!;
    expect(fillOrders.fields.find(field => field.apiKey === "orderIds")?.structure?.items).toMatchObject({ reference: "marketing.campaign.asset-orders.list", referenceParentKey: "path_id" });

    for (const operation of [columns, columnUpdate, columnDelete, rowUpdate, sheetPreview, assignmentGrade, priceUpdate, fillOrders]) {
      expect(coverage.entries).toContainEqual(expect.objectContaining({ method: operation.method, path: operation.path, status: "contract", id: operation.id }));
    }
  });

  it("connects safe asset-order AI job summaries and confirms cancellation by campaign and job label", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.asset-order.ai.jobs.list")!;
    const cancel = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.asset-order.ai.job.cancel")!;
    expect(list).toMatchObject({ method: "GET", path: "/marketing-campaigns/:id/asset-orders/ai/jobs/assistant-summaries", permissionGroups: [["marketing:post"]], confirmation: false });
    expect(list.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.list" });
    expect(list.resultFields).toEqual(["operation", "status", "totalItems", "completedItems", "failedItems", "skippedItems", "conflictedItems", "progress", "startedAt", "completedAt", "createdAt", "updatedAt"]);
    expect(list.resultFields).not.toEqual(expect.arrayContaining(["instruction", "targetOrderIds", "results", "errorMessage", "estimatedCost", "actualCost", "companyCode", "idempotencyKey"]));
    expect(cancel).toMatchObject({ method: "POST", path: "/marketing-campaigns/:id/asset-orders/ai/jobs/:jobId/cancel", confirmation: true });
    expect(cancel.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.list" });
    expect(cancel.fields.find(field => field.apiKey === "jobId")).toMatchObject({ reference: list.id, referenceParentKey: "path_id" });
    expect(cancel.resultFields).not.toEqual(expect.arrayContaining(["instruction", "targetOrderIds", "results", "errorMessage", "estimatedCost", "actualCost", "companyCode", "idempotencyKey"]));
    expect(defaultWorkflow(cancel).confirmationLocked).toBe(true);
    for (const operation of [list, cancel]) {
      expect(coverage.entries).toContainEqual(expect.objectContaining({ method: operation.method, path: operation.path, status: "contract", id: operation.id }));
    }
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/marketing-campaigns/:id/asset-orders/ai/jobs/:jobId")).toMatchObject({ status: "unsupported" });
  });

  it("connects Content Sheet AI job summaries and status-gated cancel/retry without exposing job payloads", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.sheet.ai.jobs.list")!;
    const cancel = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.sheet.ai.job.cancel")!;
    const retry = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.sheet.ai.job.retry")!;
    expect(list).toMatchObject({ method: "GET", path: "/marketing-campaigns/:id/sheet/ai/jobs/assistant-summaries", permissionGroups: [["marketing:post"]], confirmation: false });
    expect(list.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.list" });
    expect(list.resultFields).toEqual(["operation", "status", "totalItems", "completedItems", "failedItems", "conflictedItems", "progress", "startedAt", "completedAt", "createdAt", "updatedAt"]);
    expect(list.resultFields).not.toEqual(expect.arrayContaining(["proposals", "errorMessage", "estimatedCost", "actualCost", "companyCode", "idempotencyKey"]));
    for (const [operation, suffix, title] of [[cancel, "cancel", "hủy"], [retry, "retry", "chạy lại"]] as const) {
      expect(operation).toMatchObject({ method: "POST", path: `/marketing-campaigns/:id/sheet/ai/jobs/:jobId/${suffix}`, confirmation: true, resultFields: expect.arrayContaining(["operation", "status", "progress"]) });
      expect(operation.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.list" });
      expect(operation.fields.find(field => field.apiKey === "jobId")).toMatchObject({ reference: list.id, referenceParentKey: "path_id" });
      expect(operation.resultFields).not.toEqual(expect.arrayContaining(["proposals", "errorMessage", "estimatedCost", "actualCost", "companyCode", "idempotencyKey"]));
      expect(operation.description.toLocaleLowerCase("vi")).toContain(title);
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
    }
    for (const operation of [list, cancel, retry]) {
      expect(coverage.entries).toContainEqual(expect.objectContaining({ method: operation.method, path: operation.path, status: "contract", id: operation.id }));
    }
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/marketing-campaigns/:id/sheet/ai/jobs/:jobId")).toMatchObject({ status: "unsupported" });
  });

  it("requires confirmation and resolves a campaign rejection by visible campaign and slot details", () => {
    const reject = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.slot.reject")!;
    expect(reject).toMatchObject({
      method: "POST",
      path: "/marketing-campaigns/:id/slots/:slotId/reject",
      permissions: ["marketing:post"],
      confirmation: true,
    });
    expect(reject.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.calendar", referenceValueKey: "campaignId" });
    expect(reject.fields.find(field => field.apiKey === "slotId")).toMatchObject({ reference: "marketing.campaign.calendar", referenceValueKey: "slotId" });
    expect(reject.resultFields).toEqual(["status", "scheduledAt", "platform", "mediaType"]);
    expect(reject.resultFields.some(field => /(^id$|campaignId|slotId|token)/i.test(field))).toBe(false);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === reject.path)).toMatchObject({ status: "contract", id: reject.id });
    expect(defaultWorkflow(reject).confirmationLocked).toBe(true);
  });

  it("queues retry only for failed or attention-needed campaign slots after confirmation", () => {
    const retry = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.slot.retry")!;
    expect(retry).toMatchObject({
      method: "POST",
      path: "/marketing-campaigns/:id/slots/:slotId/retry",
      permissions: ["marketing:post"],
      confirmation: true,
    });
    expect(retry.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.calendar", referenceValueKey: "campaignId" });
    expect(retry.fields.find(field => field.apiKey === "slotId")).toMatchObject({ reference: "marketing.campaign.calendar", referenceValueKey: "slotId" });
    expect(retry.resultFields).toEqual(["status", "scheduledAt", "platform", "mediaType"]);
    expect(retry.description).toContain("thất bại");
    expect(defaultWorkflow(retry).confirmationLocked).toBe(true);
  });

  it("queues only eligible Facebook slots for approval and leaves TikTok consent in the interface", () => {
    const approve = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.slot.approve")!;
    expect(approve).toMatchObject({
      method: "POST",
      path: "/marketing-campaigns/:id/slots/:slotId/approve",
      permissions: ["marketing:post"],
      confirmation: true,
    });
    expect(approve.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.calendar", referenceValueKey: "campaignId" });
    expect(approve.fields.find(field => field.apiKey === "slotId")).toMatchObject({ reference: "marketing.campaign.calendar", referenceValueKey: "slotId" });
    expect(approve.resultFields).toEqual(["status", "scheduledAt", "platform", "mediaType"]);
    expect(approve.description).toContain("Chỉ hỗ trợ Facebook");
    expect(defaultWorkflow(approve).confirmationLocked).toBe(true);
  });

  it("selects campaign Orders and calendar slots by visible names before writes", () => {
    const dismiss = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.asset-order.ai.dismiss")!;
    const publishNow = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.slot.publish-now")!;
    const contentUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.campaign.slot.content.update")!;
    const replaceImage = ASSISTANT_OPERATIONS.find(op => op.path === "/marketing-campaigns/:id/slots/:slotId/replace-image");

    expect(dismiss).toMatchObject({ confirmation: true, permissionGroups: [["marketing:post"]] });
    expect(dismiss.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.list" });
    expect(dismiss.fields.find(field => field.apiKey === "orderId")).toMatchObject({ reference: "marketing.campaign.asset-orders.list", referenceParentKey: "path_id" });

    for (const operation of [publishNow, contentUpdate]) {
      expect(operation).toMatchObject({ confirmation: true, permissionGroups: [["marketing:post"]] });
      expect(operation.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "marketing.campaign.calendar", referenceValueKey: "campaignId" });
      expect(operation.fields.find(field => field.apiKey === "slotId")).toMatchObject({ reference: "marketing.campaign.calendar", referenceValueKey: "slotId" });
      expect(operation.fields.filter(field => field.source === "query").map(field => field.apiKey)).toEqual(["startDate", "endDate"]);
      expect(operation.description).toContain("tối đa 7 ngày");
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
    }
    expect(publishNow.description).toContain("TikTok không hỗ trợ");
    expect(publishNow.resultFields).toEqual(["status", "scheduledAt", "platform", "mediaType"]);
    expect(contentUpdate.fields.find(field => field.apiKey === "bodyText")?.max).toBe(10000);
    expect(replaceImage).toBeUndefined();

    for (const operation of [dismiss, publishNow, contentUpdate]) {
      expect(coverage.entries).toContainEqual(expect.objectContaining({ method: operation.method, path: operation.path, status: "contract", id: operation.id }));
    }
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/marketing-campaigns/:id/slots/:slotId/replace-image"))
      .toMatchObject({ status: "unsupported" });
  });

  it("clears only customer-service scenario knowledge after explicit confirmation", () => {
    const clearScenario = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.scenario.clear")!;
    expect(clearScenario).toMatchObject({ method: "DELETE", path: "/gemini/customer-service-scenario", permissions: ["company-knowledge:manage"], confirmation: true });
    expect(clearScenario.fields).toEqual([]);
    expect(coverage.entries.find(entry => entry.method === "DELETE" && entry.path === "/gemini/customer-service-scenario")).toMatchObject({ status: "contract", id: clearScenario.id });
    expect(defaultWorkflow(clearScenario).confirmationLocked).toBe(true);
  });

  it("edits only an account-owned image selected from media history", () => {
    const editImage = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.ai.image.edit")!;
    expect(editImage).toMatchObject({ method: "POST", path: "/gemini/edit-image", permissions: ["marketing:manage"], confirmation: true, contextBody: ["requestId"], fixedBodyValues: { preserveOutsideRegion: true }, resultFields: ["url", "revision", "replayed"] });
    expect(editImage.fields.find(field => field.apiKey === "sourceMediaId")).toMatchObject({ required: true, reference: "marketing.media-history.list", referenceValueKey: "id", referenceContext: { query_type: "image" } });
    expect(editImage.fields.map(field => field.apiKey)).not.toContain("sourceImageUrl");
    expect(editImage.fields.map(field => field.apiKey)).not.toContain("supportingImageUris");
    expect(editImage.description).toContain("không nhận URL hoặc ảnh bên ngoài");
    expect(editImage.description).toContain("trừ một lượt AI");
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/gemini/edit-image")).toMatchObject({ status: "contract", id: editImage.id });
    expect(defaultWorkflow(editImage).confirmationLocked).toBe(true);
  });

  it("clears the complete current-company knowledge base only after confirmation", () => {
    const clearAll = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.clear-all")!;
    expect(clearAll).toMatchObject({ method: "POST", path: "/gemini/clear-knowledge", permissions: ["company-knowledge:manage"], confirmation: true, fields: [] });
    expect(clearAll.description).toContain("đề xuất FAQ");
    expect(clearAll.resultFields).toEqual(["cleared"]);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === clearAll.path)).toMatchObject({ status: "contract", id: clearAll.id });
    expect(defaultWorkflow(clearAll).confirmationLocked).toBe(true);
  });

  it("creates at most twenty workers per batch and requires names and phone numbers", () => {
    const bulkCreate = ASSISTANT_OPERATIONS.find(op => op.id === "worker.bulk.create")!;
    expect(bulkCreate).toMatchObject({ method: "POST", path: "/worker-management/workers/bulk", permissions: ["people:manage"], confirmation: true });
    const workers = bulkCreate.fields.find(field => field.apiKey === "workers")!;
    expect(workers.structure).toMatchObject({ type: "array", minItems: 1, maxItems: 20 });
    expect(workers.structure?.items?.keys).toMatchObject({ fullName: { required: true }, phone: { required: true } });
    expect(workers.structure?.items?.keys).not.toHaveProperty("partnerCode");
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/worker-management/workers/bulk")).toMatchObject({ status: "contract", id: bulkCreate.id });
    expect(defaultWorkflow(bulkCreate).confirmationLocked).toBe(true);
  });

  it("soft deletes up to twenty named workers with manage permission and confirmation", () => {
    const deletion = ASSISTANT_OPERATIONS.find(op => op.id === "worker.bulk.delete")!;
    expect(deletion).toMatchObject({ method: "POST", path: "/worker-management/workers/bulk-delete", permissions: ["people:manage"], confirmation: true });
    expect(deletion.fields.find(field => field.apiKey === "ids")?.structure).toMatchObject({ type: "array", minItems: 1, maxItems: 20, items: { reference: "worker.list", referenceValueKey: "id" } });
    expect(deletion.resultFields).toEqual(["deletedCount"]);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/worker-management/workers/bulk-delete")).toMatchObject({ status: "contract", id: deletion.id });
    expect(defaultWorkflow(deletion).confirmationLocked).toBe(true);
  });

  it("exposes only safe Telegram link status for the signed-in account", () => {
    const telegram = ASSISTANT_OPERATIONS.find(op => op.id === "account.telegram-link.status")!;
    expect(telegram).toMatchObject({ method: "GET", path: "/auth/telegram-link", module: "chat", permissions: ["chat:read"], confirmation: false });
    expect(telegram.fields).toEqual([]);
    expect(telegram.resultFields).toEqual(["linked", "linkedAt", "botUsername"]);
    expect(telegram.resultFields.some(field => /code|token|telegram.*id/i.test(field))).toBe(false);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/auth/telegram-link")).toMatchObject({ status: "contract", id: telegram.id });
  });

  it("manages the signed-in account's Telegram link with explicit social-integration permissions", () => {
    const status = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.account.telegram-link.status")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.account.telegram-link.create")!;
    const unlink = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.account.telegram-link.unlink")!;
    expect(status).toMatchObject({ method: "GET", path: "/marketing-settings/telegram-link", permissions: ["social-integration:read"], confirmation: false, fields: [] });
    expect(status.resultFields).toEqual(["linked", "linkedAt", "botUsername"]);
    for (const operation of [create, unlink]) {
      expect(operation).toMatchObject({ permissions: ["social-integration:manage"], confirmation: true, fields: [] });
      expect(operation.resultFields).toEqual(["linked", "pendingCode", "pendingCodeExpiresAt", "botUsername"]);
      expect(operation.resultFields.some(field => /telegram.*id/i.test(field))).toBe(false);
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
    }
    expect(create).toMatchObject({ method: "POST", path: "/marketing-settings/telegram-link" });
    expect(unlink).toMatchObject({ method: "DELETE", path: "/marketing-settings/telegram-link" });
    expect(unlink.title).toContain("tạo mã mới");
    for (const method of ["GET", "POST", "DELETE"]) {
      expect(coverage.entries.find(entry => entry.method === method && entry.path === "/marketing-settings/telegram-link")).toMatchObject({ status: "contract" });
    }
  });

  it("exposes only same-company social integration status for a named colleague", () => {
    const integrations = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.author.integration-status")!;
    expect(integrations).toMatchObject({ method: "GET", path: "/marketing-settings/authors/:id", module: "social-marketing", permissions: ["marketing:read", "social-integration:read"], confirmation: false });
    expect(integrations.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "account.colleagues.list", label: "Tên hoặc email nhân sự" });
    expect(integrations.resultFields).toEqual(["facebookConnected", "facebookPageName", "tiktokConnected", "tiktokUsername", "zaloConnected", "zaloName"]);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/marketing-settings/authors/:id")).toMatchObject({ status: "contract", id: integrations.id });
  });

  it("exposes AI plan and usage reads across the modules authorized by suite access", () => {
    const plans = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.ai-subscription.plans")!;
    const summary = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.ai-subscription.summary")!;
    const permissions = ["marketing:read", "omni-inbox:read", "company-knowledge:read", "social-integration:read"];
    for (const operation of [plans, summary]) {
      expect(operation).toMatchObject({ module: "social-marketing", modules: ["social-marketing", "omni-inbox", "company-knowledge"], permissions, confirmation: false });
      expect(operation.fields).toEqual([]);
      expect(operation.permissionGroups).toEqual([permissions]);
      expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === operation.path)).toMatchObject({ status: "contract", id: operation.id });
    }
    expect(plans.resultFields).toEqual(["plans"]);
    expect(summary.resultFields).toEqual(["planName", "subscriptionStatus", "billingScope", "aiLimit", "used", "remaining", "expiresAt", "usage"]);
  });

  it("exposes only the signed-in user's Canva connection status through marketing read access", () => {
    const canva = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.canva.status")!;
    expect(canva).toMatchObject({ method: "GET", path: "/canva/status", module: "social-marketing", permissions: ["marketing:read"], confirmation: false });
    expect(canva.fields).toEqual([]);
    expect(canva.resultFields).toEqual(["connected", "connectedAt"]);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/canva/status")).toMatchObject({ status: "contract", id: canva.id });
  });

  it("lists Canva design titles without provider identifiers or edit links", () => {
    const canva = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.canva.designs.list")!;
    expect(canva).toMatchObject({ method: "GET", path: "/canva/designs", module: "social-marketing", permissions: ["marketing:read"], confirmation: false, resultFields: ["title", "updatedAt"] });
    expect(canva.fields).toEqual([]);
    expect(canva.description).toContain("ID thiết kế");
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/canva/designs")).toMatchObject({ status: "contract", id: canva.id });
  });

  it("documents assistant control APIs outside the business-operation catalog", () => {
    for (const path of [
      "/chatbot/assistant/workflows",
      "/chatbot/assistant/workflows/:actionId/interpret",
      "/chatbot/assistant/workflows/:actionId",
      "/chatbot/assistant/workflows/:actionId/reset",
      "/chatbot/assistant/conversations",
      "/chatbot/assistant/conversations/:conversationId",
      "/chatbot/assistant/turns",
    ]) {
      expect(coverage.entries.find(entry => entry.path === path)).toMatchObject({ status: "unsupported", reason: expect.stringContaining("API") });
    }
    expect(coverage.entries.find(entry => entry.method === "PATCH" && entry.path === "/retail/warranty/serial/:id")).toMatchObject({ status: "unsupported", reason: expect.stringContaining("serial/by-code") });
  });

  it("lets users read and update their own assistant preferences with confirmation and version checks", () => {
    const read = ASSISTANT_OPERATIONS.find(operation => operation.id === "account.assistant-settings.read")!;
    const update = ASSISTANT_OPERATIONS.find(operation => operation.id === "account.assistant-settings.update")!;
    expect(read).toMatchObject({ method: "GET", path: "/chatbot/assistant/settings", module: "chat", permissions: ["chat:read"], confirmation: false, resultFields: ["version", "windowMode", "enterToSend", "showSuggestions", "alwaysConfirm", "speakReplies", "wakeWordEnabled"] });
    expect(read.resultFields).not.toContain("instructions");
    expect(update).toMatchObject({ method: "PATCH", path: "/chatbot/assistant/settings", module: "chat", permissions: ["chat:read"], confirmation: true });
    expect(update.fields.find(field => field.apiKey === "speakReplies")).toMatchObject({ type: "boolean", required: false });
    expect(update.fields.find(field => field.apiKey === "wakeWordEnabled")).toMatchObject({ type: "boolean", required: false });
    expect(update.fields.find(field => field.apiKey === "windowMode")?.options).toEqual(["window", "fullscreen"]);
    expect(update.fields.find(field => field.apiKey === "instructions")).toMatchObject({ max: 2000, required: false });
    expect(update.fields.find(field => field.apiKey === "responseRules")).toMatchObject({ max: 2000, required: false });
    expect(update.fields.find(field => field.apiKey === "autoMemoryEnabled")).toMatchObject({ type: "boolean", required: false });
    expect(update.resultFields).not.toContain("instructions");
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === read.path && entry.method === "GET")).toMatchObject({ status: "contract", id: read.id });
    expect(coverage.entries.find(entry => entry.path === update.path && entry.method === "PATCH")).toMatchObject({ status: "contract", id: update.id });
  });

  it("keeps messaging diagnostics unavailable when reads can mutate integrations or expose private conversations", () => {
    for (const path of [
      "/facebook/debug-ai-logs",
      "/facebook/messenger/diagnostics/page",
      "/facebook/messenger/diagnostics/:conversationId",
      "/facebook/messenger/post-detail/:postId",
      "/zalo/diagnostics/oa",
      "/zalo/diagnostics/:conversationId",
    ]) {
      expect(ASSISTANT_OPERATIONS.some(operation => operation.path === path)).toBe(false);
      expect(coverage.entries.find(entry => entry.path === path)?.status).toBe("unsupported");
      expect(coverage.entries.find(entry => entry.path === path)?.reason).toBeTruthy();
    }
    expect(coverage.entries.find(entry => entry.path === "/facebook/messenger/diagnostics/page")?.reason).toContain("đăng ký webhook");
    expect(coverage.entries.find(entry => entry.path === "/zalo/diagnostics/oa")?.reason).toContain("làm mới token");
  });

  it("exposes company order summaries only through social integration read access", () => {
    const orders = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.order-sheet.orders.list")!;
    expect(orders).toMatchObject({ method: "GET", path: "/order-sheets/orders", module: "omni-inbox", modules: ["omni-inbox", "social-marketing"], permissions: ["social-integration:read"], confirmation: false });
    expect(orders.fields).toMatchObject([expect.objectContaining({ key: "query_limit", apiKey: "limit", max: 100 })]);
    expect(orders.resultFields).toEqual(["customerName", "itemsSummary", "totalAmount", "orderStatus", "createdAt", "depositStatus", "paymentMethod"]);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/order-sheets/orders")).toMatchObject({ status: "contract", id: orders.id });
  });

  it("exposes safe company Telegram order status and editable product catalog settings", () => {
    const telegram = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.telegram-order.config-status")!;
    expect(telegram).toMatchObject({ method: "GET", path: "/company-telegram-order", module: "omni-inbox", modules: ["social-marketing", "omni-inbox"], permissions: ["social-integration:read"], confirmation: false });
    expect(telegram.resultFields).toEqual(["enabled", "notifyNewOrder", "botConfigured", "botUsername", "lastTestedAt", "lastTestStatus"]);
    expect(telegram.resultFields.some(field => /botToken|chatId|error/i.test(field))).toBe(false);
    const telegramUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.telegram-order.config.update")!;
    expect(telegramUpdate).toMatchObject({ method: "PUT", path: "/company-telegram-order", roles: ["admin", "superadmin"], permissions: ["social-integration:read"], confirmation: true });
    expect(telegramUpdate.fields.map(field => field.apiKey)).toEqual(["enabled", "notifyNewOrder"]);
    expect(defaultWorkflow(telegramUpdate).confirmationLocked).toBe(true);

    const config = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.product-catalog.config")!;
    expect(config).toMatchObject({ method: "GET", path: "/company-cake-catalog", permissions: ["social-integration:read"], confirmation: false });
    expect(config.resultFields).toEqual(["enabled", "maxImagesPerReply", "catalogName", "itemLabel", "selectionMessage", "businessDescription"]);
    expect(config.resultFields.some(field => /url|email|companyCode/i.test(field))).toBe(false);

    const update = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.product-catalog.config.update")!;
    expect(update).toMatchObject({ method: "PUT", path: "/company-cake-catalog", permissions: ["social-integration:read"], permissionGroups: [["social-integration:read"], ["social-integration:manage"]], confirmation: true });
    expect(update.fields.map(field => field.apiKey)).toEqual(["enabled", "rootFolderUrl", "maxImagesPerReply", "catalogName", "itemLabel", "selectionMessage", "businessDescription"]);
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/company-telegram-order")).toMatchObject({ status: "contract", id: telegram.id });
    expect(coverage.entries.find(entry => entry.method === "PUT" && entry.path === "/company-telegram-order")).toMatchObject({ status: "contract", id: telegramUpdate.id });
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/company-cake-catalog")).toMatchObject({ status: "contract", id: config.id });
    expect(coverage.entries.find(entry => entry.method === "PUT" && entry.path === "/company-cake-catalog")).toMatchObject({ status: "contract", id: update.id });
    const catalogTest = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.product-catalog.config.test")!;
    expect(catalogTest).toMatchObject({ method: "POST", path: "/company-cake-catalog/test", permissionGroups: [["social-integration:read"], ["social-integration:manage"]], confirmation: true });
    expect(catalogTest.resultFields).toEqual(["categoryCount", "imageCount", "categories"]);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/company-cake-catalog/test")).toMatchObject({ status: "contract", id: catalogTest.id });

    const sepay = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.sepay.config")!;
    expect(sepay).toMatchObject({ method: "GET", path: "/company-sepay", permissions: ["social-integration:read"], confirmation: false });
    expect(sepay.resultFields).toContain("accountCount");
    expect(sepay.resultFields.some(field => /accountNumbers|webhookId|webhookUrl|secret|qrAccount/i.test(field))).toBe(false);
    const sepayUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.sepay.config.update")!;
    expect(sepayUpdate).toMatchObject({ method: "PUT", path: "/company-sepay", permissionGroups: [["social-integration:read"], ["social-integration:manage"]], confirmation: true });
    expect(sepayUpdate.fields.map(field => field.apiKey)).toEqual(["enabled", "paymentCodePrefix", "depositEnabled", "depositPercent"]);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/company-sepay")).toMatchObject({ status: "contract", id: sepay.id });
  });

  it("lists only the signed-in user's notifications and exposes bounded filters", () => {
    const notifications = ASSISTANT_OPERATIONS.find(op => op.id === "notification.list")!;
    expect(notifications).toMatchObject({ method: "GET", path: "/notifications", module: "chat", permissions: ["chat:read"], confirmation: false });
    expect(notifications.fields.map(field => field.apiKey)).toEqual(["page", "limit", "read", "type"]);
    expect(notifications.fields.find(field => field.apiKey === "limit")).toMatchObject({ max: 100 });
    expect(notifications.fields.some(field => /recipient|userId|companyCode|branchId/i.test(field.apiKey!))).toBe(false);
    expect(notifications.resultFields).toEqual(["title", "body", "type", "read", "createdAt"]);
    expect(defaultWorkflow(notifications).confirmationLocked).toBe(false);
  });

  it("exposes repair notification settings and resend with bounded results and confirmation", () => {
    const settings = ASSISTANT_OPERATIONS.find(op => op.method === "PUT" && op.path === "/repair/settings/notifications")!;
    const resend = ASSISTANT_OPERATIONS.find(op => op.id === "repair.notification.resend")!;
    const feedbackLink = ASSISTANT_OPERATIONS.find(op => op.id === "repair.feedback.link.create")!;
    const deviceLookup = ASSISTANT_OPERATIONS.find(op => op.id === "repair.device.lookup")!;
    expect(settings).toMatchObject({ module: "repair", permissions: ["repair:manage"], confirmation: true });
    expect(settings.resultFields).toEqual(["notifyChannels", "updatedAt"]);
    expect(settings.fields.find(field => field.apiKey === "templates")?.type).toBe("json");
    expect(resend).toMatchObject({ method: "POST", path: "/repair/tickets/:id/notifications/resend", permissions: ["repair:manage"], confirmation: true });
    expect(resend.fields.find(field => field.key === "path_id")?.reference).toBe("repair.list");
    expect(resend.fields.find(field => field.key === "targetBranch")?.reference).toBe("branch.list");
    expect(resend.fields.find(field => field.key === "event")?.options).toEqual(["received", "done"]);
    expect(resend.resultFields).toEqual(["status", "channel", "reason", "ticketCode"]);
    expect(defaultWorkflow(resend).confirmationLocked).toBe(true);
    expect(feedbackLink).toMatchObject({ method: "POST", path: "/repair/tickets/:id/feedback-qr", permissions: ["repair:manage"], confirmation: true, resultFields: ["ticketCode", "feedbackUrl"] });
    expect(feedbackLink.fields.find(field => field.key === "path_id")?.reference).toBe("repair.list");
    expect(feedbackLink.fields.find(field => field.key === "targetBranch")?.reference).toBe("branch.list");
    expect(feedbackLink.description).toContain("chỉ chia sẻ cho khách của phiếu này");
    expect(coverage.entries.find(entry => entry.method === feedbackLink.method && entry.path === feedbackLink.path)).toMatchObject({ status: "contract", id: feedbackLink.id });
    expect(defaultWorkflow(feedbackLink).confirmationLocked).toBe(true);
    expect(deviceLookup).toMatchObject({ method: "POST", path: "/repair/tickets/lookup-device", permissions: ["repair:manage"], confirmation: false });
    expect(deviceLookup.fields.find(field => field.key === "serialNumber")).toMatchObject({ required: true, source: "body" });
    expect(deviceLookup.fields.find(field => field.key === "targetBranch")).toMatchObject({ required: true, reference: "branch.list" });
    expect(deviceLookup.resultFields).not.toContain("customerPhone");
    expect(coverage.entries.find(entry => entry.method === deviceLookup.method && entry.path === deviceLookup.path)).toMatchObject({ status: "contract", id: deviceLookup.id });
  });

  it("sends one explicit email only with management permission and locked confirmation", () => {
    const operation = ASSISTANT_OPERATIONS.find(op => op.id === "student.email.send")!;
    expect(operation).toMatchObject({ method: "POST", path: "/send-email", module: "student", permissions: ["people:manage"], confirmation: true, fixedBodyValues: { check: false } });
    expect(operation.fields.find(field => field.key === "to")).toMatchObject({ type: "email", required: true, max: 254 });
    expect(operation.fields.find(field => field.key === "subject")).toMatchObject({ required: true, max: 200 });
    expect(operation.fields.find(field => field.key === "html")).toMatchObject({ required: true, max: 10000 });
    expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/send-email")).toMatchObject({ status: "contract", id: operation.id });
  });

  it("connects treasury workflows through named records and server-pinned versions", () => {
    const accounts = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.accounts.list")!;
    const vouchers = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.vouchers.list")!;
    const bankLines = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.bank-lines.list")!;
    const periods = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.periods.list")!;
    const createVoucher = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.vouchers.create")!;
    const decision = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.vouchers.decision")!;
    const reconcile = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.reconciliation.create")!;
    const createBankLine = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.bank-lines.create")!;
    const matchBankLine = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.bank-lines.match")!;
    const updatePeriod = ASSISTANT_OPERATIONS.find(op => op.id === "finance.treasury.period.update")!;

    expect(accounts.resultFields).toContain("version");
    expect(vouchers.resultFields).toContain("version");
    expect(bankLines.resultFields).toContain("bankKey");
    expect(periods.resultFields).toContain("version");
    expect(createVoucher.fields.find(field => field.key === "accountId")?.reference).toBe(accounts.id);
    expect(createVoucher.fields.find(field => field.key === "destinationAccountId")?.requiredWhen).toEqual({ field: "kind", equals: "transfer" });
    expect(createVoucher.contextBody).toEqual(["key"]);
    expect(decision).toMatchObject({ path: "/finance/reporting/treasury/vouchers/:id/decision", systemBodyFields: ["version"], confirmation: true });
    expect(decision.fields.find(field => field.key === "path_id")?.reference).toBe(vouchers.id);
    expect(decision.fields.find(field => field.key === "reason")?.requiredWhen).toEqual({ field: "action", equals: "reject" });
    expect(reconcile).toMatchObject({ systemBodyFields: ["version"], contextBody: ["key"], confirmation: true });
    expect(reconcile.fields.find(field => field.key === "accountId")?.reference).toBe(accounts.id);
    expect(createBankLine.fields.find(field => field.key === "accountId")?.reference).toBe(accounts.id);
    expect(matchBankLine.fields.find(field => field.key === "path_id")?.reference).toBe(bankLines.id);
    expect(matchBankLine.fields.find(field => field.key === "voucherId")?.reference).toBe(vouchers.id);
    expect(updatePeriod).toMatchObject({ systemBodyFields: ["version"], confirmation: true });
    for (const operation of [createVoucher, decision, reconcile, createBankLine, matchBankLine, updatePeriod]) expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
  });

  it("exposes inventory reconciliation as a read-only, warehouse-bounded workflow", () => {
    const warehouses = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.reconciliation.warehouses.list")!;
    const run = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.reconciliation.run")!;
    expect(warehouses).toMatchObject({ method: "GET", path: "/inventory/reconciliation/warehouses", permissions: ["inventory:read"] });
    expect(warehouses.fields.find(field => field.key === "targetBranch")).toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list", required: true });
    expect(run).toMatchObject({ method: "POST", path: "/inventory/reconciliation/runs", permissions: ["inventory:read"], confirmation: false });
    expect(run.fields.find(field => field.key === "warehouseId")?.reference).toBe(warehouses.id);
    expect(run.fields.find(field => field.key === "warehouseId")?.required).toBe(true);
    expect(defaultWorkflow(run).confirmationLocked).toBe(false);
    expect(run.fields.some(field => field.key === "baseline" || field.key === "ledgerComplete")).toBe(false);
  });

  it("supports restoring a named item from the resource trash and partial auto-reply settings", () => {
    const resources = ASSISTANT_OPERATIONS.find(op => op.id === "resource.list")!;
    const trash = ASSISTANT_OPERATIONS.find(op => op.id === "resource.trash.list")!;
    const restore = ASSISTANT_OPERATIONS.find(op => op.id === "resource.restore")!;
    const autoReply = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.auto-reply.config.update")!;
    const marketingSettings = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.settings.update")!;
    const customerCreate = ASSISTANT_OPERATIONS.find(op => op.id === "customer.create")!;
    const quickCustomerCreate = ASSISTANT_OPERATIONS.find(op => op.id === "customer.quick.create")!;
    const taskActivity = ASSISTANT_OPERATIONS.find(op => op.id === "task.activity.update")!;
    expect(resources.resultFields).toContain("name");
    expect(resources.resultFields).not.toContain("fileUrl");
    expect(trash).toMatchObject({ method: "GET", path: "/resources/trash", permissions: ["resource:read"] });
    expect(restore).toMatchObject({ method: "POST", path: "/resources/:id/restore", permissions: ["resource:manage"], confirmation: true });
    expect(restore.fields.find(field => field.key === "path_id")).toMatchObject({ reference: trash.id, label: "Tên hoặc mã Tài nguyên cần khôi phục" });
    expect(restore.resultFields).toEqual(["restoredCount"]);
    expect(autoReply).toMatchObject({ permissions: ["omni-inbox:manage"], confirmation: true });
    expect(autoReply.fields.every(field => !field.required)).toBe(true);
    expect(autoReply.fields.map(field => field.apiKey)).toContain("advancedInstructions");
    expect(autoReply.fields.map(field => field.apiKey)).not.toContain("disabledAt");
    expect(marketingSettings).toMatchObject({ method: "PUT", path: "/marketing/settings", permissions: ["marketing:manage"], confirmation: true });
    expect(marketingSettings.fields.find(field => field.apiKey === "sendTime")?.pattern).toBe("^(?:[01][0-9]|2[0-3]):[0-5][0-9]$");
    expect(marketingSettings.fields.find(field => field.apiKey === "remarketingInactiveDays")).toMatchObject({ min: 7, max: 3650, integer: true });
    expect(customerCreate.fields.find(field => field.key === "customerKind")?.options).toEqual(["individual", "business"]);
    expect(customerCreate.fields.find(field => field.key === "gender")?.options).toEqual(["male", "female", "other"]);
    expect(quickCustomerCreate).toMatchObject({ method: "POST", path: "/customers/quick", permissions: ["customer:manage"], confirmation: true });
    expect(quickCustomerCreate.fields.map(field => field.apiKey)).toEqual(["name", "phone"]);
    expect(quickCustomerCreate.fields.every(field => field.required)).toBe(true);
    expect(quickCustomerCreate.resultFields).toEqual(["customerCode", "name", "type", "status"]);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/customers/quick")).toMatchObject({ status: "contract", id: "customer.quick.create" });
    expect(defaultWorkflow(restore).confirmationLocked).toBe(true);
    expect(defaultWorkflow(autoReply).confirmationLocked).toBe(true);
    expect(defaultWorkflow(marketingSettings).confirmationLocked).toBe(true);
    expect(defaultWorkflow(quickCustomerCreate).confirmationLocked).toBe(true);
    expect(taskActivity).toMatchObject({ method: "PATCH", path: "/kanban/tasks/:id/activity", permissions: ["work:read"], systemBodyFields: ["revision"], confirmation: true });
    expect(taskActivity.fields.find(field => field.key === "path_id")?.reference).toBe("task.list");
    expect(taskActivity.fields.find(field => field.key === "progress")).toMatchObject({ min: 0, max: 100, integer: true, requiredWhen: { field: "action", equals: "progress" } });
    expect(taskActivity.fields.find(field => field.key === "note")?.requiredWhen).toEqual({ field: "action", equals: ["progress", "help"] });
    expect(defaultWorkflow(taskActivity).confirmationLocked).toBe(true);
  });

  it("exposes payroll configuration workflows with permissions, named references, and server-pinned versions", () => {
    const schedule = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.reconciliation.schedule.update")!;
    const variables = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.period.variables.list")!;
    const variableUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.period.variables.update")!;
    const formulaCreate = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.formula.create")!;
    const formulaUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.formula.update")!;
    const policyCreate = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.policy.create")!;
    const policyUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.policy.update")!;
    expect(schedule).toMatchObject({ confirmation: true, systemBodyFields: ["version"] });
    expect(schedule.fields.map(field => field.key)).toEqual(["enabled", "day", "hour", "minute", "periodOffset"]);
    expect(variables.resultFields).toContain("version");
    expect(variableUpdate.fields.find(field => field.key === "path_id")).toMatchObject({ reference: variables.id });
    expect(variableUpdate.systemBodyFields).toContain("expectedVersion");
    expect(formulaCreate.fields.find(field => field.key === "expression")?.type).toBe("json");
    expect(formulaUpdate).toMatchObject({ confirmation: true, mergeBodyWithReference: true });
    expect(formulaUpdate.fields.find(field => field.key === "path_id")?.reference).toBe("payroll.formula.list");
    expect(formulaUpdate.fields.find(field => field.key === "priority")?.required).toBe(false);
    expect(policyCreate.fields.find(field => field.key === "funds")?.type).toBe("json");
    expect(policyUpdate).toMatchObject({ confirmation: true, mergeBodyWithReference: true });
    expect(policyUpdate.fields.find(field => field.key === "path_id")?.reference).toBe("payroll.policy.list");
    for (const op of [schedule, variableUpdate, formulaCreate, formulaUpdate, policyCreate, policyUpdate]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("connects custom-field configuration and reversible archive operations under settings permissions", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "student.custom-field.list")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "student.custom-field.create")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "student.custom-field.update")!;
    const archive = ASSISTANT_OPERATIONS.find(op => op.id === "student.custom-field.archive")!;
    const restore = ASSISTANT_OPERATIONS.find(op => op.id === "student.custom-field.restore")!;
    const remove = ASSISTANT_OPERATIONS.find(op => op.id === "student.custom-field.delete")!;
    expect(list.permissionGroups).toEqual([["settings:read"]]);
    expect(list.fields.find(field => field.key === "path_moduleKey")?.label).toContain("students");
    expect(create).toMatchObject({ permissions: ["settings:manage"], confirmation: true });
    expect(create.fields.find(field => field.key === "type")?.options).toContain("currency");
    expect(update.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(archive.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(restore.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(defaultWorkflow(remove).confirmationLocked).toBe(true);
    expect(remove.description).toContain("Không thể khôi phục");
    for (const op of [create, update, archive, restore, remove]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("pins financial plan updates to the selected branch and current month version", () => {
    const breakeven = ASSISTANT_OPERATIONS.find(op => op.id === "finance.reporting.breakeven")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "finance.reporting.plan.update")!;
    expect(breakeven.fields.find(field => field.key === "targetBranch")).toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list" });
    expect(breakeven.fields.find(field => field.apiKey === "month")?.pattern).toBe("^\\d{4}-(0[1-9]|1[0-2])$");
    expect(update.fields.find(field => field.key === "targetBranch")?.reference).toBe("branch.list");
    expect(update.systemBodyFields).toContain("version");
    expect(update.mergeBodyWithReference).toBe(true);
    expect(update.fields.find(field => field.key === "rent")?.required).toBe(false);
    expect(update.fields.find(field => field.key === "salesMix")?.type).toBe("json");
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
  });

  it("exposes bounded bulk student creation with named class selection and confirmation", () => {
    const operation = ASSISTANT_OPERATIONS.find(op => op.id === "student.bulk.create")!;
    const preview = ASSISTANT_OPERATIONS.find(op => op.id === "student.bulk.preview")!;
    expect(preview).toMatchObject({ confirmation: false, permissions: ["people:manage"] });
    expect(preview.fields.find(field => field.key === "students")?.structure).toMatchObject({ minItems: 1, maxItems: 100 });
    expect(preview.resultFields).toEqual(["errors"]);
    expect(operation.permissionGroups).toEqual([["people:manage"]]);
    expect(operation.confirmation).toBe(true);
    expect(operation.fields.find(field => field.key === "students")?.structure).toMatchObject({ minItems: 1, maxItems: 100 });
    const row = operation.fields.find(field => field.key === "students")?.structure?.items;
    expect(row?.keys?.fullName?.required).toBe(true);
    expect(row?.keys?.phone?.required).toBe(true);
    expect(row?.keys?.email?.required).toBe(true);
    expect(row?.keys?.batchCode).toMatchObject({ reference: "batch.list", referenceValueKey: "code" });
    expect(row?.keys).not.toHaveProperty("paidAmount");
    expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
  });

  it("supports student name lookup and bounded delete impact preview before confirmed deletion", () => {
    const students = ASSISTANT_OPERATIONS.find(op => op.id === "student.list")!;
    expect(students).toMatchObject({ method: "GET", path: "/students", permissions: ["people:read"], confirmation: false });
    expect(students.resultFields).toContain("fullName");
    expect(students.fields.find(field => field.apiKey === "search")).toMatchObject({ key: "search", max: 100 });
    expect(students.fields.map(field => field.apiKey)).toEqual(["search", "status", "rank", "page", "limit"]);
    expect(students.fields.find(field => field.apiKey === "limit")).toMatchObject({ min: 1, max: 100 });

    const preview = ASSISTANT_OPERATIONS.find(op => op.id === "student.bulk.delete.preview")!;
    const deletion = ASSISTANT_OPERATIONS.find(op => op.id === "student.bulk.delete")!;
    for (const operation of [preview, deletion]) {
      expect(operation).toMatchObject({ method: "POST", path: operation === preview ? "/students/bulk-delete-preview" : "/students/bulk-delete", permissions: ["people:manage"] });
      expect(operation.fields.find(field => field.apiKey === "ids")?.structure).toMatchObject({ minItems: 1, maxItems: 20, items: { reference: "student.list", referenceValueKey: "id" } });
      expect(operation.resultFields.some(field => /studentId|deletedIds/i.test(field))).toBe(false);
    }
    expect(preview.confirmation).toBe(false);
    expect(deletion.confirmation).toBe(true);
    expect(deletion.description).toContain("không khôi phục được");
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/students")).toMatchObject({ status: "contract", id: students.id });
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/students/bulk-delete-preview")).toMatchObject({ status: "contract", id: preview.id });
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/students/bulk-delete")).toMatchObject({ status: "contract", id: deletion.id });
  });

  it("resolves class names and locks date-specific attendance deletion behind confirmation", () => {
    const batches = ASSISTANT_OPERATIONS.find(op => op.id === "batch.list")!;
    const deletion = ASSISTANT_OPERATIONS.find(op => op.id === "batch.attendance.delete")!;
    expect(batches.resultFields).toContain("name");
    expect(batches.fields.find(field => field.apiKey === "search")).toMatchObject({ max: 100 });
    expect(batches.fields.find(field => field.apiKey === "limit")).toMatchObject({ min: 1, max: 100 });
    expect(deletion).toMatchObject({ method: "DELETE", path: "/batches/:id/attendance", permissions: ["people:manage"], confirmation: true });
    expect(deletion.fields.find(field => field.source === "path")).toMatchObject({ reference: "batch.list" });
    expect(deletion.fields.find(field => field.apiKey === "date")).toMatchObject({ required: true, pattern: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$" });
    expect(deletion.description).toContain("không thể khôi phục");
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/batches")).toMatchObject({ status: "contract", id: "batch.list" });
    expect(coverage.entries.find(entry => entry.method === "DELETE" && entry.path === "/batches/:id/attendance")).toMatchObject({ status: "contract", id: deletion.id });
  });

  it("exposes company knowledge metadata and FAQ suggestions through the knowledge read permission", () => {
    const health = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.health")!;
    const documents = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.documents.list")!;
    const deleteDocument = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.documents.delete")!;
    const updateScopes = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.documents.scopes.update")!;
    const conflicts = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.conflicts.list")!;
    const faqs = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.faq-candidates.list")!;
    const analyze = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.faq-candidates.analyze")!;
    const approve = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.faq-candidate.approve")!;
    const reject = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.faq-candidate.reject")!;
    const remove = ASSISTANT_OPERATIONS.find(op => op.id === "company-knowledge.faq-candidate.delete")!;
    expect(health).toMatchObject({ method: "GET", path: "/gemini/knowledge-health", module: "company-knowledge", permissions: ["company-knowledge:read"], confirmation: false });
    expect(health.resultFields).toEqual(["mode", "documentsCount", "chunksCount", "detectedTopics", "warnings", "latestSyncAt"]);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === health.path)).toMatchObject({ status: "contract", id: health.id });
    expect(documents).toMatchObject({ method: "GET", path: "/company-knowledge/documents", module: "company-knowledge", permissions: ["company-knowledge:read"], confirmation: false });
    expect(documents.resultFields).not.toContain("sourceUrl");
    expect(documents.resultFields).not.toContain("createdBy");
    expect(deleteDocument.fields.find(field => field.key === "path_id")?.reference).toBe(documents.id);
    expect(defaultWorkflow(deleteDocument).confirmationLocked).toBe(true);
    expect(updateScopes.fields.find(field => field.key === "path_id")?.reference).toBe(documents.id);
    expect(updateScopes.fields.find(field => field.key === "pageScope")?.options).toEqual(["all"]);
    expect(defaultWorkflow(updateScopes).confirmationLocked).toBe(true);
    expect(conflicts.resultFields).toEqual(["type", "severity", "title", "documentA", "documentB"]);
    expect(faqs.fields.find(field => field.key === "query_status")?.options).toEqual(["pending", "approved", "rejected", "all"]);
    expect(faqs.resultFields).not.toContain("sampleCustomerMessages");
    expect(analyze).toMatchObject({ permissions: ["company-knowledge:manage"], confirmation: true });
    expect(approve.fields.find(field => field.key === "path_id")?.reference).toBe(faqs.id);
    expect(approve.fields.find(field => field.key === "customAnswer")?.required).toBe(false);
    for (const operation of [approve, reject, remove]) expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
  });

  it("connects student creation and updates with manage permissions and named references", () => {
    const students = ASSISTANT_OPERATIONS.find(op => op.id === "student.list")!;
    const courses = ASSISTANT_OPERATIONS.find(op => op.id === "course.list")!;
    const partners = ASSISTANT_OPERATIONS.find(op => op.id === "partner.list")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/students")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.method === "PATCH" && op.path === "/students/:id")!;

    expect(create).toMatchObject({ title: "Tạo hồ sơ học viên", confirmation: true });
    expect(create.permissionGroups).toEqual([["people:read"], ["people:manage"]]);
    expect(create.fields.filter(field => field.systemRequired).map(field => field.key)).toEqual(["fullName", "phone", "email", "registrationDate"]);
    expect(update).toMatchObject({ title: "Cập nhật hồ sơ học viên", confirmation: true });
    expect(update.permissionGroups).toEqual([["people:read"], ["people:manage"]]);
    expect(update.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "student.list", label: "Tên, số điện thoại hoặc email học viên" });
    expect(update.fields.find(field => field.key === "courseId")?.reference).toBe("course.list");
    expect(update.fields.find(field => field.key === "partnerId")?.reference).toBe("partner.list");
    expect(students.fields.find(field => field.apiKey === "search")?.source).toBe("query");
    expect(courses.fields.find(field => field.apiKey === "search")?.source).toBe("query");
    expect(partners.fields.find(field => field.apiKey === "search")?.source).toBe("query");
    const unassigned = ASSISTANT_OPERATIONS.find(op => op.id === "student.unassigned.list")!;
    const assignBranch = ASSISTANT_OPERATIONS.find(op => op.method === "PATCH" && op.path === "/students/:id/assign-branch")!;
    const batches = ASSISTANT_OPERATIONS.find(op => op.id === "batch.list")!;
    const miniTest = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/student-quality/batches/:batchId/students/:studentId/mini-tests")!;
    expect(unassigned.roles).toEqual(["admin"]);
    expect(assignBranch.roles).toEqual(["admin"]);
    expect(assignBranch.fields.find(field => field.key === "path_id")?.reference).toBe("student.unassigned.list");
    expect(assignBranch.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    expect(defaultWorkflow(assignBranch).confirmationLocked).toBe(true);
    expect(batches.fields.find(field => field.apiKey === "search")?.source).toBe("query");
    expect(miniTest.fields.find(field => field.key === "path_batchId")?.reference).toBe("batch.list");
    expect(miniTest.fields.find(field => field.key === "path_studentId")).toMatchObject({ reference: "batch.attendance.learners", referenceParentKey: "path_batchId" });
    expect(miniTest.fields.find(field => field.key === "score")?.required).toBe(true);
    expect(miniTest.fields.find(field => field.key === "maxScore")?.min).toBeGreaterThan(0);
    expect(defaultWorkflow(miniTest).confirmationLocked).toBe(true);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
  });

  it("connects fixed-asset lifecycle operations with integer amounts, named references, and accounting periods", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "finance.asset.list")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/assets")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.method === "PATCH" && op.path === "/finance/assets/:id")!;
    const transfer = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/assets/:id/transfer")!;
    const disposal = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/assets/:id/disposal")!;
    const run = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/assets/depreciations/run")!;
    const post = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/assets/depreciations/post")!;

    expect(list.resultFields).toContain("assetCode");
    expect(create).toMatchObject({ title: "Tạo tài sản cố định", permissions: ["asset:manage"], confirmation: true, dateOnlyToIsoUtc: ["purchaseDate", "inServiceDate"] });
    expect(create.fields.find(field => field.key === "originalCost")).toMatchObject({ required: true, min: 1, integer: true });
    expect(create.fields.find(field => field.key === "salvageValue")?.defaultValue).toBe(0);
    expect(update.fields.find(field => field.key === "path_id")?.reference).toBe("finance.asset.list");
    expect(transfer.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    expect(disposal.dateOnlyToIsoUtc).toEqual(["disposedAt"]);
    expect(run.fields.find(field => field.key === "period")?.pattern).toBe("^[0-9]{4}-(?:0[1-9]|1[0-2])$");
    expect(post.permissions).toEqual(["asset:manage"]);
    for (const op of [create, update, transfer, disposal, run, post]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
    expect(() => validateField(run.fields.find(field => field.key === "period")!, "2026-13")).toThrow();
  });

  it("connects branch-scoped asset inventory sessions with named references and required confirmation", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "finance.asset.inventory.list")!;
    const open = ASSISTANT_OPERATIONS.find(op => op.id === "finance.asset.inventory.open")!;
    const count = ASSISTANT_OPERATIONS.find(op => op.id === "finance.asset.inventory.count")!;
    const variance = ASSISTANT_OPERATIONS.find(op => op.id === "finance.asset.inventory.variance")!;
    const finalize = ASSISTANT_OPERATIONS.find(op => op.id === "finance.asset.inventory.finalize")!;
    expect(list.resultFields).toContain("sessionCode");
    expect(open).toMatchObject({ permissions: ["asset:manage"], confirmation: true, dateOnlyToIsoUtc: ["inventoryDate"] });
    expect(open.fields.map(field => field.key)).toEqual(["sessionCode", "name", "inventoryDate"]);
    expect(count.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id, label: "Mã hoặc tên phiên kiểm kê" });
    expect(count.fields.find(field => field.key === "result")?.options).toEqual(["present", "damaged", "surplus"]);
    expect(variance.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(finalize.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    for (const op of [open, count, finalize]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("connects the current transfer lifecycle through selected branches and visible warehouse/SKU names", () => {
    const transferList = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.transfer.list")!;
    const detail = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.transfer.detail")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.transfer.create")!;
    const accept = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.transfer.accept")!;
    const cancel = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.transfer.cancel")!;
    expect(create).toMatchObject({ permissions: ["inventory:manage"], confirmation: true, contextBody: ["idempotencyKey"] });
    expect(create.fields.find(field => field.key === "targetBranch")).toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list", required: false });
    expect(create.fields.find(field => field.key === "toBranch")).toMatchObject({ apiKey: "toBranchId", reference: "branch.list" });
    expect(create.fields.find(field => field.key === "fromWarehouseId")?.reference).toBe("inventory.warehouse.locations.list");
    expect(create.fields.some(field => field.key === "toWarehouseId")).toBe(false);
    expect(create.fields.find(field => field.key === "items")?.structure?.items?.keys?.productId?.reference).toBe("product.list");
    expect(create.fields.find(field => field.key === "items")?.structure?.items?.keys?.variantId).toMatchObject({ reference: "inventory.product.detail", referenceParentKey: "productId" });
    expect(create.fields.find(field => field.key === "items")?.structure?.items?.keys?.unitIdentifiers?.label).toContain("IMEI/serial");
    expect(detail.fields.find(field => field.key === "path_id")?.reference).toBe(transferList.id);
    expect(accept.fields.find(field => field.key === "path_id")).toMatchObject({ reference: transferList.id });
    expect(cancel.fields.find(field => field.key === "reason")?.required).toBe(true);
    expect(ASSISTANT_OPERATIONS.some(op => op.path === "/inventory/transfers/:id/reverse")).toBe(false);
    for (const op of [create, accept, cancel]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("connects serial lookup, history, and stock registration with branch and product/SKU references", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.serial.list")!;
    const detail = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.serial.detail")!;
    const history = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.serial.history")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.serial.create")!;
    const transition = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.serial.transition")!;
    expect(list).toMatchObject({ permissions: ["inventory:read"], path: "/inventory/serials" });
    expect(list.fields.find(field => field.key === "targetBranch")).toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list", required: false });
    expect(list.fields.find(field => field.apiKey === "barcodes")).toMatchObject({ source: "query", required: false });
    expect(detail.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id, label: "IMEI, serial hoặc mã vạch" });
    expect(history.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(create).toMatchObject({ permissions: ["inventory:manage"], confirmation: true });
    expect(create.fields.find(field => field.key === "targetBranch")?.reference).toBe("branch.list");
    expect(create.fields.find(field => field.key === "productId")).toMatchObject({ reference: "product.list", source: "body" });
    expect(create.fields.find(field => field.key === "sku")).toMatchObject({ reference: "inventory.product.detail", referenceParentKey: "productId", referenceValueKey: "sku" });
    expect(create.fields.find(field => field.key === "serialNumber")?.required).toBe(false);
    expect(create.fields.find(field => field.key === "serialNumbers")?.required).toBe(false);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    expect(transition).toMatchObject({ permissions: ["inventory:manage"], confirmation: true });
    expect(transition.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(transition.fields.find(field => field.key === "toStatus")?.options).toEqual(["lost", "in_stock", "defective", "repairing", "scrapped"]);
    expect(transition.fields.find(field => field.key === "reason")?.required).toBe(true);
    expect(defaultWorkflow(transition).confirmationLocked).toBe(true);

    const request = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.serial.transfer.request")!;
    const accept = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.serial.transfer.accept")!;
    const cancel = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.serial.transfer.cancel")!;
    for (const operation of [request, accept, cancel]) {
      expect(operation).toMatchObject({ permissions: ["inventory:manage"], confirmation: true });
      expect(operation.permissionGroups).toEqual([["inventory:manage"], ["inventory:read"], ["access:read", "hr:read"]]);
      expect(operation.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id });
      expect(operation.resultFields).toEqual(["serialNumber", "sku", "productName", "status"]);
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
    }
    expect(request.path).toBe("/inventory/serials/:id/transfer/request");
    expect(request.fields.find(field => field.key === "toBranch")).toMatchObject({ apiKey: "toBranchId", reference: "branch.list", required: true });
    expect(request.fields.some(field => field.key === "toWarehouseId")).toBe(false);
    expect(request.fields.find(field => field.key === "reason")?.required).toBe(true);
    expect(accept.path).toBe("/inventory/serials/:id/transfer/accept");
    expect(cancel.path).toBe("/inventory/serials/:id/transfer/cancel");
    expect(cancel.fields.find(field => field.key === "reason")?.required).toBe(true);
    const localTransfer = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.serial.transfer.local")!;
    expect(localTransfer).toMatchObject({ method: "POST", path: "/inventory/serials/:id/transfer", confirmation: true, systemBodyFields: ["toBranchId"] });
    expect(localTransfer.permissionGroups).toEqual([["inventory:manage"], ["inventory:read"], ["access:read", "hr:read"]]);
    expect(localTransfer.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id });
    expect(localTransfer.fields.find(field => field.key === "targetBranch")).toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list" });
    expect(localTransfer.fields.find(field => field.key === "toWarehouseId")).toMatchObject({ reference: "inventory.warehouse.locations.list", referenceParentKey: "targetBranch", required: true });
    expect(localTransfer.description).toContain("trong cùng chi nhánh");
    expect(defaultWorkflow(localTransfer).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === localTransfer.path)).toMatchObject({ status: "contract", id: localTransfer.id });

    expect(ASSISTANT_OPERATIONS.some(op => op.path === "/inventory/transfers/destinations")).toBe(false);
    expect(coverage.entries.find(entry => entry.path === "/inventory/transfers/destinations")).toMatchObject({ status: "unsupported" });
  });

  it("updates warranty by the visible serial code and requires branch scope and confirmation", () => {
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "retail.warranty.serial.update")!;
    expect(update).toMatchObject({
      method: "PATCH",
      path: "/retail/warranty/serial/by-code/:code",
      permissions: ["retail:manage"],
      confirmation: true,
    });
    expect(update.fields.find(field => field.key === "path_code")).toMatchObject({ source: "path", label: "IMEI, số sê-ri hoặc mã vạch nội bộ" });
    expect(update.fields.find(field => field.key === "targetBranch")).toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list" });
    expect(update.fields.find(field => field.key === "months")).toMatchObject({ required: true, min: 0, max: 1200, integer: true });
    expect(update.resultFields).not.toContain("_id");
  });

  it("connects inventory count item updates by visible count code and SKU", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.count.list")!;
    const detail = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.count.detail")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.count.item.update")!;
    expect(list).toMatchObject({ method: "GET", path: "/inventory/counts", permissions: ["inventory:read"] });
    expect(list.fields.find(field => field.key === "targetBranch")).toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list", required: false });
    expect(detail.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id });
    expect(update).toMatchObject({ method: "PATCH", path: "/inventory/counts/:id/items/:itemId", confirmation: true, permissionGroups: [["inventory:manage", "inventory:read"]] });
    expect(update.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id, label: "Mã hoặc tên phiếu kiểm kê" });
    expect(update.fields.find(field => field.key === "path_itemId")).toMatchObject({ reference: detail.id, referenceParentKey: "path_id", label: "SKU hoặc tên sản phẩm trong phiếu kiểm kê" });
    expect(update.fields.find(field => field.key === "countedQuantity")).toMatchObject({ required: false, min: 0 });
    expect(update.fields.find(field => field.key === "note")).toMatchObject({ required: false, max: 500 });
    expect(update.resultFields).toEqual(["countCode", "status", "updatedItem"]);
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "PATCH" && entry.path === "/inventory/counts/:id/items/:itemId")).toMatchObject({ status: "contract", id: update.id });
  });

  it("connects the new customer history and repair refund workflows with protected write rules", () => {
    expect(ASSISTANT_OPERATIONS.find(op => op.id === "customer.transactions")).toMatchObject({ method: "GET", path: "/customers/:id/transactions", rawResponse: true });
    expect(ASSISTANT_OPERATIONS.find(op => op.id === "customer.transaction.detail")).toMatchObject({ method: "GET", path: "/customers/:id/transactions/:kind/:sourceId", rawResponse: true });
    expect(ASSISTANT_OPERATIONS.find(op => op.id === "repair.refund.summary")).toMatchObject({ method: "GET", path: "/repair/tickets/:id/refunds" });
    expect(ASSISTANT_OPERATIONS.find(op => op.id === "repair.refund.vouchers")).toMatchObject({ permissionGroups: [["repair:manage"], ["finance-wallet:manage"]] });
    const refund = ASSISTANT_OPERATIONS.find(op => op.id === "repair.refund.create")!;
    expect(refund).toMatchObject({ method: "POST", path: "/repair/tickets/:id/refunds", confirmation: true, contextBody: ["idempotencyKey"] });
    expect(defaultWorkflow(refund).confirmationLocked).toBe(true);
  });

  it("exposes commission configuration with Vietnamese fields and write permissions", () => {
    const partnerUpdate = ASSISTANT_OPERATIONS.find(op => op.method === "PATCH" && op.path === "/partners/:id")!;
    const partnerDetail = ASSISTANT_OPERATIONS.find(op => op.method === "GET" && op.path === "/partners/:id")!;
    const partnerBulkCreate = ASSISTANT_OPERATIONS.find(op => op.id === "partner.bulk.create")!;
    const bankDetails = ASSISTANT_OPERATIONS.find(op => op.id === "partner.bank-details.update")!;
    const partnerCommission = ASSISTANT_OPERATIONS.find(op => op.id === "partner.commission.update")!;
    const list = ASSISTANT_OPERATIONS.find(op => op.method === "GET" && op.path === "/partners/commission-levels")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/partners/commission-levels")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.method === "PATCH" && op.path === "/partners/commission-levels/:id")!;
    const remove = ASSISTANT_OPERATIONS.find(op => op.method === "DELETE" && op.path === "/partners/commission-levels/:id")!;
    expect(partnerUpdate).toMatchObject({ title: "Cập nhật thông tin liên hệ đối tác", confirmation: true });
    expect(partnerUpdate.fields.find(field => field.key === "path_id")?.reference).toBe("partner.list");
    expect(partnerUpdate.fields.map(field => field.apiKey)).not.toEqual(expect.arrayContaining(["bankName", "bankAccountNo", "bankAccountName", "commissionType", "commissionValue"]));
    expect(partnerUpdate.fields.map(field => field.apiKey)).toEqual(expect.arrayContaining(["name", "phone", "email", "isActive", "notes"]));
    expect(partnerDetail).toMatchObject({ title: "Xem thông tin đối tác", resultFields: expect.arrayContaining(["bankName", "bankAccountNo", "commissionType", "commissionValue"]) });
    expect(partnerBulkCreate).toMatchObject({ title: "Tạo nhiều đối tác", confirmation: true, resultFields: ["importedCount", "skippedCount", "errors"] });
    expect(partnerBulkCreate.fields.find(field => field.apiKey === "partners")?.structure).toMatchObject({ minItems: 1, maxItems: 100 });
    expect(defaultWorkflow(partnerBulkCreate).confirmationLocked).toBe(true);
    expect(bankDetails).toMatchObject({ title: "Cập nhật thông tin chuyển khoản đối tác", method: "PATCH", path: "/partners/:id", confirmation: true });
    expect(bankDetails.fields.filter(field => field.source === "body").map(field => field.apiKey)).toEqual(["bankName", "bankAccountNo", "bankAccountName"]);
    expect(bankDetails.fields.filter(field => field.source === "body").every(field => field.required)).toBe(true);
    expect(bankDetails.fields.find(field => field.key === "path_id")?.reference).toBe("partner.list");
    expect(partnerCommission).toMatchObject({ title: "Cấu hình hoa hồng cho đối tác", method: "PATCH", path: "/partners/:id", confirmation: true });
    expect(partnerCommission.fields.find(field => field.key === "path_id")?.reference).toBe("partner.list");
    expect(partnerCommission.fields.find(field => field.key === "commissionType")).toMatchObject({ required: true, options: ["percentage", "fixed"] });
    expect(partnerCommission.fields.find(field => field.key === "commissionValue")).toMatchObject({ required: true, min: 0 });
    expect(defaultWorkflow(partnerCommission).confirmationLocked).toBe(true);
    for (const operation of [partnerUpdate, partnerBulkCreate, bankDetails, partnerCommission, create, update, remove]) {
      expect(operation.permissionGroups).toEqual([["relationship:manage"]]);
    }
    expect(partnerUpdate.systemBodyFields).toContain("expectedVersion");
    expect(list).toMatchObject({ title: "Tra cứu cấu hình hoa hồng", permissions: ["relationship:read"], resultFields: ["name", "minTuition", "commissionRate"] });
    expect(create).toMatchObject({ title: "Tạo cấu hình hoa hồng", permissions: ["relationship:manage"], confirmation: true });
    expect(create.permissionGroups).toEqual([["relationship:manage"]]);
    expect(create.fields.find(field => field.key === "name")?.label).toBe("Tên cấp bậc hoa hồng");
    expect(create.fields.find(field => field.key === "minTuition")?.label).toBe("Doanh số tối thiểu (VND)");
    expect(create.fields.find(field => field.key === "commissionRate")?.max).toBe(100);
    expect(update.fields.find(field => field.key === "path_id")?.label).toBe("Tên hoặc mã cấp bậc hoa hồng");
    expect(update.fields.find(field => field.key === "path_id")?.reference).toBe("partner.commission.levels.list");
    expect(update.permissionGroups).toEqual([["relationship:manage"]]);
    expect(remove.permissionGroups).toEqual([["relationship:manage"]]);
    expect(create.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    expect(list.resultFields).toContain("commissionRate");
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
  });

  it("exposes annual leave balance only for the authenticated employee", () => {
    const balance = ASSISTANT_OPERATIONS.find(op => op.id === "leave.balance.me")!;
    expect(balance).toMatchObject({ method: "GET", path: "/leave/balance", permissions: ["hr:read"], permissionGroups: [["hr:read"]] });
    expect(balance.fields.map(field => field.apiKey)).toEqual(["year"]);
    expect(balance.fields[0]).toMatchObject({ source: "query", min: 2000, max: 2200, integer: true });
    expect(balance.resultFields).toEqual(["year", "entitlement", "used", "pending", "unexcused", "remaining"]);
  });

  it("exposes today's attendance only for the authenticated employee", () => {
    const today = ASSISTANT_OPERATIONS.find(op => op.id === "timekeeping.today.me")!;
    expect(today).toMatchObject({ method: "GET", path: "/timekeeping/today", permissionGroups: [["chat:read"]], confirmation: false });
    expect(today.fields).toEqual([]);
    expect(today.resultFields).toEqual(["date", "isWorkingDay", "dayLabel", "attendanceStatus", "checkIn", "checkOut"]);
  });

  it("exposes a company or branch scoped employee attendance report by name", () => {
    const report = ASSISTANT_OPERATIONS.find(op => op.id === "timekeeping.records.list")!;
    expect(report).toMatchObject({ method: "GET", path: "/timekeeping/records", permissionGroups: [["timekeeping:read"]], confirmation: false });
    expect(report.fields.find(field => field.apiKey === "date")).toMatchObject({ source: "query", required: false });
    expect(report.resultFields).toEqual(["date", "employeeName", "attendanceStatus", "checkIn", "checkOut"]);
  });

  it("connects shift, assignment, and employee work-hour workflows through names", () => {
    const shifts = ASSISTANT_OPERATIONS.find(op => op.id === "api.get.d632a938b9c72492")!;
    const createShift = ASSISTANT_OPERATIONS.find(op => op.id === "api.post.4e68581113f1ef79")!;
    const updateShift = ASSISTANT_OPERATIONS.find(op => op.id === "api.patch.08411917f1ed9b75")!;
    const deleteShift = ASSISTANT_OPERATIONS.find(op => op.id === "api.delete.39330ed93a819149")!;
    const assignmentList = ASSISTANT_OPERATIONS.find(op => op.id === "api.get.efd26957a4dbe889")!;
    const assign = ASSISTANT_OPERATIONS.find(op => op.id === "api.post.5511b45cf3a736d1")!;
    const workHours = ASSISTANT_OPERATIONS.find(op => op.id === "api.get.5d0d3ea4fc0d9efb")!;
    const updateWorkHours = ASSISTANT_OPERATIONS.find(op => op.id === "api.patch.6bc968347283a069")!;

    for (const operation of [shifts, createShift, updateShift, deleteShift, assignmentList, assign, workHours, updateWorkHours]) {
      expect(operation.permissions).toContain("timekeeping:manage");
    }
    expect(shifts).toMatchObject({ method: "GET", path: "/timekeeping/shifts", confirmation: false });
    expect(shifts.title).toBe("Tra cứu ca làm việc");
    expect(createShift).toMatchObject({ method: "POST", confirmation: true });
    expect(createShift.fields.find(field => field.apiKey === "workingDays")?.structure?.items?.options).toEqual(["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]);
    expect(updateShift).toMatchObject({ method: "PATCH", confirmation: true });
    expect(updateShift.fields.find(field => field.key === "path_id")).toMatchObject({ reference: shifts.id, label: "Tên hoặc mã ca cần cập nhật" });
    expect(deleteShift.fields.find(field => field.key === "path_id")?.reference).toBe(shifts.id);
    expect(defaultWorkflow(createShift).confirmationLocked).toBe(true);
    expect(defaultWorkflow(updateShift).confirmationLocked).toBe(true);
    expect(defaultWorkflow(deleteShift).confirmationLocked).toBe(true);

    expect(assignmentList.resultFields).toContain("shiftName");
    expect(assign.fields.find(field => field.apiKey === "employeeIds")?.structure?.items).toMatchObject({ reference: "employee.list", referenceValueKey: "id" });
    expect(assign.fields.find(field => field.apiKey === "shiftId")).toMatchObject({ reference: shifts.id, referenceValueKey: "id" });
    expect(defaultWorkflow(assign).confirmationLocked).toBe(true);
    expect(updateWorkHours).toMatchObject({ method: "PATCH", path: "/timekeeping/work-hours/:uid", confirmation: true, mergeBodyWithReference: true });
    expect(updateWorkHours.fields.find(field => field.key === "path_uid")).toMatchObject({ reference: workHours.id, label: "Tên hoặc email nhân viên cần cập nhật giờ làm" });
    expect(updateWorkHours.fields.find(field => field.apiKey === "useCustom")).toMatchObject({ required: false, type: "boolean" });
    expect(updateWorkHours.fields.find(field => field.apiKey === "workingDays")?.structure?.items?.options).toContain("Thứ 2");
    expect(defaultWorkflow(updateWorkHours).confirmationLocked).toBe(true);
    for (const operation of [shifts, createShift, updateShift, deleteShift, assignmentList, assign, workHours, updateWorkHours]) {
      expect(coverage.entries).toContainEqual(expect.objectContaining({ method: operation.method, path: operation.path, status: "contract", id: operation.id }));
    }
  });

  it("connects read-only timekeeping settings with safe scope and roles", () => {
    const location = ASSISTANT_OPERATIONS.find(op => op.id === "timekeeping.company.location")!;
    const attempts = ASSISTANT_OPERATIONS.find(op => op.id === "api.get.d2e63aaeb8682c88")!;
    const locationUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "api.patch.cbf8c2b9d544f837")!;
    const calendar = ASSISTANT_OPERATIONS.find(op => op.id === "timekeeping.work-calendar.list")!;
    const calendarAudit = ASSISTANT_OPERATIONS.find(op => op.id === "timekeeping.work-calendar.audit")!;
    const calendarSync = ASSISTANT_OPERATIONS.find(op => op.id === "timekeeping.work-calendar.sync")!;
    const calendarCreate = ASSISTANT_OPERATIONS.find(op => op.id === "timekeeping.work-calendar.create")!;
    const calendarUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "timekeeping.work-calendar.update")!;
    expect(location).toMatchObject({ method: "GET", permissionGroups: [["chat:read"], ["timekeeping:manage"]], confirmation: false });
    expect(location.resultFields).toEqual(["addressName", "allowedRadius", "checkInLimit", "checkOutLimit", "lunchBreakStart", "lunchBreakEnd", "annualLeaveDays", "workDays"]);
    expect(location.resultFields).not.toContain("latitude");
    expect(location.resultFields).not.toContain("longitude");
    expect(attempts).toMatchObject({ method: "GET", path: "/timekeeping/attempts", permissions: ["timekeeping:manage"], confirmation: false });
    expect(attempts.fields.find(field => field.apiKey === "date")).toMatchObject({ required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
    expect(attempts.resultFields).not.toContain("latitude");
    expect(attempts.resultFields).not.toContain("longitude");
    expect(attempts.resultFields).not.toContain("ipAddress");
    expect(locationUpdate).toMatchObject({ method: "PATCH", path: "/timekeeping/company-location", permissions: ["timekeeping:manage"], confirmation: true });
    expect(locationUpdate.fields.find(field => field.apiKey === "latitude")).toMatchObject({ required: false, min: -90, max: 90 });
    expect(locationUpdate.fields.find(field => field.apiKey === "longitude")).toMatchObject({ required: false, min: -180, max: 180 });
    expect(locationUpdate.resultFields).not.toContain("latitude");
    expect(locationUpdate.resultFields).not.toContain("longitude");
    expect(defaultWorkflow(locationUpdate).confirmationLocked).toBe(true);
    expect(calendar).toMatchObject({ method: "GET", roles: ["admin", "superadmin"], permissionGroups: [["chat:read"]], confirmation: false });
    expect(calendar.fields.find(field => field.apiKey === "year")).toMatchObject({ defaultValue: new Date().getFullYear(), min: 2000, max: 2200 });
    expect(calendar.fields.find(field => field.apiKey === "year")?.label).toBe("Năm");
    expect(calendar.resultFields).toEqual(["date", "name", "dayTypeLabel", "isApplied"]);
    expect(calendarCreate).toMatchObject({ method: "POST", path: "/timekeeping/work-calendar", roles: ["admin", "superadmin"], permissions: ["timekeeping:manage"], confirmation: true });
    expect(calendarCreate.fields.find(field => field.apiKey === "date")).toMatchObject({ required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
    expect(calendarCreate.fields.find(field => field.apiKey === "dayType")?.options).toEqual(["holiday", "substitute_holiday", "working_override"]);
    expect(calendarSync).toMatchObject({ method: "POST", path: "/timekeeping/work-calendar/sync", roles: ["admin", "superadmin"], permissions: ["timekeeping:manage"], confirmation: true, resultFields: ["calendarDaysCount"] });
    expect(calendarSync.fields.find(field => field.apiKey === "year")).toMatchObject({ required: true, min: 2026, max: 2026 });
    expect(defaultWorkflow(calendarSync).confirmationLocked).toBe(true);
    expect(calendarUpdate).toMatchObject({ method: "PATCH", path: "/timekeeping/work-calendar/:id", roles: ["admin", "superadmin"], permissions: ["timekeeping:manage"], confirmation: true });
    expect(calendarUpdate.fields.find(field => field.key === "path_id")?.reference).toBe(calendar.id);
    expect(calendarUpdate.fields.find(field => field.apiKey === "adminReason")?.requiredWhen).toEqual({ field: "isApplied", equals: false });
    expect(calendarUpdate.description).toContain("chỉ cho phép bật/tắt");
    expect(calendarAudit).toMatchObject({
      method: "GET",
      path: "/timekeeping/work-calendar/:id/audit",
      roles: ["admin", "superadmin"],
      permissionGroups: [["chat:read"]],
      confirmation: false,
      resultFields: ["action", "reason", "createdAt"],
    });
    expect(calendarAudit.fields.find(field => field.key === "path_id")).toMatchObject({
      label: "Tên hoặc mã ngày trong lịch công ty",
      reference: "timekeeping.work-calendar.list",
    });
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === calendarAudit.path)).toMatchObject({ status: "contract", id: calendarAudit.id });
  });

  it("exposes only self-service account name and email operations", () => {
    const profile = ASSISTANT_OPERATIONS.find(op => op.id === "account.profile.me")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "account.profile.update")!;
    const businessSettings = ASSISTANT_OPERATIONS.find(op => op.id === "account.business-settings.update")!;
    expect(profile).toMatchObject({ module: "chat", method: "GET", path: "/auth/me", permissionGroups: [["chat:read"]], resultFields: ["displayName", "email"] });
    expect(update).toMatchObject({ module: "chat", method: "PATCH", path: "/auth/profile", permissionGroups: [["chat:read"]], confirmation: true, resultFields: ["displayName"] });
    expect(update.fields.map(field => field.apiKey)).toEqual(["displayName"]);
    expect(update.fields[0]).toMatchObject({ systemRequired: true, min: 1, max: 120 });
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(businessSettings).toMatchObject({ method: "PATCH", path: "/auth/business-settings", permissions: ["people:manage"], confirmation: true });
    expect(businessSettings.fields).toHaveLength(1);
    expect(businessSettings.fields[0]).toMatchObject({ apiKey: "businessType", systemRequired: true, options: ["driving", "language", "general"] });
    expect(businessSettings.description).toContain("tài khoản đang đăng nhập");
    expect(coverage.entries.find(entry => entry.method === "PATCH" && entry.path === businessSettings.path)).toMatchObject({ status: "contract", id: businessSettings.id });
    expect(defaultWorkflow(businessSettings).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/auth/me")).toMatchObject({ status: "contract", id: "account.profile.me" });
    expect(inventory.endpoints.find(endpoint => endpoint.method === "GET" && endpoint.path === "/auth/me")?.ambiguous).toBe(true);
  });

  it("exposes payroll self-service without accepting another employee's identity", () => {
    const reconciliation = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.employee.me.reconciliation")!;
    const action = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.employee.reconciliation.action")!;
    const payslips = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.employee.me.payslips")!;
    const requests = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.employee.me.payslip.review-requests")!;
    const requestReview = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.employee.me.payslip.review.request")!;

    expect([reconciliation, action, payslips, requests, requestReview]).toHaveLength(5);
    for (const operation of [reconciliation, action, payslips, requests, requestReview]) {
      expect(operation.permissionGroups).toEqual([["chat:read"]]);
      expect(operation.fields.some(field => field.apiKey === "employeeId")).toBe(false);
      expect(operation.resultFields).not.toContain("employeeId");
    }
    expect(action).toMatchObject({ method: "POST", confirmation: true, systemBodyFields: ["expectedVersion", "issueId"] });
    expect(action.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "payroll.employee.me.reconciliation", label: "Kỳ lương cần đối soát (YYYY-MM)" });
    expect(action.fields.find(field => field.apiKey === "action")?.label).toBe("Thao tác");
    expect(action.fields.find(field => field.apiKey === "field")?.label).toBe("Khoản lương cần trao đổi");
    expect(action.fields.find(field => field.apiKey === "expectedVersion")).toBeUndefined();
    expect(action.fields.find(field => field.apiKey === "issueId")).toBeUndefined();
    expect(requestReview.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "payroll.employee.me.payslips" });
    expect(defaultWorkflow(action).confirmationLocked).toBe(true);
    expect(defaultWorkflow(requestReview).confirmationLocked).toBe(true);
  });

  it("exposes labor-partner commission policies and resolves policies by name", () => {
    const partnerList = ASSISTANT_OPERATIONS.find(op => op.id === "worker.partner.list")!;
    const policyList = ASSISTANT_OPERATIONS.find(op => op.id === "worker.partner.policy.list")!;
    const policyCreate = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/worker-management/partners/policies")!;
    const policyUpdate = ASSISTANT_OPERATIONS.find(op => op.method === "PATCH" && op.path === "/worker-management/partners/policies/:policyId")!;
    const partnerCreate = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/worker-management/partners")!;
    expect(partnerList.resultFields).toContain("name");
    expect(policyList.resultFields).toContain("seasonal");
    expect(policyCreate).toMatchObject({ title: "Tạo chính sách hoa hồng đối tác lao động", confirmation: true });
    expect(policyCreate.fields.find(field => field.key === "official")?.type).toBe("json");
    expect(policyCreate.fields.find(field => field.key === "seasonal")?.structure?.keys?.hourRounding).toMatchObject({
      requiredWhen: { field: "enabled", equals: true },
      label: "Quy tắc làm tròn giờ",
    });
    expect(policyUpdate.fields.find(field => field.key === "path_policyId")?.reference).toBe("worker.partner.policy.list");
    expect(partnerCreate.fields.find(field => field.key === "defaultPolicyId")?.reference).toBe("worker.partner.policy.list");
    expect(defaultWorkflow(policyCreate).confirmationLocked).toBe(true);
    expect(defaultWorkflow(policyUpdate).confirmationLocked).toBe(true);
  });

  it("exposes a confirmed monthly referral KPI workflow for labor partners", () => {
    const operation = ASSISTANT_OPERATIONS.find(op => op.id === "worker.partner.kpi.set")!;
    expect(operation).toMatchObject({
      method: "PUT",
      path: "/worker-management/partners/kpi/:partnerId",
      permissions: ["labor-partner:manage"],
      confirmation: true,
      title: "Đặt KPI giới thiệu cho đối tác lao động",
    });
    expect(operation.fields.find(field => field.key === "path_partnerId")).toMatchObject({
      reference: "worker.partner.list",
      label: "Tên hoặc mã đối tác lao động",
    });
    expect(operation.fields.find(field => field.key === "targetReferrals")).toMatchObject({ required: true, min: 0, max: 100000, integer: true });
    expect(operation.fields.find(field => field.key === "periodAnchor")).toMatchObject({ required: true, type: "date", label: "Tháng áp dụng" });
    expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
  });

  it("connects labor-partner referral lookup and pending confirmation by partner and worker names", () => {
    const partnerList = ASSISTANT_OPERATIONS.find(op => op.id === "worker.partner.list")!;
    const workerList = ASSISTANT_OPERATIONS.find(op => op.id === "worker.list")!;
    const referrals = ASSISTANT_OPERATIONS.find(op => op.id === "worker.partner.referrals.list")!;
    const workerReferrals = ASSISTANT_OPERATIONS.find(op => op.id === "worker.partner.worker-referral.list")!;
    const confirm = ASSISTANT_OPERATIONS.find(op => op.id === "worker.partner.referral.confirm")!;

    expect(referrals.fields.find(field => field.key === "path_partnerId")).toMatchObject({ reference: partnerList.id, label: "Tên hoặc mã đối tác lao động" });
    expect(referrals.resultFields).toContain("workerName");
    expect(workerReferrals.fields.find(field => field.key === "path_workerId")).toMatchObject({ reference: workerList.id, label: "Tên người lao động" });
    expect(workerReferrals.resultFields).toContain("partnerName");
    expect(confirm).toMatchObject({ permissions: ["labor-partner:manage"], confirmation: true });
    expect(confirm.fields.find(field => field.key === "path_partnerId")).toMatchObject({ reference: partnerList.id });
    expect(confirm.fields.find(field => field.key === "path_referralId")).toMatchObject({ reference: referrals.id, referenceParentKey: "path_partnerId" });
    expect(defaultWorkflow(confirm).confirmationLocked).toBe(true);
  });

  it("resolves labor-partner settlement recalculation by partner and period labels", () => {
    const settlementList = ASSISTANT_OPERATIONS.find(op => op.id === "worker.partner.settlements.list")!;
    const recalculate = ASSISTANT_OPERATIONS.find(op => op.id === "worker.partner.settlement.recalculate")!;
    expect(settlementList.resultFields).toEqual(expect.arrayContaining(["partnerName", "periodStart", "periodEnd", "status", "totalAmount"]));
    expect(recalculate).toMatchObject({ method: "POST", confirmation: true, title: "Tính lại kỳ đối soát hoa hồng đối tác lao động" });
    expect(recalculate.fields.find(field => field.key === "path_settlementId")).toMatchObject({ reference: "worker.partner.settlements.list", label: "Tên hoặc mã đối tác, kỳ đối soát hoặc trạng thái" });
    expect(defaultWorkflow(recalculate).confirmationLocked).toBe(true);
  });

  it("connects retail cashbook reads and confirmed vouchers within a named branch", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "retail.finance.cashbook.list")!;
    const reconcile = ASSISTANT_OPERATIONS.find(op => op.id === "retail.finance.cashbook.reconcile")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "retail.finance.cashbook.voucher.create")!;
    expect(list).toMatchObject({ permissions: ["retail:manage"], confirmation: false, resultFields: expect.arrayContaining(["entries", "summary", "shiftsReconciliation"]) });
    expect(list.fields.find(field => field.key === "query_from")?.required).toBe(true);
    expect(list.fields.find(field => field.key === "query_to")?.required).toBe(true);
    expect(list.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    expect(reconcile).toMatchObject({ permissions: ["retail:manage"], confirmation: false });
    expect(reconcile.resultFields).toEqual(expect.arrayContaining(["period", "balanced"]));
    expect(create).toMatchObject({ permissions: ["retail:manage"], confirmation: true, contextBody: ["idempotencyKey"] });
    expect(create.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    for (const key of ["businessDate", "account", "direction", "amount", "reason"]) expect(create.fields.find(field => field.key === key)?.required).toBe(true);
    expect(create.fields.find(field => field.key === "profitCategory")?.defaultValue).toBe("other");
    expect(create.fields.some(field => field.apiKey === "idempotencyKey")).toBe(false);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/retail/finance/cashbook/close")).toMatchObject({ status: "contract", id: "retail.finance.cashbook.close" });
    expect(ASSISTANT_OPERATIONS.some(op => op.path === "/retail/finance/cashbook/close")).toBe(true);
  });

  it("exposes pending SePay review by payment label without banking secrets", () => {
    const pending = ASSISTANT_OPERATIONS.find(op => op.id === "retail.payment-review.pending")!;
    const review = ASSISTANT_OPERATIONS.find(op => op.id === "retail.payment-review.review")!;
    expect(pending).toMatchObject({ method: "GET", path: "/retail/payment-review", resultFields: expect.arrayContaining(["code", "orderCode", "receivedAmount", "reviewReason"]) });
    expect(pending.permissionGroups).toEqual([["retail-payment-review:read"], ["retail-payment-review:manage"]]);
    expect(pending.resultFields).not.toEqual(expect.arrayContaining(["transactionId", "accountNumber", "companyCode"]));
    expect(review).toMatchObject({ method: "POST", path: "/retail/payment-review/:id/review", permissions: ["retail-payment-review:manage"], confirmation: true });
    expect(review.fields.find(field => field.key === "path_id")).toMatchObject({ reference: pending.id, label: "Mã đơn hoặc mã thanh toán cần rà soát" });
    expect(review.fields.find(field => field.key === "note")).toMatchObject({ required: true, max: 500, label: "Kết quả rà soát" });
    expect(defaultWorkflow(review).confirmationLocked).toBe(true);
  });

  it("connects recruitment operations with explicit permission groups, branch scope, names, and confirmation", () => {
    const jobList = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.job.list")!;
    const jobCreate = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.job.create")!;
    const jobUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.job.update")!;
    const applicantCreate = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.applicant.create")!;
    const transition = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.applicant.transition")!;
    const interviewCreate = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.interview.create")!;
    const pipelineUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "recruitment.pipeline.update")!;

    expect(jobList).toMatchObject({ permissions: ["recruitment:read"], confirmation: false });
    expect(jobList.fields.find(field => field.key === "branchId")).toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list", required: true });
    expect(jobCreate).toMatchObject({ title: "Tạo vị trí tuyển dụng", permissions: ["recruitment:manage"], confirmation: true });
    expect(jobCreate.fields.filter(field => field.systemRequired).map(field => field.key)).toContain("code");
    expect(jobCreate.fields.filter(field => field.systemRequired).map(field => field.key)).toContain("title");
    expect(collectValues(defaultWorkflow(jobCreate), { branchId: "507f1f77bcf86cd799439012", code: "DEV-01", title: "Kỹ sư QA", status: "open" }).missing).toEqual(expect.arrayContaining(["Mô tả", "Yêu cầu ứng viên", "Số lượng tuyển", "Hình thức làm việc", "Địa điểm", "Hạn nhận hồ sơ"]));
    expect(jobUpdate.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "recruitment.job.list", label: "Tên hoặc mã vị trí tuyển dụng" });
    expect(jobUpdate.systemBodyFields).toEqual(["version"]);
    expect(jobUpdate.fields.some(field => field.apiKey === "version")).toBe(false);
    expect(applicantCreate.fields.find(field => field.key === "jobId")?.reference).toBe("recruitment.job.list");
    expect(applicantCreate.fields.find(field => field.key === "confirmDuplicate")?.defaultValue).toBe(false);
    expect(transition.fields.find(field => field.key === "stageId")).toMatchObject({ reference: "recruitment.pipeline.get", label: "Tên bước tuyển dụng tiếp theo" });
    expect(pipelineUpdate.title).toBe("Cập nhật các bước tuyển dụng");
    expect(interviewCreate.fields.find(field => field.key === "applicantId")?.reference).toBe("recruitment.applicant.list");
    expect(interviewCreate.fields.find(field => field.key === "jobId")?.required).toBe(false);
    expect(pipelineUpdate.fields.find(field => field.key === "stages")?.structure?.items?.keys?.id?.reference).toBe("recruitment.pipeline.get");
    for (const operation of ASSISTANT_OPERATIONS.filter(op => op.id.startsWith("recruitment.") && op.method !== "GET")) expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
    for (const route of inventory.endpoints.filter(endpoint => endpoint.path.startsWith("/recruitment/") && !endpoint.path.includes("attachment") && !endpoint.path.includes("/files/"))) {
      expect(route.permissions.length).toBeGreaterThan(0);
    }
  });

  it("connects retail commission and product catalog tasks with explicit guards and readable references", () => {
    const retailSettingsUpdate = ASSISTANT_OPERATIONS.find(op => op.method === "PUT" && op.path === "/retail/settings")!;
    const partnerList = ASSISTANT_OPERATIONS.find(op => op.id === "retail.partner.list")!;
    const partnerCreates = ["collaborator", "dealer", "supplier"].map(role => ASSISTANT_OPERATIONS.find(op => op.id === `retail.partner.create.${role}`)!);
    const partnerUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "retail.partner.update")!;
    const pointsPolicyRead = ASSISTANT_OPERATIONS.find(op => op.id === "retail.points.policy.get")!;
    const pointsPolicy = ASSISTANT_OPERATIONS.find(op => op.id === "retail.points.policy.update")!;
    const basePolicy = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/retail/partners/commission-policies")!;
    const partnerRate = ASSISTANT_OPERATIONS.find(op => op.method === "PUT" && op.path === "/retail/finance/commission/policies")!;
    const closeCashbookPeriod = ASSISTANT_OPERATIONS.find(op => op.id === "retail.finance.cashbook.close")!;
    const productCommission = ASSISTANT_OPERATIONS.find(op => op.method === "PUT" && op.path === "/retail/partners/product-commissions")!;
    const commissionProducts = ASSISTANT_OPERATIONS.find(op => op.id === "retail.partner.product.commission.products")!;
    const payout = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/retail/finance/commission/partners/:id/payouts")!;
    const receivableLatest = ASSISTANT_OPERATIONS.find(op => op.id === "retail.receivable.reconciliation.latest")!;
    const receivableRun = ASSISTANT_OPERATIONS.find(op => op.id === "retail.receivable.reconciliation.run")!;
    const receivableHistory = ASSISTANT_OPERATIONS.find(op => op.id === "retail.receivable.customer.history")!;
    const afterSaleList = ASSISTANT_OPERATIONS.find(op => op.id === "retail.after-sale.list")!;
    const afterSaleDetail = ASSISTANT_OPERATIONS.find(op => op.id === "retail.after-sale.detail")!;
    const adjustPoints = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/retail/points/customers/:id/adjust")!;
    const product = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.product.create.sellable")!;
    const receiving = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/inventory/receiving/receipts")!;

    expect(partnerList.resultFields).toContain("role");
    for (const partnerCreate of partnerCreates) expect(partnerCreate).toMatchObject({ permissions: ["retail-partner:manage"], confirmation: true });
    expect(partnerCreates[0].fields.find(field => field.key === "userId")?.reference).toBe("retail.partner.user.list");
    expect(partnerCreates[1].fields.find(field => field.key === "customerId")?.reference).toBe("retail.partner.customer.list");
    expect(partnerCreates[2].fields.find(field => field.key === "supplierId")?.reference).toBe("retail.partner.supplier.list");
    expect(partnerUpdate).toMatchObject({ permissions: ["retail-partner:manage"], confirmation: true });
    expect(partnerUpdate.fields.find(field => field.key === "path_id")?.reference).toBe("retail.partner.list");
    expect(retailSettingsUpdate).toMatchObject({ title: "Cập nhật cài đặt bán lẻ", permissions: ["retail:manage"], confirmation: true });
    expect(retailSettingsUpdate.fields.find(field => field.key === "defaultTaxRate")?.max).toBe(100);
    expect(retailSettingsUpdate.fields.find(field => field.key === "invoicePaperSize")?.options).toEqual(["A4", "A5", "80mm", "58mm"]);
    expect(retailSettingsUpdate.fields.find(field => field.key === "targetBranch")?.reference).toBe("branch.list");
    expect(defaultWorkflow(retailSettingsUpdate).confirmationLocked).toBe(true);
    expect(pointsPolicyRead.permissions).toContain("retail-points:manage");
    expect(pointsPolicyRead.resultFields).toContain("version");
    expect(pointsPolicy).toMatchObject({ permissions: ["retail-points:manage"], confirmation: true, title: "Cập nhật chính sách tích điểm bán lẻ" });
    expect(pointsPolicy.fields.find(field => field.key === "maxRedeemPercent")?.required).toBe(false);
    expect(pointsPolicy.fields.find(field => field.key === "version")?.required).toBe(false);
    expect(defaultWorkflow(pointsPolicy).confirmationLocked).toBe(true);
    expect(basePolicy).toMatchObject({ title: "Tạo cấu hình hoa hồng bán lẻ", permissions: ["retail-partner-policy:manage"], confirmation: true });
    expect(basePolicy.fields.find(field => field.key === "partnerId")?.reference).toBe("retail.partner.list");
    expect(partnerRate).toMatchObject({ id: "retail.finance.commission.policy.update", title: "Cấu hình hoa hồng SKU cho cộng tác viên", confirmation: true });
    expect(partnerRate.fields.find(field => field.key === "partnerId")?.reference).toBe("retail.partner.list");
    expect(partnerRate.fields.find(field => field.key === "sku")).toMatchObject({ required: false, defaultValue: "*" });
    expect(partnerRate.fields.find(field => field.key === "targetBranch")?.reference).toBe("branch.list");
    expect(closeCashbookPeriod).toMatchObject({ title: "Chốt kỳ sổ quỹ bán lẻ", permissions: ["retail:manage"], confirmation: true });
    expect(closeCashbookPeriod.fields.map(field => field.apiKey)).toContain("branchId");
    expect(defaultWorkflow(closeCashbookPeriod).confirmationLocked).toBe(true);
    expect(receivableLatest).toMatchObject({ method: "GET", permissions: ["retail:manage"], confirmation: false });
    expect(receivableLatest.resultFields).toEqual(["differenceCount", "orderTotal", "ledgerTotal", "differenceTotal", "createdAt"]);
    expect(receivableLatest.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    expect(receivableRun).toMatchObject({ method: "POST", permissions: ["retail:manage"], confirmation: true });
    expect(receivableRun.resultFields).toEqual(receivableLatest.resultFields);
    expect(receivableRun.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    expect(defaultWorkflow(receivableRun).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/retail/receivables/reconciliations")).toMatchObject({ status: "contract", id: "retail.receivable.reconciliation.run" });
    for (const [path, reason] of [
      ["/retail/receivables/adjustments", "customerId"],
      ["/retail/receivables/:entryId/reversal", "entry"],
    ] as const) {
      expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === path))
        .toMatchObject({ status: "unsupported", reason: expect.stringContaining(reason) });
      expect(ASSISTANT_OPERATIONS.some(operation => operation.method === "POST" && operation.path === path)).toBe(false);
    }
    expect(receivableHistory).toMatchObject({ method: "GET", permissions: ["retail:read", "retail:manage"], confirmation: false });
    expect(receivableHistory.fields.find(field => field.key === "path_customerId")).toMatchObject({ reference: "customer.list", label: "Tên hoặc mã khách hàng" });
    expect(receivableHistory.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    expect(receivableHistory.resultFields).toEqual(["type", "amount", "signedAmount", "runningBalance", "reason", "paymentMethod", "reference", "createdAt"]);
    expect(afterSaleList).toMatchObject({ method: "GET", permissions: ["retail:read", "retail:manage"], confirmation: false, title: "Tra cứu chứng từ đổi trả và thu mua" });
    expect(afterSaleList.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    expect(afterSaleList.fields.find(field => field.key === "query_orderId")).toMatchObject({ reference: "retail.order.list", label: "Mã đơn bán gốc" });
    expect(afterSaleList.fields.find(field => field.key === "query_type")?.options).toEqual(["return", "buyback"]);
    expect(afterSaleList.resultFields).toEqual(["code", "type", "status", "orderCode", "customerName", "totalAmount", "itemsSummary", "paymentMethod", "reason", "businessDate", "createdAt"]);
    expect(afterSaleDetail).toMatchObject({ method: "GET", confirmation: false, title: "Xem chứng từ đổi trả hoặc thu mua" });
    expect(afterSaleDetail.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "retail.after-sale.list", label: "Tên hoặc mã chứng từ đổi trả hoặc thu mua" });
    expect(afterSaleDetail.fields.find(field => field.key === "targetBranch")).toMatchObject({ apiKey: "branchId", reference: "branch.list" });
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/retail/after-sales")).toMatchObject({ status: "contract", id: "retail.after-sale.list" });
    expect(partnerRate.fields.find(field => field.key === "ratePercent")?.max).toBe(100);
    expect(productCommission).toMatchObject({ id: "retail.partner.product.commissions.update", title: "Cấu hình hoa hồng theo sản phẩm", permissions: ["retail-partner-policy:manage"], confirmation: true });
    expect(productCommission.fields.find(field => field.key === "skus")?.structure?.items).toMatchObject({ reference: commissionProducts.id, referenceValueKey: "sku" });
    expect(productCommission.fields.find(field => field.key === "rule")?.structure?.keys?.kind?.options).toEqual(["phone", "accessory"]);
    expect(commissionProducts.resultFields).toEqual(["sku", "name", "variantName"]);
    expect(payout).toMatchObject({ confirmation: true, contextBody: ["idempotencyKey"] });
    expect(payout.fields.find(field => field.key === "path_id")?.reference).toBe("retail.partner.list");
    expect(adjustPoints.fields.find(field => field.key === "path_id")?.reference).toBe("customer.list");
    expect(product.fields.find(field => field.key === "sellingPrice")).toMatchObject({ required: true, type: "number" });
    expect(product.fields.find(field => field.key === "categoryCode")?.referenceValueKey).toBe("code");
    expect(receiving.fields.find(field => field.key === "items")?.structure?.items?.keys?.variantId.referenceParentKey).toBe("productId");
    for (const op of [basePolicy, partnerRate, productCommission, payout, adjustPoints, product, receiving]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("connects everyday POS shift operations and resolves cashiers, drawers, and shifts by name", () => {
    const shifts = ASSISTANT_OPERATIONS.find(op => op.id === "retail.shift.list")!;
    const cashiers = ASSISTANT_OPERATIONS.find(op => op.id === "retail.shift.cashier.list")!;
    const drawers = ASSISTANT_OPERATIONS.find(op => op.id === "retail.shift.drawer.list")!;
    const open = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/retail/shifts/open")!;
    const moveCash = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/retail/shifts/:id/cash-movements")!;
    const close = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/retail/shifts/:id/close")!;
    const pause = ASSISTANT_OPERATIONS.find(op => op.id === "retail.shift.pause")!;
    const resume = ASSISTANT_OPERATIONS.find(op => op.id === "retail.shift.resume")!;
    const reconcile = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/retail/shifts/:id/reconcile")!;
    const settlementList = ASSISTANT_OPERATIONS.find(op => op.id === "retail.shift.settlements.list")!;
    const reviewSettlement = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/retail/shifts/settlements/review")!;

    expect(shifts).toMatchObject({ permissions: ["retail:manage"], resultFields: expect.arrayContaining(["shiftCode", "cashierName", "status"]) });
    expect(cashiers.resultFields).toContain("name");
    expect(drawers.resultFields).toContain("code");
    expect(open.fields.find(field => field.key === "cashierId")?.reference).toBe("retail.shift.cashier.list");
    expect(open.fields.find(field => field.key === "cashierId")?.required).toBe(true);
    expect(open.fields.find(field => field.key === "drawerId")?.reference).toBe("retail.shift.drawer.list");
    expect(moveCash.fields.find(field => field.key === "path_id")?.reference).toBe("retail.shift.list");
    expect(close.fields.find(field => field.key === "path_id")?.reference).toBe("retail.shift.list");
    expect(close.contextQuery).toEqual(["terminalId"]);
    expect(pause).toMatchObject({ method: "POST", optionalPathFields: ["id"], permissionGroups: [["pos:manage", "retail:manage"]], contextQuery: ["terminalId"], confirmation: true });
    expect(pause.fields.some(field => field.source === "path")).toBe(false);
    expect(resume).toMatchObject({ method: "POST", optionalPathFields: ["id"], permissionGroups: [["pos:manage", "retail:manage"]], systemBodyFields: ["terminalId", "expectedTerminalId"], confirmation: true });
    expect(resume.fields.some(field => field.source === "path" || ["terminalId", "expectedTerminalId"].includes(field.apiKey || ""))).toBe(false);
    expect(ASSISTANT_OPERATIONS.find(op => op.id === "retail.shift.current")?.resultFields).not.toContain("_id");
    expect(ASSISTANT_OPERATIONS.find(op => op.id === "retail.shift.current")?.resultFields).not.toContain("terminalId");
    expect(reconcile.fields.find(field => field.key === "countedCash")?.required).toBe(true);
    expect(settlementList.resultFields).toContain("paymentMethod");
    expect(reviewSettlement.fields.find(field => field.key === "orderId")?.reference).toBe("retail.shift.settlements.list");
    for (const op of [open, moveCash, close, pause, resume, reconcile, reviewSettlement]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("connects retail order checkout and money changes with branch, price, version, and refund guards", () => {
    const products = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.products.list")!;
    const orders = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.list")!;
    const detail = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.detail")!;
    const quote = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.quote")!;
    const draftCreate = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.draft.create")!;
    const draftUpdate = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.draft.update")!;
    const confirm = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.confirm")!;
    const checkout = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.checkout")!;
    const collect = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.collect")!;
    const cancel = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.cancel")!;
    expect(products.fields.find(field => field.key === "query_q")).toMatchObject({ apiKey: "q", source: "query" });
    expect(products.resultFields).toContain("price");
    expect(orders.fields.find(field => field.key === "targetBranch")).toMatchObject({ reference: "branch.list", apiKey: "branchId" });
    expect(orders.fields.find(field => field.key === "query_search")?.apiKey).toBe("q");
    expect(detail).toMatchObject({ rawResponse: true });
    expect(detail.resultFields).toContain("items");
    expect(detail.resultFields).not.toContain("version");
    expect(detail.resultFields).not.toContain("customerPhone");
    expect(quote).toMatchObject({ confirmation: false, title: "Tính thử đơn bán lẻ" });
    expect(defaultWorkflow(quote).confirmationLocked).toBe(false);
    expect(draftCreate).toMatchObject({ path: "/retail/orders", confirmation: true, contextBody: ["idempotencyKey"] });
    expect(draftUpdate).toMatchObject({ path: "/retail/orders/:id", confirmation: true, contextBody: ["idempotencyKey"] });
    expect(draftUpdate.fields.find(field => field.key === "path_id")?.reference).toBe(orders.id);
    expect(draftUpdate.fields.find(field => field.apiKey === "version")?.required).toBe(false);
    expect(confirm).toMatchObject({ path: "/retail/orders/:id/confirm", confirmation: true, contextBody: ["idempotencyKey"] });
    expect(confirm.fields.find(field => field.key === "path_id")?.reference).toBe(orders.id);
    expect(confirm.fields.find(field => field.apiKey === "expectedVersion")?.required).toBe(false);
    expect(checkout).toMatchObject({ confirmation: true, contextBody: ["idempotencyKey"] });
    expect(checkout.fields.find(field => field.key === "targetBranch")).toMatchObject({ reference: "branch.list", apiKey: "branchId" });
    expect(checkout.fields.find(field => field.key === "input")?.structure?.keys?.items?.items?.keys?.productId).toMatchObject({ reference: products.id, referenceValueKey: "id" });
    expect(checkout.fields.find(field => field.key === "input")?.structure?.keys?.billingProfileId).toMatchObject({ reference: "customer.billing.profile.list", referenceParentKey: "customerId", referenceValueKey: "id" });
    expect(checkout.fields.find(field => field.key === "posSessionId")?.required).toBe(false);
    expect(checkout.fields.find(field => field.key === "expectedGrandTotal")?.required).toBe(false);
    expect(collect).toMatchObject({ permissions: ["retail:manage"], confirmation: true, contextBody: ["idempotencyKey"] });
    expect(collect.fields.find(field => field.key === "path_id")?.reference).toBe(orders.id);
    expect(collect.fields.find(field => field.key === "expectedVersion")?.required).toBe(false);
    expect(cancel).toMatchObject({ permissions: ["retail:manage"], confirmation: true, contextBody: ["idempotencyKey"] });
    expect(cancel.fields.find(field => field.key === "refunds")?.defaultValue).toBe("[]");
    expect(cancel.fields.find(field => field.key === "path_id")?.reference).toBe(orders.id);
    for (const op of [draftCreate, draftUpdate, confirm, checkout, collect, cancel]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("connects retail order and invoice lookup with scoped, user-friendly fields", () => {
    const orders = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.list")!;
    const orderDetail = ASSISTANT_OPERATIONS.find(op => op.id === "retail.order.detail")!;
    const invoiceList = ASSISTANT_OPERATIONS.find(op => op.id === "retail.invoice.list")!;
    const invoiceDetail = ASSISTANT_OPERATIONS.find(op => op.id === "retail.invoice.detail")!;
    const invoiceSummary = ASSISTANT_OPERATIONS.find(op => op.id === "retail.invoice.summary")!;
    const salesSummary = ASSISTANT_OPERATIONS.find(op => op.id === "retail.report.summary")!;
    expect(orders.resultFields).toEqual(expect.arrayContaining(["orderCode", "customerName", "paymentStatus", "grandTotal"]));
    expect(orders.resultFields).not.toContain("customerPhone");
    expect(orders.resultFields).not.toContain("version");
    expect(orderDetail.resultFields).toContain("payments");
    expect(orderDetail.resultFields).not.toContain("version");
    expect(invoiceList).toMatchObject({ method: "GET", path: "/retail/invoices", rawResponse: true });
    expect(invoiceList.fields.find(field => field.apiKey === "q")?.key).toBe("search");
    expect(invoiceList.fields.find(field => field.apiKey === "from")?.type).toBe("date");
    expect(invoiceList.fields.find(field => field.apiKey === "status")?.options).toEqual(["issued", "void"]);
    expect(invoiceDetail.fields.find(field => field.key === "path_id")?.reference).toBe(invoiceList.id);
    expect(invoiceSummary).toMatchObject({ method: "GET", path: "/retail/invoices/summary", rawResponse: true, confirmation: false });
    expect(invoiceSummary.fields.find(field => field.key === "targetBranch")).toMatchObject({ reference: "branch.list", apiKey: "branchId" });
    expect(invoiceSummary.resultFields).toContain("issuedAmount");
    expect(salesSummary).toMatchObject({ method: "GET", path: "/retail/reports/summary", confirmation: false });
    expect(salesSummary.fields.find(field => field.key === "targetBranch")).toMatchObject({ reference: "branch.list", apiKey: "branchId" });
    expect(defaultWorkflow(invoiceSummary).instructions).toContain("mặc định hôm nay");
    expect(defaultWorkflow(salesSummary).instructions).toContain("không hiển thị JSON");
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/retail/invoices/summary")).toMatchObject({ status: "manual", id: "retail.invoice.summary" });
  });

  it("connects customer billing profiles with scoped permissions and name-based POS selection", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "customer.billing.profile.list")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "customer.billing.profile.create")!;
    expect(list).toMatchObject({ method: "GET", path: "/customers/:id/billing-profiles", permissions: ["customer:read", "pos:manage", "repair:manage"] });
    expect(list.permissionGroups).toEqual([["customer:read", "pos:manage", "repair:manage"]]);
    expect(list.fields.find(field => field.key === "path_id")).toMatchObject({ reference: "customer.list", label: "Tên hoặc số điện thoại khách hàng" });
    expect(list.resultFields).toContain("legalName");
    expect(create).toMatchObject({ method: "POST", path: "/customers/:id/billing-profiles", confirmation: true, permissions: ["customer:manage", "pos:manage"] });
    expect(create.permissionGroups).toEqual([["customer:manage", "pos:manage"]]);
    expect(create.fields.find(field => field.key === "path_id")?.reference).toBe("customer.list");
    for (const key of ["legalName", "taxId", "address", "invoiceEmail"]) expect(create.fields.find(field => field.apiKey === key)?.required).toBe(true);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
  });

  it("connects worker labor-contract lookup, creation, editing, renewal and deletion", () => {
    const workers = ASSISTANT_OPERATIONS.find(op => op.id === "worker.list")!;
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "worker.labor.contract.list")!;
    const detail = ASSISTANT_OPERATIONS.find(op => op.method === "GET" && op.path === "/worker-management/labor-contracts/:id")!;
    const history = ASSISTANT_OPERATIONS.find(op => op.method === "GET" && op.path === "/worker-management/labor-contracts/:id/history")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/worker-management/labor-contracts")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.method === "PATCH" && op.path === "/worker-management/labor-contracts/:id")!;
    const renew = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/worker-management/labor-contracts/:id/renew")!;
    const remove = ASSISTANT_OPERATIONS.find(op => op.method === "DELETE" && op.path === "/worker-management/labor-contracts/:id")!;

    expect(workers.resultFields).toContain("fullName");
    expect(list).toMatchObject({ permissions: ["people:read", "people:manage"], resultFields: expect.arrayContaining(["workerName", "code", "endDate"]) });
    expect(list.fields.find(field => field.apiKey === "workerId")).toMatchObject({ reference: workers.id, label: "Tên người lao động" });
    expect(detail.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(history.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(create).toMatchObject({ permissions: ["people:manage"], confirmation: true });
    expect(create.fields.find(field => field.key === "workerId")).toMatchObject({ required: true, reference: workers.id, referenceValueKey: "id" });
    expect(create.fields.find(field => field.key === "endDate")?.required).toBe(true);
    expect(create.fields.find(field => field.key === "status")?.defaultValue).toBe("active");
    expect(update.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(renew.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(renew.fields.find(field => field.key === "code")?.required).toBe(true);
    expect(renew.fields.find(field => field.key === "startDate")?.required).toBe(true);
    expect(remove.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    for (const op of [update, renew, remove]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
    expect(collectValues(defaultWorkflow(create), { workerId: "Đỗ Đức Chung", code: "HD-01", clientName: "Công ty Ánh Dương", startDate: "2026-01-01", endDate: "2026-12-31" }).missing).toEqual([]);
    expect(collectValues(defaultWorkflow(renew), { path_id: "HD-01", code: "HD-02" }).missing).toEqual(["Ngày bắt đầu", "Ngày kết thúc"]);
  });

  it("supports safe name-based partial worker updates with locked confirmation", () => {
    const workers = ASSISTANT_OPERATIONS.find(op => op.id === "worker.list")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "worker.update")!;
    expect(workers).toMatchObject({ method: "GET", path: "/worker-management/workers", permissions: ["people:read", "people:manage"] });
    expect(workers.resultFields).toEqual(["fullName", "status", "laborType", "registrationDate"]);
    expect(update).toMatchObject({ method: "PATCH", path: "/worker-management/workers/:id", permissions: ["people:manage"], confirmation: true });
    expect(update.fields.find(field => field.key === "path_id")).toMatchObject({ reference: workers.id, label: "Tên hoặc mã lao động cần cập nhật" });
    expect(update.fields.filter(field => field.source === "body").every(field => !field.required)).toBe(true);
    expect(update.fields.some(field => ["projectId", "customFields", "partnerId"].includes(field.apiKey || ""))).toBe(false);
    expect(update.resultFields).toEqual(["fullName", "status", "laborType", "registrationDate"]);
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
  });

  it("connects account-level AI settings through inbox permissions and preserves partial updates", () => {
    const accounts = ASSISTANT_OPERATIONS.find(op => op.id === "omni-inbox.account.list")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "omni-inbox.account.ai-config.update")!;
    expect(accounts).toMatchObject({ method: "GET", path: "/omni-inbox/accounts", module: "omni-inbox", permissions: ["omni-inbox:read", "omni-inbox:manage"] });
    expect(accounts.resultFields).toEqual(["displayName", "platform", "isConnected"]);
    expect(update).toMatchObject({ method: "PATCH", path: "/omni-inbox/accounts/:id/ai-config", module: "omni-inbox", permissions: ["omni-inbox:manage"], confirmation: true });
    expect(update.fields.find(field => field.key === "path_id")).toMatchObject({ reference: accounts.id, label: "Tên hoặc mã tài khoản cần cập nhật" });
    expect(update.fields.filter(field => field.source === "body").every(field => !field.required)).toBe(true);
    expect(update.fields.map(field => field.apiKey)).not.toEqual(expect.arrayContaining(["customerServiceScriptFileName", "disabledAt", "model"]));
    expect(update.resultFields).toEqual(["displayName", "platform", "updated"]);
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    for (const item of [
      { id: "marketing.account.list", path: "/marketing-campaigns/accounts", module: "social-marketing", permission: "marketing:read" },
      { id: "company-knowledge.account.list", path: "/company-knowledge/accounts", module: "company-knowledge", permission: "company-knowledge:read" },
    ]) {
      const list = ASSISTANT_OPERATIONS.find(op => op.id === item.id)!;
      expect(list).toMatchObject({ method: "GET", path: item.path, module: item.module, permissions: [item.permission], permissionGroups: [[item.permission]], resultFields: ["displayName", "platform", "isConnected"], confirmation: false });
      expect(list.fields.find(field => field.apiKey === "platform")?.options).toEqual(["Facebook", "Zalo", "TikTok"]);
      expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === item.path)).toMatchObject({ status: "manual", id: item.id });
    }
  });

  it("lists saved marketing content with bounded search and a filtered response", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.content.list")!;
    expect(list).toMatchObject({ method: "GET", path: "/marketing-contents", module: "social-marketing", permissions: ["marketing:read"], permissionGroups: [["marketing:read"]], confirmation: false });
    expect(list.fields.map(field => field.apiKey)).toEqual(["search", "channel", "status", "page", "limit"]);
    expect(list.fields.find(field => field.apiKey === "search")?.max).toBe(200);
    expect(list.fields.find(field => field.apiKey === "limit")).toMatchObject({ defaultValue: 50, min: 1, max: 100, integer: true });
    expect(list.resultFields).toEqual(["title", "channel", "contentType", "status", "bodyText", "scheduledDate", "scheduledTime", "generatedAt", "publishedAt"]);
    expect(list.resultFields).not.toEqual(expect.arrayContaining(["companyCode", "integrationId", "campaignSlotId", "imageUrl", "videoUrl", "postUrl", "authorUid"]));
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === list.path)).toMatchObject({ status: "manual", id: list.id });
  });

  it("offers name based choices for linked records across social, inventory, repair and student workflows", () => {
    const route = (method: string, path: string) => ASSISTANT_OPERATIONS.find(item => item.method === method && item.path === path)!;
    const tiktokPublish = route("POST", "/tiktok/publish");
    expect(tiktokPublish).toMatchObject({ id: "marketing.tiktok.publish", confirmation: true });
    expect(tiktokPublish.fields.find(field => field.apiKey === "cardId")).toMatchObject({ reference: "marketing.content.list", referenceContext: { channel: "TikTok" }, referenceValueKey: "id" });
    expect(tiktokPublish.fields.find(field => field.apiKey === "integrationId")).toMatchObject({ reference: "marketing.account.list", referenceContext: { platform: "TikTok" }, referenceValueKey: "id" });
    for (const path of ["/tiktok-business/publish"]) {
      const publish = route("POST", path);
      expect(publish.fields.find(field => field.apiKey === "cardId")).toMatchObject({ reference: "marketing.content.list", referenceContext: { channel: "TikTok" } });
      expect(publish.fields.find(field => field.apiKey === "integrationId")).toMatchObject({ reference: "marketing.account.list", referenceContext: { platform: "TikTok" } });
    }
    expect(route("POST", "/tiktok/creator-info").fields.find(field => field.apiKey === "integrationId"))
      .toMatchObject({ reference: "marketing.account.list", referenceContext: { platform: "TikTok" }, required: false });

    const schedule = route("POST", "/scheduler/schedule-post");
    expect(schedule).toMatchObject({ id: "marketing.scheduler.schedule-post", confirmation: true });
    expect(schedule.fields.find(field => field.apiKey === "cardId")).toMatchObject({ reference: "marketing.content.list", referenceParentKey: "channel" });
    expect(schedule.fields.find(field => field.apiKey === "integrationId")).toMatchObject({ reference: "marketing.account.list", referenceParentKey: "channel" });
    expect(schedule.fields.some(field => field.apiKey === "integration")).toBe(false);

    const bulkProduct = route("POST", "/inventory/catalog/products/bulk-create-with-variants");
    expect(bulkProduct.fields.find(field => field.apiKey === "mediaIds")?.structure?.items).toMatchObject({ reference: "resource.list", referenceValueKey: "id", referenceContext: { query_section: "local", resourceKind: "media" } });
    expect(bulkProduct.fields.find(field => field.apiKey === "documentIds")?.structure?.items).toMatchObject({ reference: "resource.list", referenceValueKey: "id", referenceContext: { query_section: "local", resourceKind: "document" } });
    expect(route("PATCH", "/inventory/catalog/variants/:id").fields.find(field => field.apiKey === "mediaIds")?.structure?.items)
      .toMatchObject({ reference: "resource.list", referenceContext: { query_section: "local", resourceKind: "media" } });

    const miniTests = route("GET", "/student-quality/batches/:batchId/students/:studentId");
    expect(miniTests).toMatchObject({ id: "student.quality.mini-tests.list", resultFields: ["title", "date", "score", "maxScore", "note"] });
    for (const method of ["PATCH", "DELETE"]) {
      expect(route(method, "/student-quality/batches/:batchId/students/:studentId/mini-tests/:miniTestId").fields.find(field => field.apiKey === "miniTestId"))
        .toMatchObject({ reference: miniTests.id, referenceParentKey: "path_studentId" });
    }

    const parts = route("GET", "/repair/tickets/:id/parts");
    expect(parts.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "repair.list" });
    expect(route("POST", "/repair/tickets/:id/parts/:partId/return").fields.find(field => field.apiKey === "partId"))
      .toMatchObject({ reference: parts.id, referenceParentKey: "path_id" });
    for (const path of ["/worker-management/partners/settlements/:settlementId/void", "/worker-management/partners/settlements/:settlementId/adjustments", "/worker-management/partners/settlements/:settlementId/approve", "/worker-management/partners/settlements/:settlementId/payouts"]) {
      expect(route("POST", path).fields.find(field => field.apiKey === "settlementId")).toMatchObject({ reference: "worker.partner.settlements.list" });
    }
  });

  it("connects the Facebook Page chat-flow lifecycle through visible names and confirmations", () => {
    const accounts = ASSISTANT_OPERATIONS.find(op => op.id === "omni-inbox.account.list")!;
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.chat-flow.list")!;
    const suggest = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.chat-flow.suggest")!;
    const draft = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.chat-flow.draft.create")!;
    const activate = ASSISTANT_OPERATIONS.find(op => op.id === "marketing.chat-flow.activate")!;
    expect(accounts.permissionGroups).toEqual([["omni-inbox:read"], ["omni-inbox:manage"]]);
    expect(list).toMatchObject({ method: "GET", path: "/marketing-settings/chat-flows/:pageId", permissions: ["omni-inbox:manage"], resultFields: expect.arrayContaining(["version", "status", "goal", "fields"]) });
    expect(list.fields.find(field => field.key === "path_pageId")).toMatchObject({ reference: accounts.id, referenceValueKey: "pageId", label: "Trang Facebook đang kết nối" });
    expect(suggest).toMatchObject({ method: "POST", confirmation: true, resultFields: ["goal", "fields", "completionMessage"] });
    expect(suggest.fields.find(field => field.key === "path_pageId")?.referenceValueKey).toBe("pageId");
    expect(draft).toMatchObject({ method: "POST", confirmation: true });
    expect(draft.fields.find(field => field.key === "fields")?.structure).toMatchObject({ minItems: 1, maxItems: 12 });
    expect(activate).toMatchObject({ method: "POST", confirmation: true, resultFields: ["version", "status", "goal", "completionMessage"] });
    expect(activate.fields.find(field => field.key === "path_pageId")).toMatchObject({ reference: accounts.id, referenceValueKey: "pageId" });
    expect(activate.fields.find(field => field.key === "path_version")).toMatchObject({ reference: list.id, referenceParentKey: "path_pageId", referenceValueKey: "version" });
    for (const op of [suggest, draft, activate]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("resolves personal notification actions by title and time", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "notification.list")!;
    const markRead = ASSISTANT_OPERATIONS.find(op => op.id === "notification.mark-read")!;
    const markAllRead = ASSISTANT_OPERATIONS.find(op => op.id === "notification.mark-all-read")!;
    const remove = ASSISTANT_OPERATIONS.find(op => op.id === "notification.delete")!;
    expect(list.permissionGroups).toEqual([["chat:read"], ["chat:manage"]]);
    expect(markRead).toMatchObject({ method: "PATCH", path: "/notifications/:id/read", confirmation: true, resultFields: ["title", "type", "read", "createdAt"] });
    expect(markRead.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id, label: "Tên hoặc mã thông báo theo tiêu đề và thời điểm" });
    expect(markAllRead).toMatchObject({ method: "PATCH", path: "/notifications/read-all", permissions: ["chat:read"], confirmation: true });
    expect(remove).toMatchObject({ method: "DELETE", path: "/notifications/:id", permissions: ["chat:manage"], confirmation: true, resultFields: ["deleted"] });
    expect(remove.fields.find(field => field.key === "path_id")).toMatchObject({ reference: list.id, label: "Tên hoặc mã thông báo theo tiêu đề và thời điểm" });
    for (const op of [markRead, markAllRead, remove]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("connects product catalog resource CRUD with kind-specific validation and name lookup", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.catalog.resource.list")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/inventory/catalog/resources/:kind")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.method === "PATCH" && op.path === "/inventory/catalog/resources/:kind/:id")!;
    const remove = ASSISTANT_OPERATIONS.find(op => op.method === "DELETE" && op.path === "/inventory/catalog/resources/:kind/:id")!;
    const field = (op: typeof create, key: string) => op.fields.find(candidate => candidate.key === key || candidate.apiKey === key)!;

    expect(list).toMatchObject({ permissions: ["inventory:read"], resultFields: expect.arrayContaining(["code", "name", "status"]) });
    expect(list.fields.find(candidate => candidate.apiKey === "q")?.source).toBe("query");
    expect(list.fields.find(candidate => candidate.apiKey === "status")?.options).toEqual(["active", "inactive"]);
    expect(create).toMatchObject({ permissions: ["inventory:manage"], confirmation: true });
    expect(field(create, "name")).toMatchObject({ systemRequired: true, required: true });
    expect(field(create, "path_kind").options).toEqual(["categories", "brands", "units", "attributes"]);
    expect(field(create, "category").requiredWhen).toEqual({ field: "path_kind", equals: "units" });
    expect(field(create, "type").requiredWhen).toEqual({ field: "path_kind", equals: "attributes" });
    expect(field(create, "options").requiredWhen).toEqual({ field: "type", equals: ["select", "multi-select"] });
    expect(field(create, "options").structure?.minItems).toBe(1);
    expect(field(create, "conversionFactor")).toMatchObject({ exclusiveMin: true, requiredWhen: { field: "baseUnitCode", present: true } });
    expect(field(create, "baseUnitCode").reference).toBe(list.id);
    expect(update.fields.find(candidate => candidate.key === "path_id")).toMatchObject({ reference: list.id, label: "Tên hoặc mã dữ liệu sản phẩm" });
    expect(remove.fields.find(candidate => candidate.key === "path_kind")?.options).toEqual(["categories", "brands"]);
    expect(remove.fields.find(candidate => candidate.key === "path_id")?.reference).toBe(list.id);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(defaultWorkflow(remove).confirmationLocked).toBe(true);

    expect(collectValues(defaultWorkflow(create), { path_kind: "units", name: "Kilogram" }).missing).toContain("Nhóm đơn vị tính");
    expect(collectValues(defaultWorkflow(create), { path_kind: "categories", name: "Linh kiện" }).missing).not.toContain("Nhóm đơn vị tính");
    expect(collectValues(defaultWorkflow(create), { path_kind: "attributes", name: "Màu", type: "select" }).missing).toContain("Danh sách giá trị lựa chọn (JSON)");
    expect(collectValues(defaultWorkflow(create), { path_kind: "units", name: "Gram", category: "weight", baseUnitCode: "Kilogram" }).missing).toContain("Hệ số quy đổi");
    expect(collectValues(defaultWorkflow(create), { path_kind: "units", name: "Gram", category: "weight", baseUnitCode: "Kilogram", conversionFactor: 0 }).errors).toContain("Hệ số quy đổi: must be greater than 0.");
  });

  it("connects bulk SKU updates and deletion through product and variant names", () => {
    const products = ASSISTANT_OPERATIONS.find(op => op.id === "product.list")!;
    const detail = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.product.detail")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.variant.bulk.update")!;
    const remove = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.variant.bulk.delete")!;
    const ids = update.fields.find(field => field.key === "ids")!;
    expect(update).toMatchObject({ permissions: ["inventory:manage"], confirmation: true, resultFields: ["sku", "displayName", "status", "trackingMode", "unitCode"] });
    expect(ids.structure).toMatchObject({ minItems: 1, maxItems: 20 });
    expect(ids.structure?.items?.keys?.productId).toMatchObject({ reference: products.id, referenceValueKey: "id" });
    expect(ids.structure?.items?.keys?.variantId).toMatchObject({ reference: detail.id, referenceParentKey: "productId", referenceValueKey: "id" });
    expect(update.fields.find(field => field.key === "changes")?.structure?.minProperties).toBe(1);
    expect(update.fields.find(field => field.key === "changes")?.structure?.keys?.trackingMode.options).toEqual(["none", "quantity", "unit_barcode", "serial", "lot"]);
    expect(remove).toMatchObject({ permissions: ["inventory:manage"], confirmation: true, resultFields: [] });
    expect(remove.fields.find(field => field.key === "ids")?.structure?.maxItems).toBe(20);
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(defaultWorkflow(remove).confirmationLocked).toBe(true);
    expect(collectValues(defaultWorkflow(update), { ids: "[]", changes: "{}" }).errors).toEqual(expect.arrayContaining(["Danh sách sản phẩm và SKU: cần ít nhất 1 mục.", "Nội dung cập nhật: cần nhập ít nhất 1 trường."]));
  });

  it("connects finance write operations with server-generated deduplication keys", () => {
    const debtList = ASSISTANT_OPERATIONS.find(op => op.id === "finance.debt.list")!;
    const debtCreate = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/reporting/debts")!;
    const debtPayment = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/reporting/debts/:id/payments")!;
    const expense = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/reporting/expenses")!;
    const account = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/reporting/treasury/accounts")!;
    expect(debtList.resultFields).toContain("version");
    expect(debtCreate.fields.find(field => field.key === "amount")?.required).toBe(true);
    expect(debtPayment.fields.find(field => field.key === "path_id")?.reference).toBe("finance.debt.list");
    expect(debtPayment.contextBody).toEqual(["key"]);
    expect(expense.contextBody).toEqual(["key"]);
    for (const op of [debtCreate, debtPayment, expense, account]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("connects receivable collection and adjustment with visible business codes and distinct permissions", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "finance.receivable.list")!;
    const collection = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/receivables/:id/payments")!;
    const adjustment = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/receivables/:id/adjustments")!;
    const writeOff = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/receivables/:id/write-off")!;
    expect(list.permissions).toContain("finance-receivable:read");
    expect(list.fields.find(field => field.key === "targetBranch")).toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list", required: false });
    expect(collection.permissions).toEqual(["finance-receivable:manage"]);
    expect(collection.fields.find(field => field.key === "path_id")?.reference).toBe("finance.receivable.list");
    expect(collection.fields.find(field => field.key === "paymentMethod")?.options).toContain("transfer");
    expect(adjustment.fields.find(field => field.key === "direction")?.defaultValue).toBe("increase");
    expect(writeOff.description).toContain("toàn bộ số dư còn lại");
    for (const op of [collection, adjustment, writeOff]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("reverses only an unreversed named receivable payment or adjustment with explicit confirmation", () => {
    const detail = ASSISTANT_OPERATIONS.find(op => op.id === "finance.receivable.detail")!;
    const reversal = ASSISTANT_OPERATIONS.find(op => op.id === "finance.receivable.entry.reversal")!;
    expect(detail).toMatchObject({ method: "GET", path: "/finance/receivables/:id", permissions: ["finance-receivable:read"] });
    expect(detail.resultFields).toEqual(["receivableCode", "customerName", "balance", "status"]);
    expect(reversal).toMatchObject({ method: "POST", path: "/finance/receivables/:id/entries/:entryId/reversal", permissions: ["finance-receivable:manage"], confirmation: true, contextBody: ["idempotencyKey"] });
    expect(reversal.fields.find(field => field.key === "path_id")?.reference).toBe("finance.receivable.list");
    expect(reversal.fields.find(field => field.key === "path_entryId")?.reference).toBe(detail.id);
    expect(reversal.fields.find(field => field.key === "reason")?.required).toBe(true);
    expect(reversal.resultFields).toEqual(["receivableCode", "customerName", "balance", "status", "type", "amount", "reason"]);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === reversal.path)).toMatchObject({ status: "contract", id: reversal.id });
    expect(defaultWorkflow(reversal).confirmationLocked).toBe(true);
  });

  it("connects receivable reminder suspension and due-date extension with reason, named lookup, and safe results", () => {
    const suspend = ASSISTANT_OPERATIONS.find(op => op.id === "finance.receivable.suspend")!;
    const extend = ASSISTANT_OPERATIONS.find(op => op.id === "finance.receivable.extend")!;
    expect(suspend).toMatchObject({ permissions: ["finance-receivable:manage"], confirmation: true, dateOnlyToIsoUtc: ["until"] });
    expect(suspend.fields.find(field => field.key === "path_id")?.reference).toBe("finance.receivable.list");
    expect(suspend.fields.find(field => field.key === "reason")?.required).toBe(true);
    expect(extend).toMatchObject({ permissions: ["finance-receivable:manage"], confirmation: true, dateOnlyToIsoUtc: ["dueDate"], contextBody: ["idempotencyKey"] });
    expect(extend.fields.find(field => field.key === "path_id")?.reference).toBe("finance.receivable.list");
    expect(extend.fields.find(field => field.key === "reason")?.required).toBe(true);
    for (const op of [suspend, extend]) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
  });

  it("requires a finance branch and confirmation before queuing overdue reminders", () => {
    const operation = ASSISTANT_OPERATIONS.find(op => op.id === "finance.reminders.run")!;
    expect(operation).toMatchObject({
      method: "POST", path: "/finance/reminders/runs", permissions: ["finance-receivable:manage"], confirmation: true,
      resultFields: ["eligibleCount", "queuedCount", "skippedCount", "failedCount", "duplicateCount"],
    });
    expect(operation.fields.find(field => field.key === "targetBranch"))
      .toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list", required: true });
    expect(operation.description).toContain("có thể tạo nhiều thông báo");
    expect(operation.description).toContain("một lần trong ngày");
    expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === operation.path))
      .toMatchObject({ status: "contract", id: operation.id });
  });

  it("keeps retail debt and receivable compatibility aliases on stable assistant workflows", () => {
    const route = (method: string, path: string) => ASSISTANT_OPERATIONS.find(operation => operation.method === method && operation.path === path);
    const retailDebtRun = route("POST", "/retail/debt-reminders/run");
    const financeAdjustment = route("POST", "/finance/receivables/:id/adjustments");
    const financeReversal = route("POST", "/finance/receivables/:id/entries/:entryId/reversal");
    expect(retailDebtRun).toMatchObject({ id: "retail.debt-reminders.run", confirmation: true });
    expect(financeAdjustment?.fields.find(field => field.key === "path_id")?.reference).toBe("finance.receivable.list");
    expect(financeReversal?.fields.find(field => field.key === "path_id")?.reference).toBe("finance.receivable.list");
    for (const [method, path, expectedReason] of [
      ["POST", "/retail/reports/debt-reminders/run", "RetailDebtReminderService.run"],
      ["POST", "/retail/receivables/adjustments", "finance cutover"],
      ["POST", "/retail/receivables/:entryId/reversal", "finance cutover"],
    ] as const) {
      expect(route(method, path)).toBeUndefined();
      expect(coverage.entries.find(entry => entry.method === method && entry.path === path))
        .toMatchObject({ status: "unsupported", reason: expect.stringContaining(expectedReason) });
    }
  });

  it("lists and resolves reminder runs by date while keeping delivery identities private", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "finance.reminders.runs.list")!;
    const detail = ASSISTANT_OPERATIONS.find(op => op.id === "finance.reminders.runs.detail")!;
    const retryable = ASSISTANT_OPERATIONS.find(op => op.id === "finance.reminders.retryable-deliveries.list")!;
    const retry = ASSISTANT_OPERATIONS.find(op => op.id === "finance.reminders.delivery.retry-in-app")!;
    expect(list).toMatchObject({ method: "GET", path: "/finance/reminders/runs", permissions: ["finance-receivable:read"] });
    expect(list.fields.find(field => field.key === "targetBranch")).toMatchObject({ source: "query", apiKey: "branchId", reference: "branch.list", required: true });
    expect(list.fields.find(field => field.apiKey === "limit")).toMatchObject({ defaultValue: 20, min: 1, max: 100, integer: true });
    expect(list.resultFields).toEqual(["date", "trigger", "status", "eligibleCount", "queuedCount", "skippedCount", "failedCount", "duplicateCount", "startedAt", "completedAt"]);
    expect(list.resultFields).not.toContain("id");
    expect(detail).toMatchObject({ method: "GET", path: "/finance/reminders/runs/:id", permissions: ["finance-receivable:read"] });
    expect(detail.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(detail.resultFields).toContain("deliverySentCount");
    expect(detail.resultFields).not.toContain("deliveries");
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === list.path)).toMatchObject({ status: "contract", id: list.id });
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === detail.path)).toMatchObject({ status: "contract", id: detail.id });
    expect(retryable).toMatchObject({ method: "GET", path: "/finance/reminders/deliveries/retryable", permissions: ["finance-receivable:manage"] });
    expect(retryable.resultFields).toContain("notificationBody");
    expect(retryable.description).toContain("không bao gồm sự kiện Marketing");
    expect(retry).toMatchObject({ method: "POST", path: "/finance/reminders/deliveries/:id/retry-in-app", confirmation: true });
    expect(retry.fields.find(field => field.key === "path_id")?.reference).toBe(retryable.id);
    expect(retry.confirmationDetails?.path_id?.map(detail => detail.key)).toContain("notificationBody");
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === retryable.path)).toMatchObject({ status: "contract", id: retryable.id });
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === retry.path)).toMatchObject({ status: "contract", id: retry.id });
    expect(defaultWorkflow(retry).confirmationLocked).toBe(true);
  });

  it("scopes retail debt reminder runs to a named branch and requires confirmation before sending", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "retail.debt-reminders.runs.list")!;
    const detail = ASSISTANT_OPERATIONS.find(op => op.id === "retail.debt-reminders.runs.detail")!;
    const retryable = ASSISTANT_OPERATIONS.find(op => op.id === "retail.debt-reminders.retryable-deliveries.list")!;
    const retry = ASSISTANT_OPERATIONS.find(op => op.id === "retail.debt-reminders.delivery.retry")!;
    const run = ASSISTANT_OPERATIONS.find(op => op.id === "retail.debt-reminders.run")!;
    expect(list).toMatchObject({ method: "GET", path: "/retail/debt-reminders/runs", permissions: ["retail:manage"] });
    expect(list.fields.find(field => field.key === "targetBranch" && field.apiKey === "branchId")).toMatchObject({ reference: "branch.list", required: false });
    expect(list.resultFields).not.toContain("settings");
    expect(detail).toMatchObject({ method: "GET", path: "/retail/debt-reminders/runs/:id", permissions: ["retail:manage"] });
    expect(detail.fields.find(field => field.key === "path_id")?.reference).toBe(list.id);
    expect(detail.resultFields.some(field => /email|payload|companyCode|branchId|^id$|orderId/i.test(field))).toBe(false);
    expect(retryable).toMatchObject({ method: "GET", path: "/retail/debt-reminders/deliveries/retryable", permissions: ["retail:manage"] });
    expect(retryable.fields.find(field => field.key === "targetBranch" && field.apiKey === "branchId")).toMatchObject({ reference: "branch.list", required: false });
    expect(retryable.resultFields).toEqual(["recipientName", "recipientEmail", "orderCode", "subject", "message", "attempt", "maxAttempts", "createdAt"]);
    expect(retryable.description).toContain("lỗi tạm thời");
    expect(retryable.description).toContain("nội dung thư");
    expect(retry).toMatchObject({ method: "POST", path: "/retail/debt-reminders/deliveries/:id/retry", permissions: ["retail:manage"], confirmation: true });
    expect(retry.fields.find(field => field.key === "path_id")?.reference).toBe(retryable.id);
    expect(retry.description).toContain("địa chỉ");
    expect(retry.description).toContain("nội dung");
    expect(run).toMatchObject({ method: "POST", path: "/retail/debt-reminders/run", permissions: ["retail:manage"], confirmation: true });
    expect(run.fields.find(field => field.key === "targetBranch" && field.apiKey === "branchId")).toMatchObject({ reference: "branch.list", required: false });
    expect(run.description).toContain("xếp email");
    expect(run.resultFields).not.toContain("cycleKey");
    for (const operation of [list, detail, retryable, retry, run]) {
      expect(coverage.entries.find(entry => entry.method === operation.method && entry.path === operation.path)).toMatchObject({ status: "contract", id: operation.id });
    }
    expect(defaultWorkflow(run).confirmationLocked).toBe(true);
    expect(defaultWorkflow(retry).confirmationLocked).toBe(true);
  });

  it("limits Google Drive assistant browsing to the signed-in account and safe file metadata", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "resource.google-drive.list")!;
    expect(list).toMatchObject({ method: "GET", path: "/integrations/google-drive/resources", permissions: ["resource:read"] });
    expect(list.fields.find(field => field.apiKey === "folderId")).toMatchObject({ reference: list.id, referenceValueKey: "id", required: false });
    expect(list.fields.some(field => field.apiKey === "ownerId")).toBe(false);
    expect(list.resultFields).toEqual(["name", "mimeType", "size", "createdAt"]);
    expect(list.resultFields.some(field => /id|link|token|owner/i.test(field))).toBe(false);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/integrations/google-drive/resources/group/:roomId")).toMatchObject({ status: "unsupported" });
    expect(coverage.entries.find(entry => entry.method === "DELETE" && entry.path === "/integrations/google-drive/resources/:id")).toMatchObject({ status: "unsupported" });
  });

  it("requires confirmation before sending one-time attendance codes by email", () => {
    const operation = ASSISTANT_OPERATIONS.find(op => op.id === "student.online-attendance.create-sessions")!;
    expect(operation).toMatchObject({ method: "POST", path: "/attendance/online/sessions", permissions: ["people:manage"], confirmation: true });
    expect(operation.fields.find(field => field.key === "batchId")).toMatchObject({ reference: "batch.list", required: true });
    expect(operation.fields.find(field => field.key === "date")).toMatchObject({ type: "date", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
    expect(operation.resultFields).toEqual(["sent", "skippedNotRegistered", "skippedNoEmail", "failed", "total"]);
    expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
  });

  it("connects VAT invoice entry and reads the current period version before updating it", () => {
    const vatList = ASSISTANT_OPERATIONS.find(op => op.id === "finance.vat.list")!;
    const invoice = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/finance/reporting/vat/invoices")!;
    const period = ASSISTANT_OPERATIONS.find(op => op.method === "PUT" && op.path === "/finance/reporting/vat/period")!;
    expect(vatList.fields.find(field => field.key === "query_period")?.required).toBe(true);
    expect(invoice.fields.find(field => field.key === "deductibleVat")?.defaultValue).toBe(0);
    expect(invoice).toMatchObject({ confirmation: true, permissions: ["finance-wallet:manage"] });
    expect(period.fields.find(field => field.key === "version")?.required).toBe(false);
    expect(period.description).toContain("lấy phiên bản kỳ hiện tại");
    expect(defaultWorkflow(period).confirmationLocked).toBe(true);
  });

  it("imports VAT only from an issued retail invoice after selecting its finance branch", () => {
    const invoiceLookup = ASSISTANT_OPERATIONS.find(op => op.id === "retail.invoice.list")!;
    const importTax = ASSISTANT_OPERATIONS.find(op => op.id === "finance.tax.from-invoice")!;
    expect(invoiceLookup).toMatchObject({ method: "GET", path: "/retail/invoices", resultFields: expect.arrayContaining(["invoiceNo", "orderCode", "customerName", "status"]) });
    expect(invoiceLookup.fields.find(field => field.apiKey === "q")?.key).toBe("search");
    expect(importTax).toMatchObject({ method: "POST", path: "/finance/management/tax/from-invoice/:id", confirmation: true });
    expect(importTax.fields.find(field => field.apiKey === "id")?.reference).toBe("retail.invoice.list");
    expect(importTax.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list" });
    expect(importTax.permissionGroups).toEqual([["finance-wallet:manage"], ["retail:read", "retail:manage"]]);
    expect(importTax.resultFields).not.toContain("sourceInvoiceId");
    expect(defaultWorkflow(importTax).confirmationLocked).toBe(true);
  });

  it("limits manual stock-log reversal to eligible outbound records and a scoped branch", () => {
    const logList = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.stock-log.list")!;
    const reverse = ASSISTANT_OPERATIONS.find(op => op.id === "inventory.stock-log.reverse")!;
    expect(logList).toMatchObject({ method: "GET", path: "/crud/stock-logs", permissions: ["inventory:read"], confirmation: false });
    expect(logList.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list" });
    expect(reverse).toMatchObject({ method: "POST", path: "/inventory/stock-logs/:id/reverse", confirmation: true, permissions: ["inventory:manage"] });
    expect(reverse.fields.find(field => field.apiKey === "id")?.reference).toBe("inventory.stock-log.list");
    expect(reverse.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list" });
    expect(reverse.fields.find(field => field.apiKey === "reason")?.required).toBe(true);
    expect(defaultWorkflow(reverse).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "GET" && entry.path === "/crud/stock-logs")).toMatchObject({ status: "manual", id: "inventory.stock-log.list" });
  });

  it("keeps account bank settings outside chat while PATCH can clear omitted values", () => {
    const update = coverage.entries.find(entry => entry.method === "PATCH" && entry.path === "/auth/bank-settings");
    const read = coverage.entries.find(entry => entry.method === "GET" && entry.path === "/auth/users/:id/bank-settings");
    expect(update).toMatchObject({ status: "unsupported", reason: expect.stringContaining("có thể xóa các trường còn lại") });
    expect(read).toMatchObject({ status: "unsupported", reason: expect.stringContaining("trả thông tin tài khoản ngân hàng của người khác") });
    expect(ASSISTANT_OPERATIONS.some(operation => [update, read].some(route => route?.method === operation.method && route.path === operation.path))).toBe(false);
  });

  it("only connects fixed existing routes, preserving mandatory confirmation and permission groups", () => {
    expect(ASSISTANT_OPERATIONS.length).toBeGreaterThan(400);
    expect(new Set(ASSISTANT_OPERATIONS.map(o => o.module)).size).toBe(17);
    expect(new Set(ASSISTANT_OPERATIONS.map(o => o.id)).size).toBe(ASSISTANT_OPERATIONS.length);
    for (const op of ASSISTANT_OPERATIONS.filter(o => o.adapter === "contract")) {
      expect(inventory.endpoints.some(e => e.method === op.method && e.path === op.path), op.path).toBe(true);
      expect(op.permissionGroups?.length).toBeGreaterThan(0);
      expect(op.permissionGroups?.every(group => group.length > 0 && group.every(p => typeof p === "string" && p.includes(":")))).toBe(true);
      expect(new Set(op.fields.map(f => f.key)).size).toBe(op.fields.length);
      expect(op.fields.length).toBeLessThanOrEqual(100);
      expect(op.fields.every(f => ["path", "query", "body"].includes(f.source!))).toBe(true);
      expect(op.fields.some(f => /^(companyCode|companyId|password|idempotencyKey)$/.test(f.apiKey!))).toBe(false);
      expect(op.fields.filter(f => f.apiKey === "branchId").every(f => f.reference === "branch.list" && (op.id.startsWith("recruitment.") ? f.key === "branchId" : f.key === "targetBranch"))).toBe(true);
      if (op.method !== "GET" && !op.readOnly && !["retail.order.quote", "student.bulk.preview", "student.bulk.delete.preview", "inventory.reconciliation.run", "repair.device.lookup", "company-email.celebration.preview", "marketing.tiktok.creator-info", "marketing.tiktok-business.creator-info"].includes(op.id)) expect(defaultWorkflow(op).confirmationLocked).toBe(true);
    }
    expect(ASSISTANT_OPERATIONS.filter(op => op.method !== "GET" && !op.readOnly && !op.confirmation).map(op => op.id).sort()).toEqual(["company-email.celebration.preview", "inventory.reconciliation.run", "marketing.tiktok-business.creator-info", "marketing.tiktok.creator-info", "repair.device.lookup", "retail.order.quote", "student.bulk.delete.preview", "student.bulk.preview"].sort());
    const manuallyDiscoveredRoutes = manualRouteCoverage.filter(route => !inventory.endpoints.some(endpoint => endpoint.method === route.method && endpoint.path === route.path));
    expect(coverage.entries.length).toBe(inventory.endpoints.length + manuallyDiscoveredRoutes.length);
    const pendingEntries = coverage.entries.filter(entry => entry.status === "pending");
    expect(pendingEntries).toEqual([]);
    expect(coverage.reviewPending).toBe(0);
    expect(pendingEntries.every(entry => !ASSISTANT_OPERATIONS.some(op => op.method === entry.method && op.path === entry.path))).toBe(true);
    const unsupportedEntries = coverage.entries.filter(entry => entry.status === "unsupported");
    expect(coverage.intentionallyUnsupported).toBe(unsupportedEntries.length);
    expect(unsupportedEntries.every(entry => typeof entry.reason === "string" && entry.reason.trim().length > 0)).toBe(true);
    expect(unsupportedEntries.every(entry => !ASSISTANT_OPERATIONS.some(op => op.method === entry.method && op.path === entry.path))).toBe(true);
    const unsupportedReport = readFileSync("server/assistant/UNSUPPORTED.md", "utf8");
    for (const entry of unsupportedEntries) {
      expect(unsupportedReport).toContain(`- \`${entry.method} ${entry.path}\` — ${entry.reason} — \`${entry.file}:${entry.line}\``);
    }
  });
  it("exposes confirmed retail after-sale creation with named order/SKU and protected session/version fields", () => {
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "retail.after-sale.create")!;
    const items = create.fields.find(field => field.key === "items");
    expect(create).toMatchObject({ method: "POST", path: "/retail/after-sales", permissionGroups: [["retail:manage"]], confirmation: true, contextBody: ["idempotencyKey"] });
    expect(create.systemBodyFields).toEqual(expect.arrayContaining(["expectedVersion", "cashSessionId"]));
    expect(create.fields.find(field => field.key === "orderId")).toMatchObject({ reference: "retail.order.list", systemRequired: true, label: "Mã đơn bán gốc" });
    expect(items).toMatchObject({ type: "json", systemRequired: true, structure: { type: "array", minItems: 1, maxItems: 30, items: { type: "object" } } });
    expect(items?.structure?.items?.keys?.sku).toMatchObject({ reference: "retail.order.products.list", referenceValueKey: "sku", required: true });
    expect(items?.structure?.items?.keys?.quantity).toMatchObject({ type: "number", required: true, min: 1, integer: true });
    expect(items?.structure?.items?.keys?.unitAmount?.required).toBe(false);
    expect(create.fields.find(field => field.key === "shiftSelector")).toMatchObject({ reference: "retail.shift.list", referenceValueKey: "id", referenceContext: { query_status: "open" } });
    expect(create.fields.some(field => field.apiKey === "idempotencyKey" || field.apiKey === "cashSessionId")).toBe(false);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.method === "POST" && entry.path === "/retail/after-sales")).toMatchObject({ status: "contract", id: "retail.after-sale.create" });
  });

  it("keeps after-sale reconcile and revoke unavailable without the original idempotent request context", () => {
    const recoveryRoutes = [
      ["/retail/after-sales/reconcile", /idempotencyKey.*requestFingerprint/i],
      ["/retail/after-sales/revoke", /idempotencyKey.*payload/i],
    ] as const;
    for (const [path, reasonPattern] of recoveryRoutes) {
      const entry = coverage.entries.find(candidate => candidate.method === "POST" && candidate.path === path)!;
      expect(entry.status).toBe("unsupported");
      expect(entry.reason).toMatch(reasonPattern);
      expect(ASSISTANT_OPERATIONS.some(operation => operation.method === "POST" && operation.path === path)).toBe(false);
    }
  });

  it("documents uncontracted batch, payroll, recovery, print, and outbound-send routes as intentionally unavailable", () => {
    const reviewed = [
      ["POST", "/marketing-campaigns/preview-drive", /Google Drive.*bộ chọn tệp/i],
      ["POST", "/bulk-create/ai/scene", /canvas.*layer.*AI/i],
      ["POST", "/bulk-create/templates", /canvas.*layer/i],
      ["POST", "/bulk-create/preview", /template động.*render/i],
      ["POST", "/bulk-create/jobs", /tối đa 100 dòng.*chi phí/i],
      ["PUT", "/video-caption-projects/:id/segments", /thay toàn bộ timeline.*expectedVersion/i],
      ["POST", "/payroll/runs/:id/exports", /XLSX.*lương nhạy cảm/i],
      ["POST", "/payroll/periods/:periodKey/snapshot", /snapshot.*đầu vào lương/i],
      ["POST", "/payroll/periods/:periodKey/lock", /Khóa kết quả công/i],
      ["POST", "/payroll/periods/:periodKey/run", /tạo lượt chạy trực tiếp/i],
      ["POST", "/payroll/periods/:periodKey/process", /tính và ghi kết quả lương/i],
      ["POST", "/payroll/periods/:periodKey/approve", /Phê duyệt ở cấp kỳ/i],
      ["POST", "/payroll/periods/:periodKey/close", /Đóng kỳ/i],
      ["PUT", "/batches/:id/attendance", /toàn bộ attendance.*nhiều học viên/i],
      ["POST", "/retail/shifts/:id/cash-movements/reconcile", /khóa chống trùng.*payload/i],
      ["POST", "/retail/orders/checkout/reconcile", /khóa chống trùng.*payload/i],
      ["POST", "/retail/orders/checkout/revoke", /khóa chống trùng.*payload/i],
      ["POST", "/retail/orders/draft-requests/reconcile", /khóa chống trùng.*payload/i],
      ["POST", "/retail/orders/draft-requests/revoke", /khóa chống trùng.*payload/i],
      ["POST", "/retail/orders/:id/payments/reconcile", /khóa chống trùng/i],
      ["POST", "/retail/orders/:id/payments/revoke", /khóa chống trùng/i],
      ["POST", "/retail/orders/:id/cancel/reconcile", /khóa chống trùng/i],
      ["POST", "/retail/orders/:id/cancel/revoke", /khóa chống trùng/i],
      ["POST", "/retail/invoices/:id/pos-print", /in hóa đơn tại POS/i],
      ["POST", "/retail/invoices/:id/payment-print", /in biên nhận.*POS/i],
      ["POST", "/retail/invoices/:id/reprint", /In lại hóa đơn/i],
      ["POST", "/marketing/runs/:type", /hàng loạt.*gửi thông báo/i],
      ["POST", "/marketing/deliveries/:id/retry", /gửi lại cả email marketing/i],
      ["POST", "/marketing/test-send", /phát email.*thật/i],
    ] as const;
    for (const [method, path, reasonPattern] of reviewed) {
      const entry = coverage.entries.find(candidate => candidate.method === method && candidate.path === path)!;
      expect(entry.status, `${method} ${path}`).toBe("unsupported");
      expect(entry.reason, `${method} ${path}`).toMatch(reasonPattern);
      expect(ASSISTANT_OPERATIONS.some(operation => operation.method === method && operation.path === path)).toBe(false);
    }
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "batch.attendance.record.update")).toBeDefined();
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "payroll.run.calculate")).toBeDefined();
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "finance.reminders.delivery.retry-in-app")).toBeDefined();
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "retail.debt-reminders.delivery.retry")).toBeDefined();
  });

  it("keeps ambiguous authentication, payment callback, and generic chat routes out of business workflows", () => {
    const reviewed = [
      ["GET", "/facebook/oauth-callback", /OAuth.*state\/cookie.*nhiều router/i],
      ["POST", "/webhook/payment", /Webhook thanh toán.*nhà cung cấp/i],
      ["POST", "/auth/register", /Đăng ký tài khoản công khai.*mật khẩu/i],
      ["POST", "/auth/login", /Đăng nhập.*mật khẩu/i],
      ["POST", "/auth/refresh-token", /token bảo mật/i],
      ["POST", "/auth/logout", /Đăng xuất.*phiên xác thực/i],
      ["DELETE", "/auth/users/:id", /ID cơ sở dữ liệu.*theo tên/i],
      ["PUT", "/company-payment/vietqr", /VietQR.*thông tin tài khoản/i],
      ["POST", "/chatbot/chat", /hội thoại tổng quát.*vai trò system/i],
    ] as const;
    for (const [method, path, reasonPattern] of reviewed) {
      const entry = coverage.entries.find(candidate => candidate.method === method && candidate.path === path)!;
      expect(entry.status, `${method} ${path}`).toBe("unsupported");
      expect(entry.reason, `${method} ${path}`).toMatch(reasonPattern);
      expect(ASSISTANT_OPERATIONS.some(operation => operation.method === method && operation.path === path)).toBe(false);
    }
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.create")).toBeDefined();
  });

  it("documents routes without user permissions that require secrets, callbacks, files, devices, or privileged settings", () => {
    const reviewed = [
      ["GET", "/social-integrations/:id", /thông tin xác thực.*danh sách tài khoản/i],
      ["POST", "/facebook/init-oauth", /OAuth.*cookie/i],
      ["POST", "/facebook/data-deletion-callback", /Callback xóa dữ liệu.*công khai/i],
      ["GET", "/facebook/data-deletion-status/:code", /mã yêu cầu xóa công khai/i],
      ["POST", "/facebook/n8n-callback", /Callback từ n8n/i],
      ["POST", "/zalo/validate-integration", /thông tin xác thực Zalo/i],
      ["POST", "/zalo/save-integration", /thông tin xác thực.*Zalo/i],
      ["DELETE", "/zalo/integration", /Ngắt tích hợp Zalo/i],
      ["POST", "/scheduler/check-and-publish", /phát hành nhiều nội dung/i],
      ["POST", "/marketing-campaigns/internal/prepare", /Endpoint nội bộ/i],
      ["POST", "/marketing-campaigns/internal/media", /Endpoint nội bộ/i],
      ["POST", "/marketing-campaigns/internal/verify", /Endpoint kiểm tra nội bộ/i],
      ["POST", "/marketing-campaigns/internal/publish", /Endpoint worker.*phát hành/i],
      ["POST", "/marketing-campaigns/internal/tiktok-status", /trạng thái TikTok/i],
      ["POST", "/marketing-media/campaign-sign-upload", /tệp.*tải lên/i],
      ["GET", "/marketing-media/audio-proxy", /Proxy trả dữ liệu âm thanh/i],
      ["GET", "/marketing-media/video-proxy", /Proxy trả dữ liệu video/i],
      ["GET", "/order-sheets/service-account", /service account.*credential/i],
      ["POST", "/order-sheets/integrations/:integrationId/test", /Google Sheets.*credential/i],
      ["POST", "/order-sheets/integrations/:integrationId/template", /ghi cấu trúc.*dịch vụ ngoài/i],
      ["POST", "/order-sheets/orders/:orderId/retry", /Google Sheets.*bản ghi trùng/i],
      ["POST", "/company-telegram-order/test", /Telegram.*kênh bên ngoài/i],
      ["POST", "/timekeeping/check-in", /tệp ảnh.*khuôn mặt.*vị trí/i],
      ["POST", "/timekeeping/check-out", /tệp ảnh.*khuôn mặt.*vị trí/i],
      ["GET", "/payroll/runs/:id/payslips/:employeeId/print", /HTML phiếu lương.*thu nhập nhạy cảm/i],
      ["PATCH", "/student-management/settings", /superadmin.*toàn hệ thống/i],
      ["POST", "/attendance/online/checkin", /mã phiên.*ảnh khuôn mặt/i],
      ["POST", "/log-client-error", /telemetry.*log lỗi nội bộ/i],
      ["GET", "/repair/feedback/:token", /token công khai.*không gắn/i],
      ["POST", "/repair/feedback/:token", /token công khai.*thay mặt khách hàng/i],
    ] as const;
    for (const [method, path, reasonPattern] of reviewed) {
      const entry = coverage.entries.find(candidate => candidate.method === method && candidate.path === path)!;
      expect(entry.status, `${method} ${path}`).toBe("unsupported");
      expect(entry.reason, `${method} ${path}`).toMatch(reasonPattern);
      expect(ASSISTANT_OPERATIONS.some(operation => operation.method === method && operation.path === path)).toBe(false);
    }
  });

  it("documents dynamic publish, credential validation, and whole-share replacement as unavailable", () => {
    const reviewed = [
      ["POST", "/facebook/publish", /payload đăng Facebook tổng quát.*slot chiến dịch/i],
      ["POST", "/facebook/validate-token", /token Facebook.*bí mật/i],
      ["POST", "/tiktok/validate-token", /token TikTok.*bí mật/i],
      ["POST", "/tiktok-business/validate-token", /token TikTok Business.*bí mật/i],
      ["PUT", "/resources/:id/shares", /thay toàn bộ danh sách chia sẻ.*ID user\/room/i],
    ] as const;
    for (const [method, path, reasonPattern] of reviewed) {
      const entry = coverage.entries.find(candidate => candidate.method === method && candidate.path === path)!;
      expect(entry.status, `${method} ${path}`).toBe("unsupported");
      expect(entry.reason, `${method} ${path}`).toMatch(reasonPattern);
      expect(ASSISTANT_OPERATIONS.some(operation => operation.method === method && operation.path === path)).toBe(false);
    }
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.campaign.slot.publish-now")).toBeDefined();
  });

  it("validates nested list data before dispatch, including required keys and scope injection", () => {
    const op = ASSISTANT_OPERATIONS.find(o => o.path === "/inventory/receiving/receipts" && o.method === "POST")!;
    const field = op.fields.find(f => f.key === "items")!;
    const item = { productId: "507f1f77bcf86cd799439011", variantId: "507f1f77bcf86cd799439012", quantity: 1, unitCost: 0 };
    expect(validateField(field, JSON.stringify([item]))).toBe(JSON.stringify([item]));
    expect(() => validateField(field, JSON.stringify([{ ...item, companyCode: "OTHER" }]))).toThrow("companyCode");
    expect(() => validateField(field, JSON.stringify([{ ...item, quantity: -1 }]))).toThrow();
    expect(() => validateField(field, JSON.stringify([{ productId: item.productId }]))).toThrow("variantId");
    expect(() => validateField(field, '{"__proto__":{"polluted":true}}')).toThrow();
    expect(collectValues(defaultWorkflow(op), { supplierId: "x" }).missing).toContain(field.label);
  });
  it("stores structured defaults as JSON strings accepted by the workflow editor", () => {
    for (const op of ASSISTANT_OPERATIONS) for (const field of defaultWorkflow(op).fields) {
      if (field.type === "json" && field.defaultValue !== undefined) {
        expect(typeof field.defaultValue).toBe("string");
        expect(() => validateField(field, field.defaultValue)).not.toThrow();
      }
    }
  });
  it("does not let personal rules change an API binding or disable mutation confirmation", () => {
    const op = ASSISTANT_OPERATIONS.find(o => o.path === "/courses" && o.method === "POST")!;
    const defaults = defaultWorkflow(op);
    const payload = { ...defaults, fields: defaults.fields.map(f => ({ key: f.key, required: !!f.systemRequired, source: "path", apiKey: "companyCode" })) };
    expect(() => validateWorkflow(op, { ...payload, requireConfirmation: false })).toThrow("xác nhận");
    const saved = validateWorkflow(op, payload);
    expect(saved.fields.every(f => f.source === "body")).toBe(true);
    expect(saved.fields.some(f => f.apiKey === "companyCode")).toBe(false);
  });
  it("connects scoped payroll adjustment decisions and clearly confirms payroll period reset", () => {
    const adjustments = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.adjustment.list")!;
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.adjustment.create")!;
    const approve = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.adjustment.approve")!;
    const reject = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.adjustment.reject")!;
    const reset = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.period.reset")!;
    expect(adjustments).toMatchObject({ method: "GET", path: "/payroll/periods/:periodKey/adjustments", permissions: ["payroll-period:read"], confirmation: false });
    expect(adjustments.resultFields).toEqual(["employeeName", "kind", "amount", "reason", "status", "createdAt"]);
    expect(adjustments.fields.find(field => field.apiKey === "periodKey")).toMatchObject({ source: "path", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" });
    expect(create).toMatchObject({ method: "POST", path: "/payroll/periods/:periodKey/adjustments", permissions: ["payroll-period:manage"], confirmation: true });
    expect(create.permissionGroups).toEqual([["payroll-period:manage"], ["payroll-period:read"], ["access:read", "hr:read"]]);
    expect(create.fields.find(field => field.apiKey === "employeeId")).toMatchObject({ reference: "employee.list", systemRequired: true });
    expect(create.fields.find(field => field.apiKey === "advanceDetails")?.requiredWhen).toEqual({ field: "kind", equals: "advance" });
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    for (const operation of [approve, reject]) {
      expect(operation).toMatchObject({ method: "POST", permissions: ["payroll-period:manage"], confirmation: true });
      expect(operation.permissionGroups).toEqual([["payroll-period:manage"], ["payroll-period:read"]]);
      expect(operation.fields.find(field => field.apiKey === "adjustmentId")).toMatchObject({ reference: "payroll.adjustment.list" });
      expect(operation.fields.find(field => field.apiKey === "branchId")).toMatchObject({ reference: "branch.list", required: true });
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
      expect(coverage.entries.find(entry => entry.path === operation.path && entry.method === operation.method)).toMatchObject({ status: "contract", id: operation.id });
    }
    expect(reset).toMatchObject({ method: "DELETE", path: "/payroll/periods/:periodKey", permissions: ["payroll-period:manage"], confirmation: true });
    expect(reset.description).toMatch(/không thể khôi phục/i);
    expect(defaultWorkflow(reset).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === create.path && entry.method === create.method)).toMatchObject({ status: "contract", id: create.id });
  });
  it("exposes branch-scoped payroll input lookup and confirmed name-based updates with hidden version fields", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.path === "/payroll/periods/:periodKey/inputs" && op.method === "GET")!;
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.period.input.update")!;
    const bulk = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.period.inputs.bulk")!;
    expect(list).toMatchObject({ permissionGroups: [["payroll-period:read", "payroll-period:manage"], ["access:read", "hr:read"]], confirmation: false });
    expect(list.resultFields).toEqual(["employeeName", "periodKey", "agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction", "editable", "needsRefresh"]);
    expect(update).toMatchObject({ method: "PUT", path: "/payroll/periods/:periodKey/inputs/:employeeId", confirmation: true });
    expect(update.permissionGroups).toEqual([["payroll-period:manage"], ["access:read", "hr:read"]]);
    expect(update.systemBodyFields).toContain("expectedVersion");
    expect(update.fields.find(field => field.apiKey === "employeeId")).toMatchObject({ reference: "employee.list", label: "Tên nhân viên" });
    expect(update.fields.find(field => field.apiKey === "reason")).toMatchObject({ required: true, label: "Lý do đối soát" });
    expect(update.fields.some(field => field.apiKey === "expectedVersion")).toBe(false);
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === update.path && entry.method === update.method)).toMatchObject({ status: "contract", id: update.id });

    expect(bulk).toMatchObject({ method: "PUT", path: "/payroll/periods/:periodKey/inputs", confirmation: true, permissions: ["payroll-period:manage"] });
    expect(bulk.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list", required: true });
    expect(bulk.fields.find(field => field.apiKey === "rows")?.structure).toMatchObject({
      type: "array", minItems: 1, maxItems: 20,
      items: { type: "object", keys: { employeeId: { reference: "employee.list", referenceValueKey: "id", required: true }, reason: { required: true } } },
    });
    expect(defaultWorkflow(bulk).confirmationLocked).toBe(true);
    expect(bulk.description).toMatch(/thành công một phần/i);
    expect(coverage.entries.find(entry => entry.path === bulk.path && entry.method === bulk.method)).toMatchObject({ status: "contract", id: bulk.id });

    const removePending = ASSISTANT_OPERATIONS.find(op => op.id === "branch.pending.delete")!;
    expect(removePending).toMatchObject({ method: "DELETE", path: "/auth/branches/:id/pending", confirmation: true, roles: ["admin"], permissionGroups: [["access:manage"], ["access:read", "hr:read"]] });
    expect(removePending.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "branch.list", source: "path" });
    expect(removePending.resultFields).toEqual(["deleted", "name"]);
    expect(coverage.entries.find(entry => entry.path === removePending.path && entry.method === removePending.method)).toMatchObject({ status: "contract", id: removePending.id });
  });
  it("exposes safe payroll line-override lookup and confirmed draft-only bulk edits", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.period.line-overrides.list")!;
    const bulk = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.period.line-overrides.bulk")!;
    expect(list).toMatchObject({ method: "GET", path: "/payroll/periods/:periodKey/line-overrides", permissionGroups: [["payroll-period:read"], ["access:read", "hr:read"]], confirmation: false });
    expect(list.fields.find(field => field.apiKey === "periodKey")).toMatchObject({ required: true, pattern: "^\\d{4}-(0[1-9]|1[0-2])$" });
    expect(list.resultFields).toEqual(expect.arrayContaining(["employeeName", "reason", "baseSalary", "customValues"]));
    expect(bulk).toMatchObject({ method: "PUT", path: "/payroll/periods/:periodKey/line-overrides", permissions: ["payroll-period:manage"], permissionGroups: [["payroll-period:manage"], ["payroll-period:read"], ["access:read", "hr:read"]], confirmation: true });
    expect(bulk.fields.find(field => field.apiKey === "rows")?.structure).toMatchObject({
      type: "array", minItems: 1, maxItems: 20,
      items: { type: "object", keys: {
        employeeId: { reference: "employee.list", referenceValueKey: "id", required: true },
        reason: { required: true, max: 500 },
        customValues: { type: "object", open: true },
        clearFields: { type: "array", maxItems: 12, items: { pattern: "^(?:baseSalary|adjustedBase|overtime|bonusTotal|penaltyTotal|socialInsurance|healthInsurance|unemploymentInsurance|personalIncomeTax|otherDeductions|advances|custom\\..{1,100})$" } },
      } },
    });
    const fields = bulk.fields.find(field => field.apiKey === "rows")?.structure?.items?.keys?.values?.keys || {};
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(["baseSalary", "adjustedBase", "personalIncomeTax", "advances"]));
    expect(Object.keys(fields)).not.toEqual(expect.arrayContaining(["commission", "hiddenIncome", "deductionTotal", "net"]));
    expect(defaultWorkflow(bulk).confirmationLocked).toBe(true);
    expect(bulk.description).toMatch(/trạng thái nháp/i);
    expect(coverage.entries.filter(entry => entry.path === bulk.path)).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "GET", status: "contract", id: list.id }),
      expect.objectContaining({ method: "PUT", status: "contract", id: bulk.id }),
    ]));
  });
  it("creates only a branch-scoped regular payroll draft and derives its dates from the period", () => {
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.create")!;
    expect(create).toMatchObject({ method: "POST", path: "/payroll/runs", permissions: ["payroll-period:manage"], confirmation: true, fixedBodyValues: { type: "regular" } });
    expect(create.systemBodyFields).toEqual(expect.arrayContaining(["startDate", "endDate", "type"]));
    expect(create.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list", required: true });
    expect(create.fields.find(field => field.apiKey === "periodKey")).toMatchObject({ required: true, pattern: "^\\d{4}-(0[1-9]|1[0-2])$" });
    expect(create.fields.some(field => ["startDate", "endDate", "type"].includes(field.apiKey || ""))).toBe(false);
    expect(create.resultFields).toEqual(["periodKey", "startDate", "endDate", "type", "status"]);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === create.path && entry.method === create.method)).toMatchObject({ status: "contract", id: create.id });
  });
  it("lists payroll runs by period with branch scope and hidden internal selectors", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.list")!;
    expect(list).toMatchObject({ method: "GET", path: "/payroll/runs", confirmation: false });
    expect(list.permissionGroups).toEqual([["payroll-period:read", "payroll-period:manage"]]);
    expect(list.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list", required: true });
    expect(list.fields.find(field => field.apiKey === "periodKey")).toMatchObject({ pattern: "^\\d{4}-(0[1-9]|1[0-2])$" });
    expect(list.fields.find(field => field.apiKey === "status")?.options).toEqual(["draft", "review", "closed", "paid"]);
    expect(list.resultFields).toEqual(["periodKey", "startDate", "endDate", "type", "status", "createdAt"]);
    expect(list.resultFields).not.toContain("version");
    expect(coverage.entries.find(entry => entry.path === list.path && entry.method === list.method)).toMatchObject({ status: "contract", id: list.id });
  });
  it("lists payroll payment batches with read permission and a restricted result schema", () => {
    const payments = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.payments.list")!;
    expect(payments).toMatchObject({ method: "GET", path: "/payroll/runs/:id/payments", confirmation: false });
    expect(payments.permissionGroups).toEqual([["payroll-payment:read"]]);
    expect(payments.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list", source: "path" });
    expect(payments.resultFields).toEqual(["amount", "status", "paymentDate", "createdAt", "employeeCount"]);
    expect(coverage.entries.find(entry => entry.path === payments.path && entry.method === payments.method)).toMatchObject({ status: "contract", id: payments.id });
  });
  it("creates a confirmed, branch-scoped payroll payment draft with employee-name allocations", () => {
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.payment.create")!;
    expect(create).toMatchObject({ method: "POST", path: "/payroll/runs/:id/payments", confirmation: true });
    expect(create.permissionGroups).toEqual([["payroll-payment:manage"], ["payroll-period:read", "payroll-period:manage"], ["access:read", "hr:read"]]);
    expect(create.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list", source: "path" });
    expect((create.fields.find(field => field.apiKey === "lines")?.structure as any)?.items?.keys?.employeeId).toMatchObject({ reference: "employee.list" });
    expect(create.contextBody).toContain("idempotencyKey");
    expect(create.resultFields).toEqual(["amount", "status", "employeeCount", "paymentDate", "createdAt"]);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === create.path && entry.method === create.method)).toMatchObject({ status: "contract", id: create.id });
  });
  it("confirms, cancels, and reverses only named payroll payment batches in the selected branch", () => {
    const cases = [
      ["payroll.payment.cancel", "/payroll/payments/:id/cancel", "draft", "cancelled"],
      ["payroll.payment.confirm", "/payroll/payments/:id/confirm", "draft", "confirmed"],
      ["payroll.payment.reverse", "/payroll/payments/:id/reverse", "confirmed", "reversed"],
    ] as const;
    for (const [id, path, sourceStatus, resultStatus] of cases) {
      const operation = ASSISTANT_OPERATIONS.find(item => item.id === id)!;
      expect(operation).toMatchObject({ method: "POST", path, confirmation: true });
      expect(operation.permissionGroups).toEqual([
        ["payroll-payment:manage"], ["payroll-payment:read"],
        ["payroll-period:read", "payroll-period:manage"], ["access:read"],
      ]);
      expect(operation.fields.find(field => field.source === "path" && field.apiKey === "id")).toMatchObject({
        reference: "payroll.run.payments.list", referenceParentKey: "query_id",
      });
      expect(operation.fields.find(field => field.key === "query_id")).toMatchObject({
        source: "query", apiKey: "id", reference: "payroll.run.list", required: true,
      });
      expect(operation.fields.find(field => field.key === "targetBranch")).toMatchObject({
        source: "query", apiKey: "branchId", reference: "branch.list", required: true,
      });
      expect(operation.resultFields).toContain("status");
      expect(operation.description).toContain(sourceStatus === "draft" ? "nháp" : "đã xác nhận");
      expect(operation.description).toContain(resultStatus === "reversed" ? "không thu hồi tiền" : id === "payroll.payment.confirm" ? "không gửi lệnh ngân hàng" : "không chuyển tiền");
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
      expect(coverage.entries.find(entry => entry.path === path && entry.method === "POST")).toMatchObject({ status: "contract", id });
    }
    const confirm = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.payment.confirm")!;
    expect(confirm.fields.find(field => field.key === "paymentDate"))?.toMatchObject({ type: "date", required: true });
    expect(confirm.description).toContain("đã thực hiện bên ngoài hệ thống");
  });
  it("creates and updates company branches through named, permissioned workflows", () => {
    const create = ASSISTANT_OPERATIONS.find(op => op.id === "branch.create")!;
    expect(create).toMatchObject({ method: "POST", path: "/auth/branches", confirmation: true, roles: ["admin", "superadmin", "branch_owner"], permissionGroups: [["access:manage"]] });
    expect(create.fields.find(field => field.apiKey === "code")).toMatchObject({ required: true, max: 32, pattern: "^[A-Za-z0-9_-]+$" });
    expect(create.fields.map(field => field.apiKey)).not.toEqual(expect.arrayContaining(["managerId", "locationConfig", "companyCode"]));
    expect(create.resultFields).toEqual(["name", "code", "address", "phone", "isActive", "pendingOwnerSetup"]);
    expect(defaultWorkflow(create).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === create.path && entry.method === create.method)).toMatchObject({ status: "contract", id: create.id });

    const update = ASSISTANT_OPERATIONS.find(op => op.id === "branch.update")!;
    expect(update).toMatchObject({ method: "PATCH", path: "/auth/branches/:id", confirmation: true, roles: create.roles, permissionGroups: [["access:manage"], ["access:read", "hr:read"]] });
    expect(update.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "branch.list", source: "path" });
    expect(update.fields.filter(field => field.source === "body").every(field => field.required === false)).toBe(true);
    expect(update.fields.map(field => field.apiKey)).not.toEqual(expect.arrayContaining(["managerId", "locationConfig", "companyCode"]));
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === update.path && entry.method === update.method)).toMatchObject({ status: "contract", id: update.id });
  });
  it("exposes only aggregate celebration email history under company settings permission", () => {
    const history = ASSISTANT_OPERATIONS.find(op => op.id === "company-email.celebration.history")!;
    expect(history).toMatchObject({ method: "GET", path: "/company-email/celebration/history", confirmation: false, permissionGroups: [["settings:manage"]] });
    expect(history.resultFields).toEqual(["totalCount", "sentCount", "failedCount", "pendingCount", "skippedCount"]);
    expect(history.fields.filter(field => field.source === "body" || field.source === "query")).toEqual([]);
    expect(coverage.entries.find(entry => entry.path === history.path && entry.method === history.method)).toMatchObject({ status: "contract", id: history.id });
  });
  it("shows only safe email celebration configuration fields", () => {
    const config = ASSISTANT_OPERATIONS.find(op => op.id === "company-email.celebration.config")!;
    expect(config).toMatchObject({ method: "GET", path: "/company-email/celebration", confirmation: false, permissionGroups: [["settings:manage"]] });
    expect(config.resultFields).toEqual(["configured", "birthdayEnabled", "holidayEnabled", "sendTime", "holidayOverridesCount"]);
    expect(config.fields.filter(field => field.source === "body" || field.source === "query")).toEqual([]);
    expect(coverage.entries.find(entry => entry.path === config.path && entry.method === config.method)).toMatchObject({ status: "contract", id: config.id });
  });
  it("previews celebration email content without saving or sending it", () => {
    const preview = ASSISTANT_OPERATIONS.find(op => op.id === "company-email.celebration.preview")!;
    expect(preview).toMatchObject({ method: "POST", path: "/company-email/celebration/preview", confirmation: false, permissionGroups: [["settings:manage"]], resultFields: ["subject", "html"] });
    expect(preview.fields.find(field => field.apiKey === "subject")).toMatchObject({ type: "text", source: "body", max: 300 });
    expect(preview.fields.find(field => field.apiKey === "html")).toMatchObject({ type: "text", source: "body", max: 4000 });
    expect(preview.fields.find(field => field.apiKey === "holidayName")).toMatchObject({ type: "text", source: "body", max: 100 });
    expect(preview.description).toContain("kh\u00F4ng l\u01B0u");
    expect(defaultWorkflow(preview).confirmationLocked).toBe(false);
    expect(coverage.entries.find(entry => entry.path === preview.path && entry.method === preview.method)).toMatchObject({ status: "contract", id: preview.id });
  });
  it("offers partial celebration settings updates with confirmation and no upload or SMTP fields", () => {
    const update = ASSISTANT_OPERATIONS.find(op => op.id === "company-email.celebration.update")!;
    expect(update).toMatchObject({ method: "PATCH", path: "/company-email/celebration", confirmation: true, permissionGroups: [["settings:manage"]], resultFields: ["updatedFields"] });
    expect(update.fields.filter(field => field.source === "body").map(field => field.apiKey)).toEqual([
      "birthdayEnabled", "holidayEnabled", "sendTime", "birthdaySubject", "birthdayHtml", "holidaySubject", "holidayHtml",
    ]);
    expect(update.fields.filter(field => field.source === "body").every(field => field.required === false)).toBe(true);
    expect(defaultWorkflow(update).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === update.path && entry.method === update.method)).toMatchObject({ status: "contract", id: update.id });
  });
  it("exposes SMTP settings and confirmation-gated connection actions without exposing password edits", () => {
    const config = ASSISTANT_OPERATIONS.find(op => op.id === "company-email.smtp.config")!;
    expect(config).toMatchObject({ method: "GET", path: "/company-email/smtp", confirmation: false, permissionGroups: [["settings:manage"]] });
    expect(config.resultFields).toEqual(["configured", "host", "port", "secure", "user", "fromEmail", "fromName", "hasPassword"]);

    for (const [id, path, resultField] of [
      ["company-email.smtp.verify", "/company-email/smtp/verify", "verified"],
      ["company-email.smtp.test", "/company-email/smtp/test", "sent"],
    ]) {
      const operation = ASSISTANT_OPERATIONS.find(op => op.id === id)!;
      expect(operation).toMatchObject({ method: "POST", path, confirmation: true, permissionGroups: [["settings:manage"]] });
      expect(operation.resultFields).toEqual([resultField]);
      expect(operation.fields.filter(field => field.source === "body" || field.source === "query")).toEqual([]);
      expect(coverage.entries.find(entry => entry.path === path && entry.method === "POST")).toMatchObject({ status: "contract", id });
    }

    const save = coverage.entries.find(entry => entry.path === "/company-email/smtp" && entry.method === "PUT");
    expect(save).toMatchObject({ status: "unsupported" });
    expect(save?.reason).toContain("mật khẩu ứng dụng");
  });
  it("publishes payroll slips only for a closed or paid run and returns an aggregate", () => {
    const publish = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.payslips.publish")!;
    expect(publish).toMatchObject({
      method: "POST", path: "/payroll/runs/:id/payslips/publish", confirmation: true,
      permissionGroups: [["payroll-payment:manage"], ["payroll-period:read", "payroll-period:manage"]],
      resultFields: ["publishedCount"],
    });
    expect(publish.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list", source: "path" });
    expect(publish.fields.filter(field => field.source === "body")).toEqual([]);
    expect(publish.description).toContain("không gửi tiền hay gửi email");
    expect(defaultWorkflow(publish).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === publish.path && entry.method === publish.method)).toMatchObject({ status: "contract", id: publish.id });
  });
  it("withdraws one named employee's published payslip with confirmation and a safe result", () => {
    const withdraw = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.payslips.withdraw")!;
    expect(withdraw).toMatchObject({
      method: "POST", path: "/payroll/runs/:id/payslips/:employeeId/withdraw", confirmation: true,
      permissionGroups: [["payroll-payment:manage"], ["payroll-period:read", "payroll-period:manage"], ["access:read", "hr:read"]],
      resultFields: ["withdrawn"],
    });
    expect(withdraw.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list", source: "path" });
    expect(withdraw.fields.find(field => field.apiKey === "employeeId")).toMatchObject({ reference: "employee.list", source: "path" });
    expect(withdraw.fields.filter(field => field.source === "body")).toEqual([]);
    expect(defaultWorkflow(withdraw).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === withdraw.path && entry.method === withdraw.method)).toMatchObject({ status: "contract", id: withdraw.id });
  });
  it("exposes payroll line detail only through named run and employee references with strict permissions", () => {
    const detail = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.line.detail")!;
    expect(detail).toMatchObject({
      method: "GET", path: "/payroll/runs/:id/lines/:employeeId", confirmation: false,
      permissionGroups: [["payroll-period:read", "payroll-period:manage"], ["payroll-payment:read", "payroll-payment:manage"], ["access:read", "hr:read"]],
    });
    expect(detail.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list", source: "path" });
    expect(detail.fields.find(field => field.apiKey === "employeeId")).toMatchObject({ reference: "employee.list", source: "path" });
    expect(detail.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list", source: "query" });
    expect(detail.resultFields).toEqual(["employeeName", "grossPay", "deductions", "netPay"]);
    expect(coverage.entries.find(entry => entry.path === detail.path && entry.method === detail.method)).toMatchObject({ status: "contract", id: detail.id });
  });
  it("exposes payroll issue summaries through the selected run without internal identifiers", () => {
    const issues = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.issues.list")!;
    expect(issues).toMatchObject({ method: "GET", path: "/payroll/runs/:id/issues", confirmation: false, permissionGroups: [["payroll-period:read", "payroll-period:manage"]] });
    expect(issues.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list", source: "path" });
    expect(issues.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list", source: "query" });
    expect(issues.resultFields).toEqual(["code", "field", "severity", "message", "remediation"]);
    expect(coverage.entries.find(entry => entry.path === issues.path && entry.method === issues.method)).toMatchObject({ status: "contract", id: issues.id });
  });
  it("lists payroll reconciliation status by selected run with branch scope and no salary snapshot fields", () => {
    const reconciliation = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.reconciliation.list")!;
    expect(reconciliation).toMatchObject({ method: "GET", path: "/payroll/runs/:id/reconciliation", confirmation: false, permissionGroups: [["payroll-period:read"]] });
    expect(reconciliation.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list", source: "path" });
    expect(reconciliation.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list", source: "query" });
    expect(reconciliation.resultFields).toEqual(["runStatus", "employeeCount", "items", "employeeName", "periodKey", "isConfirmed", "stale", "confirmedAt", "openIssueCount", "openIssueFields"]);
    expect(reconciliation.resultFields).not.toContain("snapshot");
    expect(coverage.entries.find(entry => entry.path === reconciliation.path && entry.method === reconciliation.method)).toMatchObject({ status: "contract", id: reconciliation.id });
  });
  it("publishes payroll reconciliation with a hidden run version, branch selection, and confirmation", () => {
    const publish = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.reconciliation.publish")!;
    expect(publish).toMatchObject({ method: "POST", path: "/payroll/runs/:id/reconciliation/publish", confirmation: true, permissionGroups: [["payroll-period:manage"]] });
    expect(publish.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list", source: "path" });
    expect(publish.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list", source: "query" });
    expect(publish.systemBodyFields).toContain("expectedVersion");
    expect(publish.fields.some(field => field.apiKey === "expectedVersion")).toBe(false);
    expect(publish.resultFields).toEqual(["employeeCount"]);
    expect(defaultWorkflow(publish).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === publish.path && entry.method === publish.method)).toMatchObject({ status: "contract", id: publish.id });
  });
  it("allows payroll managers to reply to or resolve one named employee's open reconciliation issue", () => {
    const action = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.reconciliation.action")!;
    expect(action).toMatchObject({ method: "POST", path: "/payroll/runs/:id/reconciliation/:employeeId/actions", confirmation: true, permissionGroups: [["payroll-period:manage"], ["access:read", "hr:read"]] });
    expect(action.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list", source: "path" });
    expect(action.fields.find(field => field.apiKey === "employeeId")).toMatchObject({ reference: "employee.list", source: "path" });
    expect(action.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list", source: "query" });
    expect(action.systemBodyFields).toEqual(expect.arrayContaining(["expectedVersion", "issueId"]));
    expect(action.fields.find(field => field.apiKey === "action")?.options).toEqual(["reply", "resolve"]);
    expect(action.fields.find(field => field.apiKey === "body")).toMatchObject({ required: true, max: 4000 });
    expect(defaultWorkflow(action).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === action.path && entry.method === action.method)).toMatchObject({ status: "contract", id: action.id });
  });
  it("lets payroll managers respond to a selected employee payslip review request", () => {
    const list = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.payslip.review-requests.list")!;
    const resolve = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.payslip.review-request.resolve")!;
    expect(list).toMatchObject({ method: "GET", path: "/payroll/runs/:id/payslip-review-requests", permissions: ["payroll-period:read"] });
    expect(list.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list", source: "path" });
    expect(list.resultFields).toEqual(["employeeName", "periodKey", "status", "message", "response", "createdAt", "resolvedAt"]);
    expect(resolve).toMatchObject({ method: "POST", confirmation: true, permissions: ["payroll-period:manage"] });
    expect(resolve.fields.find(field => field.apiKey === "branchId")).toMatchObject({ key: "targetBranch", reference: "branch.list", source: "query" });
    expect(resolve.fields.find(field => field.apiKey === "id")?.reference).toBe("payroll.run.list");
    expect(resolve.fields.find(field => field.apiKey === "requestId")?.reference).toBe(list.id);
    expect(resolve.fields.find(field => field.apiKey === "requestId")?.referenceParentKey).toBe("path_id");
    expect(resolve.fields.find(field => field.apiKey === "response")).toMatchObject({ required: true, max: 4000 });
    expect(resolve.resultFields).toEqual(["employeeName", "periodKey", "status", "response", "resolvedAt"]);
    expect(defaultWorkflow(resolve).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === resolve.path && entry.method === resolve.method)).toMatchObject({ status: "contract", id: resolve.id });
  });
  it("synchronizes approved attendance with a hidden version and idempotency header", () => {
    const sync = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.sync-attendance")!;
    expect(sync).toMatchObject({ method: "POST", path: "/payroll/runs/:id/sync-attendance", permissions: ["payroll-period:manage"], confirmation: true, contextHeaders: ["idempotency-key"] });
    expect(sync.fields.find(field => field.apiKey === "id")).toMatchObject({ reference: "payroll.run.list" });
    expect(sync.fields.find(field => field.apiKey === "id")?.label).toContain("Lượt chạy lương cần đồng bộ công");
    expect(sync.systemBodyFields).toContain("expectedVersion");
    expect(sync.fields.some(field => field.apiKey === "expectedVersion")).toBe(false);
    expect(sync.resultFields).toEqual(["status", "employeeCount", "blockingIssueCount"]);
    expect(defaultWorkflow(sync).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === sync.path && entry.method === sync.method)).toMatchObject({ status: "contract", id: sync.id });
  });
  it("locks attendance only for the selected payroll run with an automatic version and confirmation", () => {
    const lock = ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.lock-attendance")!;
    expect(lock).toMatchObject({ method: "POST", path: "/payroll/runs/:id/lock-attendance", permissions: ["payroll-period:manage"], confirmation: true });
    expect(lock.fields.find(field => field.apiKey === "id")?.reference).toBe("payroll.run.list");
    expect(lock.systemBodyFields).toContain("expectedVersion");
    expect(lock.fields.some(field => field.apiKey === "expectedVersion")).toBe(false);
    expect(lock.resultFields).toEqual(["periodKey", "lockedAt", "employeeCount"]);
    expect(defaultWorkflow(lock).confirmationLocked).toBe(true);
    expect(coverage.entries.find(entry => entry.path === lock.path && entry.method === lock.method)).toMatchObject({ status: "contract", id: lock.id });
  });
  it("calculates and recalculates only through confirmed, idempotent payroll workflows", () => {
    for (const [id, path, label] of [
      ["payroll.run.calculate", "/payroll/runs/:id/calculate", "Lượt chạy lương cần tính"],
      ["payroll.run.recalculate", "/payroll/runs/:id/recalculate", "Lượt chạy lương cần tính lại"],
    ]) {
      const operation = ASSISTANT_OPERATIONS.find(op => op.id === id)!;
      expect(operation).toMatchObject({ method: "POST", path, permissions: ["payroll-period:manage"], confirmation: true, contextHeaders: ["idempotency-key"] });
      expect(operation.fields.find(field => field.apiKey === "id")?.reference).toBe("payroll.run.list");
      expect(operation.fields.find(field => field.apiKey === "id")?.label).toContain(label);
      expect(operation.systemBodyFields).toContain("expectedVersion");
      expect(operation.fields.some(field => field.apiKey === "expectedVersion")).toBe(false);
      expect(operation.resultFields).toEqual(["status", "revision", "employeeCount", "blockingIssueCount", "warningIssueCount"]);
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
      expect(coverage.entries.find(entry => entry.path === path && entry.method === "POST")).toMatchObject({ status: "contract", id });
    }
  });
  it("gates payroll review transitions by permission, current version, reason, and confirmation", () => {
    const transitions = [
      ["payroll.run.review", "/payroll/runs/:id/review", "payroll-period:manage", false],
      ["payroll.run.close", "/payroll/runs/:id/close", "payroll-period:manage", false],
      ["payroll.run.reopen", "/payroll/runs/:id/reopen", "payroll-period:manage", true],
      ["payroll.run.mark-paid", "/payroll/runs/:id/mark-paid", "payroll-payment:manage", true],
    ] as const;
    for (const [id, path, permission, reasonRequired] of transitions) {
      const operation = ASSISTANT_OPERATIONS.find(op => op.id === id)!;
      expect(operation).toMatchObject({ method: "POST", path, permissions: [permission], confirmation: true, contextBody: ["correlationId"] });
      expect(operation.fields.find(field => field.apiKey === "id")?.reference).toBe("payroll.run.list");
      expect(operation.systemBodyFields).toEqual(expect.arrayContaining(["expectedVersion", "correlationId"]));
      expect(operation.fields.some(field => ["expectedVersion", "correlationId"].includes(field.apiKey || ""))).toBe(false);
      expect(operation.fields.find(field => field.apiKey === "reason")?.required).toBe(reasonRequired);
      expect(defaultWorkflow(operation).confirmationLocked).toBe(true);
      expect(coverage.entries.find(entry => entry.path === path && entry.method === "POST")).toMatchObject({ status: "contract", id });
    }
    expect(ASSISTANT_OPERATIONS.find(op => op.id === "payroll.run.mark-paid")?.description).toContain("không chuyển tiền");
  });
  it("redacts sensitive response keys at every depth and bounds result lists", () => {
    const result = redactAssistantResult({ companyCode: "TEST", name: "An", data: [{ password: "bad", accessToken: "bad", nested: { api_key: "bad", salary: 5 } }], many: Array.from({ length: 30 }, (_, i) => i) });
    expect(JSON.stringify(result)).not.toContain("bad");
    expect(result).toMatchObject({ name: "An", data: [{ nested: { salary: 5 } }] });
    expect((result as any).many).toHaveLength(15);
  });

  it("uses the four existing training categories and separates student courses", () => {
    const trainingCreate = ASSISTANT_OPERATIONS.find(operation => operation.id === "training.create")!;
    const trainingUpdate = ASSISTANT_OPERATIONS.find(operation => operation.id === "training.update")!;
    const studentCourseCreate = ASSISTANT_OPERATIONS.find(operation => operation.method === "POST" && operation.path === "/courses")!;

    expect(trainingCreate.fields.find(field => field.key === "category")).toMatchObject({
      label: "Danh mục đào tạo",
      systemRequired: true,
      options: ["Văn hóa", "Kỹ thuật", "Kinh doanh", "Công nghệ"],
    });
    expect(trainingUpdate.fields.find(field => field.key === "category")?.options).toEqual(["Văn hóa", "Kỹ thuật", "Kinh doanh", "Công nghệ"]);
    expect(trainingCreate.fields.find(field => field.key === "instructor")).toMatchObject({ label: "Giảng viên", required: false, systemRequired: false });
    expect(trainingCreate.fields.find(field => field.key === "lessons")).toMatchObject({
      type: "json",
      required: true,
      structure: { type: "array", items: { type: "object", keys: { title: { required: true }, type: { required: true, options: ["youtube", "document", "other", "text", "video"] } } } },
    });
    expect(trainingCreate.fields.find(field => field.key === "quizzes")).toMatchObject({
      type: "json",
      required: true,
      structure: { type: "array", items: { type: "object", keys: { question: { required: true }, options: { minItems: 2, required: true }, correctOptionIndex: { integer: true, min: 0, required: true } } } },
    });
    expect(trainingUpdate.fields.find(field => field.key === "lessons")?.required).toBe(false);
    expect(defaultWorkflow(trainingCreate).instructions).toContain("Giảng viên mặc định là người tạo khóa");
    expect(studentCourseCreate.title).toBe("Tạo khóa học cho học viên");
  });

});
