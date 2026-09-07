import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { CONFIG } from "../src/config.js";

const url = process.env.GAME_URL || "http://127.0.0.1:5173/";
const evidence = "docs/evidence/audio-handling";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Keep this effects-only suite independent of the separately tested soundtrack.
await context.addInitScript((key) => {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ musicMuted: true }));
}, CONFIG.storageKey);
await context.addInitScript(() => {
  // Observe actual samples downstream of the app's master gain, not its flags.
  const connect = AudioNode.prototype.connect;
  window.__audioQA = { samples: [], context: null };
  AudioNode.prototype.connect = function (target, ...args) {
    if (target === this.context.destination) {
      window.__audioQA.context = this.context;
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 2048;
      connect.call(this, analyser);
      const data = new Float32Array(analyser.fftSize);
      setInterval(() => {
        analyser.getFloatTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
        window.__audioQA.samples.push({ rms, at: performance.now() });
        if (window.__audioQA.samples.length > 1000) window.__audioQA.samples.shift();
      }, 20);
    }
    return connect.call(this, target, ...args);
  };
});
const page = await context.newPage();
const errors = [], checks = [], metrics = {};
page.on("pageerror", (error) => errors.push(error.message));
const state = (name) => page.waitForSelector(`body[data-state="${name}"]`);
const rms = () => page.evaluate(() => Math.max(0, ...window.__audioQA.samples.filter(s => s.at > performance.now() - 200).map(s => s.rms)));
const check = (name) => { checks.push(name); console.log("PASS " + name); };
let report;
try {
  await page.goto(url);
  await state("garage");
  assert.equal(await page.locator("#sound-button").getAttribute("aria-pressed"), "true");
  await page.locator('[data-action="start"]').click();
  await state("racing");
  await page.waitForTimeout(1200);
  metrics.engineRms = await rms();
  assert.ok(metrics.engineRms > 0.015, `audible default engine RMS ${metrics.engineRms}`);
  check("fresh start produces real audio samples without a separate unmute step");

  if (await page.evaluate(() => !!window.__workbench)) {
    const before = await page.evaluate(() => window.__workbench.inspect().race.cars[0]);
    await page.keyboard.down("ArrowLeft");
    await page.waitForFunction(() => window.__workbench.inspect().race.cars[0].impactRemaining > 0.2);
    const hit = await page.evaluate(() => window.__workbench.inspect().race.cars[0]);
    await page.keyboard.up("ArrowLeft");
    metrics.impact = { before: before.speed, after: hit.speed, count: hit.impactCount, side: hit.impactSide };
    assert.ok(hit.speed < before.speed * 0.85);
    await page.getByText("레일 충돌 · 충격으로 감속! 안쪽으로 조향하세요").waitFor();
    await page.screenshot({ path: `${evidence}/rail-impact.png` });
    check("real steering hits the rail and reduces actual speed with impact HUD");
  }

  await page.keyboard.press("Escape");
  await state("paused");
  await page.waitForTimeout(600);
  metrics.pausedRms = await rms();
  assert.ok(metrics.pausedRms < 0.0001);
  await page.evaluate(() => window.__audioQA.context.suspend());
  await page.locator('[data-action="resume"]').click();
  await state("racing");
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => window.__audioQA.context.state), "running");
  assert.ok(await rms() > 0.01);
  check("pause silences output and resume recovers a suspended AudioContext");

  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="test-sound"]').click();
  await page.waitForTimeout(100);
  metrics.previewRms = await rms();
  assert.ok(metrics.previewRms > 0.01);
  assert.equal(await page.locator("body").getAttribute("data-state"), "paused");
  await page.screenshot({ path: `${evidence}/sound-settings.png` });
  check("sound test is audible in paused settings without resuming the race");

  await page.locator("#volume-setting").fill("0");
  await page.waitForTimeout(600);
  assert.ok(await rms() < 0.0001);
  await page.locator('[data-action="test-sound"]').click();
  assert.equal(await page.locator("#volume-setting").inputValue(), "0.5");
  await page.waitForTimeout(100);
  assert.ok(await rms() > 0.01);
  await page.locator("#sound-setting").uncheck();
  await page.waitForTimeout(600);
  assert.ok(await rms() < 0.0001);
  await page.reload();
  await state("garage");
  assert.equal(await page.locator("#sound-button").getAttribute("aria-pressed"), "false");
  await page.locator("#sound-button").click();
  await page.waitForTimeout(100);
  assert.ok(await rms() > 0.01);
  check("zero volume recovery, persistent mute and garage unmute confirmation work");

  await page.locator('[data-action="wheel"]').click();
  await page.waitForTimeout(450);
  assert.ok(await rms() > 0.01);
  await page.locator('[data-action="wheel"]').click();
  await page.waitForTimeout(600);
  assert.ok(await rms() < 0.0001);
  check("garage wheel test starts and stops the motor sound");

  const unsupported = await context.newPage();
  await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await unsupported.goto(url);
  await unsupported.waitForSelector('body[data-state="garage"]');
  await unsupported.locator('[data-action="settings"]').click();
  await unsupported.locator('[data-action="test-sound"]').click();
  await unsupported.getByText("이 브라우저는 Web Audio를 지원하지 않습니다.", { exact: true }).waitFor();
  await unsupported.locator('#settings-dialog [data-action="close-dialog"]').first().click();
  await unsupported.locator('[data-action="start"]').click();
  await unsupported.waitForSelector('body[data-state="racing"]');
  await unsupported.close();
  check("unsupported audio reports a visible error while racing remains playable");
  assert.deepEqual(errors, []);
  report = { status: "passed", url, browser: browser.version(), checks, metrics, errors };
} catch (error) {
  report = { status: "failed", url, checks, metrics, errors, error: error.stack };
  throw error;
} finally {
  await writeFile(`${evidence}/${url.includes("4173") ? "production" : "development"}-report.json`, JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
