const drivingKeys = new Set([
  "KeyA",
  "KeyD",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
]);
export class InputManager {
  constructor({ onPause, onCamera, onBlur, active }) {
    this.keys = new Set();
    this.active = active;
    this.down = (event) => {
      if (
        event.target.matches("input, select, textarea") ||
        event.target.closest("dialog")
      )
        return;
      if (this.active() && drivingKeys.has(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.keys.add(event.code);
      if (["Escape", "KeyP"].includes(event.code)) onPause();
      if (event.code === "KeyC") onCamera();
      if (/^Digit[1-6]$/.test(event.code))
        onCamera(Number(event.code.slice(-1)) - 1);
    };
    this.up = (event) => this.keys.delete(event.code);
    this.blur = () => {
      this.clear();
      onBlur();
    };
    this.visibility = () => {
      if (document.hidden) this.blur();
    };
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
    document.addEventListener("visibilitychange", this.visibility);
  }
  read() {
    return {
      steer:
        Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
        Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")),
      boost: this.keys.has("Space"),
      stabilize: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
    };
  }
  clear() {
    this.keys.clear();
  }
  dispose() {
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibility);
  }
}
