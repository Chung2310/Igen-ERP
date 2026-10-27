import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run against the isolated QA harness (`npm run qa:local`) after `npm run build`.
const directory = path.resolve('tmp/local-qa');
const access = JSON.parse(await readFile(path.join(directory, 'access.json'), 'utf8'));
const branchId = access.accounts.find(account => account.companyCode === 'QA_EDU' && account.branchId)?.branchId;
assert.ok(branchId, 'QA_EDU branch is missing');
const loginResponse = await fetch('http://127.0.0.1:3120/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: access.retailDemo.email, password: access.retailDemo.password }) });
const login = await loginResponse.json();
assert.equal(loginResponse.status, 200, `QA login failed: ${login.message || loginResponse.status}`);
const chrome = process.env.QA_CHROME_PATH || path.join(process.env.USERPROFILE || '', '.cache/puppeteer/chrome/win64-151.0.7922.47/chrome-win64/chrome.exe');
const port = 9232;
const output = path.join(directory, 'screenshots');
await mkdir(output, { recursive: true });
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(directory, 'inventory-chrome-profile')}`, '--no-first-run', '--disable-gpu', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
const check = (name, result) => { assert.ok(result, name); checks.push({ name, passed: true }); console.log(`PASS ${name}`); };
let socket;
try {
  let page;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(item => item.type === 'page'); if (page) break; } catch { /* Chrome starting */ }
    await delay(500);
  }
  assert.ok(page, 'Chrome did not start');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } });
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
  const waitFor = async (expression, label) => {
    const end = Date.now() + 15_000;
    while (Date.now() < end) { try { if (await evaluate(expression)) return; } catch { /* document may be navigating */ } await delay(200); }
    throw new Error(`Timeout: ${label}: ${JSON.stringify(await evaluate(`({ url: location.href, text: document.body.innerText.slice(0, 500) })`))}`);
  };
  await call('Page.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('accessToken', ${JSON.stringify(login.accessToken)}); localStorage.setItem('igen.activeBranch.QA_EDU', ${JSON.stringify(branchId)});` });
  for (const width of [390, 768, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: 'http://127.0.0.1:3120/kho-san-pham?sub=dieu-chuyen' });
    await waitFor("document.body?.innerText.includes('Điều chuyển và đối soát kho')", `Điều chuyển ${width}px`);
    await waitFor("document.body && !document.body.innerText.includes('Đang tải phiếu...')", `Danh sách điều chuyển ${width}px`);
    const state = await evaluate(`({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, active: [...document.querySelectorAll('#inventory_tabs_switch button')].some(button => button.textContent.trim() === 'Điều chuyển' && button.getAttribute('aria-current') === 'page'), visible: (() => { const tab = document.querySelector('#inventory_tabs_switch [aria-current="page"]'); const container = tab?.parentElement; if (!tab || !container) return false; const a = tab.getBoundingClientRect(), b = container.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1; })() })`);
    check(`Điều chuyển hiển thị ở ${width}px`, state.width === width && state.active && state.visible && !state.overflow);
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, `inventory-transfer-${width}.png`), Buffer.from(screenshot.data, 'base64'));
  }
  check('Mở popup tạo điều chuyển', await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(item => item.textContent.trim() === 'Tạo phiếu điều chuyển'); button?.click(); return Boolean(button); })()`));
  await waitFor("Boolean(document.querySelector('dialog[open][aria-labelledby=create-transfer-title]'))", 'Popup tạo điều chuyển');
  check('Popup có kho gửi và kho nhận', await evaluate("document.querySelector('dialog[open]')?.innerText.includes('Kho gửi') && document.querySelector('dialog[open]')?.innerText.includes('Kho nhận')"));
  for (const width of [390, 768, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: 'http://127.0.0.1:3120/kho-san-pham?sub=san-pham' });
    await waitFor("Boolean(document.querySelector('button[aria-label=\"Lọc danh mục sản phẩm\"]'))", `Bộ lọc sản phẩm ${width}px`);
    await waitFor("document.body && !document.body.innerText.includes('Đang tải danh mục sản phẩm...')", `Danh sách sản phẩm ${width}px`);
    const state = await evaluate("({ filters: Boolean(document.querySelector('button[aria-label=\"Lọc danh mục sản phẩm\"]') && document.querySelector('button[aria-label=\"Lọc thương hiệu sản phẩm\"]')), overflow: document.documentElement.scrollWidth > innerWidth })");
    check(`Bộ lọc Sản phẩm hiển thị ở ${width}px`, state.filters && !state.overflow);
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, `inventory-product-${width}.png`), Buffer.from(screenshot.data, 'base64'));
  }
} finally {
  await writeFile(path.join(directory, 'inventory-browser-report.json'), JSON.stringify({ at: new Date().toISOString(), checks }, null, 2));
  socket?.close(); browser.kill();
}
