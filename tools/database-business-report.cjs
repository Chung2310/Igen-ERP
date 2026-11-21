const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(process.argv[2] || 'tmp/business-db-round2');
const runs = ['results.json', 'completion-regression.json'].filter(name => fs.existsSync(path.join(dir, name)))
  .map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
if (!runs.length) throw new Error('No test results found');
const run = {
  testResults: runs.flatMap(result => result.testResults),
  numTotalTests: runs.reduce((sum, result) => sum + result.numTotalTests, 0),
  numPassedTests: runs.reduce((sum, result) => sum + result.numPassedTests, 0),
  numFailedTests: runs.reduce((sum, result) => sum + result.numFailedTests, 0),
};
const tests = run.testResults.flatMap(s => s.assertionResults.map(t => ({file:s.name,name:t.title,fullName:t.fullName,status:t.status,errors:t.failureMessages})));
const readLines = name => {
  const file = path.join(dir, name);
  return fs.existsSync(file) ? fs.readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
};
const database = ['finance','retail','inventory'].flatMap(module=>readLines(`${module}.jsonl`).map(trace=>({ ...trace,
  testStatus: tests.find(t=>t.name===trace.name)?.status || 'unknown',
})));
const conversations = readLines('conversations.jsonl');
const report = {generatedAt:new Date().toISOString(),summary:{total:run.numTotalTests,passed:run.numPassedTests,failed:run.numFailedTests,
  databaseTraces:database.length,conversationTraces:conversations.length},
  scope:`Kiểm tra nghiệp vụ và DB tạm của tài chính, bán lẻ, chuyển kho. Có ${conversations.length} ca hội thoại trong lần chạy này.`,
  limitations:[
    'Không phải tỷ lệ bao phủ toàn app hoặc toàn bộ chức năng của ba module.',
    'MongoDB replica set thật, biệt lập và tạm. Không ghi dữ liệu ERP thật.',
    'Các hội thoại giả lập đầu ra AI, session, quyền và HTTP. HTTP chuyển tới service thật. Chưa kiểm tra đăng nhập/JWT hoặc router thật. Xem từng ca để biết thao tác cụ thể đã kiểm tra.',
    'Phạm vi hội thoại được xác định bởi từng ca bên dưới. Ca service và ca hội thoại là hai lớp bằng chứng riêng. Chưa kiểm tra giao diện POS hoặc kết nối thanh toán thật.',
    'Test bán lẻ mock bước cập nhật hạng khách hàng sau giao dịch. Chưa chứng minh bước này.',
    'Snapshot mỗi model tối đa 50 bản ghi, có tổng count để nhận biết dữ liệu vượt giới hạn.',
    'Không gọi AI trả phí, không gửi email hoặc tin nhắn thật.'
  ],tests,database,conversations};
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const detail=(label,value)=>`<details><summary>${esc(label)}</summary><pre>${esc(JSON.stringify(value,null,2))}</pre></details>`;
fs.writeFileSync(path.join(dir,'report.html'),`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nghiệp vụ tài chính, bán lẻ và kho trên DB tạm</title><style>body{font:16px/1.6 system-ui;max-width:1150px;margin:24px auto;padding:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere}details{border:1px solid #aaa;padding:12px;margin:12px 0}summary{cursor:pointer}</style><h1>Nghiệp vụ tài chính, bán lẻ và kho trên DB tạm</h1><p>${esc(report.scope)}</p><p>${run.numPassedTests}/${run.numTotalTests} ca đạt. ${run.numFailedTests} ca lỗi.</p><ul>${report.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h2>Hội thoại trợ lý</h2>${conversations.map(c=>detail(c.name,c)).join('')}<h2>Dữ liệu DB trước, tại điểm kiểm tra và sau thao tác</h2>${database.map(c=>detail(`${c.module} — ${c.name} — ${c.testStatus}`,c)).join('')}${detail('Tất cả ca kiểm thử và trạng thái',tests)}</html>`);
console.log(JSON.stringify({ ...report.summary, report:path.join(dir,'report.html') }));
