import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ASSISTANT_OPERATIONS } from "../catalog";
import { buildManualGuide } from "../manual-guides";
import { MANUAL_PROCEDURES } from "../manual-guide-procedures";
import { SUPPLEMENTAL_GUIDES } from "../manual-guide-supplement";
import { MANUAL_SCREENS } from "../manual-guide-routes";
import backlog from "../manual-guide-backlog.json";
import { endpointShape, reachableSourceFiles, scanManualGuideSources } from "./manual-guide-source-audit";

const sources = scanManualGuideSources();
const reachable = reachableSourceFiles(sources);
const coverage = JSON.parse(fs.readFileSync("server/assistant/coverage.generated.json", "utf8"));
// These routes are registered via retailCouponRoutes[method] in three loops;
// the older assistant API inventory misses them. Keep the evidence explicit.
const supplementalRoutes = [
  ["GET", "/retail/coupons/automations", 52], ["POST", "/retail/coupons/automations", 52],
  ["PUT", "/retail/coupons/automations/:id", 52], ["GET", "/retail/coupons/birthday-program", 65],
  ["PUT", "/retail/coupons/birthday-program", 65], ["GET", "/retail/coupons", 76],
  ["PUT", "/retail/coupons/:id", 76],
].map(([method, path, line]) => ({ method, path, line, file: "server/modules/retail/routes/retail-coupon.routes.ts", reason: "Route khai báo bằng vòng lặp, bổ sung khi rà giao diện." }));
for (const route of supplementalRoutes) {
  if (!coverage.entries.some((e: any) => e.method === route.method && endpointShape(e.path) === endpointShape(String(route.path)))) coverage.entries.push(route);
}
const errors: string[] = [];
for (const recipe of [...MANUAL_PROCEDURES, ...SUPPLEMENTAL_GUIDES]) {
  for (const e of recipe.evidence) {
    if (!fs.existsSync(e.file) || !fs.readFileSync(e.file, "utf8").includes(e.contains)) errors.push(`${recipe.id}: ${e.file} thiếu ${e.contains}`);
  }
  if (![...ASSISTANT_OPERATIONS, ...coverage.entries].some(op => recipe.method.split("|").includes(op.method) && recipe.path.test(op.path.replace(/\/$/, "")))) errors.push(`${recipe.id}: không khớp thao tác nào`);
}
if (errors.length) throw new Error(errors.join("\n"));
const entries = ASSISTANT_OPERATIONS.map(op => {
  const guide = buildManualGuide(op);
  if (guide.status === "procedure" && guide.evidence.some(e => !reachable.has(e.file))) errors.push(`${op.id}: hướng dẫn trỏ tới component chưa nối từ entry ứng dụng: ${guide.evidence.filter(e => !reachable.has(e.file)).map(e => e.file).join(", ")}`);
  return {
    ...guide, api: { method: op.method, path: op.path }, permissions: op.permissions,
    permissionGroups: op.permissionGroups || [], roles: op.roles || [],
    evidence: guide.evidence.map(e => {
      const content = fs.readFileSync(e.file, "utf8");
      return { ...e, line: e.contains ? content.slice(0, content.indexOf(e.contains)).split("\n").length : 1,
        sha256: crypto.createHash("sha256").update(content).digest("hex") };
    }),
    // Search candidates only: a matching string does not prove a reachable UI action.
    apiSourceCandidates: sources.flatMap(s => s.endpoints.filter(e => endpointShape(e.text) === endpointShape(op.path))),
  };
});
const covered = new Set(ASSISTANT_OPERATIONS.map(op => `${op.method} ${endpointShape(op.path)}`));
if (errors.length) throw new Error(errors.join("\n"));
const apiWithoutOperation = coverage.entries.filter((e: any) => !covered.has(`${e.method} ${endpointShape(e.path)}`)).map((e: any) => {
  const matches = MANUAL_SCREENS.filter(s => s.path.test(e.path));
  const module = [...new Set(matches.map(s => s.module))];
  const sample = module.length === 1 ? ASSISTANT_OPERATIONS.find(op => op.module === module[0]) : undefined;
  const guide = sample ? buildManualGuide({ ...sample, id: `route:${e.method}:${e.path}`, title: `${e.method} ${e.path}`, method: e.method, path: e.path, fields: [], readOnly: e.method === "GET" }) : undefined;
  if (guide?.status === "procedure" && guide.evidence.some(v => !reachable.has(v.file))) throw new Error(`${e.path}: API-only guide references an unreachable component`);
  return {
  method: e.method, path: e.path, source: { file: e.file, line: e.line }, reason: e.reason,
  status: "not-in-assistant-catalog",
  guide,
  apiSourceCandidates: sources.flatMap(s => s.endpoints.filter(p => endpointShape(p.text) === endpointShape(e.path))),
}; });
const summary = {
  reviewedBacklog: {
    total: backlog.length,
    procedures: entries.filter(e => backlog.includes(e.operationId) && e.status === "procedure").length,
    unavailable: entries.filter(e => backlog.includes(e.operationId) && e.status === "ui-unavailable").length,
    unresolved: backlog.filter(id => !entries.some(e => e.operationId === id && ["procedure", "ui-unavailable"].includes(e.status))).length,
  },
  operations: entries.length, apiRoutes: coverage.entries.length, apiWithoutOperation: apiWithoutOperation.length,
  apiOnlyByStatus: Object.fromEntries(["procedure", "navigation-only", "unverified", "ui-unavailable", "unmapped"].map(status => [status, apiWithoutOperation.filter((e: any) => (e.guide?.status || "unmapped") === status).length])),
  byStatus: Object.fromEntries(["procedure", "navigation-only", "unverified", "ui-unavailable"].map(status => [status, entries.filter(e => e.status === status).length])),
  modules: [...new Set(entries.map(e => e.module))].map(module => ({ module, total: entries.filter(e => e.module === module).length,
    procedures: entries.filter(e => e.module === module && e.status === "procedure").length })),
};
const report = { schemaVersion: 1, summary, entries, apiWithoutOperation };
const out = "docs/assistant/manual-guides";
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "catalog.json"), JSON.stringify(report, null, 2) + "\n");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const labels = { procedure: "Có các bước đã đối chiếu mã nguồn", "navigation-only": "Mới xác định màn hình", unverified: "Chưa xác minh giao diện", "ui-unavailable": "Giao diện đang ẩn hoặc chưa được nối" };
const list = (values: string[]) => `<ol>${values.map(v => `<li>${esc(v)}</li>`).join("")}</ol>`;
fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hướng dẫn dự phòng ERP theo từng thao tác</title>
<style>body{font:16px/1.6 system-ui;max-width:1100px;margin:auto;padding:24px;color:#202124}details{border:1px solid #bbb;padding:12px;margin:12px 0}summary{cursor:pointer;font-weight:600}code{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:8px;text-align:left}a{color:#174ea6}small{display:block}input{font:inherit;padding:8px;width:90%;margin:12px 0}pre{white-space:pre-wrap}li{margin:6px 0}</style>
<h1>Hướng dẫn dự phòng ERP theo từng thao tác</h1><p>${entries.length} thao tác trong ${summary.modules.length} module; ${apiWithoutOperation.length} API chưa có thao tác tương ứng trong danh mục trợ lý. Đây là rà soát mã nguồn, chưa phải xác nhận đã thử toàn bộ giao diện bằng dữ liệu thật.</p>
<p>Đợt bổ sung ${summary.reviewedBacklog.total} mục: <strong>${summary.reviewedBacklog.procedures} hướng dẫn có bước thao tác</strong>; ${summary.reviewedBacklog.unavailable} mục có lý do và bằng chứng chưa có luồng giao diện tương đương; ${summary.reviewedBacklog.unresolved} mục chưa rà xong. Các mục chưa có giao diện vẫn là khoảng trống chức năng, không được tính là hướng dẫn hoàn chỉnh.</p>
<p>${Object.entries(summary.byStatus).map(([key, count]) => `${esc(labels[key as keyof typeof labels])}: <strong>${count}</strong>`).join(" · ")}</p>
<p>Mục chưa có đủ bước được ghi rõ, không dùng tên API để đoán tên nút. Hướng dẫn không vượt quyền và không bảo đảm dịch vụ hoạt động khi chính API đang lỗi. Khi chưa rõ đã ghi dữ liệu hay chưa, kiểm tra trước khi thao tác lại.</p>
<label for="search">Tìm chức năng, module hoặc mã thao tác</label><input id="search" type="search" placeholder="Ví dụ: học phí, kiểm kê, employee.create"><p id="count" role="status"></p>
${entries.map(e => `<details data-entry data-search="${esc(`${e.title} ${e.moduleLabel} ${e.operationId} ${e.status}`.toLocaleLowerCase("vi"))}"><summary>${esc(e.moduleLabel)} — ${esc(e.title)}</summary><p><strong>${esc(labels[e.status])}</strong> · <code>${esc(e.operationId)}</code></p><p>${esc(e.reason)}</p>${e.link ? `<p>Đường dẫn trong ERP: <code>${esc(e.link)}</code></p>` : ""}<h3>Điều kiện</h3>${list(e.prerequisites)}${e.steps.length ? `<h3>Thao tác</h3>${list(e.steps)}` : "<p>Chưa cung cấp chuỗi thao tác ghi dữ liệu cho mục này vì chưa có đủ bằng chứng giao diện.</p>"}<h3>Dữ liệu của thao tác</h3><p>Danh sách dưới đây lấy từ hợp đồng trợ lý, không mặc định là tên trường trên biểu mẫu. Trường bắt buộc thực tế còn phụ thuộc cấu hình doanh nghiệp.</p><table><tr><th>Thông tin</th><th>Yêu cầu</th><th>Mục đích</th></tr>${e.fields.map(f => `<tr><td>${esc(f.label)}${f.options ? `<br>${esc(f.options.join(" / "))}` : ""}</td><td>${f.required ? "Bắt buộc" : "Theo nhu cầu"}</td><td>${esc(f.purpose)}</td></tr>`).join("")}</table><h3>Bằng chứng và phạm vi kiểm tra</h3><p>API: <code>${esc(e.api.method)} ${esc(e.api.path)}</code></p><p>Quyền khai báo: ${esc(e.permissions.join(", "))}; nhóm quyền bổ sung: ${esc(JSON.stringify(e.permissionGroups))}; vai trò: ${esc(e.roles.join(", "))}. Quyền cuối cùng do máy chủ kiểm tra.</p><ul>${e.evidence.map(v => `<li><code>${esc(v.file)}:${v.line}</code> ${esc(v.contains)}</li>`).join("")}</ul><p>${e.apiSourceCandidates.length} vị trí nguồn có đường dẫn API khớp (chỉ là đầu mối rà soát, không chứng minh nút thao tác hoạt động).</p></details>`).join("\n")}
<h2>API chưa có thao tác tương ứng trong danh mục trợ lý</h2><p>Gồm cả nghiệp vụ, hạ tầng, xác thực và thiết bị. Mức hướng dẫn được ghi riêng; có hướng dẫn không đồng nghĩa trợ lý đã gọi được API này.</p>${apiWithoutOperation.map((e: any) => `<details data-entry data-search="${esc(`${e.method} ${e.path}`.toLowerCase())}"><summary>${esc(e.method)} ${esc(e.path)}</summary><p>${esc(e.reason || "Cần rà soát hợp đồng và giao diện")}</p><p><code>${esc(e.source.file)}:${esc(e.source.line)}</code></p>${e.guide ? `<p><strong>${esc(labels[e.guide.status as keyof typeof labels])}</strong></p><p>${esc(e.guide.reason)}</p>${e.guide.link ? `<p>Đường dẫn ERP: <code>${esc(e.guide.link)}</code></p>` : ""}${list(e.guide.prerequisites)}${list(e.guide.steps)}` : "<p>Chưa xác minh màn hình nghiệp vụ; cần phân loại riêng hạ tầng, xác thực và thiết bị.</p>"}</details>`).join("\n")}
<script>const input=document.querySelector('#search');const rows=[...document.querySelectorAll('[data-entry]')];const fold=s=>s.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');function filter(){const q=fold(input.value);let n=0;for(const row of rows){row.hidden=!fold(row.dataset.search).includes(q);if(!row.hidden)n++}document.querySelector('#count').textContent=n+' mục phù hợp'}input.addEventListener('input',filter);filter();</script></html>`);
console.log(JSON.stringify(summary, null, 2));
