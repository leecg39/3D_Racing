import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.GAME_URL || "http://127.0.0.1:5173/";
const evidence = path.resolve("docs/evidence/music");
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  const connect = AudioNode.prototype.connect;
  const create = AudioContext.prototype.createMediaElementSource;
  window.__musicQA = { media: [], outputs: [], rms: 0 };
  AudioContext.prototype.createMediaElementSource = function (media) {
    window.__musicQA.media.push(media);
    return create.call(this, media);
  };
  AudioNode.prototype.connect = function (target, ...args) {
    if (target === this.context.destination) {
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 2048;
      connect.call(this, analyser);
      window.__musicQA.outputs.push({ analyser, samples: new Float32Array(analyser.fftSize) });
    }
    return connect.call(this, target, ...args);
  };
  setInterval(() => {
    window.__musicQA.rms = Math.max(0, ...window.__musicQA.outputs.map(({ analyser, samples }) => {
      analyser.getFloatTimeDomainData(samples);
      return Math.sqrt(samples.reduce((n, x) => n + x * x, 0) / samples.length);
    }));
  }, 20);
});
const page = await context.newPage();
const checks = [], errors = [], metrics = {};
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});
const state = (value) => page.waitForSelector(`body[data-state="${value}"]`);
const read = () => page.evaluate(() => window.__workbench.inspect());
const audible = () => page.waitForFunction(() => window.__musicQA.rms > 0.002, null, { timeout: 10000 });
const silent = () => page.waitForFunction(() => window.__musicQA.rms < 0.0001, null, { timeout: 5000 });
const musicState = (status) => page.waitForFunction((s) => window.__workbench.inspect().audio.music.status === s, status);
const check = (name) => { checks.push(name); console.log(`PASS ${name}`); };
let failure;
try {
  await page.goto(url);
  await state("garage");
  assert.equal((await read()).audio.music.status, "locked");
  await page.locator('#music-button').click();
  await musicState("playing");
  await audible();
  assert.equal((await read()).audio.music.title, "Airport Lounge");
  metrics.garageRms = await page.evaluate(() => window.__musicQA.rms);
  check("first garage interaction starts audible licensed lounge music");

  await page.locator('[data-action="start"]').click();
  await state("racing");
  await musicState("playing");
  assert.equal((await read()).audio.music.title, "Go Cart");
  await page.waitForFunction(() => window.__musicQA.media.filter((m) => !m.paused).length === 1);
  assert.equal((await read()).audio.music.elements, 2);
  await page.locator("#music-button").click();
  await page.waitForTimeout(250);
  assert.equal((await read()).audio.music.playing, false);
  await audible();
  check("race switches tracks, and muting music preserves engine audio");

  await page.locator('[data-action="settings"]').click();
  await state("paused");
  await page.locator("#volume-setting").fill("0");
  await silent();
  await page.locator('[data-action="test-music"]').click();
  await audible();
  assert.equal((await read()).settings.volume, 0);
  metrics.musicOnlyRms = await page.evaluate(() => window.__musicQA.rms);
  await page.locator("#music-volume-setting").fill("0.42");
  await audible();
  await page.locator(".music-credits summary").click();
  assert.equal(await page.locator('.music-credits a[href="https://creativecommons.org/licenses/by/4.0/"]').count(), 1);
  await page.screenshot({ path: path.join(evidence, "music-settings.png") });
  check("music preview and volume work independently of zero effects volume; credits are visible");
  await page.locator('#settings-dialog [data-action="close-dialog"]').last().click();
  await silent();
  const pausedTime = (await read()).audio.music.time;
  await page.waitForTimeout(250);
  assert.ok(Math.abs((await read()).audio.music.time - pausedTime) < 0.1);
  await page.locator('[data-action="resume"]').click();
  await state("racing");
  await audible();
  assert.ok((await read()).audio.music.time >= pausedTime);
  check("closing preview returns to silence; resume preserves the playback position");

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await state("paused");
  await page.waitForTimeout(300);
  await silent();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.locator('[data-action="resume"]').click();
  await audible();
  check("background focus loss pauses audio and a user resume restores it");

  await page.locator("#sound-button").click();
  await page.waitForTimeout(300);
  await silent();
  await page.locator("#sound-button").click();
  await audible();
  check("global sound mute and unmute control both audio channels");

  await page.waitForFunction(() => window.__musicQA.media.some((m) => !m.paused && Number.isFinite(m.duration)));
  await page.evaluate(() => {
    const media = window.__musicQA.media.find((m) => !m.paused);
    media.currentTime = media.duration - 0.2;
  });
  await page.waitForFunction(() => window.__musicQA.media.some((m) => !m.paused && m.currentTime < 2), null, { timeout: 5000 });
  check("the real MP3 loops at its end without creating another audio element");

  await page.keyboard.press("Escape");
  await state("paused");
  await page.locator('#pause-screen [data-action="garage"]').click();
  await musicState("playing");
  assert.equal((await read()).audio.music.trackId, "garage");
  assert.equal((await read()).audio.music.elements, 2);
  await page.reload();
  await state("garage");
  assert.equal((await read()).settings.musicVolume, 0.42);
  assert.equal((await read()).settings.volume, 0);
  await page.locator('[data-car="bulldog"]').click();
  await musicState("playing");
  await page.locator("#music-button").click();
  await page.reload();
  await state("garage");
  assert.equal((await read()).settings.musicMuted, true);
  check("scene switches reuse audio elements and separate music preferences persist");
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await page.locator("#music-button").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert.ok(await page.locator("#sound-button").isVisible());
  }
  check("music controls fit desktop and narrow layouts");

  const broken = await context.newPage();
  await broken.route("**/audio/music/*.mp3", (route) => route.fulfill({ status: 404, body: "missing test fixture" }));
  await broken.goto(url);
  await broken.waitForSelector('body[data-state="garage"]');
  await broken.locator("#music-button").click();
  await broken.waitForFunction(() => window.__workbench.inspect().audio.music.status === "error");
  await broken.locator('[data-action="start"]').click();
  await broken.waitForSelector('body[data-state="racing"]');
  assert.ok(await broken.locator("#speed").isVisible());
  await broken.close();
  check("missing music reports a recoverable error without breaking the race");
  assert.deepEqual(errors, []);
} catch (error) {
  failure = error.stack;
  process.exitCode = 1;
  console.error(error);
  await page.screenshot({ path: path.join(evidence, "failure.png") }).catch(() => {});
} finally {
  await writeFile(path.join(evidence, "report.json"), JSON.stringify({
    status: failure ? "failed" : "passed", date: new Date().toISOString(),
    browser: browser.version(), checks, metrics, errors, ...(failure ? { failure } : {}),
  }, null, 2) + "\n");
  await browser.close();
  console.log(`Evidence: ${evidence}`);
}
