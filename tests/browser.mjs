import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CONFIG } from "../src/config.js";

const evidence = path.resolve(process.env.EVIDENCE_DIR || "docs/evidence");
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: process.env.HEADLESS === "1",
  ...(process.env.SOFTWARE_GL === "1"
    ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: path.join(evidence, "video"),
    size: { width: 1440, height: 900 },
  },
});
const page = await context.newPage();
const errors = [],
  failedRequests = [],
  checks = [],
  samples = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400)
    failedRequests.push(`${response.status()} ${response.url()}`);
});
const read = () => page.evaluate(() => window.__workbench.inspect());
const screenshot = async (name) => {
  await page.screenshot({ path: path.join(evidence, name + ".png") });
};
const check = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const state = async (name) =>
  page.waitForFunction((s) => window.__workbench?.inspect().state === s, name, {
    timeout: 15000,
  });
let initialMemory, resultSnapshot, report;
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173", {
    waitUntil: "networkidle",
  });
  await state("garage");
  await page.waitForTimeout(1000);
  await screenshot("01-garage");
  check("local assets loaded and garage rendered");
  for (const id of ["vortex", "bulldog", "nova", "zephyr"]) {
    await page.locator(`[data-car="${id}"]`).click();
    assert.equal((await read()).selected, id);
  }
  check("all four image-backed vehicle cards change the 3D car");
  await page.locator('[data-action="explode"]').click();
  await page.waitForTimeout(1000);
  assert.equal((await read()).exploded, true);
  await page.locator('[data-part="Motor"]').click();
  assert.equal((await read()).part, "Motor");
  await page.locator('[data-action="wheel"]').click();
  assert.equal((await read()).wheelTest, true);
  await screenshot("02-exploded");
  for (let i = 0; i < 10; i++)
    await page.locator('[data-action="explode"]').click();
  await page.locator('[data-car="bulldog"]').click();
  assert.equal((await read()).exploded, false);
  assert.equal((await read()).part, null);
  await page.locator('[data-car="zephyr"]').click();
  check("explosion, part selection, wheel test and reset on car change");
  await page.locator('[data-action="assets"]').click();
  for (const id of [
    "lineup",
    "zephyr",
    "bulldog",
    "workshop",
    "track",
    "interface",
    "props",
  ]) {
    await page.locator(`[data-asset="${id}"]`).click();
    await page.waitForFunction(
      () =>
        document.querySelector("#asset-sheet-image").complete &&
        document.querySelector("#asset-sheet-image").naturalWidth > 0,
    );
  }
  await page.locator('[data-asset="track"]').click();
  await screenshot("03-blueprint");
  await page.locator('#assets-dialog [data-action="close-dialog"]').click();
  check("all seven original asset sheets are available in the archive");
  await page.locator('[data-action="settings"]').click();
  await page.locator("#sound-setting").check();
  await page.locator("#motion-setting").check();
  await page.locator("#settings-dialog .primary").click();
  await page.locator('[data-action="start"]').click();
  await state("countdown");
  await page.keyboard.press("Escape");
  await state("paused");
  const countdownBefore = (await read()).countdown;
  await page.waitForTimeout(700);
  assert.equal((await read()).countdown, countdownBefore);
  check("countdown pauses without advancing time");
  await page.locator('[data-action="resume"]').click();
  await state("racing");
  initialMemory = (await read()).render;
  await page.keyboard.press("Digit1");
  await page.keyboard.down("Space");
  await page.waitForTimeout(1700);
  assert.ok((await read()).race.cars[0].heat > 25);
  assert.ok((await read()).race.cars[0].boosting);
  await page.keyboard.up("Space");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyD");
  const lane = (await read()).race.cars[0].lane;
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(650);
  await page.keyboard.up("KeyA");
  // Positive lane offsets move left in the driver's view.
  assert.ok((await read()).race.cars[0].lane > lane);
  await page.keyboard.down("Space");
  await page.keyboard.down("Shift");
  await page.waitForTimeout(300);
  assert.equal((await read()).race.cars[0].boosting, false);
  assert.equal((await read()).race.cars[0].stabilizing, true);
  await page.keyboard.up("Space");
  await page.keyboard.up("Shift");
  check("keyboard lane input, boost heat and stabilization cost");
  await screenshot("04-racing");
  for (let i = 1; i <= 6; i++) {
    await page.keyboard.press(`Digit${i}`);
    assert.equal((await read()).camera, i - 1);
  }
  await page.keyboard.press("Digit2");
  check("all six cameras can be selected");
  await page.keyboard.down("Space");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await state("paused");
  const paused = await read();
  await page.waitForTimeout(700);
  assert.deepEqual((await read()).race, paused.race);
  assert.equal(paused.audio.active, false);
  assert.deepEqual(paused.keys, []);
  await page.keyboard.up("Space");
  await page.locator('[data-action="resume"]').click();
  check("blur clears keys and freezes race time, physics and sound");
  let capturedWet = false,
    capturedStorm = false,
    capturedLoop = false;
  const wallStart = Date.now();
  while (
    (await read()).state !== "results" &&
    Date.now() - wallStart < CONFIG.laps * 50000
  ) {
    const current = await read();
    samples.push({
      time: current.race.time,
      fps: current.fps,
      calls: current.render.calls,
      triangles: current.render.triangles,
    });
    if (!capturedLoop && current.race.time > 16) {
      await screenshot("05-circuit");
      capturedLoop = true;
    }
    if (!capturedWet && current.race.cars[0].lap === 2) {
      await screenshot("06-wet-lap");
      capturedWet = true;
    }
    if (!capturedStorm && current.race.cars[0].lap === 3) {
      await screenshot("07-storm-lap");
      capturedStorm = true;
    }
    await page.waitForTimeout(2000);
  }
  await state("results");
  resultSnapshot = await read();
  assert.ok(
    resultSnapshot.race.cars.every(
      (c) => c.completedLaps === CONFIG.laps && Number.isFinite(c.finishTime),
    ),
  );
  assert.equal(resultSnapshot.records.length, 1);
  assert.ok(capturedWet && capturedStorm);
  await screenshot("08-results");
  check(
    `actual full race: four finishers, ${CONFIG.laps} laps, weather, one saved result`,
  );
  await page.locator('[data-action="replay"]').click();
  await state("replay");
  await page.locator("#replay-seek").fill("62");
  await page.locator("#replay-seek").dispatchEvent("input");
  await page.waitForTimeout(500);
  assert.ok((await read()).replayTime > resultSnapshot.replayDuration * 0.6);
  await page.locator('[data-action="replay-speed"]').click();
  await screenshot("09-replay");
  await page.locator('[data-action="end-replay"]').click();
  await state("results");
  assert.deepEqual((await read()).race, resultSnapshot.race);
  assert.deepEqual((await read()).records, resultSnapshot.records);
  check(
    "recorded replay seeks and changes speed without altering race or records",
  );
  // Check resource reuse through ten new race starts, without remounting the app.
  const memories = [];
  for (let i = 0; i < 10; i++) {
    if ((await read()).state === "results")
      await page.locator('#results-screen [data-action="restart"]').click();
    else await page.locator('#pause-screen [data-action="restart"]').click();
    await state("countdown");
    await page.waitForTimeout(120);
    await page.keyboard.press("Escape");
    await state("paused");
    const current = await read();
    assert.equal(current.race.time, 0);
    assert.equal(current.race.cars[0].completedLaps, 0);
    assert.equal(current.replayFrames, 1);
    memories.push(current.render);
  }
  assert.equal(memories[9].geometries, memories[1].geometries);
  assert.equal(memories[9].textures, memories[1].textures);
  check(
    "ten browser restarts reuse geometry and textures without duplicate state",
  );
  await page.locator('#pause-screen [data-action="garage"]').click();
  await page.locator('[data-action="settings"]').click();
  await page.locator("#quality-setting").selectOption("performance");
  await page.locator("#settings-dialog .primary").click();
  await page.locator('[data-action="start"]').click();
  await state("racing");
  await page.waitForTimeout(1000);
  await screenshot("10-performance-mode");
  assert.equal((await read()).settings.quality, "performance");
  check("performance mode remains playable");
  await page.keyboard.press("Escape");
  await page.locator('#pause-screen [data-action="garage"]').click();
  await page.reload({ waitUntil: "networkidle" });
  await state("garage");
  assert.equal((await read()).records.length, 1);
  assert.equal((await read()).settings.quality, "performance");
  check("local records and preferences survive reload");
  await page.setViewportSize({ width: 1280, height: 720 });
  await screenshot("11-desktop-1280");
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot("12-mobile-notice");
  assert.ok(await page.locator('[data-action="start"]').isVisible());
  check("compact layout keeps start action and desktop requirement visible");
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  check("no JavaScript errors, missing assets or HTTP failures");
  report = {
    status: "passed",
    date: new Date().toISOString(),
    browser: browser.version(),
    headless: process.env.HEADLESS === '1',
    softwareRendering: process.env.SOFTWARE_GL === '1',
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    viewport: "1440×900",
    checks,
    errors,
    failedRequests,
    samples,
    initialMemory,
    finalMemory: memories.at(-1),
    race: resultSnapshot.race,
  };
} catch (error) {
  await screenshot("failure").catch(() => {});
  report = {
    status: "failed",
    error: error.stack,
    checks,
    errors,
    failedRequests,
    samples,
  };
  console.error(error);
  process.exitCode = 1;
} finally {
  const video = page.video();
  await context.close();
  if (video) await video.saveAs(path.join(evidence, "race-and-restart.webm"));
  await browser.close();
  await writeFile(
    path.join(evidence, "browser-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(`Evidence: ${evidence}`);
}
