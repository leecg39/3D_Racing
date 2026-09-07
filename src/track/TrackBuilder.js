import * as THREE from "three";
import { material, cylinder, box, labelTexture } from "../world/materials.js";
export function buildRibbon(
  track,
  offsetA,
  offsetB,
  elevation = 0,
  start = 0,
  end = 1,
  segments = 600,
) {
  const positions = [],
    normals = [],
    uv = [],
    indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = start + ((end - start) * i) / segments,
      s = track.sample(t * track.length);
    for (const offset of [offsetA, offsetB]) {
      const p = s.position
        .clone()
        .addScaledVector(s.side, offset)
        .addScaledVector(s.up, elevation);
      positions.push(p.x, p.y, p.z);
      normals.push(s.up.x, s.up.y, s.up.z);
      uv.push(offset === offsetA ? 0 : 1, t * 50);
    }
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  return geo;
}
export class TrackBuilder {
  constructor(track) {
    this.root = new THREE.Group();
    this.wetPatches = [];
    const road = material("#252d38", 0.65, 0.15),
      rail = material("#293039", 0.48, 0.4),
      support = material("#26323a", 0.55, 0.3);
    road.side = THREE.DoubleSide;
    const surface = new THREE.Mesh(buildRibbon(track, -2.8, 2.8), road);
    surface.receiveShadow = true;
    this.root.add(surface);
    for (const side of [-1, 1]) {
      const baseGeometry = buildRibbon(track, side * 2.47, side * 2.78, 0.022);
      const curb = baseGeometry.toNonIndexed();
      baseGeometry.dispose();
      const colors = new Float32Array(curb.getAttribute("position").count * 3);
      const red = new THREE.Color("#d9332d"),
        white = new THREE.Color("#e7eaf0");
      for (let i = 0; i < colors.length / 3; i++)
        (Math.floor(i / 30) % 2 ? red : white).toArray(colors, i * 3);
      curb.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const strip = new THREE.Mesh(
        curb,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.6,
          side: THREE.DoubleSide,
        }),
      );
      this.root.add(strip);
      const points = Array.from({ length: 501 }, (_, i) => {
        const s = track.sample((track.length * i) / 500);
        return s.position
          .addScaledVector(s.side, side * 2.82)
          .addScaledVector(s.up, 0.26);
      });
      const curve = new THREE.CatmullRomCurve3(points, true);
      const bar = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 700, 0.12, 6, true),
        rail,
      );
      bar.castShadow = true;
      this.root.add(bar);
    }
    for (const offset of [-1.4, 0, 1.4]) {
      const strip = new THREE.Mesh(
        buildRibbon(track, offset - 0.018, offset + 0.018, 0.019),
        material("#c5c4ac", 1),
      );
      strip.material.side = THREE.DoubleSide;
      this.root.add(strip);
    }
    const dummy = new THREE.Object3D();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const posts = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.075, 0.1, 0.35, 6),
      rail,
      160,
    );
    for (let i = 0; i < 80; i++) {
      const sample = track.sample((i / 80) * track.length);
      for (const side of [-1, 1]) {
        dummy.position
          .copy(sample.position)
          .addScaledVector(sample.side, side * 2.82)
          .addScaledVector(sample.up, 0.1);
        dummy.quaternion.setFromUnitVectors(upAxis, sample.up);
        dummy.updateMatrix();
        posts.setMatrixAt(i * 2 + (side + 1) / 2, dummy.matrix);
      }
    }
    posts.castShadow = true;
    this.root.add(posts);
    dummy.quaternion.identity();
    const supports = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      support,
      48,
    );
    for (let i = 0; i < 24; i++) {
      const sample = track.sample((i / 24) * track.length);
      for (const side of [-1, 1]) {
        dummy.position
          .copy(sample.position)
          .addScaledVector(sample.side, side * 2.1);
        dummy.position.y = sample.position.y / 2;
        dummy.scale.set(0.3, sample.position.y, 0.45);
        dummy.rotation.y = Math.atan2(sample.forward.x, sample.forward.z);
        dummy.updateMatrix();
        supports.setMatrixAt(i * 2 + (side + 1) / 2, dummy.matrix);
      }
    }
    supports.castShadow = true;
    supports.receiveShadow = true;
    this.root.add(supports);
    for (const [a, b] of [
      [0.21, 0.4],
      [0.65, 0.79],
    ]) {
      const wet = new THREE.Mesh(
        buildRibbon(track, -0.3, 2.6, 0.032, a, b, 140),
        new THREE.MeshPhysicalMaterial({
          color: "#789c99",
          transparent: true,
          opacity: 0.47,
          roughness: 0.14,
          metalness: 0.4,
          side: THREE.DoubleSide,
        }),
      );
      wet.visible = false;
      this.wetPatches.push(wet);
      this.root.add(wet);
      const stormWet = new THREE.Mesh(
        buildRibbon(track, -2.6, -0.3, 0.031, a, b, 140),
        wet.material,
      );
      stormWet.visible = false;
      stormWet.userData.storm = true;
      this.wetPatches.push(stormWet);
      this.root.add(stormWet);
    }
    const start = track.sample(0),
      gate = new THREE.Group();
    gate.position.copy(start.position);
    gate.rotation.y = Math.atan2(start.forward.x, start.forward.z);
    this.root.add(gate);
    for (const x of [-3.2, 3.2]) box(gate, [0.2, 3.3, 0.24], [x, 1.5, 0], rail);
    const sign = new THREE.MeshStandardMaterial({
      map: labelTexture("TABLETOP RACERS  /  START", {
        width: 1024,
        height: 160,
        font: "bold 65px sans-serif",
      }),
      roughness: 0.7,
    });
    box(gate, [6.7, 0.8, 0.2], [0, 3.15, 0], sign);
    const checks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.35, 0.014, 0.28),
      material("#ede8d9"),
      32,
    );
    let n = 0;
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    for (let x = 0; x < 16; x++)
      for (let z = 0; z < 4; z++)
        if ((x + z) % 2 === 0) {
          dummy.position.set(-2.625 + x * 0.35, 0.025, z * 0.28 - 0.56);
          dummy.updateMatrix();
          checks.setMatrixAt(n++, dummy.matrix);
        }
    gate.add(checks);
  }
  setWeather(lap) {
    for (const patch of this.wetPatches)
      patch.visible = lap >= (patch.userData.storm ? 3 : 2);
  }
}
