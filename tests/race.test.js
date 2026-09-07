import test from "node:test";
import assert from "node:assert/strict";
import { CARS, CONFIG } from "../src/config.js";
import { TrackSampler } from "../src/track/TrackSampler.js";
import { RaceManager } from "../src/race/RaceManager.js";
import { strategicInput } from "../src/race/AIDriver.js";
import { FixedClock } from "../src/core/GameLoop.js";
import { GameState } from "../src/core/GameState.js";
import { ReplayRecorder } from "../src/replay/ReplayRecorder.js";
import { Storage } from "../src/core/Storage.js";
import { CarController } from "../src/car/CarController.js";
import { Scene } from "three";
import { WeatherSystem } from "../src/weather/WeatherSystem.js";
const track = new TrackSampler();
test("reset during a fixed tick does not leave a negative accumulator", () => {
  const clock = new FixedClock();
  let count = 0;
  clock.advance(0.1, () => {
    count++;
    clock.reset();
  });
  assert.equal(clock.accumulator, 0);
  assert.equal(count, 1);
  clock.advance(CONFIG.step, () => {
    count++;
  });
  assert.equal(count, 2);
});
test("loop frames invert continuously and reconnect at the finish line", () => {
  assert.ok(track.samples.some((frame) => frame.up.y < -0.95));
  assert.ok(track.samples.some((frame) => frame.forward.y > 0.98));
  for (let i = 1; i < track.samples.length; i++)
    assert.ok(track.samples[i].up.dot(track.samples[i - 1].up) > 0.98);
  assert.ok(track.samples[0].up.dot(track.samples.at(-1).up) > 0.99);
});
test("rain particles seek to the same recorded time independent of previous playback", () => {
  const scene = new Scene();
  scene.userData.sun = { intensity: 1 };
  const weather = new WeatherSystem(scene, { setWeather() {} });
  weather.setLap(3);
  weather.update(65);
  const positions = [...weather.positions];
  weather.update(79);
  weather.update(10);
  weather.update(65);
  assert.deepEqual([...weather.positions], positions);
});
function simulate(mode, spec = CARS[0], hz = 60, record = false) {
  const race = new RaceManager(track, spec),
    clock = new FixedClock(),
    recorder = new ReplayRecorder();
  for (let i = 0; i < hz * CONFIG.laps * 50 && !race.finished; i++) {
    clock.advance(1 / hz, (dt) => {
      const input =
        mode === "strategy"
          ? strategicInput(race.player, track, race.cars)
          : mode === "script"
            ? {
                steer: Math.sin(race.time * 0.7) > 0.85 ? 1 : 0,
                boost: race.time % 8 < 2,
                stabilize: race.time % 8 > 6,
              }
            : {
                steer: 0,
                boost: mode === "boost" || mode === "both",
                stabilize: mode === "both",
              };
      race.update(dt, input);
      if (record) recorder.record(race);
    });
  }
  return { race, recorder };
}
test("all four cars finish ordered checkpoints and all configured laps", () => {
  for (const spec of CARS) {
    const { race } = simulate("strategy", spec);
    assert.equal(race.finished, true);
    for (const car of race.cars) {
      assert.equal(car.completedLaps, CONFIG.laps);
      assert.equal(car.nextCheckpoint, CONFIG.checkpoints * CONFIG.laps + 1);
      assert.equal(car.lapTimes.length, CONFIG.laps);
      assert.ok(car.finishTime > (track.length * CONFIG.laps) / CONFIG.maxSpeed && car.finishTime < CONFIG.laps * 50);
      assert.ok(
        Math.abs(car.lapTimes.reduce((sum, t) => sum + t, 0) - car.finishTime) <
          1e-9,
      );
      assert.equal(car.distance, track.length * CONFIG.laps);
    }
    const times = race.ranking().map((c) => c.finishTime);
    assert.deepEqual(
      times,
      [...times].sort((a, b) => a - b),
    );
  }
});
test("strategic input beats idle, held boost, and both buttons for every car", () => {
  for (const spec of CARS) {
    const strategy = simulate("strategy", spec).race.player;
    const idle = simulate("none", spec).race.player;
    const boost = simulate("boost", spec).race.player;
    const both = simulate("both", spec).race.player;
    assert.ok(
      strategy.finishTime < idle.finishTime - 1 / CONFIG.speedScale,
      `${spec.id}: strategy vs idle`,
    );
    assert.ok(
      strategy.finishTime < boost.finishTime - 3 / CONFIG.speedScale,
      `${spec.id}: strategy vs held boost`,
    );
    assert.ok(
      strategy.finishTime < both.finishTime - 8 / CONFIG.speedScale,
      `${spec.id}: strategy vs simultaneous input`,
    );
    assert.ok(boost.overheatCount >= 2);
    assert.equal(strategy.overheatCount, 0);
    assert.equal(both.boostSeconds, 0);
  }
});
test("same scripted input gives identical distance, heat, laps and finish at 30/60/120 Hz", () => {
  const results = [30, 60, 120].map(
    (hz) => simulate("script", CARS[0], hz).race,
  );
  for (const other of results.slice(1))
    for (let i = 0; i < 4; i++) {
      assert.ok(
        Math.abs(results[0].cars[i].finishTime - other.cars[i].finishTime) <
          1e-9,
      );
      assert.ok(Math.abs(results[0].cars[i].heat - other.cars[i].heat) < 1e-9);
      assert.deepEqual(results[0].cars[i].lapTimes, other.cars[i].lapTimes);
    }
});
test("teleport and reverse progress cannot award a lap", () => {
  const race = new RaceManager(track),
    car = race.player;
  car.distance = track.length * 2.99;
  race.checkProgress(car, CONFIG.step);
  assert.equal(car.distance, 0);
  assert.equal(car.completedLaps, 0);
  assert.equal(car.nextCheckpoint, 1);
  car.previousDistance = 10;
  car.distance = 9;
  race.checkProgress(car, CONFIG.step);
  assert.equal(car.distance, 10);
  car.distance = track.length;
  car.previousDistance = track.length - 0.01;
  race.checkProgress(car, CONFIG.step);
  assert.equal(
    car.completedLaps,
    0,
    "cannot skip required earlier checkpoints",
  );
});
test("finish handling is idempotent and final order remains fixed", () => {
  const { race } = simulate("strategy");
  const snapshot = JSON.stringify(race.snapshot());
  for (let i = 0; i < 100; i++) race.update(CONFIG.step, { boost: true });
  assert.equal(JSON.stringify(race.snapshot()), snapshot);
});
test("ten consecutive full races are independent, deterministic, and have bounded replays", () => {
  let expected;
  for (let i = 0; i < 10; i++) {
    const { race, recorder } = simulate("strategy", CARS[0], 60, true);
    assert.ok(recorder.frames.length < CONFIG.laps * 50 * CONFIG.replayHz + 2);
    assert.ok(recorder.duration > (track.length * CONFIG.laps) / CONFIG.maxSpeed);
    expected ??= JSON.stringify(race.snapshot());
    assert.equal(JSON.stringify(race.snapshot()), expected);
  }
});
test("replay interpolates real recorded positions and cannot mutate original race", () => {
  const { race, recorder } = simulate("strategy", CARS[0], 60, true);
  const original = JSON.stringify(race.snapshot()),
    a = recorder.frames[30],
    b = recorder.frames[31];
  const middle = recorder.sample((a.time + b.time) / 2);
  assert.ok(
    Math.abs(
      middle.cars[0].distance - (a.cars[0].distance + b.cars[0].distance) / 2,
    ) < 1e-8,
  );
  middle.cars[0].distance = 123456;
  recorder.sample(1);
  recorder.sample(60);
  recorder.sample(0);
  assert.equal(JSON.stringify(race.snapshot()), original);
  assert.notEqual(a.cars[0].distance, 123456);
});
test("weather changes grip, has a dry avoidance line in lap two, and predictable wind", () => {
  const d = track.length * 0.3;
  assert.equal(track.surface(d, 1, 1).wet, false);
  assert.equal(track.surface(d, 1, 2).wet, true);
  assert.equal(track.surface(d, -1, 2).wet, false);
  assert.equal(track.surface(d, -1, 3).wet, true);
  assert.ok(track.surface(track.length * 0.5, 0, 3).wind > 0.6);
  const dry = new CarController(CARS[0]),
    wet = new CarController(CARS[0]);
  dry.distance = wet.distance = d;
  dry.speed = wet.speed = 12 * CONFIG.speedScale;
  dry.lane = wet.lane = 1;
  wet.lap = 2;
  for (let i = 0; i < 30; i++) {
    dry.update(CONFIG.step, {}, track, 0);
    wet.update(CONFIG.step, {}, track, 0);
  }
  assert.ok(wet.stability < dry.stability);
});
test("track frame is continuous and right-handed, road and path share the same curve", () => {
  for (let i = 0; i < 200; i++) {
    const frame = track.sample((i / 200) * track.length);
    assert.ok(Math.abs(frame.forward.dot(frame.side)) < 0.002);
    assert.ok(frame.side.clone().cross(frame.up).dot(frame.forward) > 0.999);
    assert.ok(
      frame.position.distanceTo(track.curve.getPointAt(i / 200)) < 0.03,
    );
  }
  assert.ok(
    track.sample(0).position.distanceTo(track.sample(track.length).position) <
      1e-9,
  );
});
test("large background delta is capped and reset drops accumulated time", () => {
  const clock = new FixedClock();
  let ticks = 0;
  clock.advance(60, () => ticks++);
  assert.equal(ticks, 6);
  clock.advance(0.007, () => ticks++);
  clock.reset();
  clock.advance(0.01, () => ticks++);
  assert.equal(ticks, 6);
});
test("state rejects duplicate starts and invalid jumps", () => {
  const state = new GameState();
  state.set("garage");
  state.set("countdown");
  assert.equal(state.set("countdown"), false);
  state.set("paused");
  state.set("countdown");
  state.set("racing");
  state.set("results");
  state.set("replay");
  state.set("paused");
  state.set("replay");
  state.set("results");
  state.set("garage");
  assert.throws(() => state.set("results"), /Invalid state/);
});
test("storage tolerates denied access, corrupt data and invalid records", () => {
  const denied = new Storage({
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  });
  assert.equal(denied.available, false);
  denied.save();
  const corrupt = new Storage({ getItem: () => "{invalid" });
  assert.equal(corrupt.data.selected, "zephyr");
  const invalid = new Storage({
    getItem: () =>
      JSON.stringify({
        selected: "fake",
        volume: 999,
        records: [{ car: "<script>", total: 4 }],
      }),
  });
  assert.deepEqual(invalid.data.records, []);
  assert.equal(invalid.data.selected, "zephyr");
  assert.equal(invalid.data.volume, 1);
  const memory = new Map(),
    storage = new Storage({
      getItem: (k) => memory.get(k),
      setItem: (k, v) => memory.set(k, v),
    });
  const { race } = simulate("strategy");
  for (let i = 0; i < 15; i++) storage.record(race);
  assert.equal(storage.data.records.length, 10);
  assert.equal(
    new Storage({ getItem: (k) => memory.get(k) }).data.records.length,
    10,
  );
});
