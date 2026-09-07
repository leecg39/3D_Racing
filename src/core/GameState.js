const transitions = {
  loading: ["garage", "error"],
  garage: ["countdown", "error"],
  countdown: ["racing", "paused", "garage"],
  racing: ["paused", "results", "garage"],
  paused: ["racing", "countdown", "replay", "garage", "countdown"],
  results: ["countdown", "garage", "replay"],
  replay: ["results", "paused", "garage"],
  error: [],
};
export class GameState {
  constructor(onChange = () => {}) {
    this.value = "loading";
    this.onChange = onChange;
    this.previous = null;
  }
  set(next) {
    if (next === this.value) return false;
    if (!transitions[this.value]?.includes(next))
      throw new Error(`Invalid state: ${this.value} → ${next}`);
    this.previous = this.value;
    this.value = next;
    this.onChange(next, this.previous);
    return true;
  }
}
