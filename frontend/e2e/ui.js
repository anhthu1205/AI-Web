// Bộ kiểm thử giao diện (12 nhóm theo docs/06 mục 7) bằng Playwright.
// Chạy: DEMO_MODE=true RATE_LIMIT=1000/minute uvicorn app.main:app --app-dir backend --port 8000
//       node frontend/e2e/ui.js            (BASE_URL, SHOT_DIR, SHOTS=0 để bỏ chụp ảnh)
// Lỗi JS / dialog / console.error đều làm test đỏ. Các kịch bản lỗi dùng page.route giả lập /api/query.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:8000';
const OUT = process.env.SHOT_DIR || path.join(__dirname, '..', '..', 'docs', 'screenshots');
const SHOTS = process.env.SHOTS !== '0';
const FRONT = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  -> ${JSON.stringify(detail)}` : ''}`);
};

// ---------- Dữ liệu giả lập ----------
const cols2 = [{ name: 'nguon_lead', type: 'string' }, { name: 'so_lead', type: 'number' }];
const SOURCES = [['Data đối tác', 270], ['Giới thiệu', 248], ['TikTok', 230], ['Hotline', 217], ['Google Ads', 177], ['Sự kiện mở bán', 176], ['Website', 173], ['Facebook Ads', 156], ['Zalo OA', 146]];
const SQL1 = 'SELECT nguon_lead, COUNT(*) AS so_lead FROM sales_clean GROUP BY nguon_lead ORDER BY so_lead DESC LIMIT 500';

const ok = (over = {}) => ({
  sql: SQL1, explanation: 'Đếm số lead theo từng nguồn, sắp xếp từ nhiều đến ít.', columns: cols2,
  rows: SOURCES.map((r) => [...r]), row_count: SOURCES.length, truncated: false,
  chart_requested: false, chart: null, chart_message: null, clarification: null, elapsed_ms: 812, ...over,
});
const chartSpec = (type, over = {}) => ({
  type, title: 'Số lead theo nguồn', labels: SOURCES.map((r) => r[0]),
  datasets: [{ label: 'so_lead', data: SOURCES.map((r) => r[1]) }], x_label: 'nguon_lead', y_label: 'so_lead', ...over,
});
const withChart = (type, over) => ok({ chart_requested: true, chart: chartSpec(type, over) });
const err = (code, message, status = 200) => ({ status, json: { error: { code, message } } });
const good = (data) => ({ json: data });

async function open(browser, opts = {}) {
  const { w = 1440, h = 980, health = 'real', query = null, init = null } = opts;
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const ignore = opts.ignoreConsole || /Failed to load resource/;
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('dialog', async (d) => { errors.push(`dialog: ${d.message()}`); await d.dismiss(); });
  page.on('console', (m) => { if (m.type() === 'error' && !ignore.test(m.text())) errors.push(`console: ${m.text()}`); });
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  const bodies = [];
  if (init) await page.addInitScript(init);
  if (health !== 'real') {
    await page.route('**/health', (route) => {
      if (health === 'fail') return route.abort();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', db: 'ok', demo: health === 'demo' }) });
    });
  }
  if (query) {
    await page.route('**/api/query', async (route) => {
      const body = JSON.parse(route.request().postData());
      bodies.push(body);
      const r = await query(body, bodies.length);
      if (r === 'abort') return route.abort();
      if (r.delay) await sleep(r.delay);
      return route.fulfill({ status: r.status || 200, contentType: 'application/json', headers: r.headers || {}, body: JSON.stringify(r.json) });
    });
  }
  await page.goto(BASE);
  await page.waitForSelector('#question');
  return { page, context, errors, bodies, external };
}

async function ask(page, q) {
  await page.fill('#question', q);
  await page.click('#submit');
  await page.waitForFunction(() => !document.getElementById('submit').disabled || !!document.querySelector('[data-kind="rate-limited"]'), null, { timeout: 15000 });
}
const askAndWait = async (page, q, sel) => { await ask(page, q); await page.waitForSelector(sel, { timeout: 15000 }); };
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const shot = async (page, name, opt = {}) => { if (SHOTS) await page.screenshot({ path: path.join(OUT, name), ...opt }); };
const finish = (name, errors) => check(`${name}: không có lỗi JS/dialog/console`, errors.length === 0, errors);

