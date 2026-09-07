import test from "node:test";
import assert from "node:assert/strict";
import { Group, Vector3 } from "three";
import { CONFIG, CARS } from "../src/config.js";
import { CarController } from "../src/car/CarController.js";
import { placeCarOnTrack } from "../src/car/CarPlacement.js";
import { TrackSampler } from "../src/track/TrackSampler.js";
import { Storage } from "../src/core/Storage.js";
import { AudioManager } from "../src/audio/AudioManager.js";

const straight = {
  sample: () => ({ curvature: 0, turn: 0, forward: { y: 0 } }),
  surface: () => ({ wet: false, wind: 0 }),
};
test("all four cars have +150% cruise speed and a strict 400 km/h boost cap", () => {
  assert.equal(CONFIG.baseSpeed, 7.1 * 2.5);
  assert.equal(CONFIG.maxSpeed * 10, 400);
  for (const spec of CARS) {
    const car = new CarController(spec);
    for (let i = 0; i < 600; i++) car.update(CONFIG.step, {}, straight, 0);
    assert.ok(Math.abs(car.speed - CONFIG.baseSpeed * spec.speed) < 1e-6);
    const cruise = car.speed;
    for (let i = 0; i < 60; i++) car.update(CONFIG.step, { boost: true }, straight, 0);
    assert.ok(car.speed > cruise * 1.6);
    for (let i = 0; i < 75; i++) car.update(CONFIG.step, { boost: true }, straight, 0);
    assert.equal(Math.round(car.speed * 10), 400);
    for (let i = 0; i < 600; i++) {
      car.update(CONFIG.step, { boost: true }, straight, 0);
      assert.ok(car.speed <= CONFIG.maxSpeed);
    }
  }
});
test("steep downhill boosting cannot exceed the speed cap", () => {
  const downhill = { ...straight, sample: () => ({ curvature: 0, turn: 0, forward: { y: -1 } }) };
  for (const spec of CARS) {
    const car = new CarController(spec);
    for (let i = 0; i < 180; i++) {
      car.update(CONFIG.step, { boost: true }, downhill, 0);
      assert.ok(car.speed <= CONFIG.maxSpeed);
    }
  }
});
test("either rail causes an immediate speed loss, inward impulse and recovery", () => {
  for (const side of [-1, 1]) {
    const car = new CarController(CARS[0]);
    car.speed = CONFIG.baseSpeed;
    car.lane = side * (CONFIG.laneLimit - 0.001);
    car.lateralSpeed = side * 3;
    car.update(CONFIG.step, { steer: side, boost: true }, straight, 0);
    assert.equal(car.impactCount, 1);
    assert.equal(car.impactSide, side);
    assert.ok(car.speed < CONFIG.baseSpeed * 0.72);
    assert.ok(car.lateralSpeed * side < 0);
    assert.ok(Math.abs(car.lane) <= CONFIG.laneLimit);
    assert.equal(car.boosting, false);
    for (let i = 0; i < 15; i++) car.update(CONFIG.step, { steer: side }, straight, 0);
    assert.equal(car.impactCount, 1, "holding the rail cannot create one hit every frame");
    for (let i = 0; i < 120; i++) car.update(CONFIG.step, { steer: -side * 0.1 }, straight, 0);
    assert.equal(car.impactRemaining, 0);
    assert.ok(car.speed > CONFIG.baseSpeed * 0.95);
    assert.equal(car.snapshot().impactCount, car.impactCount);
  }
});
test("stationary contact does not repeatedly trigger impact effects", () => {
  const car = new CarController(CARS[0]);
  car.lane = CONFIG.laneLimit;
  car.update(CONFIG.step, { steer: 1 }, straight, 0);
  assert.equal(car.impactCount, 0);
});
test("tires meet sampled road height on flat, banked and inverted track", () => {
  const track = new TrackSampler();
  for (const tireRadius of [0.411, 0.436]) {
    const root = new Group();
    root.scale.setScalar(0.63);
    const wheelPivots = [];
    for (const x of [-0.99, 0.99]) for (const z of [-1.15, 1.1]) {
      const wheel = new Group();
      wheel.position.set(x, 0.43, z);
      wheel.userData.base = wheel.position.clone();
      root.add(wheel);
      wheelPivots.push(wheel);
    }
    const model = { root, wheelPivots, tireRadius };
    for (let i = 0; i < 400; i++) {
      const distance = (track.length * i) / 400;
      const lane = Math.sin(i) * CONFIG.laneLimit;
      const frame = placeCarOnTrack(model, track, distance, lane);
      root.updateMatrixWorld(true);
      for (const wheel of wheelPivots) {
        const road = track.sample(distance + wheel.userData.base.z * 0.63);
        const contact = road.position.addScaledVector(road.side, lane + wheel.userData.base.x * 0.63);
        const bottom = wheel.getWorldPosition(new Vector3()).addScaledVector(frame.up, -tireRadius * 0.63);
        assert.ok(Math.abs(bottom.sub(contact).dot(frame.up)) < 1e-6);
      }
    }
  }
});
test("new audio settings are audible while saved mute and zero volume are respected", () => {
  const fresh = new Storage({ getItem: () => null });
  assert.equal(fresh.data.muted, false);
  assert.equal(fresh.data.volume, 0.5);
  const saved = new Storage({ getItem: () => JSON.stringify({ muted: true, volume: 0 }) });
  assert.equal(saved.data.muted, true);
  assert.equal(saved.data.volume, 0);
});
test("missing Web Audio reports failure without preventing gameplay", async () => {
  const statuses = [];
  const audio = new AudioManager({ muted: false, volume: 0.5 }, (value) => statuses.push(value));
  assert.equal(await audio.unlock(), false);
  audio.setActive(true);
  audio.update({ speed: 10 }, 1);
  audio.beep();
  audio.impact();
  assert.deepEqual(statuses, ["unsupported"]);
});
