import fs from 'node:fs';

const coverage = JSON.parse(fs.readFileSync('server/assistant/coverage.generated.json', 'utf8'));
const operations = JSON.parse(fs.readFileSync('server/assistant/expanded-catalog.generated.json', 'utf8'));
const file = 'server/assistant/COVERAGE.md';
const previous = fs.readFileSync(file, 'utf8');
const counts = new Map();
for (const operation of operations) counts.set(operation.module, (counts.get(operation.module) || 0) + 1);
const start = previous.indexOf('## Số liệu hiện tại');
const end = previous.indexOf('## Adapter thủ công');
if (start < 0 || end < start) throw new Error('Không tìm thấy phần thống kê coverage.');
const lines = [
  '## Số liệu hiện tại', '',
  'Phạm vi người dùng đã chốt: toàn bộ nghiệp vụ ERP; xác thực và thiết bị giữ luồng riêng. Trạng thái hiện tại **chưa hoàn tất toàn bộ phạm vi này**.', '',
  `- ${coverage.total} route trong coverage, gồm API kiểm kê và manifest adapter thủ công.`,
  `- ${coverage.connectedContracts} hợp đồng sinh và ${coverage.connectedManualRoutes} route adapter thủ công: tổng ${coverage.connectedRoutes} route đã nối.`,
  `- ${coverage.reviewPending} route chờ rà soát; ${coverage.intentionallyUnsupported} route hiện chưa nối sau đánh giá.`,
  `- ${coverage.unresolved.length} khai báo route động chưa phân giải.`, '',
  'Số route không phải số nghiệp vụ đã kiểm thử. Nhóm chưa nối gồm cả alias, hạ tầng/xác thực/thiết bị và nghiệp vụ còn thiếu adapter. Không được coi toàn bộ nhóm này là ngoài phạm vi người dùng hoặc báo đã phủ 100%.', '',
  'Danh sách từng route, lý do và tệp nguồn: [UNSUPPORTED.md](./UNSUPPORTED.md). Chạy `node server/assistant/scripts/update-coverage-summary.mjs` sau khi sinh lại catalog để cập nhật số liệu ở đây.', '',
  '### Hợp đồng sinh theo phân hệ', '',
  '| Phân hệ | Hợp đồng sinh |', '| --- | ---: |',
  ...[...counts].sort(([a], [b]) => a.localeCompare(b)).map(([module, count]) => `| ${module} | ${count} |`), '',
  '### Phần nghiệp vụ còn cần phát triển', '',
  '- Nhập/xuất và xử lý tệp: gắn tệp của đúng phiên, kiểm tra loại/kích thước, xem trước dữ liệu, trả tệp kết quả có quyền truy cập.',
  '- Tạo ảnh/video kiến trúc và các tác vụ media: nối đầu vào ảnh, phiên tác vụ, tiến độ và tài sản kết quả.',
  '- Rà soát hợp đồng/hóa đơn dùng bộ trường động: đọc cấu hình hiện tại, phân giải trường theo tên, xác nhận và bảo toàn dữ liệu.',
  '- Các thao tác marketing hàng loạt, khôi phục/đối soát và thao tác ghi còn bị chặn: cần adapter theo hợp đồng API thực tế và kiểm thử hội thoại.', '',
  'Các mục này vẫn thuộc phạm vi nghiệp vụ đã yêu cầu; chưa được tính là hoàn tất chỉ vì có route API hoặc đã chạy qua bộ kiểm thử hiện có.', '',
];
fs.writeFileSync(file, previous.slice(0, start) + lines.join('\n') + previous.slice(end));
console.log(JSON.stringify({ connectedRoutes: coverage.connectedRoutes, pending: coverage.reviewPending, unsupported: coverage.intentionallyUnsupported }));
