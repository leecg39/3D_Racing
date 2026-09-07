import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { material, box, cylinder, labelTexture } from "../world/materials.js";
import { damp } from "../config.js";

let tireContactTexture;
function contactMaterial() {
  if (!tireContactTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    gradient.addColorStop(0, "rgba(0,0,0,0.8)");
    gradient.addColorStop(0.45, "rgba(0,0,0,0.45)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    tireContactTexture = new THREE.CanvasTexture(canvas);
  }
  return new THREE.MeshBasicMaterial({
    map: tireContactTexture, transparent: true, opacity: 0.65,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  });
}

// Cross sections create curved bodywork with separate fenders and an open chassis.
function loftGeometry(sections, xOffset = 0) {
  const positions = [],
    indices = [];
  for (const [z, w, base, h] of sections) {
    for (const [u, v] of [
      [-1, 0],
      [-1, 0.42],
      [-0.79, 0.87],
      [-0.38, 1],
      [0.38, 1],
      [0.79, 0.87],
      [1, 0.42],
      [1, 0],
    ])
      positions.push(xOffset + u * w, base + v * h, z);
  }
  for (let j = 0; j < sections.length - 1; j++)
    for (let i = 0; i < 8; i++) {
      const a = j * 8 + i,
        b = j * 8 + ((i + 1) % 8),
        c = a + 8,
        d = b + 8;
      indices.push(a, c, b, b, c, d);
    }
  for (const j of [0, sections.length - 1])
    for (let i = 1; i < 7; i++) {
      const a = j * 8;
      indices.push(
        ...(j === 0 ? [a, a + i, a + i + 1] : [a, a + i + 1, a + i]),
      );
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
function loft(parent, sections, mat, x = 0) {
  const mesh = new THREE.Mesh(loftGeometry(sections, x), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function mergeStatic(group) {
  const groups = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh || Array.isArray(child.material)) continue;
    child.updateMatrix();
    const geometry = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone();
    geometry.applyMatrix4(child.matrix);
    // Extruded sections need a UV attribute to merge with primitive geometry.
    if (!geometry.getAttribute("uv"))
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          new Float32Array(geometry.getAttribute("position").count * 2),
          2,
        ),
      );
    if (!groups.has(child.material)) groups.set(child.material, []);
    groups.get(child.material).push(geometry);
    child.geometry.dispose();
    group.remove(child);
  }
  for (const [mat, geometries] of groups) {
    const merged = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}
function numberDecal(parent, spec) {
  const mat = new THREE.MeshStandardMaterial({
    map: labelTexture(spec.number, {
      background: spec.bodyColor,
      color: spec.id === "bulldog" ? "#f4f6f8" : spec.color,
      width: 256,
      height: 256,
      font: "italic bold 133px sans-serif",
    }),
    roughness: 0.35,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), mat);
  mesh.rotation.x = -Math.PI / 2 + 0.2;
  mesh.position.set(0, 0.542, 1);
  parent.add(mesh);
}
export class CarModel {
  constructor(spec) {
    this.spec = spec;
    this.root = new THREE.Group();
    this.root.name = spec.id;
    this.parts = {};
    this.wheelPivots = [];
    this.explosion = 0;
    this.exploded = false;
    this.selectedPart = null;
    const paint = new THREE.MeshPhysicalMaterial({
      color: spec.color,
      roughness: 0.24,
      metalness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
    });
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: spec.bodyColor,
      roughness: 0.24,
      metalness: 0.26,
      clearcoat: 1,
    });
    const accent = material(spec.secondary, 0.32, 0.3),
      dark = material("#111921", 0.48, 0.25),
      carbon = material("#252b32", 0.7, 0.2);
    const rubber = material("#111619", 0.95),
      chrome = material("#c5cbd3", 0.21, 0.88),
      copper = material("#ca8d36", 0.35, 0.75);
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#08131c",
      roughness: 0.1,
      metalness: 0.65,
      clearcoat: 1,
    });
    const part = (name, explode) => {
      const g = new THREE.Group();
      g.name = name;
      g.userData.explode = new THREE.Vector3(...explode);
      this.parts[name] = g;
      this.root.add(g);
      return g;
    };
    const chassis = part("Chassis", [0, 0, 0]);
    loft(
      chassis,
      [
        [-1.8, 0.88, 0.26, 0.08],
        [-1.25, 0.84, 0.26, 0.12],
        [0, 0.72, 0.26, 0.12],
        [1.48, 0.84, 0.26, 0.09],
        [1.93, 1.03, 0.25, 0.07],
      ],
      carbon,
    );
    for (const x of [-0.65, 0.65])
      box(chassis, [0.11, 0.18, 2.8], [x, 0.44, -0.05], dark);
    for (const z of [-1.15, 1.1]) {
      cylinder(chassis, 0.06, 2.15, [0, 0.44, z], chrome, [0, 0, Math.PI / 2]);
      box(chassis, [1.48, 0.12, 0.28], [0, 0.385, z], dark);
    }
    for (const x of [-0.65, 0.65])
      for (const z of [-1.5, -0.3, 0.65, 1.6]) {
        cylinder(chassis, 0.065, 0.035, [x, 0.52, z], chrome, null, 8);
        box(chassis, [0.16, 0.06, 0.19], [x, 0.45, z], carbon);
      }
    for (let i = 0; i < 8; i++)
      box(chassis, [1.18, 0.09, 0.06], [0, 0.37, -0.9 + i * 0.27], dark);
    const body = part("BodyShell", [0, 1.6, 0]);
    const heavy = spec.shell === "wide",
      long = spec.shell === "long",
      compact = spec.shell === "compact";
    const nose = long ? 1.88 : compact ? 1.56 : 1.78;
    loft(
      body,
      [
        [-1.45, 0.36, 0.52, 0.2],
        [-0.85, heavy ? 0.52 : 0.46, 0.56, 0.32],
        [-0.2, 0.46, 0.52, 0.28],
        [0.4, heavy ? 0.34 : 0.3, 0.47, 0.22],
        [1.08, heavy ? 0.3 : 0.23, 0.36, 0.15],
        [nose, heavy ? 0.26 : 0.095, 0.3, 0.07],
      ],
      shellMat,
    );
    loft(
      body,
      [
        [-0.82, 0.17, 0.8, 0.1],
        [-0.62, 0.26, 0.78, 0.26],
        [-0.15, 0.255, 0.74, 0.32],
        [0.18, 0.19, 0.65, 0.26],
        [0.58, 0.055, 0.56, 0.04],
      ],
      glass,
    );
    for (const side of [-1, 1]) {
      const x = side * (heavy ? 0.94 : 0.88),
        w = heavy ? 0.37 : long ? 0.285 : 0.31;
      loft(
        body,
        [
          [-1.6, w * 0.6, 0.47, 0.18],
          [-1.35, w, 0.51, 0.35],
          [-0.95, w, 0.6, 0.29],
          [-0.58, w * 0.76, 0.53, 0.21],
          [-0.35, w * 0.35, 0.45, 0.05],
        ],
        paint,
        x,
      );
      loft(
        body,
        [
          [0.24, w * 0.47, 0.39, 0.12],
          [0.65, w * 0.87, 0.44, 0.26],
          [1.05, w, 0.53, 0.31],
          [1.38, w * 0.92, 0.44, heavy ? 0.35 : 0.27],
          [1.74, w * 0.61, 0.29, 0.09],
        ],
        paint,
        x,
      );
      loft(
        body,
        [
          [0.44, 0.035, 0.64, 0.01],
          [1.03, 0.045, 0.845, 0.015],
          [1.45, 0.035, 0.62, 0.01],
          [1.68, 0.025, 0.405, 0.008],
        ],
        accent,
        x - side * 0.055,
      );
      loft(
        body,
        [
          [-1.48, 0.034, 0.76, 0.01],
          [-1.05, 0.04, 0.897, 0.01],
          [-0.59, 0.025, 0.737, 0.01],
        ],
        heavy ? chrome : accent,
        x,
      );
      loft(
        body,
        [
          [-0.65, 0.16, 0.45, 0.15],
          [-0.05, 0.19, 0.48, 0.21],
          [0.4, 0.09, 0.36, 0.1],
        ],
        heavy ? carbon : paint,
        side * 0.59,
      );
      for (let i = 0; i < (heavy ? 5 : 3); i++)
        box(
          body,
          [heavy ? 0.25 : 0.14, 0.025, 0.04],
          [
            x,
            heavy ? 0.79 - i * 0.016 : 0.73,
            heavy ? 1.18 + i * 0.055 : -0.58 + i * 0.095,
          ],
          dark,
          [heavy ? 0.35 : 0, 0, 0],
        );
      if (heavy) box(body, [0.26, 0.1, 0.3], [x, 0.5, 1.56], dark, [0.5, 0, 0]);
      for (const z of [-1.43, 1.64])
        cylinder(
          body,
          0.025,
          0.01,
          [x, z > 0 ? 0.41 : 0.76, z],
          chrome,
          null,
          8,
        );
    }
    loft(
      body,
      [
        [0.45, 0.065, 0.69, 0.006],
        [1, 0.06, 0.53, 0.006],
        [nose - 0.09, 0.036, 0.384, 0.005],
      ],
      heavy ? paint : accent,
    );
    numberDecal(body, spec);
    if (compact)
      for (const side of [-1, 1])
        box(body, [0.1, 0.12, 0.58], [side * 0.53, 0.84, -0.74], paint, [
          0,
          0,
          -side * 0.15,
        ]);
    const motor = part("Motor", [-0.65, 0.85, -0.65]);
    cylinder(motor, 0.23, 0.7, [0, 0.6, -0.9], chrome, [0, 0, Math.PI / 2], 32);
    for (const x of [-0.37, 0.37])
      cylinder(motor, 0.21, 0.055, [x, 0.6, -0.9], dark, [0, 0, Math.PI / 2]);
    cylinder(
      motor,
      0.08,
      0.18,
      [0.46, 0.6, -0.9],
      copper,
      [0, 0, Math.PI / 2],
      12,
    );
    for (let i = 0; i < 6; i++)
      box(motor, [0.026, 0.075, 0.28], [-0.25 + i * 0.1, 0.81, -0.9], carbon);
    const gears = part("GearAssembly", [1.08, 0.7, -0.22]);
    for (const [x, z, r] of [
      [0.55, -1.15, 0.2],
      [0.56, -0.9, 0.12],
      [0.63, -1.02, 0.16],
    ]) {
      cylinder(
        gears,
        r,
        0.07,
        [x, 0.45, z],
        x > 0.6 ? paint : copper,
        [0, 0, Math.PI / 2],
        16,
      );
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        box(
          gears,
          [0.075, 0.05, 0.05],
          [x, 0.45 + Math.sin(a) * r, z + Math.cos(a) * r],
          copper,
          [a, 0, 0],
        );
      }
    }
    const batteries = part("BatteryPack", [0, 0.7, 0.8]);
    for (const x of [-0.28, 0.28]) {
      cylinder(batteries, 0.15, 1.05, [x, 0.48, -0.11], dark, [
        Math.PI / 2,
        0,
        0,
      ]);
      cylinder(batteries, 0.153, 0.2, [x, 0.48, 0.3], accent, [
        Math.PI / 2,
        0,
        0,
      ]);
      cylinder(batteries, 0.08, 0.04, [x, 0.48, 0.44], chrome, [
        Math.PI / 2,
        0,
        0,
      ]);
      box(batteries, [0.1, 0.012, 0.6], [x, 0.635, -0.1], chrome);
    }
    const wheels = part("Wheels", [0, 0.1, 0]);
    this.tireRadius = (heavy ? 0.43 : 0.405) + 0.006;
    for (const z of [-1.15, 1.1])
      cylinder(chassis, 0.045, 1.98, [0, 0.43, z], chrome, [0, 0, Math.PI / 2], 12);
    for (const x of [-0.99, 0.99])
      for (const z of [-1.15, 1.1]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.43, z);
        pivot.userData.base = pivot.position.clone();
        pivot.userData.side = Math.sign(x);
        wheels.add(pivot);
        this.wheelPivots.push(pivot);
        cylinder(
          pivot,
          heavy ? 0.43 : 0.405,
          0.33,
          [0, 0, 0],
          rubber,
          [0, 0, Math.PI / 2],
          40,
        );
        cylinder(pivot, 0.31, 0.348, [0, 0, 0], dark, [0, 0, Math.PI / 2], 32);
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.269, 0.023, 8, 32),
          accent,
        );
        rim.rotation.y = Math.PI / 2;
        rim.position.x = Math.sign(x) * 0.181;
        pivot.add(rim);
        cylinder(
          pivot,
          0.084,
          0.375,
          [0, 0, 0],
          accent,
          [0, 0, Math.PI / 2],
          12,
        );
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          box(
            pivot,
            [0.359, 0.042, 0.235],
            [0, Math.sin(a) * 0.152, Math.cos(a) * 0.152],
            accent,
            [-a, 0, 0],
          );
        }
        cylinder(
          pivot,
          0.034,
          0.386,
          [0, 0, 0],
          chrome,
          [0, 0, Math.PI / 2],
          8,
        );
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * Math.PI * 2;
          box(
            pivot,
            [0.22, 0.012, 0.037],
            [
              0,
              Math.sin(a) * (heavy ? 0.43 : 0.405),
              Math.cos(a) * (heavy ? 0.43 : 0.405),
            ],
            carbon,
            [Math.PI / 2 - a, 0, 0],
          );
        }
        mergeStatic(pivot);
      }
    const rollers = part("Rollers", [0, 0.8, 0]);
    for (const x of [-1.18, 1.18])
      for (const z of [-1.7, 1.91]) {
        box(rollers, [0.55, 0.055, 0.15], [x * 0.82, 0.35, z], carbon);
        cylinder(rollers, 0.215, 0.055, [x, 0.43, z], rubber);
        cylinder(rollers, 0.17, 0.025, [x, 0.47, z], chrome);
        cylinder(rollers, 0.068, 0.23, [x, 0.565, z], chrome);
        cylinder(rollers, 0.04, 0.02, [x, 0.69, z], dark, null, 8);
      }
    const wing = part("RearWing", [0, 1.75, -0.62]),
      wingWidth = heavy ? 2.12 : long ? 1.82 : 2.02;
    for (const x of [-0.46, 0.46])
      box(wing, [0.12, 0.42, 0.17], [x, 0.92, -1.38], carbon, [-0.28, 0, 0]);
    box(
      wing,
      [wingWidth, 0.055, 0.44],
      [0, 1.16, -1.53],
      heavy ? dark : paint,
      [0.13, 0, 0],
    );
    box(wing, [wingWidth, 0.095, 0.06], [0, 1.21, -1.73], heavy ? dark : paint);
    for (const x of [-wingWidth / 2, wingWidth / 2])
      loft(
        wing,
        [
          [-1.8, 0.027, 1.15, 0.25],
          [-1.5, 0.027, 1.15, 0.22],
          [-1.28, 0.027, 1.14, 0.12],
        ],
        paint,
        x,
      );
    for (const x of [-0.59, 0.59]) {
      box(
        wing,
        [0.23, 0.008, 0.42],
        [x, 1.199, -1.52],
        heavy ? paint : shellMat,
        [0.13, 0, 0],
      );
      box(
        wing,
        [0.055, 0.009, 0.42],
        [x + 0.14, 1.2, -1.52],
        accent,
        [0.13, 0, 0],
      );
    }
    Object.values(this.parts).forEach(mergeStatic);
    this.flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.19, 0.85, 12),
      new THREE.MeshBasicMaterial({
        color: "#4acfff",
        transparent: true,
        opacity: 0.82,
      }),
    );
    this.flame.rotation.x = -Math.PI / 2;
    this.flame.position.set(0, 0.43, -2.05);
    this.flame.visible = false;
    this.root.add(this.flame);
    const sparkPositions = new Float32Array(18 * 3);
    for (let i = 0; i < 18; i++) {
      sparkPositions[i * 3] = (i % 3) * 0.09;
      sparkPositions[i * 3 + 1] = 0.12 + ((i * 7) % 11) * 0.035;
      sparkPositions[i * 3 + 2] = -0.8 + ((i * 5) % 17) * 0.09;
    }
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    this.sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({
      color: "#ffb43c", size: 0.085, transparent: true, depthWrite: false,
    }));
    this.sparks.visible = false;
    this.root.add(this.sparks);
    // Local contact occlusion remains visible even in shadow-free performance mode.
    this.contactShadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.58, 0.66), contactMaterial(), 4);
    this.contactShadows.frustumCulled = false;
    this.contactMatrix = new THREE.Object3D();
    this.contactMatrix.rotation.x = -Math.PI / 2;
    this.root.add(this.contactShadows);
  }
  update(dt, { speed = 0, boost = false, wheelTest = false, impact = 0, impactSide = 0 } = {}) {
    this.explosion = damp(this.explosion, this.exploded ? 1 : 0, 6, dt);
    for (const group of Object.values(this.parts))
      group.position
        .copy(group.userData.explode)
        .multiplyScalar(this.explosion);
    for (const pivot of this.wheelPivots) {
      pivot.position.copy(pivot.userData.base);
      pivot.position.x =
        pivot.userData.base.x + pivot.userData.side * this.explosion * 0.85;
      pivot.rotation.x += dt * (wheelTest ? 13 : speed / this.tireRadius);
    }
    this.flame.visible = boost;
    this.sparks.visible = impact > 0;
    this.sparks.position.set(impactSide * 1.3, 0.12, 0);
    this.sparks.scale.set(impactSide || 1, 1 + (1 - impact) * 2, 1 + (1 - impact) * 2);
    this.sparks.material.opacity = impact;
    this.updateContactShadows();
  }
  updateContactShadows() {
    this.contactShadows.visible = this.explosion < 0.05;
    this.wheelPivots.forEach((wheel, i) => {
      this.contactMatrix.position.copy(wheel.position);
      this.contactMatrix.position.y -= this.tireRadius - 0.014 / this.root.scale.x;
      this.contactMatrix.updateMatrix();
      this.contactShadows.setMatrixAt(i, this.contactMatrix.matrix);
    });
    this.contactShadows.instanceMatrix.needsUpdate = true;
  }
  selectPart(name) {
    this.selectedPart = name;
  }
  assembled() {
    this.exploded = false;
    this.explosion = 0;
    this.update(0);
    this.selectPart(null);
  }
}
