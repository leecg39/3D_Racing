import * as THREE from "three";
export class WeatherSystem {
  constructor(scene, trackVisual) {
    this.scene = scene;
    this.trackVisual = trackVisual;
    this.lap = 1;
    this.enabled = true;
    this.positions = new Float32Array(420 * 6);
    for (let i = 0; i < 420; i++) {
      const j = i * 6,
        x = Math.sin(i * 71.13) * 36,
        y = (i * 7.37) % 24,
        z = Math.cos(i * 17.91) * 22;
      this.positions.set([x, y, z, x - 0.12, y + 0.65, z], j);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.rain = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: "#d6e6db",
        transparent: true,
        opacity: 0.42,
      }),
    );
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    scene.add(this.rain);
  }
  setLap(lap) {
    this.lap = lap;
    this.trackVisual.setWeather(lap);
    this.rain.visible = lap === 3 && this.enabled;
    this.scene.userData.sun.intensity = lap === 3 ? 2.2 : lap === 2 ? 2.9 : 3.5;
  }
  update(time) {
    if (!this.rain.visible) return;
    for (let i = 0; i < this.positions.length; i += 6) {
      const y = ((((((i / 6) * 7.37) % 24) - time * 20) % 24) + 24) % 24;
      this.positions[i + 1] = y;
      this.positions[i + 4] = y + 0.65;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }
}