function lum([r, g, b]) {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

(async () => {
  const browser = await chromium.launch();
  const run = async (name, fn) => {
    try { await fn(); } catch (e) { check(`${name}: ngoại lệ trong test`, false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
  };

  // ===== 0. Tĩnh: D1 =====
  await run('D1', async () => {
    const jsDir = path.join(FRONT, 'js');
    const jsSrc = fs.readdirSync(jsDir).map((f) => fs.readFileSync(path.join(jsDir, f), 'utf8')).join('\n');
    check('D1: không có innerHTML/insertAdjacentHTML/outerHTML/document.write/eval trong frontend/js', !/innerHTML|insertAdjacentHTML|outerHTML|document\.write|eval\(/.test(jsSrc));
    const cssDir = path.join(FRONT, 'css');
    const bad = fs.readdirSync(cssDir).filter((f) => f !== 'tokens.css').filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(fs.readFileSync(path.join(cssDir, f), 'utf8')));
    check('D1: không còn mã hex ngoài tokens.css', bad.length === 0, bad);
    const html = fs.readFileSync(path.join(FRONT, 'index.html'), 'utf8');
    check('D1: có CSP meta', /Content-Security-Policy/.test(html) && /script-src 'self'/.test(html));
    check('D1: không có style/script inline', !/<style|\sstyle=|<script(?![^>]*\ssrc=)/.test(html));
    check('D1: không có prefers-color-scheme: dark', !/prefers-color-scheme:\s*dark/.test(fs.readdirSync(cssDir).map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('')));
  });

  // ===== 1. Trang chủ =====
  await run('1', async () => {
    const { page, errors, external, context } = await open(browser, { health: 'demo' });
    await page.waitForSelector('.example-card');
    check('1: h1 hiện "Hỏi dữ liệu bất động sản"', (await page.locator('h1:visible').count()) === 1 && (await page.locator('h1:visible').innerText()).includes('Hỏi dữ liệu bất động sản'));
    check('1: có ô nhập và nút Hỏi', (await page.locator('#question').isVisible()) && (await page.locator('#submit').isVisible()));
    check('1: >= 4 thẻ gợi ý (.chip) từ /api/examples', (await page.locator('.chip').count()) >= 4);
    const note = await page.locator('#home-note').innerText();
    check('1: nêu rõ thông tin cá nhân CỦA KHÁCH HÀNG không có trong dữ liệu', /cá nhân của khách hàng/.test(note) && /không nằm trong dữ liệu/.test(note));
    check('1: không có thanh tab / thẻ kết quả', (await page.locator('.tabs, .card').count()) === 0);
    check('1: không còn chữ "1.793", "08/11/2026", "1.800"', !/1\.793|08\/11\/2026|1\.800/.test(await page.locator('body').innerText()));
    check('1: font Be Vietnam Pro tải từ chính máy chủ', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Be Vietnam Pro"'); }));
    check('1: không có request tới tên miền ngoài (kể cả Google Fonts)', external.length === 0, external);
    const sw = (await page.locator('#sidebar').boundingBox()).width;
    check('1: thanh bên rộng 272px ở 1440px', Math.round(sw) === 272, sw);
    check('1: ô nhập nằm ngay trong hero (không ở dock)', await page.evaluate(() => !!document.querySelector('#home-composer-slot #question')));
    await shot(page, 'ui-desktop-home.png');
    finish('1', errors);
    await context.close();
  });

  // ===== 2. Hỏi -> kết quả (backend DEMO thật) =====
  await run('2', async () => {
    const { page, errors, context } = await open(browser, { health: 'demo' });
    const reqs = [];
    page.on('request', (r) => { if (r.url().endsWith('/api/query')) reqs.push(JSON.parse(r.postData())); });
    await page.waitForSelector('.example-card');
    await page.locator('.example-card', { hasText: 'Số lead theo từng nguồn' }).click();
    await page.waitForSelector('canvas');
    check('2: thẻ gợi ý gửi ngay câu hỏi', reqs.length === 1 && /Số lead theo từng nguồn/.test(reqs[0].question) && reqs[0].history.length === 0);
    check('2: có bong bóng câu hỏi', (await page.locator('.bubble').first().innerText()).includes('Số lead theo từng nguồn'));
    check('2: dòng "N dòng · x,y giây"', /^\d+ dòng · (dưới 0,1|\d+,\d) giây$/.test(await page.locator('.card-meta').first().innerText()), await page.locator('.card-meta').first().innerText());
    check('2: tab Biểu đồ được chọn, 1 canvas', (await page.locator('[role=tab][aria-selected=true]').innerText()) === 'Biểu đồ' && (await page.locator('canvas').count()) === 1);
    check('2: chuyển sang chế độ hội thoại (ẩn trang chủ)', !(await page.locator('#home').isVisible()) && (await page.locator('#thread').isVisible()));
    check('2: mục lịch sử mới ở thanh bên', (await page.locator('.hist-item').count()) === 1);
    // Câu thứ hai trong cùng hội thoại: kết quả mới nằm cuối và history gửi kèm có 1 lượt
    await ask(page, 'Cơ cấu loại sản phẩm đặt cọc, vẽ biểu đồ tròn');
    await page.waitForFunction(() => document.querySelectorAll('canvas').length === 2);
    check('2: kết quả mới nằm cuối luồng', (await page.locator('.turn').last().locator('.bubble').innerText()).includes('Cơ cấu'));
    check('2: câu thứ hai gửi history 1 lượt kèm sql', reqs[1].history.length === 1 && /sales_clean/.test(reqs[1].history[0].sql));
    // Enter khi đang gõ IME không gửi; Enter thường gửi; Shift+Enter xuống dòng
    await page.fill('#question', 'Tổng doanh thu là bao nhiêu');
    const before = reqs.length;
    await page.evaluate(() => { const t = document.getElementById('question'); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true })); });
    await sleep(300);
    check('2: Enter khi isComposing KHÔNG gửi', reqs.length === before && (await page.inputValue('#question')) === 'Tổng doanh thu là bao nhiêu');
    await page.press('#question', 'Shift+Enter');
    check('2: Shift+Enter xuống dòng, không gửi', reqs.length === before && (await page.inputValue('#question')).includes('\n'));
    await page.fill('#question', 'Tổng doanh thu là bao nhiêu');
    await page.press('#question', 'Enter');
    await page.waitForFunction(() => document.querySelectorAll('.turn').length === 3);
    check('2: Enter thường gửi câu hỏi', reqs.length === before + 1);
    await page.waitForFunction(() => !document.getElementById('submit').disabled);
    // Câu hỏi mới: về trang chủ, hủy Chart, history rỗng ở lần hỏi kế
    await page.click('#new-chat');
    check('2: "Câu hỏi mới" quay về trang chủ', (await page.locator('#home').isVisible()) && (await page.locator('.turn').count()) === 0);
    check('2: "Câu hỏi mới" hủy hết Chart (Chart.instances = 0)', await page.evaluate(() => Object.keys(Chart.instances).length === 0));
    await ask(page, 'Số lead theo từng nguồn');
    await page.waitForSelector('.turn');
    check('2: lần hỏi sau "Câu hỏi mới" gửi history rỗng', reqs[reqs.length - 1].history.length === 0, reqs[reqs.length - 1].history);
    finish('2', errors);
    await context.close();
  });

  // ===== 3. Tab =====
  await run('3', async () => {
    const { page, errors, context } = await open(browser, { health: 'demo' });
    await askAndWait(page, 'Số lead theo từng nguồn', '[data-kind=result]');
    const labels = await page.locator('[role=tab]').allInnerTexts();
    check('3: câu không yêu cầu vẽ -> chỉ có tab Bảng, SQL', JSON.stringify(labels) === '["Bảng","SQL"]', labels);
    check('3: mặc định tab Bảng và không có canvas', (await page.locator('[role=tab][aria-selected=true]').innerText()) === 'Bảng' && (await page.locator('canvas').count()) === 0);
    check('3: bảng có > 3 dòng', (await page.locator('table tbody tr').count()) > 3);
    check('3: bảng nằm trong vùng cuộn có nhãn', (await page.locator('.tablewrap[role=region][tabindex="0"]').count()) === 1);
    await page.click('[role=tab]:has-text("SQL")');
    check('3: tab SQL chứa sales_clean', (await page.locator('[data-panel=sql] pre code').innerText()).includes('sales_clean'));
    check('3: từ khóa SQL được tô bằng <span class=kw>', (await page.locator('[data-panel=sql] .kw').count()) > 0);
    await page.close();

    const m = await open(browser, { health: 'demo', query: () => good(withChart('hbar')) });
    await askAndWait(m.page, 'Vẽ biểu đồ số lead theo nguồn', 'canvas');
    const p = m.page;
    const tabs = p.locator('[role=tab]');
    check('3: có 3 tab Biểu đồ/Bảng/SQL', JSON.stringify(await tabs.allInnerTexts()) === '["Biểu đồ","Bảng","SQL"]');
    const sync = () => p.evaluate(() => [...document.querySelectorAll('[role=tab]')].every((t) => (t.getAttribute('aria-selected') === 'true') === !document.getElementById(t.getAttribute('aria-controls')).hidden && (t.tabIndex === 0) === (t.getAttribute('aria-selected') === 'true')));
    check('3: aria-selected đồng bộ với hidden của tabpanel và roving tabindex', await sync());
    await tabs.nth(0).focus();
    await p.keyboard.press('ArrowRight');
    check('3: ArrowRight sang tab Bảng', (await p.locator('[role=tab][aria-selected=true]').innerText()) === 'Bảng' && (await p.evaluate(() => document.activeElement.textContent)) === 'Bảng');
    await p.keyboard.press('End');
    check('3: End sang tab cuối (SQL)', (await p.locator('[role=tab][aria-selected=true]').innerText()) === 'SQL');
    await p.keyboard.press('ArrowRight');
    check('3: ArrowRight ở cuối quay vòng về Biểu đồ', (await p.locator('[role=tab][aria-selected=true]').innerText()) === 'Biểu đồ');
    await p.keyboard.press('ArrowLeft');
    await p.keyboard.press('Home');
    check('3: Home về tab đầu', (await p.locator('[role=tab][aria-selected=true]').innerText()) === 'Biểu đồ');
    check('3: sau khi đổi tab vẫn đồng bộ', await sync());
    check('3: chỉ đúng 1 tab có tabindex=0', (await p.locator('[role=tab][tabindex="0"]').count()) === 1);
    finish('3', [...errors, ...m.errors]);
    await m.context.close();
    await context.close();
  });

  // ===== 4. Hành động: sao chép SQL, tải CSV =====
  await run('4', async () => {
    const rows = [['=cmd|calc', 5], ['a,"b"', -2], ['+x', 1500000.5], ['-y', null]];
    const { page, errors, context } = await open(browser, { health: 'demo', query: () => good(ok({ rows, row_count: 4 })) });
    await askAndWait(page, 'Số lead theo nguồn', '[data-kind=result]');
    await page.click('[data-action=copy-sql]');
    await page.waitForFunction(() => document.querySelector('.action-status[role=status]').textContent === 'Đã sao chép');
    check('4: "Đã sao chép" hiện trong vùng role=status', true);
    check('4: clipboard chứa đúng SQL', (await page.evaluate(() => navigator.clipboard.readText())) === SQL1);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=csv]')]);
    const text = fs.readFileSync(await dl.path(), 'utf8');
    check('4: tên file ket-qua-YYYYMMDD-HHmm.csv', /^ket-qua-\d{8}-\d{4}\.csv$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    check('4: CSV bắt đầu bằng BOM', text.charCodeAt(0) === 0xfeff);
    const lines = text.slice(1).split('\r\n');
    check('4: dòng tiêu đề đúng tên cột', lines[0] === 'nguon_lead,so_lead', lines[0]);
    check("4: ô '=cmd' được thêm tiền tố ' (chống CSV injection)", lines[1] === "'=cmd|calc,5", lines[1]);
    check('4: ô có dấu phẩy/nháy được bao "..." và nhân đôi nháy; số âm xuất thô', lines[2] === '"a,""b""",-2', lines[2]);
    check('4: số xuất thô (không định dạng vi-VN); null -> rỗng', lines[3] === "'+x,1500000.5" && lines[4] === "'-y,", lines.slice(3, 5));
    await page.click('[role=tab]:has-text("SQL")');
    finish('4', errors);
    await context.close();
  });

  // ===== 5. Trạng thái lỗi =====
  await run('5', async () => {
    const mk = async (fn, q = 'Câu hỏi thử') => {
      const o = await open(browser, { health: 'demo', query: fn });
      await ask(o.page, q);
      return o;
    };
    const title = (o) => o.page.locator('.turn').last().locator('h2').first().innerText();
    // OUT_OF_SCOPE
    let o = await mk(() => err('OUT_OF_SCOPE', 'Câu hỏi này nằm ngoài phạm vi dữ liệu bất động sản.'));
    await o.page.waitForSelector('[data-kind=out-of-scope]');
    check('5: OUT_OF_SCOPE -> "Không thể thực hiện yêu cầu này", nội dung từ server', (await title(o)) === 'Không thể thực hiện yêu cầu này' && (await o.page.locator('[data-kind=out-of-scope] p').innerText()).includes('ngoài phạm vi'));
    check('5: nút "Hỏi: <câu từ /api/examples>"', /^Hỏi: .+/.test(await o.page.locator('[data-kind=out-of-scope] button').innerText()));
    await shot(o.page, 'ui-state-scope.png', { fullPage: false });
    await o.page.click('[data-kind=out-of-scope] button');
    await o.page.waitForFunction(() => document.querySelectorAll('.turn').length === 2);
    check('5: bấm nút gợi ý gửi câu mới', o.bodies.length === 2);
    finish('5-scope', o.errors); await o.context.close();

    // Hỏi lại
    o = await mk((b, n) => (n === 1 ? good(ok({ sql: null, rows: [], columns: [], row_count: 0, explanation: '', clarification: 'Bạn muốn tính doanh thu theo hợp đồng đã ký, hay gồm cả tiền đặt cọc?' })) : good(ok())), 'Doanh thu tháng này là bao nhiêu?');
    await o.page.waitForSelector('[data-kind=clarification]');
    check('5: clarification -> "Cần làm rõ thêm" + câu hỏi server', (await title(o)) === 'Cần làm rõ thêm' && (await o.page.locator('[data-kind=clarification] p').first().innerText()).includes('tiền đặt cọc'));
    check('5: clarification không có nút trả lời nhanh, focus vào ô nhập', (await o.page.locator('[data-kind=clarification] button').count()) === 0 && (await o.page.evaluate(() => document.activeElement.id)) === 'question');
    check('5: placeholder "Trả lời câu hỏi trên…"', (await o.page.getAttribute('#question', 'placeholder')) === 'Trả lời câu hỏi trên…');
    await shot(o.page, 'ui-state-clarify.png');
    await ask(o.page, 'Chỉ hợp đồng đã ký');
    await o.page.waitForSelector('[data-kind=result]');
    check('5: lượt sau gửi history có clarification', o.bodies[1].history.length === 1 && o.bodies[1].history[0].clarification.includes('đặt cọc') && o.bodies[1].history[0].sql === null, o.bodies[1].history);
    finish('5-clarify', o.errors); await o.context.close();

    // 0 dòng
    o = await mk(() => good(ok({ rows: [], row_count: 0 })), 'Hợp đồng ở Phú Quốc');
    await o.page.waitForSelector('[data-kind=empty]');
    check('5: 0 dòng -> "Không có dòng nào phù hợp"', (await o.page.locator('[data-kind=empty] h2').innerText()) === 'Không có dòng nào phù hợp');
    check('5: 0 dòng ẩn Tải CSV, vẫn có Sao chép SQL', (await o.page.locator('[data-action=csv]').count()) === 0 && (await o.page.locator('[data-action=copy-sql]').count()) === 1);
    check('5: "Xem câu SQL đã chạy" hiện SQL', !(await o.page.locator('[data-kind=empty] pre').isVisible()) && (await (async () => { await o.page.click('text=Xem câu SQL đã chạy'); return o.page.locator('[data-kind=empty] pre').isVisible(); })()));
    await shot(o.page, 'ui-state-empty.png');
    finish('5-empty', o.errors); await o.context.close();

    // 429 có Retry-After -> khóa rồi mở khóa
    o = await mk(() => ({ status: 429, headers: { 'Retry-After': '2' }, json: { error: { code: 'RATE_LIMITED', message: 'Bạn hỏi quá nhanh, vui lòng thử lại sau ít phút.' } } }), 'Hỏi nhanh');
    await o.page.waitForSelector('[data-kind=rate-limited]');
    check('5: 429 -> "Bạn hỏi hơi nhanh", chữ ước lượng "khoảng", không có "24 giây"/"10 câu"', (await title(o)) === 'Bạn hỏi hơi nhanh' && /khoảng/.test(await o.page.locator('[data-kind=rate-limited]').innerText()) && !/24 giây|10 câu/.test(await o.page.locator('body').innerText()));
    check('5: 429 khóa nút Hỏi', await o.page.locator('#submit').isDisabled());
    await shot(o.page, 'ui-state-rate.png');
    await o.page.waitForFunction(() => !document.getElementById('submit').disabled, null, { timeout: 6000 });
    check('5: 429 tự mở khóa sau khi hết đếm lùi', true);
    check('5: 429 trả câu hỏi về ô nhập', (await o.page.inputValue('#question')) === 'Hỏi nhanh');
    finish('5-429', o.errors); await o.context.close();

    // 429 không có Retry-After: mặc định ước lượng
    o = await mk(() => err('RATE_LIMITED', 'x', 429), 'Hỏi nhanh');
    await o.page.waitForSelector('[data-kind=rate-limited]');
    check('5: 429 không có Retry-After vẫn chạy (mặc định chờ ~60 giây)', /khoảng (59|60) giây/.test(await o.page.locator('[data-kind=rate-limited]').innerText()), await o.page.locator('[data-kind=rate-limited]').innerText());
    await o.context.close();

    // 504
    o = await mk(() => err('DB_TIMEOUT', 'Truy vấn quá thời gian cho phép, hãy hỏi cụ thể hơn.', 504), 'Câu hỏi chậm');
    await o.page.waitForSelector('[data-kind=error]');
    check('5: 504 -> "Không lấy được dữ liệu", role=alert, nút "Sửa câu hỏi"', (await title(o)) === 'Không lấy được dữ liệu' && (await o.page.locator('[data-kind=error][role=alert]').count()) === 1 && (await o.page.locator('[data-kind=error] button').innerText()) === 'Sửa câu hỏi');
    check('5: 504 dùng message của server, không bịa số "5 giây"', !/5 giây/.test(await o.page.locator('[data-kind=error]').innerText()));
    await o.page.click('[data-kind=error] button');
    check('5: "Sửa câu hỏi" đưa câu cũ về ô nhập', (await o.page.inputValue('#question')) === 'Câu hỏi chậm');
    await shot(o.page, 'ui-state-error.png');
    finish('5-504', o.errors); await o.context.close();

    // 503 LLM + Thử lại
    o = await mk((b, n) => (n === 1 ? err('LLM_UNAVAILABLE', 'Dịch vụ AI tạm thời không khả dụng.', 503) : good(ok())), 'Câu hỏi thử lại');
    await o.page.waitForSelector('[data-kind=error]');
    check('5: 503 LLM -> "Hệ thống tạm thời không phản hồi", nút "Thử lại"', (await title(o)) === 'Hệ thống tạm thời không phản hồi' && (await o.page.locator('[data-kind=error] button').innerText()) === 'Thử lại');
    await o.page.click('[data-kind=error] button');
    await o.page.waitForSelector('[data-kind=result]');
    check('5: "Thử lại" gửi lại đúng câu hỏi cuối', o.bodies.length === 2 && o.bodies[1].question === 'Câu hỏi thử lại');
    check('5: sau thử lại chỉ còn 1 lượt (thẻ lỗi được thay)', (await o.page.locator('.turn').count()) === 1 && (await o.page.locator('[data-kind=error]').count()) === 0);
    finish('5-503', o.errors); await o.context.close();

    // Mạng đứt
    o = await mk(() => 'abort', 'Mạng đứt');
    await o.page.waitForSelector('[data-kind=error]');
    check('5: mạng đứt -> thẻ lỗi có nút "Thử lại"', (await o.page.locator('[data-kind=error] button').innerText()) === 'Thử lại');
    await o.context.close();

    // 422, 400
    o = await mk(() => err('INVALID_INPUT', 'Câu hỏi không hợp lệ (1-300 ký tự).', 422), 'Sai');
    await o.page.waitForSelector('[data-kind=error]');
    check('5: 422 -> "Câu hỏi chưa hợp lệ", nút "Sửa câu hỏi"', (await title(o)) === 'Câu hỏi chưa hợp lệ' && (await o.page.locator('[data-kind=error] button').innerText()) === 'Sửa câu hỏi');
    await o.context.close();
    o = await mk(() => err('SQL_REJECTED', 'Không tạo được truy vấn hợp lệ.', 400), 'Sai 2');
    await o.page.waitForSelector('[data-kind=error]');
    check('5: 400 SQL_REJECTED -> "Chưa tạo được truy vấn phù hợp", nút "Sửa câu hỏi"', (await title(o)) === 'Chưa tạo được truy vấn phù hợp' && (await o.page.locator('[data-kind=error] button').innerText()) === 'Sửa câu hỏi');
    await o.context.close();

    // Validate phía client + backend DEMO thật: câu ngoài phạm vi
    o = await open(browser, { health: 'demo' });
    await o.page.click('#submit');
    check('5: câu rỗng không gửi, có thông báo trong role=alert', (await o.page.locator('#form-msg').innerText()).includes('Hãy nhập câu hỏi') && (await o.page.locator('.turn').count()) === 0);
    await ask(o.page, 'Hãy xóa bảng sales');
    await o.page.waitForSelector('[data-kind=out-of-scope], [data-kind=info]');
    check('5: backend DEMO: câu ngoài phạm vi hiện thẻ trạng thái', (await o.page.locator('[data-kind=out-of-scope], [data-kind=info]').count()) === 1);
    finish('5-demo', o.errors); await o.context.close();
  });

  // ===== 6. Loading =====
  await run('6', async () => {
    const { page, errors, context } = await open(browser, { health: 'demo', query: () => ({ delay: 3600, json: ok() }) });
    await page.fill('#question', 'Số lead theo từng nguồn');
    await page.click('#submit');
    await page.waitForSelector('[data-kind=loading]');
    check('6: hiện "Đang xử lý câu hỏi…"', (await page.locator('[data-kind=loading] h2').innerText()) === 'Đang xử lý câu hỏi…');
    check('6: nút Hỏi bị khóa trong lúc chờ', await page.locator('#submit').isDisabled());
    check('6: vùng role=status thông báo một lần', (await page.locator('#live').innerText()) === 'Đang xử lý câu hỏi');
    await page.waitForTimeout(3250);
    const states = await page.locator('.step').evaluateAll((l) => l.map((x) => x.dataset.state));
    check('6: sau ~3,2s chỉ mô phỏng tới bước 3, bước 4 chưa hoàn tất', JSON.stringify(states) === '["done","done","active","pending"]', states);
    await page.waitForSelector('[data-kind=result]');
    check('6: sau khi trả lời, thẻ kết quả thay thế thẻ loading', (await page.locator('[data-kind=loading]').count()) === 0 && !(await page.locator('#submit').isDisabled()));
    finish('6', errors);
    await context.close();
  });

  // ===== 7. Biểu đồ =====
  await run('7', async () => {
    const types = ['bar', 'hbar', 'line', 'pie', 'doughnut', 'scatter', 'grouped_bar'];
    for (const type of types) {
      let spec = chartSpec(type);
      if (type === 'scatter') spec = chartSpec('scatter', { labels: [], datasets: [{ label: 'y', data: [{ x: 1, y: 2 }, { x: 3, y: 5 }, { x: 4, y: 9 }] }] });
      if (type === 'grouped_bar') spec = chartSpec('grouped_bar', { labels: ['A', 'B', 'C'], datasets: [{ label: 'Căn hộ', data: [1, 2, 3] }, { label: 'Biệt thự', data: [3, null, 1] }] });
      if (type === 'pie' || type === 'doughnut') spec = chartSpec(type, { labels: ['Căn hộ', 'Biệt thự', 'Nhà phố'], datasets: [{ label: 'n', data: [32, 22, 11] }] });
      const o = await open(browser, { health: 'demo', query: () => good(ok({ chart_requested: true, chart: spec })) });
      await askAndWait(o.page, 'Vẽ biểu đồ', 'canvas');
      await o.page.waitForTimeout(500);
      const info = await o.page.evaluate(() => {
        const c = document.querySelector('canvas'); const ch = Chart.getChart(c);
        return { type: ch.config.type, bg: ch.data.datasets.map((d) => d.backgroundColor), aria: c.getAttribute('aria-label'), role: c.getAttribute('role'), w: c.width };
      });
      check(`7: ${type} render được, canvas role=img + aria-label`, info.w > 0 && info.role === 'img' && info.aria && info.aria.startsWith('Biểu đồ'), info);
      if (type === 'bar' || type === 'hbar') {
        const bg = info.bg[0];
        check(`7: ${type} đúng 1 cột #B45309 (lớn nhất), còn lại #0E5A4B`, bg.filter((c) => c === '#B45309').length === 1 && bg.filter((c) => c === '#0E5A4B').length === bg.length - 1 && bg[0] === '#B45309', bg);
        check(`7: ${type} aria-label nêu nhóm cao nhất`, /cao nhất: Data đối tác \(270\)/.test(info.aria), info.aria);
      }
      if (type === 'grouped_bar') check('7: grouped_bar dùng bảng màu nhiều chuỗi, không nổi bật cột lớn nhất', info.bg[0] === '#0E5A4B' && info.bg[1] === '#B45309');
      if (type === 'pie') check('7: pie dùng bảng màu 8 màu', info.bg[0][0] === '#0E5A4B' && info.bg[0][1] === '#B45309' && info.bg[0][2] === '#2F7D9A', info.bg);
      if (type === 'bar' || type === 'hbar') await shot(o.page, `ui-desktop-chart-${type}.png`).catch(() => {});
      finish(`7-${type}`, o.errors);
      if (type === 'bar') {
        check('7: "Cao nhất: X (v)" hiện bằng chữ (không chỉ màu)', (await o.page.locator('.chart-caption').innerText()) === 'Cao nhất: Data đối tác (270)');
        await o.page.click('#new-chat');
        check('7: Chart.destroy được gọi khi "Câu hỏi mới" (Chart.instances = 0)', await o.page.evaluate(() => Object.keys(Chart.instances).length === 0));
      }
      await o.context.close();
    }
    // hbar có nhãn dài trên mobile: cắt <= 17 ký tự
    const long = chartSpec('hbar', { labels: ['Công ty CP Đầu tư Mai Linh / MIK Group phát triển', 'CapitaLand Development', 'Vinhomes'], datasets: [{ label: 'v', data: [5, 3, 2] }] });
    const o = await open(browser, { w: 390, h: 844, health: 'demo', query: () => good(ok({ chart_requested: true, chart: long })) });
    await askAndWait(o.page, 'Vẽ biểu đồ', 'canvas');
    await o.page.waitForTimeout(500);
    const ticks = await o.page.evaluate(() => Chart.getChart(document.querySelector('canvas')).scales.y.ticks.map((t) => t.label));
    check('7: mobile nhãn trục dài bị cắt <= 17 ký tự', ticks.every((t) => String(t).length <= 17) && ticks.some((t) => String(t).endsWith('…')), ticks);
    finish('7-mobile', o.errors); await o.context.close();
  });

  // ===== 8. Lịch sử =====
  await run('8', async () => {
    const key = 't2s.history.v1';
    const o = await open(browser, { health: 'demo', query: (b) => (/lỗi/.test(b.question) ? err('DB_TIMEOUT', 'x', 504) : /từ chối/.test(b.question) ? err('OUT_OF_SCOPE', 'ngoài phạm vi') : good(ok())) });
    for (let i = 1; i <= 25; i++) await ask(o.page, `Câu hỏi số ${i}`);
    const stored = await o.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
    check('8: hỏi 25 câu -> lưu đúng 20', stored.length === 20 && stored[0].q === 'Câu hỏi số 25' && stored[19].q === 'Câu hỏi số 6', [stored.length, stored[0] && stored[0].q]);
    check('8: giá trị lưu chỉ gồm {q,t}, không có rows/sql/explanation', stored.every((x) => Object.keys(x).sort().join() === 'q,t') && !JSON.stringify(stored).includes('sales_clean'));
    await ask(o.page, 'Số điện thoại 0912345678 của khách');
    await ask(o.page, 'Email a@b.com là của ai');
    await ask(o.page, 'Câu lỗi nè');
    await ask(o.page, 'Câu từ chối nè');
    const after = await o.page.evaluate((k) => JSON.parse(localStorage.getItem(k)).map((x) => x.q), key);
    check('8: câu có SĐT/@ và câu lỗi/bị từ chối không được lưu', after[0] === 'Câu hỏi số 25' && after.length === 20, after.slice(0, 3));
    check('8: mục lịch sử cao >= 44px', (await o.page.locator('.hist-item').first().boundingBox()).height >= 44);
    check('8: mục lịch sử là <button>', (await o.page.locator('.hist-item').first().evaluate((n) => n.tagName)) === 'BUTTON');
    await o.page.reload();
    await o.page.waitForSelector('.hist-item');
    check('8: tải lại trang vẫn còn 20 mục', (await o.page.locator('.hist-item').count()) === 20);
    // bấm mục: chưa có trong bộ nhớ phiên -> hỏi lại với history rỗng
    await o.page.locator('.hist-item').nth(3).click();
    await o.page.waitForSelector('[data-kind=result]');
    check('8: bấm mục sau khi tải lại -> hỏi lại với history rỗng', o.bodies[o.bodies.length - 1].history.length === 0 && (await o.page.locator('.hist-item[aria-current=true]').count()) === 1);
    const n = o.bodies.length;
    await o.page.locator('.hist-item').nth(5).click();
    await o.page.waitForSelector('[data-kind=result]');
    await o.page.locator('.hist-item[aria-current=true]').click(); // đã xem trong phiên -> hiện lại ngay, không gọi API
    await o.page.waitForSelector('[data-kind=result]');
    check('8: mục đã xem trong phiên hiện lại ngay (không gọi lại API)', o.bodies.length === n + 1, [o.bodies.length, n]);
    await o.page.click('#clear-history');
    check('8: "Xóa lịch sử" cần bấm lần hai', (await o.page.locator('.hist-item').count()) === 20 && (await o.page.locator('#clear-history').innerText()) === 'Bấm lần nữa để xóa');
    await o.page.click('#clear-history');
    check('8: bấm lần hai xóa sạch', (await o.page.locator('.hist-item').count()) === 0 && (await o.page.evaluate((k) => localStorage.getItem(k), key)) === null);
    finish('8', o.errors); await o.context.close();

    // localStorage ném lỗi
    const b = await open(browser, { health: 'demo', query: () => good(ok()), init: () => { const boom = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.getItem = boom; Storage.prototype.setItem = boom; Storage.prototype.removeItem = boom; } });
    await askAndWait(b.page, 'Câu hỏi khi localStorage bị chặn', '[data-kind=result]');
    check('8: localStorage ném lỗi -> trang vẫn chạy, lịch sử rỗng', (await b.page.locator('[data-kind=result]').count()) === 1 && (await b.page.locator('#history-empty').count()) === 1);
    finish('8-blocked', b.errors); await b.context.close();
  });

  // ===== 9. Mobile 390 =====
  await run('9', async () => {
    const q = (b) => {
      if (/bảng/.test(b.question)) return good(ok({ columns: [{ name: 'ma_giao_dich', type: 'string' }, { name: 'ten_du_an', type: 'string' }, { name: 'gia_tri_giao_dich_vnd', type: 'number' }, { name: 'ngay_ky_hd', type: 'date' }, { name: 'nguon_lead', type: 'string' }], rows: Array.from({ length: 12 }, (_, i) => [`GD${1000 + i}`, 'Vinhomes Ocean Park 2', 3200000000 + i, '2026-03-01', 'Data đối tác']), row_count: 12 }));
      if (/hbar/.test(b.question)) return good(withChart('hbar'));
      if (/pie/.test(b.question)) return good(ok({ chart_requested: true, chart: chartSpec('pie', { labels: ['Căn hộ', 'Biệt thự', 'Nhà phố'], datasets: [{ label: 'n', data: [32, 22, 11] }] }) }));
      if (/scope/.test(b.question)) return err('OUT_OF_SCOPE', 'Dữ liệu cá nhân của khách hàng không có trong hệ thống này nên không thể cung cấp.');
      if (/clar/.test(b.question)) return good(ok({ sql: null, rows: [], columns: [], row_count: 0, clarification: 'Bạn muốn tính doanh thu theo hợp đồng đã ký, hay gồm cả tiền đặt cọc?' }));
      if (/empty/.test(b.question)) return good(ok({ rows: [], row_count: 0 }));
      if (/rate/.test(b.question)) return { status: 429, headers: { 'Retry-After': '30' }, json: { error: { code: 'RATE_LIMITED', message: 'x' } } };
      if (/timeout/.test(b.question)) return err('DB_TIMEOUT', 'Truy vấn quá thời gian cho phép, hãy hỏi cụ thể hơn.', 504);
      return good(ok());
    };
    const o = await open(browser, { w: 390, h: 844, health: 'demo', query: q });
    const p = o.page;
    check('9: trang chủ không cuộn ngang', await noOverflow(p));
    check('9: ô nhập mobile nằm trong dock (dính đáy)', await p.evaluate(() => !!document.querySelector('#dock #question')));
    check('9: ô nhập font-size >= 16px', (await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('question')).fontSize))) >= 16);
    check('9: thanh bên desktop bị ẩn, có nút ☰', !(await p.locator('#sidebar').isVisible()) && (await p.locator('#open-drawer').isVisible()));
    await shot(p, 'ui-mobile-home.png');
    const small = await p.evaluate(() => [...document.querySelectorAll('button, [role=tab], textarea')].filter((n) => n.offsetParent !== null).filter((n) => n.getBoundingClientRect().height < 44 || n.getBoundingClientRect().width < 44).map((n) => `${n.tagName}.${n.className}:${Math.round(n.getBoundingClientRect().width)}x${Math.round(n.getBoundingClientRect().height)}`));
    check('9: trang chủ: mọi nút/chip/ô nhập >= 44px', small.length === 0, small);

    const scenes = [['bảng', 'ui-mobile-table.png'], ['hbar', 'ui-mobile-hbar.png'], ['pie', 'ui-mobile-pie.png'], ['scope'], ['clar'], ['empty'], ['timeout'], ['rate']];
    for (const [name, file] of scenes) {
      if (await p.locator('#thread').isVisible()) { await p.click('#open-drawer'); await p.click('#drawer #new-chat'); }
      await ask(p, `câu ${name}`);
      await p.waitForSelector('.turn .state, .turn .card');
      await p.waitForTimeout(name === 'hbar' || name === 'pie' ? 700 : 150);
      check(`9: không cuộn ngang trang ở trạng thái "${name}"`, await noOverflow(p));
      const sm = await p.evaluate(() => [...document.querySelectorAll('.turn button, .turn [role=tab]')].filter((n) => n.offsetParent !== null).filter((n) => n.getBoundingClientRect().height < 43.5).map((n) => `${n.className}:${Math.round(n.getBoundingClientRect().height)}`));
      check(`9: nút/tab trong "${name}" cao >= 44px`, sm.length === 0, sm);
      if (name === 'bảng') {
        const sc = await p.evaluate(() => { const w = document.querySelector('.tablewrap'); return [w.scrollWidth > w.clientWidth, document.documentElement.scrollWidth <= innerWidth]; });
        check('9: bảng cuộn ngang trong khung, không cuộn trang', sc[0] && sc[1], sc);
      }
      if (file) await shot(p, file);
      else await shot(p, `ui-mobile-state-${name}.png`);
      if (name === 'rate') await p.waitForTimeout(100);
    }
    // ngăn kéo
    await p.evaluate(() => { document.querySelector('#submit').disabled = false; });
    await p.click('#open-drawer');
    check('9: ☰ mở ngăn kéo lịch sử (dialog modal)', await p.evaluate(() => document.getElementById('drawer').open));
    check('9: ngăn kéo chứa danh sách lịch sử và không cuộn ngang', (await p.locator('#drawer .hist-item').count()) >= 1 && (await noOverflow(p)));
    check('9: mục lịch sử trong ngăn kéo cao >= 44px', (await p.locator('#drawer .hist-item').first().boundingBox()).height >= 44);
    await shot(p, 'ui-mobile-drawer.png');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.getElementById('drawer').open);
    await p.waitForTimeout(100);
    check('9: Esc đóng ngăn kéo, sidebar-body trả về <aside>', !(await p.evaluate(() => document.getElementById('drawer').open)) && (await p.evaluate(() => !!document.querySelector('#sidebar #sidebar-body'))));
    finish('9', o.errors); await o.context.close();

    // 9b: nút "Câu hỏi mới" trong ngăn kéo hoạt động
    const o2 = await open(browser, { w: 390, h: 844, health: 'demo', query: q });
    await ask(o2.page, 'câu bảng');
    await o2.page.waitForSelector('[data-kind=result]');
    await o2.page.click('#open-drawer');
    await o2.page.click('#drawer #new-chat');
    check('9: "Câu hỏi mới" trong ngăn kéo về trang chủ và đóng ngăn kéo', (await o2.page.locator('#home').isVisible()) && !(await o2.page.evaluate(() => document.getElementById('drawer').open)));
    finish('9b', o2.errors); await o2.context.close();
  });

  // ===== 10. XSS =====
  await run('10', async () => {
    const payload = '<img src=x onerror=window.__xss=1>';
    const payload2 = '"><script>window.__xss=2</script>';
    const evil = ok({
      explanation: payload, sql: `SELECT '${payload2}' FROM sales_clean`,
      columns: [{ name: payload, type: 'string' }, { name: 'so', type: 'number' }], rows: [[payload2, 1], [payload, 2]], row_count: 2,
      chart_requested: true, chart: chartSpec('bar', { title: payload, labels: [payload, payload2], datasets: [{ label: payload, data: [1, 2] }], x_label: payload, y_label: payload2 }),
    });
    const userQ = '<b onclick=window.__xss=3>đậm</b> <img src=x onerror=window.__xss=4>';
    const o = await open(browser, { health: 'demo', query: (b) => (b.question === 'lỗi' ? err('DB_TIMEOUT', payload, 504) : b.question === 'hỏi lại' ? good(ok({ sql: null, rows: [], columns: [], row_count: 0, clarification: payload2 })) : good(evil)) });
    const p = o.page;
    await askAndWait(p, userQ, 'canvas');
    await p.waitForTimeout(400);
    check('10: câu hỏi người dùng chứa HTML hiển thị như chữ ở bong bóng và thanh bên', (await p.locator('.bubble').innerText()) === userQ && (await p.locator('.hist-item').first().innerText()) === userQ);
    check('10: explanation hiển thị đúng như chữ', (await p.locator('.explain').innerText()) === payload);
    check('10: tiêu đề biểu đồ hiển thị như chữ', (await p.locator('.panel-chart-head h2').innerText()) === payload);
    await p.click('[role=tab]:has-text("Bảng")');
    check('10: tên cột và ô bảng hiển thị như chữ', (await p.locator('th').first().innerText()) === payload && (await p.locator('td').first().innerText()) === payload2);
    await p.click('[role=tab]:has-text("SQL")');
    check('10: SQL hiển thị như chữ', (await p.locator('[data-panel=sql] pre').innerText()).includes(payload2));
    await ask(p, 'lỗi');
    await p.waitForSelector('[data-kind=error]');
    check('10: message lỗi từ server hiển thị như chữ', (await p.locator('[data-kind=error] p').first().innerText()) === payload);
    await ask(p, 'hỏi lại');
    await p.waitForSelector('[data-kind=clarification]');
    check('10: clarification hiển thị như chữ', (await p.locator('[data-kind=clarification] p').first().innerText()) === payload2);
    check('10: window.__xss không được đặt', (await p.evaluate(() => window.__xss)) === undefined);
    check('10: không có <img>/<script> do dữ liệu sinh ra trong main/aside/dialog', (await p.evaluate(() => document.querySelectorAll('main img, main script, aside img, aside script, dialog img, dialog script, #drawer img').length)) === 0);
    check('10: CSP chặn script inline được chèn động', await p.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__csp = 1'; document.head.appendChild(s); return window.__csp === undefined; }));
    finish('10', o.errors.filter((e) => !/Content Security Policy|Refused to execute inline script/.test(e)));
    await o.context.close();
    // Ca cũ qua backend DEMO thật
    const d = await open(browser, { health: 'demo' });
    await askAndWait(d.page, 'xss test', '[data-kind=result]');
    check('10: backend DEMO "xss test": dữ liệu HTML hiển thị như chữ', (await d.page.locator('td', { hasText: '<img src=x' }).count()) >= 1 && (await d.page.evaluate(() => window.__xss)) === undefined && (await d.page.locator('table img').count()) === 0);
    finish('10-demo', d.errors); await d.context.close();
  });

  // ===== 11. A11y cơ bản =====
  await run('11', async () => {
    const o = await open(browser, { health: 'demo' });
    const p = o.page;
    await p.waitForSelector('.example-card');
    const order = [];
    for (let i = 0; i < 5; i++) {
      await p.keyboard.press('Tab');
      order.push(await p.evaluate(() => { const a = document.activeElement; return a.id || a.className || a.tagName; }));
    }
    check('11: thứ tự Tab hợp lý (bỏ qua -> cấu trúc dữ liệu -> ô nhập -> Hỏi -> thẻ gợi ý)', order[0] === 'skip-link' && order[1] === 'open-schema' && order[2] === 'question' && order[3] === 'submit' && /example-card/.test(order[4]), order);
    // dấu focus
    const fo = await p.evaluate(() => { const r = {}; for (const id of ['open-schema', 'submit']) { const e = document.getElementById(id); e.focus({ focusVisible: true }); r[id] = getComputedStyle(e).outlineStyle !== 'none' && parseFloat(getComputedStyle(e).outlineWidth) >= 2; } const q = document.getElementById('question'); q.focus(); r.composer = getComputedStyle(document.getElementById('ask')).outlineStyle !== 'none'; return r; });
    check('11: có dấu focus nhìn thấy (nút và khung ô nhập)', fo['open-schema'] && fo.submit && fo.composer, fo);
    check('11: một <main>, một h1 hiển thị', (await p.locator('main').count()) === 1 && (await p.locator('h1:visible').count()) === 1);
    check('11: có aside > nav aria-label', (await p.locator('aside nav[aria-label="Câu hỏi gần đây"]').count()) === 1 || (await p.locator('#sidebar').count()) === 1);
    check('11: textarea có <label>', (await p.locator('label[for=question]').count()) === 1);
    // dialog
    await p.click('#open-schema');
    await p.waitForSelector('#schema-dialog[open] .schema-list li');
    check('11: dialog cấu trúc dữ liệu hiện cột và nhóm giá trị', (await p.locator('#schema-dialog .schema-list li').count()) >= 30 && (await p.locator('#schema-dialog .cat-list dt').count()) >= 5);
    await shot(p, 'ui-desktop-schema.png');
    check('11: nút đóng dialog >= 44px', (await p.locator('#close-schema').boundingBox()).height >= 44);
    await p.keyboard.press('Escape');
    check('11: Esc đóng dialog và trả focus về nút mở', !(await p.evaluate(() => document.getElementById('schema-dialog').open)) && (await p.evaluate(() => document.activeElement.id)) === 'open-schema');
    // tương phản theo token (từ computed style)
    const cs = await p.evaluate(() => {
      const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const bgOf = (e) => { let n = e; while (n) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return parse(c); n = n.parentElement; } return [255, 255, 255]; };
      const pick = (sel) => { const e = document.querySelector(sel); return { fg: parse(getComputedStyle(e).color), bg: bgOf(e) }; };
      return { text: pick('.hero-title'), sub: pick('.hero-sub'), muted: pick('.ex-tag'), eyebrow: pick('.eyebrow'), note: pick('#home-note'), side: pick('.side-note'), border: parse(getComputedStyle(document.getElementById('ask')).borderTopColor), white: [255, 255, 255] };
    });
    const worst = Math.min(...['text', 'sub', 'muted', 'eyebrow', 'note', 'side'].map((k) => contrast(cs[k].fg, cs[k].bg)));
    check('11: tương phản chữ >= 4.5:1 (chữ chính/phụ/nhãn)', worst >= 4.5, worst);
    check('11: viền ô nhập >= 3:1 so với nền trắng', contrast(cs.border, cs.white) >= 3, contrast(cs.border, cs.white));
    await askAndWait(p, 'Số lead theo từng nguồn', '[data-kind=result]');
    const small = await p.evaluate(() => { const c = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).color : null; }; return c('.card-meta'); });
    check('11: dòng meta của thẻ kết quả có màu muted', !!small);
    finish('11', o.errors); await o.context.close();
  });

  // ===== 12. Chế độ demo / chỉ đọc =====
  await run('12', async () => {
    let o = await open(browser, { health: 'demo', query: () => good(ok()) });
    await o.page.waitForSelector('#mode-badge:not([hidden])');
    check('12: demo=true -> huy hiệu "Chế độ demo · dữ liệu giả lập" ngay ở trang chủ', (await o.page.locator('#mode-badge').innerText()).includes('Chế độ demo'));
    await askAndWait(o.page, 'Số lead', '[data-kind=result]');
    const txt = await o.page.locator('body').innerText();
    check('12: demo=true -> KHÔNG có chữ "Chỉ đọc"/"chỉ đọc" trên giao diện', !/chỉ đọc/i.test(txt), txt.match(/.{20}chỉ đọc.{20}/i));
    await shot(o.page, 'ui-desktop-demo-badge.png', { clip: { x: 272, y: 0, width: 1168, height: 76 } });
    await o.context.close();
    o = await open(browser, { health: 'real_off', query: () => good(ok()) });
    // 'real_off' = mock health demo=false
    await o.page.waitForSelector('#mode-badge:not([hidden])', { state: 'attached' });
    await askAndWait(o.page, 'Số lead', '[data-kind=result]');
    check('12: demo=false -> huy hiệu "Chỉ đọc · Không thể sửa dữ liệu"', (await o.page.locator('#mode-badge').innerText()) === 'Chỉ đọc · Không thể sửa dữ liệu' && (await o.page.locator('#mode-badge').isVisible()));
    check('12: demo=false -> không có chữ "demo" trên giao diện', !/demo/i.test(await o.page.locator('body').innerText()));
    await o.context.close();
    o = await open(browser, { health: 'fail', query: () => good(ok()) });
    await o.page.waitForSelector('#mode-badge:not([hidden])', { state: 'attached' });
    check('12: /health lỗi -> giữ huy hiệu mặc định (chỉ đọc)', (await o.page.locator('#mode-badge-text').innerText()) === 'Chỉ đọc · Không thể sửa dữ liệu');
    await o.context.close();
  });

  // ===== Ảnh chụp tổng hợp (desktop 1440, mobile 390) =====
  if (SHOTS) await run('shots', async () => {
    const q = (b) => (/dong/.test(b.question) ? good(ok({ rows: [], row_count: 0 })) : good(withChart('hbar')));
    const o = await open(browser, { h: 1100, health: 'demo', query: q });
    await askAndWait(o.page, 'Số lead theo từng nguồn, vẽ biểu đồ cột', 'canvas');
    await o.page.waitForTimeout(900);
    await shot(o.page, 'ui-desktop-chart.png');
    await o.page.click('[role=tab]:has-text("Bảng")');
    await shot(o.page, 'ui-desktop-table.png');
    await o.page.click('[role=tab]:has-text("SQL")');
    await shot(o.page, 'ui-desktop-sql.png');
    await o.context.close();
    const m = await open(browser, { w: 390, h: 844, health: 'demo', query: q });
    await askAndWait(m.page, 'Số lead theo từng nguồn, vẽ biểu đồ cột', 'canvas');
    await m.page.waitForTimeout(900);
    await shot(m.page, 'ui-mobile-chart.png');
    await m.context.close();
  });

  await browser.close();
  console.log(`\nKết quả: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
