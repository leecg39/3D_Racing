import { CONFIG } from "../config.js";
export class FixedClock {
  constructor() {
    this.accumulator = 0;
  }
  advance(delta, update) {
    this.accumulator += Math.min(Math.max(delta, 0), CONFIG.maxFrame);
    while (this.accumulator + 1e-10 >= CONFIG.step) {
      this.accumulator -= CONFIG.step;
      update(CONFIG.step);
    }
    return Math.max(0, this.accumulator / CONFIG.step);
  }
  reset() {
    this.accumulator = 0;
  }
}
export class GameLoop {
  constructor(update, render) {
    this.clock = new FixedClock();
    this.last = null;
    this.frame = (now) => {
      if (!this.running) return;
      const delta = this.last === null ? 0 : (now - this.last) / 1000;
      this.last = now;
      const alpha = this.clock.advance(delta, update);
      render(Math.min(delta, CONFIG.maxFrame), alpha);
      if (this.running) this.raf = requestAnimationFrame(this.frame);
    };
  }
  start() {
    this.running = true;
    this.raf = requestAnimationFrame(this.frame);
  }
  reset() {
    this.clock.reset();
    this.last = null;
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
