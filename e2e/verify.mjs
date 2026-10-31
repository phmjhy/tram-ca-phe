import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const modulePath = process.argv.find(arg => arg.startsWith('--playwright='))?.slice('--playwright='.length);
const { chromium } = await import(modulePath || process.env.POS_PLAYWRIGHT_MODULE || 'playwright');

// Standalone QA runner. Playwright lives in a disposable directory, not app dependencies.
const base = 'http://127.0.0.1:4175';
const output = new URL('../docs/evidence/', import.meta.url);
await fs.mkdir(output, { recursive: true });
let evidence = { date: new Date().toISOString(), base, browser: '', results: [], errors: [], failures: [], limitations: ['Real iOS/Android virtual keyboard is not emulated by desktop Chrome; BLOCKED.'], screenshots: [] };
if (process.argv.includes('--extra-only')) { evidence = JSON.parse(await fs.readFile(new URL('browser-results.json', output), 'utf8')); evidence.extraRunAt = new Date().toISOString(); evidence.results = evidence.results.filter(r => r.name !== 'Console/page errors and failed requests'); }
let browser;
const write = () => fs.writeFile(new URL('browser-results.json', output), JSON.stringify(evidence, null, 2) + '\n');
async function check(name, fn) {
  try { const detail = await fn(); evidence.results.push({ name, status: 'PASS', detail: detail ?? '' }); console.log('PASS', name); }
  catch (error) { evidence.results.push({ name, status: 'FAIL', detail: error.message }); throw error; }
  finally { await write(); }
}
function monitor(page) {
  page.on('pageerror', e => evidence.errors.push({ type: 'pageerror', message: e.message }));
  page.on('console', msg => { if (msg.type() === 'error') evidence.errors.push({ type: 'console', message: msg.text(), location: msg.location() }); });
  page.on('requestfailed', r => evidence.failures.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400) evidence.failures.push({ url: r.url(), status: r.status() }); });
  page.on('dialog', dialog => dialog.accept());
}
const orders = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('tram_order_v2:')).map(k => JSON.parse(localStorage.getItem(k))));
const money = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
async function count(page, value) { await page.waitForFunction(n => Object.keys(localStorage).filter(k => k.startsWith('tram_order_v2:')).length === n, value); }
async function nav(page, width, label) {
  await page.locator(width <= 700 ? '.mobile-nav' : '.sidebar nav').getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('heading', { name: label, exact: true, level: 1 }).waitFor();
}
async function add(page, name = 'Cà phê đen') { await page.locator('button.product').filter({ has: page.locator('.product-name', { hasText: new RegExp(`^${name}$`) }) }).click(); }
async function save(page, expected) { await page.getByRole('button', { name: 'Lưu đơn hàng', exact: true }).click(); await count(page, expected); await page.getByRole('heading', { name: 'Đơn hàng', level: 1 }).waitFor(); }
async function layout(page, viewport, screen) {
  const dimensions = await page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.inner + 1, `${screen}: body overflow ${JSON.stringify(dimensions)}`);
  if (viewport.width <= 700) {
    const mobile = page.locator('.mobile-nav'); assert.equal(await mobile.isVisible(), true);
    assert.equal(await mobile.getByRole('button').count(), 4);
    if (await mobile.evaluate(el => getComputedStyle(el).position === 'fixed')) {
      for (const button of await mobile.getByRole('button').all()) await unobscured(button);
    }
    const active = mobile.locator('button.active');
    assert.notEqual(await active.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(42, 89, 75)');
    for (const label of await mobile.locator('button span').all()) {
      const height = await label.evaluate(el => el.getBoundingClientRect().height);
      assert.ok(height < 20, `Mobile label wraps into multiple lines: ${height}px`);
    }
  }
  const file = `${viewport.width}x${viewport.height}-${screen}.png`;
  await page.screenshot({ path: new URL(file, output).pathname, fullPage: true }); evidence.screenshots.push(file);
  return dimensions;
}
async function unobscured(locator) {
  await locator.scrollIntoViewIfNeeded();
  const result = await locator.evaluate(el => {
    const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { hit: Boolean(top && (el === top || el.contains(top))), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, height: innerHeight };
  });
  assert.ok(result.hit, `Control covered or offscreen: ${JSON.stringify(result)}`); return result;
}
try {
  browser = await chromium.launch({ executablePath: process.env.POS_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, chromiumSandbox: true });
  evidence.browser = await browser.version();
  if (process.argv.includes('--probe')) {
    const context = await browser.newContext(); const page = await context.newPage(); monitor(page);
    await page.goto(base); await page.locator('.product').first().waitFor();
    await page.waitForTimeout(500); console.log(JSON.stringify({ errors: evidence.errors, failures: evidence.failures }));
    await browser.close(); process.exit(0);
  }
  if (!process.argv.includes('--extra-only')) for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    const prefix = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 700, hasTouch: viewport.width < 700, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    // No persistent user profile or production origin. Each viewport starts from empty storage.
    const page = await context.newPage(); monitor(page);
    await page.goto(base); await page.locator('.product').first().waitFor();
    await check(`${prefix}: empty isolated profile / POS layout`, async () => {
      assert.equal((await orders(page)).length, 0); assert.equal(await page.locator('.channel-grid button').count(), 4);
      assert.ok(await page.evaluate(() => Boolean(navigator.locks))); return layout(page, viewport, 'pos');
    });
    await check(`${prefix}: add/increase/decrease/remove/note/store unpaid`, async () => {
      await add(page); await page.getByRole('button', { name: 'Tăng Cà phê đen', exact: true }).click();
      await page.getByRole('button', { name: 'Giảm Cà phê đen', exact: true }).click();
      await add(page, 'Cà phê sữa'); await page.getByRole('button', { name: 'Giảm Cà phê sữa', exact: true }).click();
      assert.equal(await page.locator('.cart-item').count(), 1); await add(page, 'Cà phê sữa');
      await page.getByLabel('Ghi chú đơn', { exact: true }).fill(`TEST ${prefix} ghi chú`);
      await unobscured(page.getByRole('button', { name: 'Lưu đơn hàng', exact: true }));
      await save(page, 1); const [o] = await orders(page);
      assert.equal(o.channel, 'store'); assert.equal(o.total, 49000); assert.equal(o.paid, false); assert.equal(o.paidAt, null); assert.equal(o.note, `TEST ${prefix} ghi chú`);
    });
    await check(`${prefix}: takeaway order`, async () => {
      await nav(page, viewport.width, 'Bán hàng'); await page.getByRole('button', { name: 'Mang đi', exact: true }).click(); await add(page); await save(page, 2);
      assert.equal((await orders(page)).filter(o => o.channel === 'takeaway').length, 1);
    });
    await check(`${prefix}: App manual and defaults unpaid`, async () => {
      await nav(page, viewport.width, 'Bán hàng'); await page.getByRole('button', { name: 'App', exact: true }).click();
      await page.getByLabel('Mã đơn App (tùy chọn)').fill(`TEST-APP-${prefix}`); await add(page); await save(page, 3);
      const o = (await orders(page)).find(o => o.channel === 'app'); assert.equal(o.paid, false); assert.equal(o.paidAt, null); assert.equal(o.appCode, `TEST-APP-${prefix}`);
    });
    await check(`${prefix}: Hotline requires phone AND address; no shipping`, async () => {
      await nav(page, viewport.width, 'Bán hàng'); await page.getByRole('button', { name: 'Hotline', exact: true }).click(); await add(page);
      await page.getByRole('button', { name: 'Lưu đơn hàng', exact: true }).click(); await page.getByRole('alert').waitFor(); assert.equal((await orders(page)).length, 3);
      await page.getByLabel('Số điện thoại *', { exact: true }).fill('TEST-PHONE');
      await page.getByRole('button', { name: 'Lưu đơn hàng', exact: true }).click(); await page.getByRole('alert').waitFor(); assert.equal((await orders(page)).length, 3);
      await page.getByLabel('Địa chỉ giao *', { exact: true }).fill('TEST-ADDRESS');
      assert.equal(await page.getByText('Phí ship', { exact: true }).count(), 0);
      await save(page, 4); const o = (await orders(page)).find(o => o.channel === 'hotline'); assert.equal(o.total, 22000); assert.equal('shipping' in o, false);
    });
    await check(`${prefix}: confirm paid / paidAt`, async () => {
      const card = page.locator('article.order').filter({ hasText: `TEST ${prefix} ghi chú` });
      await card.getByRole('button', { name: 'Xác nhận đã thanh toán', exact: true }).click();
      await card.locator('.status.paid').waitFor(); const o = (await orders(page)).find(o => o.note === `TEST ${prefix} ghi chú`);
      assert.equal(o.paid, true); assert.ok(Number.isFinite(Date.parse(o.paidAt)));
      assert.equal(await card.getByRole('button', { name: 'Xác nhận đã thanh toán', exact: true }).count(), 0);
    });
    await check(`${prefix}: rapid save (five DOM clicks same turn)`, async () => {
      await nav(page, viewport.width, 'Bán hàng'); await page.getByRole('button', { name: 'Tại quán', exact: true }).click(); await add(page);
      await page.getByRole('button', { name: 'Lưu đơn hàng', exact: true }).evaluate(el => { for (let i = 0; i < 5; i++) el.click(); });
      await count(page, 5); await page.getByRole('heading', { name: 'Đơn hàng', level: 1 }).waitFor();
      assert.equal((await orders(page)).length, 5);
    });
    await check(`${prefix}: sales/paid/unpaid and receipts report / layout`, async () => {
      await nav(page, viewport.width, 'Báo cáo');
      const values = await page.locator('.stat strong').allTextContents(); assert.deepEqual(values, [money(137000), money(49000), money(88000)]);
      assert.ok((await page.locator('main').innerText()).includes(`Khoản thanh toán ghi nhận trong ngày: ${money(49000)}`));
      const rows = await page.locator('tbody tr').allTextContents(); assert.equal(rows.length, 4);
      await unobscured(page.getByLabel('Ngày báo cáo (giờ Việt Nam)')); return layout(page, viewport, 'reports');
    });
    await check(`${prefix}: two tabs create concurrently, storage event updates UI`, async () => {
      await nav(page, viewport.width, 'Bán hàng'); await add(page); await page.getByLabel('Ghi chú đơn', { exact: true }).fill('TEST TAB-A');
      const second = await context.newPage(); monitor(second); await second.goto(base); await second.locator('.product').first().waitFor();
      await add(second); await second.getByLabel('Ghi chú đơn', { exact: true }).fill('TEST TAB-B');
      await Promise.all([page.getByRole('button', { name: 'Lưu đơn hàng', exact: true }).click(), second.getByRole('button', { name: 'Lưu đơn hàng', exact: true }).click()]);
      await count(page, 7); await page.locator('article.order').filter({ hasText: 'TEST TAB-B' }).waitFor(); await second.locator('article.order').filter({ hasText: 'TEST TAB-A' }).waitFor();
      const cardA = page.locator('article.order').filter({ hasText: 'TEST TAB-A' }); const cardB = second.locator('article.order').filter({ hasText: 'TEST TAB-B' });
      await Promise.all([cardA.getByRole('button', { name: 'Xác nhận đã thanh toán', exact: true }).click(), cardB.getByRole('button', { name: 'Xác nhận đã thanh toán', exact: true }).click()]);
      await cardA.locator('.status.paid').waitFor(); await cardB.locator('.status.paid').waitFor();
      const both = (await orders(page)).filter(o => ['TEST TAB-A', 'TEST TAB-B'].includes(o.note)); assert.equal(both.length, 2); assert.ok(both.every(o => o.paid && o.paidAt));
      // Same order, two tab requests queued under the real browser Web Lock.
      const raceId = (await orders(page)).find(o => !o.paid).storageId;
      const raceLabel = `#${(await orders(page)).find(o => o.storageId === raceId).code}`;
      const race1 = page.locator('article.order').filter({ has: page.getByText(raceLabel, { exact: true }) });
      const race2 = second.locator('article.order').filter({ has: second.getByText(raceLabel, { exact: true }) });
      await page.evaluate(() => { void navigator.locks.request('tram-pos-write-v2', () => new Promise(resolve => { window.releaseTestLock = resolve; })); });
      await page.waitForFunction(() => Boolean(window.releaseTestLock));
      // Both UI handlers now queue behind the same real browser lock.
      await Promise.all([race1.getByRole('button', { name: 'Xác nhận đã thanh toán', exact: true }).evaluate(el => el.click()), race2.getByRole('button', { name: 'Xác nhận đã thanh toán', exact: true }).evaluate(el => el.click())]);
      await page.evaluate(() => window.releaseTestLock());
      await race1.locator('.status.paid').waitFor(); await race2.locator('.status.paid').waitFor();
      const paidAt = (await orders(page)).find(o => o.storageId === raceId).paidAt; assert.ok(paidAt);
      await second.reload(); await second.locator('.product').first().waitFor(); assert.equal((await orders(second)).find(o => o.storageId === raceId).paidAt, paidAt);
      await second.close();
    });
    await check(`${prefix}: reload preserves orders/snapshots/paidAt`, async () => {
      const before = await orders(page); await page.reload(); await page.locator('.product').first().waitFor();
      assert.deepEqual(await orders(page), before); await nav(page, viewport.width, 'Đơn hàng');
      assert.equal(await page.locator('article.order').count(), 7); return layout(page, viewport, 'orders');
    });
    await check(`${prefix}: products view / layout`, async () => { await nav(page, viewport.width, 'Sản phẩm'); return layout(page, viewport, 'products'); });
    if (viewport.width < 700) await check(`${prefix}: reduced visual viewport (keyboard proxy only)`, async () => {
      await nav(page, viewport.width, 'Bán hàng'); await add(page);
      await page.setViewportSize({ width: viewport.width, height: Math.max(320, viewport.height - 300) });
      await page.getByLabel('Ghi chú đơn', { exact: true }).fill('TEST KEYBOARD PROXY');
      await unobscured(page.getByRole('button', { name: 'Lưu đơn hàng', exact: true }));
      const file = `${viewport.width}x${viewport.height}-short-viewport.png`;
      await page.screenshot({path: new URL(file, output).pathname, fullPage: false}); evidence.screenshots.push(file);
      await page.setViewportSize(viewport); return 'Resize proxy passed; native virtual keyboard remains BLOCKED.';
    });
    await context.close();
  }
  await check('Legacy real browser: prior-day order paid today / raw preservation', async () => {
    const context = await browser.newContext({ viewport: {width:1440,height:900}, timezoneId:'Asia/Ho_Chi_Minh', locale:'vi-VN' });
    const page = await context.newPage(); monitor(page);
    const createdAt = new Date(Date.now() - 86400000).toISOString();
    const raw = JSON.stringify([
      {id:'TEST-DUPLICATE-ID',code:'TEST-LEGACY-1',channel:'grab',items:[{id:1,name:'TEST SNAPSHOT',price:22000,qty:1}],total:22000,shipping:0,payment:'cash',paid:false,status:'ready',createdAt,note:'TEST LEGACY NEED-PAY'},
      {id:'TEST-DUPLICATE-ID',code:'TEST-LEGACY-2',channel:'shopee',items:[{id:1,name:'TEST SNAPSHOT',price:22000,qty:1}],total:22000,shipping:0,payment:'transfer',paid:true,status:'done',createdAt},
      {id:'TEST-CANCELLED',code:'TEST-LEGACY-3',channel:'store',items:[{id:1,name:'TEST SNAPSHOT',price:22000,qty:1}],total:22000,shipping:0,payment:'cash',paid:false,status:'cancelled',createdAt},
    ]);
    await context.addInitScript(value => localStorage.setItem('tram_orders', value), raw);
    await page.goto(base); await page.locator('.product').first().waitFor(); await nav(page, 1440, 'Đơn hàng');
    assert.equal(await page.locator('article.order').count(),3);
    await page.locator('article.order').filter({hasText:'TEST LEGACY NEED-PAY'}).getByRole('button',{name:'Xác nhận đã thanh toán',exact:true}).click();
    await page.locator('article.order').filter({hasText:'TEST LEGACY NEED-PAY'}).locator('.status.paid').waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('tram_orders')),raw);
    await nav(page,1440,'Báo cáo');
    assert.deepEqual(await page.locator('.stat strong').allTextContents(),[money(0),money(0),money(0)]);
    assert.ok((await page.locator('main').innerText()).includes(`Khoản thanh toán ghi nhận trong ngày: ${money(22000)}`));
    assert.ok((await page.locator('main').innerText()).includes('1 đơn cũ đã thanh toán chưa biết ngày thu'));
    const priorDay = await page.evaluate(value => {
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
      return ['year','month','day'].map(t=>parts.find(p=>p.type===t).value).join('-');
    }, createdAt);
    await page.getByLabel('Ngày báo cáo (giờ Việt Nam)').fill(priorDay);
    await page.waitForFunction(() => document.querySelector('.stat strong')?.textContent === new Intl.NumberFormat('vi-VN').format(44000)+'đ');
    assert.deepEqual(await page.locator('.stat strong').allTextContents(),[money(44000),money(44000),money(0)]);
    assert.ok((await page.locator('main').innerText()).includes(`Khoản thanh toán ghi nhận trong ngày: ${money(0)}`));
    await page.screenshot({path:new URL('legacy-cross-day-report.png',output).pathname,fullPage:true}); evidence.screenshots.push('legacy-cross-day-report.png');
    await context.close(); return '3 legacy rows retained including duplicate IDs and cancelled; raw key unchanged; prior-day sales 44000, today receipt 22000, unknown paidAt excluded.';
  });
  await check('Console/page errors and failed requests', async () => { assert.deepEqual(evidence.errors, []); assert.deepEqual(evidence.failures, []); });
} catch (error) {
  evidence.fatal = error.message; console.error('FAIL', error.message); process.exitCode = 1;
} finally {
  await browser?.close(); await write();
}
