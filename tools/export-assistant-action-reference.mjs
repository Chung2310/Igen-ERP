import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ASSISTANT_OPERATIONS, defaultWorkflow } from '../server/assistant/catalog.ts';

// Run from the repository with: node --import tsx tools/export-assistant-action-reference.mjs
// Import only the catalog; this export does not call ERP APIs or load account settings.
const root = new URL('../', import.meta.url);
const markdownUrl = new URL('docs/tham-chieu-action-tro-ly-erp.md', root);
const jsonUrl = new URL('docs/tham-chieu-action-tro-ly-erp.json', root);
const generatedAt = new Date().toISOString();
const generatedDate = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'long', timeStyle: 'short',
}).format(new Date(generatedAt));
const operations = [...ASSISTANT_OPERATIONS].sort((a, b) =>
  a.module.localeCompare(b.module) || a.id.localeCompare(b.id));
const modules = [...new Set(operations.map(operation => operation.module))];
const ids = new Set(operations.map(operation => operation.id));
if (ids.size !== operations.length) throw new Error('Catalog contains duplicate action IDs.');
const blocked = operations.filter(operation => operation.unavailableReason);
const code = value => `\`${String(value).replace(/`/g, '&#96;')}\``;
const cell = value => String(value).replace(/\|/g, '&#124;').replace(/[\r\n]+/g, ' ').trim();
const absolute = url => fileURLToPath(url).replace(/\\/g, '/');
const jsonPath = absolute(jsonUrl);
const lines = [
  '# Danh sách action của Trợ lý ERP',
  '',
  `Thời điểm xuất: ${generatedDate} (giờ Việt Nam).`,
  '',
  '## Action là gì?',
  '',
  '**Action là một thao tác được khai báo sẵn trong catalog để AI lựa chọn và server thực thi.** AI trả mã ở `actionId`; server dùng mã đó để tìm operation có `id` tương ứng. `values` chứa dữ liệu đầu vào theo các field của operation.',
  '',
  'Ví dụ: “Tìm sản phẩm iPhone” có thể được diễn giải thành `actionId = product.list`, với `values.search = iPhone`. Catalog quy định `search` gửi vào query có tên `q`, nên executor gọi API tìm sản phẩm với `q=iPhone`.',
  '',
  '## Phạm vi danh sách',
  '',
  `- Tổng số: **${operations.length} action**, thuộc **${modules.length} phân hệ**.`,
  `- Có **${blocked.length} action được đánh dấu không khả dụng** bằng \`unavailableReason\`; các action đó vẫn được giữ trong bản tham chiếu.`,
  '- Nguồn là `ASSISTANT_OPERATIONS` sau khi import và ghép catalog thực tế, bao gồm các hiệu chỉnh trong code. Không chỉ lấy từ file catalog JSON sinh tự động.',
  '- Đây là danh mục gốc tại thời điểm xuất. Quyền, vai trò, trạng thái module và cấu hình workflow quyết định action nào xuất hiện với một tài khoản cụ thể.',
  '- Một action thường có API chính được khai báo. Khi thực thi có thể có thêm API tìm reference, kiểm tra trạng thái hoặc adapter xử lý riêng.',
  '- Có nhiều action dùng cùng một method/path nhưng khác mục đích hoặc cấu hình. Vì vậy số action không phải số endpoint duy nhất.',
  '',
  `Schema đầy đủ nằm trong [bản JSON](${jsonPath}). Mỗi phần tử trong \`operations\` có \`id\` chính là mã AI phải trả trong \`actionId\`.`,
  '',
  '## Cách đọc bảng',
  '',
  '- **Mã action:** giá trị `actionId` dùng để tra operation. Các mã dạng `api.get.…`, `api.post.…` cũng là mã action hợp lệ do catalog sinh ra; tra ý nghĩa bằng tên và API đi kèm.',
  '- **API:** method/path khai báo, chưa thêm tiền tố `/api/v1`. Một số operation còn có xử lý riêng trong executor/adapter.',
  '- **Đầu vào:** tên field trong `values`, kiểu dữ liệu và mapping được field khai báo. Ví dụ `search (text) → query.q` nghĩa là `values.search` được gửi vào query `q`.',
  '- **Dấu `*`:** trường required/systemRequired trong workflow mặc định. Điều kiện `requiredWhen`, reference, quy tắc chuyên biệt và cấu hình cá nhân có thể yêu cầu thêm dữ liệu; xem JSON và code để xét đầy đủ.',
  '- **Mapping “executor”:** field không khai báo `source`; cách dựng API input được xử lý bởi executor/nhánh tương ứng.',
  '- **Xác nhận:** yêu cầu trong workflow mặc định sau khi ghép catalog. “Theo điều kiện” nghĩa là không bật sẵn ở mặc định; cài đặt cá nhân hoặc logic thực thi vẫn có thể yêu cầu xác nhận.',
  '- **Liên kết `ref`:** mã thao tác dùng để tìm bản ghi liên quan. Server dùng kết quả để phân giải đầu vào.',
  '',
  'JSON giữ đầy đủ mô tả, permissions/permissionGroups, roles, fields, requiredWhen, defaults, reference context, adapter, resultFields và các thuộc tính khác có trong operation.',
  '',
  '## Mục lục theo phân hệ',
  '',
  '| Phân hệ | Số action |',
  '|---|---:|',
  ...modules.map(module => `| [${module}](#module-${module}) | ${operations.filter(operation => operation.module === module).length} |`),
  '',
];

