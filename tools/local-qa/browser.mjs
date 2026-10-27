import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('tmp/local-qa');
const auth = JSON.parse(await readFile(path.join(directory, 'browser-auth.json'), 'utf8'));
const chrome = process.env.QA_CHROME_PATH || path.join(process.env.USERPROFILE, '.cache/puppeteer/chrome/win64-151.0.7922.47/chrome-win64/chrome.exe');
await mkdir(path.join(directory, 'screenshots'), { recursive: true });
const browser = spawn(chrome, ['--headless=new', '--remote-debugging-port=9226', `--user-data-dir=${path.join(directory, 'chrome-profile')}`, '--no-first-run', '--disable-gpu', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
const report = [];
try {
  let page;
  for (let i = 0; i < 60; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9226/json/list')).json()).find(p => p.type === 'page'); if (page) break; } catch {}
    await delay(500);
  }
  if (!page) throw new Error('Chrome did not start');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, message => { clearTimeout(timer); message.error ? reject(new Error(message.error.message)) : resolve(message.result); });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
  await call('Page.enable');
  const injection = await call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('accessToken', ${JSON.stringify(auth.superAdminToken)}); localStorage.setItem('igen_super_admin_device_id_v1', ${JSON.stringify(auth.deviceId)});` });
  for (const width of [390, 768, 1440]) {
    for (const theme of ['light', 'dark']) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
      await call('Page.navigate', { url: 'http://127.0.0.1:3120/super-admin' });
      await delay(2500);
      await evaluate(`document.documentElement.classList.toggle('dark', ${theme === 'dark'}); [...document.querySelectorAll('button')].find(b => b.textContent.includes('Giám sát hoạt động'))?.click()`);
      await delay(3500);
      const state = await evaluate(`({title: document.title, text: document.body.innerText, overflow: document.documentElement.scrollWidth > innerWidth, width: innerWidth})`);
      const screenshot = await call('Page.captureScreenshot', { format: 'png' });
      const file = `activity-${width}-${theme}.png`;
      await writeFile(path.join(directory, 'screenshots', file), Buffer.from(screenshot.data, 'base64'));
      report.push({ width, theme, ...state, screenshot: file });
      console.log(JSON.stringify({ width, theme, overflow: state.overflow, activityVisible: state.text.includes('Tạm dừng') }));
    }
  }
  await evaluate(`document.querySelector('button[aria-pressed="false"]')?.click()`);
  await delay(500);
  const paused = await evaluate(`Boolean(document.querySelector('button[aria-pressed="true"]'))`);
  await evaluate(`document.querySelector('button[aria-pressed="true"]')?.click()`);
  await delay(500);
  const resumed = await evaluate(`Boolean(document.querySelector('button[aria-pressed="false"]'))`);
  report.push({ check: 'pause-resume', passed: paused && resumed });
  const correlationId = `qa-browser-${Date.now()}`;
  const activityResponse = await fetch('http://127.0.0.1:3120/api/v1/auth/me', { headers: { Authorization: `Bearer ${auth.adminToken}`, 'x-correlation-id': correlationId } });
  let liveVisible = false;
  for (let i = 0; i < 12; i++) {
    await delay(500);
    liveVisible = await evaluate(`document.querySelector('section[aria-label="Giám sát hoạt động"]')?.textContent.includes(${JSON.stringify(correlationId)})`);
    if (liveVisible) break;
  }
  report.push({ check: 'new-api-action-appears-without-reload', status: activityResponse.status, passed: activityResponse.ok && liveVisible });
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  const access = JSON.parse(await readFile(path.join(directory, 'access.json'), 'utf8'));
  for (const company of ['QA_EDU', 'QA_LABOR']) {
    const branch = access.accounts.find(a => a.companyCode === company && a.branchId).branchId;
    const token = company === 'QA_EDU' ? auth.adminToken : auth.laborAdminToken;
    const setup = await call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('accessToken', ${JSON.stringify(token)}); localStorage.setItem('igen.activeBranch.${company}', ${JSON.stringify(branch)}); document.documentElement.classList.remove('dark');` });
    const routes = company === 'QA_EDU' ? ['/tong-quan', '/nhan-su', '/doi-tac', '/doi-tac-ban-le', '/kho-san-pham', '/quan-ly-tai-nguyen', '/tro-chuyen', '/quan-ly-hoc-vien', '/quan-ly-khach-hang', '/quan-ly-ung-vien', '/ban-le', '/tai-chinh', '/phan-tich', '/quan-tri-user', '/cai-dat', '/sua-chua-bao-hanh'] : ['/quan-ly-lao-dong'];
    for (const route of routes) {
      await call('Page.navigate', { url: `http://127.0.0.1:3120${route}` });
      await delay(3000);
      const state = await evaluate(`({title: document.title, text: document.body.innerText, overflow: document.documentElement.scrollWidth > innerWidth, pathname: location.pathname})`);
      const screenshot = await call('Page.captureScreenshot', { format: 'png' });
      const file = `${company}-${route.slice(1)}.png`;
      await writeFile(path.join(directory, 'screenshots', file), Buffer.from(screenshot.data, 'base64'));
      report.push({ company, route, ...state, screenshot: file });
      console.log(JSON.stringify({ company, route, actualPath: state.pathname, overflow: state.overflow, textLength: state.text.length }));
    }
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: setup.identifier });
  }
} finally {
  await writeFile(path.join(directory, 'browser-report.json'), JSON.stringify(report, null, 2));
  socket?.close();
  browser.kill();
}
if (report.some(entry => entry.passed === false || entry.overflow || (entry.width && !entry.text.includes('Tạm dừng')))) process.exitCode = 1;
