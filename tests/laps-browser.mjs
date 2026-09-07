import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { CONFIG } from "../src/config.js";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const evidence = "docs/evidence/15-laps";
await mkdir(evidence, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ muted: true, records: [
      { car: "zephyr", total: 30, bestLap: 9, position: 1 },
    ] }));
  }, CONFIG.storageKey);
  await page.goto("http://127.0.0.1:4173/");
  await page.waitForSelector('body[data-state="garage"]');
  assert.match(await page.locator(".track-info").textContent(), /15 LAPS/);
  await page.locator('[data-action="records"]').click();
  assert.match(await page.locator("#records-list").textContent(), /15랩을 완주/);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), CONFIG.storageKey);
  assert.equal(saved.records[0].laps, 3);
  assert.equal(saved.records[0].total, 30);
  await page.locator('#records-dialog [data-action="close-dialog"]').first().click();
  await page.locator('[data-action="start"]').click();
  await page.waitForSelector('body[data-state="racing"]');
  assert.match(await page.locator("#race-lap").textContent(), /1\s*\/\s*15/);
  await page.screenshot({ path: `${evidence}/production-start.png` });
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/production-report.json`, JSON.stringify({
    status: "passed", laps: CONFIG.laps, browser: browser.version(), errors,
    checks: ["built garage advertises 15 laps", "old 3-lap records retained but excluded from 15-lap leaderboard", "built HUD shows 1/15"],
  }, null, 2) + "\n");
  console.log("PASS built 15-lap game, correct HUD and legacy record preservation");
} finally { await browser.close(); }