for (const module of modules) {
  const group = operations.filter(operation => operation.module === module);
  lines.push(`<a id="module-${module}"></a>`, '', `## ${module} — ${group.length} action`, '',
    '| Mã action | Tên thao tác | API khai báo | Đầu vào và mapping | Xác nhận mặc định |',
    '|---|---|---|---|---|');
  for (const operation of group) {
    const workflow = defaultWorkflow(operation);
    const fields = workflow.fields.map(field => {
      const required = field.required || field.systemRequired ? '*' : '';
      const mapping = field.source ? `${field.source}.${field.apiKey || field.key}` : 'executor';
      const reference = field.reference ? `; ref: ${code(field.reference)}` : '';
      return `${code(field.key)}${required} (${field.type}) → ${code(mapping)}${reference}`;
    }).join('<br>') || '—';
    const status = operation.unavailableReason ? '**Không khả dụng**' : workflow.requireConfirmation ? 'Có' : 'Theo điều kiện';
    lines.push(`| ${code(operation.id)} | ${cell(operation.title)} | ${code(`${operation.method} ${operation.path}`)} | ${cell(fields)} | ${status} |`);
  }
  lines.push('');
}

if (blocked.length) {
  lines.push('## Action được đánh dấu không khả dụng', '',
    '| Mã action | Lý do trong catalog |', '|---|---|',
    ...blocked.map(operation => `| ${code(operation.id)} | ${cell(operation.unavailableReason)} |`), '');
}
lines.push('## Nguồn và cách cập nhật', '',
  `- [Catalog gốc](${absolute(new URL('server/assistant/catalog.ts', root))})`,
  `- [Luồng giải thích và ví dụ](${absolute(new URL('docs/phan-tich-luong-tro-ly-erp.md', root))})`,
  `- [Script xuất danh sách](${absolute(new URL('tools/export-assistant-action-reference.mjs', root))})`,
  '', 'Để xuất lại theo code hiện tại, chạy từ thư mục gốc dự án:', '',
  '```sh', 'node --import tsx tools/export-assistant-action-reference.mjs', '```', '',
  'Bản xuất chỉ đọc catalog và ghi hai tài liệu tham chiếu Markdown/JSON; không gọi API nghiệp vụ hoặc truy cập dữ liệu tài khoản.', '');

await fs.writeFile(jsonUrl, JSON.stringify({
  generatedAt,
  source: 'server/assistant/catalog.ts#ASSISTANT_OPERATIONS',
  scope: 'Base catalog before per-account permission, module and workflow filtering',
  count: operations.length,
  moduleCount: modules.length,
  unavailableCount: blocked.length,
  modules: Object.fromEntries(modules.map(module => [module, operations.filter(operation => operation.module === module).length])),
  operations,
}, null, 2) + '\n', 'utf8');
await fs.writeFile(markdownUrl, lines.join('\n'), 'utf8');
console.log(JSON.stringify({ count: operations.length, modules: modules.length,
  markdown: absolute(markdownUrl), json: jsonPath }));
