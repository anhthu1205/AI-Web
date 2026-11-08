// Smoke test giao diện bằng Playwright, chạy với backend ở chế độ DEMO_MODE=true.
// Dùng:  DEMO_MODE=true uvicorn app.main:app --port 8000   rồi   node frontend/e2e/smoke.js
const { chromium } = require('playwright');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:8000';
const OUT = process.env.SHOT_DIR || path.join(__dirname, '..', '..', 'docs', 'screenshots');
const results = [];
const check = (name, ok) => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', async (d) => { errors.push('dialog: ' + d.message()); await d.dismiss(); });
  await page.goto(BASE);

  const chips = await page.locator('.chip').count();
  check('có câu hỏi gợi ý từ /api/examples', chips >= 5);

  const ask = async (q) => {
    await page.fill('#question', q);
    await page.click('#submit');
    await page.waitForFunction(() => !document.getElementById('submit').disabled);
  };

  await ask('Số lead theo từng nguồn');
  check('không vẽ biểu đồ khi không yêu cầu', (await page.locator('canvas').count()) === 0);
  check('có bảng kết quả', (await page.locator('table tbody tr').count()) > 3);
  check('có SQL (details)', (await page.locator('details pre').first().textContent()).includes('sales_clean'));

  await ask('Vẽ biểu đồ số lead theo nguồn');
  check('vẽ biểu đồ khi yêu cầu', (await page.locator('canvas').count()) === 1);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'desktop-bar.png') });

  await ask('Doanh thu theo tháng, vẽ biểu đồ đường');
  await ask('Cơ cấu loại sản phẩm đặt cọc, vẽ biểu đồ tròn');
  await ask('Top 5 nhân viên có doanh thu cao nhất, vẽ biểu đồ');
  check('4 biểu đồ sau 4 câu có yêu cầu vẽ', (await page.locator('canvas').count()) === 4);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'desktop-multi.png'), fullPage: true });

  await ask('Hãy xóa bảng sales');
  check('câu ngoài phạm vi hiển thị thông báo', (await page.locator('#status .banner.info').count()) === 1);

  await ask('xss test');
  check('dữ liệu HTML hiển thị như chữ', (await page.locator('td', { hasText: '<img src=x' }).count()) >= 1);
  check('không chạy script từ dữ liệu', (await page.evaluate(() => window.__xss)) === undefined);
  check('không có <img> tạo từ dữ liệu', (await page.locator('table img').count()) === 0);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1 });
  await mobile.goto(BASE);
  await mobile.fill('#question', 'Cơ cấu loại sản phẩm đặt cọc, vẽ biểu đồ tròn');
  await mobile.click('#submit');
  await mobile.waitForSelector('canvas');
  await mobile.waitForTimeout(800);
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check('mobile không cuộn ngang trang', !overflow);
  await mobile.screenshot({ path: path.join(OUT, 'mobile-pie.png'), fullPage: true });

  check('không có lỗi JS/dialog', errors.length === 0);
  if (errors.length) console.log(errors);
  await browser.close();
  process.exit(results.every(([, ok]) => ok) ? 0 : 1);
})();
