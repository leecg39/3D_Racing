import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
export class CameraRig {
  constructor(canvas, track) {
    this.camera = new THREE.PerspectiveCamera(
      40,
      innerWidth / innerHeight,
      0.1,
      250,
    );
    this.track = track;
    this.mode = 0;
    this.reducedMotion = false;
    this.initialized = false;
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 19;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = Math.PI / 2.08;
    this.controls.target.set(0, 0.7, 0);
    this.target = new THREE.Vector3();
    this.garage();
  }
  garage() {
    this.controls.enabled = true;
    this.camera.fov = 38;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(6.4, 5.8, 8.2);
    this.controls.target.set(0, 0.75, 0);
    this.controls.update();
    this.initialized = false;
  }
  setMode(mode) {
    this.mode = mode;
    this.initialized = false;
  }
  focusPart(part, exploded) {
    const direction = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    this.controls.target.set(0, exploded ? 1.7 : 0.8, 0);
    this.camera.position
      .copy(this.controls.target)
      .addScaledVector(direction, exploded ? 13.7 : 10.6);
    this.controls.update();
  }
  update(dt, car, time, isGarage = false) {
    if (isGarage) {
      this.controls.update();
      return;
    }
    this.controls.enabled = false;
    const frame = this.track.sample(car.distance),
      point = frame.position.clone().addScaledVector(frame.side, car.lane);
    const mode =
      this.mode === 5 ? [0, 1, 4, 2][Math.floor(time / 7) % 4] : this.mode;
    let position, target;
    switch (mode) {
      case 1:
        position = new THREE.Vector3(46, 54, 59);
        target = new THREE.Vector3(0, 0, 0);
        break;
      case 2:
        position = point
          .clone()
          .addScaledVector(frame.forward, 0.65)
          .addScaledVector(frame.up, 0.95);
        {
          const ahead = this.track.sample(car.distance + (frame.loop ? 3 : 9));
          target = ahead.position.addScaledVector(ahead.up, 0.65);
        }
        break;
      case 3:
        position = point
          .clone()
          .addScaledVector(frame.side, 1.1)
          .addScaledVector(frame.forward, -0.6)
          .addScaledVector(frame.up, 0.6);
        target = point
          .clone()
          .addScaledVector(frame.forward, 4)
          .addScaledVector(frame.up, 0.5);
        break;
      case 4: {
        const fixed = this.track.sample(
          Math.floor(car.distance / 23) * 23 + 12,
        );
        position = fixed.position
          .clone()
          .addScaledVector(fixed.side, 8)
          .add(new THREE.Vector3(0, 5, 0));
        target = point.clone();
        break;
      }
      default:
        position = point
          .clone()
          .addScaledVector(
            frame.forward,
            frame.loop ? -3.7 : this.reducedMotion ? -9 : -7,
          )
          .addScaledVector(
            frame.up,
            frame.loop ? 2.3 : this.reducedMotion ? 5.5 : 4,
          );
        {
          const ahead = this.track.sample(
            car.distance + (frame.loop ? 2.5 : 6),
          );
          target = ahead.position.addScaledVector(ahead.up, 0.5);
        }
    }
    const smooth = this.initialized
      ? 1 - Math.exp(-dt * (mode === 2 || mode === 3 ? 24 : 8))
      : 1;
    this.camera.position.lerp(position, smooth);
    this.target.lerp(target, smooth);
    if (!this.reducedMotion && car.impactRemaining > 0) {
      const shake = car.impactRemaining * 0.2;
      this.camera.position.addScaledVector(frame.side, Math.sin(time * 95) * shake);
      this.camera.position.addScaledVector(frame.up, Math.sin(time * 71) * shake * 0.5);
    }
    const desiredUp = [0, 2, 3].includes(mode)
      ? frame.up
      : new THREE.Vector3(0, 1, 0);
    this.camera.up
      .lerp(desiredUp, this.initialized ? 1 - Math.exp(-dt * 12) : 1)
      .normalize();
    this.camera.lookAt(this.target);
    this.initialized = true;
    const fov = mode === 1 ? 42 : mode === 2 || mode === 3 ? 65 : 53;
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
