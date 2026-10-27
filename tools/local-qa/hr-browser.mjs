import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run against `npm run qa:local`: its loopback server and isolated MongoDB are
// seeded with employees, departments, contracts, attendance, leave and payroll data.
const directory = path.resolve('tmp/local-qa');
const auth = JSON.parse(await readFile(path.join(directory, 'browser-auth.json'), 'utf8'));
const access = JSON.parse(await readFile(path.join(directory, 'access.json'), 'utf8'));
const branchId = access.accounts.find(account => account.companyCode === 'QA_EDU' && account.branchId)?.branchId;
assert.ok(branchId, 'QA_EDU branch fixture is missing');
const chrome = process.env.QA_CHROME_PATH || path.join(process.env.USERPROFILE || '', '.cache/puppeteer/chrome/win64-151.0.7922.47/chrome-win64/chrome.exe');
const origin = 'http://127.0.0.1:3120';
const loginResponse = await fetch(`${origin}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: access.retailDemo.email, password: access.retailDemo.password }) });
const login = await loginResponse.json();
assert.equal(loginResponse.status, 200, `QA login failed: ${login.message || loginResponse.status}`);
assert.ok(login.accessToken, 'QA login did not return an access token');
const token = login.accessToken;
const port = 9231;
const report = [];
const createdName = `QA Phòng ban ${Date.now()}`;
const renamedName = `${createdName} cập nhật`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (name, result) => { assert.ok(result, name); report.push({ name, passed: true }); console.log(`PASS ${name}`); };
const api = async (route, method = 'GET', body) => {
  const response = await fetch(`${origin}/api/v1${route}`, { method, headers: { Authorization: `Bearer ${token}`, 'x-device-id': auth.deviceId, 'x-branch-id': branchId, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json();
  return { ...json, httpStatus: response.status };
};

await mkdir(directory, { recursive: true });
await mkdir(path.join(directory, 'screenshots'), { recursive: true });
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(directory, 'hr-chrome-profile')}`, '--no-first-run', '--disable-gpu', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
let createdId;
try {
  let page;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(item => item.type === 'page'); if (page) break; } catch { /* Chrome is starting. */ }
    await delay(500);
  }
  assert.ok(page, 'Chrome did not start');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    pending.get(message.id)(message); pending.delete(message.id);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome timeout: ${method}`)); }, 15000);
    pending.set(id, message => { clearTimeout(timer); message.error ? reject(new Error(message.error.message)) : resolve(message.result); });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  };
  const waitFor = async (expression, name, timeout = 15000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await evaluate(expression)) return; await delay(200); }
    const state = await evaluate(`({ url: location.href, text: document.body.innerText.slice(0, 900) })`);
    throw new Error(`Timeout: ${name}: ${JSON.stringify(state)}`);
  };
  const button = label => `[...document.querySelectorAll('button')].find(item => item.textContent.trim() === ${JSON.stringify(label)})`;
  const clickButton = async label => { check(`Có nút ${label}`, await evaluate(`Boolean(${button(label)})`)); await evaluate(`${button(label)}.click()`); };
  const setInput = async (selector, value) => {
    const changed = await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); if (!input) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    check(`Có trường ${selector}`, changed);
  };
  await call('Page.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('accessToken', ${JSON.stringify(token)}); localStorage.setItem('igen.activeBranch.QA_EDU', ${JSON.stringify(branchId)});` });

  const departments = await api('/hr/departments');
  check('API phòng ban đọc dữ liệu MongoDB QA', departments.httpStatus === 200 && Array.isArray(departments.data) && departments.data.length > 0);
  const contracts = await api('/hr-contracts');
  check('API hợp đồng đọc dữ liệu nhân viên QA', contracts.httpStatus === 200 && Array.isArray(contracts.data?.contracts) && contracts.data.contracts.length > 0);
  const employees = await api('/auth/users');
  check('API nhân viên có dữ liệu trong chi nhánh', employees.httpStatus === 200 && JSON.stringify(employees).includes('QA_EDU'));

  for (const width of [390, 768, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: `${origin}/nhan-su?sub=phong-ban` });
    await waitFor("[...document.querySelectorAll('button')].some(item => item.textContent.trim() === 'Thêm phòng ban')", `Phòng ban ở ${width}px`);
    await waitFor("document.body.innerText.includes('Danh sách phòng ban')", `Danh sách phòng ban ở ${width}px`);
    const state = await evaluate(`({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, list: document.body.innerText.includes('Danh sách phòng ban') })`);
    if (state.overflow) console.log(`Horizontal overflow at ${width}px:`, state);
    check(`Phòng ban hiện tại ${width}px`, state.width === width && state.list && !state.overflow);
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(directory, 'screenshots', `hr-departments-${width}.png`), Buffer.from(screenshot.data, 'base64'));
  }

  await clickButton('Thêm phòng ban');
  await waitFor("Boolean(document.querySelector('dialog[open][aria-label=\"Thêm phòng ban\"]'))", 'Popup tạo phòng ban');
  check('Popup tạo có danh sách quản lý', await evaluate("document.querySelector('dialog[open] select[id$=manager]')?.options.length > 1"));
  await setInput('dialog[open] input[id$=name]', createdName);
  check('Lưu từ popup tạo', await evaluate(`(() => { const item = [...document.querySelectorAll('dialog[open] button')].find(button => button.textContent.trim() === 'Thêm phòng ban'); item?.click(); return Boolean(item); })()`));
  await waitFor(`document.body.innerText.includes(${JSON.stringify(createdName)})`, 'Tạo phòng ban trong giao diện');
  let listed = await api('/hr/departments');
  createdId = listed.data.find(item => item.name === createdName)?.id;
  check('Phòng ban mới được lưu vào MongoDB', Boolean(createdId));

  check('Có thao tác sửa phòng ban', await evaluate(`(() => { const item = document.querySelector('button[aria-label=${JSON.stringify(`Sửa ${createdName}`)}]'); item?.click(); return Boolean(item); })()`));
  await waitFor("Boolean(document.querySelector('dialog[open][aria-label=\"Sửa phòng ban\"]'))", 'Popup sửa phòng ban');
  check('Mở popup sửa phòng ban', true);
  await setInput('dialog[open] input[id$=name]', renamedName);
  await clickButton('Lưu thay đổi');
  await waitFor(`document.body.innerText.includes(${JSON.stringify(renamedName)})`, 'Sửa phòng ban trong giao diện');
  listed = await api('/hr/departments');
  check('Tên phòng ban cập nhật trong MongoDB', listed.data.some(item => item.id === createdId && item.name === renamedName));

  await evaluate(`document.querySelector('button[aria-label=${JSON.stringify(`Xóa ${renamedName}`)}]')?.click()`);
  await waitFor("Boolean(document.querySelector('[role=dialog]'))", 'Popup xác nhận xóa');
  await clickButton('Xóa phòng ban');
  await waitFor(`!document.body.innerText.includes(${JSON.stringify(renamedName)})`, 'Xóa phòng ban trong giao diện');
  listed = await api('/hr/departments');
  check('Chỉ phòng ban thử nghiệm bị xóa', !listed.data.some(item => item.id === createdId) && listed.data.length >= departments.data.length);
  createdId = undefined;

  for (const [slug, label, fixture] of [
    ['so-do', 'Sơ đồ tổ chức', 'manager kiểm thử QA_EDU'],
    ['chi-nhanh', 'Chi nhánh', 'QA_EDU - HN'],
    ['dao-tao', 'Đào tạo', 'Đào tạo quy trình QA_EDU-HN'],
    ['quy-trinh', 'Quy trình', 'Quy trình'],
    ['kanban', 'Giao việc', 'Dự án triển khai ERP QA_EDU-HN'],
    ['lich', 'Lịch & Ca làm việc', 'Chấm công'],
    ['hop-dong', 'Hợp đồng', 'Nhân viên kiểm thử'],
    ['payroll', 'Bảng lương', 'Bảng lương'],
    ['tuyen-dung', 'Tuyển dụng', 'Ứng viên QA_EDU-HN'],
  ]) {
    await call('Page.navigate', { url: `${origin}/nhan-su?sub=${slug}` });
    await waitFor(`document.querySelector('nav[aria-label="Mục Nhân sự"] button[aria-current="page"]')?.textContent.trim() === ${JSON.stringify(label)}`, `Tab ${label}`);
    check(`Điều hướng Nhân sự: ${label}`, await evaluate(`document.querySelector('nav[aria-label="Mục Nhân sự"] button[aria-current="page"]')?.textContent.trim() === ${JSON.stringify(label)}`));
    if (slug === 'tuyen-dung') await clickButton('Ứng viên');
    await waitFor(`document.body.innerText.includes(${JSON.stringify(fixture)})`, `Dữ liệu ${label}`);
    check(`Dữ liệu Nhân sự: ${label}`, true);
    if (slug === 'lich') {
      for (const schedule of ['Ca làm việc', 'Lịch nghỉ lễ', 'Giờ làm việc nhân viên']) {
        check(`Mở ${schedule}`, await evaluate(`(() => { const item = [...document.querySelectorAll('nav[aria-label="Nội dung lịch và ca làm việc"] button')].find(button => button.textContent.trim() === ${JSON.stringify(schedule)}); item?.click(); return Boolean(item); })()`));
        await waitFor(`document.querySelector('nav[aria-label="Nội dung lịch và ca làm việc"] button[aria-current="page"]')?.textContent.trim() === ${JSON.stringify(schedule)}`, `Mục lịch ${schedule}`);
      }
    }
  }
} finally {
  if (createdId) await api(`/hr/departments/${createdId}`, 'DELETE').catch(() => {});
  await writeFile(path.join(directory, 'hr-browser-report.json'), JSON.stringify({ at: new Date().toISOString(), checks: report }, null, 2));
  socket?.close();
  browser.kill();
}
