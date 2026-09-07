import { clamp } from "../config.js";

const base = import.meta.env?.BASE_URL ?? "/";
export const MUSIC_TRACKS = Object.freeze({
  garage: Object.freeze({ title: "Airport Lounge", artist: "Kevin MacLeod", url: `${base}audio/music/airport-lounge.mp3`, source: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100806" }),
  race: Object.freeze({ title: "Go Cart", artist: "Kevin MacLeod", url: `${base}audio/music/go-cart.mp3`, source: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300006" }),
});
export const musicVolume = (settings) => Number.isFinite(settings.musicVolume)
  ? clamp(settings.musicVolume, 0, 1) : 0.28;
export const musicEnabled = (settings) => !settings.muted && !settings.musicMuted && musicVolume(settings) > 0;
export const hasAudioOutput = (settings) => !settings.muted && (
  (Number.isFinite(settings.volume) ? settings.volume > 0 : true) || musicEnabled(settings)
);

export class MusicManager {
  constructor(settings, onStatus = () => {}) {
    this.settings = settings;
    this.onStatus = onStatus;
    this.scene = "loading";
    this.trackId = "garage";
    this.hidden = false;
    this.preview = false;
    this.entries = new Map();
  }
  attach(context) {
    if (this.context === context) return;
    this.dispose();
    this.context = context;
    this.output = context.createGain();
    this.output.gain.value = 0;
    // Independent of the effects master; global mute still controls both.
    this.output.connect(context.destination);
  }
  entry(id) {
    if (this.entries.has(id)) return this.entries.get(id);
    const media = new Audio();
    media.preload = "none";
    media.loop = true;
    media.src = MUSIC_TRACKS[id].url;
    const source = this.context.createMediaElementSource(media);
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.output);
    const entry = { id, media, source, gain, pending: null, pauseTimer: null, failed: false };
    media.onplaying = media.onpause = () => this.report();
    media.onerror = () => { entry.failed = true; this.report(); };
    this.entries.set(id, entry);
    return entry;
  }
  setScene(scene) {
    this.scene = scene;
    this.preview = false;
    if (["garage", "results"].includes(scene)) this.trackId = "garage";
    else if (["countdown", "racing", "replay"].includes(scene)) this.trackId = "race";
    this.sync();
  }
  setHidden(hidden) {
    this.hidden = hidden;
    this.sync();
  }
  setPreview(preview) {
    this.preview = preview;
    this.sync();
  }
  wantsMusic() {
    return musicEnabled(this.settings) && !this.hidden &&
      (this.preview || ["garage", "results", "countdown", "racing", "replay"].includes(this.scene));
  }
  sync() {
    if (!this.output || this.context.state === "closed") { this.report(); return; }
    const audible = this.wantsMusic() && this.context.state === "running";
    if (audible) this.entry(this.trackId);
    const now = this.context.currentTime;
    this.output.gain.setTargetAtTime(audible ? musicVolume(this.settings) * 0.7 : 0, now, 0.035);
    for (const entry of this.entries.values()) {
      clearTimeout(entry.pauseTimer);
      const wanted = audible && entry.id === this.trackId && !entry.failed;
      entry.gain.gain.setTargetAtTime(wanted ? 1 : 0, now, 0.05);
      if (wanted) {
        if (entry.media.paused && !entry.pending) {
          entry.pending = entry.media.play().catch((error) => {
            if (error.name !== "AbortError") entry.failed = true;
          }).finally(() => {
            entry.pending = null;
            // A quick off/on while loading can abort the earlier play request.
            if (this.entries.get(entry.id) === entry && !entry.failed && entry.media.paused &&
              this.trackId === entry.id && this.wantsMusic() && this.context?.state === "running") this.sync();
            else this.report();
          });
        }
      } else {
        // Fade out before pausing; preserve the position for a smooth resume.
        entry.pauseTimer = setTimeout(() => { entry.media.pause(); this.report(); }, 180);
      }
    }
    this.report();
  }
  retry() {
    for (const entry of this.entries.values()) {
      if (entry.failed) { entry.failed = false; entry.media.load(); }
    }
  }
  inspect() {
    const entry = this.entries.get(this.trackId);
    return {
      trackId: this.trackId, title: MUSIC_TRACKS[this.trackId].title,
      status: entry?.failed ? "error" : !this.context ? "locked"
        : !this.wantsMusic() ? "paused" : !entry || entry.media.paused ? "loading" : "playing",
      time: entry?.media.currentTime ?? 0,
      playing: !!entry && !entry.media.paused && this.wantsMusic() && this.context?.state === "running",
      elements: this.entries.size,
    };
  }
  report() { this.onStatus(this.inspect()); }
  dispose() {
    for (const entry of this.entries.values()) {
      clearTimeout(entry.pauseTimer);
      entry.media.onplaying = entry.media.onpause = entry.media.onerror = null;
      entry.media.pause();
      entry.media.removeAttribute("src");
      entry.media.load();
      entry.source.disconnect();
      entry.gain.disconnect();
    }
    this.entries.clear();
    this.output?.disconnect();
    this.output = null;
    this.context = null;
  }
}
