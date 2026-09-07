import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const evidence = "docs/evidence/audio-handling";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForFunction(() => !!window.__workbench);
  const rows = await page.evaluate(async () => {
    const { CarModel } = await import("/src/car/CarFactory.js");
    const { placeCarOnTrack } = await import("/src/car/CarPlacement.js");
    const { TrackSampler } = await import("/src/track/TrackSampler.js");
    const { TrackBuilder } = await import("/src/track/TrackBuilder.js");
    const { CARS } = await import("/src/config.js");
    const { Raycaster, Vector3 } = await import("/node_modules/.vite/deps/three.js");
    const track = new TrackSampler();
    const road = new TrackBuilder(track).root.children[0];
    road.updateMatrixWorld(true);
    return CARS.map((spec) => {
      const model = new CarModel(spec);
      model.root.scale.setScalar(0.63);
      let maxGap = -Infinity, minGap = Infinity, misses = 0;
      for (let i = 0; i < 200; i++) {
        const distance = i * track.length / 200;
        const frame = placeCarOnTrack(model, track, distance, 0);
        model.root.updateMatrixWorld(true);
        for (const wheel of model.wheelPivots) {
          const origin = wheel.getWorldPosition(new Vector3());
          const ray = new Raycaster(origin, frame.up.clone().negate(), 0, 2);
          const hit = ray.intersectObject(road)[0];
          if (!hit) { misses++; continue; }
          const gap = hit.distance - model.tireRadius * 0.63;
          maxGap = Math.max(maxGap, gap);
          minGap = Math.min(minGap, gap);
        }
      }
      return { id: spec.id, wheelSamples: 800, maxGap, minGap, misses };
    });
  });
  for (const row of rows) {
    assert.equal(row.misses, 0);
    assert.ok(row.maxGap < 0.012 && row.minGap > -0.015);
  }
  // Low-angle in-game inspection, no scene/model replacement.
  await page.locator('[data-action="start"]').click();
  await page.waitForSelector('body[data-state="racing"]');
  await page.keyboard.press("Digit4");
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${evidence}/wheel-contact.png` });
  await writeFile(`${evidence}/contact-report.json`, JSON.stringify({
    status: "passed", browser: browser.version(), rows,
    note: "Raycast against the actual ribbon geometry, 4 cars × 200 track positions × 4 tires; world units, not real metres.",
  }, null, 2) + "\n");
  console.log("PASS 3,200 actual road-mesh tire contact samples including the inverted loop");
} finally { await browser.close(); }
