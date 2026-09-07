import * as THREE from "three";
export const material = (color, roughness = 0.65, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
export function box(parent, size, position, mat, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function cylinder(
  parent,
  radius,
  height,
  position,
  mat,
  rotation = null,
  segments = 24,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    mat,
  );
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function labelTexture(
  text,
  {
    background = "#eee9d9",
    color = "#253330",
    width = 512,
    height = 128,
    font = "bold 64px sans-serif",
  } = {},
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function woodTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#806244";
  ctx.fillRect(0, 0, 1024, 512);
  let seed = 73;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 1300; i++) {
    const y = random() * 512;
    ctx.strokeStyle = `rgba(99,65,38,${random() * 0.095})`;
    ctx.lineWidth = 0.4 + random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(300, y + random() * 12, 700, y - random() * 12, 1024, y);
    ctx.stroke();
  }
  for (let i = 1; i < 5; i++) {
    ctx.fillStyle = "#9f7d5840";
    ctx.fillRect(0, i * 102, 1024, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}
export function matTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#153b3c";
  ctx.fillRect(0, 0, 1024, 768);
  for (let i = 0; i <= 1024; i += 16) {
    ctx.strokeStyle = i % 64 === 0 ? "#b8c2a458" : "#b8c2a422";
    ctx.lineWidth = i % 64 === 0 ? 1.3 : 0.65;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 768);
    ctx.stroke();
  }
  for (let i = 0; i <= 768; i += 16) {
    ctx.strokeStyle = i % 64 === 0 ? "#b8c2a458" : "#b8c2a422";
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }
  ctx.strokeStyle = "#d2d6b080";
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, 972, 716);
  ctx.fillStyle = "#d2d6b0";
  ctx.font = "bold 15px monospace";
  for (let i = 1; i < 16; i++) ctx.fillText(String(i), i * 64 + 4, 48);
  ctx.font = "bold 20px monospace";
  ctx.fillText("WORKBENCH / PRECISION CUTTING MAT", 50, 703);
  ctx.font = "15px monospace";
  ctx.fillText("A2  ·  1:32  ·  STUDIO SERIES", 660, 703);
  for (const r of [45, 70, 100]) {
    ctx.beginPath();
    ctx.arc(880, 150, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function disposeObject(root) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  root.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material)
      for (const mat of Array.isArray(child.material)
        ? child.material
        : [child.material]) {
        materials.add(mat);
        if (mat.map) textures.add(mat.map);
      }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
  root.removeFromParent();
}
