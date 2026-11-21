import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const base = process.env.GYM_QA_BASE_URL || 'http://127.0.0.1:3000';
const browserPath = process.env.GYM_QA_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const authPath = process.env.GYM_QA_AUTH_PATH || join(tmpdir(), 'igen-gym-qa-auth.json');
const output = fileURLToPath(new URL('./artifacts/', import.meta.url));
const mode = process.argv[2] || 'survey';

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(['login', 'login-customer'].includes(mode) ? {} : { storageState: authPath }) });
const page = await context.newPage();
const findings = [];
page.on('pageerror', error => findings.push({ kind: 'pageerror', message: error.message.slice(0, 300) }));
page.on('response', response => {
  if (response.status() >= 400 && response.url().includes('/api/v1/gym/')) {
    findings.push({ kind: 'api', status: response.status(), path: new URL(response.url()).pathname });
  }
});

try {
  if (mode === 'login' || mode === 'login-customer') {
    if (!process.env.GYM_QA_EMAIL || !process.env.GYM_QA_PASSWORD) throw new Error('GYM_QA_EMAIL and GYM_QA_PASSWORD are required');
    await page.goto(`${base}/dang-nhap`);
    await page.locator('#login-email').fill(process.env.GYM_QA_EMAIL);
    await page.locator('#login-password').fill(process.env.GYM_QA_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByText('Quản lý phòng Gym', { exact: true }).first().click();
    const frame = page.frameLocator('iframe[title="Quản lý phòng Gym"]');
    if (mode === 'login') await frame.getByRole('link', { name: 'Khách hàng', exact: true }).waitFor({ timeout: 20000 });
    else await page.waitForTimeout(2200);
    await context.storageState({ path: authPath });
    await page.screenshot({ path: join(output, 'admin-entry.png'), fullPage: true });
    console.log(JSON.stringify({ mode, result: 'pass', url: page.url(), authSaved: true, gymText: mode === 'login-customer' ? (await frame.locator('body').innerText()).slice(0, 1100) : undefined, findings }));
  } else if (mode === 'roadmap-layout') {
    const checks = [];
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/chuoi-gym/pt/roadmaps`);
      await page.getByRole('button', { name: 'Tạo roadmap', exact: true }).click();
      const labels = ['Mục tiêu chính', 'Đơn vị chỉ số mục tiêu', 'Thời gian dự kiến (Tuần)', 'Tần suất tập luyện'];
      const selectHeights = [];
      for (const label of labels) selectHeights.push({ label, height: (await page.getByRole('combobox', { name: label }).boundingBox())?.height });
      const targetInputHeight = (await page.getByRole('spinbutton', { name: 'Chỉ số mục tiêu' }).boundingBox())?.height;
      const card = await page.getByTestId('feasibility-card').boundingBox();
      const durationLabel = await page.locator('label.field').filter({ hasText: 'Thời lượng tối đa mỗi buổi (phút)' }).boundingBox();
      await page.screenshot({ path: join(output, `gym-roadmap-controls-${width}.png`) });
      checks.push({ width, selectHeights, targetInputHeight, aiCardToDurationGap: Math.round((durationLabel?.y || 0) - ((card?.y || 0) + (card?.height || 0))), findings });
    }
    console.log(JSON.stringify({ mode, checks }));
  } else if (mode === 'gym-popup-overlays') {
    const scenarios = [
      { name: 'Khách hàng', path: '/chuoi-gym/customers', button: 'Thêm khách hàng', overlay: 'div[style*="position: fixed"][style*="inset: 0"]' },
      { name: 'InBody', path: '/chuoi-gym/pt/inbody', button: 'Nhập thủ công', overlay: '.modal-backdrop.profile-modal-backdrop' },
      { name: 'Giáo án AI', path: '/chuoi-gym/pt/my-workout-plans', button: 'Tạo bằng AI', overlay: '.workout-wizard-backdrop' },
    ];
    const checks = [];
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const scenario of scenarios) {
        await page.goto(`${base}${scenario.path}`);
        await page.getByRole('button', { name: scenario.button, exact: true }).first().click();
        const overlay = page.locator(scenario.overlay).first();
        await overlay.waitFor({ timeout: 15000 });
        const style = await overlay.evaluate(el => {
          const css = getComputedStyle(el);
          return { background: css.backgroundColor, blur: css.backdropFilter };
        });
        await page.screenshot({ path: join(output, `gym-popup-${scenario.name.replaceAll(' ', '-')}-${width}.png`) });
        checks.push({ width, name: scenario.name, ...style });
      }
    }
    console.log(JSON.stringify({ mode, checks, findings }));
  } else if (mode === 'inbody-backdrop-visual') {
    const checks = [];
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/chuoi-gym/pt/inbody`);
      if (width === 1440) await page.locator('button[title="Sửa phiếu InBody"]:visible').first().click();
      else await page.getByRole('button', { name: 'Nhập thủ công', exact: true }).first().click();
      const dialog = page.getByRole('dialog', { name: width === 1440 ? 'Chỉnh sửa phiếu đo InBody' : 'Nhập kết quả InBody thủ công' });
      await dialog.waitFor();
      const overlay = await page.locator('.profile-modal-backdrop').evaluate(el => {
        const css = getComputedStyle(el);
        return { background: css.backgroundColor, blur: css.backdropFilter, modal: el.querySelector('[role="dialog"]')?.getAttribute('aria-modal') };
      });
      await page.screenshot({ path: join(output, `inbody-popup-no-overlay-${width}.png`) });
      await page.keyboard.press('Escape');
      checks.push({ width, overlay, closedOnEscape: await dialog.count() === 0, findings });
    }
    console.log(JSON.stringify({ mode, checks }));
  } else if (mode === 'badge-visual') {
    const checks = [];
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/chuoi-gym/customers`);
      await page.locator('.status-badge.status-active').first().waitFor({ timeout: 20000 });
      const status = await page.locator('.status-badge.status-active').first().evaluate(el => {
        const css = getComputedStyle(el);
        return { text: el.textContent?.trim(), transform: css.textTransform, radius: css.borderRadius, color: css.color, background: css.backgroundColor };
      });
      const pt = await page.locator('.gym-assigned-pt').first().count() ? await page.locator('.gym-assigned-pt').first().evaluate(el => {
        const css = getComputedStyle(el);
        return { text: el.textContent?.trim(), transform: css.textTransform, radius: css.borderRadius, color: css.color, background: css.backgroundColor };
      }) : null;
      await page.screenshot({ path: join(output, `gym-badges-${width}.png`) });
      checks.push({ width, status, pt, bodyEnd: pt ? undefined : (await page.locator('body').innerText()).slice(-450), findings });
    }
    console.log(JSON.stringify({ mode, checks }));
  } else if (mode === 'survey') {
    await page.goto(`${base}/quan-ly-chuoi-gym`);
    const frame = page.frameLocator('iframe[title="Quản lý phòng Gym"]');
    await frame.getByRole('button', { name: 'Thêm khách hàng' }).waitFor({ timeout: 20000 });
    const links = [
      ['Khách hàng', '/customers'], ['InBody', '/pt/inbody'], ['Dinh dưỡng', '/pt/nutrition'],
      ['Lộ trình', '/pt/roadmaps'], ['Giáo án', '/pt/my-workout-plans'], ['Tiến độ', '/pt/progress'],
      ['Đội ngũ PT', '/management/trainers'], ['Gói mẫu', '/management/packages'],
      ['Điều chuyển', '/transfers'], ['Kho tư liệu', '/knowledge'], ['Trợ lý AI', '/pt/assistant'],
    ];
    const pages = [];
    for (const [label, path] of links) {
      const link = frame.getByRole('link', { name: label, exact: true });
      await link.click();
      await page.waitForTimeout(700);
      const gymFrame = page.frames().find(item => item.url().includes('/chuoi-gym/'));
      const text = gymFrame ? await gymFrame.locator('body').innerText() : '';
      const passed = Boolean(gymFrame?.url().endsWith(path) && text.trim() && !text.includes('Không thể tải'));
      pages.push({ label, path, passed, url: gymFrame?.url(), preview: text.slice(0, 180) });
      await page.screenshot({ path: join(output, `${path.replaceAll('/', '_')}.png`) });
    }
    await writeFile(join(output, 'survey.json'), JSON.stringify({ pages, findings }, null, 2));
    console.log(JSON.stringify({ mode, pages, findings }));
  } else if (mode === 'inspect') {
    const path = process.env.GYM_QA_PATH || '/customers';
    await page.goto(`${base}/chuoi-gym${path}`);
    await page.locator('main').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    if (process.env.GYM_QA_SELECT_CUSTOMER) {
      await page.locator('input[name="customerId"] + .customer-select-trigger').click();
      await page.getByRole('option', { name: new RegExp(process.env.GYM_QA_SELECT_CUSTOMER) }).click();
    }
    if (process.env.GYM_QA_TEXT) await page.getByText(process.env.GYM_QA_TEXT, { exact: true }).first().click();
    if (process.env.GYM_QA_BUTTON) {
      const button = page.getByRole('button', { name: process.env.GYM_QA_BUTTON }).first();
      await button.waitFor({ timeout: 45000 });
      await button.click();
    }
    if (process.env.GYM_QA_AFTER_BUTTON) await page.getByRole('button', { name: process.env.GYM_QA_AFTER_BUTTON }).first().click();
    if (process.env.GYM_QA_WAIT_MS) await page.waitForTimeout(Number(process.env.GYM_QA_WAIT_MS));
    const fields = await page.locator('input,select,textarea').evaluateAll(items => items.map(item => ({ tag: item.tagName, type: item.getAttribute('type'), placeholder: item.getAttribute('placeholder'), name: item.getAttribute('name'), ariaLabel: item.getAttribute('aria-label') })));
    const buttons = await page.getByRole('button').allTextContents();
    const body = await page.locator('body').innerText();
    console.log(JSON.stringify({ mode, path, button: process.env.GYM_QA_BUTTON, body: body.slice(-3000), fields, buttons: buttons.slice(-35), findings }));
  } else if (mode === 'seed-pt' || mode === 'seed-pt2') {
    await page.goto(`${base}/chuoi-gym/management/trainers`);
    const second = mode === 'seed-pt2';
    const name = second ? 'QA Gym - PT Lan Anh' : 'QA Gym - PT Minh An';
    await page.getByText('Thêm Huấn luyện viên', { exact: true }).waitFor();
    if (!(await page.getByText(name, { exact: true }).count())) {
      await page.getByRole('button', { name: 'Thêm Huấn luyện viên', exact: true }).click();
      await page.locator('input[name="fullName"]').fill(name);
      await page.locator('input[name="phone"]').fill(second ? '0900000102' : '0900000101');
      await page.locator('input[name="email"]').fill(second ? 'qa-gym-pt2-20261121@example.com' : 'qa-gym-pt-20261121@example.com');
      await page.locator('input[name="specialization"]').fill('Huấn luyện tổng quát');
      await page.locator('input[name="yearsOfExperience"]').fill('3');
      await page.locator('input[name="username"]').fill(second ? 'qa_gym_pt2_20261121' : 'qa_gym_pt_20261121');
      if (!process.env.GYM_QA_SAMPLE_PASSWORD) throw new Error('GYM_QA_SAMPLE_PASSWORD is required when creating QA accounts.');
      await page.locator('input[name="password"]').fill(process.env.GYM_QA_SAMPLE_PASSWORD);
      await page.getByRole('button', { name: 'Tạo Huấn luyện viên', exact: true }).click();
      await page.waitForTimeout(1800);
    }
    const visible = await page.getByText(name, { exact: true }).count();
    console.log(JSON.stringify({ mode, name, passed: Boolean(visible), body: (await page.locator('body').innerText()).slice(-850), findings }));
  } else if (mode === 'seed-packages') {
    await page.goto(`${base}/chuoi-gym/management/packages`);
    const items = [
      { name: 'QA Gym - Gói 12 buổi', totalSessions: '12', durationDays: '30', price: '1200000' },
      { name: 'QA Gym - Gói 24 buổi', totalSessions: '24', durationDays: '60', price: '2200000' },
    ];
    const results = [];
    for (const item of items) {
      await page.getByRole('button', { name: 'Tạo gói mẫu mới', exact: true }).waitFor();
      if (!(await page.getByText(item.name, { exact: true }).count())) {
        await page.getByRole('button', { name: 'Tạo gói mẫu mới', exact: true }).click();
        for (const key of ['name', 'totalSessions', 'durationDays', 'price']) await page.locator(`[name="${key}"]`).fill(item[key]);
        await page.locator('textarea[name="description"]').fill('Dữ liệu mẫu QA Gym để kiểm tra quy trình gói tập.');
        await page.getByRole('button', { name: 'Tạo gói mẫu', exact: true }).click();
        await page.waitForTimeout(1000);
      }
      results.push({ name: item.name, visible: Boolean(await page.getByText(item.name, { exact: true }).count()) });
    }
    console.log(JSON.stringify({ mode, results, body: (await page.locator('body').innerText()).slice(-700), findings }));
  } else if (mode === 'seed-customers') {
    await page.goto(`${base}/chuoi-gym/customers`);
    const items = [
      { name: 'QA Gym - Nguyễn An', phone: '0900000201', email: 'qa-gym-kh1@example.com', height: '170', weight: '68', goal: 'Tăng sức bền' },
      { name: 'QA Gym - Trần Bình', phone: '0900000202', email: 'qa-gym-kh2@example.com', height: '165', weight: '60', goal: 'Tăng cơ' },
    ];
    const results = [];
    for (const item of items) {
      await page.getByRole('button', { name: 'Thêm khách hàng', exact: true }).waitFor();
      await page.waitForTimeout(400);
      if (!(await page.getByText(item.name, { exact: true }).count())) {
        await page.getByRole('button', { name: 'Thêm khách hàng', exact: true }).click();
        await page.getByPlaceholder('Nguyễn Văn A').fill(item.name);
        await page.getByPlaceholder('0912345678').fill(item.phone);
        await page.getByPlaceholder('email@example.com').fill(item.email);
        await page.getByRole('combobox', { name: 'Huấn luyện viên phụ trách' }).click();
        const ptOption = page.getByRole('option', { name: 'QA Gym - PT Minh An' });
        try {
          await ptOption.click({ timeout: 1500 });
        } catch {
          findings.push({ kind: 'ui', message: 'PT dropdown option is covered by the weight label; selected through DOM click for test continuation' });
          await ptOption.evaluate(element => element.click());
        }
        await page.getByPlaceholder('165').fill(item.height);
        await page.getByPlaceholder('58').fill(item.weight);
        await page.getByPlaceholder('Giảm 3kg mỡ, săn chắc cơ đùi và eo...').fill(item.goal);
        await page.getByRole('button', { name: 'Tạo khách hàng', exact: true }).click();
        await page.waitForTimeout(1000);
      }
      results.push({ name: item.name, visible: Boolean(await page.getByText(item.name, { exact: true }).count()) });
    }
    console.log(JSON.stringify({ mode, results, body: (await page.locator('body').innerText()).slice(-900), findings }));
  } else if (mode === 'ai-assistant') {
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${base}/chuoi-gym/pt/assistant`);
    await page.getByPlaceholder('Nhập câu hỏi hoặc tình huống cần hỗ trợ (Nhấn Enter để gửi)...').fill('QA Gym: Hãy nêu một bài tập khởi động đơn giản trước khi tập tạ, trả lời ngắn.');
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/assistant/conversations/') && response.url().endsWith('/messages') && response.request().method() === 'POST' && response.status() !== 428, { timeout: 120000 });
    await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    await page.waitForTimeout(700);
    console.log(JSON.stringify({ mode, status: response.status(), success: payload.success, message: payload.message, body: (await page.locator('body').innerText()).slice(-1200), findings }));
  } else if (mode === 'inbody-manual') {
    await page.goto(`${base}/chuoi-gym/pt/inbody`);
    await page.getByRole('button', { name: 'Nhập thủ công' }).waitFor();
    const results = [];
    for (const item of [
      { name: 'QA Gym - Nguyễn An', weight: '68.5', height: '170', fat: '18.5', muscle: '31.2' },
      { name: 'QA Gym - Trần Bình', weight: '60.5', height: '165', fat: '22.1', muscle: '26.4' },
    ]) {
      if (!(await page.getByText(item.name, { exact: true }).count())) {
        await page.getByRole('button', { name: 'Nhập thủ công' }).click();
        await page.locator('input[name="manualCustomerId"] + .customer-select-trigger').click();
        await page.getByRole('option', { name: new RegExp(item.name) }).click();
        await page.getByPlaceholder('vd: 68.5').fill(item.weight);
        await page.getByPlaceholder('vd: 170.1').fill(item.height);
        await page.getByPlaceholder('vd: 18.5').fill(item.fat);
        await page.getByPlaceholder('vd: 31.2').fill(item.muscle);
        await page.getByPlaceholder('Nhập nhận định thêm, mục tiêu trao đổi hoặc lưu ý bệnh lý/cơ xương khớp của học viên...').fill('Dữ liệu kiểm thử QA Gym.');
        const responsePromise = page.waitForResponse(response => response.url().includes('/api/inbody') && response.request().method() === 'POST', { timeout: 30000 });
        await page.getByRole('button', { name: 'Lưu kết quả InBody' }).click();
        const response = await responsePromise;
        results.push({ name: item.name, status: response.status(), body: (await response.text()).slice(0, 250) });
      } else results.push({ name: item.name, status: 'already-visible' });
    }
    await page.reload();
    await page.waitForTimeout(1500);
    console.log(JSON.stringify({ mode, results, body: (await page.locator('body').innerText()).slice(-1300), findings }));
  } else if (mode === 'nutrition-calc-ai') {
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${base}/chuoi-gym/pt/nutrition`);
    await page.getByRole('button', { name: 'Tính Ngay' }).waitFor({ timeout: 30000 });
    await page.locator('input[name="customerId"] + .customer-select-trigger').click();
    await page.getByRole('option', { name: /QA Gym - Nguyễn An/ }).click();
    const numbers = page.locator('main input[type="number"]');
    await numbers.nth(0).fill('68.5');
    await numbers.nth(1).fill('170');
    await numbers.nth(2).fill('28');
    await numbers.nth(3).fill('18.5');
    await page.getByRole('button', { name: 'Tính Ngay' }).click();
    const calcText = (await page.locator('main.portal-content').innerText()).slice(-1500);
    await page.getByRole('tab', { name: 'Hỏi Chuyên Gia AI' }).click();
    await page.getByRole('button', { name: 'Mesomorph' }).click();
    await page.getByPlaceholder('Mô tả giờ làm việc, giờ tập và giấc ngủ thực tế...').fill('Làm việc văn phòng, tập 3 buổi mỗi tuần, ngủ 7 giờ.');
    await page.getByPlaceholder('Dị ứng (tôm, cua, lactose), ăn chay, nhịn ăn gián đoạn 16/8, thói quen ăn ngoài...').fill('Ăn món Việt, không có dị ứng.');
    await page.getByPlaceholder('VD: Giảm 4kg mỡ bụng, giữ nguyên cơ bắp trong 8 tuần').fill('Tăng sức bền trong 8 tuần.');
    const responses = [];
    page.on('response', async response => { if (response.request().method() === 'POST' && /nutrition|ai/.test(response.url())) responses.push({ status: response.status(), path: new URL(response.url()).pathname }); });
    await page.getByRole('button', { name: 'AI Phân tích thể chất & Tính toán chuyên sâu' }).click();
    await page.waitForTimeout(30000);
    console.log(JSON.stringify({ mode, calcText, aiText: (await page.locator('main.portal-content').innerText()).slice(-2600), responses, findings }));
  } else if (mode === 'inbody-ocr') {
    page.on('dialog', dialog => dialog.accept());
    const fixture = join(output, 'synthetic-inbody.png');
    const fixturePage = await context.newPage();
    await fixturePage.setViewportSize({ width: 900, height: 750 });
    await fixturePage.setContent(`<main style="font: 26px Arial; padding: 35px; color: #111; background:#fff"><h1>INBODY TEST DATA</h1><p>Name: QA Gym - Nguyen An</p><p>Date: 2026-11-21</p><hr><p>Height: 170 cm</p><p>Weight: 68.5 kg</p><p>Skeletal Muscle Mass: 31.2 kg</p><p>Body Fat Percentage: 18.5 %</p><p>Body Fat Mass: 12.7 kg</p><p>BMI: 23.7</p><p>BMR: 1507 kcal</p><p>Visceral Fat Level: 5</p><p>InBody Score: 78</p><small>QA synthetic fixture; no real patient data.</small></main>`);
    await fixturePage.screenshot({ path: fixture });
    await fixturePage.close();
    await page.goto(`${base}/chuoi-gym/pt/inbody`);
    await page.getByRole('button', { name: 'Quét phiếu InBody' }).click();
    await page.locator('input[name="customerId"] + .customer-select-trigger').click();
    await page.getByRole('option', { name: /QA Gym - Nguyễn An/ }).click();
    await page.locator('input[type="file"]').setInputFiles(fixture);
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/inbody/ocr') && response.request().method() === 'POST' && response.status() !== 428, { timeout: 120000 });
    await page.getByRole('button', { name: 'Quét InBody', exact: true }).click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(output, 'inbody-ocr-result.png') });
    console.log(JSON.stringify({ mode, status: response.status(), message: payload.message, data: payload.data && { weight: payload.data.weight, height: payload.data.height, bodyFatPercentage: payload.data.bodyFatPercentage, muscleMass: payload.data.muscleMass }, body: (await page.locator('body').innerText()).slice(-1100), findings }));
  } else if (mode === 'inbody-ocr-file' || mode === 'inbody-ocr-file-debug') {
    if (!process.env.GYM_QA_PDF_PATH) throw new Error('GYM_QA_PDF_PATH is required.');
    await page.goto(`${base}/chuoi-gym/pt/inbody`);
    await page.getByRole('button', { name: 'Quét phiếu InBody' }).click();
    await page.locator('input[type="file"]').setInputFiles(process.env.GYM_QA_PDF_PATH);
    const ocrResponses = [];
    page.on('response', item => { if (item.url().includes('/api/inbody/ocr')) ocrResponses.push({ status: item.status(), path: new URL(item.url()).pathname }); });
    const ocrRequests = [];
    page.on('request', item => { if (item.url().includes('/api/inbody/ocr')) ocrRequests.push({ method: item.method(), path: new URL(item.url()).pathname }); });
    const dialogs = [];
    page.on('dialog', dialog => { dialogs.push(dialog.type()); dialog.accept(); });
    const failedRequests = [];
    page.on('requestfailed', item => { if (item.url().includes('/api/inbody/ocr')) failedRequests.push({ path: new URL(item.url()).pathname, failure: item.failure()?.errorText }); });
    if (mode === 'inbody-ocr-file-debug') {
      await page.getByRole('button', { name: 'Quét InBody', exact: true }).click();
      await page.waitForTimeout(Number(process.env.GYM_QA_DEBUG_WAIT_MS || 30000));
      console.log(JSON.stringify({ mode, ocrRequests, ocrResponses, failedRequests, dialogs, body: (await page.locator('body').innerText()).slice(-650), findings }));
      await browser.close();
      process.exit(0);
    }
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/inbody/ocr') && response.request().method() === 'POST' && response.status() !== 428, { timeout: 180000 });
    await page.getByRole('button', { name: 'Quét InBody', exact: true }).click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    const data = payload.data || {};
    console.log(JSON.stringify({ mode, status: response.status(), code: payload.code, message: payload.message, metrics: { weight: data.weight, height: data.height, bodyFatPercentage: data.bodyFatPercentage, muscleMass: data.muscleMass }, detectedNamePresent: Boolean(data.detectedCustomerName || data.customerName), findings }));
  } else if (mode === 'roadmap-manual-ai' || mode === 'roadmap-manual') {
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${base}/chuoi-gym/pt/roadmaps`);
    await page.getByRole('button', { name: 'Tạo roadmap', exact: true }).click();
    await page.locator('input[name="customerId"] + .customer-select-trigger').click();
    await page.getByRole('option', { name: /QA Gym - Nguyễn An/ }).click();
    await page.getByRole('button', { name: 'Tạo lộ trình với AI' }).waitFor({ state: 'visible', timeout: 30000 });
    await page.getByRole('textbox', { name: 'Tên roadmap' }).fill('QA Gym - Lộ trình tăng sức bền 8 tuần');
    await page.getByRole('textbox', { name: 'Tên phase 1' }).fill('Làm quen kỹ thuật và tăng sức bền');
    await page.getByRole('button', { name: 'Thêm tuần vào phase 1' }).click();
    await page.getByRole('textbox', { name: 'Trọng tâm tuần 1 phase 1' }).fill('Tập kỹ thuật và cardio nhẹ 3 buổi.');
    const manualPromise = page.waitForResponse(response => response.url().includes('/api/roadmaps') && response.request().method() === 'POST', { timeout: 30000 });
    await page.getByRole('button', { name: 'Lưu roadmap' }).click();
    const manualResponse = await manualPromise;
    const manual = { status: manualResponse.status(), message: (await manualResponse.json().catch(() => ({}))).message };
    console.log(JSON.stringify({ mode, stage: 'manual', manual }));
    if (mode === 'roadmap-manual') {
      console.log(JSON.stringify({ mode, manual, body: (await page.locator('body').innerText()).slice(-1000), findings }));
      await browser.close();
      process.exit(0);
    }
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Tạo roadmap', exact: true }).click();
    await page.locator('input[name="customerId"] + .customer-select-trigger').click();
    await page.getByRole('option', { name: /QA Gym - Trần Bình/ }).click();
    const aiButton = page.getByRole('button', { name: 'Tạo lộ trình với AI' });
    await aiButton.waitFor({ state: 'visible', timeout: 30000 });
    const aiPromise = page.waitForResponse(response => response.url().includes('/api/content-drafts/roadmap') && response.request().method() === 'POST' && response.status() !== 428, { timeout: 120000 });
    await aiButton.click();
    const aiResponse = await aiPromise;
    const aiPayload = await aiResponse.json().catch(() => ({}));
    console.log(JSON.stringify({ mode, manual, ai: { status: aiResponse.status(), message: aiPayload.message, title: aiPayload.data?.title }, body: (await page.locator('body').innerText()).slice(-1800), findings }));
  } else if (mode === 'workout-ai-analyze' || mode === 'workout-ai-full') {
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${base}/chuoi-gym/pt/my-workout-plans`);
    await page.getByRole('button', { name: 'Tạo bằng AI' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tạo giáo án bằng AI' });
    await dialog.locator('input[name="customerId"] + .customer-select-trigger').click();
    await dialog.getByRole('option', { name: /QA Gym - Nguyễn An/ }).click();
    await dialog.getByRole('button', { name: 'Thêm khung giờ Thứ 2' }).click();
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/ai/workout-proposals') && response.request().method() === 'POST' && response.status() !== 428, { timeout: 120000 });
    await dialog.getByRole('button', { name: 'Phân tích bằng AI' }).click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    const analysis = { status: response.status(), message: payload.message, durationWeeks: payload.data?.durationWeeks, sessionsPerWeek: payload.data?.sessionsPerWeek };
    if (mode === 'workout-ai-analyze') {
      console.log(JSON.stringify({ mode, analysis, body: (await dialog.innerText()).slice(-1500), findings }));
    } else {
      await dialog.getByRole('button', { name: 'Tiếp tục cấu hình' }).click();
      await dialog.getByRole('button', { name: 'Tiếp tục tạo giáo án' }).click();
      const generationPromise = page.waitForResponse(response => response.url().includes('/api/ai/workout-generations') && response.request().method() === 'POST' && response.status() !== 428, { timeout: 120000 });
      await dialog.getByRole('button', { name: 'Tạo giáo án', exact: true }).click();
      const generationResponse = await generationPromise;
      const generationPayload = await generationResponse.json().catch(() => ({}));
      await page.getByRole('button', { name: 'Lưu giáo án' }).waitFor({ timeout: 120000 });
      const savePromise = page.waitForResponse(response => response.url().includes('/api/workout-templates') && response.request().method() === 'POST', { timeout: 30000 });
      await page.getByRole('button', { name: 'Lưu giáo án' }).click();
      const saveResponse = await savePromise;
      const savePayload = await saveResponse.json().catch(() => ({}));
      console.log(JSON.stringify({ mode, analysis, generation: { status: generationResponse.status(), message: generationPayload.message, jobId: generationPayload.data?.id }, save: { status: saveResponse.status(), message: savePayload.message }, body: (await page.locator('body').innerText()).slice(-1700), findings }));
    }
  } else if (mode === 'knowledge-upload') {
    await page.goto(`${base}/chuoi-gym/knowledge`);
    await page.getByRole('button', { name: 'Tài Liệu Tri Thức' }).click();
    await page.getByRole('button', { name: 'Tải lên file tri thức' }).click();
    const fixture = join(output, 'qa-gym-knowledge.txt');
    await writeFile(fixture, 'QA Gym - Tai lieu kiem thu\nHuong dan: tap khoi dong 5 phut, uong nuoc day du, ghi lai tien do sau moi buoi.\nDay la du lieu thu nghiem, khong phai huong dan y te.\n');
    await page.locator('input[type="file"]').setInputFiles(fixture);
    const responses = [];
    page.on('response', response => { if (response.request().method() === 'POST' && response.url().includes('/api/knowledge')) responses.push({ status: response.status(), path: new URL(response.url()).pathname }); });
    await page.getByRole('button', { name: /Bắt đầu Tải lên & Nạp RAG/ }).click();
    await page.waitForTimeout(3000);
    console.log(JSON.stringify({ mode, responses, body: (await page.locator('body').innerText()).slice(-1500), findings }));
  } else if (mode === 'nutrition-meal-ai') {
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${base}/chuoi-gym/pt/nutrition`);
    await page.locator('input[name="customerId"] + .customer-select-trigger').click();
    await page.getByRole('option', { name: /QA Gym - Nguyễn An/ }).click();
    await page.getByText('2. Thiết Kế Thực Đơn', { exact: true }).click();
    await page.getByRole('button', { name: 'Tạo thực đơn mới' }).click();
    await page.getByRole('button', { name: '3 ngày', exact: true }).click();
    const responses = [];
    page.on('response', response => { if (response.url().includes('/api/') && response.request().method() === 'POST' && /nutrition|meal|food/.test(response.url())) responses.push({ status: response.status(), path: new URL(response.url()).pathname }); });
    await page.getByRole('button', { name: 'Sinh thực đơn AI' }).click();
    await page.waitForTimeout(30000);
    console.log(JSON.stringify({ mode, responses, body: (await page.locator('body').innerText()).slice(-2200), findings }));
  } else if (mode === 'transfer') {
    await page.goto(`${base}/chuoi-gym/transfers`);
    await page.getByRole('button', { name: '-- Bấm chọn khách hàng (2 khách) --' }).waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: '-- Bấm chọn khách hàng (2 khách) --' }).click();
    await page.getByText('QA Gym - Trần Bình', { exact: true }).click();
    await page.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.getByRole('combobox', { name: 'Chọn Huấn luyện viên tiếp nhận' }).click();
    await page.getByRole('option', { name: /QA Gym - PT Lan Anh/ }).click();
    await page.getByRole('button', { name: 'Đổi ca tập theo nguyện vọng học viên' }).click();
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/transfers/admin-force-batch') && response.request().method() === 'POST', { timeout: 30000 });
    await page.getByRole('button', { name: 'Xác nhận điều chuyển ngay' }).click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    await page.waitForTimeout(800);
    console.log(JSON.stringify({ mode, status: response.status(), message: payload.message, transferredCount: payload.data?.transferredCount, body: (await page.locator('body').innerText()).slice(-1200), findings }));
  } else if (mode === 'assign-workout') {
    await page.goto(`${base}/chuoi-gym/pt/customers`);
    await page.getByRole('button', { name: 'Chi tiết' }).first().click();
    await page.getByRole('button', { name: 'Giáo án', exact: true }).click();
    await page.getByRole('button', { name: 'Gán giáo án' }).click();
    const dialog = page.getByRole('dialog', { name: 'Chọn giáo án mẫu' });
    await dialog.getByRole('button', { name: /QA Gym - Nguyễn An: Cardio Endurance Beginner/ }).click();
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/customers/') && response.url().includes('/workout-plans/assign') && response.request().method() === 'POST', { timeout: 30000 });
    await dialog.getByRole('button', { name: 'Xác nhận gán' }).click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    console.log(JSON.stringify({ mode, status: response.status(), message: payload.message, body: (await page.locator('body').innerText()).slice(-900), findings }));
  } else if (mode === 'progress-session') {
    await page.goto(`${base}/chuoi-gym/pt/progress`);
    await page.getByRole('button', { name: /Ghi nhận buổi tập QA Gym - Nguyễn An/ }).click();
    const form = page.getByRole('form', { name: 'Ghi nhận buổi tập' });
    await form.waitFor({ timeout: 30000 });
    await form.getByRole('textbox', { name: 'Giờ ghi nhận' }).fill('10:30');
    await form.getByRole('spinbutton', { name: 'Treadmill Walk thời lượng (phút)' }).fill('30');
    await form.getByRole('spinbutton', { name: 'Treadmill Walk quãng đường (km)' }).fill('2.5');
    await form.getByRole('spinbutton', { name: 'Plank Hold thời lượng (phút)' }).fill('10');
    await form.getByRole('spinbutton', { name: 'Cân nặng (kg)' }).fill('68.2');
    await form.getByRole('spinbutton', { name: 'Tỷ lệ mỡ (%)' }).fill('18.4');
    await form.getByRole('textbox', { name: 'Cảm nhận sau buổi tập' }).fill('QA Gym: hoàn thành buổi tập mẫu.');
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/workout-sessions') && response.request().method() === 'POST', { timeout: 30000 });
    await page.getByRole('button', { name: 'Hoàn tất buổi tập' }).click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    console.log(JSON.stringify({ mode, status: response.status(), message: payload.message, requestExerciseResults: JSON.parse(response.request().postData() || '{}').exerciseResults, body: (await page.locator('body').innerText()).slice(-900), findings }));
  } else if (mode === 'customer-account') {
    await page.goto(`${base}/chuoi-gym/pt/customers`);
    await page.getByRole('button', { name: 'Chi tiết' }).first().click();
    await page.getByRole('button', { name: 'Cấp tài khoản' }).first().click();
    await page.locator('input[name="customerUsername"]').fill('qa_gym_customer_20261121');
    if (!process.env.GYM_QA_SAMPLE_PASSWORD) throw new Error('GYM_QA_SAMPLE_PASSWORD is required when creating QA accounts.');
    await page.locator('input[name="customerPassword"]').fill(process.env.GYM_QA_SAMPLE_PASSWORD);
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/customers/') && response.url().endsWith('/account') && response.request().method() === 'POST', { timeout: 30000 });
    await page.getByRole('button', { name: 'Cấp tài khoản', exact: true }).last().click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    console.log(JSON.stringify({ mode, status: response.status(), message: payload.message, body: (await page.locator('body').innerText()).slice(-700), findings }));
  } else if (mode === 'customer-security') {
    await page.goto(`${base}/quan-ly-chuoi-gym`);
    const frame = page.frameLocator('iframe[title="Quản lý phòng Gym"]');
    const pages = [];
    for (const label of ['Hành trình', 'Giáo án', 'Dinh dưỡng', 'Lộ trình', 'Chỉ số', 'Lịch tập', 'Tiến độ']) {
      await frame.getByRole('link', { name: label, exact: true }).click();
      await page.waitForTimeout(600);
      const gymFrame = page.frames().find(item => item.url().includes('/chuoi-gym/'));
      pages.push({ label, url: gymFrame?.url(), text: (await gymFrame?.locator('body').innerText().catch(() => ''))?.slice(-160) });
    }
    await page.goto(`${base}/chuoi-gym/management/trainers`);
    await page.waitForTimeout(1000);
    console.log(JSON.stringify({ mode, pages, adminAttempt: { url: page.url(), body: (await page.locator('body').innerText()).slice(-700) }, findings }));
  } else if (mode === 'pt-edit-customer') {
    await page.goto(`${base}/chuoi-gym/pt/customers`);
    await page.getByRole('button', { name: 'Chi tiết' }).first().click();
    await page.getByRole('button', { name: 'Sửa thông tin' }).click();
    await page.locator('textarea[name="customerInternalNotes"]').fill('QA Gym: khách thử nghiệm đã có giáo án và buổi tập mẫu.');
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/customers/') && response.request().method() === 'PATCH', { timeout: 30000 });
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    await page.reload();
    await page.getByRole('button', { name: 'Chi tiết' }).first().click();
    console.log(JSON.stringify({ mode, status: response.status(), message: payload.message, noteVisible: (await page.locator('body').innerText()).includes('QA Gym: khách thử nghiệm đã có giáo án'), findings }));
  } else if (mode === 'nutrition-logs' || mode === 'nutrition-activity') {
    await page.goto(`${base}/chuoi-gym/pt/nutrition`);
    await page.locator('input[name="customerId"] + .customer-select-trigger').click();
    await page.getByRole('option', { name: /QA Gym - Nguyễn An/ }).click();
    await page.getByText('5. Nhật Ký Calo In / Out', { exact: true }).click();
    const results = [];
    for (const item of (mode === 'nutrition-activity' ? [
      { type: 'ACTIVITY', name: 'QA Gym - Đi bộ 30 phút', calories: '150' },
    ] : [
      { type: 'FOOD', name: 'QA Gym - Bữa sáng mẫu', calories: '420' },
      { type: 'ACTIVITY', name: 'QA Gym - Đi bộ 30 phút', calories: '150' },
    ])) {
      await page.getByRole('button', { name: item.type === 'FOOD' ? 'Món Ăn (Calo Nạp Vào)' : 'Vận Động (Calo Tiêu Hao)' }).click();
      await page.getByRole('textbox', { name: 'Tên món hoặc hoạt động' }).fill(item.name);
      await page.getByRole('spinbutton', { name: 'Calories nhật ký' }).fill(item.calories);
      if (item.type === 'ACTIVITY') await page.getByPlaceholder('VD: 45 phút').fill('30');
      const responsePromise = page.waitForResponse(response => response.url().includes('/api/nutrition/logs') && response.request().method() === 'POST', { timeout: 30000 });
      await page.getByRole('button', { name: 'Lưu nhật ký' }).click();
      const response = await responsePromise;
      results.push({ type: item.type, status: response.status(), message: (await response.json().catch(() => ({}))).message });
    }
    await page.reload();
    console.log(JSON.stringify({ mode, results, findings }));
  } else if (mode === 'notification-read') {
    await page.goto(`${base}/chuoi-gym/notifications`);
    await page.getByRole('button', { name: /QA Gym - Thông báo mẫu 1/ }).waitFor();
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/notifications/') && response.url().endsWith('/read') && response.request().method() === 'PATCH', { timeout: 30000 });
    await page.getByRole('button', { name: /QA Gym - Thông báo mẫu 1/ }).click();
    const response = await responsePromise;
    await page.reload();
    await page.getByText('1 chưa đọc').waitFor({ timeout: 20000 });
    console.log(JSON.stringify({ mode, status: response.status(), oneUnreadVisible: true, findings }));
  } else if (mode === 'exercise-manual') {
    await page.goto(`${base}/chuoi-gym/pt/my-workout-plans?tab=exercises`);
    const name = 'QA Gym - Plank Knee Drive';
    await page.getByRole('button', { name: 'Tạo bài tập' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tạo bài tập' });
    await dialog.getByRole('textbox', { name: 'Tên bài tập' }).fill(name);
    await dialog.getByRole('combobox', { name: 'Cách ghi nhận' }).click();
    await page.getByRole('option', { name: 'Trọng lượng cơ thể' }).click();
    await dialog.getByRole('textbox', { name: 'Kỹ thuật' }).fill('Chống tay, giữ lưng thẳng, kéo gối luân phiên về phía ngực.');
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/exercises') && response.request().method() === 'POST', { timeout: 30000 });
    await dialog.getByRole('button', { name: 'Lưu bài tập' }).click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    await page.getByText(name, { exact: true }).waitFor({ timeout: 20000 });
    console.log(JSON.stringify({ mode, status: response.status(), message: payload.message, visible: true, findings }));
  } else if (mode === 'exercise-ai') {
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${base}/chuoi-gym/pt/my-workout-plans?tab=exercises`);
    await page.getByRole('button', { name: 'Tạo bằng AI' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tạo bài tập bằng AI' });
    await dialog.getByRole('textbox', { name: 'Yêu cầu tạo bài tập' }).fill('Tạo 1 bài tập kéo lưng với dây kháng lực cho người mới. Tên bài tập bằng tiếng Anh, khác các bài đã có trong thư viện.');
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/ai/exercise-generations') && response.request().method() === 'POST' && response.status() !== 428, { timeout: 120000 });
    await dialog.getByRole('button', { name: 'Tạo bản nháp' }).click();
    const response = await responsePromise;
    const payload = await response.json().catch(() => ({}));
    const draftCount = payload.data?.drafts?.length || 0;
    let save;
    if (response.ok() && draftCount) {
      const saveButton = dialog.getByRole('button', { name: /Lưu \d+ bài tập/ });
      await saveButton.waitFor({ timeout: 30000 });
      const savePromise = page.waitForResponse(item => item.url().includes('/api/exercises/bulk') && item.request().method() === 'POST', { timeout: 30000 });
      await saveButton.click();
      const savedResponse = await savePromise;
      save = { status: savedResponse.status(), message: (await savedResponse.json().catch(() => ({}))).message };
    }
    console.log(JSON.stringify({ mode, generation: { status: response.status(), message: payload.message, draftCount }, save, body: (await page.locator('body').innerText()).slice(-700), findings }));
  } else {
    throw new Error(`Unknown mode: ${mode}`);
  }
} finally {
  await browser.close();
}
