import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidence = path.resolve(process.env.EVIDENCE_DIR || "docs/evidence/dashboard");
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], checks = [], layouts = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});
const state = (value) => page.waitForSelector(`body[data-state="${value}"]`);
const check = (name) => { checks.push(name); console.log(`PASS ${name}`); };
const screenshot = (name) => page.screenshot({ path: path.join(evidence, `${name}.png`) });
let failure;
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173/");
  await state("garage");
  await page.locator('[data-action="start"]').click();
  await state("countdown");
  assert.equal(await page.locator("#speed-gauge").getAttribute("aria-valuenow"), "0");
  assert.equal(await page.locator("#speed-arc").getAttribute("stroke-dasharray"), "0 100");
  check("countdown resets both the digital speed and arc to zero");
  await state("racing");
  await page.waitForFunction(() => Number(document.querySelector("#speed").textContent) > 150);
  const live = await page.evaluate(() => ({
    speed: Number(document.querySelector("#speed").textContent),
    actual: window.__workbench.inspect().race.cars[0].speed * 10,
    value: Number(document.querySelector("#speed-gauge").getAttribute("aria-valuenow")),
    arc: parseFloat(document.querySelector("#speed-arc").getAttribute("stroke-dasharray")),
  }));
  assert.ok(Math.abs(live.speed - live.actual) < 8, JSON.stringify(live));
  assert.equal(live.speed, live.value);
  assert.ok(Math.abs(live.arc * 4 - live.speed) <= 0.5);
  await screenshot("01-driving");
  await page.locator("#speed-gauge").screenshot({ path: path.join(evidence, "dial-detail.png") });
  check("digital display, accessible value and arc follow the live car speed");

  await page.keyboard.down("Space");
  await page.waitForSelector('#speed-gauge[data-mode="boost"]');
  assert.equal(await page.locator("#drive-mode").textContent(), "B");
  await screenshot("02-boost");
  await page.keyboard.up("Space");
  check("real boost input changes the drive indicator and gauge treatment");
  await page.keyboard.down("Shift");
  await page.waitForSelector('#speed-gauge[data-mode="grip"]');
  await page.keyboard.up("Shift");
  check("stabilization is represented by the GRIP state");

  await page.keyboard.press("Escape");
  await state("paused");
  const paused = await page.locator("#speed-gauge").getAttribute("aria-valuenow");
  await page.waitForTimeout(250);
  assert.equal(await page.locator("#speed-gauge").getAttribute("aria-valuenow"), paused);
  await page.locator('[data-action="resume"]').click();
  await state("racing");
  check("pause freezes the gauge and resume restores live updates");

  for (const viewport of [
    { width: 1440, height: 900 }, { width: 1280, height: 720 },
    { width: 1024, height: 522 }, { width: 850, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(120);
    const layout = await page.evaluate(() => {
      const bounds = (selector) => {
        const e = document.querySelector(selector), r = e.getBoundingClientRect();
        return { selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, visible: getComputedStyle(e).display !== "none" };
      };
      const controls = document.querySelector("#replay-controls");
      const hidden = controls.hidden;
      controls.hidden = false;
      const replay = bounds("#replay-controls");
      controls.hidden = hidden;
      return {
        viewport: { width: innerWidth, height: innerHeight },
        parts: ["#speed-gauge", ".telemetry-meters", ".map-panel", ".driving-help", ".weather-chip"].map(bounds),
        scrollWidth: document.documentElement.scrollWidth,
        replay,
      };
    });
    for (const part of layout.parts.filter((p) => p.visible)) {
      assert.ok(part.x >= -1 && part.right <= viewport.width + 1, JSON.stringify(part));
      assert.ok(part.y >= 0 && part.bottom <= viewport.height + 1, JSON.stringify(part));
    }
    const gauge = layout.parts[0], weather = layout.parts.at(-1);
    assert.ok(gauge.y >= weather.bottom, "weather must not overlap the speedometer");
    assert.ok(layout.replay.bottom <= gauge.y, "replay controls must stay above the speedometer");
    assert.ok(layout.replay.x >= 0 && layout.replay.right <= viewport.width, "replay controls fit horizontally");
    assert.ok(layout.scrollWidth <= viewport.width, "no horizontal overflow");
    layouts.push(layout);
    await screenshot(`layout-${viewport.width}x${viewport.height}`);
  }
  check("gauge, meters and surrounding overlays fit five viewport sizes");

  // Exercise boundary and replay-style backwards updates on the real component.
  // The detached fixture never replaces or changes the live race.
  const fixtures = await page.evaluate(async () => {
    const { Speedometer, speedometerMarkup } = await import("/src/ui/Speedometer.js");
    const host = document.createElement("div");
    host.innerHTML = speedometerMarkup();
    const root = host.firstElementChild, dial = new Speedometer(root);
    return [
      { speed: 40, boosting: true }, { speed: 5 }, { speed: 0 },
      { speed: 100 }, { speed: -10 }, { speed: NaN },
      { speed: 20, overheated: true, boosting: true },
      { speed: 12, impactRemaining: 0.3 }, { speed: 0, finishTime: 30 },
    ].map((player) => {
      dial.update(player);
      return {
        speed: Number(root.getAttribute("aria-valuenow")),
        arc: parseFloat(root.querySelector("#speed-arc").getAttribute("stroke-dasharray")),
        state: root.dataset.mode,
      };
    });
  });
  assert.deepEqual(fixtures.map((x) => x.speed), [400, 50, 0, 400, 0, 0, 200, 120, 0]);
  assert.deepEqual(fixtures.map((x) => x.arc), [100, 12.5, 0, 100, 0, 0, 50, 30, 0]);
  assert.deepEqual(fixtures.map((x) => x.state), ["boost", "drive", "ready", "drive", "ready", "ready", "hot", "impact", "finished"]);
  check("0/400 limits, backwards speed updates, overheat, impact and finish states");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press("Escape");
  await state("paused");
  await page.locator('#pause-screen [data-action="garage"]').click();
  await state("garage");
  await page.locator('[data-action="settings"]').click();
  await page.locator("#motion-setting").check();
  await page.locator('#settings-dialog [data-action="close-dialog"]').last().click();
  assert.equal(await page.locator("#speed-gauge").evaluate((el) => el.classList.contains("reduced-motion")), true);
  await page.locator('[data-action="start"]').click();
  await state("racing");
  await page.keyboard.press("Digit3");
  await page.waitForTimeout(600);
  await screenshot("03-forward-camera");
  check("reduced motion is respected and the gauge works in the forward camera");
  assert.deepEqual(errors, []);
  check("no JavaScript errors, failed assets or HTTP errors");
} catch (error) {
  failure = error.stack;
  process.exitCode = 1;
  console.error(error);
  await screenshot("failure").catch(() => {});
} finally {
  await writeFile(path.join(evidence, "report.json"), JSON.stringify({
    status: failure ? "failed" : "passed", date: new Date().toISOString(),
    browser: browser.version(), checks, layouts, errors, ...(failure ? { failure } : {}),
  }, null, 2) + "\n");
  await browser.close();
  console.log(`Evidence: ${evidence}`);
}
