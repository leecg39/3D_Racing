import * as THREE from "three";
import {
  box,
  cylinder,
  material,
  woodTexture,
  matTexture,
  labelTexture,
} from "./materials.js";
import { atlasTexture, addAssetSprite } from "../assets.js";

function addLamp(parent, x, z, scale = 1) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.scale.setScalar(scale);
  parent.add(root);
  const metal = material("#39423c", 0.48, 0.3),
    brass = material("#b89555", 0.35, 0.65);
  cylinder(root, 0.85, 0.16, [0, 0.1, 0], metal);
  box(root, [0.13, 2.6, 0.13], [0.15, 1.35, 0], metal, [0, 0, -0.18]);
  box(root, [0.13, 2, 0.13], [-0.25, 3.3, 0], metal, [0, 0, 0.7]);
  cylinder(root, 0.14, 0.24, [0.37, 2.6, 0], brass, [Math.PI / 2, 0, 0]);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.78, 0.75, 32, 1, true),
    metal,
  );
  shade.position.set(-0.9, 4.2, 0);
  shade.rotation.z = -0.35;
  root.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 16, 12),
    new THREE.MeshStandardMaterial({
      color: "#fff7c2",
      emissive: "#ffe4a0",
      emissiveIntensity: 2,
    }),
  );
  bulb.position.set(-0.8, 3.98, 0);
  root.add(bulb);
}
function addProps(parent, large = false) {
  const scale = large ? 2.5 : 1;
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  parent.add(root);
  const paper = material("#ede5cf"),
    dark = material("#3d4842"),
    orange = material("#c96742"),
    metal = material("#b8bcbc", 0.35, 0.7);
  const books = new THREE.Group();
  books.position.set(large ? 9 : -5.1, 0, large ? -6 : -2.8);
  books.rotation.y = -0.18;
  root.add(books);
  for (let i = 0; i < 3; i++) {
    box(
      books,
      [2.1 + i * 0.1, 0.18, 2.8],
      [i * 0.08, 0.13 + i * 0.27, 0],
      paper,
    );
    box(
      books,
      [2.22 + i * 0.1, 0.03, 2.88],
      [i * 0.08, 0.24 + i * 0.27, 0],
      i === 1 ? dark : orange,
    );
  }
  const bookLabel = new THREE.MeshStandardMaterial({
    map: labelTexture("THE SMALL / MACHINES", {
      width: 512,
      height: 512,
      font: "bold 32px sans-serif",
      background: "#c96742",
      color: "#f2e4c9",
    }),
  });
  box(books, [1.9, 0.012, 2.4], [0.16, 0.8, 0], bookLabel);
  const tools = new THREE.Group();
  tools.position.set(large ? -10 : 5.1, 0, large ? 5.3 : 1.2);
  tools.rotation.y = 0.35;
  root.add(tools);
  cylinder(tools, 0.14, 1.5, [0, 0.16, 0], orange, [Math.PI / 2, 0, 0]);
  cylinder(tools, 0.045, 1.4, [0, 0.16, 1.2], metal, [Math.PI / 2, 0, 0]);
  box(tools, [0.35, 0.07, 3.6], [0.65, 0.06, 0], metal, [0, 0.04, 0]);
  for (let i = 0; i < 18; i++)
    box(
      tools,
      [i % 5 === 0 ? 0.15 : 0.08, 0.012, 0.015],
      [0.57, 0.101, -1.65 + i * 0.19],
      dark,
    );
  const mug = new THREE.Group();
  mug.position.set(large ? 11 : 5.3, 0, large ? 4 : -3.4);
  root.add(mug);
  cylinder(mug, 0.48, 0.95, [0, 0.48, 0], paper);
  cylinder(mug, 0.39, 0.016, [0, 0.958, 0], material("#3e2c22"));
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.09, 8, 20),
    paper,
  );
  handle.position.set(0.52, 0.5, 0);
  mug.add(handle);
  for (let i = 0; i < 3; i++)
    cylinder(
      root,
      0.055,
      2.4,
      [large ? -10 + i * 0.2 : -5.7 + i * 0.18, 0.09, large ? -5.2 : 2],
      i === 1 ? orange : dark,
      [Math.PI / 2, 0, 0.1 + i * 0.1],
      6,
    );
  addLamp(root, large ? -10 : -4.8, large ? -6 : -4.6, large ? 1.5 : 1);
}
export class WorkshopScene {
  constructor() {
    this.garage = this.makeScene();
    this.race = this.makeScene();
    const wood = new THREE.MeshStandardMaterial({
      map: woodTexture(),
      roughness: 0.82,
    });
    box(this.garage, [26, 0.6, 20], [0, -0.34, 0], wood);
    const mat = new THREE.MeshStandardMaterial({
      map: matTexture(),
      roughness: 0.9,
    });
    const cutting = box(this.garage, [10, 0.065, 7.5], [0, 0.015, 0], mat);
    cutting.rotation.y = 0.03;
    addProps(this.garage);
    box(this.race, [78, 1.8, 49], [0, -0.96, 0], wood);
    box(this.race, [69, 0.03, 40], [0, 0.015, 0], mat);
    addProps(this.race, true);
    const floor = material("#182732");
    box(this.race, [200, 1, 200], [0, -15, 0], floor);
    for (const x of [-32, 32])
      for (const z of [-17, 17])
        box(this.race, [2.2, 15, 2.2], [x, -8, z], material("#4c5048"));
    box(this.race, [150, 60, 1], [0, 10, -42], material("#d6d5c5"));
    const windowMat = new THREE.MeshBasicMaterial({ color: "#f5e8c8" });
    box(this.race, [35, 20, 0.3], [12, 14, -41], windowMat);
    for (const x of [-6, 12, 30])
      box(this.race, [0.7, 21, 0.8], [x, 14, -40.7], material("#898f80"));
    box(this.race, [37, 0.7, 0.8], [12, 14, -40.7], material("#898f80"));
    box(this.race, [37, 0.7, 2], [12, 3.5, -40.5], material("#a49b84"));
    this.addImageAssets();
  }
  addImageAssets() {
    const panorama = atlasTexture("workshop");
    panorama.repeat.set(1, 0.46);
    panorama.offset.set(0, 0.45);
    const panoramaMat = new THREE.MeshBasicMaterial({
      map: panorama,
      color: "#b3c4d4",
      toneMapped: false,
    });
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 12),
      panoramaMat,
    );
    backdrop.position.set(0, 4.4, -8.5);
    this.garage.add(backdrop);
    const raceBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(145, 53),
      panoramaMat,
    );
    raceBackdrop.position.set(0, 15, -38);
    this.race.add(raceBackdrop);
    for (const [x, z, angle] of [
      [65, 0, -Math.PI / 2],
      [-65, 0, Math.PI / 2],
      [0, 65, Math.PI],
    ]) {
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(145, 60),
        panoramaMat,
      );
      wall.position.set(x, 17, z);
      wall.rotation.y = angle;
      this.race.add(wall);
    }
    addAssetSprite(this.garage, "toolbox", [5.8, 0, -3], 2.4, -0.35);
    addAssetSprite(this.garage, "notebook", [-5.3, 0.04, 0.7], 1.8, 0.3);
    addAssetSprite(this.race, "fan", [-22, 0, -19], 15, 0.16);
    addAssetSprite(this.race, "toolbox", [28, 0, -16], 8, -0.25);
    addAssetSprite(this.race, "books", [-31, 0, 9], 6.5, 0.65);
    addAssetSprite(this.race, "rainSign", [21, 0, -10], 4.4);
    addAssetSprite(this.race, "pitSign", [-19, 0, 18], 3.3);
    addAssetSprite(this.race, "boostSign", [-7, 0, -3], 3.5);
    for (let i = 0; i < 5; i++)
      addAssetSprite(this.race, "cone", [-20 + i * 2, 0, 18], 1.2);
    const monitor = new THREE.Group();
    monitor.position.set(13, 0, -20);
    monitor.rotation.y = -0.2;
    this.race.add(monitor);
    box(monitor, [12, 8, 0.5], [0, 8, 0], material("#141e28"));
    box(monitor, [0.8, 4, 0.8], [0, 2, 0], material("#202c35"));
    box(monitor, [5, 0.3, 2.4], [0, 0.2, 0], material("#202c35"));
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(11.3, 7.3),
      new THREE.MeshBasicMaterial({
        map: atlasTexture("track"),
        toneMapped: false,
      }),
    );
    screen.position.set(0, 8, 0.26);
    monitor.add(screen);
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 6.75),
      new THREE.MeshBasicMaterial({
        map: atlasTexture("lineup"),
        toneMapped: false,
      }),
    );
    poster.position.set(-29, 10, -30);
    poster.rotation.y = 0.15;
    this.race.add(poster);
  }
  makeScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#14232e");
    scene.fog = new THREE.Fog("#14232e", 85, 180);
    scene.add(new THREE.HemisphereLight("#c4e0ff", "#283f44", 1.65));
    const sun = new THREE.DirectionalLight("#ffe6b0", 3.1);
    sun.position.set(-18, 35, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.normalBias = 0.012;
    sun.shadow.bias = -0.0001;
    scene.add(sun);
    scene.userData.sun = sun;
    const fill = new THREE.DirectionalLight("#d6e9f3", 1.2);
    fill.position.set(10, 8, -10);
    scene.add(fill);
    return scene;
  }
}
