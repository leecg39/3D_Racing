import { CONFIG, CARS, clamp } from "../config.js";
const defaults = {
  selected: "zephyr",
  volume: 0.5,
  muted: false,
  quality: "balanced",
  reducedMotion: false,
  records: [],
};
export class Storage {
  constructor(adapter) {
    this.adapter = adapter;
    this.available = true;
    this.fresh = true;
    this.data = { ...defaults, records: [] };
    try {
      this.adapter = adapter === undefined ? globalThis.localStorage : adapter;
      const saved = JSON.parse(
        this.adapter?.getItem(CONFIG.storageKey) ?? "null",
      );
      if (saved && typeof saved === "object") {
        this.fresh = false;
        this.data.selected = CARS.some((c) => c.id === saved.selected)
          ? saved.selected
          : defaults.selected;
        this.data.volume = Number.isFinite(saved.volume)
          ? clamp(saved.volume, 0, 1)
          : defaults.volume;
        this.data.muted = typeof saved.muted === "boolean" ? saved.muted : defaults.muted;
        this.data.quality = ["balanced", "performance"].includes(saved.quality)
          ? saved.quality
          : defaults.quality;
        this.data.reducedMotion = saved.reducedMotion === true;
        this.data.records = Array.isArray(saved.records)
          ? saved.records
              .filter(
                (r) =>
                  r && CARS.some((c) => c.id === r.car) &&
                  Number.isFinite(r.total) &&
                  r.total > 0 &&
                  Number.isFinite(r.bestLap) &&
                  r.bestLap > 0 &&
                  Number.isInteger(r.position) &&
                  r.position >= 1 &&
                  r.position <= 4 &&
                  (r.laps === undefined || (Number.isInteger(r.laps) && r.laps > 0 && r.laps <= 100)),
              )
              .map((r) => ({ ...r, laps: r.laps ?? 3 }))
          : [];
        this.trimRecords();
      }
    } catch {
      this.available = false;
    }
  }
  save() {
    try {
      this.adapter?.setItem(CONFIG.storageKey, JSON.stringify(this.data));
    } catch {
      this.available = false;
    }
  }
  record(race) {
    const player = race.player;
    const entry = {
      car: player.id,
      laps: player.completedLaps,
      total: player.finishTime,
      bestLap: Math.min(...player.lapTimes),
      position: race.ranking().indexOf(player) + 1,
      date: new Date().toISOString(),
    };
    this.data.records.push(entry);
    this.trimRecords();
    this.save();
    return entry;
  }
  currentRecords() {
    return this.data.records.filter((record) => record.laps === CONFIG.laps);
  }
  trimRecords() {
    const counts = new Map();
    this.data.records.sort((a, b) => a.total - b.total);
    this.data.records = this.data.records.filter((record) => {
      const count = (counts.get(record.laps) ?? 0) + 1;
      counts.set(record.laps, count);
      return count <= 10;
    });
  }
}
