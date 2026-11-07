export const QUOTATION_FEATURES = ["quotation", "quotation-approval", "quotation-price-book", "quotation-template", "quotation-ai", "quotation-contract", "quotation-acceptance"] as const;

/** Source UI compatibility never grants authorization: every route is checked here. */
export function quotationRoutePermissions(method: string, pathname: string): string[] {
  const read = method === "GET" || method === "HEAD";
  const path = pathname.replace(/\?.*$/, "");
  const permissions = ["quotation:read"];
  if (/\/(?:approve|reject|submit-review)$/.test(path)) {
    permissions.push(path.endsWith("submit-review") ? "quotation:manage" : "quotation-approval:manage");
  } else if (/^\/(?:quote-template|quote-templates|document-templates|contract-templates|acceptance-templates|settlement-templates)(?:\/|$)/.test(path)) {
    permissions.push(`quotation-template:${read ? "read" : "manage"}`);
  } else if (/^\/(?:catalog|price-list)(?:\/|$)/.test(path)) {
    permissions.push(`quotation-price-book:${read ? "read" : "manage"}`);
  } else if (/^\/contracts(?:\/|$)/.test(path)) {
    permissions.push(`quotation-contract:${read ? "read" : "manage"}`);
  } else if (/^\/acceptance-records(?:\/|$)/.test(path)) {
    permissions.push(`quotation-acceptance:${read ? "read" : "manage"}`);
  } else if (!read) {
    permissions.push("quotation:manage");
  }
  if (/\/(?:suggest|analyze|recalculate|export\/retry)$/.test(path)) permissions.push("quotation-ai:manage");
  if (method === "POST" && path === "/customer-quotes") permissions.push("quotation-ai:manage");
  if (path === "/settings" && !read) permissions.push("quotation-template:manage");
  return [...new Set(permissions)];
}
