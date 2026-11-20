const fs = require('node:fs');
const path = require('node:path');
const manifest = JSON.parse(fs.readFileSync('server/assistant/testing/student-readiness-criteria.json', 'utf8'));
const resultPath = process.argv[2] || 'tmp/readiness-final-verified.json';
const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const assertions = result.testResults.flatMap(suite => suite.assertionResults.map(test => ({ file: path.basename(suite.name), name: test.fullName || test.title, status: test.status })));
const criteria = manifest.criteria.map(c => {
  const evidence = c.evidence.map(ref => ({ ...ref, tests: assertions.filter(test => test.file === ref.file && new RegExp(ref.pattern).test(test.name)) }));
  return { ...c, evidence, verifiedTechnical: evidence.length > 0 && evidence.every(ref => ref.tests.length > 0 && ref.tests.every(test => test.status === 'passed')) };
});
const verified = criteria.filter(c => c.verifiedTechnical).length;
const coverage = { criterionCount: criteria.length, verifiedTechnical: verified, technicalPercent: Math.round(verified / criteria.length * 1000) / 10,
  overallAssistantCoverage: null, liveModelAccuracy: null, realAuthenticationEndToEnd: false,
  note: 'Tỷ lệ chỉ dành cho tiêu chí kỹ thuật của 10 công việc học viên đã chốt. Không phải tỷ lệ hiểu ngôn ngữ của AI thật, không phải toàn bộ chức năng học viên hoặc toàn ERP.' };
const traceFile = 'tmp/readiness-conversations-final.jsonl';
const traces = fs.existsSync(traceFile) ? fs.readFileSync(traceFile, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse).filter(row => row.module === 'student-real-db') : [];
const report = { generatedAt: new Date().toISOString(), scope: manifest.scope, coverage, criteria,
  validation: { total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests, source: resultPath },
  limitations: ['Đầu ra AI được cung cấp sẵn, chưa chạy mô hình thật.', 'MongoDB replica set thật nhưng tạm và biệt lập. HTTP được thay bằng cầu nối test tới service thật, chưa chạy đăng nhập/JWT và toàn bộ router thật.', 'Middleware phân quyền được kiểm tra riêng với dữ liệu quyền thật, quyền của phiên trợ lý vẫn được giả lập.', 'Chuyển lớp giữ nguyên học phí chưa có luồng được kiểm chứng.', 'Hoàn/hủy phiếu thu đã lưu và cập nhật thanh toán đồng thời chưa được kiểm tra đầy đủ.', 'Tạo khoản thu hiện yêu cầu MongoDB hỗ trợ transaction. Không tự chạy ghi rời rạc trên standalone.'], traces };
fs.writeFileSync('tmp/student-readiness-report.json', JSON.stringify(report, null, 2));
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = value => `<pre>${esc(JSON.stringify(value, null, 2))}</pre>`;
const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bằng chứng mức bao phủ kỹ thuật học viên</title><style>body{font:16px/1.6 system-ui;max-width:1200px;margin:32px auto;padding:0 20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;text-align:left}details{border:1px solid #aaa;padding:12px;margin:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}summary{cursor:pointer}</style>
<h1>Bằng chứng kiểm chứng kỹ thuật của 10 công việc học viên</h1><p><strong>${verified}/${criteria.length} điều kiện đã có bằng chứng kỹ thuật (${coverage.technicalPercent}%).</strong></p><p>${esc(coverage.note)}</p><p>Không có kết luận tỷ lệ bao phủ chung của trợ lý. Các trường liveModelAccuracy và overallAssistantCoverage được để trống trong dữ liệu báo cáo.</p>
<h2>Giới hạn và điều kiện triển khai</h2><ul>${report.limitations.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>Từng điều kiện và bằng chứng</h2><table><tr><th>Mã</th><th>Điều kiện</th><th>Kết quả kỹ thuật</th></tr>${criteria.map(c=>`<tr><td>${esc(c.id)}</td><td>${esc(c.description)}</td><td>${c.verifiedTechnical?'Có bằng chứng':'Chưa kiểm chứng'}</td></tr>`).join('')}</table>
${criteria.map(c=>`<details><summary>${esc(c.id+' — '+c.job)}</summary>${json(c)}</details>`).join('')}
<h2>Hội thoại và dữ liệu MongoDB đọc lại</h2>${traces.map(t=>`<details><summary>${esc(t.name)} — ${esc(t.status)}</summary>${json(t)}</details>`).join('')}
<h2>Kết quả chạy kiểm thử</h2>${json(report.validation)}</html>`;
fs.writeFileSync('tmp/student-readiness-report.html', html);
console.log(JSON.stringify({ coverage, validation: report.validation, databaseConversations: traces.length, report: 'tmp/student-readiness-report.html' }));
