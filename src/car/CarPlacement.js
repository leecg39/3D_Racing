import { Matrix4 } from "three";

const basis = new Matrix4();

// The road ribbon and wheel contact points use the same transported track frame.
// Four small suspension offsets keep the tires on banked roads and the loop.
export function placeCarOnTrack(model, track, distance, lane) {
  const frame = track.sample(distance);
  const scale = model.root.scale.x;
  model.root.position.copy(frame.position)
    .addScaledVector(frame.side, lane)
    .addScaledVector(frame.up, (model.tireRadius - 0.43) * scale);
  basis.makeBasis(frame.side, frame.up, frame.forward);
  model.root.quaternion.setFromRotationMatrix(basis);
  for (const wheel of model.wheelPivots) {
    const base = wheel.userData.base;
    const ground = track.sample(distance + base.z * scale);
    const contact = ground.position.addScaledVector(ground.side, lane + base.x * scale);
    wheel.position.y = contact.sub(model.root.position).dot(frame.up) / scale + model.tireRadius;
    wheel.rotation.x = distance / (model.tireRadius * scale);
  }
  model.updateContactShadows?.();
  return frame;
}
