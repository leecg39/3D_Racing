import { CONFIG } from "../config.js";
export class ReplayRecorder {
  constructor() {
    this.frames = [];
    this.nextAt = 0;
  }
  record(race, force = false) {
    if (force || race.time + 1e-6 >= this.nextAt) {
      this.frames.push(race.snapshot());
      this.nextAt = race.time + 1 / CONFIG.replayHz;
    }
  }
  get duration() {
    return this.frames.at(-1)?.time ?? 0;
  }
  sample(time) {
    if (!this.frames.length) return null;
    let low = 0,
      high = this.frames.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.frames[mid].time <= time) low = mid;
      else high = mid - 1;
    }
    const a = this.frames[low],
      b = this.frames[Math.min(low + 1, this.frames.length - 1)];
    const mix = Math.max(
      0,
      Math.min(1, (time - a.time) / Math.max(0.0001, b.time - a.time)),
    );
    return {
      time,
      cars: a.cars.map((car, i) => ({
        ...car,
        distance: car.distance + (b.cars[i].distance - car.distance) * mix,
        lane: car.lane + (b.cars[i].lane - car.lane) * mix,
        speed: car.speed + (b.cars[i].speed - car.speed) * mix,
      })),
    };
  }
}
