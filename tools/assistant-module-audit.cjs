const fs = require('node:fs');
const prefix = process.argv[2] || '';
if (!/^[a-z0-9-]*$/.test(prefix)) throw new Error('Invalid evidence prefix');
const plan = JSON.parse(fs.readFileSync('server/assistant/testing/app-audit-plan.json', 'utf8'));
const validation = JSON.parse(fs.readFileSync(`tmp/app-audit/${prefix}validation.json`, 'utf8'));
const conversations = JSON.parse(fs.readFileSync(`tmp/app-audit/${prefix}conversations.json`, 'utf8'));
const result = JSON.parse(fs.readFileSync(`tmp/app-audit/${prefix}results.json`, 'utf8'));
const matrixSuites = result.testResults.filter(s => /function-(?:conversation-)?matrix\.test\.ts$/.test(s.name));
const matrixTests = matrixSuites.flatMap(s=>s.assertionResults);
const matrixResult = {...result, testResults:matrixSuites, numTotalTests:matrixTests.length,
  numPassedTests:matrixTests.filter(t=>t.status==='passed').length,
  numFailedTests:matrixTests.filter(t=>t.status==='failed').length,
  numPendingTests:matrixTests.filter(t=>!['passed','failed'].includes(t.status)).length};
const businessPath = prefix ? 'tmp/app-audit/fix-backend.json' : 'tmp/app-audit/business-results.json';
const business = fs.existsSync(businessPath) ? JSON.parse(fs.readFileSync(businessPath, 'utf8')) : null;
const recheckPath = prefix ? `tmp/app-audit/${prefix}results.json` : 'tmp/app-audit/backend-recheck.json';
const recheck = fs.existsSync(recheckPath) ? JSON.parse(fs.readFileSync(recheckPath, 'utf8')) : null;
const nodePath = prefix ? 'tmp/app-audit/fix-template.tap' : 'tmp/app-audit/node-business.tap';
const nodeBuffer = fs.existsSync(nodePath) ? fs.readFileSync(nodePath) : null;
const nodeText = nodeBuffer ? nodeBuffer.toString(nodeBuffer[0] === 0xff && nodeBuffer[1] === 0xfe ? 'utf16le' : 'utf8') : '';
const nodeStat = key => { const matches = [...nodeText.matchAll(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'gm'))]; return matches.length ? Number(matches.at(-1)[1]) : null; };
const nodeBusiness = {source:nodePath,complete:nodeStat('duration_ms') !== null || /^# duration_ms /m.test(nodeText),
  total:nodeStat('tests'),passed:nodeStat('pass'),failed:nodeStat('fail'),
  failures:nodeText.split(/\r?\n/).filter(line=>/^\s*not ok /.test(line))};
const summary = r => r ? {total:r.numTotalTests,passed:r.numPassedTests,failed:r.numFailedTests,pending:r.numPendingTests,
  failedSuites:r.testResults.filter(s=>s.status==='failed').map(s=>({file:s.name,message:s.message,
    failures:s.assertionResults.filter(t=>t.status==='failed').map(t=>({name:t.fullName,errors:t.failureMessages}))}))} : null;
const modules = plan.modules.map(module => {
  const operations = validation.operations.filter(op => op.module === module.key).map(op => {
    const cases = validation.cases.filter(c=>c.operation===op.id);
    const turns = conversations.filter(c=>c.operation===op.id);
    return {...op, validation:cases, conversations:turns,
      failures:[...cases,...turns].filter(c=>c.status!=='passed'),
      acceptance:'Chưa kết luận nghiệp vụ. Phản hồi AI/API trong ma trận được giả lập.'};
  });
  const cases=operations.flatMap(op=>[...op.validation,...op.conversations]);
  return {...module, operations, summary:{registeredOperations:operations.length,cases:cases.length,
    passed:cases.filter(c=>c.status==='passed').length,failed:cases.filter(c=>c.status!=='passed').length,
    affectedOperations:operations.filter(op=>op.failures.length).length},
    businessAcceptancePercent:null};
});
const report = {generatedAt:new Date().toISOString(),plan,modules,matrix:summary(matrixResult),fullRun:summary(result),business:summary(business),nodeBusiness,backendRecheck:summary(recheck),
  overallAcceptancePercent:null,
  limitations:['Chỉ chạy offline, không gọi OpenRouter hoặc ghi ERP thật.',
    'Các lỗi ma trận bao gồm khác biệt fixture và quy tắc sản phẩm, chưa được mặc định là lỗi trợ lý.',
    'Các ca backend có mức mock khác nhau. Chỉ ca MongoDB tạm đọc lại dữ liệu mới là bằng chứng DB thật.',
    'Lượt backend ban đầu có cả file node:test chạy bằng Vitest nên phát sinh No test suite. Đây là lỗi công cụ chạy. Kết quả node:test được chạy lại riêng và giữ nguyên trong nodeBusiness.',
    'Chưa hoàn thành đối chiếu toàn bộ UI/API để chốt mẫu số chức năng.',
    'Ca đạt không chứng minh mô hình thật hiểu cách nói khác nhau.'],
  triage:[{module:'retail',cases:'retail-coupon-automation.integration.test.ts',classification:'Dữ liệu kiểm thử phụ thuộc ngày chạy',
    evidence:'Test phát coupon từ đơn ngày 20/10/2026, hiệu lực 30 ngày, rồi resolveCoupon bằng thời gian thực. Ngày chạy 19/11/2026 đã đến thời điểm hết hạn.',
    next:'Cố định đồng hồ nhất quán trong test, giữ ca coupon hết hạn riêng. Chưa sửa sản phẩm vì từ chối coupon hết hạn là đúng.'},
    {module:'quotation',cases:'contract-template.node-test.ts: Insufficient AI credit',classification:'Không khớp thông báo lỗi kỳ vọng',
      evidence:'HTTP 402 tạo TemplateAiCreditError nhưng message là thông báo sự cố chung. Test yêu cầu thông báo thiếu tín dụng. Cần giữ mã lỗi và lý do có thể xử lý được.'},
    {module:'worker',cases:'worker-labor-contract.service.test.ts: renewal',classification:'Chưa xác minh nguồn lỗi',
      next:'Đối chiếu kết quả chạy lại riêng trong backendRecheck, kiểm tra mock session và truy vấn trước khi kết luận lỗi gia hạn.'},
    {module:'customer',cases:'unknown-condition',classification:'Cần đánh giá quy tắc',
    evidence:'semantic-interpreter.ts chuyển thông tin khách hàng ngoài schema vào notes. Ma trận yêu cầu chặn mọi trường lạ, khác với customer-notes.interpreter.test.ts. Chưa sửa để tránh làm mất thông tin hợp lệ.',
    next:'Tách thông tin mô tả cần lưu khỏi điều kiện thao tác không được phép bỏ qua.'},
    {module:'multiple',cases:'reference selection, account settings, draft activation',classification:'Chưa xác minh nguồn lỗi',
      next:'Đối chiếu response API thật trong mã nguồn, tạo fixture theo đúng hợp đồng, rồi tái hiện trước khi sửa sản phẩm.'}]};
