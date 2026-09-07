import { clamp } from "../config.js";
import { MusicManager } from "./MusicManager.js";

export class AudioManager {
  constructor(settings, onStatus = () => {}, onMusicStatus = () => {}) {
    this.settings = settings;
    this.onStatus = onStatus;
    this.context = null;
    this.active = false;
    this.music = new MusicManager(settings, onMusicStatus);
  }
  async unlock() {
    let timer;
    try {
      if (!this.context || this.context.state === "closed") {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) {
          this.onStatus("unsupported");
          return false;
        }
        this.context = new Audio();
        this.context.onstatechange = () => {
          this.onStatus(this.context.state);
          this.music.sync();
        };
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.context.destination);
        // Gate race audio separately so settings tests can sound while paused.
        this.driving = this.context.createGain();
        this.driving.gain.value = 0;
        this.driving.connect(this.master);
        this.motor = this.context.createOscillator();
        this.motor.type = "sawtooth";
        this.motor.frequency.value = 100;
        this.filter = this.context.createBiquadFilter();
        this.filter.type = "lowpass";
        this.filter.frequency.value = 1400;
        this.motorGain = this.context.createGain();
        this.motorGain.gain.value = 0;
        this.motor.connect(this.filter);
        this.filter.connect(this.motorGain);
        this.motorGain.connect(this.driving);
        this.motor.start();
        const noise = this.context.createBuffer(
            1,
            this.context.sampleRate * 2,
            this.context.sampleRate,
          ),
          samples = noise.getChannelData(0);
        let seed = 13;
        for (let i = 0; i < samples.length; i++) {
          seed = (seed * 16807) % 2147483647;
          samples[i] = ((seed / 2147483647) * 2 - 1) * 0.2;
        }
        this.rain = this.context.createBufferSource();
        this.rain.buffer = noise;
        this.rain.loop = true;
        this.rainGain = this.context.createGain();
        this.rainGain.gain.value = 0;
        this.rain.connect(this.rainGain);
        this.rainGain.connect(this.driving);
        this.rain.start();
        this.music.attach(this.context);
      }
      if (this.context.state !== "running") {
        // Called from start/resume/sound clicks, inside the user's gesture.
        await Promise.race([
          this.context.resume(),
          new Promise((resolve) => { timer = setTimeout(resolve, 1200); }),
        ]);
      }
      this.music.retry();
      this.sync();
      this.onStatus(this.context.state);
      return this.context.state === "running";
    } catch {
      this.onStatus("error");
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  sync() {
    if (!this.master || !this.driving || this.context.state === "closed") return;
    const volume = Number.isFinite(this.settings.volume)
      ? clamp(this.settings.volume, 0, 1) : 0.5;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : volume, now, 0.02);
    this.driving.gain.setTargetAtTime(this.active ? 1 : 0, now, 0.02);
    this.music.sync();
  }
  setActive(active) {
    this.active = active;
    this.sync();
  }
  update(car, lap) {
    if (!this.motorGain || this.context.state === "closed") return;
    const now = this.context.currentTime;
    const frequency = 110 + car.speed * 38;
    this.motor.frequency.setTargetAtTime(frequency, now, 0.05);
    this.filter.frequency.setTargetAtTime(Math.max(1400, frequency * 3), now, 0.05);
    this.motorGain.gain.setTargetAtTime(
      car.speed > 0 ? 0.14 + (car.boosting ? 0.04 : 0) : 0,
      now,
      0.04,
    );
    this.rainGain.gain.setTargetAtTime(lap >= 3 ? 0.18 : 0, now, 0.2);
  }
  beep(frequency = 640, duration = 0.12, preview = false) {
    if (this.context?.state !== "running" || this.settings.muted || (!this.active && !preview)) return;
    const osc = this.context.createOscillator(),
      gain = this.context.createGain(),
      now = this.context.currentTime;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(preview ? this.master : this.driving);
    osc.start();
    osc.stop(now + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  impact() {
    if (this.context?.state !== "running" || this.settings.muted || !this.active) return;
    const hit = this.context.createBufferSource();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const now = this.context.currentTime;
    hit.buffer = this.rain.buffer;
    filter.type = "lowpass";
    filter.frequency.value = 1600;
    gain.gain.setValueAtTime(1.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    hit.connect(filter);
    filter.connect(gain);
    gain.connect(this.driving);
    hit.start();
    hit.stop(now + 0.18);
    hit.onended = () => { hit.disconnect(); filter.disconnect(); gain.disconnect(); };
    this.beep(95, 0.13);
  }
}
