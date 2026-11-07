import { CustomerModel } from "../customer-management/models/customer.model";
import { customerScopeFilter, resolveCustomerBranchScope } from "../customer-management/customer-branch-scope";
import { getModuleStateForCompany, resolveModuleAccess } from "../../middleware/require-module";
import { quotationContext, assertQuotationPermission } from "./context";

async function requireSource(module: "customer") {
  const ctx = quotationContext(), state = await getModuleStateForCompany(ctx.companyCode);
  assertQuotationPermission(`${module}:read`);
  if (!resolveModuleAccess({ role: "staff", companyCode: ctx.companyCode }, module, state.modules, state.exists, state.businessType)) throw Object.assign(new Error("Phân hệ dữ liệu nguồn chưa được kích hoạt."), { statusCode: 403 });
  return ctx;
}
export async function listErpCustomers(query: string) {
  const ctx = await requireSource("customer");
  const scope = await resolveCustomerBranchScope(ctx);
  const q = query.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return CustomerModel.find({ ...customerScopeFilter(scope), status: "active", ...(q ? { $or: [{ name: new RegExp(q, "i") }, { phone: new RegExp(q, "i") }, { customerCode: new RegExp(q, "i") }] } : {}) })
    .select("_id customerCode name phone email address").sort({ name: 1 }).limit(30).lean();
}