if (prefix) {
  report.triage = [{module:'shared',cases:'fix loop',classification:'Xem kết quả chạy lại trong matrix/business/nodeBusiness',
    evidence:'Sửa lệnh đánh dấu đã đọc, điều kiện cập nhật bị chuyển thành ghi chú, tham chiếu _id bị mất sau projection, kiểm tra lặp sai với tham chiếu phiên bản và thông báo AI 402. Sửa fixture API, mock session và đồng hồ test. Không bỏ test lỗi.',
    next:'Các báo cáo gốc được giữ tại results.json, business-results.json và node-business.tap. Các lần chạy lại có phạm vi khác nhau, không cộng số test thành tỷ lệ nghiệp vụ.'}];
}
fs.writeFileSync('tmp/app-audit/module-report.json',JSON.stringify(report,null,2));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const details=(label,data)=>`<details><summary>${esc(label)}</summary><pre>${esc(JSON.stringify(data,null,2))}</pre></details>`;
fs.writeFileSync('tmp/app-audit/module-report.html',`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kiểm tra từng module trợ lý ERP</title><style>body{font:16px/1.5 system-ui;max-width:1200px;margin:24px auto;padding:16px}td,th{padding:8px;border:1px solid #aaa;text-align:left}table{border-collapse:collapse;width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere}details{padding:8px;border:1px solid #aaa;margin:8px 0}</style><h1>Kế hoạch và bằng chứng kiểm tra từng module</h1><p>Chưa kết luận đạt 80–90% toàn app.</p><ul>${report.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${details('Kế hoạch, tình huống chung và điều kiện hoàn thành',plan)}${details('Kết quả ma trận offline',report.matrix)}${details('Kết quả kiểm tra nghiệp vụ/backend',report.business)}${details('Các nhóm lỗi đang phân loại',report.triage)}<table><tr><th>Module</th><th>Thao tác catalog</th><th>Ca đạt</th><th>Ca lỗi</th><th>Thao tác có lỗi</th></tr>${modules.map(m=>`<tr><td><a href="module-${m.key}.html">${esc(m.key)}</a></td><td>${m.summary.registeredOperations}</td><td>${m.summary.passed}</td><td>${m.summary.failed}</td><td>${m.summary.affectedOperations}</td></tr>`).join('')}</table></html>`);
for (const m of modules) fs.writeFileSync(`tmp/app-audit/module-${m.key}.html`, `<!doctype html><html lang="vi"><meta charset="utf-8"><title>${esc(m.key)}</title><style>body{font:16px/1.5 system-ui;max-width:1100px;margin:24px auto;padding:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere}details{padding:8px;border:1px solid #aaa;margin:8px 0}</style><a href="module-report.html">Index</a><h1>${esc(m.key)}</h1>${details('Business scope',{jobs:m.jobs,invariants:m.invariants})}${m.operations.map(op=>details(`${op.title} ? ${op.id} ? failures: ${op.failures.length}`,op)).join('')}</html>`);
console.log(JSON.stringify({modules:modules.map(m=>({module:m.key,...m.summary})),matrix:{total:result.numTotalTests,passed:result.numPassedTests,failed:result.numFailedTests},business:business?{total:business.numTotalTests,passed:business.numPassedTests,failed:business.numFailedTests}:null}));
