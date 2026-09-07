import { CONFIG, CARS } from "../config.js";
import { CarController } from "../car/CarController.js";
import { strategicInput } from "./AIDriver.js";
export class RaceManager {
  constructor(track, selected = CARS[0]) {
    this.track = track;
    this.cars = [selected, ...CARS.filter((car) => car.id !== selected.id)].map(
      (spec, i) => new CarController(spec, i),
    );
    this.player = this.cars[0];
    this.time = 0;
    this.finished = false;
    this.playerFinished = false;
  }
  update(dt, playerInput) {
    if (this.finished) return;
    this.time += dt;
    for (const car of this.cars) {
      car.update(
        dt,
        car.index === 0
          ? playerInput
          : strategicInput(
              car,
              this.track,
              this.cars,
              [1, 0.88, 0.94, 0.84][car.index],
            ),
        this.track,
        this.time,
      );
    }
    // Resolve front-to-back; only a car actually ahead can slow a follower.
    const moving = this.cars
      .filter((car) => car.finishTime === null)
      .sort((a, b) => b.distance - a.distance);
    for (let i = 1; i < moving.length; i++) {
      const car = moving[i];
      for (let j = 0; j < i; j++) {
        const ahead = moving[j],
          gap = ahead.distance - car.distance;
        if (gap >= 0 && gap < 1.85 && Math.abs(ahead.lane - car.lane) < 0.76) {
          car.distance = Math.max(car.previousDistance, ahead.distance - 1.85);
          car.speed = Math.min(car.speed, ahead.speed * 0.98);
        }
      }
    }
    for (const car of this.cars) this.checkProgress(car, dt);
    this.playerFinished = this.player.finishTime !== null;
    this.finished = this.cars.every((car) => car.finishTime !== null);
  }
  checkProgress(car, dt) {
    if (car.finishTime !== null) return;
    const spacing = this.track.length / CONFIG.checkpoints;
    // Ordered checkpoint index is authoritative; reject teleports and reverse movement.
    const delta = car.distance - car.previousDistance;
    if (
      delta < 0 ||
      delta > CONFIG.baseSpeed * CONFIG.boostMultiplier * 2 * dt + 0.01
    ) {
      car.distance = car.previousDistance;
      return;
    }
    while (car.distance >= car.nextCheckpoint * spacing) {
      const at = car.nextCheckpoint * spacing;
      if (car.previousDistance > at) break;
      if (car.nextCheckpoint % CONFIG.checkpoints === 0) {
        const crossing =
          this.time -
          dt +
          (dt * (at - car.previousDistance)) / Math.max(delta, 0.000001);
        car.completedLaps++;
        car.lapTimes.push(crossing - car.lastLapAt);
        car.lastLapAt = crossing;
        car.lap = Math.min(CONFIG.laps, car.completedLaps + 1);
        if (car.completedLaps >= CONFIG.laps) {
          car.finishTime = crossing;
          car.distance = CONFIG.laps * this.track.length;
          car.speed = 0;
        }
      }
      car.nextCheckpoint++;
      if (car.finishTime !== null) break;
    }
  }
  ranking() {
    return [...this.cars].sort((a, b) => {
      if (a.finishTime !== null && b.finishTime !== null)
        return a.finishTime - b.finishTime;
      if (a.finishTime !== null) return -1;
      if (b.finishTime !== null) return 1;
      return b.distance - a.distance || a.index - b.index;
    });
  }
  snapshot() {
    return { time: this.time, cars: this.cars.map((car) => car.snapshot()) };
  }
}
