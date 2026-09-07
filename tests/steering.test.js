import test from "node:test";
import assert from "node:assert/strict";
import { Group, PerspectiveCamera } from "three";
import { CONFIG, CARS } from "../src/config.js";
import { InputManager } from "../src/input/InputManager.js";
import { CarController } from "../src/car/CarController.js";
import { placeCarOnTrack } from "../src/car/CarPlacement.js";
import { TrackSampler } from "../src/track/TrackSampler.js";

const track = new TrackSampler();
const readKeys = (...codes) =>
  InputManager.prototype.read.call({ keys: new Set(codes) });

for (const [code, screenDirection] of [
  ["ArrowLeft", -1],
  ["ArrowRight", 1],
  ["KeyA", -1],
  ["KeyD", 1],
]) {
  test(`${code} moves the car toward the matching driver-view screen edge`, () => {
    // Include banked corners and the inverted loop, with the camera's up axis
    // following the road just as it does in the driving cameras.
    for (let i = 0; i < 100; i++) {
      const car = new CarController(CARS[0]);
      car.distance = (track.length * i) / 100;
      car.lane = 0;
      car.update(CONFIG.step, readKeys(code), track, 0);
      const model = { root: new Group(), wheelPivots: [], tireRadius: 0.43 };
      const frame = placeCarOnTrack(model, track, car.distance, car.lane);
      const camera = new PerspectiveCamera(53, 16 / 9, 0.1, 250);
      camera.position.copy(frame.position)
        .addScaledVector(frame.forward, -7)
        .addScaledVector(frame.up, 4);
      camera.up.copy(frame.up);
      camera.lookAt(frame.position.clone().addScaledVector(frame.forward, 6));
      camera.updateMatrixWorld(true);
      const centerX = frame.position.clone().project(camera).x;
      const carX = model.root.position.clone().project(camera).x;
      assert.ok(
        (carX - centerX) * screenDirection > 0,
        `${code} at track sample ${i}: screen displacement ${carX - centerX}`,
      );
    }
  });
}

test("opposite steering keys cancel and duplicate bindings do not double steering", () => {
  for (const left of ["ArrowLeft", "KeyA"]) {
    for (const right of ["ArrowRight", "KeyD"]) {
      assert.equal(readKeys(left, right).steer, 0);
    }
  }
  assert.equal(readKeys().steer, 0);
  assert.equal(readKeys("ArrowLeft", "KeyA").steer, readKeys("ArrowLeft").steer);
  assert.equal(readKeys("ArrowRight", "KeyD").steer, readKeys("ArrowRight").steer);
});
