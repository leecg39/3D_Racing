import { CONFIG, clamp, damp } from "../config.js";
export class CarController {
  constructor(spec, index = 0) {
    this.spec = spec;
    this.id = spec.id;
    this.index = index;
    this.distance = 0;
    this.previousDistance = 0;
    this.speed = 0;
    this.lane = [-1.65, -0.55, 0.55, 1.65][index];
    this.lateralSpeed = 0;
    this.heat = 0;
    this.overheated = false;
    this.boosting = false;
    this.stabilizing = false;
    this.stability = 100;
    this.skidding = false;
    this.railContact = false;
    this.impactRemaining = 0;
    this.impactCooldown = 0;
    this.impactCount = 0;
    this.impactSide = 0;
    this.lap = 1;
    this.completedLaps = 0;
    this.nextCheckpoint = 1;
    this.lapTimes = [];
    this.lastLapAt = 0;
    this.finishTime = null;
    this.boostSeconds = 0;
    this.overheatCount = 0;
    this.wet = false;
    this.wind = 0;
  }
  update(dt, input, track, time) {
    if (this.finishTime !== null) return;
    this.impactRemaining = Math.max(0, this.impactRemaining - dt);
    this.impactCooldown = Math.max(0, this.impactCooldown - dt);
    const steer = Number.isFinite(input.steer) ? clamp(input.steer, -1, 1) : 0;
    this.previousDistance = this.distance;
    const frame = track.sample(this.distance);
    const surface = track.surface(this.distance, this.lane, this.lap);
    this.wet = surface.wet;
    this.wind = surface.wind;
    this.stabilizing = !!input.stabilize;
    this.boosting = !!input.boost && !this.overheated && !this.stabilizing && this.impactRemaining === 0;
    this.heat = clamp(
      this.heat +
        dt *
          (this.boosting
            ? CONFIG.heatRate
            : -(this.overheated ? CONFIG.overheatCooling : CONFIG.coolingRate) *
              this.spec.cooling),
      0,
      CONFIG.overheatAt,
    );
    if (this.heat >= CONFIG.overheatAt && !this.overheated) {
      this.overheated = true;
      this.overheatCount++;
      this.boosting = false;
    }
    if (this.overheated && this.heat <= CONFIG.recoverAt)
      this.overheated = false;
    if (this.boosting) this.boostSeconds += dt;
    const risk =
      ((frame.curvature * (this.speed / CONFIG.speedScale) ** 2 * (surface.wet ? 1.55 : 1)) /
        (7.5 * this.spec.grip)) *
      (this.stabilizing ? 0.35 : 1);
    this.skidding = risk > CONFIG.skidThreshold;
    this.stability = damp(
      this.stability,
      clamp(115 - risk * 48, 8, 100),
      5,
      dt,
    );
    const lateralTarget =
      steer * 3.6 * Math.sqrt(CONFIG.speedScale) +
      (this.skidding ? -frame.turn * Math.min(risk, 3) * 1.6 : 0) +
      surface.wind * (this.stabilizing ? 0.15 : 1);
    this.lateralSpeed = damp(
      this.lateralSpeed,
      lateralTarget,
      this.stabilizing ? 13 : 7,
      dt,
    );
    this.lane += this.lateralSpeed * dt;
    this.railContact = Math.abs(this.lane) > CONFIG.laneLimit;
    if (this.railContact && this.impactCooldown === 0 && Math.abs(this.lateralSpeed) > 0.55 && this.speed > 1) {
      this.impactSide = Math.sign(this.lane);
      this.impactCount++;
      this.impactRemaining = CONFIG.impactDuration;
      this.impactCooldown = CONFIG.impactCooldown;
      this.speed *= CONFIG.impactSpeedRetention;
      this.lateralSpeed = -this.impactSide * Math.max(0.9, Math.abs(this.lateralSpeed) * 0.4);
      this.lane = this.impactSide * (CONFIG.laneLimit - 0.06);
      this.boosting = false;
    }
    this.lane = clamp(this.lane, -CONFIG.laneLimit, CONFIG.laneLimit);
    let target = CONFIG.baseSpeed * this.spec.speed;
    target *= clamp(1 - frame.forward.y * 0.18, 0.82, 1.18);
    if (this.boosting) target *= CONFIG.boostMultiplier;
    if (this.stabilizing) target *= CONFIG.stabilizeMultiplier;
    if (this.overheated) target *= 0.64;
    if (this.impactRemaining > 0) target *= 0.7;
    if (this.skidding) target *= clamp(1.08 - risk * 0.21, 0.43, 0.88);
    if (this.railContact && (this.skidding || Math.abs(steer) > 0))
      target *= 0.82;
    target = Math.min(target, CONFIG.maxSpeed);
    this.speed = damp(this.speed, target, target > this.speed ? (this.boosting ? 6 : 2.2) : 4.8, dt);
    this.speed = clamp(this.speed, 0, CONFIG.maxSpeed);
    // An inside line covers a shorter physical arc. The benefit is bounded.
    const lineFactor = clamp(
      1 - frame.curvature * this.lane * frame.turn,
      0.89,
      1.11,
    );
    this.distance += (this.speed / lineFactor) * dt;
  }
  snapshot() {
    return {
      id: this.id,
      distance: this.distance,
      lane: this.lane,
      speed: this.speed,
      heat: this.heat,
      lap: this.lap,
      completedLaps: this.completedLaps,
      lapTimes: [...this.lapTimes],
      boosting: this.boosting,
      stabilizing: this.stabilizing,
      stability: this.stability,
      overheated: this.overheated,
      finishTime: this.finishTime,
      wet: this.wet,
      wind: this.wind,
      impactRemaining: this.impactRemaining,
      impactCount: this.impactCount,
      impactSide: this.impactSide,
    };
  }
}
