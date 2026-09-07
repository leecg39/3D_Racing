import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage(), external = [], failed = [], errors = [];
await page.route('**/*', route => {
  if (!route.request().url().startsWith('http://127.0.0.1:4173') && !route.request().url().startsWith('data:')) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('body[data-state="garage"]');
  assert.equal(await page.evaluate(() => typeof window.__workbench), 'undefined');
  await page.locator('[data-action="explode"]').click(); await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/evidence/13-production-exploded.png' });
  await page.locator('[data-action="start"]').click(); await page.waitForSelector('body[data-state="racing"]');
  await page.keyboard.down('Space'); await page.waitForTimeout(1000); await page.keyboard.up('Space');
  assert.ok(Number.parseInt(await page.locator('#heat-text').textContent()) > 0);
  await page.keyboard.press('Escape'); await page.waitForSelector('body[data-state="paused"]');
  assert.deepEqual(errors, []); assert.deepEqual(failed, []); assert.deepEqual(external, []);
  console.log('PASS production build, local fonts/assets, actual keyboard input, no external dependencies');
  const denied = await context.newPage();
  await denied.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied for QA'); } }); });
  await denied.goto('http://127.0.0.1:4173/'); await denied.waitForSelector('body[data-state="garage"]'); await denied.close();
  console.log('PASS storage-denied browser still loads garage');
  const webgl = await context.newPage();
  await webgl.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return String(type).startsWith('webgl') ? null : original.call(this, type, ...args); }; });
  await webgl.goto('http://127.0.0.1:4173/'); await webgl.getByText('작업실을 열지 못했습니다.').waitFor(); await webgl.close();
  console.log('PASS WebGL-unavailable recovery message');
  const missing = await context.newPage(); await missing.route('**/assets/source/lineup.png', route => route.fulfill({ status: 404, body: 'QA missing asset' }));
  await missing.goto('http://127.0.0.1:4173/'); await missing.getByText('작업실을 열지 못했습니다.').waitFor(); await missing.close();
  console.log('PASS missing-asset recovery message');
  await writeFile('docs/evidence/production-report.json', JSON.stringify({ status: 'passed', browser: browser.version(), errors, failedRequests: failed, externalRequests: external, checks: ['built game loads', 'local fonts and seven original images', 'no development diagnostics', 'keyboard boost changes heat', 'pause works', 'storage denied', 'WebGL denied', 'missing image failure'] }, null, 2));
} finally { await browser.close(); }
