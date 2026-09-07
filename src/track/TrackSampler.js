import { CatmullRomCurve3, Vector3, Quaternion } from "three";
import { CONFIG } from "../config.js";
export const TRACK_POINTS = [
  [-21, 0.85, 13],
  [-6, 0.85, 14],
  [12, 0.85, 13],
  [25, 1, 6],
  [24, 1.1, -6],
  [18, 1.1, -14],
  [11, 1.1, -16],
  ...Array.from({ length: 25 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    return [
      6 - 5.1 * Math.sin(angle),
      1.1 + 5.1 * (1 - Math.cos(angle)),
      -16 + (i / 24) * 6.2,
    ];
  }),
  [-1, 1.2, -9.5],
  [-9, 3.4, -2],
  [-20, 1.6, -7],
  [-29, 0.85, 0],
];
export class TrackSampler {
  constructor() {
    this.curve = new CatmullRomCurve3(
      TRACK_POINTS.map((p) => new Vector3(...p)),
      true,
      "centripetal",
    );
    this.curve.arcLengthDivisions = 2400;
    this.curve.updateArcLengths();
    this.length = this.curve.getLength();
    this.width = CONFIG.trackWidth;
    this.samples = Array.from({ length: 1600 }, (_, i) =>
      this.compute(i / 1600),
    );
    // Parallel transport keeps the road and car orientation continuous through
    // the vertical loop, including the two places with a vertical tangent.
    const q = new Quaternion();
    for (let i = 1; i < this.samples.length; i++) {
      const prev = this.samples[i - 1],
        current = this.samples[i];
      q.setFromUnitVectors(prev.forward, current.forward);
      current.up.copy(prev.up).applyQuaternion(q).normalize();
      current.side.crossVectors(current.up, current.forward).normalize();
      current.up.crossVectors(current.forward, current.side).normalize();
    }
    const first = this.samples[0],
      last = this.samples.at(-1);
    q.setFromUnitVectors(last.forward, first.forward);
    const endUp = last.up.clone().applyQuaternion(q);
    const twist = Math.atan2(
      first.forward.dot(endUp.clone().cross(first.up)),
      endUp.dot(first.up),
    );
    for (const frame of this.samples) {
      frame.up.applyAxisAngle(frame.forward, twist * frame.t);
      frame.side.crossVectors(frame.up, frame.forward).normalize();
      frame.up.crossVectors(frame.forward, frame.side).normalize();
    }
    for (let i = 0; i < this.samples.length; i++) {
      const frame = this.samples[i],
        next = this.samples[(i + 5) % this.samples.length];
      const signedCurve =
        next.forward.clone().sub(frame.forward).dot(frame.side) /
        ((this.length * 5) / this.samples.length);
      frame.curvature = Math.abs(signedCurve);
      frame.turn = Math.sign(signedCurve);
    }
  }
  compute(t) {
    const position = this.curve.getPointAt(t);
    const forward = this.curve.getTangentAt(t).normalize();
    const side = new Vector3()
      .crossVectors(new Vector3(0, 1, 0), forward)
      .normalize();
    const up = new Vector3().crossVectors(forward, side).normalize();
    const next = this.curve.getTangentAt((t + 0.004) % 1).normalize();
    const curvature =
      Math.acos(Math.min(1, Math.max(-1, forward.dot(next)))) /
      (0.004 * this.length);
    const turn = Math.sign(forward.z * next.x - forward.x * next.z);
    return { position, forward, side, up, curvature, turn, t };
  }
  sample(distance) {
    const t =
      (((distance % this.length) + this.length) % this.length) / this.length;
    const index = t * this.samples.length,
      a = this.samples[Math.floor(index) % this.samples.length],
      b = this.samples[(Math.floor(index) + 1) % this.samples.length];
    const f = index % 1;
    return {
      position: a.position.clone().lerp(b.position, f),
      forward: a.forward.clone().lerp(b.forward, f).normalize(),
      side: a.side.clone().lerp(b.side, f).normalize(),
      up: a.up.clone().lerp(b.up, f).normalize(),
      curvature: a.curvature + (b.curvature - a.curvature) * f,
      turn: a.turn,
      loop: a.position.y > 4.5 && a.position.x > 0 && a.position.z < -9,
      t,
    };
  }
  surface(distance, lane, lap) {
    const t =
      (((distance % this.length) + this.length) % this.length) / this.length;
    const wetZone = (t > 0.21 && t < 0.4) || (t > 0.65 && t < 0.79);
    return {
      wet: lap >= 2 && wetZone && (lane > -0.3 || lap >= 3),
      wind:
        lap >= 3 && t > 0.42 && t < 0.61
          ? Math.sin(((t - 0.42) / 0.19) * Math.PI) * 0.8
          : 0,
      wetZone,
    };
  }
}
