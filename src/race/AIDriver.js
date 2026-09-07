import { CONFIG, clamp } from "../config.js";
export function strategicInput(car, track, cars = [], skill = 1) {
  const look = track.sample(car.distance + car.speed * 0.55);
  const surface = track.surface(car.distance + 2, car.lane, car.lap);
  const turnRisk =
    (look.curvature * (car.speed / CONFIG.speedScale) ** 2 * (surface.wet ? 1.55 : 1)) /
    (7.5 * car.spec.grip);
  let targetLane = look.turn * 0.75;
  if (surface.wetZone && car.lap === 2) targetLane = -1.25;
  const ahead = cars
    .filter(
      (other) =>
        other !== car &&
        other.finishTime === null &&
        other.distance > car.distance &&
        other.distance - car.distance < 4.5 &&
        Math.abs(other.lane - car.lane) < 0.9,
    )
    .sort((a, b) => a.distance - b.distance)[0];
  if (ahead) {
    const candidates = [-1.65, -0.55, 0.55, 1.65];
    candidates.sort((a, b) => Math.abs(a - car.lane) - Math.abs(b - car.lane));
    targetLane =
      candidates.find(
        (lane) =>
          !cars.some(
            (other) =>
              other !== car &&
              Math.abs(other.distance - car.distance) < 4 &&
              Math.abs(other.lane - lane) < 0.8,
          ),
      ) ?? -car.lane;
  }
  const stabilize =
    turnRisk > 0.84 * skill ||
    (surface.wind > 0.65 && Math.abs(car.lane) > 1.5);
  return {
    steer: clamp((targetLane - car.lane) * 2, -1, 1),
    boost:
      !stabilize &&
      look.curvature < 0.064 * skill &&
      car.heat < 70 * skill &&
      !car.overheated,
    stabilize,
  };
}
