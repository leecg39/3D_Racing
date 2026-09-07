import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidence = path.resolve(process.env.EVIDENCE_DIR || "docs/evidence/steering");
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], checks = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});
const read = () => page.evaluate(() => window.__workbench.inspect());
const state = (value) => page.waitForSelector(`body[data-state="${value}"]`);
let failure;
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173/");
  await state("garage");
  // Test the actual keyboard listener, race and each driver-facing camera.
  for (const mode of [0, 2, 3]) {
    for (const [code, direction] of [
      ["ArrowLeft", -1], ["ArrowRight", 1], ["KeyA", -1], ["KeyD", 1],
    ]) {
      if (checks.length === 0) {
        await page.locator('[data-action="start"]').click();
      } else {
        await page.locator('#pause-screen [data-action="restart"]').click();
      }
      await state("racing");
      await page.keyboard.press(`Digit${mode + 1}`);
      assert.equal((await read()).camera, mode);
      const before = (await read()).race.cars[0];
      await page.keyboard.down(code);
      let after;
      try {
        const moved = await page.waitForFunction((lane) => {
          const car = window.__workbench.inspect().race.cars[0];
          return Math.abs(car.lane - lane) > 0.025 ? car : false;
        }, before.lane, { timeout: 3000 });
        after = await moved.jsonValue();
        await moved.dispose();
      } finally {
        await page.keyboard.up(code);
      }
      const screenDelta = await page.evaluate(async ({ before, after, mode }) => {
        const { TrackSampler } = await import("/src/track/TrackSampler.js");
        const { CameraRig } = await import("/src/camera/CameraRig.js");
        const track = new TrackSampler();
        const rig = new CameraRig(document.createElement("canvas"), track);
        try {
          rig.setMode(mode);
          rig.update(1 / 60, after, 0);
          rig.camera.updateMatrixWorld(true);
          const frame = track.sample(after.distance);
          // Use a point in front of the camera: the car itself is behind the
          // first-person camera. Project the measured lateral displacement.
          const probe = rig.camera.position.clone().addScaledVector(
            rig.camera.getWorldDirection(frame.forward.clone()), 8,
          );
          return probe.clone().addScaledVector(frame.side, after.lane - before.lane)
            .project(rig.camera).x - probe.project(rig.camera).x;
        } finally {
          rig.controls.dispose();
        }
      }, { before, after, mode });
      assert.ok(screenDelta * direction > 0, `${code}, camera ${mode}: ${screenDelta}`);
      checks.push({ code, camera: mode, laneDelta: after.lane - before.lane, screenDelta });
      console.log(`PASS ${code}, camera ${mode}: correct screen direction`);
      assert.equal((await read()).keys.includes(code), false);
      if (mode === 0 && code.startsWith("Arrow")) {
        await page.screenshot({ path: path.join(evidence, `${code}.png`) });
      }
      await page.keyboard.press("Escape");
      await state("paused");
    }
  }
  assert.deepEqual(errors, []);
} catch (error) {
  failure = error.stack;
  process.exitCode = 1;
  console.error(error);
  await page.screenshot({ path: path.join(evidence, "failure.png") }).catch(() => {});
} finally {
  await writeFile(path.join(evidence, "report.json"), JSON.stringify({
    status: failure ? "failed" : "passed", date: new Date().toISOString(),
    browser: browser.version(), checks, errors, ...(failure ? { failure } : {}),
  }, null, 2) + "\n");
  await browser.close();
  console.log(`Evidence: ${evidence}`);
}
