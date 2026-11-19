// Build a reviewable per-operation report from offline Vitest evidence.
// Run after the two function-matrix suites with their evidence output env vars.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(process.argv[2] || 'tmp/function-matrix');
const matrix = JSON.parse(fs.readFileSync(path.join(dir, 'evidence-verified.json'), 'utf8'));
const conversations = JSON.parse(fs.readFileSync(path.join(dir, 'conversations-verified.json'), 'utf8'));
const moduleNames={hr:'Nhân sự',quotation:'Báo giá',student:'Học viên',worker:'Lao động','labor-partner':'Đối tác lao động','retail-partner':'Đối tác bán lẻ','student-partner':'Đối tác học viên',healthcare:'Quản lý y tế',inventory:'Kho sản phẩm',repair:'Sửa chữa bảo hành',retail:'Bán lẻ',finance:'Tài chính'};
const targetCall = (call, op) => {
  const actual = call.path.split('/');
  const expected = ('/api/v1' + op.path).split('/');
  return call.method === op.method && actual.length === expected.length && actual.every((part, i) => expected[i].startsWith(':') || part === expected[i]);
};
const operations = matrix.operations.map(op => {
  const validation = matrix.cases.filter(c => c.operation === op.id);
  const turns = conversations.filter(c => c.operation === op.id);
  const probe = turns.find(c => c.scenario === 'api-rejection-probe');
  const reachedTarget = Boolean(probe?.calls.some(call => targetCall(call, op) && call.status===422));
  const success = turns.find(c => c.scenario === 'success-probe');
  const succeeded = success?.status==='passed' && success?.lastReply?.status==='completed';
  return { ...op, validation, conversations: turns, coverage: {
    totalCases: validation.length + turns.length,
    failedCases: [...validation, ...turns].filter(c => c.status !== 'passed').length,
    targetApiRejectionExercised: reachedTarget,
    confirmationExercised: Boolean(probe?.confirmation),
    successfulMockExecution: succeeded,
    unavailableReason: op.unavailableReason || null,
    unavailableBlocked: Boolean(op.unavailableReason && turns.some(c=>c.scenario==='unavailable-operation' && c.status==='passed' && c.calls.length===0)),
    successAndPersistence: succeeded ? (success.savedRecords?.length ? 'Đã kiểm tra gọi ghi đúng một lần. Nhật ký mock lưu payload và bản ghi phản hồi giả lập. Gửi lại cùng requestId không ghi trùng. Chưa kiểm tra lưu DB thật.' : 'Đã kiểm tra phản hồi thành công qua API mock. Chức năng chỉ đọc hoặc xem trước.') : 'Chưa đạt ca thành công',
    cancellationBeforeWrite: turns.find(c=>c.scenario==='cancel-preview')?.status || 'Không áp dụng',
    staleVersion: turns.find(c=>c.scenario==='stale-version')?.status || 'Chưa kiểm tra trong ma trận này',
    realModel: 'Chưa kiểm tra. Phản hồi AI được giả lập',
    stoppedAt: op.unavailableReason || (reachedTarget ? 'Đã gọi API đích giả lập trả lỗi 422' : (probe?.lastReply?.reply || probe?.reply?.reply || 'Chưa có bằng chứng')),
  }};
});
const summary = {
  generatedAt: new Date().toISOString(),
  operations: operations.length,
  cases: operations.reduce((n, op) => n + op.coverage.totalCases, 0),
  failedCases: operations.reduce((n, op) => n + op.coverage.failedCases, 0),
  targetApiRejections: operations.filter(op => op.coverage.targetApiRejectionExercised).length,
  successfulMockExecutions: operations.filter(op=>op.coverage.successfulMockExecution).length,
  cancelledBeforeWrite: operations.filter(op=>op.coverage.cancellationBeforeWrite==='passed').length,
  staleVersionsBlocked: operations.filter(op=>op.coverage.staleVersion==='passed').length,
  unavailableBlocked: operations.filter(op=>op.coverage.unavailableBlocked).length,
  limitations: 'Kiểm thử offline với phản hồi API thành công và từ chối. Mock AI, quyền, phiên hội thoại và API. Dữ liệu ghi trong báo cáo là payload và bản ghi trong bộ nhớ test, không phải DB ERP. Không chứng minh AI thật hiểu câu tự nhiên hoặc tất cả quy tắc nghiệp vụ backend. Các biến thể nghiệp vụ, hỏi bổ sung sau tạo và giao diện chưa được phủ hết cho từng chức năng. Không gọi OpenRouter, gửi email thật hay ghi dữ liệu ERP thật.',
};
fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({summary, operations}, null, 2));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const detail = (label, data) => `<details><summary>${esc(label)}</summary><pre>${esc(JSON.stringify(data, null, 2))}</pre></details>`;
const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Kiểm tra từng chức năng trợ lý ERP</title>
<style>body{font:16px system-ui;max-width:1200px;margin:24px auto;padding:0 16px;color:#202124}details{margin:10px 0;padding:12px;border:1px solid #ccc;border-radius:8px}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f6f6;padding:12px}input,select{padding:10px;margin:8px}table{border-collapse:collapse;width:100%}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}.limit{background:#fff1ce;padding:16px}</style>
<h1>Kiểm tra từng chức năng trợ lý ERP</h1><p class="limit">${esc(summary.limitations)}</p>
<p>${summary.operations} chức năng · ${summary.cases} ca · ${summary.failedCases} ca lỗi · ${summary.targetApiRejections} chức năng đã kiểm tra API từ chối · ${summary.successfulMockExecutions} chức năng đạt ca thành công với mock.</p>
<p>${summary.unavailableBlocked} thao tác cũ không khả dụng được kiểm tra chặn, không tính là thao tác thành công.</p>
<table><thead><tr><th>Mô-đun</th><th>Danh mục</th><th>Thành công mock</th><th>API từ chối</th><th>Ca lỗi</th></tr></thead><tbody>${[...new Set(operations.map(op=>op.module))].map(m=>{const ops=operations.filter(op=>op.module===m);return `<tr><td>${esc(moduleNames[m]||m)}</td><td>${ops.length}</td><td>${ops.filter(op=>op.coverage.successfulMockExecution).length}</td><td>${ops.filter(op=>op.coverage.targetApiRejectionExercised).length}</td><td>${ops.reduce((n,op)=>n+op.coverage.failedCases,0)}</td></tr>`}).join('')}</tbody></table>
<p>Ba lỗi đã sửa: ngày giờ không tồn tại vẫn được chấp nhận, nội dung dài hợp lệ bị chặn ở 4.000 ký tự, xử lý yêu cầu kiểm tra phiếu lương báo hoàn tất dù API từ chối.</p>
<p>Lượt bổ sung dữ liệu: sửa thao tác đánh dấu đợt học phí đã thu bị hỏi thêm thông tin sửa, sửa hai thao tác cập nhật lương hàng loạt bị lặp xác nhận do phiên bản máy chủ. Kiểm tra hủy trước khi ghi, gửi lại cùng requestId và dữ liệu lương đổi phiên bản sau xem trước.</p>
<p>Lượt mở rộng 9 mô-đun: sửa phạm vi chi nhánh của chi tiết hóa đơn bán lẻ, giữ ngày của lịch hẹn y tế không có giờ khi sửa bác sĩ, chuẩn hóa tham chiếu công nợ và giữ mã chọn riêng của khoản chi trả hoa hồng. Các ca POS dùng thiết bị và ca bán hàng giả lập.</p>
<label>Tìm chức năng <input id="q" type="search" placeholder="Tên, mã chức năng"></label><label>Mô-đun <select id="module"><option value="">Tất cả</option>${[...new Set(operations.map(op=>op.module))].map(m=>`<option value="${esc(m)}">${esc(moduleNames[m]||m)}</option>`).join('')}</select></label>
${operations.map(op => `<details class="operation" data-module="${esc(op.module)}" data-search="${esc((op.id+' '+op.title).toLocaleLowerCase('vi'))}"><summary>${esc(op.title)} — ${esc(op.id)} · ${op.coverage.totalCases} ca · ${op.coverage.failedCases} lỗi</summary>
<p>${esc(op.method+' '+op.path)}</p><p><strong>${esc(op.coverage.stoppedAt)}</strong></p><p>Luồng thành công và lưu dữ liệu: ${esc(op.coverage.successAndPersistence)}. Xác nhận đã chạy: ${op.coverage.confirmationExercised?'Có':'Chưa'}.</p>
${detail('Trường dữ liệu và ràng buộc của chức năng',op.fields)}
<h2>Các ca hội thoại</h2>${op.conversations.map(c=>detail(c.scenario+' — '+c.status, {input:c.input, mockAi:c.ai, reply:c.reply, followups:c.followups, confirmations:c.confirmations, lastReply:c.lastReply, apiCalls:c.calls, savedRecords:c.savedRecords, replay:c.replay, pending:c.pending,error:c.error})).join('')}
<h2>Các ca diễn giải và kiểm tra trường dữ liệu</h2>${op.validation.map(c=>detail(c.caseId+' — '+c.status,c)).join('')}
</details>`).join('')}
<script>function filter(){const q=document.querySelector('#q').value.toLocaleLowerCase('vi');const m=document.querySelector('#module').value;document.querySelectorAll('.operation').forEach(el=>el.hidden=!(el.dataset.search.includes(q)&&(!m||el.dataset.module===m)));}document.querySelector('#q').addEventListener('input',filter);document.querySelector('#module').addEventListener('change',filter);</script></html>`;
fs.writeFileSync(path.join(dir, 'report.html'), html);
console.log(JSON.stringify(summary, null, 2));
