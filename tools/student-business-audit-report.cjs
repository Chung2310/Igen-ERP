const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || 'tmp';
const matrix = JSON.parse(fs.readFileSync('server/assistant/testing/student-business-scenarios.json', 'utf8'));
const run = JSON.parse(fs.readFileSync(path.join(root, 'student-business-results.json'), 'utf8'));
const tests = run.testResults.flatMap(suite => suite.assertionResults.map(test => ({ file: path.basename(suite.name), name: test.fullName || test.title, status: test.status })));
const scenarios = matrix.scenarios.map(scenario => ({ ...scenario,
  matchingTests: tests.filter(test => scenario.evidence.some(e => test.file === e.file && new RegExp(e.pattern).test(test.name))),
  conclusion: 'CHƯA ĐỦ BẰNG CHỨNG KẾT LUẬN ĐẠT TOÀN BỘ',
  liveModel: 'Chưa kiểm chứng', liveDatabase: 'Chưa kiểm chứng',
}));
const readLines = name => fs.existsSync(path.join(root, name)) ? fs.readFileSync(path.join(root, name), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
const ledger = { generatedAt: new Date().toISOString(), completionRule: matrix.completionRule,
  verification: { total: run.numTotalTests, passed: run.numPassedTests, failed: run.numFailedTests },
  scenarios, paymentTraces: readLines('student-business-payment-traces.jsonl'), conversationTraces: readLines('student-business-conversations-verified.jsonl') };
fs.writeFileSync(path.join(root, 'student-business-audit.json'), JSON.stringify(ledger, null, 2));
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const block = value => `<pre>${esc(JSON.stringify(value, null, 2))}</pre>`;
const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ma trận công việc học viên</title>
<style>body{font:16px/1.6 system-ui;max-width:1150px;margin:32px auto;padding:0 20px}details{border:1px solid #aaa;padding:12px;margin:12px 0}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere}td,th{padding:8px;border:1px solid #aaa;text-align:left}table{border-collapse:collapse;width:100%}</style>
<h1>Ma trận kiểm chứng công việc học viên</h1><p>${esc(matrix.completionRule)}</p>
<p>${run.numPassedTests}/${run.numTotalTests} test đạt. Đây là bằng chứng từng phần. Cả 10 công việc vẫn chưa đủ bằng chứng kết luận đạt toàn bộ.</p>
<p>Hội thoại dùng đầu ra AI cung cấp sẵn. Ba ca thu học phí đã nối trợ lý với PaymentService thật, xác nhận, lưu vào bộ nhớ và tra lại số nợ qua trợ lý. HTTP và model lưu trữ vẫn giả lập. Những ca khác dùng API giả lập hoặc kiểm tra backend riêng. Chưa kiểm tra mô hình, xác thực và DB thật. Không gọi AI trả phí, không ghi ERP thật.</p>
<h2>Phát hiện nghiệp vụ</h2><p>Thu lệch 500–1.000 đồng so với đợt học phí từng làm số nợ theo đợt không khớp thực thu. Đã sửa để chỉ khớp đợt khi số tiền bằng chính xác, phần thu khác được phân bổ theo thứ tự đợt. Chuyển lớp giữ nguyên học phí vẫn chưa đạt: thêm vào lớp có lộ trình có thể tính lại học phí, chưa có bằng chứng chuyển nguyên tử.</p>
<table><tr><th>Công việc</th><th>Test liên quan đạt/tổng</th><th>Kết luận</th></tr>${scenarios.map(s=>`<tr><td>${esc(s.id+' '+s.job)}</td><td>${s.matchingTests.filter(t=>t.status==='passed').length}/${s.matchingTests.length}</td><td>Chưa đủ bằng chứng</td></tr>`).join('')}</table>
${scenarios.map(s=>`<details><summary>${esc(s.id+' '+s.job)}</summary><h3>Câu người dùng</h3>${block(s.requests)}<h3>Điều kiện phải đạt</h3>${block(s.criteria)}<h3>Thiếu gì</h3><p>${esc(s.gap)}</p><h3>Bằng chứng kiểm thử tương ứng</h3>${block(s.matchingTests)}${s.sourceEvidence ? block(s.sourceEvidence) : ''}</details>`).join('')}
<h2>Dữ liệu thu tiền và đọc lại sau xử lý</h2>${ledger.paymentTraces.map(t=>`<details><summary>${esc(t.case)}</summary>${block(t)}</details>`).join('')}
<h2>Nhật ký hội thoại giả lập</h2>${ledger.conversationTraces.map(t=>`<details><summary>${esc(t.name)} — ${esc(t.status)}</summary>${block(t)}</details>`).join('')}</html>`;
fs.writeFileSync(path.join(root, 'student-business-audit.html'), html);
console.log(JSON.stringify({ scenarios: scenarios.length, ...ledger.verification, report: path.join(root, 'student-business-audit.html') }));
