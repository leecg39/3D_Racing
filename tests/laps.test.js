import test from "node:test";
import assert from "node:assert/strict";
import { Scene } from "three";
import { CONFIG } from "../src/config.js";
import { TrackSampler } from "../src/track/TrackSampler.js";
import { RaceManager } from "../src/race/RaceManager.js";
import { strategicInput } from "../src/race/AIDriver.js";
import { ReplayRecorder } from "../src/replay/ReplayRecorder.js";
import { Storage } from "../src/core/Storage.js";
import { WeatherSystem } from "../src/weather/WeatherSystem.js";

test("15 laps require 180 checkpoints and do not finish at lap three", () => {
  assert.equal(CONFIG.laps, 15);
  const track = new TrackSampler();
  const race = new RaceManager(track);
  const replay = new ReplayRecorder();
  let passedThree = false;
  while (!race.finished && race.time < 750) {
    race.update(CONFIG.step, strategicInput(race.player, track, race.cars));
    replay.record(race);
    if (race.player.completedLaps === 3) {
      passedThree = true;
      assert.equal(race.player.finishTime, null);
      assert.equal(race.finished, false);
    }
  }
  replay.record(race, true);
  assert.ok(passedThree);
  assert.equal(race.finished, true);
  for (const car of race.cars) {
    assert.equal(car.completedLaps, 15);
    assert.equal(car.nextCheckpoint, 181);
    assert.equal(car.lapTimes.length, 15);
  }
  assert.equal(replay.sample(replay.duration).cars[0].completedLaps, 15);
});

test("rain and storm lighting remain enabled after lap three through lap fifteen", () => {
  const scene = new Scene();
  scene.userData.sun = { intensity: 1 };
  const weather = new WeatherSystem(scene, { setWeather() {} });
  for (const lap of [3, 4, 10, 15]) {
    weather.setLap(lap);
    assert.equal(weather.rain.visible, true);
    assert.equal(scene.userData.sun.intensity, 2.2);
  }
  weather.setLap(1);
  assert.equal(weather.rain.visible, false);
});

test("legacy three-lap records survive while fifteen-lap records get their own top ten", () => {
  const memory = new Map([[CONFIG.storageKey, JSON.stringify({
    muted: true,
    records: [{ car: "zephyr", total: 30, bestLap: 9, position: 1 }],
  })]]);
  const adapter = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const storage = new Storage(adapter);
  const player = { id: "zephyr", completedLaps: 15, finishTime: 150, lapTimes: Array(15).fill(10) };
  const race = { player, ranking: () => [player] };
  for (let i = 0; i < 12; i++) storage.record(race);
  const restored = new Storage(adapter);
  assert.equal(restored.currentRecords().length, 10);
  assert.equal(restored.data.records.filter((r) => r.laps === 3).length, 1);
  assert.equal(restored.data.muted, true);
});
