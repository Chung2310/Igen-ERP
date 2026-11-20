const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || 'tmp';
const results = JSON.parse(fs.readFileSync(path.join(root, 'owner-discovery-tests.json'), 'utf8'));
const lines = fs.readFileSync(path.join(root, 'owner-discovery-conversations.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean);
const cases = [...new Map(lines.map(line => { const row = JSON.parse(line); return [row.name, row]; })).values()];
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const details = cases.map(row => `<details><summary>${escape(row.name)} — ${escape(row.status)}</summary>
${row.turns.map(turn => `<h3>Người dùng gửi</h3><pre>${escape(JSON.stringify(turn.input, null, 2))}</pre><h3>Trợ lý trả lời</h3><pre>${escape(JSON.stringify(turn.reply || turn.error, null, 2))}</pre>`).join('')}
<h3>API giả lập đã gọi</h3><pre>${escape(JSON.stringify(row.apiCalls, null, 2))}</pre>
<h3>Dữ liệu trong bộ nhớ sau kiểm thử</h3><pre>${escape(JSON.stringify(row.records, null, 2))}</pre>
<h3>Phản hồi AI giả lập</h3><pre>${escape(JSON.stringify(row.aiProviderOutputs, null, 2))}</pre></details>`).join('\n');
const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kiểm thử trợ lý từ góc nhìn chủ doanh nghiệp</title>
<style>body{font:16px/1.6 system-ui;max-width:1100px;margin:32px auto;padding:0 20px}details{border:1px solid #aaa;padding:12px;margin:12px 0}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f3f3;padding:12px}h3{font-size:16px}</style>
<h1>Kiểm thử trợ lý từ góc nhìn chủ doanh nghiệp</h1>
<p>Tạo lúc ${escape(new Date().toISOString())}. ${results.numPassedTests}/${results.numTotalTests} ca đạt trong ba tệp kiểm thử. ${cases.length} hội thoại học viên có nhật ký chi tiết.</p>
<p>Phạm vi mới: khám phá chức năng theo quyền ở 12 phân hệ, mục tiêu chưa rõ, đồng ý chung chưa đủ để thao tác, chuyển từ hướng dẫn sang tạo hoặc tra cứu học phí, giữ bản nháp và không suy ra việc ghi từ tên tệp.</p>
<p><strong>Giới hạn:</strong> AI, API, quyền và lưu phiên được giả lập. Bộ kiểm thử chạy luồng xử lý thật nhưng cung cấp sẵn phản hồi AI. Không đo được khả năng mô hình thật hiểu tiếng Việt. Bản ghi dưới đây nằm trong bộ nhớ kiểm thử, không phải cơ sở dữ liệu ERP. Chưa xác minh đầy đủ các chuỗi chuyển lớp giữ nguyên học phí, phân tích nguyên nhân doanh thu, nhập Excel rồi báo cáo hoặc làm lại theo tháng trước.</p>
<p>Các hội thoại hồi quy cũ cũng được giữ bên dưới để đối chiếu. Không gọi OpenRouter hoặc ghi dữ liệu ERP thật.</p>${details}</html>`;
fs.writeFileSync(path.join(root, 'owner-discovery-report.html'), html, 'utf8');
console.log(JSON.stringify({ tests: results.numTotalTests, passed: results.numPassedTests, failed: results.numFailedTests, conversations: cases.length, report: path.join(root, 'owner-discovery-report.html') }));
