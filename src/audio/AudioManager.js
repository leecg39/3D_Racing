export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.active = false;
  }
  async unlock() {
    try {
      if (!this.context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.context.destination);
        this.motor = this.context.createOscillator();
        this.motor.type = "sawtooth";
        this.motor.frequency.value = 100;
        this.filter = this.context.createBiquadFilter();
        this.filter.type = "lowpass";
        this.filter.frequency.value = 700;
        this.motorGain = this.context.createGain();
        this.motorGain.gain.value = 0;
        this.motor.connect(this.filter);
        this.filter.connect(this.motorGain);
        this.motorGain.connect(this.master);
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
        this.rainGain.connect(this.master);
        this.rain.start();
      }
      await this.context.resume();
    } catch {
      /* The rest of the game remains available without audio. */
    }
  }
  setActive(active) {
    this.active = active;
    if (this.context)
      this.master.gain.setTargetAtTime(
        active && !this.settings.muted ? this.settings.volume : 0,
        this.context.currentTime,
        0.04,
      );
  }
  update(car, lap) {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.motor.frequency.setTargetAtTime(110 + car.speed * 38, now, 0.05);
    this.motorGain.gain.setTargetAtTime(
      car.speed > 0 ? 0.065 + (car.boosting ? 0.025 : 0) : 0,
      now,
      0.04,
    );
    this.rainGain.gain.setTargetAtTime(lap === 3 ? 0.18 : 0, now, 0.2);
  }
  beep(frequency = 640, duration = 0.12) {
    if (!this.context || this.settings.muted || !this.active) return;
    const osc = this.context.createOscillator(),
      gain = this.context.createGain(),
      now = this.context.currentTime;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(now + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}
